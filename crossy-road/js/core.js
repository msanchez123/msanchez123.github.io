/* core.js: shared namespace, rng, voxel builder, renderer, camera, audio, particles, shared clock, event bus. */
(function () {
'use strict';
const T = THREE;
const AH = window.AH = { T: T };
AH.COLS = 7; AH.MINROW = -8; AH.WRAP = 22; AH.PER = 44;
AH.JD = 0.17; AH.LOGTOP = 0.17; AH.PADY = 0.08; AH.FLYY = 1.9;
AH.DIRS = { F: [0, -1], B: [0, 1], L: [-1, 0], R: [1, 0] };
AH.ARENA_EVERY = 50; AH.ARENA_LEN = 15;
AH.chars = [];
const clamp = AH.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
AH.lerp = (a, b, t) => a + (b - a) * t;
AH.$ = id => document.getElementById(id);

/* ---- fixed 100% UI baseline ----
 * The page forces a 1:1 viewport (no pinch zoom, no text inflation) and every CSS size is  N * var(--u).
 * --u is recomputed from the real viewport, so browser zoom and system font scaling cannot push text off screen:
 * zooming in shrinks innerWidth, which shrinks --u by the same factor, and the UI lands at the same physical size. */
(function () {
  let mv = document.querySelector('meta[name=viewport]');
  if (!mv) { mv = document.createElement('meta'); mv.name = 'viewport'; document.head.appendChild(mv); }
  mv.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  const root = document.documentElement;
  AH.uPx = 1;
  AH.fitUI = function () {
    const vv = window.visualViewport;
    const w = (vv && vv.width) || window.innerWidth, h = (vv && vv.height) || window.innerHeight;
    // 390x720 css px is the design size; clamp keeps tiny and huge screens usable
    const u = Math.max(0.72, Math.min(1.55, Math.min(w / 390, h / 720)));
    AH.uPx = u; root.style.setProperty('--u', (u).toFixed(4) + 'px');
  };
  AH.fitUI();
  window.addEventListener('resize', AH.fitUI);
  window.addEventListener('orientationchange', function () { setTimeout(AH.fitUI, 120); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', AH.fitUI);
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) { document.addEventListener(n, function (e) { e.preventDefault(); }, { passive: false }); });
  document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
})();
AH.calm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

/* ---- rng: world stream is seeded per room/round so every phone builds the same course ---- */
AH.seeded = function (str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
let gen = Math.random;
AH.setSeed = s => { gen = s ? AH.seeded(s) : Math.random; };
AH.rand = () => gen();
AH.rnd = (a, b) => a + gen() * (b - a);
AH.ri = (a, b) => Math.floor(AH.rnd(a, b + 1));
AH.prnd = (a, b) => a + Math.random() * (b - a); // cosmetic only

/* ---- event bus ---- */
const subs = {};
AH.on = (n, f) => { (subs[n] = subs[n] || []).push(f); };
AH.emit = (n, a, b) => { (subs[n] || []).forEach(f => f(a, b)); };

/* ---- shared clock (offset is estimated by net.js so hazards line up on every phone) ---- */
AH.clock = { off: 0 };
AH.now = () => (Date.now() + AH.clock.off) / 1000;

/* ---- voxel builder ---- */
const U = (function () {
  const g = new T.BoxGeometry(1, 1, 1).toNonIndexed();
  return { p: g.attributes.position.array, n: g.attributes.normal.array, c: g.attributes.position.count };
})();
function Builder() { this.p = []; this.n = []; this.c = []; }
Builder.prototype.box = function (w, h, d, color, x, y, z) {
  const col = new T.Color(color);
  for (let i = 0; i < U.c; i++) {
    this.p.push(U.p[i * 3] * w + x, U.p[i * 3 + 1] * h + y, U.p[i * 3 + 2] * d + z);
    this.n.push(U.n[i * 3], U.n[i * 3 + 1], U.n[i * 3 + 2]);
    this.c.push(col.r, col.g, col.b);
  }
  return this;
};
Builder.prototype.build = function () {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
  g.computeBoundingSphere();
  return g;
};
AH.Builder = Builder;
AH.VM = new T.MeshLambertMaterial({ vertexColors: true });
AH.VMG = new T.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.26, depthWrite: false });
AH.FIREMAT = new T.MeshLambertMaterial({ vertexColors: true, emissive: 0xff5a00, emissiveIntensity: 0.4 });
const flat = {};
AH.M = c => flat[c] || (flat[c] = new T.MeshLambertMaterial({ color: c }));
AH.BOX = new T.BoxGeometry(1, 1, 1);
AH.hex = c => '#' + c.toString(16).padStart(6, '0');

/* ---- renderer, camera, lights ---- */
const stage = AH.stage = AH.$('stage');
const renderer = AH.renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
AH.$('gl').appendChild(renderer.domElement);
const scene = AH.scene = new T.Scene();
const camera = AH.camera = new T.OrthographicCamera(-5, 5, 5, -5, 0.1, 160);
const CAM_OFF = new T.Vector3(4.5, 11, 9);
const hemi = AH.hemi = new T.HemisphereLight(0xffffff, 0x9aa8b8, 0.62);
scene.add(hemi);
const sun = AH.sun = new T.DirectionalLight(0xffffff, 0.5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 });
scene.add(sun, sun.target);

