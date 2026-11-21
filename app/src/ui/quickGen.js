// «Быстрая генерация»: fill a star system with planets of chosen types, or a galaxy with stars — how many, how far
// from the core, how dense — either adding to what is already there (existing stars are kept at a distance) or
// replacing it. Planet maps are made on the first visit (planet.gen tells which generator). One undo step.
import {h, mulberry} from '../core/util.js';
import {slider, segmented, check, button, note} from './widgets.js';
import {createSystem, createPlanet, createLink, randomName, STAR_COLORS, GALAXY_R, CORE_R, sectorAt, sectorName} from '../space/campaign.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV'];
const COLORS = {
  mixed: STAR_COLORS,
  warm: ['#ffe9b0', '#ffd27a', '#ff9e5e', '#fff4e0'],
  cold: ['#bcd4ff', '#8fb4ff', '#ffffff'],
  red: ['#ff6b4a', '#ff9e5e', '#ff7a5a'],
  white: ['#fff4e0', '#ffffff', '#f4f7ff'],
};
const newSeed = () => Math.floor(Math.random() * 1e9);

export function registerQuickGen(ss) {
  const sp = () => ss.space;
  // remembered between openings
  const S = {
    sys: {mode: 'add', counts: {}, random: 0, orbit0: 24, gap: 20, jitter: 25, sizeMin: 0.6, sizeMax: 1.4, moonChance: 20, moonMax: 2, shuffle: true, seed: newSeed()},
    gal: {mode: 'add', count: 20, dist: 'uniform', r0: 18, r1: 95, minDist: 7, sector: '', colors: 'mixed', sizeMin: 0.6, sizeMax: 1.5, pMin: 0, pMax: 3, types: [], routes: false, seed: newSeed()},
  };
  const gens = () => ss.reg.generators.list().filter(g => !g.hidden);
  const isMoonGen = (g) => g.id === 'moon' || /спутник/i.test(g.group || '');
  const planetGens = () => gens().filter(g => !isMoonGen(g));
  const big = (id) => /gas|giant|гигант/i.test(id);

  // the target system: the open one, or the system selected on the galaxy map
  const targetSystem = () => {
    const S2 = sp(); if (!S2) return null;
    const {g, s} = S2.current();
    if (S2.nav.level === 'system') return s ? {g, s} : null;
    if (S2.nav.level === 'galaxy' && S2.sel && S2.sel.kind === 'system') { const s2 = g && g.systems.find(x => x.id === S2.sel.id); return s2 ? {g, s: s2} : null; }
    return null;
  };
  const targetGalaxy = () => { const S2 = sp(); if (!S2 || !['galaxy', 'system'].includes(S2.nav.level)) return null; return S2.current().g; };

  // ---------- planets for a system ----------
  // list: generator ids in orbit order (from the star outwards)
  function addPlanets(s, list, o, rnd, startOrbit) {
    let orbit = startOrbit, made = 0, moons = 0;
    const roots = s.planets.filter(p => !p.parent).length;
    list.forEach((gid, i) => {
      const n = roots + i;
      const size = (o.sizeMin + rnd() * Math.max(0, o.sizeMax - o.sizeMin)) * (big(gid) ? 1.7 : 1);
      const p = createPlanet({name: `${s.name} ${ROMAN[n] || n + 1}`, orbit: +orbit.toFixed(1), angle: rnd() * Math.PI * 2, size: +size.toFixed(2), gen: gid});
      s.planets.push(p); made++;
      if (o.moonMax > 0 && rnd() * 100 < o.moonChance) {
        const k = 1 + Math.floor(rnd() * o.moonMax);
        for (let j = 0; j < k; j++) {
          s.planets.push(createPlanet({name: `${p.name} — луна ${j + 1}`, parent: p.id, orbit: +(5 + p.size * 2 + j * 3.5).toFixed(1), angle: rnd() * Math.PI * 2, size: 0.35 + rnd() * 0.2, gen: ss.reg.generators.has('moon') ? 'moon' : ''}));
          moons++;
        }
      }
      orbit += o.gap * (1 + (rnd() - 0.5) * 2 * o.jitter / 100) + (big(gid) ? o.gap * 0.4 : 0);
    });
    return {made, moons};
  }
  const systemList = (o, rnd) => {
    const list = [];
    for (const [id, n] of Object.entries(o.counts)) if (ss.reg.generators.has(id)) for (let i = 0; i < n; i++) list.push(id);
    const pool = planetGens().map(g => g.id);
    for (let i = 0; i < o.random && pool.length; i++) list.push(pool[Math.floor(rnd() * pool.length)]);
    if (o.shuffle) for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    return list;
  };
  const outerOrbit = (s) => s.planets.filter(p => !p.parent).reduce((m, p) => Math.max(m, p.orbit), 0);
  const withDocs = (planets) => planets.filter(p => p.doc).length;

  async function runSystem(api) {
    const t = targetSystem(); if (!t) return ss.ui.toast('Открой систему или выбери её на карте галактики');
    const o = S.sys, rnd = mulberry(o.seed), list = systemList(o, rnd);
    if (!list.length) return ss.ui.toast('Выбери хотя бы один тип планет');
    if (o.mode === 'replace' && t.s.planets.length) {
      const d = withDocs(t.s.planets);
      if (!await ss.ui.confirm(`Убрать из системы «${t.s.name}» все планеты (${t.s.planets.length}${d ? `, у ${d} уже есть карты` : ''}) и создать новые? Можно отменить через Ctrl+Z.`, 'Заменить')) return;
    }
    let res = null;
    sp().mutate(() => {
      if (o.mode === 'replace') { t.s.planets = []; t.s.links = []; }
      const start = o.mode === 'add' && t.s.planets.length ? outerOrbit(t.s) + o.gap : o.orbit0;
      res = addPlanets(t.s, list, o, rnd, start);
    }, 'Быстрая генерация планет');
    o.seed = newSeed();
    ss.ui.toast(`«${t.s.name}»: +${res.made} планет${res.moons ? `, +${res.moons} лун` : ''}`);
    api.close();
  }

  // ---------- stars for a galaxy ----------
  // where the new stars go; deterministic for a seed, so the preview shows exactly what will be made
  function planStars(g, o) {
    const rnd = mulberry(o.seed), gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const r0 = Math.min(o.r0, o.r1), r1 = Math.max(o.r0, o.r1), keep = o.mode === 'add' ? g.systems.map(s => [s.x, s.z]) : [];
    const out = [], md2 = o.minDist * o.minDist;
    const arms = Math.max(1, g.arms | 0), clusters = [];
    if (o.dist === 'clusters') { const nc = Math.max(2, Math.min(12, Math.round(o.count / 7))); for (let i = 0; i < nc; i++) { const r = Math.sqrt(r0 * r0 + rnd() * (r1 * r1 - r0 * r0)), a = rnd() * Math.PI * 2; clusters.push([Math.cos(a) * r, Math.sin(a) * r]); } }
    const sample = () => {
      const u = rnd();
      if (o.dist === 'core') { const r = r0 + (r1 - r0) * Math.pow(u, 2.2), a = rnd() * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r]; }
      if (o.dist === 'arms') { const r = r0 + (r1 - r0) * Math.pow(u, 0.85), k = Math.floor(rnd() * arms), a = k / arms * Math.PI * 2 + g.twist * Math.log(Math.max(1, r) / 8) + gauss() * 0.22; return [Math.cos(a) * r, Math.sin(a) * r]; }
      if (o.dist === 'clusters') { const c = clusters[Math.floor(rnd() * clusters.length)], sp2 = 4 + (r1 - r0) * 0.06; return [c[0] + gauss() * sp2, c[1] + gauss() * sp2]; }
      const r = Math.sqrt(r0 * r0 + u * (r1 * r1 - r0 * r0)), a = rnd() * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r];
    };
    const free = (x, z) => { for (const p of keep) if ((p[0] - x) ** 2 + (p[1] - z) ** 2 < md2) return false; for (const p of out) if ((p[0] - x) ** 2 + (p[1] - z) ** 2 < md2) return false; return true; };
    for (let tries = 0; out.length < o.count && tries < o.count * 120; tries++) {
      const [x, z] = sample(), r = Math.hypot(x, z);
      if (r < r0 - 0.01 || r > r1 + 0.01 || r > GALAXY_R) continue;
      if (o.sector && sectorAt(g, x, z) !== o.sector) continue;
      if (!free(x, z)) continue;
      out.push([x, z]);
    }
    return out;
  }

  async function runGalaxy(api) {
    const g = targetGalaxy(); if (!g) return ss.ui.toast('Открой галактику');
    const o = S.gal, pts = planStars(g, o);
    if (!pts.length) return ss.ui.toast('Не нашлось свободного места — уменьши расстояние между звёздами или расширь область');
    if (o.mode === 'replace' && g.systems.length) {
      const np = g.systems.reduce((n, s) => n + s.planets.length, 0);
      if (!await ss.ui.confirm(`Убрать из галактики «${g.name}» все системы (${g.systems.length}${np ? `, планет в них: ${np}` : ''}) и создать новые? Можно отменить через Ctrl+Z.`, 'Заменить')) return;
    }
    const rnd = mulberry(o.seed ^ 0x5bd1e995), pal = COLORS[o.colors] || STAR_COLORS;
    const allowed = (o.types.length ? o.types.filter(id => ss.reg.generators.has(id)) : planetGens().map(x => x.id));
    let systems = 0, planets = 0, moons = 0, links = 0;
    sp().mutate(() => {
      if (o.mode === 'replace') { g.systems = []; g.links = []; }
      const names = new Set(g.systems.map(s => s.name)), made = [];
      for (const [x, z] of pts) {
        let name = randomName(rnd, 2); for (let i = 0; names.has(name) && i < 20; i++) name = randomName(rnd, 2); names.add(name);
        const red = o.colors === 'red';
        const s = createSystem({name, x: +x.toFixed(2), z: +z.toFixed(2), starColor: pal[Math.floor(rnd() * pal.length)], starSize: +((o.sizeMin + rnd() * Math.max(0, o.sizeMax - o.sizeMin)) * (red ? 0.8 : 1)).toFixed(2)});
        const lo = Math.min(o.pMin, o.pMax), hi = Math.max(o.pMin, o.pMax), n = lo + Math.floor(rnd() * (hi - lo + 1));
        if (n > 0 && allowed.length) {
          const list = []; for (let i = 0; i < n; i++) list.push(allowed[Math.floor(rnd() * allowed.length)]);
          const r = addPlanets(s, list, {...S.sys, moonChance: S.sys.moonChance}, rnd, S.sys.orbit0); planets += r.made; moons += r.moons;
        }
        g.systems.push(s); made.push(s); systems++;
      }
      // hyperlanes: each new system to its nearest neighbour (new or old)
      if (o.routes) {
        const has = new Set(g.links.map(l => [l.a, l.b].sort().join('|')));
        for (const s of made) {
          let best = null, bd = Infinity;
          for (const t of g.systems) { if (t === s) continue; const d = (t.x - s.x) ** 2 + (t.z - s.z) ** 2; if (d < bd) { bd = d; best = t; } }
          if (!best) continue; const k = [s.id, best.id].sort().join('|'); if (has.has(k)) continue;
          has.add(k); g.links.push(createLink(s.id, best.id, 'hyperlane')); links++;
        }
      }
    }, 'Быстрая генерация звёзд');
    o.seed = newSeed();
    ss.ui.toast(`«${g.name}»: +${systems} систем${planets ? `, +${planets} планет` : ''}${moons ? `, +${moons} лун` : ''}${links ? `, +${links} путей` : ''}`);
    api.close();
  }

  // ---------- UI ----------
  const card = (title, ...body) => h('div', {class: 'set-card'}, title ? h('div', {class: 'set-title'}, title) : null, ...body);
  const pct = (v) => v + '%';
  const seedRow = (o, onChange) => {
    const out = h('code', {class: 'qg-seed'}, String(o.seed));
    return h('div', {class: 'qg-seedrow'}, h('span', {class: 'lbl'}, 'Сид'), out,
      h('button', {class: 'qg-dice', title: 'Другой вариант', onclick: () => { o.seed = newSeed(); out.textContent = o.seed; onChange(); }}, ss.themes.icon('dice'), ' Другой вариант'));
  };
  // a searchable list of planet types; mode 'count' (a −/+ counter per type) or 'pick' (on/off)
  function typeList(o, mode, onChange) {
    const wrap = h('div', {class: 'qg-types'});
    const search = h('input', {class: 'field', type: 'search', placeholder: 'Поиск типа: лёд, лава, джунгли, газ…'});
    const list = h('div', {class: 'qg-list'});
    const render = () => {
      const q = search.value.trim().toLowerCase(); list.innerHTML = '';
      let group = null;
      for (const g of planetGens()) {
        if (q && !(g.name + ' ' + (g.group || '') + ' ' + (g.desc || '') + ' ' + g.id).toLowerCase().includes(q)) continue;
        if (g.group !== group) { group = g.group; list.appendChild(h('div', {class: 'qg-group'}, group || 'Другие')); }
        const sw = h('span', {class: 'qg-sw'}, (g.preview || []).slice(0, 4).map(c => h('i', {style: {background: c}})));
        if (mode === 'count') {
          const n = o.counts[g.id] || 0, num = h('b', {class: 'qg-n'}, String(n));
          const set = (v) => { v = Math.max(0, Math.min(12, v)); if (v) o.counts[g.id] = v; else delete o.counts[g.id]; num.textContent = v; row.classList.toggle('on', v > 0); onChange(); };
          const row = h('div', {class: 'qg-row' + (n ? ' on' : ''), title: g.desc || ''}, ss.themes.icon(g.icon || 'planet', 'qg-ico'), h('span', {class: 'qg-name'}, g.name), sw,
            h('div', {class: 'qg-step'}, h('button', {onclick: () => set((o.counts[g.id] || 0) - 1), title: 'Меньше'}, '−'), num, h('button', {onclick: () => set((o.counts[g.id] || 0) + 1), title: 'Больше'}, '+')));
          row.addEventListener('dblclick', (e) => { if (!e.target.closest('button')) set((o.counts[g.id] || 0) + 1); });
          list.appendChild(row);
        } else {
          const on = o.types.includes(g.id);
          const row = h('button', {class: 'qg-row qg-pick' + (on ? ' on' : ''), title: g.desc || '', onclick: () => {
            const i = o.types.indexOf(g.id); if (i >= 0) o.types.splice(i, 1); else o.types.push(g.id); row.classList.toggle('on', i < 0); onChange();
          }}, ss.themes.icon(g.icon || 'planet', 'qg-ico'), h('span', {class: 'qg-name'}, g.name), sw, h('span', {class: 'qg-tick'}, ss.themes.icon('check')));
          list.appendChild(row);
        }
      }
      if (!list.children.length) list.appendChild(h('div', {class: 'note'}, 'Ничего не найдено'));
    };
    search.addEventListener('input', render);
    render();
    wrap.append(search, list);
    return wrap;
  }

  const planetsSection = {id: 'planets', label: 'Планеты в системе', icon: 'planet', enabled: () => !!targetSystem(), render(p, api) {
    const t = targetSystem(), o = S.sys;
    if (!t) { p.append(note('Открой систему или выбери систему на карте галактики.')); return; }
    const total = h('b'), go = h('button', {class: 'primary qg-go', onclick: () => runSystem(api)});
    const upd = () => {
      const n = Object.values(o.counts).reduce((a, b) => a + b, 0) + o.random;
      total.textContent = n;
      go.textContent = n ? (o.mode === 'replace' ? `Заменить на ${n} планет` : `Добавить ${n} планет`) : 'Выбери типы планет';
      go.disabled = !n;
    };
    const existing = t.s.planets.filter(x => !x.parent).length;
    p.append(
      h('div', {class: 'qg-head'}, h('div', null, h('div', {class: 'qg-title'}, `Система «${t.s.name}»`), h('small', null, existing ? `сейчас планет: ${existing}, дальняя орбита ${outerOrbit(t.s).toFixed(0)}` : 'пока без планет')),
        segmented({options: [{value: 'add', label: 'Дополнить', title: 'существующие планеты остаются, новые встают на орбиты дальше'}, {value: 'replace', label: 'Заменить', title: 'убрать все планеты системы и создать новые'}], value: o.mode, onChange: v => { o.mode = v; upd(); }})),
      h('div', {class: 'qg-cols'},
        h('div', {class: 'qg-main'}, card('Типы и количество', note('Кнопками − / + задай, сколько планет каждого типа нужно. Карты планет создадутся при первом заходе на них.'), typeList(o, 'count', upd),
          slider({id: 'qg_rand', label: 'И ещё случайных типов', min: 0, max: 12, value: o.random, onInput: v => { o.random = v; upd(); }}))),
        h('div', {class: 'qg-side'},
          card('Орбиты',
            slider({id: 'qg_o0', label: 'Первая орбита', min: 8, max: 80, value: o.orbit0, onInput: v => { o.orbit0 = v; }}),
            slider({id: 'qg_gap', label: 'Шаг между орбитами', min: 6, max: 50, value: o.gap, onInput: v => { o.gap = v; }}),
            slider({id: 'qg_jit', label: 'Неравномерность', min: 0, max: 60, value: o.jitter, format: pct, onInput: v => { o.jitter = v; }}),
            check({id: 'qg_shuf', label: 'Перемешать типы по орбитам', checked: o.shuffle, onChange: v => { o.shuffle = v; }})),
          card('Размер и луны',
            slider({id: 'qg_smin', label: 'Размер от', min: 30, max: 200, step: 5, value: Math.round(o.sizeMin * 100), format: pct, onInput: v => { o.sizeMin = v / 100; }}),
            slider({id: 'qg_smax', label: 'Размер до', min: 30, max: 200, step: 5, value: Math.round(o.sizeMax * 100), format: pct, onInput: v => { o.sizeMax = v / 100; }}),
            slider({id: 'qg_mc', label: 'Шанс лун у планеты', min: 0, max: 100, value: o.moonChance, format: pct, onInput: v => { o.moonChance = v; }}),
            slider({id: 'qg_mm', label: 'Лун не больше', min: 0, max: 4, value: o.moonMax, onInput: v => { o.moonMax = v; }})),
          seedRow(o, () => {}))),
      h('div', {class: 'qg-foot'}, h('span', null, 'Всего: ', total, ' планет'), button('Сбросить типы', () => { o.counts = {}; o.random = 0; api.refresh(); }), go));
    upd();
  }};

  const starsSection = {id: 'stars', label: 'Звёзды в галактике', icon: 'galaxy', enabled: () => !!targetGalaxy(), render(p, api) {
    const g = targetGalaxy(), o = S.gal;
    if (!g) { p.append(note('Открой галактику.')); return; }
    const cv = h('canvas', {class: 'qg-map', width: 560, height: 560});
    const info = h('div', {class: 'qg-mapinfo'});
    const go = h('button', {class: 'primary qg-go', onclick: () => runGalaxy(api)});
    let raf = 0;
    const css = getComputedStyle(document.body), accent = css.getPropertyValue('--accent').trim() || '#ff5a3c';
    const draw = () => {
      raf = 0;
      const pts = planStars(g, o), c = cv.getContext('2d'), W = cv.width, k = W / 2 / (GALAXY_R + 6);
      const X = (x) => W / 2 + x * k;
      c.clearRect(0, 0, W, W);
      c.fillStyle = 'rgba(8,10,18,.9)'; c.beginPath(); c.arc(W / 2, W / 2, (GALAXY_R + 4) * k, 0, Math.PI * 2); c.fill();
      // sectors
      c.strokeStyle = 'rgba(200,212,255,.13)'; c.lineWidth = 1;
      const band = (GALAXY_R - CORE_R) / g.rings;
      for (let i = 0; i <= g.rings; i++) { c.beginPath(); c.arc(W / 2, W / 2, (CORE_R + i * band) * k, 0, Math.PI * 2); c.stroke(); }
      for (let s = 0; s < g.slices; s++) { const a = s / g.slices * Math.PI * 2; c.beginPath(); c.moveTo(X(Math.cos(a) * CORE_R), X(Math.sin(a) * CORE_R)); c.lineTo(X(Math.cos(a) * GALAXY_R), X(Math.sin(a) * GALAXY_R)); c.stroke(); }
      // the area where stars go
      const r0 = Math.min(o.r0, o.r1), r1 = Math.max(o.r0, o.r1);
      c.save(); c.fillStyle = accent; c.globalAlpha = 0.1;
      if (o.sector) { const {r0: a0r, r1: a1r, a0, a1} = sectorGeomSafe(g, o.sector); c.beginPath(); c.arc(W / 2, W / 2, Math.min(r1, a1r) * k, a0, a1); c.arc(W / 2, W / 2, Math.max(r0, a0r) * k, a1, a0, true); c.closePath(); c.fill(); }
      else { c.beginPath(); c.arc(W / 2, W / 2, r1 * k, 0, Math.PI * 2); c.arc(W / 2, W / 2, r0 * k, 0, Math.PI * 2, true); c.fill('evenodd'); }
      c.restore();
      // existing systems: grey (gone in «replace»), with a ring if they have planets
      const old = o.mode === 'add';
      for (const s of g.systems) {
        c.globalAlpha = old ? 1 : 0.25; c.fillStyle = '#9aa3b8'; c.beginPath(); c.arc(X(s.x), X(s.z), 3, 0, Math.PI * 2); c.fill();
        if (s.planets.length) { c.strokeStyle = '#cfd6e6'; c.lineWidth = 1.2; c.beginPath(); c.arc(X(s.x), X(s.z), 6.5, 0, Math.PI * 2); c.stroke(); }
        if (old && o.minDist > 0) { c.strokeStyle = 'rgba(154,163,184,.25)'; c.setLineDash([3, 3]); c.beginPath(); c.arc(X(s.x), X(s.z), o.minDist * k, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
      }
      c.globalAlpha = 1;
      // new stars
      c.fillStyle = accent; c.shadowColor = accent; c.shadowBlur = 6;
      for (const [x, z] of pts) { c.beginPath(); c.arc(X(x), X(z), 3.2, 0, Math.PI * 2); c.fill(); }
      c.shadowBlur = 0;
      const short = pts.length < o.count;
      info.innerHTML = '';
      info.append(h('span', {class: 'qg-dot new'}), `новых: ${pts.length}`, h('span', {class: 'qg-dot old'}), `${old ? 'есть' : 'будут убраны'}: ${g.systems.length}`,
        ...(short ? [h('span', {class: 'qg-warn'}, `Места хватило только на ${pts.length} из ${o.count} — уменьши расстояние между звёздами или расширь область`)] : []));
      go.textContent = pts.length ? (o.mode === 'replace' ? `Заменить на ${pts.length} звёзд` : `Добавить ${pts.length} звёзд`) : 'Нет места';
      go.disabled = !pts.length;
    };
    const upd = () => { if (!raf) raf = requestAnimationFrame(draw); };
    const sectors = [{value: '', label: 'Вся галактика'}, {value: 'core', label: sectorName(g, 'core')}];
    for (let r = 0; r < g.rings; r++) for (let s = 0; s < g.slices; s++) sectors.push({value: `${r}:${s}`, label: sectorName(g, `${r}:${s}`)});
    const secSel = h('select', {class: 'field'}, sectors.map(s => h('option', {value: s.value, selected: s.value === o.sector}, s.label)));
    secSel.addEventListener('change', () => { o.sector = secSel.value; upd(); });
    const np = g.systems.filter(s => s.planets.length).length;
    p.append(
      h('div', {class: 'qg-head'}, h('div', null, h('div', {class: 'qg-title'}, `Галактика «${g.name}»`), h('small', null, `систем: ${g.systems.length}, из них с планетами: ${np}`)),
        segmented({options: [{value: 'add', label: 'Дополнить', title: 'существующие звёзды остаются, новые встают не ближе заданного расстояния к ним'}, {value: 'replace', label: 'Заменить', title: 'убрать все системы галактики и создать новые'}], value: o.mode, onChange: v => { o.mode = v; upd(); }})),
      h('div', {class: 'qg-cols'},
        h('div', {class: 'qg-main'},
          card('Звёзды',
            slider({id: 'qg_cnt', label: 'Сколько звёзд', min: 1, max: 200, value: o.count, onInput: v => { o.count = v; upd(); }}),
            h('div', {class: 'lbl'}, 'Как расположены'),
            segmented({options: [{value: 'uniform', label: 'Ровно'}, {value: 'arms', label: 'По рукавам'}, {value: 'core', label: 'К ядру'}, {value: 'clusters', label: 'Скоплениями'}], value: o.dist, onChange: v => { o.dist = v; upd(); }}),
            slider({id: 'qg_r0', label: 'От центра, ближе всего', min: 0, max: 100, value: o.r0, onInput: v => { o.r0 = v; upd(); }}),
            slider({id: 'qg_r1', label: 'От центра, дальше всего', min: 0, max: 100, value: o.r1, onInput: v => { o.r1 = v; upd(); }}),
            slider({id: 'qg_md', label: 'Расстояние между звёздами, не меньше', min: 0, max: 30, step: 0.5, value: o.minDist, onInput: v => { o.minDist = v; upd(); }}),
            h('div', {class: 'field-row'}, h('label', {class: 'lbl'}, 'Только в секторе'), secSel)),
          card('Звёзды и планеты в них',
            h('div', {class: 'lbl'}, 'Цвет звёзд'),
            segmented({options: [{value: 'mixed', label: 'Любые'}, {value: 'warm', label: 'Жёлтые'}, {value: 'cold', label: 'Голубые'}, {value: 'red', label: 'Красные'}, {value: 'white', label: 'Белые'}], value: o.colors, onChange: v => { o.colors = v; }}),
            slider({id: 'qg_ss0', label: 'Размер звезды от', min: 30, max: 250, step: 5, value: Math.round(o.sizeMin * 100), format: pct, onInput: v => { o.sizeMin = v / 100; }}),
            slider({id: 'qg_ss1', label: 'Размер звезды до', min: 30, max: 250, step: 5, value: Math.round(o.sizeMax * 100), format: pct, onInput: v => { o.sizeMax = v / 100; }}),
            slider({id: 'qg_p0', label: 'Планет в системе от', min: 0, max: 10, value: o.pMin, onInput: v => { o.pMin = v; }}),
            slider({id: 'qg_p1', label: 'Планет в системе до', min: 0, max: 10, value: o.pMax, onInput: v => { o.pMax = v; }}),
            note('Типы планет: отметь нужные (ничего не отмечено — любые). Орбиты и луны берутся из вкладки «Планеты в системе».'),
            typeList(o, 'pick', () => {}),
            check({id: 'qg_routes', label: 'Соединить новые системы гиперпутями с ближайшими', checked: o.routes, onChange: v => { o.routes = v; }}))),
        h('div', {class: 'qg-side'}, card('Где появятся', cv, info), seedRow(o, upd))),
      h('div', {class: 'qg-foot'}, h('span', {class: 'qg-legend'}, 'Новые звёзды — цветом акцента, существующие — серым, с кольцом — уже с планетами.'), go));
    upd();
    return () => cancelAnimationFrame(raf);
  }};
  const sectorGeomSafe = (g, key) => {
    if (key === 'core') return {r0: 0, r1: CORE_R, a0: 0, a1: Math.PI * 2};
    const [r, s] = key.split(':').map(Number), band = (GALAXY_R - CORE_R) / g.rings, step = Math.PI * 2 / g.slices;
    return {r0: CORE_R + r * band, r1: CORE_R + (r + 1) * band, a0: s * step, a1: (s + 1) * step};
  };

  ss.reg.dialogs.register({id: 'quickgen', title: 'Быстрая генерация', icon: 'dice',
    subtitle: () => 'планеты в систему, звёзды в галактику — одним шагом, Ctrl+Z отменит', sections: [starsSection, planetsSection]});
  const inSpace = () => ss.space && ['galaxy', 'system'].includes(ss.space.nav.level);
  const open = (sec) => ss.ui.openDialog('quickgen', typeof sec === 'string' ? sec : ss.space.nav.level === 'system' ? 'planets' : 'stars');
  ss.reg.menus.register({id: 'space:quickgen', menu: 'Правка', order: 310, label: 'Быстрая генерация звёзд и планет…', accel: 'Ctrl+Shift+G', enabled: inSpace,
    action: open, bar: {icon: 'dice', text: 'Быстрая генерация', order: 2, active: () => ss.ui.dialogs.isOpen('quickgen')}});
  ss.quickGen = {planStars, open, state: S};
}
