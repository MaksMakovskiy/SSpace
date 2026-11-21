// Shattered planet: a world broken by a catastrophe. Great rifts down to the glowing core, impact holes,
// raised crust slabs, boiled-off seas, ruins of the old life; chunks of the planet and debris on the orbit.
export function activate(ss, mod) {
  const {THREE} = ss;

  ss.reg.effects.register({
    id: 'coreglow', name: 'Ядро: раскалённое свечение (мод)',
    glsl: `vec3 q=nP*18.0;float f=fbm3(q+vec3(uTime*0.12,-uTime*0.08,uTime*0.05));float pulse=0.75+0.25*sin(uTime*1.3+f*9.0);
      diffuseColor.rgb=mix(vec3(0.5,0.08,0.02),diffuseColor.rgb,f);
      totalEmissiveRadiance+=vec3(1.0,0.42,0.08)*(0.6+0.9*f)*pulse+vec3(1.0,0.85,0.5)*pow(f,6.0)*1.5;`,
  });
  ss.reg.effects.register({
    id: 'riftglow', name: 'Разлом: свечение из глубины (мод)',
    glsl: `float f=fbm3(nP*30.0+vec3(0.0,uTime*0.1,0.0));float edge=smoothstep(0.45,0.8,f);
      diffuseColor.rgb*=0.6+0.4*f;totalEmissiveRadiance+=vec3(1.0,0.3,0.05)*edge*(0.35+0.2*sin(uTime*2.0+f*20.0));`,
  });

  ss.registerPack({
    format: 'sspace-pack', id: 'broken', name: 'Разрушенная планета', version: '1.0.0',
    terrains: [
      {id: 'core', group: 'Разрушенный мир', name: 'Обнажённое ядро', color: '#ff6a1a', h: -3, v: 0, fx: 'coreglow', tex: 'flow'},
      {id: 'rift', group: 'Разрушенный мир', name: 'Разлом', color: '#2a1410', h: -2.2, v: 0.4, fx: 'riftglow', tex: 'lavacrust'},
      {id: 'crust', group: 'Разрушенный мир', name: 'Расколотая кора', color: '#6a5a50', h: 0.3, v: 0.4, tex: 'cracked'},
      {id: 'slab', group: 'Разрушенный мир', name: 'Вздыбленные плиты', color: '#5a4c44', h: 1.8, v: 0.9, tex: 'rock'},
      {id: 'shards', group: 'Разрушенный мир', name: 'Кристаллизованные осколки', color: '#9aa8b8', h: 1.2, v: 0.8, fx: 'sparkle', tex: 'crystal'},
      {id: 'ash', group: 'Разрушенный мир', name: 'Пепел катастрофы', color: '#4a4440', h: 0.1, v: 0.15, tex: 'dunes'},
      {id: 'deadsea', group: 'Разрушенный мир', name: 'Выкипевшее море', color: '#38383e', h: -0.7, v: 0.2, tex: 'cracked'},
      {id: 'glass', group: 'Разрушенный мир', name: 'Спёкшееся стекло', color: '#2f4a4a', h: 0.05, v: 0.05, fx: 'glass', tex: 'cracked'},
      {id: 'ruins', group: 'Разрушенный мир', name: 'Руины цивилизации', color: '#5d574f', h: 0.25, v: 0.1, tex: 'city', bld: 'ruins'},
    ],
    poiKinds: [{id: 'impact', sym: '☄', name: 'Место удара', color: '#ff6a1a'}],
  }, 'мод ' + mod.id);

  // ---------- orbit: big jagged chunks of the planet, some showing the hot side ----------
  if (ss.orbit) {
    const rock = (seed) => {
      const g = new THREE.IcosahedronGeometry(1, 1), P = g.attributes.position;
      const r = ss.util.mulberry(seed), scale = [0.7 + r() * 0.6, 0.5 + r() * 0.5, 0.6 + r() * 0.7];
      // jitter shared corners the same way: key by rounded position
      const off = new Map();
      for (let i = 0; i < P.count; i++) {
        const key = [P.getX(i), P.getY(i), P.getZ(i)].map(v => Math.round(v * 1000)).join(',');
        if (!off.has(key)) off.set(key, 0.65 + r() * 0.55);
        const f = off.get(key); P.setXYZ(i, P.getX(i) * f * scale[0], P.getY(i) * f * scale[1], P.getZ(i) * f * scale[2]);
      }
      g.computeVertexNormals(); return g;
    };
    ss.orbit.registerType({
      id: 'fragments', name: 'Осколки планеты', icon: 'shard', group: 'Обломки и пояса',
      params: [
        {id: 'count', name: 'Количество', min: 1, max: 80, step: 1, value: 12},
        {id: 'rmin', name: 'Орбита от', min: 1.1, max: 3.5, step: 0.01, value: 1.3},
        {id: 'rmax', name: 'Орбита до', min: 1.1, max: 3.5, step: 0.01, value: 2.4},
        {id: 'size', name: 'Размер', min: 0.01, max: 0.3, step: 0.005, value: 0.07},
        {id: 'hot', name: 'Доля раскалённых', min: 0, max: 1, step: 0.05, value: 0.35},
        {id: 'lanes', name: 'Разброс орбит, °', min: 0, max: 90, step: 1, value: 25},
        {id: 'speed', name: 'Скорость', min: 0, max: 2, step: 0.05, value: 0.4},
        {id: 'color', name: 'Цвет коры', kind: 'color', value: '#6a5a50'},
      ],
      build(it) {
        const g = new THREE.Group(), r = ss.util.mulberry(ss.orbit.seedOf && (it._seed || it.id) ? ss.orbit.seedOf(it) : Math.floor((it.rmin + it.rmax + it.size) * 1e5) + (it.count | 0));
        const geos = [0, 1, 2, 3, 4, 5].map(i => rock(i * 977 + 13));
        const cold = new THREE.MeshPhongMaterial({color: it.color, flatShading: true, shininess: 4});
        const hot = new THREE.MeshPhongMaterial({color: it.color, emissive: 0xff4a10, emissiveIntensity: 0.55, flatShading: true, shininess: 4});
        const items = [], D = Math.PI / 180;
        for (let i = 0; i < (it.count | 0); i++) {
          const m = new THREE.Mesh(geos[i % geos.length], r() < it.hot ? hot : cold);
          const s = it.size * (0.35 + r() * 1.1); m.scale.setScalar(s);
          const o = {m, rad: it.rmin + r() * Math.max(0, it.rmax - it.rmin), ph: r() * Math.PI * 2, node: r() * Math.PI * 2, inc: (r() - 0.5) * 2 * it.lanes * D,
            spin: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.5)};
          o.w = (0.5 + r() * 0.8) / Math.pow(o.rad, 1.5);
          items.push(o); g.add(m);
        }
        const place = () => {
          for (const o of items) {
            const ca = Math.cos(o.node), sa = Math.sin(o.node), ci = Math.cos(o.inc), si = Math.sin(o.inc), c = Math.cos(o.ph), s = Math.sin(o.ph);
            o.m.position.set((ca * c - sa * ci * s) * o.rad, si * s * o.rad, (sa * c + ca * ci * s) * o.rad);
          }
        };
        place();
        g.userData.tick = (dt) => { const k = it.speed * 0.2 * dt; for (const o of items) { o.ph += o.w * k; o.m.rotation.x += o.spin.x * dt; o.m.rotation.y += o.spin.y * dt; o.m.rotation.z += o.spin.z * dt; } place(); };
        return g;
      },
    });
  }

  // ---------- generator ----------
  ss.reg.generators.register({
    id: 'shattered', name: 'Разрушенная планета (мод)', icon: 'crack', group: 'Разрушенные миры',
    desc: 'Мир после катастрофы: разломы до раскалённого ядра, пробоины, вздыбленная кора, осколки на орбите.',
    preview: ['#6a5a50', '#2a1410', '#ff6a1a', '#38383e', '#9aa8b8'],
    atmosphere: {on: true, color: '#ff8a5a'},
    params: [
      {id: 'destruction', name: 'Сила разрушения', min: 0, max: 100, value: 45, unit: '%'},
      {id: 'rifts', name: 'Великих разломов', min: 0, max: 20, value: 6},
      {id: 'riftWidth', name: 'Ширина разломов', min: 1, max: 6, value: 2},
      {id: 'holes', name: 'Пробоин до ядра', min: 0, max: 10, value: 3},
      {id: 'holeSize', name: 'Размер пробоин', min: 1, max: 8, value: 3},
      {id: 'fragments', name: 'Крупных осколков на орбите', min: 0, max: 80, value: 14},
      {id: 'debris', name: 'Обломков на орбите', min: 0, max: 100, value: 60, unit: '%'},
      {id: 'atmo', name: 'Остаток атмосферы', type: 'check', value: true, section: 'Что осталось'},
      {id: 'seas', name: 'Высохшие моря', type: 'check', value: true, section: 'Что осталось'},
      {id: 'ruins', name: 'Руины цивилизации', type: 'check', value: true, section: 'Что осталось'},
      {id: 'sparks', name: 'Искры и пыль', type: 'check', value: true, section: 'Что осталось'},
    ],
    run({G, seed, params: P, type, util, atmosphere, look, preview}) {
      const rnd = util.mulberry(seed), elev = util.makeNoise(seed), crack = util.makeNoise(seed + 3), cr2 = util.makeNoise(seed + 8);
      const T = Object.fromEntries(['core', 'rift', 'crust', 'slab', 'shards', 'ash', 'deadsea', 'glass', 'ruins'].map(k => [k, type('broken:' + k)]));
      const k = Math.max(1, (G.n || 10) / 10), D = P.destruction / 100;
      const at = (c, s, o) => [G.centers[c * 3] * s + o, G.centers[c * 3 + 1] * s + o, G.centers[c * 3 + 2] * s + o];
      const out = new Uint8Array(G.V), e = new Float32Array(G.V);
      // what is left of the old surface
      for (let c = 0; c < G.V; c++) {
        e[c] = elev(...at(c, 2, 5), 5);
        out[c] = (P.seas && e[c] < 0.4) ? T.deadsea : e[c] > 0.72 ? T.slab : e[c] < 0.47 ? T.ash : T.crust;
      }
      // a web of cracks: the stronger the destruction, the wider
      for (let c = 0; c < G.V; c++) {
        const a = Math.abs(crack(...at(c, 3.5, 1), 3) - 0.5), b = Math.abs(cr2(...at(c, 6, 4), 2) - 0.5);
        if (a < D * 0.045 || (D > 0.5 && b < (D - 0.5) * 0.04)) out[c] = T.rift;
        else if (a < D * 0.08 && rnd() < 0.5) out[c] = T.glass;
      }
      const isDeep = (t) => t === T.rift || t === T.core;
      const grow = (c0, R, fn) => {
        const dist = new Map([[c0, 0]]), q = [c0];
        for (let j = 0; j < q.length; j++) { const c = q[j], d = dist.get(c); if (d >= R) continue; for (const nb of G.nbr[c]) if (!dist.has(nb)) { dist.set(nb, d + 1); q.push(nb); } }
        for (const [c, d] of dist) fn(c, d);
      };
      // great rifts: jagged lines across the planet, the middle reaching the core
      const ang = (a, b) => G.centers[a * 3] * G.centers[b * 3] + G.centers[a * 3 + 1] * G.centers[b * 3 + 1] + G.centers[a * 3 + 2] * G.centers[b * 3 + 2];
      // the lines first, then one widening pass from all of them at once (fast on big planets)
      const w = Math.max(0, Math.round(P.riftWidth * k * 0.6) - 1);
      const dist = new Int16Array(G.V).fill(-1), q = [];
      for (let r = 0; r < P.rifts; r++) {
        let c = Math.floor(rnd() * G.V), b = Math.floor(rnd() * G.V);
        for (let t = 0; t < 20 && ang(c, b) > -0.2; t++) b = Math.floor(rnd() * G.V); // far apart
        const seen = new Set();
        for (let step = 0; step < G.V && c !== b; step++) {
          seen.add(c);
          if (dist[c] !== 0) { dist[c] = 0; q.push(c); }
          // next: one of the two cells nearest to the target, so the line zigzags
          const nbs = [...G.nbr[c]].filter(x => !seen.has(x)).sort((x, y) => ang(y, b) - ang(x, b));
          if (!nbs.length) break;
          c = nbs[rnd() < 0.65 || nbs.length < 2 ? 0 : 1];
        }
      }
      for (let j = 0; j < q.length; j++) { const c = q[j], d = dist[c]; if (d >= w) continue; for (const nb of G.nbr[c]) if (dist[nb] < 0) { dist[nb] = d + 1; q.push(nb); } }
      for (const c of q) out[c] = dist[c] === 0 && D > 0.3 && rnd() < D ? T.core : T.rift;
      // impact holes: the core in the middle, a rift ring, thrown-up slabs around
      const marks = [];
      for (let i = 0; i < P.holes; i++) {
        const c0 = Math.floor(rnd() * G.V), R = Math.max(1, Math.round(P.holeSize * k * (0.6 + rnd() * 0.7)));
        grow(c0, R + Math.max(1, Math.round(R * 0.6)), (c, d) => {
          if (d <= R * 0.55) out[c] = T.core; else if (d <= R) out[c] = T.rift; else if (!isDeep(out[c])) out[c] = rnd() < 0.6 ? T.slab : T.shards;
        });
        marks.push(c0);
      }
      // the crust next to the rifts is pushed up and crystallised
      for (let c = 0; c < G.V; c++) if (!isDeep(out[c]) && out[c] !== T.glass) {
        let near = 0; for (const nb of G.nbr[c]) if (isDeep(out[nb])) near++;
        if (near && rnd() < 0.35 + D * 0.3) out[c] = rnd() < 0.3 ? T.shards : T.slab;
      }
      // ruins on what is left
      if (P.ruins) { const n = Math.round(G.V / 180 * (1 - D * 0.6)); for (let i = 0; i < n; i++) { const c = Math.floor(rnd() * G.V); if (out[c] === T.crust || out[c] === T.ash) out[c] = T.ruins; } }

      atmosphere(P.atmo ? {on: true, color: '#ff8a5a'} : {on: false});
      const orbit = [];
      if (P.fragments > 0) orbit.push({type: 'fragments', name: 'Осколки планеты', count: P.fragments, rmin: 1.25, rmax: 2.6, size: 0.07, hot: 0.35, lanes: 20 + D * 40, speed: 0.4, color: '#6a5a50'});
      if (P.debris > 0) {
        orbit.push({type: 'debris', name: 'Пояс обломков', radius: 1.5, spread: 0.25, count: Math.round(P.debris * 50), size: 0.01, tilt: 9, node: 20, spin: 0.25, color: '#7a6a60'});
        if (P.debris > 50) orbit.push({type: 'debris', name: 'Внешний пояс', radius: 2.3, spread: 0.4, count: Math.round(P.debris * 25), size: 0.008, tilt: -14, node: 140, spin: 0.15, color: '#5a5048'});
      }
      look({orbit, riftsparks: !!P.sparks, dustveil: !!P.sparks, brokenMarks: preview ? null : marks});
      return out;
    },
  });

  // marks over the impact sites (real planet only)
  ss.hooks.on('generate:done', (gen) => {
    if (!ss.doc || !Array.isArray(ss.doc.pois)) return;
    const had = ss.doc.pois.some(p => p.kind === 'broken:impact');
    ss.doc.pois = ss.doc.pois.filter(p => p.kind !== 'broken:impact');
    const marks = gen && gen.id === 'shattered' && ss.doc.meta.look && ss.doc.meta.look.brokenMarks;
    if (Array.isArray(marks)) marks.forEach((c, i) => ss.doc.pois.push({c, kind: 'broken:impact', name: 'Место удара ' + (i + 1), note: ''}));
    if (had || (marks && marks.length)) { ss.docChanged({layer: 'pois'}); ss.pois && ss.pois.rebuild(); }
  });

  ss.particles.forLook('riftsparks', {name: 'Искры из разломов', icon: 'spark', mod: 'Разрушенная планета', count: 1600, r0: 1.0, r1: 1.3, size: 0.012, opacity: 0.9, additive: true, motion: 'rise', speed: 0.05,
    colors: [{color: '#ff6a1a', weight: 4}, {color: '#ffb347', weight: 2}, {color: '#ffe08a', weight: 1}]});
  ss.particles.forLook('dustveil', {name: 'Пыль катастрофы', icon: 'wind', mod: 'Разрушенная планета', count: 2500, r0: 1.02, r1: 1.25, size: 0.016, opacity: 0.35, motion: 'drift', speed: 0.03,
    colors: [{color: '#6a5a50', weight: 3}, {color: '#8a7a6a', weight: 2}, {color: '#4a4440', weight: 2}]});
}
