/* biomes.js: the props of the newer environments (rainforest, beach, lake): tree shapes, rocks and bushes, ground cover and the creature skins.
 * world.js looks these up through hooks (treeStyles, TALL, LOWP, ground, beastStyles), so nothing in the world generator is special-cased. */
(function () {
'use strict';
const AH = window.AH, W = AH.world, rnd = AH.rnd, ri = AH.ri, rand = AH.rand, pick = a => a[Math.floor(rand() * a.length)];
const mixHex = (a, b, k) => new AH.T.Color(a).lerp(new AH.T.Color(b), k).getHex();

/* ---- trees ---- */
W.treeStyles = W.treeStyles || {};
/* rainforest: a tall buttressed trunk, a broad layered canopy, trailing vines and a few bright blossoms */
W.treeStyles.jungle = function (c) {
  const R = c.R, o = c.o, t = c.t, sg = c.sg, tr = c.B(), cr = c.B();
  tr.cone(0.5, 0.26, 0.6, 7, t.trunk, 0, 0, 0, o);
  for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4 + c.v; tr.cone(0.18, 0.04, 0.8, 4, t.trunk, Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3, { R: R, lx: Math.cos(a) * 0.2, lz: Math.sin(a) * 0.2, j: 0.05 }); }
  tr.cone(0.26, 0.17, 2.0, 6, t.trunk, 0, 0.5, 0, { R: R, lx: 0.08 * sg, j: 0.05 }).cone(0.18, 0.12, 1.4, 6, mixHex(t.trunk, 0x000000, 0.12), 0.08 * sg, 2.45, 0, { R: R, lx: -0.1 * sg });
  const top = 3.7 + 0.2 * c.v;
  cr.blob(1.25, 0.34, 1.25, c.dk, 0, top - 0.3, 0, o);
  cr.blob(1.15, 0.5, 1.1, c.a, 0.2 * sg, top, 0, o).blob(0.9, 0.46, 0.9, c.b2, -0.8 * sg, top - 0.15, 0.3, o).blob(0.85, 0.44, 0.85, c.a, 0.85 * sg, top - 0.1, -0.3, o).blob(0.7, 0.4, 0.7, c.b2, 0, top + 0.35, 0.1, o).blob(0.45, 0.3, 0.45, t.c, -0.2 * sg, top + 0.7, 0, { R: R, tint: 0.2 });
  for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.8; cr.cone(0.035, 0.015, 1.1 + R() * 0.8, 4, 0x2f8a3a, Math.cos(a) * 0.95, top - 1.2, Math.sin(a) * 0.7, { R: R, j: 0.05 }); }
  for (let i = 0; i < 3; i++) cr.blob(0.1, 0.08, 0.1, t.cap, (R() - 0.5) * 1.8, top + 0.1 + R() * 0.3, (R() - 0.5) * 1.2 + 0.5, { R: R, n: 5, tint: 0.1 });
  return { trunk: tr.build(), crown: cr.build() };
};
/* lake shore: a leaning willow, its crown a dome of long drooping fronds */
W.treeStyles.willow = function (c) {
  const R = c.R, o = c.o, t = c.t, sg = c.sg, tr = c.B(), cr = c.B();
  tr.cone(0.34, 0.2, 0.45, 6, t.trunk, 0, 0, 0, o).cone(0.2, 0.12, 1.3, 6, t.trunk, 0, 0.4, 0, { R: R, lx: 0.14 * sg, lz: 0.03 }).cone(0.12, 0.07, 0.7, 5, t.trunk, 0.14 * sg, 1.65, 0.03, { R: R, lx: 0.2 * sg, lz: 0.03 });
  const cx = 0.34 * sg, top = 2.4;
  cr.blob(0.8, 0.42, 0.8, c.a, cx, top + 0.2, 0, o).blob(0.55, 0.3, 0.55, c.b2, cx - 0.2 * sg, top + 0.5, 0.1, o);
  for (let i = 0; i < 12; i++) { const a = i * 0.524 + R() * 0.2, rr = 0.7 + R() * 0.25; cr.leaf(0.12, 0.1, c.b2, cx + Math.cos(a) * rr, top + 0.1, Math.sin(a) * rr, a, 0, o); cr.cone(0.1, 0.03, 1.3 + R() * 0.5, 4, i % 2 ? c.a : c.b2, cx + Math.cos(a) * rr, top - 1.3 + 0.05, Math.sin(a) * rr, { R: R, lx: Math.cos(a) * 0.12, lz: Math.sin(a) * 0.12, j: 0.1 }); }
  return { trunk: tr.build(), crown: cr.build() };
};

