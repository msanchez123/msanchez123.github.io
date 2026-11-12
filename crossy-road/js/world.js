/* world.js: endless lane generation (seeded), hazards driven by the shared clock, checkpoint boss arenas. */
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

/* ---- cached geometry ---- */
const G = {};
function geo(key, fn) { return G[key] || (G[key] = fn()); }
const trunkGeo = () => geo('trunk', () => new Builder().box(0.34, 2.0, 0.34, 0x7b4f2a, 0, 1.0, 0).box(0.5, 0.18, 0.5, 0x6a4423, 0, 0.09, 0).build());
const canopyGeo = v => geo('canopy' + v, () => {
  const g = v ? 0x2a8f4f : 0x2f9a58, g2 = v ? 0x39a860 : 0x3fb36a;
  return new Builder().box(1.9, 0.8, 1.9, g, 0, 2.5, 0).box(1.4, 0.8, 1.4, g2, 0, 3.2, 0).box(0.8, 0.6, 0.8, 0x4cc46f, 0, 3.8, 0).box(0.9, 0.1, 0.9, 0xf6fbff, 0, 4.15, 0).build();
});
const rockGeo = v => geo('rock' + v, () => v
  ? new Builder().box(0.85, 0.6, 0.75, 0x9aa3ad, 0, 0.3, 0).box(0.5, 0.3, 0.5, 0xb7c0c8, 0.05, 0.72, 0).build()
  : new Builder().box(0.7, 0.9, 0.7, 0x8a939d, 0, 0.45, 0).box(0.45, 0.35, 0.45, 0xb7c0c8, -0.05, 1.05, 0.03).build());
const padGeo = () => geo('pad', () => new Builder().box(0.92, 0.1, 0.62, 0x3fbf5a, 0, 0, 0).box(0.62, 0.1, 0.92, 0x3fbf5a, 0, 0, 0).box(0.78, 0.1, 0.78, 0x46c862, 0, 0, 0)
  .box(0.5, 0.05, 0.5, 0x5ad577, 0, 0.06, 0).box(0.06, 0.05, 0.34, 0x2f9a45, 0, 0.09, 0.2).build());
const fenceGeo = () => geo('fence', () => new Builder().box(0.9, 1.3, 0.3, 0x8a6a4a, 0, 0.65, 0).box(0.96, 0.18, 0.34, 0xb08a5a, 0, 1.2, 0).box(0.96, 0.18, 0.34, 0xb08a5a, 0, 0.5, 0).build());
const rollGeo = () => geo('roll', () => new T.IcosahedronGeometry(0.58, 0));
const pillarGeo = () => geo('pillar', () => new Builder().box(0.8, 2.6, 0.8, 0xb9b0a0, 0, 1.3, 0).box(1, 0.3, 1, 0x9d9484, 0, 2.75, 0).build());

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
function buildLog(len) {
  return new Builder().box(len, 0.3, 0.84, 0x9a6a3a, 0, 0, 0).box(len * 0.9, 0.04, 0.3, 0xb07f4a, 0, 0.16, 0)
    .box(0.08, 0.26, 0.7, 0xd9b27c, len / 2, 0, 0).box(0.08, 0.26, 0.7, 0xd9b27c, -len / 2, 0, 0).build();
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
  if (r <= 2 || r % AH.ARENA_EVERY >= AH.ARENA_EVERY - 2) return 'grass';
  if (W.runLeft <= 0) {
    const avail = TYPES.filter(e => r >= e[4]);
    const tot = avail.reduce((s, e) => s + e[1], 0);
    let e;
    do { let x = rand() * tot, acc = 0; for (let i = 0; i < avail.length; i++) { acc += avail[i][1]; if (x < acc || i === avail.length - 1) { e = avail[i]; break; } } } while (e[0] === W.run);
    W.run = e[0]; W.runLeft = ri(e[2], e[3]);
  }
  W.runLeft--;
  return W.run;
}

