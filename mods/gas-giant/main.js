// Gas giant: a planet of cloud bands. Several colour schemes (Jupiter, Saturn, ice giant, hot Jupiter, toxic),
// band count and turbulence, oval storms, polar vortices, rings (through the «Орбита» mod) and cloud haze.
export function activate(ss, mod) {
  // ---------- effects: smooth flowing sub-bands over the cells, and stronger swirls for storms ----------
  ss.reg.effects.register({
    id: 'gasbands', name: 'Газ: текущие полосы (мод)',
    glsl: `float lat=nP.y;float sw=fbm3(vec3(nP.x*2.2+uTime*0.025,lat*7.0,nP.z*2.2-uTime*0.02));
      float b=sin(lat*62.0+sw*8.0+uTime*0.03)*0.5+0.5;float fine=fbm3(vec3(nP.x*9.0+uTime*0.05,lat*40.0,nP.z*9.0));
      diffuseColor.rgb*=0.84+0.2*b+0.12*(fine-0.5);
      // the scene's fill light is bluish: give the gas its own glow so pale bands keep their hue
      vec3 own=diffuseColor.rgb;float day=smoothstep(-0.25,0.35,sunDot);diffuseColor.rgb*=0.55;
      float fres=pow(1.0-abs(normalize(vNv).z),2.5);totalEmissiveRadiance+=own*(0.12+0.38*day+0.15*fres);`,
  });
  ss.reg.effects.register({
    id: 'gasstorm', name: 'Газ: вихрь шторма (мод)',
    glsl: `vec3 q=nP*16.0;float a=uTime*0.12;mat2 R=mat2(cos(a),-sin(a),sin(a),cos(a));q.xz=R*q.xz;
      float s=fbm3(q+fbm3(q*0.5)*3.0);diffuseColor.rgb*=0.75+0.5*s;
      float day=smoothstep(-0.25,0.35,sunDot);totalEmissiveRadiance+=diffuseColor.rgb*(0.1+0.35*day)+vec3(1.0)*pow(max(0.0,s-0.6),3.0)*0.6;`,
  });

  // ---------- colour schemes: every scheme gives 6 cloud types ----------
  const ROLES = [
    {id: 'light', name: 'Светлая полоса'}, {id: 'mid', name: 'Средняя полоса'}, {id: 'dark', name: 'Тёмный пояс'},
    {id: 'deep', name: 'Глубинный пояс'}, {id: 'white', name: 'Белые облака'}, {id: 'storm', name: 'Шторм'},
  ];
  const SCHEMES = [
    {id: 'jupiter', name: 'Юпитер', atmo: '#ffd9a8', cols: ['#e8d8b8', '#c9a27a', '#a8643a', '#7a4a2e', '#f4efe4', '#c0503a']},
    {id: 'saturn', name: 'Сатурн', atmo: '#ffeab0', cols: ['#eadcae', '#d9c48a', '#c8ac6a', '#b8955a', '#f2ead0', '#e0b870']},
    {id: 'ice', name: 'Ледяной гигант', atmo: '#9fd8ff', cols: ['#9fd0ff', '#6aa8e8', '#3a6ac8', '#2a4a9a', '#d8ecff', '#1a2a6a']},
    {id: 'hot', name: 'Горячий юпитер', atmo: '#ff9a5a', cols: ['#ffb070', '#e06a2a', '#a8301a', '#5a1a14', '#ffd8a0', '#ffe8b0']},
    {id: 'toxic', name: 'Ядовитый', atmo: '#c8f07a', cols: ['#c8e07a', '#9ab84a', '#6a8a3a', '#4a5a2a', '#eef4b8', '#e8d84a']},
    {id: 'violet', name: 'Аметистовый', atmo: '#d0a8ff', cols: ['#d8c0f0', '#a888d8', '#7a58b8', '#4a3080', '#f0e8ff', '#ff8ad8']},
  ];
  const terrains = [];
  for (const S of SCHEMES) ROLES.forEach((R, i) => terrains.push({
    id: S.id + '-' + R.id, group: 'Газовый гигант: ' + S.name, name: `${R.name} (${S.name})`, color: S.cols[i],
    h: 0, v: 0, fx: R.id === 'storm' ? 'gasstorm' : 'gasbands', tex: '',
  }));
  ss.registerPack({format: 'sspace-pack', id: 'gas', name: 'Газовые гиганты', version: '1.0.0', terrains,
    poiKinds: [{id: 'storm', sym: '🌀', name: 'Великий шторм', color: '#ff8a5a'}]}, 'мод ' + mod.id);

  // ---------- generator ----------
  ss.reg.generators.register({
    id: 'gas-giant', name: 'Газовый гигант (мод)', icon: 'planet', group: 'Газовые гиганты',
    desc: 'Полосы облаков, вихри и великие штормы, полярные циклоны, кольца. Шесть расцветок.',
    preview: ['#e8d8b8', '#c9a27a', '#a8643a', '#f4efe4', '#c0503a'],
    atmosphere: {on: true, color: '#ffd9a8'},
    params: [
      {id: 'scheme', name: 'Расцветка', type: 'select', value: 'jupiter', options: [...SCHEMES.map(s => ({value: s.id, label: s.name})), {value: 'random', label: 'Случайная'}]},
      {id: 'bands', name: 'Полос', min: 3, max: 30, value: 12},
      {id: 'turb', name: 'Завихрения полос', min: 0, max: 100, value: 45, unit: '%'},
      {id: 'storms', name: 'Штормов', min: 0, max: 12, value: 3},
      {id: 'stormSize', name: 'Размер штормов', min: 1, max: 6, value: 3},
      {id: 'rings', name: 'Кольца', type: 'select', value: 'auto', options: [
        {value: 'auto', label: 'По расцветке (у Сатурна — широкие)'}, {value: 'none', label: 'Нет'}, {value: 'thin', label: 'Тонкие'}, {value: 'wide', label: 'Широкие'}]},
      {id: 'poles', name: 'Полярные циклоны', type: 'check', value: true, section: 'Детали'},
      {id: 'haze', name: 'Облачная дымка', type: 'check', value: true, section: 'Детали'},
      {id: 'marks', name: 'Метки великих штормов', type: 'check', value: true, section: 'Детали'},
    ],
    run({G, seed, params: P, type, util, atmosphere, look, preview}) {
      const rnd = util.mulberry(seed), turb = util.makeNoise(seed), fine = util.makeNoise(seed + 5);
      const S = P.scheme === 'random' ? SCHEMES[Math.floor(rnd() * SCHEMES.length)] : (SCHEMES.find(s => s.id === P.scheme) || SCHEMES[0]);
      const T = Object.fromEntries(ROLES.map(R => [R.id, type(`gas:${S.id}-${R.id}`)]));
      atmosphere({on: true, color: S.atmo});
      // a band pattern for this seed: light zones and dark belts alternate, with a few odd ones
      const pattern = [];
      for (let i = 0; i < P.bands; i++) {
        const base = i % 2 ? (rnd() < 0.3 ? 'deep' : 'dark') : (rnd() < 0.25 ? 'white' : 'light');
        pattern.push(rnd() < 0.2 ? 'mid' : base);
      }
      const k = Math.max(1, (G.n || 10) / 10), tu = P.turb / 100;
      const out = new Uint8Array(G.V);
      for (let c = 0; c < G.V; c++) {
        const x = G.centers[c * 3], y = G.centers[c * 3 + 1], z = G.centers[c * 3 + 2];
        // latitude, bent by turbulence (stronger near band edges)
        const w = (turb(x * 2.4 + 9, y * 6 + 9, z * 2.4 + 9, 4) - 0.5) * tu * 0.35 + (fine(x * 7 + 3, y * 14 + 3, z * 7 + 3, 2) - 0.5) * tu * 0.08;
        const t = Math.min(0.9999, Math.max(0, (y + w + 1) / 2));
        out[c] = T[pattern[Math.floor(t * P.bands)]];
      }
      // polar cyclones: a dark ring and a storm eye at each pole
      if (P.poles) for (let c = 0; c < G.V; c++) {
        const y = Math.abs(G.centers[c * 3 + 1]);
        if (y > 0.985) out[c] = T.storm; else if (y > 0.955) out[c] = T.deep;
      }
      // great storms: ovals stretched along the bands, a light rim around a dark core
      const cellAng = Math.sqrt(4 * Math.PI / G.V), marks = [];
      for (let i = 0; i < P.storms; i++) {
        const lat = (rnd() * 2 - 1) * 0.7, lon = rnd() * Math.PI * 2, cl = Math.sqrt(1 - lat * lat);
        const cx = Math.cos(lon) * cl, cy = lat, cz = Math.sin(lon) * cl;
        const R = cellAng * P.stormSize * k * (0.7 + rnd() * 0.7);
        let best = -1, bd = -2;
        for (let c = 0; c < G.V; c++) {
          const x = G.centers[c * 3], y = G.centers[c * 3 + 1], z = G.centers[c * 3 + 2];
          const dot = x * cx + y * cy + z * cz; if (dot > bd) { bd = dot; best = c; }
          if (dot < Math.cos(R * 2.2)) continue;
          // distance on the sphere, latitude counted twice → an oval along the bands
          const dLat = (y - cy) * 2.1, dLon = Math.acos(Math.max(-1, Math.min(1, (x * cx + z * cz) / Math.max(1e-6, Math.hypot(x, z) * cl)))) * Math.max(0.2, cl);
          const d = Math.hypot(dLat, dLon) / R;
          if (d < 0.6) out[c] = T.storm; else if (d < 1) out[c] = T.white;
        }
        if (best >= 0) marks.push(best);
      }
      // rings through the «Орбита» mod
      const ringMode = P.rings === 'auto' ? (S.id === 'saturn' ? 'wide' : 'none') : P.rings;
      const ring = (r, w, col, a) => ({type: 'ring', name: 'Кольцо', radius: r, width: w, height: 0.004, tilt: 18, node: 30, lights: 0, spin: 0.15, color: col, alpha: a});
      const orbit = ringMode === 'wide' ? [ring(1.35, 0.32, S.cols[0]), ring(1.72, 0.08, S.cols[1]), ring(1.86, 0.32, S.cols[4])]
        : ringMode === 'thin' ? [ring(1.5, 0.05, S.cols[2]), ring(1.62, 0.02, S.cols[0])] : [];
      if (orbit.length) orbit.push({type: 'debris', name: 'Ледяная пыль колец', radius: 1.6, spread: 0.3, count: 2500, size: 0.006, tilt: 18, node: 30, spin: 0.15, color: S.cols[4]});
      look({orbit, haze: !!P.haze, gasMarks: P.marks && !preview ? marks : null});
      return out;
    },
  });

  // storm crowns: put a mark over every great storm (only on the real planet, not in the gallery preview)
  ss.hooks.on('generate:done', (gen) => {
    if (!ss.doc || !Array.isArray(ss.doc.pois)) return;
    const had = ss.doc.pois.some(p => p.kind === 'gas:storm');
    ss.doc.pois = ss.doc.pois.filter(p => p.kind !== 'gas:storm');
    const marks = gen && gen.id === 'gas-giant' && ss.doc.meta.look && ss.doc.meta.look.gasMarks;
    if (Array.isArray(marks)) marks.forEach((c, i) => ss.doc.pois.push({c, kind: 'gas:storm', name: 'Великий шторм ' + (i + 1), note: ''}));
    if (had || (marks && marks.length)) { ss.docChanged({layer: 'pois'}); ss.pois && ss.pois.rebuild(); }
    // a gas giant is big: make it look so on the system map
    if (gen && gen.id === 'gas-giant' && ss.space && ss.space.nav.level === 'planet') {
      const w = ss.space.where('planet', ss.space.nav.pid);
      if (w && !w.p.parent && w.p.size < 1.6) { w.p.size = 1.6 + Math.random() * 0.5; ss.campaignChanged(); }
    }
  });

  // thin glowing haze over the cloud tops
  ss.particles.forLook('haze', {name: 'Облачная дымка', icon: 'cloud', mod: 'Газовый гигант', count: 900, r0: 1.01, r1: 1.06, size: 0.035, opacity: 0.07, motion: 'drift', speed: 0.05,
    colors: [{color: '#ffffff', weight: 3}, {color: '#ffe8c8', weight: 2}]});
}
