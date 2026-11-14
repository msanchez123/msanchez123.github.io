/* player.js: the local player (movement, collisions, death/revive) and pointer input. Character specifics live in js/chars/*. */
(function () {
'use strict';
const AH = window.AH, T = AH.T, W = AH.world;
const COLS = AH.COLS, JD = AH.JD, clamp = AH.clamp, lerp = AH.lerp, $ = AH.$;
AH.ghosts = AH.ghosts || new Map();
const DIRS = AH.DIRS, Nav = AH.nav;

const G = AH.G = { state: 'ready', score: 0, best: 0, deadT: 0, overShown: false, newBest: false, rs: 0, round: 0, stall: 0, chaseZ: 6.5, spec: false, cardOn: true };
try { G.best = +localStorage.getItem('avhop-best') || 0; } catch (e) {}

const P = AH.P = {
  x: 0, y: 0, z: 0, row: 0, baseY: 0, jumping: false, jt: 0, dur: JD, hgt: 0.95, big: false, bounce: false,
  fromX: 0, fromZ: 0, toX: 0, toZ: 0, toRow: 0, fromBase: 0, toBase: 0, ox: 0, oz: 0, orow: 0, obase: 0, ologRef: null, orel: 0,
  log: null, logOff: 0, dead: false, kind: '', kbT: 0, buf: null, landT: 0, bump: 0, holdT: 0, holding: false, faceTarget: 0, dirKey: 'F',
  ch: null, cs: {}, inv: false, fly: false, lift: 0, rig: null, auto: false, burn: false, glow: false, chi: 0
};

/* ---- model ---- */
AH.geoCache = [];
AH.charGeo = i => AH.geoCache[i] || (AH.geoCache[i] = AH.chars[i].geo(AH.Builder));
AH.fireCache = [];
AH.charFireGeo = i => AH.chars[i].fireGeo ? (AH.fireCache[i] || (AH.fireCache[i] = AH.chars[i].fireGeo(AH.Builder))) : AH.charGeo(i);
const pm = new T.Mesh(new T.BufferGeometry(), AH.VM); pm.castShadow = true;
const pscale = new T.Group(); pscale.add(pm);
const pg = new T.Group(); pg.add(pscale); AH.scene.add(pg);
AH.pg = pg; AH.pscale = pscale; AH.pm = pm;
const GLOW = new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x38e1ff, emissiveIntensity: 0.7 });

AH.player = {};
const PL = AH.player;
PL.setChar = function (i) {
  P.chi = clamp(i | 0, 0, AH.chars.length - 1); P.ch = AH.chars[P.chi]; P.fly = false; P.lift = 0;
  pm.geometry = AH.charGeo(P.chi);
  if (P.rig) { pscale.remove(P.rig.group); P.rig = null; }
  if (P.ch.rig) { P.rig = P.ch.rig(AH.Builder); pscale.add(P.rig.group); }
  try { localStorage.setItem('avhop-char', String(P.chi)); } catch (e) {}
  P.ch.init(P);
};
function face(dx, dz) { P.faceTarget = Math.atan2(-dx, -dz); }
function setFace(k) { P.dirKey = k; face(DIRS[k][0], DIRS[k][1]); }
PL.setFace = setFace;

/* ---- helpers ---- */
function occupied(x, row) {
  if (P.fly) return false;
  for (const g of AH.ghosts.values()) {
    if (g.dead || g.first || g.fly) continue;
    if (Math.round(-g.tz) === row && Math.abs(g.tx - x) < 0.72) return true;
  }
  return false;
}
PL.occupied = occupied;

/* Hop options shared by everything that asks "where would I land": the same rules for the player, leaps and the planner. */
PL.opts = function () {
  const ch = P.ch;
  return {
    fly: P.fly, occ: occupied,
    block: (x, z) => !!(AH.boss && AH.boss.hopCheck(x, z, P)),
    veto: ch.veto ? (row, x, t) => ch.veto(P, row, x, t) : null
  };
};
PL.from = function () {
  const cur = W.get(P.row);
  return { row: P.row, x: P.x, cont: !P.fly && Nav.carried(cur), drift: P.fly ? 0 : Nav.drift(cur, P.log) };
};
/* Where would a hop of n blocks in direction k land? Returns null when blocked. Pure, so abilities and the robot can ask. */
PL.plan = function (k, n) {
  n = n || 1;
  if (AH.boss) AH.boss.hitFlag = false;
  const f = PL.from(), o = PL.opts(), t = AH.now();
  for (let m = n; m >= 1; m--) { const h = Nav.hop(f, k, m, t, o); if (h) return h; }
  return null;
};

