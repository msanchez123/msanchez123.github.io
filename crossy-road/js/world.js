/* world.js: endless lane generation (seeded, themed per zone), hazards driven by the shared clock, checkpoint boss arenas.
 * Everything that answers "can I stand here / what hurts me here" lives in W.stand / W.hitAt / W.baseOf so the player, the robot and
 * the fox all ask the same questions. */
(function () {
'use strict';
const AH = window.AH, T = AH.T;
const COLS = AH.COLS, WRAP = AH.WRAP, PER = AH.PER, Builder = AH.Builder, VM = AH.VM, scene = AH.scene;
/* two RNG streams (see core.js): the plain ones are DECORATION ONLY; the l-prefixed ones decide the level and must never be used for looks */
const rnd = (a, b) => AH.rnd(a, b), ri = (a, b) => AH.ri(a, b), rand = () => AH.rand();
const lrnd = (a, b) => AH.lrnd(a, b), lri = (a, b) => AH.lri(a, b), lrand = () => AH.lrand();
const pick = arr => arr[Math.floor(rand() * arr.length)], lpick = arr => arr[Math.floor(lrand() * arr.length)];
const C = AH.course, TUNE = C.TUNE;
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
    const t = th.tree, B = () => new Builder(), a = t.a[v], b2 = t.b[v], R = AH.seeded('tr' + th.id + v), o = { R: R }, dk = mixHex(a, 0x000000, 0.3), sg = v ? -1 : 1;
    if (W.treeStyles && W.treeStyles[t.style]) return W.treeStyles[t.style]({ th: th, v: v, B: B, R: R, o: o, a: a, b2: b2, dk: dk, sg: sg, t: t });
    if (t.style === 'pine') {
      const tr = B().cone(0.34, 0.2, 0.35, 6, t.trunk, 0, 0, 0, o).cone(0.2, 0.1, 1.3, 6, t.trunk, 0, 0.3, 0, { R: R, lx: 0.04 * sg }).build();
      const c = B();
      for (let i = 0; i < 5; i++) {
        const y = 0.85 + i * 0.62 + v * 0.05, rb = 1.05 - i * 0.18, h = 1.0 - i * 0.04;
        c.cone(rb, 0, h, 8, i % 2 ? b2 : a, 0, y, 0, { R: R, j: 0.22 });
        c.cone(rb * 0.74, 0, h * 0.62, 8, t.cap, 0, y + h * 0.36, 0, { R: R, j: 0.2, tint: 0.06 });          // snow lying on the boughs
      }
      c.cone(0.12, 0, 0.45, 6, t.c, 0, 3.85, 0, o);
      return { trunk: tr, crown: c.build() };
    }
    if (t.style === 'cactus') {
      const c = B();
      c.cone(0.31, 0.26, 2.0, 8, a, 0, 0, 0, { R: R, j: 0.06, tint: 0.2 }).blob(0.27, 0.2, 0.27, a, 0, 2.05, 0, o).blob(0.1, 0.08, 0.1, t.cap, 0.04, 2.3, 0, o);
      c.cone(0.15, 0.15, 0.4, 6, b2, -0.2, 0.85, 0, { R: R, lx: -0.5, j: 0.06 }).cone(0.15, 0.13, 0.85 + 0.2 * v, 6, a, -0.7, 1.2, 0, { R: R, j: 0.06 }).blob(0.14, 0.11, 0.14, a, -0.7, 2.1 + 0.2 * v, 0, o);
      c.cone(0.14, 0.14, 0.35, 6, b2, 0.2, 1.25, 0, { R: R, lx: 0.45, j: 0.06 }).cone(0.14, 0.12, 0.6, 6, a, 0.65, 1.55, 0, { R: R, j: 0.06 }).blob(0.13, 0.1, 0.13, a, 0.65, 2.2, 0, o);
      return { trunk: c.build(), crown: null };
    }
    if (t.style === 'char') {
      const c = B();
      c.blob(0.5, 0.18, 0.5, 0x3a3034, 0, 0.1, 0, o).cone(0.3, 0.2, 1.0, 6, t.trunk, 0, 0.05, 0, { R: R, lx: 0.12 * sg }).cone(0.2, 0.12, 0.95, 6, t.trunk, 0.12 * sg, 1.0, 0, { R: R, lx: -0.2 * sg }).cone(0.12, 0.06, 0.7, 5, t.trunk, -0.08 * sg, 1.9, 0, { R: R, lx: 0.1 * sg });
      c.cone(0.08, 0.03, 0.95, 5, t.trunk, 0.05 * sg, 1.2, 0, { R: R, lx: 0.7 * sg, lz: 0.12 }).cone(0.07, 0.03, 0.8, 5, t.trunk, -0.05 * sg, 1.65, 0, { R: R, lx: -0.62 * sg, lz: -0.1 }).cone(0.05, 0.02, 0.5, 5, t.trunk, 0, 2.35, 0, { R: R, lx: 0.2 * sg });
      c.blob(0.1, 0.09, 0.1, t.c, 0.75 * sg, 2.2, 0.12, { R: R, tint: 0.2 }).blob(0.09, 0.08, 0.09, t.cap, -0.67 * sg, 2.4, -0.1, { R: R, tint: 0.2 }).blob(0.08, 0.07, 0.08, t.c, 0.2 * sg, 2.9, 0, { R: R, tint: 0.2 }).blob(0.06, 0.2, 0.06, t.c, 0.16 * sg, 1.0, -0.22, { R: R, tint: 0.2 });
      return { trunk: c.build(), crown: null };
    }
    if (t.style === 'palm') {
      const tr = B(), lean = 0.14 * sg;
      tr.cone(0.3, 0.2, 0.3, 6, t.trunk, 0, 0, 0, o);
      for (let i = 0; i < 4; i++) tr.cone(0.19 - i * 0.012, 0.17 - i * 0.012, 0.72, 6, i % 2 ? mixHex(t.trunk, 0x000000, 0.14) : t.trunk, lean * i * 0.7, 0.25 + i * 0.7, 0, { R: R, lx: lean * 0.7, j: 0.05 });
      const cx = lean * 2.8, c = B();
      c.blob(0.22, 0.16, 0.22, mixHex(t.trunk, 0x000000, 0.25), cx, 3.1, 0, o).blob(0.1, 0.1, 0.1, 0x5b3a1a, cx + 0.14, 2.95, 0.1, o).blob(0.1, 0.1, 0.1, 0x5b3a1a, cx - 0.1, 2.95, -0.12, o);
      for (let i = 0; i < 8; i++) c.leaf(1.55 + R() * 0.3, 0.5, i % 2 ? b2 : a, cx, 3.15 + R() * 0.1, 0, i * 0.785 + R() * 0.3, 0.55 + R() * 0.4);
      return { trunk: tr.build(), crown: c.build() };
    }
    // oak: flared roots, a leaning trunk with a branch, a crown of overlapping leaf clumps in several greens
    const tr = B().cone(0.36, 0.22, 0.45, 6, t.trunk, 0, 0, 0, o).cone(0.21, 0.13, 1.6 + 0.2 * v, 6, t.trunk, 0, 0.35, 0, { R: R, lx: 0.07 * sg, lz: 0.03 }).cone(0.07, 0.04, 0.6, 5, t.trunk, 0.05 * sg, 1.5, 0, { R: R, lx: 0.5 * sg, lz: 0.12 }).build();
    const c = B(), top = 2.25 + 0.2 * v;
    c.blob(0.85, 0.34, 0.85, dk, 0.05, top - 0.2, 0, o);
    c.blob(1.0, 0.72, 1.0, a, 0.05 * sg, top + 0.25, 0, o).blob(0.72, 0.58, 0.72, b2, -0.62 * sg, top, 0.2, o).blob(0.68, 0.55, 0.68, a, 0.65 * sg, top + 0.05, -0.2, o);
    c.blob(0.62, 0.5, 0.62, b2, 0.12, top + 0.75, 0.1, o).blob(0.5, 0.38, 0.5, t.c, -0.1 * sg, top + 1.15, 0, { R: R, tint: 0.18 }).blob(0.3, 0.25, 0.3, mixHex(t.c, 0xffffff, 0.2), 0.2, top + 1.4, 0.05, o);
    return { trunk: tr, crown: c.build() };
  });
}
/* boulders: irregular faceted rocks, a big one with smaller ones beside it, plus a themed finish (moss, snow, lava, rebar) */
const rockGeoF = (th, v) => geo('rock' + th.id + v, () => {
  const r = th.rock, R = AH.seeded('rk' + th.id + v), o = { R: R, j: 0.3 }, b = new Builder(), id = th.id, topY = v ? 1.05 : 0.8;
  if (!v) b.rock(0.95, 0.8, 0.85, r[0], 0, 0, 0, o).rock(0.5, 0.45, 0.45, r[1], 0.42, 0, 0.25, o).rock(0.35, 0.3, 0.3, r[2], -0.4, 0, 0.3, o);
  else b.rock(0.72, 1.05, 0.7, r[2], 0, 0, 0, o).rock(0.5, 0.6, 0.5, r[0], 0.38, 0, 0.1, o).rock(0.3, 0.25, 0.3, r[1], -0.32, 0, -0.25, o);
  if (id === 'forest' || id === 'temple' || id === 'rainforest' || id === 'lake') { b.blob(0.3, 0.09, 0.28, 0x4f8f3f, 0, topY - 0.02, 0, { R: R, tint: 0.2 }).blob(0.18, 0.07, 0.16, 0x62a84a, 0.42, 0.42, 0.25, { R: R, tint: 0.2 }); for (let i = 0; i < 4; i++) b.blade(0.28, 0.08, 0x4fae3f, -0.1 + i * 0.12, 0.45, i, 0.05); }
  else if (id === 'winter') b.blob(0.36, 0.13, 0.34, 0xffffff, 0, topY - 0.02, 0, { R: R, tint: 0.05 }).blob(0.2, 0.08, 0.18, 0xeaf4ff, 0.42, 0.44, 0.25, { R: R, tint: 0.05 });
  else if (id === 'volcano') b.blob(0.1, 0.07, 0.04, 0xff5a14, 0.3, 0.36, -0.4, { R: R, tint: 0.1 }).blob(0.06, 0.05, 0.04, 0xffb43a, -0.2, 0.5, -0.38, { R: R, tint: 0.1 });
  else if (id === 'desert') b.blob(0.3, 0.06, 0.28, mixHex(r[1], 0xffffff, 0.2), 0, topY - 0.02, 0, { R: R, tint: 0.06 });
  return b.build();
});
/* a low themed blocker: a fallen log, tall grass, snow drift, ice crystals, dry bush, ash mound, crates, a barrier, a broken column... variant 0 is chunky, 1 is a clump */
const lowGeoF = (th, v) => geo('low' + th.id + v, () => {
  const b = new Builder(), t = th.tree, id = th.id, R = AH.seeded('lw' + th.id + v), o = { R: R };
  if (id === 'winter') {
    if (!v) b.blob(0.6, 0.3, 0.5, 0xffffff, 0, 0.25, 0, { R: R, tint: 0.05 }).blob(0.4, 0.28, 0.34, 0xeaf4ff, 0.2, 0.42, 0.05, { R: R, tint: 0.05 }).blob(0.3, 0.2, 0.28, 0xffffff, -0.3, 0.3, 0.1, { R: R, tint: 0.05 });
    else b.rock(0.55, 0.32, 0.5, 0xb9c4cf, -0.15, 0, 0, o).blob(0.5, 0.2, 0.42, 0xffffff, -0.12, 0.26, 0, { R: R, tint: 0.04 }).rock(0.3, 0.2, 0.28, 0xaab6c2, 0.38, 0, 0.1, o).blob(0.28, 0.1, 0.24, 0xffffff, 0.38, 0.16, 0.1, { R: R, tint: 0.04 });   // snow-capped stones
  } else if (id === 'desert') {
    if (!v) b.rock(1.0, 0.5, 0.8, 0xd1ad70, 0, 0, 0, o).rock(0.55, 0.36, 0.5, 0xe2c58e, 0.12, 0.38, 0, o).rock(0.4, 0.25, 0.4, 0xc29a58, -0.35, 0, 0.25, o);
    else { b.blob(0.42, 0.34, 0.42, 0xb98f45, 0, 0.36, 0, o).blob(0.3, 0.26, 0.3, 0x8a6a30, 0.15, 0.58, 0.05, o); for (let i = 0; i < 5; i++) b.cone(0.03, 0.01, 0.5, 4, 0xa07a3a, (i - 2) * 0.12, 0.45, (i % 2) * 0.1, { R: R, lx: (i - 2) * 0.1 }); }
  } else if (id === 'volcano') {
    if (!v) b.rock(0.9, 0.5, 0.75, 0x2b2630, 0, 0, 0, o).rock(0.5, 0.4, 0.45, 0x1f1a23, 0.05, 0.4, 0, o).blob(0.12, 0.07, 0.4, 0xff5a14, 0.22, 0.4, 0, { R: R, tint: 0.1 });
    else b.blob(0.45, 0.2, 0.4, 0x3a3340, 0, 0.18, 0, o).blob(0.3, 0.25, 0.3, 0x2b2630, 0, 0.42, 0, o).blob(0.1, 0.1, 0.1, 0xffb43a, 0.05, 0.68, 0, { R: R, tint: 0.1 });
  } else if (id === 'temple') {
    if (!v) b.cone(0.32, 0.28, 0.75, 8, 0xb5ae8a, 0, 0, 0, { R: R, j: 0.06 }).cone(0.26, 0.24, 0.4, 8, 0x9a9170, 0.12, 0.7, 0, { R: R, lx: 0.1, j: 0.08 }).blob(0.26, 0.08, 0.24, 0x4f8f3f, 0, 0.78, 0, { R: R, tint: 0.2 });
    else b.rock(0.95, 0.55, 0.8, 0x9a9170, 0, 0, 0, o).blob(0.36, 0.1, 0.3, 0x4f8f3f, 0, 0.55, 0, { R: R, tint: 0.2 }).blob(0.08, 0.24, 0.08, 0x3f7a2a, 0.35, 0.35, 0.3, o);
  } else {                                               // forest / default: fallen log with moss, or a thick patch of tall grass and ferns
    if (!v) {
      b.cylX(1.05, 0.26, 0.22, 8, t.trunk, 0, 0.26, 0.04, { R: R, cap: 0xd9b27c }).blob(0.2, 0.06, 0.18, 0x4f8f3f, 0.1, 0.52, 0.04, { R: R, tint: 0.2 }).cylX(0.4, 0.06, 0.03, 5, t.trunk, 0.15, 0.42, 0.3, { R: R }).blob(0.14, 0.05, 0.12, 0x4f8f3f, -0.3, 0.5, 0.04, { R: R, tint: 0.2 });
    } else {
      for (let i = 0; i < 16; i++) b.blade(0.75 + R() * 0.55, 0.12, i % 3 ? t.a[0] : t.b[0], -0.4 + R() * 0.8, -0.35 + R() * 0.7, R() * 3.14, (R() - 0.5) * 0.5);
      for (let i = 0; i < 3; i++) b.leaf(0.55, 0.22, t.b[1], -0.2 + i * 0.2, 0.12, 0, i * 2.1, 0.2);
    }
  }
  return b.build();
});
/* ---- themed obstacle sets: each environment has its own tall and low props instead of one shape recoloured ---- */
const TALL = {
  forest: [null, null, (b, R, o) => {                                  // a mossy stump with a few roots
    b.cone(0.5, 0.4, 0.8, 9, 0x6b4a2f, 0, 0, 0, { R: R, j: 0.08 }).blob(0.43, 0.06, 0.43, 0xc9a273, 0, 0.82, 0, { R: R, n: 7, tint: 0.06 }).blob(0.3, 0.07, 0.28, 0x4f8f3f, -0.12, 0.8, 0.05, { R: R, tint: 0.2 });
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.4, x = Math.cos(a) * 0.5, z = Math.sin(a) * 0.46; b.cone(0.14, 0.05, 0.3, 5, 0x5b3d22, x, 0, z, { R: R, lx: Math.cos(a) * 0.18, lz: Math.sin(a) * 0.16 }); }
  }],
  winter: [(b, R, o) => {                                              // a big snow-capped boulder
    b.rock(1.05, 0.8, 0.95, 0x9aa6b3, 0, 0, 0, o).blob(0.8, 0.22, 0.72, 0xffffff, 0, 0.74, 0, { R: R, tint: 0.04, n: 7 }).rock(0.45, 0.4, 0.4, 0xaab6c2, 0.6, 0, 0.25, o).blob(0.34, 0.1, 0.3, 0xffffff, 0.6, 0.36, 0.25, { R: R, tint: 0.04, n: 5 });
  }, null, (b, R, o) => {                                              // a rounded snow bank
    b.blob(0.75, 0.5, 0.65, 0xffffff, 0, 0.35, 0, { R: R, n: 8, tint: 0.03 }).blob(0.5, 0.36, 0.45, 0xeaf4ff, 0.4, 0.28, 0.1, { R: R, n: 7, tint: 0.03 }).rock(0.3, 0.2, 0.26, 0x8a96a3, -0.5, 0, 0.2, o);
  }],
  desert: [(b, R, o) => {                                              // banded sandstone mesa
    b.rock(1.15, 0.5, 0.95, 0xc29a58, 0, 0, 0, o).rock(1.0, 0.3, 0.85, 0xe6cd8d, 0.02, 0.48, 0, o).rock(0.9, 0.32, 0.75, 0xd1ad70, -0.02, 0.76, 0.02, o).rock(0.66, 0.34, 0.55, 0xe2c58e, 0.05, 1.06, 0, o);
    b.rock(0.5, 0.3, 0.4, 0xb98f45, 0.62, 0, 0.3, o);
  }, (b, R, o) => {                                                    // a leaning spire
    b.cone(0.5, 0.4, 0.55, 7, 0xc29a58, 0, 0, 0, { R: R, j: 0.08 }).cone(0.4, 0.3, 0.55, 7, 0xe2c58e, 0, 0.52, 0, { R: R, j: 0.08, lx: 0.04 }).cone(0.3, 0.18, 0.55, 7, 0xd1ad70, 0.02, 1.04, 0, { R: R, j: 0.08, lx: 0.06 }).cone(0.18, 0.02, 0.6, 7, 0xe6cd8d, 0.06, 1.55, 0, { R: R, lx: 0.1 });
  }, (b, R, o) => {                                                    // a dead tree with a skull at its foot
    b.cone(0.26, 0.14, 1.2, 6, 0x8a7a66, 0, 0, 0, { R: R, lx: 0.08 }).cone(0.09, 0.03, 0.8, 5, 0x8a7a66, 0.05, 1.0, 0, { R: R, lx: 0.7 }).cone(0.08, 0.03, 0.7, 5, 0x7a6a56, 0.02, 1.15, 0, { R: R, lx: -0.7, lz: 0.2 }).cone(0.05, 0.02, 0.45, 4, 0x8a7a66, 0.35, 1.6, 0, { R: R, lx: 0.6 });
    b.blob(0.14, 0.12, 0.14, 0xf1ead2, 0.45, 0.12, -0.25, { n: 5 }).box(0.07, 0.07, 0.05, 0x23262e, 0.4, 0.14, -0.38).box(0.07, 0.07, 0.05, 0x23262e, 0.5, 0.14, -0.38).box(0.5, 0.05, 0.06, 0xf1ead2, 0.1, 0.03, 0.4);
  }],
  volcano: [(b, R, o) => {                                             // obsidian crystals over glowing magma
    b.rock(0.95, 0.3, 0.85, 0x2b2630, 0, 0, 0, o).blob(0.3, 0.06, 0.3, 0xff5a14, 0, 0.28, 0, { R: R, tint: 0.1, n: 5 });
    for (let i = 0; i < 6; i++) { const a = i * 1.1, rr = i ? 0.3 : 0; b.cone(0.17 + R() * 0.08, 0, 0.7 + R() * 0.9 + (i ? 0 : 0.5), 5, [0x1f1a2e, 0x3b2a55, 0x2a1f40][i % 3], Math.cos(a) * rr, 0.25, Math.sin(a) * rr, { R: R, lx: (R() - 0.5) * 0.5, lz: (R() - 0.5) * 0.5 }); }
  }, (b, R, o) => {                                                    // a lava vent
    b.cone(0.75, 0.28, 0.7, 8, 0x2b2630, 0, 0, 0, { R: R, j: 0.12 }).cone(0.3, 0.2, 0.08, 8, 0x1f1a23, 0, 0.66, 0, { n: 8 }).blob(0.26, 0.06, 0.26, 0xff5a14, 0, 0.72, 0, { R: R, tint: 0.1, n: 6 }).blob(0.12, 0.05, 0.12, 0xffb43a, 0.02, 0.78, 0, { R: R, n: 5 });
    for (let i = 0; i < 3; i++) b.blob(0.05, 0.05, 0.05, 0xffb43a, (i - 1) * 0.12, 1.0 + i * 0.22, (i % 2 - 0.5) * 0.1, { n: 4 });
    for (let i = 0; i < 3; i++) b.box(0.07, 0.35, 0.05, 0xff6a1a, Math.cos(i * 2.1) * 0.42, 0.2, Math.sin(i * 2.1) * 0.42);
  }, (b, R, o) => {                                                    // basalt columns
    for (let i = 0; i < 6; i++) { const a = i * 1.05, rr = i ? 0.42 : 0; b.cone(0.2, 0.19, 0.6 + R() * 0.95, 6, i % 2 ? 0x2b2630 : 0x3a3340, Math.cos(a) * rr, 0, Math.sin(a) * rr, { j: 0.02, R: R }); }
  }],
  temple: [(b, R, o) => {                                              // a golden-crowned idol
    b.box(0.84, 0.24, 0.84, 0x8a8570, 0, 0.12, 0).box(0.66, 0.2, 0.66, 0x9a9170, 0, 0.34, 0).box(0.5, 0.62, 0.4, 0xb5ae8a, 0, 0.76, 0).box(0.4, 0.32, 0.38, 0xc4bd96, 0, 1.24, -0.02).box(0.54, 0.2, 0.44, 0xd9a63a, 0, 1.5, -0.02).box(0.3, 0.1, 0.1, 0xd9a63a, 0, 1.68, -0.02);
    b.box(0.08, 0.06, 0.04, 0x2a2a22, 0.1, 1.28, -0.22).box(0.08, 0.06, 0.04, 0x2a2a22, -0.1, 1.28, -0.22).box(0.12, 0.1, 0.06, 0xb5ae8a, 0, 1.18, -0.24).box(0.3, 0.05, 0.04, 0x2a2a22, 0, 1.1, -0.22);
    for (const s of [-1, 1]) b.box(0.14, 0.5, 0.18, 0xb5ae8a, s * 0.34, 0.72, 0).blob(0.2, 0.06, 0.2, 0x4f8f3f, s * 0.12, 0.5, 0.1, { R: R, tint: 0.2, n: 5 });
  }, (b, R, o) => {                                                    // a broken stepped column with a fallen drum and creepers
    b.box(0.9, 0.18, 0.9, 0x8a8570, 0, 0.09, 0).cone(0.34, 0.32, 0.5, 8, 0xb5ae8a, 0, 0.18, 0, { j: 0.02 }).cone(0.32, 0.3, 0.45, 8, 0xc4bd96, 0, 0.68, 0, { j: 0.02, lx: 0.05 }).cone(0.3, 0.1, 0.3, 7, 0xb5ae8a, 0.04, 1.12, 0, { R: R, j: 0.08, lx: 0.08 });
    b.cylX(0.5, 0.28, 0.28, 8, 0xa8a07c, 0.62, 0.28, 0.35, { R: R, cap: 0xc4bd96 }).blob(0.1, 0.5, 0.1, 0x3f7a2a, 0.3, 0.7, 0.28, { R: R, n: 5 }).blob(0.14, 0.04, 0.14, 0x4f8f3f, 0, 1.0, 0.2, { R: R, tint: 0.2, n: 5 });
  }, (b, R, o) => {                                                    // a mossy stone head
    b.blob(0.52, 0.5, 0.46, 0x8f8f7a, 0, 0.55, 0, { n: 7, R: R, tint: 0.08 }).blob(0.3, 0.1, 0.2, 0x7f7f6c, 0, 0.98, -0.05, { n: 6 }).box(0.8, 0.14, 0.7, 0x7a7a66, 0, 0.07, 0);
    b.blob(0.11, 0.12, 0.1, 0x8f8f7a, 0, 0.5, -0.46, { n: 5 }).box(0.18, 0.08, 0.06, 0x3a3a30, 0.2, 0.7, -0.44).box(0.18, 0.08, 0.06, 0x3a3a30, -0.2, 0.7, -0.44).box(0.36, 0.08, 0.06, 0x3a3a30, 0, 0.3, -0.44).box(0.62, 0.1, 0.1, 0xd9a63a, 0, 0.88, -0.38);
    b.blob(0.3, 0.1, 0.26, 0x4f8f3f, 0.05, 1.02, 0.1, { R: R, tint: 0.2, n: 6 }).blob(0.08, 0.3, 0.08, 0x3f7a2a, -0.4, 0.5, -0.2, { R: R, n: 5 });
  }]
};
const LOWP = {
  forest: [null, null, (b, R, o) => {                                  // a bramble with berries
    for (let i = 0; i < 5; i++) b.blob(0.3 + R() * 0.15, 0.22, 0.28 + R() * 0.1, i % 2 ? 0x3f8f35 : 0x2f7a2c, -0.4 + i * 0.2, 0.22, (R() - 0.5) * 0.3, { R: R, tint: 0.1, n: 5 });
    for (let i = 0; i < 7; i++) b.blob(0.045, 0.045, 0.045, 0xc2185b, -0.45 + R() * 0.9, 0.2 + R() * 0.25, -0.2 + R() * 0.4, { n: 4 });
  }],
  winter: [null, null, (b, R, o) => {                                  // a snow-laden shrub
    for (let i = 0; i < 4; i++) b.blob(0.3 + R() * 0.1, 0.22, 0.28, i % 2 ? 0x2f5a44 : 0x3a6b4f, -0.3 + i * 0.22, 0.2, (R() - 0.5) * 0.25, { R: R, n: 5 });
    for (let i = 0; i < 3; i++) b.blob(0.3, 0.09, 0.26, 0xffffff, -0.25 + i * 0.25, 0.4, (R() - 0.5) * 0.2, { R: R, tint: 0.04, n: 5 });
  }],
  desert: [null, null, (b, R, o) => {                                  // barrel cacti in bloom
    for (let i = 0; i < 3; i++) { const x = -0.3 + i * 0.3, h = 0.28 + R() * 0.2; b.blob(0.2, h, 0.2, 0x4f8a4a, x, h, (R() - 0.5) * 0.3, { R: R, n: 7 }).blob(0.07, 0.04, 0.07, i % 2 ? 0xe6559b : 0xffd23f, x, h * 2 + 0.02, 0, { n: 5 }); }
  }],
  volcano: [null, null, (b, R, o) => {                                 // a glowing fissure between rock heaps
    b.rock(0.6, 0.5, 0.6, 0x2b2630, -0.32, 0, 0, o).rock(0.55, 0.42, 0.55, 0x1f1a23, 0.34, 0, 0.05, o).box(0.44, 0.1, 0.12, 0xff6a1a, 0, 0.05, 0).box(0.3, 0.06, 0.08, 0xffb43a, 0, 0.1, 0);
    b.blob(0.05, 0.05, 0.05, 0xffb43a, 0.02, 0.5, 0, { n: 4 });
  }],
  temple: [null, null, (b, R, o) => {                                  // clay pots on a worn altar slab
    b.box(1.0, 0.2, 0.7, 0x9a9170, 0, 0.1, 0);
    for (let i = 0; i < 3; i++) { const x = -0.3 + i * 0.3, h = 0.3 + (i % 2) * 0.12; b.blob(0.15, h * 0.7, 0.15, 0xb5653a, x, 0.2 + h * 0.7, 0, { n: 6 }).cone(0.11, 0.09, 0.07, 7, 0x8f4a28, x, 0.2 + h * 1.4 - 0.02, 0, { n: 7 }).box(0.16, 0.03, 0.16, 0xd9a63a, x, 0.2 + h * 0.9, 0); }
  }]
};
const themed = (tbl, kind, th, v, fallback) => {
  const list = tbl[th.id], f = list && list[v % 3];
  return f ? geo(kind + 'T' + th.id + v, () => { const b = new Builder(), R = AH.seeded(kind + th.id + v); f(b, R, { R: R, j: 0.25 }); return b.build(); }) : fallback(th, v % 2);
};
W.TALL = TALL; W.LOWP = LOWP;                                  // biomes.js adds the newer environments' props to these tables
const rockGeo = (th, v) => themed(TALL, 'tall', th, v, rockGeoF);
const lowGeo = (th, v) => themed(LOWP, 'lowp', th, v, lowGeoF);
W.propGeo = (th, mode, v) => mode === 'rock' ? rockGeo(th, v) : lowGeo(th, v);
W.treeParts = treeParts;
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
function wpick(list, boost, u) { let t = 0; list.forEach(e => t += e[1] * (boost && boost[e[0]] || 1)); let x = (u === undefined ? rand() : u) * t; for (const e of list) { x -= e[1] * (boost && boost[e[0]] || 1); if (x <= 0) return e[0]; } return list[0][0]; }
function buildVehicle(th, heavy, dir, styleHint, lenHint, boost) {
  const Lr = (a, c) => lenHint === undefined ? rnd(a, c) : a + lenHint * (c - a);          // length comes from the layout stream (lenHint 0..1) so the look of a car can't change how long it is
  const style = wpick(heavy ? VEH_HEAVY : VEH_LIGHT, boost, styleHint);          // which vehicle it is, and how long, both come from the layout stream (hints 0..1): its hitbox follows from them
  const b = new Builder(), X = (w, h, d, c, x, y, z) => b.box(w, h, d, c, dir * x, y, z);
  /* a wedge: sd = +1 means the tall end is at the rear and the slope runs down to the front (a windshield); -1 is a rear window. y0 is the base height. */
  const XW = (len, h, wid, c, x, y0, z, sd) => b.wedge(len, h, wid, c, dir * x, y0, z, sd * dir);
  const col = style === 'taxi' ? 0xf5c518 : pick(CAR_COLORS), lite = mixHex(col, 0xffffff, 0.28), dk = mixHex(col, 0x000000, 0.25), snow = th.id === 'winter' && rand() < 0.65;
  const wheels = (L, n) => { for (let k = 0; k < n; k++) { const xw = n === 2 ? (k ? -L * 0.3 : L * 0.3) : L * (0.34 - k * (0.68 / (n - 1))); X(0.3, 0.3, 0.1, TIRE, xw, 0.15, 0.4); X(0.3, 0.3, 0.1, TIRE, xw, 0.15, -0.4); } };
  const lights = L => { X(0.05, 0.09, 0.6, 0xfff1a6, L / 2, 0.36, 0); X(0.05, 0.09, 0.6, 0xd7263d, -L / 2, 0.36, 0); };
  let L;
  if (style === 'sedan' || style === 'taxi') {
    L = Lr(1.6, 1.95);
    X(L, 0.3, 0.78, col, 0, 0.32, 0); X(L * 0.28, 0.02, 0.7, lite, L * 0.3, 0.485, 0);                          // body and bonnet
    X(L * 0.3, 0.26, 0.7, GLASS, -L * 0.06, 0.6, 0); X(L * 0.3, 0.05, 0.72, lite, -L * 0.06, 0.755, 0);          // cabin and roof
    XW(L * 0.22, 0.26, 0.7, GLASS, L * 0.2, 0.47, 0, 1); XW(L * 0.16, 0.26, 0.7, GLASS, -L * 0.29, 0.47, 0, -1);  // raked windshield and rear window
    if (style === 'taxi') { X(0.3, 0.1, 0.2, 0xfff7d1, -L * 0.06, 0.83, 0); X(L * 0.9, 0.05, 0.8, 0x1c1f26, 0, 0.42, 0); }
    else if (snow) X(L * 0.3, 0.06, 0.7, 0xffffff, -L * 0.06, 0.79, 0);
    lights(L); wheels(L, 2);
  } else if (style === 'hatch') {
    L = Lr(1.35, 1.6);
    X(L, 0.3, 0.78, col, 0, 0.32, 0); X(L * 0.46, 0.28, 0.7, GLASS, -L * 0.12, 0.61, 0); X(L * 0.46, 0.05, 0.72, lite, -L * 0.12, 0.775, 0);
    XW(L * 0.22, 0.28, 0.7, GLASS, L * 0.22, 0.47, 0, 1); X(0.06, 0.2, 0.5, dk, -L / 2, 0.58, 0);
    if (snow) X(L * 0.46, 0.06, 0.7, 0xffffff, -L * 0.12, 0.81, 0);
    lights(L); wheels(L, 2);
  } else if (style === 'suv') {
    L = Lr(1.8, 2.05);
    X(L, 0.4, 0.82, col, 0, 0.38, 0); X(L * 0.5, 0.34, 0.74, GLASS, -L * 0.1, 0.78, 0); X(L * 0.5, 0.05, 0.76, lite, -L * 0.1, 0.975, 0); X(L * 0.44, 0.04, 0.58, DARKM, -L * 0.1, 1.01, 0); X(0.12, 0.3, 0.3, TIRE, -L / 2 - 0.06, 0.5, 0);
    XW(L * 0.17, 0.34, 0.74, GLASS, L * 0.34, 0.58, 0, 1);
    if (snow) X(L * 0.44, 0.06, 0.66, 0xffffff, -L * 0.1, 1.05, 0);
    lights(L); wheels(L, 2);
  } else if (style === 'sports') {
    L = Lr(1.5, 1.75);
    X(L, 0.22, 0.82, col, 0, 0.26, 0); X(L * 0.2, 0.18, 0.68, GLASS, -L * 0.08, 0.46, 0); X(L * 0.2, 0.04, 0.7, lite, -L * 0.08, 0.57, 0);
    XW(L * 0.28, 0.18, 0.68, GLASS, L * 0.16, 0.37, 0, 1); XW(L * 0.2, 0.18, 0.68, GLASS, -L * 0.28, 0.37, 0, -1);
    X(L * 0.96, 0.015, 0.14, 0xffffff, 0, 0.378, 0); X(0.16, 0.04, 0.78, DARKM, -L / 2 + 0.05, 0.52, 0);
    lights(L); wheels(L, 2);
  } else if (style === 'pickup') {
    L = Lr(2.0, 2.3);
    X(L, 0.24, 0.8, col, 0, 0.3, 0); X(L * 0.2, 0.28, 0.72, GLASS, L * 0.06, 0.56, 0); X(L * 0.2, 0.05, 0.74, lite, L * 0.06, 0.72, 0);
    XW(L * 0.2, 0.28, 0.72, GLASS, L * 0.26, 0.42, 0, 1);
    X(L * 0.46, 0.16, 0.06, dk, -L * 0.26, 0.5, 0.37); X(L * 0.46, 0.16, 0.06, dk, -L * 0.26, 0.5, -0.37); X(0.06, 0.16, 0.74, dk, -L / 2 + 0.03, 0.5, 0);
    if (rand() < 0.6) X(rnd(0.3, 0.5), rnd(0.2, 0.34), 0.5, pick(CARGO_COLORS), -L * 0.28, 0.56, 0);
    lights(L); wheels(L, 2);
  } else if (style === 'van') {
    L = Lr(1.9, 2.2);
    X(L, 0.3, 0.82, col, 0, 0.32, 0); X(L * 0.72, 0.3, 0.84, col, -L * 0.14, 0.62, 0); X(L * 0.5, 0.14, 0.86, GLASS, -L * 0.05, 0.66, 0); X(L * 0.72, 0.05, 0.84, lite, -L * 0.14, 0.795, 0);
    XW(L * 0.28, 0.3, 0.78, GLASS, L * 0.36, 0.47, 0, 1); X(L * 0.9, 0.06, 0.84, pick(CARGO_COLORS), 0, 0.34, 0);
    lights(L); wheels(L, 2);
  } else if (style === 'bus') {
    L = Lr(3.2, 3.7);
    X(L - 0.5, 0.85, 0.84, col, -0.25, 0.575, 0); X((L - 0.5) * 0.92, 0.24, 0.86, GLASS, -0.25, 0.78, 0); X(L - 0.5, 0.05, 0.8, lite, -0.25, 1.02, 0); X(0.7, 0.1, 0.5, 0xcfd6df, -L * 0.15, 1.08, 0); X(L - 0.5, 0.08, 0.86, 0xffffff, -0.25, 0.34, 0);
    X(0.5, 0.38, 0.84, col, L / 2 - 0.25, 0.34, 0); XW(0.5, 0.47, 0.84, GLASS, L / 2 - 0.25, 0.53, 0, 1);
    lights(L); wheels(L, 3);
  } else {                                                                      // boxtruck, flatbed, tanker: a cab pulling something
    L = Lr(2.7, 3.3);
    const cab = pick(CAR_COLORS), cx = L / 2 - 0.48;
    X(0.95, 0.34, 0.84, cab, cx, 0.32, 0); X(0.55, 0.3, 0.84, cab, cx - 0.2, 0.64, 0); X(0.55, 0.05, 0.86, mixHex(cab, 0xffffff, 0.3), cx - 0.2, 0.805, 0); XW(0.4, 0.3, 0.8, GLASS, cx + 0.275, 0.49, 0, 1);
    X(L * 0.96, 0.14, 0.7, DARKM, 0, 0.2, 0);
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
  const m = new T.Mesh(flowGeo(th, ri(0, 2)), AH.VMC); row.group.add(m);
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
  else if (id === 'forest' || id === 'temple' || id === 'rainforest' || id === 'lake') b.box(rnd(0.3, 0.7), 0.05, w0 * rnd(0.3, 0.6), 0x4f8f3f, rnd(-len * 0.4, len * 0.4), h0 / 2 + 0.02, rnd(-0.1, 0.1));
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
  if (W.beastStyles && W.beastStyles[style]) return W.beastStyles[style](new Builder(), dir);
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
const flip = () => lrand() < 0.5 ? -1 : 1;
const HAZ = { road: 1, water: 1, lily: 1, rail: 1, roll: 1, tide: 1 };       // lanes that always sit inside a flat, protected zone
const OPT_ONLY = { lake: 1, tide: 1, ice: 1 };                                       // lane kinds that only appear in themes that ask for them
const mixOf = (mix, t) => mix[t] === undefined ? (OPT_ONLY[t] ? 0 : 1) : mix[t];
W.lakes = [];

/* ---- type selection ---- */
const TYPES = [['grass', 0.08, 1, 2, 0], ['road', 0.26, 1, 1, 0], ['water', 0.2, 2, 3, 0], ['rail', 0.08, 1, 2, 12], ['lily', 0.1, 2, 3, 6]];
/* ---- pre-set structures ("chunks") ----
 * A chunk is a short authored sequence of lanes. Every chunk rolls its own numbers when placed. A builder returns one spec per row:
 * { type, dir, spd, n, truck, pad, tp, rock, step, y, flat, bg, lane, lk, lake, pc }. makeRow reads the spec; unspecified fields keep the normal random behaviour.
 * Hazard chunks (roads, rivers, rails, rockslides, tides) are wrapped in two FLAT buffer rows on each side that carry the hazard's own background shape, so the ground never
 * steps up or down inside or right beside them and the background always matches. A road lane is FIVE rows deep (see roadLane). `y` is relative to the level at the chunk's start. */
const lanes = (type, n, f) => { const o = []; for (let i = 0; i < n; i++) o.push(Object.assign({ type: type, ci: i, cn: n }, f ? f(i) : null)); return o; };
const calm = () => ({ type: 'grass', tp: lrnd(0.32, 0.42) });
const buf = (bg, n) => lanes('grass', n === undefined ? 2 : n, () => ({ tp: lrnd(0.3, 0.4), flat: true, bg: bg, buffer: true }));
const wrap = (bg, specs, v) => { const bv = v || bgVariant(bg), all = [].concat(buf(bg), specs, buf(bg)); all.forEach(q => { q.bgv = bv; }); return all; };
/* one traffic lane: five rows (five hops to cross), traffic runs along the middle of it. The outer two rows are the safe verge. */
let lastTraffic = null;                                                      // so two neighbouring lanes never have the same personality
const roadLane = f => { const L = Object.assign({ dir: flip(), bg: 'pass' }, f), out = []; L.kind = C.pickTraffic(lrand, lastTraffic); lastTraffic = L.kind; for (let k = 0; k < 5; k++) out.push({ type: 'road', lane: L, lk: k, bg: L.bg, dir: L.dir, flat: true }); return out; };
const isWildTheme = th => !!(AH.BEASTS && AH.BEASTS[th.id]);
const WILD = { id: 'wildlands', min: 0, types: ['grass'], w: 3, build() { const tp = lrnd(0.06, 0.12); return [].concat(lanes('grass', lri(6, 10), () => ({ wild: true, tp: tp, bg: 'dense' })), [calm()]); } };
const hillsY = (n, peak, sg, i) => sg * Math.round(peak * Math.sin(Math.PI * (i + 0.5) / n) * 1.15);
const CHUNKS = [
  { id: 'river', min: 6, types: ['lily', 'water'], w: 1.3, build() {
    const d = flip(), sp = lrnd(0.9, 1.15), a = lri(1, 2), c = lri(2, 3), bg = lrand() < 0.4 ? 'falls' : 'river';
    return [].concat(wrap(bg, [].concat(lanes('lily', a, () => ({ pad: lrnd(0.3, 0.5), bg: bg })), lanes('water', c, i => ({ dir: i % 2 ? -d : d, spd: sp * lrnd(0.9, 1.15), bg: bg })))), [calm()]); } },
  { id: 'highway', min: 0, types: ['road'], w: 1.1, build() {
    const d = flip(), n1 = lri(1, 2), n2 = lri(1, 2), bg = lrand() < 0.5 ? 'pass' : 'pass2', sp = [];
    for (let i = 0; i < n1; i++) sp.push(roadLane({ dir: i % 2 ? -d : d, bg: bg }));
    sp.push([{ type: 'grass', tp: lrnd(0.1, 0.25), flat: true, bg: bg }]);
    for (let i = 0; i < n2; i++) sp.push(roadLane({ dir: i % 2 ? d : -d, bg: bg }));
    return [].concat(wrap(bg, [].concat.apply([], sp)), [calm()]); } },
  { id: 'railyard', min: 12, types: ['rail', 'grass'], w: 0.9, build() {
    return [].concat(wrap('tunnel', [].concat(lanes('rail', 2, () => ({ dir: flip(), bg: 'tunnel' })), [{ type: 'grass', tp: lrnd(0.15, 0.3), flat: true, bg: 'tunnel' }], lanes('rail', lri(1, 2), () => ({ dir: flip(), bg: 'tunnel' })))), [calm()]); } },
  { id: 'maze', min: 0, types: ['grass'], w: 1.8, build() {
    const n = lri(4, 6), tp = lrnd(0.2, 0.3), y = lpick([0, 0, 1, -1]); let st = flip();
    return [].concat(lanes('grass', n, () => { if (lrand() < 0.35) st = -st; return { tp: tp, rock: lrnd(0.2, 0.6), step: lrand() < 0.2 ? 0 : st, bg: 'dense', y: y }; }), [calm()]); } },
  { id: 'boulders', min: 4, types: ['roll', 'grass'], w: 1.1, build() {              // a rockslide: waves of boulders tumble down the hill on one side and cross every lane together (rules in course.js)
    const d = flip(), rs = C.rockslide(lrand, d, PER, WRAP);
    return [].concat(wrap('scree', lanes('roll', rs.n, () => ({ dir: d, spd: 1, grp: rs.grp, bg: 'scree' }))), [calm()]); } },
  { id: 'stones', min: 6, types: ['lily'], w: 1, build() {
    const pad = lrnd(0.24, 0.36), bg = lrand() < 0.35 ? 'falls' : 'river'; return [].concat(wrap(bg, lanes('lily', lri(4, 5), () => ({ pad: pad, bg: bg }))), [calm()]); } },
  { id: 'crossroads', min: 12, types: ['road', 'rail'], w: 0.8, build() {
    const d = flip(); return [].concat(wrap('pass', [].concat(roadLane({ dir: d }), lanes('rail', 1, () => ({ dir: flip(), bg: 'pass' })), roadLane({ dir: -d })), [{ k: 0, sh: 0 }, { k: 0, sh: 0 }]), [calm()]); } },
  { id: 'island', min: 6, types: ['water', 'grass'], w: 1, build() {
    const d = flip(), sp = lrnd(0.9, 1.2), bg = 'river';
    return [].concat(wrap(bg, [].concat(lanes('water', lri(2, 3), i => ({ dir: i ? -d : d, spd: sp, bg: bg })), [{ type: 'grass', tp: lrnd(0.12, 0.25), flat: true, bg: bg }], lanes('water', lri(2, 3), i => ({ dir: i ? d : -d, spd: sp * 1.1, bg: bg })))), [calm()]); } },
  { id: 'pits', min: 5, types: ['grass'], w: 0, build() {                           // a field of holes: ice water, quicksand, lava, dark pits, bog (see HOLEC). Always a path through.
    const p = lrnd(0.28, 0.42), n = lri(3, 5); return [].concat(lanes('grass', n, () => ({ holes: p, flat: true, tp: 0.1 })), [calm()]); } },
  { id: 'icefield', min: 5, types: ['ice'], w: 3.6, build() {                          // slippery ice: every hop slides one block further, and there are holes in it
    const p = lrnd(0.1, 0.18), n = lri(4, 6); return [].concat(lanes('grass', n, () => ({ ice: true, holes: p, flat: true, tp: 0.22 })), [calm()]); } },
  { id: 'hills', min: 3, types: ['grass'], w: 0.5, build() {                       // a rolling climb up to a plateau (or down into a valley) and back; sometimes the edges curve away
    const n = lri(6, 9), peak = lri(1, 2), sg = flip(), bg = lrand() < 0.4 ? 'dip' : 'hills', tp = lrnd(0.08, 0.16);
    return [].concat(lanes('grass', n, i => ({ tp: tp, rock: lrnd(0.1, 0.35), y: hillsY(n, peak, sg, i), bg: bg })), [calm()]); } },
  { id: 'glade', min: 3, types: ['grass'], w: 0.4, build() {                         // a sunken, tree-lined hollow
    return [].concat(lanes('grass', lri(4, 6), () => ({ tp: lrnd(0.12, 0.2), rock: lrnd(0.1, 0.3), y: -1, bg: 'cliffs' })), [calm()]); } },
  { id: 'plateau', min: 3, types: ['grass'], w: 0.5, build() {                       // a raised (or sunken) block of ground with ramps on both ends, in a safe stretch
    const sg = flip(), pk = lri(1, 2), n = lri(3, 5), bg = pk > 1 ? 'cliffs' : 'hills', o = [];
    for (let i = 0; i < pk - 1; i++) o.push({ type: 'grass', tp: 0.06, y: sg * (i + 1), bg: bg });
    for (let i = 0; i < n; i++) o.push({ type: 'grass', tp: lrnd(0.08, 0.16), rock: lrnd(0.2, 0.5), y: sg * pk, bg: bg });
    for (let i = pk - 1; i > 0; i--) o.push({ type: 'grass', tp: 0.06, y: sg * i, bg: bg });
    return o.concat([calm()]); } },
  { id: 'terraces', min: 3, types: ['grass'], w: 0.4, build() {                       // a staircase of terraces up and back down
    const sg = flip(), st = lri(2, 3), o = [];
    for (let i = 1; i <= st; i++) for (let k = 0; k < 2; k++) o.push({ type: 'grass', tp: lrnd(0.06, 0.14), rock: 0.4, y: sg * i, bg: 'hills' });
    for (let i = st - 1; i >= 0; i--) for (let k = 0; k < 2; k++) o.push({ type: 'grass', tp: lrnd(0.06, 0.14), rock: 0.4, y: sg * i, bg: 'hills' });
    return o.concat([calm()]); } },
  { id: 'lake', min: 6, types: ['lake'], w: 0, build() {                            // a big lake in the strip: walk around its curved shore. The rim rows rise (or the middle sinks) so the shore has its own heights.
    const n = lri(8, 12), side = flip(), rx = lrnd(3.4, 4.6), cx = side > 0 ? lrnd(-3.2, -0.8) : lrnd(0.8, 3.2), rimUp = lrand() < 0.5, o = [];
    const L = { cx: cx, rx: rx, n: n, side: side, r0: 0, r1: 0, zc: 0 };
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n * 2 - 1, edge = Math.abs(t) > 0.62;
      o.push({ type: 'grass', lake: L, li: i, tp: lrnd(0.08, 0.16), rock: lrnd(0.1, 0.4), bg: 'hills', y: rimUp ? (edge ? 1 : 0) : (edge ? 0 : -1) });
    }
    return [].concat(buf('hills', 1), o, [calm()]); } },
  { id: 'tides', min: 4, types: ['tide'], w: 3, build() {
    return [].concat(wrap(null, lanes('tide', lri(2, 3), () => ({ bg: null }))), [calm()]); } }
];
function hazardRun(type) {
  if (type === 'road') {
    const bg = lrand() < 0.5 ? 'pass' : 'pass2', n = lrand() < 0.35 ? 2 : 1, d = flip(), sp = [];
    for (let i = 0; i < n; i++) sp.push(roadLane({ dir: i % 2 ? -d : d, spd: lrnd(0.9, 1.2), bg: bg }));
    return wrap(bg, [].concat.apply([], sp));
  }
  const bg = lrand() < 0.3 ? 'falls' : 'river', d = flip();
  if (type === 'water') return wrap(bg, lanes('water', lri(2, 3), i => ({ dir: i % 2 ? -d : d, spd: lrnd(0.9, 1.2), bg: bg })));
  return wrap(bg, lanes('lily', lri(2, 3), () => ({ pad: lrnd(0.3, 0.5), bg: bg })));
}
function startQueue(specs) { W.queue = specs; W.cb = W.ey; W.gY = AH.clamp(W.ey, -1, 1); W.spec = W.queue.shift(); W.run = W.spec.type; W.runLeft = 0; return W.spec.type; }
function tryChunk(r) {
  const th0 = AH.themeAt(r), mix = th0.mix, pool = [], wildT = isWildTheme(th0), room = AH.nextArena(r) - 3;
  CHUNKS.concat(wildT ? [WILD] : []).forEach(c => {
    if (r < c.min || (wildT && c.types.indexOf('road') >= 0)) return;
    const k = c.types.reduce((a, t) => a + mixOf(mix, t), 0) / c.types.length; if (k > 0) pool.push([c, c.w * k]);
  });
  for (let tries = 0; tries < 5 && pool.length; tries++) {                           // pacing (course.js) picks the kind of stretch; if it doesn't fit before the next arena, try another
    const ch = C.choose(pool, W, lrand); if (!ch) return false;
    const specs = ch.build();
    if (r + specs.length > room) { pool.splice(pool.findIndex(e => e[0] === ch), 1); continue; }
    if (ch.id === 'lake') { const L = specs.find(q => q.lake).lake, first = r + 1; L.r0 = first; L.r1 = first + L.n - 1; L.zc = (L.r0 + L.r1) / 2; W.lakes.push(L); }
    notePlaced(ch.id, C.isChallenge(ch), specs.length);
    startQueue(specs);
    return true;
  }
  return false;
}
/* pacing bookkeeping: a challenge owes the player some rest afterwards; rest stretches pay it off */
function notePlaced(id, challenge, rows) {
  W.lastChunk = id; W.recent.push(id); if (W.recent.length > 6) W.recent.shift();
  W.restLeft = challenge ? C.restRows(lrand) : Math.max(0, W.restLeft - rows);
}
const CHUNK_ONLY = { rail: 1, tide: 1, lake: 1 };          // these only ever appear inside authored structures; scattered randomly they look odd
function pickType(r) {
  const A = W.arenaStart(r);
  W.spec = null;
  if (r < 0) { W.spec = { back: true, tp: 0, bg: r < -9 ? 'mountain' : r < -3 ? 'dense' : 'hills' }; return 'grass'; }       // the land behind the start line
  if (A >= 0) { W.queue = []; W.runLeft = 0; W.restLeft = TUNE.rest.afterArena; return (r - A === AH.ARENA_LEN - 1) ? 'gate' : 'arena'; }
  if (r <= 2 || AH.nextArena(r) - r <= 2 || (r > AH.ARENA_EVERY && (r - AH.ARENA_EVERY) % AH.PERIOD === AH.ARENA_LEN)) return 'grass';
  if (W.queue.length) { W.spec = W.queue.shift(); W.run = W.spec.type; W.runLeft = 0; return W.spec.type; }
  if (W.runLeft <= 0 && tryChunk(r)) return W.spec.type;
  if (W.runLeft <= 0) {
    const th = AH.themeAt(r), mix = th.mix;
    const avail = TYPES.filter(e => r >= e[4] && !CHUNK_ONLY[e[0]]).map(e => [e[0], e[1] * (mix[e[0]] || 1), e[2], e[3]]);
    const tot = avail.reduce((s, e) => s + e[1], 0);
    let e;
    do { let x = lrand() * tot, acc = 0; for (let i = 0; i < avail.length; i++) { acc += avail[i][1]; if (x < acc || i === avail.length - 1) { e = avail[i]; break; } } } while (e[0] === W.run);
    if (e[0] === 'road' && isWildTheme(th)) {            // creatures never ride along roads: those lanes become a wildland instead
      const sp = WILD.build();
      if (r + sp.length <= AH.nextArena(r) - 3) { notePlaced('wildlands', false, sp.length); return startQueue(sp) && 'grass'; }
      e = ['grass', 1, 1, 2];
    } else if (HAZ[e[0]] && W.restLeft <= 0) {           // (a challenge is never started while rest is still owed)
      const sp = hazardRun(e[0]);
      if (r + sp.length <= AH.nextArena(r) - 3) { notePlaced('run', true, sp.length); return startQueue(sp); }
      e = ['grass', 1, 1, 2];
    } else if (HAZ[e[0]]) e = ['grass', 1, 1, 2];
    W.run = e[0]; W.runLeft = lri(e[2], e[3]);
  }
  W.runLeft--;
  if (W.run === 'grass' && W.restLeft > 0) W.restLeft--;
  return W.run;
}

/* ---- terrain: ONE continuous height field ----
 * The playable strip is flat across (every lane sits at its own elevation, joined by smooth slopes). Beyond it the very same surface runs on into hills, mountains, cliffs,
 * river banks, tunnels, waterfalls, dips or the sea, chosen by the row's `bg` preset. `pre` is how far the lane's own surface (water, track bed) carries on flat before the land
 * rises. Rows in one hazard share one preset, and their buffer rows share it too, so a lane never ends against an unrelated background. */
const hash3 = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 1597334677) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const sm = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const vn = (a, b, c) => { const ia = Math.floor(a), ib = Math.floor(b), fa = sm(a - ia), fb = sm(b - ib), h = (i, j) => hash3(i, j, c);
  return h(ia, ib) * (1 - fa) * (1 - fb) + h(ia + 1, ib) * fa * (1 - fb) + h(ia, ib + 1) * (1 - fa) * fb + h(ia + 1, ib + 1) * fa * fb; };
