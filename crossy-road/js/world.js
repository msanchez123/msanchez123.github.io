/* world.js: endless lane generation (seeded, themed per zone), hazards driven by the shared clock, checkpoint boss arenas.
 * Everything that answers "can I stand here / what hurts me here" lives in W.stand / W.hitAt / W.baseOf so the player, the robot and
 * the fox all ask the same questions. */
(function () {
'use strict';
const AH = window.AH, T = AH.T;
const COLS = AH.COLS, WRAP = AH.WRAP, PER = AH.PER, Builder = AH.Builder, VM = AH.VM, scene = AH.scene;
const rnd = (a, b) => AH.rnd(a, b), ri = (a, b) => AH.ri(a, b), rand = () => AH.rand();
const pick = arr => arr[Math.floor(rand() * arr.length)];
const W = AH.world = { rows: new Map(), gen: -9, run: 'grass', runLeft: 0, pathCol: 0, arenas: {}, killed: new Set(), removed: new Set() };

const wrapX = W.wrapX = v => ((v + WRAP) % PER + PER) % PER - WRAP;
W.objX = (o, t) => wrapX(o.x0 + o.dir * o.speed * t);
W.arenaStart = r => (r >= AH.ARENA_EVERY && r % AH.ARENA_EVERY < AH.ARENA_LEN) ? r - r % AH.ARENA_EVERY : -1;
W.arena = A => W.arenas[A] || (W.arenas[A] = { beaten: false });
W.firstOpenArena = function () { for (let A = AH.ARENA_EVERY; A < 5000; A += AH.ARENA_EVERY) if (!W.arena(A).beaten) return A; return 1e9; };
const mixHex = (a, b, k) => new T.Color(a).lerp(new T.Color(b), k).getHex();

/* ---- cached geometry (keyed by theme) ---- */
const G = {};
function geo(key, fn) { return G[key] || (G[key] = fn()); }

function treeParts(th, v) {
  return geo('tree' + th.id + v, () => {
    const t = th.tree, B = () => new Builder(), a = t.a[v], b2 = t.b[v];
    if (t.style === 'pine') {
      const tr = B().box(0.3, 1.3, 0.3, t.trunk, 0, 0.65, 0).box(0.46, 0.16, 0.46, mixHex(t.trunk, 0x000000, 0.2), 0, 0.08, 0).build();
      const c = B(), tiers = [[2.0, 1.55], [1.62, 2.1], [1.22, 2.65], [0.82, 3.2]];
      tiers.forEach((q, i) => { c.box(q[0], 0.56, q[0], i % 2 ? b2 : a, 0, q[1], 0).box(q[0] * 0.86, 0.12, q[0] * 0.86, t.cap, 0, q[1] + 0.31, 0); });
      c.box(0.36, 0.5, 0.36, t.c, 0, 3.72, 0).box(0.2, 0.1, 0.2, t.cap, 0, 4.0, 0);
      return { trunk: tr, crown: c.build() };
    }
    if (t.style === 'cactus') {
      const c = B();
      c.box(0.5, 2.3, 0.5, a, 0, 1.15, 0).box(0.34, 2.1, 0.34, b2, 0, 1.15, 0.03).box(0.56, 0.16, 0.56, mixHex(a, 0x000000, 0.2), 0, 0.08, 0)
       .box(0.6, 0.3, 0.3, a, -0.5, 1.15, 0).box(0.3, 0.85, 0.3, a, -0.78, 1.5, 0).box(0.6, 0.3, 0.3, a, 0.5, 1.5, 0).box(0.3, 0.7, 0.3, a, 0.78, 1.8, 0)
       .box(0.2, 0.18, 0.2, t.cap, 0, 2.38, 0).box(0.16, 0.14, 0.16, t.cap, -0.78, 1.98, 0);
      return { trunk: c.build(), crown: null };
    }
    if (t.style === 'char') {
      const c = B();
      c.box(0.36, 1.9, 0.36, t.trunk, 0, 0.95, 0).box(0.5, 0.18, 0.5, a, 0, 0.09, 0).box(0.9, 0.16, 0.16, t.trunk, 0.4, 1.35, 0).box(0.16, 0.7, 0.16, t.trunk, 0.82, 1.62, 0)
       .box(0.7, 0.16, 0.16, t.trunk, -0.32, 1.7, 0).box(0.16, 0.55, 0.16, t.trunk, -0.62, 1.95, 0).box(0.14, 0.14, 0.14, t.c, 0.82, 2.02, 0).box(0.12, 0.12, 0.12, t.cap, -0.62, 2.26, 0).box(0.38, 0.1, 0.38, t.c, 0, 1.86, 0);
      return { trunk: c.build(), crown: null };
    }
    const tr = B().box(0.34, 2.0, 0.34, t.trunk, 0, 1.0, 0).box(0.5, 0.18, 0.5, mixHex(t.trunk, 0x000000, 0.14), 0, 0.09, 0).build();
    const c = B().box(1.9, 0.8, 1.9, a, 0, 2.5, 0).box(1.4, 0.8, 1.4, b2, 0, 3.2, 0).box(0.8, 0.6, 0.8, t.c, 0, 3.8, 0).box(0.9, 0.1, 0.9, t.cap, 0, 4.15, 0).build();
    return { trunk: tr, crown: c };
  });
}
const rockGeo = (th, v) => geo('rock' + th.id + v, () => { const r = th.rock; return v
  ? new Builder().box(0.85, 0.6, 0.75, r[0], 0, 0.3, 0).box(0.5, 0.3, 0.5, r[1], 0.05, 0.72, 0).build()
  : new Builder().box(0.7, 0.9, 0.7, r[2], 0, 0.45, 0).box(0.45, 0.35, 0.45, r[1], -0.05, 1.05, 0.03).build(); });
const padGeo = th => geo('pad' + th.id, () => { const p = th.pad; return new Builder().box(0.92, 0.1, 0.62, p[0], 0, 0, 0).box(0.62, 0.1, 0.92, p[0], 0, 0, 0).box(0.78, 0.1, 0.78, p[1], 0, 0, 0)
  .box(0.5, 0.05, 0.5, p[2], 0, 0.06, 0).box(0.06, 0.05, 0.34, p[3], 0, 0.09, 0.2).build(); });
const fenceGeo = th => geo('fence' + th.id, () => new Builder().box(0.9, 1.3, 0.3, th.fence[0], 0, 0.65, 0).box(0.96, 0.18, 0.34, th.fence[1], 0, 1.2, 0).box(0.96, 0.18, 0.34, th.fence[1], 0, 0.5, 0).build());
const rollGeo = () => geo('roll', () => new T.IcosahedronGeometry(0.58, 0));

function buildCar(len, color, dir, truck) {
  const b = new Builder(), L = len, glass = 0xdff3fb;
  b.box(L * 0.96, 0.18, 0.78, 0x2a2f36, 0, 0.18, 0);
  if (!truck) {
    b.box(L, 0.46, 0.82, color, 0, 0.5, 0).box(L * 0.5, 0.36, 0.74, glass, -dir * L * 0.06, 0.9, 0).box(L * 0.34, 0.06, 0.76, color, -dir * L * 0.06, 1.11, 0);
  } else {
    b.box(L - 1.05, 0.8, 0.86, 0xf1f5f9, -dir * 0.525, 0.62, 0).box(0.95, 0.62, 0.84, color, dir * (L / 2 - 0.48), 0.5, 0).box(0.12, 0.26, 0.7, glass, dir * (L / 2 - 0.02), 0.66, 0);
  }
  b.box(0.06, 0.12, 0.14, 0xfff1a6, dir * L / 2, 0.5, 0.26).box(0.06, 0.12, 0.14, 0xfff1a6, dir * L / 2, 0.5, -0.26);
  return b.build();
}
function buildLog(len, th) {
  const l = th.log;
  return new Builder().box(len, 0.3, 0.84, l[0], 0, 0, 0).box(len * 0.9, 0.04, 0.3, l[1], 0, 0.16, 0)
    .box(0.08, 0.26, 0.7, l[2], len / 2, 0, 0).box(0.08, 0.26, 0.7, l[2], -len / 2, 0, 0).build();
}
function buildTrain(len, dir, col) {
  return new Builder().box(len, 1.0, 0.9, col, 0, 0.8, 0).box(len * 0.98, 0.1, 1, 0x2b2f36, 0, 1.35, 0).box(len * 0.9, 0.3, 0.92, 0xdff3fb, 0, 1.0, 0)
    .box(1.2, 0.9, 0.86, 0xffd23f, dir * (len / 2 - 0.6), 0.75, 0).box(len * 0.95, 0.3, 1, 0x222831, 0, 0.25, 0)
    .box(0.1, 0.2, 0.2, 0xfff1a6, dir * len / 2, 0.7, 0.25).box(0.1, 0.2, 0.2, 0xfff1a6, dir * len / 2, 0.7, -0.25).build();
}
const CAR_COLORS = [0xe5484d, 0x3b82f6, 0xf5c518, 0x9b5de5, 0x2dd4bf, 0xff7a59, 0xf1f5f9];

/* ---- type selection ---- */
const TYPES = [['grass', 0.2, 1, 2, 0], ['road', 0.24, 1, 3, 0], ['water', 0.18, 1, 2, 0], ['rail', 0.08, 1, 2, 12],
  ['lily', 0.1, 1, 3, 6], ['conv', 0.08, 1, 2, 8], ['roll', 0.12, 1, 3, 4]];
function pickType(r) {
  const A = W.arenaStart(r);
  if (A >= 0) { W.runLeft = 0; return (r - A === AH.ARENA_LEN - 1) ? 'gate' : 'arena'; }
  if (r <= 2 || r % AH.ARENA_EVERY >= AH.ARENA_EVERY - 2 || r % AH.ARENA_EVERY === AH.ARENA_LEN) return 'grass';
  if (W.runLeft <= 0) {
    const mix = AH.themeAt(r).mix;
    const avail = TYPES.filter(e => r >= e[4]).map(e => [e[0], e[1] * (mix[e[0]] || 1), e[2], e[3]]);
    const tot = avail.reduce((s, e) => s + e[1], 0);
    let e;
    do { let x = rand() * tot, acc = 0; for (let i = 0; i < avail.length; i++) { acc += avail[i][1]; if (x < acc || i === avail.length - 1) { e = avail[i]; break; } } } while (e[0] === W.run);
    W.run = e[0]; W.runLeft = ri(e[2], e[3]);
  }
  W.runLeft--;
  return W.run;
}

/* ---- row construction ---- */
function addObstacle(row, x, rock, solid, th) {
  const g = new T.Group();
  if (rock) {
    const m = new T.Mesh(rockGeo(th, rand() < 0.5 ? 0 : 1), VM); m.castShadow = true; g.add(m);
  } else {
    const parts = treeParts(th, rand() < 0.5 ? 0 : 1);
    const trunk = new T.Mesh(parts.trunk, VM); trunk.castShadow = true; g.add(trunk);
    if (parts.crown) { const can = new T.Mesh(parts.crown, VM); can.castShadow = true; g.add(can); row.canopies.push({ mesh: can, x: x }); }
    const s = rnd(0.9, 1.2); g.scale.set(s, s * rnd(0.95, 1.15), s);
  }
  g.position.x = x; g.rotation.y = ri(0, 3) * 1.5708;
  row.group.add(g);
  if (solid) row.blockers.set(x, { kind: rock ? 'rock' : 'tree', node: g });
}

function groundDetails(b, th) {
  const n = ri(8, 14);
  for (let i = 0; i < n; i++) {
    const x = rnd(-COLS - 3, COLS + 3), z = rnd(-0.4, 0.4), h = rnd(0.3, 0.55), c = rand() < 0.5 ? th.tuft[0] : th.tuft[1];
    if (th.id === 'winter') b.box(0.1, h * 0.8, 0.1, c, x, h * 0.4, z).box(0.07, h * 0.55, 0.07, th.tuft[1], x + 0.1, h * 0.28, z + 0.04);
    else if (th.id === 'volcano') b.box(0.12, 0.05, 0.12, rand() < 0.5 ? 0xff6a1a : 0xffb43a, x, 0.03, z).box(0.3, 0.04, 0.08, 0x2b2630, x + 0.2, 0.02, z - 0.1);
    else b.box(0.07, h, 0.07, c, x, h / 2, z).box(0.07, h * 0.8, 0.07, c, x + 0.09, h * 0.4, z + 0.05).box(0.07, h * 0.65, 0.07, c, x - 0.08, h * 0.33, z - 0.05);
  }
  for (let i = ri(0, 2); i > 0; i--) {
    const x = rnd(-COLS - 2, COLS + 2), z = rnd(-0.35, 0.35);
    if (th.id === 'volcano') b.box(0.18, 0.1, 0.18, th.bloom[ri(0, 2)], x, 0.05, z);
    else b.box(0.05, 0.22, 0.05, th.id === 'desert' ? 0x2f8f4a : 0x3f9a3a, x, 0.11, z).box(0.16, 0.12, 0.16, pick(th.bloom), x, 0.26, z);
  }
  for (let i = ri(0, 2); i > 0; i--) b.box(0.22, 0.1, 0.18, th.pebble, rnd(-COLS - 2, COLS + 2), 0.05, rnd(-0.35, 0.35));
  if (th.id === 'winter') for (let i = ri(0, 2); i > 0; i--) b.box(0.5, 0.18, 0.4, 0xffffff, rnd(-COLS - 2, COLS + 2), 0.09, rnd(-0.3, 0.3));
  if (th.id === 'desert') for (let i = ri(0, 2); i > 0; i--) b.box(0.6, 0.12, 0.34, th.ground[1], rnd(-COLS - 2, COLS + 2), 0.06, rnd(-0.3, 0.3));
}

/* arena dressing: a ring of runes on the floor, walls with braziers, themed props outside, banners at the entrance */
function arenaDecor(b, th, r, k, gate) {
  const A = th.arena, SIDES = [-1, 1];
  b.box(80, 0.5, 1, (k + r) % 2 ? A.a : A.b, 0, -0.25, 0);
  // rune rings
  [5.4, 2.7].forEach(R => { const dz = k - 7; if (Math.abs(dz) <= R) { const x = Math.sqrt(R * R - dz * dz), w = Math.abs(dz) > R - 0.6 ? 1.3 : 0.5; for (const s of x < 0.3 ? [1] : SIDES) b.box(w, 0.03, 0.62, A.accent, s * x, 0.015, 0); } });
  if (k === 7) b.box(1.2, 0.04, 1.2, A.accent, 0, 0.02, 0).box(0.5, 0.06, 0.5, A.flame[1], 0, 0.04, 0);
  if (k === 1) b.box(COLS * 2 + 1, 0.03, 0.34, A.flag, 0, 0.015, 0.1);
  // walls
  for (const s of SIDES) {
    const wx = s * (COLS + 1.35);
    b.box(0.5, 0.8, 1.02, A.wall, wx, 0.4, 0).box(0.72, 0.14, 1.04, A.wallTop, wx, 0.86, 0);
    if (k % 3 === 1) { // brazier
      b.box(0.14, 0.55, 0.14, 0x3a2f2a, wx, 1.2, 0).box(0.5, 0.14, 0.5, 0x3a2f2a, wx, 1.52, 0).box(0.28, 0.3, 0.28, A.flame[0], wx, 1.74, 0).box(0.16, 0.26, 0.16, A.flame[1], wx, 1.98, 0);
    }
    // props beyond the wall
    const px = s * (COLS + 2.3 + rnd(0, 1.4)), h = rnd(0.8, 2.5), prop = A.prop;
    if (prop === 'ruin') { b.box(0.8, h, 0.8, A.pillar[0], px, h / 2, 0).box(1.0, 0.25, 1.0, A.pillar[1], px, h + 0.12, 0); if (rand() < 0.6) b.box(0.84, 0.18, 0.84, A.moss, px, h * 0.55, 0); }
    else if (prop === 'ice') { b.box(0.7, h, 0.7, A.pillar[0], px, h / 2, 0).box(0.42, h * 0.55, 0.42, A.pillar[1], px + 0.05, h + h * 0.27, 0).box(0.18, 0.5, 0.18, 0xffffff, px + 0.05, h + h * 0.6, 0); }
    else if (prop === 'obelisk') { b.box(0.9, 0.4, 0.9, A.pillar[1], px, 0.2, 0).box(0.66, h, 0.66, A.pillar[0], px, 0.4 + h / 2, 0).box(0.4, 0.5, 0.4, A.accent, px, 0.4 + h + 0.25, 0); }
    else { b.box(0.8, h, 0.8, A.pillar[0], px, h / 2, 0).box(0.82, 0.1, 0.82, A.accent, px, h * 0.45, 0).box(0.6, 0.12, 0.6, A.flame[0], px, h + 0.06, 0); }
  }
  // scattered floor debris so the arena never looks bare
  for (let i = ri(2, 4); i > 0; i--) b.box(rnd(0.15, 0.4), 0.06, rnd(0.15, 0.3), mixHex(A.a, A.accent, 0.4), rnd(-COLS, COLS), 0.03, rnd(-0.35, 0.35));
  if (th.id === 'volcano') for (let i = ri(1, 3); i > 0; i--) b.box(rnd(0.5, 1.4), 0.03, 0.07, 0xff7a1a, rnd(-COLS, COLS), 0.02, rnd(-0.3, 0.3));
  if (th.id === 'winter') for (let i = ri(1, 3); i > 0; i--) b.box(0.4, 0.06, 0.4, 0xffffff, rnd(-COLS, COLS), 0.03, rnd(-0.3, 0.3));
  // entrance posts with flags, then the boss banners at the exit gate
  if (k === 0 || gate) for (const s of SIDES) {
    const px = s * (COLS + 0.8);
    b.box(0.6, 3.4, 0.6, A.pillar[0], px, 1.7, 0).box(0.8, 0.3, 0.8, A.pillar[1], px, 3.55, 0).box(0.3, 0.3, 0.3, A.flame[1], px, 3.9, 0)
     .box(0.7, 0.5, 0.06, A.flag, px - s * 0.45, 3.1, 0).box(0.7, 0.18, 0.07, A.flame[1], px - s * 0.45, 3.1, 0);
  }
}

function makeRow(r) {
  const th = AH.themeAt(r), type = pickType(r), b = new Builder();
  const row = { r: r, type: type, objs: [], blockers: new Map(), pads: null, group: new T.Group(), canopies: [], train: null, lamp: null, carry: 0, theme: th.id };
  const d = Math.min(1, Math.max(0, r) / 120);
  const prev = W.pathCol;
  W.pathCol = AH.clamp(prev + ri(-1, 1), -COLS, COLS);
  const pc = W.pathCol;
  const addObj = (mesh, o) => { o.mesh = mesh; o.row = r; o.idx = row.objs.length; o.alive = !W.killed.has(r + ':' + o.idx); mesh.visible = o.alive; row.group.add(mesh); row.objs.push(o); };
  const place = (i, n, off, jit) => -WRAP + (((off + i * PER / n + rnd(-jit, jit)) % PER) + PER) % PER;

  if (type === 'grass') {
    b.box(80, 0.5, 1, th.ground[r & 1], 0, -0.25, 0);
    groundDetails(b, th);
  } else if (type === 'road') {
    b.box(80, 0.5, 1, th.road, 0, -0.25, 0);
    const before = W.rows.get(r - 1);
    if (before && before.type === 'road') for (let x = -40; x < 40; x += 2.4) b.box(1.2, 0.02, 0.14, th.marking, x, 0.01, 0.5);
    b.box(0.3, 0.55, 0.3, th.cone, COLS + 1.4, 0.27, 0.3).box(0.3, 0.55, 0.3, th.cone, -COLS - 1.4, 0.27, 0.3);
  } else if (type === 'water' || type === 'lily') {
    // the river ends at the map edge, where it spills over a waterfall: touch it and you are out of the map
    const rip = th.id === 'volcano' ? 0xffb43a : mixHex(th.water, 0xffffff, 0.35), fall = th.id === 'volcano' ? 0xff8a2a : mixHex(th.water, 0xffffff, 0.5);
    const EDGE = COLS + 1.5;
    b.box(EDGE * 2, 0.4, 1, th.water, 0, -0.5, 0);
    for (let i = ri(5, 9); i > 0; i--) b.box(rnd(0.5, 1.4), 0.02, 0.07, rip, rnd(-EDGE + 0.8, EDGE - 0.8), -0.29, rnd(-0.4, 0.4));
    for (const sx of [-1, 1]) {
      b.box(0.45, 0.12, 1.02, 0xffffff, sx * (EDGE + 0.1), -0.27, 0)                       // foam on the lip
       .box(0.34, 3.4, 1.0, fall, sx * (EDGE + 0.3), -1.95, 0).box(0.1, 3.0, 0.5, 0xffffff, sx * (EDGE + 0.52), -1.8, 0.1)   // the falling sheet
       .box(0.1, 2.2, 0.3, rip, sx * (EDGE + 0.2), -1.6, -0.25).box(1.0, 0.18, 1.2, 0xffffff, sx * (EDGE + 0.5), -3.6, 0);    // streaks and mist at the bottom
    }
  } else if (type === 'rail') {
    b.box(80, 0.4, 1, th.bed, 0, -0.2, 0);
    for (let x = -40; x < 40; x += 0.8) b.box(0.22, 0.08, 0.9, th.tie, x, 0.04, 0);
    b.box(80, 0.1, 0.08, th.steel, 0, 0.12, 0.28).box(80, 0.1, 0.08, th.steel, 0, 0.12, -0.28);
    b.box(0.14, 1.6, 0.14, 0x4a525c, -COLS - 1.6, 0.8, 0.4);
  } else if (type === 'conv') {
    b.box(80, 0.5, 1, th.conv.base, 0, -0.25, 0).box(80, 0.2, 0.08, th.conv.edge, 0, 0.02, 0.46).box(80, 0.2, 0.08, th.conv.edge, 0, 0.02, -0.46);
  } else if (type === 'roll') {
    b.box(80, 0.5, 1, th.roll.ground, 0, -0.25, 0);
    for (let i = 0; i < 10; i++) b.box(0.24, 0.1, 0.2, th.roll.speck, rnd(-COLS - 3, COLS + 3), 0.05, rnd(-0.35, 0.35));
  } else if (type === 'arena' || type === 'gate') {
    arenaDecor(b, th, r, r - W.arenaStart(r), type === 'gate');
  }
  const mesh = new T.Mesh(b.build(), VM);
  mesh.castShadow = false; mesh.receiveShadow = true;
  row.group.add(mesh);
  row.group.position.z = -r;

  if (type === 'grass') {
    for (let x = -COLS - 6; x <= COLS + 6; x++) {
      const inArea = Math.abs(x) <= COLS;
      let p;
      if (inArea) { if (x === prev || x === pc) continue; p = r <= 2 ? 0 : 0.085; } else p = Math.abs(x) === COLS + 1 ? 1 : 0.35;
      const hit = rand() < p, rock = rand() < 0.25;
      if (hit && !W.removed.has(r + ':' + x)) addObstacle(row, x, rock, inArea, th);
    }
  } else if (type === 'road') {
    const dir = rand() < 0.5 ? -1 : 1, sp = rnd(2.2, 4.2) * (1 + 0.5 * d), n = ri(4, 7), off = rnd(0, PER);
    for (let i = 0; i < n; i++) {
      const truck = rand() < 0.3, len = truck ? 2.6 : 1.5, x = place(i, n, off, 0.8);
      const m = new T.Mesh(buildCar(len, CAR_COLORS[ri(0, CAR_COLORS.length - 1)], dir, truck), VM); m.castShadow = true;
      addObj(m, { x0: x, x: x, len: len, dir: dir, speed: sp, kind: 'car', hurts: true, carries: false });
    }
  } else if (type === 'roll') {
    const dir = rand() < 0.5 ? -1 : 1, sp = rnd(2.6, 5) * (1 + 0.4 * d), n = ri(4, 6), off = rnd(0, PER);
    for (let i = 0; i < n; i++) {
      const s = rnd(0.9, 1.25), m = new T.Mesh(rollGeo(), AH.M(th.roll.ball)); m.scale.set(s, s, s); m.position.y = 0.58 * s; m.castShadow = true;
      addObj(m, { x0: place(i, n, off, 0.8), x: 0, len: 1.1 * s, dir: dir, speed: sp, kind: 'roll', hurts: true, carries: false, spin: s });
    }
  } else if (type === 'water') {
    const dir = rand() < 0.5 ? -1 : 1, sp = rnd(1.1, 2.0) * (1 + 0.3 * d), n = ri(5, 7), off = rnd(0, PER);
    for (let i = 0; i < n; i++) {
      const len = rnd(2, 3.4), m = new T.Mesh(buildLog(len, th), VM); m.castShadow = true;
      addObj(m, { x0: place(i, n, off, 0.6), x: 0, len: len, dir: dir, speed: sp, kind: 'log', hurts: false, carries: true });
    }
  } else if (type === 'lily') {
    row.pads = new Map();
    for (let x = -COLS; x <= COLS; x++) {
      if (rand() < 0.38 || x === prev || x === pc) {
        const m = new T.Mesh(padGeo(th), VM); m.position.set(x, AH.PADY - 0.04, 0); m.rotation.y = rand() * 3; m.receiveShadow = true;
        row.group.add(m); row.pads.set(x, m);
      }
    }
  } else if (type === 'conv') {
    const dir = rand() < 0.5 ? -1 : 1, sp = rnd(1.3, 2.3);
    row.carry = dir * sp;
    for (let i = 0; i < 16; i++) {
      const m = new T.Mesh(AH.BOX, AH.M(th.conv.belt)); m.scale.set(1.2, 0.04, 0.7); m.position.y = 0.03;
      addObj(m, { x0: -WRAP + i * PER / 16, x: 0, len: 1.2, dir: dir, speed: sp, kind: 'deco', hurts: false, carries: false });
    }
    row.objs.forEach(o => { o.alive = true; o.mesh.visible = true; });
  } else if (type === 'rail') {
    const dir = rand() < 0.5 ? -1 : 1, len = ri(8, 11), tm = rnd(4.2, 7.5);
    const m = new T.Mesh(buildTrain(len, dir, pick([0x3b82f6, 0xe5484d, 0x2dd4bf, 0x9b5de5])), VM); m.castShadow = true; m.visible = false;
    row.group.add(m);
    const lamp = new T.Mesh(AH.BOX, AH.M(0x552222)); lamp.scale.set(0.3, 0.3, 0.3); lamp.position.set(-COLS - 1.6, 1.7, 0.4);
    row.group.add(lamp); row.lamp = lamp;
    row.train = { mesh: m, dir: dir, len: len, T: tm, warn: 1.3, speed: 30, off: rnd(0, tm), alive: !W.killed.has(r + ':-1'), row: r, idx: -1, kind: 'train' };
  } else if (type === 'gate') {
    if (!W.arena(W.arenaStart(r)).beaten) {
      for (let x = -COLS; x <= COLS; x++) {
        const m = new T.Mesh(fenceGeo(th), VM); m.position.x = x; m.castShadow = true; row.group.add(m);
        row.blockers.set(x, { kind: 'fence', node: m });
      }
    }
  }
  scene.add(row.group);
  return row;
}
function removeRow(row) { scene.remove(row.group); }

/* ---- public api ---- */
W.reset = function (seed) {
  W.rows.forEach(removeRow); W.rows.clear();
  W.gen = -9; W.run = 'grass'; W.runLeft = 0; W.pathCol = 0; W.arenas = {}; W.killed = new Set(); W.removed = new Set();
  AH.setSeed(seed);
};
W.ensure = function (needRow) { while (W.gen < needRow) { W.gen++; W.rows.set(W.gen, makeRow(W.gen)); } };
W.prune = function (minRow) { W.rows.forEach((row, r) => { if (r < minRow) { removeRow(row); W.rows.delete(r); } }); };
W.get = r => W.rows.get(r);

W.trainState = function (row, t) {
  const tr = row.train, p = (((t + tr.off) % tr.T) + tr.T) % tr.T;
  if (p < tr.warn) return { warn: true, x: null };
  const q = p - tr.warn, sx = -tr.dir * (WRAP + tr.len / 2), x = sx + tr.dir * tr.speed * q;
  if (Math.abs(x) > WRAP + tr.len / 2 + 1) return { warn: false, x: null };
  return { warn: false, x: x };
};
/* hazard overlapping x at time t (pad = extra reach; the planner asks with a bigger pad than the game uses) */
W.hitAt = function (row, x, t, pad) {
  if (!row) return null;
  const pd = pad === undefined ? 0.3 : pad;
  if (row.type === 'road' || row.type === 'roll') {
    for (const o of row.objs) if (o.alive && o.hurts && Math.abs(W.objX(o, t) - x) < o.len / 2 + pd) return o;
  } else if (row.type === 'rail' && row.train && row.train.alive) {
    const s = W.trainState(row, t);
    if (s.x !== null && Math.abs(s.x - x) < row.train.len / 2 + pd) return row.train;
  }
  return null;
};
W.logAt = function (row, x, t, pad) {
  if (!row || row.type !== 'water') return null;
  const pd = pad === undefined ? 0.25 : pad;
  for (const o of row.objs) if (Math.abs(W.objX(o, t) - x) < o.len / 2 + pd) return o;
  return null;
};
W.padAt = (row, x) => !!(row && row.pads && row.pads.has(Math.round(x)));

/* The one answer to "what is under my feet at (row, x, t)?" Water needs a log, lily water needs a pad, everything else is ground. */
W.baseOf = row => !row ? 0 : row.type === 'water' ? AH.LOGTOP : row.type === 'lily' ? AH.PADY : 0;
W.stand = function (row, x, t, pad) {
  if (!row) return { ok: false, kind: 'void' };
  if (row.type === 'water') { const lg = W.logAt(row, x, t, pad); return lg ? { ok: true, base: AH.LOGTOP, log: lg } : { ok: false, kind: 'water' }; }
  if (row.type === 'lily') return W.padAt(row, x) ? { ok: true, base: AH.PADY, snap: Math.round(x) } : { ok: false, kind: 'water' };
  return { ok: true, base: 0 };
};

/* destruction (applied locally; fx.js broadcasts it) */
W.killObj = function (r, i, silent) {
  W.killed.add(r + ':' + i);
  const row = W.rows.get(r); if (!row) return false;
  const o = i < 0 ? row.train : row.objs[i];
  if (!o || !o.alive) return false;
  o.alive = false; o.mesh.visible = false;
  if (!silent) AH.burst(8, o.x !== undefined ? o.x : 0, 0.6, -r, [0xffd23f, 0xffffff, 0xff7a59], 3, 4);
  return true;
};
W.removeBlocker = function (r, c, silent) {
  W.removed.add(r + ':' + c);
  const row = W.rows.get(r); if (!row) return false;
  const bl = row.blockers.get(c);
  if (!bl || bl.kind === 'fence') return false;
  row.blockers.delete(c); row.group.remove(bl.node);
  row.canopies = row.canopies.filter(cn => cn.x !== c);
  if (!silent) AH.burst(8, c, 0.8, -r, [0x7b4f2a, 0x4cc46f, 0xb7c0c8], 3, 4);
  return true;
};
W.beat = function (A) {
  W.arena(A).beaten = true;
  const row = W.rows.get(A + AH.ARENA_LEN - 1);
  if (row) { row.blockers.forEach(bl => row.group.remove(bl.node)); row.blockers.clear(); }
};

/* what a player who joins mid-round needs to rebuild the same world */
W.snapshot = function () {
  return { k: Array.from(W.killed), rm: Array.from(W.removed), bt: Object.keys(W.arenas).filter(a => W.arenas[a].beaten).map(Number) };
};
W.applySnapshot = function (s) {
  if (!s) return;
  (s.bt || []).forEach(A => W.beat(A));
  (s.rm || []).forEach(id => { const q = id.split(':'); W.removeBlocker(+q[0], +q[1], true); });
  (s.k || []).forEach(id => { const q = id.split(':'); W.killObj(+q[0], +q[1], true); });
};

W.update = function (dt, fx, fz) {
  const t = AH.now();
  W.rows.forEach(row => {
    for (const o of row.objs) {
      if (!o.alive) continue;
      o.x = wrapX(o.x0 + o.dir * o.speed * t); o.mesh.position.x = o.x;
      if (row.type === 'water') o.mesh.visible = Math.abs(o.x) - o.len / 2 < COLS + 1.9;
      if (o.spin) o.mesh.rotation.z = -o.dir * o.x / (0.58 * o.spin);
    }
    if (row.train) {
      const s = W.trainState(row, t), tr = row.train;
      tr.mesh.visible = tr.alive && s.x !== null;
      if (s.x !== null) { tr.mesh.position.x = s.x; tr.x = s.x; }
      const on = s.warn && Math.floor(t * 6) % 2 === 0;
      row.lamp.material = AH.M(on ? 0xff3b3b : 0x552222);
    }
    // canopies fade when the player stands under or right behind them
    if (row.canopies.length && Math.abs(-row.r - fz) < 3.2) {
      for (const c of row.canopies) c.mesh.material = Math.abs(c.x - fx) < 3.2 ? AH.VMG : VM;
    } else for (const c of row.canopies) if (c.mesh.material !== VM) c.mesh.material = VM;
  });
};
})();
