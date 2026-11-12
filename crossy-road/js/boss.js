/* boss.js: a random giant creature guards every 50th lane. One phone (the host) runs the brain, everyone sees it and gets hurt by it.
 * Touching it while it is not exhausted, or standing in a slam / cone, is a one hit KO. Hop into it while it is exhausted to hurt it. */
(function () {
'use strict';
const AH = window.AH, T = AH.T, W = AH.world, COLS = AH.COLS;
const B = AH.boss = { on: false, A: 0, st: 'none', tm: 0, hp: 0, max: 10, x: 0, z: 0, rot: 0, px: 0, pz: 0, prot: 0, ax: 0, az: 0, dx: 0, dz: 0, chaseT: 3, flash: 0, hitFlag: false, group: null, mat: null, bossSeed: '', sent: 0 };
const R_BODY = 1.7, SLAM_R = 2.7, CONE_LEN = 8, CONE_HALF = 0.5;

/* ---- the creature: a different monster for every arena ---- */
function buildCreature(seed) {
  const rng = AH.seeded(seed), R = (a, b) => a + rng() * (b - a), RI = (a, b) => Math.floor(R(a, b + 0.999));
  const hsl = (h, s, l) => new T.Color().setHSL(((h % 1) + 1) % 1, s, l).getHex();
  const hue = rng(), c1 = hsl(hue, 0.55, 0.5), c2 = hsl(hue + 0.06, 0.45, 0.68), c3 = hsl(hue + 0.5, 0.6, 0.5), dark = hsl(hue, 0.4, 0.25);
  const b = new AH.Builder();
  const bw = R(2.0, 2.8), bh = R(1.5, 2.3), bd = R(2.2, 3.0), y0 = 0.55;
  b.box(bw, bh, bd, c1, 0, y0 + bh / 2, 0).box(bw * 0.8, bh * 0.45, bd * 0.92, c2, 0, y0 + bh * 0.28, 0.05);
  const hw = R(1.2, 1.9), hy = y0 + bh + hw * 0.25, hz = -bd / 2 - hw * 0.15;
  b.box(hw, hw * 0.85, hw, c1, 0, hy, hz);
  const eyes = RI(1, 5), es = Math.min(0.5, hw / (eyes + 0.8));
  for (let i = 0; i < eyes; i++) {
    const ex = (i - (eyes - 1) / 2) * (hw * 0.78 / Math.max(1, eyes)) * 1.3, ey = hy + R(0.05, 0.3);
    b.box(es, es, 0.14, 0xffffff, ex, ey, hz - hw / 2).box(es * 0.45, es * 0.55, 0.1, dark, ex, ey, hz - hw / 2 - 0.1);
  }
  for (let i = 0, n = RI(3, 6); i < n; i++) b.box(hw / (n * 1.6), 0.2, 0.12, 0xffffff, (i - (n - 1) / 2) * (hw * 0.8 / n), hy - hw * 0.28, hz - hw / 2);
  for (let i = 0, n = RI(0, 4); i < n; i++) { const hx = (i - (n - 1) / 2) * (hw * 0.7 / Math.max(1, n - 1 || 1)); b.box(0.3, 0.5, 0.3, 0xf1ead2, hx, hy + hw * 0.55, hz).box(0.18, 0.4, 0.18, 0xf1ead2, hx, hy + hw * 0.55 + 0.4, hz); }
  for (let i = 0, n = RI(0, 6); i < n; i++) b.box(0.3, R(0.4, 0.9), 0.3, c3, 0, y0 + bh + 0.2, bd / 2 - (i + 0.5) * (bd / Math.max(1, n)));
  const legs = [2, 4, 4, 6][RI(0, 3)], lh = R(0.6, 0.9);
  for (let i = 0; i < legs; i++) { const sx = i % 2 ? 1 : -1, lz = ((i >> 1) - (legs / 4 - 0.5)) * (bd * 0.7 / Math.max(1, legs / 2 - 1 || 1)); b.box(0.5, lh, 0.5, dark, sx * (bw / 2 - 0.15), lh / 2, lz).box(0.7, 0.14, 0.8, c3, sx * (bw / 2 - 0.15), 0.07, lz - 0.1); }
  for (let side = -1; side <= 1; side += 2) for (let i = 0, n = RI(0, 2); i < n; i++) {
    const az = R(-0.8, 0.8);
    b.box(0.4, 0.4, 0.4, c1, side * (bw / 2 + 0.2), y0 + bh * 0.6, az).box(0.34, 0.34, 0.34, c2, side * (bw / 2 + 0.5), y0 + bh * 0.4, az - 0.2).box(0.28, 0.28, 0.28, c3, side * (bw / 2 + 0.75), y0 + bh * 0.2, az - 0.4);
  }
  for (let i = 0, n = RI(2, 5); i < n; i++) b.box(0.5 - i * 0.06, 0.5 - i * 0.06, 0.6, c1, 0, y0 + 0.5 + i * 0.1, bd / 2 + 0.3 + i * 0.55);
  if (rng() < 0.4) b.box(0.08, 0.9, 0.08, dark, 0.3, hy + hw * 0.6 + 0.3, hz).box(0.22, 0.22, 0.22, 0xffd23f, 0.3, hy + hw * 0.6 + 0.85, hz);
  return b.build();
}

/* ---- telegraphs ---- */
const tmat = c => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.3, depthWrite: false, side: T.DoubleSide });
const circle = new T.Mesh(new T.CircleGeometry(1, 32).rotateX(-Math.PI / 2), tmat(0xe5484d));
const lane = new T.Mesh((function () { const g = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); g.translate(0, 0, -0.5); return g; })(), tmat(0xe5484d));
const cone = (function () {
  const pts = [0, 0, 0]; for (let i = 0; i <= 12; i++) { const a = -CONE_HALF + 2 * CONE_HALF * i / 12; pts.push(Math.sin(a), 0, -Math.cos(a)); }
  const idx = []; for (let i = 1; i <= 12; i++) idx.push(0, i + 1, i);
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); g.setIndex(idx);
  return new T.Mesh(g, tmat(0xe5484d));
})();
[circle, lane, cone].forEach(m => { m.visible = false; m.position.y = 0.06; m.renderOrder = 2; AH.scene.add(m); });

