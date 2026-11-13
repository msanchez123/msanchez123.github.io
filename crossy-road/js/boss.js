/* boss.js: a random giant creature guards every 50th lane. One phone (the host) runs the brain, everyone sees it and gets hurt by it.
 * It sleeps until every living player is inside the arena (someone who died on the way is simply not waited for), wakes with a roar, and moves
 * only along the four directions a player can hop in. Touching it, or standing in a slam / cone / meteor / pool, is a one hit KO. Hop into it
 * while it is exhausted to hurt it. At half health it enrages: faster, and the arena floor itself turns deadly in places. */
(function () {
'use strict';
const AH = window.AH, T = AH.T, W = AH.world, COLS = AH.COLS;
const B = AH.boss = { on: false, A: 0, st: 'none', tm: 0, hp: 0, max: 10, x: 0, z: 0, rot: 0, px: 0, pz: 0, prot: 0, ax: 0, az: 0, dir: [0, -1], axT: 0, phase: 1, pools: [], mets: [], kit: { summon: true }, chaseT: 3, flash: 0, hitFlag: false, group: null, mat: null, sent: 0 };
const R_BODY = 1.7, SLAM_R = 2.7, CONE_LEN = 8, CONE_HALF = 0.5, MET_R = 1.4, MET_WARN = 1.2;

/* ---- the creature: a different monster for every arena ---- */
function buildCreature(seed) {
  B.kind = 'creature';
  const rng = AH.seeded(seed), R = (a, b) => a + rng() * (b - a), RI = (a, b) => Math.floor(R(a, b + 0.999));
  const hsl = (h, s, l) => new T.Color().setHSL(((h % 1) + 1) % 1, s, l).getHex();
  const hue = rng(), c1 = hsl(hue, 0.55, 0.5), c2 = hsl(hue + 0.06, 0.45, 0.68), c3 = hsl(hue + 0.5, 0.6, 0.5), dark = hsl(hue, 0.4, 0.25);
  const b = new AH.Builder();
  const theme = AH.themeAt(B.A), special = rng();
  // Rare playful mechanical bosses; most encounters remain fantastical.
  if (special < 0.035) { // helicopter (very rare)
    B.kind = 'helicopter';
    b.box(3.8, 1.0, 2.0, 0x536273, 0, 1.25, 0).box(1.8, 0.85, 1.5, 0x71869a, 0, 1.5, -0.35)
      .box(1.0, 0.5, 0.08, 0x9fe8ff, 0, 1.55, -1.12).box(0.18, 0.35, 0.18, 0x394653, 0, 2.0, 0)
      .box(2.2, 0.18, 0.18, 0x394653, 2.65, 1.2, 0).box(0.35, 0.28, 0.35, 0xe5484d, 3.65, 1.2, 0);
    for (const side of [-1, 1]) b.box(0.45, 0.35, 0.55, 0x303b49, side * 1.1, 0.55, 0.3);
    return b.build();
  }
  B.kind = 'creature';
  if (special < 0.075) { // giant car (rare)
    B.kind = 'car';
    b.box(4.6, 1.15, 2.2, 0xe5484d, 0, 1.05, 0).box(2.7, 1.0, 1.85, 0x9ed9ed, 0, 1.9, -0.1)
      .box(4.9, 0.22, 2.35, 0x242a32, 0, 0.45, 0).box(0.35, 0.28, 0.12, 0xfff1a6, 0, 1.0, -1.14)
      .box(0.22, 0.22, 0.12, 0xfff1a6, -1.8, 1.0, -1.14).box(0.22, 0.22, 0.12, 0xfff1a6, 1.8, 1.0, -1.14);
    for (const x of [-1.55, 1.55]) for (const z of [-0.72, 0.72]) b.box(0.58, 0.58, 0.35, 0x171b22, x, 0.48, z);
    return b.build();
  }
  if (special < 0.34) { // broad ancient guardian / turtle-like colossus
    const shell = theme.id === 'desert' ? 0xb58a4b : theme.id === 'winter' ? 0x7ea6c5 : theme.id === 'volcano' ? 0x55434b : 0x477b55;
    b.box(3.4, 1.55, 3.2, shell, 0, 1.35, 0).box(2.7, 0.5, 2.5, 0xc8a86a, 0, 2.15, 0)
      .box(1.1, 1.0, 1.0, c1, 0, 1.5, -1.75).box(0.22, 0.22, 0.12, 0xffffff, -0.25, 1.7, -2.24)
      .box(0.22, 0.22, 0.12, 0xffffff, 0.25, 1.7, -2.24);
    for (const x of [-1.25, 1.25]) for (const z of [-1.0, 1.0]) b.box(0.65, 0.75, 0.7, dark, x, 0.4, z);
    for (let i = -1; i <= 1; i++) b.box(0.22, 0.65, 0.22, c3, i * 0.75, 2.55, 0.1);
    return b.build();
  }
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

/* A separate animated rig gives the rare helicopter moving rotor blades and visible side guns. */
function makeHeliRig() {
  const root = new T.Group(), metal = new T.MeshLambertMaterial({ color: 0x536273 }), dark = new T.MeshLambertMaterial({ color: 0x202a35 }), glass = new T.MeshLambertMaterial({ color: 0x9fe8ff, emissive: 0x16445a });
  const box = (mat, x, y, z, sx, sy, sz, parent) => { const m = new T.Mesh(AH.BOX, mat); m.position.set(x,y,z); m.scale.set(sx,sy,sz); (parent || root).add(m); return m; };
  const rotor = new T.Group(); rotor.position.set(0, 2.18, 0); box(dark,0,0,0,0.22,0.12,0.22,rotor);
  box(dark,0,0,0,5.8,0.07,0.22,rotor); box(dark,0,0,0,0.22,0.07,5.8,rotor); root.add(rotor);
  const tailRotor = new T.Group(); tailRotor.position.set(2.95,1.2,0); box(dark,0,0,0,0.12,0.12,0.12,tailRotor);
  box(dark,0,0,0,0.08,1.15,0.12,tailRotor); box(dark,0,0,0,0.08,0.12,1.15,tailRotor); root.add(tailRotor);
  const guns = [];
  for (const side of [-1,1]) { box(metal,side*1.55,0.72,0.25,0.65,0.32,0.58); guns.push(box(dark,side*1.85,0.7,-0.05,0.72,0.16,0.16)); box(glass,side*0.32,1.52,-1.1,0.52,0.28,0.05); }
  return { root, rotor, tailRotor, guns };
}

/* ---- telegraphs ---- */
const tmat = c => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.3, depthWrite: false, side: T.DoubleSide });
const discGeo = new T.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
const circle = new T.Mesh(discGeo, tmat(0xe5484d));
const lane = new T.Mesh((function () { const g = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); g.translate(0, 0, -0.5); return g; })(), tmat(0xe5484d));
const cone = (function () {
  const pts = [0, 0, 0]; for (let i = 0; i <= 12; i++) { const a = -CONE_HALF + 2 * CONE_HALF * i / 12; pts.push(Math.sin(a), 0, -Math.cos(a)); }
  const idx = []; for (let i = 1; i <= 12; i++) idx.push(0, i + 1, i);
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); g.setIndex(idx);
  return new T.Mesh(g, tmat(0xe5484d));
})();
[circle, lane, cone].forEach(m => { m.visible = false; m.position.y = 0.06; m.renderOrder = 2; AH.scene.add(m); });
/* phase 2 floor hazards and falling meteors */
const poolMeshes = [], metMeshes = [];
for (let i = 0; i < 6; i++) {
  const g = new T.Group(), a = new T.Mesh(discGeo, tmat(0xff6a1a)), c = new T.Mesh(discGeo, tmat(0x1a0d0d));
  a.position.y = 0.05; c.position.y = 0.07; c.scale.set(0.72, 1, 0.72); g.add(a, c); g.visible = false; AH.scene.add(g); poolMeshes.push({ g: g, a: a, c: c });
}
for (let i = 0; i < 8; i++) {
  const g = new T.Group(), d = new T.Mesh(discGeo, tmat(0xe5484d)), r = new T.Mesh(AH.BOX, AH.M(0x6b5a5a));
  d.position.y = 0.07; r.scale.set(0.9, 0.9, 0.9); g.add(d, r); g.visible = false; AH.scene.add(g); metMeshes.push({ g: g, d: d, r: r });
}
const zzz = new T.Group();
for (let i = 0; i < 3; i++) { const m = new T.Mesh(AH.BOX, AH.M(0xffffff)); m.scale.set(0.3, 0.3, 0.06); zzz.add(m); }
zzz.visible = false; AH.scene.add(zzz);

