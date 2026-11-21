// Example mod for SSpace. Copy this folder, rename it, change mod.json, and build from here.
// activate(ss, mod) runs once at startup, after the built-in content and packs are registered.

export function activate(ss, mod) {
  const {THREE} = ss;

  // 1) A surface texture written in GLSL. `q` is the position scaled by planet size; return a height 0..1.
  ss.reg.textures.register({
    id: 'moon-dust', name: 'Лунная пыль (мод)', scale: 1.1, strength: 0.08, tone: [0.78, 0.35],
    height: 'float w=worley(q*0.55);return smoothstep(0.05,0.55,w)*0.75+0.25*vnz(q*6.0);',
  });

  // 2) A shader effect. Variables: diffuseColor, totalEmissiveRadiance, nP, vP, uTime, uLightObj, sunDot.
  ss.reg.effects.register({
    id: 'aurora', name: 'Полярное сияние (мод)',
    glsl: 'float a=0.5+0.5*sin(uTime*1.3+nP.x*18.0+nP.z*11.0);float night=smoothstep(0.1,-0.3,sunDot);totalEmissiveRadiance+=vec3(0.2,0.95,0.6)*a*(0.15+0.6*night);',
  });

  // 3) A building style. Units are hex radii; put(kind, x, y, rotation, width, height, depth, color, lift, tilt).
  ss.reg.buildings.register({
    id: 'moonbase', name: 'Лунная база (мод)',
    build({rnd, spots, put}) {
      put('dome', 0, 0, 0, 0.32, 0.26, 0.32, '#dfe7ee');
      for (const [x, y] of spots(4, 0.62, 0.35)) {
        put('dome', x, y, 0, 0.14, 0.12, 0.14, '#c9d3dc');
        put('box', x * 0.5, y * 0.5, Math.atan2(y, x), Math.hypot(x, y) * 0.9, 0.05, 0.05, '#9aa4ae');
      }
      put('box', 0.55, -0.35, rnd(), 0.05, 0.6, 0.05, '#e6372e');
    },
  });

  // 4) Data: terrain types and a point-of-interest kind (same format as a JSON pack in /packs).
  ss.registerPack({
    format: 'sspace-pack', id: 'moon', name: 'Луна (мод)', version: '1.0.0',
    terrains: [
      {id: 'regolith', group: 'Луна', name: 'Реголит', color: '#9b978f', h: 0.1, v: 0.2, tex: 'moon-dust'},
      {id: 'mare', group: 'Луна', name: 'Лунное море', color: '#55524f', h: -0.25, v: 0.05, tex: 'moon-dust'},
      {id: 'rim', group: 'Луна', name: 'Вал кратера', color: '#b8b1a6', h: 1.3, v: 0.6, tex: 'rock'},
      {id: 'base', group: 'Луна', name: 'Лунная база', color: '#7d8590', h: 0.2, v: 0.05, tex: 'moon-dust', bld: 'moonbase'},
      {id: 'aurora-ice', group: 'Луна', name: 'Лёд с сиянием', color: '#cfe8ef', h: 0.3, v: 0.2, fx: 'aurora', tex: 'snow'},
    ],
    poiKinds: [{id: 'portal', sym: '◎', name: 'Портал', color: '#b48cff'}],
  }, 'мод ' + mod.id);

  // 5) A generator: appears in Планета → Генерация.
  ss.reg.generators.register({
    id: 'moon', name: 'Луна (мод)', icon: 'moon', group: 'Спутники', desc: 'Реголит и кратеры, без атмосферы.', preview: ['#9a968e', '#6f6b64', '#cfcac0'], atmosphere: {on: false}, // airless: the generator switches the atmosphere off
    params: [{id: 'craters', name: 'Кратеров', min: 2, max: 60, value: 18}],
    run({G, seed, params, type, util}) {
      const rnd = util.mulberry(seed), out = new Uint8Array(G.V).fill(type('moon:regolith'));
      const mare = type('moon:mare'), rim = type('moon:rim'), crater = type('base:crater');
      const noise = util.makeNoise(seed);
      for (let c = 0; c < G.V; c++) if (noise(G.centers[c * 3] * 2 + 5, G.centers[c * 3 + 1] * 2 + 5, G.centers[c * 3 + 2] * 2 + 5, 3) < 0.42) out[c] = mare;
      for (let i = 0; i < params.craters; i++) {
        const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u), cx = s * Math.cos(a), cy = u, cz = s * Math.sin(a);
        const r = 0.05 + rnd() * 0.18;
        for (let c = 0; c < G.V; c++) {
          const d = Math.acos(Math.min(1, G.centers[c * 3] * cx + G.centers[c * 3 + 1] * cy + G.centers[c * 3 + 2] * cz));
          if (d < r * 0.75) out[c] = crater; else if (d < r) out[c] = rim;
        }
      }
      return out;
    },
  });

  // 6) A tool: «Портал» drops a portal pin with one click (key O).
  ss.reg.tools.register({
    id: 'moon-portal', name: 'Портал (мод)', key: 'O', hint: 'Клик — поставить портал',
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></svg>',
    down: ({c, ss}) => { const i = ss.pois.add(c, 'moon:portal'); ss.pois.update(i, {name: 'Портал ' + (i + 1)}); },
  });

  // 7) A window and a menu entry.
  ss.reg.windows.register({
    id: 'moon-info', title: 'Луна: статистика', dock: 'left', order: 5, width: 260, levels: ['planet'],
    render(body, ss) {
      const out = ss.util.h('div', {class: 'sec-body'});
      body.appendChild(out);
      const update = () => {
        const n = ss.doc ? ss.doc.pois.filter(p => p.kind === 'moon:portal').length : 0;
        out.innerHTML = '';
        out.append(ss.util.h('div', {class: 'count'}, ss.util.h('b', null, String(n)), ' порталов'),
          ss.util.h('div', {class: 'note'}, 'Это окно добавлено модом example-moon.'));
      };
      const off = ss.hooks.on('pois:changed', update);
      update();
      return {update, destroy: off};
    },
  });
  ss.reg.menus.register({id: 'moon:new', menu: 'Моды', order: 1010, label: 'Луна: превратить открытую планету в луну',
    enabled: (ss) => ss.space.nav.level === 'planet',
    action: async (ss) => { if (await ss.ui.confirm('Заменить карту этой планеты лунной поверхностью? Атмосфера выключится.', 'Сделать луну')) ss.newPlanet({n: 16, generator: 'moon'}); }});
  ss.reg.menus.register({id: 'moon:win', menu: 'Моды', order: 1020, label: 'Луна: окно статистики', action: (ss) => ss.ui.toggleWindow('moon-info')});

  // 8) A filter: add text to the hover line in the status bar.
  ss.hooks.on('cellInfo', (text, c) => (ss.doc && ss.doc.palette[ss.doc.cells[c]]?.src?.startsWith('moon:') ? text + ' · лунный грунт' : text));

  // 9) A patch: wrap a core function. Here every new pin of kind "portal" glows in the log.
  ss.patch(ss.pois, 'add', (orig, c, kind) => {
    const i = orig(c, kind);
    if (kind === 'moon:portal') console.log(`[${mod.id}] портал на клетке ${c}`);
    return i;
  });

  // 10) Per-frame hook: the atmosphere glows violet while the planet has a portal
  //     (back to the planet's own atmosphere color otherwise).
  const atmo = ss.scene.atmo.material.uniforms.uColor.value, violet = new THREE.Color(0.75, 0.55, 1.0);
  let tinted = false;
  ss.hooks.on('frame', () => {
    const has = !!(ss.doc && ss.doc.pois.some(p => p.kind === 'moon:portal'));
    if (has !== tinted) { if (has) atmo.copy(violet); else atmo.set((ss.doc && ss.doc.atmo && ss.doc.atmo.color) || '#6badff'); tinted = has; }
  });
  ss.hooks.on('doc:loaded', () => { tinted = false; });

  // 11) A particle effect for the «Эффекты» window (not switched on by the generator: a moon has no air to hold dust)
  ss.particles.forLook('moondust', {name: 'Лунная пыль', icon: 'dots', mod: 'Луна', note: 'Пыль, поднятая метеоритами, висит низко над поверхностью.',
    count: 2000, r0: 1.0, r1: 1.05, size: 0.009, opacity: 0.5, motion: 'drift', speed: 0.006, colors: [{color: '#b8b4ac', weight: 3}, {color: '#8a8680', weight: 2}]});
}