/* ---- row construction ---- */
function addObstacle(row, x, rock, solid) {
  const g = new T.Group();
  if (rock) {
    const m = new T.Mesh(rockGeo(rand() < 0.5 ? 0 : 1), VM); m.castShadow = true; g.add(m);
  } else {
    const trunk = new T.Mesh(trunkGeo(), VM); trunk.castShadow = true;
    const can = new T.Mesh(canopyGeo(rand() < 0.5 ? 0 : 1), VM); can.castShadow = true;
    g.add(trunk, can); row.canopies.push({ mesh: can, x: x });
    const s = rnd(0.9, 1.2); g.scale.set(s, s * rnd(0.95, 1.15), s);
  }
  g.position.x = x; g.rotation.y = ri(0, 3) * 1.5708;
  row.group.add(g);
  if (solid) row.blockers.set(x, { kind: rock ? 'rock' : 'tree', node: g });
}
function grassDetails(b, r) {
  const n = ri(8, 14);
  for (let i = 0; i < n; i++) {
    const x = rnd(-COLS - 3, COLS + 3), z = rnd(-0.4, 0.4), h = rnd(0.3, 0.55), c = rand() < 0.5 ? 0x4fae3f : 0x62c24c;
    b.box(0.07, h, 0.07, c, x, h / 2, z).box(0.07, h * 0.8, 0.07, c, x + 0.09, h * 0.4, z + 0.05).box(0.07, h * 0.65, 0.07, c, x - 0.08, h * 0.33, z - 0.05);
  }
  for (let i = ri(0, 2); i > 0; i--) {
    const x = rnd(-COLS - 2, COLS + 2), z = rnd(-0.35, 0.35);
    b.box(0.05, 0.22, 0.05, 0x3f9a3a, x, 0.11, z).box(0.16, 0.12, 0.16, pick([0xff6fa5, 0xffd23f, 0xffffff, 0xa78bfa]), x, 0.26, z);
  }
  for (let i = ri(0, 2); i > 0; i--) b.box(0.22, 0.1, 0.18, 0xb3bcc5, rnd(-COLS - 2, COLS + 2), 0.05, rnd(-0.35, 0.35));
}
function makeRow(r) {
  const type = pickType(r), b = new Builder();
  const row = { r: r, type: type, objs: [], blockers: new Map(), pads: null, group: new T.Group(), canopies: [], train: null, lamp: null, carry: 0 };
  const d = Math.min(1, Math.max(0, r) / 120);
  const prev = W.pathCol;
  W.pathCol = AH.clamp(prev + ri(-1, 1), -COLS, COLS);
  const pc = W.pathCol;
  const addObj = (mesh, o) => { o.mesh = mesh; o.row = r; o.idx = row.objs.length; o.alive = !W.killed.has(r + ':' + o.idx); mesh.visible = o.alive; row.group.add(mesh); row.objs.push(o); };
  const place = (i, n, off, jit) => -WRAP + (((off + i * PER / n + rnd(-jit, jit)) % PER) + PER) % PER;

  if (type === 'grass') {
    b.box(80, 0.5, 1, (r & 1) ? 0x7bcf5a : 0x86d964, 0, -0.25, 0);
    grassDetails(b, r);
  } else if (type === 'road') {
    b.box(80, 0.5, 1, 0x59626e, 0, -0.25, 0);
    const before = W.rows.get(r - 1);
    if (before && before.type === 'road') for (let x = -40; x < 40; x += 2.4) b.box(1.2, 0.02, 0.14, 0xe9eef2, x, 0.01, 0.5);
    b.box(0.3, 0.55, 0.3, 0xf97316, COLS + 1.4, 0.27, 0.3).box(0.3, 0.55, 0.3, 0xf97316, -COLS - 1.4, 0.27, 0.3);
  } else if (type === 'water' || type === 'lily') {
    b.box(80, 0.4, 1, 0x3aa0e8, 0, -0.5, 0);
  } else if (type === 'rail') {
    b.box(80, 0.4, 1, 0x8d8579, 0, -0.2, 0);
    for (let x = -40; x < 40; x += 0.8) b.box(0.22, 0.08, 0.9, 0x5b4636, x, 0.04, 0);
    b.box(80, 0.1, 0.08, 0xaeb6bf, 0, 0.12, 0.28).box(80, 0.1, 0.08, 0xaeb6bf, 0, 0.12, -0.28);
    b.box(0.14, 1.6, 0.14, 0x4a525c, -COLS - 1.6, 0.8, 0.4);
  } else if (type === 'conv') {
    b.box(80, 0.5, 1, 0x3a3f47, 0, -0.25, 0).box(80, 0.2, 0.08, 0xffd23f, 0, 0.02, 0.46).box(80, 0.2, 0.08, 0xffd23f, 0, 0.02, -0.46);
  } else if (type === 'roll') {
    b.box(80, 0.5, 1, 0xc2a26a, 0, -0.25, 0);
    for (let i = 0; i < 10; i++) b.box(0.24, 0.1, 0.2, 0x9a8156, rnd(-COLS - 3, COLS + 3), 0.05, rnd(-0.35, 0.35));
  } else if (type === 'arena' || type === 'gate') {
    const k = r - W.arenaStart(r);
    b.box(80, 0.5, 1, (k + r) % 2 ? 0xcfc7b8 : 0xc2baa9, 0, -0.25, 0);
    if (k % 3 === 0) { /* pillars sit in the border, never in the play area */ }
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
      if (hit && !W.removed.has(r + ':' + x)) addObstacle(row, x, rock, inArea);
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
      const s = rnd(0.9, 1.25), m = new T.Mesh(rollGeo(), AH.M(0x8d9199)); m.scale.set(s, s, s); m.position.y = 0.58 * s; m.castShadow = true;
      addObj(m, { x0: place(i, n, off, 0.8), x: 0, len: 1.1 * s, dir: dir, speed: sp, kind: 'roll', hurts: true, carries: false, spin: s });
    }
  } else if (type === 'water') {
    const dir = rand() < 0.5 ? -1 : 1, sp = rnd(1.1, 2.0) * (1 + 0.3 * d), n = ri(5, 7), off = rnd(0, PER);
    for (let i = 0; i < n; i++) {
      const len = rnd(2, 3.4), m = new T.Mesh(buildLog(len), VM); m.castShadow = true;
      addObj(m, { x0: place(i, n, off, 0.6), x: 0, len: len, dir: dir, speed: sp, kind: 'log', hurts: false, carries: true });
    }
  } else if (type === 'lily') {
    row.pads = new Map();
    for (let x = -COLS; x <= COLS; x++) {
      if (rand() < 0.38 || x === prev || x === pc) {
        const m = new T.Mesh(padGeo(), VM); m.position.set(x, AH.PADY - 0.04, 0); m.rotation.y = rand() * 3; m.receiveShadow = true;
        row.group.add(m); row.pads.set(x, m);
      }
    }
  } else if (type === 'conv') {
    const dir = rand() < 0.5 ? -1 : 1, sp = rnd(1.3, 2.3);
    row.carry = dir * sp;
    for (let i = 0; i < 16; i++) {
      const m = new T.Mesh(AH.BOX, AH.M(0x2a2e35)); m.scale.set(1.2, 0.04, 0.7); m.position.y = 0.03;
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
  } else if (type === 'arena') {
    const k = r - W.arenaStart(r);
    if (k === 0) for (const sx of [-1, 1]) { const m = new T.Mesh(AH.BOX, AH.M(0xe5484d)); m.scale.set(0.5, 3.4, 0.5); m.position.set(sx * (COLS + 0.9), 1.7, 0); row.group.add(m); }
    if (k % 2 === 1) for (const sx of [-1, 1]) { const m = new T.Mesh(pillarGeo(), VM); m.position.set(sx * (COLS + 1.6), 0, 0); m.castShadow = true; row.group.add(m); }
  } else if (type === 'gate') {
    if (!W.arena(W.arenaStart(r)).beaten) {
      for (let x = -COLS; x <= COLS; x++) {
        const m = new T.Mesh(fenceGeo(), VM); m.position.x = x; m.castShadow = true; row.group.add(m);
        row.blockers.set(x, { kind: 'fence', node: m });
      }
    }
  }
  scene.add(row.group);
  return row;
}
function removeRow(row) {
  scene.remove(row.group);
  row.group.traverse(o => { if (o.geometry && !o.userData.shared) { /* geometries are cached or per-object; let GC reclaim */ } });
}

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
W.hitAt = function (row, x, t) {
  if (!row) return null;
  if (row.type === 'road' || row.type === 'roll') {
    for (const o of row.objs) if (o.alive && o.hurts && Math.abs(W.objX(o, t) - x) < o.len / 2 + 0.3) return o;
  } else if (row.type === 'rail' && row.train && row.train.alive) {
    const s = W.trainState(row, t);
    if (s.x !== null && Math.abs(s.x - x) < row.train.len / 2 + 0.3) return row.train;
  }
  return null;
};
W.logAt = function (row, x, t) {
  if (!row || row.type !== 'water') return null;
  for (const o of row.objs) if (Math.abs(W.objX(o, t) - x) < o.len / 2 + 0.25) return o;
  return null;
};
W.padAt = (row, x) => !!(row && row.pads && row.pads.has(Math.round(x)));