/* ---- shared helpers ---- */
function players() {
  const out = [], P = AH.P;
  if (!P.dead) out.push({ x: P.x, z: P.z, row: P.row });
  AH.ghosts.forEach(g => { if (!g.dead && !g.first) out.push({ x: g.tx, z: g.tz, row: Math.round(-g.tz) }); });
  return out;
}
const isHost = () => !AH.net || AH.net.isHost();
const fwd = rot => [-Math.sin(rot), -Math.cos(rot)];
const rotOf = d => Math.atan2(-d[0], -d[1]);
const ROARS = ['GRRAAAH!', 'WHO WOKE ME?!', 'YOU SHALL NOT PASS!', 'MY ARENA!', 'RAAAWR!!', 'CRUSH THEM!'];
const RAGES = ['ENOUGH!', 'NOW YOU SEE MY TRUE FORM!', 'THE GROUND WILL BURN!', 'I AM NOT DONE!'];

/* effects every phone plays when the boss changes state (no game logic here) */
function onEnter(st) {
  if (st === 'roar') { AH.shout && AH.shout(ROARS[(B.A / AH.ARENA_EVERY) % ROARS.length | 0]); AH.cam.shake = Math.max(AH.cam.shake, 0.6); AH.beep(70, 1.4, 'sawtooth', 0.1, -20); }
  else if (st === 'rage') { AH.shout && AH.shout(RAGES[(B.A / AH.ARENA_EVERY) % RAGES.length | 0]); AH.cam.shake = Math.max(AH.cam.shake, 0.7); AH.beep(60, 1.6, 'sawtooth', 0.11, -20); }
  else if (st === 'slam') AH.cam.shake = Math.max(AH.cam.shake, 0.4);
  else if (st === 'tired') AH.cam.shake = Math.max(AH.cam.shake, 0.4);
}
function setSt(st) {
  B.st = st; B.tm = 0;
  // Lock each attack's aim when its warning begins. Telegraphs remain fixed,
  // giving players a fair chance to react instead of following them.
  const tg = nearest(B);
  if (st === 'tslam' && tg) { B.ax = Math.round(tg.x); B.az = Math.round(tg.z); }
  if (st === 'tcone' && tg) { B.dir = pickDir(tg); snapFace(); }
  if (st === 'tcharge' && tg) { B.dir = pickDir(tg); snapFace(); }
  onEnter(st);
}