/* a little collision puff, and a thrown-back hop away from whatever we hit */
function impact(x, z, cols, shake) { AH.burst(10, x, 0.7, z, cols, 3.2, 4); AH.cam.shake = Math.max(AH.cam.shake, shake || 0.2); AH.beep(110, 0.12, 'square', 0.06, -60); }
function barrierAhead(k, n) {
  if (k !== 'F') return null;
  const bx = Math.round(P.x);
  for (let i = 1; i <= n; i++) { const r = W.get(P.row + i), bl = r && r.blockers.get(bx); if (bl && bl.kind === 'barrier') return r; }
  return null;
}
const OPP = { F: 'B', B: 'F', L: 'R', R: 'L' };
PL.knock = function (k) {
  if (P.dead || P.jumping) { P.bump = 0.3; return; }
  P.kbT = 0.35; P.bump = 0.3;
  const f = P.faceTarget;
  P.nohit = true; const ok = PL.tryMove(OPP[k], 1, true, true); P.nohit = false;
  if (ok) { P.hgt = 0.7; P.dur = 0.17; P.faceTarget = f; P.dirKey = k; }
};
PL.tryMove = function (k, n, isLeap, noCount) {
  n = n || 1;
  if (G.state === 'dead') return false;
  if (P.jumping) { P.buf = { k: k, n: n, leap: !!isLeap, nc: !!noCount }; return false; }
  setFace(k);
  const pl = PL.plan(k, n);
  if (!pl) {
    if (AH.boss && AH.boss.hitFlag && !P.nohit) {                  // jumped into the guardian: it is hurt, you are thrown back
      AH.boss.hitFlag = false;
      const d = DIRS[k], B = AH.boss;
      AH.boss.hurt(1, d[0], d[1]);
      if (B.st !== 'sleep' && B.st !== 'roar' && B.st !== 'rage' && B.st !== 'dying') impact(P.x + d[0] * 0.8, P.z + d[1] * 0.8, [0xffffff, 0xffd23f, P.ch.col], 0.3);
      PL.knock(k); return false;
    }
    const gr = barrierAhead(k, n);
    if (gr) {                                                      // the exit barrier: unbreakable until the guardian is down
      const A = W.arenaStart(gr.r);
      if (W.arena(A).beaten) {
        AH.net ? AH.net.event('brk', { a: A }, true) : W.breakBarrier(A, false);
        impact(P.x, P.z - 1, [0xffffff, 0xffd23f, P.ch.col], 0.5);
      } else { AH.toast && AH.toast('Defeat the guardian first!', 1400); impact(P.x, P.z - 0.8, [0xcfc7b8, 0xffffff], 0.15); }
      P.bump = 0.2; return false;
    }
    P.bump = 0.18; AH.beep(130, 0.06, 'square', 0.03); return false; }
  const big = pl.steps > 1, trow = pl.rowObj;
  P.jumping = true; P.jt = 0; P.bounce = false; P.big = big;
  P.dur = big ? Math.min(0.2 + 0.05 * pl.steps, 0.9) : JD; P.hgt = big ? Math.min(1.2 + 0.3 * pl.steps, 3.4) : 0.95;
  if (P.fly) P.hgt = 0;
  P.fromX = P.x; P.fromZ = P.z; P.toX = pl.x; P.toZ = -pl.row; P.toRow = pl.row;
  P.fromBase = P.baseY; P.toBase = W.baseOf(trow);
  P.ox = P.x; P.oz = P.z; P.orow = P.row; P.obase = P.baseY; P.ologRef = P.log; P.orel = P.log ? P.x - P.log.x : 0;
  P.log = null;
  if (!isLeap && !noCount && !P.auto) { P.ch.onStep(P); AH.beep(480, 0.09, 'square', 0.04, 320); }
  else AH.beep(300, 0.25, 'square', 0.05, 600);
  if (G.state === 'ready') { G.state = 'play'; if (!G.rs) G.rs = AH.now(); $('start').hidden = true; $('hint').hidden = true; }
  return true;
};