const X0 = AH.BGX - 1.4;                                              // where the flat strip ends and the shaped land begins
const SEA_Y = -1.55;                                                  // absolute height of the sea surface
const BGP = { hills: { A: 1.7, w: 6, r: 0.5 }, dense: { A: 2.6, w: 5, r: 0.7 }, mountain: { A: 6.5, w: 5, r: 1.3 }, cliffs: { A: 3.6, w: 3.4, r: 0.8 },
  scree: { A: 5.5, w: 4.5, r: 1.7 }, pass: { L: { A: 4, w: 9, r: 0.25 }, R: { A: -3.6, w: 9, r: 0.25 } }, pass2: { L: { A: -3.6, w: 9, r: 0.25 }, R: { A: 4, w: 9, r: 0.25 } },
  dip: { A: -3.2, w: 5, r: 0.3 }, falls: { A: -4.6, w: 3.5, r: 0 }, bowl: { A: 3.2, w: 5, r: 0.4 }, ridge: { A: 6, w: 4.5, r: 0.9 },
  river: { A: 4.2, w: 2.4, r: 0.5, pre: 1.0 }, tunnel: { A: 7, w: 2.2, r: 0.9, pre: 8.4 },
  shore: { L: { A: -5.8, w: 6, r: 0.3 }, R: { A: 2.4, w: 5.5, r: 0.9 } }, shore2: { L: { A: 2.4, w: 5.5, r: 0.9 }, R: { A: -5.8, w: 6, r: 0.3 } } };
