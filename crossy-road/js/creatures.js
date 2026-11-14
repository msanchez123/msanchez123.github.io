/* creatures.js: the boss roster. Every checkpoint arena draws its guardian from a pool that fits the zone it closes (a mushroom lord in the forest,
 * a frost mammoth on the peaks, a demolition mech in the city, a feathered serpent in the temple...). Each archetype is its own silhouette, built
 * from voxel boxes, facing -z (forward). The footprint stays inside roughly 2 blocks of the centre so the hit radius in boss.js still feels fair.
 * AH.creatures.make(theme, seed) -> { geo, name } ; the same seed gives the same boss on every phone. */
(function () {
'use strict';
const AH = window.AH, T = AH.T;
const mix = (a, b, k) => new T.Color(a).lerp(new T.Color(b), k).getHex();
const lit = (c, k) => k >= 0 ? mix(c, 0xffffff, k) : mix(c, 0x000000, -k);
const hsl = (h, s, l) => new T.Color().setHSL(((h % 1) + 1) % 1, s, l).getHex();
const MIR = [-1, 1];

/* ---- forest ---- */
function mushroom(x) {
  const b = x.b, R = x.R, hue = R(0, 1) < 0.5 ? 0xd9433a : 0x8e4fd0, cap = hue, capL = lit(hue, 0.18), capD = lit(hue, -0.2), st = 0xf3e6c8, stD = 0xd8c6a0, dk = 0x2a1a14;
  MIR.forEach(s => b.box(0.8, 0.5, 1.0, stD, s * 0.65, 0.25, -0.2));
  b.box(1.9, 0.5, 1.9, stD, 0, 0.75, 0).box(1.6, 1.7, 1.6, st, 0, 1.8, 0);
  MIR.forEach(s => b.box(0.34, 0.5, 0.1, 0xffffff, s * 0.4, 2.0, -0.83).box(0.18, 0.3, 0.1, dk, s * 0.4, 2.0, -0.9).box(0.55, 0.12, 0.1, dk, s * 0.4, 2.32, -0.88));
  b.box(0.9, 0.2, 0.1, dk, 0, 1.3, -0.85).box(0.12, 0.2, 0.1, 0xffffff, -0.25, 1.42, -0.9).box(0.12, 0.2, 0.1, 0xffffff, 0.25, 1.42, -0.9);
  MIR.forEach(s => b.box(0.45, 0.45, 0.45, stD, s * 1.1, 1.5, -0.3).box(0.6, 0.6, 0.6, st, s * 1.35, 1.1, -0.45));
  b.box(3.7, 0.16, 3.7, 0xe8d3a8, 0, 2.7, 0).box(3.6, 0.5, 3.6, cap, 0, 2.98, 0).box(3.0, 0.5, 3.0, capL, 0, 3.45, 0).box(2.1, 0.4, 2.1, cap, 0, 3.85, 0).box(1.2, 0.3, 1.2, capD, 0, 4.15, 0);
  for (let i = 0; i < 8; i++) { const s = R(0.3, 0.6); b.box(s, 0.1, s, 0xffffff, R(-1.3, 1.3), 3.2 + R(0, 0.2), R(-1.3, 1.3)); }
  for (let i = 0; i < 6; i++) b.box(0.12, 0.12, 0.12, 0xf5e642, R(-2, 2), R(0.8, 3.2), R(-2, 2));   // spores
}
function treant(x) {
  const b = x.b, R = x.R, bark = 0x6b4a2e, barkL = 0x84603c, barkD = 0x4a321e, lf = 0x2f9a4a, lfL = 0x4cc46f, lfD = 0x1f6f38;
  [[-1, -0.7], [1, -0.7], [-0.9, 0.9], [0.9, 0.9]].forEach(p => b.box(0.7, 0.8, 1.3, barkD, p[0], 0.4, p[1]).box(0.5, 0.4, 0.9, bark, p[0] * 1.3, 0.2, p[1] * 1.2));
  b.box(1.9, 2.4, 1.7, bark, 0, 1.9, 0).box(1.5, 1.4, 1.5, barkL, 0, 3.6, 0);
  MIR.forEach(s => b.box(0.42, 0.3, 0.1, 0xffd23f, s * 0.45, 3.1, -0.78).box(0.7, 0.14, 0.12, barkD, s * 0.45, 3.4, -0.78));
  b.box(0.9, 0.5, 0.12, barkD, 0, 2.3, -0.88).box(0.12, 0.2, 0.14, barkL, -0.3, 2.5, -0.9).box(0.12, 0.2, 0.14, barkL, 0.3, 2.5, -0.9);
  MIR.forEach(s => { b.box(0.55, 1.5, 0.55, bark, s * 1.35, 2.7, -0.3).box(0.5, 0.5, 1.2, barkL, s * 1.55, 3.6, -0.9).box(1.0, 0.8, 1.0, lf, s * 1.6, 4.05, -1.2); b.box(0.4, 0.7, 0.4, bark, s * 1.15, 1.6, -0.5); });
  b.box(3.3, 0.9, 3.0, lf, 0, 4.8, 0).box(2.5, 0.9, 2.4, lfL, 0, 5.5, 0).box(1.5, 0.7, 1.5, lfD, 0, 6.1, 0);
  for (let i = 0; i < 6; i++) b.box(0.45, 0.45, 0.45, R(0, 1) < 0.5 ? 0xff6fa5 : 0xffd23f, R(-1.4, 1.4), 4.6 + R(0, 1.2), R(-1.4, 1.4));
}
/* quadrupeds: bear (forest), mammoth (frost), jaguar (temple) */
function quad(x, kind) {
  const b = x.b, R = x.R, P = { bear: [0x7a4f2e, 0xc9a07a], mammoth: [0x7d5a48, 0xefe6cf], jaguar: [0xe2a43a, 0xf6e3b0] }[kind], fur = P[0], lite = P[1], dk = lit(fur, -0.4), h = kind === 'jaguar' ? 1.3 : 1.7;
  const len = kind === 'jaguar' ? 3.6 : 3.1, z0 = 0.25;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => b.box(0.85, h * 0.7, 0.85, fur, p[0] * 0.85, h * 0.35, z0 + p[1] * len * 0.32).box(0.95, 0.22, 1.05, dk, p[0] * 0.85, 0.11, z0 + p[1] * len * 0.32 - 0.1));
  b.box(2.2, h * 1.15, len, fur, 0, h * 0.7 + h * 0.58, z0).box(1.6, h * 0.35, len * 0.8, lite, 0, h * 0.7 + 0.1, z0);
  if (kind !== 'jaguar') b.box(1.9, 0.7, 1.7, lit(fur, 0.1), 0, h * 1.3 + 0.6, z0 - 0.6);
  const hz = z0 - len / 2 - 0.35, hy = h * 1.25 + 0.4;
  if (kind === 'mammoth') {
    b.box(1.6, 1.5, 1.5, fur, 0, hy + 0.2, hz).box(0.6, 0.7, 0.6, fur, 0, hy - 0.4, hz - 1.0).box(0.5, 0.7, 0.5, fur, 0, hy - 1.0, hz - 1.15).box(0.45, 0.55, 0.45, fur, 0, hy - 1.5, hz - 1.1);
    MIR.forEach(s => b.box(0.18, 1.5, 1.3, lit(fur, -0.12), s * 1.05, hy + 0.3, hz + 0.3).box(0.26, 0.26, 1.7, lite, s * 0.65, hy - 0.5, hz - 0.9).box(0.24, 0.8, 0.24, lite, s * 0.65, hy - 0.1, hz - 1.7)
      .box(0.22, 0.22, 0.22, 0x111111, s * 0.45, hy + 0.35, hz - 0.78));
    b.box(2.3, 0.3, len + 0.1, lit(fur, -0.2), 0, 1.0, z0);
  } else if (kind === 'bear') {
    b.box(1.5, 1.3, 1.3, fur, 0, hy, hz).box(0.8, 0.55, 0.7, lite, 0, hy - 0.25, hz - 0.85).box(0.3, 0.22, 0.14, 0x111111, 0, hy - 0.05, hz - 1.22);
    MIR.forEach(s => b.box(0.45, 0.45, 0.3, fur, s * 0.6, hy + 0.8, hz + 0.1).box(0.2, 0.2, 0.1, 0x111111, s * 0.4, hy + 0.2, hz - 0.68).box(0.14, 0.4, 0.14, 0xffffff, s * 0.25, hy - 0.62, hz - 0.95));
  } else {
    b.box(1.3, 1.1, 1.2, fur, 0, hy - 0.1, hz).box(0.7, 0.45, 0.6, lite, 0, hy - 0.35, hz - 0.75).box(0.24, 0.2, 0.12, 0x2a1a14, 0, hy - 0.2, hz - 1.08);
    MIR.forEach(s => b.box(0.34, 0.34, 0.2, fur, s * 0.5, hy + 0.55, hz + 0.2).box(0.2, 0.14, 0.1, 0x2fe0c0, s * 0.35, hy + 0.12, hz - 0.62).box(0.1, 0.4, 0.1, 0xffffff, s * 0.22, hy - 0.62, hz - 0.88));
    for (let i = 0; i < 14; i++) b.box(0.3, 0.3, 0.3, 0x2a1a14, R(-1, 1), h * 1.75 + 0.02, z0 + R(-len / 2 + 0.3, len / 2 - 0.3));
    b.box(0.35, 0.35, 1.4, fur, 0, h * 1.1, z0 + len / 2 + 0.6).box(0.35, 0.35, 0.9, fur, 0, h * 1.35, z0 + len / 2 + 1.3).box(0.38, 0.38, 0.3, 0x2a1a14, 0, h * 1.5, z0 + len / 2 + 1.75);
    MIR.forEach(s => b.box(0.34, 0.14, 0.14, 0xffd23f, s * 0.9, h * 1.6, z0 + 0.4));
  }
}

/* ---- peaks ---- */
function yeti(x) {
  const b = x.b, fur = 0xf2f6fa, furD = 0xcfdceb, furL = 0xffffff;
  MIR.forEach(s => b.box(0.95, 1.4, 0.95, fur, s * 0.8, 0.7, 0.2).box(1.1, 0.4, 1.4, furD, s * 0.8, 0.2, 0));
  b.box(2.5, 2.1, 1.7, fur, 0, 2.5, 0.1).box(2.0, 1.3, 0.2, furL, 0, 2.3, -0.82).box(2.2, 0.5, 1.5, furD, 0, 1.6, 0.1);
  MIR.forEach(s => b.box(0.9, 0.9, 1.1, furL, s * 1.55, 3.3, 0).box(0.8, 2.0, 0.8, fur, s * 1.65, 2.2, -0.15).box(1.15, 1.0, 1.15, furD, s * 1.65, 0.85, -0.25).box(0.2, 0.7, 0.2, 0xbfe9ff, s * 1.4, 3.95, 0.1).box(0.16, 0.5, 0.16, 0xbfe9ff, s * 1.75, 3.85, 0.3));
  b.box(1.5, 1.2, 1.3, fur, 0, 4.15, -0.25).box(1.0, 0.8, 0.12, 0x6fc3ff, 0, 4.1, -0.9).box(1.1, 0.3, 0.12, furD, 0, 4.55, -0.9);
  MIR.forEach(s => b.box(0.22, 0.2, 0.1, 0xffffff, s * 0.28, 4.2, -0.97).box(0.1, 0.12, 0.1, 0xe5484d, s * 0.28, 4.2, -1.02).box(0.12, 0.4, 0.12, 0xffffff, s * 0.25, 3.72, -0.98));
  b.box(0.5, 0.14, 0.1, 0x10324a, 0, 3.85, -0.98);
}
/* ---- stone / ice / lava / ruin colossus: dressed from the zone ---- */
function golem(x) {
  const b = x.b, R = x.R, th = x.th, id = th.id;
  const stone = { winter: 0xbfe3f8, volcano: 0x2b2630, desert: 0xd9bf8a, city: 0x6a7380, temple: 0x9a9484 }[id] || 0x9d9484;
  const a = lit(stone, R(-0.05, 0.05)), c2 = lit(stone, -0.2), c3 = lit(stone, 0.2);
  const glow = { volcano: 0xff6a1a, winter: 0x7cd8ff, temple: 0x2fe0c0, city: 0x38e1ff }[id] || 0xffd23f, ac = th.arena.moss;
  MIR.forEach(s => b.box(1.0, 0.5, 1.4, c2, s * 0.85, 0.25, 0.1).box(0.8, 1.1, 0.8, a, s * 0.85, 1.05, 0.1).box(0.9, 0.3, 0.9, c3, s * 0.85, 1.7, 0.1));
  b.box(2.4, 1.9, 1.7, a, 0, 2.65, 0).box(2.0, 0.4, 1.3, c2, 0, 1.85, 0).box(2.0, 1.2, 0.2, c3, 0, 2.7, -0.9).box(0.7, 0.7, 0.12, glow, 0, 2.75, -1.02).box(0.36, 0.36, 0.14, lit(glow, 0.55), 0, 2.75, -1.06);
  MIR.forEach(s => b.box(1.1, 0.9, 1.3, c3, s * 1.5, 3.5, 0).box(0.85, 1.7, 0.9, a, s * 1.6, 2.4, -0.1).box(1.15, 1.1, 1.15, c2, s * 1.6, 1.1, -0.15).box(1.2, 0.14, 1.2, glow, s * 1.6, 1.68, -0.15));
  b.box(1.2, 1.0, 1.1, a, 0, 4.2, -0.1).box(0.9, 0.16, 0.1, glow, 0, 4.25, -0.68).box(1.3, 0.25, 1.2, c3, 0, 4.82, -0.1);
  for (let i = 0; i < 6; i++) {
    const sx = R(-1.9, 1.9), sz = R(-0.5, 0.5);
    if (id === 'winter') b.box(0.3, R(0.5, 1.1), 0.3, i % 2 ? 0xffffff : 0x9fd8ff, sx, 4.1 + R(0, 0.4), sz);
    else if (id === 'volcano') b.box(0.14, R(0.6, 1.4), 0.14, glow, sx, 2.2 + R(0, 1.2), -0.92 + R(0, 0.05));
    else b.box(R(0.3, 0.6), 0.18, R(0.3, 0.6), ac, sx, 4.0 + R(0, 0.1), sz);
  }
  if (id === 'temple') b.box(1.6, 0.25, 1.4, 0xf2c14e, 0, 5.05, -0.1).box(0.4, 0.7, 0.3, 0x2fe0c0, 0, 5.5, -0.1);
}

/* ---- dunes ---- */
function scorpion(x) {
  const b = x.b, sh = 0xc98a3a, shL = 0xe6ad54, shD = 0x7a4a1e;
  b.box(2.0, 0.8, 2.6, sh, 0, 1.0, 0.3).box(1.6, 0.5, 1.7, shL, 0, 1.55, 0.2).box(1.3, 0.2, 1.2, shD, 0, 1.85, 0.1);
  MIR.forEach(s => b.box(0.22, 0.22, 0.1, 0xff3b3b, s * 0.35, 1.5, -0.72));
  for (let k = 0; k < 4; k++) MIR.forEach(s => b.box(0.9, 0.2, 0.22, shD, s * 1.35, 0.7, -0.5 + k * 0.62).box(0.22, 0.7, 0.22, shD, s * 1.75, 0.35, -0.5 + k * 0.62));
  MIR.forEach(s => b.box(0.4, 0.4, 1.3, sh, s * 0.85, 1.0, -1.5).box(1.0, 0.55, 0.9, shL, s * 1.0, 1.0, -2.2).box(0.3, 0.45, 0.8, shD, s * 1.3, 1.0, -2.8).box(0.3, 0.45, 0.8, shD, s * 0.7, 1.0, -2.8));
  [[1.9, 1.15], [2.35, 1.8], [2.4, 2.5], [2.0, 3.15], [1.4, 3.6]].forEach((p, i) => b.box(0.7 - i * 0.05, 0.7 - i * 0.05, 0.7 - i * 0.05, i % 2 ? shL : sh, 0, p[1], p[0] - 0.4));
  b.box(0.28, 0.8, 0.28, 0xffd23f, 0, 3.4, 0.7);
}
function sphinx(x) {
  const b = x.b, sand = 0xdcb872, sandD = 0xb89452, gold = 0xf2c14e, blue = 0x2a6fdb;
  b.box(2.2, 1.5, 3.4, sand, 0, 1.0, 0.9).box(2.4, 0.3, 3.5, sandD, 0, 0.15, 0.9);
  MIR.forEach(s => b.box(0.8, 0.7, 1.7, sand, s * 0.7, 0.45, -1.6).box(0.9, 0.2, 0.5, sandD, s * 0.7, 0.1, -2.35).box(0.14, 0.14, 0.1, 0xffffff, s * 0.7, 0.2, -2.63));
  b.box(2.0, 1.8, 1.4, sand, 0, 2.0, -0.4).box(1.3, 1.2, 1.2, 0xc9985a, 0, 3.35, -0.7);
  b.box(2.1, 1.4, 1.5, gold, 0, 3.35, -0.45).box(1.34, 1.24, 0.3, 0xc9985a, 0, 3.3, -1.3);
  MIR.forEach(s => b.box(0.18, 1.2, 1.5, blue, s * 0.78, 3.3, -0.4).box(0.25, 0.16, 0.12, 0x2fe0ff, s * 0.3, 3.45, -1.42).box(0.18, 0.16, 0.1, 0x111111, s * 0.3, 3.45, -1.47));
  b.box(0.3, 0.7, 0.2, gold, 0, 2.6, -1.35).box(0.2, 0.4, 0.2, gold, 0, 4.2, -1.2).box(0.14, 0.2, 0.14, 0xe5484d, 0, 4.5, -1.2);
  b.box(0.35, 0.35, 1.5, sand, 0.9, 1.3, 2.9).box(0.4, 0.4, 0.4, sandD, 0.9, 1.3, 3.7);
  MIR.forEach(s => b.box(0.5, 1.8, 1.6, lit(sand, 0.1), s * 1.3, 2.3, 0.9));   // folded wings
}
function crab(x) {
  const b = x.b, th = x.th, id = th.id;
  const sh = { desert: 0xd98a4a, volcano: 0x2f2a36, city: 0x8a96a3, forest: 0xd9573a }[id] || 0xd9573a, shL = id === 'volcano' ? 0xff6a1a : lit(sh, 0.2), shD = lit(sh, -0.3);
  b.box(3.0, 1.1, 2.3, sh, 0, 1.15, 0.2).box(2.4, 0.5, 1.7, shL, 0, 1.85, 0.1);
  MIR.forEach(s => {
    b.box(0.15, 0.6, 0.15, shD, s * 0.5, 2.3, -0.8).box(0.4, 0.4, 0.4, 0xffffff, s * 0.5, 2.7, -0.85).box(0.2, 0.25, 0.12, 0x111111, s * 0.5, 2.7, -1.08);
    for (let k = 0; k < 3; k++) b.box(0.9, 0.24, 0.24, shD, s * 1.85, 0.85, 0.0 + k * 0.7).box(0.24, 0.85, 0.24, shD, s * 2.2, 0.42, k * 0.7);
    b.box(0.45, 0.45, 1.1, sh, s * 1.4, 1.3, -1.5).box(1.1, 1.0, 0.9, shL, s * 1.3, 1.3, -2.25).box(0.4, 0.55, 0.8, shD, s * 1.65, 1.3, -2.85).box(0.4, 0.55, 0.8, shD, s * 0.95, 1.3, -2.85);
  });
  b.box(1.4, 0.2, 0.1, shD, 0, 1.4, -1.0);
  if (id === 'city') b.box(0.1, 0.9, 0.1, 0x3a4350, 0.9, 2.5, 0.3).box(0.22, 0.22, 0.22, 0xff3b5c, 0.9, 3.0, 0.3).box(1.2, 0.2, 0.1, 0x38e1ff, 0, 1.9, -1.0);
}

/* ---- ember rift ---- */
function drake(x) {   // the classic random monster, kept as one option among many
  const b = x.b, R = x.R, RI = (a, c) => Math.floor(R(a, c + 0.999)), hue = R(0, 0.08), c1 = hsl(hue, 0.6, 0.3), c2 = hsl(hue + 0.04, 0.5, 0.45), c3 = 0xff6a1a, dark = hsl(hue, 0.4, 0.15);
  const bw = R(2.0, 2.6), bh = R(1.5, 2.0), bd = R(2.6, 3.2), y0 = 0.7;
  b.box(bw, bh, bd, c1, 0, y0 + bh / 2, 0).box(bw * 0.8, bh * 0.45, bd * 0.92, c2, 0, y0 + bh * 0.28, 0.05);
  const hw = R(1.3, 1.7), hy = y0 + bh + hw * 0.2, hz = -bd / 2 - hw * 0.3;
  b.box(hw, hw * 0.8, hw * 1.2, c1, 0, hy, hz).box(hw * 0.7, hw * 0.4, 0.6, c2, 0, hy - 0.2, hz - hw * 0.7);
  MIR.forEach(s => b.box(0.3, 0.3, 0.1, 0xffd23f, s * hw * 0.3, hy + 0.2, hz - hw * 0.6).box(0.28, 0.9, 0.28, 0xf1ead2, s * hw * 0.35, hy + 0.7, hz + 0.1).box(0.18, 0.5, 0.18, 0xf1ead2, s * hw * 0.35, hy + 1.3, hz + 0.1));
  for (let i = 0, n = RI(4, 6); i < n; i++) b.box(0.3, R(0.5, 1.0), 0.3, c3, 0, y0 + bh + 0.3, bd / 2 - (i + 0.5) * (bd / n));
  MIR.forEach(s => { b.box(1.2, 0.12, 2.2, dark, s * (bw / 2 + 0.7), y0 + bh + 0.5, 0.3).box(0.2, 1.2, 0.2, c1, s * (bw / 2 + 0.2), y0 + bh * 0.8, 0.3); });   // folded wings
  MIR.forEach(s => [-1, 1].forEach(q => b.box(0.55, y0 + 0.2, 0.6, dark, s * (bw / 2 - 0.2), (y0 + 0.2) / 2, q * bd * 0.3)));
  for (let i = 0; i < 4; i++) b.box(0.7 - i * 0.14, 0.7 - i * 0.14, 0.7, c1, 0, y0 + 0.5 - i * 0.05, bd / 2 + 0.3 + i * 0.65);
}

/* ---- city ---- */
function mech(x) {
  const b = x.b, steel = 0x8a96a3, dark = 0x3a4350, yel = 0xffc21a, glow = 0x38e1ff, red = 0xff3b5c;
  MIR.forEach(s => b.box(1.1, 0.35, 1.7, dark, s * 1.0, 0.18, -0.1).box(0.7, 1.3, 0.7, steel, s * 1.0, 1.0, 0).box(0.95, 0.3, 0.95, yel, s * 1.0, 1.75, 0));
  b.box(2.7, 0.9, 1.5, dark, 0, 2.2, 0).box(2.4, 1.9, 1.6, steel, 0, 3.5, 0).box(2.0, 1.2, 0.2, dark, 0, 3.5, -0.85).box(1.7, 0.16, 0.1, glow, 0, 3.8, -0.97).box(1.7, 0.16, 0.1, glow, 0, 3.4, -0.97).box(1.7, 0.16, 0.1, glow, 0, 3.0, -0.97);
  MIR.forEach(s => b.box(0.9, 0.9, 1.0, yel, s * 1.5, 4.25, 0).box(0.42, 0.42, 1.7, dark, s * 1.5, 4.25, -1.1).box(0.3, 0.3, 0.1, red, s * 1.5, 4.25, -1.97).box(0.55, 1.5, 0.6, steel, s * 1.6, 2.9, 0.1).box(0.8, 0.8, 0.8, dark, s * 1.6, 1.95, 0.1));
  b.box(1.1, 0.8, 1.0, steel, 0, 4.9, -0.1).box(0.9, 0.22, 0.1, red, 0, 4.95, -0.62).box(0.08, 0.9, 0.08, dark, 0.4, 5.6, 0).box(0.2, 0.2, 0.2, red, 0.4, 6.1, 0);
  MIR.forEach(s => b.box(0.3, 1.3, 0.3, dark, s * 0.6, 4.6, 0.9).box(0.4, 0.14, 0.4, 0x777777, s * 0.6, 5.3, 0.9));
}
function dozer(x) {
  const b = x.b, yel = 0xffc21a, dark = 0x2e343c, steel = 0x9aa3ad;
  MIR.forEach(s => { b.box(0.9, 1.0, 3.7, dark, s * 1.3, 0.5, 0.2); for (let i = 0; i < 6; i++) b.box(1.0, 0.14, 0.3, 0x555d68, s * 1.3, 1.03, -1.5 + i * 0.62); b.box(0.6, 0.6, 0.6, 0x555d68, s * 1.3, 0.5, -1.7).box(0.6, 0.6, 0.6, 0x555d68, s * 1.3, 0.5, 2.0); });
  b.box(2.2, 1.0, 3.0, yel, 0, 1.3, 0.3).box(1.9, 1.3, 1.6, yel, 0, 2.45, 0.8).box(1.5, 0.6, 0.1, 0xdff3fb, 0, 2.65, -0.03).box(2.1, 0.14, 1.8, dark, 0, 3.15, 0.8);
  b.box(0.3, 1.3, 0.3, dark, 0.7, 3.0, 1.7).box(0.4, 0.14, 0.4, 0x777777, 0.7, 3.7, 1.7);
  MIR.forEach(s => b.box(0.5, 0.3, 0.14, 0xff3b3b, s * 0.6, 1.65, -1.22).box(0.8, 0.12, 0.14, dark, s * 0.6, 1.95, -1.25).box(0.3, 1.0, 1.7, dark, s * 1.2, 1.2, -1.4));
  b.box(3.5, 1.5, 0.4, steel, 0, 1.15, -2.3).box(3.5, 0.2, 0.6, 0x555d68, 0, 1.9, -2.3);
  for (let i = -2; i <= 2; i++) b.box(0.4, 0.45, 0.5, 0xcfd6de, i * 0.7, 0.3, -2.35);
}

/* ---- sun temple ---- */
function totem(x) {
  const b = x.b, R = x.R, st = 0x9a9484, stL = 0xb5ae9a, stD = 0x6f6a5a, gold = 0xf2c14e, jade = 0x2fe0c0, dk = 0x2a1a14, F = [0x2fb0a0, 0xf2c14e, 0xe5484d];
  b.box(2.7, 0.5, 2.7, stD, 0, 0.25, 0).box(2.3, 1.3, 2.1, st, 0, 1.15, 0);
  MIR.forEach(s => b.box(0.42, 0.3, 0.1, jade, s * 0.5, 1.45, -1.06).box(0.18, 0.3, 0.1, dk, s * 0.5, 1.45, -1.1).box(0.15, 0.3, 0.1, 0xffffff, s * 0.38, 0.72, -1.07));
  b.box(1.1, 0.3, 0.1, dk, 0, 0.9, -1.06);
  b.box(2.0, 1.3, 1.9, stL, 0, 2.45, 0).box(0.38, 0.65, 0.5, gold, 0, 2.4, -1.1);
  MIR.forEach(s => b.box(0.3, 0.3, 0.1, jade, s * 0.55, 2.8, -0.97).box(0.9, 0.2, 1.7, gold, s * 1.0, 2.0, 0));
  b.box(2.5, 1.4, 2.1, st, 0, 3.8, 0).box(2.6, 0.25, 2.2, gold, 0, 3.15, 0);
  MIR.forEach(s => b.box(0.5, 0.35, 0.1, jade, s * 0.6, 4.0, -1.07).box(0.2, 0.3, 0.1, dk, s * 0.6, 4.0, -1.12).box(0.18, 0.4, 0.1, 0xffffff, s * 0.4, 3.45, -1.08));
  b.box(1.4, 0.3, 0.1, dk, 0, 3.55, -1.07);
  for (let i = -3; i <= 3; i++) b.box(0.32, 1.0 - Math.abs(i) * 0.12, 0.2, F[(i + 3) % 3], i * 0.36, 4.95 - Math.abs(i) * 0.1, 0.1).box(0.34, 0.2, 0.24, gold, i * 0.36, 4.5, 0.1);
  MIR.forEach(s => b.box(1.0, 1.0, 1.0, st, s * 2.0, 1.7 + R(0, 0.15), -0.5).box(0.4, 0.4, 0.12, jade, s * 2.0, 1.7, -1.02).box(0.5, 0.3, 0.5, stD, s * 2.0, 1.0, -0.5));
}
function serpent(x) {
  const b = x.b, R = x.R, sc = 0x1f9a8a, scL = 0x3fd0b8, scD = 0x146a60, gold = 0xf2c14e, F = [0x2fe0c0, 0xf2c14e, 0xe5484d];
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; b.box(0.95, 0.95, 0.95, k % 2 ? sc : scL, Math.cos(a) * 1.35, 0.48, Math.sin(a) * 1.35 + 0.5); }
  for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 + 0.4; b.box(0.9, 0.9, 0.9, k % 2 ? scL : sc, Math.cos(a) * 0.9, 1.35, Math.sin(a) * 0.9 + 0.5); }
  b.box(0.55, 0.5, 0.7, scD, 0, 0.25, 2.3).box(0.35, 0.35, 0.6, gold, 0, 0.2, 2.8);
  [[0, 1.8, -0.8], [0, 2.4, -1.4], [0, 3.1, -1.7], [0, 3.8, -1.7]].forEach((p, i) => { b.box(0.95 - i * 0.07, 0.95 - i * 0.07, 0.95, i % 2 ? sc : scL, p[0], p[1], p[2]); b.box(0.2, 0.5, 0.45, F[i % 3], 0, p[1] + 0.55, p[2] + 0.25); });
  b.box(1.3, 0.95, 1.5, sc, 0, 4.45, -2.2).box(0.8, 0.45, 0.7, scL, 0, 4.2, -3.1);
  MIR.forEach(s => b.box(0.28, 0.28, 0.1, 0xffd23f, s * 0.35, 4.65, -2.98).box(0.1, 0.5, 0.1, 0xffffff, s * 0.25, 3.85, -3.3).box(0.2, 0.2, 0.6, scD, s * 0.62, 4.9, -1.8));
  for (let i = 0; i < 5; i++) b.box(0.22, 0.9 - i * 0.1, 0.5, F[i % 3], 0, 5.15 - i * 0.05, -1.7 + i * 0.28);
  MIR.forEach(s => b.box(1.5, 0.1, 0.8, F[0], s * 1.2, 3.8, -0.6).box(1.0, 0.1, 0.6, gold, s * 1.5, 3.55, -0.3));   // feathered wings
}

