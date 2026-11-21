// Ghost world: a see-through, shimmering pale-blue planet.
// The generator sets look.ghost; while it is on, this mod makes the planet surface material translucent.
export function activate(ss, mod) {
  ss.reg.effects.register({
    id: 'ghost', name: 'Призрак: мерцание и свечение краёв (мод)',
    glsl: `float fres=pow(1.0-abs(normalize(vNv).z),2.0);
      float scan=0.5+0.5*sin(nP.y*80.0-uTime*2.5);
      float flick=0.85+0.15*sin(uTime*7.0+dot(nP,vec3(13.0,7.0,11.0)));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.6,0.85,1.0),0.35);
      totalEmissiveRadiance+=vec3(0.45,0.8,1.0)*(0.22+0.6*fres)*flick+vec3(0.3,0.6,1.0)*0.12*scan;`,
  });

  ss.registerPack({
    format: 'sspace-pack', id: 'ghost', name: 'Призрачный мир', version: '1.0.0',
    terrains: [
      {id: 'plain', group: 'Призрачные земли', name: 'Призрачная равнина', color: '#9fdcff', h: 0.1, v: 0.1, fx: 'ghost', tex: 'grass'},
      {id: 'forest', group: 'Призрачные земли', name: 'Эфирный лес', color: '#7fc8ff', h: 0.45, v: 0.2, fx: 'ghost', tex: 'forest'},
      {id: 'spires', group: 'Призрачные земли', name: 'Хрустальные шпили', color: '#d8f4ff', h: 1.9, v: 0.9, tex: 'crystal', fx: 'ghost'},
      {id: 'rift', group: 'Призрачные земли', name: 'Разлом', color: '#3a6aa0', h: -1.4, v: 0.5, fx: 'ghost', tex: 'rock'},
      {id: 'mist', group: 'Призрачные земли', name: 'Туманное море', color: '#5aa8e0', h: -0.8, v: 0.2, tex: 'flow', fx: 'water'},
      {id: 'echo', group: 'Призрачные земли', name: 'Эхо-руины', color: '#b8d8ff', h: 0.3, v: 0.2, tex: 'paving', fx: 'ghost', bld: 'ruins'},
    ],
    poiKinds: [{id: 'echo', sym: '◌', name: 'Эхо', color: '#bfe8ff'}],
  }, 'мод ' + mod.id);

  ss.reg.generators.register({
    id: 'ghost', name: 'Призрачный мир (мод)', icon: 'ghost', group: 'Аномальные', desc: 'Полупрозрачная голубая планета, хрустальные шпили, огоньки.', preview: ['#bfe8ff', '#5aa8e0', '#d8f4ff', '#b8d8ff'], atmosphere: {on: true, color: '#bfe8ff'}, look: {ghost: true, wisps: true},
    params: [
      {id: 'rifts', name: 'Разломы', min: 0, max: 100, value: 30, unit: '%'},
      {id: 'mist', name: 'Туманные моря', min: 0, max: 90, value: 35, unit: '%'},
    ],
    run({G, seed, params, type, util}) {
      const elev = util.makeNoise(seed), veins = util.makeNoise(seed + 4), wood = util.makeNoise(seed + 8);
      const T = {plain: type('ghost:plain'), forest: type('ghost:forest'), spires: type('ghost:spires'), rift: type('ghost:rift'), mist: type('ghost:mist'), echo: type('ghost:echo')};
      const sorted = [], out = new Uint8Array(G.V), e = new Float32Array(G.V);
      for (let c = 0; c < G.V; c++) { const x = G.centers[c * 3] * 2 + 5, y = G.centers[c * 3 + 1] * 2 + 5, z = G.centers[c * 3 + 2] * 2 + 5; e[c] = elev(x, y, z, 5); sorted.push(e[c]); }
      sorted.sort((a, b) => a - b);
      const sea = sorted[Math.floor(params.mist / 100 * (G.V - 1))], high = sorted[Math.floor(0.94 * (G.V - 1))];
      for (let c = 0; c < G.V; c++) {
        const x = G.centers[c * 3] * 3, y = G.centers[c * 3 + 1] * 3, z = G.centers[c * 3 + 2] * 3;
        const vein = Math.abs(veins(x, y, z, 3) - 0.5), w = wood(x * 1.3, y * 1.3, z * 1.3, 3);
        let t = e[c] < sea ? T.mist : e[c] > high ? T.spires : w > 0.58 ? T.forest : T.plain;
        if (t !== T.mist && vein < 0.03 * params.rifts / 30) t = T.rift;
        if (t === T.plain && w < 0.3 && ((c * 2654435761) >>> 0) % 97 === 0) t = T.echo;
        out[c] = t;
      }
      return out;
    },
  });

  // translucency while the planet's look says "ghost"; «Яркость» in the «Эффекты» window sets how solid the surface is
  const apply = () => {
    if (!ss.view || !ss.view.materials) return;
    const M = ss.view.materials, on = !!ss.particles.lookOf().ghost;
    const k = Math.max(0.1, Math.min(2, ss.particles.fxOf('ghost').opacity || 1)), op = Math.min(0.95, 0.5 * k);
    const m = M.surface;
    if (m.transparent !== on) { m.transparent = on; m.depthWrite = !on; m.needsUpdate = true; }
    m.opacity = on ? op : 1;
    M.water.opacity = on ? Math.min(0.9, 0.45 * k) : 0.8;
  };
  for (const e of ['doc:loaded', 'look:changed', 'level:changed', 'fx:changed', 'view:installed']) ss.hooks.on(e, apply);
  ss.particles.addToggle({key: 'ghost', name: 'Прозрачная поверхность', icon: 'ghost', mod: 'Призрак', tune: ['opacity'],
    note: '«Яркость» — насколько плотная поверхность: меньше — прозрачнее.'});
  ss.particles.forLook('wisps', {name: 'Блуждающие огоньки', icon: 'wisp', mod: 'Призрак', count: 900, r0: 1.01, r1: 1.2, size: 0.016, opacity: 0.8, additive: true, motion: 'drift', speed: 0.02,
    colors: [{color: '#bfe8ff', weight: 4}, {color: '#7fe3ff', weight: 3}, {color: '#ffffff', weight: 1}]});
}
