// Megastructures: stations the size of a planet. Three generators:
//   «Корабль-планета»  — the globe is the middle hull; a bow, engines, wings and a bridge tower are 3D parts on it;
//   «Сфера-станция»    — plated sphere with trenches, districts, turrets, outer rings and polar spires;
//   «Бурб»             — a black sphere with glowing seams and a huge round port into the empty inside.
// The 3D parts live in the planet frame (turn with it) and are described by doc.meta.look.mega.
export function activate(ss, mod) {
  const {THREE} = ss, D = Math.PI / 180;

  // ---------- effects ----------
  const SEAM_COLORS = {red: [1.0, 0.13, 0.08], cyan: [0.5, 0.9, 1.0], amber: [1.0, 0.7, 0.28], green: [0.4, 1.0, 0.45], violet: [0.75, 0.45, 1.0], white: [1, 1, 1]};
  const v3 = (c) => `vec3(${c.map(x => x.toFixed(3)).join(',')})`;
  for (const [id, c] of Object.entries(SEAM_COLORS)) {
    // panel lines: planes of a 3D lattice cut by the sphere, big panels bright, small ones faint
    const body = (k) => `vec3 q1=nP*9.0,q2=nP*31.0;vec3 g1=abs(fract(q1)-0.5),g2=abs(fract(q2)-0.5);
      float l1=smoothstep(0.455,0.49,max(g1.x,max(g1.y,g1.z))),l2=smoothstep(0.465,0.495,max(g2.x,max(g2.y,g2.z)));
      float pulse=0.75+0.25*sin(uTime*1.7+dot(floor(q1),vec3(1.7,3.1,5.3)));
      diffuseColor.rgb*=1.0-0.35*l1;
      totalEmissiveRadiance+=${v3(c)}*(l1*${k}+l2*${(k * 0.15).toFixed(3)})*pulse;`;
    ss.reg.effects.register({id: 'seams-' + id, name: `Швы: ${id} (мод)`, glsl: body(0.45)});
  }
  // these two glow in the colour of the type itself, so one effect serves every colour (keeps the shader small)
  ss.reg.effects.register({id: 'seamline', name: 'Светящийся шов (мод)', glsl: `vec3 c0=diffuseColor.rgb;float p=0.7+0.3*sin(uTime*2.3+nP.x*30.0+nP.y*20.0);diffuseColor.rgb*=0.25;totalEmissiveRadiance+=c0*1.5*p;`});
  ss.reg.effects.register({id: 'voidglow', name: 'Пустота с отсветом (мод)', glsl: `vec3 c0=diffuseColor.rgb;diffuseColor.rgb=vec3(0.004);float b=0.55+0.45*sin(uTime*0.7);totalEmissiveRadiance+=c0*0.9*b;`});
  const SEAM_HEX = Object.fromEntries(Object.entries(SEAM_COLORS).map(([k, c]) => [k, '#' + new THREE.Color().setRGB(...c).getHexString()]));
  const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
  ss.reg.effects.register({id: 'thruster', name: 'Сопла двигателей (мод)', glsl: `float f=0.75+0.25*sin(uTime*23.0+nP.y*40.0)*sin(uTime*17.0);diffuseColor.rgb*=0.5;totalEmissiveRadiance+=vec3(0.45,0.75,1.0)*1.5*f;`});

  // ---------- building styles ----------
  ss.reg.buildings.register({id: 'mega-turrets', name: 'Турели мегаструктуры (мод)', build({rnd, spots, put}) {
    for (const [x, y] of spots(2 + Math.floor(rnd() * 3), 0.6, 0.35)) {
      const r = rnd() * 6.3; put('box', x, y, r, 0.22, 0.06, 0.22, '#5a606a'); put('cyl', x, y, 0, 0.14, 0.08, 0.14, '#6a727e', 0.06);
      put('box', x + Math.cos(r) * 0.12, y + Math.sin(r) * 0.12, r, 0.26, 0.025, 0.025, '#4a4f58', 0.1);
    }
  }});
  ss.reg.buildings.register({id: 'mega-antenna', name: 'Антенны мегаструктуры (мод)', build({rnd, spots, put}) {
    for (const [x, y] of spots(2 + Math.floor(rnd() * 2), 0.55, 0.35)) {
      const h = 0.5 + rnd() * 0.9; put('cyl', x, y, 0, 0.03, h, 0.03, '#c9d1dc'); put('dome', x, y, 0, 0.16, 0.06, 0.16, '#d8dee6', h * 0.6);
      put('glow', x, y, 0, 0.04, 0.04, 0.04, '#ff4a4a', h);
    }
  }});
  ss.reg.buildings.register({id: 'mega-blocks', name: 'Жилые блоки мегаструктуры (мод)', build({rnd, spots, put, pick}) {
    for (const [x, y] of spots(5 + Math.floor(rnd() * 4), 0.66, 0.2)) put('box', x, y, Math.round(rnd() * 4) * Math.PI / 4, 0.14, 0.08 + rnd() * 0.25, 0.14, pick(['#7f8a96', '#9aa4b2', '#5d6f82', '#b8c0cc']));
  }});

  // ---------- terrains (pack «mega») ----------
  const SCHEMES = {
    steel: {name: 'Стальной', hull: ['#9aa4b2', '#6a727e', '#454c56']},
    white: {name: 'Белый', hull: ['#e8ecf2', '#c9d1dc', '#9aa4b2']},
    dark: {name: 'Тёмный', hull: ['#4a4f58', '#30343b', '#1e2126']},
    bronze: {name: 'Бронзовый', hull: ['#b8955a', '#8a6a3e', '#5a4428']},
  };
  const terrains = [];
  for (const [sid, S] of Object.entries(SCHEMES)) for (const [cid] of Object.entries(SEAM_COLORS)) {
    const g = `Мегаструктура: ${S.name.toLowerCase()} корпус`;
    terrains.push(
      {id: `${sid}-${cid}-plate1`, group: g, name: `Обшивка светлая (${S.name}, ${cid})`, color: S.hull[0], h: 0.15, v: 0, fx: 'seams-' + cid, tex: 'plates'},
      {id: `${sid}-${cid}-plate2`, group: g, name: `Обшивка (${S.name}, ${cid})`, color: S.hull[1], h: 0.1, v: 0, fx: 'seams-' + cid, tex: 'plates'},
      {id: `${sid}-${cid}-plate3`, group: g, name: `Обшивка тёмная (${S.name}, ${cid})`, color: S.hull[2], h: 0.05, v: 0, fx: 'seams-' + cid, tex: 'plates'},
      {id: `${sid}-${cid}-trench`, group: g, name: `Траншея (${S.name}, ${cid})`, color: shade(SEAM_HEX[cid], 0.35), h: -1.4, v: 0, fx: 'seamline', tex: 'circuit'},
      {id: `${sid}-${cid}-dock`, group: g, name: `Док (${S.name}, ${cid})`, color: shade(SEAM_HEX[cid], 0.12), h: -0.8, v: 0, fx: 'voidglow', tex: 'plates'},
    );
  }
  terrains.push(
    {id: 'district', group: 'Мегаструктура: модули', name: 'Жилой сектор', color: '#5d6f82', h: 0.3, v: 0.1, tex: 'city', bld: 'mega-blocks'},
    {id: 'turrets', group: 'Мегаструктура: модули', name: 'Батарея турелей', color: '#4a4f58', h: 0.2, v: 0, tex: 'plates', bld: 'mega-turrets'},
    {id: 'antenna', group: 'Мегаструктура: модули', name: 'Антенное поле', color: '#6a727e', h: 0.2, v: 0, tex: 'plates', bld: 'mega-antenna'},
    {id: 'engine', group: 'Мегаструктура: модули', name: 'Дюзы двигателей', color: '#2a2f3a', h: -0.5, v: 0, fx: 'thruster', tex: 'plates'},
  );
  // the Burb: black armour, glowing seams, a port into emptiness
  const ARMOR = {black: ['#0b0c0e', '#121316'], graphite: ['#1c1e22', '#26292e'], blood: ['#1a0a0a', '#240e0e']};
  for (const [aid, A] of Object.entries(ARMOR)) for (const [cid] of Object.entries(SEAM_COLORS)) terrains.push(
    {id: `burb-${aid}-${cid}-armor`, group: 'Бурб', name: `Броня Бурба (${aid}, ${cid})`, color: A[0], h: 0.12, v: 0, fx: 'seams-' + cid, tex: 'plates'},
    {id: `burb-${aid}-${cid}-armor2`, group: 'Бурб', name: `Броня Бурба, плиты (${aid}, ${cid})`, color: A[1], h: 0.18, v: 0.02, fx: 'seams-' + cid, tex: 'plates'},
    {id: `burb-${aid}-${cid}-seam`, group: 'Бурб', name: `Шов Бурба (${aid}, ${cid})`, color: shade(SEAM_HEX[cid], 0.8), h: -0.25, v: 0, fx: 'seamline', tex: ''},
    {id: `burb-${aid}-${cid}-rim`, group: 'Бурб', name: `Кромка порта (${aid}, ${cid})`, color: shade(SEAM_HEX[cid], 0.55), h: 0.45, v: 0, fx: 'seamline', tex: 'plates'},
    {id: `burb-${aid}-${cid}-void`, group: 'Бурб', name: `Пустота порта (${aid}, ${cid})`, color: shade(SEAM_HEX[cid], 0.06), h: -3, v: 0, fx: 'voidglow', tex: ''},
  );
  ss.registerPack({format: 'sspace-pack', id: 'mega', name: 'Мегаструктуры', version: '1.0.0', terrains,
    poiKinds: [{id: 'port', sym: '◉', name: 'Порт', color: '#ff3a2a'}, {id: 'bridge', sym: '⌂', name: 'Мостик', color: '#7fe3ff'}]}, 'мод ' + mod.id);

  // ---------- 3D parts in the planet frame ----------
  const parts = new THREE.Group(); parts.name = 'megastructure';
  let attached = false;
  const lambert = (c, e = 0x0d1014) => new THREE.MeshLambertMaterial({color: c, emissive: e});
  const glow = (c, o = 1, add = true) => new THREE.MeshBasicMaterial({color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide});
  const seamRGB = (id) => new THREE.Color().setRGB(...(SEAM_COLORS[id] || SEAM_COLORS.red));
  let anims = [];
  function clear() { parts.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); parts.clear(); anims = []; }
  // rebuilt only when its own settings change: switching an effect or tuning the orbit must not rebuild (and jerk) it
  let lastKey = null;
  function rebuild(ev) {
    const L0 = ss.doc && ss.doc.meta && ss.doc.meta.look && ss.doc.meta.look.mega;
    const key = JSON.stringify(L0 || null) + '|' + (ss.space && ss.space.nav.level) + '|' + (ss.doc ? ss.doc.n : '');
    if (ev === 'look' && key === lastKey) return;
    lastKey = key;
    clear();
    if (!attached && ss.scene.globe) { ss.scene.globe.add(parts); attached = true; }
    const L = ss.doc && ss.doc.meta && ss.doc.meta.look && ss.doc.meta.look.mega;
    parts.visible = !!(L && ss.space && ss.space.nav.level === 'planet');
    if (!L) return;
    if (L.type === 'ship') buildShip(L); else if (L.type === 'sphere') buildSphere(L); else if (L.type === 'burb') buildBurb(L);
  }
  function buildShip(L) {
    const hull = lambert(L.hull), dark = lambert(L.dark), accent = seamRGB(L.seam);
    // bow: a long faceted wedge in front (+X)
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.72, L.bow, 6, 1), hull); bow.rotation.z = -Math.PI / 2; bow.position.x = 0.55 + L.bow / 2; bow.scale.set(1, 1, 0.55); parts.add(bow);
    const keel = new THREE.Mesh(new THREE.BoxGeometry(L.bow * 0.9, 0.08, 0.5), dark); keel.position.set(0.6 + L.bow * 0.42, -0.28, 0); parts.add(keel);
    // lights along the bow
    const lp = []; for (let i = 0; i < 60; i++) { const t = i / 60; lp.push(0.7 + t * L.bow * 0.9, 0.36 * (1 - t), (i % 2 ? 1 : -1) * 0.38 * (1 - t)); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    parts.add(new THREE.Points(lg, new THREE.PointsMaterial({color: accent, size: 0.02, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending})));
    // engine block (-X): a cluster of nozzles with glowing exhaust
    const n = L.engines, rows = Math.ceil(Math.sqrt(n)), es = 0.9 / rows;
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.15, 1.15), dark); block.position.x = -1.05; parts.add(block);
    for (let i = 0; i < n; i++) {
      const y = (Math.floor(i / rows) - (rows - 1) / 2) * es * 1.15, z = ((i % rows) - (rows - 1) / 2) * es * 1.15;
      const noz = new THREE.Mesh(new THREE.CylinderGeometry(es * 0.38, es * 0.5, 0.35, 16, 1, true), hull); noz.rotation.z = Math.PI / 2; noz.position.set(-1.45, y, z); parts.add(noz);
      const fire = new THREE.Mesh(new THREE.ConeGeometry(es * 0.42, 0.9 * L.flame, 16, 1, true), glow('#7fc8ff', 0.55)); fire.rotation.z = Math.PI / 2; fire.position.set(-1.62 - 0.45 * L.flame, y, z); parts.add(fire);
      anims.push((t) => { fire.scale.y = 0.85 + 0.15 * Math.sin(t * 30 + i); fire.material.opacity = 0.45 + 0.15 * Math.sin(t * 23 + i * 2); });
    }
    // wings
    if (L.wings) for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 1.3), hull); w.position.set(-0.4, -0.1, s * 1.35); w.rotation.y = s * 0.35; parts.add(w);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.05), dark); tip.position.set(-0.75, 0.05, s * 1.95); parts.add(tip);
      const nav = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), glow(s > 0 ? '#3aff6a' : '#ff3a3a', 1, false)); nav.position.set(-0.6, 0, s * 2.0); parts.add(nav);
    }
    // bridge tower on top (+Y)
    if (L.tower) {
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.25, 0.3), hull); b1.position.set(-0.3, 1.05, 0); parts.add(b1);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.55), dark); b2.position.set(-0.3, 1.24, 0); parts.add(b2);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.03, 0.56), glow(accent, 0.9)); win.position.set(-0.3, 1.26, 0); parts.add(win);
      for (const s of [-1, 1]) { const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.35, 4), hull); ant.position.set(-0.4, 1.45, s * 0.12); parts.add(ant); }
    }
  }
  function buildSphere(L) {
    const hull = lambert(L.hull), accent = seamRGB(L.seam);
    for (let i = 0; i < L.rings; i++) {
      const r = 1.25 + i * 0.18, ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025 + 0.01 * (L.rings - i), 8, 128), hull);
      ring.rotation.x = Math.PI / 2 + (i % 2 ? 0.08 : -0.08) * i; parts.add(ring);
      const lp = []; for (let k = 0; k < 120; k++) { const a = k / 120 * Math.PI * 2; lp.push(Math.cos(a) * r, 0.03, Math.sin(a) * r); }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
      const pts = new THREE.Points(lg, new THREE.PointsMaterial({color: accent, size: 0.015, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending})); pts.rotation.copy(ring.rotation); pts.rotation.x -= Math.PI / 2; parts.add(pts);
      // struts from the sphere to the ring
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + i, st = new THREE.Mesh(new THREE.BoxGeometry(r - 1, 0.02, 0.02), hull); st.position.set(Math.cos(a) * (1 + (r - 1) / 2), 0, Math.sin(a) * (1 + (r - 1) / 2)); st.rotation.y = -a; parts.add(st); }
    }
    if (L.spires) for (const s of [-1, 1]) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 8), hull); sp.position.y = s * 1.3; if (s < 0) sp.rotation.x = Math.PI; parts.add(sp);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), glow(accent, 1)); tip.position.y = s * 1.66; parts.add(tip);
      anims.push((t) => { tip.material.opacity = 0.5 + 0.5 * Math.sin(t * 2 + s); });
    }
  }
  function buildBurb(L) {
    const accent = seamRGB(L.seam);
    for (const p of L.ports || []) {
      const dir = new THREE.Vector3(...p.dir).normalize(), a = p.ang, q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const g = new THREE.Group(); g.quaternion.copy(q); parts.add(g);
      // the empty inside: a black disc deep in the hole, so you look into nothing
      const voidDisc = new THREE.Mesh(new THREE.CircleGeometry(Math.sin(a) * 1.02, 64), new THREE.MeshBasicMaterial({color: 0x000000, side: THREE.DoubleSide}));
      voidDisc.rotation.x = -Math.PI / 2; voidDisc.position.y = Math.cos(a) * 0.82; g.add(voidDisc);
      if (L.innerGlow) { const ig = new THREE.Mesh(new THREE.CircleGeometry(Math.sin(a) * 0.9, 64), glow(accent, 0.12)); ig.rotation.x = -Math.PI / 2; ig.position.y = Math.cos(a) * 0.82 + 0.002; g.add(ig); anims.push((t) => { ig.material.opacity = 0.06 + 0.08 * (0.5 + 0.5 * Math.sin(t * 0.9)); }); }
      // glowing rim, and lights around it
      if (L.rim) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(Math.sin(a) * 1.04, 0.006 + a * 0.012, 8, 96), glow(accent, 0.95)); rim.rotation.x = Math.PI / 2; rim.position.y = Math.cos(a) * 1.04; g.add(rim);
        const lp = []; for (let k = 0; k < 64; k++) { const t = k / 64 * Math.PI * 2, r = Math.sin(a) * 1.09; lp.push(Math.cos(t) * r, Math.cos(a) * 1.06, Math.sin(t) * r); }
        const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
        const pts = new THREE.Points(lg, new THREE.PointsMaterial({color: accent, size: 0.025, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending})); g.add(pts);
        if (L.pulse) anims.push((t) => { rim.material.opacity = 0.65 + 0.35 * Math.sin(t * 1.8); pts.material.opacity = 0.5 + 0.5 * Math.sin(t * 1.8 + 1); });
      }
    }
  }
  for (const e of ['doc:loaded', 'level:changed', 'view:installed']) ss.hooks.on(e, () => rebuild());
  ss.hooks.on('look:changed', () => rebuild('look'));
  ss.hooks.on('frame', ({t}) => { if (parts.visible && ss.prefs.anim) for (const f of anims) f(t); }, 6);

  // ---------- generators ----------
  const seamOpts = [{value: 'red', label: 'Красные'}, {value: 'cyan', label: 'Голубые'}, {value: 'amber', label: 'Янтарные'}, {value: 'green', label: 'Зелёные'}, {value: 'violet', label: 'Фиолетовые'}, {value: 'white', label: 'Белые'}];
  const schemeOpts = Object.entries(SCHEMES).map(([v, s]) => ({value: v, label: s.name}));
  const at = (G, c) => [G.centers[c * 3], G.centers[c * 3 + 1], G.centers[c * 3 + 2]];
  const hullTypes = (type, sch, seam) => ({p1: type(`mega:${sch}-${seam}-plate1`), p2: type(`mega:${sch}-${seam}-plate2`), p3: type(`mega:${sch}-${seam}-plate3`), trench: type(`mega:${sch}-${seam}-trench`), dock: type(`mega:${sch}-${seam}-dock`)});
  // patchwork of plates: big panels of three shades
  const plating = (G, util, seed, H, out) => { const nz = util.makeNoise(seed); for (let c = 0; c < G.V; c++) { const [x, y, z] = at(G, c), v = nz(x * 3 + 5, y * 3 + 5, z * 3 + 5, 2); out[c] = v < 0.42 ? H.p3 : v < 0.58 ? H.p2 : H.p1; } };
  const sprinkle = (G, rnd, out, t, share, ok = () => true) => { const n = Math.round(G.V * share); for (let i = 0; i < n; i++) { const c = Math.floor(rnd() * G.V); if (ok(c)) out[c] = t; } };
  const commonExtras = [
    {id: 'districts', name: 'Жилых секторов', min: 0, max: 40, value: 8, unit: '%', section: 'Начинка'},
    {id: 'turrets', name: 'Турелей', min: 0, max: 30, value: 5, unit: '%', section: 'Начинка'},
    {id: 'antennas', name: 'Антенных полей', min: 0, max: 20, value: 2, unit: '%', section: 'Начинка'},
    {id: 'docks', name: 'Доков', min: 0, max: 30, value: 6, section: 'Начинка'},
    {id: 'still', name: 'Не вращать (станция не крутится как планета)', type: 'check', value: true, section: 'Вид'},
  ];
  const fillModules = (G, rnd, util, seed, P, out, T, H, k) => {
    const nz = util.makeNoise(seed + 9);
    for (let c = 0; c < G.V; c++) { const [x, y, z] = at(G, c); if (out[c] === H.trench) continue; if (nz(x * 4, y * 4, z * 4, 2) > 1 - P.districts / 100 * 1.6) out[c] = T.district; }
    sprinkle(G, rnd, out, T.turrets, P.turrets / 100 * 0.25, (c) => out[c] !== H.trench);
    sprinkle(G, rnd, out, T.antenna, P.antennas / 100 * 0.25, (c) => out[c] !== H.trench);
    for (let i = 0; i < P.docks; i++) { const c0 = Math.floor(rnd() * G.V), R = Math.max(1, Math.round(k)); const q = [c0], seen = new Set(q); for (let j = 0; j < q.length; j++) { const c = q[j]; out[c] = H.dock; if (seen.size < 3 * R * R + 1) for (const nb of G.nbr[c]) if (!seen.has(nb)) { seen.add(nb); q.push(nb); } } }
  };
  const mods = (type) => ({district: type('mega:district'), turrets: type('mega:turrets'), antenna: type('mega:antenna'), engine: type('mega:engine')});

  ss.reg.generators.register({
    id: 'mega-ship', name: 'Корабль-планета (мод)', icon: 'rocket', group: 'Мегаструктуры',
    desc: 'Станция размером с планету в форме корабля: шар — середина корпуса, нос, двигатели, крылья и мостик.',
    preview: ['#9aa4b2', '#6a727e', '#14171c', '#7fe3ff', '#2a2f3a'], atmosphere: {on: false},
    params: [
      {id: 'scheme', name: 'Корпус', type: 'select', options: schemeOpts, value: 'steel'},
      {id: 'seam', name: 'Огни и швы', type: 'select', options: seamOpts, value: 'cyan'},
      {id: 'bow', name: 'Длина носа', min: 0.6, max: 3, step: 0.1, value: 1.8},
      {id: 'engines', name: 'Двигателей', min: 1, max: 16, value: 6},
      {id: 'flame', name: 'Длина выхлопа', min: 0, max: 3, step: 0.1, value: 1},
      {id: 'trenches', name: 'Траншей поперёк корпуса', min: 0, max: 8, value: 3},
      {id: 'wings', name: 'Крылья', type: 'check', value: true, section: 'Вид'},
      {id: 'tower', name: 'Мостик', type: 'check', value: true, section: 'Вид'},
      ...commonExtras,
    ],
    run({G, seed, params: P, type, util, look, preview}) {
      const rnd = util.mulberry(seed), H = hullTypes(type, P.scheme, P.seam), T = mods(type), out = new Uint8Array(G.V), k = Math.max(1, (G.n || 10) / 10);
      plating(G, util, seed, H, out);
      const cellAng = Math.sqrt(4 * Math.PI / G.V);
      for (let i = 0; i < P.trenches; i++) { const x0 = -0.6 + (P.trenches > 1 ? i / (P.trenches - 1) : 0.5) * 1.3; for (let c = 0; c < G.V; c++) if (Math.abs(G.centers[c * 3] - x0) < cellAng * 0.55) out[c] = H.trench; }
      // a spine trench along the hull
      for (let c = 0; c < G.V; c++) if (Math.abs(G.centers[c * 3 + 2]) < cellAng * 0.5 && G.centers[c * 3 + 1] > 0) out[c] = H.trench;
      fillModules(G, rnd, util, seed, P, out, T, H, k);
      for (let c = 0; c < G.V; c++) if (G.centers[c * 3] < -0.93) out[c] = T.engine;
      const S = SCHEMES[P.scheme] || SCHEMES.steel;
      look({mega: {type: 'ship', hull: S.hull[0], dark: S.hull[2], seam: P.seam, bow: P.bow, engines: P.engines | 0, flame: P.flame, wings: !!P.wings, tower: !!P.tower, still: !!P.still}});
      return out;
    },
  });

  ss.reg.generators.register({
    id: 'mega-sphere', name: 'Сфера-станция (мод)', icon: 'station', group: 'Мегаструктуры',
    desc: 'Сфера в бронеплитах: экваториальная траншея, жилые сектора, турели, внешние кольца и полярные шпили.',
    preview: ['#c9d1dc', '#9aa4b2', '#14171c', '#ffb347', '#5d6f82'], atmosphere: {on: false},
    params: [
      {id: 'scheme', name: 'Корпус', type: 'select', options: schemeOpts, value: 'white'},
      {id: 'seam', name: 'Огни и швы', type: 'select', options: seamOpts, value: 'amber'},
      {id: 'trench', name: 'Ширина экваториальной траншеи', min: 0, max: 6, value: 2},
      {id: 'bands', name: 'Траншей по широтам', min: 0, max: 8, value: 2},
      {id: 'meridians', name: 'Траншей по меридианам', min: 0, max: 12, value: 4},
      {id: 'rings', name: 'Внешних колец', min: 0, max: 4, value: 2},
      {id: 'spires', name: 'Полярные шпили', type: 'check', value: true, section: 'Вид'},
      ...commonExtras,
    ],
    run({G, seed, params: P, type, util, look}) {
      const rnd = util.mulberry(seed), H = hullTypes(type, P.scheme, P.seam), T = mods(type), out = new Uint8Array(G.V), k = Math.max(1, (G.n || 10) / 10);
      plating(G, util, seed, H, out);
      const cellAng = Math.sqrt(4 * Math.PI / G.V);
      for (let c = 0; c < G.V; c++) {
        const [x, y, z] = at(G, c), lat = Math.asin(Math.max(-1, Math.min(1, y))), lon = Math.atan2(z, x);
        if (P.trench > 0 && Math.abs(lat) < cellAng * (P.trench * k * 0.5 + 0.2)) out[c] = H.trench;
        for (let b = 1; b <= P.bands; b++) { const l0 = (b / (P.bands + 1)) * Math.PI / 2 * 0.95; if (Math.abs(Math.abs(lat) - l0) < cellAng * 0.5) out[c] = H.trench; }
        if (P.meridians > 0 && Math.abs(lat) < 1.3) { const step = Math.PI * 2 / P.meridians, d = Math.abs(((lon % step) + step) % step - step / 2) - step / 2; if (Math.abs(d) * Math.cos(lat) < cellAng * 0.45) out[c] = H.trench; }
      }
      fillModules(G, rnd, util, seed, P, out, T, H, k);
      const S = SCHEMES[P.scheme] || SCHEMES.steel;
      look({mega: {type: 'sphere', hull: S.hull[1], seam: P.seam, rings: P.rings | 0, spires: !!P.spires, still: !!P.still}});
      return out;
    },
  });

  ss.reg.generators.register({
    id: 'burb', name: 'Бурб (мод)', icon: 'burb', group: 'Мегаструктуры',
    desc: 'Чёрный шар смерти: броня, светящиеся по швам линии и огромный круглый порт-вход в пустоту внутри.',
    preview: ['#0b0c0e', '#121316', '#ff2a1a', '#000000', '#200606'], atmosphere: {on: false},
    params: [
      {id: 'portSize', name: 'Размер главного порта', min: 1, max: 14, value: 4},
      {id: 'portLat', name: 'Порт: широта, °', min: -80, max: 80, value: 20},
      {id: 'portLon', name: 'Порт: долгота, °', min: 0, max: 360, value: 0},
      {id: 'extra', name: 'Малых портов', min: 0, max: 10, value: 0},
      {id: 'extraSize', name: 'Размер малых портов', min: 1, max: 6, value: 2},
      {id: 'seam', name: 'Цвет швов', type: 'select', options: seamOpts, value: 'red', section: 'Швы'},
      {id: 'armor', name: 'Броня', type: 'select', options: [{value: 'black', label: 'Чёрная'}, {value: 'graphite', label: 'Графитовая'}, {value: 'blood', label: 'Кроваво-чёрная'}], value: 'black', section: 'Швы'},
      {id: 'lines', name: 'Швов по широтам', min: 0, max: 16, value: 6, section: 'Швы'},
      {id: 'meridians', name: 'Швов по меридианам', min: 0, max: 24, value: 8, section: 'Швы'},
      {id: 'rim', name: 'Светящаяся кромка порта', type: 'check', value: true, section: 'Вид'},
      {id: 'pulse', name: 'Пульсация света', type: 'check', value: true, section: 'Вид'},
      {id: 'innerGlow', name: 'Отсвет из глубины порта', type: 'check', value: true, section: 'Вид'},
      {id: 'still', name: 'Не вращать', type: 'check', value: true, section: 'Вид'},
      {id: 'turrets', name: 'Турелей (обычно пусто)', min: 0, max: 30, value: 0, unit: '%', section: 'Начинка'},
      {id: 'marks', name: 'Метки портов', type: 'check', value: true, section: 'Начинка'},
    ],
    run({G, seed, params: P, type, util, look, preview}) {
      const rnd = util.mulberry(seed), id = (s) => type(`mega:burb-${P.armor}-${P.seam}-${s}`);
      const T = {a1: id('armor'), a2: id('armor2'), seam: id('seam'), rim: id('rim'), void: id('void'), turrets: type('mega:turrets')};
      const out = new Uint8Array(G.V), nz = util.makeNoise(seed), cellAng = Math.sqrt(4 * Math.PI / G.V), k = Math.max(1, (G.n || 10) / 10);
      for (let c = 0; c < G.V; c++) {
        const [x, y, z] = at(G, c); out[c] = nz(x * 3 + 2, y * 3 + 2, z * 3 + 2, 2) < 0.5 ? T.a1 : T.a2;
        const lat = Math.asin(Math.max(-1, Math.min(1, y))), lon = Math.atan2(z, x);
        for (let b = 1; b <= P.lines; b++) { const l0 = -Math.PI / 2 + b / (P.lines + 1) * Math.PI; if (Math.abs(lat - l0) < cellAng * 0.5) out[c] = T.seam; }
        if (P.meridians > 0 && Math.abs(lat) < 1.35) { const step = Math.PI * 2 / P.meridians, d = Math.abs(((lon % step) + step) % step - step / 2) - step / 2; if (Math.abs(d) * Math.cos(lat) < cellAng * 0.45) out[c] = T.seam; }
      }
      if (P.turrets > 0) sprinkle(G, rnd, out, T.turrets, P.turrets / 100 * 0.2, (c) => out[c] !== T.seam);
      // ports: a disc of emptiness and a raised glowing rim
      const ports = [], marks = [];
      const port = (lat, lon, size) => {
        const dir = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)], ang = cellAng * size * k * 0.6 + cellAng * 0.6;
        let best = -1, bd = -2;
        for (let c = 0; c < G.V; c++) {
          const d = G.centers[c * 3] * dir[0] + G.centers[c * 3 + 1] * dir[1] + G.centers[c * 3 + 2] * dir[2]; if (d > bd) { bd = d; best = c; }
          const a = Math.acos(Math.max(-1, Math.min(1, d)));
          if (a < ang) out[c] = T.void; else if (a < ang + cellAng * 1.1) out[c] = T.rim;
        }
        ports.push({dir, ang}); marks.push(best);
      };
      port(P.portLat * D, P.portLon * D, P.portSize);
      // small ports keep clear of the others
      const angOf = (size) => cellAng * size * k * 0.6 + cellAng * 0.6;
      for (let i = 0; i < P.extra; i++) {
        for (let t = 0; t < 60; t++) {
          const lat = (rnd() * 2 - 1) * 1.2, lon = rnd() * Math.PI * 2, d = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)], me = angOf(P.extraSize);
          if (ports.every(p => Math.acos(Math.max(-1, Math.min(1, p.dir[0] * d[0] + p.dir[1] * d[1] + p.dir[2] * d[2]))) > p.ang + me + cellAng * 3)) { port(lat, lon, P.extraSize); break; }
        }
      }
      look({mega: {type: 'burb', seam: P.seam, ports, rim: !!P.rim, pulse: !!P.pulse, innerGlow: !!P.innerGlow, still: !!P.still}, megaMarks: P.marks && !preview ? marks : null});
      return out;
    },
  });

  // after a generation: stop the day spin if asked, and mark the ports / the bridge
  ss.hooks.on('generate:done', (gen) => {
    const L = ss.doc && ss.doc.meta && ss.doc.meta.look;
    const mega = L && L.mega;
    if (mega && mega.still && ss.sky && !ss.doc.sky.paused) ss.sky.togglePause();
    if (!ss.doc || !Array.isArray(ss.doc.pois)) return;
    const had = ss.doc.pois.some(p => p.kind === 'mega:port');
    ss.doc.pois = ss.doc.pois.filter(p => p.kind !== 'mega:port');
    const marks = mega && L.megaMarks;
    if (Array.isArray(marks)) marks.forEach((c, i) => ss.doc.pois.push({c, kind: 'mega:port', name: i ? 'Малый порт ' + i : 'Главный порт', note: ''}));
    if (had || (marks && marks.length)) { ss.docChanged({layer: 'pois'}); ss.pois && ss.pois.rebuild(); }
  });
}