const ARCH = {
  mushroom: { name: 'Sporelord', fn: mushroom }, treant: { name: 'Elder Treant', fn: treant },
  bear: { name: 'Grizzlor', fn: x => quad(x, 'bear') }, mammoth: { name: 'Frost Mammoth', fn: x => quad(x, 'mammoth') }, jaguar: { name: 'Stone Jaguar', fn: x => quad(x, 'jaguar') },
  yeti: { name: 'The Yeti', fn: yeti }, golem: { name: 'Colossus', fn: golem }, scorpion: { name: 'Dune Scorpion', fn: scorpion }, sphinx: { name: 'Sand Sphinx', fn: sphinx },
  crab: { name: 'Giant Crab', fn: crab }, drake: { name: 'Ember Drake', fn: drake }, mech: { name: 'Demolition Mech', fn: mech }, dozer: { name: 'Rampaging Dozer', fn: dozer },
  totem: { name: 'Totem Guardian', fn: totem }, serpent: { name: 'Feathered Serpent', fn: serpent }
};
const POOLS = {
  forest: ['mushroom', 'treant', 'bear', 'golem'], winter: ['mammoth', 'yeti', 'golem'], desert: ['scorpion', 'sphinx', 'crab', 'golem'],
  volcano: ['drake', 'golem', 'crab'], city: ['mech', 'dozer', 'crab', 'golem'], temple: ['totem', 'serpent', 'jaguar', 'golem']
};
const TITLE = { golem: { winter: 'Ice Colossus', volcano: 'Magma Colossus', desert: 'Sandstone Colossus', city: 'Concrete Colossus', temple: 'Temple Colossus', forest: 'Stone Colossus' },
  crab: { desert: 'Sand Crab King', volcano: 'Magma Crab', city: 'Robo Crab', forest: 'Giant Crab' } };

AH.creatures = {
  make(th, seed) {
    const rng = AH.seeded(seed), R = (a, b) => a + rng() * (b - a), pool = POOLS[th.id] || POOLS.forest, kind = pool[Math.floor(rng() * pool.length) % pool.length];
    const b = new AH.Builder(); ARCH[kind].fn({ b: b, R: R, th: th });
    let hx = 0; for (let i = 0; i < b.p.length; i += 3) hx = Math.max(hx, Math.abs(b.p[i]), Math.abs(b.p[i + 2]));
    if (hx > 2.8) { const k = 2.8 / hx; for (let i = 0; i < b.p.length; i++) b.p[i] *= k; }     // keep the whole body inside the hit zone
    const name = (TITLE[kind] && TITLE[kind][th.id]) || ARCH[kind].name;
    return { geo: b.build(), name: name, kind: kind };
  }
};
})();