function bounceBack() {
  const bx = P.ologRef ? P.ologRef.x + P.orel : P.ox;
  P.bounce = true; P.big = false; P.jumping = true; P.jt = 0; P.dur = 0.14; P.hgt = 0.5;
  P.fromX = P.x; P.fromZ = P.z; P.fromBase = P.baseY;
  P.toX = bx; P.toZ = P.oz; P.toRow = P.orow; P.toBase = P.obase;
  P.bump = 0.18; AH.beep(130, 0.06, 'square', 0.03);
}
PL.survive = function (kind, obj) {
  if (P.inv) return true;
  return !!(P.ch.guard && P.ch.guard(P, kind, obj));
};
/* The wave (avalanche, mudslide, lava...) cannot be shrugged off by any ability. Everything else asks the character first. */
PL.hurt = function (kind, obj) {
  if (P.dead || (G.state === 'ready' && !G.rs)) return;
  if (kind !== 'snow' && PL.survive(kind, obj)) return;
  PL.die(kind);
};

/* Put the player on whatever is under them right now: log, lily pad, plain ground, or the water. Used after every hop and when a flight ends. */
PL.settle = function () {
  const row = W.get(P.row);
  if (!row) return true;
  const st = W.stand(row, P.x, AH.now());
  if (!st.ok) { if (PL.survive('water')) { bounceBack(); return false; } PL.die('water'); return false; }
  P.log = st.log || null;
  if (st.log) P.logOff = P.x - st.log.x;
  if (st.snap !== undefined) P.x = st.snap;
  P.baseY = st.base; P.y = P.baseY;
  if (row.type === 'water' || row.type === 'lily') AH.burst(3, P.x, 0.1, P.z, [0xbfe6ff], 1.2, 2);
  else AH.burst(3, P.x, 0.05, P.z, [0xffffff, 0xcfeab8], 1.2, 1.6);
  return true;
};

function land() {
  P.jumping = false; P.x = P.toX; P.z = P.toZ; P.row = P.toRow; P.baseY = P.toBase; P.y = P.baseY;
  if (!P.bounce && occupied(P.x, P.row)) { bounceBack(); return; }
  if (!W.get(P.row)) return;
  if (P.row > G.score) { G.score = P.row; AH.emit('score'); }
  if (P.fly) P.log = null;
  else if (!PL.settle()) return;
  if (P.big) { AH.burst(12, P.x, 0.1, P.z, [0xffd23f, 0xffffff], 3.4, 3); AH.cam.shake = Math.max(AH.cam.shake, 0.2); P.big = false; }
  P.landT = P.fly ? 0 : 0.12;
  if (P.ch.onLand) P.ch.onLand(P);
  if (P.buf) { const b = P.buf; P.buf = null; PL.tryMove(b.k, b.n, b.leap, b.nc); }
}

PL.die = function (kind) {
  if (P.dead) return;
  P.dead = true; P.kind = kind; G.state = 'dead'; G.deadT = 0; P.jumping = false; P.holding = false; P.auto = false; P.inv = false; P.fly = false;
  $('start').hidden = true; $('hint').hidden = true;
  const cc = P.ch.col;
  if (kind === 'car' || kind === 'boss') { AH.burst(16, P.x, 0.6, P.z, [cc, 0xfff6ea, 0xffd23f], 3.2, 4.5); AH.cam.shake = 0.45; AH.beep(150, 0.28, 'sawtooth', 0.08, -100); }
  else if (kind === 'snow') { AH.burst(20, P.x, 0.8, P.z, [0xffffff, 0xe6f4ff], 3, 5); AH.cam.shake = 0.5; AH.beep(80, 0.6, 'sawtooth', 0.09, -40); }
  else { AH.burst(18, P.x, 0, P.z, [0x7cc8ff, 0xffffff, 0x3aa0e8], 2.6, 6.5); AH.beep(320, 0.32, 'sine', 0.07, -220); }
  if (G.score > G.best) {
    G.best = G.score; G.newBest = true;
    try { localStorage.setItem('avhop-best', String(G.best)); } catch (e) {}
  } else G.newBest = false;
  AH.emit('score');
};

