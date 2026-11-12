/* net.js: peer to peer rooms with Trystero. Handles invite links, ghosts of other players, a shared clock, and the event channel.
 * The lowest peer id is the "host" and runs the boss brain; everything else is symmetric. */
(function () {
'use strict';
const AH = window.AH, T = AH.T, $ = AH.$, G = AH.G, P = AH.P;
const TURN = []; // add {urls:'turn:host:3478', username:'u', credential:'p'} when a carrier blocks direct links
const NET = AH.net = { id: null, room: null, connecting: false, note: '', selfId: 'self-' + Math.random().toString(36).slice(2, 8), send: {}, lastSend: 0, sync: new Map(), syncT: 0 };
const SLOTS = [0x3b82f6, 0x9b5de5, 0x2dd4bf, 0xe5484d, 0xf5c518, 0xff7aa8];
let slotIdx = 0;

NET.roomFromHash = function () { const m = /^#room-([a-z0-9]{4,12})$/.exec(location.hash); return m ? m[1] : null; };
NET.isHost = function () {
  if (!NET.room) return true;
  let low = NET.selfId;
  AH.ghosts.forEach((g, id) => { if (id < low) low = id; });
  return low === NET.selfId;
};
NET.event = function (t, d, toSelf) {
  if (NET.send.ev) { try { NET.send.ev([t, d]); } catch (e) {} }
  if (toSelf) handleEvent(t, d);
};
NET.sendBoss = function (arr) { if (NET.send.bs) { try { NET.send.bs(arr); } catch (e) {} } };
function handleEvent(t, d) {
  if (t === 'kill' || t === 'stomp' || t === 'poop') AH.fx.recv(t, d);
  else if (t === 'bdmg') { if (NET.isHost() && AH.boss) AH.boss.hurt(d.n); }
  else if (t === 'beat') AH.onBeat(d.a);
}
const idOf = a => typeof a === 'string' ? a : (a && a.peerId);

/* ---- ghosts ---- */
function addGhost(id, ch) {
  const col = SLOTS[slotIdx++ % SLOTS.length];
  const mesh = new T.Mesh(AH.charGeo(ch), AH.VM); mesh.castShadow = true;
  const inner = new T.Group(); inner.add(mesh);
  const tag = new T.Mesh(AH.BOX, AH.M(col)); tag.scale.set(0.26, 0.26, 0.26); tag.position.y = 2.6; tag.rotation.set(0.62, 0, 0.78);
  const g = new T.Group(); g.add(inner, tag); g.visible = false; AH.scene.add(g);
  const o = { id: id, g: g, inner: inner, mesh: mesh, tag: tag, col: col, ch: ch, tx: 0, ty: 0, tz: 0, tr: 0, sy: 1, score: 0, dead: false, fly: !!AH.chars[ch].flies, seen: performance.now(), first: true };
  AH.ghosts.set(id, o);
  return o;
}
function removeGhost(id) { const g = AH.ghosts.get(id); if (!g) return; AH.scene.remove(g.g); AH.ghosts.delete(id); }
NET.removeGhost = removeGhost;

function onState(d, a) {
  const id = idOf(a);
  if (!id || !Array.isArray(d) || d.length < 11) return;
  const rd = d[8] | 0, rs = +d[9] || 0;
  if (rd < G.round) return;
  if (rd > G.round) AH.adoptRound(rd, rs);
  else if (rs > 0 && (G.rs === 0 || rs < G.rs)) AH.adoptStart(rs);
  const ch = AH.clamp(d[7] | 0, 0, AH.chars.length - 1);
  const g = AH.ghosts.get(id) || addGhost(id, ch);
  if (g.ch !== ch) { g.ch = ch; g.mesh.geometry = AH.charGeo(ch); g.fly = !!AH.chars[ch].flies; }
  const was = g.dead, fl = d[10] | 0;
  g.tx = d[0]; g.ty = d[1]; g.tz = d[2]; g.tr = d[3]; g.score = d[4] | 0; g.dead = !!d[5]; g.sy = d[6] || 1; g.fire = !!(fl & 1);
  if ((fl & 1) && !g.flames) { g.flames = AH.fx.makeFlames(); g.g.add(g.flames); }
  else if (!(fl & 1) && g.flames) { g.g.remove(g.flames); g.flames = null; }
  g.seen = performance.now();
  if (g.first) { g.first = false; g.g.position.set(g.tx, g.ty, g.tz); g.g.rotation.y = g.tr; }
  else if (g.dead && !was && !g.fly) AH.burst(14, g.tx, 0.6, g.tz, [AH.chars[ch].col, 0xfff6ea, g.col], 3, 4.5);
}

/* ---- shared clock: every phone converges on the average of all phone clocks ---- */
function onSync(d, a) {
  const id = idOf(a);
  if (!id || !d) return;
  if (d.b === undefined) { NET.send.sy && NET.send.sy({ a: d.a, b: Date.now() }, id); return; }
  const now = Date.now(), rtt = now - d.a;
  if (rtt < 0 || rtt > 3000) return;
  const off = d.b + rtt / 2 - now, cur = NET.sync.get(id);
  if (!cur || rtt <= cur.rtt * 1.3 || now - cur.at > 15000) NET.sync.set(id, { off: off, rtt: rtt, at: now });
  let sum = 0, n = 0;
  NET.sync.forEach((v, k) => { if (AH.ghosts.has(k)) { sum += v.off; n++; } });
  AH.clock.off = n ? sum / (n + 1) : 0;
}

NET.leave = function () {
  try { if (NET.room) NET.room.leave(); } catch (e) {}
  NET.room = null; NET.send = {}; NET.sync.clear(); AH.clock.off = 0;
  Array.from(AH.ghosts.keys()).forEach(removeGhost);
};
NET.connect = async function () {
  if (!NET.id || NET.room || NET.connecting) return;
  NET.connecting = true; NET.note = 'Connecting…'; NET.refresh();
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/trystero@0.25.4/+esm');
    if (mod.selfId) NET.selfId = mod.selfId;
    const cfg = { appId: 'avalanche-hop-v2' };
    if (TURN.length) cfg.turnConfig = TURN;
    const room = mod.joinRoom(cfg, NET.id);
    const mk = function (name, handler) {
      const act = room.makeAction(name);
      if (Array.isArray(act)) { act[1](handler); return (d, to) => act[0](d, to); }
      act.onMessage = handler;
      return (d, to) => act.send(d, to ? { target: to } : undefined);
    };
    NET.send.st = mk('st', onState);
    NET.send.sy = mk('sy', onSync);
    NET.send.bs = mk('bs', function (d, a) { if (!NET.isHost() && AH.boss && Array.isArray(d)) AH.boss.apply(d); });
    NET.send.ev = mk('ev', function (d, a) { if (Array.isArray(d)) handleEvent(d[0], d[1]); });
    try { room.onPeerJoin = function () { NET.lastSend = 0; NET.syncT = 0; }; } catch (e) {}
    try { room.onPeerLeave = function (pid) { removeGhost(idOf(pid)); NET.sync.delete(idOf(pid)); }; } catch (e) {}
    NET.room = room; NET.note = '';
  } catch (e) { NET.note = 'Multiplayer could not start here'; }
  NET.connecting = false; NET.refresh();
};

NET.tick = function (dt, now) {
  if (!NET.room) return;
  if (NET.send.st && now - NET.lastSend > 100) {
    NET.lastSend = now;
    const fl = (P.burn ? 1 : 0) | (P.glow ? 2 : 0) | (P.fly ? 4 : 0);
    try { NET.send.st([+P.x.toFixed(2), +P.y.toFixed(2), +P.z.toFixed(2), +AH.pg.rotation.y.toFixed(2), G.score, P.dead ? 1 : 0, +AH.pscale.scale.y.toFixed(2), P.chi, G.round, G.rs, fl]); } catch (e) {}
  }
  NET.syncT -= dt;
  if (NET.syncT <= 0 && NET.send.sy) { NET.syncT = 2.5; try { NET.send.sy({ a: Date.now() }); } catch (e) {} }
};

/* ---- HUD bits ---- */
NET.refresh = function () {
  const st = $('netstat'), box = $('mp');
  if (!NET.id) { st.textContent = ''; box.innerHTML = ''; return; }
  const n = AH.ghosts.size;
  let txt = NET.note;
  if (!txt) txt = n ? 'Room ' + NET.id + ' · ' + (n + 1) + ' players' : (window.top !== window.self ? 'Link works once the file is hosted' : 'Room ' + NET.id + ' · waiting for friends');
  st.textContent = txt;
  const list = [{ c: P.ch ? P.ch.col : 0xffffff, s: G.score, me: true, d: P.dead }];
  AH.ghosts.forEach(g => list.push({ c: g.col, s: g.score, me: false, d: g.dead }));
  list.sort((a, b) => b.s - a.s);
  box.innerHTML = list.map(p => '<span class="chip"><i style="background:' + AH.hex(p.c) + '"></i>' + (p.me ? 'YOU ' : '') + p.s + (p.d ? ' ✕' : '') + '</span>').join('');
};
NET.invite = async function () {
  AH.audio();
  if (!NET.id) {
    NET.id = Math.random().toString(36).slice(2, 8);
    AH.roomSeed = NET.id;
    try { location.hash = 'room-' + NET.id; } catch (e) {}
    AH.newRound(true); NET.connect();
  }
  const url = location.href.split('#')[0] + '#room-' + NET.id;
  try { if (navigator.share) { await navigator.share({ title: 'Avalanche Hop', text: 'Race me on the same course', url: url }); return; } }
  catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); NET.note = 'Link copied'; }
  catch (e) { NET.note = url; $('netstat').classList.add('sel'); }
  NET.refresh();
  setTimeout(function () { if (NET.note === 'Link copied') { NET.note = ''; NET.refresh(); } }, 2500);
};
})();
