// Nanite swarm: a planet being eaten by self-replicating machines. Untouched land remains where the swarm has not reached.
export function activate(ss, mod) {
  ss.reg.effects.register({
    id: 'nanite', name: 'Наниты: бегущие металлические ячейки (мод)',
    glsl: `vec3 q=nP*55.0;float w=worley(q+vec3(uTime*0.35,uTime*0.12,uTime*0.27));
      float edge=1.0-smoothstep(0.0,0.09,abs(w-0.45));
      float pulse=0.5+0.5*sin(uTime*3.2+w*24.0);
      vec3 Nb=normalize(vNv);float sp=pow(max(dot(Nb,normalize(uLight+vec3(0.0,0.0,1.0))),0.0),28.0)*smoothstep(-0.1,0.3,sunDot);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.68,0.72,0.78),0.35)*(0.85+0.2*w);
      totalEmissiveRadiance+=vec3(0.35,0.9,1.0)*edge*(0.25+0.55*pulse)+vec3(0.9)*sp*0.6;`,
  });
  ss.reg.buildings.register({id: 'assembler', name: 'Шпили-сборщики (мод)', build({rnd, spots, put}) {
    for (const [x, y] of spots(3 + Math.floor(rnd() * 3), 0.6, 0.3)) {
      const hgt = 0.7 + rnd() * 1.1;
      put('cyl', x, y, 0, 0.07, hgt, 0.07, '#c9d1dc');
      put('cone', x, y, 0, 0.16, 0.25, 0.16, '#8f9aa8');
      put('glowRing', x, y, 0, 0.16, 1, 0.16, '#7fe3ff', hgt * 0.55);
      put('glow', x, y, 0, 0.06, 0.06, 0.06, '#bff3ff', hgt);
    }
  }});
  ss.registerPack({
    format: 'sspace-pack', id: 'nanite', name: 'Нанитовый рой', version: '1.0.0',
    terrains: [
      {id: 'sea', group: 'Рой', name: 'Нанитовое море', color: '#7d8590', h: -0.2, v: 0.1, tex: 'flow', fx: 'nanite'},
      {id: 'goo', group: 'Рой', name: 'Серая слизь', color: '#9aa0a8', h: 0.1, v: 0.15, fx: 'nanite', tex: 'dunes'},
      {id: 'spires', group: 'Рой', name: 'Шпили-сборщики', color: '#c9d1dc', h: 1.2, v: 0.6, tex: 'plates', fx: 'nanite', bld: 'assembler'},
      {id: 'pits', group: 'Рой', name: 'Перерабатывающая яма', color: '#3a3f46', h: -1.3, v: 0.4, fx: 'nanite', tex: 'rock'},
      {id: 'core', group: 'Рой', name: 'Ядро роя', color: '#7fe3ff', h: 0.6, v: 0.2, tex: 'flow', fx: 'glow'},
      {id: 'front', group: 'Рой', name: 'Фронт поглощения', color: '#5a6470', h: 0.15, v: 0.3, fx: 'nanite', tex: 'rock'},
    ],
    poiKinds: [{id: 'core', sym: '◉', name: 'Ядро роя', color: '#7fe3ff'}],
  }, 'мод ' + mod.id);

  ss.reg.generators.register({
    id: 'nanite-swarm', name: 'Нанитовый рой (мод)', icon: 'swarm', group: 'Аномальные', desc: 'Рой нанитов поглощает обычный мир.', preview: ['#7d8590', '#c9d1dc', '#7fe3ff', '#3fae4a'], atmosphere: {on: true, color: '#c0c8d0'}, look: {swarm: true},
    params: [
      {id: 'consumed', name: 'Поглощено роем', min: 0, max: 100, value: 70, unit: '%'},
      {id: 'cores', name: 'Ядер роя', min: 0, max: 20, value: 4},
    ],
    run(ctx) {
      const {G, seed, params, type, util} = ctx;
      // start from a normal living world, then let the swarm eat it
      // another mod may have replaced or removed «continents»: then start from plains and seas made here
      const cont = ss.reg.generators.get('continents');
      let base = null;
      try { base = cont ? cont.run({...ctx, params: {...Object.fromEntries((cont.params || []).map(p => [p.id, p.value])), water: 55}}) : null; } catch (e) { console.warn('[nanite-swarm] континенты не сработали', e); }
      if (!base || base.length !== G.V) { const n0 = util.makeNoise(seed + 40), sea = type('base:sea'), land = type('base:plains'); base = new Uint8Array(G.V); for (let c = 0; c < G.V; c++) base[c] = n0(G.centers[c * 3] * 2 + 3, G.centers[c * 3 + 1] * 2 + 3, G.centers[c * 3 + 2] * 2 + 3, 4) < 0.5 ? sea : land; }
      const spread = util.makeNoise(seed + 21), fx = util.makeNoise(seed + 22), rnd = util.mulberry(seed);
      const T = Object.fromEntries(['sea', 'goo', 'spires', 'pits', 'core', 'front'].map(k => [k, type('nanite:' + k)]));
      const water = new Set(['base:deep', 'base:sea', 'base:shallow', 'base:swamp', 'base:ice'].map(id => type(id)));
      const limit = 1 - params.consumed / 100;
      const out = new Uint8Array(G.V);
      for (let c = 0; c < G.V; c++) {
        const x = G.centers[c * 3] * 2.4 + 3, y = G.centers[c * 3 + 1] * 2.4 + 3, z = G.centers[c * 3 + 2] * 2.4 + 3;
        const s = spread(x, y, z, 4), f = fx(x * 2, y * 2, z * 2, 2);
        if (s < limit - 0.03) out[c] = base[c];
        else if (s < limit + 0.02) out[c] = T.front;
        else if (water.has(base[c])) out[c] = T.sea;
        else out[c] = f > 0.68 ? T.spires : f < 0.3 ? T.pits : T.goo;
      }
      for (let i = 0; i < params.cores; i++) { const c = Math.floor(rnd() * G.V); if (out[c] !== base[c]) { out[c] = T.core; for (const nb of G.nbr[c]) if (rnd() < 0.5) out[nb] = T.spires; } }
      return out;
    },
  });

  ss.particles.forLook('swarm', {name: 'Облако нанитов на орбите', icon: 'swarm', mod: 'Рой', count: 4500, r0: 1.08, r1: 1.5, size: 0.011, opacity: 0.9, additive: true, motion: 'orbit', speed: 0.05,
    colors: [{color: '#c9d1dc', weight: 5}, {color: '#7fe3ff', weight: 3}, {color: '#ffffff', weight: 1}]});
}
