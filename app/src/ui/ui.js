// UI shell: menu bar, tool bar, status bar, toasts, modals and the window manager.
import {h, fmt, cellCount, plural} from '../core/util.js';
import {createDialogs} from './dialogs.js';
import {createWM} from './wm.js';
import * as w from './widgets.js';

export const MENU_ORDER = ['Файл', 'Правка', 'Вид', 'Планета', 'Окна', 'Моды', 'Справка'];

export function createUI(ss) {
  const menubar = document.getElementById('menubar');
  const toolbar = document.getElementById('toolbar');
  const layer = document.getElementById('windows');
  const stInfo = document.getElementById('stInfo'), stHint = document.getElementById('stHint'), stRight = document.getElementById('stRight');
  const toastEl = document.getElementById('toast');
  const wm = createWM(ss, layer);
  let openMenu = null, toastT = 0;

  // ---------- FPS counter (status bar) ----------
  const fpsEl = document.getElementById('stFps');
  const fpsSt = {frames: 0, t0: performance.now(), worst: 0, last: performance.now()};
  ss.hooks.on('frame', () => {
    const now = performance.now(), ft = now - fpsSt.last; fpsSt.last = now;
    if (!ss.prefs.fps) return;
    fpsSt.frames++; if (ft > fpsSt.worst) fpsSt.worst = ft;
    const span = now - fpsSt.t0;
    if (span >= 500) {
      const fps = fpsSt.frames * 1000 / span;
      fpsEl.textContent = `${Math.round(fps)} FPS · ${(span / fpsSt.frames).toFixed(1)} мс`;
      fpsEl.title = `Средний кадр ${(span / fpsSt.frames).toFixed(1)} мс, самый долгий за полсекунды ${fpsSt.worst.toFixed(1)} мс`;
      fpsEl.className = fps >= 55 ? 'good' : fps >= 30 ? 'mid' : 'bad';
      fpsSt.frames = 0; fpsSt.t0 = now; fpsSt.worst = 0;
    }
  }, -100);
  ss.hooks.on('prefs:changed', ({key}) => { if (key === 'fps') fpsEl.hidden = !ss.prefs.fps; });
  fpsEl.hidden = !ss.prefs.fps;

  // ---------- menu bar ----------
  function menuItems(name) {
    if (name === 'Окна') {
      const items = ss.reg.windows.list().filter(d => wm.levelOk(d)).sort((a, b) => (a.order || 0) - (b.order || 0)).map(d => ({id: 'win:' + d.id, label: d.title, checked: () => wm.isOpen(d.id), action: () => wm.toggle(d.id), accel: d.accel}));
      items.push({sep: true},
        {id: 'win:magnet', label: 'Магнит окон (Alt — временно выключить)', checked: () => ss.prefs.magnet !== false, action: () => { ss.setPref('magnet', ss.prefs.magnet === false); toast(ss.prefs.magnet ? 'Магнит окон включён' : 'Магнит окон выключен'); }},
        {id: 'win:reset', label: 'Сбросить расположение окон', action: () => wm.resetLayout()});
      return items;
    }
    const list = ss.reg.menus.list().filter(m => m.menu === name && !m.hidden).sort((a, b) => (a.order || 0) - (b.order || 0));
    const out = []; let lastGroup = null;
    for (const m of list) { const g = Math.floor((m.order || 0) / 100); if (lastGroup !== null && g !== lastGroup) out.push({sep: true}); lastGroup = g; out.push(m); }
    return out;
  }
  function renderMenubar() {
    menubar.innerHTML = '';
    menubar.appendChild(h('div', {class: 'brand'}, h('b', null, 'S'), 'Space'));
    const names = [...MENU_ORDER];
    for (const m of ss.reg.menus.list()) if (!names.includes(m.menu)) names.splice(names.length - 1, 0, m.menu);
    for (const name of names) {
      const btn = h('button', {class: 'menu-title'}, name);
      const drop = h('div', {class: 'menu-drop', hidden: true});
      const wrap = h('div', {class: 'menu'}, btn, drop);
      const fill = () => {
        drop.innerHTML = '';
        for (const it of menuItems(name)) {
          if (it.sep) { drop.appendChild(h('div', {class: 'menu-sep'})); continue; }
          const enabled = !it.enabled || it.enabled(ss), checked = it.checked ? it.checked(ss) : null;
          drop.appendChild(h('button', {class: 'menu-item' + (checked ? ' checked' : ''), disabled: !enabled, onclick: () => { closeMenus(); try { it.action(ss); } catch (e) { console.error(e); toast('Ошибка: ' + e.message); } refreshMenus(); }},
            h('span', {class: 'mi-check'}, checked === null ? '' : (checked ? '✓' : '')), h('span', {class: 'mi-label'}, it.label), h('span', {class: 'mi-accel'}, it.accel || '')));
        }
      };
      btn.addEventListener('click', (e) => { e.stopPropagation(); if (openMenu === wrap) closeMenus(); else { closeMenus(); fill(); drop.hidden = false; wrap.classList.add('open'); openMenu = wrap; } });
      btn.addEventListener('mouseenter', () => { if (openMenu && openMenu !== wrap) { closeMenus(); fill(); drop.hidden = false; wrap.classList.add('open'); openMenu = wrap; } });
      menubar.appendChild(wrap);
    }
    // quick buttons: menu items with `bar: {icon, text, side: 'left' | 'right', active()}` also live in the bar
    const barItems = ss.reg.menus.list().filter(m => m.bar).sort((a, b) => (a.bar.order ?? a.order ?? 0) - (b.bar.order ?? b.order ?? 0));
    const mk = (m) => {
      const b = h('button', {class: 'bar-btn', 'data-id': m.id, title: m.label + (m.accel ? ' (' + m.accel + ')' : ''), onclick: () => { closeMenus(); const cur = ss.reg.menus.get(m.id) || m; /* a mod may have changed the action since */ try { cur.action(ss); } catch (e) { console.error(e); toast('Ошибка: ' + e.message); } updateBar(); }},
        ss.themes.icon(m.bar.icon || 'dots', 'bar-ico'), m.bar.text ? h('span', {class: 'bar-text'}, m.bar.text) : null);
      return b;
    };
    menubar.appendChild(h('div', {class: 'bar-group'}, barItems.filter(m => m.bar.side !== 'right').map(mk)));
    menubar.appendChild(h('div', {class: 'menu-spacer'}));
    menubar.appendChild(h('div', {class: 'doc-title', id: 'docTitle'}));
    menubar.appendChild(h('div', {class: 'bar-group right'}, barItems.filter(m => m.bar.side === 'right').map(mk)));
    updateTitle(); updateBar();
  }
  // show only what works here (planet buttons on the planet), light up what is open
  function updateBar() {
    for (const b of menubar.querySelectorAll('.bar-btn')) {
      const m = ss.reg.menus.get(b.dataset.id); if (!m) continue;
      const en = !m.enabled || m.enabled(ss);
      b.hidden = !en && m.bar.hideOff !== false; b.disabled = !en;
      b.classList.toggle('on', !!(m.bar.active && m.bar.active(ss)));
    }
  }
  for (const e of ['level:changed', 'dialog:opened', 'dialog:closed', 'window:open', 'window:close', 'prefs:changed']) ss.hooks.on(e, () => updateBar());
  function closeMenus() { if (openMenu) { openMenu.querySelector('.menu-drop').hidden = true; openMenu.classList.remove('open'); openMenu = null; } closeContext(); }

  // ---------- context menu (right click) ----------
  // items: [{label, action, disabled, danger, checked, sub: [...items]}, {sep: true}, {title: 'Заголовок'}]
  let ctxEl = null;
  function closeContext() { if (ctxEl) { ctxEl.remove(); ctxEl = null; } }
  function fillCtx(box, items) {
    for (const it of items) {
      if (!it) continue;
      if (it.sep) { box.appendChild(h('div', {class: 'menu-sep'})); continue; }
      if (it.title) { box.appendChild(h('div', {class: 'ctx-title'}, it.title)); continue; }
      if (it.palette) { box.appendChild(ctxPalette(it.palette)); continue; }
      const hasSub = Array.isArray(it.sub) && it.sub.length;
      const btn = h('button', {class: 'menu-item ctx-item' + (it.danger ? ' danger' : '') + (it.checked ? ' checked' : ''), disabled: !!it.disabled || (Array.isArray(it.sub) && !it.sub.length)},
        h('span', {class: 'mi-check'}, it.checked ? '✓' : ''), h('span', {class: 'mi-label'}, it.swatch ? h('span', {class: 'mi-swatch', style: {background: it.swatch}}) : null, it.label), h('span', {class: 'mi-accel'}, hasSub ? '▸' : (it.accel || '')));
      if (hasSub) {
        const sub = h('div', {class: 'ctx ctx-sub', hidden: true});
        fillCtx(sub, it.sub);
        const wrap = h('div', {class: 'ctx-wrap'}, btn, sub);
        wrap.addEventListener('mouseenter', () => {
          for (const s of box.querySelectorAll(':scope > .ctx-wrap > .ctx-sub')) s.hidden = true;
          sub.hidden = false; sub.style.left = '100%'; sub.style.right = 'auto'; sub.style.top = '-5px';
          const r = sub.getBoundingClientRect();
          if (r.right > innerWidth - 4) { sub.style.left = 'auto'; sub.style.right = '100%'; }
          if (r.bottom > innerHeight - 4) sub.style.top = Math.min(-5, innerHeight - 4 - r.bottom - 5) + 'px';
        });
        box.appendChild(wrap);
      } else {
        btn.addEventListener('mouseenter', () => { for (const s of box.querySelectorAll(':scope > .ctx-wrap > .ctx-sub')) s.hidden = true; });
        btn.addEventListener('click', () => { closeContext(); try { it.action && it.action(); } catch (e) { console.error(e); toast('Ошибка: ' + e.message); } });
        box.appendChild(btn);
      }
    }
  }
  // palette item: {palette: {colors: ['#hex' | {color, name}], value, pick(c), custom: true, none: 'Без цвета'}}
  function ctxPalette(p) {
    const cur = String(p.value || '').toLowerCase();
    const pick = (c) => { closeContext(); try { p.pick(c); } catch (e) { console.error(e); toast('Ошибка: ' + e.message); } };
    const grid = h('div', {class: 'ctx-swatches'}, (p.colors || []).map(x => {
      const c = typeof x === 'string' ? x : x.color, name = typeof x === 'string' ? c : x.name + ' · ' + c;
      return h('button', {class: c.toLowerCase() === cur ? 'on' : '', style: {background: c}, title: name, onclick: () => pick(c)});
    }));
    const box = h('div', {class: 'ctx-palette'}, grid);
    if (p.custom !== false) {
      // the native colour dialog blurs the window (which closes this menu), so the input lives on <body>
      const open = (e) => {
        const r = (e.currentTarget || box).getBoundingClientRect();
        const inp = h('input', {type: 'color', value: /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#ffffff', style: {position: 'fixed', left: r.left + 'px', top: r.bottom + 'px', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none'}});
        document.body.appendChild(inp);
        inp.addEventListener('input', () => { try { p.preview && p.preview(inp.value); } catch {} });
        inp.addEventListener('change', () => { inp.remove(); try { p.pick(inp.value); } catch (er) { console.error(er); toast('Ошибка: ' + er.message); } });
        inp.addEventListener('blur', () => setTimeout(() => inp.remove(), 300));
        closeContext(); inp.click();
      };
      box.appendChild(h('button', {class: 'ctx-custom', onclick: open}, h('span', {class: 'mi-swatch', style: {background: cur || 'transparent'}}), h('span', null, 'Свой цвет…'), h('code', null, cur || '—')));
    }
    if (p.none) box.appendChild(h('button', {class: 'menu-item ctx-item', onclick: () => pick('')}, h('span', {class: 'mi-check'}, cur ? '' : '✓'), h('span', {class: 'mi-label'}, p.none)));
    return box;
  }
  function contextMenu(x, y, items) {
    closeMenus();
    items = ss.hooks.filter('contextMenu', items);
    if (!items || !items.length) return;
    ctxEl = h('div', {class: 'ctx'});
    fillCtx(ctxEl, items);
    document.body.appendChild(ctxEl);
    const r = ctxEl.getBoundingClientRect();
    ctxEl.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px';
    ctxEl.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px';
  }
  document.addEventListener('pointerdown', (e) => { if (ctxEl && !e.target.closest('.ctx')) closeContext(); }, true);
  window.addEventListener('blur', closeContext);
  function prompt(title, value = '', label = 'Название') {
    return new Promise(res => {
      const inp = h('input', {class: 'field', value, maxlength: 80});
      let done = false;
      const close = modal({title, body: h('div', {class: 'field-row'}, h('label', {class: 'lbl'}, label), inp), buttons: [
        {label: 'Отмена', action: () => { done = true; res(null); }},
        {label: 'OK', primary: true, action: () => { done = true; res(inp.value.trim() || null); }},
      ]});
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { done = true; close(); res(inp.value.trim() || null); } if (e.key === 'Escape') { done = true; close(); res(null); } });
      setTimeout(() => { inp.focus(); inp.select(); }, 20);
    });
  }
  document.addEventListener('pointerdown', (e) => { if (openMenu && !e.target.closest('.menu')) closeMenus(); });
  function refreshMenus() { /* menus are filled on open; nothing cached */ }

  function updateTitle() {
    const el = document.getElementById('docTitle'); if (!el) return;
    const camp = ss.space && ss.space.campaign;
    const base = camp ? camp.name : (ss.doc ? ss.doc.name : 'SSpace');
    const name = base + (ss.editor.dirty ? ' •' : '');
    el.textContent = name; document.title = `${name} — SSpace`;
  }

  // ---------- tool bar ----------
  function renderToolbar() {
    toolbar.innerHTML = '';
    const level = ss.space ? ss.space.nav.level : 'planet';
    for (const T of ss.reg.tools.list()) {
      if (!(T.levels || ['planet']).includes(level)) continue;
      toolbar.appendChild(h('button', {class: 'tb' + (ss.editor.tool === T.id ? ' on' : ''), title: `${T.name}${T.key ? ' (' + T.key + ')' : ''}${T.hint ? '\n' + T.hint : ''}`, onclick: () => ss.setTool(T.id), html: T.icon || `<span class="tb-letter">${T.name[0]}</span>`}));
    }
    if (level !== 'planet') {
      toolbar.appendChild(h('div', {class: 'tb-sep'}));
      toolbar.appendChild(h('button', {class: 'tb tb-up', title: 'Уровень выше (Ctrl+↑)', onclick: () => ss.space.up(), disabled: level === 'universe'}, ss.themes ? ss.themes.icon('up') : '▲', h('span', {class: 'tb-cap'}, 'Выше')));
      return;
    }
    toolbar.appendChild(h('div', {class: 'tb-sep'}));
    toolbar.appendChild(h('button', {class: 'tb tb-up', title: 'К звёздной системе (Ctrl+↑)', onclick: () => ss.space && ss.space.up()}, ss.themes ? ss.themes.icon('up') : '▲', h('span', {class: 'tb-cap'}, 'Выше')));
    toolbar.appendChild(h('div', {class: 'tb-sep'}));
    toolbar.appendChild(h('div', {class: 'tb-label'}, 'Слой'));
    toolbar.appendChild(h('button', {class: 'tb tb-text' + (ss.editor.layer === 'terrain' ? ' on' : ''), title: 'Ландшафт (M)', onclick: () => ss.setLayer('terrain')}, 'Земля'));
    toolbar.appendChild(h('button', {class: 'tb tb-text' + (ss.editor.layer === 'mark' ? ' on' : ''), title: 'Маркеры поверх ландшафта (M)', onclick: () => ss.setLayer('mark')}, 'Маркер'));
    toolbar.appendChild(h('div', {class: 'tb-sep'}));
    toolbar.appendChild(h('div', {class: 'tb-label'}, 'Кисть'));
    toolbar.appendChild(h('button', {class: 'tb tb-small', title: 'Больше ( ] )', onclick: () => ss.setRadius(ss.editor.radius + 1)}, '+'));
    toolbar.appendChild(h('div', {class: 'tb-radius', title: 'Радиус кисти'}, String(ss.editor.radius + 1)));
    toolbar.appendChild(h('button', {class: 'tb tb-small', title: 'Меньше ( [ )', onclick: () => ss.setRadius(ss.editor.radius - 1)}, '−'));
    toolbar.appendChild(h('div', {class: 'tb-sep'}));
    const cur = currentColor();
    toolbar.appendChild(h('div', {class: 'tb-current', title: cur.title, style: {background: cur.color}}));
  }
  function currentColor() {
    const ed = ss.editor, doc = ss.doc;
    if (!doc) return {color: '#000', title: ''};
    if (ed.layer === 'mark') return {color: ed.tool === 'erase' ? 'transparent' : doc.markerColors[ed.markerSel] || '#e6372e', title: 'Цвет маркера'};
    const p = doc.palette[ed.sel]; return {color: p ? p.color : '#000', title: p ? p.name : ''};
  }

  // ---------- status bar ----------
  const putInfo = (t) => { if (stInfo.textContent !== t) stInfo.textContent = t; };
  function setInfo(text) { putInfo(text || (ss.space ? ss.space.LEVEL_NAMES[ss.space.nav.level] : '')); }
  function cellInfo(c) {
    if (ss.space && ss.space.nav.level !== 'planet') return;
    if (c < 0 || !ss.view.H) { putInfo('Наведи на планету'); return; }
    const doc = ss.doc, p = doc.palette[doc.cells[c]], {lat, lon} = ss.view.cellLatLon(c), hv = ss.view.H[c], wet = ss.view.W[c];
    const ht = wet ? `глубина ${Math.abs(hv).toFixed(1)}` : (hv >= 0 ? `высота ${hv.toFixed(1)}` : `впадина ${Math.abs(hv).toFixed(1)}`);
    const pi = ss.pois.at(c), pm = pi >= 0 ? ` · ${ss.pois.kindOf(doc.pois[pi].kind).sym} ${doc.pois[pi].name || ss.pois.kindOf(doc.pois[pi].kind).name}` : '';
    const shape = ss.view.G.corners[c].length === 5 ? 'пятиугольник' : 'гекс';
    let text = `#${c} · ${p ? p.name : '?'}${doc.markers[c] ? ' · маркер' : ''}${pm} · ${ht} · ${shape} · ${Math.abs(lat).toFixed(0)}°${lat >= 0 ? 'с' : 'ю'} ${Math.abs(lon).toFixed(0)}°${lon >= 0 ? 'в' : 'з'}`;
    text = ss.hooks.filter('cellInfo', text, c);
    putInfo(text);
  }
  function updateStatus() {
    const T = ss.reg.tools.get(ss.editor.tool);
    stHint.textContent = T ? `${T.name}: ${T.hint || ''}` : '';
    const level = ss.space ? ss.space.nav.level : 'planet';
    if (level !== 'planet') {
      if (!ss.space.campaign) return;
      const c = ss.space.campaign, {g, s} = ss.space.current();
      stRight.textContent = level === 'universe' ? `Галактик: ${c.galaxies.length}` : level === 'galaxy' ? `Систем: ${g ? g.systems.length : 0} · секторов: ${g ? g.rings * g.slices + 1 : 0}` : `Планет: ${s ? s.planets.length : 0}`;
      return;
    }
    const n = ss.doc ? cellCount(ss.doc.n) : 0;
    stRight.textContent = `${ss.editor.layer === 'mark' ? 'Маркеры' : 'Ландшафт'} · ${fmt(n)} ${plural(n, 'клетка', 'клетки', 'клеток')} · ${ss.sky.clock || ''}`;
  }

  // ---------- toast / modal ----------
  function toast(msg, ms = 2400) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), ms); }
  function modal({title, body, buttons = [{label: 'Закрыть', primary: true}], width = 420, onDismiss}) {
    const back = h('div', {class: 'modal-back'});
    const close = () => back.remove();
    const foot = h('div', {class: 'modal-foot'}, buttons.map(b => h('button', {class: b.primary ? 'primary' : '', onclick: async () => { const r = b.action ? await b.action() : undefined; if (r !== false) close(); }}, b.label)));
    const box = h('div', {class: 'modal', style: {width: width + 'px'}}, h('div', {class: 'modal-head'}, title), h('div', {class: 'modal-body'}, body), foot);
    back.appendChild(box); document.body.appendChild(back);
    back.addEventListener('pointerdown', (e) => { if (e.target === back) { close(); onDismiss && onDismiss(); } });
    const first = box.querySelector('input,select,textarea,button.primary'); first && first.focus();
    return close;
  }
  function confirm(text, ok = 'Да', cancel = 'Отмена') {
    return new Promise(res => modal({title: 'Подтверждение', body: h('p', null, text), buttons: [{label: cancel, action: () => res(false)}, {label: ok, primary: true, action: () => res(true)}], onDismiss: () => res(false)}));
  }

  ss.hooks.on('sky:tick', updateStatus);
  document.getElementById('zIn').onclick = () => ss.scene.zoomBy(0.8);
  document.getElementById('zOut').onclick = () => ss.scene.zoomBy(1.25);
  document.getElementById('zReset').onclick = () => ss.scene.resetView();

  const dialogs = createDialogs(ss);
  return {
    dialogs, openDialog: (id, sec) => dialogs.open(id, sec), closeDialog: () => dialogs.close(), toggleDialog: (id, sec) => dialogs.toggle(id, sec), updateBar: () => updateBar(),
    w, wm, toast, modal, confirm, prompt, contextMenu, closeContext, cellInfo, setInfo, updateStatus, updateTitle, closeMenus, refreshMenus,
    renderMenubar, renderToolbar,
    openWindow: (id) => wm.open(id), closeWindow: (id) => wm.close(id), toggleWindow: (id) => wm.toggle(id),
    refreshWindows: () => wm.updateAll(),
  };
}
