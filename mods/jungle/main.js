// Jungle world: you choose which plants grow there. Every plant is its own terrain with its own 3D flora
// (building style), so you can also paint them by hand from the «Джунгли» group of the palette.
export function activate(ss, mod) {
  // fewer plants per cell on big planets so the whole globe stays covered within the 3D piece limit
  const thin = (n) => { const V = (ss.view && ss.view.G && ss.view.G.V) || 1000; return Math.max(1, Math.round(n * Math.min(1, 7000 / V))); };
  // tip of a piece leaning by `tilt` in direction `rot` (see buildings.js: the piece leans toward X × up)
  const lean = (rot, tilt, len) => [Math.sin(rot) * Math.sin(tilt) * len, -Math.cos(rot) * Math.sin(tilt) * len, Math.cos(tilt) * len];

  const B = ss.reg.buildings;
  B.register({id: 'jungle:giants', name: 'Джунгли: деревья-великаны', build({rnd, pick, spots, put}) {
    const leaf = ['#2e7d32', '#1f6a2a', '#3f9a3a', '#2a8a4a', '#4caf50'];
    for (const [x, y] of spots(thin(4 + Math.floor(rnd() * 3)), 0.66, 0.3)) {
      const th = 0.55 + rnd() * 0.5, tw = 0.05 + rnd() * 0.03;
      put('cyl', x, y, 0, tw, th, tw, rnd() < 0.5 ? '#5b4030' : '#6b4a35');
      for (let i = 0; i < 3; i++) put('cone', x, y, rnd() * 6.3, tw * 1.6, 0.12, tw * 1.6, '#4a3528', 0, 0.5 + rnd() * 0.3); // buttress roots
      const n = 2 + Math.floor(rnd() * 2);
      for (let i = 0; i < n; i++) {
        const a = rnd() * 6.3, r = i ? 0.08 + rnd() * 0.06 : 0, s = 0.28 + rnd() * 0.14;
        put('ball', x + Math.cos(a) * r, y + Math.sin(a) * r, 0, s, s * 0.55, s, pick(leaf), th - 0.06 + rnd() * 0.08);
      }
    }
    for (const [x, y] of spots(thin(3), 0.72, 0.15)) { const s = 0.1 + rnd() * 0.08; put('ball', x, y, 0, s, s * 0.7, s, pick(leaf)); }
  }});
  B.register({id: 'jungle:fungi', name: 'Джунгли: гигантские грибы', build({rnd, pick, spots, put}) {
    const caps = ['#c0392b', '#8e44ad', '#e67e22', '#16a085', '#d35400', '#b03a7a'];
    for (const [x, y] of spots(thin(3 + Math.floor(rnd() * 3)), 0.62, 0.3)) {
      const sh = 0.25 + rnd() * 0.6, sw = 0.05 + rnd() * 0.04, cw = 0.2 + sh * 0.25, col = pick(caps);
      put('cyl', x, y, 0, sw, sh, sw, '#efe4cf', 0, (rnd() - 0.5) * 0.25);
      put('ball', x, y, 0, cw * 2, cw * 0.7, cw * 2, col, sh - cw * 0.25);
      for (let i = 0; i < 3; i++) { const a = rnd() * 6.3; put('glow', x + Math.cos(a) * cw * 0.6, y + Math.sin(a) * cw * 0.6, 0, 0.025, 0.025, 0.025, '#b8ffe8', sh + cw * 0.3); }
    }
    for (const [x, y] of spots(thin(5), 0.75, 0.1)) { const s = 0.04 + rnd() * 0.04; put('cyl', x, y, 0, 0.015, s, 0.015, '#efe4cf'); put('ball', x, y, 0, s * 1.6, s * 0.6, s * 1.6, pick(caps), s * 0.8); }
  }});
  B.register({id: 'jungle:ferns', name: 'Джунгли: папоротники и подлесок', build({rnd, pick, spots, put}) {
    const g = ['#3f8f3a', '#4caf50', '#2e7d32', '#6abf4a', '#5a9a2a'];
    for (const [x, y] of spots(thin(5 + Math.floor(rnd() * 3)), 0.7, 0.2)) {
      const n = 5 + Math.floor(rnd() * 3), len = 0.16 + rnd() * 0.12, col = pick(g);
      for (let i = 0; i < n; i++) put('cone', x, y, i / n * 6.283 + rnd() * 0.4, 0.05, len, 0.02, col, 0, 0.7 + rnd() * 0.4);
      if (rnd() < 0.3) { const s = 0.08 + rnd() * 0.06; put('ball', x, y, 0, s, s * 0.6, s, pick(g)); }
    }
  }});
  B.register({id: 'jungle:spiral', name: 'Джунгли: спиральные деревья', build({rnd, pick, spots, put}) {
    const ring = ['#9b59b6', '#c06cf0', '#7d3c98', '#e07ad8'];
    for (const [x, y] of spots(thin(3 + Math.floor(rnd() * 2)), 0.6, 0.32)) {
      const th = 0.9 + rnd() * 0.6, col = pick(ring), n = 5 + Math.floor(rnd() * 3);
      put('cyl', x, y, 0, 0.03, th, 0.03, '#3a2a4a');
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, s = 0.5 * (1 - t) + 0.12;
        put('ring', x, y, i * 1.1, s, 1.4, s, col, th * (0.2 + 0.75 * t), (i % 2 ? 1 : -1) * 0.35);
      }
      put('glow', x, y, 0, 0.07, 0.07, 0.07, '#ff9ae8', th);
    }
  }});
  B.register({id: 'jungle:lantern', name: 'Джунгли: деревья-светоносы', build({rnd, pick, spots, put}) {
    const fruit = ['#7fffe0', '#ffe08a', '#9fd8ff', '#c8ff8a'];
    for (const [x, y] of spots(thin(3 + Math.floor(rnd() * 2)), 0.6, 0.32)) {
      const th = 0.55 + rnd() * 0.35, glow = pick(fruit);
      put('cyl', x, y, 0, 0.05, th, 0.05, '#4a5a5a');
      put('ball', x, y, 0, 0.46, 0.14, 0.46, rnd() < 0.5 ? '#2f7a78' : '#3a8a6a', th - 0.05);
      const n = 4 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const rot = i / n * 6.283 + rnd() * 0.5, tilt = 1.0 + rnd() * 0.3, len = 0.22 + rnd() * 0.08;
        put('cyl', x, y, rot, 0.02, len, 0.02, '#4a5a5a', th * 0.7, tilt);
        const [dx, dy, dz] = lean(rot, tilt, len);
        const hang = 0.08 + rnd() * 0.1;
        put('cyl', x + dx, y + dy, 0, 0.006, hang, 0.006, '#8ab0a0', th * 0.7 + dz - hang);
        put('glow', x + dx, y + dy, 0, 0.06, 0.07, 0.06, glow, th * 0.7 + dz - hang - 0.06);
      }
    }
  }});
  B.register({id: 'jungle:tendrils', name: 'Джунгли: заросли щупалец', build({rnd, pick, spots, put}) {
    const flesh = ['#8a2a44', '#a83a5a', '#6a1f3a', '#c04a6a'];
    for (const [x, y] of spots(thin(3 + Math.floor(rnd() * 3)), 0.62, 0.26)) {
      const n = 4 + Math.floor(rnd() * 4), col = pick(flesh);
      for (let i = 0; i < n; i++) {
        const rot = rnd() * 6.283, tilt = rnd() * 0.6, len = 0.3 + rnd() * 0.6;
        put('cone', x, y, rot, 0.075, len, 0.075, col, 0, tilt);
        const [dx, dy, dz] = lean(rot, tilt, len);
        if (rnd() < 0.6) put('glow', x + dx, y + dy, 0, 0.035, 0.035, 0.035, '#ff6ab0', dz - 0.02);
      }
      put('ball', x, y, 0, 0.14, 0.1, 0.14, '#5a1a30');
      if (rnd() < 0.5) put('ball', x + 0.1, y, 0, 0.07, 0.09, 0.07, '#d8a040');
    }
  }});

  ss.registerPack({
    format: 'sspace-pack', id: 'jungle', name: 'Мир джунглей', version: '1.0.0',
    terrains: [
      {id: 'giants', group: 'Джунгли', name: 'Тропический лес (великаны)', color: '#2e7d32', h: 0.4, v: 0.3, tex: 'canopy', bld: 'jungle:giants'},
      {id: 'fungi', group: 'Джунгли', name: 'Грибная чаща', color: '#6a4a7e', h: 0.3, v: 0.2, fx: 'glow', tex: 'caps', bld: 'jungle:fungi'},
      {id: 'ferns', group: 'Джунгли', name: 'Папоротниковый подлесок', color: '#4f9a3a', h: 0.2, v: 0.15, tex: 'grass', bld: 'jungle:ferns'},
      {id: 'spiral', group: 'Джунгли', name: 'Спиральная роща', color: '#4a3070', h: 0.35, v: 0.2, tex: 'canopy', bld: 'jungle:spiral'},
      {id: 'lantern', group: 'Джунгли', name: 'Роща светоносов', color: '#1f5560', h: 0.3, v: 0.2, fx: 'glow', tex: 'canopy', bld: 'jungle:lantern'},
      {id: 'tendrils', group: 'Джунгли', name: 'Заросли щупалец', color: '#6a2238', h: 0.25, v: 0.2, tex: 'canopy', bld: 'jungle:tendrils'},
      {id: 'clearing', group: 'Джунгли', name: 'Поляна', color: '#7fb24a', h: 0.1, v: 0.1, tex: 'grass'},
      {id: 'cliffs', group: 'Джунгли', name: 'Поросшие скалы', color: '#556b48', h: 1.3, v: 0.6, tex: 'rock'},
      {id: 'temple', group: 'Джунгли', name: 'Затерянный храм', color: '#8a8a6a', h: 0.5, v: 0.1, tex: 'paving', bld: 'temple'},
      {id: 'village', group: 'Джунгли', name: 'Деревня на сваях', color: '#8a6a4a', h: 0.15, v: 0.05, tex: 'grass', bld: 'houses'},
      {id: 'river', group: 'Джунгли', name: 'Мутная река', color: '#5a6a3a', h: -0.35, v: 0.05, fx: 'water', tex: 'seabed'},
      {id: 'lake', group: 'Джунгли', name: 'Заросшее озеро', color: '#2f5a4a', h: -0.8, v: 0.2, fx: 'water', tex: 'seabed'},
      {id: 'swamp', group: 'Джунгли', name: 'Топь', color: '#4d5a2a', h: -0.15, v: 0.05, fx: 'water', tex: 'seabed'},
    ],
    poiKinds: [{id: 'idol', sym: '♜', name: 'Идол', color: '#e0c060'}],
  }, 'мод ' + mod.id);

  const FLORA = [
    {id: 'giants', name: 'Деревья-великаны', on: true},
    {id: 'fungi', name: 'Гигантские грибы', on: true},
    {id: 'ferns', name: 'Папоротники', on: true},
    {id: 'spiral', name: 'Спиральные деревья', on: false},
    {id: 'lantern', name: 'Деревья-светоносы', on: false},
    {id: 'tendrils', name: 'Заросли щупалец', on: false},
  ];
  ss.reg.generators.register({
    id: 'jungle', name: 'Мир джунглей (мод)', icon: 'leaf', group: 'Обитаемые миры',
    desc: 'Сплошные джунгли: выбери растения, реки, топи, храмы. Каждое растение — свой 3D-лес.',
    preview: ['#2e7d32', '#6a4a7e', '#4f9a3a', '#1f5560', '#5a6a3a'],
    atmosphere: {on: true, color: '#9fe8b0'},
    params: [
      {id: 'density', name: 'Густота зарослей', min: 0, max: 100, value: 85, unit: '%'},
      {id: 'patch', name: 'Размер рощ', min: 1, max: 6, value: 3},
      {id: 'water', name: 'Озёра и топи', min: 0, max: 40, value: 10, unit: '%'},
      {id: 'rivers', name: 'Рек', min: 0, max: 40, value: 10},
      {id: 'mountains', name: 'Скалы', min: 0, max: 30, value: 7, unit: '%'},
      {id: 'temples', name: 'Затерянных храмов', min: 0, max: 20, value: 4},
      {id: 'villages', name: 'Деревень', min: 0, max: 20, value: 3},
      ...FLORA.map(f => ({id: 'f_' + f.id, name: f.name, type: 'check', value: f.on, section: 'Растения'})),
      {id: 'rain', name: 'Тропический дождь', type: 'check', value: true, section: 'Погода и воздух'},
      {id: 'spores', name: 'Пыльца и споры', type: 'check', value: true, section: 'Погода и воздух'},
      {id: 'fireflies', name: 'Светлячки', type: 'check', value: false, section: 'Погода и воздух'},
    ],
    run({G, seed, params, type, util, look}) {
      const rnd = util.mulberry(seed), elev = util.makeNoise(seed), dens = util.makeNoise(seed + 5);
      const T = Object.fromEntries(['giants', 'fungi', 'ferns', 'spiral', 'lantern', 'tendrils', 'clearing', 'cliffs', 'temple', 'village', 'river', 'lake', 'swamp'].map(k => [k, type('jungle:' + k)]));
      const flora = FLORA.filter(f => params['f_' + f.id]).map((f, i) => ({t: T[f.id], noise: util.makeNoise(seed + 20 + i * 7), off: 3 + i * 11.3}));
      const at = (c, k, s) => [G.centers[c * 3] * k + s, G.centers[c * 3 + 1] * k + s, G.centers[c * 3 + 2] * k + s];
      const e = new Float32Array(G.V), sorted = [];
      for (let c = 0; c < G.V; c++) { e[c] = elev(...at(c, 2, 4), 5); sorted.push(e[c]); }
      sorted.sort((a, b) => a - b);
      const q = (f) => sorted[Math.min(G.V - 1, Math.max(0, Math.floor(f * (G.V - 1))))];
      const wl = params.water / 100, lakeL = q(wl * 0.6), swampL = q(wl), high = q(1 - params.mountains / 100);
      const fScale = 5 / params.patch;
      // clearings: the given share of land by a separate noise (quantile, so 15% really means 15%)
      const d = new Float32Array(G.V); for (let c = 0; c < G.V; c++) d[c] = dens(...at(c, 4, 9), 3);
      const ds = Array.from(d).sort((a, b) => a - b), clearL = params.density >= 100 ? -1 : ds[Math.floor((1 - params.density / 100) * (G.V - 1))];
      const out = new Uint8Array(G.V);
      for (let c = 0; c < G.V; c++) {
        let t;
        if (params.water > 0 && e[c] <= lakeL) t = T.lake;
        else if (params.water > 0 && e[c] <= swampL) t = T.swamp;
        else if (params.mountains > 0 && e[c] >= high) t = T.cliffs;
        else if (!flora.length || d[c] <= clearL) t = T.clearing;
        else {
          let best = -1;
          for (const f of flora) { const v = f.noise(...at(c, fScale, f.off), 3); if (v > best) { best = v; t = f.t; } }
        }
        out[c] = t;
      }
      // rivers: from the hills down the steepest way until water or a hollow (which becomes a lake)
      const water = (t) => t === T.lake || t === T.swamp || t === T.river;
      for (let r = 0; r < params.rivers; r++) {
        let c = -1;
        for (let k = 0; k < 40; k++) { const x = Math.floor(rnd() * G.V); if (e[x] > q(0.7) && !water(out[x])) { c = x; break; } }
        if (c < 0) continue;
        const seen = new Set();
        for (let step = 0; step < 120 && c >= 0; step++) {
          if (water(out[c]) && step) break;
          if (out[c] !== T.cliffs || step > 2) out[c] = T.river;
          seen.add(c);
          let nx = -1, low = Infinity;
          for (const nb of G.nbr[c]) if (!seen.has(nb) && e[nb] < low) { low = e[nb]; nx = nb; }
          if (nx < 0) break;
          if (low > e[c] + 0.02) { out[c] = T.lake; break; }
          c = nx;
        }
      }
      // temples deep in the forest, villages on river banks
      const land = (t) => !water(t) && t !== T.cliffs;
      for (let i = 0; i < params.temples; i++) { const c = Math.floor(rnd() * G.V); if (land(out[c])) out[c] = T.temple; }
      for (let i = 0, k = 0; i < params.villages && k < 400; k++) {
        const c = Math.floor(rnd() * G.V); if (out[c] !== T.river) continue;
        const nb = [...G.nbr[c]].find(n => land(out[n]) && out[n] !== T.temple); if (nb === undefined) continue;
        out[nb] = T.village; i++;
      }
      look({rain: !!params.rain, spores: !!params.spores, fireflies: !!params.fireflies});
      return out;
    },
  });

  ss.particles.forLook('fireflies', {name: 'Светлячки', icon: 'sparkles', mod: 'Джунгли', count: 1600, r0: 1.0, r1: 1.06, size: 0.012, opacity: 0.9, additive: true, motion: 'drift', speed: 0.01, jitter: 0.006,
    colors: [{color: '#d8ff6a', weight: 4}, {color: '#ffe08a', weight: 2}, {color: '#7fffe0', weight: 1}]});
}
