/* Fox (passive only): never falls in water or off ledges, and once per checkpoint a deadly hit sets it ablaze for a 3 second survival window.
 * While the window lasts it shrugs off hazards and its fire trail burns them. The wave (avalanche, mudslide...) is the one thing that still kills it. */
(function () {
'use strict';
const AH = window.AH, W = AH.world, T = AH.T, INK = 0x10324a, CREAM = 0xfff6ea, DARK = 0x3a2418;
const FIRE_T = 3;

const PAL = { c: 0xf0782a, light: 0xffb066, cream: CREAM, dark: DARK };
const FIREPAL = { c: 0xd92b12, light: 0xff9a2e, cream: 0xffd36b, dark: 0x2a0b06 };
const TRAIL = 9;   // seconds a flame patch burns
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
  blurb: 'Never hops into water or off edges. Once per checkpoint, a fatal hit turns it into a fire fox for 3 seconds: an explosion, a long burning trail, and it survives. The wave and the map edge still kill it.',
  geo(B) { return foxModel(B, PAL); },
  fireGeo(B) { return foxModel(B, FIREPAL); },
  init(p) {
    if (p.cs && p.cs.trail) p.cs.trail.forEach(t => AH.scene.remove(t.mesh));
    if (p.cs && p.cs.fl) AH.pg.remove(p.cs.fl);
    p.cs = { fireAvail: true, fire: 0, drop: 0, trail: [], fl: null }; p.inv = false; p.burn = false; p.glow = false;
  },
  ui(p) {
    const c = p.cs;
    return { label: 'FIRE', pct: c.fire > 0 ? c.fire / FIRE_T * 100 : c.fireAvail ? 100 : 0, ready: false, text: c.fire > 0 ? Math.ceil(c.fire) + 's' : c.fireAvail ? 'READY' : 'USED', passive: true };
  },
  veto(p, row, x, t) {
    if (row.type === 'water') return !W.logAt(row, x, t);
    if (row.type === 'lily') return !W.padAt(row, x);
    return false;
  },
  guard(p, kind, obj) {
    const c = p.cs;
    if (!c.fireAvail || c.fire > 0) return false;
    c.fireAvail = false; c.fire = FIRE_T; c.drop = 0; p.inv = true; p.burn = true;
    AH.burst(18, p.x, 0.6, p.z, [0xff8a1a, 0xffd23f, 0xff4a00], 3.5, 5);
    AH.fx.blast(p.row, p.x, true);
    AH.beep(260, 0.4, 'sawtooth', 0.07, 400);
    if (obj && AH.fx) AH.fx.kill(obj, true);
    return true;
  },
  onStep(p) { if (p.burn) this.dropFire(p); },
  onLand(p) { if (p.burn) this.dropFire(p); },
  dropFire(p) {
    const fl = AH.fx.makeFlames(3, 0.28, 0.6);
    fl.position.set(p.x, 0, p.z); AH.scene.add(fl);
    p.cs.trail.push({ mesh: fl, x: p.x, row: Math.round(-p.z), t: 0 });
  },
  update(p, dt) {
    const c = p.cs, tr = c.trail;
    if (p.dead) { p.burn = false; c.fire = 0; }
    if (!!p.burn !== !!c.wasBurn) { c.wasBurn = !!p.burn; AH.pm.geometry = p.burn ? AH.charFireGeo(p.chi) : AH.charGeo(p.chi); }
    if (p.burn) {
      c.fire -= dt; c.drop -= dt;
      if (c.drop <= 0 && !p.jumping) { c.drop = 0.35; this.dropFire(p); }   // keeps burning while it stands still
      if (c.fire <= 0) { c.fire = 0; p.burn = false; p.inv = false; }
    }
    if (p.burn && !p.cs.fl) { p.cs.fl = AH.fx.makeFlames(4, 0.4, 0.7); AH.pg.add(p.cs.fl); }
    if (p.cs.fl) { p.cs.fl.visible = p.burn; if (p.burn) AH.fx.tickFlames(p.cs.fl, AH.now()); }
    for (let i = tr.length - 1; i >= 0; i--) {
      const f = tr[i]; f.t += dt;
      AH.fx.tickFlames(f.mesh, AH.now()); const fade = f.t > TRAIL - 0.8 ? Math.max(0.05, (TRAIL - f.t) / 0.8) : 1; f.mesh.scale.set(fade, fade, fade);
      const row = W.get(f.row);
      if (row) {
        if (row.type === 'road' || row.type === 'roll') {
          for (const o of row.objs) if (o.alive && o.hurts && Math.abs(W.objX(o, AH.now()) - f.x) < o.len / 2 + 0.7) AH.fx.kill(o, true);
        } else if (row.type === 'rail' && row.train && row.train.alive) {
          const s = W.trainState(row, AH.now());
          if (s.x !== null && Math.abs(s.x - f.x) < row.train.len / 2 + 0.7) AH.fx.kill(row.train, true);
        }
      }
      if (f.t > TRAIL) { AH.scene.remove(f.mesh); tr.splice(i, 1); }
    }
  }
});
AH.on('arena', function () { const p = AH.P; if (p.ch && p.ch.id === 'fox' && p.cs) p.cs.fireAvail = true; });
})();