/* ---- rocks and low plants ---- */
const T3 = (th, tbl, i, fn) => { tbl[th] = tbl[th] || [null, null, null]; tbl[th][i] = fn; };
/* rainforest */
T3('rainforest', W.TALL, 0, (b, R, o) => { b.rock(1.0, 0.8, 0.9, 0x6f776b, 0, 0, 0, o).blob(0.5, 0.12, 0.45, 0x2f8a3a, -0.1, 0.75, 0, { R: R, tint: 0.15, n: 6 }).blob(0.28, 0.2, 0.3, 0x7a8276, 0.5, 0.15, 0.2, o); });
T3('rainforest', W.TALL, 1, (b, R, o) => { b.rock(0.8, 1.1, 0.7, 0x7e8678, 0, 0, 0, o).blob(0.35, 0.1, 0.3, 0x3f9a45, 0.05, 1.05, 0, { R: R, tint: 0.15, n: 5 }); for (let i = 0; i < 3; i++) b.cone(0.03, 0.015, 0.8, 4, 0x2f8a3a, -0.3 + i * 0.3, 0.3, 0.38, { R: R }); });
T3('rainforest', W.TALL, 2, (b, R, o) => { b.cone(0.5, 0.35, 0.7, 7, 0x5a3d26, 0, 0, 0, { R: R, j: 0.08 }); for (let i = 0; i < 4; i++) { const a = i * 1.6; b.cone(0.1, 0.04, 0.25, 5, 0x4a3220, Math.cos(a) * 0.45, 0, Math.sin(a) * 0.4, { R: R, lx: Math.cos(a) * 0.15, lz: Math.sin(a) * 0.15 }); } b.blob(0.3, 0.08, 0.26, 0x2f8a3a, 0, 0.72, 0, { R: R, tint: 0.2, n: 5 }); });
T3('rainforest', W.LOWP, 0, (b, R, o) => { for (let i = 0; i < 7; i++) b.leaf(0.7, 0.28, i % 2 ? 0x2f9a3f : 0x45b856, 0, 0.12, 0, i * 0.9 + R() * 0.3, 0.3 + R() * 0.3); });
T3('rainforest', W.LOWP, 1, (b, R, o) => { for (let i = 0; i < 4; i++) b.blob(0.3, 0.24, 0.28, i % 2 ? 0x1f7a35 : 0x2fa04a, -0.4 + i * 0.27, 0.22, (R() - 0.5) * 0.3, { R: R, tint: 0.1, n: 5 }); for (let i = 0; i < 4; i++) b.blob(0.06, 0.06, 0.06, pick([0xff4fa0, 0xffd23f, 0xff7a1a]), -0.4 + R() * 0.8, 0.3 + R() * 0.2, 0.2, { n: 4 }); });
T3('rainforest', W.LOWP, 2, (b, R, o) => { for (let i = 0; i < 3; i++) { const x = -0.3 + i * 0.3, h = 0.5 + R() * 0.4; b.cone(0.05, 0.03, h, 5, 0x6a4a2a, x, 0, 0, { R: R }); b.leaf(0.7, 0.35, 0x2fa04a, x, h, 0, i * 1.1, 0.4); b.leaf(0.7, 0.35, 0x45b856, x, h, 0, i * 1.1 + 2.1, 0.4); } });
/* beach */
T3('beach', W.TALL, 0, (b, R, o) => { b.rock(0.9, 0.55, 0.8, 0x9a9484, 0, 0, 0, o).blob(0.3, 0.14, 0.3, 0xe9d9a8, 0.2, 0.5, 0.1, { R: R, n: 5, tint: 0.05 }); });
T3('beach', W.TALL, 1, (b, R, o) => { b.cylX(1.7, 0.16, 0.13, 6, 0xcdb48a, 0, 0.18, 0, { R: R, cap: 0xe6d3a8 }).cone(0.05, 0.02, 0.4, 4, 0xcdb48a, 0.3, 0.2, 0, { R: R, lx: 0.1 }); });
T3('beach', W.TALL, 2, (b, R, o) => { b.blob(0.7, 0.3, 0.6, 0xe6d3a0, 0, 0.3, 0, { R: R, n: 7, tint: 0.04 }); for (let i = 0; i < 5; i++) b.blade(0.7, 0.1, 0x7ab84a, -0.3 + i * 0.15, 0, i, 0.2, 0.5); });
T3('beach', W.LOWP, 0, (b, R, o) => { for (let i = 0; i < 6; i++) b.blade(0.5 + R() * 0.3, 0.09, i % 2 ? 0x8ac05a : 0x6aa94a, -0.3 + R() * 0.6, (R() - 0.5) * 0.3, R() * 3, 0.3 + R() * 0.2, 0); });
T3('beach', W.LOWP, 1, (b, R, o) => { b.blob(0.3, 0.2, 0.28, 0xff9a8a, 0, 0.16, 0, { R: R, n: 6 }); for (let i = 0; i < 5; i++) b.cone(0.04, 0.0, 0.3, 4, 0xffb3a0, Math.cos(i * 1.26) * 0.3, 0.1, Math.sin(i * 1.26) * 0.3, { R: R, lx: Math.cos(i * 1.26) * 0.08, lz: Math.sin(i * 1.26) * 0.08 }); });
T3('beach', W.LOWP, 2, (b, R, o) => { b.rock(0.5, 0.3, 0.45, 0xa8a090, -0.2, 0, 0, o).rock(0.35, 0.22, 0.3, 0x8a8a80, 0.25, 0, 0.1, o).blob(0.1, 0.05, 0.1, 0xffffff, 0.4, 0.05, 0.3, { n: 5 }); });
/* lake */
T3('lake', W.TALL, 0, (b, R, o) => { b.rock(1.0, 0.8, 0.85, 0x98a2ac, 0, 0, 0, o).blob(0.4, 0.1, 0.38, 0x5a9a58, 0, 0.78, 0, { R: R, tint: 0.15, n: 6 }); });
T3('lake', W.TALL, 1, (b, R, o) => { b.rock(0.75, 1.15, 0.7, 0xaab3bc, 0, 0, 0, o).rock(0.4, 0.5, 0.4, 0x8a949e, 0.5, 0, 0.1, o); });
T3('lake', W.TALL, 2, (b, R, o) => { for (let i = 0; i < 6; i++) { const x = -0.35 + i * 0.14, h = 0.9 + R() * 0.7; b.cone(0.035, 0.025, h, 4, 0x6a8a44, x, 0, (R() - 0.5) * 0.3, { R: R, lx: (R() - 0.5) * 0.15 }); b.cone(0.06, 0.05, 0.22, 5, 0x6a4a2a, x, h - 0.1, 0, { R: R }); } });
T3('lake', W.LOWP, 0, (b, R, o) => { for (let i = 0; i < 6; i++) b.blade(0.6 + R() * 0.4, 0.08, i % 2 ? 0x7ab84a : 0x5a9a3a, -0.3 + R() * 0.6, (R() - 0.5) * 0.3, R() * 3, 0.3, 0); });
T3('lake', W.LOWP, 1, (b, R, o) => { b.blob(0.3, 0.2, 0.28, 0x4a9a58, -0.2, 0.2, 0, { R: R, n: 5 }); for (let i = 0; i < 4; i++) b.blob(0.05, 0.05, 0.05, pick([0xff9ac8, 0xffffff, 0xc7b8ff]), -0.4 + R() * 0.5, 0.35, 0.15 + R() * 0.1, { n: 4 }); });
T3('lake', W.LOWP, 2, (b, R, o) => { b.rock(0.5, 0.28, 0.45, 0xa0aab4, -0.15, 0, 0, o).rock(0.3, 0.2, 0.28, 0x8a949e, 0.3, 0, 0.1, o); });

