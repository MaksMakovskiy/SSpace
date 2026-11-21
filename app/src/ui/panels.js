// Built-in windows. Each is a registry entry, so mods can replace or add windows the same way.
import {h, fmt, cellCount, plural, debounce} from '../core/util.js';
import {section, slider, select, check, segmented, button, note} from './widgets.js';
import {setModEnabled} from '../core/mods.js';
import {registerFxWindow} from './fxWindow.js';
import {registerGenDialog} from './genDialog.js';
import {registerDevWindow} from './devWindow.js';
import {registerAppDialogs} from './appDialogs.js';
import {registerQuickGen} from './quickGen.js';
import {registerSearch} from './search.js';
import {registerShare} from './share.js';

function listen(ss, names, fn) { const offs = names.map(n => ss.hooks.on(n, fn)); return () => offs.forEach(o => o()); }

export function registerPanels(ss) {
  const R = ss.reg.windows;

  // ---------------- Ландшафты ----------------
  R.register({id: 'palette', title: 'Ландшафты', dock: 'right', order: 1, defaultOpen: true, width: 310, accel: 'Ctrl+1', render(body) {
    const search = h('input', {class: 'field', type: 'search', placeholder: 'Поиск по типам…', id: 'palSearch'});
    const palList = h('div', {class: 'pal'});
    const lib = h('div', {class: 'lib'});
    const palSec = section('Палитра планеты', true, palList,
      h('div', {class: 'btnrow'}, button('+ Свой тип', () => ss.addCustomType()), button('Обновить из наборов', () => ss.syncPaletteFromPacks())));
    const libSec = section('Библиотека наборов', true, lib);
    body.append(search, palSec, libSec);
    let counts = [];
    const recount = () => { const d = ss.doc; counts = new Array(d.palette.length).fill(0); for (let c = 0; c < d.cells.length; c++) counts[d.cells[c]]++; };
    function renderPal() {
      const q = search.value.trim().toLowerCase(), d = ss.doc, V = d.cells.length;
      palList.innerHTML = '';
      d.palette.forEach((p, i) => {
        if (q && !p.name.toLowerCase().includes(q)) return;
        const pct = counts[i] ? (counts[i] / V * 100) : 0;
        palList.appendChild(h('div', {class: 'pal-row' + (i === ss.editor.sel ? ' sel' : ''), title: i < 9 ? `Клавиша ${i + 1}` : '', onclick: (e) => { if (!e.target.closest('.pal-del')) ss.selectType(i); }},
          h('span', {class: 'hex', style: {background: p.color}}),
          h('span', {class: 'pal-name'}, p.name),
          h('span', {class: 'pal-pct'}, counts[i] ? (pct < 1 ? '<1%' : Math.round(pct) + '%') : ''),
          h('button', {class: 'pal-del', title: 'Убрать из палитры', onclick: () => ss.removePaletteEntry(i)}, '×')));
      });
    }
    function renderLib() {
      const q = search.value.trim().toLowerCase(), used = new Set(ss.doc.palette.map(p => p.src).filter(Boolean));
      lib.innerHTML = '';
      for (const pack of ss.reg.packs.list()) {
        const items = ss.reg.terrains.list().filter(t => t.pack === pack.id && (!q || t.name.toLowerCase().includes(q)));
        if (!items.length) continue;
        const groups = new Map(); for (const t of items) { if (!groups.has(t.group)) groups.set(t.group, []); groups.get(t.group).push(t); }
        const inner = [];
        for (const [g, ts] of groups) {
          inner.push(h('div', {class: 'grp'}, g));
          inner.push(h('div', {class: 'chips'}, ts.map(t => h('button', {class: 'chip' + (used.has(t.id) ? ' added' : ''), title: describe(ss, t), onclick: () => ss.addTerrainToPalette(t.id)},
            h('i', {class: 'hex', style: {background: t.color}}), t.name))));
        }
        const det = h('details', {class: 'pack', open: !!q || pack.id === 'base'}, h('summary', null, pack.name, h('span', {class: 'muted'}, ` · ${pack.version}`)), ...inner);
        lib.appendChild(det);
      }
      if (!lib.children.length) lib.appendChild(note('Ничего не найдено.'));
    }
    const update = () => { recount(); renderPal(); renderLib(); };
    const lazyCount = debounce(() => { recount(); renderPal(); }, 250);
    search.addEventListener('input', () => { renderPal(); renderLib(); });
    const off = listen(ss, ['palette:changed', 'selection:changed', 'doc:loaded', 'registry:terrains', 'registry:packs'], update);
    const off2 = ss.hooks.on('doc:changed', (e) => { if (!e || e.layer === 'terrain') lazyCount(); });
    update();
    return {update, destroy() { off(); off2(); }};
  }});

  // ---------------- Свойства типа ----------------
  R.register({id: 'props', title: 'Свойства типа', dock: 'right', col: 1, order: 2, defaultOpen: true, width: 310, accel: 'Ctrl+2', render(body) {
    const head = h('div', {class: 'props-head'});
    const name = h('input', {class: 'field', id: 'tpName', maxlength: 60});
    const color = h('input', {type: 'color', id: 'tpColor', class: 'color'});
    const hS = slider({id: 'tpH', label: 'Высота', min: -3, max: 3, step: 0.1, value: 0, format: v => (v > 0 ? '+' : '') + Number(v).toFixed(1), onInput: v => ss.updatePaletteEntry(ss.editor.sel, {h: v})});
    const vS = slider({id: 'tpV', label: 'Неровность', min: 0, max: 2, step: 0.05, value: 0, format: v => Number(v).toFixed(2), onInput: v => ss.updatePaletteEntry(ss.editor.sel, {v})});
    const opts = (reg, none) => [{value: '', label: none}, ...ss.reg[reg].list().map(x => ({value: x.id, label: x.name}))];
    const fxS = select({id: 'tpFx', label: 'Эффект', options: opts('effects', 'Нет'), value: '', onChange: v => ss.updatePaletteEntry(ss.editor.sel, {fx: v})});
    const txS = select({id: 'tpTex', label: 'Поверхность', options: opts('textures', 'Гладкая'), value: '', onChange: v => ss.updatePaletteEntry(ss.editor.sel, {tex: v})});
    const bdS = select({id: 'tpBld', label: 'Застройка (3D)', options: opts('buildings', 'Нет'), value: '', onChange: v => ss.updatePaletteEntry(ss.editor.sel, {bld: v})});
    const src = h('div', {class: 'note'});
    const resetBtn = button('Сбросить к набору', () => ss.resetPaletteEntry(ss.editor.sel));
    name.addEventListener('input', () => ss.updatePaletteEntry(ss.editor.sel, {name: name.value}, true));
    color.addEventListener('input', () => ss.updatePaletteEntry(ss.editor.sel, {color: color.value}, true));
    body.append(head,
      section('Основное', true, h('div', {class: 'row2'}, color, name), hS, vS),
      section('Внешний вид', true, fxS, txS, bdS),
      section('Источник', false, src, h('div', {class: 'btnrow'}, resetBtn, button('Экспорт палитры…', () => ss.exportPalettePack()))));
    function update() {
      const p = ss.doc.palette[ss.editor.sel]; if (!p) return;
      head.innerHTML = ''; head.append(h('span', {class: 'hex big', style: {background: p.color}}), h('b', null, p.name));
      if (document.activeElement !== name) name.value = p.name;
      color.value = p.color; hS.set(p.h); vS.set(p.v);
      fxS.setOptions(opts('effects', 'Нет'), p.fx); txS.setOptions(opts('textures', 'Гладкая'), p.tex); bdS.setOptions(opts('buildings', 'Нет'), p.bld);
      const t = p.src && ss.reg.terrains.get(p.src);
      src.textContent = p.src ? (t ? `Из набора «${(ss.reg.packs.get(t.pack) || {}).name || t.pack}», id ${p.src}` : `Набор с типом ${p.src} сейчас не загружен`) : 'Свой тип, не связан с набором.';
      resetBtn.disabled = !t;
    }
    const off = listen(ss, ['selection:changed', 'palette:changed', 'doc:loaded', 'registry:effects', 'registry:textures', 'registry:buildings'], update);
    update();
    return {update, destroy: off};
  }});

  // ---------------- Точки интереса ----------------
  R.register({id: 'pois', title: 'Точки интереса', dock: 'right', order: 3, defaultOpen: false, width: 310, accel: 'Ctrl+3', render(body) {
    const kinds = h('div', {class: 'poi-kinds'});
    const editor = h('div', {class: 'props-box', hidden: true});
    const kindSel = h('select', {id: 'poiKindSel'});
    const nameI = h('input', {class: 'field', id: 'poiName', placeholder: 'Название', maxlength: 60});
    const noteI = h('textarea', {class: 'field', id: 'poiNote', rows: 4, placeholder: 'Заметка для мастера'});
    editor.append(kindSel, nameI, noteI, h('div', {class: 'btnrow'}, button('Показать', () => { const i = ss.editor.poiSel; if (i >= 0) ss.pois.flyTo(ss.doc.pois[i].c); }), button('Удалить', () => ss.pois.remove(ss.editor.poiSel), 'danger')));
    const list = h('div', {class: 'poi-list'});
    const vis = check({id: 'poiVis', label: 'Показывать метки', checked: ss.prefs.pois, onChange: v => ss.setPref('pois', v)});
    body.append(section('Поставить метку', true, kinds, note('Выбери вид и кликай по планете (инструмент «Метка», P). Клик по клетке с меткой выбирает её.')),
      section('Выбранная метка', true, editor, h('div', {class: 'note', id: 'poiNone'}, 'Метка не выбрана.')),
      section('Все метки', true, list, vis));
    kindSel.addEventListener('change', () => ss.pois.update(ss.editor.poiSel, {kind: kindSel.value}));
    nameI.addEventListener('input', () => ss.pois.update(ss.editor.poiSel, {name: nameI.value}));
    noteI.addEventListener('input', () => { const i = ss.editor.poiSel; if (i >= 0) { ss.doc.pois[i].note = noteI.value; ss.docChanged({layer: 'pois'}); } });
    function update() {
      const K = ss.reg.poiKinds.list();
      if (!ss.editor.poiKind && K[0]) ss.editor.poiKind = K[0].id;
      kinds.innerHTML = '';
      K.forEach(k => kinds.appendChild(h('button', {class: ss.editor.poiKind === k.id ? 'on' : '', title: k.name, onclick: () => { ss.editor.poiKind = k.id; ss.pois.select(-1); ss.setTool('poi'); update(); }, html: ss.pois.badgeHtml(k.id) + `<span>${k.name}</span>`})));
      kindSel.innerHTML = ''; K.forEach(k => kindSel.appendChild(h('option', {value: k.id}, `${k.sym}  ${k.name}`)));
      const i = ss.editor.poiSel, p = ss.doc.pois[i];
      editor.hidden = !p; body.querySelector('#poiNone').hidden = !!p;
      if (p) { kindSel.value = p.kind; if (document.activeElement !== nameI) nameI.value = p.name; if (document.activeElement !== noteI) noteI.value = p.note; }
      list.innerHTML = '';
      if (!ss.doc.pois.length) list.appendChild(note('Меток пока нет.'));
      ss.doc.pois.forEach((q, j) => list.appendChild(h('button', {class: 'poi-row' + (j === i ? ' sel' : ''), onclick: () => { ss.pois.select(j); ss.pois.flyTo(q.c); }, html: ss.pois.badgeHtml(q.kind) + `<span></span>`})));
      [...list.querySelectorAll('.poi-row span:last-child')].forEach((s, j) => { const q = ss.doc.pois[j]; s.textContent = q.name || `${ss.pois.kindOf(q.kind).name} #${j + 1}`; });
      vis.set(ss.prefs.pois);
    }
    const off = listen(ss, ['pois:changed', 'pois:selected', 'doc:loaded', 'registry:poiKinds', 'prefs:changed'], update);
    update();
    return {update, destroy: off};
  }});

  // ---------------- Планета ----------------
  R.register({id: 'planet', title: 'Планета', dock: 'left', order: 1, defaultOpen: true, width: 290, accel: 'Ctrl+4', render(body) {
    const nameI = h('input', {class: 'field', id: 'plName', maxlength: 80});
    nameI.addEventListener('input', () => { ss.doc.name = nameI.value || 'Планета'; ss.docChanged({layer: 'meta'}); });
    const countBox = h('div', {class: 'count'});
    const showCount = (n) => {
      const t = cellCount(n), heavy = n > 70 ? 'очень тяжёлая планета: нужна мощная видеокарта и ~0,5 ГБ памяти' : n > 50 ? 'тяжёлая планета: на слабых компьютерах кисть может подтормаживать' : '';
      countBox.innerHTML = `<b>${fmt(t)}</b> ${plural(t, 'клетка', 'клетки', 'клеток')}<small>${fmt(t - 12)} гексов + 12 пятиугольников · частота ${n}</small>` + (heavy ? `<small class="warn-text">${heavy}</small>` : '');
    };
    const sizeS = slider({id: 'plSize', label: 'Частота сетки', min: 1, max: 100, step: 1, value: ss.doc.n, onInput: showCount, onChange: v => ss.resizePlanet(v)});

    // generation lives in its own window («Генератор миров»); here only a summary and a shortcut
    const genNote = h('div', {class: 'note'});

    // sky
    const clock = h('div', {class: 'clock'}, h('b', {id: 'clkTime'}, '--:--'), h('span', {id: 'clkPhase'}, ''), h('small', null, 'время на нулевом меридиане'));
    const playBtn = button('Стоп', () => ss.sky.togglePause());
    const dayI = h('input', {class: 'field', type: 'number', id: 'dayMin', min: 0.1, max: 1440, step: 0.1});
    dayI.addEventListener('input', () => { const v = parseFloat(String(dayI.value).replace(',', '.')); if (v > 0) ss.sky.set({dayMin: Math.min(1440, Math.max(0.1, v))}); });
    const tiltS = slider({id: 'skTilt', label: 'Наклон оси', min: 0, max: 60, value: 23, format: v => v + '°', onInput: v => ss.sky.set({tilt: v})});
    const nightS = slider({id: 'skNight', label: 'Свет на ночной стороне', min: 0, max: 80, value: 20, format: v => v + '%', onInput: v => ss.sky.set({night: v})});
    // the star belongs to the star system: changing it here changes it for every planet of the system
    const STAR = ['#ffe9b0', '#fff4e0', '#ffd27a', '#ff9e5e', '#ff6b4a', '#bcd4ff', '#8fb4ff', '#ffffff', '#c39bff', '#7fe3b0'];
    const sysSel = () => (ss.space && ss.space.nav.level === 'planet' ? {kind: 'system', id: ss.space.nav.sid} : null);
    const starSw = h('div', {class: 'swatches'});
    const starCol = h('input', {type: 'color', class: 'color', id: 'starColor'});
    starCol.addEventListener('change', () => { const s = sysSel(); if (s) ss.space.update(s, {starColor: starCol.value}, 'Цвет звезды'); });
    const starSize = slider({id: 'starSize', label: 'Размер звезды', min: 0.3, max: 3, step: 0.1, value: 1, format: v => Number(v).toFixed(1), onChange: v => { const s = sysSel(); if (s) ss.space.update(s, {starSize: v}, 'Размер звезды'); }});
    const starName = h('div', {class: 'note'});
    // this planet's atmosphere (saved with the planet; generators may switch it)
    const ATMO = ['#6badff', '#9fd8ff', '#ffb38f', '#ff8a6a', '#c39bff', '#9fffd8', '#e8e4d0', '#ffe08a'];
    const atmoOn = check({id: 'atmoOn', label: 'У планеты есть атмосфера', checked: true, onChange: v => ss.setAtmosphere({on: v})});
    const atmoSw = h('div', {class: 'swatches'});
    const atmoCol = h('input', {type: 'color', class: 'color', id: 'atmoColor'});
    atmoCol.addEventListener('input', () => ss.setAtmosphere({color: atmoCol.value}));

    // view
    const P = ss.prefs;
    const reliefS = slider({id: 'vRelief', label: 'Рельеф', min: 0, max: 300, step: 10, value: Math.round(ss.doc.relief * 100), format: v => v + '%', onInput: v => ss.setRelief(v / 100)});
    // display options for all planets live in «Настройки» (⚙ in the top bar)

    body.append(
      section('Планета', true, h('div', {class: 'field-row'}, h('label', {class: 'lbl', for: 'plName'}, 'Название'), nameI), countBox, sizeS, reliefS, genNote),
      section('Звезда и сутки', true, clock, h('div', {class: 'btnrow three'}, button('◀ Фаза', () => ss.sky.jump(-1)), playBtn, button('Фаза ▶', () => ss.sky.jump(1))),
        h('div', {class: 'field-row'}, h('label', {class: 'lbl', for: 'dayMin'}, 'Длина суток, минут'), dayI), tiltS, nightS),
      section('Атмосфера', false, atmoOn, atmoSw, h('label', {class: 'check'}, atmoCol, 'Свой цвет'),
        note('Своя у каждой планеты. Генератор «Луна» её выключает, «Континенты» включают. Галочка «Атмосфера» в «Виде» прячет её на всех планетах сразу.')),
      section('Звезда системы', false, starName, starSw, h('label', {class: 'check'}, starCol, 'Свой цвет'), starSize,
        note('Звезда общая для всей системы: цвет и размер меняются у всех её планет. Клик по другой планете на небе — перелёт к ней.')),
    );
    function update() {
      const d = ss.doc;
      if (document.activeElement !== nameI) nameI.value = d.name;
      sizeS.set(d.n); showCount(d.n);
      if (document.activeElement !== dayI) dayI.value = d.sky.dayMin;
      tiltS.set(d.sky.tilt); nightS.set(d.sky.night); playBtn.textContent = d.sky.paused ? 'Пуск' : 'Стоп'; playBtn.classList.toggle('on', d.sky.paused);
      reliefS.set(Math.round(d.relief * 100));
      const lg = d.meta && d.meta.gen && ss.reg.generators.get(d.meta.gen.id);
      genNote.textContent = lg ? `Создана: «${lg.name.replace(/\s*\(мод\)\s*$/, '')}», сид ${d.meta.gen.seed}. Ctrl+G — ещё вариант, «Генератор» вверху — другие миры.` : 'Нарисована вручную. «Генератор» вверху — создать мир.';
      const at = d.atmo || {on: true, color: '#6badff'};
      atmoOn.set(at.on); if (document.activeElement !== atmoCol) atmoCol.value = at.color;
      atmoSw.innerHTML = '';
      ATMO.forEach(c => atmoSw.appendChild(h('button', {class: c.toLowerCase() === at.color.toLowerCase() ? 'on' : '', style: {background: c}, title: c, onclick: () => ss.setAtmosphere({on: true, color: c})})));
      const sys = ss.space && ss.space.current().s;
      if (sys) {
        starName.textContent = `Звезда системы «${sys.name}»`;
        starCol.value = sys.starColor; starSize.set(sys.starSize);
        starSw.innerHTML = '';
        ss.space.STAR_PALETTE.forEach(({color: c, name}) => starSw.appendChild(h('button', {class: c.toLowerCase() === sys.starColor.toLowerCase() ? 'on' : '', style: {background: c}, title: name + ' · ' + c, onclick: () => ss.space.update(sysSel(), {starColor: c}, 'Цвет звезды')})));
      }
    }
    const off = listen(ss, ['doc:loaded', 'sky:changed', 'prefs:changed', 'registry:generators', 'view:installed', 'space:changed', 'level:changed', 'atmo:changed', 'look:changed'], update);
    const off2 = ss.hooks.on('sky:tick', ({text, phase}) => { body.querySelector('#clkTime').textContent = text; body.querySelector('#clkPhase').textContent = phase; });
    update();
    return {update, destroy() { off(); off2(); }};
  }});

  // ---------------- Маркеры ----------------
  R.register({id: 'markers', title: 'Маркеры', dock: 'left', order: 2, defaultOpen: false, width: 270, accel: 'Ctrl+5', render(body) {
    const PRESET = ['#e6372e', '#ff7a59', '#ff9f1c', '#f4c430', '#a3e048', '#2fbf71', '#1fc8b8', '#4cc9f0', '#3a86ff', '#8e5cf7', '#e0457b', '#f5f5f5', '#121212', '#8b1e1e'];
    const cur = h('div', {class: 'cur'});
    const sw = h('div', {class: 'swatches'});
    const custom = h('input', {type: 'color', class: 'color', id: 'mkCustom', value: '#e6372e'});
    custom.addEventListener('change', () => ss.selectMarker(custom.value));
    const op = slider({id: 'mkOp', label: 'Непрозрачность', min: 10, max: 100, value: Math.round(ss.prefs.markerOpacity * 100), format: v => v + '%', onInput: v => ss.setPref('markerOpacity', v / 100)});
    const vis = check({id: 'mkVis', label: 'Показывать маркеры', checked: ss.prefs.markers, onChange: v => ss.setPref('markers', v)});
    body.append(note('Маркеры рисуются полупрозрачно поверх ландшафта и его не меняют. Слой переключается клавишей M.'), cur, sw,
      h('label', {class: 'check'}, custom, 'Свой цвет'), op, vis,
      h('div', {class: 'btnrow'}, button('Рисовать маркером', () => { ss.setLayer('mark'); ss.setTool('brush'); }, 'primary'), button('Стереть все', () => ss.clearMarkers(), 'danger')));
    function update() {
      const c = ss.doc.markerColors[ss.editor.markerSel] || '#e6372e';
      cur.innerHTML = ''; cur.append('Текущий цвет: ', h('i', {style: {background: c}}));
      sw.innerHTML = '';
      const all = [...new Set([...PRESET, ...ss.doc.markerColors])];
      all.forEach(col => sw.appendChild(h('button', {class: col.toLowerCase() === c.toLowerCase() ? 'on' : '', style: {background: col}, title: col, onclick: () => ss.selectMarker(col)})));
      op.set(Math.round(ss.prefs.markerOpacity * 100)); vis.set(ss.prefs.markers);
    }
    const off = listen(ss, ['selection:changed', 'doc:loaded', 'prefs:changed'], update);
    update();
    return {update, destroy: off};
  }});

  // planet editor windows only show on the planet level
  for (const id of ['palette', 'props', 'pois', 'planet', 'markers']) R.update(id, {levels: ['planet']});

  // ---------------- Справка ----------------
  registerFxWindow(ss);
  registerGenDialog(ss);
  registerDevWindow(ss);

  registerAppDialogs(ss, HELP_HTML);
  registerQuickGen(ss);
  registerSearch(ss);
  registerShare(ss);
}

