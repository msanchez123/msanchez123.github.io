/* fx.js: world-changing effects that every phone must see (kills, stomp, poop). Each is applied locally and broadcast. */
(function () {
'use strict';
const AH = window.AH, T = AH.T, W = AH.world, DIRS = AH.DIRS;
const FX = AH.fx = {};
const falling = [];
const send = (t, d) => { if (AH.net) AH.net.event(t, d); };

FX.kill = function (o, bcast) {
  if (!o || !o.alive) return;
  W.killObj(o.row, o.idx);
  if (bcast) send('kill', { r: o.row, i: o.idx });
};
function killRowNear(r, x, reach) {
  const row = W.get(r);
  if (!row) return;
  const t = AH.now();
  if (row.type === 'road' || row.type === 'roll') row.objs.forEach(o => { if (o.alive && o.hurts && Math.abs(W.objX(o, t) - x) < reach + o.len / 2) W.killObj(r, o.idx); });
  else if (row.type === 'rail' && row.train && row.train.alive) {
    const s = W.trainState(row, t);
    if (s.x !== null && Math.abs(s.x - x) < reach + row.train.len / 2) W.killObj(r, -1);
  }
}

/* Gorilla stomp: everything within 3 blocks gets smashed. Moving platforms (logs) are never touched. */
const rings = [];
const ringGeo = new T.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2);
FX.stomp = function (r, x, mine) {
  const R = 3, cx = Math.round(x);
  for (let dr = -R; dr <= R; dr++) {
    const rr = r + dr;
    for (let dc = -R; dc <= R; dc++) if (dc * dc + dr * dr <= R * R + 0.5) W.removeBlocker(rr, cx + dc);
    killRowNear(rr, x, Math.sqrt(Math.max(0, R * R - dr * dr)));
  }
  const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.7, depthWrite: false }));
  m.position.set(x, 0.1, -r); AH.scene.add(m); rings.push({ m: m, t: 0 });
  for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283; AH.burst(1, x + Math.cos(a) * 2, 0.2, -r + Math.sin(a) * 2, [0xffffff, 0xcfd8e0, 0xffd23f], 2.2, 2.5); }
  AH.cam.shake = Math.max(AH.cam.shake, 0.4); AH.beep(90, 0.4, 'sawtooth', 0.08, -50);
  if (AH.boss && AH.boss.on && mine && Math.hypot(AH.boss.x - x, AH.boss.z + r) < R + 1.7) AH.boss.hurt(2);
  if (mine) send('stomp', { r: r, x: x });
};

/* A bundle of flickering flame tongues (red base, orange middle, yellow tip) used by the fire fox and its trail. */
const FM = [0xff3d00, 0xff8a1a, 0xffd84a].map(c => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.93 }));
FX.makeFlames = function (n, spread, s) {
  n = n || 7; spread = spread || 0.7; s = s || 1.2;
  const group = new T.Group(); group.userData.items = [];
  for (let i = 0; i < n; i++) {
    const g = new T.Group();
    [[0.26, 0.22, 0], [0.18, 0.24, 1], [0.1, 0.22, 2]].forEach((q, k) => {
      const m = new T.Mesh(AH.BOX, FM[q[2]]); m.scale.set(q[0], q[1], q[0]); m.position.y = 0.11 + k * 0.2; g.add(m);
    });
    g.position.set((Math.random() - 0.5) * 2 * spread, 0.1 + Math.random() * spread, (Math.random() - 0.5) * 2 * spread);
    group.add(g); group.userData.items.push({ g: g, ph: Math.random() * 6.28, s: s });
  }
  return group;
};
FX.tickFlames = function (group, t) {
  const items = group.userData.items || [];
  for (let i = 0; i < items.length; i++) { const it = items[i]; it.g.scale.set(it.s, (1 + 0.3 * Math.sin(t * 14 + it.ph)) * it.s, it.s); it.g.rotation.y = t * 3 + it.ph; }
};

/* Gull bomb: falls from the sky, then wrecks the lane it lands in. */
FX.poop = function (x, z, mine) {
  const m = new T.Mesh(AH.BOX, AH.M(0xf4f1e8)); m.scale.set(0.3, 0.38, 0.3); m.position.set(x, AH.GULLY, z);
  AH.scene.add(m);
  falling.push({ m: m, x: x, z: z, y: AH.GULLY, vy: 0, mine: mine });
  AH.beep(900, 0.25, 'sine', 0.04, -600);
  if (mine) send('poop', { x: x, z: z });
};
FX.update = function (dt) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const g = rings[i]; g.t += dt;
    const k = Math.min(1, g.t / 0.35); g.m.scale.set(0.3 + 2.8 * k, 1, 0.3 + 2.8 * k); g.m.material.opacity = 0.7 * (1 - g.t / 0.45);
    if (g.t > 0.45) { AH.scene.remove(g.m); rings.splice(i, 1); }
  }
  for (let i = falling.length - 1; i >= 0; i--) {
    const f = falling[i];
    f.vy -= 22 * dt; f.y += f.vy * dt; f.m.position.y = f.y;
    if (f.y <= 0.15) {
      AH.scene.remove(f.m); falling.splice(i, 1);
      AH.burst(14, f.x, 0.2, f.z, [0xffffff, 0xf4f1e8, 0xc8d0d8], 3, 4);
      AH.cam.shake = Math.max(AH.cam.shake, 0.12); AH.beep(160, 0.2, 'square', 0.05, -80);
      const r = Math.round(-f.z);
      killRowNear(r, f.x, 1.1);
      if (AH.boss && AH.boss.on && f.mine && Math.hypot(AH.boss.x - f.x, AH.boss.z - f.z) < 2.6) AH.boss.hurt(1);
    }
  }
};
FX.clear = function () { rings.forEach(g => AH.scene.remove(g.m)); rings.length = 0; falling.forEach(f => AH.scene.remove(f.m)); falling.length = 0; };

/* remote side */
FX.recv = function (t, d) {
  if (t === 'kill') W.killObj(d.r, d.i);
  else if (t === 'stomp') FX.stomp(d.r, d.x, false);
  else if (t === 'poop') FX.poop(d.x, d.z, false);
};
})();
