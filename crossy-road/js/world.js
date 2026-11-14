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
W.arenaStart = r => { const o = r - AH.ARENA_EVERY; return (o >= 0 && o % AH.PERIOD < AH.ARENA_LEN) ? r - o % AH.PERIOD : -1; };
W.arena = A => W.arenas[A] || (W.arenas[A] = { beaten: false });
W.firstOpenArena = function () { for (let A = AH.ARENA_EVERY; A < 5000; A += AH.PERIOD) if (!W.arena(A).beaten) return A; return 1e9; };
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
/* a low themed blocker (fallen log, tall grass, snow mound, sandstone slab, basalt, crates, broken column...): variant 0 is chunky, 1 is a clump */
const lowGeo = (th, v) => geo('low' + th.id + v, () => {
  const b = new Builder(), t = th.tree, id = th.id;
  if (id === 'winter') {
    if (!v) b.box(0.95, 0.45, 0.8, 0xffffff, 0, 0.22, 0).box(0.6, 0.3, 0.55, 0xe9f5ff, 0.05, 0.55, 0).box(0.3, 0.2, 0.3, 0xffffff, -0.2, 0.8, 0.05);
    else [[-0.25, 0.9], [0, 1.25], [0.28, 0.8]].forEach(q => b.box(0.28, q[1], 0.28, 0xbfe3f8, q[0], q[1] / 2, 0).box(0.16, q[1] * 0.7, 0.16, 0x7cc8f0, q[0], q[1] * 0.55, 0));
  } else if (id === 'desert') {
    if (!v) b.box(0.95, 0.5, 0.8, 0xd1ad70, 0, 0.25, 0).box(0.55, 0.32, 0.5, 0xe2c58e, 0.1, 0.66, 0).box(0.9, 0.08, 0.84, 0xc29a58, 0, 0.1, 0);
    else { b.box(0.7, 0.6, 0.7, 0xb98f45, 0, 0.35, 0).box(0.5, 0.5, 0.5, 0x8a6a30, 0, 0.55, 0.02).box(0.2, 0.2, 0.2, 0xd9b36a, 0.15, 0.85, 0); }
  } else if (id === 'volcano') {
    if (!v) b.box(0.85, 0.5, 0.75, 0x2b2630, 0, 0.25, 0).box(0.5, 0.36, 0.5, 0x1f1a23, -0.05, 0.68, 0).box(0.12, 0.2, 0.76, 0xff5a14, 0.2, 0.52, 0);
    else b.box(0.9, 0.3, 0.8, 0x3a3340, 0, 0.15, 0).box(0.5, 0.36, 0.5, 0x2b2630, 0, 0.48, 0).box(0.16, 0.1, 0.16, 0xffb43a, 0.05, 0.7, 0);
  } else if (id === 'city') {
    if (!v) b.box(0.85, 0.6, 0.85, 0x9b6b3a, 0, 0.3, 0).box(0.62, 0.5, 0.62, 0xb4854a, 0.04, 0.85, 0).box(0.9, 0.08, 0.14, 0xe5c98a, 0, 0.3, 0.43).box(0.66, 0.08, 0.14, 0xe5c98a, 0.04, 0.85, 0.32);
    else { b.box(1.0, 0.62, 0.42, 0xe6e9f0, 0, 0.31, 0); for (let i = -2; i <= 2; i++) b.box(0.1, 0.5, 0.44, i % 2 ? 0xffe14a : 0x1c1f26, i * 0.2, 0.32, 0); }
  } else if (id === 'temple') {
    if (!v) b.box(0.62, 0.7, 0.62, 0xb5ae8a, 0, 0.35, 0).box(0.5, 0.36, 0.5, 0x9a9170, 0.05, 0.88, 0.03).box(0.66, 0.1, 0.66, 0x8a8560, 0, 0.05, 0);
    else b.box(0.9, 0.55, 0.8, 0x9a9170, 0, 0.28, 0).box(0.7, 0.14, 0.62, 0x4f8f3f, 0, 0.6, 0).box(0.1, 0.5, 0.1, 0x3f7a2a, 0.35, 0.4, 0.4);
  } else {                                               // forest / default: fallen log, or a patch of tall grass and bushes
    if (!v) b.box(1.0, 0.5, 0.5, t.trunk, 0, 0.25, 0).box(0.1, 0.4, 0.4, 0xd9b27c, -0.52, 0.25, 0).box(0.1, 0.4, 0.4, 0xd9b27c, 0.52, 0.25, 0).box(0.7, 0.1, 0.4, t.a[0], 0, 0.55, 0);
    else for (let i = 0; i < 7; i++) { const h = 0.7 + ((i * 37) % 5) * 0.12; b.box(0.14, h, 0.14, i % 2 ? t.a[0] : t.b[0], -0.36 + (i % 4) * 0.24, h / 2, -0.2 + (i % 3) * 0.2); }
  }
  return b.build();
});
W.propGeo = (th, mode, v) => mode === 'rock' ? rockGeo(th, v) : lowGeo(th, v);
const padGeo = th => geo('pad' + th.id, () => { const p = th.pad; return new Builder().box(0.92, 0.1, 0.62, p[0], 0, 0, 0).box(0.62, 0.1, 0.92, p[0], 0, 0, 0).box(0.78, 0.1, 0.78, p[1], 0, 0, 0)
  .box(0.5, 0.05, 0.5, p[2], 0, 0.06, 0).box(0.06, 0.05, 0.34, p[3], 0, 0.09, 0.2).build(); });
const fenceGeo = th => geo('fence' + th.id, () => new Builder().box(0.9, 1.3, 0.3, th.fence[0], 0, 0.65, 0).box(0.96, 0.18, 0.34, th.fence[1], 0, 1.2, 0).box(0.96, 0.18, 0.34, th.fence[1], 0, 0.5, 0).build());
const rollGeo = () => geo('roll', () => new T.IcosahedronGeometry(0.58, 0));

