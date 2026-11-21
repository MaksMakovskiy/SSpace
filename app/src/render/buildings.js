// Instanced 3D buildings. Styles come from ss.reg.buildings: {id, name, build(ctx)}.
// ctx.put(kind, x, y, rot, width, height, depth, color, lift?, tilt?) places one piece;
// x/y are in hex radii from the cell center, sizes in hex radii. Kinds: 'box', 'roof', 'dome',
// plus anything added with ss.buildings.addKind(name, geometry, material).
import {mulberry} from '../core/util.js';

export function createBuildings(ss) {
  const THREE = ss.THREE, S = ss.scene, globe = S.globe;
  let dirty = true, lastT = 0, meshes = [];

  function windowsShader(sh) {
    sh.uniforms.uSunW = S.uniforms.uSunW;
    sh.vertexShader = 'varying vec3 vLoc;\nvarying vec3 vLN;\nvarying vec3 vWD;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvLoc=position;vLN=normal;\n#ifdef USE_INSTANCING\nvec4 wc=modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0);\n#else\nvec4 wc=modelMatrix*vec4(0.0,0.0,0.0,1.0);\n#endif\nvWD=normalize(wc.xyz);');
    sh.fragmentShader = 'uniform vec3 uSunW;\nvarying vec3 vLoc;\nvarying vec3 vLN;\nvarying vec3 vWD;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  float night=smoothstep(0.08,-0.22,dot(vWD,uSunW));
  if(abs(vLN.y)<0.5&&night>0.0){
    vec2 g=vec2(vLoc.x+vLoc.z,vLoc.y);
    float fl=floor(g.y*9.0),cl=floor(g.x*5.0);
    float on=step(0.5,fract(sin(dot(vec3(fl,cl,vWD.x*97.0+vWD.y*31.0+vWD.z*13.0),vec3(12.9898,78.233,37.719)))*43758.5453));
    float win=step(0.3,fract(g.y*9.0))*step(0.35,fract(g.x*5.0))*step(0.08,vLoc.y);
    totalEmissiveRadiance+=vec3(1.0,0.8,0.5)*win*on*night*0.95;
  }`);
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const roofGeo = new THREE.ConeGeometry(0.75, 1, 4); roofGeo.rotateY(Math.PI / 4); roofGeo.translate(0, 0.5, 0);
  const domeGeo = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const boxMat = new THREE.MeshLambertMaterial(); boxMat.onBeforeCompile = windowsShader;
  // unit pieces: base at y=0 unless noted; width/depth 1 = one hex radius after scaling
  const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 14); cylGeo.translate(0, 0.5, 0);
  const coneGeo = new THREE.ConeGeometry(0.5, 1, 12); coneGeo.translate(0, 0.5, 0);
  const ringGeo = new THREE.TorusGeometry(0.5, 0.07, 8, 28); ringGeo.rotateX(Math.PI / 2); // horizontal, centered at y=0
  const ballGeo = new THREE.SphereGeometry(0.5, 14, 10); ballGeo.translate(0, 0.5, 0);
  const lit = () => new THREE.MeshLambertMaterial(), glow = () => new THREE.MeshBasicMaterial(); // glow = unlit, looks lit at night
  const kinds = new Map([
    ['box', {geo: boxGeo, mat: boxMat}],
    ['roof', {geo: roofGeo, mat: lit()}],
    ['dome', {geo: domeGeo, mat: new THREE.MeshLambertMaterial({emissive: 0x0a2a33})}],
    ['cyl', {geo: cylGeo, mat: lit()}],
    ['cone', {geo: coneGeo, mat: lit()}],
    ['ring', {geo: ringGeo, mat: lit()}],
    ['ball', {geo: ballGeo, mat: lit()}],
    ['glow', {geo: ballGeo, mat: glow()}],
    ['glowRing', {geo: ringGeo, mat: glow()}],
    ['glowBox', {geo: boxGeo, mat: glow()}],
  ]);
  const PALS = {
    houseWall: ['#efe6d2', '#e9d8b8', '#d9c7a3', '#f5efe6', '#e3d3bf'], houseRoof: ['#b5532a', '#8e3b2a', '#6d5a3e', '#a64b3c', '#5b4a6b'],
    town: ['#c9c5bd', '#a9a59e', '#d8cfc0', '#8f949c', '#b8ab98'], tower: ['#7f93a8', '#9fb2c4', '#5d6f82', '#b9c7d3', '#8aa0b5'],
    stone: ['#8a8580', '#77726c', '#958f86'], dome: ['#cfe9f2', '#e8f4f8', '#bfe0ea'], ruin: ['#6b625a', '#7d746a', '#5a534d', '#857a6c'],
    metal: ['#c9d1dc', '#aeb8c4', '#8f9aa8', '#d8dee6'], industry: ['#7a746e', '#8b847c', '#6a645f', '#9a9188'],
    container: ['#c4472f', '#2f6fb0', '#e0a33a', '#3c8a5a', '#8e5cf7', '#d9d4c6'], field: ['#c9b24a', '#9cbf4a', '#d8c56a', '#7fa53c', '#b89a3a'],
    tent: ['#e8dcc0', '#d9c39a', '#c7a777', '#b98d5a'], energy: ['#4cc9f0', '#7fe3ff', '#9fe8ff'],
  };

  function rebuild() {
    for (const m of meshes) { globe.remove(m); m.dispose && m.dispose(); }
    meshes = [];
    const tStart = performance.now();
    const V = ss.view, G = V.G, H = V.H, W = V.W;
    if (!G || !H || !ss.prefs.buildings) return;
    const lists = new Map(); const LIMIT = 100000; let total = 0;
    // visit cells in a scattered order (a stride coprime with V): if the piece limit is reached on a huge planet
    // the 3D thins out evenly instead of leaving a bare region
    const gcd = (a, b) => (b ? gcd(b, a % b) : a); let stride = 7919; while (gcd(stride, G.V) !== 1) stride += 2;
    const doc = ss.doc, d = G.dir, up = new THREE.Vector3();
    const _m = new THREE.Matrix4();
    for (let i = 0; i < G.V && total < LIMIT; i++) {
      const c = (i * stride) % G.V;
      const p = doc.palette[doc.cells[c]]; if (!p || !p.bld || W[c]) continue;
      const style = ss.reg.buildings.get(p.bld); if (!style || typeof style.build !== 'function') continue;
      const cx = G.centers[c * 3], cy = G.centers[c * 3 + 1], cz = G.centers[c * 3 + 2]; up.set(cx, cy, cz);
      const s = G.cellStart[c], k = (G.cellLen[c] - 1) / 5;
      let ax = d[(s + 1) * 3], ay = d[(s + 1) * 3 + 1], az = d[(s + 1) * 3 + 2]; const dt = ax * cx + ay * cy + az * cz; ax -= cx * dt; ay -= cy * dt; az -= cz * dt;
      const R = Math.hypot(ax, ay, az), u = new THREE.Vector3(ax / R, ay / R, az / R), w = new THREE.Vector3().crossVectors(up, u);
      const r0 = 1 + H[c] * V.unitH, rnd = mulberry(c * 7919 + p.bld.length * 131 + p.bld.charCodeAt(0));
      const corners = [];
      for (let i = 0; i < k; i++) {
        const o = (s + 1 + i) * 3, dd = d[o] * cx + d[o + 1] * cy + d[o + 2] * cz;
        const qx = d[o] - cx * dd, qy = d[o + 1] - cy * dd, qz = d[o + 2] - cz * dd;
        corners.push([(qx * u.x + qy * u.y + qz * u.z) / R, (qx * w.x + qy * w.y + qz * w.z) / R]);
      }
      const put = (kind, x, y, rot, sw, sh, sd, color, lift = 0, tilt = 0) => {
        if (!kinds.has(kind) || total >= LIMIT) return;
        const cr = Math.cos(rot), sr = Math.sin(rot);
        const X = u.clone().multiplyScalar(cr).addScaledVector(w, sr);
        let Y = up.clone(), Z = new THREE.Vector3().crossVectors(X, Y);
        if (tilt) { const ct = Math.cos(tilt), st = Math.sin(tilt), Y2 = Y.clone().multiplyScalar(ct).addScaledVector(Z, st); Z.multiplyScalar(ct).addScaledVector(Y, -st); Y = Y2; }
        _m.makeBasis(X.multiplyScalar(sw * R), Y.multiplyScalar(sh * R), Z.multiplyScalar(sd * R));
        const L = lift * R;
        _m.setPosition(up.x * (r0 + L) + (u.x * x + w.x * y) * R, up.y * (r0 + L) + (u.y * x + w.y * y) * R, up.z * (r0 + L) + (u.z * x + w.z * y) * R);
        if (!lists.has(kind)) lists.set(kind, []);
        lists.get(kind).push(_m.clone(), color); total++;
      };
      const pick = a => a[Math.floor(rnd() * a.length)];
      const spots = (n, maxR, minD) => {
        const out = [];
        for (let t = 0; t < n * 8 && out.length < n; t++) {
          const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * maxR, x = Math.cos(a) * rr, y = Math.sin(a) * rr;
          if (out.every(o => Math.hypot(o[0] - x, o[1] - y) >= minD)) out.push([x, y]);
        }
        return out;
      };
      try { style.build({c, rnd, pick, spots, put, corners, PALS, THREE, ss}); } catch (e) { console.error('[building ' + p.bld + ']', e); }
    }
    const col = new THREE.Color();
    for (const [kind, L] of lists) {
      const K = kinds.get(kind), n = L.length / 2; if (!n) continue;
      const im = new THREE.InstancedMesh(K.geo, K.mat, n); im.frustumCulled = false;
      for (let i = 0; i < n; i++) { im.setMatrixAt(i, L[i * 2]); im.setColorAt(i, col.set(L[i * 2 + 1])); }
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      globe.add(im); meshes.push(im);
    }
    if (ss.metrics) { ss.metrics.record('3d:buildings', performance.now() - tStart, {pieces: total}); ss.metrics.gauge('3d.pieces', total); if (total >= LIMIT) ss.metrics.count('3d.limitHit'); }
    ss.hooks.emit('buildings:rebuilt', {count: total});
  }

  const markDirty = () => { dirty = true; };
  ss.hooks.on('view:heights', markDirty);
  ss.hooks.on('view:installed', markDirty);
  ss.hooks.on('registry:buildings', markDirty);
  ss.hooks.on('frame', () => { if (dirty && performance.now() - lastT > 150) { dirty = false; lastT = performance.now(); rebuild(); } }, 90);

  return {
    PALS, markDirty, rebuild,
    addKind(name, geo, mat) { kinds.set(name, {geo, mat: mat || new THREE.MeshLambertMaterial()}); dirty = true; },
    windowsShader,
  };
}
