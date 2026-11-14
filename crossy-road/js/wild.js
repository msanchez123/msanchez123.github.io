/* wild.js: living creatures on the ground (wildlands) and in the sky.
 * Ground creatures live in "wildlands", vast patches of open ground (they replace the old creature roads). They are scattered around, idle and wander, and
 * when one faces you from close by it notices you: a "!" pops up above its head, then it chases you for a few seconds and finally gives up. Touching any of them is
 * fatal. Now and then an aerial predator spots you anywhere on the map, hovers over you, then dives at a spot that was marked on the ground a moment earlier.
 * All of it is simulated locally on each phone (nothing is sent over the network): it only ever threatens the local player. */
(function () {
'use strict';
const AH = window.AH, T = AH.T, W = AH.world, COLS = AH.COLS, Wd = AH.wild = {};
const list = [];
let bird = null, birdT = 26, ringM = null;
const rg = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;
const adiff = (a, b) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return d; };
const markGeo = new AH.Builder().box(0.34, 0.62, 0.08, 0xffffff, 0, 0, -0.03).box(0.15, 0.36, 0.1, 0xe5232d, 0, 0.09, 0).box(0.15, 0.15, 0.1, 0xe5232d, 0, -0.2, 0).build();

/* ---- ground creatures ---- */
Wd.populate = function (row, th) {
  const bs = AH.BEASTS && AH.BEASTS[th.id]; if (!bs) return;
  const n = Math.random() < 0.62 ? (Math.random() < 0.3 ? 2 : 1) : 0;
  for (let i = 0; i < n; i++) {
    const big = Math.random() < 0.3, style = big ? bs.big : bs.small;
    let x = 0, ok = false;
    for (let t = 0; t < 8; t++) { x = Math.round(rg(-COLS, COLS)); if (!row.blockers.has(x)) { ok = true; break; } }
    if (!ok) continue;
    const g = new T.Group(), body = new T.Group(), m = new T.Mesh(W.beastGeo(style), AH.VM), mark = new T.Mesh(markGeo, AH.VM);
    m.castShadow = true; body.add(m); g.add(body); mark.visible = false; g.add(mark);
    const px = x + rg(-0.3, 0.3), pz = -row.r + rg(-0.3, 0.3);
    g.position.set(px, 0, pz); AH.scene.add(g);
    const hd = rg(0, TAU);
    list.push({ g: g, body: body, mark: mark, big: big, row: row.r, hx: px, hz: pz, x: px, z: pz, hd: hd, vh: hd, st: 'idle', t: rg(0, 2), walking: false, ph: rg(0, 6), cd: rg(0, 2), tc: 0, hop: 0 });
  }
};
Wd.drop = function (r) {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].row === r) { AH.scene.remove(list[i].g); list.splice(i, 1); }
};
Wd.clear = function () {
  list.forEach(c => AH.scene.remove(c.g)); list.length = 0;
  if (bird) { AH.scene.remove(bird.g); bird = null; } if (ringM) ringM.visible = false;
  birdT = 26;
};
/* is a chasing / close creature near this spot? (the robot autopilot asks) */
Wd.dangerAt = function (x, z) {
  for (const c of list) if (c.g.visible && Math.hypot(x - c.x, z - c.z) < (c.st === 'idle' ? 1.2 : 1.9)) return true;
  return false;
};
/* move along heading hd; blocked by trees, rocks and any ground that is not open grass. Returns true if it moved. */
function step(c, hd, sp, dt) {
  const nx = c.x + Math.cos(hd) * sp * dt, nz = c.z + Math.sin(hd) * sp * dt;
  const free = (x, z) => { const r = W.get(Math.round(-z)); return !!r && r.type === 'grass' && Math.abs(x) <= COLS && !r.blockers.has(Math.round(x)); };
  if (free(nx, nz)) { c.x = nx; c.z = nz; return true; }
  if (free(nx, c.z)) { c.x = nx; return true; }
  if (free(c.x, nz)) { c.z = nz; return true; }
  return false;
}
function updateCreature(c, dt, P, alive, now) {
  const far = Math.abs(c.row - P.row) > 18;
  c.g.visible = !far; if (far) return;
  c.t -= dt; c.cd -= dt; c.tc += dt;
  const dx = P.x - c.x, dz = P.z - c.z, d = Math.hypot(dx, dz), toP = Math.atan2(dz, dx);
  const sp = c.big ? 3.0 : 3.7;
  let moving = false, jump = 0;
  if (c.st === 'idle') {
    if (c.t <= 0) {
      if (c.walking) { c.walking = false; c.t = rg(1, 2.6); }
      else {
        c.walking = true; c.t = rg(0.8, 1.7);
        c.hd = Math.hypot(c.x - c.hx, c.z - c.hz) > 5 ? Math.atan2(c.hz - c.z, c.hx - c.x) + rg(-0.5, 0.5) : c.hd + rg(-1.7, 1.7);
      }
    }
    if (c.walking) { moving = step(c, c.hd, c.big ? 0.9 : 1.15, dt); if (!moving) { c.hd += 2.2; c.t = Math.min(c.t, 0.3); } }
    // spotted you: close, and looking your way
    if (alive && c.cd <= 0 && d < (c.big ? 7.6 : 6.6) && Math.abs(adiff(c.vh, toP)) < 0.95 && Math.abs(c.row - P.row) < 9) {
      c.st = 'alert'; c.t = 0.55; c.hd = toP; c.tc = 0; AH.beep(900, 0.12, 'square', 0.04, 500);
    }
  } else if (c.st === 'alert') {
    c.hd = toP; jump = Math.sin(Math.PI * (1 - c.t / 0.55)) * 0.55;
    if (c.t <= 0) { c.st = 'chase'; c.t = rg(3.2, 4.4); c.tc = 0; }
  } else if (c.st === 'chase') {
    const ad = adiff(c.hd, toP); c.hd += ad * Math.min(1, dt * 6);
    moving = step(c, c.hd, sp, dt);
    if (c.t <= 0 || !alive) { c.st = 'idle'; c.cd = 3.5; c.walking = false; c.t = rg(1, 2); }
  }
  // touching any creature is fatal (a flyer is above it)
  if (alive && !P.fly && P.y - P.baseY < 0.5 && d < (c.big ? 0.85 : 0.62)) {
    AH.player.hurt('beast', null);
    if (!P.dead) { AH.burst(12, c.x, 0.6, c.z, [0xffd23f, 0xffffff, 0xff7a1a], 3, 4); c.dead = true; }
  }
  // animation: bob / waddle while walking, a bouncing gallop when chasing, breathing when still, a hop and a "!" when it spots you
  c.vh += adiff(c.vh, c.hd) * Math.min(1, dt * (c.st === 'chase' ? 12 : 6));
  c.ph += dt * (c.st === 'chase' ? 12 : moving ? 8 : 2.2);
  const s = Math.sin(c.ph), a = Math.abs(s);
  let by = jump, lean = 0, roll = 0, sy = 1 + Math.sin(c.ph) * (moving ? 0 : 0.025);
  if (c.st === 'chase') { by += a * 0.24; lean = -0.2; roll = s * 0.1; sy = 1 + (0.5 - a) * 0.12; }
  else if (moving) { by += a * 0.1; roll = s * 0.06; lean = -0.04; sy = 1 + (0.5 - a) * 0.06; }
  else if (c.st === 'alert') { lean = 0.25; sy = 1.08; }
  c.g.position.set(c.x, by, c.z);
  c.body.rotation.y = -c.vh; c.body.rotation.z = lean; c.body.rotation.x = roll; c.body.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
  const showMark = c.st === 'alert' || (c.st === 'chase' && c.tc < 1.1);
  c.mark.visible = showMark;
  if (showMark) { const pop = c.st === 'alert' ? Math.min(1, (0.55 - c.t) * 9) : 1; c.mark.position.set(0, (c.big ? 2.1 : 1.45) + by * 0.5 + Math.sin(now * 12) * 0.05, 0); c.mark.scale.setScalar(0.3 + 0.7 * pop); }
}