/* ---- shared helpers ---- */
function players() {
  const out = [], P = AH.P;
  if (!P.dead && !(AH.G.state === 'ready' && !AH.G.rs && false)) out.push({ x: P.x, z: P.z, fly: P.fly, row: P.row });
  AH.ghosts.forEach(g => { if (!g.dead && !g.first) out.push({ x: g.tx, z: g.tz, fly: g.fly, row: Math.round(-g.tz) }); });
  return out;
}
const isHost = () => !AH.net || AH.net.isHost();
const fwd = rot => [-Math.sin(rot), -Math.cos(rot)];

B.start = function (A) {
  if (B.on) return;
  B.on = true; B.A = A; B.st = 'spawn'; B.tm = 0; B.hp = B.max; B.x = B.px = 0; B.z = B.pz = -(A + 12); B.rot = B.prot = 0; B.chaseT = 3; B.flash = 0;
  const g = buildCreature((AH.roomSeed || 'solo') + ':boss:' + A);
  B.mat = new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x000000 });
  B.group = new T.Group(); const mesh = new T.Mesh(g, B.mat); mesh.castShadow = true; B.group.add(mesh); B.mesh = mesh;
  B.group.position.set(B.x, 0, B.z); AH.scene.add(B.group);
  AH.beep(80, 0.8, 'sawtooth', 0.08, -30); AH.cam.shake = 0.5;
  AH.emit('boss-start', A);
};
B.clear = function () {
  if (B.group) AH.scene.remove(B.group);
  B.group = null; B.on = false; B.st = 'none';
  circle.visible = lane.visible = cone.visible = false;
};

B.hurt = function (n) {
  if (!B.on || B.st === 'dying' || B.st === 'spawn') return;
  if (!isHost()) { AH.net.event('bdmg', { n: n }); return; }
  B.hp -= n; B.flash = 0.25; AH.beep(200, 0.15, 'square', 0.06, -100);
  if (B.hp <= 0) { B.st = 'dying'; B.tm = 0; }
  B.sent = 0;
};