/* destruction (applied locally; fx.js broadcasts it) */
W.killObj = function (r, i) {
  W.killed.add(r + ':' + i);
  const row = W.rows.get(r); if (!row) return false;
  const o = i < 0 ? row.train : row.objs[i];
  if (!o || !o.alive) return false;
  o.alive = false; o.mesh.visible = false;
  AH.burst(8, o.x !== undefined ? o.x : 0, 0.6, -r, [0xffd23f, 0xffffff, 0xff7a59], 3, 4);
  return true;
};
W.removeBlocker = function (r, c) {
  W.removed.add(r + ':' + c);
  const row = W.rows.get(r); if (!row) return false;
  const bl = row.blockers.get(c);
  if (!bl || bl.kind === 'fence') return false;
  row.blockers.delete(c); row.group.remove(bl.node);
  row.canopies = row.canopies.filter(cn => cn.x !== c);
  AH.burst(8, c, 0.8, -r, [0x7b4f2a, 0x4cc46f, 0xb7c0c8], 3, 4);
  return true;
};
W.beat = function (A) {
  W.arena(A).beaten = true;
  const row = W.rows.get(A + AH.ARENA_LEN - 1);
  if (row) { row.blockers.forEach(bl => row.group.remove(bl.node)); row.blockers.clear(); }
};

W.update = function (dt, fx, fz) {
  const t = AH.now();
  W.rows.forEach(row => {
    for (const o of row.objs) {
      if (!o.alive) continue;
      o.x = wrapX(o.x0 + o.dir * o.speed * t); o.mesh.position.x = o.x;
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