/* ---- vehicles: a dozen different models, each rolled with its own colour, length and details. front = +x * dir. Returns { g, len }. ---- */
const CAR_COLORS = [0xe5484d, 0x3b82f6, 0xf5c518, 0x9b5de5, 0x2dd4bf, 0xff7a59, 0xf1f5f9, 0x2f3640, 0x22a06b, 0xd2d6dc, 0x7a5c3b, 0x1d4ed8, 0xb91c1c];
const CARGO_COLORS = [0xf1f5f9, 0xe5484d, 0x3b82f6, 0xf5c518, 0x22a06b, 0xff7a59, 0xd2d6dc];
const GLASS = 0x8fd0ea, TIRE = 0x1b1d22, DARKM = 0x2a2f36;
const VEH_LIGHT = [['sedan', 3.2], ['hatch', 2.6], ['suv', 2.2], ['pickup', 1.6], ['van', 1.6], ['sports', 1.0], ['taxi', 0.5]];
const VEH_HEAVY = [['boxtruck', 3], ['flatbed', 2], ['bus', 1.4], ['tanker', 1.4]];
function wpick(list, boost) { let t = 0; list.forEach(e => t += e[1] * (boost && boost[e[0]] || 1)); let x = rand() * t; for (const e of list) { x -= e[1] * (boost && boost[e[0]] || 1); if (x <= 0) return e[0]; } return list[0][0]; }
function buildVehicle(th, heavy, dir) {
  const style = wpick(heavy ? VEH_HEAVY : VEH_LIGHT, th.id === 'city' ? { taxi: 5, bus: 2 } : null);
  const b = new Builder(), X = (w, h, d, c, x, y, z) => b.box(w, h, d, c, dir * x, y, z);
  const col = style === 'taxi' ? 0xf5c518 : pick(CAR_COLORS), lite = mixHex(col, 0xffffff, 0.28), dk = mixHex(col, 0x000000, 0.25), snow = th.id === 'winter' && rand() < 0.65;
  const wheels = (L, n) => { for (let k = 0; k < n; k++) { const xw = n === 2 ? (k ? -L * 0.3 : L * 0.3) : L * (0.34 - k * (0.68 / (n - 1))); X(0.3, 0.3, 0.1, TIRE, xw, 0.15, 0.4); X(0.3, 0.3, 0.1, TIRE, xw, 0.15, -0.4); } };
  const lights = L => { X(0.05, 0.09, 0.6, 0xfff1a6, L / 2, 0.36, 0); X(0.05, 0.09, 0.6, 0xd7263d, -L / 2, 0.36, 0); };
  let L;
  if (style === 'sedan' || style === 'taxi') {
    L = rnd(1.6, 1.95);
    X(L, 0.3, 0.78, col, 0, 0.32, 0); X(L * 0.5, 0.26, 0.7, GLASS, -L * 0.05, 0.6, 0); X(L * 0.42, 0.05, 0.72, lite, -L * 0.05, 0.75, 0); X(L * 0.28, 0.02, 0.5, lite, L * 0.3, 0.48, 0);
    if (style === 'taxi') { X(0.3, 0.1, 0.2, 0xfff7d1, -L * 0.05, 0.83, 0); X(L * 0.9, 0.05, 0.8, 0x1c1f26, 0, 0.42, 0); }
    else if (snow) X(L * 0.4, 0.06, 0.7, 0xffffff, -L * 0.05, 0.79, 0);
    lights(L); wheels(L, 2);
  } else if (style === 'hatch') {
    L = rnd(1.35, 1.6);
    X(L, 0.3, 0.78, col, 0, 0.32, 0); X(L * 0.62, 0.3, 0.7, GLASS, -L * 0.1, 0.62, 0); X(L * 0.56, 0.05, 0.72, lite, -L * 0.1, 0.79, 0); X(0.06, 0.2, 0.5, dk, -L / 2, 0.58, 0);
    if (snow) X(L * 0.5, 0.06, 0.7, 0xffffff, -L * 0.1, 0.83, 0);
    lights(L); wheels(L, 2);
  } else if (style === 'suv') {
    L = rnd(1.8, 2.05);
    X(L, 0.4, 0.82, col, 0, 0.38, 0); X(L * 0.64, 0.34, 0.74, GLASS, -L * 0.1, 0.78, 0); X(L * 0.62, 0.05, 0.76, lite, -L * 0.1, 0.97, 0); X(L * 0.5, 0.04, 0.58, DARKM, -L * 0.1, 1.01, 0); X(0.12, 0.3, 0.3, TIRE, -L / 2 - 0.06, 0.5, 0);
    if (snow) X(L * 0.5, 0.06, 0.66, 0xffffff, -L * 0.1, 1.05, 0);
    lights(L); wheels(L, 2);
  } else if (style === 'sports') {
    L = rnd(1.5, 1.75);
    X(L, 0.22, 0.82, col, 0, 0.26, 0); X(L * 0.36, 0.18, 0.68, GLASS, -L * 0.06, 0.46, 0); X(L * 0.3, 0.04, 0.7, lite, -L * 0.06, 0.56, 0); X(L * 0.96, 0.015, 0.14, 0xffffff, 0, 0.378, 0); X(0.16, 0.04, 0.78, DARKM, -L / 2 + 0.05, 0.52, 0);
    lights(L); wheels(L, 2);
  } else if (style === 'pickup') {
    L = rnd(2.0, 2.3);
    X(L, 0.24, 0.8, col, 0, 0.3, 0); X(L * 0.3, 0.28, 0.72, GLASS, L * 0.12, 0.56, 0); X(L * 0.28, 0.05, 0.74, lite, L * 0.12, 0.72, 0);
    X(L * 0.46, 0.16, 0.06, dk, -L * 0.26, 0.5, 0.37); X(L * 0.46, 0.16, 0.06, dk, -L * 0.26, 0.5, -0.37); X(0.06, 0.16, 0.74, dk, -L / 2 + 0.03, 0.5, 0);
    if (rand() < 0.6) X(rnd(0.3, 0.5), rnd(0.2, 0.34), 0.5, pick(CARGO_COLORS), -L * 0.28, 0.56, 0);
    lights(L); wheels(L, 2);
  } else if (style === 'van') {
    L = rnd(1.9, 2.2);
    X(L, 0.52, 0.82, col, 0, 0.46, 0); X(0.08, 0.26, 0.7, GLASS, L / 2 + 0.005, 0.64, 0); X(L * 0.5, 0.16, 0.84, GLASS, L * 0.12, 0.7, 0); X(L, 0.05, 0.84, lite, 0, 0.74, 0); X(L * 0.9, 0.06, 0.84, pick(CARGO_COLORS), 0, 0.34, 0);
    lights(L); wheels(L, 2);
  } else if (style === 'bus') {
    L = rnd(3.2, 3.7);
    X(L, 0.7, 0.84, col, 0, 0.5, 0); X(L * 0.92, 0.22, 0.86, GLASS, 0, 0.68, 0); X(0.06, 0.3, 0.76, GLASS, L / 2 + 0.005, 0.6, 0); X(L * 0.98, 0.05, 0.8, lite, 0, 0.87, 0); X(0.7, 0.1, 0.5, 0xcfd6df, -L * 0.15, 0.95, 0); X(L, 0.08, 0.86, 0xffffff, 0, 0.34, 0);
    lights(L); wheels(L, 3);
  } else {                                                                      // boxtruck, flatbed, tanker: a cab pulling something
    L = rnd(2.7, 3.3);
    const cab = pick(CAR_COLORS), cx = L / 2 - 0.48;
    X(0.95, 0.62, 0.84, cab, cx, 0.46, 0); X(0.08, 0.26, 0.7, GLASS, L / 2 - 0.0, 0.62, 0); X(0.9, 0.05, 0.86, mixHex(cab, 0xffffff, 0.3), cx, 0.8, 0); X(L * 0.96, 0.14, 0.7, DARKM, 0, 0.2, 0);
    if (style === 'boxtruck') { const cg = pick(CARGO_COLORS); X(L - 1.1, 0.85, 0.88, cg, -0.55, 0.64, 0); X(L - 1.2, 0.2, 0.9, mixHex(cg, 0x000000, 0.22), -0.55, 0.62, 0); }
    else if (style === 'flatbed') { X(L - 1.05, 0.08, 0.86, 0x8a6a45, -0.52, 0.34, 0); for (let k = 0, n = ri(2, 3); k < n; k++) X(rnd(0.45, 0.7), rnd(0.3, 0.5), 0.6, pick(CARGO_COLORS), -0.2 - k * 0.7 + rnd(-0.05, 0.05), 0.6, 0); }
    else { X(L - 1.1, 0.62, 0.78, 0xcfd6df, -0.55, 0.66, 0); X(0.08, 0.64, 0.8, 0x555a63, -0.2, 0.66, 0); X(0.08, 0.64, 0.8, 0x555a63, -1.0, 0.66, 0); X(0.4, 0.08, 0.3, 0xe5484d, -0.6, 1.03, 0); }
    X(0.05, 0.09, 0.6, 0xfff1a6, L / 2 + 0.03, 0.34, 0); X(0.05, 0.09, 0.6, 0xd7263d, -L / 2, 0.3, 0); wheels(L, 3);
  }
  return { g: b.build(), len: L };
}
/* a natural log: lumpy rounded trunk of several differently thick segments, bark strips, end rings, knots, a branch stub and a themed finish */
/* directional current: flat streak quads in one cached geometry; the row slides it along the flow and wraps it every PERIOD so it never ends */
const FLOWP = 12;
function flowGeo(th, variant) {
  return geo('flow' + th.id + variant, () => {
    const lava = th.id === 'volcano', c1 = lava ? 0xffb43a : mixHex(th.water, 0xffffff, 0.45), c2 = lava ? 0xff7a1a : mixHex(th.water, 0xffffff, 0.22);
    const P = [], N = [], C = [], I = [], col = new T.Color(), y = -0.27;
    let q = 0;
    const quad = (x0, x1, z0, z1, hex) => {
      col.setHex(hex);
      [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].forEach(p => { P.push(p[0], y, p[1]); N.push(0, 1, 0); C.push(col.r, col.g, col.b); });
      I.push(q, q + 2, q + 1, q, q + 3, q + 2); q += 4;
    };
    const lr = AH.seeded('flow' + th.id + variant), R = (a, b) => a + lr() * (b - a);
    for (let k = -3; k <= 3; k++) for (let i = 0; i < 5; i++) {
      const x = k * FLOWP + (i + R(0, 0.9)) * FLOWP / 5 - 3, len = R(0.7, 2.4), z = R(-0.38, 0.38), wd = R(0.03, 0.07);
      quad(x, x + len, z - wd, z + wd, i % 2 ? c1 : c2);
      if (lr() < 0.5) quad(x + len * 0.6, x + len * 0.6 + 0.5, z + 0.12, z + 0.12 + wd * 0.8, c1);        // short side ripple, gives the streaks a wavy feel
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
    g.setIndex(I); return g;
  });
}
function addFlow(row, th, dir, sp) {
  const m = new T.Mesh(flowGeo(th, ri(0, 2)), VM); row.group.add(m);
  row.flow = { m: m, v: dir * sp * 0.9, off: rnd(0, FLOWP) };
}
function buildLog(len, th) {
  const l = th.log, id = th.id, b = new Builder(), w0 = rnd(0.55, 0.92), h0 = rnd(0.3, 0.36), dark = mixHex(l[0], 0x000000, 0.28), bark = mixHex(l[0], 0x000000, 0.1);
  const nseg = Math.max(2, Math.round(len / 1.1)), sl = len / nseg;
  for (let i = 0; i < nseg; i++) {
    const x = -len / 2 + sl * (i + 0.5), k = rnd(0.88, 1.08), w = w0 * k, h = h0 * (0.94 + 0.12 * k), c = i % 2 ? l[0] : bark;
    b.box(sl + 0.02, h, w * 0.74, c, x, 0, 0).box(sl + 0.01, h * 0.74, w, c, x, 0, 0);
  }
  b.box(len * rnd(0.5, 0.85), 0.03, w0 * 0.16, dark, rnd(-0.2, 0.2), h0 / 2 + 0.005, rnd(-w0 * 0.25, w0 * 0.25));                                          // bark strip
  for (const e of [-1, 1]) b.box(0.07, h0 * 0.8, w0 * 0.62, l[2], e * (len / 2 + 0.01), 0, 0);                                                                // pale end rings
  b.box(0.15, 0.06, 0.15, dark, rnd(-len * 0.35, len * 0.35), h0 / 2 + 0.01, rnd(-w0 * 0.2, w0 * 0.2));                                                      // knot
  if (rand() < 0.45) { const sd = rand() < 0.5 ? -1 : 1; b.box(0.22, 0.14, 0.26, bark, rnd(-len * 0.3, len * 0.3), 0.04, sd * (w0 / 2 + 0.1)); }              // branch stub
  if (id === 'winter') b.box(len * rnd(0.4, 0.8), 0.07, w0 * 0.5, 0xffffff, rnd(-0.2, 0.2), h0 / 2 + 0.03, 0);
  else if (id === 'volcano') b.box(rnd(0.4, 0.9), 0.035, 0.05, rand() < 0.5 ? 0xff5a14 : 0xffb43a, rnd(-len * 0.4, len * 0.4), h0 / 2 + 0.012, rnd(-w0 * 0.25, w0 * 0.25));
  else if (id === 'forest' || id === 'temple') b.box(rnd(0.3, 0.7), 0.05, w0 * rnd(0.3, 0.6), 0x4f8f3f, rnd(-len * 0.4, len * 0.4), h0 / 2 + 0.02, rnd(-0.1, 0.1));
  else if (id === 'city') b.box(0.1, h0 * 1.02, w0 * 1.02, 0xffe14a, rnd(-len * 0.35, len * 0.35), 0, 0);
  return b.build();
}
function buildTrain(len, dir, col) {
  return new Builder().box(len, 1.0, 0.9, col, 0, 0.8, 0).box(len * 0.98, 0.1, 1, 0x2b2f36, 0, 1.35, 0).box(len * 0.9, 0.3, 0.92, 0xdff3fb, 0, 1.0, 0)
    .box(1.2, 0.9, 0.86, 0xffd23f, dir * (len / 2 - 0.6), 0.75, 0).box(len * 0.95, 0.3, 1, 0x222831, 0, 0.25, 0)
    .box(0.1, 0.2, 0.2, 0xfff1a6, dir * len / 2, 0.7, 0.25).box(0.1, 0.2, 0.2, 0xfff1a6, dir * len / 2, 0.7, -0.25).build();
}
/* creature skins for traffic lanes. Head points the way it travels (dir); small fits the car slot (1.5 long), big the truck slot (2.6). */
W.beastGeo = style => geo('beast' + style, () => buildBeast(style, 1));
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

/* ---- type selection ---- */
const TYPES = [['grass', 0.24, 1, 2, 0], ['road', 0.26, 1, 3, 0], ['water', 0.2, 1, 2, 0], ['rail', 0.08, 1, 2, 12], ['lily', 0.1, 1, 3, 6]];
/* ---- pre-set structures ("chunks") ----
 * A chunk is a short authored sequence of lanes (a river crossing, a highway with a median, a grove maze...). Every chunk is a builder that rolls its own
 * numbers each time it is placed (lengths, directions, speeds, density, where the gaps are), so no two look alike. A builder returns one spec per lane:
 * { type, dir, spd, n, truck, pad, tp, rock, step }. makeRow reads the spec; unspecified fields keep the normal random behaviour. The path column of
 * grass / lily lanes is still kept connected by makeRow, so every chunk stays passable. Chunks only start where they fit before the next arena. */
const flip = () => rand() < 0.5 ? -1 : 1;
const lanes = (type, n, f) => { const o = []; for (let i = 0; i < n; i++) o.push(Object.assign({ type: type }, f ? f(i) : null)); return o; };
const calm = () => ({ type: 'grass', tp: rnd(0.04, 0.12) });
const isWildTheme = th => !!(AH.BEASTS && AH.BEASTS[th.id]);
/* wildlands: a vast stretch of open ground where creatures roam (see wild.js). Replaces the creature roads of the beast zones. */
const WILD = { id: 'wildlands', min: 0, types: ['grass'], w: 3, build() { const tp = rnd(0.06, 0.12); return [].concat(lanes('grass', ri(6, 10), () => ({ wild: true, tp: tp, bg: 'dense' })), [calm()]); } };
const CHUNKS = [
  { id: 'river', min: 6, types: ['lily', 'water'], w: 1.2, build() {
    const d = flip(), sp = rnd(0.9, 1.15), a = ri(1, 2), c = ri(2, 3);
    return [].concat(lanes('lily', a, () => ({ pad: rnd(0.3, 0.5), bg: 'cliffs' })), lanes('water', c, i => ({ dir: i % 2 ? -d : d, spd: sp * rnd(0.9, 1.15), n: ri(5, 7), bg: 'cliffs' })), [calm()]); } },
  { id: 'highway', min: 0, types: ['road'], w: 1.3, build() {
    const d = flip(), n1 = ri(2, 3), n2 = ri(1, 2), base = rnd(0.9, 1.25);
    return [].concat(lanes('road', n1, i => ({ dir: i % 2 ? -d : d, spd: base * (1 + i * 0.15), truck: rnd(0.15, 0.5) })), [{ type: 'grass', tp: rnd(0.1, 0.25) }],
      lanes('road', n2, i => ({ dir: i % 2 ? d : -d, spd: base * 1.25, truck: rnd(0.2, 0.5) })), [calm()]); } },
  { id: 'railyard', min: 12, types: ['rail', 'grass'], w: 0.9, build() {
    return [].concat(lanes('rail', 2, () => ({ dir: flip() })), [{ type: 'grass', tp: rnd(0.15, 0.3) }], lanes('rail', ri(1, 2), () => ({ dir: flip() })), [calm()]); } },
  { id: 'maze', min: 0, types: ['grass'], w: 1.1, build() {
    const n = ri(4, 6), tp = rnd(0.2, 0.3); let st = flip();
    return [].concat(lanes('grass', n, () => { if (rand() < 0.35) st = -st; return { tp: tp, rock: rnd(0.2, 0.6), step: rand() < 0.2 ? 0 : st, bg: 'dense' }; }), [calm()]); } },
  { id: 'boulders', min: 4, types: ['roll', 'grass'], w: 0.9, build() {
    const d = flip(), n = ri(3, 5), sp = rnd(0.9, 1.2);
    return [].concat(lanes('roll', n, i => ({ dir: i % 2 ? -d : d, spd: sp * rnd(0.9, 1.15), n: ri(4, 6) })), [calm()]); } },
  { id: 'stones', min: 6, types: ['lily'], w: 0.9, build() {
    const pad = rnd(0.24, 0.36); return [].concat(lanes('lily', ri(4, 5), () => ({ pad: pad, bg: 'cliffs' })), [calm()]); } },
  { id: 'crossroads', min: 12, types: ['road', 'rail'], w: 0.8, build() {
    const d = flip(); return [].concat(lanes('road', 2, i => ({ dir: i ? d : -d, spd: rnd(1, 1.3) })), lanes('rail', 1, () => ({ dir: flip() })), lanes('road', 2, i => ({ dir: i ? -d : d, spd: rnd(1, 1.3) })), [calm()]); } },
  { id: 'island', min: 6, types: ['water', 'grass'], w: 1, build() {
    const d = flip(), sp = rnd(0.9, 1.2);
    return [].concat(lanes('water', ri(1, 2), i => ({ dir: i ? -d : d, spd: sp, n: ri(5, 7) })), [{ type: 'grass', tp: rnd(0.12, 0.25) }], lanes('water', ri(1, 2), i => ({ dir: i ? d : -d, spd: sp * 1.1, n: ri(5, 7) })), [calm()]); } }
];
function tryChunk(r) {
  if (rand() > 0.68) return false;
  const mix = AH.themeAt(r).mix, pool = [];
  const th0 = AH.themeAt(r), wildT = isWildTheme(th0);
  CHUNKS.concat(wildT ? [WILD] : []).forEach(c => { if (c.id === W.lastChunk || r < c.min || (wildT && c.types.indexOf('road') >= 0)) return; const k = c.types.reduce((a, t) => a + (mix[t] === undefined ? 1 : mix[t]), 0) / c.types.length; pool.push([c, c.w * k]); });
  const tot = pool.reduce((a, e) => a + e[1], 0); if (!tot) return false;
  let x = rand() * tot, ch = pool[pool.length - 1][0];
  for (const e of pool) { x -= e[1]; if (x <= 0) { ch = e[0]; break; } }
  const specs = ch.build(), room = AH.nextArena(r) - 3;
  if (r + specs.length > room) return false;                         // must end before the calm lanes ahead of the next arena
  W.queue = specs; W.lastChunk = ch.id;
  return true;
}
const CHUNK_ONLY = { rail: 1 };          // these only ever appear inside authored structures; scattered randomly they look odd
function pickType(r) {
  const A = W.arenaStart(r);
  W.spec = null;
  if (A >= 0) { W.queue = []; W.runLeft = 0; return (r - A === AH.ARENA_LEN - 1) ? 'gate' : 'arena'; }
  if (r <= 2 || AH.nextArena(r) - r <= 2 || (r > AH.ARENA_EVERY && (r - AH.ARENA_EVERY) % AH.PERIOD === AH.ARENA_LEN)) return 'grass';
  if (W.queue.length || (W.runLeft <= 0 && tryChunk(r))) { W.spec = W.queue.shift(); W.run = W.spec.type; W.runLeft = 0; return W.spec.type; }
  if (W.runLeft <= 0) {
    const mix = AH.themeAt(r).mix;
    const avail = TYPES.filter(e => r >= e[4] && !CHUNK_ONLY[e[0]]).map(e => [e[0], e[1] * (mix[e[0]] || 1), e[2], e[3]]);
    const tot = avail.reduce((s, e) => s + e[1], 0);
    let e;
    do { let x = rand() * tot, acc = 0; for (let i = 0; i < avail.length; i++) { acc += avail[i][1]; if (x < acc || i === avail.length - 1) { e = avail[i]; break; } } } while (e[0] === W.run);
    if (e[0] === 'road' && isWildTheme(AH.themeAt(r))) {            // creatures never ride along roads: those lanes become a wildland instead
      const sp = WILD.build();
      if (r + sp.length <= AH.nextArena(r) - 3) { W.queue = sp; W.lastChunk = 'wildlands'; W.spec = W.queue.shift(); W.run = 'grass'; W.runLeft = 0; return 'grass'; }
      e = avail.find(q => q[0] === 'grass') || e; if (e[0] === 'road') e = ['grass', 1, 1, 2];
    }
    W.run = e[0]; W.runLeft = ri(e[2], e[3]);
  }
  W.runLeft--;
  return W.run;
}

/* ---- background: everything beyond the playable lanes is decoration, with a few blocks of height difference up and down ---- */
const hash3 = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 1597334677) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const HILL = [0, 0, 0.5, 0.5, 1, 1, 1.5, 2];
const BG0 = COLS + 2.6, SEG = 4.2, NSEG = 3;
function sideH(r, side, seg, type) {
  let h = HILL[Math.floor(hash3(r >> 1, side * 9 + seg, 17) * HILL.length)];
  if (type === 'arena') h = Math.max(h, 1);
  if (type === 'gate') h = 2.5 + Math.round(hash3(r, side * 9 + seg, 5) * 3) / 2;
  return h;
}
/* triangular hills (prisms) on both sides of the lane strip. Height rows share plateaus of two lanes so neighbouring ridges line up into mountain ranges. */
const hillW = SEG * 1.6, hillCx = (side, i) => side * (BG0 - 0.3 + hillW / 2 + i * SEG);
const hillPeak = (r, side, i, type, S) => { const h = sideH(r, side, i, type); return h <= 0 ? 0 : h * (S && S.bg === 'cliffs' ? 2 : 1.3); };
function hillY(r, side, x, type, S) { let y = 0; for (let i = 0; i < NSEG; i++) { const h = hillPeak(r, side, i, type, S); if (h > 0) y = Math.max(y, h * (1 - Math.abs(x - hillCx(side, i)) / (hillW / 2))); } return y; }
function groundBase(b, th, r, type, col, hillCol, hillsOnly, S) {
  const base = hillsOnly ? th.ground[r & 1] : (hillCol || col);
  if (!hillsOnly) b.box(80, 0.5, 1, col, 0, -0.25, 0);
  const cl = S && S.bg === 'cliffs';
  for (const side of [-1, 1]) for (let i = 0; i < NSEG; i++) {
    const h = hillPeak(r, side, i, type, S); if (h <= 0) continue;
    b.prism(hillW, h, 1, mixHex(base, th.rock[2], Math.min(0.7, 0.16 + h * 0.1 + (cl ? 0.3 : 0))), hillCx(side, i), 0, 0);
  }
}
/* the edge of a road, rail or boulder lane: a rock mountain with a tunnel mouth where the traffic goes in and out, and (roads) guard rails leading up to it */
function tunnelSides(b, th, r, type) {
  const stone = th.rock[1], rock = mixHex(th.ground[r & 1], th.rock[2], 0.55), openH = type === 'road' ? 1.3 : 1.7;
  for (const s of [-1, 1]) {
    const H = 3.6 + hash3(r, s * 3, 9) * 1.8, H2 = 1.2 + hash3(r, s * 5, 11) * 2.4;
    b.box(2.4, openH + 1.0, 1, rock, s * (BG0 + 0.1 + 1.25), (openH + 1.0) / 2, 0);                           // the cliff face the mouth is cut into
    b.box(1.2, openH, 0.84, 0x14161b, s * (BG0 + 0.05 + 0.6), openH / 2, 0);                                  // the dark mouth, flush with where the clip plane ends
    b.box(1.35, 0.3, 0.98, stone, s * (BG0 + 0.03 + 0.67), openH + 0.15, 0);                                  // lintel
    b.prism(9.2, H, 1, mixHex(rock, th.rock[2], 0.15), s * (BG0 + 0.1 + 4.6), 0, 0);                          // the mountain behind
    b.prism(10, H2, 1, mixHex(rock, th.ground[r & 1], 0.3), s * (BG0 + 0.1 + 13.5), 0, 0);
    if (type === 'road') for (const z of [-0.46, 0.46]) b.box(1.9, 0.08, 0.05, 0xcfd6df, s * (BG0 - 1.0), 0.34, z).box(0.07, 0.4, 0.07, 0x7a828c, s * (BG0 - 0.1), 0.2, z);
  }
}
/* scenery props in the unreachable background. A cheap few boxes each, varied in height, themed per environment. */
function bgProp(b, th, x, y, z, big) {
  const t = th.tree, id = th.id, h = rnd(1.6, 4.8) * (big ? 1.4 : 1), w = rnd(0.9, 1.7);
  if (id === 'winter') { b.box(0.34, h * 0.35, 0.34, t.trunk, x, y + h * 0.17, z); [[1, 0.3], [0.75, 0.55], [0.5, 0.78]].forEach((q, i) => b.box(w * q[0] * 1.5, h * 0.26, w * q[0] * 1.5, i % 2 ? t.b[0] : t.a[0], x, y + h * q[1] + 0.3, z).box(w * q[0] * 1.2, 0.1, w * q[0] * 1.2, t.cap, x, y + h * q[1] + 0.3 + h * 0.13, z)); }
  else if (id === 'desert') { if (rand() < 0.5) b.box(0.5, h, 0.5, t.a[0], x, y + h / 2, z).box(0.5, 0.3, 0.3, t.a[0], x + 0.4, y + h * 0.5, z).box(0.3, h * 0.4, 0.3, t.a[0], x + 0.6, y + h * 0.65, z); else b.box(w * 1.6, h * 0.5, w * 1.3, th.rock[0], x, y + h * 0.25, z).box(w, h * 0.35, w * 0.8, th.rock[1], x + 0.1, y + h * 0.6, z); }
  else if (id === 'volcano') { b.box(w, h, w, 0x2b2630, x, y + h / 2, z).box(w * 0.55, h * 0.6, w * 0.55, 0x1f1a23, x, y + h * 1.25, z).box(0.14, h * 0.8, w * 1.02, 0xff5a14, x, y + h * 0.5, z); }
  else if (id === 'city') { const bw = rnd(1.3, 2.3), bh = h * 1.7; b.box(bw, bh, bw, pick([0x4a5568, 0x5b6b8a, 0x3b4454, 0x6b7280]), x, y + bh / 2, z); for (let k = 1; k < bh / 1.5; k++) b.box(bw + 0.04, 0.14, bw + 0.04, pick([0xffe14a, 0x38e1ff, 0xff2fd0, 0x2a3140]), x, y + k * 1.5, z); b.box(bw * 0.5, 0.35, bw * 0.5, 0x2a3140, x, y + bh + 0.17, z); }
  else if (id === 'temple') { if (rand() < 0.5) b.box(0.8, h * 0.8, 0.8, 0xb5ae8a, x, y + h * 0.4, z).box(1.1, 0.25, 1.1, 0x9a9170, x, y + h * 0.82, z).box(0.14, h * 0.7, 0.84, 0x4f8f3f, x + 0.3, y + h * 0.35, z); else b.box(w * 2, 0.5, w * 2, 0x9a9170, x, y + 0.25, z).box(w * 1.5, 0.5, w * 1.5, 0xb5ae8a, x, y + 0.75, z).box(w, 0.5, w, 0xc4bd96, x, y + 1.25, z); }
  else { b.box(0.4, h * 0.45, 0.4, t.trunk, x, y + h * 0.22, z).box(w * 1.9, h * 0.34, w * 1.9, t.a[0], x, y + h * 0.55, z).box(w * 1.3, h * 0.3, w * 1.3, t.b[0], x, y + h * 0.82, z).box(w * 0.7, h * 0.2, w * 0.7, t.c, x, y + h * 1.0, z); }
}
function bgDecor(b, th, r, type, S) {
  if (type === 'road' || type === 'rail' || type === 'roll') return;           // those edges are mountains with tunnels (tunnelSides)
  const dense = S && S.bg === 'dense';
  for (const side of [-1, 1]) for (let i = 0, n = dense ? 2 : rand() < (type === 'arena' || type === 'gate' ? 0.8 : 0.55) ? 1 : 0; i < n; i++) {
    const x = side * (BG0 + rnd(0.8, SEG * NSEG - 1));
    bgProp(b, th, x, hillY(r, side, x, type, S), rnd(-0.3, 0.3), dense || rand() < 0.25);
  }
}

