(function () {
'use strict';
const AH = window.AH, INK = 0x10324a;
AH.chars.push({
  id: 'gorilla', name: 'Gorilla', col: 0x59606e, label: 'STOMP',
  blurb: 'Every 6 hops, stomp the ground: everything within 3 blocks gets smashed, hazards and obstacles alike. Logs survive.',
  geo(B) {
    const d = 0x3d3f4a, m = 0x575b6c, k = 0x2b2e36, face = 0x6b5a4e, silver = 0x9aa0aa, b = new B();
    // hunched torso with a heavy shoulder hump and a silver saddle
    b.box(1.0, 0.7, 0.8, d, 0, 0.82, 0.08).box(1.16, 0.34, 0.7, d, 0, 1.12, 0.0).box(0.7, 0.07, 0.5, silver, 0, 1.31, 0.02)
     .box(0.62, 0.4, 0.06, k, 0, 0.84, -0.34).box(0.28, 0.22, 0.05, m, 0.17, 0.95, -0.37).box(0.28, 0.22, 0.05, m, -0.17, 0.95, -0.37)
    // low forward head, brow ridge, bare face
     .box(0.5, 0.42, 0.46, d, 0, 1.12, -0.46).box(0.1, 0.12, 0.3, d, 0, 1.4, -0.42).box(0.56, 0.1, 0.14, k, 0, 1.28, -0.7)
     .box(0.36, 0.26, 0.06, face, 0, 1.1, -0.72).box(0.07, 0.07, 0.04, 0xffffff, 0.1, 1.2, -0.76).box(0.07, 0.07, 0.04, 0xffffff, -0.1, 1.2, -0.76)
     .box(0.04, 0.05, 0.04, INK, 0.1, 1.19, -0.79).box(0.04, 0.05, 0.04, INK, -0.1, 1.19, -0.79)
     .box(0.14, 0.05, 0.04, k, 0, 1.05, -0.77).box(0.2, 0.05, 0.04, 0x3a2f28, 0, 0.96, -0.77)
    // long arms resting on knuckles
     .box(0.3, 0.55, 0.3, d, 0.68, 0.92, 0.0).box(0.3, 0.55, 0.3, d, -0.68, 0.92, 0.0)
     .box(0.28, 0.5, 0.3, d, 0.72, 0.4, -0.1).box(0.28, 0.5, 0.3, d, -0.72, 0.4, -0.1)
     .box(0.34, 0.22, 0.38, k, 0.72, 0.11, -0.16).box(0.34, 0.22, 0.38, k, -0.72, 0.11, -0.16)
     .box(0.32, 0.3, 0.34, d, 0.26, 0.15, 0.34).box(0.32, 0.3, 0.34, d, -0.26, 0.15, 0.34);
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
