/* Robot: every 10 hops the AUTO button hands control to an autopilot that crosses up to 10 lanes, waits when it must, and cannot be hurt. */
(function () {
'use strict';
const AH = window.AH, W = AH.world;

function safe(row, x, t) {
  const r = W.get(row);
  if (!r) return false;
  if (r.type === 'water') return !!W.logAt(r, x, t);
  if (r.type === 'lily') return W.padAt(r, x);
  if (W.hitAt(r, x, t)) return false;
  return !(AH.boss && AH.boss.lethalAt(x, -row));
}
function standSafe(p, now) {
  const r = W.get(p.row);
  if (!r) return true;
  if (r.type === 'water' || r.type === 'lily') return Math.abs(p.x) < AH.COLS + 0.8;
  return safe(p.row, p.x, now) && safe(p.row, p.x, now + 0.35) && safe(p.row, p.x, now + 0.7);
}
function stop(p, manual) {
  p.cs.auto = null; p.auto = false; p.cs.steps = 0;
  if (manual) p.cs.grace = 0.8; // a moment of cover after switching off by hand
  else { p.inv = false; p.glow = false; }
}

AH.chars.push({
  id: 'robot', name: 'Robot', col: 0x38e1ff, label: 'AUTO',
  blurb: 'Every 10 hops, press AUTO. The robot crosses up to 10 lanes by itself along the safest path and cannot be hurt on the way.',
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
    return { label: 'AUTO', pct: p.cs.steps / 10 * 100, ready: p.cs.steps >= 10, text: p.cs.steps >= 10 ? 'GO!' : p.cs.steps + '/10' };
  },
  onStep(p) { p.cs.steps = Math.min(10, p.cs.steps + 1); },
  cancel(p) { if (p.cs.auto) { stop(p, true); AH.beep(300, 0.2, 'square', 0.05, -150); } },
  press(p) {
    if (p.cs.auto) { this.cancel(p); return; }
    if (p.cs.steps < 10) { AH.beep(130, 0.06, 'square', 0.03); return; }
    AH.player.cancelHold();
    p.cs.auto = { goal: p.row + 10, best: p.row, bt: 0, t: 0, wait: 0, side: Math.random() < 0.5 ? 'L' : 'R' };
    p.auto = true; p.inv = true; p.glow = true;
    AH.beep(700, 0.3, 'square', 0.05, 500);
  },
  update(p, dt) {
    const a = p.cs.auto;
    if (!a) { if (p.cs.grace > 0) { p.cs.grace -= dt; if (p.cs.grace <= 0) { p.inv = false; p.glow = false; } } return; }
    a.t += dt; a.wait -= dt;
    const rt = W.get(p.row), calm = !!rt && (rt.type === 'grass' || rt.type === 'arena' || rt.type === 'gate');
    // keep driving past the goal until it stands on safe ground, so control never returns mid-hazard
    if (p.dead || a.t > 40 || (p.row >= a.goal && calm && !p.jumping) || p.row >= a.goal + 8) { stop(p); return; }
    if (p.row > a.best) { a.best = p.row; a.bt = 0; } else a.bt += dt;
    if (p.jumping || p.buf || a.wait > 0) return;
    const now = AH.now(), P = AH.player;
    const ok = k => {
      const pl = P.plan(k, 1);
      if (!pl) return false;
      const t = now + pl.dm;
      return safe(pl.row, pl.x, t) && (pl.rowObj.type === 'water' || pl.rowObj.type === 'lily' || safe(pl.row, pl.x, t + 0.35));
    };
    const go = k => { P.tryMove(k, 1, false, true); a.wait = 0.03; };
    if (ok('F')) return go('F');
    const blocked = !P.plan('F', 1);
    if (!blocked && a.bt < 2 && standSafe(p, now)) { a.wait = 0.05; return; }
    const first = a.side, second = first === 'L' ? 'R' : 'L';
    if (ok(first)) return go(first);
    if (ok(second)) { a.side = second; return go(second); }
    if (ok('B')) { a.bt = 0; return go('B'); }      // no way forward: back off and try another line
    if (a.bt < 3 && standSafe(p, now)) { a.wait = 0.05; return; }
    for (const k of [first, second, 'B', 'F']) if (P.plan(k, 1)) { a.bt = 0; return go(k); }
    a.wait = 0.1;
  },
  guard() { return false; }
});
})();
