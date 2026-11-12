(function () {
'use strict';
const AH = window.AH, INK = 0x10324a;
AH.chars.push({
  id: 'gull', name: 'Seagull', col: 0xdfe6ee, label: 'POOP', flies: true,
  blurb: 'Flies high above everything. Nothing can hurt you, but you earn no score. Every 4 hops, drop a bomb that wrecks hazards and hurts bosses.',
  geo(B) {
    const w = 0xffffff, b = new B();
    b.box(0.5, 0.4, 0.8, w, 0, 0.6, 0).box(0.34, 0.2, 0.5, 0xe8eef5, 0, 0.45, 0.02)
     .box(0.34, 0.34, 0.34, w, 0, 0.9, -0.42).box(0.12, 0.1, 0.24, 0xff9f1a, 0, 0.85, -0.65)
     .box(0.07, 0.08, 0.04, INK, 0.1, 0.95, -0.6).box(0.07, 0.08, 0.04, INK, -0.1, 0.95, -0.6)
     .box(0.9, 0.06, 0.5, 0xe8eef5, 0.7, 0.72, 0.05).box(0.9, 0.06, 0.5, 0xe8eef5, -0.7, 0.72, 0.05)
     .box(0.4, 0.06, 0.4, 0x6b7785, 1.3, 0.72, 0.1).box(0.4, 0.06, 0.4, 0x6b7785, -1.3, 0.72, 0.1)
     .box(0.3, 0.06, 0.4, 0xdfe6ee, 0, 0.62, 0.55)
     .box(0.06, 0.2, 0.06, 0xff9f1a, 0.1, 0.3, -0.05).box(0.06, 0.2, 0.06, 0xff9f1a, -0.1, 0.3, -0.05);
    return b.build();
  },
  init(p) { p.cs = { steps: 0 }; p.inv = true; p.burn = false; p.glow = false; },
  ui(p) { return { label: 'POOP', pct: p.cs.steps / 4 * 100, ready: p.cs.steps >= 4, text: p.cs.steps >= 4 ? 'DROP' : p.cs.steps + '/4' }; },
  onStep(p) { p.cs.steps = Math.min(4, p.cs.steps + 1); },
  press(p) {
    if (p.cs.steps < 4) { AH.beep(130, 0.06, 'square', 0.03); return; }
    AH.fx.poop(p.x, p.z, true);
    p.cs.steps = 0;
  },
  update() {},
  guard() { return true; }
});
})();
