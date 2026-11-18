'use strict';
/* Headless loader for the course tools: runs the REAL game scripts (core, themes, course, world, biomes, nav) with three.js and the DOM stubbed out, so the level can be generated and tested in plain Node, no browser. */
// Headless loader: runs the REAL core(rng/builder)/themes/world/biomes/nav with THREE and DOM stubbed out.
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = process.env.AH_SRC || path.join(__dirname, '..');
const stub = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : stub(), apply: () => stub(), construct: () => stub() });
class Color { constructor(h) { if (typeof h === 'number') { this.r = ((h >> 16) & 255) / 255; this.g = ((h >> 8) & 255) / 255; this.b = (h & 255) / 255; } else { this.r = this.g = this.b = 0.5; } }
  setHex(h) { this.r = ((h >> 16) & 255) / 255; this.g = ((h >> 8) & 255) / 255; this.b = (h & 255) / 255; return this; }
  lerp(o, k) { this.r += (o.r - this.r) * k; this.g += (o.g - this.g) * k; this.b += (o.b - this.b) * k; return this; } getHex() { return ((this.r * 255) << 16) | ((this.g * 255) << 8) | (this.b * 255); } }
class Obj { constructor() { this.children = []; this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }; this.rotation = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }; this.scale = { x: 1, y: 1, z: 1, set() {}, setScalar() {} }; this.parent = null; this.userData = {}; }
  add(...c) { c.forEach(k => { this.children.push(k); k.parent = this; }); return this; } remove(k) { this.children = this.children.filter(c => c !== k); } traverse(f) { f(this); this.children.forEach(c => c.traverse && c.traverse(f)); } }
class Geo { constructor() { this.attributes = { position: { array: new Float32Array(108), count: 36 }, normal: { array: new Float32Array(108) }, color: { array: new Float32Array(108) } }; } toNonIndexed() { return this; } rotateX() { return this; } translate() { return this; } setAttribute() {} setIndex() {} computeVertexNormals() {} computeBoundingSphere() {} dispose() {} }
const T = new Proxy({ Color, Group: Obj, Mesh: class extends Obj { constructor(g, m) { super(); this.geometry = g; this.material = m; } }, BoxGeometry: Geo, BufferGeometry: Geo, PlaneGeometry: Geo, IcosahedronGeometry: Geo,
  Float32BufferAttribute: class {}, Vector3: class { constructor(x, y, z) { this.x = x; this.y = y; this.z = z; } }, Plane: class {}, Box3: class {}, Ray: class {} }, { get: (t, k) => k in t ? t[k] : stub() });
const ctx = { console, Math, Date, Set, Map, Float32Array, Object, Array, Number, String, JSON, THREE: T, performance };
ctx.window = ctx; ctx.document = stub(); ctx.matchMedia = undefined;
vm.createContext(ctx);
const run = (code, name) => vm.runInContext(code, ctx, { filename: name });
// trimmed core: constants, rng, bus, clock, Builder (lines 1-19, 46-229) + stubbed materials/scene
const core = fs.readFileSync(path.join(SRC, 'js/core.js'), 'utf8').split('\n');
const pick = (a, b) => core.slice(a - 1, b).join('\n');
const iRng = core.findIndex(l => l.startsWith('/* ---- rng')) + 1, iEnd = core.findIndex(l => l.startsWith('AH.BOX =')) + 1;      // found by marker, so edits to core.js don't break the loader
run(pick(1, 19) + '\n' + pick(iRng, iEnd).replace(/AH\.\$ = .*/, '') + '\n})();', 'core-trim');
run(`const AH=window.AH; AH.BGX=9.65; AH.scene=new THREE.Group(); AH.$=()=>null;
 for (const k of ['VMC','VMF','VMR','VMW','VMT','VMX']) AH[k]={}; AH.waveT={value:0}; AH.waterMat=()=>({}); AH.MC=()=>({}); AH.CLIP=[];`, 'core-stub');
const PATCH = process.env.AH_PATCH ? JSON.parse(process.env.AH_PATCH) : [];
['themes.js', 'course.js', 'world.js', 'biomes.js', 'nav.js'].filter(f => fs.existsSync(path.join(SRC, 'js', f))).forEach(f => { let c = fs.readFileSync(path.join(SRC, 'js', f), 'utf8'); PATCH.forEach(([a, b]) => { if (c.includes(a)) c = c.split(a).join(b); }); run(c, f); });
module.exports = ctx;