B.start = function (A) {
  if (B.on) return;
  B.on = true; B.A = A; B.st = 'sleep'; B.tm = 0; B.hp = B.max; B.phase = 1; B.pools = []; B.mets = []; B.x = B.px = 0; B.z = B.pz = -(A + 12);
  B.rot = B.prot = 0; B.dir = [0, -1]; B.axT = 0; B.chaseT = 3; B.flash = 0;
  const seed = (AH.roomSeed || 'solo') + ':boss:' + A, kr = AH.seeded(seed + ':kit');
  B.kit = { summon: kr() < 0.7 }; B.bullets = []; B.fireT = 0; B.barrierLift = 0;
  const g = buildCreature(seed);
  B.mat = new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x000000 });
  B.group = new T.Group(); const mesh = new T.Mesh(g, B.mat); mesh.castShadow = true; B.group.add(mesh); B.mesh = mesh;
  B.group.position.set(B.x, 0, B.z); AH.scene.add(B.group);
  B.heli = B.kind === 'helicopter' ? makeHeliRig() : null; if (B.heli) B.group.add(B.heli.root);
  // Decorative arena-entry barricade: it seals the entrance behind the party.
  const th = AH.themeAt(A), gate = new T.Group(), stone = AH.M(th.arena.wall), cap = AH.M(th.arena.wallTop), glow = AH.M(th.arena.accent);
  // Theme-matched sealed entrance: chunky ruin slabs, ice monoliths, basalt columns or neon pylons.
  for (const x of [-6,-4,-2,0,2,4,6]) {
    const pillar = new T.Mesh(AH.BOX, stone); pillar.scale.set(0.72, 2.35, 0.48); pillar.position.set(x, 1.15, 0); gate.add(pillar);
    const crown = new T.Mesh(AH.BOX, cap); crown.scale.set(0.9, 0.28, 0.62); crown.position.set(x, 2.42, 0); gate.add(crown);
    const rune = new T.Mesh(AH.BOX, glow); rune.scale.set(0.12, 0.72, 0.06); rune.position.set(x, 1.2, -0.27); gate.add(rune);
  }
  const lintel = new T.Mesh(AH.BOX, cap); lintel.scale.set(14.5, 0.48, 0.58); lintel.position.set(0, 2.72, 0); gate.add(lintel);
  gate.position.set(0, 0, -A); AH.scene.add(gate); B.barrier = gate;
  poolMeshes.forEach(p => { p.a.material.color.setHex(th.arena.flame[0]); p.c.material.color.setHex(th.arena.pillar[1]); });
  AH.emit('boss-start', A);
};
B.clear = function () {
  if (B.group) AH.scene.remove(B.group);
  if (B.barrier) AH.scene.remove(B.barrier);
  B.barrier = null; B.heli = null; B.bullets = []; B.group = null; B.on = false; B.st = 'none'; B.phase = 1; B.pools = []; B.mets = [];
  (B.bulletMeshes || []).forEach(m => { m.visible = false; });
  circle.visible = lane.visible = cone.visible = zzz.visible = false;
  poolMeshes.forEach(p => p.g.visible = false); metMeshes.forEach(m => m.g.visible = false);
};

