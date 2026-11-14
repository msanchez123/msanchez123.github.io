/* Seagull: a normal ground character until it has hopped 5 times. Then the button lifts it into 1 second of flight (over cars, trains,
 * water and trees), and while it is in the air it rains poop bombs. Flying changes only what can touch you: it scores, counts for
 * checkpoints and bosses, and the boss and the wave can still get it. When the second is up it simply drops straight down from where it is
 * (no gliding to safety, no nudging to a free tile) onto whatever is there. The charge starts again from zero on landing: 5 fresh hops. */
(function () {
'use strict';
const AH = window.AH, T = AH.T, W = AH.world, INK = 0x10324a, COLS = AH.COLS;
const NEED = 5, FLY_T = 1, POOP_EVERY = 0.22, GRAV = 34;

AH.chars.push({
  id: 'gull', name: 'Seagull', col: 0xdfe6ee, label: 'FLY',
  blurb: 'Hop 5 times, then FLY: 1 second in the air, over traffic, water and trees, rapidly dropping bombs that wreck hazards and hurt bosses. Then it drops right where it is, and the charge starts over.',
  geo(B) {
    const w = 0xffffff, b = new B();
    b.box(0.5, 0.4, 0.8, w, 0, 0.6, 0).box(0.34, 0.2, 0.5, 0xe8eef5, 0, 0.45, 0.02)
     .box(0.34, 0.34, 0.34, w, 0, 0.9, -0.42).box(0.12, 0.1, 0.24, 0xff9f1a, 0, 0.85, -0.65)
     .box(0.07, 0.08, 0.04, INK, 0.1, 0.95, -0.6).box(0.07, 0.08, 0.04, INK, -0.1, 0.95, -0.6)
     .box(0.08, 0.3, 0.56, 0xe8eef5, 0.28, 0.62, 0.06).box(0.08, 0.3, 0.56, 0xe8eef5, -0.28, 0.62, 0.06)
     .box(0.08, 0.1, 0.3, 0x6b7785, 0.28, 0.44, 0.34).box(0.08, 0.1, 0.3, 0x6b7785, -0.28, 0.44, 0.34)
     .box(0.3, 0.06, 0.4, 0xdfe6ee, 0, 0.62, 0.55)
     .box(0.06, 0.2, 0.06, 0xff9f1a, 0.1, 0.3, -0.05).box(0.06, 0.2, 0.06, 0xff9f1a, -0.1, 0.3, -0.05);
    return b.build();
  },
  /* the spread wings: two hinged pairs (shoulder + wing tip) that flap while airborne. Local player and remote ghosts both get one. */
  rig(B) {
    const group = new T.Group(), wings = [];
    [1, -1].forEach(side => {
      const sh = new T.Group(); sh.position.set(side * 0.27, 0.74, 0.05);
      const arm = new T.Mesh(new B().box(0.7, 0.06, 0.52, 0xf4f7fb, side * 0.35, 0, 0).box(0.5, 0.04, 0.3, 0xe3eaf2, side * 0.3, 0.035, 0.06).build(), AH.VM);
      const tp = new T.Group(); tp.position.set(side * 0.7, 0, 0);
      const tip = new T.Mesh(new B().box(0.62, 0.05, 0.4, 0x6b7785, side * 0.31, 0, 0.04).box(0.16, 0.05, 0.3, 0x2b3440, side * 0.62, 0, 0.04).build(), AH.VM);
      arm.castShadow = tip.castShadow = true;
      tp.add(tip); sh.add(arm, tp); group.add(sh); wings.push({ sh: sh, tp: tp, side: side });
    });
    group.visible = false;
    let ph = 0;
    return {
      group: group,
      tick(flying, t, dt) {
        group.visible = flying;
        if (!flying) return;
        ph += dt * 15;
        wings.forEach(w => { w.sh.rotation.z = w.side * Math.sin(ph) * 0.8; w.tp.rotation.z = w.side * Math.sin(ph - 0.9) * 0.55; });
      }
    };
  },
  init(p) { p.cs = { steps: 0, t: 0, cd: 0, vy: 0, drop: false }; p.inv = false; p.burn = false; p.glow = false; p.fly = false; p.lift = 0; },
  ui(p) {
    const c = p.cs;
    if (p.fly) return { label: 'FLY', pct: Math.max(0, c.t) / FLY_T * 100, ready: false, text: c.t > 0 ? Math.ceil(c.t) + 's' : '...' };
    return { label: 'FLY', pct: c.steps / NEED * 100, ready: c.steps >= NEED, text: c.steps >= NEED ? 'FLY!' : c.steps + '/' + NEED };
  },
  onStep(p) { if (!p.fly) p.cs.steps = Math.min(NEED, p.cs.steps + 1); },   // hops made in the air do not charge the next flight
  press(p) {
    const c = p.cs;
    if (p.fly) return;                        // bombs drop by themselves while airborne
    if (c.steps < NEED) { AH.beep(130, 0.06, 'square', 0.03); return; }
    c.steps = 0; c.t = FLY_T; c.cd = 0.12; c.vy = 0; c.drop = false; p.fly = true; p.log = null;
    AH.burst(10, p.x, 0.8, p.z, [0xffffff, 0xe8eef5], 2.4, 3.2);
    AH.beep(520, 0.3, 'sine', 0.06, 500);
  },
  update(p, dt) {
    const c = p.cs;
    if (p.dead) return;
    if (!p.fly) { p.lift += (0 - p.lift) * Math.min(1, dt * 9); return; }
    if (!c.drop) {
      c.cd -= dt;
      if (c.cd <= 0) { AH.fx.poop(p.x, p.z, true, p.y + p.lift); c.cd = POOP_EVERY; }
      c.t -= dt; p.lift += (AH.FLYY - p.lift) * Math.min(1, dt * 7);
      if (c.t > 0) return;
      c.drop = true; c.vy = 0;                      // time is up: no gliding, no safe spot, it just falls from where it is
    }
    c.vy += GRAV * dt; p.lift -= c.vy * dt;
    if (p.lift > 0) return;
    p.lift = 0; c.drop = false; c.steps = 0; p.fly = false;     // touched down: the charge is spent and starts again from zero
    AH.beep(300, 0.12, 'sine', 0.04, -120);
    AH.burst(6, p.x, 0.1, p.z, [0xffffff, 0xe8eef5], 1.6, 2.2);
    if (!p.jumping) AH.player.settle();             // on landing it is simply wherever it is: water, traffic, anything. (A hop in progress settles itself when it ends.)
  },
  guard() { return false; }
});
})();