/* Called when a boss falls: everyone gets back up at the arena entrance. */
PL.revive = function (A) {
  if (!P.dead) return;
  P.dead = false; P.kind = ''; G.state = 'play'; G.overShown = false; G.deadT = 0;
  P.row = A + 2; P.z = -P.row; P.x = clamp(Math.round(AH.prnd(-3, 3)), -COLS, COLS);
  P.y = P.baseY = 0; P.lift = 0; P.fly = false; P.log = null; P.jumping = false; P.buf = null;
  pg.visible = true; pscale.scale.set(1, 1, 1);
  $('over').hidden = true;
  AH.burst(16, P.x, 0.5, P.z, [0xffd23f, 0xffffff, P.ch.col], 3, 5);
  AH.beep(520, 0.3, 'square', 0.05, 500);
  P.ch.init(P, true);
};

/* ---- per frame ---- */
PL.update = function (dt, hold) {
  let d = P.faceTarget - pg.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  pg.rotation.y += d * Math.min(1, dt * 22);
  pm.material = P.burn ? AH.FIREMAT : P.glow ? GLOW : AH.VM;
  P.ch.update(P, dt);
  if (P.rig) P.rig.tick(P.fly, AH.now(), dt);

  if (P.dead) {
    const t = G.deadT;
    if (P.kind === 'car' || P.kind === 'boss') { const k = Math.min(1, t / 0.1); pscale.scale.set(1 + 0.5 * k, 1 - 0.85 * k, 1 + 0.5 * k); }
    else if (P.kind === 'snow') { if (t > 0.35) pg.visible = false; }
    else { const s = Math.max(0, 1 - t * 1.6); pscale.scale.set(s, s, s); pg.position.y = P.y - Math.min(t * 2.5, 1.2); }
    if (P.kind !== 'water' && P.kind !== 'lost') { P.lift = Math.max(0, P.lift - dt * 7); pg.position.y = P.y + P.lift; }
    return;
  }
  const now = AH.now();
  let sy = 1, sxz = 1;
  if (P.jumping) {
    P.jt += dt / P.dur;
    const t = Math.min(P.jt, 1);
    P.x = lerp(P.fromX, P.toX, t); P.z = lerp(P.fromZ, P.toZ, t);
    P.y = lerp(P.fromBase, P.toBase, t) + Math.sin(Math.PI * t) * P.hgt;
    if (!P.fly) { sy = 1 + (P.big ? 0.38 : 0.22) * Math.sin(Math.PI * t); sxz = 1 - (P.big ? 0.14 : 0.08) * Math.sin(Math.PI * t); }
    if (P.jt >= 1) land();
  } else {
    const row = W.get(P.row);
    if (row && row.type === 'water' && P.log) P.x = P.log.x + P.logOff;
    else if (row && row.type === 'conv' && !P.fly) P.x += row.carry * dt;
    // carried past the waterfall at the map edge: out of the map, no matter who you are
    if (!P.fly && Math.abs(P.x) > COLS + 1.5) { PL.die('lost'); return; }
    P.y = P.baseY;
    if (hold) {
      P.holdT += dt;
      if (!P.fly) {
      const k = Math.min(1, P.holdT / 0.16), e = k * k * (3 - 2 * k);
      sy = 1 - 0.38 * e; sxz = 1 + 0.14 * e; }
    } else if (P.landT > 0) {
      P.landT -= dt;
      const k = Math.max(0, P.landT) / 0.12;
      sy = 1 - 0.2 * k; sxz = 1 + 0.1 * k;
    }
  }
  // the boss is solid: if it walks into you (or you were carried into it) you get shoved out instead of passing through
  P.kbT = Math.max(0, P.kbT - dt);
  const BS = AH.boss;
  if (BS && BS.on && !P.jumping && !P.fly && P.kbT <= 0 && BS.st !== 'dying' && BS.st !== 'sleep') {
    const dx = P.x - BS.x, dz = P.z - BS.z;
    if (Math.hypot(dx, dz) < BS.R - 0.25) {
      const k = Math.abs(dx) > Math.abs(dz) ? (dx < 0 ? 'L' : 'R') : (dz < 0 ? 'F' : 'B');
      P.kbT = 0.3; impact(P.x, P.z, [0xffffff, 0xd9d2c0], 0.15);
      const f = P.faceTarget; P.nohit = true;
      if (!PL.tryMove(k, 1, true, true)) { const k2 = k === 'F' || k === 'B' ? (dx < 0 ? 'L' : 'R') : (dz < 0 ? 'F' : 'B'); PL.tryMove(k2, 1, true, true); }
      P.nohit = false; P.faceTarget = f;
    }
  }
  let tilt = 0;
  if (P.bump > 0) { P.bump -= dt; tilt = Math.sin(P.bump * 70) * 0.16 * (P.bump / 0.18); }
  pscale.rotation.z = tilt;
  pscale.scale.set(sxz, sy, sxz);
  pg.position.set(P.x, P.y + P.lift, P.z);

  // hazards that touch the player's lane right now. A flyer is above cars, trains and water, but the boss and the wave still get it.
  const grounded = !P.jumping || P.y - P.baseY < 0.5;
  if (!P.fly && grounded) {
    const row = W.get(Math.round(-P.z));
    const o = row && W.hitAt(row, P.x, now);
    if (o) PL.hurt('car', o);
  }
  if ((P.fly || grounded) && AH.boss && AH.boss.lethalAt(P.x, P.z)) PL.hurt('boss', null);
};

