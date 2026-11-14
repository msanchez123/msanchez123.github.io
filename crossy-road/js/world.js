/* world.js: endless lane generation (seeded, themed per zone), hazards driven by the shared clock, checkpoint boss arenas.
 * Everything that answers "can I stand here / what hurts me here" lives in W.stand / W.hitAt / W.baseOf so the player, the robot and
 * the fox all ask the same questions. */
(function () {
'use strict';
const AH = window.AH, T = AH.T;
const COLS = AH.COLS, WRAP = AH.WRAP, PER = AH.PER, Builder = AH.Builder, VM = AH.VM, scene = AH.scene;
const rnd = (a, b) => AH.rnd(a, b), ri = (a, b) => AH.ri(a, b), rand = () => AH.rand();
const pick = arr => arr[Math.floor(rand() * arr.length)];
const W = AH.world = { rows: new Map(), gen: -9, run: 'grass', runLeft: 0, queue: [], spec: null, lastChunk: '', pathCol: 0, arenas: {}, killed: new Set(), removed: new Set() };

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
    if (t.style === 'tower') {
      const c = B(), w = 1.3, h = v ? 3.6 : 2.8;
      c.box(w, h, w, a, 0, h / 2, 0);
      for (let y = 0.7, i = 0; y < h - 0.3; y += 0.7, i++) c.box(w + 0.04, 0.22, w + 0.04, i % 2 ? t.c : t.cap, 0, y, 0);
      c.box(w + 0.2, 0.16, w + 0.2, t.trunk, 0, h + 0.08, 0).box(0.4, 0.4, 0.4, 0x7a828f, 0.25, h + 0.36, 0.2).box(0.08, 0.8, 0.08, 0x3a4350, -0.3, h + 0.55, -0.2).box(0.14, 0.14, 0.14, 0xff3b5c, -0.3, h + 1.0, -0.2);
      return { trunk: c.build(), crown: null };
    }
    if (t.style === 'palm') {
      const dk = mixHex(t.trunk, 0x000000, 0.2), tr = B().box(0.4, 0.14, 0.4, dk, 0, 0.07, 0).box(0.3, 0.9, 0.3, t.trunk, 0, 0.55, 0).box(0.26, 0.9, 0.26, dk, 0.05, 1.45, 0).box(0.24, 0.9, 0.24, t.trunk, 0.1, 2.35, 0).build();
      const c = B().box(0.5, 0.3, 0.5, a, 0.1, 3.0, 0).box(0.2, 0.2, 0.2, 0x5b3a1a, 0.3, 2.75, 0.2).box(0.2, 0.2, 0.2, 0x5b3a1a, -0.1, 2.75, -0.2);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(d => {
        const ax = d[0] !== 0;
        c.box(ax ? 1.3 : 0.5, 0.12, ax ? 0.5 : 1.3, a, 0.1 + d[0] * 0.7, 2.95, d[1] * 0.7).box(ax ? 0.7 : 0.45, 0.12, ax ? 0.45 : 0.7, b2, 0.1 + d[0] * 1.45, 2.7, d[1] * 1.45);
      });
      return { trunk: tr, crown: c.build() };
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
/* creature skins for traffic lanes. Head points the way it travels (dir); small fits the car slot (1.5 long), big the truck slot (2.6). */
function buildBeast(style, dir) {
  const b = new Builder(), X = (lu, h, wz, col, x, y, z) => b.box(lu, h, wz, col, dir * x, y, z), Z = [-1, 1];
  if (style === 'wolf') {
    const f = 0x9aa6b5, fl = 0xe4ebf2, dk = 0x4a5565;
    X(0.8, 0.42, 0.46, f, -0.08, 0.55, 0); X(0.5, 0.2, 0.4, fl, -0.05, 0.38, 0); X(0.36, 0.34, 0.38, f, 0.5, 0.68, 0); X(0.2, 0.16, 0.2, fl, 0.72, 0.62, 0); X(0.06, 0.07, 0.07, 0x111111, 0.84, 0.66, 0);
    Z.forEach(z => { X(0.05, 0.07, 0.07, 0xffd23f, 0.6, 0.74, z * 0.14); X(0.1, 0.16, 0.1, dk, 0.42, 0.92, z * 0.13); [-0.3, 0.28].forEach(u => X(0.12, 0.38, 0.12, dk, u, 0.19, z * 0.16)); });
    X(0.34, 0.12, 0.14, f, -0.58, 0.68, 0); X(0.14, 0.12, 0.14, fl, -0.78, 0.76, 0);
  } else if (style === 'mammoth') {
    const f = 0x7d5a48, fd = 0x5a3e30, cr = 0xefe6cf;
    X(1.6, 1.0, 1.0, f, -0.1, 0.95, 0); X(1.5, 0.3, 1.05, fd, -0.1, 0.42, 0); X(0.8, 0.4, 0.8, 0x8d6a56, -0.2, 1.55, 0); X(0.7, 0.85, 0.8, f, 0.85, 1.05, 0); X(0.25, 0.5, 0.28, f, 1.25, 0.75, 0); X(0.22, 0.4, 0.26, f, 1.3, 0.4, 0);
    Z.forEach(z => { X(0.7, 0.1, 0.1, cr, 1.15, 0.6, z * 0.4); X(0.12, 0.4, 0.1, cr, 1.5, 0.8, z * 0.4); X(0.4, 0.6, 0.08, fd, 0.75, 1.15, z * 0.46); X(0.05, 0.06, 0.06, 0x111111, 1.18, 1.2, z * 0.3); [-0.7, 0.5].forEach(u => X(0.35, 0.55, 0.35, fd, u, 0.28, z * 0.33)); });
  } else if (style === 'scarab') {
    const sh = 0x1f7a6a, gold = 0xf2c14e, dk = 0x143a34;
    X(0.9, 0.38, 0.78, sh, -0.05, 0.5, 0); X(0.05, 0.4, 0.8, gold, -0.05, 0.52, 0); X(0.72, 0.14, 0.62, 0x2fb0a0, -0.05, 0.74, 0); X(0.28, 0.24, 0.44, dk, 0.55, 0.4, 0);
    Z.forEach(z => { X(0.2, 0.1, 0.08, dk, 0.75, 0.5, z * 0.12); X(0.05, 0.05, 0.07, 0xff3b3b, 0.7, 0.46, z * 0.16); [-0.3, 0, 0.3].forEach(u => X(0.1, 0.1, 0.34, dk, u, 0.2, z * 0.5)); });
  } else if (style === 'scorpion') {
    const sh = 0xc98a3a, shl = 0xe6ad54, dk = 0x7a4a1e;
    X(1.1, 0.4, 0.8, sh, 0.2, 0.5, 0); X(0.9, 0.25, 0.62, shl, 0.2, 0.78, 0);
    Z.forEach(z => { X(0.5, 0.18, 0.18, sh, 0.95, 0.5, z * 0.45); X(0.35, 0.22, 0.12, dk, 1.25, 0.5, z * 0.55); X(0.35, 0.22, 0.12, dk, 1.25, 0.5, z * 0.35); [-0.2, 0.05, 0.3, 0.55].forEach(u => X(0.1, 0.1, 0.4, dk, u, 0.2, z * 0.5)); });
    X(0.3, 0.3, 0.3, sh, -0.5, 0.6, 0); X(0.28, 0.3, 0.28, sh, -0.75, 0.95, 0); X(0.26, 0.3, 0.26, sh, -0.85, 1.3, 0); X(0.26, 0.26, 0.26, sh, -0.65, 1.55, 0); X(0.2, 0.2, 0.2, 0xffd23f, -0.4, 1.5, 0);
  } else if (style === 'jaguar') {
    const f = 0xe2a43a, dk = 0x2a1a14;
    X(0.9, 0.38, 0.4, f, -0.05, 0.52, 0); for (let i = 0; i < 6; i++) X(0.1, 0.04, 0.1, dk, -0.35 + i * 0.13, 0.73, i % 2 ? 0.1 : -0.1);
    X(0.34, 0.3, 0.34, f, 0.52, 0.62, 0); X(0.14, 0.12, 0.2, 0xf6e3b0, 0.74, 0.56, 0);
    Z.forEach(z => { X(0.05, 0.06, 0.07, 0x2fe0c0, 0.66, 0.68, z * 0.12); X(0.08, 0.12, 0.1, f, 0.42, 0.84, z * 0.12); [-0.35, 0.3].forEach(u => X(0.12, 0.34, 0.12, f, u, 0.17, z * 0.15)); });
    X(0.5, 0.1, 0.1, f, -0.7, 0.55, 0); X(0.14, 0.1, 0.1, dk, -1.0, 0.62, 0);
  } else if (style === 'boar') {
    const f = 0x7a4a2a, dk = 0x3a2414;
    X(1.3, 0.8, 0.8, f, -0.1, 0.75, 0); X(1.0, 0.2, 0.12, 0x2a1a14, -0.1, 1.22, 0); X(0.6, 0.62, 0.66, 0x8a5a38, 0.8, 0.7, 0); X(0.3, 0.3, 0.4, 0xd9a07a, 1.15, 0.62, 0); X(0.2, 0.2, 0.1, f, -0.8, 0.85, 0);
    Z.forEach(z => { X(0.3, 0.1, 0.08, 0xffffff, 1.2, 0.5, z * 0.22); X(0.08, 0.24, 0.08, 0xffffff, 1.32, 0.62, z * 0.22); X(0.1, 0.2, 0.12, dk, 0.65, 1.08, z * 0.25); X(0.05, 0.07, 0.07, 0x111111, 1.08, 0.82, z * 0.2); [-0.6, 0.5].forEach(u => X(0.24, 0.45, 0.24, dk, u, 0.22, z * 0.28)); });
  } else if (style === 'salamander') {
    const dk = 0x2b2630;
    X(0.9, 0.22, 0.46, dk, -0.05, 0.3, 0); for (let i = 0; i < 4; i++) X(0.08, 0.24, 0.48, 0xff6a1a, -0.3 + i * 0.2, 0.31, 0);
    X(0.34, 0.22, 0.4, 0x3a3340, 0.55, 0.3, 0); X(0.15, 0.04, 0.06, 0xff3d00, 0.8, 0.28, 0);
    Z.forEach(z => { X(0.05, 0.05, 0.07, 0xffd23f, 0.64, 0.4, z * 0.14); [-0.3, 0.35].forEach(u => X(0.1, 0.1, 0.3, dk, u, 0.12, z * 0.4)); });
    X(0.5, 0.14, 0.2, dk, -0.7, 0.24, 0); X(0.3, 0.1, 0.12, 0xff6a1a, -1.0, 0.2, 0);
  } else {   // tortoise
    const dk = 0x2b2630;
    X(1.5, 0.7, 1.1, dk, -0.1, 0.7, 0); X(1.1, 0.3, 0.8, 0x3a3340, -0.1, 1.15, 0); X(1.2, 0.06, 0.1, 0xff6a1a, -0.1, 1.32, 0); X(0.1, 0.06, 0.7, 0xff6a1a, -0.1, 1.32, 0); X(0.12, 0.12, 0.12, 0xff6a1a, -0.5, 0.95, 0.56); X(0.12, 0.12, 0.12, 0xff6a1a, 0.3, 0.9, -0.56);
    X(0.45, 0.4, 0.45, 0x4a424c, 0.95, 0.75, 0); X(0.2, 0.2, 0.3, 0x4a424c, -0.9, 0.35, 0);
    Z.forEach(z => { X(0.06, 0.06, 0.07, 0xffd23f, 1.15, 0.82, z * 0.14); [-0.6, 0.5].forEach(u => X(0.4, 0.35, 0.35, 0x4a424c, u, 0.18, z * 0.5)); });
  }
  return b.build();
}
const TAU = Math.PI * 2;
const CAR_COLORS = [0xe5484d, 0x3b82f6, 0xf5c518, 0x9b5de5, 0x2dd4bf, 0xff7a59, 0xf1f5f9];

/* ---- type selection ---- */
const TYPES = [['grass', 0.2, 1, 2, 0], ['road', 0.24, 1, 3, 0], ['water', 0.18, 1, 2, 0], ['rail', 0.08, 1, 2, 12],
  ['lily', 0.1, 1, 3, 6], ['conv', 0.08, 1, 2, 8], ['roll', 0.12, 1, 3, 4]];
/* ---- pre-set structures ("chunks") ----
 * A chunk is a short authored sequence of lanes (a river crossing, a highway with a median, a grove maze...). Every chunk is a builder that rolls its own
 * numbers each time it is placed (lengths, directions, speeds, density, where the gaps are), so no two look alike. A builder returns one spec per lane:
 * { type, dir, spd, n, truck, pad, tp, rock, step }. makeRow reads the spec; unspecified fields keep the normal random behaviour. The path column of
 * grass / lily lanes is still kept connected by makeRow, so every chunk stays passable. Chunks only start where they fit before the next arena. */
const flip = () => rand() < 0.5 ? -1 : 1;
const lanes = (type, n, f) => { const o = []; for (let i = 0; i < n; i++) o.push(Object.assign({ type: type }, f ? f(i) : null)); return o; };
const calm = () => ({ type: 'grass', tp: rnd(0.04, 0.12) });
const CHUNKS = [
  { id: 'river', min: 6, types: ['lily', 'water'], w: 1.2, build() {
    const d = flip(), sp = rnd(0.9, 1.15), a = ri(1, 2), c = ri(2, 3);
    return [].concat(lanes('lily', a, () => ({ pad: rnd(0.3, 0.5) })), lanes('water', c, i => ({ dir: i % 2 ? -d : d, spd: sp * rnd(0.9, 1.15), n: ri(5, 7) })), [calm()]); } },
  { id: 'highway', min: 0, types: ['road'], w: 1.3, build() {
    const d = flip(), n1 = ri(2, 3), n2 = ri(1, 2), base = rnd(0.9, 1.25);
    return [].concat(lanes('road', n1, i => ({ dir: i % 2 ? -d : d, spd: base * (1 + i * 0.15), truck: rnd(0.15, 0.5) })), [{ type: 'grass', tp: rnd(0.1, 0.25) }],
      lanes('road', n2, i => ({ dir: i % 2 ? d : -d, spd: base * 1.25, truck: rnd(0.2, 0.5) })), [calm()]); } },
  { id: 'railyard', min: 12, types: ['rail', 'grass'], w: 0.9, build() {
    return [].concat(lanes('rail', 2, () => ({ dir: flip() })), [{ type: 'grass', tp: rnd(0.15, 0.3) }], lanes('rail', ri(1, 2), () => ({ dir: flip() })), [calm()]); } },
  { id: 'conveyors', min: 8, types: ['conv'], w: 1, build() {
    const d = flip(), n = ri(3, 4), sp = rnd(0.9, 1.3);
    return [].concat(lanes('conv', n, i => ({ dir: i % 2 ? -d : d, spd: sp * rnd(0.85, 1.2) })), [calm()]); } },
  { id: 'maze', min: 0, types: ['grass'], w: 1.1, build() {
    const n = ri(4, 6), tp = rnd(0.4, 0.58); let st = flip();
    return [].concat(lanes('grass', n, () => { if (rand() < 0.35) st = -st; return { tp: tp, rock: rnd(0.2, 0.6), step: rand() < 0.2 ? 0 : st }; }), [calm()]); } },
  { id: 'alley', min: 4, types: ['roll', 'grass'], w: 1, build() {
    const d = flip(), n = ri(3, 4), sp = rnd(0.9, 1.2);
    return [].concat(lanes('roll', n, i => ({ dir: i % 2 ? -d : d, spd: sp * rnd(0.9, 1.15), n: ri(4, 6) })), [calm()]); } },
  { id: 'stones', min: 6, types: ['lily'], w: 0.9, build() {
    const pad = rnd(0.24, 0.36); return [].concat(lanes('lily', ri(4, 5), () => ({ pad: pad })), [calm()]); } },
  { id: 'crossroads', min: 12, types: ['road', 'rail'], w: 0.8, build() {
    const d = flip(); return [].concat(lanes('road', 2, i => ({ dir: i ? d : -d, spd: rnd(1, 1.3) })), lanes('rail', 1, () => ({ dir: flip() })), lanes('road', 2, i => ({ dir: i ? -d : d, spd: rnd(1, 1.3) })), [calm()]); } },
  { id: 'island', min: 6, types: ['water', 'grass'], w: 1, build() {
    const d = flip(), sp = rnd(0.9, 1.2);
    return [].concat(lanes('water', ri(1, 2), i => ({ dir: i ? -d : d, spd: sp, n: ri(5, 7) })), [{ type: 'grass', tp: rnd(0.12, 0.25) }], lanes('water', ri(1, 2), i => ({ dir: i ? d : -d, spd: sp * 1.1, n: ri(5, 7) })), [calm()]); } },
  { id: 'sprint', min: 8, types: ['road', 'roll'], w: 0.8, build() {
    const d = flip(); return [].concat(lanes('roll', 1, () => ({ dir: d, spd: rnd(1.1, 1.4) })), lanes('road', 2, i => ({ dir: i ? d : -d, spd: rnd(1, 1.35), truck: 0.4 })), lanes('roll', 1, () => ({ dir: -d, spd: rnd(1.1, 1.4) })), [calm()]); } }
];
function tryChunk(r) {
  if (rand() > 0.6) return false;
  const mix = AH.themeAt(r).mix, pool = [];
  CHUNKS.forEach(c => { if (c.id === W.lastChunk || r < c.min) return; const k = c.types.reduce((a, t) => a + (mix[t] === undefined ? 1 : mix[t]), 0) / c.types.length; pool.push([c, c.w * k]); });
  const tot = pool.reduce((a, e) => a + e[1], 0); if (!tot) return false;
  let x = rand() * tot, ch = pool[pool.length - 1][0];
  for (const e of pool) { x -= e[1]; if (x <= 0) { ch = e[0]; break; } }
  const specs = ch.build(), room = (Math.floor(r / AH.ARENA_EVERY) + 1) * AH.ARENA_EVERY - 3;
  if (r + specs.length > room) return false;                         // must end before the calm lanes ahead of the next arena
  W.queue = specs; W.lastChunk = ch.id;
  return true;
}
function pickType(r) {
  const A = W.arenaStart(r);
  W.spec = null;
  if (A >= 0) { W.queue = []; W.runLeft = 0; return (r - A === AH.ARENA_LEN - 1) ? 'gate' : 'arena'; }
  if (r <= 2 || r % AH.ARENA_EVERY >= AH.ARENA_EVERY - 2 || r % AH.ARENA_EVERY === AH.ARENA_LEN) return 'grass';
  if (W.queue.length || (W.runLeft <= 0 && tryChunk(r))) { W.spec = W.queue.shift(); W.run = W.spec.type; W.runLeft = 0; return W.spec.type; }
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
    else if (th.id === 'city') b.box(0.6, 0.03, 0.08, c, x, 0.015, z).box(0.08, 0.03, 0.4, c, x + 0.3, 0.015, z)
    else if (th.id === 'volcano') b.box(0.12, 0.05, 0.12, rand() < 0.5 ? 0xff6a1a : 0xffb43a, x, 0.03, z).box(0.3, 0.04, 0.08, 0x2b2630, x + 0.2, 0.02, z - 0.1);
    else b.box(0.07, h, 0.07, c, x, h / 2, z).box(0.07, h * 0.8, 0.07, c, x + 0.09, h * 0.4, z + 0.05).box(0.07, h * 0.65, 0.07, c, x - 0.08, h * 0.33, z - 0.05);
  }
  for (let i = ri(0, 2); i > 0; i--) {
    const x = rnd(-COLS, COLS), z = rnd(-0.35, 0.35);
    if (th.id === 'city') b.box(0.16, 0.05, 0.16, pick(th.bloom), x, 0.025, z);
    else if (th.id === 'volcano') b.box(0.18, 0.1, 0.18, th.bloom[ri(0, 2)], x, 0.05, z);
    else b.box(0.05, 0.22, 0.05, th.id === 'desert' ? 0x2f8f4a : 0x3f9a3a, x, 0.11, z).box(0.16, 0.12, 0.16, pick(th.bloom), x, 0.26, z);
  }
  for (let i = ri(0, 2); i > 0; i--) b.box(0.22, 0.1, 0.18, th.pebble, rnd(-COLS, COLS), 0.05, rnd(-0.35, 0.35));
  if (th.id === 'winter') for (let i = ri(0, 2); i > 0; i--) b.box(0.5, 0.18, 0.4, 0xffffff, rnd(-COLS, COLS), 0.09, rnd(-0.3, 0.3));
  if (th.id === 'desert') for (let i = ri(0, 2); i > 0; i--) b.box(0.6, 0.12, 0.34, th.ground[1], rnd(-COLS, COLS), 0.06, rnd(-0.3, 0.3));
}

/* the arena floor is dressed per environment, so each guardian fights on its own kind of ground */
const ARENA_FLOOR = {
  forest: [0x5c9440, 0x528a39, (b, th, r, k) => {                       // mossy grass, roots, flower tufts and mushroom rings
    for (let i = ri(4, 7); i > 0; i--) b.box(rnd(0.4, 1.2), 0.05, rnd(0.3, 0.7), pick([0x6fae4c, 0x477a30, 0x7ab85a]), rnd(-COLS, COLS), 0.025, rnd(-0.35, 0.35));
    for (let i = ri(1, 3); i > 0; i--) b.box(rnd(1, 2.4), 0.07, 0.12, 0x6b4a2f, rnd(-COLS, COLS), 0.035, rnd(-0.35, 0.35));
    for (let i = ri(2, 5); i > 0; i--) { const x = rnd(-COLS, COLS), z = rnd(-0.35, 0.35); b.box(0.06, 0.16, 0.06, 0x3f7a2a, x, 0.08, z).box(0.14, 0.1, 0.14, pick([0xffd23f, 0xff7aa8, 0xffffff]), x, 0.2, z); }
  }],
  winter: [0xd7ecfa, 0xc3def2, (b, th, r, k) => {                       // frozen lake: glossy blocks, cracks, snow drifts
    b.box(80, 0.04, 0.9, 0xeaf7ff, 0, 0.02, 0);
    for (let i = ri(2, 4); i > 0; i--) b.box(rnd(0.8, 2.2), 0.03, 0.05, 0x7fb6dc, rnd(-COLS, COLS), 0.05, rnd(-0.38, 0.38));
    for (let i = ri(1, 3); i > 0; i--) b.box(rnd(0.5, 1.1), 0.14, rnd(0.3, 0.6), 0xffffff, rnd(-COLS, COLS), 0.07, rnd(-0.3, 0.3));
  }],
  desert: [0xe3c58f, 0xd8b880, (b, th, r, k) => {                       // wind-rippled sand, buried flagstones, bones
    for (let i = ri(4, 7); i > 0; i--) b.box(rnd(1, 3), 0.03, 0.06, 0xc9a56a, rnd(-COLS, COLS), 0.03, rnd(-0.4, 0.4));
    for (let i = ri(1, 3); i > 0; i--) b.box(rnd(0.6, 1.2), 0.06, rnd(0.5, 0.8), 0xb8935a, rnd(-COLS, COLS), 0.03, rnd(-0.3, 0.3));
    if (rand() < 0.4) { const x = rnd(-COLS, COLS); b.box(0.5, 0.08, 0.12, 0xf3ecd8, x, 0.06, 0).box(0.12, 0.1, 0.12, 0xf3ecd8, x + 0.3, 0.07, 0.05); }
  }],
  volcano: [0x2f2830, 0x28222a, (b, th, r, k) => {                      // cracked basalt over glowing lava seams
    for (let i = ri(3, 6); i > 0; i--) b.box(rnd(0.8, 2.4), 0.04, 0.09, pick([0xff5a14, 0xff8a1a, 0xffb43a]), rnd(-COLS, COLS), 0.025, rnd(-0.4, 0.4));
    for (let i = ri(2, 4); i > 0; i--) b.box(rnd(0.3, 0.8), 0.12, rnd(0.3, 0.6), 0x1c171d, rnd(-COLS, COLS), 0.06, rnd(-0.3, 0.3));
    for (let i = ri(1, 3); i > 0; i--) b.box(0.12, 0.05, 0.12, 0xffd23f, rnd(-COLS, COLS), 0.04, rnd(-0.3, 0.3));
  }],
  city: [0x3c414d, 0x353a45, (b, th, r, k) => {                         // asphalt plaza: lane paint, neon strips, manholes, hazard stripes
    for (let x = -COLS; x < COLS; x += 2.2) b.box(1.1, 0.02, 0.1, 0xe6e9f0, x, 0.012, 0.3);
    if (k % 4 === 1) b.box(COLS * 2 + 1, 0.025, 0.07, pick([0xff2fd0, 0x2ff7ff, 0xffe14a]), 0, 0.02, -0.4);
    for (let i = ri(1, 2); i > 0; i--) { const x = rnd(-COLS, COLS); b.box(0.7, 0.03, 0.7, 0x23262e, x, 0.015, 0).box(0.5, 0.04, 0.5, 0x4a505c, x, 0.02, 0); }
    if (k % 3 === 0) for (let x = -COLS; x < COLS; x += 1) b.box(0.5, 0.025, 0.2, x % 2 ? 0xffe14a : 0x1c1f26, x, 0.014, -0.1);
  }],
  temple: [0xb9b28c, 0xaaa27c, (b, th, r, k) => {                       // flagstone tiles with carved glyph rows and creeping moss
    for (let x = -COLS; x <= COLS; x += 1) b.box(0.94, 0.04, 0.94, (x + k) % 2 ? 0xc4bd96 : 0xa39b76, x, 0.02, 0);
    if (k % 3 === 1) for (let i = ri(3, 6); i > 0; i--) b.box(0.2, 0.06, 0.2, 0x7a7556, rnd(-COLS, COLS), 0.05, rnd(-0.3, 0.3));
    for (let i = ri(2, 4); i > 0; i--) b.box(rnd(0.3, 0.9), 0.05, rnd(0.3, 0.6), 0x4f8f3f, rnd(-COLS, COLS), 0.045, rnd(-0.3, 0.3));
  }]
};

/* the exit barrier: one big themed obstacle across the whole gate row. It does not move until the guardian falls, then a hop into it smashes it. */
const barrierGeo = th => geo('barrier' + th.id, () => {
  const b = new Builder(), W2 = COLS * 2 + 1.4, A = th.arena, id = th.id;
  const jag = (n, f) => { for (let i = 0; i < n; i++) f(-W2 / 2 + (i + 0.5) * W2 / n, i); };
  if (id === 'forest') {                                                // a pile of giant fallen trees
    [[0.5, 0.0], [0.5, 0.0], [1.5, 0.35], [2.4, -0.15]].forEach((q, i) => {
      const y = q[0], h = 0.95, c = i % 2 ? 0x6b4a2f : 0x7a5535;
      b.box(W2 - 0.4 * i, h, 0.95, c, 0, y, q[1]).box(W2 - 0.4 * i + 0.1, h * 0.8, 0.5, mixHex(c, 0x000000, 0.2), 0, y, q[1] + 0.45);
      b.box(0.12, h * 0.7, 0.7, 0xd9b27c, -(W2 - 0.4 * i) / 2 - 0.05, y, q[1]).box(0.12, h * 0.7, 0.7, 0xd9b27c, (W2 - 0.4 * i) / 2 + 0.05, y, q[1]);
    });
    jag(7, (x, i) => b.box(0.25, 0.5 + (i % 3) * 0.4, 0.25, 0x5a3b22, x, 3.1 + (i % 3) * 0.2, 0.1 * (i % 2)).box(0.7, 0.35, 0.6, i % 2 ? 0x3f7a2a : 0x4cc46f, x, 3.15 + (i % 3) * 0.3, 0));
  } else if (id === 'winter') {                                         // a wall of ice blocks and crystal spikes
    for (let l = 0; l < 3; l++) jag(l % 2 ? 6 : 7, (x, i) => b.box(W2 / (l % 2 ? 6 : 7) - 0.08, 1.05, 1.0, [0xbfe3f8, 0xdff3ff, 0x9fd2ee][(i + l) % 3], x, 0.55 + l * 1.05, 0));
    jag(8, (x, i) => { const h = 0.9 + (i * 37 % 5) * 0.28; b.box(0.5, h, 0.5, 0xeaf8ff, x, 3.15 + h / 2, 0).box(0.3, h * 0.6, 0.3, 0x7cc8f0, x, 3.15 + h * 0.8, 0); });
  } else if (id === 'desert') {                                         // toppled sandstone colossus and boulders
    for (let l = 0; l < 3; l++) jag(l === 1 ? 5 : 6, (x, i) => b.box(W2 / (l === 1 ? 5 : 6) - 0.06, 1.1, 1.0, [0xe2c58e, 0xd1ad70, 0xc29a58][(i + l) % 3], x, 0.55 + l * 1.1, 0));
    b.box(1.1, 1.6, 1.1, 0xb8935a, -3.5, 4.1, 0).box(0.7, 0.35, 0.8, 0xe2c58e, -3.5, 5.1, 0.05).box(2.4, 0.9, 1.0, 0xd1ad70, 1.8, 3.8, 0).box(0.9, 0.9, 1.0, 0xc2410c, 3.3, 4.6, 0);
  } else if (id === 'volcano') {                                        // obsidian spires with molten seams
    for (let l = 0; l < 2; l++) jag(7, (x, i) => b.box(W2 / 7 - 0.05, 1.3, 1.0, [0x2b2630, 0x1f1a23][(i + l) % 2], x, 0.65 + l * 1.3, 0).box(W2 / 7 - 0.25, 0.1, 1.04, [0xff5a14, 0xffb43a][(i + l) % 2], x, 1.0 + l * 1.3, 0));
    jag(7, (x, i) => { const h = 1.2 + (i * 53 % 6) * 0.35; b.box(0.7, h, 0.7, 0x1a151d, x, 2.6 + h / 2, 0).box(0.34, h * 0.8, 0.74, 0xff5a14, x, 2.6 + h * 0.5, 0); });
  } else if (id === 'city') {                                           // a stack of shipping containers and a wrecked truck
    const cols = [0xe5484d, 0x2f6fd6, 0xf2b01e, 0x2dae6f, 0xb44bd6];
    for (let l = 0; l < 3; l++) jag(l === 1 ? 3 : 4, (x, i) => { const w = W2 / (l === 1 ? 3 : 4) - 0.08; b.box(w, 1.15, 1.05, cols[(i * 2 + l) % 5], x, 0.6 + l * 1.2, 0).box(w - 0.2, 0.08, 1.1, 0x20242c, x, 0.2 + l * 1.2, 0).box(w - 0.2, 0.08, 1.1, 0x20242c, x, 1.0 + l * 1.2, 0); });
    b.box(0.14, 1.8, 0.14, 0x4a505c, -5, 4.45, 0).box(1.6, 0.4, 0.2, 0xff2fd0, -5, 5.2, 0).box(0.14, 1.5, 0.14, 0x4a505c, 4.5, 4.3, 0).box(1.2, 0.35, 0.2, 0x2ff7ff, 4.5, 4.9, 0);
  } else {                                                              // temple: carved stone door flanked by pillars
    b.box(W2, 3.0, 1.0, 0xb5ae8a, 0, 1.5, 0).box(W2 - 1, 0.3, 1.1, 0x8a8560, 0, 3.15, 0);
    jag(5, (x, i) => b.box(1.7, 2.6, 0.2, i % 2 ? 0x9a9170 : 0xa8a07c, x, 1.4, 0.55).box(1.0, 0.7, 0.24, 0xc98a3a, x, 1.7, 0.6).box(0.4, 0.4, 0.28, 0xffd23f, x, 1.7, 0.66));
    jag(4, (x, i) => b.box(0.9, 1.2, 1.0, 0x8a8560, x, 3.9, 0).box(0.5, 0.3, 1.04, 0xffd23f, x, 4.65, 0));
  }
  return b.build();
});

/* arena dressing: a ring of runes on the floor, debris, and posts with banners at the entrance and exit gates. No walls: the invisible wall bounds it. */
function arenaDecor(b, th, r, k, gate) {
  const A = th.arena, SIDES = [-1, 1], FL = ARENA_FLOOR[th.id], alt = (k + r) % 2;
  b.box(80, 0.5, 1, FL ? FL[alt] : (alt ? A.a : A.b), 0, -0.25, 0);
  if (FL) FL[2](b, th, r, k, alt);
  [5.4, 2.7].forEach(R => { const dz = k - 7; if (Math.abs(dz) <= R) { const x = Math.sqrt(R * R - dz * dz), w = Math.abs(dz) > R - 0.6 ? 1.3 : 0.5; for (const s of x < 0.3 ? [1] : SIDES) b.box(w, 0.03, 0.62, A.accent, s * x, 0.015, 0); } });
  if (k === 7) b.box(1.2, 0.04, 1.2, A.accent, 0, 0.02, 0).box(0.5, 0.06, 0.5, A.flame[1], 0, 0.04, 0);
  if (k === 1) b.box(COLS * 2 + 1, 0.03, 0.34, A.flag, 0, 0.015, 0.1);
  for (let i = ri(2, 4); i > 0; i--) b.box(rnd(0.15, 0.4), 0.06, rnd(0.15, 0.3), mixHex(A.a, A.accent, 0.4), rnd(-COLS, COLS), 0.03, rnd(-0.35, 0.35));
  if (th.id === 'volcano') for (let i = ri(1, 3); i > 0; i--) b.box(rnd(0.5, 1.4), 0.03, 0.07, 0xff7a1a, rnd(-COLS, COLS), 0.02, rnd(-0.3, 0.3));
  if (th.id === 'winter') for (let i = ri(1, 3); i > 0; i--) b.box(0.4, 0.06, 0.4, 0xffffff, rnd(-COLS, COLS), 0.03, rnd(-0.3, 0.3));
  if (k === 0 || gate) for (const s of SIDES) {
    const px = s * (COLS + 0.8);
    b.box(0.6, 3.4, 0.6, A.pillar[0], px, 1.7, 0).box(0.8, 0.3, 0.8, A.pillar[1], px, 3.55, 0).box(0.3, 0.3, 0.3, A.flame[1], px, 3.9, 0)
     .box(0.7, 0.5, 0.06, A.flag, px - s * 0.45, 3.1, 0).box(0.7, 0.18, 0.07, A.flame[1], px - s * 0.45, 3.1, 0);
  }
}

function makeRow(r) {
  const th = AH.themeAt(r), type = pickType(r), S = W.spec || {}, b = new Builder();
  const row = { r: r, type: type, objs: [], blockers: new Map(), pads: null, group: new T.Group(), canopies: [], train: null, lamp: null, carry: 0, theme: th.id };
  const d = Math.min(1, Math.max(0, r) / 120);
  const prev = W.pathCol;
  W.pathCol = AH.clamp(prev + (S.step !== undefined ? S.step : ri(-1, 1)), -COLS, COLS);
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
  } else if (type === 'water' || type === 'lily') {
    const rip = mixHex(th.water, 0xffffff, 0.35);
    b.box(80, 0.4, 1, th.water, 0, -0.5, 0);
    for (let i = ri(8, 14); i > 0; i--) b.box(rnd(0.5, 1.4), 0.02, 0.07, th.id === 'volcano' ? 0xffb43a : rip, rnd(-14, 14), -0.29, rnd(-0.4, 0.4));
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
    for (let x = -COLS; x <= COLS; x++) {
      if (x === prev || x === pc) continue;
      const hit = rand() < (r <= 2 ? 0 : S.tp !== undefined ? S.tp : 0.085), rock = rand() < (S.rock !== undefined ? S.rock : 0.25);
      if (hit && !W.removed.has(r + ':' + x)) addObstacle(row, x, rock, true, th);
    }
  } else if (type === 'road') {
    const dir = S.dir || flip(), sp = rnd(2.2, 4.2) * (S.spd || 1) * (1 + 0.5 * d), n = S.n || ri(4, 7), off = rnd(0, PER), tr = S.truck !== undefined ? S.truck : 0.3;
    for (let i = 0; i < n; i++) {
      const truck = rand() < tr, len = truck ? 2.6 : 1.5, x = place(i, n, off, 0.8);
      const bs = AH.BEASTS && AH.BEASTS[th.id], col = CAR_COLORS[ri(0, CAR_COLORS.length - 1)];
      const m = new T.Mesh(bs ? buildBeast(truck ? bs.big : bs.small, dir) : buildCar(len, col, dir, truck), VM); m.castShadow = true;
      addObj(m, { x0: x, x: x, len: len, dir: dir, speed: sp, kind: 'car', hurts: true, carries: false });
    }
  } else if (type === 'roll') {
    const dir = S.dir || flip(), sp = rnd(2.6, 5) * (S.spd || 1) * (1 + 0.4 * d), n = S.n || ri(4, 6), off = rnd(0, PER);
    for (let i = 0; i < n; i++) {
      const s = rnd(0.9, 1.25), m = new T.Mesh(rollGeo(), AH.M(th.roll.ball)); m.scale.set(s, s, s); m.position.y = 0.58 * s; m.castShadow = true;
      addObj(m, { x0: place(i, n, off, 0.8), x: 0, len: 1.1 * s, dir: dir, speed: sp, kind: 'roll', hurts: true, carries: false, spin: s });
    }
  } else if (type === 'water') {
    const dir = S.dir || flip(), sp = rnd(1.1, 2.0) * (S.spd || 1) * (1 + 0.3 * d), n = S.n || ri(5, 7), off = rnd(0, PER);
    for (let i = 0; i < n; i++) {
      const len = rnd(2, 3.4), m = new T.Mesh(buildLog(len, th), VM); m.castShadow = true;
      addObj(m, { x0: place(i, n, off, 0.6), x: 0, len: len, dir: dir, speed: sp, kind: 'log', hurts: false, carries: true });
    }
  } else if (type === 'lily') {
    row.pads = new Map();
    for (let x = -COLS; x <= COLS; x++) {
      if (rand() < (S.pad !== undefined ? S.pad : 0.38) || x === prev || x === pc) {
        const m = new T.Mesh(padGeo(th), VM); m.position.set(x, AH.PADY - 0.04, 0); m.rotation.y = rand() * 3; m.receiveShadow = true;
        row.group.add(m); row.pads.set(x, m);
      }
    }
  } else if (type === 'conv') {
    const dir = S.dir || flip(), sp = rnd(1.3, 2.3) * (S.spd || 1);
    row.carry = dir * sp;
    for (let i = 0; i < 16; i++) {
      const m = new T.Mesh(AH.BOX, AH.M(th.conv.belt)); m.scale.set(1.2, 0.04, 0.7); m.position.y = 0.03;
      addObj(m, { x0: -WRAP + i * PER / 16, x: 0, len: 1.2, dir: dir, speed: sp, kind: 'deco', hurts: false, carries: false });
    }
    row.objs.forEach(o => { o.alive = true; o.mesh.visible = true; });
  } else if (type === 'rail') {
    const dir = S.dir || flip(), len = ri(8, 11), tm = rnd(4.2, 7.5);
    const m = new T.Mesh(buildTrain(len, dir, pick([0x3b82f6, 0xe5484d, 0x2dd4bf, 0x9b5de5])), VM); m.castShadow = true; m.visible = false;
    row.group.add(m);
    const lamp = new T.Mesh(AH.BOX, AH.M(0x552222)); lamp.scale.set(0.3, 0.3, 0.3); lamp.position.set(-COLS - 1.6, 1.7, 0.4);
    row.group.add(lamp); row.lamp = lamp;
    row.train = { mesh: m, dir: dir, len: len, T: tm, warn: 1.3, speed: 30, off: rnd(0, tm), alive: !W.killed.has(r + ':-1'), row: r, idx: -1, kind: 'train' };
  } else if (type === 'gate') {
    if (!W.arena(W.arenaStart(r)).broken) {
      const m = new T.Mesh(barrierGeo(th), VM); m.castShadow = true; row.group.add(m);
      row.barrier = { mesh: m, th: th };
      for (let x = -COLS; x <= COLS; x++) row.blockers.set(x, { kind: 'barrier', node: null });
    }
  }
  scene.add(row.group);
  return row;
}
function removeRow(row) { scene.remove(row.group); }

/* ---- public api ---- */
W.reset = function (seed) {
  W.rows.forEach(removeRow); W.rows.clear();
  W.gen = -9; W.run = 'grass'; W.runLeft = 0; W.queue = []; W.spec = null; W.lastChunk = ''; W.pathCol = 0; W.arenas = {}; W.killed = new Set(); W.removed = new Set();
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
/* the arena's entrance: once the boss is awake it is sealed by an INVISIBLE lock (no wall to look at) until the guardian falls */
W.entrance = function (A, closed) {
  const row = W.rows.get(A);
  if (!row || row.type !== 'arena') return;
  const g = row.gate || (row.gate = { closed: false });
  if (closed === g.closed) return;
  g.closed = closed;
  if (closed) { for (let x = -COLS; x <= COLS; x++) if (!row.blockers.has(x)) row.blockers.set(x, { kind: 'fence', node: null }); }
  else row.blockers.forEach((bl, x) => { if (bl.kind === 'fence') row.blockers.delete(x); });
};
W.beat = function (A) {
  W.arena(A).beaten = true;
  W.entrance(A, false);
};
/* the exit barrier of arena A: only breakable once the guardian is beaten. Returns the gate row's barrier, or null. */
W.barrierAt = function (A) { const row = W.rows.get(A + AH.ARENA_LEN - 1); return row && row.barrier && !W.arena(A).broken ? row : null; };
W.breakBarrier = function (A, silent) {
  const a = W.arena(A); if (a.broken) return false;
  a.broken = true;
  const row = W.rows.get(A + AH.ARENA_LEN - 1);
  if (!row) return true;
  row.blockers.forEach((bl, x) => { if (bl.kind === 'barrier') row.blockers.delete(x); });
  const bar = row.barrier; row.barrier = null;
  if (bar) {
    row.group.remove(bar.mesh);
    if (!silent) {
      const z = -row.r, ar = bar.th.arena, cols = [ar.pillar[0], ar.pillar[1], ar.flame[0], ar.flame[1], bar.th.tree ? bar.th.tree.trunk : 0x7a5535];
      for (let x = -COLS; x <= COLS; x += 1.5) AH.burst(4, x, 0.8 + Math.random() * 1.4, z, cols, 4.5, 6);
      AH.cam.shake = Math.max(AH.cam.shake, 0.7); AH.beep(70, 0.6, 'sawtooth', 0.1, -30);
      if (AH.boss && AH.boss.boom) { AH.boss.th = bar.th; for (let x = -COLS + 2; x <= COLS; x += 5) AH.boss.boom(x, z, 2.6, 0, true); }
    }
  }
  return true;
};

/* what a player who joins mid-round needs to rebuild the same world */
W.snapshot = function () {
  return { k: Array.from(W.killed), rm: Array.from(W.removed), bt: Object.keys(W.arenas).filter(a => W.arenas[a].beaten).map(Number), br: Object.keys(W.arenas).filter(a => W.arenas[a].broken).map(Number) };
};
W.applySnapshot = function (s) {
  if (!s) return;
  (s.bt || []).forEach(A => W.beat(A));
  (s.br || []).forEach(A => W.breakBarrier(A, true));
  (s.rm || []).forEach(id => { const q = id.split(':'); W.removeBlocker(+q[0], +q[1], true); });
  (s.k || []).forEach(id => { const q = id.split(':'); W.killObj(+q[0], +q[1], true); });
};

W.update = function (dt, fx, fz) {
  const t = AH.now();
  W.rows.forEach(row => {
    for (const o of row.objs) {
      if (!o.alive) continue;
      o.x = wrapX(o.x0 + o.dir * o.speed * t); o.mesh.position.x = o.x;
      // a ball rolls clockwise (seen from +z) when it travels towards +x: rotation = -distance / radius, whichever way it goes. Using the travelled
      // distance (not the wrapped position) also keeps it from jumping when it wraps around.
      if (o.spin) o.mesh.rotation.z = (-(o.dir * o.speed * t) / (0.58 * o.spin)) % TAU;
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
