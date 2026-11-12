/* main.js: game loop, shared avalanche, rounds, HUD, character picker, boot. */
(function () {
'use strict';
const AH = window.AH, T = AH.T, W = AH.world, G = AH.G, P = AH.P, PL = AH.player, NET = AH.net, $ = AH.$, COLS = AH.COLS, clamp = AH.clamp;
const scene = AH.scene, B = AH.boss;

/* ---- avalanche: one shared wall for the whole room, driven by the shared clock ---- */
function chaseDist(e) {
  const k = Math.min(e, 100);
  let d = 1.5 * (0.5 * k + 0.004 * k * k);
  if (e > 100) d += 1.5 * 1.3 * (e - 100);
  return d;
}
const slab = new T.Mesh(AH.BOX, new T.MeshLambertMaterial({ color: 0xf2f9ff }));
slab.scale.set(120, 1.2, 46); scene.add(slab);
const boulders = [], bGeo = new T.IcosahedronGeometry(1, 0), bCols = [0xffffff, 0xe9f5ff, 0xd5eafb];
function addBoulder(x, z0, r) {
  const m = new T.Mesh(bGeo, AH.M(bCols[Math.floor(Math.random() * 3)]));
  m.scale.set(r, r, r); scene.add(m);
  boulders.push({ m: m, x: x, z0: z0, r: r, ph: Math.random() * 6, roll: AH.prnd(0.8, 1.3) });
}
for (let i = 0; i < 24; i++) addBoulder(-24 + i * 2 + AH.prnd(-0.4, 0.4), AH.prnd(0, 1.2), AH.prnd(0.75, 1.3));
for (let i = 0; i < 22; i++) addBoulder(AH.prnd(-24, 24), AH.prnd(1.4, 6), AH.prnd(1, 1.9));

/* ---- toast / hint ---- */
let toastT = 0;
AH.toast = function (msg, ms) { const h = $('hint'); h.textContent = msg; h.hidden = false; toastT = (ms || 1800) / 1000; };

/* ---- rounds ---- */
function checkLate() {
  if (G.rs > 0 && G.state === 'ready' && 6.5 - chaseDist(AH.now() - G.rs) < 3.2) PL.die('late');
}
AH.adoptRound = function (rd, rs) { G.round = rd; AH.resetWorld(); G.rs = rs; checkLate(); };
AH.adoptStart = function (rs) { const was = G.rs; G.rs = rs; if (!was) checkLate(); };
AH.everyoneDead = function () {
  if (!P.dead) return false;
  for (const g of AH.ghosts.values()) if (!g.dead && !g.first && !g.fly) return false;
  return true;
};
AH.resetWorld = function () {
  W.reset(NET.id ? NET.id + ':' + G.round : null);
  AH.clearParts(); AH.fx.clear(); B.clear(); B.done = false;
  G.score = 0; G.chaseZ = 6.5; G.state = 'ready'; G.deadT = 0; G.overShown = false; G.newBest = false; G.rs = 0; G.stall = 0; G.spec = false; G.lastArena = 0;
  AH.ghosts.forEach(g => { g.first = true; g.dead = false; g.score = 0; g.g.visible = false; });
  P.ch.init(P);
  P.fly = !!P.ch.flies;
  Object.assign(P, { x: 0, z: 0, row: 0, jumping: false, dead: false, log: null, buf: null, landT: 0, bump: 0, kind: '', big: false, bounce: false, dirKey: 'F', auto: false, faceTarget: 0 });
  P.baseY = P.y = P.fly ? AH.GULLY : 0;
  AH.pg.visible = true; AH.pg.position.set(0, P.y, 0); AH.pg.rotation.y = 0; AH.pscale.scale.set(1, 1, 1); AH.pscale.rotation.set(0, 0, 0);
  PL.resetInput();
  AH.cam.snap(0, -2.5);
  W.ensure(30);
  $('over').hidden = true;
  $('start').hidden = !G.cardOn;
  $('hint').textContent = 'Hold, then release to hop'; $('hint').hidden = G.cardOn;
  G.cardOn = false;
  AH.emit('score');
  NET.refresh();
};
AH.newRound = function (keep) { if (!keep) G.round++; AH.resetWorld(); };
AH.onBeat = function (A) {
  if (W.arena(A).beaten) return;
  W.beat(A); B.clear();
  AH.ghosts.forEach(g => { if (g.dead) { g.dead = false; } });
  PL.revive(A);
  G.stall = G.stall; // avalanche resumes from where it was held
  AH.toast('Boss defeated! Everyone is back up', 2600);
  AH.beep(660, 0.5, 'square', 0.05, 600); AH.cam.shake = 0.3;
};

/* ---- character picker ---- */
function makePreviews() {
  try {
    const r2 = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r2.setPixelRatio(1); r2.setSize(144, 144);
    const sc2 = new T.Scene();
    sc2.add(new T.HemisphereLight(0xffffff, 0x9aa8b8, 0.85));
    const dl = new T.DirectionalLight(0xffffff, 0.7); dl.position.set(-3, 6, -5); sc2.add(dl);
    const cam = new T.OrthographicCamera(-1.5, 1.5, 2.1, -0.9, 0.1, 40);
    cam.position.set(-2.6, 2.4, -4.4); cam.lookAt(0, 0.75, 0);
    const out = [];
    AH.chars.forEach(function (c, i) {
      const m = new T.Mesh(AH.charGeo(i), AH.VM); sc2.add(m);
      r2.render(sc2, cam); out.push(r2.domElement.toDataURL('image/png'));
      sc2.remove(m);
    });
    r2.dispose(); try { r2.forceContextLoss(); } catch (e) {}
    return out;
  } catch (e) { return null; }
}
function paintPicker() {
  document.querySelectorAll('.pick button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === P.chi)));
  document.querySelectorAll('.blurb').forEach(el => { el.textContent = P.ch.name + ': ' + P.ch.blurb; });
}
function initPicker() {
  const urls = makePreviews();
  document.querySelectorAll('.pick').forEach(function (box) {
    box.addEventListener('pointerdown', e => e.stopPropagation());
    AH.chars.forEach(function (c, i) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.i = String(i); b.setAttribute('aria-label', c.name);
      if (urls) { const im = document.createElement('img'); im.alt = ''; im.src = urls[i]; b.appendChild(im); }
      else { const sw = document.createElement('div'); sw.className = 'sw'; sw.style.background = AH.hex(c.col); b.appendChild(sw); }
      const sp = document.createElement('span'); sp.textContent = c.name; b.appendChild(sp);
      b.addEventListener('click', function () {
        AH.audio(); PL.setChar(i); AH.beep(620, 0.07, 'square', 0.04, 200);
        if (G.state === 'ready') { G.cardOn = true; AH.resetWorld(); }
        paintPicker();
      });
      box.appendChild(b);
    });
  });
}

/* ---- held-tap aim indicator (kangaroo) ---- */
const aimTiles = [];
for (let i = 0; i < 6; i++) { const m = new T.Mesh(AH.BOX, new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.55, depthWrite: false })); m.visible = false; scene.add(m); aimTiles.push(m); }
function updateAim() {
  const n = (P.holding && P.holdT >= 0.1 && !P.dead && !P.jumping && P.ch.aim) ? P.ch.aim(P) : 0;
  const pl = n >= 2 ? PL.plan(P.dirKey, n) : null;
  const steps = pl ? pl.steps : 0, d = AH.DIRS[P.dirKey], t = AH.now();
  for (let i = 0; i < aimTiles.length; i++) {
    const m = aimTiles[i], on = steps >= 2 && i < steps;
    m.visible = on;
    if (!on) continue;
    const last = i === steps - 1;
    m.position.set(P.x + d[0] * (i + 1), 0.05, P.z + d[1] * (i + 1));
    m.scale.set(last ? 0.95 : 0.55, 0.06, last ? 0.95 : 0.55);
    m.material.opacity = last ? 0.55 + 0.2 * Math.sin(t * 10) : 0.4;
  }
}

