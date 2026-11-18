/* check-course.js: automatic checks of the generated course. Run:  node tools/check-course.js [seeds=6] [rows=250]
 *   1. same seed => identical level
 *   2. changing decoration (scenery density) => identical level           (set AH_PATCH to try your own cosmetic change)
 *   3. rhythm: challenges are separated by rest; how long each lasts
 *   4. every challenge can be crossed from the safe corridor, and the worst-case wait stays bounded
 * Exits non-zero when a check fails, so it can run in CI or before a commit. */
const AH = require('./load.js').AH, W = AH.world, Nav = AH.nav, C = AH.course;
const SEEDS = +process.argv[2] || 6, ROWS = +process.argv[3] || 250;
const calm = t => t === 'grass' || t === 'arena' || t === 'gate';
const isCalm = r => { const w = W.get(r); return calm(w.type) && !w.ice && !w.holes; };            // ice fields and pit fields count as challenges
let fail = 0; const bad = m => { fail++; console.log('  FAIL', m); };

const build = seed => { W.reset(seed); W.ensure(ROWS + 45); for (let r = 0; r <= ROWS + 40; r++) { const w = W.get(r); if (w.type === 'gate') w.blockers.clear(); } };
const fingerprint = seed => { build(seed); const o = []; for (let r = -9; r <= ROWS; r++) { const w = W.get(r); o.push([w.type, w.pc, [...w.blockers.keys()].sort((a, b) => a - b).join(','), w.objs.map(q => q.speed.toFixed(3) + '@' + q.x0.toFixed(2) + 'L' + q.len.toFixed(2)).join('|'), w.pads ? [...w.pads.keys()].sort((a, b) => a - b).join(',') : '', w.train ? w.train.T.toFixed(2) + '/' + w.train.off.toFixed(2) : ''].join(':')); } return o; };

/* the game's own space-time search (Nav rules), returning the minimum time to reach the next calm row */
function solve(s, goal, H, budget) {
  const t0 = s.t, CALM = { grass: 1, arena: 1, gate: 1 };
  const root = { row: s.row, x: s.x, v: 0, tick: 0, cont: false }, layers = [[root]], seen = new Set(); let best = null, work = 0;
  const key = (row, x, tick) => (((row + 30) * 96 + Math.round((x + 9) * 4)) * 128) + tick;
  const push = (n, ro) => { const k = key(n.row, n.x, n.tick); if (seen.has(k)) return; seen.add(k); (layers[n.tick] || (layers[n.tick] = [])).push(n); if (n.row >= goal && CALM[ro.type] && !best) best = n; };
  for (let tick = 0; tick <= H && !best; tick++) {
    for (const n of layers[tick] || []) {
      if (++work > budget) return null;
      const t = t0 + tick * 0.1, row = W.get(n.row);
      if (tick < H) { const x1 = n.x + n.v * 0.1; if (Nav.safe(row, x1, t + 0.1, false)) push({ row: n.row, x: x1, v: n.v, tick: tick + 1, cont: n.cont }, row); }
      if (tick + 2 > H) continue;
      for (const k of ['F', 'L', 'R', 'B']) {
        if (k === 'B' && n.row <= s.row - 1) continue;
        const h = Nav.hop({ row: n.row, x: n.x, cont: n.cont, drift: n.v }, k, 1, t, {}); if (!h) continue;
        const tl = t + h.dm, st = W.stand(h.rowObj, h.x, tl, 0.05); if (!st.ok) continue;
        const x2 = st.snap !== undefined ? st.snap : h.x, v2 = st.log ? st.log.dir * st.log.speed : (h.rowObj.type === 'conv' ? h.rowObj.carry : 0), x3 = x2 + v2 * (t + 0.2 - tl);
        if (!Nav.safe(h.rowObj, x2, tl, true) || !Nav.safe(h.rowObj, x3, t + 0.2, false)) continue;
        push({ row: h.row, x: x3, v: v2, tick: tick + 2, cont: Nav.carried(h.rowObj) }, h.rowObj);
      }
    }
  }
  return best ? best.tick : null;
}