const DEFBG = { grass: 'hills', road: 'pass', rail: 'tunnel', roll: 'scree', water: 'river', lily: 'river', tide: 'hills', arena: 'bowl', gate: 'ridge' };
const OFFY = { water: -0.3, lily: -0.3 };                             // water sits a little below its lane's elevation
const RAMP0 = 0.12, ramp = u => sm((Math.abs(u) - RAMP0) / (0.5 - RAMP0)), cramp = u => sm((Math.abs(u) - 0.42) / 0.08);
/* The land behind a lane is NOT always a curve of the same height. v = { k, sh } for a side: k scales the height (0 is dead flat) and sh picks the profile
 * (0 a smooth curve, 1 a straight ramp, 2 a terraced step). Hazard runs roll one v for the whole run (bgVariant, below), so a lane and its buffer rows always agree;
 * ordinary ground wanders between flat, low and tall as it goes along, smoothly, so neighbouring rows never disagree. */
const FREEBG = { hills: 1, dense: 1, mountain: 1, cliffs: 1, dip: 1, bowl: 0 };
function bgVariant(kind) {
  const one = () => {
    const q = rand(), sh = rand() < 0.5 ? 0 : rand() < 0.6 ? 1 : 2;
    if (kind === 'river') return rand() < 0.62 ? { k: rnd(0.7, 1.25), sh: sh } : { k: -rnd(0.55, 0.95), sh: sh };       // a river's banks always rise or fall away: never a flat edge
    if (kind === 'falls' || kind === 'bowl' || kind === 'ridge' || kind === 'scree' || !kind) return { k: 1, sh: 0 };     // a waterfall needs its drop, boulders need their hill
    if (q < (kind === 'tunnel' ? 0.12 : 0.06)) return { k: 0, sh: 0 };                                      // flat
    if (kind === 'tunnel') return { k: rnd(0.95, 1.25), sh: 0 };                                           // a train needs a flat run-out or a proper hill, never a low bump
    if (q < 0.3) return { k: rnd(0.55, 0.8), sh: sh };                                                     // low
    return { k: rnd(0.85, 1.25), sh: sh };
  };
  const a = one(); return [a, (kind === 'tunnel' || rand() < 0.5) ? a : one()];                              // rails need the same land on both sides
}
function sideParams(r, side, kind, v) {
  let P = BGP[kind] || BGP.hills; if (P.L) P = side === 0 ? P.L : P.R;
  const n = vn(r * 0.22, side * 7 + 1, 3);
  let m = 1, sh = 0;
  if (v) { m = v[side].k; sh = v[side].sh; }
  else if (FREEBG[kind]) { const q = vn(r * 0.03, side * 5 + 31, 3), q2 = vn(r * 0.025, side * 5 + 47, 3); m = q < 0.2 ? 0.55 + (q - 0.2) * 1.5 : Math.min(1.2, 0.55 + (q - 0.2) / 0.3 * 0.6); sh = Math.max(0, Math.min(2, (q2 - 0.3) * 4)); }
  return { A: P.A * (P.A < 0 ? 0.85 + 0.3 * n : 0.55 + 0.9 * n) * m, w: P.w * (0.85 + 0.3 * vn(r * 0.2, side * 5 + 2, 4)), r: P.r * Math.min(1, Math.abs(m)), f: kind === 'falls' ? 1 : 0, pre: P.pre || 0, sh: sh };
}
const prof = (t, sh) => { const c = sm(t), l = Math.min(t, 1.15) / 1.15, st = 0.55 * sm(t * 2) + 0.45 * sm(t * 2 - 1.1); return sh <= 1 ? c + (l - c) * sh : l + (st - l) * (sh - 1); };
const THEME_CAP = { winter: 0xffffff, volcano: 0x4a4048, desert: 0xf0d9a0, beach: 0xf5e6b8, lake: 0xdfeaf2, rainforest: 0x8a9086 };
const RGBC = {}, RGB = hex => RGBC[hex] || (RGBC[hex] = (c => [c.r, c.g, c.b])(new T.Color(hex)));
const mixRGB = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
/* a lake's depth at row-coordinate q (= row - u) and x. Continuous in q, so neighbouring rows meet exactly. */
function lakeW(L, q) { const t = (q - L.zc) / (L.n / 2); return Math.abs(t) >= 1 ? 0 : L.rx * Math.pow(1 - t * t, 0.6); }
function lakeDip(q, x) {
  for (let i = 0; i < W.lakes.length; i++) {
    const L = W.lakes[i]; if (q < L.r0 - 0.5 || q > L.r1 + 0.5) continue;
    const d = lakeW(L, q) - Math.abs(x - L.cx); if (d > 0) return 0.55 * sm(d / 1.1);
  }
  return 0;
}
W.lakeW = lakeW;
function makeTerrain(row, th, laneHex) {
  const own = row.tp, ry = row.y, nb = u => u < 0 ? (row.tn || own) : (row.tb || own), mix = (u, a, b) => a + ((a + b) / 2 - a) * ramp(u);
  /* The ground height along the row is a cubic Hermite through the row's own level and the seam levels, with the seam slope taken from the neighbouring rows' levels, so a steady
   * climb is a steady slope (not a staircase of flat seams and steep middles, which showed up as dark stripes across the ground). */
  const Y = u => { const yN = (row.tn || own).y, yB = (row.tb || own).y, s = u < 0 ? -1 : 1, t = Math.abs(u) / 0.5, n = s < 0 ? yN : yB, p1 = (own.y + n) / 2, m0 = 0.25 * s * (yB - yN), m1 = 0.5 * (n - own.y), t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * own.y + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1; };
  const SP = (u, sd, k) => mix(u, own[sd][k], nb(u)[sd][k]);
  const laneC = u => {                                                     // exactly the average of the two lanes on the seam, so neighbouring rows meet without a visible line
    const nbT = nb(u), k = (own.crisp || nbT.crisp) ? cramp(u) : ramp(u);
    return mixRGB(own.lane, nbT.lane, 0.5 * k);
  };
  const holeDip = (u, x) => { if (!row.holes) return 0; const cx = Math.round(x); if (!row.wet.has(cx)) return 0; const e = Math.min(0.5 - Math.abs(x - cx), 0.5 - Math.abs(u)); return e <= 0 ? 0 : 0.5 * sm(e / 0.2); };
  const sea = th.sea, holeCol = RGB(HOLEC[th.id] || 0x2f6f9f);
  const H = (u, x) => {
    const y = Y(u), ax = Math.abs(x), zw = row.r - u;
    if (ax <= X0) return y - ry - (W.lakes.length ? lakeDip(zw, x) : 0) - holeDip(u, x);
    const sd = x < 0 ? 'L' : 'R', A = SP(u, sd, 'A'), w = SP(u, sd, 'w'), rg = SP(u, sd, 'r'), pre = SP(u, sd, 'pre'), s = ax - X0 - pre;
    if (s <= 0) return y - ry;
    const t = s / w;
    let h = A * prof(t, SP(u, sd, 'sh'));
    if (A > 0 && t > 1) h += A * 0.1 * Math.min(t - 1, 1.5);                        // keeps climbing a little: mountains, not plateaus
    h += rg * Math.min(1, s / 2.5) * ((vn(ax * 0.42, zw * 0.42, 5) - 0.5) * 1.8 + (vn(ax * 1.1, zw * 1.1, 6) - 0.5) * 0.5) * (A >= 0 ? 1 : 0.25);
    return y + h - ry;
  };
  const ground = RGB(row.gnd || th.ground[0]), rock = th.rock.map(RGB), cap = RGB(THEME_CAP[th.id] || th.rock[0]), mist = RGB(0xdcebf5), foam = RGB(0xffffff), water = RGB(th.water), dark = mixRGB(ground, [0, 0, 0], 0.4);
  const earth = RGB((th.roll && th.roll.hill) || 0x7b5a3c), earthD = mixRGB(earth, [0, 0, 0], 0.25), wetSand = mixRGB(ground, [0.25, 0.2, 0.12], 0.45), deep = mixRGB(water, [0, 0.05, 0.15], 0.35);
  const C = (u, x, y) => {
    const ax = Math.abs(x), lane = laneC(u), zw = row.r - u;
    if (ax <= X0) {
      if (row.holes) { const hd = holeDip(u, x); if (hd > 0.001) return mixRGB(mixRGB(lane, mixRGB(holeCol, [0, 0, 0], 0.5), sm(hd / 0.1) * 0.6), holeCol, sm((hd - 0.1) / 0.25)); }
      if (W.lakes.length) {
        const dp = lakeDip(zw, x);
        if (dp > 0.001) { const c0 = mixRGB(lane, wetSand, sm(dp / 0.12)); return mixRGB(c0, deep, sm((dp - 0.2) / 0.3)); }
      }
      return lane;
    }
    const sd = x < 0 ? 'L' : 'R', pre = SP(u, sd, 'pre'), s = ax - X0 - pre, h = y - (Y(u) - ry), nz = 1 + (vn(ax * 0.7, zw * 0.7, 7) - 0.5) * 0.1;
    const slope = Math.abs(H(u, x + 0.45) - H(u, x - 0.45)) / 0.9;
    let c = mixRGB(own.g || ground, nb(u).g || ground, 0.5 * ramp(u));       // the background ground colour meets its neighbour's exactly on the seam
    if (row.kind === 'scree' || row.kind === 'mountain') c = mixRGB(earth, rock[0], Math.max(0, Math.min(0.45, (vn(ax * 0.25, zw * 1.4, 8) - 0.35) * 1.2)));        // a rocky, earthy brown hill
    if (row.kind === 'scree') c = mixRGB(c, earthD, Math.min(0.5, slope * 0.2));
    const rk = sm((slope - 0.85) / 1.1) * 0.75;                                      // bare rock only where it is steep, not just because it is high
    c = mixRGB(c, rock[1], rk);
    if (h > 3.6) c = mixRGB(c, cap, Math.min(1, (h - 3.6) / 1.6));                   // snow, ash, pale stone near the tops
    if (h < -0.2) c = mixRGB(c, dark, Math.min(0.5, -h * 0.15));
    const K = row.keep || 0, F = row.keepFade || 1.3, kw = Math.max(0, Math.min(1, 1 - (s - K) / F));
    if (kw > 0) c = mixRGB(c, lane, kw);                                             // the lane's own surface (pavement, water, track bed) carries on into the background
    const f = SP(u, sd, 'f');
    if (f > 0.01) c = mixRGB(c, mixRGB(water, foam, Math.max(0, 0.9 - s * 0.9)), f);   // a waterfall: the water carries on over the edge
    const ay = ry + y;
    if (sea) {
      if (ay < SEA_Y + 0.6) { const dd = ay - SEA_Y; c = mixRGB(c, wetSand, Math.min(1, (SEA_Y + 0.6 - ay) / 0.6)); if (dd < 0.12 && dd > -0.1) c = mixRGB(c, foam, 0.7); else if (dd < -0.1) c = mixRGB(c, water, Math.min(0.9, -dd * 0.6)); }
    } else if (ay < -1.6) c = mixRGB(c, dark, Math.min(0.65, (-1.6 - ay) * 0.3));   // far below: a deeper shade of the same ground, never a pale smear
    const nn = kw > 0.99 && row.type === 'road' ? 1 : nz;
    return [c[0] * nn, c[1] * nn, c[2] * nn];
  };
  return { H: H, C: C, E: u => Y(u) - ry };
}
const SIDE = [0, 0.5, 1.0, 1.6, 2.3, 3.1, 4.0, 5.0, 6.2, 7.6, 9.2, 11, 13, 15.5, 18.5, 22, 26, 30];
const TXS = SIDE.slice().reverse().map(q => -(X0 + q)).concat(SIDE.slice(1).map(q => X0 + q)); TXS.splice(SIDE.length, 0, X0);
const TXSD = (function () { const a = TXS.slice(); for (let x = -X0 + 0.5; x < X0 - 0.01; x += 0.5) a.push(x); return a.sort((p, q) => p - q); })();
const TXSH = TXS.concat((function () { const a = []; for (let x = -7.5; x <= 7.5; x += 0.5) a.push(x); return a; })()).sort((p, q) => p - q).filter((v, i, a) => !i || v - a[i - 1] > 0.01);   // cell edges and centres, so holes get clean sides
/* the hole in the ground, per environment: open water in the ice, quicksand, lava, a dark pit, bog, tide pool */
const HOLEC = { forest: 0x4a3a28, winter: 0x2f6f9f, desert: 0x8a6a30, volcano: 0xff5a14, rainforest: 0x3e5a2a, temple: 0x16140f, beach: 0x2f86b8, lake: 0x2f86b8 };
const TUS = [-0.506, -0.36, -0.24, -RAMP0, RAMP0, 0.24, 0.36, 0.506];
/* a thin strip of paint lying on the ground along x (road lines, rails): it follows the terrain, so it climbs the background slopes with the road instead of floating or sinking */
function ribbon(b, T, u0, u1, xa, xb, hex, lift) {
  const col = RGB(hex), pts = [xa]; for (const x of TXS) if (x > xa + 0.01 && x < xb - 0.01) pts.push(x); pts.push(xb);
  const xs = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], d = pts[i + 1] - a, n = Math.max(1, Math.ceil(d / 1.1)); for (let k = 0; k < n; k++) xs.push(a + d * k / n); } xs.push(xb);
  const up = [0, 1, 0], P = (x, u) => [x, T.H(u, x) + lift, u];
  for (let i = 0; i < xs.length - 1; i++) {
    const A0 = P(xs[i], u0), A1 = P(xs[i], u1), B0 = P(xs[i + 1], u0), B1 = P(xs[i + 1], u1);
    [A0, A1, B0, B0, A1, B1].forEach(p => b._v(p, up, col, 1));
  }
}
/* trees, rocks, and per-kind scenery growing on the shaped land: the same models as the playable lanes, baked into the row mesh (no extra draw calls) */
const SCAT = { scree: 4, pass: 0, pass2: 0, hills: 0.7, dense: 1.5, mountain: 0.9, cliffs: 1.0, dip: 0.35, falls: 0, bowl: 1.0, ridge: 1.3, river: 0.5, tunnel: 0.6, shore: 0.9, shore2: 0.9 };
function scatter(b, th, row, T) {
  const k = SCAT[row.kind] || 0;
  for (const sd of [-1, 1]) for (let n = Math.floor(k) + (rand() < k % 1 ? 1 : 0); n > 0; n--) {
    const x = sd * (X0 + rnd(1.2, 12.5)), u = rnd(-0.3, 0.3), y = T.H(u, x) - 0.06;
    if (row.y + y < (th.sea ? SEA_Y + 0.35 : -2.2)) continue;
    if (row.kind === 'river' && Math.abs(x) < X0 + 4.9) continue;
    const rocky = row.kind === 'scree' ? rand() < 0.95 : (row.kind === 'mountain' || row.kind === 'ridge') ? rand() < 0.7 : rand() < 0.2, v = rand() < 0.5 ? 0 : 1, sc = (row.kind === 'scree' ? rnd(0.7, 2.1) : rnd(0.85, 1.4)) * (1 + (Math.abs(x) - X0) * 0.03), rot = rnd(0, 6.28);
    if (rocky) b.addGeo(rockGeoF(th, v), x, y, u, sc * 1.4, sc * 1.4, sc * 1.4, rot);
    else { const p = treeParts(th, v), ty = sc * rnd(1, 1.5); b.addGeo(p.trunk, x, y, u, sc, ty, sc, rot); if (p.crown) b.addGeo(p.crown, x, y, u, sc, ty, sc, rot); }
  }
  /* the mouth of a tunnel where the rails go on into the hill */
  if (row.kind === 'tunnel' && row.type === 'rail') {
    for (const sd of [-1, 1]) if (Math.abs(row.tp[sd < 0 ? 'L' : 'R'].A) > 3) {
      const x = sd * (X0 + 7.7), y = T.H(0, x), dkc = 0x14161a, stone = th.rock[1];
      b.box(0.5, 2.0, 0.78, dkc, x + sd * 0.2, y + 1.0, 0).box(0.9, 0.5, 1.0, stone, x, y + 2.15, 0).box(0.7, 2.3, 0.14, stone, x, y + 1.1, 0.43).box(0.7, 2.3, 0.14, stone, x, y + 1.1, -0.43);
    }
  }
  /* the sea: one animated sheet of water over the low side of the shore */
  if (row.sea) { /* mesh added in makeRow */ }
}
/* elevation of row r. Roads, rivers, rails, tides and their buffer rows keep the level they start at (no verticality inside or within two rows of them). Elsewhere the ground rarely steps (about 1 row in 30) and steps either way; chunks add the bigger raised / sunken sections. */
function elevFor(r, type, S) {
  let tgt;
  if (r < 0) { W.ey = Math.min(3, Math.floor(-r / 4)); W.gY = 0; return W.ey; }      // the start camp sits in a hollow with terraces rising behind it
  if (AH.nextArena(r) - r <= 3 || type === 'arena' || type === 'gate' || r <= 6) tgt = 0;           // arenas and the lanes around them are level
  else if (S.flat || HAZ[type]) tgt = W.ey;
  else if (S.y !== undefined) tgt = AH.clamp(W.cb + S.y, -2, 2);
  else if (type === 'grass') {
    if (lrand() < 0.035) { const dir = W.gY === 0 ? (lrand() < 0.5 ? -1 : 1) : (lrand() < 0.55 ? -Math.sign(W.gY) : Math.sign(W.gY)); W.gY = AH.clamp(W.gY + dir, -1, 1); }
    tgt = W.gY;
  } else tgt = W.ey;
  const stp = AH.nextArena(r) - r <= 3 ? 1 : 0.5;                                      // a rise is spread over two rows (half a block each), a gentle ramp instead of a cliff face
  return (W.ey = W.ey + AH.clamp(tgt - W.ey, -stp, stp));
}