B.gateBlocks = function (fromRow, toRow) {
  return !!(B.on && B.barrier && B.st === 'sleep' && fromRow >= B.A && toRow < B.A);
};

B.hurt = function (n) {
  if (!B.on || B.st === 'dying' || B.st === 'sleep' || B.st === 'roar' || B.st === 'rage') return;
  if (!isHost()) { AH.net.event('bdmg', { n: n }); return; }
  B.hp -= n; B.flash = 0.25; AH.beep(200, 0.15, 'square', 0.06, -100);
  if (B.hp <= 0) setSt('dying');
  B.sent = 0;
};

B.lethalAt = function (x, z) {
  if (!B.on || B.st === 'dying' || B.st === 'sleep') return false;
  if (B.bullets) for (const q of B.bullets) if (Math.hypot(x-q.x,z-q.z) < 0.48) return true;
  if (B.phase >= 2) for (const p of B.pools) if (Math.hypot(x - p[0], z - p[1]) < p[2] - 0.15) return true;
  for (const m of B.mets) if (m.t >= MET_WARN && m.t < MET_WARN + 0.35 && Math.hypot(x - m.x, z - m.z) < MET_R) return true;
  if (B.st === 'tired') return false;
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
B.blocks = function (x, z) { return B.on && B.st === 'tired' && Math.hypot(x - B.x, z - B.z) < R_BODY + 0.6; };
B.hopCheck = function (x, z) {
  if (!B.blocks(x, z)) return false;
  B.hitFlag = true; return true;
};

/* ---- host brain ---- */
function nearest(from) {
  const ps = players(); let best = null, bd = 1e9;
  ps.forEach(p => { const d = Math.hypot(p.x - from.x, p.z - from.z); if (d < bd) { bd = d; best = p; } });
  return best;
}
/* The boss moves like a player: along one of the four directions. It keeps its current axis until the other one is clearly longer. */
function pickDir(tg) {
  const dx = tg.x - B.x, dz = tg.z - B.z, onX = B.dir[0] !== 0;
  if (onX) return (Math.abs(dz) > Math.abs(dx) + 1.2) ? [0, Math.sign(dz) || 1] : [Math.sign(dx) || 1, 0];
  return (Math.abs(dx) > Math.abs(dz) + 1.2) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dz) || 1];
}
function face(dt, k) {
  let d = rotOf(B.dir) - B.rot; d = Math.atan2(Math.sin(d), Math.cos(d));
  B.rot += d * Math.min(1, dt * k);
}
function snapFace() { B.rot = rotOf(B.dir); }
function clampPos() {
  B.x = AH.clamp(B.x, -COLS + 0.5, COLS - 0.5);
  B.z = AH.clamp(B.z, -(B.A + 13), -(B.A + 1));
}
const rg = (a, b) => a + Math.random() * (b - a);
function spawnMeteors(n) {
  const ps = players(); if (!ps.length) return;
  for (let i = 0; i < n; i++) {
    const tg = ps[Math.floor(Math.random() * ps.length)], j = i === 0 ? 0.6 : 2.4;
    B.mets.push({ x: AH.clamp(tg.x + rg(-j, j), -COLS + 0.5, COLS - 0.5), z: AH.clamp(tg.z + rg(-j, j), -(B.A + 13), -(B.A + 1)), t: 0 });
  }
  if (B.mets.length > 8) B.mets.splice(0, B.mets.length - 8);
}
function makePools() {
  const out = [];
  for (let tries = 0; tries < 60 && out.length < 4; tries++) {
    const x = rg(-COLS + 1.5, COLS - 1.5), z = -(B.A + rg(4, 12)), r = rg(1.1, 1.6);
    if (out.every(p => Math.hypot(p[0] - x, p[1] - z) > p[2] + r + 1.6) && Math.hypot(x - B.x, z - B.z) > R_BODY + r + 0.8) out.push([+x.toFixed(2), +z.toFixed(2), +r.toFixed(2)]);
  }
  return out;
}
function think(dt) {
  B.tm += dt;
  B.mets.forEach(m => m.t += dt); B.mets = B.mets.filter(m => m.t < MET_WARN + 0.5);
  const tg = nearest(B), p2 = B.phase >= 2, spd = p2 ? 3.3 : 2.6, chaseT = () => p2 ? 1.4 + Math.random() * 1.2 : 2 + Math.random() * 1.5;
  const next = function () {
    if (B.kind === 'helicopter' && Math.random() < 0.48) { setSt('hland'); return; }
    const r = Math.random();
    if (B.kit.summon && r < (p2 ? 0.35 : 0.22)) setSt('tsum');
    else setSt(r < 0.5 ? 'tcharge' : r < 0.75 ? 'tslam' : 'tcone');
  };
  // enrage at half health
  if (!p2 && B.hp <= B.max / 2 && (B.st === 'chase' || B.st === 'tired')) { setSt('rage'); return; }
  switch (B.st) {
    case 'sleep': {
      const ps = players();
      if (ps.length && ps.every(p => p.row >= B.A + 1)) setSt('roar');
      break; }
    case 'roar': if (B.tm > 2.0) { setSt('chase'); B.chaseT = 2.2; } break;
    case 'rage':
      if (B.tm > 0.9 && B.phase < 2) { B.phase = 2; B.pools = makePools(); AH.cam.shake = 0.6; }
      if (B.tm > 2.4) { setSt('chase'); B.chaseT = 1.6; }
      break;
    case 'chase':
      if (tg) {
        B.axT -= dt; if (B.axT <= 0) { B.dir = pickDir(tg); B.axT = 0.4; }
        face(dt, 7); B.x += B.dir[0] * spd * dt; B.z += B.dir[1] * spd * dt; clampPos();
      }
      if (B.tm > B.chaseT) next();
      break;
    case 'tcharge':
      snapFace();
      if (B.tm > 0.88) { setSt('charge'); }
      break;
    case 'charge': {
      const ox = B.x, oz = B.z, sp = p2 ? 15 : 13;
      B.x += B.dir[0] * sp * dt; B.z += B.dir[1] * sp * dt; clampPos();
      if (B.tm > 1.5 || Math.hypot(B.x - ox, B.z - oz) < sp * dt * 0.3) setSt('tired');
      break; }
    case 'tslam':
      if (B.tm > 0.98) setSt('slam');
      break;
    case 'slam': if (B.tm > 0.3) { setSt('chase'); B.chaseT = chaseT(); } break;
    case 'tcone':
      snapFace();
      if (B.tm > 0.98) { setSt('cone'); }
      break;
    case 'cone': if (B.tm > 0.35) { setSt('chase'); B.chaseT = chaseT(); } break;
    case 'tsum': if (B.tm > 0.9) { spawnMeteors(p2 ? 5 : 3); setSt('sum'); } break;
    case 'sum': if (B.tm > 0.6) { setSt('chase'); B.chaseT = chaseT(); } break;
    case 'tired': if (B.tm > 2.8) { setSt('chase'); B.chaseT = 2.2; } break;
    case 'hland': if (B.tm > 0.9) { setSt('hgun'); B.fireT = 0; B.bullets = []; } break;
    case 'hgun': {
      B.fireT -= dt;
      if (B.fireT <= 0) {
        B.fireT = 0.22;
        const target = nearest(B);
        if (target) for (const side of [-1,1]) { const sx = B.x + side * 1.8, sz = B.z; const dx = target.x - sx, dz = target.z - sz, len = Math.hypot(dx,dz)||1; B.bullets.push({x:sx,z:sz,vx:dx/len*8.5,vz:dz/len*8.5,t:0}); }
      }
      B.bullets.forEach(q => { q.x += q.vx*dt; q.z += q.vz*dt; q.t += dt; }); B.bullets = B.bullets.filter(q => q.t < 1.8 && Math.abs(q.x) < COLS+1);
      if (B.tm > 3.8) { B.bullets = []; setSt('tired'); }
      break;
    }
    case 'dying':
      if (B.tm > 2.2 && !B.done) { B.done = true; AH.net ? AH.net.event('beat', { a: B.A }, true) : AH.onBeat(B.A); }
      break;
  }
}

