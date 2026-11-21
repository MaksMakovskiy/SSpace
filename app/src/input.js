// Pointer / keyboard input and the built-in tools.
// A tool is {id, name, key, icon, hint, rotate?, drag?, layer?, hover(c, ss)->cells, down(ctx), drag(ctx), up(ctx)}.
// ctx = {c, e, ss}. Keyboard accelerators come from tools (key) and menu items (accel), matched by
// physical key (e.code), so shortcuts work in any keyboard layout.

const ICON = (d) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ICONS = {
  brush: ICON('<path d="M14 4l6 6-8.5 8.5a3 3 0 0 1-2 .9L5 20l.6-4.5a3 3 0 0 1 .9-2Z"/><path d="M12.5 5.5l6 6"/>'),
  fill: ICON('<path d="M5 11l7-7 7 7-7 7Z"/><path d="M19 15c1 1.5 1.5 2.5 1.5 3.2a1.5 1.5 0 0 1-3 0c0-.7.5-1.7 1.5-3.2Z"/>'),
  pick: ICON('<path d="M15 4l5 5-2 2-5-5Z"/><path d="M13 6L5 14v5h5l8-8"/>'),
  erase: ICON('<path d="M8 20h12"/><path d="M4 15l9-9 6 6-7 7H8Z"/><path d="M9 10l6 6"/>'),
  poi: ICON('<path d="M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11Z"/><path d="M10.5 8.5a1.6 1.6 0 1 1 2.1 1.5c-.4.2-.6.5-.6.9V12"/><path d="M12 14.5h.01"/>'),
  rotate: ICON('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>'),
};

export function keyFromEvent(e) {
  let k = e.code || '';
  if (k.startsWith('Key')) k = k.slice(3);
  else if (k.startsWith('Digit')) k = k.slice(5);
  else if (k.startsWith('Numpad') && /\d$/.test(k)) k = k.slice(6);
  else k = ({BracketLeft: '[', BracketRight: ']', Comma: ',', Period: '.', Minus: '-', Equal: '=', Backquote: '`', Slash: '/'})[k] || k;
  return (e.ctrlKey || e.metaKey ? 'Ctrl+' : '') + (e.shiftKey ? 'Shift+' : '') + (e.altKey ? 'Alt+' : '') + k;
}

