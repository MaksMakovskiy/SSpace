// «Генератор миров»: a big gallery over the editor. Cards with a real preview of every generator in the middle,
// a sidebar on the left with the chosen generator's settings, the generation add-ons (ss.reg.genLayers:
// «Обитаемость» and others) and the generate buttons.
// Generator defs may add: icon, desc, group (gallery section), preview: ['#hex', …] (fallback colours),
// and params of three kinds: {id, name, min, max, step, value, unit} — slider; {type: 'check', value: bool} — checkbox;
// {type: 'select', options: [{value, label}], value}. Any param may name a `section` to group it under a heading.
// The last generation of a planet is kept in doc.meta.gen = {id, seed, params, layers}.
import {h} from '../core/util.js';
import {slider, select, check, button, note} from './widgets.js';
import {createPreviewer} from './genPreview.js';

export function registerGenDialog(ss) {
  const R = ss.reg.generators, PV = createPreviewer(ss);
  const memory = new Map();      // generator id → its param values while the app runs
  const layerState = new Map();  // layer id → {on, params}
  let genId = '', query = '', group = '', keepOpen = false, keepExtras = false, seed = Math.floor(Math.random() * 1e6);
  let el = null, spinRaf = 0;

  const clean = (name) => String(name || '').replace(/\s*\(мод\)\s*$/, '');
  const groupOf = (g) => g.group || 'Другие';
  const valsOf = (g) => {
    if (!memory.has(g.id)) memory.set(g.id, {});
    const v = memory.get(g.id);
    for (const p of g.params || []) if (v[p.id] === undefined) v[p.id] = p.value;
    return v;
  };
  const layerOf = (L) => {
    if (!layerState.has(L.id)) layerState.set(L.id, {on: !!L.defaultOn, params: {}});
    const st = layerState.get(L.id);
    for (const p of L.params || []) if (st.params[p.id] === undefined) st.params[p.id] = p.value;
    return st;
  };
  const activeLayers = () => { const o = {}; for (const L of ss.reg.genLayers.list()) { const st = layerOf(L); if (st.on) o[L.id] = {on: true, params: {...st.params}}; } return o; };

  function control(prefix, p, vals, onChange) {
    const id = prefix + '_' + p.id, set = (v) => { vals[p.id] = v; onChange && onChange(); };
    if (p.type === 'check') return check({id, label: p.name, checked: !!vals[p.id], onChange: set});
    if (p.type === 'select') return select({id, label: p.name, options: p.options || [], value: vals[p.id], onChange: set});
    return slider({id, label: p.name, min: p.min, max: p.max, step: p.step || 1, value: vals[p.id], format: v => v + (p.unit || ''), onInput: set});
  }
  function paramBlock(prefix, params, vals, onChange) {
    const blocks = new Map([['', []]]);
    for (const p of params || []) { const s = p.section || ''; if (!blocks.has(s)) blocks.set(s, []); blocks.get(s).push(control(prefix, p, vals, onChange)); }
    const out = [...blocks.get('')];
    for (const [name, ctrls] of blocks) if (name) out.push(h('div', {class: 'gen-sec'}, name), h('div', {class: ctrls.every(c => c.tagName === 'LABEL') ? 'gen-checks' : 'stack'}, ...ctrls));
    return out;
  }

  function open() {
    if (el) return;
    if (!ss.doc || ss.space.nav.level !== 'planet') return ss.ui.toast('Генератор работает на уровне планеты: открой карту планеты');
    // start on the generator this planet was made with (and its settings)
    const last = ss.doc.meta && ss.doc.meta.gen;
    if (last && R.get(last.id)) {
      genId = last.id; if (last.params) Object.assign(valsOf(R.get(last.id)), last.params);
      if (last.seed != null) seed = last.seed;
      for (const [lid, cfg] of Object.entries(last.layers || {})) { const L = ss.reg.genLayers.get(lid); if (L) { const st = layerOf(L); st.on = true; Object.assign(st.params, cfg.params || {}); } }
    }
    if (!R.get(genId)) genId = R.ids()[0] || '';

    const search = h('input', {class: 'field genx-search', type: 'search', placeholder: 'Поиск: лёд, лава, джунгли, обитаемые…', value: query});
    const chips = h('div', {class: 'genx-chips'});
    const count = h('span', {class: 'genx-count'});
    const grid = h('div', {class: 'genx-grid'});
    const side = h('aside', {class: 'genx-side'});
    el = h('div', {class: 'genx-back'},
      h('div', {class: 'genx', role: 'dialog', 'aria-label': 'Генератор миров'},
        h('header', {class: 'genx-head'},
          h('div', {class: 'genx-title'}, h('b', null, 'Генератор миров'), count),
          search,
          h('button', {class: 'genx-close', title: 'Закрыть (Esc)', onclick: close}, ss.themes.icon('close'))),
        chips,
        h('div', {class: 'genx-body'}, side, grid)));
    el.addEventListener('pointerdown', (e) => { if (e.target === el) close(); });
    document.body.appendChild(el);
    document.addEventListener('keydown', onKey, true);
    ss.hooks.emit('dialog:opened', {id: 'generator'});
    search.addEventListener('input', () => { query = search.value; renderGrid(); });
    let queue = [], big = null, bigData = null, spin = 0.6;
    renderChips(chips); renderGrid(); renderSide();
    setTimeout(() => search.focus(), 0);

    function renderChips(box) {
      box.innerHTML = '';
      const groups = [...new Set(R.list().map(groupOf))].sort((a, b) => (a === 'Базовые' ? -1 : b === 'Базовые' ? 1 : a.localeCompare(b, 'ru')));
      for (const g of ['', ...groups]) box.appendChild(h('button', {class: 'genx-chip' + (g === group ? ' on' : ''), onclick: () => { group = g; renderChips(box); renderGrid(); }}, g || 'Все'));
    }

    // ----- cards -----
    function renderGrid() {
      grid.innerHTML = ''; queue = [];
      const q = query.trim().toLowerCase();
      const list = R.list().filter(g => (!group || groupOf(g) === group) && (!q || [g.name, g.desc, groupOf(g), g.id].some(x => x && String(x).toLowerCase().includes(q))));
      count.textContent = `Генераторов: ${list.length}` + (list.length !== R.size ? ` из ${R.size}` : '');
      if (!list.length) { grid.appendChild(h('div', {class: 'genx-empty'}, 'Ничего не нашлось. Попробуй другое слово или группу «Все».')); return; }
      for (const g of list) {
        const cv = h('canvas', {class: 'genx-card-img'});
        const card = h('button', {class: 'genx-card' + (g.id === genId ? ' on' : ''), title: 'Двойной клик — сразу сгенерировать',
          onclick: () => { genId = g.id; for (const c of grid.querySelectorAll('.genx-card')) c.classList.toggle('on', c === card); renderSide(); },
          ondblclick: () => { genId = g.id; generate(false); }},
          h('div', {class: 'genx-card-top'},
            ss.themes.icon(g.icon || 'globe', 'genx-card-ico'),
            h('span', {class: 'genx-card-name'}, clean(g.name)),
            g.id === (ss.doc.meta && ss.doc.meta.gen && ss.doc.meta.gen.id) ? h('span', {class: 'genx-badge'}, 'сейчас') : null),
          h('div', {class: 'genx-card-meta'}, groupOf(g) + ((g.params || []).length ? ` · настроек: ${(g.params || []).length}` : '')),
          cv,
          g.desc ? h('div', {class: 'genx-card-desc'}, g.desc) : null);
        grid.appendChild(card);
        queue.push([g, cv]);
      }
      pump();
    }
    // previews are drawn one by one so the gallery opens at once
    function pump() {
      if (!el || !queue.length) return;
      const [g, cv] = queue.shift();
      if (cv.isConnected) PV.draw(cv, PV.compute(g, {seed: 1, params: memory.get(g.id) || {}}), {spin: 0.6});
      setTimeout(pump, 0);
    }

    // ----- sidebar: big preview, settings, add-ons, buttons -----
    function renderSide() {
      side.innerHTML = '';
      const g = R.get(genId);
      if (!g) { side.appendChild(note('Выбери генератор справа.')); return; }
      const vals = valsOf(g);
      big = h('canvas', {class: 'genx-big'});
      const seedI = h('input', {class: 'field', type: 'number', value: seed});
      seedI.addEventListener('input', () => { seed = +seedI.value || 1; refresh(); });
      const layersBox = h('div', {class: 'gen-layers'});
      for (const L of ss.reg.genLayers.list()) {
        const st = layerOf(L);
        const body = h('div', {class: 'gen-layer-body', hidden: !st.on}, L.desc ? h('div', {class: 'note'}, L.desc) : null, ...paramBlock('L_' + L.id, L.params, st.params, refresh));
        const on = check({id: 'gl_' + L.id, label: h('span', {class: 'ico-label'}, L.icon ? ss.themes.icon(L.icon) : null, L.name), checked: st.on, onChange: v => { st.on = v; body.hidden = !v; refresh(); }});
        on.classList.add('gen-layer-head');
        layersBox.append(h('div', {class: 'gen-layer' + (st.on ? ' on' : '')}, on, body));
      }
      const keep = check({id: 'genxKeep', label: 'Не закрывать после генерации', checked: keepOpen, onChange: v => { keepOpen = v; }});
      const keepX = check({id: 'genxKeepX', label: 'Оставить орбиту и эффекты как есть', checked: keepExtras, onChange: v => { keepExtras = v; }});
      side.append(
        h('div', {class: 'genx-preview'}, big, h('div', {class: 'genx-preview-cap'}, 'предпросмотр · крутится')),
        h('div', {class: 'genx-side-head'}, ss.themes.icon(g.icon || 'globe', 'genx-card-ico'), h('b', null, clean(g.name))),
        g.desc ? h('div', {class: 'note'}, g.desc) : null,
        h('div', {class: 'genx-side-sec'}, h('div', {class: 'genx-side-title'}, 'Настройки мира'),
          ...((g.params || []).length ? paramBlock('gp_' + g.id, g.params, vals, refresh) : [note('У этого генератора нет настроек.')]),
          h('div', {class: 'field-row'}, h('label', {class: 'lbl'}, 'Сид'), h('div', {class: 'row2'}, seedI, h('button', {title: 'Случайный сид', onclick: () => { seed = Math.floor(Math.random() * 1e6); seedI.value = seed; refresh(); }}, ss.themes.icon('dice'))))),
        ss.reg.genLayers.size ? h('div', {class: 'genx-side-sec'}, h('div', {class: 'genx-side-title'}, 'Дополнения'), note('Работают поверх любого генератора.'), layersBox) : null,
        h('div', {class: 'genx-actions'},
          h('div', {class: 'btnrow'}, button('Сгенерировать', () => generate(false), 'primary'), button('Ещё вариант', () => generate(true))),
          h('div', {class: 'btnrow'}, button('Сбросить настройки', () => { memory.delete(g.id); renderSide(); }), button('Залить всё', () => ss.fillAll())),
          keepX, keep));
      refresh();
      function refresh() {
        for (const box of layersBox.querySelectorAll('.gen-layer')) box.classList.toggle('on', !box.querySelector('.gen-layer-body').hidden);
        clearTimeout(refresh.t);
        refresh.t = setTimeout(() => { bigData = PV.compute(g, {seed, params: {...vals}, layers: activeLayers()}); }, 120);
      }
    }
    // the big preview turns slowly
    const loop = () => { if (!el) return; spin += 0.004; if (big && big.isConnected && bigData) PV.draw(big, bigData, {spin}); spinRaf = requestAnimationFrame(loop); };
    spinRaf = requestAnimationFrame(loop);

    async function generate(newSeed) {
      const g = R.get(genId); if (!g) return;
      if (newSeed) seed = Math.floor(Math.random() * 1e6);
      const layers = activeLayers();
      for (const L of ss.reg.genLayers.list()) {
        if (!layers[L.id] || typeof L.confirm !== 'function') continue;
        const msg = L.confirm(g, layers[L.id].params);
        if (msg && !(await ss.ui.confirm(msg, 'Сгенерировать', 'Отмена'))) return;
      }
      ss.generate(g.id, {seed, params: {...valsOf(g)}, layers, keep: keepExtras});
      if (!keepOpen) close(); else renderSide();
    }
  }

  function onKey(e) { if (e.key === 'Escape' && !document.querySelector('.modal-back')) { e.stopPropagation(); close(); } }
  function close() {
    if (!el) return;
    cancelAnimationFrame(spinRaf);
    el.remove(); el = null;
    document.removeEventListener('keydown', onKey, true);
    ss.hooks.emit('dialog:closed', {id: 'generator'});
  }

  ss.openGenerator = open;
  ss.closeGenerator = close;
  ss.generatorOpen = () => !!el;
  ss.reg.menus.register({id: 'planet:genwin', menu: 'Планета', order: 19, label: 'Генератор миров…', accel: 'Ctrl+8', enabled: () => ss.space.nav.level === 'planet', action: () => (el ? close() : open()),
    bar: {icon: 'dice', text: 'Генератор', order: 1, active: () => !!el}});
  ss.hooks.on('level:changed', () => { if (ss.space.nav.level !== 'planet') close(); });
}
