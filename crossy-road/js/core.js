/* core.js: shared namespace, rng, voxel builder, renderer, camera, audio, particles, shared clock, event bus. */
(function () {
'use strict';
const T = THREE;
const AH = window.AH = { T: T };
AH.COLS = 7; AH.MINROW = 0; AH.WRAP = 22; AH.PER = 44;
AH.JD = 0.17; AH.LOGTOP = 0.17; AH.PADY = 0.08; AH.FLYY = 1.9;
AH.DIRS = { F: [0, -1], B: [0, 1], L: [-1, 0], R: [1, 0] };
AH.ARENA_EVERY = 100; AH.ARENA_LEN = 15; AH.PERIOD = AH.ARENA_EVERY + AH.ARENA_LEN;
/* arenas sit EVERY normal lanes apart (the arena itself is not counted): first at EVERY, then every PERIOD */
AH.nextArena = r => r < AH.ARENA_EVERY ? AH.ARENA_EVERY : AH.ARENA_EVERY + (Math.floor((r - AH.ARENA_EVERY) / AH.PERIOD) + 1) * AH.PERIOD;
AH.arenaIdx = A => Math.round((A - AH.ARENA_EVERY) / AH.PERIOD);
/* score = lanes crossed, with the arenas themselves removed, so every stretch between bosses is the same length */
AH.scoreOf = r => { if (r < AH.ARENA_EVERY) return Math.max(0, r); const o = r - AH.ARENA_EVERY, k = Math.floor(o / AH.PERIOD), q = o % AH.PERIOD; return q < AH.ARENA_LEN ? AH.ARENA_EVERY * (k + 1) : r - (k + 1) * AH.ARENA_LEN; };
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
/* Two independent streams, both re-seeded per row from (seed, row):
 *   layout  (AH.lrand/lrnd/lri) - everything that decides WHAT is where: lane types, obstacles, logs, cars, timings. This is the level.
 *   deco    (AH.rand/rnd/ri)    - purely visual choices: tuft positions, rock shapes, colours. Changing any decoration can never change the level.
 * Because each row has its own streams, a row's layout depends only on the seed, its row number and the course state, never on how much decoration came before. */
let seedStr = null, lgen = Math.random, dgen = Math.random;
AH.setSeed = s => { seedStr = s || null; lgen = dgen = Math.random; };
AH.seedLayout = r => { if (seedStr) lgen = AH.seeded(seedStr + ':L:' + r); };
AH.seedDeco = r => { if (seedStr) dgen = AH.seeded(seedStr + ':D:' + r); };
AH.lrand = () => lgen();
AH.lrnd = (a, b) => a + lgen() * (b - a);
AH.lri = (a, b) => Math.floor(AH.lrnd(a, b + 1));
AH.rand = () => dgen();
AH.rnd = (a, b) => a + dgen() * (b - a);
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
/* a triangular prism: the cross-section is a triangle in x/y (base w wide, apex h high), extruded d deep along z. Used for hills and mountains. */
Builder.prototype.prism = function (w, h, d, color, x, y, z) {
  const col = new T.Color(color), hw = w / 2, hd = d / 2, nl = Math.hypot(h, hw), nx = h / nl, ny = hw / nl;
  const Lf = [x - hw, y, z + hd], Rf = [x + hw, y, z + hd], Tf = [x, y + h, z + hd], Lb = [x - hw, y, z - hd], Rb = [x + hw, y, z - hd], Tb = [x, y + h, z - hd];
  const tri = (a, b2, c2, n) => [a, b2, c2].forEach(v => { this.p.push(v[0], v[1], v[2]); this.n.push(n[0], n[1], n[2]); this.c.push(col.r, col.g, col.b); });
  tri(Lf, Rf, Tf, [0, 0, 1]); tri(Rb, Lb, Tb, [0, 0, -1]);
  tri(Rf, Rb, Tb, [nx, ny, 0]); tri(Rf, Tb, Tf, [nx, ny, 0]);
  tri(Lb, Lf, Tb, [-nx, ny, 0]); tri(Lf, Tf, Tb, [-nx, ny, 0]);
  return this;
};
/* a right-triangle wedge (windshields, ramps): base len along x and wid along z sitting at height y, the tall end h high at the -x end when sd > 0 (+x end when sd < 0), sloping down to nothing at the other end. */
Builder.prototype.wedge = function (len, h, wid, color, x, y, z, sd) {
  const col = new T.Color(color), s = sd < 0 ? -1 : 1, hl = len / 2, hw = wid / 2, nl = Math.hypot(h, len), nx = h / nl * s, ny = len / nl;
  const tallX = x - s * hl, lowX = x + s * hl;
  const tri = (a, b2, c2, n, k) => [a, b2, c2].forEach(v => { this.p.push(v[0], v[1], v[2]); this.n.push(n[0], n[1], n[2]); this.c.push(col.r * k, col.g * k, col.b * k); });
  const A0 = [tallX, y, z - hw], A1 = [lowX, y, z - hw], A2 = [tallX, y + h, z - hw], B0 = [tallX, y, z + hw], B1 = [lowX, y, z + hw], B2 = [tallX, y + h, z + hw];
  if (s > 0) { tri(B0, B1, B2, [0, 0, 1], 1); tri(A1, A0, A2, [0, 0, -1], 1); } else { tri(B1, B0, B2, [0, 0, 1], 1); tri(A0, A1, A2, [0, 0, -1], 1); }
  const flip = s > 0;                                                    // slope face
  if (flip) { tri(A1, A2, B2, [nx, ny, 0], 1.08); tri(A1, B2, B1, [nx, ny, 0], 1.08); } else { tri(A2, A1, B1, [nx, ny, 0], 1.08); tri(A2, B1, B2, [nx, ny, 0], 1.08); }
  if (flip) { tri(A0, B2, A2, [-s, 0, 0], 0.85); tri(A0, B0, B2, [-s, 0, 0], 0.85); } else { tri(A0, A2, B2, [-s, 0, 0], 0.85); tri(A0, B2, B0, [-s, 0, 0], 0.85); }
  if (s > 0) { tri(A0, A1, B1, [0, -1, 0], 0.6); tri(A0, B1, B0, [0, -1, 0], 0.6); } else { tri(A0, B1, A1, [0, -1, 0], 0.6); tri(A0, B0, B1, [0, -1, 0], 0.6); }
  return this;
};
/* ---- organic low-poly primitives: irregular, flat-shaded facets with baked light/dark variation (trees, rocks, bushes, animals, grass) ---- */
const rgb = col => { const k = new T.Color(col); return [k.r, k.g, k.b]; };
const rr = o => (o && o.R) || Math.random;
Builder.prototype._v = function (p, n, col, k) {
  this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]);
  this.c.push(Math.min(1, col[0] * k), Math.min(1, col[1] * k), Math.min(1, col[2] * k));
};
/* one flat-shaded triangle; the normal is flipped to point away from `cen`, and the brightness follows the facing (lit tops, dim undersides) plus a random facet tint */
Builder.prototype._t = function (a, b, c2, cen, col, R, tint) {
  let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c2[0] - a[0], vy = c2[1] - a[1], vz = c2[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
  nx /= l; ny /= l; nz /= l;
  const mx = (a[0] + b[0] + c2[0]) / 3 - cen[0], my = (a[1] + b[1] + c2[1]) / 3 - cen[1], mz = (a[2] + b[2] + c2[2]) / 3 - cen[2];
  if (nx * mx + ny * my + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; const t = b; b = c2; c2 = t; }
  const k = (ny > 0 ? 0.84 + 0.26 * ny : 0.84 + 0.3 * ny) * (1 + (R() - 0.5) * (tint === undefined ? 0.12 : tint));
  this._v(a, [nx, ny, nz], col, k); this._v(b, [nx, ny, nz], col, k); this._v(c2, [nx, ny, nz], col, k);
};
const ring = (n, cx, cy, cz, rx, rz, rot, j, R) => { const o = []; for (let i = 0; i < n; i++) { const a = rot + i * Math.PI * 2 / n, f = 1 + (R() - 0.5) * j; o.push([cx + Math.cos(a) * rx * f, cy + (R() - 0.5) * j * 0.3 * (rx + rz) * 0.5, cz + Math.sin(a) * rz * f]); } return o; };
/* rounded irregular lump (foliage, bush, shoulder, head): two rings and two apexes. rx/ry/rz are half sizes. o = { n: sides, j: irregularity, R: rng } */
Builder.prototype.blob = function (rx, ry, rz, color, x, y, z, o) {
  o = o || {}; const n = o.n || 6, R = rr(o), j = o.j === undefined ? 0.28 : o.j, col = rgb(color), rot = R() * 6.28;
  const lo = ring(n, x, y - ry * 0.35, z, rx * 0.95, rz * 0.95, rot, j, R), up = ring(n, x, y + ry * 0.45, z, rx * 0.8, rz * 0.8, rot + 0.3, j, R);
  const B = [x, y - ry * 0.92, z], Tp = [x + (R() - 0.5) * rx * 0.3, y + ry, z + (R() - 0.5) * rz * 0.3], cen = [x, y, z];
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n;
    this._t(B, lo[i], lo[k], cen, col, R, o.tint); this._t(lo[i], lo[k], up[k], cen, col, R, o.tint); this._t(lo[i], up[k], up[i], cen, col, R, o.tint); this._t(up[i], up[k], Tp, cen, col, R, o.tint);
  }
  return this;
};
/* tapered (optionally leaning) cylinder / cone: base radius rb at y, top radius rt at y+h, top centre shifted by o.lx/o.lz. rt = 0 is a pointed cone. */
Builder.prototype.cone = function (rb, rt, h, n, color, x, y, z, o) {
  o = o || {}; const R = rr(o), j = o.j === undefined ? 0.1 : o.j, col = rgb(color), rot = o.rot === undefined ? R() * 6.28 : o.rot, lx = o.lx || 0, lz = o.lz || 0;
  const bt = ring(n, x, y, z, rb, rb, rot, j, R), tp = rt > 0 ? ring(n, x + lx, y + h, z + lz, rt, rt, rot, j, R) : null, cen = [x + lx / 2, y + h / 2, z + lz / 2], apex = [x + lx, y + h, z + lz];
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n;
    if (tp) { this._t(bt[i], bt[k], tp[k], cen, col, R, o.tint); this._t(bt[i], tp[k], tp[i], cen, col, R, o.tint); this._t(tp[i], tp[k], apex, cen, col, R, o.tint); }
    else this._t(bt[i], bt[k], apex, cen, col, R, o.tint);
  }
  return this;
};
/* irregular boulder: broad base, bulging middle, flat-ish top. w/h/d are full sizes. */
Builder.prototype.rock = function (w, h, d, color, x, y, z, o) {
  o = o || {}; const n = o.n || 6, R = rr(o), j = o.j === undefined ? 0.3 : o.j, col = rgb(color), rot = R() * 6.28;
  const b = ring(n, x, y, z, w * 0.42, d * 0.42, rot, j, R), m = ring(n, x, y + h * 0.5, z, w * 0.52, d * 0.52, rot + 0.2, j, R), t = ring(n, x, y + h * 0.88, z, w * 0.3, d * 0.3, rot - 0.2, j, R);
  const T0 = [x + (R() - 0.5) * w * 0.2, y + h, z + (R() - 0.5) * d * 0.2], cen = [x, y + h * 0.45, z];
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n;
    this._t(b[i], b[k], m[k], cen, col, R, o.tint); this._t(b[i], m[k], m[i], cen, col, R, o.tint);
    this._t(m[i], m[k], t[k], cen, col, R, o.tint); this._t(m[i], t[k], t[i], cen, col, R, o.tint); this._t(t[i], t[k], T0, cen, col, R, o.tint);
  }
  return this;
};
/* horizontal cylinder along x (fallen logs, pipes): radius r0 at the -x end, r1 at the +x end, with end caps */
Builder.prototype.cylX = function (len, r0, r1, n, color, x, y, z, o) {
  o = o || {}; const R = rr(o), j = o.j === undefined ? 0.08 : o.j, col = rgb(color), capc = o.cap ? rgb(o.cap) : col, cen = [x, y, z];
  const ringX = (px, r) => { const out = []; for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n, f = 1 + (R() - 0.5) * j; out.push([px, y + Math.sin(a) * r * f, z + Math.cos(a) * r * f]); } return out; };
  const A = ringX(x - len / 2, r0), B2 = ringX(x + len / 2, r1);
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n;
    this._t(A[i], A[k], B2[k], cen, col, R, o.tint); this._t(A[i], B2[k], B2[i], cen, col, R, o.tint);
    this._t(A[i], A[k], [x - len / 2, y, z], cen, capc, R, 0.05); this._t(B2[i], B2[k], [x + len / 2, y, z], cen, capc, R, 0.05);
  }
  return this;
};
/* a flat drooping leaf / palm frond: from (x,y,z) outward along yaw, len long, wid wide, the tip sinks by droop. Visible from both sides. */
Builder.prototype.leaf = function (len, wid, color, x, y, z, yaw, droop, o) {
  const col = rgb(color), cy = Math.cos(yaw), sy = Math.sin(yaw), P = (lx, ly, lz) => [x + lx * cy - lz * sy, y + ly, z + lx * sy + lz * cy];
  const p0 = P(0, 0, 0), p1 = P(len * 0.45, -droop * 0.25, wid / 2), p2 = P(len, -droop, 0), p3 = P(len * 0.45, -droop * 0.25, -wid / 2);
  [[p0, p1, p2, 0.85], [p0, p2, p3, 1.0]].forEach(q => { for (let s = 0; s < 2; s++) { const ny = s ? -1 : 1; [q[0], s ? q[2] : q[1], s ? q[1] : q[2]].forEach((v, i) => this._v(v, [0, ny, 0], col, i === 0 ? 0.78 : q[3] * (v === p2 ? 1.12 : 1))); } });
  return this;
};
/* a grass blade: a thin tapering triangle (both sides), darker at the root, lighter at the tip */
Builder.prototype.blade = function (h, wid, color, x, z, yaw, lean, y0) {
  y0 = y0 || 0;
  const col = rgb(color), cy = Math.cos(yaw), sy = Math.sin(yaw), hw = wid / 2;
  const a = [x - cy * hw, y0, z - sy * hw], b = [x + cy * hw, y0, z + sy * hw], t = [x + lean * cy * 0.5, y0 + h, z + lean * sy * 0.5];
  const up = [0, 1, 0];
  [[a, b, t], [b, a, t]].forEach(q => { this._v(q[0], up, col, 0.72); this._v(q[1], up, col, 0.72); this._v(q[2], up, col, 1.18); });
  return this;
};
/* a smooth heightfield sheet. xs/us are the sample positions, hfn(u,x) the height, cfn(u,x,y) a [r,g,b] colour. Normals come from the height function itself,
 * so the land is shaded smoothly (no block edges). */
