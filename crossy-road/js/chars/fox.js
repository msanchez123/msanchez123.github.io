/* Fox (passive only): never falls in water or off ledges. Its skill starts charged: the first deadly hit sets it ablaze for a 3 second survival window
 * (an explosion, then a subtle pulsing fire aura) in which it shrugs off hazards. Once the aura has died down the skill recharges after 20 more hops.
 * The wave (avalanche, mudslide...) is the one thing that still kills it. */
(function () {
'use strict';
const AH = window.AH, W = AH.world, T = AH.T, INK = 0x10324a, CREAM = 0xfff6ea, DARK = 0x3a2418;
const FIRE_T = 3, NEED = 20;

const PAL = { c: 0xf0782a, light: 0xffb066, cream: CREAM, dark: DARK };
const FIREPAL = { c: 0xff8a34, light: 0xffbd7c, cream: CREAM, dark: DARK };   // only the orange fur warms up, and only a little
function foxModel(B, q) {
  const c = q.c, light = q.light, cream = q.cream, dark = q.dark, b = new B();
  b.box(0.58, 0.5, 0.9, c, 0, 0.52, 0.1).box(0.38, 0.3, 0.06, cream, 0, 0.5, -0.36).box(0.4, 0.1, 0.6, cream, 0, 0.3, 0.1)
   .box(0.52, 0.44, 0.46, c, 0, 0.92, -0.36).box(0.54, 0.18, 0.3, cream, 0, 0.78, -0.5).box(0.22, 0.16, 0.22, light, 0, 0.84, -0.7)
   .box(0.1, 0.08, 0.06, INK, 0, 0.88, -0.83).box(0.08, 0.1, 0.04, INK, 0.15, 1.02, -0.6).box(0.08, 0.1, 0.04, INK, -0.15, 1.02, -0.6)
   .box(0.16, 0.3, 0.12, c, 0.17, 1.24, -0.3).box(0.16, 0.3, 0.12, c, -0.17, 1.24, -0.3)
   .box(0.14, 0.1, 0.1, dark, 0.17, 1.42, -0.3).box(0.14, 0.1, 0.1, dark, -0.17, 1.42, -0.3)
   .box(0.06, 0.18, 0.04, cream, 0.17, 1.22, -0.37).box(0.06, 0.18, 0.04, cream, -0.17, 1.22, -0.37)
   .box(0.26, 0.26, 0.5, c, 0, 0.58, 0.7).box(0.34, 0.34, 0.4, c, 0, 0.7, 1.05).box(0.34, 0.34, 0.22, cream, 0, 0.72, 1.34);
  [[0.2, -0.2], [-0.2, -0.2], [0.2, 0.4], [-0.2, 0.4]].forEach(p => b.box(0.15, 0.3, 0.15, c, p[0], 0.2, p[1]).box(0.16, 0.12, 0.18, dark, p[0], 0.06, p[1] - 0.01));
  return b.build();
}

AH.chars.push({
  id: 'fox', name: 'Fox', col: 0xff8a2a, label: 'FIRE', noFall: true,
  blurb: 'Never hops into water or off edges. Its skill starts charged: a fatal hit sets it ablaze for 3 seconds of pulsing fire in which it survives. Then it recharges after 20 hops. The wave and the map edge still kill it.',
  geo(B) { return foxModel(B, PAL); },
  fireGeo(B) { return foxModel(B, FIREPAL); },
  init(p) {
    if (p.cs && p.cs.fl) AH.pg.remove(p.cs.fl);
    p.cs = { fireAvail: true, fire: 0, steps: 0, fl: null }; p.inv = false; p.burn = false; p.glow = false;
  },
  ui(p) {
    const c = p.cs;
    if (c.fire > 0) return { label: 'FIRE', pct: c.fire / FIRE_T * 100, ready: false, text: Math.ceil(c.fire) + 's', passive: true };
    if (c.fireAvail) return { label: 'FIRE', pct: 100, ready: false, text: 'READY', passive: true };
    return { label: 'FIRE', pct: c.steps / NEED * 100, ready: false, text: c.steps + '/' + NEED, passive: true };
  },
  veto(p, row, x, t) {
    if (row.type === 'water') return !W.logAt(row, x, t);
    if (row.type === 'lily') return !W.padAt(row, x);
    return false;
  },
  guard(p, kind, obj) {
    const c = p.cs;
    if (!c.fireAvail || c.fire > 0) return false;
    c.fireAvail = false; c.fire = FIRE_T; c.steps = 0; p.inv = true; p.burn = true;
    AH.burst(18, p.x, 0.6, p.z, [0xff8a1a, 0xffd23f, 0xff4a00], 3.5, 5);
    AH.fx.blast(p.row, p.x, true);
    AH.beep(260, 0.4, 'sawtooth', 0.07, 400);
    if (obj && AH.fx) AH.fx.kill(obj, true);
    return true;
  },
  onStep(p) {                       // hops recharge the skill, but only once the aura has run out
    const c = p.cs;
    if (c.fireAvail || c.fire > 0) return;
    if (++c.steps >= NEED) { c.steps = 0; c.fireAvail = true; AH.beep(520, 0.2, 'sine', 0.05, 300); AH.burst(8, p.x, 0.8, p.z, [0xffb066, 0xffe0b0], 2, 3); }
  },
  update(p, dt) {
    const c = p.cs;
    if (p.dead) { p.burn = false; c.fire = 0; }
    if (!!p.burn !== !!c.wasBurn) { c.wasBurn = !!p.burn; AH.pm.geometry = p.burn ? AH.charFireGeo(p.chi) : AH.charGeo(p.chi); }
    if (p.burn) {
      c.fire -= dt;
      if (c.fire <= 0) { c.fire = 0; p.burn = false; p.inv = false; }
    }
    if (p.burn && !c.fl) { c.fl = AH.fx.makeAura(); AH.pg.add(c.fl); }
    if (c.fl) { c.fl.visible = p.burn; if (p.burn) AH.fx.tickAura(c.fl, AH.now()); }
  }
});
})();
