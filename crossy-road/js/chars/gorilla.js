(function () {
'use strict';
const AH = window.AH, INK = 0x10324a;
AH.chars.push({
  id: 'gorilla', name: 'Gorilla', col: 0x59606e, label: 'STOMP',
  blurb: 'Every 6 hops, stomp the ground: everything within 3 blocks gets smashed, hazards and obstacles alike. Logs survive.',
  geo(B) {
    // a voxel gorilla in the same style as the other animals: hunched, broad-shouldered, long arms to the ground, small head sunk low. Front is -z.
    const fur = 0x4d525f, fur2 = 0x5e6472, dark = 0x2f333c, silver = 0x9fa6b2, skin = 0x6b5a52, face = 0x3a3430, b = new B();
    // legs and feet
    for (const s of [-1, 1]) b.box(0.36, 0.42, 0.4, fur, s * 0.27, 0.21, 0.18).box(0.42, 0.12, 0.5, dark, s * 0.27, 0.06, 0.05);
    // belly, then the big hunched chest and shoulders pushed forward
    b.box(0.86, 0.34, 0.66, fur, 0, 0.58, 0.14).box(1.06, 0.58, 0.8, fur2, 0, 1.0, 0.04).box(1.3, 0.36, 0.78, fur, 0, 1.38, -0.02);
    b.box(0.6, 0.34, 0.05, skin, 0, 1.0, -0.37);                                           // bare chest
    b.box(1.0, 0.1, 0.64, silver, 0, 1.6, 0.1).box(0.7, 0.1, 0.5, silver, 0, 1.0, 0.46);   // silverback saddle and lower back
    // head: low and forward between the shoulders, heavy brow, muzzle, crest
    b.box(0.6, 0.5, 0.52, fur, 0, 1.52, -0.5).box(0.24, 0.2, 0.4, dark, 0, 1.84, -0.42);
    b.box(0.66, 0.12, 0.16, dark, 0, 1.64, -0.8).box(0.38, 0.26, 0.2, face, 0, 1.4, -0.82).box(0.26, 0.05, 0.04, 0x0d0d10, 0, 1.3, -0.93);
    b.box(0.07, 0.07, 0.03, 0x0d0d10, 0.07, 1.46, -0.93).box(0.07, 0.07, 0.03, 0x0d0d10, -0.07, 1.46, -0.93);
    b.box(0.14, 0.11, 0.05, 0xffffff, 0.15, 1.5, -0.775).box(0.14, 0.11, 0.05, 0xffffff, -0.15, 1.5, -0.775);
    b.box(0.07, 0.08, 0.04, 0x111111, 0.15, 1.5, -0.81).box(0.07, 0.08, 0.04, 0x111111, -0.15, 1.5, -0.81);
    b.box(0.1, 0.16, 0.1, dark, 0.34, 1.54, -0.42).box(0.1, 0.16, 0.1, dark, -0.34, 1.54, -0.42);
    // arms: big shoulders, long columns down to knuckles on the ground
    for (const s of [-1, 1]) {
      b.box(0.46, 0.5, 0.56, fur2, s * 0.8, 1.36, -0.02).box(0.34, 0.86, 0.36, fur, s * 0.88, 0.8, -0.1).box(0.38, 0.3, 0.4, fur2, s * 0.88, 0.3, -0.18);
      b.box(0.42, 0.2, 0.46, dark, s * 0.88, 0.1, -0.24).box(0.1, 0.1, 0.14, dark, s * 0.78, 0.05, -0.52).box(0.1, 0.1, 0.14, dark, s * 0.98, 0.05, -0.52);
    }
    return b.build();
  },
  init(p) { p.cs = { steps: 0 }; p.inv = false; p.burn = false; p.glow = false; },
  ui(p) { return { label: 'STOMP', pct: p.cs.steps / 6 * 100, ready: p.cs.steps >= 6, text: p.cs.steps >= 6 ? 'GO!' : p.cs.steps + '/6' }; },
  onStep(p) { p.cs.steps = Math.min(6, p.cs.steps + 1); },
  press(p) {
    if (p.cs.steps < 6) { AH.beep(130, 0.06, 'square', 0.03); return; }
    AH.player.cancelHold();
    AH.fx.stomp(p.row, p.x, true);
    p.cs.steps = 0; p.landT = 0.2;
  },
  update() {},
  guard() { return false; }
});
})();