Builder.prototype.terrain = function (xs, us, hfn, cfn) {
  const e = 0.06, V = (u, x) => { const y = hfn(u, x), c = cfn(u, x, y), nx = hfn(u, x - e) - hfn(u, x + e), nz = hfn(u - e, x) - hfn(u + e, x), l = Math.hypot(nx, 2 * e, nz); this._v([x, y, u], [nx / l, 2 * e / l, nz / l], c, 1); };
  for (let i = 0; i < us.length - 1; i++) for (let j = 0; j < xs.length - 1; j++) {
    const u0 = us[i], u1 = us[i + 1], x0 = xs[j], x1 = xs[j + 1];
    V(u0, x0); V(u1, x0); V(u0, x1);
    V(u0, x1); V(u1, x0); V(u1, x1);
  }
  return this;
};
/* bake an existing geometry into this builder (scaled, turned about y, moved): scenery that costs no extra draw calls */
Builder.prototype.addGeo = function (g, x, y, z, sx, sy, sz, rot) {
  const P = g.attributes.position.array, N = g.attributes.normal.array, C = g.attributes.color.array, c = Math.cos(rot || 0), s = Math.sin(rot || 0);
  for (let i = 0; i < P.length; i += 3) {
    const px = P[i] * sx, py = P[i + 1] * sy, pz = P[i + 2] * sz;
    this.p.push(x + px * c + pz * s, y + py, z - px * s + pz * c);
    this.n.push(N[i] * c + N[i + 2] * s, N[i + 1], -N[i] * s + N[i + 2] * c);
    this.c.push(C[i], C[i + 1], C[i + 2]);
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
AH.FIREMAT = new T.MeshLambertMaterial({ vertexColors: true, emissive: 0xff5a00, emissiveIntensity: 0.05 });
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
/* vehicles, boulders, logs and trains slide into tunnels and banks at the edge of the playable strip: a clip plane on each side hides whatever is past it,
 * so nothing ever drives through a hill. BGX is where the tunnel mouths and banks start. */
renderer.localClippingEnabled = true;
AH.BGX = 9.65;
AH.CLIP = [new T.Plane(new T.Vector3(1, 0, 0), AH.BGX), new T.Plane(new T.Vector3(-1, 0, 0), AH.BGX)];
AH.VMC = new T.MeshLambertMaterial({ vertexColors: true, clippingPlanes: AH.CLIP });
AH.CLIPF = [new T.Plane(new T.Vector3(1, 0, 0), 15), new T.Plane(new T.Vector3(-1, 0, 0), 15)];
AH.VMF = new T.MeshLambertMaterial({ vertexColors: true, clippingPlanes: AH.CLIPF });
AH.VMR = new T.MeshLambertMaterial({ vertexColors: true });                           // boulders: free to ride up the hills, no clipping
AH.CLIPR = [new T.Plane(new T.Vector3(1, 0, 0), 9.3), new T.Plane(new T.Vector3(-1, 0, 0), 9.3)];   // rivers keep their water flat out to the foot of the bank
AH.VMW = new T.MeshLambertMaterial({ vertexColors: true, clippingPlanes: AH.CLIPR });
AH.CLIPT = [new T.Plane(new T.Vector3(1, 0, 0), 15.9), new T.Plane(new T.Vector3(-1, 0, 0), 15.9)];  // trains run on into their tunnel
AH.VMT = new T.MeshLambertMaterial({ vertexColors: true, clippingPlanes: AH.CLIPT });
AH.CLIPX = [new T.Plane(new T.Vector3(1, 0, 0), 27.5), new T.Plane(new T.Vector3(-1, 0, 0), 27.5)];  // trains on flat ground run all the way to the far edge
AH.VMX = new T.MeshLambertMaterial({ vertexColors: true, clippingPlanes: AH.CLIPX });
/* animated water: one shared clock, waves are driven in the vertex shader (height) and a crest highlight in the fragment shader */
AH.waveT = { value: 0 };
const waterMats = {};
AH.waterMat = function (hex, amp) {
  const key = hex + ':' + (amp || 1);
  if (waterMats[key]) return waterMats[key];
  const m = new T.MeshLambertMaterial({ color: hex, transparent: true, opacity: 0.93 });
  m.onBeforeCompile = function (sh) {
    sh.uniforms.uTime = AH.waveT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vWv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vec4 wpp = modelMatrix * vec4(transformed, 1.0);\n float wv = sin(wpp.x * 0.55 + uTime * 1.5 + wpp.z * 0.35) * 0.5 + sin(wpp.x * 1.1 - uTime * 1.1 + wpp.z * 0.8) * 0.3 + sin(wpp.z * 0.9 + uTime * 0.9) * 0.2;\n transformed.y += wv * ' + (0.13 * (amp || 1)).toFixed(3) + ';\n vWv = wv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWv;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb += max(0.0, vWv - 0.35) * 0.55 + vWv * 0.04;');
  };
  return (waterMats[key] = m);
};
const clipFlat = {};
AH.MC = col => clipFlat[col] || (clipFlat[col] = new T.MeshLambertMaterial({ color: col, clippingPlanes: AH.CLIP }));
const scene = AH.scene = new T.Scene();
const camera = AH.camera = new T.OrthographicCamera(-5, 5, 5, -5, 0.1, 160);
const CAM_OFF = new T.Vector3(4.5, 11, 9);
const hemi = AH.hemi = new T.HemisphereLight(0xffffff, 0x9aa8b8, 0.62);
scene.add(hemi);
const sun = AH.sun = new T.DirectionalLight(0xffffff, 0.5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.bias = -0.0012; sun.shadow.normalBias = 0.06;
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
  focus: new T.Vector3(), tx: 0, tz: 0, ty: 0, shake: 0,
  snap(x, z) { this.tx = x; this.tz = z; this.ty = 0; this.focus.set(x, 0, z); },
  update(dt) {
    const f = this.focus;
    f.x += (this.tx - f.x) * Math.min(1, dt * 5);
    f.z += (this.tz - f.z) * Math.min(1, dt * 6);
    f.y += (this.ty - f.y) * Math.min(1, dt * 3);
    const amp = AH.calm ? 0 : this.shake;
    this.shake = Math.max(0, this.shake - dt * 1.2);
    const ox = amp ? AH.prnd(-amp, amp) : 0, oz = amp ? AH.prnd(-amp, amp) : 0;
    camera.position.set(f.x + CAM_OFF.x + ox, CAM_OFF.y + f.y, f.z + CAM_OFF.z + oz);
    camera.lookAt(f.x + ox, f.y, f.z + oz);
    const sx = Math.round(f.x / 2) * 2, sz = Math.round(f.z / 2) * 2;
    sun.position.set(sx - 4, 14 + f.y, sz + 6); sun.target.position.set(sx, f.y, sz); sun.target.updateMatrixWorld();
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
