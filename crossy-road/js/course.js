/* course.js: the rules of the course, in one place. No rendering, no three.js: pure numbers and decisions, so it can be read, tuned and tested on its own.
 *
 *  WHAT LIVES HERE
 *   TUNE      every number that shapes how the map FEELS (rest length, traffic gaps, ...). Change the feel here, not inside world.js.
 *   pacing    choose(): which kind of stretch comes next. The map alternates CHALLENGES (roads, rivers, rails, rockslides, tides, ice, pits)
 *             with REST stretches (open ground, hills, mazes, glades), so every hazard is a moment of its own with room to breathe on either side.
 *   fairness  helpers that make a hazard crossable BY CONSTRUCTION (e.g. a road lane's gaps are always longer than the time it takes to cross it).
 *
 *  WHAT DOES NOT: how things look (world.js / biomes.js), how the hero moves (player.js). */
(function () {
'use strict';
const AH = window.AH, C = AH.course = {};

const HOP = 0.2;                                   // seconds per hop (the player's hop cadence)

C.TUNE = {
  /* Rest: after a challenge, `chance` is the odds that a scenery stretch (hills, maze, glade...) follows before the next challenge; otherwise the next challenge
   * comes right after the hazard's own buffer rows (those are always there: 2 before, 2 after, 1 calm). `rows` is how much calm is owed when rest happens;
   * `start` is the calm at the beginning of a run, `afterArena` after a boss arena. */
  rest: { chance: 0.65, rows: 4, start: 4, afterArena: 3 },
  /* how many recent chunks (and their families) are not repeated */
  noRepeat: 2,
  /* traffic. A lane is 5 rows deep, so crossing it takes 5 hops. Gaps between vehicles are always at least `window` seconds of travel, which is
   * the crossing time plus a margin to spot the gap and react. Raise `window` for a gentler road, lower it for a tighter one. */
  road: { window: 1.7, gapMin: 3.6, gapJitter: 2.2, tailGap: [1.1, 1.9], maxSpeed: 7.4 },
  /* maxSpeed: nothing on a road may cross the visible strip (about 9.6 units each side) in less than the time it takes to cross the lane (~1.3 s with reaction), or a car could
   * appear and hit you before you could possibly have seen it. */
  /* hazards get a little faster over the first `rows` rows, then stay put. Set rows to 0 for a flat course. */
  speedRamp: { rows: 120, road: 0.35, water: 0.3, roll: 0.4 }
};

/* ---- pacing ---- */
C.CHALLENGE_LANES = { road: 1, water: 1, lily: 1, rail: 1, roll: 1, tide: 1, ice: 1 };
C.FAMILY = { river: 'water', stones: 'water', island: 'water', highway: 'road', crossroads: 'road', railyard: 'rail', boulders: 'slide', tides: 'tide', icefield: 'ice', pits: 'pits' };
C.isChallenge = chunk => chunk.id === 'pits' || chunk.types.some(t => C.CHALLENGE_LANES[t]);
C.restRows = rand => rand() < C.TUNE.rest.chance ? C.TUNE.rest.rows : 0;

/* pool: [[chunk, weight], ...]  state: { restLeft, recent: [chunk ids, newest last] }  rand: layout-stream random.
 * Returns the chunk to build next, or null when nothing suitable is left. */
C.choose = function (pool, state, rand) {
  const recent = state.recent.slice(-C.TUNE.noRepeat), fams = recent.map(id => C.FAMILY[id] || id);
  const wantChallenge = state.restLeft <= 0;
  const fits = (list, strict) => list.filter(e => !strict || (recent.indexOf(e[0].id) < 0 && fams.indexOf(C.FAMILY[e[0].id] || e[0].id) < 0));
  const kind = list => list.filter(e => C.isChallenge(e[0]) === wantChallenge);
  let cand = fits(kind(pool), true);
  if (!cand.length) cand = fits(kind(pool), false);                                         // ran out of variety: repeat rather than break the rhythm
  if (!cand.length) return null;
  const tot = cand.reduce((a, e) => a + e[1], 0); let x = rand() * tot;
  for (const e of cand) { x -= e[1]; if (x <= 0) return e[0]; }
  return cand[cand.length - 1][0];
};

/* ---- traffic: every lane has a personality, so neighbouring lanes feel different and a road is something to read, not one repeated pattern ---- */
C.TRAFFIC = {
  crawl:    { w: 1.5, speed: [2.2, 3.0], heavy: 0.85, platoon: 1, n: 5, boost: { bus: 2, tanker: 1.5, flatbed: 1.2 } },     // slow heavy goods: easy to time, long and wide
  commuter: { w: 3.0, speed: [4.6, 5.6], heavy: 0.15, platoon: 1, n: 4 },                                                     // ordinary mixed traffic
  express:  { w: 1.3, speed: [6.6, 7.4], heavy: 0.0,  platoon: 1, n: 3, boost: { sports: 6, taxi: 3, sedan: 0.6, hatch: 0.4, suv: 0.4, van: 0.5, pickup: 0.5 } },   // a few fast cars: short windows, but long and clear
  convoy:   { w: 1.3, speed: [3.5, 4.3], heavy: 0.5,  platoon: 3, n: 6 }                                                      // vehicles bunched in tight platoons with big gaps between them
};
C.pickTraffic = function (rand, avoid) {
  const keys = Object.keys(C.TRAFFIC).filter(k => k !== avoid), tot = keys.reduce((a, k) => a + C.TRAFFIC[k].w, 0); let x = rand() * tot;
  for (const k of keys) { x -= C.TRAFFIC[k].w; if (x <= 0) return k; }
  return keys[keys.length - 1];
};
/* speed of one road lane, after the (optional) ramp, never above maxSpeed */
C.roadSpeed = (kind, row, rand) => { const k = C.TRAFFIC[kind], sp = (k.speed[0] + rand() * (k.speed[1] - k.speed[0])) * C.speedMul('road', row); return Math.min(sp, C.TUNE.road.maxSpeed); };

/* ---- river lanes: long slow rafts, ordinary logs, short quick stepping logs. Each covers about the same share of the lane, so none is "the hard one", just a different feel. ---- */
C.LOGS = {
  raft:     { w: 1.2, len: [3.4, 4.4], n: [4, 5], speed: [0.8, 1.15] },
  plain:    { w: 2.5, len: [2.0, 3.4], n: [5, 7], speed: [1.1, 1.7] },
  stepping: { w: 1.2, len: [1.4, 2.0], n: [7, 9], speed: [1.6, 2.1] }
};
C.pickLogs = function (rand, avoid) {
  const keys = Object.keys(C.LOGS).filter(k => k !== avoid), tot = keys.reduce((a, k) => a + C.LOGS[k].w, 0); let x = rand() * tot, name = keys[keys.length - 1];
  for (const k of keys) { x -= C.LOGS[k].w; if (x <= 0) { name = k; break; } }
  const L = C.LOGS[name], r = a => a[0] + rand() * (a[1] - a[0]);
  return { kind: name, n: Math.round(r(L.n)), speed: r(L.speed), lenRange: L.len };
};

/* ---- trains ---- */
C.TRAINS = {
  regional: { w: 2.0, len: [8, 11],  speed: [28, 32], warn: 1.4, period: [4.6, 7.5] },
  freight:  { w: 1.2, len: [13, 17], speed: [17, 21], warn: 2.0, period: [5.8, 8.0] },     // long and slow: a wall that takes a while to pass, more warning
  express:  { w: 1.0, len: [6, 8],   speed: [38, 44], warn: 1.6, period: [4.2, 6.5] }      // short and very fast: gone in a blink
};
C.pickTrain = function (rand) {
  const keys = Object.keys(C.TRAINS), tot = keys.reduce((a, k) => a + C.TRAINS[k].w, 0); let x = rand() * tot, name = keys[keys.length - 1];
  for (const k of keys) { x -= C.TRAINS[k].w; if (x <= 0) { name = k; break; } }
  const t = C.TRAINS[name], r = (a) => a[0] + rand() * (a[1] - a[0]);
  return { kind: name, len: Math.round(r(t.len)), speed: r(t.speed), warn: t.warn, period: r(t.period) };
};

/* ---- rockslide: boulders tumble across the lanes in waves. Pure data: where each rock starts, in which row, how big. ---- */
C.ROCKS = { speed: [2.3, 3.8], waveWidth: 10, rho: [0.9, 1.6], follower: [0.45, 0.7] };
C.rockslide = function (rand, dir, PER, WRAP) {
  const R = C.ROCKS, n = 5 + Math.floor(rand() * 3), sp = R.speed[0] + rand() * (R.speed[1] - R.speed[0]);
  const need = sp * (C.crossTime(n) + 0.9);                                                    // the quiet gap between waves must be long enough to cross the whole slide
  const nw = [3, 2, 1].find(k => PER / k - R.waveWidth >= need) || 1, list = [];
  const clear = (x, j, rr) => list.every(e => Math.hypot(e.x - x, e.j - j) >= (e.rho + rr) * 0.95);
  for (let w = 0; w < nw; w++) {
    const xc = (w + 0.15 + rand() * 0.4) * PER / nw - WRAP;
    for (let q = 2 + Math.floor(rand() * 2), tries = 0; q > 0 && tries < 24; tries++) {
      const j = Math.floor(rand() * n), rho = R.rho[0] + rand() * (R.rho[1] - R.rho[0]), x = xc + (rand() * 2 - 1) * 2.4;
      if (!clear(x, j, rho) || list.some(e => e.main && e.j !== j && Math.abs(e.j - j) < 2 && Math.abs(e.x - x) < 6)) continue;
      q--; list.push({ x: x, j: j, rho: rho, v: Math.floor(rand() * 5), main: true });
      const r2 = R.follower[0] + rand() * (R.follower[1] - R.follower[0]);
      const fx = x - dir * (rho + r2 + 0.3 + rand() * 0.6), want = rand() < 0.6;
      if (want && clear(fx, j, r2)) list.push({ x: fx, j: j, rho: r2, v: Math.floor(rand() * 5) });      // a small rock tumbling in the big one's wake, same row (only if there is room)
    }
  }
  return { n: n, grp: { sp: sp, list: list } };
};

/* ---- fairness ---- */
/* Vehicle layout for one road lane. Between platoons (a platoon of 1 is a single vehicle) the gap is at least speed * window, so there is always a gap long enough to cross in;
 * inside a platoon vehicles tailgate with a small gap that cannot be crossed (it reads as one long moving wall). lens: vehicle lengths in order.
 * Returns { gaps } (the space after each vehicle that fits, with the spare room already shared out between platoons), so the lane wraps exactly at `period`. */
C.roadGaps = function (speed, lens, period, rand, platoon) {
  const T = C.TUNE.road, k = Math.max(1, platoon || 1), bigGap = Math.max(T.gapMin, speed * T.window);
  for (let n = lens.length; n >= 1; n--) {
    const gaps = [], big = []; let used = 0;
    for (let i = 0; i < n; i++) {
      const end = (i + 1) % k === 0 || i === n - 1, g = end ? bigGap + rand() * T.gapJitter : T.tailGap[0] + rand() * (T.tailGap[1] - T.tailGap[0]);
      gaps.push(g); big.push(end); used += lens[i] + g;
    }
    if (used <= period || n === 1) {
      const nb = big.filter(Boolean).length, slack = Math.max(0, period - used) / nb;
      return { gaps: gaps.map((g, i) => big[i] ? g + slack : g), count: n, big: big };
    }
  }
};
/* seconds needed to cross a lane of n rows at hop cadence */
C.crossTime = n => n * HOP;

/* speed multiplier for a hazard kind at a given row */
C.speedMul = (kind, row) => 1 + (C.TUNE.speedRamp[kind] || 0) * (C.TUNE.speedRamp.rows > 0 ? Math.min(1, Math.max(0, row) / C.TUNE.speedRamp.rows) : 0);
})();