/* ---- row construction ---- */
function addObstacle(row, x, mode, solid, th, lv) {      // lv (0..2) is a LAYOUT roll: it decides whether tall grass can be walked through, so it must not come from the decoration stream
  const g = new T.Group(), rock = mode !== 'tree';
  if (mode === 'low') {
    if ((row.theme === 'forest' || row.theme === 'rainforest') && lv === 1) solid = false;          // tall grass is just walked through
    const m = new T.Mesh(lowGeo(th, lv), VM); m.castShadow = true; g.add(m);
    const s = rnd(0.95, 1.25); g.scale.set(s * rnd(0.9, 1.1), s * rnd(1, 1.6), s * rnd(0.9, 1.1));
  } else if (rock) {
    const m = new T.Mesh(rockGeo(th, ri(0, 2)), VM); m.castShadow = true; g.add(m);
    const s = rnd(0.95, 1.2); g.scale.set(s, s * rnd(1, 1.15), s);
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

/* ground cover: tufts of tapering blades (dark root, light tip) in a few greens, flowers on stems, pebbles, and very soft colour patches so the lawn is never flat */
const GRASS = {
  forest: [0x3f8f34, 0x56a843, 0x7bc55a, 0x2f7a2c], winter: [0xe6f1fb, 0xc4dbef, 0xf5faff, 0xa9c8e0], desert: [0xb59a4a, 0xc9ae5a, 0xd9c177, 0x9a8340],
  volcano: [0x6a4a3a, 0x7a5844, 0x8a6a54, 0x4a3a34], temple: [0x3f7f35, 0x4d8f3f, 0x6aae55, 0x2f6a2c]
};
/* ground cover, different for every environment: lawns with grass, clover, flowers and mushrooms; snow with drifts, ice and tracks; dunes with ripples, shrubs and bones;
 * ash fields with glowing cracks and obsidian; cracked pavement with weeds, litter and puddles; moss-grown flagstones with ferns and fallen masonry */
function groundDetails(b, th, r, T, bg) {
  let cx = 0;
  const lim = X0 - 0.2, id = th.id, X = bg ? () => (cx = (rand() < 0.5 ? -1 : 1) * (X0 + rnd(0.3, 9.5))) : () => (cx = rnd(-lim, lim)), E = z => T.H(z, cx), Z = () => rnd(-0.38, 0.38);
  if (W.ground && W.ground[id]) return W.ground[id](b, th, r, T, bg, { X: X, E: E, Z: Z });
  if (id === 'forest') {
    const g = GRASS.forest, n = ri(12, 18);
    for (let i = 0; i < n; i++) { const x = X(), z = Z(); for (let k = ri(4, 7); k > 0; k--) { const zz = z + rnd(-0.12, 0.12); b.blade(rnd(0.16, 0.4), rnd(0.06, 0.1), g[ri(0, g.length - 1)], x + rnd(-0.14, 0.14), zz, rnd(0, 3.14), rnd(-0.14, 0.14), E(zz)); } }
    for (let i = ri(0, 3); i > 0; i--) { const x = X(), z = Z(), y = E(z); b.blade(0.28, 0.04, 0x3f9a3a, x, z, 0, 0.02, y).blob(0.075, 0.05, 0.075, pick(th.bloom), x, y + 0.3, z, { R: rand, tint: 0.15, n: 5 }); }
    for (let i = ri(2, 5); i > 0; i--) { const z = Z(); b.leaf(0.16, 0.08, pick([0xc9792b, 0xa5521e, 0xd6a02f, 0x8a5a2b]), X(), E(z) + 0.012, z, rnd(0, 6.3), 0); }
    for (let i = ri(0, 2); i > 0; i--) { const z = Z(); b.rock(rnd(0.16, 0.28), rnd(0.07, 0.12), rnd(0.14, 0.22), th.pebble, X(), E(z), z, { R: rand, n: 5 }); }
  } else if (id === 'winter') {
    for (let i = ri(3, 6); i > 0; i--) { const z = Z(); b.blob(rnd(0.25, 0.6), rnd(0.05, 0.1), rnd(0.2, 0.35), 0xffffff, X(), E(z) + 0.03, z, { R: rand, tint: 0.04, n: 5 }); }          // wind-blown snow lumps
    if (!bg && rand() < 0.5) { const z0 = Z(), x0 = X(), dir = rand() < 0.5 ? 1 : -1; for (let k = 0; k < ri(4, 7); k++) { const z = AH.clamp(z0 + (k % 2 ? 0.08 : -0.08), -0.4, 0.4); b.box(0.07, 0.012, 0.1, 0xb9cfe0, x0 + dir * k * 0.26, E(z) + 0.01, z); } }   // paw prints
    for (let i = ri(0, 2); i > 0; i--) { const z = Z(); b.rock(rnd(0.12, 0.22), rnd(0.06, 0.1), rnd(0.12, 0.18), 0x7c8794, X(), E(z), z, { R: rand, n: 5 }); }
  } else if (id === 'desert') {
    if (!bg) for (let i = ri(4, 7); i > 0; i--) { const z = Z(); b.box(rnd(0.9, 2.2), 0.014 + (i % 5) * 0.002, 0.05, i % 2 ? 0xe6cd8d : 0xc4a25a, X(), E(z) + 0.01, z); }                // wind ripples in the sand
    for (let i = ri(0, 2); i > 0; i--) { const x = X(), z = Z(), y = E(z); for (let k = ri(5, 8); k > 0; k--) b.cone(rnd(0.02, 0.04), 0, rnd(0.2, 0.42), 4, pick([0x8a6a30, 0xa07a3a, 0x6f5426]), x + rnd(-0.1, 0.1), y, z + rnd(-0.08, 0.08), { R: rand, lx: rnd(-0.8, 0.8), lz: rnd(-0.8, 0.8) }); }   // dry thorn shrub
    if (rand() < 0.3) { const x = X(), z = Z(), y = E(z); b.blob(0.13, 0.16, 0.13, 0x4f8a4a, x, y + 0.16, z, { R: rand, n: 6 }).blob(0.04, 0.03, 0.04, 0xe6559b, x, y + 0.34, z, { n: 4 }); }  // little barrel cactus
    if (rand() < 0.22) { const x = X(), z = Z(), y = E(z); b.box(0.3, 0.05, 0.06, 0xf1ead2, x, y + 0.03, z).blob(0.06, 0.05, 0.06, 0xf1ead2, x - 0.17, y + 0.04, z, { n: 4 }).blob(0.06, 0.05, 0.06, 0xf1ead2, x + 0.17, y + 0.04, z, { n: 4 }).box(0.05, 0.04, 0.22, 0xe6dcc0, x + 0.05, y + 0.025, z + 0.05); }   // bleached bone
    for (let i = ri(1, 3); i > 0; i--) { const z = Z(); b.rock(rnd(0.12, 0.26), rnd(0.06, 0.12), rnd(0.12, 0.2), pick([0xb98f45, 0x9a7a3a, 0xd9b57a]), X(), E(z), z, { R: rand, n: 5 }); }
  } else if (id === 'volcano') {
    if (!bg) for (let i = ri(3, 5); i > 0; i--) { const z = Z(); b.box(rnd(0.5, 1.5), 0.012 + (i % 4) * 0.002, rnd(0.2, 0.5), pick([0x2a2328, 0x3a2f34, 0x241d22]), X(), E(z) + 0.01, z); }          // ash drifts
    if (!bg) for (let i = ri(1, 3); i > 0; i--) { let x = X(), z = Z(); for (let k = 0; k < ri(3, 5); k++) { const w = rnd(0.2, 0.45), nz = AH.clamp(z + rnd(-0.12, 0.12), -0.4, 0.4); b.box(w, 0.014, 0.05, k % 2 ? 0xff7a1a : 0xff9a2a, x, E(nz) + 0.012 + k * 0.0012, nz); x += w * 0.85; z = nz; } }   // glowing cracks
    for (let i = ri(0, 3); i > 0; i--) { const x = X(), z = Z(), y = E(z); for (let k = ri(2, 4); k > 0; k--) b.cone(rnd(0.04, 0.08), 0, rnd(0.15, 0.4), 4, pick([0x1a151d, 0x2b2236, 0x3b2a55]), x + rnd(-0.12, 0.12), y, z + rnd(-0.1, 0.1), { R: rand, lx: rnd(-0.4, 0.4) }); }   // obsidian shards
    for (let i = ri(0, 3); i > 0; i--) { const z = Z(); b.blob(0.035, 0.03, 0.035, pick([0xffb43a, 0xff6a1a]), X(), E(z) + rnd(0.05, 0.3), z, { n: 4 }); }                // drifting embers
    for (let i = ri(2, 4); i > 0; i--) { const x = X(), z = Z(), y = E(z); for (let k = ri(3, 5); k > 0; k--) b.blade(rnd(0.08, 0.2), 0.04, pick([0x1c1618, 0x2a2024, 0x3a2a22]), x + rnd(-0.1, 0.1), z + rnd(-0.08, 0.08), rnd(0, 3), rnd(-0.2, 0.2), y); }   // scorched stubble
  } else {                                                              // temple
    if (!bg) for (let i = ri(4, 6); i > 0; i--) { const z = Z(); b.box(rnd(0.55, 0.95), 0.01 + (i % 4) * 0.002, rnd(0.45, 0.8), mixHex(th.ground[0], i % 2 ? 0xc9c2a0 : 0x2a3a22, rnd(0.08, 0.18)), X(), E(z) + 0.006, z); }   // moss-streaked flagstones
    for (let i = ri(2, 4); i > 0; i--) { const x = X(), z = Z(), y = E(z); for (let k = 0; k < 6; k++) b.leaf(rnd(0.3, 0.5), 0.14, pick([0x2f7a2c, 0x3f8f35, 0x56a843]), x, y + 0.02, z, k * 1.05 + rnd(-0.2, 0.2), rnd(0.35, 0.7)); }   // jungle ferns
    for (let i = ri(0, 3); i > 0; i--) { const x = X(), z = Z(), y = E(z); b.blade(0.3, 0.04, 0x2f7a2c, x, z, 0, 0.02, y).blob(0.08, 0.05, 0.08, pick(th.bloom), x, y + 0.32, z, { R: rand, tint: 0.15, n: 5 }); }
    if (!bg && rand() < 0.3) { const x = X(), z = Z(), y = E(z); b.box(0.5, 0.012, 0.5, 0x6f6a52, x, y + 0.012, z).box(0.34, 0.014, 0.05, 0xd9a63a, x, y + 0.02, z).box(0.05, 0.014, 0.34, 0xd9a63a, x, y + 0.02, z); }   // an old glyph tile inlaid with gold
    for (let i = ri(1, 3); i > 0; i--) { const z = Z(); b.rock(rnd(0.16, 0.32), rnd(0.08, 0.16), rnd(0.14, 0.26), pick([0xb5ae8a, 0x9a9170, 0x8a8a70]), X(), E(z), z, { R: rand, n: 5, j: 0.15 }); }   // fallen masonry
  }
}


/* ---- boulders: a dozen different natural rocks (round, flat, lumpy, angular), each with its own colour ---- */
function rollGeoV(th, v) {
  return geo('rollrock2' + th.id + v, () => {
    /* every variant is nearly round and centred on its own middle: that is what lets it roll steadily. (A flat or lopsided rock turned about its middle wobbles and digs into the ground.) */
    const b = new Builder(), R = AH.seeded('rr2' + th.id + v), o = (n, j) => ({ R: R, n: n, j: j }), base = th.roll.ball;
    const cols = [base, mixHex(base, th.roll.hill, 0.45), mixHex(base, 0x000000, 0.22), mixHex(base, 0xffffff, 0.2), 0x8a7f6c, 0x6b6f75, 0x9a8a74];
    const c = i => cols[(v * 2 + i) % cols.length];
    if (v === 0) b.blob(0.58, 0.56, 0.57, c(0), 0, 0, 0, o(9, 0.07));
    else if (v === 1) b.blob(0.58, 0.55, 0.56, c(0), 0, 0, 0, o(7, 0.1)).blob(0.3, 0.26, 0.3, c(1), 0.2, 0.15, 0.1, o(5, 0.1));
    else if (v === 2) b.blob(0.57, 0.56, 0.55, c(0), 0, 0, 0, o(6, 0.14));
    else if (v === 3) b.blob(0.5, 0.5, 0.5, c(0), 0, 0, 0, o(7, 0.08)).blob(0.34, 0.3, 0.34, c(1), 0.2, -0.1, 0.12, o(5, 0.1)).blob(0.3, 0.3, 0.3, c(2), -0.18, 0.12, -0.1, o(5, 0.1));
    else b.blob(0.58, 0.56, 0.56, c(0), 0, 0, 0, o(5, 0.22));
    return b.build();
  });
}
const BOULD_DUST = [0xb8a98a, 0x9a8a74, 0x7b6a55, 0x8d9199];
const smooth = x => x * x * (3 - 2 * x);
function rollUpdate(row, o, t, fz, dt) {
  if (o.proxy) return;
  const p = o.x * o.dir, pv = -(X0 + 5.8), vis = p > pv, m = o.mesh, near = Math.abs(row.r + fz) < 11;
  if (vis && !o.wasVis) {                                                   // a boulder breaks loose at the top of the hill: the hill shudders and throws up dust and chips (the warning)
    o.wasVis = true;
    if (near) { row.shakeT = 0.6; AH.cam.shake = Math.max(AH.cam.shake, 0.07); AH.burst(9, o.x, row.y + row.T.H(0, o.x) + 0.8, -row.r, BOULD_DUST, 2.4, 3.6); }
  } else if (!vis) { o.wasVis = false; o.crumbled = false; }
  const kin = AH.clamp((p - pv) / 1.8, 0, 1), kout = p > X0 - 0.2 ? AH.clamp(1 - (p - (X0 - 0.2)) / 2.4, 0, 1) : 1, k = smooth(Math.min(kin, kout));
  if (kout < 0.9 && !o.crumbled && near) { o.crumbled = true; AH.burst(7, o.x, row.y + row.T.H(0, o.x) + 0.5, -row.r, BOULD_DUST, 2.2, 2.6); }      // it breaks up against the far bank
  m.visible = vis && k > 0.03;
  if (!m.visible) return;
  const gy = row.T.H(0, o.x), d = Math.max(0, p - pv), ph = d / 3.4, f = ph - Math.floor(ph), amp = o.bamp * Math.exp(-d / 9);
  m.scale.set(o.sc * k, o.sc * k, o.sc * k);                                // uniform scale: a rolling rock must stay round
  m.position.x = o.x;
  m.position.y = gy + o.rad * 0.96 * k + amp * 4 * f * (1 - f) * k;        // resting on the ground, hopping a little near the top of the hill and settling into a steady roll
  m.rotation.z = -(o.dir * o.speed * t) / o.rad;                             // rolling without slipping: turn = distance / radius
  const n = Math.floor(ph);
  if (o.bn !== undefined && n !== o.bn && near && k > 0.5 && amp > 0.1) {   // a landing leaves a puff of dust and a small thud
    AH.burst(amp > 0.25 ? 5 : 3, o.x, row.y + gy + 0.1, -row.r, BOULD_DUST, 1.5 + amp, 1.6 + amp);
    if (amp > 0.25) AH.cam.shake = Math.max(AH.cam.shake, 0.05 + 0.04 * amp);
  }
  o.bn = n;
}

/* the exit boundary of an arena: a natural belt of the zone's own trees and boulders. Three predefined chunk styles (treeline, boulder ridge, mixed ridge); every piece has its own size, tilt and depth so the line is ragged, not a wall. */
const barrierGeo = (th, vr, nx) => geo('barrier' + th.id + (nx ? nx.id : '') + vr, () => {
  const b = new Builder(), R = AH.seeded('bar' + th.id + vr), HW = X0 + 1.6, rr = (a, c) => a + R() * (c - a), pr = vr === 1 ? 0.7 : vr === 2 ? 0.4 : 0.12;
  const pack = t => ({ tp: [treeParts(t, 0), treeParts(t, 1)], rg: [rockGeoF(t, 0), rockGeoF(t, 1)] }), A = pack(th), N = nx && nx.id !== th.id ? pack(nx) : A;
  const piece = (S, x, z, sc, rotAdd) => {
    if (R() < pr) { const g = S.rg[Math.floor(R() * 2)]; b.addGeo(g, x, 0, z, sc * rr(1.3, 2), sc * rr(1.3, 2.3), sc * rr(1.3, 2), rr(0, 6.28)); }
    else { const p = S.tp[Math.floor(R() * 2)], ty = sc * rr(1.1, 1.6), rot = rr(0, 6.28); b.addGeo(p.trunk, x, 0, z, sc, ty, sc, rot); if (p.crown) b.addGeo(p.crown, x, 0, z, sc, ty, sc, rot); }
  };
  for (let layer = 0; layer < 2; layer++) for (let x = -HW + layer * 0.5; x <= HW; x += rr(0.85, 1.3)) piece(R() < (layer ? 0.55 : 0.25) ? N : A, x, rr(-0.5, 0.5) + (layer ? 0.35 : -0.15), rr(1.5, 2.3) * (layer ? 0.85 : 1));
  for (let x = -HW; x <= HW; x += rr(1.6, 2.6)) b.addGeo((R() < 0.4 ? N : A).rg[Math.floor(R() * 2)], x, 0, rr(-0.5, 0.6), rr(1.2, 2), rr(0.9, 1.6), rr(1.2, 2), rr(0, 6.28));
  for (let x = -HW; x <= HW; x += rr(1.2, 2.0)) {                                  // the belt thins out on both sides, in the arena's biome towards the arena and in the next one beyond it
    if (R() < 0.55) piece(A, x, rr(0.8, 1.7), rr(0.8, 1.3));
    if (R() < 0.55) piece(N, x, -rr(0.8, 1.7), rr(0.8, 1.3));
  }
  return b.build();
});

/* the land behind the start line: dense trees and rocks on terraces that rise away from the camp, so a big screen never sees the edge of the world */
function backDecor(b, th, r, T) {
  const dens = r < -9 ? 0.75 : r < -3 ? 0.6 : 0.3, tp = [treeParts(th, 0), treeParts(th, 1)];
  for (let x = -COLS - 3; x <= COLS + 3; x++) {
    if (rand() > dens || (r >= -4 && Math.abs(x) < 3.5)) continue;
    const sc = rnd(1, 1.6) * (1 + -r * 0.02), xx = x + rnd(-0.4, 0.4), u = rnd(-0.3, 0.3), y = T.H(u, xx) - 0.05;
    if (rand() < 0.22) b.addGeo(rockGeoF(th, ri(0, 1)), xx, y, u, sc * 1.4, sc * 1.4, sc * 1.4, rnd(0, 6.28));
    else { const p = tp[ri(0, 1)], ty = sc * rnd(1.1, 1.7); b.addGeo(p.trunk, xx, y, u, sc, ty, sc, rnd(0, 6.28)); if (p.crown) b.addGeo(p.crown, xx, y, u, sc, ty, sc, rnd(0, 6.28)); }
  }
}
function campDecor(b, th, r, T) {
  const y = T.E(0), wood = th.tree.trunk, fl = th.arena.flag;
  if (r >= -5 && r <= 0) b.box(1.5, 0.02, 0.9, mixHex(th.ground[0], 0xc9b58a, 0.5), 0, y + 0.012, 0).box(0.9, 0.02, 0.6, mixHex(th.ground[0], 0xc9b58a, 0.35), 0.2, y + 0.016, 0.1);   // a worn path to the start
  if (r === -2) {                                                                           // campfire ring
    for (let i = 0; i < 7; i++) { const a = i * 0.9; b.box(0.3, 0.22, 0.3, 0x8a8f98, -3.2 + Math.cos(a) * 0.55, y + 0.11, Math.sin(a) * 0.36); }
    b.box(0.5, 0.1, 0.12, wood, -3.2, y + 0.1, 0.05).box(0.12, 0.1, 0.5, wood, -3.2, y + 0.12, 0).box(0.2, 0.34, 0.2, 0xff7a1a, -3.2, y + 0.3, 0).box(0.12, 0.28, 0.12, 0xffd23f, -3.2, y + 0.36, 0);
  }
  if (r === -3) b.prism(2.2, 1.6, 1.0, mixHex(wood, 0xffffff, 0.35), 4.2, y, 0).box(0.7, 1.0, 0.05, 0x23262e, 4.2, y + 0.5, 0.52);   // a tent
  if (r === -1) {                                                                           // the start arch: two posts, a beam, a flag and two lanterns
    for (const s of [-1, 1]) { b.cone(0.16, 0.13, 2.7, 6, wood, s * 2.5, y, 0, { R: rand }); b.box(0.2, 0.26, 0.2, 0xffd23f, s * 2.5, y + 2.2, 0.0); }
    b.box(5.5, 0.26, 0.24, wood, 0, y + 2.75, 0);
  }
  if (r === -4 || r === -3) for (const s of [-1, 1]) b.cone(0.07, 0.06, 1.4, 5, wood, s * 6.2, y, 0.1, { R: rand }).box(0.2, 0.2, 0.2, 0xffe066, s * 6.2, y + 1.45, 0.1);
  /* a lived-in camp: a ranger's cabin, wooden fences along the sides, supplies by the start, hay, a cairn and banners */
  const roof = mixHex(wood, 0x000000, 0.3), plank = mixHex(wood, 0xffffff, 0.2);
  if (r === -7) {
    b.box(3.2, 1.5, 2.2, plank, -5.2, y + 0.75, 0).prism(3.6, 1.1, 2.6, roof, -5.2, y + 1.5, 0).box(0.7, 1.1, 0.06, 0x2b2118, -5.2, y + 0.55, 1.13).box(0.6, 0.5, 0.06, 0xbfe3f8, -6.3, y + 0.95, 1.13).box(0.6, 0.5, 0.06, 0xbfe3f8, -4.1, y + 0.95, 1.13).box(0.4, 1.0, 0.4, 0x8a8f98, -6.4, y + 2.1, -0.4);
    b.box(1.6, 0.14, 0.9, wood, -5.2, y + 0.05, 1.7).box(1.2, 0.05, 0.5, 0xd9b48a, -5.2, y + 0.16, 1.7);
  }
  if (r <= -2 && r >= -9) for (const s of [-1, 1]) { b.cone(0.07, 0.06, 0.95, 5, wood, s * 7.3, y, 0.35, { R: rand }); if (r % 2 === 0) b.box(0.07, 0.07, 2.1, plank, s * 7.3, y + 0.62, 0.9).box(0.07, 0.07, 2.1, plank, s * 7.3, y + 0.32, 0.9); }
  if (r === -2) { for (const q of [[3.4, 0], [4.1, 0.5], [3.7, -0.5]]) b.box(0.6, 0.6, 0.6, plank, q[0], y + 0.3, q[1]).box(0.64, 0.06, 0.64, wood, q[0], y + 0.62, q[1]); b.box(0.5, 0.7, 0.5, mixHex(wood, 0x000000, 0.15), 4.9, y + 0.35, 0.3).box(0.54, 0.06, 0.54, 0x8a8f98, 4.9, y + 0.72, 0.3); }
  if (r === -5) { for (const q of [[-2.4, 0.2], [2.6, -0.2]]) b.box(0.9, 0.5, 0.6, 0xd9c36a, q[0], y + 0.25, q[1]).box(0.5, 0.4, 0.55, 0xc9b25a, q[0] + 0.1, y + 0.7, q[1]); }
  if (r === -3) { b.cone(0.5, 0.3, 0.5, 6, 0x8a8f98, 6.0, y, 0.6, { R: rand, j: 0.1 }).cone(0.34, 0.22, 0.4, 6, 0x9aa0aa, 6.0, y + 0.45, 0.6, { R: rand, j: 0.1 }).cone(0.2, 0.12, 0.3, 6, 0xaab0ba, 6.0, y + 0.8, 0.6, { R: rand, j: 0.1 }); }
}

function makeRow(r) {
  AH.seedLayout(r); AH.seedDeco(r);
  const th = AH.themeAt(r), type = pickType(r), S = W.spec || {};
  const row = { r: r, type: type, objs: [], blockers: new Map(), pads: null, group: new T.Group(), canopies: [], train: null, lamp: null, carry: 0, theme: th.id, lane: null, wet: null, tide: null, buffer: !!S.buffer };
    const prev = W.pathCol;
  let step = S.step !== undefined ? S.step : lri(-1, 1);
  if (S.lake) { const w = lakeW(S.lake, r); step = AH.clamp((S.lake.side > 0 ? Math.min(COLS - 1, Math.ceil(S.lake.cx + w) + 1) : Math.max(-COLS + 1, Math.floor(S.lake.cx - w) - 1)) - prev, -2, 2); }
  W.pathCol = S.back ? 0 : AH.clamp(prev + step, -COLS, COLS);
  const pc = W.pathCol; row.pc = pc;
  const addObj = (mesh, o) => { o.mesh = mesh; o.row = r; o.idx = row.objs.length; o.alive = !W.killed.has(r + ':' + o.idx); mesh.visible = o.alive; row.group.add(mesh); row.objs.push(o); };
  const place = (i, n, off, jit) => -WRAP + (((off + i * PER / n + lrnd(-jit, jit)) % PER) + PER) % PER;

  row.ci = S.ci || 0;
  const e = elevFor(r, type, S);
  let kind = S.bg || DEFBG[type] || 'hills', bgv = S.bgv;
  /* where one biome hands over to the next, the ground colour, plants and rocks of the old one fade out over several rows, and the high ground behind the arena's exit eases down */
  let old = null, ow = 0, after = 0;
  for (let d = 1; d <= 8; d++) if (AH.themeAt(r - d).id !== th.id) { old = AH.themeAt(r - d); ow = 0.5 * (1 - (d - 1) / 8); break; }
  for (let d = 1; d <= 5; d++) { const g = r - d, A0 = W.arenaStart(g); if (A0 >= 0 && g - A0 === AH.ARENA_LEN - 1 && W.arenaStart(r) < 0) { after = d; break; } }
  if (after && !S.bg && type === 'grass') { kind = 'ridge'; const k = 0.85 * (1 - (after - 1) / 5) + 0.12; bgv = [{ k: k, sh: 0 }, { k: k, sh: 0 }]; }
  const gnd = old ? mixHex(th.ground[0], old.ground[0], ow) : th.ground[0], thP = () => (old && rand() < ow) ? old : th;
  if (th.sea && !S.bg && (type === 'grass' || type === 'tide')) kind = (AH.zoneOf(r) % 2) ? 'shore' : 'shore2';
  row.y = e; row.th = th; row.kind = kind;
  if (type === 'road') { row.keep = 21; row.keepFade = 3; }
  else if ((type === 'water' || type === 'lily') && kind === 'river') { row.keep = BGP.river.pre + 0.3; row.keepFade = 0.8; }
  else if (type === 'rail') { row.keep = BGP.tunnel.pre + 1.4; row.keepFade = 0.8; }          // the track bed carries on into the background; the rails run all the way to the edge (flat ground or a tunnel mouth)
  row.ice = !!S.ice; row.wildRow = !!S.wild;
  row.gnd = gnd; row.thG = thP();
  const laneHex = S.ice ? mixHex(th.ground[0], 0xa9d4ee, 0.75) : type === 'road' ? th.road : type === 'rail' ? th.bed : type === 'roll' ? th.roll.ground : (type === 'water' || type === 'lily') ? th.water : type === 'tide' ? mixHex(th.ground[0], 0x6a5a3a, 0.25) : gnd;
  row.tp = { y: e + (OFFY[type] || 0), L: sideParams(r, 0, kind, bgv), R: sideParams(r, 1, kind, bgv), lane: RGB(laneHex), g: RGB(gnd), crisp: type === 'road' || type === 'rail' };
  if (type === 'rail') { row.flatRail = Math.abs(row.tp.L.A) < 0.5 && Math.abs(row.tp.R.A) < 0.5; row.keep = row.flatRail ? X0 + 12 : BGP.tunnel.pre + 1.4; row.keepFade = 0.8; }
  if (S.lake) { row.lake = S.lake; row.txs = TXSD; row.wet = new Set(); const lw = lakeW(S.lake, r); for (let x = -COLS; x <= COLS; x++) if (Math.abs(x - S.lake.cx) < lw - 0.15) row.wet.add(x); }
  if (S.holes && type === 'grass' && !S.lake && !S.buffer) {                      // a field of holes (ice water, quicksand, lava, pits, bog). The cells on the path through the field are always left solid.
    row.holes = true; row.txs = TXSH; row.wet = new Set();
    for (let x = -COLS; x <= COLS; x++) if (x !== prev && x !== pc && lrand() < S.holes) row.wet.add(x);
  }
  const T0 = row.T = makeTerrain(row, th, laneHex);
  if (type === 'road') { row.follow = true; row.cutX = 20.5; }                                                     // traffic climbs and descends with the road
  if (kind === 'falls' && type === 'water') { row.follow = true; let cx = X0; while (cx < 20 && T0.H(0, cx) - T0.E(0) > -3.2) cx += 0.2; row.cutX = cx; }     // logs ride the water over the edge and vanish into the mist
  /* everything drawn on the ground is made once the neighbouring rows exist (finishRow), so the slopes between lanes can be shaped properly */
  row.fin = (b, T) => {
    const E = T.E;
    if (S.back) backDecor(b, th, r, T);
    if (r >= -5 && r <= 0) campDecor(b, th, r, T);
    if (type === 'grass' || type === 'arena' || type === 'gate') {
      if (!row.holes) groundDetails(b, row.thG || th, r, T);
      if (row.ice) for (let i = ri(4, 8); i > 0; i--) { const z = rnd(-0.4, 0.4), x = rnd(-X0 + 1, X0 - 1); if (!row.wet.has(Math.round(x))) b.box(rnd(0.5, 1.4), 0.01, 0.035, 0x8fc0dc, x, E(z) + 0.012, z); }
      if (['hills', 'dense', 'dip', 'bowl', 'shore', 'shore2'].indexOf(kind) >= 0 && !row.lake) groundDetails(b, th, r, T, true);
    } else if (type === 'road') {
      const ahead = W.rows.get(r + 1), behind = W.rows.get(r - 1), isRoad = q => q && q.type === 'road', lk = S.lk, WH = 0xf2f2f2, Xe = X0 + 14;
      /* continuous white lines along the outer edges of the carriageway; discontinuous white dashes where two lanes meet. Both carry on up the background slope with the road. */
      if (lk === 0 && !isRoad(behind)) ribbon(b, T, 0.35, 0.46, -Xe, Xe, WH, 0.02);
      if (lk === 4 && !isRoad(ahead)) ribbon(b, T, -0.46, -0.35, -Xe, Xe, WH, 0.02);
      if (lk === 4 && isRoad(ahead)) for (let x = -Xe; x < Xe; x += 2.8) ribbon(b, T, -0.5, -0.44, x, x + 1.5, WH, 0.02);
      if (lk === 0 && isRoad(behind)) for (let x = -Xe; x < Xe; x += 2.8) ribbon(b, T, 0.44, 0.5, x, x + 1.5, WH, 0.02);
    } else if (type === 'rail') {
      const xe = row.flatRail ? X0 + 19 : X0 + 7.4;
      for (let x = -xe; x < xe; x += 0.8) b.box(0.22, 0.08, 0.5, th.tie, x, 0.04 + E(0), 0);
      b.box(xe * 2, 0.1, 0.08, th.steel, 0, 0.12 + E(0), 0.2).box(xe * 2, 0.1, 0.08, th.steel, 0, 0.12 + E(0), -0.2);
      b.box(0.14, 1.6, 0.14, 0x4a525c, -COLS - 1.6, 0.8, 0.4);
    } else if (type === 'roll') {
      for (let i = 0; i < 10; i++) { const z = rnd(-0.35, 0.35); b.box(0.24, 0.1, 0.2, th.roll.speck, rnd(-COLS - 3, COLS + 3), 0.05 + E(z), z); }
    } else if (type === 'tide') {
      for (let i = ri(3, 6); i > 0; i--) { const z = rnd(-0.35, 0.35); b.box(rnd(0.6, 1.8), 0.012, 0.05, mixHex(th.ground[0], 0xffffff, 0.35), rnd(-X0 + 1, X0 - 1), E(z) + 0.012, z); }
    }
    if (row.lake && row.wet.size) for (let i = ri(3, 6); i > 0; i--) { const x = rnd(-X0 + 0.5, X0 - 0.5), z = rnd(-0.3, 0.3); if (T.H(z, x) < -0.35) b.blob(rnd(0.08, 0.2), 0.02, rnd(0.06, 0.1), 0xffffff, x, -0.34, z, { R: rand, n: 5, tint: 0.05 }); }
  };
  row.group.position.set(0, e, -r);

  if (type === 'grass') {
    for (let x = -COLS; x <= COLS; x++) {
      if (x === prev || Math.abs(x - pc) <= 1 || S.back || (row.wet && row.wet.has(x))) continue;               // a three-wide corridor always stays open
      const hit = lrand() < (r <= 2 ? 0 : S.tp !== undefined ? S.tp : 0.36), u = lrand(), rp = S.rock !== undefined ? S.rock : 0.2;
      const mode = u < rp ? 'rock' : lrand() < 0.4 ? 'low' : 'tree';
      if (hit && !W.removed.has(r + ':' + x)) addObstacle(row, x, mode, true, thP(), lri(0, 2));
    }
  } else if (type === 'road') {
    const L = S.lane, lk = S.lk;
    row.dir = L.dir;
    if (lk === 0 || !L.st) L.st = { rc: r + (2 - lk), objs: [], kind: L.kind };
    row.lane = L.st;
    if (lk === 2) {                                                          // the traffic runs along the middle of the five-row lane, so it is centred in it
      const dir = L.dir, K = C.TRAFFIC[L.kind || 'commuter'], sp = C.roadSpeed(L.kind || 'commuter', r, lrand), vs = [];
      for (let i = 0; i < K.n; i++) vs.push(buildVehicle(th, lrand() < K.heavy, dir, lrand(), lrand(), K.boost));
      const fit = C.roadGaps(sp, vs.map(v => v.len * 1.9), PER, lrand, K.platoon);   // between platoons there is always a gap longer than the time needed to cross the lane (course.js)
      vs.length = fit.count;
      let cx = lrnd(0, PER);
      vs.forEach((v, i) => {
        const m = new T.Mesh(v.g, AH.VM), len = v.len * 1.9;
        m.scale.set(1.9, 1.7, 2.2); m.castShadow = true;                       // big vehicles, about two hops wide, sitting on the middle row of the lane
        addObj(m, { x0: -WRAP + (((cx + len / 2) % PER) + PER) % PER, x: 0, len: len, dir: dir, speed: sp, kind: 'car', hurts: true, carries: false });
        cx += len + fit.gaps[i];
      });
      L.st.objs = row.objs;
    }
  } else if (type === 'roll') {
    const G0 = S.grp, dir = S.dir || flip(), ci = S.grp ? row.ci : 0;
    if (G0) {
      row.rocks = G0;
      if (G0.mul === undefined) G0.mul = C.speedMul('roll', r);
      const sp = G0.sp * G0.mul; row.hillRoll = true;
      G0.list.forEach(e => {
        const dz = Math.abs(ci - e.j), chord = 2 * Math.sqrt(Math.max(0.1, e.rho * e.rho - Math.pow(Math.max(0, dz - 0.5), 2)));
        if (dz > e.rho + 0.4) return;
        const sc = e.rho / 0.58, hv = hash3(Math.round(e.x * 10), e.j, 11);
        /* a boulder is a pivot that ROLLS (turns about the horizontal axis across its path) holding a rock that is only turned once, at random. That keeps the spin steady whatever the rock looks like. */
        const m = new T.Group(), rock = new T.Mesh(rollGeoV(th, e.v || 0), AH.VMR);
        rock.castShadow = true; rock.rotation.set(hv * 6, hv * 3, hv * 5); m.add(rock);
        addObj(m, { x0: e.x, x: 0, len: chord, dir: dir, speed: sp, kind: 'roll', hurts: true, carries: false, rad: e.rho, sc: sc, proxy: dz > 0, bamp: 0.14 * e.rho + 0.1 });
        if (dz > 0) m.visible = false;
      });
    }
  } else if (type === 'water') {
    const dir = S.dir || flip(), LG = C.pickLogs(lrand, W.lastLogs); W.lastLogs = LG.kind;           // neighbouring river lanes differ in character (course.js)
    const sp = LG.speed * (S.spd || 1) * C.speedMul('water', r), n = LG.n, off = lrnd(0, PER);
    for (let i = 0; i < n; i++) {
      const len = lrnd(LG.lenRange[0], LG.lenRange[1]), m = new T.Mesh(buildLog(len, th), row.follow ? AH.VMF : kind === 'river' ? AH.VMW : AH.VMC); m.castShadow = true;
      addObj(m, { x0: place(i, n, off, 0.6), x: 0, len: len, dir: dir, speed: sp, kind: 'log', hurts: false, carries: true });
    }
    addFlow(row, th, dir, sp);
  } else if (type === 'lily') {
    row.pads = new Map(); addFlow(row, th, flip(), 0.3);
    for (let x = -COLS; x <= COLS; x++) {
      if (lrand() < (S.pad !== undefined ? S.pad : 0.38) || x === prev || x === pc) {
        const m = new T.Mesh(padGeo(th), VM); const ps = rnd(0.78, 1.18); m.scale.set(ps, 1, ps * rnd(0.9, 1.1)); m.position.set(x + rnd(-0.08, 0.08), AH.PADY - 0.04, rnd(-0.08, 0.08)); m.rotation.y = rand() * 3; m.receiveShadow = true;
        row.group.add(m); row.pads.set(x, m);
      }
    }
  } else if (type === 'rail') {
    const dir = S.dir || flip(), TR = C.pickTrain(lrand), len = TR.len, tm = TR.period;
    const m = new T.Mesh(buildTrain(len, dir, pick([0x3b82f6, 0xe5484d, 0x2dd4bf, 0x9b5de5])), row.flatRail ? AH.VMX : AH.VMT); m.castShadow = true; m.visible = false;
    row.group.add(m);
    const lamp = new T.Mesh(AH.BOX, AH.M(0x552222)); lamp.scale.set(0.3, 0.3, 0.3); lamp.position.set(-COLS - 1.6, 1.7, 0.4);
    row.group.add(lamp); row.lamp = lamp;
    row.train = { mesh: m, dir: dir, len: len, T: tm, warn: TR.warn, speed: TR.speed, tkind: TR.kind, off: lrnd(0, tm), alive: !W.killed.has(r + ':-1'), row: r, idx: -1, kind: 'train' };
  } else if (type === 'tide') {
    const tm = lrnd(5.5, 8), sheet = new T.Mesh(geo('tidepl', () => new T.PlaneGeometry(2 * X0, 1.0, 40, 1).rotateX(-Math.PI / 2)), AH.waterMat(th.water, 1.1));
    sheet.position.y = 0.1; sheet.visible = false; row.group.add(sheet);
    row.tide = { T: tm, warn: 1.7, dur: 1.2, off: lrnd(0, tm), alive: true, row: r, idx: -1, kind: 'tide', mesh: sheet };
  } else if (type === 'gate') {
    if (!W.arena(W.arenaStart(r)).broken) {
      const m = new T.Group(), main = new T.Mesh(barrierGeo(th, AH.arenaIdx(W.arenaStart(r)) % 3, AH.themeAt(r + 1)), VM); main.castShadow = true; m.add(main);
      row.group.add(m);
      row.barrier = { mesh: m, th: th };
      for (let x = -COLS; x <= COLS; x++) row.blockers.set(x, { kind: 'barrier', node: null });
    }
  }
  if (th.sea && (kind === 'shore' || kind === 'shore2')) {                    // the sea: an animated sheet of water over the low side of the shore
    const sx = kind === 'shore' ? -1 : 1, sea = new T.Mesh(geo('seapl', () => new T.PlaneGeometry(34, 1.02, 34, 1).rotateX(-Math.PI / 2)), AH.waterMat(th.water, 1.3));
    sea.position.set(sx * (X0 + 17), SEA_Y - e, 0); row.group.add(sea);
  }
  if (row.lake && row.wet.size) {
    const w = Math.max(lakeW(row.lake, r - 0.5), lakeW(row.lake, r), lakeW(row.lake, r + 0.5));
    if (w > 0.3) { const lw = new T.Mesh(geo('lakepl', () => new T.PlaneGeometry(1, 1.02, 28, 1).rotateX(-Math.PI / 2)), AH.waterMat(th.water, 0.6)); lw.scale.x = 2 * (w + 0.8); lw.position.set(row.lake.cx, -0.3, 0); row.group.add(lw); }
  }
  scene.add(row.group);
  if (S.wild && AH.wild) AH.wild.populate(row, th);
  if (AH.wild && AH.wild.aqua && !S.buffer) AH.wild.aqua(row, th);
  return row;
}
function finishRow(row) {
  if (row.done) return; row.done = true;
  AH.seedDeco(row.r);                                   // decoration has its own stream per row, so nothing visual can ever move the level
  const ah = W.rows.get(row.r + 1), bh = W.rows.get(row.r - 1);
  row.tn = ah ? ah.tp : row.tp; row.tb = bh ? bh.tp : row.tp;
  const b = new Builder(), T0 = row.T;
  b.terrain(row.txs || TXS, TUS, T0.H, T0.C);
  if (row.fin) row.fin(b, T0);
  scatter(b, row.th, row, T0);
  const mesh = new T.Mesh(b.build(), VM);
  mesh.castShadow = false; mesh.receiveShadow = true;
  row.group.add(mesh); row.mesh = mesh;
}
function removeRow(row) { scene.remove(row.group); if (row.mesh && row.mesh.geometry) row.mesh.geometry.dispose(); if (AH.wild) AH.wild.drop(row.r); }

/* ---- seeing the player through scenery: anything standing between the (isometric) camera and the fox turns into a pale ghost until it is out of the way ---- */
const ghostMat = new T.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false });
const ghosted = new Set(), gRay = new T.Ray(), gBox = new T.Box3(), gTo = new T.Vector3(), gO = new T.Vector3(), gHit = new T.Vector3();
W.seeThrough = function (px, py, pz, row0) {
  const cam = AH.camera; cam.getWorldDirection(gTo); gTo.multiplyScalar(-1);                          // from the fox towards the camera
  gO.set(px, py + 0.45, pz); gRay.set(gO, gTo);
  const now = new Set();
  for (let r = row0 - 3; r <= row0 + 9; r++) {
    const row = W.rows.get(r); if (!row || !row.blockers) continue;
    row.blockers.forEach(bl => {
      const n = bl.node; if (!n || !n.parent) return;
      n.traverse(o => {
        if (!o.isMesh) return;
        if (!o.userData.bx) { o.updateWorldMatrix(true, false); o.userData.bx = new T.Box3().setFromObject(o); }
        gBox.copy(o.userData.bx).expandByScalar(0.12);
        if (gRay.intersectBox(gBox, gHit) && gHit.distanceTo(gO) > 0.3) now.add(o);
      });
    });
  }
  now.forEach(o => { if (!ghosted.has(o)) { o.userData.m0 = o.material; o.material = ghostMat; } });
  ghosted.forEach(o => { if (!now.has(o)) { if (o.userData.m0) o.material = o.userData.m0; } });
  ghosted.clear(); now.forEach(o => ghosted.add(o));
};