/* ---- ground cover (lawns, dunes, lakeside meadow). x = X() picks the spot and moves the height lookup E there. ---- */
W.ground = W.ground || {};
W.ground.rainforest = function (b, th, r, T, bg, H) {
  const X = H.X, E = H.E, Z = H.Z, g = [0x1f7a35, 0x2f9a45, 0x45b856, 0x176a2e];
  for (let i = ri(10, 15); i > 0; i--) { const x = X(), z = Z(), y = E(z); for (let k = ri(4, 7); k > 0; k--) b.blade(rnd(0.2, 0.5), rnd(0.07, 0.12), pick(g), x + rnd(-0.15, 0.15), z + rnd(-0.1, 0.1), rnd(0, 6.3), rnd(-0.12, 0.12), y); }
  for (let i = ri(2, 5); i > 0; i--) { const x = X(), z = Z(), y = E(z); for (let k = 0; k < 5; k++) b.leaf(rnd(0.3, 0.5), 0.14, pick([0x2f9a45, 0x45b856]), x, y + 0.04, z, k * 1.26, 0.12); }
  for (let i = ri(1, 4); i > 0; i--) { const x = X(), z = Z(), y = E(z); b.blade(0.3, 0.04, 0x3f9a3a, x, z, 0, 0.02, y).blob(0.08, 0.05, 0.08, pick(th.bloom), x, y + 0.32, z, { R: rand, tint: 0.15, n: 5 }); }
  for (let i = ri(3, 6); i > 0; i--) { const z = Z(); b.leaf(0.16, 0.08, pick([0x7a5a2a, 0x9a6a2e, 0x5a4a24]), X(), E(z) + 0.012, z, rnd(0, 6.3), 0); }
  if (!bg && rand() < 0.4) { const z = Z(), x = X(); b.cylX(rnd(0.7, 1.3), 0.1, 0.09, 6, 0x5a3d26, x, E(z) + 0.1, z, { R: rand, cap: 0x8a6a40 }); }
};
W.ground.beach = function (b, th, r, T, bg, H) {
  const X = H.X, E = H.E, Z = H.Z;
  for (let i = ri(6, 10); i > 0; i--) { const z = Z(), x = X(); b.box(rnd(0.8, 2.2), 0.012, 0.05, mixHex(th.ground[0], 0xc9a56a, 0.3), x, E(z) + 0.01, z); }           // wind ripples in the sand
  for (let i = ri(1, 3); i > 0; i--) { const x = X(), z = Z(), y = E(z); for (let k = ri(3, 6); k > 0; k--) b.blade(rnd(0.3, 0.6), 0.08, pick([0x8ac05a, 0x6aa94a, 0xa6cf74]), x + rnd(-0.12, 0.12), z + rnd(-0.1, 0.1), rnd(0, 6.3), rnd(0.05, 0.2), y); }
  for (let i = ri(2, 4); i > 0; i--) { const z = Z(), x = X(); b.blob(rnd(0.05, 0.1), 0.03, rnd(0.04, 0.08), pick([0xffffff, 0xffc7d1, 0xf5e0c0, 0xff9a8a]), x, E(z) + 0.03, z, { R: rand, n: 5, tint: 0.06 }); }   // shells
  if (rand() < 0.3) { const x = X(), z = Z(), y = E(z); for (let k = 0; k < 5; k++) b.cone(0.05, 0.0, 0.14, 4, 0xff7a59, x + Math.cos(k * 1.26) * 0.09, y, z + Math.sin(k * 1.26) * 0.09, { R: rand, lx: Math.cos(k * 1.26) * 0.08, lz: Math.sin(k * 1.26) * 0.08 }); }   // a starfish
  for (let i = ri(0, 2); i > 0; i--) { const z = Z(), x = X(); b.rock(rnd(0.2, 0.4), rnd(0.1, 0.2), rnd(0.18, 0.3), pick([0x9a9484, 0xb5ae9a]), x, E(z), z, { R: rand, n: 5, j: 0.2 }); }
};
W.ground.lake = function (b, th, r, T, bg, H) {
  const X = H.X, E = H.E, Z = H.Z, g = [0x4a9a3a, 0x62b04a, 0x7bc55a, 0x3a8a34];
  for (let i = ri(11, 16); i > 0; i--) { const x = X(), z = Z(), y = E(z); for (let k = ri(4, 7); k > 0; k--) b.blade(rnd(0.18, 0.42), rnd(0.06, 0.1), pick(g), x + rnd(-0.15, 0.15), z + rnd(-0.1, 0.1), rnd(0, 6.3), rnd(-0.1, 0.1), y); }
  for (let i = ri(1, 4); i > 0; i--) { const x = X(), z = Z(), y = E(z); b.blade(0.3, 0.04, 0x3f9a3a, x, z, 0, 0.02, y).blob(0.075, 0.05, 0.075, pick(th.bloom), x, y + 0.3, z, { R: rand, tint: 0.15, n: 5 }); }
  for (let i = ri(2, 5); i > 0; i--) { const z = Z(), x = X(); b.blob(rnd(0.05, 0.1), 0.03, rnd(0.04, 0.08), pick([0xb3bcc5, 0x9aa3ad, 0xc9d1d8]), x, E(z) + 0.03, z, { R: rand, n: 5 }); }
  if (rand() < 0.35) { const x = X(), z = Z(), y = E(z); for (let k = 0; k < 4; k++) { const h = rnd(0.6, 1.0); b.cone(0.03, 0.02, h, 4, 0x6a8a44, x + k * 0.07, y, z + rnd(-0.05, 0.05), { R: rand, lx: rnd(-0.08, 0.08) }); b.cone(0.05, 0.04, 0.2, 5, 0x6a4a2a, x + k * 0.07, y + h - 0.08, z, { R: rand }); } }       // reeds with cattails
};

