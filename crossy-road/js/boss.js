/* boss.js: a giant guardian (see creatures.js) watches over every 50th lane. One phone (the host) runs the brain, everyone sees it and gets hurt by it.
 * It sleeps until every living player is inside the arena (someone who died on the way is simply not waited for), wakes with a roar, and moves
 * freely in any direction. Standing in a slam / cone / meteor / pool is a one hit KO, and so is touching the boss, but only while it is actively attacking with its body
 * (the charge, and the tracking slam: it hunts you, rears back, leaps and lands with a quake). Otherwise its body is harmless and simply solid. Warnings are wind, not markers: gusts gather before an attack and an attack is aimed once, when it starts. Once the boss wakes, the entrance is sealed by an invisible lock.
 * The boss is solid and can ALWAYS be hurt by hopping into it (the hop is blocked, the player is knocked back, the boss recoils; short cooldown).
 * At half health it enrages: faster, and the arena floor itself turns deadly in places. Every attack leaves a themed ground explosion (client side only).
 * The body is built from jointed parts (see creatures.js) that bob, walk, hop and squash. */
(function () {
'use strict';
const AH = window.AH, T = AH.T, W = AH.world, COLS = AH.COLS;
const B = AH.boss = { on: false, A: 0, st: 'none', tm: 0, hp: 0, max: 10, x: 0, z: 0, rot: 0, px: 0, pz: 0, prot: 0, ax: 0, az: 0, dir: [0, -1], axT: 0, phase: 1, obs: [], mets: [], kit: { summon: true }, chaseT: 3, flash: 0, hitFlag: false, hitDir: [0, -1], hitCd: 0, group: null, body: null, mat: null, parts: [], mode: 'walk', ph: 0, mv: 0, lx: 0, lz: 0, sq: 0, kick: 0, kd: [0, 0], th: null, lhp: 0, sent: 0, name: '', locked: false };
const R_BODY = 1.7, SLAM_R = 2.7, CONE_LEN = 8, CONE_HALF = 0.5, MET_R = 1.4, MET_WARN = 1.2, JR = 2.0, JUMP_T = 0.34, JRANGE = 4.2;

/* ---- the creature: every arena gets a guardian that fits its zone (see creatures.js) ---- */

/* ---- no coloured markers: attacks are announced by wind (AH.fx.wind*), body language and a dark shadow under falling rocks ---- */
const tmat = c => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.3, depthWrite: false, side: T.DoubleSide });
const discGeo = new T.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
/* phase 2 obstacles (see makeObstacles) and falling meteors */
const obsMeshes = [], metMeshes = [];
for (let i = 0; i < 8; i++) {
  const g = new T.Group(), d = new T.Mesh(discGeo, tmat(0x000000)), r = new T.Mesh(AH.BOX, AH.M(0x6b5a5a));
  d.position.y = 0.32; r.scale.set(0.9, 0.9, 0.9); g.add(d, r); g.visible = false; AH.scene.add(g); metMeshes.push({ g: g, d: d, r: r });
}
const zzz = new T.Group();
for (let i = 0; i < 3; i++) { const m = new T.Mesh(AH.BOX, AH.M(0xffffff)); m.scale.set(0.3, 0.3, 0.06); zzz.add(m); }
zzz.visible = false; AH.scene.add(zzz);

/* ---- ground explosions: expanding themed rings, dust and sparks. Purely visual, every phone plays its own. ---- */
const ringGeo = new T.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2);
const rings = [];
function ring(x, z, r, col, life, y) {
  y = 0.3 + (y || 0.08);
  if (rings.length > 14) { const o = rings.shift(); AH.scene.remove(o.m); o.m.material.dispose(); }
  const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthWrite: false, side: T.DoubleSide }));
  m.position.set(x, y, z); m.renderOrder = 3; AH.scene.add(m);
  rings.push({ m: m, r: r, t: 0, life: life || 0.5 });
}
function boom(x, z, r, shake, big) {
  const th = B.th || AH.themeAt(B.A), a = th.arena, cols = [a.flame[0], a.flame[1] || 0xffd23f, a.pillar[1], 0xffffff];
  ring(x, z, r, cols[0], 0.45); ring(x, z, r * 0.6, cols[1], 0.32, 0.1);
  if (big) ring(x, z, r * 1.35, cols[2], 0.7, 0.07);
  AH.burst(big ? 18 : 12, x, 0.2, z, cols, 2.4 + r * 0.7, 3.5 + r * 0.3);
  if (shake) AH.cam.shake = Math.max(AH.cam.shake, shake);
}
B.boom = boom;
function tickRings(dt) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const q = rings[i]; q.t += dt; const k = q.t / q.life;
    if (k >= 1) { AH.scene.remove(q.m); q.m.material.dispose(); rings.splice(i, 1); continue; }
    const e = 1 - (1 - k) * (1 - k), s = Math.max(0.05, q.r * e);
    q.m.scale.set(s, 1, s); q.m.material.opacity = 0.85 * (1 - k);
  }
}