/* ---- public api ---- */
W.reset = function (seed) {
  W.rows.forEach(removeRow); W.rows.clear();
  if (AH.wild) AH.wild.clear();
  W.gen = -27; W.run = 'grass'; W.runLeft = 0; W.queue = []; W.spec = null; W.lastChunk = ''; W.recent = []; lastTraffic = null; W.lastLogs = null; W.restLeft = TUNE.rest.start; W.pathCol = 0; W.ey = 0; W.gY = 0; W.cb = 0; W.lakes = []; W.arenas = {}; W.killed = new Set(); W.removed = new Set();
  AH.setSeed(seed);
};
W.ensure = function (needRow) { while (W.gen < needRow) { W.gen++; W.rows.set(W.gen, makeRow(W.gen)); const p = W.rows.get(W.gen - 1); if (p) finishRow(p); } };
W.prune = function (minRow) { W.rows.forEach((row, r) => { if (r < minRow) { removeRow(row); W.rows.delete(r); } }); };
W.get = r => W.rows.get(r);
W.laneObjs = row => !row ? [] : row.lane ? row.lane.objs : row.objs;

W.trainState = function (row, t) {
  const tr = row.train, p = (((t + tr.off) % tr.T) + tr.T) % tr.T;
  if (p < tr.warn) return { warn: true, x: null };
  const q = p - tr.warn, sx = -tr.dir * (WRAP + tr.len / 2), x = sx + tr.dir * tr.speed * q;
  if (Math.abs(x) > WRAP + tr.len / 2 + 1) return { warn: false, x: null };
  return { warn: false, x: x };
};
/* tide phase: 0 dry, 1 the foam creeps in (warning), 2 flooded (deadly), 3 draining */
W.tidePhase = function (row, t) {
  const td = row.tide, q = (((t + td.off) % td.T) + td.T) % td.T;
  return q < td.warn ? 1 : q < td.warn + td.dur ? 2 : q < td.warn + td.dur + 0.7 ? 3 : 0;
};
/* hazard overlapping x at time t (pad = extra reach; the planner asks with a bigger pad than the game uses). A road lane hurts across the three middle rows of its five. */
W.hitAt = function (row, x, t, pad) {
  if (!row) return null;
  const pd = pad === undefined ? 0.3 : pad;
  if (row.type === 'road') {
    const L = row.lane; if (!L || Math.abs(row.r - L.rc) > 1) return null;
    for (const o of L.objs) if (o.alive && o.hurts && Math.abs(W.objX(o, t) - x) < o.len / 2 + pd) return o;
  } else if (row.type === 'roll') {
    for (const o of row.objs) if (o.alive && o.hurts && Math.abs(W.objX(o, t) - x) < o.len / 2 + pd) return o;
  } else if (row.type === 'rail' && row.train && row.train.alive) {
    const s = W.trainState(row, t);
    if (s.x !== null && Math.abs(s.x - x) < row.train.len / 2 + pd) return row.train;
  } else if (row.type === 'tide' && row.tide && W.tidePhase(row, t) === 2) return row.tide;
  return null;
};
W.logAt = function (row, x, t, pad) {
  if (!row || row.type !== 'water') return null;
  const pd = pad === undefined ? 0.25 : pad;
  for (const o of row.objs) if (Math.abs(W.objX(o, t) - x) < o.len / 2 + pd) return o;
  return null;
};
W.padAt = (row, x) => !!(row && row.pads && row.pads.has(Math.round(x)));