/* ---- creature skins (the lesser enemies and the lane beasts) ---- */
W.beastStyles = W.beastStyles || {};
W.beastStyles.panther = function (b, dir) {
  const X = (lu, h, wz, col, x, y, z) => b.box(lu, h, wz, col, dir * x, y, z), f = 0x23212c, fl = 0x3a3646;
  X(0.9, 0.38, 0.4, f, -0.05, 0.52, 0); X(0.5, 0.14, 0.36, fl, -0.05, 0.4, 0); X(0.34, 0.3, 0.34, f, 0.52, 0.62, 0); X(0.14, 0.12, 0.2, fl, 0.74, 0.56, 0);
  [-1, 1].forEach(z => { X(0.05, 0.06, 0.07, 0xb8f23a, 0.66, 0.68, z * 0.12); X(0.08, 0.12, 0.1, f, 0.42, 0.84, z * 0.12); [-0.35, 0.3].forEach(u => X(0.12, 0.34, 0.12, f, u, 0.17, z * 0.15)); });
  X(0.6, 0.1, 0.1, f, -0.75, 0.6, 0); X(0.3, 0.1, 0.1, fl, -1.1, 0.7, 0);
  return b.build();
};
W.beastStyles.croc = function (b, dir) {
  const X = (lu, h, wz, col, x, y, z) => b.box(lu, h, wz, col, dir * x, y, z), f = 0x4a7a3a, fl = 0x6a9a50, dk = 0x2f5a2a;
  X(1.3, 0.4, 0.8, f, 0, 0.35, 0); X(1.1, 0.1, 0.6, fl, 0, 0.58, 0); for (let i = 0; i < 5; i++) X(0.1, 0.1, 0.5, dk, -0.45 + i * 0.25, 0.66, 0);
  X(0.9, 0.22, 0.46, f, 1.05, 0.3, 0); X(0.6, 0.1, 0.4, fl, 1.15, 0.43, 0); X(0.5, 0.06, 0.3, 0xe8e8d0, 1.2, 0.2, 0);
  X(1.0, 0.28, 0.5, f, -1.0, 0.28, 0); X(0.7, 0.18, 0.34, dk, -1.7, 0.22, 0);
  [-1, 1].forEach(z => { X(0.1, 0.1, 0.1, 0xffd23f, 0.85, 0.52, z * 0.2); [-0.4, 0.5].forEach(u => X(0.3, 0.2, 0.2, dk, u, 0.1, z * 0.5)); });
  return b.build();
};
W.beastStyles.frog = function (b, dir) {
  const X = (lu, h, wz, col, x, y, z) => b.box(lu, h, wz, col, dir * x, y, z), f = 0x4cc46f, fl = 0xd8f2a0, dk = 0x2f8a4a;
  X(0.8, 0.5, 0.7, f, 0, 0.4, 0); X(0.5, 0.2, 0.5, fl, 0.1, 0.22, 0); X(0.4, 0.3, 0.56, f, 0.5, 0.45, 0);
  [-1, 1].forEach(z => { X(0.16, 0.16, 0.16, 0xffe45a, 0.6, 0.7, z * 0.2); X(0.07, 0.08, 0.08, 0x111111, 0.68, 0.72, z * 0.2); X(0.5, 0.18, 0.18, dk, -0.25, 0.3, z * 0.42); X(0.3, 0.12, 0.2, dk, -0.55, 0.12, z * 0.5); X(0.2, 0.1, 0.16, dk, 0.55, 0.08, z * 0.35); });
  for (let i = 0; i < 3; i++) X(0.1, 0.04, 0.12, dk, -0.2 + i * 0.2, 0.68, i % 2 ? 0.1 : -0.1);
  return b.build();
};
W.beastStyles.moose = function (b, dir) {
  const X = (lu, h, wz, col, x, y, z) => b.box(lu, h, wz, col, dir * x, y, z), f = 0x6a4a34, fd = 0x4a3222, fl = 0x8a6a50, an = 0xd9c9a0;
  X(1.3, 0.8, 0.7, f, -0.1, 1.1, 0); X(0.5, 0.5, 0.5, fd, 0.5, 1.4, 0); X(0.5, 0.4, 0.4, f, 0.9, 1.5, 0); X(0.3, 0.28, 0.32, fl, 1.2, 1.38, 0); X(0.12, 0.3, 0.12, fd, 0.95, 1.1, 0);
  [-1, 1].forEach(z => { [-0.6, 0.45].forEach(u => X(0.2, 0.8, 0.2, fd, u, 0.4, z * 0.22)); X(0.05, 0.05, 0.06, 0x111111, 1.15, 1.52, z * 0.14); X(0.6, 0.06, 0.06, an, 0.85, 1.85, z * 0.4); X(0.08, 0.5, 0.06, an, 1.0, 2.05, z * 0.5); X(0.4, 0.06, 0.2, an, 0.85, 2.3, z * 0.6); X(0.08, 0.3, 0.06, an, 0.7, 2.1, z * 0.5); });
  return b.build();
};
})();
