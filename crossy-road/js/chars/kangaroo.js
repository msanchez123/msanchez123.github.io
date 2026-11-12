/* Character contract (see README in the page source):
 *   id, name, col, blurb, label, flies?, noFall?
 *   geo(Builder)        voxel model, front faces -z
 *   init(p)             reset per-player state in p.cs
 *   onStep(p)           a normal hop just started (charge up)
 *   onLand(p)?          any hop landed
 *   press(p)            ability button
 *   update(p, dt)       per frame
 *   guard(p, kind, obj) return true to survive a hit
 *   veto(p, row, x, t)  return true to forbid a landing
 *   ui(p)               {label, pct, ready, text} for the ability button
 *   aim(p)?             blocks the held-tap indicator should show (0 = hide)
 */
(function () {
'use strict';
const AH = window.AH, INK = 0x10324a;
AH.chars.push({
  id: 'kangaroo', name: 'Kangaroo', col: 0xc98a4b, label: 'LEAP',
  blurb: 'Every hop adds a block. Hold the screen, aim, then press LEAP to jump up to 6 blocks.',
  geo(B) {
    const c = 0xc98a4b, l = 0xf0d2a0, d = 0x8a5a2e, b = new B();
    b.box(0.62, 0.7, 0.6, c, 0, 0.78, 0.1).box(0.4, 0.4, 0.06, l, 0, 0.7, -0.22)
     .box(0.4, 0.4, 0.42, c, 0, 1.3, -0.1).box(0.22, 0.18, 0.2, l, 0, 1.22, -0.36).box(0.1, 0.07, 0.05, INK, 0, 1.27, -0.47)
     .box(0.07, 0.09, 0.04, INK, 0.12, 1.36, -0.32).box(0.07, 0.09, 0.04, INK, -0.12, 1.36, -0.32)
     .box(0.12, 0.42, 0.1, c, 0.14, 1.7, -0.05).box(0.12, 0.42, 0.1, c, -0.14, 1.7, -0.05)
     .box(0.05, 0.3, 0.04, l, 0.14, 1.7, -0.11).box(0.05, 0.3, 0.04, l, -0.14, 1.7, -0.11)
     .box(0.12, 0.3, 0.12, c, 0.36, 0.8, -0.2).box(0.12, 0.3, 0.12, c, -0.36, 0.8, -0.2)
     .box(0.2, 0.34, 0.5, d, 0.2, 0.17, 0.12).box(0.2, 0.34, 0.5, d, -0.2, 0.17, 0.12)
     .box(0.2, 0.1, 0.5, d, 0.2, 0.05, -0.1).box(0.2, 0.1, 0.5, d, -0.2, 0.05, -0.1)
     .box(0.2, 0.2, 0.8, c, 0, 0.35, 0.75).box(0.14, 0.14, 0.2, d, 0, 0.28, 1.2);
    return b.build();
  },
  init(p) { p.cs = { hops: 0 }; p.inv = false; p.burn = false; p.glow = false; },
  aim(p) { return p.cs.hops >= 1 ? Math.min(6, p.cs.hops + 1) : 0; },
  ui(p) {
    const n = this.aim(p);
    return { label: 'LEAP', pct: Math.min(100, p.cs.hops / 5 * 100), ready: n >= 2, text: n >= 2 ? 'x' + n : '0/5' };
  },
  onStep(p) { p.cs.hops = Math.min(5, p.cs.hops + 1); },
  press(p) {
    const n = this.aim(p);
    if (n < 2) { AH.beep(130, 0.06, 'square', 0.03); return; }
    if (!p.holding) { AH.beep(130, 0.06, 'square', 0.03); if (AH.toast) AH.toast('Hold the screen first, then press LEAP'); return; }
    AH.player.cancelHold();
    const ok = AH.player.tryMove(p.dirKey, n, true);
    if (ok || p.buf) p.cs.hops = 0;
  },
  update() {},
  guard() { return false; }
});
})();