/* The one answer to "what is under my feet at (row, x, t)?" Water needs a log, lily water needs a pad, a lake needs nothing but a shore, everything else is ground. */
W.baseOf = row => !row ? 0 : row.y + (row.type === 'water' ? AH.LOGTOP : row.type === 'lily' ? AH.PADY : 0);
W.groundY = function (x, z) { const row = W.rows.get(Math.round(-z)); return row && row.T ? row.y + row.T.E(z + row.r) : 0; };
W.stand = function (row, x, t, pad) {
  if (!row) return { ok: false, kind: 'void' };
  if (row.type === 'water') { const lg = W.logAt(row, x, t, pad); return lg ? { ok: true, base: row.y + AH.LOGTOP, log: lg } : { ok: false, kind: 'water' }; }
  if (row.type === 'lily') return W.padAt(row, x) ? { ok: true, base: row.y + AH.PADY, snap: Math.round(x) } : { ok: false, kind: 'water' };
  if (row.wet && row.wet.has(Math.round(x))) return { ok: false, kind: 'water' };
  return { ok: true, base: row.y };
};

/* destruction (applied locally; fx.js broadcasts it) */
W.killObj = function (r, i, silent) {
  W.killed.add(r + ':' + i);
  const row = W.rows.get(r); if (!row) return false;
  const o = i < 0 ? row.train : row.objs[i];
  if (!o || !o.alive) return false;
  o.alive = false; if (o.mesh) o.mesh.visible = false;
  if (!silent) AH.burst(8, o.x !== undefined ? o.x : 0, 0.6, -r, [0xffd23f, 0xffffff, 0xff7a59], 3, 4);
  return true;
};
W.removeBlocker = function (r, c, silent) {
  { const rw = W.rows.get(r), q = rw && rw.blockers.get(c); if (q && (q.kind === 'fence' || q.kind === 'barrier')) return false; }      // gates and the exit barrier can never be dug through
  W.removed.add(r + ':' + c);
  const row = W.rows.get(r); if (!row) return false;
  const bl = row.blockers.get(c);
  if (!bl || bl.kind === 'fence') return false;
  row.blockers.delete(c); if (bl.node) row.group.remove(bl.node);
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
/* the exit belt of arena A: trees and boulders, only breakable once the guardian is beaten. Returns the gate row, or null. */
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
      const z = -row.r, tr = bar.th.tree, cols = [tr ? tr.trunk : 0x7a5535, tr ? tr.c : 0x4cc46f, bar.th.roll.ball, bar.th.roll.hill];
      for (let x = -COLS; x <= COLS; x += 1.5) AH.burst(4, x, 0.8 + Math.random() * 1.4, z, cols, 4.5, 6);
      AH.cam.shake = Math.max(AH.cam.shake, 0.7); AH.beep(70, 0.6, 'sawtooth', 0.1, -30);
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
  AH.waveT.value = t;
  W.rows.forEach(row => {
    for (const o of row.objs) {
      if (!o.alive) continue;
      if (o.kind === 'roll') {                                          // hill boulders: x runs along the hill-top path, rollUpdate places them
        o.x = wrapX(o.x0 + o.dir * o.speed * t);
        const px = o.x * o.dir;
        o.px = px;
        rollUpdate(row, Object.assign(o, { x: o.x }), t, fz, dt);
        continue;
      }
      o.x = wrapX(o.x0 + o.dir * o.speed * t); o.mesh.position.x = o.x;
      o.mesh.castShadow = Math.abs(o.x) < AH.BGX + 1;
      if (row.follow) {                                                  // traffic and falls logs follow the terrain
        const p = row.T.H(0, o.x) - row.T.E(0), q = row.T.H(0, o.x + 0.3) - row.T.H(0, o.x - 0.3);
        o.mesh.position.y = p; o.mesh.rotation.z = Math.atan2(q, 0.6); o.mesh.visible = Math.abs(o.x) < row.cutX;
      }
    }
    if (row.shakeT > 0) { row.shakeT -= dt; if (row.mesh) row.mesh.position.y = row.shakeT > 0 ? Math.sin(t * 70) * 0.035 * (row.shakeT / 0.6) : 0; }
    if (row.train) {
      const s = W.trainState(row, t), tr = row.train;
      tr.mesh.visible = tr.alive && s.x !== null;
      if (s.x !== null) { tr.mesh.position.x = s.x; tr.x = s.x; }
      const on = s.warn && Math.floor(t * 6) % 2 === 0;
      row.lamp.material = AH.M(on ? 0xff3b3b : 0x552222);
    }
    if (row.tide) {                                                      // the sea creeps up the beach, floods it for a moment, then drains
      const ph = W.tidePhase(row, t), td = row.tide, q = (((t + td.off) % td.T) + td.T) % td.T, sh = td.mesh;
      sh.visible = ph > 0;
      sh.position.y = ph === 1 ? -0.3 + 0.18 * (q / td.warn) : ph === 2 ? 0.12 : ph === 3 ? 0.12 - 0.45 * ((q - td.warn - td.dur) / 0.7) : -0.3;
      if (ph === 1 && Math.abs(-row.r - fz) < 9 && Math.random() < dt * 4) AH.burst(1, (Math.random() - 0.5) * 2 * X0, row.y + 0.05, -row.r, [0xffffff, 0xdff6ff], 0.8, 1.2);
    }
    if (row.flow) {
      row.flow.m.position.x = (row.flow.off + row.flow.v * t) % FLOWP;
      if (Math.abs(-row.r - fz) < 9 && Math.random() < dt * 0.35) {          // a small splash somewhere on the water
        const lava = row.theme === 'volcano', sx = (Math.random() - 0.5) * 20;
        AH.burst(lava ? 3 : 2, sx, row.y + (lava ? 0.1 : -0.2), -row.r + (Math.random() - 0.5) * 0.6, lava ? [0xff6a1a, 0xffd23f] : [0xffffff, 0xcfeaff], lava ? 1.0 : 0.7, lava ? 3.2 : 2.4);
      }
    }
  });
};
})();
