// Inferno world: molten magma, smouldering basalt, ash dunes; the generator turns on falling ash and embers (look.ash, look.embers).
export function activate(ss, mod) {
  const {THREE} = ss;

  ss.reg.effects.register({
    id: 'magma', name: 'Магма: текущие трещины (мод)',
    glsl: `vec3 q=nP*22.0;float f=fbm3(q+vec3(0.0,uTime*0.15,uTime*0.07));
      float cr=1.0-smoothstep(0.02,0.12,abs(f-0.5));float pulse=0.7+0.3*sin(uTime*1.6+f*12.0);
      diffuseColor.rgb=mix(vec3(0.12,0.05,0.03),diffuseColor.rgb,0.35+0.65*f);
      totalEmissiveRadiance+=vec3(1.0,0.45,0.1)*(0.5*f+0.9*cr)*pulse;`,
  });
  ss.reg.effects.register({
    id: 'embers', name: 'Угли: тлеющие искры (мод)',
    glsl: `vec3 c=floor(vP*120.0);float h=fract(sin(dot(c,vec3(12.9898,78.233,37.719)))*43758.5453);
      float e=pow(max(0.0,sin(uTime*1.8+h*40.0)),6.0)*step(0.7,h);
      totalEmissiveRadiance+=vec3(1.0,0.35,0.05)*e*0.9+vec3(0.25,0.06,0.0)*0.15;`,
  });

  ss.registerPack({
    format: 'sspace-pack', id: 'inferno', name: 'Раскалённый мир', version: '1.0.0',
    terrains: [
      {id: 'magma', group: 'Пекло', name: 'Магматическое море', color: '#ff5a1a', h: -0.3, v: 0.1, tex: 'flow', fx: 'magma'},
      {id: 'river', group: 'Пекло', name: 'Лавовая река', color: '#ff8a3a', h: -0.1, v: 0.05, tex: 'flow', fx: 'magma'},
      {id: 'cracks', group: 'Пекло', name: 'Огненные трещины', color: '#3a1a14', h: -0.6, v: 0.3, tex: 'lavacrust', fx: 'magma'},
      {id: 'basalt', group: 'Пекло', name: 'Тлеющий базальт', color: '#2a2422', h: 0.3, v: 0.4, fx: 'embers', tex: 'rock'},
      {id: 'ash', group: 'Пекло', name: 'Пепельные дюны', color: '#5a5450', h: 0.15, v: 0.2, tex: 'dunes'},
      {id: 'sulfur', group: 'Пекло', name: 'Серные поля', color: '#d8c23a', h: 0.1, v: 0.1, fx: 'sparkle', tex: 'rock'},
      {id: 'peaks', group: 'Пекло', name: 'Огненные пики', color: '#3a2420', h: 2.6, v: 0.8, fx: 'embers', tex: 'rock'},
      {id: 'forge', group: 'Пекло', name: 'Кузня', color: '#6a3a2a', h: 0.3, v: 0.05, tex: 'plates', fx: 'embers', bld: 'industry'},
    ],
    poiKinds: [{id: 'eruption', sym: '▲', name: 'Извержение', color: '#ff7a3a'}],
  }, 'мод ' + mod.id);

  ss.reg.generators.register({
    id: 'inferno', name: 'Раскалённый мир (мод)', icon: 'flame', group: 'Суровые миры', desc: 'Магма, тлеющий базальт, пепел и искры.', preview: ['#ff5a1a', '#3a1a14', '#6a3a2a', '#ff8a3a'], atmosphere: {on: true, color: '#ff7a3a'}, look: {ash: true, embers: true},
    params: [
      {id: 'magma', name: 'Магма', min: 5, max: 80, value: 35, unit: '%'},
      {id: 'volcanoes', name: 'Вулканов', min: 0, max: 30, value: 8},
    ],
    run({G, seed, params, type, util}) {
      const rnd = util.mulberry(seed), elev = util.makeNoise(seed), mat = util.makeNoise(seed + 6), veins = util.makeNoise(seed + 12);
      const T = {magma: type('inferno:magma'), river: type('inferno:river'), cracks: type('inferno:cracks'), basalt: type('inferno:basalt'),
        ash: type('inferno:ash'), sulfur: type('inferno:sulfur'), peaks: type('inferno:peaks'), volcano: type('base:volcano'), forge: type('inferno:forge')};
      const e = new Float32Array(G.V), sorted = [];
      for (let c = 0; c < G.V; c++) { const x = G.centers[c * 3] * 2 + 9, y = G.centers[c * 3 + 1] * 2 + 9, z = G.centers[c * 3 + 2] * 2 + 9; e[c] = elev(x, y, z, 5); sorted.push(e[c]); }
      sorted.sort((a, b) => a - b);
      const sea = sorted[Math.floor(params.magma / 100 * (G.V - 1))], high = sorted[Math.floor(0.9 * (G.V - 1))];
      const out = new Uint8Array(G.V);
      for (let c = 0; c < G.V; c++) {
        const x = G.centers[c * 3] * 3, y = G.centers[c * 3 + 1] * 3, z = G.centers[c * 3 + 2] * 3;
        const m = mat(x, y, z, 3), v = Math.abs(veins(x * 1.3, y * 1.3, z * 1.3, 3) - 0.5);
        let t = e[c] < sea ? T.magma : e[c] > high ? T.peaks : m > 0.62 ? T.ash : m < 0.35 ? T.sulfur : T.basalt;
        if (t !== T.magma && t !== T.peaks && v < 0.025) t = T.river;
        else if (t === T.basalt && v < 0.05) t = T.cracks;
        out[c] = t;
      }
      for (let i = 0; i < params.volcanoes; i++) {
        const c0 = Math.floor(rnd() * G.V); out[c0] = T.volcano;
        for (const nb of G.nbr[c0]) if (rnd() < 0.7) out[nb] = T.peaks;
      }
      if (rnd() < 0.9) out[Math.floor(rnd() * G.V)] = T.forge;
      return out;
    },
  });

  // ---------- falling ash and rising embers (window «Эффекты») ----------
  ss.particles.forLook('ash', {name: 'Падающий пепел', icon: 'ash', mod: 'Пекло', count: 3500, r0: 1.02, r1: 1.4, size: 0.014, opacity: 0.85, motion: 'fall', speed: 0.03, jitter: 0.012,
    colors: [{color: '#5a5650', weight: 3}, {color: '#7a746c', weight: 3}, {color: '#9a948a', weight: 2}, {color: '#ff9a3a', weight: 1}]});
  ss.particles.forLook('embers', {name: 'Искры и угли', icon: 'spark', mod: 'Пекло', count: 1400, r0: 1.0, r1: 1.25, size: 0.012, opacity: 0.95, additive: true, motion: 'rise', speed: 0.05,
    colors: [{color: '#ff7a3a', weight: 4}, {color: '#ffb347', weight: 3}, {color: '#ffe08a', weight: 1}]});
}