/* ---- row construction ---- */
function addObstacle(row, x, mode, solid, th) {
  const g = new T.Group(), rock = mode !== 'tree';
  if (mode === 'low') {
    const m = new T.Mesh(lowGeo(th, rand() < 0.5 ? 0 : 1), VM); m.castShadow = true; g.add(m);
    const s = rnd(0.95, 1.25); g.scale.set(s * rnd(0.9, 1.1), s * rnd(1, 1.6), s * rnd(0.9, 1.1));
  } else if (rock) {
    const m = new T.Mesh(rockGeo(th, rand() < 0.5 ? 0 : 1), VM); m.castShadow = true; g.add(m);
    const s = rnd(0.9, 1.25); g.scale.set(s, s * rnd(1, 1.7), s);
  } else {
    const parts = treeParts(th, rand() < 0.5 ? 0 : 1);
    const trunk = new T.Mesh(parts.trunk, VM); trunk.castShadow = true; g.add(trunk);
    if (parts.crown) { const can = new T.Mesh(parts.crown, VM); can.castShadow = true; g.add(can); row.canopies.push({ mesh: can, x: x }); }
    const s = rnd(0.9, 1.25), tall = rand() < 0.3 ? rnd(1.35, 1.95) : rnd(1.0, 1.4);   // never stunted, sometimes towering
    g.scale.set(s, s * tall, s);
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
  const b = new Builder(), W2 = (COLS + 2.6) * 2, A = th.arena, id = th.id;
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
  const A = th.arena, SIDES = [-1, 1], FL = ARENA_FLOOR[th.id], alt = (k + r) % 2, slab = b;
  groundBase(b, th, r, gate ? 'gate' : 'arena', FL ? FL[alt] : (alt ? A.a : A.b), A.pillar[1]);
  /* every low floor decal (runes, tiles, cracks, drifts...) is lifted by its own tiny step, so two of them never share a top plane and flicker (z-fighting) */
  let lv = 0;
  const fb = { box(w, h, d, c, x, y, z) { const bump = h <= 0.2 ? (++lv % 17) * 0.004 : 0; slab.box(w, h + bump, d, c, x, y + bump / 2, z); return fb; } };
  b = fb;
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
    groundBase(b, th, r, 'grass', th.ground[r & 1], null, false, S);
    groundDetails(b, th);
  } else if (type === 'road') {
    b.box(80, 0.5, 1, th.road, 0, -0.25, 0);
    const before = W.rows.get(r - 1);
    if (before && before.type === 'road') for (let x = -BG0; x < BG0; x += 2.4) b.box(1.2, 0.02, 0.14, th.marking, x, 0.01, 0.5);
    for (let i = ri(0, 2); i > 0; i--) {                                       // potholes (a pale broken rim, a dark hole) and a crack or two
      const x = rnd(-BG0 + 1, BG0 - 1), z = rnd(-0.18, 0.18), pw = rnd(0.45, 0.8), pd = rnd(0.3, 0.5);
      b.box(pw * 1.35, 0.012, pd * 1.4, mixHex(th.road, 0x000000, 0.18), x, 0.006, z).box(pw, 0.02, pd, 0x0d0e11, x + rnd(-0.05, 0.05), 0.011, z);
    }
    for (let i = ri(0, 2); i > 0; i--) b.box(rnd(0.7, 1.6), 0.014, 0.03, mixHex(th.road, 0x000000, 0.35), rnd(-BG0 + 1, BG0 - 1), 0.008, rnd(-0.3, 0.3));
  } else if (type === 'water' || type === 'lily') {
    b.box(80, 0.4, 1, th.water, 0, -0.5, 0);
    for (const sd of [-1, 1]) b.box(40 - BG0, 0.55, 1, th.ground[r & 1], sd * (BG0 + (40 - BG0) / 2), -0.275, 0);      // solid banks: logs vanish into them
  } else if (type === 'rail') {
    b.box(80, 0.4, 1, th.bed, 0, -0.2, 0);
    for (let x = -BG0; x < BG0; x += 0.8) b.box(0.22, 0.08, 0.9, th.tie, x, 0.04, 0);
    b.box(80, 0.1, 0.08, th.steel, 0, 0.12, 0.28).box(80, 0.1, 0.08, th.steel, 0, 0.12, -0.28);
    b.box(0.14, 1.6, 0.14, 0x4a525c, -COLS - 1.6, 0.8, 0.4);
  } else if (type === 'roll') {
    b.box(80, 0.5, 1, th.roll.ground, 0, -0.25, 0);
    for (let i = 0; i < 10; i++) b.box(0.24, 0.1, 0.2, th.roll.speck, rnd(-COLS - 3, COLS + 3), 0.05, rnd(-0.35, 0.35));
  } else if (type === 'arena' || type === 'gate') {
    arenaDecor(b, th, r, r - W.arenaStart(r), type === 'gate');
  }
  if (type === 'road' || type === 'rail' || type === 'roll') tunnelSides(b, th, r, type);
  else if (type === 'water' || type === 'lily') groundBase(b, th, r, type, 0, null, true, S);
  bgDecor(b, th, r, type, S);
  const mesh = new T.Mesh(b.build(), VM);
  mesh.castShadow = false; mesh.receiveShadow = true;
  row.group.add(mesh);
  row.group.position.z = -r;

  if (type === 'grass') {
    for (let x = -COLS; x <= COLS; x++) {
      if (x === prev || Math.abs(x - pc) <= 1) continue;               // a three-wide corridor always stays open
      const hit = rand() < (r <= 2 ? 0 : S.tp !== undefined ? S.tp : 0.11), u = rand(), rp = S.rock !== undefined ? S.rock : 0.2;
      const mode = u < rp ? 'rock' : rand() < 0.4 ? 'low' : 'tree';
      if (hit && !W.removed.has(r + ':' + x)) addObstacle(row, x, mode, true, th);
    }
  } else if (type === 'road') {
    const dir = S.dir || flip(), sp = rnd(2.2, 4.2) * (S.spd || 1) * (1 + 0.5 * d), n = S.n || ri(4, 7), off = rnd(0, PER), tr = S.truck !== undefined ? S.truck : 0.3;
    for (let i = 0; i < n; i++) {
      const v = buildVehicle(th, rand() < tr, dir), x = place(i, n, off, 0.8);
      const m = new T.Mesh(v.g, AH.VMC); m.castShadow = true;
      addObj(m, { x0: x, x: x, len: v.len, dir: dir, speed: sp, kind: 'car', hurts: true, carries: false });
    }
  } else if (type === 'roll') {
    const dir = S.dir || flip(), sp = rnd(2.6, 5) * (S.spd || 1) * (1 + 0.4 * d), n = S.n || ri(4, 6), off = rnd(0, PER);
    for (let i = 0; i < n; i++) {
      const s = rnd(0.9, 1.25), m = new T.Mesh(rollGeo(), AH.MC(th.roll.ball)); m.scale.set(s, s, s); m.position.y = 0.58 * s; m.castShadow = true;
      addObj(m, { x0: place(i, n, off, 0.8), x: 0, len: 1.1 * s, dir: dir, speed: sp, kind: 'roll', hurts: true, carries: false, spin: s });
    }
  } else if (type === 'water') {
    const dir = S.dir || flip(), sp = rnd(1.1, 2.0) * (S.spd || 1) * (1 + 0.3 * d), n = S.n || ri(5, 7), off = rnd(0, PER);
    for (let i = 0; i < n; i++) {
      const len = rnd(2, 3.4), m = new T.Mesh(buildLog(len, th), AH.VMC); m.castShadow = true;
      addObj(m, { x0: place(i, n, off, 0.6), x: 0, len: len, dir: dir, speed: sp, kind: 'log', hurts: false, carries: true });
    }
    addFlow(row, th, dir, sp);
  } else if (type === 'lily') {
    row.pads = new Map(); addFlow(row, th, flip(), 0.3);
    for (let x = -COLS; x <= COLS; x++) {
      if (rand() < (S.pad !== undefined ? S.pad : 0.38) || x === prev || x === pc) {
        const m = new T.Mesh(padGeo(th), VM); const ps = rnd(0.78, 1.18); m.scale.set(ps, 1, ps * rnd(0.9, 1.1)); m.position.set(x + rnd(-0.08, 0.08), AH.PADY - 0.04, rnd(-0.08, 0.08)); m.rotation.y = rand() * 3; m.receiveShadow = true;
        row.group.add(m); row.pads.set(x, m);
      }
    }
  } else if (type === 'rail') {
    const dir = S.dir || flip(), len = ri(8, 11), tm = rnd(4.2, 7.5);
    const m = new T.Mesh(buildTrain(len, dir, pick([0x3b82f6, 0xe5484d, 0x2dd4bf, 0x9b5de5])), AH.VMC); m.castShadow = true; m.visible = false;
    row.group.add(m);
    const lamp = new T.Mesh(AH.BOX, AH.M(0x552222)); lamp.scale.set(0.3, 0.3, 0.3); lamp.position.set(-COLS - 1.6, 1.7, 0.4);
    row.group.add(lamp); row.lamp = lamp;
    row.train = { mesh: m, dir: dir, len: len, T: tm, warn: 1.3, speed: 30, off: rnd(0, tm), alive: !W.killed.has(r + ':-1'), row: r, idx: -1, kind: 'train' };
  } else if (type === 'gate') {
    if (!W.arena(W.arenaStart(r)).broken) {
      const m = new T.Group(), main = new T.Mesh(barrierGeo(th), VM); main.castShadow = true; m.add(main);
      const top = new Builder(), ar = th.arena, topY = { forest: 3.4, winter: 3.4, desert: 3.5, volcano: 3.0, city: 3.8, temple: 3.4 }[th.id] || 3.4;
      for (let x = -COLS - 2.5; x <= COLS + 2.6; x += 1) { const h = rnd(0.2, 1.9); top.box(1.02, h, 1.0, mixHex(ar.pillar[rand() < 0.5 ? 0 : 1], th.rock[2], rnd(0, 0.5)), x, topY - 0.2 + h / 2, rnd(-0.08, 0.08)); }
      const tm = new T.Mesh(top.build(), VM); tm.castShadow = true; m.add(tm);
      row.group.add(m);
      row.barrier = { mesh: m, th: th };
      for (let x = -COLS; x <= COLS; x++) row.blockers.set(x, { kind: 'barrier', node: null });
    }
  }
  scene.add(row.group);
  if (S.wild && AH.wild) AH.wild.populate(row, th);
  return row;
}
function removeRow(row) { scene.remove(row.group); if (AH.wild) AH.wild.drop(row.r); }

