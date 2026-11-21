// Planet rendering: terrain prisms, water sheet, shore surf, grid lines, marker overlay, picking.
// Reads ss.doc; call cellChanged() after editing a cell and refreshTypes() after editing the palette.
import {hash01, hexToRgb} from '../core/util.js';
import {buildGeodesic, nearestCell} from '../core/geometry.js';
import {terrainHook, terrainKey} from './shaders.js';

const DEF_TYPE = {rgb: [1, 0, 1], h: 0, v: 0, fxI: 0, texI: 0, water: false, bld: ''};

export function createPlanetView(ss) {
  const THREE = ss.THREE, S = ss.scene, globe = S.globe;
  let G = null, H = null, W = null, unitH = 0.03, types = [];
  let pend = [], heightsDirty = false, waterDirty = false, overlayDirty = false;
  let dMin = Infinity, dMax = -1, lMin = Infinity, lMax = -1;
  let surfMesh = null, gridLines = null, sameLines = null, OV = null, WT = null;

  const hook = terrainHook(ss);
  const surfMat = new THREE.MeshLambertMaterial({vertexColors: true, side: THREE.DoubleSide});
  surfMat.extensions = {derivatives: true}; surfMat.onBeforeCompile = hook; surfMat.customProgramCacheKey = () => 'surf|' + terrainKey(ss);
  const waterMat = new THREE.MeshLambertMaterial({vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false});
  waterMat.extensions = {derivatives: true}; waterMat.onBeforeCompile = hook; waterMat.customProgramCacheKey = () => 'water|' + terrainKey(ss);
  const gridMat = new THREE.LineBasicMaterial({color: 0x000000, transparent: true, opacity: 0.28});
  const gridSameMat = new THREE.LineBasicMaterial({color: 0x000000, transparent: true, opacity: 0.1});
  const ovMat = new THREE.MeshBasicMaterial({vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
  const hoverGeo = new THREE.BufferGeometry();
  const hoverLines = new THREE.LineSegments(hoverGeo, new THREE.LineBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false}));
  hoverLines.renderOrder = 20; hoverLines.frustumCulled = false; globe.add(hoverLines);

  const onShaderRegistry = () => { surfMat.needsUpdate = true; waterMat.needsUpdate = true; if (ss.doc && G) refreshTypes(); };
  ss.hooks.on('registry:effects', onShaderRegistry);
  ss.hooks.on('registry:textures', onShaderRegistry);

  // ---------- palette -> render types ----------
  function refreshTypes() {
    const fxIds = ss.reg.effects.ids(), txIds = ss.reg.textures.ids();
    types = ss.doc.palette.map(p => {
      const e = p.fx ? ss.reg.effects.get(p.fx) : null;
      return {rgb: hexToRgb(p.color), h: p.h, v: p.v, fxI: p.fx ? fxIds.indexOf(p.fx) + 1 : 0, texI: p.tex ? txIds.indexOf(p.tex) + 1 : 0, water: !!(e && e.water), bld: p.bld || ''};
    });
    if (G) refreshHeights(true);
    ss.hooks.emit('view:typesChanged');
  }
  const typeOf = (c) => types[ss.doc.cells[c]] || DEF_TYPE;
  function setUnit() { unitH = Math.min(0.035, 0.5 / G.n) * (ss.doc ? ss.doc.relief : 1); }

  // ---------- meshes ----------
  function makeTopLayer(mat, order, withTerrainAttrs) {
    const len = G.pos.length, nv = len / 3;
    const L = {pos: new Float32Array(len), col: new Float32Array(len), idx: new Uint32Array(G.topT * 3), fx: null};
    const g = new THREE.BufferGeometry();
    const dyn = a => a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', dyn(new THREE.BufferAttribute(L.pos, 3)));
    g.setAttribute('color', dyn(new THREE.BufferAttribute(L.col, 3)));
    if (withTerrainAttrs) {
      L.fx = new Float32Array(nv);
      g.setAttribute('normal', G.norAttr);
      g.setAttribute('fx', dyn(new THREE.BufferAttribute(L.fx, 1)));
      g.setAttribute('shore', new THREE.BufferAttribute(new Float32Array(nv), 1));
      g.setAttribute('wcol', new THREE.BufferAttribute(new Float32Array(len), 3));
      g.setAttribute('tex', new THREE.BufferAttribute(new Float32Array(nv), 1));
    }
    g.setIndex(dyn(new THREE.BufferAttribute(L.idx, 1))); g.setDrawRange(0, 0);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.4);
    L.geo = g; L.mesh = new THREE.Mesh(g, mat); L.mesh.renderOrder = order; globe.add(L.mesh);
    return L;
  }
  function indexTops(L, want) {
    let n = 0; const ix = L.idx;
    for (let c = 0; c < G.V; c++) {
      if (!want(c)) continue;
      const b = G.cellStart[c], k = (G.cellLen[c] - 1) / 5;
      for (let i = 0; i < k; i++) { ix[n++] = b; ix[n++] = b + 1 + i; ix[n++] = b + 1 + ((i + 1) % k); }
    }
    L.geo.setDrawRange(0, n); L.geo.index.needsUpdate = true;
  }
  function disposeMeshes() {
    for (const m of [surfMesh, gridLines, sameLines]) if (m) globe.remove(m);
    for (const L of [OV, WT]) if (L) { globe.remove(L.mesh); L.geo.dispose(); }
    if (G) { G.geo.dispose(); G.bgeo.dispose(); G.sgeo.dispose(); }
    surfMesh = gridLines = sameLines = OV = WT = null;
  }
  function useGeometry(g) {
    disposeMeshes(); G = g;
    surfMesh = new THREE.Mesh(G.geo, surfMat); globe.add(surfMesh);
    gridLines = new THREE.LineSegments(G.bgeo, gridMat); globe.add(gridLines);
    sameLines = new THREE.LineSegments(G.sgeo, gridSameMat); globe.add(sameLines);
    WT = makeTopLayer(waterMat, 1, true);
    OV = makeTopLayer(ovMat, 3, false);
    S.uniforms.uFreq.value = G.n * 3;
  }
  function applyPrefs() {
    if (!G) return;
    const p = ss.prefs, base = G.n > 30 ? 0.16 : 0.28;
    gridMat.opacity = base; gridLines.visible = p.grid;
    sameLines.visible = p.grid && p.sameLines !== 'hide'; gridSameMat.opacity = p.sameLines === 'half' ? base * 0.35 : base;
    OV.mesh.visible = p.markers; ovMat.opacity = p.markerOpacity;
    S.uniforms.uTexOn.value = p.textures ? 1 : 0;
    // atmosphere: the planet decides whether it has one (doc.atmo), the view setting can hide it everywhere
    const a = ss.doc && ss.doc.atmo;
    S.atmo.visible = p.atmosphere && (!a || a.on);
    if (a) S.atmo.material.uniforms.uColor.value.set(a.color);
  }

  function install() {
    const doc = ss.doc;
    if (!G || G.n !== doc.n) useGeometry(buildGeodesic(THREE, doc.n));
    H = null; W = null; pend = []; heightsDirty = false;
    dMin = Infinity; dMax = -1; lMin = Infinity; lMax = -1;
    setUnit(); applyPrefs(); refreshTypes(); repaintMarks(); setHover([]);
    ss.hooks.emit('view:installed', G);
  }

  // Change planet size; cells, markers and pins are resampled onto the new grid.
  function resample(n) {
    const doc = ss.doc; if (!G || n === G.n) return;
    const old = G, g = buildGeodesic(THREE, n);
    const cells = new Uint8Array(g.V), marks = new Uint8Array(g.V);
    let s = 0;
    for (let c = 0; c < g.V; c++) { s = nearestCell(old, g.centers[c * 3], g.centers[c * 3 + 1], g.centers[c * 3 + 2], s); cells[c] = doc.cells[s]; marks[c] = doc.markers[s]; }
    let ps = 0;
    for (const p of doc.pois) { ps = nearestCell(g, old.centers[p.c * 3], old.centers[p.c * 3 + 1], old.centers[p.c * 3 + 2], ps); p.c = ps; }
    doc.n = n; doc.cells = cells; doc.markers = marks;
    useGeometry(g); install();
  }

  // ---------- heights ----------
  function bfs(isSrc) {
    const V = G.V, d = new Uint8Array(V).fill(255), q = new Int32Array(V); let qh = 0, qt = 0;
    for (let c = 0; c < V; c++) if (isSrc(c)) { d[c] = 0; q[qt++] = c; }
    while (qh < qt) { const c = q[qh++], dc = d[c]; if (dc >= 6) continue; const nb = G.nbr[c]; for (let i = 0; i < nb.length; i++) { const x = nb[i]; if (d[x] === 255) { d[x] = dc + 1; q[qt++] = x; } } }
    return d;
  }
  function computeHeights() {
    const V = G.V, cells = ss.doc.cells, base = new Float32Array(V), vr = new Float32Array(V), wt = new Uint8Array(V);
    for (let c = 0; c < V; c++) { const T = types[cells[c]] || DEF_TYPE; base[c] = T.h; vr[c] = T.v; wt[c] = T.water ? 1 : 0; }
    const dLow = bfs(c => base[c] <= 0.3), dLand = bfs(c => base[c] >= 0 && !wt[c]);
    const out = new Float32Array(V), ramp = d => 0.45 + 0.55 * Math.min(1, (d - 1) / 3);
    for (let c = 0; c < V; c++) {
      const b = base[c]; let h = b;
      if (b > 0.3) h = b * ramp(dLow[c]); else if (b < 0) h = b * ramp(dLand[c]);
      h += vr[c] * (G.noise[c] * 2 - 1);
      if (b > 0.3) h = Math.max(0.3, h); else if (b < 0) h = Math.min(-0.05, h); else h = Math.max(-0.02, h);
      if (wt[c]) h = Math.min(h, Math.max(0, b) + 0.02 - 0.3);
      out[c] = h;
    }
    return {H: out, W: wt};
  }
  function refreshHeights(force) {
    const r = computeHeights(), old = H, oldW = W; H = r.H; W = r.W;
    if (force || !old || old.length !== H.length) { pend = []; heightsDirty = false; updateAll(); waterDirty = true; ss.hooks.emit('view:heights'); return; }
    const touch = new Uint8Array(G.V);
    const near = c => { touch[c] = 1; const nb = G.nbr[c]; for (let i = 0; i < nb.length; i++) touch[nb[i]] = 1; };
    for (const c of pend) near(c);
    for (let c = 0; c < G.V; c++) { if (W[c] !== oldW[c]) { near(c); waterDirty = true; } else if (Math.abs(H[c] - old[c]) > 1e-4) touch[c] = 1; }
    pend = []; heightsDirty = false;
    for (let c = 0; c < G.V; c++) if (touch[c]) updateCell(c);
    ss.hooks.emit('view:heights');
  }
  const waterSurface = (c) => 1 + (Math.max(0, typeOf(c).h) + 0.02) * unitH;
  const topR = (c) => (W && W[c] ? waterSurface(c) : 1 + (H ? H[c] : 0) * unitH);

  // ---------- per-cell write ----------
  function markRange(c) {
    const s = G.cellStart[c], l = G.cellLen[c]; if (s < dMin) dMin = s; if (s + l > dMax) dMax = s + l;
    const ls = G.lineStart[c], ll = (l - 1) / 5 * 2; if (ls < lMin) lMin = ls; if (ls + ll > lMax) lMax = ls + ll;
  }
  function updateCell(c) {
    const cells = ss.doc.cells, t = cells[c], T = types[t] || DEF_TYPE, rgb = T.rgb, j = 1 + (hash01(c) - 0.5) * 0.08, wet = W[c];
    const r = 1 + H[c] * unitH, bottom = 1 - 6 * unitH - 0.003, surf = wet ? waterSurface(c) : r;
    const s = G.cellStart[c], l = G.cellLen[c], k = (l - 1) / 5;
    const hs = wet ? 0.5 : Math.max(0.85, Math.min(1.12, 1 + H[c] * 0.035));
    const R = Math.min(1, rgb[0] * j * hs), Gc = Math.min(1, rgb[1] * j * hs), B = Math.min(1, rgb[2] * j * hs);
    const {pos, dir, col, fx, top, shore, wcol, tex} = G, ovp = OV.pos, wp = WT.pos, wcl = WT.col, wfx = WT.fx;
    const fxv = wet ? 0 : T.fxI, txv = wet ? 0 : T.texI;
    let sr = 0, sg = 0, sb = 0; const cs = G.corners[c], cornerShore = new Float32Array(k);
    if (!wet) {
      for (let i = 0; i < k; i++) {
        const f = cs[i];
        for (let q = 0; q < 3; q++) { const o = G.tri[f * 3 + q]; if (o !== c && W[o]) { cornerShore[i] = 1; const wr = (types[cells[o]] || DEF_TYPE).rgb; sr = wr[0]; sg = wr[1]; sb = wr[2]; break; } }
      }
    }
    for (let i = 0; i < l; i++) {
      const v = s + i, o = v * 3, isTop = top[v], rad = isTop ? r : bottom, shade = i <= k ? 1 : (isTop ? 0.8 : 0.42);
      pos[o] = dir[o] * rad; pos[o + 1] = dir[o + 1] * rad; pos[o + 2] = dir[o + 2] * rad;
      col[o] = R * shade; col[o + 1] = Gc * shade; col[o + 2] = B * shade; fx[v] = fxv;
      shore[v] = (i >= 1 && i <= k) ? cornerShore[i - 1] : 0; wcol[o] = sr; wcol[o + 1] = sg; wcol[o + 2] = sb; tex[v] = i <= k ? txv : 0;
      if (i <= k) {
        const ro = surf + 0.0022; ovp[o] = dir[o] * ro; ovp[o + 1] = dir[o + 1] * ro; ovp[o + 2] = dir[o + 2] * ro;
        if (wet) { wp[o] = dir[o] * surf; wp[o + 1] = dir[o + 1] * surf; wp[o + 2] = dir[o + 2] * surf; wcl[o] = rgb[0] * j; wcl[o + 1] = rgb[1] * j; wcl[o + 2] = rgb[2] * j; wfx[v] = T.fxI; }
      }
    }
    const ls = G.lineStart[c], lr = surf + 0.0012;
    for (let i = 0; i < k; i++) {
      const a = (s + 1 + i) * 3, b = (s + 1 + ((i + 1) % k)) * 3, o = (ls + 2 * i) * 3, nb = G.edgeNbr[ls / 2 + i];
      const same = nb >= 0 && cells[nb] === t, lp = same ? G.lposS : G.lpos, lz = same ? G.lpos : G.lposS;
      lp[o] = dir[a] * lr; lp[o + 1] = dir[a + 1] * lr; lp[o + 2] = dir[a + 2] * lr; lp[o + 3] = dir[b] * lr; lp[o + 4] = dir[b + 1] * lr; lp[o + 5] = dir[b + 2] * lr;
      lz[o] = lz[o + 1] = lz[o + 2] = lz[o + 3] = lz[o + 4] = lz[o + 5] = 0;
    }
    markRange(c);
  }
  function updateAll() { for (let c = 0; c < G.V; c++) updateCell(c); }

  function paintMark(c) {
    const v = ss.doc.markers[c];
    if (v) {
      const rgb = hexToRgb(ss.doc.markerColors[v - 1] || '#ff00ff'), s = G.cellStart[c], k = (G.cellLen[c] - 1) / 5, col = OV.col;
      for (let i = 0; i <= k; i++) { col[(s + i) * 3] = rgb[0]; col[(s + i) * 3 + 1] = rgb[1]; col[(s + i) * 3 + 2] = rgb[2]; }
    }
    markRange(c); overlayDirty = true;
  }
  function repaintMarks() { for (let c = 0; c < G.V; c++) paintMark(c); }

  function cellChanged(layer, c) { if (layer === 'mark') paintMark(c); else { pend.push(c); heightsDirty = true; } }

  function flush() {
    if (!G || !H) return;
    if (heightsDirty) { const t = performance.now(); refreshHeights(false); if (ss.metrics) ss.metrics.record('view:heights', performance.now() - t); }
    if (waterDirty) { indexTops(WT, c => W[c] === 1); waterDirty = false; }
    if (dMax >= 0) {
      const ga = G.geo.attributes, oa = OV.geo.attributes, wa = WT.geo.attributes;
      for (const [attr, size] of [[ga.position, 3], [ga.color, 3], [ga.fx, 1], [ga.shore, 1], [ga.wcol, 3], [ga.tex, 1], [oa.position, 3], [oa.color, 3], [wa.position, 3], [wa.color, 3], [wa.fx, 1]]) {
        attr.updateRange.offset = dMin * size; attr.updateRange.count = (dMax - dMin) * size; attr.needsUpdate = true;
      }
      dMin = Infinity; dMax = -1;
    }
    if (lMax >= 0) {
      for (const a of [G.bgeo.attributes.position, G.sgeo.attributes.position]) { a.updateRange.offset = lMin * 3; a.updateRange.count = (lMax - lMin) * 3; a.needsUpdate = true; }
      lMin = Infinity; lMax = -1;
    }
    if (overlayDirty) { indexTops(OV, c => ss.doc.markers[c] > 0); overlayDirty = false; }
  }
  ss.hooks.on('frame', flush, 100);

  // ---------- picking & hover ----------
  let lastPick = 0;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), inv = new THREE.Matrix4();
  function pick(clientX, clientY) {
    if (!G || !H) return -1;
    const rect = S.canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, S.camera);
    S.scene.updateMatrixWorld(); inv.copy(globe.matrixWorld).invert();
    const o = ray.ray.origin.clone().applyMatrix4(inv), d = ray.ray.direction.clone().transformDirection(inv);
    const hit = rad => { const b = o.dot(d), c = o.dot(o) - rad * rad, disc = b * b - c; if (disc < 0) return null; const tt = -b - Math.sqrt(disc); return tt < 0 ? null : o.clone().add(d.clone().multiplyScalar(tt)); };
    const p = hit(1) || hit(1 + 3 * unitH); if (!p) return -1;
    let c = nearestCell(G, p.x, p.y, p.z, lastPick);
    for (let it = 0; it < 3; it++) { const q = hit(topR(c)); if (!q) break; const c2 = nearestCell(G, q.x, q.y, q.z, c); if (c2 === c) break; c = c2; }
    lastPick = c; return c;
  }
  function brushCells(c, r) {
    const out = [c]; if (r <= 0) return out; const seen = new Set(out); let front = [c];
    for (let k = 0; k < r; k++) { const nf = []; for (const f of front) for (const nb of G.nbr[f]) if (!seen.has(nb)) { seen.add(nb); nf.push(nb); out.push(nb); } front = nf; }
    return out;
  }
  function setHover(list) {
    const p = [];
    if (G && H) for (const c of list) {
      const s = G.cellStart[c], k = (G.cellLen[c] - 1) / 5, rr = topR(c) + 0.004, dir = G.dir;
      for (let i = 0; i < k; i++) { const a = (s + 1 + i) * 3, b = (s + 1 + ((i + 1) % k)) * 3; p.push(dir[a] * rr, dir[a + 1] * rr, dir[a + 2] * rr, dir[b] * rr, dir[b + 1] * rr, dir[b + 2] * rr); }
    }
    hoverGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  }
  function setRelief(k) { ss.doc.relief = k; setUnit(); updateAll(); ss.hooks.emit('view:heights'); }
  function cellLatLon(c) {
    const x = G.centers[c * 3], y = G.centers[c * 3 + 1], z = G.centers[c * 3 + 2];
    return {lat: Math.asin(Math.max(-1, Math.min(1, y))) * 180 / Math.PI, lon: Math.atan2(x, z) * 180 / Math.PI};
  }

  return {
    get G() { return G; }, get H() { return H; }, get W() { return W; }, get unitH() { return unitH; }, get types() { return types; },
    materials: {surface: surfMat, water: waterMat, grid: gridMat, gridSame: gridSameMat, markers: ovMat},
    install, resample, refreshTypes, refreshHeights, updateAll, cellChanged, flush, pick, brushCells, setHover, topR, typeOf,
    setRelief, applyPrefs, cellLatLon, nearestCell: (x, y, z, s) => nearestCell(G, x, y, z, s),
  };
}
