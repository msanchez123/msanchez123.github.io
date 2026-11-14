/* themes.js: environment zones. The course is cut into zones; a new zone starts right after each boss arena, and the arena itself
 * wears the theme of the zone it closes. Everything that looks different between zones (ground, water, trees, hazards, arena dressing,
 * sky, and what the chasing wave is made of) lives here as data, so world.js and main.js stay theme-agnostic. */
(function () {
'use strict';
const AH = window.AH, T = AH.T;

/* mix: relative weight of each lane type inside the zone */
const THEMES = AH.THEMES = [
  { id: 'forest', name: 'Forest',
    sky: [0x7cc8f0, 0xd9f2ff], hemi: [0xffffff, 0x9aa8b8], hemiI: 0.62, sunI: 0.5,
    ground: [0x7bcf5a, 0x86d964], tuft: [0x4fae3f, 0x62c24c], bloom: [0xff6fa5, 0xffd23f, 0xffffff, 0xa78bfa], pebble: 0xb3bcc5,
    road: 0x59626e, marking: 0xe9eef2, cone: 0xf97316,
    water: 0x3aa0e8, log: [0x9a6a3a, 0xb07f4a, 0xd9b27c], pad: [0x3fbf5a, 0x46c862, 0x5ad577, 0x2f9a45],
    bed: 0x8d8579, tie: 0x5b4636, steel: 0xaeb6bf,
    roll: { ground: 0xc2a26a, speck: 0x9a8156, ball: 0x8d9199 }, conv: { base: 0x3a3f47, edge: 0xffd23f, belt: 0x2a2e35 },
    tree: { style: 'oak', trunk: 0x7b4f2a, a: [0x2a8f4f, 0x2f9a58], b: [0x39a860, 0x3fb36a], c: 0x4cc46f, cap: 0xdff5c8 }, rock: [0x9aa3ad, 0xb7c0c8, 0x8a939d],
    fence: [0x8a6a4a, 0xb08a5a],
    arena: { a: 0xcfc7b8, b: 0xc2baa9, accent: 0x8fa77a, wall: 0x9d9484, wallTop: 0xb9b0a0, pillar: [0xb9b0a0, 0x9d9484], moss: 0x5f8f4a, flame: [0xff7a1a, 0xffd23f], flag: 0xe5484d, prop: 'ruin' },
    edge: { len: 15, hi: 9, ramp: 8, depth: 11, cliff: 3, far: 9, rough: 0.3, q: 0.5, flora: 0.3, treeline: 6, peak: 0xaab3bb, fog: 0xd9f2ff, fall: 0xbfe6ff },
    mix: { grass: 1, road: 1, water: 1, rail: 1, lily: 1, conv: 1, roll: 1 },
    chase: { id: 'mud', label: 'MUDSLIDE', slab: 0x6b4a2f, rocks: [0x7a5535, 0x5d3f27, 0x8b6a45, 0x4c3320], dust: [0x7a5535, 0x5d3f27, 0x9a7a50], glow: 0, death: 'Buried in mud!' } },

  { id: 'winter', name: 'Frozen Peaks',
    sky: [0x93b9e0, 0xeaf4ff], hemi: [0xf2f8ff, 0x8fa4bd], hemiI: 0.7, sunI: 0.44,
    ground: [0xf3f8ff, 0xe3eefa], tuft: [0xcfe3f5, 0xb7d3ec], bloom: [0x9fd8ff, 0xffffff, 0xc7b8ff], pebble: 0x9aa9b8,
    road: 0x4a5663, marking: 0xdfeaf4, cone: 0x38bdf8,
    water: 0x3f86c2, log: [0xdbe9f5, 0xf5fbff, 0xb5d3ea], pad: [0xcfe6f7, 0xe3f2fc, 0xf6fbff, 0x9cc4e0],
    bed: 0x9aa7b4, tie: 0x56606c, steel: 0xc9d3dc,
    roll: { ground: 0xdfe9f3, speck: 0xb4c6d8, ball: 0xf4f9ff }, conv: { base: 0x3b4654, edge: 0x7dd3fc, belt: 0x2c3541 },
    tree: { style: 'pine', trunk: 0x6b4a33, a: [0x1f6b4a, 0x23785a], b: [0x2b8a63, 0x319a70], c: 0x3bb07c, cap: 0xffffff }, rock: [0x8e9db0, 0xc5d3e2, 0x7a899c],
    fence: [0x9cc4e0, 0xdff1fb],
    arena: { a: 0xdcebf7, b: 0xc9dff0, accent: 0x7cc8f0, wall: 0x9cc4e0, wallTop: 0xeaf6ff, pillar: [0xbfe3f8, 0x8fc4e6], moss: 0xffffff, flame: [0x38bdf8, 0xe0f7ff], flag: 0x38bdf8, prop: 'ice' },
    edge: { len: 14, hi: 11, ramp: 7, depth: 12, cliff: 3, far: 10, rough: 0.35, q: 0.5, flora: 0.28, treeline: 5, peak: 0xffffff, fog: 0xeaf4ff, fall: 0xd8f0ff },
    mix: { grass: 1, road: 0.8, water: 1.35, rail: 0.7, lily: 1.3, conv: 0.9, roll: 1.4 },
    chase: { id: 'snow', label: 'AVALANCHE', slab: 0xf2f9ff, rocks: [0xffffff, 0xe9f5ff, 0xd5eafb, 0xf6fbff], dust: [0xffffff, 0xe9f5ff, 0xcfe6f7], glow: 0, death: 'Buried in snow!' } },

  { id: 'desert', name: 'Dune Sea',
    sky: [0xf5b46c, 0xffeccd], hemi: [0xfff1d6, 0xb89a6a], hemiI: 0.66, sunI: 0.58,
    ground: [0xe8cf8a, 0xdfc27a], tuft: [0xb59a4a, 0xc9ae5a], bloom: [0xff7ab0, 0xffe066, 0xffffff], pebble: 0xc9a56a,
    road: 0x6b5f55, marking: 0xf3e6c4, cone: 0xef4444,
    water: 0x2fc3b5, log: [0xc29a62, 0xd8b479, 0xe9cfa0], pad: [0x2fae6a, 0x37c279, 0x5ad99a, 0x1f8a52],
    bed: 0xcdb98c, tie: 0x7a5a3a, steel: 0xb8a98a,
    roll: { ground: 0xd9b77a, speck: 0xb5935a, ball: 0x9c7a47 }, conv: { base: 0x5a4a3a, edge: 0xffd23f, belt: 0x3d3126 },
    tree: { style: 'cactus', trunk: 0x2f8f4a, a: [0x2f8f4a, 0x3aa35a], b: [0x45b86a, 0x4ac36f], c: 0x6fdc8c, cap: 0xff7ab0 }, rock: [0xc9a56a, 0xe2c58e, 0xb08a52],
    fence: [0xb08a52, 0xd8b479],
    arena: { a: 0xe6d0a0, b: 0xd9bf8a, accent: 0xc98a3a, wall: 0xb8935a, wallTop: 0xe2c58e, pillar: [0xd9bf8a, 0xb8935a], moss: 0x2f8f4a, flame: [0xff6a00, 0xffd23f], flag: 0xc2410c, prop: 'obelisk' },
    edge: { len: 16, hi: 8, ramp: 3.5, depth: 10, cliff: 2.5, far: 8, rough: 0.12, q: 2, flora: 0.1, treeline: 5, peak: 0xf0d9a6, fog: 0xffeccd, fall: 0 },
    mix: { grass: 1, road: 1.3, water: 0.6, rail: 1.1, lily: 0.7, conv: 0.9, roll: 1.7 },
    chase: { id: 'sand', label: 'SANDSTORM', slab: 0xd9b36a, rocks: [0xe2c58e, 0xcfa95f, 0xb98f45, 0xf0d9a6], dust: [0xe9cf94, 0xd9b36a, 0xf5e3b5], glow: 0, death: 'Buried in sand!' } },

  { id: 'volcano', name: 'Ember Rift',
    sky: [0x4a2f3a, 0xd6704a], hemi: [0xffd9c2, 0x6a3a3a], hemiI: 0.6, sunI: 0.55,
    ground: [0x4a4048, 0x423a42], tuft: [0x6a4a3a, 0x7a5844], bloom: [0xff6a1a, 0xffb43a, 0xff3d00], pebble: 0x6b5a5a,
    road: 0x2d2a33, marking: 0xff9a3a, cone: 0xffd23f,
    water: 0xff5a14, log: [0x2b2630, 0x3a3340, 0x1c1820], pad: [0x2b2630, 0x3a3340, 0x4a4252, 0xff6a1a],
    bed: 0x39333c, tie: 0x6a3a2a, steel: 0x8a7a7a,
    roll: { ground: 0x3a323a, speck: 0xff6a1a, ball: 0x2a2430 }, conv: { base: 0x2a2630, edge: 0xff7a1a, belt: 0x1c1820 },
    tree: { style: 'char', trunk: 0x241d20, a: [0x2f262a, 0x3a3034], b: [0x4a3a3a, 0x4a3a3a], c: 0xff6a1a, cap: 0xff8a1a }, rock: [0x4a424c, 0x6a5a6a, 0x332d38],
    fence: [0x2f2a36, 0xff6a1a],
    arena: { a: 0x4a4250, b: 0x3d3644, accent: 0xff6a1a, wall: 0x2f2a36, wallTop: 0x5a4a5a, pillar: [0x3a3340, 0x2b2630], moss: 0xff6a1a, flame: [0xff3d00, 0xffd23f], flag: 0xff6a1a, prop: 'basalt' },
    edge: { len: 13, hi: 10, ramp: 6, depth: 13, cliff: 3, far: 10, rough: 0.5, q: 0.5, flora: 0.18, treeline: 7, peak: 0x6a5a6a, fog: 0xd6704a, fall: 0xff8a2a },
    mix: { grass: 1, road: 0.75, water: 1.35, rail: 0.9, lily: 1.5, conv: 1.4, roll: 1 },
    chase: { id: 'lava', label: 'LAVA FLOW', slab: 0xff5a14, rocks: [0xff7a1a, 0x2b2630, 0xff4a0a, 0x3a3340], dust: [0xff6a1a, 0xffb43a, 0x2b2630], glow: 0xff3d00, death: 'Scorched!' } },

  { id: 'city', name: 'Neon Metropolis',
    sky: [0x3a3f86, 0xf7b6c8], hemi: [0xe3e8ff, 0x6a6a96], hemiI: 0.64, sunI: 0.46,
    ground: [0x8c93a0, 0x969dab], tuft: [0x6d7480, 0x7a8290], bloom: [0xff4fa0, 0x38e1ff, 0xffd23f], pebble: 0x6b7280,
    road: 0x2f333b, marking: 0xf5d142, cone: 0xff7a1a,
    water: 0x2d8fc9, log: [0x7a828f, 0x9aa3b0, 0x5d6570], pad: [0x5b6b8a, 0x6d7fa3, 0x8aa0c8, 0x38e1ff],
    bed: 0x6a6f78, tie: 0x4a4f58, steel: 0xc5ccd6,
    roll: { ground: 0x7a8190, speck: 0x5b6270, ball: 0xd9503a }, conv: { base: 0x2a2f38, edge: 0x38e1ff, belt: 0x20242b },
    tree: { style: 'tower', trunk: 0x5d6570, a: [0x6a7380, 0x7a8492], b: [0x4a5568, 0x35405a], c: 0xffd98a, cap: 0x38e1ff }, rock: [0x7a828f, 0x9aa3b0, 0x5d6570],
    fence: [0x5d6570, 0xf5d142],
    arena: { a: 0x6b7280, b: 0x5d6570, accent: 0x38e1ff, wall: 0x3a4150, wallTop: 0x5a6475, pillar: [0x4a5160, 0x2f3440], moss: 0x38e1ff, flame: [0xff4fa0, 0x38e1ff], flag: 0xff4fa0, prop: 'tower' },
    edge: { len: 12, hi: 12, ramp: 5, depth: 12, cliff: 1.5, far: 10, rough: 0, q: 1, flora: 0, treeline: 99, peak: 0x5a6475, fog: 0xf7b6c8, fall: 0, blocks: true, body: [0x3a4150, 0x2a3550, 0x4a5568, 0x35405a], top: [0x4a5160, 0x5d6570] },
    mix: { grass: 0.7, road: 1.6, water: 0.5, rail: 1.3, lily: 0.4, conv: 1.2, roll: 0.8 },
    chase: { id: 'rubble', label: 'DEMOLITION', slab: 0x7a828f, rocks: [0x8a93a1, 0x5d6570, 0xb4bcc8, 0x4a5160], dust: [0xb4bcc8, 0x8a93a1, 0xe0e5eb], glow: 0, death: 'Crushed by rubble!' } },

  { id: 'temple', name: 'Sun Temple',
    sky: [0x4fb8a4, 0xfff0b8], hemi: [0xfff4d0, 0x5a7a5a], hemiI: 0.66, sunI: 0.56,
    ground: [0x5a9a44, 0x63a54d], tuft: [0x3f7f35, 0x4d8f3f], bloom: [0xff5a8a, 0xffd23f, 0xffffff], pebble: 0xa8a090,
    road: 0x8a7f6a, marking: 0xd9c9a0, cone: 0xe07a2a,
    water: 0x2fb0a0, log: [0x6b4a2a, 0x8a6338, 0xb08a5a], pad: [0x2f9a45, 0x3fb55a, 0x5ad577, 0xff5a8a],
    bed: 0x9a9080, tie: 0x5b4636, steel: 0xb5a98a,
    roll: { ground: 0xb7a67a, speck: 0x8a7a52, ball: 0x8d8a80 }, conv: { base: 0x6a5a3a, edge: 0xffd23f, belt: 0x4a3d28 },
    tree: { style: 'palm', trunk: 0x8a6a3a, a: [0x2f9a45, 0x3fb55a], b: [0x4cc46f, 0x5ad577], c: 0x7be08f, cap: 0xffd23f }, rock: [0x9a9484, 0xb5ae9a, 0x7a7566],
    fence: [0x8a7a5a, 0xf2c14e],
    arena: { a: 0xcdbf94, b: 0xbfb084, accent: 0x2fb0a0, wall: 0x8f8566, wallTop: 0xb5a97c, pillar: [0xb5a97c, 0x8f8566], moss: 0x4a8a3a, flame: [0xff7a1a, 0x2fe0c0], flag: 0x1f9a8a, prop: 'pyramid' },
    edge: { len: 14, hi: 9, ramp: 9, depth: 10, cliff: 3, far: 9, rough: 0.2, q: 1, flora: 0.34, treeline: 6, peak: 0xb5ae9a, fog: 0xfff0b8, fall: 0xbfeee6 },
    mix: { grass: 1.1, road: 0.7, water: 1, rail: 0.5, lily: 1.2, conv: 0.6, roll: 1.8 },
    chase: { id: 'ruin', label: 'COLLAPSE', slab: 0x9a9170, rocks: [0xb5ae8a, 0x7a7556, 0x8a8a70, 0x5b5a45], dust: [0xb5ae8a, 0x8a8560, 0xd9d2a8], glow: 0, death: 'Crushed by ruins!' } }
];

/* creature skins for the traffic lanes: zones with an entry here run beasts instead of cars (small = car slot, big = truck slot) */
AH.BEASTS = { winter: { small: 'wolf', big: 'mammoth' }, desert: { small: 'scarab', big: 'scorpion' }, temple: { small: 'jaguar', big: 'boar' }, volcano: { small: 'salamander', big: 'tortoise' } };

AH.zoneOf = r => Math.max(0, Math.floor((r - AH.ARENA_LEN) / AH.ARENA_EVERY));
AH.themeAt = r => THEMES[AH.zoneOf(r) % THEMES.length];

/* ---- sky and light follow whichever zone the camera is looking at, with a soft crossfade ---- */
const S = { t: new T.Color(THEMES[0].sky[0]), b: new T.Color(THEMES[0].sky[1]), hs: new T.Color(THEMES[0].hemi[0]), hg: new T.Color(THEMES[0].hemi[1]), hi: THEMES[0].hemiI, si: THEMES[0].sunI };
const tmp = new T.Color(); let lastSig = '';
AH.skyTo = function (row, dt, snap) {
  const th = AH.themeAt(row), k = snap ? 1 : Math.min(1, dt * 1.6);
  S.t.lerp(tmp.setHex(th.sky[0]), k); S.b.lerp(tmp.setHex(th.sky[1]), k);
  S.hs.lerp(tmp.setHex(th.hemi[0]), k); S.hg.lerp(tmp.setHex(th.hemi[1]), k);
  S.hi += (th.hemiI - S.hi) * k; S.si += (th.sunI - S.si) * k;
  AH.hemi.color.copy(S.hs); AH.hemi.groundColor.copy(S.hg); AH.hemi.intensity = S.hi; AH.sun.intensity = S.si;
  const sig = S.t.getHex() + ':' + S.b.getHex();
  if (sig !== lastSig) {
    lastSig = sig;
    const g = 'linear-gradient(180deg,#' + S.t.getHexString() + ',#' + S.b.getHexString() + ')';
    document.body.style.background = g;
  }
};
})();
