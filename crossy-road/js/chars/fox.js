/* Fox (passive only): never falls in water or off ledges, and once per checkpoint a deadly hit turns it into a fire fox for 3 hops. */
(function () {
'use strict';
const AH = window.AH, W = AH.world, T = AH.T, INK = 0x10324a, CREAM = 0xfff6ea, DARK = 0x3a2418;

AH.chars.push({
  id: 'fox', name: 'Fox', col: 0xff8a2a, label: 'FIRE', noFall: true,
  blurb: 'Never falls in water or off edges. Once per checkpoint, a fatal hit sets it ablaze for 3 hops: it survives and its fire trail burns hazards.',
  geo(B) {
    const c = 0xf0782a, light = 0xffb066, b = new B();
    b.box(0.58, 0.5, 0.9, c, 0, 0.52, 0.1).box(0.38, 0.3, 0.06, CREAM, 0, 0.5, -0.36).box(0.4, 0.1, 0.6, CREAM, 0, 0.3, 0.1)
     .box(0.52, 0.44, 0.46, c, 0, 0.92, -0.36).box(0.54, 0.18, 0.3, CREAM, 0, 0.78, -0.5).box(0.22, 0.16, 0.22, light, 0, 0.84, -0.7)
     .box(0.1, 0.08, 0.06, INK, 0, 0.88, -0.83).box(0.08, 0.1, 0.04, INK, 0.15, 1.02, -0.6).box(0.08, 0.1, 0.04, INK, -0.15, 1.02, -0.6)
     .box(0.16, 0.3, 0.12, c, 0.17, 1.24, -0.3).box(0.16, 0.3, 0.12, c, -0.17, 1.24, -0.3)
     .box(0.14, 0.1, 0.1, DARK, 0.17, 1.42, -0.3).box(0.14, 0.1, 0.1, DARK, -0.17, 1.42, -0.3)
     .box(0.06, 0.18, 0.04, CREAM, 0.17, 1.22, -0.37).box(0.06, 0.18, 0.04, CREAM, -0.17, 1.22, -0.37)
     .box(0.26, 0.26, 0.5, c, 0, 0.58, 0.7).box(0.34, 0.34, 0.4, c, 0, 0.7, 1.05).box(0.34, 0.34, 0.22, CREAM, 0, 0.72, 1.34);
    [[0.2, -0.2], [-0.2, -0.2], [0.2, 0.4], [-0.2, 0.4]].forEach(q => b.box(0.15, 0.3, 0.15, c, q[0], 0.2, q[1]).box(0.16, 0.12, 0.18, DARK, q[0], 0.06, q[1] - 0.01));
    return b.build();
  },
  init(p) {
    if (p.cs && p.cs.trail) p.cs.trail.forEach(t => AH.scene.remove(t.mesh));
    if (p.cs && p.cs.fl) AH.pg.remove(p.cs.fl);
    p.cs = { fireAvail: true, fire: 0, trail: [], fl: null }; p.inv = false; p.burn = false; p.glow = false;
  },
  ui(p) {
    const c = p.cs;
    return { label: 'FIRE', pct: c.fire > 0 ? c.fire / 3 * 100 : c.fireAvail ? 100 : 0, ready: false, text: c.fire > 0 ? c.fire + ' LEFT' : c.fireAvail ? 'READY' : 'USED', passive: true };
  },
  veto(p, row, x, t) {
    if (row.type === 'water') return !W.logAt(row, x, t);
    if (row.type === 'lily') return !W.padAt(row, x);
    return false;
  },
  guard(p, kind, obj) {
    const c = p.cs;
    if (!c.fireAvail || c.fire > 0) return false;
    c.fireAvail = false; c.fire = 3; p.inv = true; p.burn = true;
    AH.burst(18, p.x, 0.6, p.z, [0xff8a1a, 0xffd23f, 0xff4a00], 3.5, 5);
    AH.beep(260, 0.4, 'sawtooth', 0.07, 400);
    if (obj && AH.fx) AH.fx.kill(obj, true);
    return true;
  },
  onStep(p) {
    const c = p.cs;
    if (c.fire > 0) { this.dropFire(p); c.fire--; }
  },
  onLand(p) {
    const c = p.cs;
    if (p.burn) {
      this.dropFire(p);
      if (c.fire <= 0) { p.burn = false; p.inv = false; }
    }
  },
  dropFire(p) {
    const fl = AH.fx.makeFlames(4, 0.4, 1);
    fl.position.set(p.x, 0, p.z); AH.scene.add(fl);
    p.cs.trail.push({ mesh: fl, x: p.x, row: Math.round(-p.z), t: 0 });
  },
  update(p, dt) {
    const tr = p.cs.trail;
    if (p.burn && !p.cs.fl) { p.cs.fl = AH.fx.makeFlames(7, 0.6, 1.2); AH.pg.add(p.cs.fl); }
    if (p.cs.fl) { p.cs.fl.visible = p.burn; if (p.burn) AH.fx.tickFlames(p.cs.fl, AH.now()); }
    for (let i = tr.length - 1; i >= 0; i--) {
      const f = tr[i]; f.t += dt;
      AH.fx.tickFlames(f.mesh, AH.now()); const fade = f.t > 2.2 ? Math.max(0.05, (3 - f.t) / 0.8) : 1; f.mesh.scale.set(fade, fade, fade);
      const row = W.get(f.row);
      if (row) {
        if (row.type === 'road' || row.type === 'roll') {
          for (const o of row.objs) if (o.alive && o.hurts && Math.abs(W.objX(o, AH.now()) - f.x) < o.len / 2 + 0.7) AH.fx.kill(o, true);
        } else if (row.type === 'rail' && row.train && row.train.alive) {
          const s = W.trainState(row, AH.now());
          if (s.x !== null && Math.abs(s.x - f.x) < row.train.len / 2 + 0.7) AH.fx.kill(row.train, true);
        }
      }
      if (f.t > 3) { AH.scene.remove(f.mesh); tr.splice(i, 1); }
    }
  }
});
AH.on('arena', function () { const p = AH.P; if (p.ch && p.ch.id === 'fox' && p.cs) p.cs.fireAvail = true; });
})();
