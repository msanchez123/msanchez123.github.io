/* Robot: every 10 hops the AUTO button hands control to an autopilot that crosses up to 10 lanes. It is NOT invulnerable: it simply plans well.
 * The autopilot holds no path. Every decision it asks the shared planner (js/nav.js) for the best first move from where it really stands, at the
 * real shared time, so it keeps re-planning, waits when waiting is the safe move, backs off or sidesteps when that is better, and treats water,
 * logs, lily pads, belts, trains and the boss through the same rules the player is held to. */
(function () {
'use strict';
const AH = window.AH, W = AH.world;
const CALM = { grass: 1, arena: 1, gate: 1 };
const NEED = 10, LANES = 10;

function stop(p) { p.cs.auto = null; p.auto = false; p.cs.steps = 0; p.glow = false; }

AH.chars.push({
  id: 'robot', name: 'Robot', col: 0x38e1ff, label: 'AUTO',
  blurb: 'Every 10 hops, press AUTO. The robot crosses up to 10 lanes by itself, re-planning every move. Press again to take over. It can still be hit.',
  geo(B) {
    const m = 0x9fb0bf, h = 0x7e8fa0, k = 0x55606c, b = new B();
    b.box(0.2, 0.2, 0.7, 0x3a4452, 0.36, 0.12, 0).box(0.2, 0.2, 0.7, 0x3a4452, -0.36, 0.12, 0)
     .box(0.66, 0.5, 0.64, m, 0, 0.5, 0).box(0.2, 0.12, 0.05, 0xffd23f, 0, 0.5, -0.33)
     .box(0.62, 0.46, 0.56, h, 0, 1.0, -0.02).box(0.5, 0.16, 0.06, 0x38e1ff, 0, 1.02, -0.3)
     .box(0.06, 0.24, 0.06, k, 0, 1.35, 0).box(0.12, 0.12, 0.12, 0xe5484d, 0, 1.52, 0)
     .box(0.08, 0.16, 0.16, k, 0.35, 1.0, 0).box(0.08, 0.16, 0.16, k, -0.35, 1.0, 0);
    return b.build();
  },
  init(p) { p.cs = { steps: 0, auto: null }; p.inv = false; p.burn = false; p.glow = false; p.auto = false; },
  ui(p) {
    if (p.cs.auto) return { label: 'AUTO', pct: 100, ready: false, text: 'ON' };
    return { label: 'AUTO', pct: p.cs.steps / NEED * 100, ready: p.cs.steps >= NEED, text: p.cs.steps >= NEED ? 'GO!' : p.cs.steps + '/' + NEED };
  },
  onStep(p) { p.cs.steps = Math.min(NEED, p.cs.steps + 1); },
  cancel(p) { if (p.cs.auto) { stop(p); AH.beep(300, 0.2, 'square', 0.05, -150); } },
  press(p) {
    if (p.cs.auto) { this.cancel(p); return; }
    if (p.cs.steps < NEED) { AH.beep(130, 0.06, 'square', 0.03); return; }
    AH.player.cancelHold();
    p.cs.auto = { goal: p.row + LANES, best: p.row, idle: 0, t: 0, wait: 0 };
    p.auto = true; p.glow = true;            // glow is only a cue; it grants nothing
    AH.beep(700, 0.3, 'square', 0.05, 500);
  },
  update(p, dt) {
    const a = p.cs.auto;
    if (!a) return;
    a.t += dt; a.wait -= dt;
    if (p.row > a.best) { a.best = p.row; a.idle = 0; } else a.idle += dt;
    const rt = W.get(p.row), calm = !!rt && !!CALM[rt.type];
    // done: reached the goal lane and standing on calm ground. Also give up if nothing has moved forward for a long time.
    if (p.dead || a.t > 60 || a.idle > 14 || (p.row >= a.goal && calm && !p.jumping) || p.row >= a.goal + 10) { stop(p); return; }
    if (p.jumping || p.buf || a.wait > 0) return;
    const PL = AH.player;
    const res = AH.nav.plan({ row: p.row, x: p.x, log: p.log, t: AH.now() }, a.goal,
      { fly: false, occ: PL.occupied, block: (x, z) => !!(AH.boss && AH.boss.blocks(x, z)) });
    if (res.act && res.act !== 'wait') { a.wait = PL.tryMove(res.act, 1, false, true) ? 0.02 : 0.1; return; }
    if (!res.act) {                       // every option looks deadly: any legal hop beats standing still
      for (const k of ['F', 'L', 'R', 'B']) if (PL.plan(k, 1)) { PL.tryMove(k, 1, false, true); a.wait = 0.02; return; }
    }
    a.wait = 0.15;                        // waiting is the plan; ask again shortly
  },
  guard() { return false; }
});
})();
