(function () {
'use strict';
const AH = window.AH, INK = 0x10324a;
AH.chars.push({
  id: 'gorilla', name: 'Gorilla', col: 0x59606e, label: 'STOMP',
  blurb: 'Every 6 hops, stomp the ground: everything within 3 blocks gets smashed, hazards and obstacles alike. Logs survive.',
  geo(B) {
    const d = 0x343943, m = 0x555b68, k = 0x20242c, face = 0x806b5e, chest = 0x454b56, silver = 0x9aa0aa, b = new B();
    // Broad tapered-looking torso, raised shoulder mantle and layered chest fur.
    b.box(1.18, 0.92, 0.86, d, 0, 0.92, 0.05).box(1.42, 0.48, 0.82, m, 0, 1.28, 0.02)
     .box(0.78, 0.56, 0.08, chest, 0, 0.96, -0.405).box(0.58, 0.12, 0.08, silver, 0, 1.34, -0.45)
     .box(0.72, 0.52, 0.58, d, 0, 1.62, -0.28).box(0.64, 0.18, 0.18, k, 0, 1.84, -0.49)
    // expressive brow, muzzle, nostrils and focused eyes
     .box(0.72, 0.18, 0.22, k, 0, 1.68, -0.66).box(0.48, 0.28, 0.22, face, 0, 1.43, -0.68)
     .box(0.18, 0.12, 0.06, k, 0, 1.5, -0.805)
     .box(0.09, 0.09, 0.05, 0xfff4dc, 0.2, 1.62, -0.72).box(0.09, 0.09, 0.05, 0xfff4dc, -0.2, 1.62, -0.72)
     .box(0.045, 0.07, 0.035, INK, 0.2, 1.62, -0.755).box(0.045, 0.07, 0.035, INK, -0.2, 1.62, -0.755)
    // long powerful arms with broad knuckles and individual fingers
     .box(0.42, 0.62, 0.48, m, 0.82, 1.02, -0.02).box(0.42, 0.62, 0.48, m, -0.82, 1.02, -0.02)
     .box(0.38, 0.58, 0.42, d, 0.94, 0.49, -0.14).box(0.38, 0.58, 0.42, d, -0.94, 0.49, -0.14)
     .box(0.48, 0.24, 0.5, k, 0.94, 0.16, -0.2).box(0.48, 0.24, 0.5, k, -0.94, 0.16, -0.2)
     .box(0.38, 0.56, 0.42, d, 0.3, 0.38, 0.32).box(0.38, 0.56, 0.42, d, -0.3, 0.38, 0.32)
     .box(0.62, 0.22, 0.82, k, 0, 0.12, 0.02);
    // subtle fur ridges and shoulder tufts
    for (let side of [-1, 1]) for (let i = 0; i < 3; i++) b.box(0.12, 0.34, 0.12, i % 2 ? d : m, side * (0.62 + i * 0.12), 1.48 - i * 0.12, 0.22);
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
