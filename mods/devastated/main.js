// Devastated world: a planet after a war. Scorched land, bomb craters, dry seabeds, ruins; dust storms (look.dust).
export function activate(ss, mod) {
  ss.reg.effects.register({
    id: 'smolder', name: 'Тление: тусклые угли и дым (мод)',
    glsl: `vec3 q=nP*35.0;float sm=fbm3(q+vec3(uTime*0.05,0.0,uTime*0.04));
      vec3 c=floor(vP*110.0);float h=fract(sin(dot(c,vec3(12.9898,78.233,37.719)))*43758.5453);
      float e=pow(max(0.0,sin(uTime*1.2+h*35.0)),8.0)*step(0.8,h);
      diffuseColor.rgb*=0.75+0.35*sm;
      totalEmissiveRadiance+=vec3(1.0,0.35,0.08)*e*0.6*(1.0-smoothstep(-0.1,0.3,sunDot)*0.5);`,
  });
  ss.registerPack({
    format: 'sspace-pack', id: 'waste', name: 'Опустошённый мир', version: '1.0.0',
    terrains: [
      {id: 'scorched', group: 'Пепелище', name: 'Выжженная земля', color: '#4a3a30', h: 0.15, v: 0.2, tex: 'rock'},
      {id: 'dust', group: 'Пепелище', name: 'Пыльные равнины', color: '#a8906a', h: 0.1, v: 0.15, tex: 'dunes'},
      {id: 'burnt', group: 'Пепелище', name: 'Сгоревший лес', color: '#3b332c', h: 0.35, v: 0.2, fx: 'smolder', tex: 'forest'},
      {id: 'crater', group: 'Пепелище', name: 'Воронка', color: '#2e2723', h: -1.0, v: 0.4, fx: 'smolder', tex: 'rock'},
      {id: 'seabed', group: 'Пепелище', name: 'Высохшее море', color: '#cbbf9e', h: -0.7, v: 0.2, tex: 'dunes'},
      {id: 'salt', group: 'Пепелище', name: 'Соляная корка', color: '#e3dccb', h: -0.4, v: 0.05, tex: 'cracked', fx: 'sparkle'},
      {id: 'puddle', group: 'Пепелище', name: 'Ядовитая лужа', color: '#7a8f4a', h: -0.3, v: 0.1, tex: 'seabed', fx: 'water'},
      {id: 'ruins', group: 'Руины', name: 'Руины города', color: '#6a625a', h: 0.3, v: 0.2, tex: 'city', bld: 'ruins'},
      {id: 'fortress', group: 'Руины', name: 'Разбитая крепость', color: '#5a534d', h: 0.9, v: 0.3, fx: 'smolder', tex: 'rock', bld: 'ruins'},
      {id: 'refuge', group: 'Руины', name: 'Лагерь выживших', color: '#8a6a4a', h: 0.2, v: 0.05, tex: 'grass', bld: 'tents'},
    ],
    poiKinds: [{id: 'wreck', sym: '⚙', name: 'Обломки', color: '#b8a888'}],
  }, 'мод ' + mod.id);

  ss.reg.generators.register({
    id: 'devastated', name: 'Опустошённый мир (мод)', icon: 'blast', group: 'Суровые миры', desc: 'Мир после войны: выжженная земля, высохшие моря, пыль и дым.', preview: ['#5a4a3a', '#e3dccb', '#8a7458', '#3a3430'], atmosphere: {on: true, color: '#c8a070'}, look: {dust: true, smoke: true},
    params: [
      {id: 'ruin', name: 'Разрушения', min: 0, max: 100, value: 60, unit: '%'},
      {id: 'craters', name: 'Воронок', min: 0, max: 80, value: 24},
      {id: 'seas', name: 'Остатки морей', min: 0, max: 40, value: 8, unit: '%'},
      {id: 'refuges', name: 'Лагерей выживших', min: 0, max: 20, value: 4},
    ],
    run({G, seed, params, type, util}) {
      const rnd = util.mulberry(seed), elev = util.makeNoise(seed), cover = util.makeNoise(seed + 2), towns = util.makeNoise(seed + 5);
      const T = Object.fromEntries(['scorched', 'dust', 'burnt', 'crater', 'seabed', 'salt', 'puddle', 'ruins', 'fortress', 'refuge'].map(k => [k, type('waste:' + k)]));
      const at = (c, k, s) => [G.centers[c * 3] * k + s, G.centers[c * 3 + 1] * k + s, G.centers[c * 3 + 2] * k + s];
      const e = new Float32Array(G.V), sorted = [];
      for (let c = 0; c < G.V; c++) { e[c] = elev(...at(c, 1.8, 6), 5); sorted.push(e[c]); }
      sorted.sort((a, b) => a - b);
      const q = (f) => sorted[Math.min(G.V - 1, Math.floor(f * (G.V - 1)))];
      const oldSea = q(0.45), puddles = q(params.seas / 100 * 0.45), ruin = params.ruin / 100;
      const out = new Uint8Array(G.V);
      for (let c = 0; c < G.V; c++) {
        const v = cover(...at(c, 3, 2), 3), town = towns(...at(c, 4, 9), 3);
        let t;
        if (e[c] < puddles) t = T.puddle;
        else if (e[c] < oldSea) t = v > 0.62 ? T.salt : T.seabed;
        else if (town > 1 - ruin * 0.3) t = town > 1 - ruin * 0.08 ? T.fortress : T.ruins;
        else if (v > 0.6) t = rnd() < ruin ? T.burnt : T.scorched;
        else t = v < 0.38 ? T.dust : T.scorched;
        out[c] = t;
      }
      const blob = (c0, r, fn) => {
        const d = new Map([[c0, 0]]), q2 = [c0];
        for (let j = 0; j < q2.length; j++) { const c = q2[j], dc = d.get(c); if (dc >= r) continue; for (const nb of G.nbr[c]) if (!d.has(nb)) { d.set(nb, dc + 1); q2.push(nb); } }
        for (const [c, dd] of d) fn(c, dd);
      };
      const scale = Math.max(1, G.n / 12);
      for (let i = 0; i < params.craters; i++) { const r = Math.round(scale * rnd() * 1.5); blob(Math.floor(rnd() * G.V), r, (c) => { out[c] = T.crater; }); }
      for (let i = 0; i < params.refuges; i++) { const c = Math.floor(rnd() * G.V); if (out[c] !== T.puddle && out[c] !== T.crater) out[c] = T.refuge; }
      return out;
    },
  });

  ss.particles.forLook('dust', {name: 'Пыльная буря', icon: 'wind', mod: 'Пустошь', count: 3000, r0: 1.01, r1: 1.16, size: 0.016, opacity: 0.55, motion: 'drift', speed: 0.06,
    colors: [{color: '#b89a70', weight: 5}, {color: '#8a7458', weight: 4}, {color: '#d8c09a', weight: 2}]});
  ss.particles.forLook('smoke', {name: 'Дым пожарищ', icon: 'cloud', mod: 'Пустошь', count: 1800, r0: 1.01, r1: 1.3, size: 0.022, opacity: 0.35, motion: 'rise', speed: 0.015, jitter: 0.006,
    colors: [{color: '#3a3430', weight: 4}, {color: '#5a524a', weight: 3}, {color: '#7a6a5a', weight: 1}]});
}