/* ---- shared helpers ---- */
function players() {
  const out = [], P = AH.P;
  if (!P.dead) out.push({ x: P.x, z: P.z, row: P.row });
  AH.ghosts.forEach(g => { if (!g.dead && !g.first) out.push({ x: g.tx, z: g.tz, row: Math.round(-g.tz) }); });
  return out;
}
const isHost = () => !AH.net || AH.net.isHost();
const th_cols = () => { const th = B.th || AH.themeAt(B.A); return [th.arena.pillar[0], th.arena.pillar[1], th.rock[1], th.rock[2]]; };
const fwd = rot => [-Math.sin(rot), -Math.cos(rot)];
const rotOf = d => Math.atan2(-d[0], -d[1]);

/* effects every phone plays when the boss changes state (no game logic here) */
function onEnter(st) {
  if (st === 'roar' || st === 'rage') { roarWind(st === 'rage'); AH.cam.shake = Math.max(AH.cam.shake, st === 'rage' ? 0.7 : 0.6); AH.beep(st === 'rage' ? 60 : 70, st === 'rage' ? 1.6 : 1.4, 'sawtooth', 0.1, -20); }
  else if (st === 'jlean') { AH.fx.windSuck(B.x, B.z, 10, 3.2, 5); AH.beep(110, 0.3, 'sine', 0.04, 160); }
  else if (st === 'jump') { AH.beep(180, 0.2, 'square', 0.05, 240); AH.fx.windBurst(B.x, B.z, 6, 0.8, 5); }
  else if (st === 'quake') { boom(B.ax, B.az, JR * 1.15, 0.22, true); B.quakeT = 0.9; AH.fx.windBurst(B.ax, B.az, 16, 0.8, 8, 0.2); AH.beep(70, 0.45, 'square', 0.09, -50); }
  else if (st === 'tslam') AH.fx.windSuck(B.ax, B.az, 12, SLAM_R + 0.6, 5);
  else if (st === 'slam') { boom(B.ax, B.az, SLAM_R * 1.25, 0.4, true); AH.beep(90, 0.25, 'square', 0.07, -40); }
  else if (st === 'cone') { const f = fwd(B.rot); for (let i = 1; i <= 4; i++) boom(B.x + f[0] * i * 1.9, B.z + f[1] * i * 1.9, 0.9 + i * 0.3, i === 1 ? 0.3 : 0); AH.beep(120, 0.3, 'sawtooth', 0.06, 200); }
  else if (st === 'tcharge') { const f = fwd(B.rot); AH.fx.windLine(B.x, B.z, f[0], f[1], 14, 12, 12, 1.4); }
  else if (st === 'tcone') { const f = fwd(B.rot); AH.fx.windSuck(B.x + f[0] * 1.5, B.z + f[1] * 1.5, 8, 2.4, 4); }
  else if (st === 'charge') { boom(B.x, B.z, 2.2, 0.15); }
  else if (st === 'recover') { B.kick = 0.45; boom(B.x, B.z, 2.4, 0.5, true); AH.beep(80, 0.3, 'square', 0.08, -50); }
  else if (st === 'sum') { boom(B.x, B.z, 2.6, 0.25); }
  else if (st === 'dying') { boom(B.x, B.z, 3.2, 0.6, true); }
}
/* a roar is a blast of wind: streaks race outwards in rings, the arena shakes */
function roarWind(big) {
  for (let i = 0; i < (big ? 4 : 3); i++) setTimeout(function () { if (B.on && B.group) AH.fx.windBurst(B.x, B.z, big ? 20 : 15, 1.4 + i * 0.6, 9 + i * 2, 1.0); }, i * 260);
}
function setSt(st) {
  B.st = st; B.tm = 0; B.locked = false; onEnter(st);
  if (!B.obs.length) return;
  if (st === 'slam') smash((x, z) => Math.hypot(x - B.ax, z - B.az) < SLAM_R + 0.6);
  else if (st === 'quake') smash((x, z) => Math.hypot(x - B.ax, z - B.az) < JR + 0.3);
  else if (st === 'cone') { const f = fwd(B.rot); smash((x, z) => { const dx = x - B.x, dz = z - B.z, l = Math.hypot(dx, dz); return l < CONE_LEN && l > 0.01 && (dx * f[0] + dz * f[1]) / l > Math.cos(CONE_HALF + 0.12); }); }
  else if (st === 'recover' && B.phase >= 2) {                                          // the arena keeps crumbling: fresh debris falls once it is thinned out
    if (B.obs.filter(alive).length < 12 && B.obs.length < 70) B.obs = B.obs.concat(makeObstacles(8));
  }
}