/* ---- input ---- */
let activeId = null, sx = 0, sy = 0, ignoreUp = false, holding = false;
PL.isHolding = () => holding;
/* Direction of a drag, or null while the finger is still inside the dead zone. The dead zone never changes which way the character faces. */
function dragDir(dx, dy) {
  if (Math.hypot(dx, dy) < 24 * (AH.uPx || 1)) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'L' : 'R';
  return dy < 0 ? 'F' : 'B';
}
const stage = AH.stage;
stage.addEventListener('pointerdown', function (e) {
  if (activeId !== null) return;
  AH.audio();
  if (G.state === 'dead' || P.auto) return;
  activeId = e.pointerId; ignoreUp = false;
  try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  sx = e.clientX; sy = e.clientY; holding = true; P.holding = true; P.holdT = 0;
});
stage.addEventListener('pointermove', function (e) {
  if (e.pointerId !== activeId || !holding) return;
  const k = dragDir(e.clientX - sx, e.clientY - sy);
  if (k) setFace(k);
});
function pointerUp(e) {
  if (e.pointerId !== activeId) return;
  activeId = null;
  const was = holding; holding = false; P.holding = false;
  if (ignoreUp) { ignoreUp = false; return; }
  if (was && e.type === 'pointerup') PL.tryMove(dragDir(e.clientX - sx, e.clientY - sy) || 'F');
}
stage.addEventListener('pointerup', pointerUp);
stage.addEventListener('pointercancel', pointerUp);
stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });
/* abilities that fire while a finger is down cancel the pending hop on release */
PL.cancelHold = function () { if (holding) { holding = false; P.holding = false; ignoreUp = true; } };
PL.resetInput = function () { holding = false; P.holding = false; };
PL.press = function () {
  if (G.state === 'dead') return;
  AH.audio();
  if (P.auto) { if (P.ch.cancel) P.ch.cancel(P); return; }
  if (P.ch.press) P.ch.press(P);
};
const KEYS = { ArrowUp: 'F', KeyW: 'F', Space: 'F', Enter: 'F', ArrowDown: 'B', KeyS: 'B', ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R' };
window.addEventListener('keydown', function (e) {
  if (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { if (!e.repeat) { e.preventDefault(); P.holding = true; PL.press(); P.holding = holding; } return; }
  const k = KEYS[e.code];
  if (!k || e.repeat) return;
  e.preventDefault(); AH.audio();
  if (G.state === 'dead') { if (k === 'F' && AH.restart) AH.restart(); return; }
  if (!P.auto) PL.tryMove(k);
});
})();
