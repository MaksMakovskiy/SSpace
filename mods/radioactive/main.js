// Radioactive world: a pulsing green "radiation" effect with hot spots, plus terrain and a generator.
export function activate(ss, mod) {
  ss.reg.effects.register({
    id: 'radiation', name: 'Радиация: пульс и горячие точки (мод)',
    glsl: `float p=0.5+0.5*sin(uTime*3.0+dot(nP,vec3(40.0,31.0,23.0)));
      float spot=step(0.82,fract(sin(dot(floor(vP*90.0),vec3(12.9898,78.233,37.719)))*43758.5453));
      float flick=0.6+0.4*sin(uTime*9.0+dot(floor(vP*90.0),vec3(3.1,7.7,5.3)));
      totalEmissiveRadiance+=diffuseColor.rgb*vec3(0.55,1.0,0.25)*(0.15+0.35*p)+vec3(0.55,1.0,0.3)*spot*flick*(0.35+0.5*p);`,
  });

  ss.registerPack({
    format: 'sspace-pack', id: 'rad', name: 'Радиоактивный мир', version: '1.0.0',
    terrains: [
      {id: 'waste', group: 'Заражённые земли', name: 'Радиоактивная пустошь', color: '#7a7a3a', h: 0.2, v: 0.25, tex: 'rock'},
      {id: 'hot', group: 'Заражённые земли', name: 'Очаг заражения', color: '#c8ff3a', h: 0.1, v: 0.2, fx: 'radiation', tex: 'rock'},
      {id: 'crater', group: 'Заражённые земли', name: 'Воронка', color: '#3a3530', h: -1.3, v: 0.4, fx: 'radiation', tex: 'rock'},
      {id: 'ash', group: 'Заражённые земли', name: 'Пепельная равнина', color: '#5a5552', h: 0.1, v: 0.15, tex: 'dunes'},
      {id: 'deadwood', group: 'Заражённые земли', name: 'Мёртвый лес', color: '#4a4a3a', h: 0.4, v: 0.2, tex: 'forest'},
      {id: 'acid', group: 'Вода', name: 'Кислотное озеро', color: '#9be03a', h: -0.6, v: 0.2, tex: 'seabed', fx: 'water'},
      {id: 'glowmarsh', group: 'Вода', name: 'Светящееся болото', color: '#4f7a2a', h: -0.1, v: 0.05, fx: 'glow', tex: 'grass'},
      {id: 'bunker', group: 'Постройки', name: 'Бункер', color: '#6b6f73', h: 0.3, v: 0.05, tex: 'city', bld: 'research'},
      {id: 'ruins', group: 'Постройки', name: 'Разрушенный город', color: '#5d574f', h: 0.3, v: 0.2, tex: 'city', bld: 'ruins'},
    ],
    poiKinds: [{id: 'hazard', sym: '☢', name: 'Радиация', color: '#c8ff3a'}],
  }, 'мод ' + mod.id);

  ss.reg.generators.register({
    id: 'radioactive', name: 'Радиоактивный мир (мод)', icon: 'radiation', group: 'Суровые миры', desc: 'Заражённые пустоши, воронки, кислотные озёра, руины.', preview: ['#b8ff6a', '#5d574f', '#9be03a', '#4f7a2a'], atmosphere: {on: true, color: '#b8ff6a'}, look: {fallout: true},
    params: [
      {id: 'craters', name: 'Воронок', min: 0, max: 40, value: 10},
      {id: 'contamination', name: 'Заражение', min: 0, max: 100, value: 45, unit: '%'},
      {id: 'ruins', name: 'Руин городов', min: 0, max: 30, value: 8},
    ],
    run({G, seed, params, type, util}) {
      const rnd = util.mulberry(seed), elev = util.makeNoise(seed), wet = util.makeNoise(seed + 5), rad = util.makeNoise(seed + 11);
      const T = {waste: type('rad:waste'), hot: type('rad:hot'), crater: type('rad:crater'), ash: type('rad:ash'), dead: type('rad:deadwood'),
        acid: type('rad:acid'), marsh: type('rad:glowmarsh'), bunker: type('rad:bunker'), ruins: type('rad:ruins'), rocks: type('base:rocks')};
      const out = new Uint8Array(G.V);
      const cont = params.contamination / 100;
      for (let c = 0; c < G.V; c++) {
        const x = G.centers[c * 3] * 2 + 3, y = G.centers[c * 3 + 1] * 2 + 3, z = G.centers[c * 3 + 2] * 2 + 3;
        const e = elev(x, y, z, 5), m = wet(x * 1.4, y * 1.4, z * 1.4, 3), r = rad(x * 1.8, y * 1.8, z * 1.8, 3);
        let t = e < 0.36 ? T.acid : e < 0.42 ? T.marsh : e > 0.7 ? T.rocks : m > 0.6 ? T.dead : m < 0.4 ? T.ash : T.waste;
        if (t !== T.acid && r > 1 - cont * 0.5) t = T.hot;
        out[c] = t;
      }
      const blob = (c0, r, fn) => {
        const dist = new Map([[c0, 0]]), q = [c0];
        for (let j = 0; j < q.length; j++) { const c = q[j], dc = dist.get(c); if (dc >= r) continue; for (const nb of G.nbr[c]) if (!dist.has(nb)) { dist.set(nb, dc + 1); q.push(nb); } }
        for (const [c, d] of dist) fn(c, d);
      };
      const scale = Math.max(1, G.n / 10);
      for (let i = 0; i < params.craters; i++) {
        const r = Math.max(1, Math.round(scale * (0.8 + rnd() * 1.6)));
        blob(Math.floor(rnd() * G.V), r + 1, (c, d) => { out[c] = d < r ? T.crater : T.hot; });
      }
      for (let i = 0; i < params.ruins; i++) {
        const r = Math.max(0, Math.round(scale * rnd() * 1.2));
        blob(Math.floor(rnd() * G.V), r, (c, d) => { if (out[c] !== T.acid) out[c] = d === 0 && rnd() < 0.5 ? T.bunker : T.ruins; });
      }
      return out;
    },
  });

  // glowing fallout drifting down (window «Эффекты»)
  ss.particles.forLook('fallout', {name: 'Радиоактивные осадки', icon: 'radiation', mod: 'Радиация', count: 2200, r0: 1.01, r1: 1.35, size: 0.012, opacity: 0.85, additive: true, motion: 'fall', speed: 0.018, jitter: 0.008,
    colors: [{color: '#b8ff6a', weight: 4}, {color: '#c8ff3a', weight: 3}, {color: '#eaffb0', weight: 1}]});
}
