// Habitation: a generation layer that settles any generated world. Pick an era (or a mix), where people may live
// (ordinary land, dangerous ground like lava and radiation, open water), how many big states and small settlements
// there are and how large. Each era × size is its own terrain with its own 3D buildings ("hab:<era>-<size>[-sea]").
export function activate(ss, mod) {
  const thin = (n) => { const V = (ss.view && ss.view.G && ss.view.G.V) || 1000; return Math.max(1, Math.round(n * Math.min(1, 9000 / V))); };
  const TIERS = [{id: 'village', name: 'деревня', n: 3, h: 0.15}, {id: 'town', name: 'город', n: 6, h: 0.2}, {id: 'capital', name: 'столица', n: 9, h: 0.3}];

  // ---------- eras: colours, a house and a landmark ----------
  // house(ctx, x, y, s) — one dwelling, s grows with the settlement size; landmark(ctx) — the centre of a town/capital
  const ERAS = [
    {id: 'primitive', name: 'Первобытные племена', color: '#8a7a4a', tex: 'grass',
      house({put, rnd}, x, y, s) { const w = 0.11 + rnd() * 0.05; put('cyl', x, y, 0, w, 0.05, w, '#7a5a3a'); put('cone', x, y, 0, w * 1.35, 0.13 * s, w * 1.35, rnd() < 0.5 ? '#a08050' : '#8a6a3a', 0.05); },
      landmark({put, rnd}) { for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; put('cyl', Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0, 0.05, 0.12 + rnd() * 0.06, 0.05, '#8a8580'); } put('glow', 0, 0, 0, 0.08, 0.1, 0.08, '#ff9a3a'); }},
    {id: 'bronze', name: 'Бронзовый век', color: '#b89a6a', tex: 'dunes',
      house({put, rnd, pick}, x, y, s) { const w = 0.13 + rnd() * 0.06, hh = 0.07 + rnd() * 0.04 * s; put('box', x, y, rnd(), w, hh, w * 0.9, pick(['#c8a070', '#d4b07a', '#b8925a'])); if (rnd() < 0.4) put('box', x, y, rnd(), w * 0.5, hh * 0.6, w * 0.5, '#c8a070', hh); },
      landmark({put}) { [[0.5, 0.08], [0.38, 0.08], [0.26, 0.08], [0.14, 0.08]].reduce((lift, [w, hh]) => { put('box', 0, 0, 0, w, hh, w, '#c9a46a', lift); return lift + hh; }, 0); put('glow', 0, 0, 0, 0.05, 0.05, 0.05, '#ffcf6a', 0.33); }},
    {id: 'wooden', name: 'Деревянное зодчество', color: '#8a6a44', tex: 'grass',
      house({put, rnd, pick}, x, y, s) { const w = 0.13 + rnd() * 0.05, hh = 0.07 + 0.03 * s, r = rnd() * 3; put('box', x, y, r, w, hh, w * 1.2, pick(['#8a5a3a', '#7a4e30', '#9a6a44'])); put('roof', x, y, r, w * 1.1, 0.08, w * 1.3, '#5a3a24', hh); },
      landmark({put}) { put('box', 0, 0, 0, 0.22, 0.22, 0.22, '#9a6a44'); put('cyl', 0, 0, 0, 0.12, 0.12, 0.12, '#9a6a44', 0.22); put('ball', 0, 0, 0, 0.16, 0.18, 0.16, '#d4a72c', 0.32); put('cone', 0, 0, 0, 0.03, 0.1, 0.03, '#d4a72c', 0.48); put('ring', 0, 0, 0, 1.4, 1.6, 1.4, '#6b4a2a', 0.04); }},
    {id: 'antiquity', name: 'Античность', color: '#d8cfb8', tex: 'paving',
      house({put, rnd, pick}, x, y, s) { const w = 0.13 + rnd() * 0.05, hh = 0.08 + 0.03 * s, r = rnd() * 3; put('box', x, y, r, w, hh, w, pick(['#eee6d6', '#e6dcc6', '#f2ece0'])); put('roof', x, y, r, w * 1.05, 0.04, w * 1.05, '#b5532a', hh); },
      landmark({put}) { put('box', 0, 0, 0, 0.42, 0.04, 0.3, '#eee6d6'); for (let i = 0; i < 8; i++) { const x = -0.18 + (i % 4) * 0.12, y = i < 4 ? -0.12 : 0.12; put('cyl', x, y, 0, 0.035, 0.18, 0.035, '#f2ece0', 0.04); } put('roof', 0, 0, Math.PI / 4, 0.44, 0.08, 0.32, '#e6dcc6', 0.22); put('ring', 0.45, 0, 0, 0.4, 2.2, 0.4, '#d8cfb8', 0.03); }},
    {id: 'medieval', name: 'Средневековье', color: '#8f8a80', tex: 'paving',
      house({put, rnd, pick}, x, y, s) { const w = 0.12 + rnd() * 0.05, hh = 0.09 + 0.04 * s, r = rnd() * 3; put('box', x, y, r, w, hh, w * 1.1, pick(['#9a9088', '#b8ab98', '#d9c7a3'])); put('roof', x, y, r, w * 1.1, 0.12, w * 1.2, pick(['#8e3b2a', '#6d5a3e', '#a64b3c']), hh); },
      landmark({put}) { put('box', 0, 0, 0, 0.2, 0.32, 0.2, '#8a8580'); for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + 0.785; put('cyl', Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0, 0.09, 0.26, 0.09, '#958f86'); put('cone', Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0, 0.11, 0.12, 0.11, '#5b4a6b', 0.26); } put('ring', 0, 0, 0, 0.7, 2.5, 0.7, '#77726c', 0.05); }},
    {id: 'renaissance', name: 'Ренессанс', color: '#c89a70', tex: 'paving',
      house({put, rnd, pick}, x, y, s) { const w = 0.13 + rnd() * 0.05, hh = 0.1 + 0.05 * s, r = rnd() * 3; put('box', x, y, r, w, hh, w * 1.2, pick(['#d9a066', '#e8b8a0', '#e8d0a0', '#d88a6a'])); put('roof', x, y, r, w * 1.05, 0.05, w * 1.25, '#b5532a', hh); },
      landmark({put}) { put('box', 0, 0, 0, 0.3, 0.18, 0.4, '#e8d8c0'); put('cyl', 0, 0.05, 0, 0.18, 0.08, 0.18, '#e8d8c0', 0.18); put('ball', 0, 0.05, 0, 0.2, 0.18, 0.2, '#c8723a', 0.2); put('cone', 0, 0.05, 0, 0.03, 0.06, 0.03, '#e8d8c0', 0.37); put('box', 0.24, -0.18, 0, 0.07, 0.42, 0.07, '#d9a066'); put('roof', 0.24, -0.18, 0, 0.08, 0.06, 0.08, '#b5532a', 0.42); }},
    {id: 'industrial', name: 'Индустриальная эпоха', color: '#7a5a4a', tex: 'city',
      house({put, rnd, pick}, x, y, s) { const w = 0.12 + rnd() * 0.06, hh = 0.12 + 0.06 * s * rnd(), r = rnd() * 0.3; put('box', x, y, r, w, hh, w * 1.4, pick(['#8a3a2a', '#9a4a34', '#7a3424', '#6a645f'])); if (rnd() < 0.25) put('cyl', x + 0.04, y, 0, 0.025, hh + 0.12, 0.025, '#5a4a40'); },
      landmark({put}) { put('box', 0, 0, 0, 0.42, 0.16, 0.3, '#7a746e'); put('roof', 0, 0, 0, 0.44, 0.06, 0.3, '#5a544e', 0.16); for (let i = 0; i < 3; i++) { put('cyl', -0.14 + i * 0.14, 0.2, 0, 0.05, 0.5, 0.05, '#6a4a3a'); put('glow', -0.14 + i * 0.14, 0.2, 0, 0.04, 0.02, 0.04, '#ff6a3a', 0.5); } }},
    {id: 'modern', name: 'Современность', color: '#7f8a96', tex: 'city',
      house({put, rnd, pick}, x, y, s) { const w = 0.1 + rnd() * 0.06; put('box', x, y, rnd() * 0.3, w, 0.12 + rnd() * 0.25 * s, w, pick(['#7f93a8', '#9fb2c4', '#5d6f82', '#b9c7d3', '#c9c5bd'])); },
      landmark({put}) { put('box', 0, 0, 0.3, 0.16, 1.1, 0.16, '#8aa0b5'); put('box', 0.2, 0.05, 0.3, 0.12, 0.75, 0.12, '#9fb2c4'); put('cyl', -0.2, 0.1, 0, 0.05, 0.9, 0.05, '#c9d1dc'); put('glow', -0.2, 0.1, 0, 0.06, 0.06, 0.06, '#ff4a4a', 0.9); }},
    {id: 'space', name: 'Космическая эра', color: '#c9d1dc', tex: 'plates',
      house({put, rnd, pick}, x, y, s) { const w = 0.12 + rnd() * 0.06; if (rnd() < 0.5) { put('ball', x, y, 0, w * 1.4, w * 0.8, w * 1.4, pick(['#e8f4f8', '#cfe9f2', '#d8dee6'])); } else { const hh = 0.2 + rnd() * 0.35 * s; put('cyl', x, y, 0, w * 0.8, hh, w * 0.8, '#d8dee6'); put('glowRing', x, y, 0, w * 1.5, 0.6, w * 1.5, '#7fe3ff', hh * 0.7); } },
      landmark(ctx) { const sp = ss.reg.buildings.get('spaceport'); if (sp) sp.build(ctx); else ctx.put('cyl', 0, 0, 0, 0.12, 1.2, 0.12, '#d8dee6'); }},
    {id: 'future', name: 'Далёкое будущее', color: '#e8ecf4', tex: 'plates',
      house({put, rnd, pick}, x, y, s) { const hh = 0.3 + rnd() * 0.5 * s; put('cone', x, y, 0, 0.09, hh, 0.09, pick(['#eef1f5', '#d8dee6', '#f2f4f8'])); if (rnd() < 0.5) put('glowRing', x, y, 0, 0.16, 0.6, 0.16, '#bfe8ff', hh * 0.6); if (rnd() < 0.3) put('glow', x, y, 0, 0.05, 0.05, 0.05, '#fff6d8', hh + 0.15 + rnd() * 0.2); },
      landmark({put}) { put('cone', 0, 0, 0, 0.18, 1.6, 0.18, '#f2f4f8'); for (let i = 0; i < 4; i++) put('glowRing', 0, 0, 0, 0.5 - i * 0.09, 0.6, 0.5 - i * 0.09, '#bfe8ff', 0.3 + i * 0.3); put('glow', 0, 0, 0, 0.1, 0.1, 0.1, '#ffffff', 1.6); }},
  ];

  // ---------- building styles and terrains: era × size, on land and on water ----------
  const terrains = [];
  for (const E of ERAS) for (const [ti, T] of TIERS.entries()) for (const sea of [false, true]) {
    const bid = `hab:${E.id}-${T.id}${sea ? '-sea' : ''}`;
    ss.reg.buildings.register({id: bid, name: `${E.name}: ${T.name}${sea ? ' на воде' : ''}`, build(ctx) {
      const {rnd, spots, put} = ctx;
      if (sea) { // platform or stilts under the settlement
        const early = ['primitive', 'bronze', 'wooden', 'antiquity', 'medieval'].includes(E.id);
        put('cyl', 0, 0, 0, 1.25, 0.03, 1.25, early ? '#6b4a2a' : '#6a7380');
        if (early) for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; put('cyl', Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0, 0.03, 0.06, 0.03, '#4a3520', -0.05); }
      }
      const lift = sea ? 0.03 : 0, s = 1 + ti * 0.6;
      const wrap = {...ctx, put: (k, x, y, r, w, hh, d, col, l = 0, tilt = 0) => put(k, x, y, r, w, hh, d, col, l + lift, tilt)};
      const big = ti > 0 && (ti === 2 || rnd() < 0.35);
      if (big) E.landmark(wrap);
      for (const [x, y] of spots(thin(T.n + Math.floor(rnd() * 3)), 0.72, 0.21)) { if (big && Math.hypot(x, y) < 0.36) continue; E.house(wrap, x, y, s); }
    }});
    terrains.push({id: `${E.id}-${T.id}${sea ? '-sea' : ''}`, group: 'Поселения: ' + E.name, name: `${E.name}: ${T.name}${sea ? ' на воде' : ''}`,
      color: sea ? '#3a6a8a' : E.color, h: sea ? 0.04 : T.h, v: 0.05, tex: sea ? 'plates' : (ti === 0 && E.tex === 'city' ? 'paving' : E.tex), bld: bid});
  }
  ss.registerPack({format: 'sspace-pack', id: 'hab', name: 'Обитаемость', version: '1.0.0', terrains,
    poiKinds: [{id: 'capital', sym: '♛', name: 'Столица государства', color: '#ffd27a'}]}, 'мод ' + mod.id);

  // ---------- where may people live ----------
  // gas giants count as dangerous ground (cloud cities), so do the rifts and the bare core of a shattered planet
  const HAZARD = /lava|magma|volcan|acid|toxic|radiat|rad:|crack|plasma|anomal|hot|forge|ember|glowmarsh|smolder|puddle|crater|gas:|broken:core|broken:rift|mega:burb|trench|-dock/i;
  const classify = (p) => {
    if (!p) return 'land';
    const key = (p.src || '') + ' ' + (p.fx || '') + ' ' + (p.name || '');
    if (HAZARD.test(key) || /Лав|Магм|Кисл|Радиа|Токси|Плазм|Аномал/i.test(p.name || '')) return 'hazard';
    if (p.fx === 'water' || p.h < -0.05) return 'water';
    return 'land';
  };

  const ERA_OPTS = [...ERAS.map(e => ({value: e.id, label: e.name})), {value: 'mix', label: 'Разные эпохи (у каждого государства своя)'}];
  ss.reg.genLayers.register({
    id: 'settlements', name: 'Обитаемость: поселения и государства', icon: 'houses',
    desc: 'Заселяет любой сгенерированный мир: города выбранной эпохи, столицы государств, деревни, дороги.',
    params: [
      {id: 'era', name: 'Эпоха', type: 'select', options: ERA_OPTS, value: 'medieval'},
      {id: 'land', name: 'На суше', type: 'check', value: true, section: 'Где строить'},
      {id: 'hazard', name: 'В опасных местах (лава, радиация, кислота)', type: 'check', value: false, section: 'Где строить'},
      {id: 'water', name: 'На воде (моря, океаны)', type: 'check', value: false, section: 'Где строить'},
      {id: 'states', name: 'Крупных государств', min: 0, max: 30, value: 4, section: 'Насыщенность'},
      {id: 'stateSize', name: 'Размер государств', min: 1, max: 15, value: 5, section: 'Насыщенность'},
      {id: 'density', name: 'Плотность застройки', min: 5, max: 100, value: 35, unit: '%', section: 'Насыщенность'},
      {id: 'small', name: 'Малых поселений', min: 0, max: 300, value: 30, section: 'Насыщенность'},
      {id: 'smallSize', name: 'Размер малых поселений', min: 1, max: 4, value: 1, section: 'Насыщенность'},
      {id: 'roads', name: 'Дороги между городами', type: 'check', value: true, section: 'Насыщенность'},
      {id: 'capitals', name: 'Метки столиц на карте', type: 'check', value: true, section: 'Насыщенность'},
    ],
    // already inhabited worlds (their generator says so) ask first
    confirm(gen) {
      return gen.inhabited ? `«${gen.name.replace(/\s*\(мод\)\s*$/, '')}» — уже обитаемый мир, у него свои города. Всё равно добавить поселения поверх?` : null;
    },
    run({G, seed, params: P, out, type, util, info, preview}) {
      const rnd = util.mulberry(seed);
      const kind = new Array(G.V); for (let c = 0; c < G.V; c++) kind[c] = classify(info(c));
      const ok = (c) => (kind[c] === 'land' && P.land) || (kind[c] === 'hazard' && P.hazard) || (kind[c] === 'water' && P.water);
      const cand = []; for (let c = 0; c < G.V; c++) if (ok(c)) cand.push(c);
      if (!cand.length) { if (!preview) ss.ui.toast('Обитаемость: нет подходящих мест — включи сушу, воду или опасные места'); return; }
      const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      shuffle(cand);
      const eraIds = ERAS.map(e => e.id), pickEra = () => P.era === 'mix' ? eraIds[Math.floor(rnd() * eraIds.length)] : P.era;
      const cellAng = Math.sqrt(4 * Math.PI / G.V);
      // sizes are given for a planet of frequency 10; bigger planets get proportionally bigger states and towns
      const k = Math.max(1, (G.n || 10) / 10), stateR = Math.max(1, Math.round(P.stateSize * k)), smallR = Math.round((P.smallSize - 1) * k + (k - 1) * 0.5);
      const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, G.centers[a * 3] * G.centers[b * 3] + G.centers[a * 3 + 1] * G.centers[b * 3 + 1] + G.centers[a * 3 + 2] * G.centers[b * 3 + 2])));
      const taken = new Uint8Array(G.V), tier = new Int8Array(G.V).fill(-1), eraOf = new Array(G.V);
      const place = (c, t, era) => { if (tier[c] >= t) return; tier[c] = t; eraOf[c] = era; taken[c] = 1; };
      const grow = (c0, R) => { // cells within R steps through allowed cells
        const dist = new Map([[c0, 0]]), q = [c0];
        for (let j = 0; j < q.length; j++) { const c = q[j], d = dist.get(c); if (d >= R) continue; for (const nb of G.nbr[c]) if (!dist.has(nb) && ok(nb)) { dist.set(nb, d + 1); q.push(nb); } }
        return dist;
      };
      // big states: spread out capitals, then towns near the centre and villages further away
      const caps = [];
      let sep = cellAng * (stateR * 2 + 2);
      for (let tries = 0; caps.length < P.states && tries < 4; tries++, sep *= 0.6) {
        for (const c of cand) { if (caps.length >= P.states) break; if (taken[c] || caps.some(k => ang(k.c, c) < sep)) continue; caps.push({c, era: pickEra()}); taken[c] = 1; }
      }
      const dens = P.density / 100;
      for (const cap of caps) {
        const R = stateR;
        for (const [c, d] of grow(cap.c, R)) {
          if (d === 0) { place(c, 2, cap.era); continue; }
          if (tier[c] >= 0 && eraOf[c] !== cap.era) continue; // a neighbour state got there first
          const f = d / Math.max(1, R);
          if (f <= 0.35 && rnd() < dens * 1.4) place(c, 1, cap.era);
          else if (rnd() < dens * (1 - f * 0.6)) place(c, 0, cap.era);
        }
      }
      // small settlements: take the era of the nearest state (or a random one)
      const smalls = [];
      for (const c of cand) {
        if (smalls.length >= P.small) break;
        if (taken[c] || caps.some(q => ang(q.c, c) < cellAng * (stateR + 1)) || smalls.some(s => ang(s, c) < cellAng * (smallR * 2 + 3))) continue;
        let era = pickEra(), best = Infinity;
        if (P.era === 'mix') for (const q of caps) { const a = ang(q.c, c); if (a < best && a < cellAng * stateR * 4) { best = a; era = q.era; } }
        smalls.push(c);
        for (const [x, d] of grow(c, smallR)) {
          if (taken[x] && tier[x] >= 0 && x !== c) continue;
          if (d === 0) place(x, P.smallSize >= 3 ? 1 : 0, era);
          else if (rnd() < 0.65) place(x, P.smallSize >= 4 && d <= k ? 1 : 0, era);
        }
      }
      // write the settlements
      for (let c = 0; c < G.V; c++) if (tier[c] >= 0) out[c] = type(`hab:${eraOf[c]}-${TIERS[tier[c]].id}${kind[c] === 'water' ? '-sea' : ''}`);
      // roads over land: each capital to its nearest neighbour capitals, each small settlement to the nearest capital
      if (P.roads && P.land) {
        const road = type('base:road');
        const walk = (a, b, maxLen) => {
          const prev = new Map([[a, -1]]), q = [a];
          for (let j = 0; j < q.length && q.length < 20000 * k * k; j++) {
            const c = q[j]; if (c === b) break;
            for (const nb of G.nbr[c]) if (!prev.has(nb) && (kind[nb] === 'land' || nb === b)) { prev.set(nb, c); q.push(nb); }
          }
          if (!prev.has(b)) return;
          const path = []; for (let c = b; c !== -1; c = prev.get(c)) path.push(c);
          if (path.length > maxLen) return;
          for (const c of path) if (tier[c] < 0 && kind[c] === 'land') out[c] = road;
        };
        for (const k of caps) {
          const others = caps.filter(o => o !== k).sort((x, y) => ang(k.c, x.c) - ang(k.c, y.c)).slice(0, 2);
          for (const o of others) walk(k.c, o.c, stateR * 8 + 20);
        }
        for (const s of smalls) {
          let best = null, bd = Infinity; for (const k of caps) { const a = ang(k.c, s); if (a < bd) { bd = a; best = k; } }
          if (best && bd < cellAng * stateR * 3) walk(s, best.c, stateR * 4 + 6);
        }
      }
      // crowns over the capitals
      if (P.capitals && !preview && ss.doc && Array.isArray(ss.doc.pois)) {
        ss.doc.pois = ss.doc.pois.filter(p => p.kind !== 'hab:capital');
        caps.forEach((k, i) => ss.doc.pois.push({c: k.c, kind: 'hab:capital', name: 'Столица ' + (i + 1), note: 'Государство эпохи «' + ERAS.find(e => e.id === k.era).name + '»'}));
        ss.docChanged({layer: 'pois'}); ss.pois && ss.pois.rebuild && ss.pois.rebuild();
      }
      if (!preview) ss.ui.toast(`Обитаемость: ${caps.length} гос. и ${smalls.length} малых поселений`);
    },
  });

  // a new world without settlements: the crowns of the old capitals go too
  ss.hooks.on('generate:done', (gen) => {
    if (gen && gen.layers && gen.layers.settlements) return;
    if (!ss.doc || !Array.isArray(ss.doc.pois) || !ss.doc.pois.some(p => p.kind === 'hab:capital')) return;
    ss.doc.pois = ss.doc.pois.filter(p => p.kind !== 'hab:capital'); ss.docChanged({layer: 'pois'}); ss.pois && ss.pois.rebuild();
  });
}