B.start = function (A) {
  if (B.on) return;
  B.on = true; B.A = A; B.st = 'sleep'; B.tm = 0; B.hp = B.max; B.phase = 1; B.obs = []; B.mets = []; B.x = B.px = 0; B.z = B.pz = -(A + 12);
  B.rot = B.prot = 0; B.dir = [0, -1]; B.axT = 0; B.chaseT = 3; B.flash = 0;
  const seed = (AH.roomSeed || 'solo') + ':boss:' + A, kr = AH.seeded(seed + ':kit');
  const th0 = AH.themeAt(A), cr = AH.creatures.make(th0, seed);
  B.name = cr.name; B.locked = false; B.mode = cr.mode; B.th = th0;
  B.kit = { summon: kr() < 0.7 && cr.mode === 'float' };        // only the hovering casters throw boulders; the melee guardians fight with their bodies
  B.hitCd = 0; B.sq = 0; B.kick = 0; B.mv = 0; B.ph = 0; B.lx = B.x; B.lz = B.z; B.lhp = B.hp;
  B.mat = new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x000000 });
  B.group = new T.Group(); B.body = new T.Group(); B.group.add(B.body); B.parts = [];
  cr.parts.forEach(p => {
    const mesh = new T.Mesh(p.geo, B.mat); mesh.castShadow = true;
    if (p.role === 'torso') { B.body.add(mesh); B.parts.push({ role: p.role, g: mesh }); return; }
    const pg = new T.Group(); pg.position.set(p.pivot[0], p.pivot[1], p.pivot[2]); pg.add(mesh); B.body.add(pg); B.parts.push({ role: p.role, g: pg });
  });
  B.group.position.set(B.x, 0, B.z); AH.scene.add(B.group);
  const th = th0;
  AH.emit('boss-start', A);
};
B.clear = function () {
  if (B.group) AH.scene.remove(B.group);
  rings.forEach(q => { AH.scene.remove(q.m); q.m.material.dispose(); }); rings.length = 0;
  B.group = null; B.body = null; B.parts = [];
  obsMeshes.forEach(o => AH.scene.remove(o.g)); obsMeshes.length = 0; B.on = false; B.st = 'none'; B.phase = 1; B.obs = []; B.mets = [];
  zzz.visible = false;
  metMeshes.forEach(m => m.g.visible = false);
};

/* a hop into the boss: always counts (it has a short cooldown so a held button cannot melt it). dx,dz = the way the player was hopping. */
B.hurt = function (n, dx, dz) {
  if (!B.on || B.st === 'dying' || B.st === 'sleep' || B.st === 'roar' || B.st === 'rage') return;
  if (!isHost()) { AH.net.event('bdmg', { n: n, dx: dx || 0, dz: dz || 0 }); return; }
  if (B.hitCd > 0) return;
  B.hitCd = 0.7; B.hp -= n; B.flash = 0.25; AH.beep(200, 0.15, 'square', 0.06, -100);
  const l = Math.hypot(dx || 0, dz || 0);
  if (l > 0) { B.x += dx / l * 0.7; B.z += dz / l * 0.7; clampPos(); }       // recoil: the boss gets shoved back a little
  if (B.hp <= 0) setSt('dying');
  B.sent = 0;
};

B.lethalAt = function (x, z) {
  if (!B.on || B.st === 'dying' || B.st === 'sleep') return false;
  for (const m of B.mets) if (m.t >= MET_WARN && m.t < MET_WARN + 0.35 && Math.hypot(x - m.x, z - m.z) < MET_R) return true;
  const d = Math.hypot(x - B.x, z - B.z);
  if (B.st === 'charge' && d < R_BODY + 0.6) return true;      // the charge is the one time the body itself hurts
  if (B.st === 'quake' && B.tm < 0.28) return Math.hypot(x - B.ax, z - B.az) < JR;           // the landing: a circle of damage around the impact, and only at the instant of impact
  if (B.st === 'slam') return Math.hypot(x - B.ax, z - B.az) < SLAM_R;
  if (B.st === 'cone') {
    const f = fwd(B.rot), dx = x - B.x, dz = z - B.z, l = Math.hypot(dx, dz);
    return l < CONE_LEN && l > 0.01 && (dx * f[0] + dz * f[1]) / l > Math.cos(CONE_HALF);
  }
  return false;
};
/* the boss is solid; a hop aimed at it is blocked and counts as a hit (the player code then knocks the player back) */
B.R = R_BODY + 0.6;
const OBS_PLAYER = 0.9, OBS_BOSS = 2.1;
const alive = o => o[4] !== 0;                       // an obstacle is [x, z, variant, kind, alive]; the boss can smash them (alive = 0)
const obsAt = (x, z) => B.obs.some(o => alive(o) && Math.hypot(x - o[0], z - o[1]) < OBS_PLAYER);
const obsHit = (x, z) => B.obs.some(o => alive(o) && Math.hypot(x - o[0], z - o[1]) < OBS_BOSS);
/* the boss destroys its own obstacles: its charge and rush plough through them, a slam, a cone blast or a meteor shatters whatever is in the area */
function smash(pred) { let n = 0; B.obs.forEach(o => { if (alive(o) && pred(o[0], o[1])) { o[4] = 0; n++; } }); if (n) B.sent = 0; return n; }
B.blocks = function (x, z) { return B.on && B.st !== 'dying' && (Math.hypot(x - B.x, z - B.z) < B.R || obsAt(x, z)); };
B.hopCheck = function (x, z, p) {
  if (p && p.nohit) return false;                 // being shoved out of the boss must not be blocked by it
  if (B.on && obsAt(x, z)) return true;           // an obstacle blocks the hop, but is not the boss
  if (!B.blocks(x, z)) return false;
  B.hitFlag = true;
  return true;
};

