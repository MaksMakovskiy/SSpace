// Orbit: things around a planet. Saved in doc.meta.orbit (your objects) and doc.meta.look.orbit (objects a generator
// placed; replaced on every generation). API for other mods: ss.orbit.registerType(def), ss.orbit.add(type, values), …
//   type def: {id, name, icon, params: [{id, name, min, max, step, value} | {id, name, kind: 'color', value}], build(item, ctx) → Object3D}
//   build may set obj.userData.tick = (dt, t) => …  for animation.
export function activate(ss, mod) {
  const {THREE} = ss, S = ss.scene, U = ss.util;
  const types = new Map();
  const root = new THREE.Group(); S.tiltGroup.add(root);
  let objs = [], selected = null;
  const D = Math.PI / 180;
  const built = new Map(); // id → {key, obj, age}
  const hashStr = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
  // the seed an object's details come from: stays the same when you edit it or it turns from «от генератора» into yours
  const seedOf = (it, salt = 0) => ((hashStr(String(it._seed || it.id)) + salt * 9973) >>> 0) || 1;

  // ---------- data ----------
  const meta = () => { if (!ss.doc) return null; ss.doc.meta = ss.doc.meta || {}; ss.doc.meta.orbit = ss.doc.meta.orbit || {items: []}; return ss.doc.meta.orbit; };
  const autoList = () => (ss.doc && ss.doc.meta && ss.doc.meta.look && Array.isArray(ss.doc.meta.look.orbit)) ? ss.doc.meta.look.orbit : [];
  const withDefaults = (it) => { const t = types.get(it.type); const o = {...it}; if (t) for (const p of t.params) if (o[p.id] === undefined) o[p.id] = p.value; return o; };
  const items = () => { const m = meta(); if (!m) return []; return [...autoList().map((x, i) => withDefaults({...x, id: x.id || 'auto' + i, auto: true})), ...m.items.map(withDefaults)]; };
  let uidN = 0; const uid = () => 'o' + Date.now().toString(36) + (uidN++).toString(36);
  function changed() { ss.docChanged({layer: 'orbit'}); rebuild(); ss.hooks.emit('orbit:changed'); }
  // editing an object a generator placed turns it into your own object
  // generator objects get fixed ids before any of them is removed, so the others keep theirs
  const pinIds = (list) => list.forEach((x, i) => { if (!x.id) x.id = 'auto' + i; });
  function own(id) {
    const m = meta(), list = autoList(); pinIds(list);
    const idx = list.findIndex(x => x.id === id);
    if (idx < 0) return m.items.find(x => x.id === id);
    // fromGen: the next generation replaces it again (removing rings in the generator really removes them)
    const copy = {...withDefaults(list[idx]), id: uid(), fromGen: true, _seed: list[idx]._seed || id}; delete copy.auto;
    list.splice(idx, 1); m.items.push(copy);
    if (built.has(id)) { built.set(copy.id, built.get(id)); built.delete(id); }
    if (selected === id) selected = copy.id;
    return copy;
  }

  // ---------- helpers for builders ----------
  const lights = (pts, color, size = 0.011) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({color, size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
  };
  // a solid ring band: radius r (inner), width w (outward), height h, around Y
  // panels of slightly different shade (and darker seams) so a ring visibly turns when it spins or is rotated
  const band = (r, w, h, color, metal = true) => {
    const prof = [new THREE.Vector2(r, -h / 2), new THREE.Vector2(r + w, -h / 2), new THREE.Vector2(r + w, h / 2), new THREE.Vector2(r, h / 2), new THREE.Vector2(r, -h / 2)];
    const geo = new THREE.LatheGeometry(prof, 240), P = geo.attributes.position, cols = new Float32Array(P.count * 3);
    const panels = 48, seed = Math.floor(r * 1000);
    for (let i = 0; i < P.count; i++) {
      const a = (Math.atan2(P.getZ(i), P.getX(i)) + Math.PI * 2) % (Math.PI * 2), f = a / (Math.PI * 2) * panels, k = Math.floor(f), fr = f - k;
      const shade = (fr < 0.06 ? 0.62 : 1) * (0.84 + 0.16 * ((Math.sin((k + seed) * 12.9898) * 43758.5453) % 1 + 1) % 1) * (k % 12 === 0 ? 0.7 : 1);
      cols[i * 3] = cols[i * 3 + 1] = cols[i * 3 + 2] = shade;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({color, vertexColors: true, side: THREE.DoubleSide, emissive: metal ? 0x0b0d12 : 0x000000}));
  };
  const tilted = (obj, it) => { const g = new THREE.Group(); g.add(obj); g.rotation.order = 'YXZ'; g.rotation.y = (it.node || 0) * D; g.rotation.x = (it.tilt || 0) * D; return g; };
  const ctx = {THREE, lights, band, tilted, U};

  // ---------- object types ----------
  function registerType(def) {
    if (!def || !def.id || typeof def.build !== 'function' || !Array.isArray(def.params)) { console.warn('[орбита] тип без id/params/build не добавлен', def && def.id); return; }
    if (types.has(def.id)) console.info(`[орбита] тип «${def.id}» заменён`);
    types.set(def.id, def); ss.hooks.emit('orbit:types');
    // saved objects of this type may be waiting for it (a mod loaded later): draw them now
    if (ss.doc && items().some(x => x.type === def.id)) rebuild(true);
  }
  registerType({
    id: 'ring', name: 'Кольцо', icon: 'ring', group: 'Кольца',
    params: [
      {id: 'radius', name: 'Радиус', min: 1.08, max: 3.5, step: 0.01, value: 1.6},
      {id: 'width', name: 'Ширина', min: 0.005, max: 0.8, step: 0.005, value: 0.12},
      {id: 'height', name: 'Высота', min: 0.002, max: 0.25, step: 0.002, value: 0.01},
      {id: 'tilt', name: 'Наклон, °', min: -90, max: 90, step: 1, value: 0},
      {id: 'node', name: 'Поворот, °', min: 0, max: 360, step: 1, value: 0},
      {id: 'lights', name: 'Огни', min: 0, max: 1, step: 0.05, value: 0.4},
      {id: 'spin', name: 'Вращение', min: -1, max: 1, step: 0.05, value: 0.1},
      {id: 'color', name: 'Цвет', kind: 'color', value: '#9aa4b2'},
    ],
    build(it) {
      const g = new THREE.Group(); g.add(band(it.radius, it.width, it.height, it.color));
      const n = Math.floor(it.lights * 900 * (it.radius + it.width) * (0.5 + it.width * 4)), p = [];
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = it.radius + Math.random() * it.width, y = (Math.random() < 0.5 ? -1 : 1) * (it.height / 2 + 0.002); p.push(Math.cos(a) * r, y, Math.sin(a) * r); }
      if (n) g.add(lights(p, Math.random() < 0.5 ? '#ffd38a' : '#9fe8ff'));
      const t = tilted(g, it); g.userData.tick = (dt) => { g.rotation.y += it.spin * 0.05 * dt; }; t.userData.tick = g.userData.tick; return t;
    },
  });
  registerType({
    id: 'debris', name: 'Обломки', icon: 'dots', group: 'Обломки и пояса',
    params: [
      {id: 'radius', name: 'Радиус', min: 1.08, max: 3.5, step: 0.01, value: 1.45},
      {id: 'spread', name: 'Разброс', min: 0.01, max: 0.8, step: 0.01, value: 0.12},
      {id: 'count', name: 'Количество', min: 50, max: 8000, step: 50, value: 1800},
      {id: 'size', name: 'Размер', min: 0.004, max: 0.04, step: 0.001, value: 0.012},
      {id: 'tilt', name: 'Наклон, °', min: -90, max: 90, step: 1, value: 8},
      {id: 'node', name: 'Поворот, °', min: 0, max: 360, step: 1, value: 0},
      {id: 'spin', name: 'Скорость', min: -1, max: 1, step: 0.05, value: 0.3},
      {id: 'color', name: 'Цвет', kind: 'color', value: '#8a8178'},
    ],
    build(it) {
      const n = it.count | 0, p = new Float32Array(n * 3), c = new Float32Array(n * 3), base = new THREE.Color(it.color), tmp = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, r = it.radius + (Math.random() + Math.random() - 1) * it.spread, y = (Math.random() + Math.random() - 1) * it.spread * 0.25;
        p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = y; p[i * 3 + 2] = Math.sin(a) * r;
        tmp.copy(base).multiplyScalar(0.6 + Math.random() * 0.7); c[i * 3] = tmp.r; c[i * 3 + 1] = tmp.g; c[i * 3 + 2] = tmp.b;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({size: it.size, vertexColors: true}));
      const t = tilted(pts, it); t.userData.tick = (dt) => { pts.rotation.y += it.spin * 0.08 * dt; }; return t;
    },
  });
  // ships and satellites: many small things, each on its own inclined orbit
  function swarmOf(it, makeGeo, engineColor) {
    const n = it.count | 0, geo = makeGeo(), mat = new THREE.MeshLambertMaterial({color: it.color, emissive: 0x111418});
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); im.frustumCulled = false;
    const orb = [];
    for (let i = 0; i < n; i++) {
      const r = it.rmin + Math.random() * Math.max(0, it.rmax - it.rmin), node = Math.random() * Math.PI * 2, inc = (Math.random() - 0.5) * 2 * it.lanes * D;
      orb.push({r, node, inc, ph: Math.random() * Math.PI * 2, w: (0.6 + Math.random() * 0.8) * it.speed * (Math.random() < 0.5 ? -1 : 1) / Math.pow(r, 1.5)});
    }
    const eng = engineColor ? new Float32Array(n * 3) : null;
    const g = new THREE.Group(); g.add(im);
    let pts = null;
    if (eng) { const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(eng, 3).setUsage(THREE.DynamicDrawUsage)); pts = new THREE.Points(eg, new THREE.PointsMaterial({color: engineColor, size: it.size * 0.9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending})); pts.frustumCulled = false; g.add(pts); }
    const m = new THREE.Matrix4(), P = new THREE.Vector3(), T = new THREE.Vector3(), R = new THREE.Vector3(), X = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3();
    const place = () => {
      for (let i = 0; i < n; i++) {
        const o = orb[i], ca = Math.cos(o.node), sa = Math.sin(o.node), ci = Math.cos(o.inc), si = Math.sin(o.inc);
        A.set(ca, 0, sa); B.set(-sa * ci, si, ca * ci);
        const c = Math.cos(o.ph), s = Math.sin(o.ph);
        P.copy(A).multiplyScalar(c * o.r).addScaledVector(B, s * o.r);
        T.copy(A).multiplyScalar(-s).addScaledVector(B, c).multiplyScalar(Math.sign(o.w) || 1);
        R.copy(P).normalize(); X.crossVectors(T, R);
        m.makeBasis(T.clone().multiplyScalar(it.size), R.clone().multiplyScalar(it.size), X.multiplyScalar(it.size)); m.setPosition(P);
        im.setMatrixAt(i, m);
        if (eng) { eng[i * 3] = P.x - T.x * it.size * 0.7; eng[i * 3 + 1] = P.y - T.y * it.size * 0.7; eng[i * 3 + 2] = P.z - T.z * it.size * 0.7; }
      }
      im.instanceMatrix.needsUpdate = true; if (pts) pts.geometry.attributes.position.needsUpdate = true;
    };
    place();
    g.userData.tick = (dt) => { for (const o of orb) o.ph += o.w * dt; place(); };
    return g;
  }
  const swarmParams = (count, rmin, rmax, size, speed, lanes, color) => [
    {id: 'count', name: 'Количество', min: 1, max: 400, step: 1, value: count},
    {id: 'rmin', name: 'Орбита от', min: 1.06, max: 3.5, step: 0.01, value: rmin},
    {id: 'rmax', name: 'Орбита до', min: 1.06, max: 3.5, step: 0.01, value: rmax},
    {id: 'size', name: 'Размер', min: 0.005, max: 0.08, step: 0.001, value: size},
    {id: 'speed', name: 'Скорость', min: 0, max: 2, step: 0.05, value: speed},
    {id: 'lanes', name: 'Разброс орбит, °', min: 0, max: 90, step: 1, value: lanes},
    {id: 'color', name: 'Цвет', kind: 'color', value: color},
  ];
  registerType({
    id: 'ships', name: 'Корабли (патруль)', icon: 'arrow', group: 'Флот и спутники',
    params: swarmParams(24, 1.12, 1.6, 0.025, 0.6, 35, '#c9d1dc'),
    build(it) {
      return swarmOf(it, () => { const g = new THREE.ConeGeometry(0.35, 1.4, 4); g.rotateZ(-Math.PI / 2); g.scale(1, 0.45, 1); return g; }, it.engine || '#7fe3ff');
    },
  });
  registerType({
    id: 'satellites', name: 'Спутники', icon: 'sparkles', group: 'Флот и спутники',
    params: swarmParams(30, 1.1, 1.9, 0.014, 0.25, 80, '#d8dee6'),
    build(it) {
      return swarmOf(it, () => { const b = new THREE.BoxGeometry(0.5, 0.5, 0.5); const p = new THREE.BoxGeometry(0.1, 0.05, 2.4); const g = new THREE.BufferGeometry(); return mergeBoxes([b, p]); }, null);
    },
  });
  function mergeBoxes(list) { // tiny merge of non-indexed copies (enough for a few boxes)
    const pos = [], nor = [];
    for (const g0 of list) { const g = g0.toNonIndexed(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g;
  }
  registerType({
    id: 'station', name: 'Станция', icon: 'station', group: 'Станции',
    params: [
      {id: 'radius', name: 'Орбита', min: 1.1, max: 3.5, step: 0.01, value: 1.7},
      {id: 'angle', name: 'Положение, °', min: 0, max: 360, step: 1, value: 40},
      {id: 'size', name: 'Размер', min: 0.03, max: 0.5, step: 0.005, value: 0.12},
      {id: 'tilt', name: 'Наклон орбиты, °', min: -90, max: 90, step: 1, value: 10},
      {id: 'node', name: 'Поворот, °', min: 0, max: 360, step: 1, value: 0},
      {id: 'speed', name: 'Скорость по орбите', min: -1, max: 1, step: 0.05, value: 0.15},
      {id: 'color', name: 'Цвет', kind: 'color', value: '#d8dee6'},
    ],
    build(it) {
      const st = new THREE.Group(), mat = new THREE.MeshLambertMaterial({color: it.color, emissive: 0x15181e});
      st.add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 8, 40), mat));
      st.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), mat));
      for (let k = 0; k < 4; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(2, 0.06, 0.06), mat); sp.rotation.z = k * Math.PI / 4 * 2 / 2; sp.rotation.z = k * Math.PI / 4; st.add(sp); }
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.6), new THREE.MeshLambertMaterial({color: '#2b4a8a', emissive: 0x0a1430})); panel.position.z = 0; panel.position.y = 0; panel.rotation.x = Math.PI / 2; panel.position.set(0, 0, 0); st.add(panel);
      const lp = []; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; lp.push(Math.cos(a) * 1.13, Math.sin(a) * 1.13, 0); }
      st.add(lights(lp, '#ffd38a', 0.012));
      st.scale.setScalar(it.size);
      const carrier = new THREE.Group(); carrier.add(st);
      let a = it.angle * D;
      const put = () => { st.position.set(Math.cos(a) * it.radius, 0, Math.sin(a) * it.radius); };
      put();
      const t = tilted(carrier, it);
      t.userData.tick = (dt) => { a += it.speed * 0.15 * dt / Math.pow(it.radius, 1.5); st.rotation.z += dt * 0.4; put(); };
      return t;
    },
  });
  // ring city: several coplanar rings — inner ones narrow and tall, outer ones flat and wide — joined by spokes,
  // with space elevators from the planet to the innermost ring
  registerType({
    id: 'ringcity', name: 'Города-кольца', icon: 'orbit', group: 'Станции',
    params: [
      {id: 'count', name: 'Колец', min: 1, max: 8, step: 1, value: 5},
      {id: 'inner', name: 'Первое кольцо на высоте', min: 1.1, max: 2, step: 0.01, value: 1.24},
      {id: 'gap', name: 'Зазор между кольцами', min: 0.01, max: 0.3, step: 0.005, value: 0.05},
      {id: 'innerW', name: 'Ширина внутреннего', min: 0.01, max: 0.3, step: 0.005, value: 0.035},
      {id: 'outerW', name: 'Ширина внешнего', min: 0.02, max: 0.8, step: 0.01, value: 0.32},
      {id: 'innerH', name: 'Высота внутреннего', min: 0.005, max: 0.3, step: 0.005, value: 0.1},
      {id: 'outerH', name: 'Высота внешнего', min: 0.002, max: 0.1, step: 0.001, value: 0.008},
      {id: 'spokes', name: 'Спиц между кольцами', min: 0, max: 36, step: 1, value: 12},
      {id: 'elevators', name: 'Космических лифтов', min: 0, max: 12, step: 1, value: 4},
      {id: 'lights', name: 'Огни городов', min: 0, max: 1, step: 0.05, value: 0.8},
      {id: 'tilt', name: 'Наклон, °', min: -90, max: 90, step: 1, value: 0},
      {id: 'node', name: 'Поворот, °', min: 0, max: 360, step: 1, value: 0},
      {id: 'spin', name: 'Вращение', min: -1, max: 1, step: 0.05, value: 0.06},
      {id: 'color', name: 'Цвет', kind: 'color', value: '#e8ecf2'},
      {id: 'glow', name: 'Цвет огней', kind: 'color', value: '#ffe08a'},
      {id: 'towers', name: 'Высотки на кольцах', min: 0, max: 1, step: 0.05, value: 0.7},
      {id: 'roads', name: 'Дороги', min: 0, max: 1, step: 0.05, value: 0.7},
      {id: 'air', name: 'Слой атмосферы над кольцом', min: 0, max: 1, step: 0.05, value: 0.6},
      {id: 'airColor', name: 'Цвет атмосферы колец', kind: 'color', value: '#bfe8ff'},
    ],
    build(it) {
      const g = new THREE.Group(), N = it.count | 0, mat = new THREE.MeshLambertMaterial({color: it.color, emissive: 0x15161a});
      const rings = []; let r = it.inner;
      // shared buffers for all rings of this city
      const roadPts = [], towerMats = [], towerCols = [], towerLights = [];
      const TOWER_CAP = 24000, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), V = new THREE.Vector3(), Sc = new THREE.Vector3();
      const towerPal = ['#f4f6fa', '#e2e8f0', '#cfd8e3', '#b8c8dc', '#dfe9f5'];
      for (let i = 0; i < N; i++) {
        const t = N > 1 ? i / (N - 1) : 0, w = it.innerW + (it.outerW - it.innerW) * t, h = it.innerH + (it.outerH - it.innerH) * t;
        const b = band(r, w, h, it.color); g.add(b); rings.push({r, w, h});
        const top = h / 2;
        // roads: avenues running around the ring and cross streets
        const avenues = [];
        if (it.roads > 0) {
          const m = Math.max(1, Math.round(w / 0.035 * it.roads));
          for (let k = 1; k <= m; k++) avenues.push(r + w * k / (m + 1));
          const seg = 256;
          for (const ar of avenues) for (let s = 0; s < seg; s++) {
            const a0 = s / seg * Math.PI * 2, a1 = (s + 1) / seg * Math.PI * 2;
            roadPts.push(Math.cos(a0) * ar, top + 0.0006, Math.sin(a0) * ar, Math.cos(a1) * ar, top + 0.0006, Math.sin(a1) * ar);
          }
          const streets = Math.round((40 + 160 * r) * it.roads);
          for (let s = 0; s < streets; s++) { const a = s / streets * Math.PI * 2; roadPts.push(Math.cos(a) * r, top + 0.0006, Math.sin(a) * r, Math.cos(a) * (r + w), top + 0.0006, Math.sin(a) * (r + w)); }
        }
        // towers on the upper surface, taller on the narrow inner rings, kept off the avenues
        const nt = Math.min(TOWER_CAP - towerMats.length, Math.floor(it.towers * 9000 * r * w));
        // each ring and each kind of detail has its own random stream: more lights do not move the houses
        const rT = U.mulberry(seedOf(it, 100 + i)), rL = U.mulberry(seedOf(it, 200 + i));
        for (let j = 0; j < nt; j++) {
          let rr = 0, ok = false;
          for (let tries = 0; tries < 4 && !ok; tries++) { rr = r + 0.004 + rT() * Math.max(0.001, w - 0.008); ok = avenues.every(ar => Math.abs(ar - rr) > 0.0035); }
          if (!ok) continue;
          const a = rT() * Math.PI * 2, fp = Math.min(0.011, w * 0.22) * (0.5 + rT() * 0.7);
          const th = (0.006 + Math.pow(rT(), 3) * 0.05) * (1 + (1 - t) * 1.6);
          q.setFromAxisAngle(Y, -a); V.set(Math.cos(a) * rr, top, Math.sin(a) * rr); Sc.set(fp, th, fp * (0.7 + rT() * 0.6));
          towerMats.push(m4.compose(V, q, Sc).clone()); towerCols.push(towerPal[Math.floor(rT() * towerPal.length)]);
          if (rT() < 0.35) towerLights.push(V.x, top + th + 0.001, V.z);
        }
        // the ring's own thin layer of air: a glowing dome over the upper surface
        if (it.air > 0) {
          const airH = w * 0.32 + 0.015, prof = [];
          for (let k = 0; k <= 16; k++) { const th2 = k / 16 * Math.PI; prof.push(new THREE.Vector2(r + w * (0.5 - 0.5 * Math.cos(th2)), top + airH * Math.sin(th2))); }
          const dome = new THREE.Mesh(new THREE.LatheGeometry(prof, 160), new THREE.MeshBasicMaterial({color: it.airColor, transparent: true, opacity: 0.11 * it.air, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}));
          dome.renderOrder = 6; g.add(dome);
        }
        // city lights on top and bottom faces and on the rims
        const n = Math.floor(it.lights * 2400 * (r + w) * (0.3 + w * 3)), p = [];
        for (let j = 0; j < n; j++) { const a = rL() * Math.PI * 2, rr = r + rL() * w, y = (rL() < 0.5 ? -1 : 1) * (h / 2 + 0.002); p.push(Math.cos(a) * rr, y, Math.sin(a) * rr); }
        for (let j = 0; j < 200 * (1 + h * 20); j++) { const a = rL() * Math.PI * 2, rr = rL() < 0.5 ? r - 0.002 : r + w + 0.002, y = (rL() - 0.5) * h; p.push(Math.cos(a) * rr, y, Math.sin(a) * rr); }
        if (p.length) g.add(lights(p, it.glow, 0.01));
        r += w + it.gap;
      }
      if (roadPts.length) {
        const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(roadPts, 3));
        g.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({color: it.glow, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false})));
      }
      if (towerMats.length) {
        const tg = new THREE.BoxGeometry(1, 1, 1); tg.translate(0, 0.5, 0);
        const im = new THREE.InstancedMesh(tg, new THREE.MeshLambertMaterial({emissive: 0x101216}), towerMats.length); im.frustumCulled = false;
        const col = new THREE.Color();
        towerMats.forEach((mm, k) => { im.setMatrixAt(k, mm); im.setColorAt(k, col.set(towerCols[k])); });
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        g.add(im);
        if (towerLights.length) g.add(lights(towerLights, '#ff9f6a', 0.008));
      }
      // spokes between neighbouring rings
      const S2 = it.spokes | 0;
      for (let i = 0; i + 1 < rings.length; i++) {
        const a0 = rings[i], a1 = rings[i + 1], len = a1.r - (a0.r + a0.w), hh = Math.min(a0.h, a1.h) * 0.5;
        if (len <= 0) continue;
        for (let k = 0; k < S2; k++) {
          const ang = (k + (i % 2) * 0.5) / S2 * Math.PI * 2, mid = a0.r + a0.w + len / 2;
          const sp = new THREE.Mesh(new THREE.BoxGeometry(len, Math.max(0.004, hh), 0.008), mat);
          sp.position.set(Math.cos(ang) * mid, 0, Math.sin(ang) * mid); sp.rotation.y = -ang; g.add(sp);
        }
      }
      // space elevators: planet surface → innermost ring
      if (rings.length) {
        const E = it.elevators | 0, top = rings[0].r;
        for (let k = 0; k < E; k++) {
          const ang = k / E * Math.PI * 2 + 0.3, len = top - 1;
          const el = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, len, 6), mat);
          el.rotation.z = Math.PI / 2; el.position.set(Math.cos(ang) * (1 + len / 2), 0, Math.sin(ang) * (1 + len / 2)); el.rotation.y = -ang; g.add(el);
          const lp = []; for (let j = 0; j < 30; j++) { const rr = 1 + len * j / 30; lp.push(Math.cos(ang) * rr, 0, Math.sin(ang) * rr); }
          g.add(lights(lp, it.glow, 0.012));
        }
      }
      const tt = tilted(g, it); tt.userData.tick = (dt) => { g.rotation.y += it.spin * 0.05 * dt; }; return tt;
    },
  });

  // ---------- rendering ----------
  function rebuild(full) {
    const tStart = performance.now();
    try { rebuildInner(full === true); } finally { if (ss.metrics) ss.metrics.record('orbit:rebuild', performance.now() - tStart, {objects: objs.length}); }
  }
  // Only objects whose settings changed are built again; the rest stay as they are (no jerk, same animation phase).
  // Builders use Math.random for their details (houses on ring cities, lights, rocks): while building, Math.random is
  // seeded from the object's id, so a rebuilt object keeps its layout. A rebuilt object is wound forward by the time
  // its predecessor had been turning, so it carries on from the same place.
  const keyOf = (it) => { const o = {...it}; delete o.auto; return JSON.stringify(o); };
  function disposeObj(o) { root.remove(o); o.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) (Array.isArray(x.material) ? x.material : [x.material]).forEach(m => m.dispose()); }); }
  function highlight(o, on) {
    o.traverse(x => {
      const m = x.material; if (!m || !m.emissive) return;
      if (x.userData.emis0 === undefined) x.userData.emis0 = m.emissive.getHex();
      m.emissive.setHex(on ? 0x3a1a10 : x.userData.emis0);
    });
  }
  function buildSeeded(t, it) {
    const real = Math.random; Math.random = U.mulberry(seedOf(it));
    try { return t.build(it, ctx); } finally { Math.random = real; }
  }
  function rebuildInner(full) {
    const show = ss.doc && ss.space.nav.level === 'planet' && ss.prefs.orbitals !== false;
    if (full || !show) { for (const b of built.values()) disposeObj(b.obj); built.clear(); root.clear(); }
    objs = [];
    if (!show) return;
    const seen = new Set();
    for (const it of items()) {
      if (it.hidden) continue;
      const t = types.get(it.type); if (!t) continue;
      seen.add(it.id);
      const key = keyOf(it), was = built.get(it.id);
      let o = was && was.key === key ? was.obj : null;
      if (!o) {
        try {
          o = buildSeeded(t, it); o.userData.itemId = it.id; o.userData.item = it;
          const age = was ? was.age : 0;
          if (was) disposeObj(was.obj);
          if (age && o.userData.tick) { const real = Math.random; Math.random = U.mulberry(7); try { o.userData.tick(age, age); } catch {} finally { Math.random = real; } }
          root.add(o); built.set(it.id, {key, obj: o, age});
        } catch (e) { console.error('[orbit ' + it.type + ']', e); if (was) { disposeObj(was.obj); built.delete(it.id); } continue; }
      } else o.userData.item = it;
      highlight(o, selected === it.id);
      objs.push(o);
    }
    for (const [id, b] of built) if (!seen.has(id)) { disposeObj(b.obj); built.delete(id); }
  }
  // a new planet / level: everything from scratch; an effect switched on: only what changed (usually nothing)
  for (const e of ['doc:loaded', 'level:changed']) ss.hooks.on(e, () => rebuild(true));
  ss.hooks.on('look:changed', () => rebuild());
  ss.hooks.on('prefs:changed', ({key}) => { if (key === 'orbitals') rebuild(); });
  ss.hooks.on('frame', ({dt, t}) => {
    if (!objs.length || !ss.prefs.anim) return;
    for (const o of objs) { if (o.userData.tick) o.userData.tick(dt, t); const b = built.get(o.userData.itemId); if (b) b.age += dt; }
  }, 7);

  // while a slider is dragged: turn/tilt the built object and change speeds without rebuilding it
  const LIVE = new Set(['tilt', 'node', 'spin', 'speed']);
  function live(id, key, v) {
    if (!LIVE.has(key)) return;
    const o = objs.find(x => x.userData.itemId === id); if (!o) return;
    const it = o.userData.item; it[key] = v;
    if (key === 'tilt' || key === 'node') { o.rotation.order = 'YXZ'; o.rotation.y = (it.node || 0) * D; o.rotation.x = (it.tilt || 0) * D; }
  }
  // a new world starts with an empty orbit (only the generator's own objects);
  // with «оставить орбиту» only what the previous generator put there is replaced
  ss.hooks.on('generate:done', (gen) => {
    const m = meta(); if (!m) return;
    const keep = gen && gen.keep, next = keep ? m.items.filter(x => !x.fromGen) : [];
    if (next.length === m.items.length) return;
    m.items = next;
    if (selected && !items().some(x => x.id === selected)) selected = null;
    ss.docChanged({layer: 'orbit'}); rebuild(); ss.hooks.emit('orbit:changed');
  });

  // ---------- placement: where each object sits, so new ones do not land on top of old ones ----------
  // band(it) → {a, b, kind}: the radial span it occupies (planet radius = 1). kind: 'ring' (a solid band), 'body' (one
  // thing at an angle), 'cloud' (a sparse swarm). A type can give its own band(it); otherwise it is read from the params.
  function bandOf(it) {
    const t = types.get(it.type); if (!t) return null;
    if (typeof t.band === 'function') { try { const r = t.band(it); if (r) return r; } catch {} }
    const has = (k) => typeof it[k] === 'number';
    if (has('rmin') && has('rmax')) return {a: Math.min(it.rmin, it.rmax), b: Math.max(it.rmin, it.rmax), kind: 'cloud'};
    if (has('inner') && has('count') && has('gap')) {
      const n = Math.max(1, it.count | 0); let w = 0; for (let i = 0; i < n; i++) w += (it.innerW || 0.03) + ((it.outerW || 0.1) - (it.innerW || 0.03)) * (n > 1 ? i / (n - 1) : 0);
      return {a: it.inner, b: it.inner + w + (n - 1) * it.gap, kind: 'ring'};
    }
    if (!has('radius')) return null;
    const r = it.radius;
    if (has('outer')) return {a: Math.min(r, it.outer), b: Math.max(r, it.outer), kind: 'ring'};
    if (has('width')) return {a: r, b: r + it.width, kind: 'ring'};
    if (has('spread')) return {a: r - it.spread, b: r + it.spread, kind: 'cloud'};
    if (has('size')) return {a: r - it.size * 1.3, b: r + it.size * 1.3, kind: 'body'};
    return {a: r - 0.03, b: r + 0.03, kind: 'body'};
  }
  // the params that move together when an object is moved outwards / inwards
  const RADIAL = ['radius', 'outer', 'rmin', 'rmax', 'inner'];
  // where the inner edge may go, so that every radial param stays inside its own slider range
  const limitsOf = (it) => {
    const t = types.get(it.type), B = bandOf(it); let lo = 1.03, hi = 4.6;
    if (t && B) for (const p of t.params) if (RADIAL.includes(p.id) && typeof it[p.id] === 'number') { const off = it[p.id] - B.a; lo = Math.max(lo, p.min - off); hi = Math.min(hi, p.max - off); }
    return {lo, hi};
  };
  const shifted = (it, d) => { const o = {}; for (const k of RADIAL) if (typeof it[k] === 'number') o[k] = +(it[k] + d).toFixed(3); return o; };
  const angDiff = (x, y) => { const d = Math.abs(((x - y) % 360 + 540) % 360 - 180); return d; };
  // do two objects get in each other's way? swarms pass through each other; bodies on one orbit are fine far apart
  function clash(A, B, ia, ib) {
    if (!A || !B || A.b <= B.a + 1e-4 || B.b <= A.a + 1e-4) return false;
    if (A.kind === 'cloud' && B.kind === 'cloud') return false;
    if (A.kind === 'body' && B.kind === 'body') return angDiff(ia.angle || 0, ib.angle || 0) < 30;
    return true;
  }
  function conflicts() {
    const its = items().filter(x => !x.hidden), out = new Map();
    const bands = its.map(bandOf);
    for (let i = 0; i < its.length; i++) for (let j = i + 1; j < its.length; j++) if (clash(bands[i], bands[j], its[i], its[j])) {
      (out.get(its[i].id) || out.set(its[i].id, []).get(its[i].id)).push(its[j].id);
      (out.get(its[j].id) || out.set(its[j].id, []).get(its[j].id)).push(its[i].id);
    }
    return out;
  }
  // the nearest free place for `it` among `others`: first another angle (for bodies), then another radius
  function freePlace(it, others) {
    const B = bandOf(it); if (!B) return null;
    const ob = others.map(o => ({o, b: bandOf(o)})).filter(x => x.b);
    const hits = (cand, cb) => ob.some(x => clash(cb, x.b, cand, x.o));
    if (!hits(it, B)) return {};
    if (B.kind === 'body') for (let k = 1; k < 12; k++) { const ang = ((it.angle || 0) + k * 30) % 360; if (!hits({...it, angle: ang}, B)) return {angle: ang}; }
    const {lo, hi} = limitsOf(it), w = B.b - B.a, pad = 0.02;  // hi: the furthest the inner edge may go
    // candidate starts: the wanted place, and right after / before every other object
    const starts = [B.a]; for (const x of ob) { starts.push(x.b.b + pad, x.b.a - pad - w); }
    let best = null;
    for (const a of starts) {
      if (a < lo - 1e-6 || a > hi + 1e-6) continue;
      const cb = {a, b: a + w, kind: B.kind};
      if (hits(it, cb)) continue;
      const d = Math.abs(a - B.a); if (!best || d < best.d) best = {d, a};
    }
    return best ? shifted(it, best.a - B.a) : null;
  }
  // lay everything out from the planet outwards so that nothing overlaps (keeps the order and the widths)
  function arrange() {
    const its = items().filter(x => !x.hidden && bandOf(x)).sort((x, y) => bandOf(x).a - bandOf(y).a), placed = [];
    let moved = 0;
    for (const it of its) {
      const fix = freePlace(it, placed);
      if (fix && Object.keys(fix).length) { const o = own(it.id); if (o) { Object.assign(o, fix); Object.assign(it, fix); moved++; } }
      placed.push(it);
    }
    if (moved) changed();
    return moved;
  }

  // ---------- API ----------
  ss.orbit = {
    bandOf, conflicts, freePlace, arrange, seedOf,
    types, registerType, items, rebuild,
    get selected() { return selected; },
    // selecting only changes the highlight, nothing is rebuilt
    select(id) { selected = id; for (const o of objs) highlight(o, o.userData.itemId === id); ss.hooks.emit('orbit:changed'); },
    add(type, values = {}) {
      const t = types.get(type), m = meta(); if (!t || !m) return null;
      const it = {type}; for (const p of t.params) it[p.id] = p.value; Object.assign(it, values); it.id = uid(); it.type = type;
      // a new object goes into a free place instead of on top of what is already there (unless told where to go)
      if (values.autoPlace === true || (!values.radius && !values.rmin && !values.inner && values.autoPlace !== false)) {
        const fix = freePlace(it, items().filter(x => !x.hidden));
        if (fix) Object.assign(it, fix); else ss.ui.toast('Свободного места на орбите не нашлось — объект встал поверх других');
      }
      delete it.autoPlace;
      m.items.push(it); selected = it.id; changed(); return it;
    },
    update(id, patch) { const it = own(id); if (!it) return; Object.assign(it, patch); changed(); },
    remove(id) {
      const m = meta(), list = autoList(); pinIds(list); const i = list.findIndex(x => x.id === id);
      if (i >= 0) list.splice(i, 1); else m.items = m.items.filter(x => x.id !== id);
      if (selected === id) selected = null; changed();
    },
    clear() { const m = meta(); m.items = []; if (ss.doc.meta.look) ss.doc.meta.look.orbit = []; selected = null; changed(); },
  };

  // ---------- window ----------
  ss.reg.windows.register({id: 'orbit', title: 'Орбита', dock: 'left', order: 3, width: 290, levels: ['planet'], accel: 'Ctrl+6', render(body) {
    const h = U.h, W = ss.ui.w;
    const addRow = h('div', {class: 'orbit-addbox'}), list = h('div', {class: 'poi-list'}), editor = h('div', {class: 'stack'});
    let filter = '';
    const search = h('input', {class: 'field', type: 'search', placeholder: 'Найти: станция, кольцо, астероиды…'});
    search.addEventListener('input', () => { filter = search.value.trim().toLowerCase(); renderAdd(); });
    const vis = W.check({id: 'orbVis', label: 'Показывать объекты на орбите', checked: ss.prefs.orbitals !== false, onChange: v => ss.setPref('orbitals', v)});
    body.append(W.section('Добавить на орбиту', true, search, addRow), W.section('На орбите', true, list, vis), W.section('Настройки объекта', true, editor));
    // add-buttons by group (types may name a `group`); the filter searches names and groups
    function renderAdd() {
      addRow.innerHTML = '';
      const groups = new Map();
      for (const t of types.values()) {
        const g = t.group || 'Другое';
        if (filter && !(t.name + ' ' + g + ' ' + (t.desc || '')).toLowerCase().includes(filter)) continue;
        if (!groups.has(g)) groups.set(g, []); groups.get(g).push(t);
      }
      if (!groups.size) addRow.appendChild(W.note('Ничего не нашлось.'));
      for (const [g, list2] of groups) {
        addRow.appendChild(h('div', {class: 'orbit-group'}, g));
        const row = h('div', {class: 'orbit-add'});
        for (const t of list2) row.appendChild(h('button', {title: (t.desc || 'Добавить: ' + t.name), onclick: () => ss.orbit.add(t.id)}, ss.themes ? ss.themes.icon(t.icon || 'dots', 'orbit-ico') : h('span', {class: 'orbit-ico'}, t.icon || '•'), t.name));
        addRow.appendChild(row);
      }
    }
    function update() {
      renderAdd();
      list.innerHTML = '';
      const its = items(), bad = conflicts();
      if (!its.length) list.appendChild(W.note('Пока пусто. Добавь кольцо, корабли или станцию кнопками выше.'));
      if (bad.size) list.appendChild(h('div', {class: 'orbit-warn'}, h('span', null, `Пересекаются: ${bad.size}`), h('button', {onclick: () => { const n = arrange(); ss.ui.toast(n ? `Разложено без пересечений: передвинуто ${n}` : 'Нечего двигать'); }}, 'Разложить')));
      for (const it of its) {
        const t = types.get(it.type);
        const eye = h('button', {class: 'orbit-eye', title: it.hidden ? 'Показать' : 'Скрыть', onclick: (e) => { e.stopPropagation(); ss.orbit.update(it.id, {hidden: !it.hidden}); }}, it.hidden ? '○' : '●');
        const del = h('button', {class: 'pal-del', title: 'Убрать с орбиты', onclick: (e) => { e.stopPropagation(); ss.orbit.remove(it.id); }}, '×');
        list.appendChild(h('div', {class: 'poi-row orbit-row' + (it.id === selected ? ' sel' : ''), onclick: () => ss.orbit.select(it.id)},
          ss.themes ? ss.themes.icon(t ? t.icon : 'help', 'orbit-ico') : h('span', {class: 'orbit-ico'}, t ? t.icon : '?'), h('span', {class: bad.has(it.id) ? 'orbit-clash' : '', title: bad.has(it.id) ? 'Пересекается с другим объектом' : ''}, (bad.has(it.id) ? '⚠ ' : '') + (it.name || (t ? t.name : it.type)) + (it.auto ? ' · от генератора' : '')), eye, del));
      }
      editor.innerHTML = '';
      const it = its.find(x => x.id === selected), t = it && types.get(it.type);
      if (!it || !t) { editor.appendChild(W.note('Выбери объект в списке, чтобы настроить.')); return; }
      for (const p of t.params) {
        if (p.kind === 'color') {
          const c = h('input', {type: 'color', class: 'color', value: it[p.id]});
          c.addEventListener('change', () => ss.orbit.update(it.id, {[p.id]: c.value}));
          editor.appendChild(h('label', {class: 'check'}, c, p.name));
        } else {
          editor.appendChild(W.slider({id: 'orb_' + p.id, label: p.name, min: p.min, max: p.max, step: p.step || 1, value: it[p.id],
            format: v => (p.step && p.step < 1 ? Number(v).toFixed(String(p.step).split('.')[1].length) : v),
            onInput: v => live(it.id, p.id, v), onChange: v => ss.orbit.update(it.id, {[p.id]: v})}));
        }
      }
      const copyOf = () => { const c = {...it}; delete c.id; delete c.auto; delete c.hidden; delete c.fromGen; delete c._seed; return c; };
      editor.appendChild(h('div', {class: 'btnrow'}, h('button', {onclick: () => ss.orbit.add(it.type, {...copyOf(), autoPlace: true})}, 'Копия'), h('button', {class: 'danger', onclick: () => ss.orbit.remove(it.id)}, 'Убрать')));
    }
    const offs = ['orbit:changed', 'orbit:types', 'doc:loaded', 'look:changed'].map(e => ss.hooks.on(e, update));
    update();
    return {update, destroy() { offs.forEach(o => o()); }};
  }});
  ss.reg.menus.register({id: 'orbit:window', menu: 'Планета', order: 40, label: 'Орбита: кольца, корабли, станции…', enabled: () => ss.space.nav.level === 'planet', action: () => ss.ui.toggleWindow('orbit'), bar: {icon: 'orbit', text: 'Орбита', order: 3, active: () => ss.ui.wm.isOpen('orbit')}});
  ss.reg.menus.register({id: 'orbit:clear', menu: 'Планета', order: 41, label: 'Очистить орбиту', enabled: () => ss.space.nav.level === 'planet', action: async () => { if (await ss.ui.confirm('Убрать с орбиты этой планеты все объекты?', 'Очистить')) ss.orbit.clear(); }});

  const css = document.createElement('style');
  css.textContent = `.orbit-addbox{display:flex;flex-direction:column;gap:4px;margin-top:6px}.orbit-group{margin-top:4px;font:600 10.5px var(--font-display);text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
    .orbit-add{display:grid;grid-template-columns:1fr 1fr;gap:4px}.orbit-add button{display:flex;align-items:center;gap:6px;font-size:12px;padding:5px 6px;text-align:left}
    .orbit-ico{width:16px;text-align:center;color:var(--accent);flex:none}.orbit-row{display:grid;grid-template-columns:16px 1fr 18px 18px;align-items:center;gap:6px}
    .orbit-eye{width:18px;height:18px;padding:0;border:0;background:none;color:var(--muted);font-size:11px}.orbit-row:hover .pal-del{opacity:1}
    .orbit-warn{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 8px;border-radius:7px;background:rgba(255,160,40,.12);color:var(--warn);font-size:12px}.orbit-warn button{padding:3px 10px;font-size:12px}.orbit-clash{color:var(--warn)}`;
  document.head.appendChild(css);
}