export function createInput(ss) {
  const S = ss.scene, canvas = S.canvas, ed = ss.editor;
  const st = {holding: false, rotating: false, lastX: 0, lastY: 0, pointers: new Map(), pinch: 0, hover: -1, tool: null};
  const tool = () => ss.reg.tools.get(ed.tool) || ss.reg.tools.get('brush');
  const planetLevel = () => !ss.space || ss.space.nav.level === 'planet';
  let wheelOut = 0;

  function hoverAt(x, y) {
    const c = ss.view.pick(x, y);
    const sky = c < 0 && ss.skyObjects ? ss.skyObjects.pick(x, y) : null;
    canvas.classList.toggle('over-sky', !!sky);
    if (sky) { st.hover = -1; ss.view.setHover([]); ss.ui.setInfo(`Планета «${sky.name}» — клик, чтобы перелететь`); return -1; }
    if (c !== st.hover || st.holding) {
      st.hover = c;
      const T = tool();
      ss.view.setHover(c >= 0 && !T.rotate ? (T.hover ? T.hover(c, ss) : [c]) : []);
      ss.ui && ss.ui.cellInfo(c);
    }
    return c;
  }
  function refreshHover() { const c = st.hover; st.hover = -2; if (c >= 0) { const T = tool(); ss.view.setHover(T.hover && !T.rotate ? T.hover(c, ss) : [c]); st.hover = c; } }

  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    if (!planetLevel()) return;
    canvas.setPointerCapture(e.pointerId); st.pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (st.pointers.size === 2) { endStroke(); st.rotating = false; const [a, b] = [...st.pointers.values()]; st.pinch = Math.hypot(a.x - b.x, a.y - b.y); return; }
    st.lastX = e.clientX; st.lastY = e.clientY; st.holding = true;
    const T = tool(); st.tool = T;
    if (e.button === 2 || e.button === 1 || e.shiftKey || T.rotate) { st.rotating = true; canvas.classList.add('rotating'); return; }
    const c = ss.view.pick(e.clientX, e.clientY);
    if (c < 0 && e.button === 0 && ss.skyObjects) {
      // another planet of the system in the sky: fly there
      const it = ss.skyObjects.pick(e.clientX, e.clientY);
      if (it) { st.holding = false; st.tool = null; ss.space.go('planet', {pid: it.pid}); ss.ui.toast('Перелёт: ' + it.name); return; }
    }
    if (c < 0) { st.rotating = true; canvas.classList.add('rotating'); return; }
    st.hover = c;
    try { T.down && T.down({c, e, ss}); } catch (err) { console.error('[tool ' + T.id + ']', err); }
    ss.ui && ss.ui.cellInfo(c);
  });
  canvas.addEventListener('pointermove', e => {
    if (!planetLevel()) return;
    if (st.pointers.has(e.pointerId)) st.pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (st.pointers.size === 2) { const [a, b] = [...st.pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (st.pinch > 0) S.zoomBy(st.pinch / d); st.pinch = d; return; }
    if (st.rotating) S.rotateBy(e.clientX - st.lastX, e.clientY - st.lastY);
    else if (st.holding && st.tool && st.tool.drag) {
      const dx = e.clientX - st.lastX, dy = e.clientY - st.lastY, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
      for (let s = 1; s <= steps; s++) { const c = ss.view.pick(st.lastX + dx * s / steps, st.lastY + dy * s / steps); if (c >= 0) { try { st.tool.drag({c, e, ss}); } catch (err) { console.error(err); } } }
    }
    st.lastX = e.clientX; st.lastY = e.clientY;
    if (!st.rotating) { st.hx = e.clientX; st.hy = e.clientY; if (!st.hoverRaf) st.hoverRaf = requestAnimationFrame(() => { st.hoverRaf = 0; if (!st.rotating && planetLevel()) hoverAt(st.hx, st.hy); }); }
  });
  function endStroke() { if (st.tool && st.tool.up) { try { st.tool.up({e: null, ss}); } catch (err) { console.error(err); } } }
  function endPointer(e) {
    if (!planetLevel() && !st.pointers.size) return;
    st.pointers.delete(e.pointerId);
    if (st.pointers.size < 2) st.pinch = 0;
    if (st.pointers.size === 0) { if (!st.rotating) endStroke(); st.rotating = false; st.holding = false; st.tool = null; canvas.classList.remove('rotating'); }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', () => { if (planetLevel() && !st.pointers.size) { st.hover = -1; ss.view.setHover([]); ss.ui && ss.ui.cellInfo(-1); } });
  canvas.addEventListener('wheel', e => {
    if (!planetLevel()) return;
    e.preventDefault();
    const atMax = S.camera.position.z >= 5.99;
    S.zoomBy(Math.exp(e.deltaY * 0.0012));
    // keep scrolling out at the farthest zoom to go up to the star system
    if (atMax && e.deltaY > 0 && ss.space) { wheelOut += e.deltaY; if (wheelOut > 400) { wheelOut = 0; ss.space.up(); } } else wheelOut = 0;
  }, {passive: false});

  // ---------- keyboard ----------
  window.addEventListener('keydown', e => {
    const t = e.target, tag = t && t.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes(t.type)) || (t && t.isContentEditable)) return;
    const key = keyFromEvent(e);
    const level = ss.space ? ss.space.nav.level : 'planet', inLevel = (lv) => !lv || lv.includes(level);
    if (key === 'Escape') { ss.ui && ss.ui.closeMenus(); if (level !== 'planet') ss.space.onKey(key, e); return; }
    for (const m of ss.reg.menus.list()) {
      if (m.accel && m.accel === key && (!m.enabled || m.enabled(ss))) { e.preventDefault(); m.action(ss); ss.ui && ss.ui.refreshMenus(); return; }
    }
    for (const W of ss.reg.windows.list()) {
      if (W.accel && W.accel === key && inLevel(W.levels)) { e.preventDefault(); ss.ui.toggleWindow(W.id); return; }
    }
    if (key.startsWith('Ctrl+') || key.startsWith('Alt+')) return;
    for (const T of ss.reg.tools.list()) if (T.key && T.key === key && inLevel(T.levels || ['planet'])) { e.preventDefault(); ss.setTool(T.id); return; }
    if (level !== 'planet') { ss.space.onKey(key, e); return; }
    if (/^[1-9]$/.test(key)) { const i = +key - 1; if (i < ss.doc.palette.length) ss.selectType(i); return; }
    if (key === '[') ss.setRadius(ed.radius - 1);
    else if (key === ']') ss.setRadius(ed.radius + 1);
    else if (key === 'Space' && tag !== 'BUTTON') { e.preventDefault(); ss.sky.togglePause(); }
    else if (key === ',') ss.sky.jump(-1);
    else if (key === '.') ss.sky.jump(1);
    else if (key === 'M') ss.setLayer(ed.layer === 'mark' ? 'terrain' : 'mark');
    else if ((key === 'Delete' || key === 'Backspace') && ed.poiSel >= 0) { e.preventDefault(); ss.pois.remove(ed.poiSel); }
  });

  registerTools(ss);
  return {get holding() { return st.holding; }, get hover() { return st.hover; }, refreshHover};
}