/* ---- host brain ---- */
function nearest(from) {
  const ps = players(); let best = null, bd = 1e9;
  ps.forEach(p => { const d = Math.hypot(p.x - from.x, p.z - from.z); if (d < bd) { bd = d; best = p; } });
  return best;
}
/* The boss moves freely: straight at its target, in whatever direction that is. */
function pickDir(tg) {
  const dx = tg.x - B.x, dz = tg.z - B.z, l = Math.hypot(dx, dz);
  return l < 0.01 ? B.dir : [dx / l, dz / l];
}
/* blocked by an obstacle: slide round it */
function sidestep(tg) { const d = B.dir, s = (tg && ((tg.x - B.x) * -d[1] + (tg.z - B.z) * d[0]) < 0) ? -1 : 1; return [-d[1] * s, d[0] * s]; }
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
/* enrage: the arena shakes and chunks of the environment crash down. They block the players AND the boss, so both have to path around them. */
function makeObstacles(count) {
  const out = [], ps = players();
  for (let tries = 0; tries < 500 && out.length < count; tries++) {
    const x = Math.round(rg(-COLS + 1, COLS - 1)), z = -(B.A + Math.round(rg(2, 12)));
    // never two obstacles side by side (diagonals only), so a line of them can never seal the arena
    if (B.obs.concat(out).some(p => alive(p) && Math.max(Math.abs(p[0] - x), Math.abs(p[1] - z)) < 2)) continue;
    if (Math.hypot(x - B.x, z - B.z) < 3.2 || ps.some(p => Math.hypot(p.x - x, p.z - z) < 2)) continue;
    out.push([x, z, Math.random() < 0.5 ? 0 : 1, Math.random() < 0.45 ? 'rock' : 'low', 1]);
  }
  return out;
}
/* move along B.dir; an obstacle in the way stops the boss (returns false) */
function stepMove(dt, sp, plough) {
  const nx = B.x + B.dir[0] * sp * dt, nz = B.z + B.dir[1] * sp * dt;
  if (plough) smash((x, z) => Math.hypot(x - nx, z - nz) < OBS_BOSS + 0.4);
  else if (obsHit(nx, nz) && !obsHit(B.x, B.z)) return false;
  B.x = nx; B.z = nz; clampPos(); return true;
}
function think(dt) {
  B.tm += dt;
  B.mets.forEach(m => { if (m.t < MET_WARN && m.t + dt >= MET_WARN) smash((x, z) => Math.hypot(x - m.x, z - m.z) < MET_R + 0.7); m.t += dt; }); B.mets = B.mets.filter(m => m.t < MET_WARN + 0.5);
  const tg = nearest(B), p2 = B.phase >= 2, spd = p2 ? 3.7 : 3.0, chaseT = () => p2 ? 1.1 + Math.random() * 1.0 : 1.6 + Math.random() * 1.2;
  const next = function () {
    const r = Math.random();
    if (B.kit.summon && r < (p2 ? 0.35 : 0.22)) setSt('tsum');
    else setSt(r < 0.2 ? 'tcharge' : r < 0.34 ? 'tslam' : r < 0.5 ? 'tcone' : 'jtrack');
  };
  // enrage at half health
  if (!p2 && B.hp <= B.max / 2 && (B.st === 'chase' || B.st === 'recover')) { setSt('rage'); return; }
  switch (B.st) {
    case 'sleep': {
      const ps = players();
      if (ps.length && ps.every(p => p.row >= B.A + 1)) setSt('roar');
      break; }
    case 'roar': if (B.tm > 2.0) { setSt('chase'); B.chaseT = 2.2; } break;
    case 'rage':
      if (B.tm > 0.9 && B.phase < 2) { B.phase = 2; B.obs = makeObstacles(22); AH.cam.shake = 0.9; }
      if (B.tm > 2.4) { setSt('chase'); B.chaseT = 1.6; }
      break;
    case 'chase':
      if (tg) {
        B.axT -= dt; if (B.axT <= 0) { B.dir = pickDir(tg); B.axT = 0.12; }
        face(dt, 7);
        if (!stepMove(dt, spd)) { B.dir = sidestep(tg); B.axT = 0.5; }
      }
      if (B.tm > B.chaseT) next();
      break;
    case 'tcharge':
      if (!B.locked) { B.locked = true; if (tg) B.dir = pickDir(tg); snapFace(); }     // aimed once; the red lane never moves afterwards
      if (B.tm > 0.85) setSt('charge');
      break;
    case 'charge': {
      const ox = B.x, oz = B.z, sp = p2 ? 16 : 14;
      const moved = stepMove(dt, sp, true);
      if (!moved || B.tm > 1.5 || Math.hypot(B.x - ox, B.z - oz) < sp * dt * 0.3) setSt('recover');
      break; }
    case 'jtrack':                                                                         // the tracking slam: hunt the target, stop once in range...
      if (tg) {
        B.dir = pickDir(tg); face(dt, 10);
        const d = Math.hypot(tg.x - B.x, tg.z - B.z);
        if (d > JRANGE) { if (!stepMove(dt, p2 ? 5.6 : 4.8)) { B.dir = sidestep(tg); } } else setSt('jlean');
      }
      if (B.tm > 2.6 && B.st === 'jtrack') setSt('jlean');
      break;
    case 'jlean':                                                                          // ...rear back for a moment (it still turns to follow)...
      if (tg) { B.dir = pickDir(tg); face(dt, 14); }
      if (B.tm > 0.42) {
        let lx = B.x, lz = B.z;                                                             // ...then leap. The landing point is fixed now, just short of the target.
        if (tg) { const d = Math.hypot(tg.x - B.x, tg.z - B.z) || 1, k = Math.max(0, d - 1.5) / d; lx = B.x + (tg.x - B.x) * k; lz = B.z + (tg.z - B.z) * k; }
        B.ax = AH.clamp(lx, -COLS + 0.5, COLS - 0.5); B.az = AH.clamp(lz, -(B.A + 13), -(B.A + 1)); B.jx = B.x; B.jz = B.z;
        setSt('jump');
      }
      break;
    case 'jump': {                                                                         // a fast jump through the air
      const k = Math.min(1, B.tm / JUMP_T), e = k * k * (3 - 2 * k);
      B.x = B.jx + (B.ax - B.jx) * e; B.z = B.jz + (B.az - B.jz) * e;
      if (k >= 1) { B.x = B.ax; B.z = B.az; setSt('quake'); }
      break; }
    case 'quake': if (B.tm > 0.9) { setSt('chase'); B.chaseT = chaseT(); } break;
    case 'tslam':
      if (!B.locked) { B.locked = true; B.ax = Math.round(tg ? tg.x : B.x); B.az = Math.round(tg ? tg.z : B.z); }   // the circle lands where it first appeared
      if (B.tm > 0.9) setSt('slam');
      break;
    case 'slam': if (B.tm > 0.3) { setSt('chase'); B.chaseT = chaseT(); } break;
    case 'tcone':
      if (!B.locked) { B.locked = true; if (tg) B.dir = pickDir(tg); snapFace(); }
      if (B.tm > 0.9) setSt('cone');
      break;
    case 'cone': if (B.tm > 0.35) { setSt('chase'); B.chaseT = chaseT(); } break;
    case 'tsum': if (B.tm > 0.75) { spawnMeteors(p2 ? 5 : 3); setSt('sum'); } break;
    case 'sum': if (B.tm > 0.6) { setSt('chase'); B.chaseT = chaseT(); } break;
    case 'recover': if (B.tm > 1.1) { setSt('chase'); B.chaseT = 2.2; } break;
    case 'dying':
      if (B.tm > 2.2 && !B.done) { B.done = true; AH.net ? AH.net.event('beat', { a: B.A }, true) : AH.onBeat(B.A); }
      break;
  }
}

