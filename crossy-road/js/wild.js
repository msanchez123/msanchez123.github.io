/* wild.js: living creatures on the ground (wildlands) and the animals of the water.
 * Ground creatures are scattered around, idle and wander. When one faces you from close by it notices you ("!" pops up), walks up, then rears back and jumps at the
 * spot you stand on: the landing is a small circle of damage (aimed once, at the start of the jump). Hop into a creature at any time before it jumps and you defeat it.
 * If its slam misses it is stunned for a few seconds (harmless, and still defeated by a bump). Walking into one does nothing at all: only the slam hurts.
 * Beaches and lakes also have fish and dolphins that leap out of the water for decoration.
 * All of it is simulated locally on each phone (nothing is sent over the network): it only ever threatens the local player. */
(function () {
'use strict';
const AH = window.AH, T = AH.T, W = AH.world, COLS = AH.COLS, Wd = AH.wild = {};
const list = [];
const rg = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;
const adiff = (a, b) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return d; };
const markGeo = new AH.Builder().box(0.34, 0.62, 0.08, 0xffffff, 0, 0, -0.03).box(0.15, 0.36, 0.1, 0xffc24a, 0, 0.09, 0).box(0.15, 0.15, 0.1, 0xffc24a, 0, -0.2, 0).build();
const starGeo = new AH.Builder().box(0.16, 0.16, 0.16, 0xffe45a, 0, 0, 0).build();
const DUST = [0xd9d2c0, 0xb7a98a, 0xffffff];
Wd.hit = null;

/* ---- ground creatures ---- */
Wd.populate = function (row, th) {
  const bs = AH.BEASTS && AH.BEASTS[th.id]; if (!bs) return;
  const chance = Math.max(0.2, 0.56 - row.r / 1400);                       // a little thinner the further you go (more of the course is obstacles instead)
  const n = Math.random() < chance ? (Math.random() < 0.25 ? 2 : 1) : 0;
  for (let i = 0; i < n; i++) {
    const big = Math.random() < 0.3, style = big ? bs.big : bs.small;
    let x = 0, ok = false;
    for (let t = 0; t < 8; t++) { x = Math.round(rg(-COLS, COLS)); if (!row.blockers.has(x)) { ok = true; break; } }
    if (!ok) continue;
    const g = new T.Group(), body = new T.Group(), m = new T.Mesh(W.beastGeo(style), AH.VM), mark = new T.Mesh(markGeo, AH.VM), stars = new T.Group();
    m.castShadow = true; body.add(m); g.add(body); mark.visible = false; g.add(mark);
    for (let k = 0; k < 3; k++) stars.add(new T.Mesh(starGeo, AH.VM)); stars.visible = false; g.add(stars);
    const px = x + rg(-0.3, 0.3), pz = -row.r + rg(-0.3, 0.3);
    g.position.set(px, W.groundY(px, pz), pz); AH.scene.add(g);
    const hd = rg(0, TAU);
    list.push({ kind: 'beast', g: g, body: body, mark: mark, stars: stars, big: big, row: row.r, hx: px, hz: pz, x: px, z: pz, hd: hd, vh: hd, st: 'idle', t: rg(0, 2), walking: false, ph: rg(0, 6), cd: rg(0, 2), tc: 0, lx: px, lz: pz, ax: 0, az: 0, dieT: 0 });
  }
};
/* fish and dolphins in the sea (beach) and the lakes: purely for looks */
const fishGeo = (function () { const b = new AH.Builder(); b.box(0.5, 0.22, 0.2, 0xff9a3a, 0, 0, 0).box(0.18, 0.28, 0.06, 0xff7a1a, -0.32, 0, 0).box(0.1, 0.1, 0.22, 0xffffff, 0.15, 0.02, 0); return b.build(); })();
const dolphinGeo = (function () { const b = new AH.Builder(), c = 0x7a96ac, l = 0xdfe9f0; b.box(1.5, 0.45, 0.5, c, 0, 0, 0).box(0.6, 0.2, 0.34, c, 0.95, -0.05, 0).box(1.1, 0.14, 0.36, l, 0, -0.18, 0).box(0.3, 0.3, 0.06, c, -0.2, 0.36, 0).box(0.5, 0.2, 0.7, c, -1.0, 0.05, 0).box(0.1, 0.1, 0.06, 0x111111, 0.7, 0.08, 0.26).box(0.1, 0.1, 0.06, 0x111111, 0.7, 0.08, -0.26); return b.build(); })();
Wd.aqua = function (row, th) {
  if (Math.random() > 0.16) return;
  let x, y, dolphin = false;
  if (th.sea && (row.kind === 'shore' || row.kind === 'shore2')) { x = (row.kind === 'shore' ? -1 : 1) * (AH.BGX + rg(1.5, 9)); y = -1.55; dolphin = Math.random() < 0.4; }
  else return;
  const m = new T.Mesh(dolphin ? dolphinGeo : fishGeo, AH.VM), g = new T.Group(); g.add(m); g.visible = false; AH.scene.add(g);
  list.push({ kind: 'aqua', g: g, row: row.r, x: x, z: -row.r + rg(-0.3, 0.3), y0: y, amp: dolphin ? rg(1.0, 1.5) : rg(0.5, 0.9), per: dolphin ? rg(5, 8) : rg(2.5, 4.5), off: rg(0, 8), dur: dolphin ? 1.3 : 0.9, dir: Math.random() < 0.5 ? -1 : 1, wet: false, big: dolphin });
};
Wd.drop = function (r) {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].row === r) { AH.scene.remove(list[i].g); list.splice(i, 1); }
};
Wd.clear = function () { list.forEach(c => AH.scene.remove(c.g)); list.length = 0; };
/* is a creature that could hurt you near this spot? (the robot autopilot asks) */
Wd.dangerAt = function (x, z) {
  for (const c of list) {
    if (c.kind !== 'beast' || !c.g.visible) continue;
    const r = c.st === 'charge' || c.st === 'leap' || c.st === 'slam' ? (c.big ? 2.9 : 2.3) : c.st === 'stun' || c.st === 'dying' ? 0.6 : c.st === 'idle' ? 1.1 : 1.6;
    if (Math.hypot(x - c.x, z - c.z) < r) return true;
  }
  return false;
};
/* a hop towards (x, z): a creature standing there is bumped (defeated) unless it is in the air. The player code reads Wd.hit. */
Wd.hopCheck = function (x, z) {
  for (const c of list) {
    if (c.kind !== 'beast' || !c.g.visible || c.st === 'leap' || c.st === 'slam' || c.st === 'dying') continue;
    if (Math.hypot(x - c.x, z - c.z) < (c.big ? 1.05 : 0.85)) { Wd.hit = c; return true; }
  }
  return false;
};
Wd.defeat = function (c) {
  if (!c || c.st === 'dying') return;
  c.st = 'dying'; c.dieT = 0; c.mark.visible = false; c.stars.visible = false;
  AH.burst(12, c.x, 0.6, c.z, [0xffffff, 0xffd23f, 0xd9d2c0], 3, 4); AH.beep(340, 0.12, 'square', 0.05, 200);
};
/* move along heading hd; blocked by trees, rocks and any ground that is not open grass. Returns true if it moved. */
const free = (x, z) => { const r = W.get(Math.round(-z)); return !!r && r.type === 'grass' && !r.buffer && Math.abs(x) <= COLS && !r.blockers.has(Math.round(x)) && !(r.wet && r.wet.has(Math.round(x))); };
function step(c, hd, sp, dt) {
  const nx = c.x + Math.cos(hd) * sp * dt, nz = c.z + Math.sin(hd) * sp * dt;
  if (free(nx, nz)) { c.x = nx; c.z = nz; return true; }
  if (free(nx, c.z)) { c.x = nx; return true; }
  if (free(c.x, nz)) { c.z = nz; return true; }
  return false;
}
const LEAP_T = 0.42, CHARGE_T = 0.85;
function updateCreature(c, dt, P, alive, now) {
  const far = Math.abs(c.row - P.row) > 18;
  c.g.visible = !far; if (far) return;
  c.t -= dt; c.cd -= dt; c.tc += dt;
  const dx = P.x - c.x, dz = P.z - c.z, d = Math.hypot(dx, dz), toP = Math.atan2(dz, dx);
  const sp = c.big ? 2.2 : 2.7, R = c.big ? 2.0 : 1.5;
  let moving = false, jump = 0, sq = 1;
  if (c.st === 'dying') {
    c.dieT += dt; sq = Math.max(0.05, 1 - c.dieT * 4);
    c.g.position.set(c.x, W.groundY(c.x, c.z), c.z); c.body.scale.set(1.3, sq, 1.3);
    if (c.dieT > 0.3) c.dead = true;
    return;
  }
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
    if (c.t <= 0) { c.st = 'chase'; c.t = rg(3.0, 4.2); c.tc = 0; }
  } else if (c.st === 'chase') {                                         // walk up to striking distance
    const ad = adiff(c.hd, toP); c.hd += ad * Math.min(1, dt * 6);
    moving = d > R + 0.8 ? step(c, c.hd, sp, dt) : false;
    if (alive && d <= R + 1.3) { c.st = 'charge'; c.t = CHARGE_T; c.tc = 0; AH.fx.windSuck(c.x, c.z, 6, 1.6, 3); }
    else if (c.t <= 0 || !alive) { c.st = 'idle'; c.cd = 3.5; c.walking = false; c.t = rg(1, 2); }
  } else if (c.st === 'charge') {                                        // crouch and gather: it keeps facing you, then the target is fixed
    c.hd = toP; sq = 1 - 0.28 * Math.min(1, c.tc / CHARGE_T);
    if (Math.random() < dt * 14) AH.fx.windSuck(c.x, c.z, 1, 1.7, 3);
    if (c.t <= 0) {
      const k = Math.max(0, d - 0.9) / (d || 1); let ax = c.x + dx * k, az = c.z + dz * k;
      if (!free(ax, az)) { ax = c.x; az = c.z; }
      c.ax = ax; c.az = az; c.lx = c.x; c.lz = c.z; c.st = 'leap'; c.t = LEAP_T; AH.beep(260, 0.12, 'square', 0.04, 300);
    }
  } else if (c.st === 'leap') {
    const f = 1 - Math.max(0, c.t) / LEAP_T, e = f * f * (3 - 2 * f);
    c.x = c.lx + (c.ax - c.lx) * e; c.z = c.lz + (c.az - c.lz) * e; jump = (c.big ? 2.0 : 1.5) * Math.sin(Math.PI * f); sq = 1.1;
    if (c.t <= 0) {                                                       // landing: a ring of dust, a small shake, and a circle of damage
      c.x = c.ax; c.z = c.az; c.st = 'slam'; c.t = 0.25;
      AH.burst(14, c.x, 0.2, c.z, DUST, 2.8, 3); AH.fx.windBurst(c.x, c.z, 8, 0.5, 5, 0.2); AH.cam.shake = Math.max(AH.cam.shake, c.big ? 0.22 : 0.14); AH.beep(100, 0.2, 'square', 0.06, -60);
      if (alive && !P.fly && P.y - P.baseY < 0.5 && Math.hypot(P.x - c.x, P.z - c.z) < R) { AH.player.hurt('beast', null); if (!P.dead) AH.burst(12, P.x, 0.6, P.z, [0xffd23f, 0xffffff], 3, 4); }
    }
  } else if (c.st === 'slam') {
    sq = 0.72 + 0.28 * (1 - c.t / 0.25);
    if (c.t <= 0) { c.st = 'stun'; c.t = rg(2.8, 3.8); }                  // it missed (or you were hurt): it is dazed for a few seconds
  } else if (c.st === 'stun') {
    sq = 0.95 + Math.sin(now * 5) * 0.02;
    if (c.t <= 0) { c.st = 'idle'; c.cd = 3; c.walking = false; c.t = rg(1, 2); }
  }
  // animation: bob / waddle while walking, breathing when still, a hop and a "!" when it spots you, dizzy stars when stunned
  c.vh += adiff(c.vh, c.hd) * Math.min(1, dt * (c.st === 'charge' || c.st === 'chase' ? 10 : 6));
  c.ph += dt * (c.st === 'chase' ? 9 : moving ? 8 : 2.2);
  const s = Math.sin(c.ph), a = Math.abs(s);
  let by = jump, lean = 0, roll = 0, sy = sq * (1 + Math.sin(c.ph) * (moving || c.st !== 'idle' ? 0 : 0.025));
  if (c.st === 'chase') { by += a * 0.14; roll = s * 0.08; }
  else if (moving) { by += a * 0.1; roll = s * 0.06; lean = -0.04; }
  else if (c.st === 'alert') { lean = 0.25; sy = 1.08; }
  else if (c.st === 'charge') lean = 0.5 * Math.min(1, c.tc / CHARGE_T) + Math.sin(now * 40) * 0.03;
  else if (c.st === 'leap') lean = -0.4 + 0.8 * (1 - c.t / LEAP_T);
  else if (c.st === 'stun') { lean = 0.18; roll = Math.sin(now * 3) * 0.12; }
  c.g.position.set(c.x, by + W.groundY(c.x, c.z), c.z);
  c.body.rotation.y = -c.vh; c.body.rotation.z = lean; c.body.rotation.x = roll; c.body.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
  const showMark = c.st === 'alert';
  c.mark.visible = showMark;
  if (showMark) { const pop = Math.min(1, (0.55 - c.t) * 9); c.mark.position.set(0, (c.big ? 2.1 : 1.45) + by * 0.5 + Math.sin(now * 12) * 0.05, 0); c.mark.scale.setScalar(0.3 + 0.7 * pop); }
  c.stars.visible = c.st === 'stun';
  if (c.stars.visible) c.stars.children.forEach((m, i) => { const q = now * 3 + i * 2.1, r = c.big ? 0.8 : 0.55; m.position.set(Math.cos(q) * r, (c.big ? 2.0 : 1.3), Math.sin(q) * r); m.rotation.y = q; });
}
function updateAqua(c, dt, P, now) {
  const far = Math.abs(c.row - P.row) > 20; c.g.visible = false; if (far) return;
  const q = (now + c.off) % c.per, f = q / c.dur;
  if (f >= 1) { if (c.wet) { c.wet = false; AH.burst(4, c.x + c.dir * c.amp, c.y0, c.z, [0xffffff, 0xcfeaff], 1.4, 1.8); } return; }
  if (!c.wet) { c.wet = true; AH.burst(4, c.x, c.y0, c.z, [0xffffff, 0xcfeaff], 1.4, 1.8); }
  c.g.visible = true;
  const px = c.x + c.dir * f * (c.big ? 3.2 : 1.6), py = c.y0 + Math.sin(Math.PI * f) * c.amp;
  c.g.position.set(px, py, c.z); c.g.rotation.y = c.dir > 0 ? 0 : Math.PI; c.g.rotation.z = Math.atan2(Math.cos(Math.PI * f) * c.amp * Math.PI, (c.big ? 3.2 : 1.6)) * (c.dir > 0 ? 1 : -1);
}

Wd.update = function (dt) {
  const P = AH.P, G = AH.G, now = AH.now(), alive = !P.dead && G.state === 'play';
  for (let i = list.length - 1; i >= 0; i--) {
    const c = list[i];
    if (c.kind === 'aqua') updateAqua(c, dt, P, now); else updateCreature(c, dt, P, alive, now);
    if (c.dead) { AH.scene.remove(c.g); list.splice(i, 1); }
  }
};
})();