function paintValue(ss) { const ed = ss.editor; if (ed.layer === 'mark') return ed.tool === 'erase' ? 0 : ed.markerSel + 1; return ed.sel; }

function registerTools(ss) {
  const R = ss.reg.tools, hist = ss.history;
  const brushHover = (c) => ss.view.brushCells(c, ss.editor.radius);
  const paint = ({c}) => hist.setMany(ss.view.brushCells(c, ss.editor.radius), paintValue(ss));

  R.register({id: 'brush', name: 'Кисть', key: 'B', icon: ICONS.brush, drag: true, hint: 'ЛКМ — рисовать, [ ] — размер кисти',
    hover: brushHover, down: (ctx) => { hist.begin(ss.editor.layer); paint(ctx); }, drag: paint, up: () => hist.commit('Кисть')});
  R.register({id: 'fill', name: 'Заливка', key: 'F', icon: ICONS.fill, hint: 'Заливает связную область одного типа',
    down: ({c}) => {
      const ed = ss.editor, doc = ss.doc, A = ed.layer === 'mark' ? doc.markers : doc.cells, v = paintValue(ss), target = A[c], terr = doc.cells[c];
      if (target === v) return;
      const ok = nb => A[nb] === target && (ed.layer !== 'mark' || doc.cells[nb] === terr);
      const list = [c], seen = new Set(list), G = ss.view.G;
      for (let i = 0; i < list.length; i++) for (const nb of G.nbr[list[i]]) if (!seen.has(nb) && ok(nb)) { seen.add(nb); list.push(nb); }
      hist.begin(ed.layer); hist.setMany(list, v); hist.commit('Заливка');
    }});
  R.register({id: 'pick', name: 'Пипетка', key: 'I', icon: ICONS.pick, hint: 'Берёт тип ландшафта (или цвет маркера) с клетки',
    down: ({c}) => {
      const ed = ss.editor, doc = ss.doc;
      if (ed.layer === 'mark') { const m = doc.markers[c]; if (m) { ss.selectMarker(doc.markerColors[m - 1]); ss.ui.toast('Взят цвет маркера'); } else ss.ui.toast('На клетке нет маркера'); }
      else { ss.selectType(doc.cells[c]); ss.ui.toast('Выбрано: ' + doc.palette[doc.cells[c]].name); }
      ss.setTool('brush');
    }});
  R.register({id: 'erase', name: 'Ластик маркеров', key: 'E', icon: ICONS.erase, drag: true, layer: 'mark', hint: 'Стирает маркеры, ландшафт не трогает',
    hover: brushHover, down: (ctx) => { hist.begin('mark'); paint(ctx); }, drag: paint, up: () => hist.commit('Ластик')});
  R.register({id: 'poi', name: 'Метка', key: 'P', icon: ICONS.poi, hint: 'Клик — поставить метку, клик по метке — выбрать',
    down: ({c}) => { const i = ss.pois.at(c); if (i >= 0) ss.pois.select(i); else ss.pois.add(c); ss.ui.openWindow('pois'); }});
  R.register({id: 'rotate', name: 'Вращать', key: 'R', icon: ICONS.rotate, rotate: true, hint: 'Тяни, чтобы крутить; колесо — масштаб'});
}