B.lethalAt = function (x, z) {
  if (!B.on || B.st === 'spawn' || B.st === 'dying' || B.st === 'tired') return false;
  const d = Math.hypot(x - B.x, z - B.z);
  if (d < R_BODY + 0.3) return true;
  if (B.st === 'slam') return Math.hypot(x - B.ax, z - B.az) < SLAM_R;
  if (B.st === 'cone') {
    const f = fwd(B.rot), dx = x - B.x, dz = z - B.z, l = Math.hypot(dx, dz);
    return l < CONE_LEN && l > 0.01 && (dx * f[0] + dz * f[1]) / l > Math.cos(CONE_HALF);
  }
  return false;
};
/* a hop aimed at an exhausted boss is blocked and counts as a hit */
B.hopCheck = function (x, z) {
  if (!B.on || B.st !== 'tired') return false;
  if (Math.hypot(x - B.x, z - B.z) < R_BODY + 0.6) { B.hitFlag = true; return true; }
  return false;
};

/* ---- host brain ---- */
function nearest(from) {
  const ps = players(); let best = null, bd = 1e9;
  const pool = ps.filter(p => !p.fly).length ? ps.filter(p => !p.fly) : ps;
  pool.forEach(p => { const d = Math.hypot(p.x - from.x, p.z - from.z); if (d < bd) { bd = d; best = p; } });
  return best;
}
function face(tx, tz, dt, k) {
  const want = Math.atan2(-(tx - B.x), -(tz - B.z));
  let d = want - B.rot; d = Math.atan2(Math.sin(d), Math.cos(d));
  B.rot += d * Math.min(1, dt * k);
}
function clampPos() {
  B.x = AH.clamp(B.x, -COLS + 0.5, COLS - 0.5);
  B.z = AH.clamp(B.z, -(B.A + 13), -(B.A + 1));
}
function think(dt) {
  B.tm += dt;
  const tg = nearest(B);
  switch (B.st) {
    case 'spawn': if (B.tm > 1.6) { B.st = 'chase'; B.tm = 0; B.chaseT = 2.5; } break;
    case 'chase':
      if (tg) { face(tg.x, tg.z, dt, 5); const f = fwd(B.rot); B.x += f[0] * 2.6 * dt; B.z += f[1] * 2.6 * dt; clampPos(); }
      if (B.tm > B.chaseT) { const r = Math.random(); B.st = r < 0.4 ? 'tcharge' : r < 0.7 ? 'tslam' : 'tcone'; B.tm = 0; }
      break;
    case 'tcharge':
      if (tg && B.tm < 0.65) face(tg.x, tg.z, dt, 8);
      if (B.tm > 1.0) { B.st = 'charge'; B.tm = 0; }
      break;
    case 'charge': {
      const f = fwd(B.rot), ox = B.x, oz = B.z;
      B.x += f[0] * 13 * dt; B.z += f[1] * 13 * dt; clampPos();
      if (B.tm > 1.5 || Math.hypot(B.x - ox, B.z - oz) < 13 * dt * 0.3) { B.st = 'tired'; B.tm = 0; AH.cam.shake = Math.max(AH.cam.shake, 0.4); }
      break; }
    case 'tslam':
      if (tg && B.tm < 0.5) { B.ax = tg.x; B.az = tg.z; }
      if (B.tm > 1.1) { B.st = 'slam'; B.tm = 0; AH.cam.shake = Math.max(AH.cam.shake, 0.4); }
      break;
    case 'slam': if (B.tm > 0.3) { B.st = 'chase'; B.tm = 0; B.chaseT = 2 + Math.random() * 1.5; } break;
    case 'tcone':
      if (tg && B.tm < 0.6) face(tg.x, tg.z, dt, 8);
      if (B.tm > 1.1) { B.st = 'cone'; B.tm = 0; }
      break;
    case 'cone': if (B.tm > 0.35) { B.st = 'chase'; B.tm = 0; B.chaseT = 2 + Math.random() * 1.5; } break;
    case 'tired': if (B.tm > 2.8) { B.st = 'chase'; B.tm = 0; B.chaseT = 2.5; } break;
    case 'dying':
      if (B.tm > 2.2 && !B.done) { B.done = true; AH.net ? AH.net.event('beat', { a: B.A }, true) : AH.onBeat(B.A); }
      break;
  }
}

