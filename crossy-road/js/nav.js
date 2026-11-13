/* nav.js: the single rulebook for hopping (Nav.hop) and a planner that searches through space AND time (Nav.plan).
 * The player, kangaroo leaps, the fox's veto and the robot all go through Nav.hop, so "where does this hop land" has exactly one answer.
 * The planner never keeps a path: the robot asks it again every decision, from where it really is, at the real shared time. */
(function () {
'use strict';
const AH = window.AH, W = AH.world, COLS = AH.COLS, JD = AH.JD, clamp = AH.clamp, DIRS = AH.DIRS;
const Nav = AH.nav = {};

Nav.dm = m => m > 1 ? Math.min(0.2 + 0.05 * m, 0.9) : JD;
/* sideways speed of whatever carries you on this row */
Nav.drift = (row, log) => !row ? 0 : row.type === 'water' ? (log ? log.dir * log.speed : 0) : row.type === 'conv' ? row.carry : 0;
Nav.carried = row => !!row && (row.type === 'water' || row.type === 'conv');

/* Where would a hop of m blocks in direction k land, starting from f = {row, x, cont, drift} at time t?
 * o = { fly, occ(x,row), block(x,z), veto(row,x,t) }. Returns null when the hop is not allowed. */
Nav.hop = function (f, k, m, t, o) {
  o = o || {};
  const d = DIRS[k], dx = d[0], dz = d[1], dm = Nav.dm(m);
  const r2 = f.row + (dz === -1 ? m : dz === 1 ? -m : 0), row = W.get(r2);
  if (!row || r2 < AH.MINROW) return null;
  const cont = !o.fly && Nav.carried(row);
  let x;
  if (dx !== 0) x = ((!o.fly && f.cont) ? f.x + f.drift * dm : Math.round(f.x)) + dx * m;
  else x = cont ? clamp(f.x, -COLS - 1, COLS + 1) : clamp(Math.round(f.x), -COLS, COLS);
  const lim = cont ? COLS + 1 : COLS;
  if (Math.abs(x) > lim + 0.001) return null;
  if (!o.fly && row.blockers.has(Math.round(x))) return null;
  if (o.occ && o.occ(x, r2)) return null;
  if (o.block && o.block(x, -r2)) return null;
  if (o.veto && o.veto(row, x, t + dm)) return null;
  return { steps: m, x: x, row: r2, rowObj: row, dm: dm };
};

/* Is it safe to be at (row, x) at time t? land=true also demands a log / pad under the feet (with a tighter margin than the game uses). */
Nav.safe = function (row, x, t, land) {
  if (!row || Math.abs(x) > COLS + 1.25) return false;
  if (land && !W.stand(row, x, t, 0.05).ok) return false;
  if (row.type === 'road' || row.type === 'roll' || row.type === 'rail') {
    if (W.hitAt(row, x, t - 0.08, 0.5) || W.hitAt(row, x, t, 0.5) || W.hitAt(row, x, t + 0.12, 0.5)) return false;
  }
  const b = AH.boss;
  if (b && b.on) {
    const z = -row.r;
    if (b.lethalAt(x, z)) return false;
    if (b.st !== 'tired' && b.st !== 'dying' && b.st !== 'sleep' && Math.hypot(x - b.x, z - b.z) < 3.3) return false;
  }
  return true;
};

const CALM = { grass: 1, arena: 1, gate: 1 };
const DIR_ORDER = ['F', 'L', 'R', 'B'];

/* s = { row, x, log, t }; goal = row to reach (and stand on calm ground); o = hop options.
 * Returns { act: 'F'|'L'|'R'|'B'|'wait'|null, goal: bool }. act is only the FIRST step; the caller re-plans after it. */
Nav.plan = function (s, goal, o) {
  const TICK = 0.1, H = (o && o.horizon) || 40, budget = (o && o.budget) || 3500, t0 = s.t;
  const r0 = W.get(s.row);
  if (!r0) return { act: null, goal: false };
  const root = { row: s.row, x: s.x, v: Nav.drift(r0, s.log), tick: 0, par: null, act: null, cont: Nav.carried(r0) };
  const layers = [[root]], seen = new Set();
  let bestGoal = null, deepest = root, work = 0;
  const key = (row, x, tick) => (((row + 30) * 96 + Math.round((x + 9) * 4)) * 128) + tick;
  const push = function (n, rowObj) {
    const kk = key(n.row, n.x, n.tick);
    if (seen.has(kk)) return;
    seen.add(kk);
    (layers[n.tick] || (layers[n.tick] = [])).push(n);
    if (n.row >= goal && CALM[rowObj.type] && (!bestGoal || n.tick < bestGoal.tick)) bestGoal = n;
    if (n.tick > deepest.tick || (n.tick === deepest.tick && n.row > deepest.row)) deepest = n;
  };
  for (let tick = 0; tick <= H; tick++) {
    if (bestGoal && tick >= bestGoal.tick) break;
    const L = layers[tick]; if (!L) continue;
    for (const n of L) {
      if (++work > budget) { tick = H + 1; break; }
      const t = t0 + tick * TICK, px = n.x + n.v * 0, row = W.get(n.row);
      // wait one tick (carried along by logs and belts)
      if (tick < H) {
        const x1 = px + n.v * TICK;
        if (Nav.safe(row, x1, t + TICK, false)) push({ row: n.row, x: x1, v: n.v, tick: tick + 1, par: n, act: 'wait', cont: n.cont }, row);
      }
      if (tick + 2 > H) continue;
      for (let i = 0; i < 4; i++) {
        const k = DIR_ORDER[i];
        if (k === 'B' && n.row <= s.row - 2) continue;      // never wander far back: keeps the search small and cheap on phones
        const h = Nav.hop({ row: n.row, x: px, cont: n.cont, drift: n.v }, k, 1, t, o);
        if (!h) continue;
        const tl = t + h.dm, st = W.stand(h.rowObj, h.x, tl, 0.05);
        if (!st.ok) continue;
        const x2 = st.snap !== undefined ? st.snap : h.x;
        const v2 = st.log ? st.log.dir * st.log.speed : (h.rowObj.type === 'conv' ? h.rowObj.carry : 0);
        const x3 = x2 + v2 * (t + 0.2 - tl);
        if (!Nav.safe(h.rowObj, x2, tl, true) || !Nav.safe(h.rowObj, x3, t + 0.2, false)) continue;
        push({ row: h.row, x: x3, v: v2, tick: tick + 2, par: n, act: k, cont: Nav.carried(h.rowObj) }, h.rowObj);
      }
    }
  }
  const end = bestGoal || deepest;
  if (end === root) return { act: null, goal: false };
  let n = end; while (n.par !== root) n = n.par;
  return { act: n.act, goal: !!bestGoal, ticks: end.tick, work: work };
};
})();