/* ---- network state ---- */
const r2 = v => +v.toFixed(2);
B.pack = function () {
  return [B.A, B.st, r2(B.x), r2(B.z), r2(B.rot), B.hp, r2(B.ax), r2(B.az), r2(B.tm), B.phase, B.obs, B.mets.map(m => [r2(m.x), r2(m.z), r2(m.t)])];
};
B.apply = function (s) {
  if (!B.on) { if (s[1] === 'none') return; B.start(s[0]); }
  B.px = s[2]; B.pz = s[3]; B.prot = s[4]; B.ax = s[6]; B.az = s[7]; B.phase = s[9] || 1;
  if (B.st !== s[1]) {
    B.tm = s[8]; B.st = s[1];
    if (s[1] === 'tcharge' || s[1] === 'tcone' || s[1] === 'cone' || s[1] === 'charge') B.rot = s[4];   // warnings appear already aimed, never swinging around
    if (s[1] === 'recover' || s[1] === 'cone' || s[1] === 'sum' || s[1] === 'dying' || s[1] === 'quake') { B.x = s[2]; B.z = s[3]; }
    if (s[1] === 'jump') { B.jx = B.x; B.jz = B.z; }
    onEnter(s[1]);
  }
  if (s[5] < B.hp && B.body) { B.flash = 0.25; B.kick = 0.35; B.sq = 0.3; AH.burst(8, B.px, 1.6, B.pz, [0xffffff, 0xffd23f], 3, 4); AH.beep(200, 0.15, 'square', 0.06, -100); }
  B.hp = s[5];
  B.obs = s[10] || []; const om = B.mets; B.mets = (s[11] || []).map(a => { const o = om.find(m => m.x === a[0] && m.z === a[1]); return { x: a[0], z: a[1], t: a[2], b: o ? o.b : (a[2] >= MET_WARN ? 1 : 0) }; });
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
  // the entrance gate drops shut once the boss is awake (and nobody is still standing in the doorway), and opens again only when it is beaten
  W.entrance(B.A, B.st !== 'sleep' && B.st !== 'none' && !W.arena(B.A).beaten && !players().some(p => p.row <= B.A));
  B.flash = Math.max(0, B.flash - dt); B.hitCd = Math.max(0, B.hitCd - dt); B.kick = Math.max(0, B.kick - dt); B.sq = Math.max(0, B.sq - dt);
  tickRings(dt);
  if (!B.group) return;
  const s = B.st, now = AH.now(), sleeping = s === 'sleep';
  // speed from real movement, so a client animates the same walk the host is doing
  const sp = Math.hypot(B.x - B.lx, B.z - B.lz) / Math.max(dt, 1e-3); B.lx = B.x; B.lz = B.z;
  B.mv += (Math.min(sp, 18) - B.mv) * Math.min(1, dt * 10);
  const run = s === 'charge' ? 1.6 : 1, wlk = Math.min(1, B.mv / 2.5);
  const prevPh = B.ph; B.ph += dt * (3.2 + B.mv * 1.5) * run;
  const sw = Math.sin(B.ph * 2) * wlk;                                   // leg swing, 0 when standing
  const land = Math.max(0, -Math.sin(B.ph * 2 + 0.2) * (Math.sin(prevPh * 2 + 0.2) > 0 ? 1 : 0)) * wlk;
  let by = 0, lean = 0, sqy = 1, roll = 0, armUp = 0, tailW = Math.sin(now * 3) * 0.15, bz = 0;
  if (B.mode === 'hop') { const h = Math.abs(Math.sin(B.ph * 1.6)); by = h * (0.25 + 0.55 * wlk); sqy = 1 + (h - 0.5) * 0.22 * wlk - 0.06 * (1 - h) * wlk; }
  else if (B.mode === 'float') { by = 0.35 + Math.sin(now * 2.4) * 0.18; lean = -0.12 * wlk; }
  else if (B.mode === 'roll') { by = Math.abs(Math.sin(B.ph * 2)) * 0.12 * wlk; roll = wlk * 0.06; }
  else { by = Math.abs(sw) * 0.12; sqy = 1 - Math.abs(Math.cos(B.ph * 2)) * 0.04 * wlk; lean = -0.06 * wlk; }
  const idle = Math.sin(now * (sleeping ? 1.6 : 2.4));
  sqy += idle * (sleeping ? 0.03 : 0.015) * (1 - wlk * 0.7);
  if (sleeping) { sqy *= 0.9; lean = -0.12; }
  const w = B.tm;
  // attack animations: wind up on the telegraph, release on the hit
  if (s === 'tslam') { const k = Math.min(1, w / 0.85); by += k * 0.9; lean = 0.35 * k; armUp = 2.2 * k; sqy += 0.08 * k; }
  else if (s === 'slam') { const k = Math.max(0, 1 - w / 0.3); by -= 0.15 * (1 - k); lean = -0.45 * (1 - k * 0.3); sqy = 0.78 + 0.2 * k; armUp = -0.6; }
  else if (s === 'tcone') { const k = Math.min(1, w / 0.85); lean = 0.28 * k; armUp = 1.6 * k; sqy += 0.06 * k; bz = Math.sin(w * 40) * 0.04 * k; }
  else if (s === 'cone') { lean = -0.4; armUp = -0.4; sqy = 0.94; }
  else if (s === 'tcharge') { const k = Math.min(1, w / 0.8); lean = -0.18 * k; sqy = 1 - 0.18 * k; bz = Math.sin(w * 55) * 0.07 * k; by -= 0.08 * k; }
  else if (s === 'charge') { lean = -0.38; sqy = 1.04; armUp = -0.7; by += Math.abs(Math.sin(now * 28)) * 0.12; }
  else if (s === 'jtrack') { lean = -0.2; by += Math.abs(Math.sin(now * 12)) * 0.08; }
  else if (s === 'jlean') { const k = Math.min(1, w / 0.38); lean = 0.55 * k; armUp = 1.6 * k; sqy = 1 - 0.14 * k; by -= 0.12 * k; }
  else if (s === 'jump') { const k = Math.min(1, w / JUMP_T); by += 3.0 * Math.sin(Math.PI * k); lean = 0.35 - 0.9 * k; armUp = 1.2 * (1 - k); sqy = 1.1 - 0.1 * k; }
  else if (s === 'quake') { const k = Math.max(0, 1 - w / 0.45); lean = -0.4 * k; sqy = 0.72 + 0.28 * (1 - k); armUp = -0.6 * k; by -= 0.1 * k; }
  else if (s === 'tsum') { const k = Math.min(1, w / 0.7); armUp = 2.4 * k; by += 0.5 * k; lean = 0.2 * k; }
  else if (s === 'sum') { armUp = 2.0; lean = -0.1; sqy = 0.94; }
  else if (s === 'roar' || s === 'rage') { const k = Math.min(1, w / 0.4); lean = 0.32 * k; armUp = 2.0 * k; sqy += Math.sin(w * 30) * 0.04; by += 0.2 * k; }
  else if (s === 'recover') { lean = -0.2 + Math.sin(w * 14) * 0.03; sqy = 0.9 + Math.sin(w * 12) * 0.03; armUp = -0.3; }
  if (B.kick > 0) { const k = B.kick / 0.45; lean += 0.5 * Math.min(1, k); sqy -= 0.15 * Math.min(1, k); bz += Math.sin(B.kick * 60) * 0.05; }
  if (B.sq > 0) sqy -= 0.15 * (B.sq / 0.3);
  sqy = Math.max(0.6, sqy) - land * 0.07;
  const sxz = 1 / Math.sqrt(Math.max(0.5, sqy));
  B.group.position.set(B.x + bz, 0, B.z);
  B.group.rotation.y = B.rot;
  let sc = s === 'dying' ? Math.max(0.05, 1 - B.tm / 2.2) : B.phase >= 2 ? 1.1 : 1;
  B.group.scale.set(sc, sc, sc);
  B.body.position.y = by; B.body.rotation.x = lean; B.body.rotation.z = roll * Math.sin(B.ph * 2); B.body.scale.set(sxz, sqy, sxz);
  B.parts.forEach(p => {
    const r = p.role;
    if (r === 'legA') p.g.rotation.x = sw * 0.75 - (s === 'charge' ? 0.3 : 0);
    else if (r === 'legB') p.g.rotation.x = -sw * 0.75 + (s === 'charge' ? 0.3 : 0);
    else if (r === 'armL') p.g.rotation.x = -sw * 0.55 + armUp * 0.8 + (B.mode === 'float' ? Math.sin(now * 3) * 0.2 : 0);
    else if (r === 'armR') p.g.rotation.x = sw * 0.55 + armUp * 0.8 + (B.mode === 'float' ? Math.sin(now * 3 + 1.5) * 0.2 : 0);
    else if (r === 'tail') { p.g.rotation.y = tailW * (1 + wlk); p.g.rotation.x = -0.15 * lean + 0.1 * Math.sin(B.ph * 2) * wlk; }
  });
  if (s === 'dying') { B.group.rotation.z = Math.sin(B.tm * 30) * 0.08; if (Math.random() < 0.4) AH.burst(2, B.x, 1.5, B.z, [0xffd23f, 0xffffff, 0xe5484d], 3, 4); if (Math.random() < 0.12) boom(B.x + rg(-2, 2), B.z + rg(-2, 2), 1.4, 0.1); }
  // footfall dust while walking, and a rumble when the charge or the rush runs
  if (wlk > 0.5 && land > 0.5 && Math.random() < 0.6) { AH.burst(2, B.x + rg(-1, 1), 0.05, B.z + rg(-1, 1), [0xd9d2c0, 0xb7a98a], 1.2, 1.2); }
  if (s === 'charge' && Math.random() < 0.5) { ring(B.x, B.z, 1.4, (B.th || AH.themeAt(B.A)).arena.flame[0], 0.3, 0.09); AH.burst(2, B.x, 0.1, B.z, [0xd9d2c0, 0xffffff], 2, 2); }
  B.mat.emissive.setHex(B.flash > 0 ? 0xffffff : 0x000000);                // the only tint is the white flash when it is hit; stage two does not recolour it
  // sleepy Zs
  zzz.visible = sleeping;
  if (sleeping) zzz.children.forEach((m, i) => { const q = ((now * 0.5 + i / 3) % 1); m.position.set(B.x + 0.9 + q * 0.8, 3.4 + q * 1.4, B.z); m.scale.set(0.3 + q * 0.2, 0.3 + q * 0.2, 0.06); });
  // wind cues: a steady trickle of gusts while an attack is being prepared, and a rumble after a landing
  {
    const f = fwd(B.rot);
    if (s === 'tcharge' && Math.random() < dt * 24) AH.fx.windLine(B.x, B.z, f[0], f[1], 1, 12, 12, 1.4);
    else if (s === 'tcone' && Math.random() < dt * 14) AH.fx.windSuck(B.x + f[0] * 1.5, B.z + f[1] * 1.5, 1, 2.6, 4);
    else if (s === 'tslam' && Math.random() < dt * 14) AH.fx.windSuck(B.ax, B.az, 1, SLAM_R + 0.8, 5);
    else if (s === 'tsum' && Math.random() < dt * 14) AH.fx.windSuck(B.x, B.z, 1, 2.6, 4);
    else if (s === 'jlean' && Math.random() < dt * 22) AH.fx.windSuck(B.x, B.z, 1, 3.0, 5);
    else if (s === 'cone' && Math.random() < dt * 30) AH.fx.windLine(B.x, B.z, f[0], f[1], 1, CONE_LEN, 14, 1.8);
  }
  if (B.quakeT > 0) { B.quakeT -= dt; AH.cam.shake = Math.max(AH.cam.shake, 0.1 * Math.max(0, B.quakeT) / 0.9); }
  // phase 2 obstacles: they drop in from above with a thump, then stay until the boss smashes them
  while (obsMeshes.length < B.obs.length) {
    const o = B.obs[obsMeshes.length], th = B.th || AH.themeAt(B.A), m = new T.Mesh(W.propGeo(th, o[3] || 'rock', o[2]), AH.VM), g = new T.Group();
    m.castShadow = true; g.add(m); g.position.set(o[0], 9 + Math.random() * 4, o[1]); const sc = 1.45 + (o[0] * 7 + o[1] * 3 & 3) * 0.12; g.scale.set(sc, sc * (1 + ((o[0] + o[1]) & 1) * 0.35), sc); g.rotation.y = (o[0] * 3 + o[1]) & 3;
    g.visible = false; AH.scene.add(g); obsMeshes.push({ g: g, vy: 0, down: false, up: true, wait: Math.random() * 0.8 });
  }
  obsMeshes.forEach((q, i) => {
    const o = B.obs[i], dead = !o || !alive(o);
    if (dead) { if (q.up) { q.up = false; q.g.visible = false; if (o && q.down) { const c = th_cols(); AH.burst(14, o[0], 0.8, o[1], c, 4.5, 5); boom(o[0], o[1], 2.0, 0.3); AH.beep(110, 0.3, 'sawtooth', 0.07, -60); } } return; }
    q.g.visible = s !== 'dying' && q.wait <= 0;
    if (q.wait > 0) { q.wait -= dt; return; }
    if (q.down) return;
    q.vy += 38 * dt; q.g.position.y -= q.vy * dt;
    if (q.g.position.y <= 0) { q.g.position.y = 0; q.down = true; boom(o[0], o[1], 2.2, 0.35); AH.beep(70, 0.25, 'square', 0.07, -40); }
  });
  if (!B.obs.length && obsMeshes.length) { obsMeshes.forEach(o => AH.scene.remove(o.g)); obsMeshes.length = 0; }
  // meteors: a growing warning circle, a rock falling into it, then a blast that is deadly for a moment
  metMeshes.forEach((m, i) => {
    const q = B.mets[i];
    m.g.visible = !!q;
    if (!q) return;
    const k = Math.min(1, q.t / MET_WARN), isBoom = q.t >= MET_WARN;
    if (isBoom && !q.b) { q.b = 1; boom(q.x, q.z, MET_R * 1.8, 0.15); }
    m.g.position.set(q.x, 0, q.z);
    m.d.scale.set(MET_R * (isBoom ? 1 : 0.3 + 0.7 * k), 1, MET_R * (isBoom ? 1 : 0.3 + 0.7 * k));
    m.d.material.opacity = isBoom ? 0.0 : 0.1 + 0.18 * k;
    m.r.visible = !isBoom; m.r.position.y = 0.5 + (1 - k) * (1 - k) * 9;
  });
  // host streams its state to the room
  if (host && AH.net) { B.sent -= dt; if (B.sent <= 0) { B.sent = 0.1; AH.net.sendBoss(B.pack()); } }
};
})();