console.log('1. determinism');
for (const seed of ['a', 'b']) { const A = fingerprint(seed), B = fingerprint(seed); const d = A.findIndex((v, i) => v !== B[i]); if (d >= 0) bad(`seed ${seed}: two builds differ at row ${d - 9}`); else console.log(`  ok   seed ${seed}: identical on rebuild (${A.length} rows)`); }

console.log('2. decoration cannot change the level');
{ // build once, then rebuild with a changed decoration RNG stream: simulate any visual tweak by consuming extra decoration numbers per row
  const base = fingerprint('c'); const rowSeed = AH.seedDeco; AH.seedDeco = r => { rowSeed(r); for (let i = 0; i < 7 + (r % 5); i++) AH.rand(); };
  const tweaked = fingerprint('c'); AH.seedDeco = rowSeed;
  const diff = base.reduce((n, v, i) => n + (v !== tweaked[i]), 0); if (diff) bad(`${diff} rows changed when only decoration randomness changed`); else console.log('  ok   0 of ' + base.length + ' rows changed');
}

console.log('3. rhythm and 4. crossing fairness  (' + SEEDS + ' seeds x ' + ROWS + ' rows)');
const rests = [], challenges = [], waits = [], byKind = {}; let unsolvable = 0, tried = 0;
for (let si = 0; si < SEEDS; si++) {
  build('s' + si);
  let r = 4;
  while (r < ROWS) {
    if (!isCalm(r)) { r++; continue; }
    let g = r + 1; while (g < ROWS && isCalm(g)) g++;                 // calm stretch r..g-1
    if (g >= ROWS) break;
    if (W.get(g).type === 'arena') { r = g + 1; continue; }
    let e = g;                                                                  // challenge g..e-1: a short calm gap inside it (a road's median strip, a river island) belongs to it
    for (;;) { while (!isCalm(e)) e++; let k = e; while (isCalm(k) && k < e + 3) k++; if (k - e < 3 && !isCalm(k) && W.get(k).type !== 'arena') e = k; else break; }
    rests.push(g - r); challenges.push(e - g);
    const kind = [...new Set(Array.from({ length: e - g }, (_, i) => W.get(g + i).type))].join('+'), start = W.get(g - 1), min = 2 * (e - g + 1);
    for (const dx of [0, -1, 1]) { const x = start.pc + dx; if (Math.abs(x) > AH.COLS || start.blockers.has(x)) continue; if (dx !== 0 && waits.length > 0 && false) continue;
      for (const ph of [0, 1.9, 4.3, 6.7]) { tried++; const tk = solve({ row: g - 1, x: x, log: null, t: 500 + ph }, e, 120, 150000); if (tk === null) { if (dx === 0) { unsolvable++; bad(`seed s${si} rows ${g}-${e - 1} (${kind}) unsolvable from the safe corridor x=${x}, phase ${ph}`); } } else if (dx === 0) { const w = (tk - min) / 10; waits.push(w); (byKind[kind] = byKind[kind] || []).push(w); } } }
    r = e;
  }
}
const q = (a, p) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : NaN; };
const avg = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
console.log(`  challenges ${challenges.length}; length rows: median ${q(challenges, 0.5)}, max ${Math.max(...challenges)}`);
console.log(`  rest before each challenge (rows): min ${Math.min(...rests)}, median ${q(rests, 0.5)}, max ${Math.max(...rests)}`);
console.log(`  wait beyond a straight dash, from the safe corridor (s): median ${q(waits, 0.5).toFixed(1)}, p90 ${q(waits, 0.9).toFixed(1)}, max ${Math.max(...waits).toFixed(1)}   [${tried} start states]`);
Object.keys(byKind).sort().forEach(k => console.log('    ' + k.padEnd(16) + ' n=' + String(byKind[k].length).padStart(3) + '  mean wait ' + avg(byKind[k]).toFixed(1) + 's  max ' + Math.max(...byKind[k]).toFixed(1) + 's'));
if (Math.min(...rests) < 3) bad('a challenge started with less than 3 rows of rest before it');
if (Math.max(...waits) > 6) bad('some arrival timing needs more than 6 s of waiting');