/* ---- public api ---- */
W.reset = function (seed) {
  W.rows.forEach(removeRow); W.rows.clear();
  if (AH.wild) AH.wild.clear();
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
  { const rw = W.rows.get(r), q = rw && rw.blockers.get(c); if (q && (q.kind === 'fence' || q.kind === 'barrier')) return false; }      // gates and the exit barrier can never be dug through
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
      o.mesh.castShadow = Math.abs(o.x) < AH.BGX + 1;
      if (o.spin) o.mesh.rotation.z = (-(o.dir * o.speed * t) / (0.58 * o.spin)) % TAU;
    }
    if (row.train) {
      const s = W.trainState(row, t), tr = row.train;
      tr.mesh.visible = tr.alive && s.x !== null;
      if (s.x !== null) { tr.mesh.position.x = s.x; tr.x = s.x; }
      const on = s.warn && Math.floor(t * 6) % 2 === 0;
      row.lamp.material = AH.M(on ? 0xff3b3b : 0x552222);
    }
    if (row.flow) {
      row.flow.m.position.x = (row.flow.off + row.flow.v * t) % FLOWP;
      if (Math.abs(-row.r - fz) < 9 && Math.random() < dt * 0.35) {          // a small splash somewhere on the water
        const lava = row.theme === 'volcano', sx = (Math.random() - 0.5) * 20;
        AH.burst(lava ? 3 : 2, sx, lava ? 0.1 : -0.2, -row.r + (Math.random() - 0.5) * 0.6, lava ? [0xff6a1a, 0xffd23f] : [0xffffff, 0xcfeaff], lava ? 1.0 : 0.7, lava ? 3.2 : 2.4);
      }
    }
    // canopies fade when the player stands under or right behind them
    if (row.canopies.length && Math.abs(-row.r - fz) < 3.2) {
      for (const c of row.canopies) c.mesh.material = Math.abs(c.x - fx) < 3.2 ? AH.VMG : VM;
    } else for (const c of row.canopies) if (c.mesh.material !== VM) c.mesh.material = VM;
  });
};
})();
