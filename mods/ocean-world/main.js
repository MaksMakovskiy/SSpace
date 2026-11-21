// Ocean world: almost all water, with a chosen number of islands (atoll → lagoon → reef rings around each).
export function activate(ss, mod) {
  ss.registerPack({
    format: 'sspace-pack', id: 'ocean', name: 'Океанический мир', version: '1.0.0',
    terrains: [
      {id: 'abyss', group: 'Океан', name: 'Бездна', color: '#0b1f40', h: -2.6, v: 0.6, tex: 'seabed', fx: 'water'},
      {id: 'open', group: 'Океан', name: 'Открытый океан', color: '#1f5394', h: -1.4, v: 0.3, tex: 'seabed', fx: 'water'},
      {id: 'kelp', group: 'Океан', name: 'Ламинариевый лес', color: '#2f6b5a', h: -0.7, v: 0.2, tex: 'canopy', fx: 'water'},
      {id: 'lagoon', group: 'Океан', name: 'Лагуна', color: '#3fd0c9', h: -0.25, v: 0.05, tex: 'seabed', fx: 'water'},
      {id: 'reef', group: 'Острова', name: 'Барьерный риф', color: '#ff8a7a', h: -0.3, v: 0.15, tex: 'coral', fx: 'water'},
      {id: 'atoll', group: 'Острова', name: 'Атолл', color: '#f0e2b0', h: 0.05, v: 0.05, tex: 'dunes'},
      {id: 'isle', group: 'Острова', name: 'Тропический остров', color: '#4caf50', h: 0.35, v: 0.3, tex: 'forest'},
      {id: 'peak', group: 'Острова', name: 'Вулканический пик', color: '#5b4a44', h: 1.3, v: 0.6, tex: 'rock'},
      {id: 'harbor', group: 'Острова', name: 'Островной порт', color: '#2b8a9a', h: 0.1, v: 0.05, tex: 'city', bld: 'harbor'},
    ],
  }, 'мод ' + mod.id);

  ss.reg.generators.register({
    id: 'ocean-world', name: 'Океанический мир (мод)', icon: 'waves', group: 'Обитаемые миры', desc: 'Бескрайний океан, острова на выбор, рифы и порты.', preview: ['#0b1f40', '#1f5394', '#3fd0c9', '#4caf50'], atmosphere: {on: true, color: '#7fc8ff'}, look: {seamist: true},
    params: [
      {id: 'islands', name: 'Островов', min: 0, max: 80, value: 14},
      {id: 'size', name: 'Размер островов', min: 1, max: 6, value: 2},
      {id: 'reefs', name: 'Рифы вокруг островов', min: 0, max: 100, value: 45, unit: '%'},
      {id: 'ports', name: 'Порты', min: 0, max: 100, value: 20, unit: '%'},
    ],
    run({G, seed, params, type, util}) {
      const rnd = util.mulberry(seed), depth = util.makeNoise(seed), kelpN = util.makeNoise(seed + 3), shape = util.makeNoise(seed + 9);
      const T = {
        abyss: type('ocean:abyss'), deep: type('base:deep'), open: type('ocean:open'), kelp: type('ocean:kelp'), lagoon: type('ocean:lagoon'),
        reef: type('ocean:reef'), atoll: type('ocean:atoll'), isle: type('ocean:isle'), peak: type('ocean:peak'), shallow: type('base:shallow'), port: type('ocean:harbor'),
      };
      const P = (c) => [G.centers[c * 3] * 2.2 + 7, G.centers[c * 3 + 1] * 2.2 + 7, G.centers[c * 3 + 2] * 2.2 + 7];
      const out = new Uint8Array(G.V), prio = new Uint8Array(G.V);
      // open water: depth bands, kelp forests in the shallower parts
      for (let c = 0; c < G.V; c++) {
        const [x, y, z] = P(c), d = depth(x, y, z, 5), k = kelpN(x * 1.7, y * 1.7, z * 1.7, 3);
        out[c] = d < 0.38 ? T.abyss : d < 0.5 ? T.deep : (d > 0.6 && k > 0.62) ? T.kelp : T.open;
      }
      // islands: rings around a center, shape wobbled by noise; land wins over water where islands meet
      const scale = Math.max(1, G.n / 10);
      const put = (c, t, p) => { if (p >= prio[c]) { out[c] = t; prio[c] = p; } };
      for (let i = 0; i < params.islands; i++) {
        const c0 = Math.floor(rnd() * G.V), r = Math.max(0, Math.round(params.size * scale * (0.5 + rnd() * 0.9)) - 1);
        const reef = rnd() * 100 < params.reefs, port = rnd() * 100 < params.ports;
        const dist = new Map([[c0, 0]]), q = [c0];
        for (let j = 0; j < q.length; j++) { const c = q[j], dc = dist.get(c); if (dc >= r + 3) continue; for (const nb of G.nbr[c]) if (!dist.has(nb)) { dist.set(nb, dc + 1); q.push(nb); } }
        let portDone = !port;
        for (const [c, d0] of dist) {
          const [x, y, z] = P(c), d = d0 + (shape(x * 3, y * 3, z * 3, 2) - 0.5) * Math.max(1, r) * 0.9;
          if (r >= 3 && d <= r * 0.35) put(c, T.peak, 6);
          else if (d <= r - 0.5) put(c, T.isle, 5);
          else if (d <= r + 0.5) { if (!portDone && d0 === r) { put(c, T.port, 7); portDone = true; } else put(c, T.atoll, 4); }
          else if (d <= r + 1.5) put(c, T.lagoon, 3);
          else if (reef && d <= r + 2.5) put(c, T.reef, 2);
          else put(c, T.shallow, 1);
        }
      }
      return out;
    },
  });

  // low sea mist and spray blown around the ocean (window «Эффекты»)
  ss.particles.forLook('seamist', {name: 'Морской туман и брызги', icon: 'waves', mod: 'Океан', count: 3000, r0: 1.0, r1: 1.07, size: 0.014, opacity: 0.4, motion: 'drift', speed: 0.035,
    colors: [{color: '#ffffff', weight: 3}, {color: '#cfeaff', weight: 3}, {color: '#9fd8ff', weight: 1}]});
}