/* 5. obstacle design: traffic personalities, fairness of every lane, train kinds, rockslide shapes */
console.log('5. obstacle design  (6 seeds x 400 rows)');
{
  const lanes = [], kinds = {}, trains = {}; let adjSame = 0, adj = 0, overlap = 0, rocks = 0, tooFast = 0, tight = 0, slides = 0;
  for (let si = 0; si < 6; si++) {
    W.reset('v' + si); W.ensure(445); let prevKind = null, prevRow = -9;
    for (let r = 3; r <= 400; r++) {
      const w = W.get(r);
      if (w.type === 'road' && w.lane && w.lane.rc === r && w.objs.length) {                                  // middle row of a lane
        const o = w.objs, sp = o[0].speed, kind = w.lane.kind, P = AH.PER, pad = 0.3;
        lanes.push({ kind, sp }); kinds[kind] = (kinds[kind] || 0) + 1; if (sp > C.TUNE.road.maxSpeed + 1e-6) tooFast++;
        const iv = o.map(q => ({ a: q.x0 - q.len / 2, b: q.x0 + q.len / 2 })).sort((p, q) => p.a - q.a);            // widest clear gap between vehicles (circular), as seconds of travel
        let best = 0; for (let i = 0; i < iv.length; i++) { const nx = iv[(i + 1) % iv.length], gap = ((nx.a - iv[i].b) % P + P) % P || (iv.length === 1 ? P - (iv[i].b - iv[i].a) : 0); best = Math.max(best, (gap - 2 * pad) / sp); }
        if (best < C.crossTime(5) + 0.4) tight++;
        if (prevKind !== null && r - prevRow <= 7) { adj++; if (prevKind === kind) adjSame++; } prevKind = kind; prevRow = r;
      }
      if (w.type === 'rail' && w.train) trains[w.train.tkind] = (trains[w.train.tkind] || 0) + 1;
      if (w.type === 'roll' && w.objs.length) {                                                                   // no two rocks in a row may overlap
        const m = w.objs.filter(q => !q.proxy), P = AH.PER;
        for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) { let dx = Math.abs(m[i].x0 - m[j].x0) % P; dx = Math.min(dx, P - dx); if (dx < (m[i].rad + m[j].rad) * 0.9) overlap++; }
        rocks += m.length;
      }
    }
  }
  const sp = lanes.map(l => l.sp), mean = avg(sp), sd = Math.sqrt(avg(sp.map(x => (x - mean) ** 2)));
  console.log('  road lanes ' + lanes.length + ': ' + Object.keys(kinds).sort().map(k => k + ' ' + kinds[k]).join(', ') + ' | speed ' + Math.min(...sp).toFixed(1) + '..' + Math.max(...sp).toFixed(1) + ' (spread sd/mean ' + (sd / mean).toFixed(2) + ')');
  console.log('  train kinds: ' + JSON.stringify(trains));
  console.log('  rocks in slides: ' + rocks + ', overlapping pairs: ' + overlap + ' | neighbouring lanes with the same personality: ' + adjSame + '/' + adj);
  if (lanes.length < 8) bad('too few road lanes sampled to judge traffic');
  if (Object.keys(kinds).length < 3) bad('traffic has fewer than 3 personalities in use');
  if (sd / mean < 0.25) bad('road lane speeds are too alike (sd/mean ' + (sd / mean).toFixed(2) + ' < 0.25)');
  if (tooFast) bad(tooFast + ' road lanes faster than the visible-reaction limit');
  if (tight) bad(tight + ' road lanes have no gap long enough to cross');
  if (adjSame) bad(adjSame + ' neighbouring road lanes share a personality');
  if (overlap) bad(overlap + ' overlapping boulder pairs');
}
console.log(fail ? `\n${fail} check(s) FAILED` : '\nall checks passed'); process.exit(fail ? 1 : 0);
