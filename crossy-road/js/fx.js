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

/* Small explosion (fire fox igniting): wrecks hazards and trees within 2.5 blocks and hurts a nearby boss. */
FX.blast = function (r, x, mine) {
  const R = 2.5, cx = Math.round(x);
  for (let dr = -3; dr <= 3; dr++) {
    const rr = r + dr;
    for (let dc = -3; dc <= 3; dc++) if (dc * dc + dr * dr <= R * R + 0.5) W.removeBlocker(rr, cx + dc);
    if (Math.abs(dr) <= R) killRowNear(rr, x, Math.sqrt(Math.max(0, R * R - dr * dr)));
  }
  const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.8, depthWrite: false }));
  m.position.set(x, 0.12, -r); AH.scene.add(m); rings.push({ m: m, t: 0 });
  for (let i = 0; i < 22; i++) { const a = i / 22 * 6.283; AH.burst(1, x + Math.cos(a) * 1.4, 0.3, -r + Math.sin(a) * 1.4, [0xff3d00, 0xff8a1a, 0xffd23f], 3, 4); }
  AH.cam.shake = Math.max(AH.cam.shake, 0.35); AH.beep(110, 0.35, 'sawtooth', 0.08, 300);
  if (AH.boss && AH.boss.on && mine && Math.hypot(AH.boss.x - x, AH.boss.z + r) < R + 1.7) AH.boss.hurt(1);
  if (mine) send('blast', { r: r, x: x });
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

/* The fox's fire aura: a few small translucent embers that rise and swell on a slow pulse around the body. Deliberately quiet. */
const AM = [0xff7a1a, 0xffc04a].map(c => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.4, depthWrite: false }));
FX.makeAura = function () {
  const group = new T.Group(); group.userData.items = [];
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * 6.283, m = new T.Mesh(AH.BOX, AM[i % 2]); m.scale.set(0.2, 0.26, 0.2);
    group.add(m); group.userData.items.push({ m: m, a: a, ph: i * 1.7, r: 0.42 + (i % 3) * 0.1 });
  }
  return group;
};
FX.tickAura = function (group, t) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 4.2);
  AM[0].opacity = 0.26 + 0.2 * pulse; AM[1].opacity = 0.2 + 0.2 * (1 - pulse);
  group.userData.items.forEach(it => {
    const k = (t * 0.9 + it.ph) % 1, s = (0.7 + 0.5 * Math.sin(t * 4.2 + it.ph)) * (1 - 0.5 * k);
    it.m.position.set(Math.cos(it.a + t * 0.6) * it.r, 0.25 + k * 1.0, Math.sin(it.a + t * 0.6) * it.r);
    it.m.scale.set(0.2 * s, 0.26 * s, 0.2 * s); it.m.rotation.y = t * 2 + it.ph;
  });
};

/* Gull bomb: falls from the sky, then wrecks the lane it lands in. */
FX.poop = function (x, z, mine, y) {
  y = y === undefined ? AH.FLYY : y;
  const m = new T.Mesh(AH.BOX, AH.M(0xf4f1e8)); m.scale.set(0.3, 0.38, 0.3); m.position.set(x, y, z);
  AH.scene.add(m);
  falling.push({ m: m, x: x, z: z, y: y, vy: 0, mine: mine });
  AH.beep(900, 0.25, 'sine', 0.04, -600);
  if (mine) send('poop', { x: x, z: z, y: y });
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
  else if (t === 'blast') FX.blast(d.r, d.x, false);
  else if (t === 'poop') FX.poop(d.x, d.z, false, d.y);
  else if (t === 'brk') W.breakBarrier(d.a, false);
};
})();