/* ---- aerial predator ---- */
const BIRD = { forest: [0x7a5535, 0xe6d9b8, 0xffc24a], winter: [0xf4f8ff, 0xffffff, 0xffa31a], desert: [0x3a3030, 0xd9a0a0, 0xffd23f], volcano: [0x3a2430, 0xff7a1a, 0xffd23f], city: [0x2a2f3a, 0x4a5160, 0xffe14a], temple: [0x2f4a3a, 0xf2c14e, 0xffd23f] };
function buildBird(th) {
  const c = BIRD[th.id] || BIRD.forest, g = new T.Group(), body = new T.Group(), B = AH.Builder;
  body.add(new T.Mesh(new B().box(0.55, 0.35, 1.0, c[0], 0, 0, 0).box(0.4, 0.3, 0.4, c[1], 0, 0.08, -0.62).box(0.12, 0.1, 0.3, c[2], 0, 0.02, -0.92).box(0.3, 0.06, 0.5, c[0], 0, 0.02, 0.7).box(0.1, 0.1, 0.06, 0x111111, 0.12, 0.14, -0.8).box(0.1, 0.1, 0.06, 0x111111, -0.12, 0.14, -0.8).build(), AH.VM));
  const wing = s => { const p = new T.Group(); p.position.set(s * 0.25, 0.1, -0.05); p.add(new T.Mesh(new B().box(1.1, 0.06, 0.6, c[0], s * 0.55, 0, 0).box(0.6, 0.05, 0.46, c[1], s * 1.35, -0.02, 0.05).build(), AH.VM)); return p; };
  const wl = wing(-1), wr = wing(1); body.add(wl, wr); g.add(body);
  const mark = new T.Mesh(markGeo, AH.VM); mark.position.y = 0.9; g.add(mark);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { g: g, body: body, wl: wl, wr: wr, mark: mark };
}
function canSpawnBird(P, G) {
  return G.state === 'play' && !P.dead && P.row >= 18 && !(AH.boss && AH.boss.on) && W.arenaStart(P.row) < 0 && AH.nextArena(P.row) - P.row > 7 && !P.auto;
}
function updateBird(dt, P, G, now) {
  if (!ringM) {
    ringM = new T.Mesh(new T.RingGeometry(0.15, 1, 32).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xe5232d, transparent: true, opacity: 0.6, depthWrite: false, side: T.DoubleSide }));
    ringM.visible = false; ringM.renderOrder = 4; AH.scene.add(ringM);
  }
  if (!bird) {
    ringM.visible = false;
    birdT -= dt;
    if (birdT <= 0) {
      if (!canSpawnBird(P, G)) { birdT = 4; return; }
      const b = buildBird(AH.themeAt(P.row)), side = Math.random() < 0.5 ? -1 : 1;
      AH.scene.add(b.g);
      bird = Object.assign(b, { st: 'in', t: 0, x: P.x + side * 16, y: 8, z: P.z - 7, tx: 0, tz: 0, vx: 0, vz: 0 });
      AH.beep(1100, 0.18, 'square', 0.04, -300);
    }
    return;
  }
  const b = bird; b.t += dt;
  if (!canSpawnBird(P, G) && b.st !== 'out') { b.st = 'out'; b.t = 0; }
  let gx, gy, gz, k = 1;
  b.mark.visible = false;
  if (b.st === 'in') { gx = P.x; gy = 5.5; gz = P.z; k = 2.4; b.mark.visible = true; if (b.t > 1.0) { b.st = 'track'; b.t = 0; } }
  else if (b.st === 'track') { gx = P.x + Math.sin(now * 2) * 0.8; gy = 5.2; gz = P.z; k = 2.6; b.mark.visible = b.t < 0.8; if (b.t > 2.8) { b.st = 'aim'; b.t = 0; b.tx = P.x; b.tz = P.z; } }
  else if (b.st === 'aim') { gx = b.tx; gy = 5.6; gz = b.tz; k = 6; ringM.visible = true; ringM.position.set(b.tx, 0.3, b.tz); const q = 1.6 - 0.7 * Math.min(1, b.t / 0.9); ringM.scale.set(q, 1, q); ringM.material.opacity = 0.35 + 0.35 * Math.abs(Math.sin(b.t * 16)); if (b.t > 0.9) { b.st = 'dive'; b.t = 0; AH.beep(500, 0.3, 'sawtooth', 0.05, -400); } }
  else if (b.st === 'dive') {
    const f = Math.min(1, b.t / 0.28); gx = b.tx; gz = b.tz; gy = 5.6 - 5.2 * f * f; k = 40; ringM.visible = true;
    if (b.t >= 0.28) {
      ringM.visible = false; AH.burst(14, b.tx, 0.3, b.tz, [0xd9d2c0, 0xffffff, 0xffd23f], 3.4, 4); AH.cam.shake = Math.max(AH.cam.shake, 0.25); AH.beep(110, 0.2, 'square', 0.07, -60);
      if (!P.dead && !P.fly && P.y - P.baseY < 0.5 && Math.hypot(P.x - b.tx, P.z - b.tz) < 1.0) AH.player.hurt('beast', null);
      b.st = 'out'; b.t = 0;
    }
  } else { gx = b.x + (b.vx >= 0 ? 1 : -1) * 20; gy = 9; gz = b.z - 10; k = 1.6; if (b.t > 1.8) { AH.scene.remove(b.g); bird = null; ringM.visible = false; birdT = rg(35, 55); return; } }
  const kk = Math.min(1, dt * k), ox = b.x, oz = b.z;
  b.x += (gx - b.x) * kk; b.y += (gy - b.y) * kk; b.z += (gz - b.z) * kk;
  b.vx = (b.x - ox) / Math.max(dt, 1e-3); b.vz = (b.z - oz) / Math.max(dt, 1e-3);
  const diving = b.st === 'dive' || b.st === 'aim';
  if (Math.hypot(b.vx, b.vz) > 0.8) b.g.rotation.y = Math.atan2(-b.vx, -b.vz);
  b.g.position.set(b.x, b.y, b.z);
  const fl = Math.sin(now * (diving ? 26 : 15)) * (diving ? 0.35 : 0.7);
  b.wl.rotation.z = -fl; b.wr.rotation.z = fl; b.body.rotation.x = diving ? 0.9 : 0.1 * Math.sin(now * 15);
  b.mark.rotation.y = -b.g.rotation.y;
}

Wd.update = function (dt) {
  const P = AH.P, G = AH.G, now = AH.now(), alive = !P.dead && G.state === 'play';
  for (let i = list.length - 1; i >= 0; i--) {
    const c = list[i]; updateCreature(c, dt, P, alive, now);
    if (c.dead) { AH.scene.remove(c.g); list.splice(i, 1); }
  }
  updateBird(dt, P, G, now);
};
})();
