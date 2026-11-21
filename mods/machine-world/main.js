// Machine world: an ecumenopolis of machines wrapped in orbital rings (look.rings = number of rings).
export function activate(ss, mod) {
  const {THREE} = ss, S = ss.scene;

  ss.reg.effects.register({
    id: 'circuit', name: 'Схемы: бегущие импульсы (мод)',
    glsl: `vec3 q=nP*40.0;vec3 f=fract(q);
      float line=max(max(step(0.93,f.x),step(0.93,f.y)),step(0.93,f.z));
      float pulse=fract(dot(floor(q),vec3(0.13,0.07,0.11))+uTime*0.6);
      float p=smoothstep(0.0,0.08,pulse)*smoothstep(0.3,0.08,pulse);
      float night=1.0-smoothstep(-0.15,0.25,sunDot);
      diffuseColor.rgb*=0.72;
      totalEmissiveRadiance+=vec3(0.2,0.8,1.0)*line*(0.15+0.9*p)*(0.5+0.7*night);`,
  });
  ss.reg.buildings.register({id: 'ringtower', name: 'Башни с кольцами (мод)', build({rnd, spots, put}) {
    for (const [x, y] of spots(2 + Math.floor(rnd() * 3), 0.55, 0.36)) {
      const hgt = 1.0 + rnd() * 1.2;
      put('box', x, y, rnd(), 0.16, hgt, 0.16, '#6f7a88');
      for (let i = 1; i <= 3; i++) put('glowRing', x, y, 0, 0.3, 0.8, 0.3, i % 2 ? '#7fe3ff' : '#ffd38a', hgt * i / 4);
      put('glow', x, y, 0, 0.07, 0.07, 0.07, '#ff5a3c', hgt);
    }
    put('box', 0, 0, 0, 0.9, 0.05, 0.9, '#3a4250');
  }});
  ss.registerPack({
    format: 'sspace-pack', id: 'machine', name: 'Планета машин', version: '1.0.0',
    terrains: [
      {id: 'mega', group: 'Машины', name: 'Мегаструктура', color: '#5d6470', h: 0.6, v: 0.3, tex: 'city', bld: 'towers'},
      {id: 'circuit', group: 'Машины', name: 'Схемные равнины', color: '#3a4250', h: 0.2, v: 0.05, tex: 'circuit', fx: 'circuit'},
      {id: 'factory', group: 'Машины', name: 'Заводские кварталы', color: '#6a6560', h: 0.4, v: 0.2, tex: 'city', bld: 'industry'},
      {id: 'rings', group: 'Машины', name: 'Башни с кольцами', color: '#8f9aa8', h: 0.9, v: 0.3, tex: 'city', bld: 'ringtower'},
      {id: 'conduit', group: 'Машины', name: 'Энергоканал', color: '#ff9f1c', h: -0.2, v: 0.02, tex: 'flow', fx: 'glow'},
      {id: 'coolant', group: 'Машины', name: 'Море охладителя', color: '#1d6a8a', h: -0.8, v: 0.2, tex: 'seabed', fx: 'water'},
      {id: 'port', group: 'Машины', name: 'Орбитальный лифт', color: '#d0d7e2', h: 0.5, v: 0.05, tex: 'plates', fx: 'circuit', bld: 'spaceport'},
    ],
    poiKinds: [{id: 'node', sym: '⌬', name: 'Узел', color: '#7fe3ff'}],
  }, 'мод ' + mod.id);

  ss.reg.generators.register({
    id: 'machine-world', name: 'Планета машин (мод)', inhabited: true, icon: 'gear', group: 'Обитаемые миры', desc: 'Сплошная экуменополия машин, кольца и патрули на орбите.', preview: ['#3a4250', '#ff9f1c', '#d0d7e2', '#1d6a8a'], atmosphere: {on: true, color: '#9fb8d8'}, look: {drones: true, smog: true},
    params: [
      {id: 'rings', name: 'Орбитальных колец', min: 0, max: 6, value: 3},
      {id: 'coolant', name: 'Моря охладителя', min: 0, max: 40, value: 8, unit: '%'},
      {id: 'lifts', name: 'Орбитальных лифтов', min: 0, max: 12, value: 4},
      {id: 'ships', name: 'Патрульных кораблей', min: 0, max: 400, value: 160},
    ],
    run({G, seed, params, type, util, look}) {
      const rnd = util.mulberry(seed), elev = util.makeNoise(seed), kind = util.makeNoise(seed + 4), lanes = util.makeNoise(seed + 8);
      const T = Object.fromEntries(['mega', 'circuit', 'factory', 'rings', 'conduit', 'coolant', 'port'].map(k => [k, type('machine:' + k)]));
      const e = new Float32Array(G.V), sorted = [];
      for (let c = 0; c < G.V; c++) { e[c] = elev(G.centers[c * 3] * 2 + 5, G.centers[c * 3 + 1] * 2 + 5, G.centers[c * 3 + 2] * 2 + 5, 4); sorted.push(e[c]); }
      sorted.sort((a, b) => a - b);
      const sea = sorted[Math.floor(params.coolant / 100 * (G.V - 1))];
      const out = new Uint8Array(G.V);
      for (let c = 0; c < G.V; c++) {
        const x = G.centers[c * 3] * 3, y = G.centers[c * 3 + 1] * 3, z = G.centers[c * 3 + 2] * 3;
        const k = kind(x, y, z, 3), lane = Math.abs(lanes(x * 1.2, y * 1.2, z * 1.2, 2) - 0.5);
        let t = e[c] < sea ? T.coolant : k > 0.66 ? T.factory : k < 0.34 ? T.circuit : T.mega;
        if (t !== T.coolant && lane < 0.022) t = T.conduit;
        else if (t === T.mega && k > 0.6) t = T.rings;
        out[c] = t;
      }
      for (let i = 0; i < params.lifts; i++) { const c = Math.floor(rnd() * G.V); if (out[c] !== T.coolant) out[c] = T.port; }
      // orbit: machine rings at different tilts, patrol fleets in several lanes, satellites and some junk
      const orbit = [];
      for (let i = 0; i < params.rings; i++) orbit.push({type: 'ring', name: 'Кольцо машин ' + (i + 1), radius: 1.2 + i * 0.15, width: 0.03 + rnd() * 0.05, height: 0.012 + rnd() * 0.02,
        tilt: Math.round((rnd() - 0.5) * 50), node: Math.round(rnd() * 360), lights: 0.7, spin: (0.1 + rnd() * 0.3) * (i % 2 ? -1 : 1), color: i % 2 ? '#8f9aa8' : '#5d6470'});
      const fleets = Math.min(4, Math.ceil(params.ships / 50));
      for (let f = 0; f < fleets; f++) {
        const cnt = Math.round(params.ships / fleets);
        if (cnt > 0) orbit.push({type: 'ships', name: 'Патруль ' + (f + 1), count: cnt, rmin: 1.1 + f * 0.12, rmax: 1.25 + f * 0.25, size: 0.018 + rnd() * 0.012,
          speed: 0.6 + rnd() * 0.8, lanes: 15 + f * 20, color: f % 2 ? '#aeb8c4' : '#6f7a88', engine: f % 2 ? '#ff9f1c' : '#7fe3ff'});
      }
      if (params.ships > 0) orbit.push({type: 'satellites', name: 'Спутники наблюдения', count: 40, rmin: 1.1, rmax: 2.2, size: 0.012, speed: 0.3, lanes: 90, color: '#d8dee6'});
      orbit.push({type: 'debris', name: 'Отработанные модули', radius: 1.9, spread: 0.08, count: 900, size: 0.01, tilt: 12, node: 40, spin: 0.2, color: '#6f7a88'});
      look({orbit});
      return out;
    },
  });

  // orbital rings and patrols are drawn by the «Орбита» mod from look.orbit; you can then edit them in the «Орбита» window

  // drone swarms in low orbit and industrial smog (window «Эффекты»)
  ss.particles.forLook('drones', {name: 'Рои дронов', icon: 'diamond', mod: 'Машины', count: 2400, r0: 1.04, r1: 1.18, size: 0.01, opacity: 1, additive: true, motion: 'orbit', speed: 0.07,
    colors: [{color: '#ffb347', weight: 3}, {color: '#7fe3ff', weight: 2}, {color: '#ff4a4a', weight: 1}]});
  ss.particles.forLook('smog', {name: 'Промышленный смог', icon: 'cloud', mod: 'Машины', count: 2600, r0: 1.01, r1: 1.1, size: 0.02, opacity: 0.3, motion: 'drift', speed: 0.02,
    colors: [{color: '#5a6470', weight: 3}, {color: '#7a8490', weight: 2}, {color: '#3a4048', weight: 2}]});
}
