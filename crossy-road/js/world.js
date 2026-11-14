/* world.js: endless lane generation (seeded, themed per zone), hazards driven by the shared clock, checkpoint boss arenas.
 * Everything that answers "can I stand here / what hurts me here" lives in W.stand / W.hitAt / W.baseOf so the player, the robot and
 * the fox all ask the same questions. */
(function () {
'use strict';
const AH = window.AH, T = AH.T;
const COLS = AH.COLS, WRAP = AH.WRAP, PER = AH.PER, Builder = AH.Builder, VM = AH.VM, scene = AH.scene;
const rnd = (a, b) => AH.rnd(a, b), ri = (a, b) => AH.ri(a, b), rand = () => AH.rand();
const pick = arr => arr[Math.floor(rand() * arr.length)];
const W = AH.world = { rows: new Map(), gen: -9, run: 'grass', runLeft: 0, pathCol: 0, arenas: {}, killed: new Set(), removed: new Set(), seedN: 1 };

const wrapX = W.wrapX = v => ((v + WRAP) % PER + PER) % PER - WRAP;
W.objX = (o, t) => wrapX(o.x0 + o.dir * o.speed * t);
W.arenaStart = r => (r >= AH.ARENA_EVERY && r % AH.ARENA_EVERY < AH.ARENA_LEN) ? r - r % AH.ARENA_EVERY : -1;
W.arena = A => W.arenas[A] || (W.arenas[A] = { beaten: false });
W.firstOpenArena = function () { for (let A = AH.ARENA_EVERY; A < 5000; A += AH.ARENA_EVERY) if (!W.arena(A).beaten) return A; return 1e9; };
const mixHex = (a, b, k) => new T.Color(a).lerp(new T.Color(b), k).getHex();

/* ---- terrain beyond the lanes ----
 * Nothing marks the edge of the course. Past the last tile the ground is a seeded height field (pure function of seed, row and distance), so it
 * flows from row to row: here a slope climbs into mountains, there a ledge breaks off into a misty drop with a far ridge on the other side.
 * Rows that carry fast hazards cut a rock portal into it (cars, trains and boulders come out of the rock), rivers and belts spill over the lip,
 * and boss arenas sit in a bowl whose walls rise around them. The invisible wall (|x| > COLS) still does the real blocking. */
const PIT = 13, COLC = [1, 2, 3, 4, 5, 6, 7, 8, 9.5, 11.5, 13.5, 15.5, 17.5, 19.5, 21.5, 23.5, 25.5, 27.5];
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
function hash3(i, j, s) { let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(s | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash3(xi, yi, s), b = hash3(xi + 1, yi, s), c = hash3(xi, yi + 1, s), d = hash3(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/* natural height of the ground c blocks outside the lane edge (c >= 1), on one side, at row r */
function edgeBase(th, side, r, c) {
  const E = th.edge, S = W.seedN + side * 7919;
  const m = vnoise(r / E.len, 3.7, S) * 2 - 1, t = smooth(-0.2, 0.2, m);          // 0 = ledge and drop, 1 = mountain
  const pk = E.hi * (0.5 + 0.5 * vnoise(r / 9, 1.3, S + 11));
  const det = E.blocks ? (hash3(Math.floor(r / 3), Math.floor((c + 0.5) / 3), S + 5) - 0.5) * 7 : (vnoise(r / 2.6, c / 2.4, S + 5) - 0.5) * Math.min(c, 10) * E.rough * 2;
  const mtn = (pk + (E.blocks ? det : 0)) * smooth(0.4, E.ramp, c) + (E.blocks ? 0 : det);
  const dep = E.depth * (0.55 + 0.45 * vnoise(r / 10, 8.1, S + 17)), far = E.far * (0.6 + 0.4 * vnoise(r / 7, 2.9, S + 23)) * smooth(15, 27, c);
  const drop = -dep * smooth(0.5, 0.5 + E.cliff, c) + far + (vnoise(r / 3, c / 3, S + 31) - 0.5) * 1.6 * smooth(2, 6, c);
  let h = drop + (mtn - drop) * t;
  const q = c <= 2.5 ? Math.min(E.q, 0.5) : E.q, cap = 2.2 * c - 0.7;                // the cap keeps the near slope from hiding the lane from the camera
  h = Math.min(h, cap); h = Math.floor(h / q + 0.5) * q; if (h > cap) h -= q;
  if (c <= 2.5 && Math.abs(h) < 0.5) h = t >= 0.5 ? 0.5 : -0.5;                     // the lane never just runs on into more flat ground
  return Math.max(h, -E.depth - 3);
}
/* ov: what this particular row does to its edges: pit (river / belt spill over the lip), portal (hazard tunnel), flat (gate shoulder), arena (0..1 bowl) */
function edgeH(th, side, r, c, ov) {
  let h = edgeBase(th, side, r, c);
  if (ov.arena > 0) {
    const ch = (c <= 1.5 ? 1.5 : c <= 2.5 ? 3 : Math.min(4.5 + (c - 3) * 0.4, 9.5)) + (c > 2.5 ? (vnoise(r / 2, c / 2, W.seedN + side) - 0.5) * 1.5 : 0);
    const target = c <= 2.5 ? ch : Math.max(h, ch);
    h = Math.round((h + (target - h) * ov.arena) * 2) / 2;
  }
  if (ov.portal && c <= 2.5) h = Math.max(h, 1.5);
  if (ov.pit && c >= 1.5 && c <= 4.5) h = -PIT;
  if (ov.flat && c <= 1.5) h = 0;
  return h;
}
/* a stack of stacked bands from yTop down to yBot, tinted by depth (towards the mist) and height (towards the peak colour) */
function bands(b, x, w, yTop, yBot, P, th, farK, par) {
  const E = th.edge, n = Math.max(1, Math.min(6, Math.ceil((yTop - yBot) / (E.blocks ? 1.6 : 3)))), hh = (yTop - yBot) / n;
  for (let i = 0; i < n; i++) {
    const ym = yTop - hh * (i + 0.5);
    let c = P[(i + par) % P.length];
    if (ym > 3) c = mixHex(c, E.peak, Math.min(0.6, (ym - 3) / 9));
    c = mixHex(c, E.fog, Math.min(0.88, Math.max(ym < 0 ? -ym / 16 : 0, farK)));
    b.box(w, hh, 1, c, x, ym, 0);
  }
}
/* builds both sides of one row, fills eh[side] (c -> top height), returns spots where trees and rocks may stand */
function terrain(b, th, r, ov, eh, prev) {
  const E = th.edge, S = W.seedN, spots = [], wall = ov.arena > 0.5;
  const P = wall ? [th.arena.wall, th.arena.pillar[0], th.arena.pillar[1]] : (E.body || th.rock), topC = wall ? [th.arena.wallTop, th.arena.wallTop] : (E.top || th.ground);
  const neon = th.arena.flame[1];
  for (let side = 0; side < 2; side++) {
    const sg = side ? 1 : -1, H = eh[side];
    COLC.forEach(c => H.set(c, edgeH(th, side, r, c, ov)));
    if (ov.skip1) H.set(1, -0.5);                                                    // that column is the river / belt itself
    for (let k = 0; k < COLC.length; k++) {
      const c = COLC[k]; if (ov.skip1 && c === 1) continue;
      const w = c > 8 ? 2 : 1, x = sg * (COLS + c), h = H.get(c), outer = k + 1 < COLC.length ? H.get(COLC[k + 1]) : h, inner = k === 0 ? 0 : H.get(COLC[k - 1]);
      const xN = side ? outer : inner, pz = prev ? prev[side].get(c) : undefined, zN = pz === undefined ? h : pz, farK = Math.max(0, (c - 8) / 26);
      const steep = Math.abs(h - outer) > 1.01 || Math.abs(h - inner) > 1.01;
      let cap;
      if (E.blocks || wall) cap = topC[(k + r) & 1];
      else if (h > E.treeline + 1) cap = E.peak;
      else if (h < -2 || (steep && h > 1.5)) cap = P[1];
      else cap = topC[(r + k) & 1];
      b.box(w, 0.35, 1, mixHex(cap, E.fog, Math.min(0.9, Math.max(h < 0 ? -h / 15 : 0, farK))), x, h - 0.175, 0);
      const bot = Math.max(-16, Math.min(h, xN, zN));                                // only the faces the camera can see (towards +x and towards lower rows) get a body
      if (bot < h - 0.4) bands(b, x, w, h - 0.35, bot, P, th, farK, (k + r) & 1);
      if (E.blocks && h >= 4) {
        const q = hash3(r, k, S + 9);
        if (q < 0.3) b.box(w + 0.04, 0.12, 1.04, neon, x, h * 0.55, 0);
        if (q > 0.55 && q < 0.7) b.box(0.5, 0.4, 0.5, 0x7a828f, x, h + 0.2, 0);
        else if (q > 0.93) b.box(0.1, 1.6, 0.1, 0x3a4350, x, h + 0.8, 0).box(0.16, 0.16, 0.16, 0xff3b5c, x, h + 1.65, 0);
      }
      if (!wall && !ov.pit && !ov.portal && E.flora > 0 && h > -0.4 && h <= E.treeline && !steep) spots.push({ x: x + (w > 1 ? rnd(-0.6, 0.6) : 0), y: h, p: E.flora * (c <= 1.5 ? 0.5 : w > 1 ? 1.4 : 1) });
    }
    // the lane's own edge wall, where the ground drops away below it (the right-hand side is the one the camera sees)
    const h1 = H.get(1);
    if (side && h1 < -0.9) bands(b, COLS + 0.25, 0.5, -0.5, Math.max(-16, h1), P, th, 0, r & 1);
    // a stream tumbling down one of the ledges
    if (E.fall && !wall && !ov.pit && hash3(r, side, S + 41) < 0.1) {
      for (let k = 0; k < 6; k++) {
        const c = COLC[k], hc = H.get(c), hn = H.get(COLC[k + 1]);
        if (hc - hn >= 3 && hc > 0) { const m = (hc + hn) / 2; b.box(0.34, hc - hn, 0.55, E.fall, sg * (COLS + c + 0.55), m, 0).box(0.55, 0.12, 0.8, 0xffffff, sg * (COLS + c + 0.4), hc + 0.06, 0).box(0.9, 0.3, 0.9, 0xffffff, sg * (COLS + c + 0.8), hn + 0.15, 0); break; }
      }
    }
    // a bank of cloud in the deep
    if (!wall && H.get(3) < -7 && hash3(r, side, S + 53) < 0.4) b.box(rnd(2, 4), 0.5, rnd(0.6, 1), mixHex(E.fog, 0xffffff, 0.35), sg * (COLS + rnd(3, 8)), -rnd(5, 10), 0);
  }
  return spots;
}

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
/* hazards that run in and out of the rock portals are cut off at the lane edge, so they always seem to come out of (and vanish into) the cliff */
const CLIP = [new T.Plane(new T.Vector3(1, 0, 0), COLS + 0.5), new T.Plane(new T.Vector3(-1, 0, 0), COLS + 0.5)];
const HVM = new T.MeshLambertMaterial({ vertexColors: true, clippingPlanes: CLIP, clipShadows: true });
const hm = {}; const HM = c => hm[c] || (hm[c] = new T.MeshLambertMaterial({ color: c, clippingPlanes: CLIP, clipShadows: true }));
const TAU = Math.PI * 2;
const CAR_COLORS = [0xe5484d, 0x3b82f6, 0xf5c518, 0x9b5de5, 0x2dd4bf, 0xff7a59, 0xf1f5f9];

/* ---- type selection ---- */
const TYPES = [['grass', 0.27, 1, 3, 0], ['road', 0.24, 1, 3, 0], ['water', 0.18, 1, 2, 0], ['rail', 0.08, 1, 2, 12],
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
function addObstacle(row, x, rock, solid, th, y) {
  const g = new T.Group();
  if (rock) {
    const m = new T.Mesh(rockGeo(th, rand() < 0.5 ? 0 : 1), VM); m.castShadow = true; g.add(m);
  } else {
    const parts = treeParts(th, rand() < 0.5 ? 0 : 1);
    const trunk = new T.Mesh(parts.trunk, VM); trunk.castShadow = true; g.add(trunk);
    if (parts.crown) { const can = new T.Mesh(parts.crown, VM); can.castShadow = true; g.add(can); row.canopies.push({ mesh: can, x: x }); }
    const s = rnd(0.9, 1.2); g.scale.set(s, s * rnd(0.95, 1.15), s);
  }
  g.position.set(x, y || 0, 0); g.rotation.y = ri(0, 3) * 1.5708;
  row.group.add(g);
  if (solid) row.blockers.set(x, { kind: rock ? 'rock' : 'tree', node: g });
}

function groundDetails(b, th) {
  const n = ri(8, 14);
  for (let i = 0; i < n; i++) {
    const x = rnd(-COLS, COLS), z = rnd(-0.4, 0.4), h = rnd(0.3, 0.55), c = rand() < 0.5 ? th.tuft[0] : th.tuft[1];
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

/* arena dressing: a ring of runes on the floor, braziers and themed props on the rock terraces of the bowl, banners and posts at the gates */
function arenaDecor(b, th, r, k, gate, eh) {
  const A = th.arena, SIDES = [-1, 1];
  b.box(COLS * 2 + 1, 0.5, 1, (k + r) % 2 ? A.a : A.b, 0, -0.25, 0);
  [5.4, 2.7].forEach(R => { const dz = k - 7; if (Math.abs(dz) <= R) { const x = Math.sqrt(R * R - dz * dz), w = Math.abs(dz) > R - 0.6 ? 1.3 : 0.5; for (const s of x < 0.3 ? [1] : SIDES) b.box(w, 0.03, 0.62, A.accent, s * x, 0.015, 0); } });
  if (k === 7) b.box(1.2, 0.04, 1.2, A.accent, 0, 0.02, 0).box(0.5, 0.06, 0.5, A.flame[1], 0, 0.04, 0);
  if (k === 1) b.box(COLS * 2 + 1, 0.03, 0.34, A.flag, 0, 0.015, 0.1);
  const inBowl = k > 1 && k < AH.ARENA_LEN - 2;
  for (const s of SIDES) {
    const H = eh[s > 0 ? 1 : 0];
    if (!inBowl) continue;
    if (k % 3 === 1) { const wx = s * (COLS + 2), y0 = H.get(2);   // brazier on the first terrace
      b.box(0.14, 0.55, 0.14, 0x3a2f2a, wx, y0 + 0.28, 0).box(0.5, 0.14, 0.5, 0x3a2f2a, wx, y0 + 0.6, 0).box(0.28, 0.3, 0.28, A.flame[0], wx, y0 + 0.82, 0).box(0.16, 0.26, 0.16, A.flame[1], wx, y0 + 1.06, 0); }
    const cc = ri(3, 5), px = s * (COLS + cc), y0 = H.get(cc), h = rnd(0.8, 2.5), prop = A.prop;
    if (prop === 'ruin') { b.box(0.8, h, 0.8, A.pillar[0], px, y0 + h / 2, 0).box(1.0, 0.25, 1.0, A.pillar[1], px, y0 + h + 0.12, 0); if (rand() < 0.6) b.box(0.84, 0.18, 0.84, A.moss, px, y0 + h * 0.55, 0); }
    else if (prop === 'ice') { b.box(0.7, h, 0.7, A.pillar[0], px, y0 + h / 2, 0).box(0.42, h * 0.55, 0.42, A.pillar[1], px + 0.05, y0 + h + h * 0.27, 0).box(0.18, 0.5, 0.18, 0xffffff, px + 0.05, y0 + h + h * 0.6, 0); }
    else if (prop === 'obelisk') { b.box(0.9, 0.4, 0.9, A.pillar[1], px, y0 + 0.2, 0).box(0.66, h, 0.66, A.pillar[0], px, y0 + 0.4 + h / 2, 0).box(0.4, 0.5, 0.4, A.accent, px, y0 + 0.4 + h + 0.25, 0); }
    else if (prop === 'pyramid') { b.box(1.8, 0.4, 1.8, A.pillar[0], px, y0 + 0.2, 0).box(1.3, 0.4, 1.3, A.pillar[1], px, y0 + 0.6, 0).box(0.8, 0.4, 0.8, A.pillar[0], px, y0 + 1.0, 0).box(0.4, 0.3, 0.4, A.accent, px, y0 + 1.35, 0); }
    else if (prop === 'tower') { b.box(0.9, h + 1, 0.9, A.pillar[0], px, y0 + (h + 1) / 2, 0).box(0.94, 0.12, 0.94, A.accent, px, y0 + h * 0.6, 0).box(0.5, 0.3, 0.5, A.flame[0], px, y0 + h + 1.15, 0); }
    else { b.box(0.8, h, 0.8, A.pillar[0], px, y0 + h / 2, 0).box(0.82, 0.1, 0.82, A.accent, px, y0 + h * 0.45, 0).box(0.6, 0.12, 0.6, A.flame[0], px, y0 + h + 0.06, 0); }
  }
  for (let i = ri(2, 4); i > 0; i--) b.box(rnd(0.15, 0.4), 0.06, rnd(0.15, 0.3), mixHex(A.a, A.accent, 0.4), rnd(-COLS, COLS), 0.03, rnd(-0.35, 0.35));
  if (th.id === 'volcano') for (let i = ri(1, 3); i > 0; i--) b.box(rnd(0.5, 1.4), 0.03, 0.07, 0xff7a1a, rnd(-COLS, COLS), 0.02, rnd(-0.3, 0.3));
  if (th.id === 'winter') for (let i = ri(1, 3); i > 0; i--) b.box(0.4, 0.06, 0.4, 0xffffff, rnd(-COLS, COLS), 0.03, rnd(-0.3, 0.3));
  // gate posts (set into the rock shoulder, which is kept flat there) with flags
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

  const k = (type === 'arena' || type === 'gate') ? r - W.arenaStart(r) : -1;
  const ov = { pit: false, skip1: false, portal: false, flat: false, arena: 0 };
  if (type === 'water' || type === 'lily' || type === 'conv') ov.pit = ov.skip1 = true;
  else if (type === 'road' || type === 'roll' || type === 'rail') ov.portal = true;
  else if (k >= 0) { ov.arena = smooth(0, 3, k) * smooth(0, 3, AH.ARENA_LEN - 1 - k); ov.flat = k === 0 || type === 'gate'; }
  const pr = W.rows.get(r - 1), eh = [new Map(), new Map()];
  const spots = terrain(b, th, r, ov, eh, pr && pr.eh);
  row.eh = eh;
  const EDGE = COLS + 1.5, halfW = ov.pit ? EDGE : COLS + 0.5, LW = halfW * 2;

  if (type === 'grass') {
    b.box(LW, 0.5, 1, th.ground[r & 1], 0, -0.25, 0);
    groundDetails(b, th);
  } else if (type === 'road') {
    b.box(LW, 0.5, 1, th.road, 0, -0.25, 0);
    const before = W.rows.get(r - 1);
    if (before && before.type === 'road') for (let x = -6.6; x < 7; x += 2.4) b.box(1.2, 0.02, 0.14, th.marking, x, 0.01, 0.5);
  } else if (type === 'water' || type === 'lily') {
    // the river runs out over the lip of the cliff: touch the far side and you are out of the map
    const rip = th.id === 'volcano' ? 0xffb43a : mixHex(th.water, 0xffffff, 0.35), fall = th.id === 'volcano' ? 0xff8a2a : mixHex(th.water, 0xffffff, 0.5), fog = th.edge.fog;
    b.box(LW, 0.4, 1, th.water, 0, -0.5, 0);
    for (let i = ri(5, 9); i > 0; i--) b.box(rnd(0.5, 1.4), 0.02, 0.07, rip, rnd(-EDGE + 0.8, EDGE - 0.8), -0.29, rnd(-0.4, 0.4));
    const seg = (PIT - 0.3) / 3;
    for (const sx of [-1, 1]) {
      b.box(0.45, 0.12, 1.02, 0xffffff, sx * (EDGE + 0.05), -0.27, 0);                                   // foam on the lip
      for (let i = 0; i < 3; i++) b.box(0.34, seg, 1.0, mixHex(fall, fog, i * 0.28), sx * (EDGE + 0.17), -0.3 - seg * (i + 0.5), 0);   // the falling sheet, fading into the mist
      b.box(0.1, PIT * 0.55, 0.5, 0xffffff, sx * (EDGE + 0.4), -PIT * 0.4, 0.1).box(1.6, 0.4, 1.3, 0xffffff, sx * (EDGE + 0.7), -PIT + 0.5, 0);
    }
  } else if (type === 'rail') {
    b.box(LW, 0.4, 1, th.bed, 0, -0.2, 0);
    for (let x = -7.2; x < 7.4; x += 0.8) b.box(0.22, 0.08, 0.9, th.tie, x, 0.04, 0);
    b.box(LW, 0.1, 0.08, th.steel, 0, 0.12, 0.28).box(LW, 0.1, 0.08, th.steel, 0, 0.12, -0.28);
    const lh = eh[0].get(1); b.box(0.14, 0.9, 0.14, 0x4a525c, -COLS - 1, lh + 0.45, 0.4);               // signal post on top of the tunnel mouth
  } else if (type === 'conv') {
    b.box(LW, 0.5, 1, th.conv.base, 0, -0.25, 0).box(LW, 0.2, 0.08, th.conv.edge, 0, 0.02, 0.46).box(LW, 0.2, 0.08, th.conv.edge, 0, 0.02, -0.46);
  } else if (type === 'roll') {
    b.box(LW, 0.5, 1, th.roll.ground, 0, -0.25, 0);
    for (let i = 0; i < 10; i++) b.box(0.24, 0.1, 0.2, th.roll.speck, rnd(-COLS, COLS), 0.05, rnd(-0.35, 0.35));
  } else if (type === 'arena' || type === 'gate') {
    arenaDecor(b, th, r, k, type === 'gate', eh);
  }
  const mesh = new T.Mesh(b.build(), VM);
  mesh.castShadow = false; mesh.receiveShadow = true;
  row.group.add(mesh);
  row.group.position.z = -r;

  if (type === 'grass') {
    // some stretches of grass are a formation (a cluster of rocks and trees) with a guaranteed way round it
    const dense = r > 2 && hash3(Math.floor(r / 3), 5, W.seedN + 77) < 0.2;
    for (let x = -COLS; x <= COLS; x++) {
      if (x === prev || x === pc) continue;
      const p = r <= 2 ? 0 : dense ? 0.36 : 0.085, hit = rand() < p, rock = rand() < (dense ? 0.55 : 0.25);
      if (hit && !W.removed.has(r + ':' + x)) addObstacle(row, x, rock, true, th);
    }
  }
  spots.forEach(sp => { if (rand() < sp.p * 0.35) addObstacle(row, sp.x, rand() < 0.25, false, th, sp.y); });
  if (type === 'grass') { /* (lane obstacles above) */
  } else if (type === 'road') {
    const dir = rand() < 0.5 ? -1 : 1, sp = rnd(2.2, 4.2) * (1 + 0.5 * d), n = ri(4, 7), off = rnd(0, PER);
    for (let i = 0; i < n; i++) {
      const truck = rand() < 0.3, len = truck ? 2.6 : 1.5, x = place(i, n, off, 0.8);
      const bs = AH.BEASTS && AH.BEASTS[th.id], col = CAR_COLORS[ri(0, CAR_COLORS.length - 1)];
      const m = new T.Mesh(bs ? buildBeast(truck ? bs.big : bs.small, dir) : buildCar(len, col, dir, truck), HVM); m.castShadow = true;
      addObj(m, { x0: x, x: x, len: len, dir: dir, speed: sp, kind: 'car', hurts: true, carries: false });
    }
  } else if (type === 'roll') {
    const dir = rand() < 0.5 ? -1 : 1, sp = rnd(2.6, 5) * (1 + 0.4 * d), n = ri(4, 6), off = rnd(0, PER);
    for (let i = 0; i < n; i++) {
      const s = rnd(0.9, 1.25), m = new T.Mesh(rollGeo(), HM(th.roll.ball)); m.scale.set(s, s, s); m.position.y = 0.58 * s; m.castShadow = true;
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
    const m = new T.Mesh(buildTrain(len, dir, pick([0x3b82f6, 0xe5484d, 0x2dd4bf, 0x9b5de5])), HVM); m.castShadow = true; m.visible = false;
    row.group.add(m);
    const lamp = new T.Mesh(AH.BOX, AH.M(0x552222)); lamp.scale.set(0.3, 0.3, 0.3); lamp.position.set(-COLS - 1, eh[0].get(1) + 1.05, 0.4);
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
  W.seedN = seed ? Math.floor(AH.seeded(String(seed))() * 1e9) : Math.floor(Math.random() * 1e9);
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
/* the arena's entrance: once the boss is awake a gate drops across the first row and stays shut until the guardian falls */
W.entrance = function (A, closed) {
  const row = W.rows.get(A);
  if (!row || row.type !== 'arena') return;
  const g = row.gate || (row.gate = { closed: false, k: 1, meshes: [] });
  if (closed === g.closed) return;
  g.closed = closed;
  if (closed) {
    const th = AH.themeAt(A);
    g.k = 0;
    for (let x = -COLS; x <= COLS; x++) {
      if (row.blockers.has(x)) continue;
      const m = new T.Mesh(fenceGeo(th), VM); m.position.set(x, 6, 0); m.castShadow = true; row.group.add(m);
      row.blockers.set(x, { kind: 'fence', node: m }); g.meshes.push(m);
    }
  } else {
    g.meshes.forEach(m => { row.group.remove(m); });
    row.blockers.forEach((bl, x) => { if (bl.kind === 'fence') row.blockers.delete(x); });
    g.meshes = [];
  }
};
W.beat = function (A) {
  W.arena(A).beaten = true;
  W.entrance(A, false);
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
      else if (row.type === 'conv') o.mesh.visible = Math.abs(o.x) + o.len / 2 < COLS + 1.6;
      else o.mesh.visible = Math.abs(o.x) - o.len / 2 < COLS + 0.6;
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
    if (row.gate && row.gate.closed && row.gate.k < 1) {
      const g = row.gate; g.k = Math.min(1, g.k + dt * 2.2);
      g.meshes.forEach(m => { m.position.y = 6 * (1 - g.k * g.k); });
      if (g.k >= 1) { AH.cam.shake = Math.max(AH.cam.shake, 0.45); AH.beep(70, 0.5, 'sawtooth', 0.09, -30); for (let x = -COLS; x <= COLS; x += 2) AH.burst(2, x, 0.2, -row.r, [0xcfc7b8, 0xffffff], 2, 2.5); }
    }
    // canopies fade when the player stands under or right behind them
    if (row.canopies.length && Math.abs(-row.r - fz) < 3.2) {
      for (const c of row.canopies) c.mesh.material = Math.abs(c.x - fx) < 3.2 ? AH.VMG : VM;
    } else for (const c of row.canopies) if (c.mesh.material !== VM) c.mesh.material = VM;
  });
};
})();