/* ---- network state ---- */
const r2 = v => +v.toFixed(2);
B.pack = function () {
  return [B.A, B.st, r2(B.x), r2(B.z), r2(B.rot), B.hp, r2(B.ax), r2(B.az), r2(B.tm), B.phase, B.pools, B.mets.map(m => [r2(m.x), r2(m.z), r2(m.t)]), (B.bullets||[]).map(q=>[r2(q.x),r2(q.z),r2(q.vx),r2(q.vz),r2(q.t)])];
};
B.apply = function (s) {
  if (!B.on) { if (s[1] === 'none') return; B.start(s[0]); }
  if (B.st !== s[1]) { B.tm = s[8]; B.st = s[1]; onEnter(s[1]); }
  B.px = s[2]; B.pz = s[3]; B.prot = s[4]; B.hp = s[5]; B.ax = s[6]; B.az = s[7]; B.phase = s[9] || 1;
  B.pools = s[10] || []; B.mets = (s[11] || []).map(a => ({ x: a[0], z: a[1], t: a[2] })); B.bullets = (s[12] || []).map(a=>({x:a[0],z:a[1],vx:a[2],vz:a[3],t:a[4]}));
};

/* ---- per frame (everyone) ---- */
B.update = function (dt) {
  const host = isHost();
  if (!B.on) {
    if (!host) return;
    const A = W.firstOpenArena();
    if (players().some(p => p.row >= A - 5)) { B.start(A); B.done = false; }
    return;
  }
  if (host) { think(dt); B.px = B.x; B.pz = B.z; B.prot = B.rot; }
  else {
    B.tm += dt; B.mets.forEach(m => m.t += dt);
    const k = Math.min(1, dt * 12);
    B.x += (B.px - B.x) * k; B.z += (B.pz - B.z) * k;
    let d = B.prot - B.rot; d = Math.atan2(Math.sin(d), Math.cos(d)); B.rot += d * k;
  }
  B.flash = Math.max(0, B.flash - dt);
  if (!B.group) return;
  const s = B.st, now = AH.now(), sleeping = s === 'sleep';
  if (B.barrier) { B.barrierLift = Math.min(1, B.barrierLift + (sleeping ? 0 : dt * 1.8)); B.barrier.position.y = B.barrierLift * 3.4; }
  const bob = sleeping ? Math.sin(now * 1.6) * 0.04 : Math.sin(now * 6) * 0.05;
  const heliAttack = B.kind === 'helicopter' && (s === 'hland' || s === 'hgun' || s === 'tired');
  B.group.position.set(B.x, B.kind === 'helicopter' ? (heliAttack ? 0.72 : 4.2 + Math.sin(now*2.4)*0.22) : bob, B.z);
  B.group.rotation.y = B.rot + (s === 'hgun' ? B.tm * 7.5 : 0);
  if (B.heli) { B.heli.rotor.rotation.y += dt * (heliAttack ? 34 : 24); B.heli.tailRotor.rotation.x += dt * 30; B.heli.root.rotation.z = s === 'hgun' ? Math.sin(B.tm*12)*0.42 : s === 'hland' ? 0 : Math.sin(now*2)*0.025; }

  let sc = s === 'dying' ? Math.max(0.05, 1 - B.tm / 2.2) : B.phase >= 2 ? 1.1 : 1;
  const breathe = sleeping ? 1 + Math.sin(now * 1.6) * 0.03 : s === 'roar' || s === 'rage' ? 1 + Math.sin(B.tm * 30) * 0.03 : 1;
  B.group.scale.set(sc, sc * (s === 'tired' ? 0.92 : sleeping ? 0.9 : breathe), sc);
  if (s === 'dying') { B.group.rotation.z = Math.sin(B.tm * 30) * 0.08; if (Math.random() < 0.4) AH.burst(2, B.x, 1.5, B.z, [0xffd23f, 0xffffff, 0xe5484d], 3, 4); }
  const hot = s === 'hland' || s === 'hgun' || s === 'tcharge' || s === 'tslam' || s === 'tcone' || s === 'tsum';
  const enraged = B.phase >= 2 && !sleeping;
  B.mat.emissive.setHex(B.flash > 0 ? 0xffffff : hot ? (Math.floor(now * 10) % 2 ? 0x992222 : 0x330000) : s === 'tired' ? 0x2244aa : s === 'rage' || s === 'roar' ? 0x772200 : enraged ? 0x330a00 : 0x000000);
  // sleepy Zs
  zzz.visible = sleeping;
  if (sleeping) zzz.children.forEach((m, i) => { const q = ((now * 0.5 + i / 3) % 1); m.position.set(B.x + 0.9 + q * 0.8, 3.4 + q * 1.4, B.z); m.scale.set(0.3 + q * 0.2, 0.3 + q * 0.2, 0.06); });
  // telegraphs
  circle.visible = s === 'tslam' || s === 'slam';
  if (circle.visible) { circle.position.set(B.ax, 0.06, B.az); circle.scale.set(SLAM_R, 1, SLAM_R); circle.material.opacity = s === 'slam' ? 0.7 : 0.25 + 0.15 * Math.sin(B.tm * 18); }
  lane.visible = s === 'tcharge';
  if (lane.visible) { lane.position.set(B.x, 0.06, B.z); lane.rotation.y = B.rot; lane.scale.set(3.4, 1, 16); lane.material.opacity = 0.2 + 0.15 * Math.sin(B.tm * 18); }
  cone.visible = s === 'tcone' || s === 'cone';
  if (cone.visible) { cone.position.set(B.x, 0.06, B.z); cone.rotation.y = B.rot; cone.scale.set(CONE_LEN, 1, CONE_LEN); cone.material.opacity = s === 'cone' ? 0.7 : 0.25 + 0.15 * Math.sin(B.tm * 18); }
  // phase 2 floor hazards
  poolMeshes.forEach((p, i) => {
    const q = B.phase >= 2 && B.pools[i];
    p.g.visible = !!q && s !== 'dying';
    if (q) { p.g.position.set(q[0], 0, q[1]); p.a.scale.set(q[2], 1, q[2]); p.c.scale.set(q[2] * 0.72, 1, q[2] * 0.72); p.a.material.opacity = 0.55 + 0.2 * Math.sin(now * 5 + i); }
  });
  // meteors: a growing warning circle, a rock falling into it, then a blast that is deadly for a moment
  metMeshes.forEach((m, i) => {
    const q = B.mets[i];
    m.g.visible = !!q;
    if (!q) return;
    const k = Math.min(1, q.t / MET_WARN), boom = q.t >= MET_WARN;
    m.g.position.set(q.x, 0, q.z);
    m.d.scale.set(MET_R * (boom ? 1 : 0.3 + 0.7 * k), 1, MET_R * (boom ? 1 : 0.3 + 0.7 * k));
    m.d.material.opacity = boom ? 0.75 : 0.2 + 0.25 * k;
    m.r.visible = !boom; m.r.position.y = 0.5 + (1 - k) * (1 - k) * 9;
  });
  if (!B.bulletMeshes) B.bulletMeshes = [];
  while (B.bulletMeshes.length < (B.bullets||[]).length) { const m = new T.Mesh(new T.SphereGeometry(0.16,8,6), new T.MeshBasicMaterial({color:0xffd36b})); AH.scene.add(m); B.bulletMeshes.push(m); }
  B.bulletMeshes.forEach((m,i)=>{ const q=(B.bullets||[])[i]; m.visible=!!q; if(q) m.position.set(q.x,0.48,q.z); });
  // host streams its state to the room
  if (host && AH.net) { B.sent -= dt; if (B.sent <= 0) { B.sent = 0.1; AH.net.sendBoss(B.pack()); } }
};
})();