/* ---- HUD ---- */
let shownScore = -1, sigAb = '';
function updateHud() {
  if (shownScore !== G.score) { shownScore = G.score; $('score').textContent = G.score; }
  $('best').textContent = 'BEST ' + Math.max(G.best, G.score);
  const u = P.ch.ui(P), el = $('ability');
  const sig = [u.label, u.pct | 0, u.text, u.ready, !!u.passive].join('|');
  if (sig !== sigAb) {
    sigAb = sig;
    el.style.setProperty('--p', String(u.pct | 0));
    el.classList.toggle('ready', !!u.ready); el.classList.toggle('passive', !!u.passive);
    $('abl').textContent = u.label; $('abn').textContent = u.text;
  }
  const bb = $('bossbar');
  bb.hidden = !B.on;
  if (B.on) $('bossfill').style.width = clamp(B.hp / B.max * 100, 0, 100).toFixed(0) + '%';
}
AH.on('score', function () { updateHud(); });

/* ---- loop ---- */
let last = performance.now(), snowT = 0, hudT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (!isFinite(dt) || dt <= 0) dt = 0.016;
  dt = Math.min(dt, 0.05);
  if (G.state === 'dead') G.deadT += dt;
  if (toastT > 0) { toastT -= dt; if (toastT <= 0 && !G.spec) { $('hint').hidden = true; $('hint').textContent = 'Hold, then release to hop'; } }

  W.update(dt, P.x, P.z);
  PL.update(dt, PL.isHolding());
  AH.ghosts.forEach(function (g, id) {
    const k = Math.min(1, dt * 14), p = g.g.position;
    p.x += (g.tx - p.x) * k; p.y += (g.ty - p.y) * k; p.z += (g.tz - p.z) * k;
    let dr = g.tr - g.g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.g.rotation.y += dr * k;
    g.inner.scale.set(1, g.sy, 1);
    g.g.visible = !g.dead && !g.first; g.tag.rotation.y += dt * 2.4;
    if (g.flames) AH.fx.tickFlames(g.flames, AH.now());
    if (now - g.seen > 5000) NET.removeGhost(id);
  });
  B.update(dt);
  AH.fx.update(dt);
  NET.tick(dt, now);
  if (P.holding && !P.dead && !P.jumping) { /* holdT advances inside PL.update */ }

  // shared avalanche, held back while a checkpoint boss is unbeaten
  let anyAlive = false;
  AH.ghosts.forEach(g => { if (!g.dead && !g.first && !g.fly) anyAlive = true; });
  const allDead = AH.everyoneDead();
  if (G.rs > 0 && !(allDead && !(P.kind === 'snow' && G.deadT < 1.2))) {
    let cz = 6.5 - chaseDist(Math.max(0, AH.now() - G.rs)) + G.stall;
    const hold = -(W.firstOpenArena() - 8);
    if (cz < hold) { G.stall += hold - cz; cz = hold; }
    G.chaseZ = cz;
  }
  if (G.rs > 0 && !P.dead && !P.fly && G.chaseZ - P.z < 1.0) PL.hurt('snow');

  // checkpoint reached: abilities that recharge per checkpoint re-arm
  const A = W.firstOpenArena();
  if (!P.dead && P.row >= A && G.lastArena !== A) { G.lastArena = A; AH.emit('arena', A); }

  slab.position.set(P.x, 0.1, G.chaseZ + 0.5 + 23);
  for (const b of boulders) {
    b.ph += dt * 6 * b.roll;
    b.m.position.set(P.x * 0 + b.x + Math.round(P.x / 48) * 48, b.r * 0.78 + Math.abs(Math.sin(b.ph)) * 0.12, G.chaseZ + b.z0);
    b.m.rotation.x -= dt * 2.6 / b.r * b.roll;
  }
  snowT -= dt;
  if (snowT <= 0 && !allDead) { snowT = 0.08; AH.burst(1, P.x + AH.prnd(-12, 12), 1.2, G.chaseZ - 0.4, [0xffffff, 0xe9f5ff], 1.4, 3); }
  AH.updateParts(dt);

  // danger feedback
  const gap = G.chaseZ - P.z, danger = (G.rs > 0 && !P.dead && !P.fly) ? clamp((6 - gap) / 5, 0, 1) : 0;
  $('warn').style.opacity = (danger * 0.8).toFixed(2);
  const fill = $('fill');
  fill.style.width = (G.rs <= 0 ? 0 : (1 - clamp((gap - 1) / 9.5, 0, 1)) * 100).toFixed(1) + '%';
  fill.style.backgroundColor = danger > 0.35 ? '#e5484d' : '#ffd23f';
  if (danger > 0.6 && !P.dead) AH.cam.shake = Math.max(AH.cam.shake, (3 - gap) * 0.05);

  // camera: independent per client. Own fox while alive, otherwise whoever is furthest ahead.
  let tx = P.x, tz = P.z;
  if (P.dead) {
    let best = null;
    AH.ghosts.forEach(g => { if (!g.dead && !g.first && (!best || (!g.fly && best.fly) || (g.fly === best.fly && g.g.position.z < best.g.position.z))) best = g; });
    if (best) { tx = best.g.position.x; tz = best.g.position.z; }
  }
  AH.cam.tx = tx; AH.cam.tz = tz - 2.5;
  AH.cam.update(dt);
  updateAim();

  const camRow = -AH.cam.focus.z;
  W.ensure(Math.max(Math.ceil(camRow) + 28, P.row + 28));
  W.prune(Math.min(Math.floor(camRow) - 18, A - 2));

  hudT -= dt; if (hudT <= 0) { hudT = 0.15; updateHud(); NET.refresh(); }

  const spec = P.dead && !allDead;
  if (spec !== G.spec) {
    G.spec = spec;
    const h = $('hint');
    if (spec) { h.textContent = P.kind === 'late' ? 'Round in progress · spectating' : 'Down! Spectating until the boss falls'; h.hidden = false; }
    else { h.hidden = true; h.textContent = 'Hold, then release to hop'; }
  }
  if (allDead && !G.overShown && G.deadT > 0.9) {
    G.overShown = true;
    const t = { car: 'Flattened!', water: 'Splash!', lost: 'Swept away!', snow: 'Buried!', boss: 'Squashed!' };
    $('overTitle').textContent = AH.ghosts.size ? 'Round over!' : (t[P.kind] || 'Game over');
    $('overScore').textContent = G.score; $('overBest').textContent = G.best; $('newBest').hidden = !G.newBest;
    $('over').hidden = false;
  }
  AH.renderer.render(scene, AH.camera);
}

/* ---- boot ---- */
PL.setChar((function () { try { return Math.floor(+localStorage.getItem('avhop-char') || 0); } catch (e) { return 0; } })());
AH.resize();
NET.id = NET.roomFromHash(); AH.roomSeed = NET.id;
initPicker(); paintPicker();
AH.resetWorld();
$('invite').addEventListener('pointerdown', e => e.stopPropagation());
$('invite').addEventListener('click', NET.invite);
$('ability').addEventListener('pointerdown', function (e) { e.stopPropagation(); e.preventDefault(); PL.press(); });
window.addEventListener('hashchange', function () {
  const id = NET.roomFromHash();
  if (id && id !== NET.id) { NET.leave(); NET.id = id; AH.roomSeed = id; G.round = 0; AH.resetWorld(); NET.connect(); }
});
requestAnimationFrame(frame);
if (NET.id) NET.connect();
})();