/* ---- network state ---- */
B.pack = function () { return [B.A, B.st, +B.x.toFixed(2), +B.z.toFixed(2), +B.rot.toFixed(2), B.hp, +B.ax.toFixed(2), +B.az.toFixed(2), +B.tm.toFixed(2)]; };
B.apply = function (s) {
  if (!B.on) { if (s[1] === 'none') return; B.start(s[0]); }
  if (B.st !== s[1]) B.tm = s[8];
  B.st = s[1]; B.px = s[2]; B.pz = s[3]; B.prot = s[4]; B.hp = s[5]; B.ax = s[6]; B.az = s[7];
};

/* ---- per frame (everyone) ---- */
B.update = function (dt) {
  const host = isHost();
  if (!B.on) {
    if (!host) return;
    const A = W.firstOpenArena();
    if (players().some(p => p.row >= A + 1)) { B.start(A); B.done = false; }
    return;
  }
  if (host) { think(dt); B.px = B.x; B.pz = B.z; B.prot = B.rot; }
  else {
    B.tm += dt;
    const k = Math.min(1, dt * 12);
    B.x += (B.px - B.x) * k; B.z += (B.pz - B.z) * k;
    let d = B.prot - B.rot; d = Math.atan2(Math.sin(d), Math.cos(d)); B.rot += d * k;
  }
  B.flash = Math.max(0, B.flash - dt);
  if (!B.group) return;
  const s = B.st, bob = Math.sin(AH.now() * 6) * 0.05;
  B.group.position.set(B.x, bob + (s === 'spawn' ? -2 * Math.max(0, 1 - B.tm / 1.4) : 0), B.z);
  B.group.rotation.y = B.rot;
  const sc = s === 'dying' ? Math.max(0.05, 1 - B.tm / 2.2) : 1;
  B.group.scale.set(sc, sc * (s === 'tired' ? 0.92 : 1), sc);
  if (s === 'dying') { B.group.rotation.z = Math.sin(B.tm * 30) * 0.08; if (Math.random() < 0.4) AH.burst(2, B.x, 1.5, B.z, [0xffd23f, 0xffffff, 0xe5484d], 3, 4); }
  const hot = s === 'tcharge' || s === 'tslam' || s === 'tcone';
  B.mat.emissive.setHex(B.flash > 0 ? 0xffffff : hot ? (Math.floor(AH.now() * 10) % 2 ? 0x992222 : 0x330000) : s === 'tired' ? 0x2244aa : 0x000000);
  // telegraphs
  circle.visible = s === 'tslam' || s === 'slam';
  if (circle.visible) { circle.position.set(B.ax, 0.06, B.az); circle.scale.set(SLAM_R, 1, SLAM_R); circle.material.opacity = s === 'slam' ? 0.7 : 0.25 + 0.15 * Math.sin(B.tm * 18); }
  lane.visible = s === 'tcharge';
  if (lane.visible) { lane.position.set(B.x, 0.06, B.z); lane.rotation.y = B.rot; lane.scale.set(3.4, 1, 16); lane.material.opacity = 0.2 + 0.15 * Math.sin(B.tm * 18); }
  cone.visible = s === 'tcone' || s === 'cone';
  if (cone.visible) { cone.position.set(B.x, 0.06, B.z); cone.rotation.y = B.rot; cone.scale.set(CONE_LEN, 1, CONE_LEN); cone.material.opacity = s === 'cone' ? 0.7 : 0.25 + 0.15 * Math.sin(B.tm * 18); }
  // host streams its state to the room
  if (host && AH.net) { B.sent -= dt; if (B.sent <= 0) { B.sent = 0.1; AH.net.sendBoss(B.pack()); } }
};
})();
