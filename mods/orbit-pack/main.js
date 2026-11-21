// Orbital arsenal: many more things for the «Орбита» window — kinds of stations, ring types, belts, debris and the rest.
// Every type is an ordinary ss.orbit type ({id, name, icon, group, params, build}), so it is saved with the planet,
// edited in the window and can be placed by generators through look({orbit: [...]}).
export function activate(ss, mod) {
  if (!ss.orbit) { console.warn('[orbit-pack] нужен мод «Орбита»'); return; }
  const {THREE} = ss, D = Math.PI / 180, U = ss.util;

  // ---------- helpers ----------
  const mat = (color, emissive = 0x101318) => new THREE.MeshLambertMaterial({color, emissive});
  const glowMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1});
  const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
  const pts = (arr, color, size, opacity = 1, additive = true) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({color, size, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending}));
  };
  // details come from a seed tied to the object (not to its size or radius), so tuning it does not reshuffle them
  const rndOf = (it, salt = 0) => (ss.orbit.seedOf && (it._seed || it.id)) ? U.mulberry(ss.orbit.seedOf(it, salt)) : U.mulberry(Math.floor(((it.radius || it.rmin || 1) * 7919 + (it.size || 0.1) * 104729 + (it.count || 0) * 31 + salt) * 1000) % 2147483647);
  // put a body on a circular orbit: angle, radius, tilt/node from the item; self-rotation around its local Y
  // orient (optional Euler) turns the body before its own spin, so it spins around its own long axis
  function orbiter(it, ctx, body, selfSpin = 0, orient = null) {
    body.scale.setScalar(it.size);
    const holder = new THREE.Group();
    if (orient) { const o = new THREE.Group(); o.rotation.copy(orient); o.add(body); holder.add(o); } else holder.add(body);
    const carrier = new THREE.Group(); carrier.add(holder);
    let a = (it.angle || 0) * D;
    const put = () => { holder.position.set(Math.cos(a) * it.radius, 0, Math.sin(a) * it.radius); holder.rotation.y = -a; };
    put();
    const t = ctx.tilted(carrier, it);
    t.userData.tick = (dt, time) => { a += (it.speed || 0) * 0.15 * dt / Math.pow(it.radius, 1.5); put(); body.rotation.y += (it.rot ?? selfSpin) * dt; if (body.userData.anim) body.userData.anim(dt, time); };
    return t;
  }
  const P = {
    radius: (v = 1.7) => ({id: 'radius', name: 'Орбита', min: 1.08, max: 4, step: 0.01, value: v}),
    angle: (v = 40) => ({id: 'angle', name: 'Положение, °', min: 0, max: 360, step: 1, value: v}),
    size: (v, max = 0.6) => ({id: 'size', name: 'Размер', min: 0.01, max, step: 0.005, value: v}),
    tilt: (v = 8) => ({id: 'tilt', name: 'Наклон орбиты, °', min: -90, max: 90, step: 1, value: v}),
    node: (v = 0) => ({id: 'node', name: 'Поворот, °', min: 0, max: 360, step: 1, value: v}),
    speed: (v = 0.15) => ({id: 'speed', name: 'Скорость по орбите', min: -1, max: 1, step: 0.05, value: v}),
    rot: (v = 0.3) => ({id: 'rot', name: 'Вращение станции', min: -2, max: 2, step: 0.05, value: v}),
    color: (v, name = 'Цвет корпуса') => ({id: 'color', name, kind: 'color', value: v}),
    accent: (v, name = 'Цвет огней') => ({id: 'accent', name, kind: 'color', value: v}),
  };
  const stationParams = (size, color, accent, extra = []) => [P.radius(), P.angle(), P.size(size), ...extra, P.tilt(), P.node(), P.speed(), P.rot(), P.color(color), P.accent(accent)];
  const reg = (def) => ss.orbit.registerType(def);

  // ================= STATIONS =================
  reg({id: 'st-wheel', name: 'Станция-колесо', icon: 'wheel', group: 'Станции', desc: 'Вращающееся колесо со спицами и стыковочной осью',
    params: stationParams(0.12, '#d8dee6', '#ffd38a', [{id: 'spokes', name: 'Спиц', min: 2, max: 12, step: 1, value: 6}]),
    build(it, ctx) {
      const b = new THREE.Group(), m = mat(it.color);
      b.add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.13, 10, 64), m));
      for (let i = 0; i < (it.spokes | 0); i++) { const s = mesh(new THREE.BoxGeometry(1, 0.05, 0.05), m, 0.5, 0, 0); const g = new THREE.Group(); g.add(s); g.rotation.y = i / it.spokes * Math.PI * 2; b.add(g); }
      b.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 16), m));
      b.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), m));
      const L = []; for (let i = 0; i < 90; i++) { const a = i / 90 * Math.PI * 2; L.push(Math.cos(a) * 1.15, (i % 2 ? 0.05 : -0.05), Math.sin(a) * 1.15); }
      b.add(pts(L, it.accent, 0.012));
      return orbiter(it, ctx, b);
    }});
  reg({id: 'st-cylinder', name: 'Цилиндр-колония', icon: 'cylinder', group: 'Станции', desc: 'Огромный вращающийся цилиндр с полосами окон и зеркалами',
    params: stationParams(0.2, '#c9d1dc', '#fff1c8', [{id: 'mirrors', name: 'Зеркала', min: 0, max: 1, step: 1, value: 1}]),
    build(it, ctx) {
      const b = new THREE.Group(), m = mat(it.color);
      b.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 2.4, 32, 1), m));
      b.add(mesh(new THREE.SphereGeometry(0.32, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 1.2, 0));
      const cap = mesh(new THREE.SphereGeometry(0.32, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, -1.2, 0); cap.rotation.x = Math.PI; b.add(cap);
      const L = []; for (let s = 0; s < 3; s++) for (let i = 0; i < 60; i++) { const a = s / 3 * Math.PI * 2, y = -1.15 + i / 60 * 2.3; L.push(Math.cos(a) * 0.33, y, Math.sin(a) * 0.33); }
      b.add(pts(L, it.accent, 0.014));
      if (it.mirrors) for (let s = 0; s < 3; s++) {
        const pane = mesh(new THREE.BoxGeometry(0.02, 2.2, 0.55), new THREE.MeshLambertMaterial({color: '#bfe0ff', emissive: 0x203040}));
        const g = new THREE.Group(); pane.position.set(0.62, 0, 0); pane.rotation.z = 0.35; g.add(pane); g.rotation.y = (s / 3 + 1 / 6) * Math.PI * 2; b.add(g);
      }
      return orbiter(it, ctx, b, 0.3, new THREE.Euler(0, 0, Math.PI / 2));
    }});
  reg({id: 'st-modular', name: 'Модульная станция', icon: 'modules', group: 'Станции', desc: 'Ферма с модулями, солнечными крыльями и радиаторами',
    params: stationParams(0.1, '#e6e8ec', '#7fe3ff', [{id: 'modules', name: 'Модулей', min: 2, max: 12, step: 1, value: 5}, {id: 'panels', name: 'Солнечных крыльев', min: 0, max: 8, step: 1, value: 4}]),
    build(it, ctx) {
      const b = new THREE.Group(), m = mat(it.color), r = rndOf(it, 3);
      b.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.07, 0.07), mat('#9aa4b2')));
      const n = it.modules | 0;
      for (let i = 0; i < n; i++) { const x = -0.6 + (n > 1 ? i / (n - 1) : 0.5) * 1.2; const c = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.45 + r() * 0.35, 14), m, x, 0, 0); c.rotation.x = Math.PI / 2; b.add(c); }
      const panel = new THREE.MeshLambertMaterial({color: '#2b4a8a', emissive: 0x0a1430});
      for (let i = 0; i < (it.panels | 0); i++) { const side = i % 2 ? 1 : -1, x = (i < 4 ? -1.05 : 1.05) + ((i >> 1) % 2) * (i < 4 ? 0.28 : -0.28); b.add(mesh(new THREE.BoxGeometry(0.24, 0.01, 0.9), panel, x, 0, side * 0.55)); }
      b.add(mesh(new THREE.BoxGeometry(0.5, 0.01, 0.25), mat('#f4f6fa'), 0, 0.25, 0));
      b.add(pts([-1.2, 0.05, 0, 1.2, 0.05, 0, 0, 0.12, 0.3, 0, 0.12, -0.3], it.accent, 0.02));
      return orbiter(it, ctx, b, 0.05);
    }});
  reg({id: 'st-citadel', name: 'Сфера-цитадель', icon: 'citadel', group: 'Станции', desc: 'Бронированная сфера с поясами, шипами-антеннами и огнями',
    params: stationParams(0.16, '#7a828e', '#ff6a5a', [{id: 'belts', name: 'Поясов', min: 0, max: 5, step: 1, value: 3}]),
    build(it, ctx) {
      const b = new THREE.Group(), m = mat(it.color), r = rndOf(it, 5);
      b.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshPhongMaterial({color: it.color, flatShading: true, shininess: 8})));
      for (let i = 0; i < (it.belts | 0); i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(1.02 - Math.abs(i - (it.belts - 1) / 2) * 0.12, 0.05, 8, 48), m); t.rotation.x = Math.PI / 2; t.position.y = (i - (it.belts - 1) / 2) * 0.35; b.add(t); }
      for (let i = 0; i < 10; i++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), d = new THREE.Vector3(Math.cos(a) * s, u, Math.sin(a) * s); const sp = mesh(new THREE.ConeGeometry(0.05, 0.5, 6), m); sp.position.copy(d.clone().multiplyScalar(1.15)); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); b.add(sp); }
      const L = []; for (let i = 0; i < 160; i++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); L.push(Math.cos(a) * s * 1.01, u * 1.01, Math.sin(a) * s * 1.01); }
      b.add(pts(L, it.accent, 0.012));
      return orbiter(it, ctx, b, 0.08);
    }});
  reg({id: 'st-shipyard', name: 'Верфь', icon: 'grid', group: 'Станции', desc: 'Решётчатый каркас со строящимся кораблём и вспышками сварки',
    params: stationParams(0.18, '#9aa4b2', '#7fe3ff', [{id: 'progress', name: 'Готовность корабля', min: 0, max: 1, step: 0.05, value: 0.6}]),
    build(it, ctx) {
      const b = new THREE.Group();
      const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.6, 0.8, 0.8, 6, 2, 2)), new THREE.LineBasicMaterial({color: it.color}));
      b.add(frame);
      for (const z of [-0.4, 0.4]) for (const y of [-0.4, 0.4]) b.add(mesh(new THREE.BoxGeometry(2.6, 0.04, 0.04), mat(it.color), 0, y, z));
      const hull = mat('#d8dee6'), L = it.progress * 2.2;
      if (L > 0.05) { const c = mesh(new THREE.CylinderGeometry(0.22, 0.26, L, 16), hull, -1.1 + L / 2, 0, 0); c.rotation.z = Math.PI / 2; b.add(c); }
      if (it.progress > 0.9) { const n = mesh(new THREE.ConeGeometry(0.22, 0.45, 16), hull, 1.15, 0, 0); n.rotation.z = -Math.PI / 2; b.add(n); }
      const sparks = pts([-1.1 + L, 0.25, 0.1, -1.1 + L, -0.2, -0.15, -1.1 + L * 0.6, 0.3, -0.2, -1.1 + L * 0.3, -0.28, 0.2], it.accent, 0.03);
      b.add(sparks);
      b.userData.anim = (dt, t) => { sparks.material.opacity = 0.3 + 0.7 * Math.abs(Math.sin(t * 11)); };
      return orbiter(it, ctx, b, 0);
    }});
  reg({id: 'st-dock', name: 'Порт-кольцо', icon: 'dock', group: 'Станции', desc: 'Кольцо-причал с пришвартованными кораблями и маяками',
    params: stationParams(0.2, '#b8c0cc', '#9fe8ff', [{id: 'ships', name: 'Кораблей у причала', min: 0, max: 24, step: 1, value: 10}]),
    build(it, ctx) {
      const b = new THREE.Group(), m = mat(it.color), r = rndOf(it, 7);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 80), m); ring.rotation.x = Math.PI / 2; b.add(ring);
      b.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.25, 16), m));
      for (let i = 0; i < 4; i++) { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(1, 0.03, 0.03), m, 0.5, 0, 0)); g.rotation.y = i * Math.PI / 2; b.add(g); }
      const ship = new THREE.ConeGeometry(0.06, 0.28, 5); ship.rotateZ(-Math.PI / 2);
      const shipCols = ['#d8dee6', '#c4472f', '#e0a33a', '#3c8a5a', '#2f6fb0'];
      for (let i = 0; i < (it.ships | 0); i++) { const a = (i + r() * 0.4) / it.ships * Math.PI * 2, s = mesh(ship, mat(shipCols[Math.floor(r() * shipCols.length)]), Math.cos(a) * 1.18, 0, Math.sin(a) * 1.18); s.rotation.y = -a; b.add(s); }
      const beacons = pts([1.06, 0, 0, -1.06, 0, 0, 0, 0, 1.06, 0, 0, -1.06], it.accent, 0.035);
      b.add(beacons); b.userData.anim = (dt, t) => { beacons.material.opacity = Math.sin(t * 3) > 0 ? 1 : 0.15; };
      return orbiter(it, ctx, b, 0.04);
    }});
  reg({id: 'st-mirror', name: 'Солнечная ферма', icon: 'panels', group: 'Станции', desc: 'Поле солнечных панелей или орбитальное зеркало',
    params: stationParams(0.25, '#2b4a8a', '#9fe8ff', [{id: 'grid', name: 'Панелей в ряду', min: 2, max: 16, step: 1, value: 6}]),
    build(it, ctx) {
      const b = new THREE.Group(), n = it.grid | 0, pm = new THREE.MeshLambertMaterial({color: it.color, emissive: 0x08122a}), fm = mat('#9aa4b2');
      const step = 2 / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) b.add(mesh(new THREE.BoxGeometry(step * 0.9, 0.01, step * 0.9), pm, -1 + step * (i + 0.5), 0, -1 + step * (j + 0.5)));
      b.add(mesh(new THREE.BoxGeometry(2.05, 0.02, 0.03), fm)); b.add(mesh(new THREE.BoxGeometry(0.03, 0.02, 2.05), fm));
      b.add(pts([1, 0.02, 1, -1, 0.02, 1, 1, 0.02, -1, -1, 0.02, -1], it.accent, 0.02));
      b.rotation.z = 0.5;
      return orbiter(it, ctx, b, 0);
    }});
  reg({id: 'st-beacon', name: 'Маяк-ретранслятор', icon: 'beacon', group: 'Станции', desc: 'Небольшой маяк с антеннами и мигающим огнём',
    params: stationParams(0.05, '#d8dee6', '#ff4a4a', [{id: 'blink', name: 'Частота мигания', min: 0.2, max: 5, step: 0.1, value: 1.5}]),
    build(it, ctx) {
      const b = new THREE.Group(), m = mat(it.color);
      b.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.6, 8), m));
      for (const s of [-1, 1]) b.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), m, 0, s * 0.9, 0));
      const dish = mesh(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, 0.9), m, 0.45, 0, 0); dish.rotation.z = Math.PI / 2; b.add(dish);
      const light = mesh(new THREE.SphereGeometry(0.14, 10, 8), glowMat(it.accent, 1), 0, 1.5, 0); b.add(light);
      b.userData.anim = (dt, t) => { light.visible = Math.sin(t * it.blink * Math.PI * 2) > 0.3; };
      return orbiter(it, ctx, b, 0.1);
    }});
  reg({id: 'st-elevator', name: 'Космический лифт', icon: 'elevator', group: 'Станции', desc: 'Трос от поверхности до противовеса, по нему ползут кабины',
    params: [{id: 'radius', name: 'Высота противовеса', min: 1.2, max: 4, step: 0.01, value: 2.2}, P.angle(0), P.size(0.08, 0.3), {id: 'lat', name: 'Широта основания, °', min: -60, max: 60, step: 1, value: 0},
      {id: 'cabins', name: 'Кабин', min: 0, max: 20, step: 1, value: 6}, {id: 'climb', name: 'Скорость кабин', min: 0, max: 2, step: 0.05, value: 0.5}, P.color('#c9d1dc'), P.accent('#ffd38a')],
    build(it, ctx) {
      // fixed to the planet's surface: rotates with the globe, so it is built in the planet frame
      const g = new THREE.Group(), lat = (it.lat || 0) * D, lon = (it.angle || 0) * D;
      const dir = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
      const len = it.radius - 1, m = mat(it.color);
      const tether = mesh(new THREE.CylinderGeometry(0.003, 0.006, len, 6), m); tether.position.copy(dir.clone().multiplyScalar(1 + len / 2)); tether.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); g.add(tether);
      const top = new THREE.Group(); top.add(new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), m)); top.add(new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.12, 6, 24), m));
      top.scale.setScalar(it.size); top.position.copy(dir.clone().multiplyScalar(it.radius)); top.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); g.add(top);
      const base = mesh(new THREE.CylinderGeometry(it.size * 0.5, it.size * 0.8, it.size * 0.6, 10), m); base.position.copy(dir.clone().multiplyScalar(1.0 + it.size * 0.3)); base.quaternion.copy(top.quaternion); g.add(base);
      const n = it.cabins | 0, cab = new Float32Array(n * 3), ph = Array.from({length: n}, (_, i) => i / Math.max(1, n));
      const cabPts = pts(Array.from(cab), it.accent, 0.018); g.add(cabPts);
      const place = () => { const a = cabPts.geometry.attributes.position; for (let i = 0; i < n; i++) { const f = (Math.sin(ph[i] * Math.PI * 2) * 0.5 + 0.5), r = 1 + len * f; a.setXYZ(i, dir.x * r, dir.y * r, dir.z * r); } a.needsUpdate = true; };
      place();
      const holder = new THREE.Group(); holder.add(g);
      holder.userData.tick = (dt) => { for (let i = 0; i < n; i++) ph[i] += it.climb * 0.05 * dt; place(); };
      // the orbit root does not spin with the planet, the globe does: follow it
      holder.userData.followGlobe = true;
      return holder;
    }});

  // ================= RINGS =================
  const ringBase = (inner, outer, color, color2) => [
    {id: 'radius', name: 'Внутренний край', min: 1.05, max: 4, step: 0.01, value: inner},
    {id: 'outer', name: 'Внешний край', min: 1.06, max: 5, step: 0.01, value: outer},
    P.tilt(12), P.node(), {id: 'spin', name: 'Вращение', min: -1, max: 1, step: 0.05, value: 0.1},
    {id: 'opacity', name: 'Плотность', min: 0.05, max: 1, step: 0.05, value: 0.7},
    P.color(color, 'Цвет'), P.accent(color2, 'Второй цвет'),
  ];
  // a flat lathe disc whose colour/opacity vary with radius (bands, gaps)
  function disc(rIn, rOut, profile, segs = 220) {
    const N = 160, prof = [];
    for (let i = 0; i <= N; i++) prof.push(new THREE.Vector2(rIn + (rOut - rIn) * i / N, 0));
    const geo = new THREE.LatheGeometry(prof, segs), P2 = geo.attributes.position, cols = new Float32Array(P2.count * 4);
    for (let i = 0; i < P2.count; i++) {
      const r = Math.hypot(P2.getX(i), P2.getZ(i)), f = (r - rIn) / Math.max(1e-6, rOut - rIn), a = Math.atan2(P2.getZ(i), P2.getX(i));
      const [cr, cg, cb, ca] = profile(f, a); cols[i * 4] = cr; cols[i * 4 + 1] = cg; cols[i * 4 + 2] = cb; cols[i * 4 + 3] = ca;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 4));
    const m = new THREE.MeshBasicMaterial({vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false});
    // three r128: vec4 vertex colours need this define
    m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <color_pars_vertex>', 'attribute vec4 color;\nvarying vec4 vCol4;').replace('#include <color_vertex>', 'vCol4=color;'); sh.fragmentShader = sh.fragmentShader.replace('#include <color_pars_fragment>', 'varying vec4 vCol4;').replace('#include <color_fragment>', 'diffuseColor*=vCol4;'); };
    m.vertexColors = false; m.customProgramCacheKey = () => 'orbit-disc4';
    const o = new THREE.Mesh(geo, m); o.renderOrder = 3; return o;
  }
  const spinning = (it, ctx, obj) => { const g = new THREE.Group(); g.add(obj); const t = ctx.tilted(g, it); t.userData.tick = (dt) => { g.rotation.y += (it.spin || 0) * 0.05 * dt; }; return t; };
  reg({id: 'ring-banded', name: 'Многополосное кольцо', icon: 'ring', group: 'Кольца', desc: 'Широкое кольцо из многих полос с щелями, как у Сатурна',
    params: [...ringBase(1.3, 2.3, '#eadcae', '#b8955a'), {id: 'bands', name: 'Полос', min: 2, max: 40, step: 1, value: 14}, {id: 'gaps', name: 'Щели', min: 0, max: 8, step: 1, value: 2}],
    build(it, ctx) {
      const r = rndOf(it, 11), c1 = new THREE.Color(it.color), c2 = new THREE.Color(it.accent), n = it.bands | 0;
      const bandV = Array.from({length: n}, () => r()), gaps = Array.from({length: it.gaps | 0}, () => [0.1 + r() * 0.8, 0.008 + r() * 0.03]);
      const tmp = new THREE.Color();
      return spinning(it, ctx, disc(it.radius, Math.max(it.outer, it.radius + 0.01), (f, a) => {
        const b = bandV[Math.min(n - 1, Math.floor(f * n))]; tmp.copy(c1).lerp(c2, b);
        let al = it.opacity * (0.35 + 0.65 * b) * Math.min(1, f * 12, (1 - f) * 12);
        for (const [gp, gw] of gaps) if (Math.abs(f - gp) < gw) al *= 0.05;
        return [tmp.r, tmp.g, tmp.b, al];
      }));
    }});
  reg({id: 'ring-ice', name: 'Ледяное кольцо', icon: 'snowflake', group: 'Кольца', desc: 'Узкое кольцо из сверкающих льдинок',
    params: [...ringBase(1.6, 1.75, '#e8f4ff', '#9fd8ff'), {id: 'count', name: 'Льдинок', min: 200, max: 20000, step: 100, value: 6000}, {id: 'grain', name: 'Размер льдинок', min: 0.002, max: 0.03, step: 0.001, value: 0.007}],
    build(it, ctx) {
      const r = rndOf(it, 13), n = it.count | 0, a = new Float32Array(n * 3), c = new Float32Array(n * 3), c1 = new THREE.Color(it.color), c2 = new THREE.Color(it.accent), t = new THREE.Color();
      for (let i = 0; i < n; i++) { const ang = r() * Math.PI * 2, rr = it.radius + r() * Math.max(0.005, it.outer - it.radius); a[i * 3] = Math.cos(ang) * rr; a[i * 3 + 1] = (r() - 0.5) * 0.006; a[i * 3 + 2] = Math.sin(ang) * rr; t.copy(c1).lerp(c2, r()); c[i * 3] = t.r; c[i * 3 + 1] = t.g; c[i * 3 + 2] = t.b; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      const p = new THREE.Points(g, new THREE.PointsMaterial({size: it.grain, vertexColors: true, transparent: true, opacity: it.opacity, depthWrite: false, blending: THREE.AdditiveBlending}));
      const o = spinning(it, ctx, p); const base = o.userData.tick;
      o.userData.tick = (dt, time) => { base(dt); p.material.size = it.grain * (0.85 + 0.15 * Math.sin(time * 4)); };
      return o;
    }});
  reg({id: 'ring-dust', name: 'Пылевое кольцо', icon: 'ash', group: 'Кольца', desc: 'Тусклый широкий пылевой диск, почти прозрачный',
    params: ringBase(1.2, 2.8, '#c8b8a0', '#8a7a6a'),
    build(it, ctx) {
      const c1 = new THREE.Color(it.color), c2 = new THREE.Color(it.accent), t = new THREE.Color();
      return spinning(it, ctx, disc(it.radius, Math.max(it.outer, it.radius + 0.01), (f, a) => {
        const w = 0.5 + 0.5 * Math.sin(f * 23 + Math.sin(a * 3) * 0.6); t.copy(c1).lerp(c2, w);
        return [t.r, t.g, t.b, it.opacity * 0.35 * Math.sin(Math.PI * f) * (0.6 + 0.4 * w)];
      }));
    }});
  reg({id: 'ring-energy', name: 'Энергетическое кольцо', icon: 'energy', group: 'Кольца', desc: 'Светящееся кольцо-щит с бегущими волнами',
    params: [...ringBase(1.45, 1.5, '#7fe3ff', '#bfe8ff'), {id: 'pulse', name: 'Скорость волн', min: 0, max: 5, step: 0.1, value: 1.5}],
    build(it, ctx) {
      const d = disc(it.radius, Math.max(it.outer, it.radius + 0.005), (f) => [1, 1, 1, Math.sin(Math.PI * f)]);
      d.material.blending = THREE.AdditiveBlending; d.material.color.set(it.color);
      const uni = {uT: {value: 0}, uC2: {value: new THREE.Color(it.accent)}, uP: {value: it.pulse}, uO: {value: it.opacity}};
      const prev = d.material.onBeforeCompile;
      d.material.onBeforeCompile = (sh) => {
        prev(sh); Object.assign(sh.uniforms, uni);
        sh.vertexShader = 'varying vec3 vPosE;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosE=position;');
        sh.fragmentShader = 'uniform float uT;uniform vec3 uC2;uniform float uP;uniform float uO;varying vec3 vPosE;\n' + sh.fragmentShader.replace('diffuseColor*=vCol4;', 'diffuseColor*=vCol4;float an=atan(vPosE.z,vPosE.x);float w=pow(0.5+0.5*sin(an*12.0-uT*uP*3.0),6.0);diffuseColor.rgb=mix(diffuseColor.rgb,uC2,w);diffuseColor.a*=uO*(0.35+0.65*w);');
      };
      d.material.customProgramCacheKey = () => 'orbit-energy';
      const o = spinning(it, ctx, d); const base = o.userData.tick;
      o.userData.tick = (dt, time) => { base(dt); uni.uT.value = time; };
      return o;
    }});

  // ================= BELTS AND DEBRIS =================
  const rockGeo = (seed) => {
    const g = new THREE.IcosahedronGeometry(1, 0), P2 = g.attributes.position, r = U.mulberry(seed), off = new Map();
    for (let i = 0; i < P2.count; i++) { const k = [P2.getX(i), P2.getY(i), P2.getZ(i)].map(v => Math.round(v * 1000)).join(','); if (!off.has(k)) off.set(k, 0.6 + r() * 0.6); const f = off.get(k); P2.setXYZ(i, P2.getX(i) * f, P2.getY(i) * f * 0.8, P2.getZ(i) * f); }
    g.computeVertexNormals(); return g;
  };
  // many instanced pieces on a belt; each piece tumbles; the belt turns
  function belt(it, ctx, geo, material, {countKey = 'count', thick = 0.25} = {}) {
    const r = rndOf(it, 17), n = it[countKey] | 0, im = new THREE.InstancedMesh(geo, material, Math.max(1, n)); im.frustumCulled = false;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color(), base = new THREE.Color(it.color), alt = new THREE.Color(it.accent || it.color);
    const items = [];
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, rr = it.radius + (r() + r() - 1) * it.spread, y = (r() + r() - 1) * it.spread * thick, sz = it.size * (0.3 + Math.pow(r(), 3) * 1.7);
      items.push({a, rr, y, sz, rx: r() * 6, ry: r() * 6, w: (0.6 + r() * 0.8) / Math.pow(Math.max(1.05, rr), 1.5), tumble: (r() - 0.5) * 2});
      im.setColorAt(i, col.copy(base).lerp(alt, r()).multiplyScalar(0.7 + r() * 0.5));
    }
    const place = () => {
      for (let i = 0; i < n; i++) { const o = items[i]; v.set(Math.cos(o.a) * o.rr, o.y, Math.sin(o.a) * o.rr); q.setFromEuler(e.set(o.rx, o.ry, 0)); s.setScalar(o.sz); im.setMatrixAt(i, m4.compose(v, q, s)); }
      im.instanceMatrix.needsUpdate = true;
    };
    place(); if (im.instanceColor) im.instanceColor.needsUpdate = true;
    const g = new THREE.Group(); g.add(im);
    const t = ctx.tilted(g, it);
    let acc = 0;
    t.userData.tick = (dt) => {
      // moving thousands of pieces every frame is costly: update at ~20 fps
      acc += dt; if (acc < 0.05) return; const step = acc; acc = 0;
      for (const o of items) { o.a += o.w * it.speed * 0.15 * step; o.rx += o.tumble * step; o.ry += o.tumble * 0.7 * step; }
      place();
    };
    return t;
  }
  const beltParams = (radius, spread, count, size, color, accent, maxCount = 6000) => [
    {id: 'radius', name: 'Радиус', min: 1.08, max: 4.5, step: 0.01, value: radius},
    {id: 'spread', name: 'Ширина', min: 0.01, max: 1, step: 0.01, value: spread},
    {id: 'count', name: 'Количество', min: 10, max: maxCount, step: 10, value: count},
    {id: 'size', name: 'Размер', min: 0.002, max: 0.08, step: 0.001, value: size},
    P.tilt(6), P.node(), {id: 'speed', name: 'Скорость', min: -2, max: 2, step: 0.05, value: 0.4},
    P.color(color, 'Цвет'), P.accent(accent, 'Второй цвет'),
  ];
  reg({id: 'belt-asteroids', name: 'Астероидный пояс', icon: 'meteor', group: 'Обломки и пояса', desc: 'Каменные астероиды разных размеров, кувыркаются',
    params: beltParams(2.2, 0.25, 900, 0.012, '#8a8178', '#5a524a'),
    build(it, ctx) { return belt(it, ctx, rockGeo(5), new THREE.MeshPhongMaterial({flatShading: true, shininess: 3})); }});
  reg({id: 'belt-ice', name: 'Пояс ледяных глыб', icon: 'diamond', group: 'Обломки и пояса', desc: 'Глыбы льда, отблёскивающие на солнце',
    params: beltParams(2.6, 0.3, 600, 0.01, '#dff0ff', '#9fd0ff'),
    build(it, ctx) { return belt(it, ctx, new THREE.OctahedronGeometry(1, 0), new THREE.MeshPhongMaterial({flatShading: true, shininess: 80, specular: 0xffffff})); }});
  reg({id: 'belt-metal', name: 'Металлический мусор', icon: 'scrap', group: 'Обломки и пояса', desc: 'Куски обшивки, ступени ракет и прочий техногенный мусор',
    params: beltParams(1.35, 0.15, 1200, 0.006, '#9aa4b2', '#c4472f'),
    build(it, ctx) { const g = new THREE.BoxGeometry(1.6, 0.4, 0.8); return belt(it, ctx, g, new THREE.MeshPhongMaterial({flatShading: true, shininess: 40}), {thick: 0.6}); }});
  reg({id: 'wrecks', name: 'Кладбище кораблей', icon: 'anchor', group: 'Обломки и пояса', desc: 'Разбитые корпуса кораблей и искры коротящей проводки',
    params: [{id: 'radius', name: 'Орбита', min: 1.1, max: 4, step: 0.01, value: 1.9}, P.angle(120), {id: 'spread', name: 'Разброс', min: 0.02, max: 0.6, step: 0.01, value: 0.12},
      {id: 'count', name: 'Корпусов', min: 1, max: 60, step: 1, value: 14}, P.size(0.05, 0.3), P.tilt(10), P.node(), P.speed(0.1), P.color('#6a6f78'), P.accent('#7fe3ff', 'Цвет искр')],
    build(it, ctx) {
      const r = rndOf(it, 19), b = new THREE.Group(), m = new THREE.MeshPhongMaterial({color: it.color, flatShading: true, shininess: 10}), burnt = new THREE.MeshPhongMaterial({color: '#2a2622', flatShading: true});
      const sparks = [], pieces = [];
      for (let i = 0; i < (it.count | 0); i++) {
        const w = new THREE.Group(), len = 0.6 + r() * 1.4;
        const hull = mesh(new THREE.CylinderGeometry(0.18, 0.22, len, 7, 1, r() < 0.5), r() < 0.3 ? burnt : m); hull.rotation.z = Math.PI / 2; w.add(hull);
        if (r() < 0.6) { const fin = mesh(new THREE.BoxGeometry(0.4, 0.03, 0.5), m, -len / 2 + 0.2, 0, 0.25); fin.rotation.y = r(); w.add(fin); }
        if (r() < 0.5) { const nose = mesh(new THREE.ConeGeometry(0.18, 0.4, 7), m, len / 2 + 0.2, 0, 0); nose.rotation.z = -Math.PI / 2; w.add(nose); }
        const a = (r() - 0.5) * 2 * it.spread / Math.max(0.1, it.radius) * 3;
        w.position.set((r() - 0.5) * it.spread * 2 / it.size, (r() - 0.5) * it.spread / it.size, (r() - 0.5) * it.spread * 2 / it.size);
        w.rotation.set(r() * 6, r() * 6, r() * 6); w.scale.setScalar(0.5 + r());
        b.add(w); pieces.push({w, s: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.4)});
        if (r() < 0.6) sparks.push(w.position.x, w.position.y, w.position.z);
      }
      const sp = pts(sparks, it.accent, 0.04); b.add(sp);
      b.userData.anim = (dt, t) => { sp.material.opacity = Math.random() < 0.15 ? 1 : 0.1; for (const p of pieces) { p.w.rotation.x += p.s.x * dt; p.w.rotation.y += p.s.y * dt; } };
      return orbiter(it, ctx, b, 0);
    }});
  reg({id: 'minefield', name: 'Минное поле', icon: 'wisp', group: 'Обломки и пояса', desc: 'Шипастые мины кольцом вокруг планеты, мигают красным',
    params: [...beltParams(1.5, 0.05, 300, 0.008, '#4a4f58', '#ff3a3a', 3000)],
    build(it, ctx) {
      const geo = new THREE.IcosahedronGeometry(1, 0), o = belt(it, ctx, geo, new THREE.MeshPhongMaterial({flatShading: true, shininess: 30}), {thick: 0.4});
      // blinking red lights over the mines
      const r = rndOf(it, 23), L = []; for (let i = 0; i < Math.min(600, it.count | 0); i++) { const a = r() * Math.PI * 2, rr = it.radius + (r() + r() - 1) * it.spread; L.push(Math.cos(a) * rr, (r() - 0.5) * it.spread * 0.4, Math.sin(a) * rr); }
      const lights = pts(L, it.accent, it.size * 1.6); o.children[0].add(lights);
      const base = o.userData.tick; o.userData.tick = (dt, t) => { base(dt); lights.material.opacity = Math.sin(t * 4) > 0.2 ? 1 : 0.1; o.children[0].rotation.y += it.speed * 0.02 * dt; };
      return o;
    }});

  // ================= FLEET, DEFENCE, NETWORKS, MOONLETS =================
  reg({id: 'defense', name: 'Орбитальная оборона', icon: 'shield', group: 'Флот и спутники', desc: 'Кольцо боевых платформ с турелями',
    params: [{id: 'radius', name: 'Орбита', min: 1.08, max: 4, step: 0.01, value: 1.4}, {id: 'count', name: 'Платформ', min: 1, max: 48, step: 1, value: 12}, P.size(0.03, 0.15),
      P.tilt(0), P.node(), P.speed(0.1), P.color('#7a828e'), P.accent('#ff6a3a')],
    build(it, ctx) {
      const g = new THREE.Group(), m = mat(it.color), n = it.count | 0, L = [];
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, p = new THREE.Group();
        p.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 1), m));
        p.add(mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.3, 10), m, 0, 0.27, 0));
        for (const z of [-0.12, 0.12]) { const br = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), m, 0.45, 0.38, z); br.rotation.z = Math.PI / 2; p.add(br); }
        p.scale.setScalar(it.size); p.position.set(Math.cos(a) * it.radius, 0, Math.sin(a) * it.radius); p.rotation.y = -a + Math.PI / 2; g.add(p);
        L.push(Math.cos(a) * it.radius, it.size * 0.4, Math.sin(a) * it.radius);
      }
      const lights = pts(L, it.accent, 0.02); g.add(lights);
      const t = ctx.tilted(g, it); t.userData.tick = (dt, time) => { g.rotation.y += it.speed * 0.05 * dt; lights.material.opacity = 0.5 + 0.5 * Math.sin(time * 2); };
      return t;
    }});
  reg({id: 'constellation', name: 'Созвездие спутников', icon: 'network', group: 'Флот и спутники', desc: 'Сеть спутников в нескольких плоскостях, связанных лазерными линиями',
    params: [{id: 'radius', name: 'Высота', min: 1.05, max: 3, step: 0.01, value: 1.18}, {id: 'planes', name: 'Плоскостей', min: 1, max: 24, step: 1, value: 5}, {id: 'perPlane', name: 'Спутников в плоскости', min: 2, max: 40, step: 1, value: 10},
      {id: 'incl', name: 'Наклон плоскостей, °', min: 0, max: 90, step: 1, value: 55}, {id: 'links', name: 'Лазерные связи', min: 0, max: 1, step: 1, value: 1}, P.speed(0.4), P.color('#ffffff', 'Цвет спутников'), P.accent('#7fe3ff', 'Цвет связей')],
    build(it, ctx) {
      const NP = it.planes | 0, NS = it.perPlane | 0, n = NP * NS, inc = it.incl * D, pos = new Float32Array(n * 3);
      const sats = pts(Array.from(pos), it.color, 0.018, 1, false), g = new THREE.Group(); g.add(sats);
      // one fixed buffer for the links, updated in place
      let lines = null, LA = null;
      if (it.links) {
        LA = new Float32Array(n * (NP > 1 ? 2 : 1) * 6); const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(LA, 3).setUsage(THREE.DynamicDrawUsage));
        lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({color: it.accent, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false})); lines.frustumCulled = false; g.add(lines);
      }
      let ph = 0;
      const place = () => {
        const a = sats.geometry.attributes.position; let k = 0;
        for (let p = 0; p < NP; p++) { const node = p / NP * Math.PI * 2, cn = Math.cos(node), sn = Math.sin(node), ci = Math.cos(inc), si = Math.sin(inc);
          for (let s = 0; s < NS; s++) { const u = ph + s / NS * Math.PI * 2 + p * 0.3, cu = Math.cos(u), su = Math.sin(u);
            const x = (cn * cu - sn * ci * su) * it.radius, y = si * su * it.radius, z = (sn * cu + cn * ci * su) * it.radius; a.setXYZ(p * NS + s, x, y, z); } }
        a.needsUpdate = true;
        if (lines) {
          const A = a.array, seg = (i, j) => { LA[k++] = A[i * 3]; LA[k++] = A[i * 3 + 1]; LA[k++] = A[i * 3 + 2]; LA[k++] = A[j * 3]; LA[k++] = A[j * 3 + 1]; LA[k++] = A[j * 3 + 2]; };
          for (let p = 0; p < NP; p++) for (let s = 0; s < NS; s++) { const i = p * NS + s; seg(i, p * NS + (s + 1) % NS); if (NP > 1) seg(i, ((p + 1) % NP) * NS + s); }
          lines.geometry.attributes.position.needsUpdate = true;
        }
      };
      place();
      let acc = 0;
      g.userData.tick = (dt) => { ph += it.speed * 0.1 * dt / Math.pow(it.radius, 1.5); acc += dt; if (acc > 0.05) { acc = 0; place(); } };
      return g;
    }});
  reg({id: 'moonlet', name: 'Малая луна', icon: 'moon', group: 'Флот и спутники', desc: 'Небольшая луна в кратерах на своей орбите (на карте системы не появляется)',
    params: [P.radius(2.6), P.angle(200), P.size(0.12, 0.5), {id: 'craters', name: 'Кратеров', min: 0, max: 60, step: 1, value: 18}, P.tilt(5), P.node(), P.speed(0.2), {id: 'rot', name: 'Вращение', min: -1, max: 1, step: 0.05, value: 0.05}, P.color('#9a968e'), P.accent('#5f5b55', 'Цвет кратеров')],
    build(it, ctx) {
      const r = rndOf(it, 29), geo = new THREE.IcosahedronGeometry(1, 4), P2 = geo.attributes.position, cols = new Float32Array(P2.count * 3);
      const c1 = new THREE.Color(it.color), c2 = new THREE.Color(it.accent), t = new THREE.Color(), cr = [];
      for (let i = 0; i < (it.craters | 0); i++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); cr.push([Math.cos(a) * s, u, Math.sin(a) * s, 0.08 + r() * 0.25]); }
      const v = new THREE.Vector3();
      for (let i = 0; i < P2.count; i++) {
        v.set(P2.getX(i), P2.getY(i), P2.getZ(i)).normalize(); let dark = 0, h = 1;
        for (const [x, y, z, rad] of cr) { const d = Math.acos(Math.min(1, v.x * x + v.y * y + v.z * z)) / rad; if (d < 1) { dark = Math.max(dark, 1 - d); h -= 0.05 * (1 - d * d); } else if (d < 1.25) h += 0.02; }
        P2.setXYZ(i, v.x * h, v.y * h, v.z * h); t.copy(c1).lerp(c2, dark * 0.8); cols[i * 3] = t.r; cols[i * 3 + 1] = t.g; cols[i * 3 + 2] = t.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
      const b = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({vertexColors: true}));
      return orbiter(it, ctx, b, 0.05);
    }});

  // the space elevator stands on the ground: keep it turning with the planet (the orbit root does not)
  ss.hooks.on('frame', () => {
    const globe = ss.scene.globe; if (!globe) return;
    ss.scene.tiltGroup.traverse(o => { if (o.userData.followGlobe) o.quaternion.copy(globe.quaternion); });
  }, 6);
}