AH.resize = function () {
  const w = stage.clientWidth || window.innerWidth, h = stage.clientHeight || window.innerHeight;
  renderer.setSize(w, h);
  const a = w / h; let hw, hh;
  if (a < 1) { hw = 6.4; hh = hw / a; } else { hh = 9.5; hw = hh * a; }
  camera.left = -hw; camera.right = hw; camera.top = hh; camera.bottom = -hh;
  camera.updateProjectionMatrix();
};
window.addEventListener('resize', AH.resize);
if (window.ResizeObserver) new ResizeObserver(AH.resize).observe(stage);

/* Each client owns its camera: it follows that client's own fox (or whoever it is spectating). */
AH.cam = {
  focus: new T.Vector3(), tx: 0, tz: 0, shake: 0,
  snap(x, z) { this.tx = x; this.tz = z; this.focus.set(x, 0, z); },
  update(dt) {
    const f = this.focus;
    f.x += (this.tx - f.x) * Math.min(1, dt * 5);
    f.z += (this.tz - f.z) * Math.min(1, dt * 6);
    const amp = AH.calm ? 0 : this.shake;
    this.shake = Math.max(0, this.shake - dt * 1.2);
    const ox = amp ? AH.prnd(-amp, amp) : 0, oz = amp ? AH.prnd(-amp, amp) : 0;
    camera.position.set(f.x + CAM_OFF.x + ox, CAM_OFF.y, f.z + CAM_OFF.z + oz);
    camera.lookAt(f.x + ox, 0, f.z + oz);
    const sx = Math.round(f.x / 2) * 2, sz = Math.round(f.z / 2) * 2;
    sun.position.set(sx - 4, 14, sz + 6); sun.target.position.set(sx, 0, sz); sun.target.updateMatrixWorld();
  }
};

/* ---- audio ---- */
let AC = null;
AH.audio = function () {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') AC.resume().catch(function () {});
};
AH.beep = function (f, d, type, v, slide) {
  if (!AC) return;
  try {
    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(v || 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d);
  } catch (e) {}
};

/* ---- particles ---- */
const parts = [];
AH.burst = function (n, x, y, z, colors, sp, up) {
  for (let i = 0; i < n; i++) {
    if (parts.length > 120) return;
    const m = new T.Mesh(AH.BOX, AH.M(colors[i % colors.length]));
    const s = AH.prnd(0.08, 0.2); m.scale.set(s, s, s); m.position.set(x, y, z); scene.add(m);
    const a = Math.random() * 6.283, v = AH.prnd(0.4, 1) * sp;
    parts.push({ m: m, vx: Math.cos(a) * v, vy: AH.prnd(0.5, 1) * up, vz: Math.sin(a) * v, life: AH.prnd(0.45, 0.9) });
  }
};
AH.updateParts = function (dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.vy -= 18 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
    p.life -= dt;
    if (p.life <= 0 || p.m.position.y < -1.5) { scene.remove(p.m); parts.splice(i, 1); }
  }
};
AH.clearParts = function () { parts.forEach(p => scene.remove(p.m)); parts.length = 0; };
})();
