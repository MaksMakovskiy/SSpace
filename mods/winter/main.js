// Winter world: snow and ice everywhere, a few open-water polynyas, snowy forests; falling snow (look.snow).
export function activate(ss, mod) {
  ss.reg.effects.register({
    id: 'frost', name: 'Иней: холодный блеск (мод)',
    glsl: `vec3 c=floor(vP*170.0);float h=fract(sin(dot(c,vec3(12.9898,78.233,37.719)))*43758.5453);
      float s=pow(max(0.0,sin(uTime*1.6+h*50.0)),30.0)*step(0.6,h)*smoothstep(-0.1,0.3,sunDot);
      float fres=pow(1.0-abs(normalize(vNv).z),2.5);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.86,0.93,1.0),0.15);
      totalEmissiveRadiance+=vec3(0.85,0.95,1.0)*s+vec3(0.35,0.55,0.8)*fres*0.25;`,
  });
  ss.registerPack({
    format: 'sspace-pack', id: 'winter', name: 'Зимний мир', version: '1.0.0',
    terrains: [
      {id: 'snow', group: 'Снега', name: 'Снежные поля', color: '#f2f6fa', h: 0.2, v: 0.15, fx: 'frost', tex: 'snow'},
      {id: 'drifts', group: 'Снега', name: 'Сугробы и торосы', color: '#e2ecf4', h: 0.5, v: 0.4, fx: 'frost', tex: 'snow'},
      {id: 'sheet', group: 'Снега', name: 'Ледяной щит', color: '#cfe6f2', h: 0.8, v: 0.3, tex: 'cracked', fx: 'frost'},
      {id: 'peaks', group: 'Снега', name: 'Ледяные пики', color: '#e6f2fa', h: 2.3, v: 0.9, fx: 'frost', tex: 'rock'},
      {id: 'taiga', group: 'Леса', name: 'Заснеженная тайга', color: '#5f7f78', h: 0.45, v: 0.2, tex: 'forest'},
      {id: 'tundra', group: 'Леса', name: 'Мёрзлая тундра', color: '#9aa898', h: 0.15, v: 0.1, tex: 'grass'},
      {id: 'frozen', group: 'Вода', name: 'Замёрзшее море', color: '#bcd9ea', h: -0.05, v: 0.05, tex: 'cracked', fx: 'frost'},
      {id: 'floe', group: 'Вода', name: 'Льдины', color: '#9fc6dc', h: -0.15, v: 0.1, fx: 'frost', tex: 'snow'},
      {id: 'polynya', group: 'Вода', name: 'Полынья', color: '#24476b', h: -0.9, v: 0.2, tex: 'seabed', fx: 'water'},
      {id: 'outpost', group: 'Поселения', name: 'Полярная станция', color: '#a8c0cc', h: 0.25, v: 0.05, tex: 'snow', bld: 'research'},
    ],
    poiKinds: [{id: 'blizzard', sym: '❄', name: 'Буран', color: '#cfe6ff'}],
  }, 'мод ' + mod.id);

  ss.reg.generators.register({
    id: 'winter', name: 'Зимний мир (мод)', icon: 'snowflake', group: 'Суровые миры', desc: 'Снег и лёд, замёрзшие моря, полыньи, метели.', preview: ['#eef3f7', '#cfe6f2', '#24476b', '#5d7a6a'], atmosphere: {on: true, color: '#d8eeff'}, look: {snow: true, blizzard: false},
    params: [
      {id: 'water', name: 'Открытая вода', min: 0, max: 50, value: 10, unit: '%'},
      {id: 'frozen', name: 'Замёрзшие моря', min: 0, max: 60, value: 30, unit: '%'},
      {id: 'forest', name: 'Леса', min: 0, max: 60, value: 18, unit: '%'},
    ],
    run({G, seed, params, type, util}) {
      const rnd = util.mulberry(seed), elev = util.makeNoise(seed), wood = util.makeNoise(seed + 3), cracks = util.makeNoise(seed + 7);
      const T = Object.fromEntries(['snow', 'drifts', 'sheet', 'peaks', 'taiga', 'tundra', 'frozen', 'floe', 'polynya', 'outpost'].map(k => [k, type('winter:' + k)]));
      const e = new Float32Array(G.V), sorted = [];
      const at = (c, k, s) => [G.centers[c * 3] * k + s, G.centers[c * 3 + 1] * k + s, G.centers[c * 3 + 2] * k + s];
      for (let c = 0; c < G.V; c++) { e[c] = elev(...at(c, 2, 4), 5); sorted.push(e[c]); }
      sorted.sort((a, b) => a - b);
      const q = (f) => sorted[Math.min(G.V - 1, Math.floor(f * (G.V - 1)))];
      const wPart = params.water / 100, fPart = params.frozen / 100;
      const open = q(wPart), sea = q(Math.min(0.95, wPart + fPart)), high = q(0.93), mid = q(0.8);
      const out = new Uint8Array(G.V);
      for (let c = 0; c < G.V; c++) {
        const w = wood(...at(c, 3, 1), 3), lat = Math.abs(G.centers[c * 3 + 1]);
        let t;
        if (e[c] < open) t = lat > 0.85 ? T.frozen : T.polynya;
        else if (e[c] < sea) t = Math.abs(cracks(...at(c, 5, 2), 2) - 0.5) < 0.04 ? T.floe : T.frozen;
        else if (e[c] > high) t = T.peaks;
        else if (e[c] > mid) t = lat > 0.6 ? T.sheet : T.drifts;
        else if (lat < 0.7 && w > 1 - params.forest / 100 * 1.4) t = T.taiga;
        else if (lat < 0.5 && w < 0.35) t = T.tundra;
        else t = T.snow;
        out[c] = t;
      }
      for (let i = 0; i < 3; i++) { const c = Math.floor(rnd() * G.V); if (out[c] === T.snow || out[c] === T.tundra) out[c] = T.outpost; }
      return out;
    },
  });

  ss.particles.forLook('snow', {name: 'Снегопад', icon: 'snowflake', mod: 'Зима', count: 3200, r0: 1.01, r1: 1.4, size: 0.012, opacity: 0.9, motion: 'fall', speed: 0.022,
    colors: [{color: '#ffffff', weight: 6}, {color: '#d8ecff', weight: 3}]});
  ss.particles.forLook('blizzard', {name: 'Метель', icon: 'wind', mod: 'Зима', note: 'Снег, который ветер несёт вокруг планеты.', count: 3500, r0: 1.01, r1: 1.1, size: 0.01, opacity: 0.75, motion: 'drift', speed: 0.12,
    colors: [{color: '#ffffff', weight: 5}, {color: '#cfe4ff', weight: 3}]});
}