function describe(ss, t) {
  const parts = [t.name];
  if (Math.abs(t.h) >= 0.05) parts.push((t.h > 0 ? '▲ ' : '▼ ') + Math.abs(t.h).toFixed(1));
  for (const [reg, id] of [['effects', t.fx], ['textures', t.tex], ['buildings', t.bld]]) { const x = id && ss.reg[reg].get(id); if (x) parts.push(x.name); }
  return parts.join(' · ');
}

const HELP_HTML = `
<details class="sec" open><summary><span class="sec-title">Космос: уровни</span></summary><div class="sec-body help">
<p>Вселенная → Галактика → Звёздная система → Планета. Внизу по центру — где ты сейчас, клик по звену переносит туда.</p>
<p><kbd>Двойной клик</kbd> или <kbd>Enter</kbd> — войти внутрь · <kbd>Ctrl+↑</kbd> — уровень выше · крути колесо дальше предела масштаба — уровень меняется сам</p>
<p><kbd>V</kbd> выбор и перенос · <kbd>A</kbd> добавить · <kbd>L</kbd> маршрут · <kbd>Del</kbd> удалить · <kbd>Esc</kbd> отмена · <kbd>ПКМ</kbd> наклон и поворот · тянуть пустоту — сдвиг</p>
<p>В галактике клик по пустому месту выбирает сектор: ему можно дать имя, цвет и заметку.</p>
</div></details>
<details class="sec" open><summary><span class="sec-title">Управление на планете</span></summary><div class="sec-body help">
<p><kbd>ЛКМ</kbd> рисовать · <kbd>ПКМ</kbd> / <kbd>Shift</kbd>+ЛКМ крутить · колесо — масштаб</p>
<p><kbd>B</kbd> кисть · <kbd>F</kbd> заливка · <kbd>I</kbd> пипетка · <kbd>E</kbd> ластик маркеров · <kbd>P</kbd> метка · <kbd>R</kbd> вращать</p>
<p><kbd>[</kbd> <kbd>]</kbd> размер кисти · <kbd>1</kbd>–<kbd>9</kbd> тип из палитры · <kbd>M</kbd> слой</p>
<p><kbd>Пробел</kbd> стоп суток · <kbd>,</kbd> <kbd>.</kbd> фазы · <kbd>Del</kbd> удалить метку</p>
<p><kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd> отмена/повтор · <kbd>Ctrl+S</kbd> сохранить · <kbd>Ctrl+O</kbd> открыть · <kbd>Ctrl+1…5</kbd> окна</p>
</div></details>
<details class="sec" open><summary><span class="sec-title">Генерация, орбита, эффекты</span></summary><div class="sec-body help">
<p><kbd>Ctrl+8</kbd> «Генератор миров»: галерея с предпросмотром и поиском, слева настройки мира и дополнения («Обитаемость» и др.). Двойной клик по карточке — сразу сгенерировать. <kbd>Ctrl+G</kbd> — ещё вариант с теми же настройками.</p>
<p>Новая генерация очищает орбиту и сбрасывает эффекты; галочка «Оставить орбиту и эффекты как есть» в галерее это отключает. Неиспользуемые типы из библиотеки при генерации уходят из палитры.</p>
<p><kbd>Ctrl+6</kbd> «Орбита»: кольца, обломки, корабли, станции, спутники, города-кольца · <kbd>Ctrl+7</kbd> «Эффекты»: снег, пепел, дождь, рой… с плотностью, скоростью и цветом.</p>
</div></details>
<details class="sec" open><summary><span class="sec-title">Наборы (без кода)</span></summary><div class="sec-body help">
<p>JSON-файл в папке <code>packs/</code>:</p>
<pre>{ "format": "sspace-pack", "id": "my", "name": "Мой набор", "version": "1.0.0",
  "terrains": [ {"id":"moss","name":"Мох","color":"#5a7a3a","h":0.2,"v":0.1,
                 "fx":"","tex":"grass","bld":"","group":"Болота"} ],
  "poiKinds": [ {"id":"cave","sym":"◐","name":"Пещера","color":"#c9a"} ] }</pre>
<p>Эффекты: {{FX}}</p><p>Поверхности: {{TEX}}</p><p>Застройка: {{BLD}}</p>
</div></details>
<details class="sec"><summary><span class="sec-title">Моды (JavaScript)</span></summary><div class="sec-body help">
<p>Папка в <code>mods/</code> с <code>mod.json</code> и <code>main.js</code>:</p>
<pre>export function activate(ss, mod) {
  ss.reg.terrains / effects / textures / buildings / poiKinds
  ss.reg.generators / genLayers / tools / windows / menus   // .register({id,...})
  ss.registerPack({...})        // данные как в JSON
  ss.hooks.on('frame', ({dt,t}) => …)
  ss.hooks.on('cellInfo', (text, c) => text + ' …')   // фильтр
  ss.patch(ss.view, 'topR', (orig, c) => orig(c))      // обёртка любой функции
  ss.particles.forLook('snow', {name, motion: 'fall', …})  // эффект в окне «Эффекты»
  ss.orbit.registerType({id, name, params, build})       // объект для окна «Орбита»
  ss.THREE, ss.scene, ss.view, ss.doc, ss.ui, ss.history
}</pre>
<p>События: <code>frame, doc:loaded, doc:changed, palette:changed, selection:changed, tool:changed, prefs:changed, pois:changed, sky:tick, view:heights, mods:loaded, look:changed, fx:changed, generate:done, orbit:changed, registry:&lt;вид&gt;</code>. Фильтры: <code>cellInfo</code>.</p>
<p>Пример — <code>mods/example-moon</code>.</p>
</div></details>`;
