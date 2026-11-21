// Planet of Angels: a silver nanite megapolis. Orbital ring cities and rising nanite motes (look.halo, window «Эффекты»).
export function activate(ss, mod) {
  const {THREE} = ss, S = ss.scene;

  ss.reg.effects.register({
    id: 'radiance', name: 'Сияние: серебро и свет (мод)',
    glsl: `float s=pow(max(0.0,sin(uTime*1.5+dot(floor(vP*140.0),vec3(1.3,7.1,3.7)))),24.0);
      float fres=pow(1.0-abs(normalize(vNv).z),3.0);
      vec3 Nb=normalize(vNv);float sp=pow(max(dot(Nb,normalize(uLight+vec3(0.0,0.0,1.0))),0.0),40.0)*smoothstep(-0.1,0.3,sunDot);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.92,0.94,1.0),0.25);
      totalEmissiveRadiance+=vec3(1.0,0.93,0.75)*(0.1+0.5*fres)+vec3(1.0)*(s*0.55+sp*0.8);`,
  });
  ss.reg.buildings.register({id: 'spires', name: 'Шпили с энергокольцами (мод)', build({rnd, spots, put}) {
    put('cyl', 0, 0, 0, 0.1, 2.2, 0.1, '#eef1f5');
    put('cone', 0, 0, 0, 0.1, 0.5, 0.1, '#ffffff', 2.2);
    put('glowRing', 0, 0, 0, 0.36, 0.7, 0.36, '#bfe8ff', 2.0);
    put('glow', 0, 0, 0, 0.08, 0.08, 0.08, '#fff6d8', 2.7);
    for (const [x, y] of spots(5 + Math.floor(rnd() * 3), 0.62, 0.24)) {
      if (Math.hypot(x, y) < 0.2) continue;
      const hgt = 0.5 + rnd() * 1.0;
      put('cyl', x, y, 0, 0.07, hgt, 0.07, rnd() < 0.5 ? '#d8dee6' : '#c9d1dc');
      put('cone', x, y, 0, 0.07, 0.25, 0.07, '#ffffff', hgt);
      if (rnd() < 0.5) put('glowRing', x, y, 0, 0.18, 0.6, 0.18, '#bfe8ff', hgt * 0.85);
    }
  }});
  ss.registerPack({
    format: 'sspace-pack', id: 'angels', name: 'Планета Ангелов', version: '1.0.0',
    terrains: [
      {id: 'megapolis', group: 'Небесный город', name: 'Серебряный мегаполис', color: '#d8dee6', h: 0.5, v: 0.2, fx: 'radiance', tex: 'city', bld: 'towers'},
      {id: 'spires', group: 'Небесный город', name: 'Небесные шпили', color: '#f2f4f8', h: 1.0, v: 0.4, tex: 'plates', fx: 'radiance', bld: 'spires'},
      {id: 'cathedral', group: 'Небесный город', name: 'Собор света', color: '#f2e8d0', h: 0.7, v: 0.1, tex: 'paving', fx: 'radiance', bld: 'temple'},
      {id: 'marble', group: 'Небесный город', name: 'Нанитовый мрамор', color: '#eef1f5', h: 0.3, v: 0.2, fx: 'glass', tex: 'rock'},
      {id: 'gardens', group: 'Сады', name: 'Сады света', color: '#f6e6a8', h: 0.2, v: 0.1, fx: 'glow', tex: 'grass'},
      {id: 'groves', group: 'Сады', name: 'Белые рощи', color: '#e8eedc', h: 0.4, v: 0.2, fx: 'radiance', tex: 'forest'},
      {id: 'mirror', group: 'Вода', name: 'Зеркальное море', color: '#cfe2f0', h: -0.5, v: 0.1, tex: 'seabed', fx: 'water'},
    ],
    poiKinds: [{id: 'choir', sym: '✧', name: 'Хор', color: '#ffe08a'}],
  }, 'мод ' + mod.id);

  ss.reg.generators.register({
    id: 'angels', name: 'Планета Ангелов (мод)', inhabited: true, icon: 'nanite', group: 'Обитаемые миры', desc: 'Серебряный нанитовый мегаполис с городами-кольцами на орбите.', preview: ['#d8dee6', '#f2f4f8', '#f6e6a8', '#cfe2f0'], atmosphere: {on: true, color: '#fff1c8'}, look: {halo: true},
    params: [
      {id: 'gardens', name: 'Сады', min: 0, max: 60, value: 20, unit: '%'},
      {id: 'mirror', name: 'Зеркальные моря', min: 0, max: 40, value: 12, unit: '%'},
      {id: 'spires', name: 'Небесных шпилей', min: 0, max: 40, value: 10},
      {id: 'cities', name: 'Колец орбитальных городов', min: 0, max: 8, value: 6},
    ],
    run({G, seed, params, type, util, look}) {
      // orbital ring cities (shown by the «Орбита» mod): inner rings narrow and tall, outer ones flat and wide, all joined
      const n = params.cities | 0;
      look({orbit: n ? [{type: 'ringcity', name: 'Города-кольца Ангелов', count: n, inner: 1.2, gap: 0.045, innerW: 0.03, outerW: 0.16 + n * 0.035,
        innerH: 0.11, outerH: 0.006, spokes: 16, elevators: 6, lights: 0.7, color: '#eef1f6', glow: '#ffe08a', spin: 0.05,
        towers: 0.8, roads: 0.8, air: 0.7, airColor: '#cfeeff'}] : []});
      const rnd = util.mulberry(seed), elev = util.makeNoise(seed), green = util.makeNoise(seed + 3), plan = util.makeNoise(seed + 6);
      const T = Object.fromEntries(['megapolis', 'spires', 'cathedral', 'marble', 'gardens', 'groves', 'mirror'].map(k => [k, type('angels:' + k)]));
      const e = new Float32Array(G.V), sorted = [];
      for (let c = 0; c < G.V; c++) { e[c] = elev(G.centers[c * 3] * 1.8 + 2, G.centers[c * 3 + 1] * 1.8 + 2, G.centers[c * 3 + 2] * 1.8 + 2, 4); sorted.push(e[c]); }
      sorted.sort((a, b) => a - b);
      const sea = sorted[Math.floor(params.mirror / 100 * (G.V - 1))];
      const out = new Uint8Array(G.V), gp = params.gardens / 100;
      for (let c = 0; c < G.V; c++) {
        const x = G.centers[c * 3] * 3, y = G.centers[c * 3 + 1] * 3, z = G.centers[c * 3 + 2] * 3;
        const g = green(x, y, z, 3), p = Math.abs(plan(x * 1.5, y * 1.5, z * 1.5, 2) - 0.5);
        let t = e[c] < sea ? T.mirror : g > 1 - gp * 1.2 ? (g > 1 - gp * 0.5 ? T.groves : T.gardens) : p < 0.03 ? T.marble : T.megapolis;
        out[c] = t;
      }
      for (let i = 0; i < params.spires; i++) { const c = Math.floor(rnd() * G.V); if (out[c] === T.megapolis) out[c] = rnd() < 0.3 ? T.cathedral : T.spires; }
      return out;
    },
  });

  // drifting motes of light: nanite swarms tending the city (look.halo)
  ss.particles.forLook('halo', {name: 'Искры нанитов над городом', icon: 'nanite', mod: 'Ангелы', count: 2200, r0: 1.01, r1: 1.5, size: 0.012, opacity: 0.9, additive: true, motion: 'rise', speed: 0.035,
    colors: [{color: '#ffe08a', weight: 4}, {color: '#ffffff', weight: 3}, {color: '#fff1c8', weight: 2}]});
}
