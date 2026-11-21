// Floating window manager. Windows come from ss.reg.windows:
//   {id, title, width?, dock?: 'left'|'right', col?, order?, defaultOpen?, render(body, ss) -> {update?(), destroy?()}}
//
// Positioning:
//  * each window is anchored to the nearer side of the work area (left or right), so right-hand windows
//    stay at the right edge when the app window is resized or maximized;
//  * magnet: while dragging, edges snap to the work area and to other windows (below, above, beside,
//    aligned tops/edges). A window snapped below or beside another one is linked to it and follows it
//    when that window moves, collapses or changes height.
import {h} from '../core/util.js';

const LAYOUT_KEY = 'sspace.layout.v2';
const GAP = 8, SNAP = 12;

export function createWM(ss, layer) {
  const wins = new Map();
  let z = 10;
  let layout = {};
  try { layout = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}'); } catch { layout = {}; }
  const saveLayout = () => { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch {} };
  const L = (id) => (layout[id] || (layout[id] = {}));
  const areaW = () => layer.clientWidth || 1200, areaH = () => layer.clientHeight || 800;
  const rectOf = (el) => ({l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, get r() { return this.l + this.w; }, get b() { return this.t + this.h; }});

  // ---------- anchors ----------
  function storeAnchor(id, el) {
    const r = rectOf(el), W = areaW(), s = L(id);
    if (r.l + r.w / 2 > W / 2) { s.ax = 'r'; s.x = Math.round(W - r.r); } else { s.ax = 'l'; s.x = Math.round(r.l); }
    s.y = Math.round(r.t);
  }
  // keep the side the window is already anchored to; only refresh the distances
  function storeKeepSide(id, el) {
    const s = L(id); if (!s.ax) return storeAnchor(id, el);
    const r = rectOf(el);
    s.x = Math.round(s.ax === 'r' ? areaW() - r.r : r.l); s.y = Math.round(r.t);
  }
  function placeFromAnchor(id, el) {
    const s = layout[id]; if (!s || s.x == null) return;
    const W = areaW(), w = el.offsetWidth;
    el.style.left = (s.ax === 'r' ? W - s.x - w : s.x) + 'px';
    el.style.top = s.y + 'px';
  }
  function defaultAnchor(def) {
    const w = def.width || 300, col = def.col || 0, y = def.defaultOpen ? GAP : 40 + (def.order || 0) * 24;
    return {ax: def.dock === 'left' ? 'l' : 'r', x: GAP + col * (w + GAP), y};
  }

  // ---------- links (follow the window we are snapped to) ----------
  function followPos(id) {
    const s = layout[id], link = s && s.link; if (!link) return null;
    const t = wins.get(link.to); if (!t || !t.el.isConnected || t.el.hidden) return null;
    const me = wins.get(id), tr = rectOf(t.el), w = me.el.offsetWidth;
    if (link.side === 'below') return {l: tr.l + link.d, t: tr.b + GAP};
    if (link.side === 'right') return {l: tr.r + GAP, t: tr.t + link.d};
    if (link.side === 'left') return {l: tr.l - GAP - w, t: tr.t + link.d};
    return null;
  }
  function relayoutFollowers(id, seen = new Set()) {
    if (seen.has(id)) return; seen.add(id);
    for (const [fid, rec] of wins) {
      const s = layout[fid];
      if (!rec.el.isConnected || !s || !s.link || s.link.to !== id) continue;
      const p = followPos(fid); if (!p) continue;
      rec.el.style.left = p.l + 'px'; rec.el.style.top = p.t + 'px';
      clampInto(rec.el); storeKeepSide(fid, rec.el);
      relayoutFollowers(fid, seen);
    }
  }
  function linksTo(id, target, seen = new Set()) { // would linking id -> target make a cycle?
    if (id === target) return true; if (seen.has(target)) return false; seen.add(target);
    const s = layout[target]; return !!(s && s.link && linksTo(id, s.link.to, seen));
  }

  // ---------- magnet ----------
  let guideEls = [];
  function clearGuides() { guideEls.forEach(e => e.classList.remove('snap-target')); guideEls = []; }
  function snap(id, el, nx, ny) {
    const w = el.offsetWidth, hgt = el.offsetHeight, W = areaW(), H = areaH();
    let bx = {d: SNAP + 1, v: nx, link: null}, by = {d: SNAP + 1, v: ny, link: null};
    const tryX = (v, link, tgt) => { const d = Math.abs(v - nx); if (d < bx.d) bx = {d, v, link, tgt}; };
    const tryY = (v, link, tgt) => { const d = Math.abs(v - ny); if (d < by.d) by = {d, v, link, tgt}; };
    tryX(GAP); tryX(W - GAP - w); tryY(GAP); tryY(H - GAP - hgt);
    for (const [oid, rec] of wins) {
      if (oid === id || !rec.el.isConnected || rec.el.hidden) continue;
      const o = rectOf(rec.el);
      const vOverlap = ny < o.b + SNAP && ny + hgt > o.t - SNAP;
      const hOverlap = nx < o.r + SNAP && nx + w > o.l - SNAP;
      if (hOverlap) {
        tryY(o.b + GAP, {to: oid, side: 'below'}, rec.el);
        tryY(o.t - GAP - hgt, null, rec.el);
      }
      if (vOverlap) {
        tryX(o.r + GAP, {to: oid, side: 'right'}, rec.el);
        tryX(o.l - GAP - w, {to: oid, side: 'left'}, rec.el);
      }
      tryX(o.l, null, rec.el); tryX(o.r - w, null, rec.el); tryY(o.t, null, rec.el);
    }
    const x = bx.d <= SNAP ? bx.v : nx, y = by.d <= SNAP ? by.v : ny;
    clearGuides();
    for (const b of [bx, by]) if (b.d <= SNAP && b.tgt) { b.tgt.classList.add('snap-target'); guideEls.push(b.tgt); }
    // remember the link (below beats beside); offset along the other axis is kept
    let link = null;
    if (by.d <= SNAP && by.link) { const o = rectOf(wins.get(by.link.to).el); link = {...by.link, d: x - o.l}; }
    else if (bx.d <= SNAP && bx.link) { const o = rectOf(wins.get(bx.link.to).el); link = {...bx.link, d: y - o.t}; }
    if (link && linksTo(id, link.to)) link = null;
    return {x, y, link};
  }

  // ---------- building ----------
  function build(id) {
    const def = ss.reg.windows.get(id); if (!def) return null;
    const s = L(id);
    if (s.x == null) Object.assign(s, defaultAnchor(def));
    const body = h('div', {class: 'win-body'});
    const collapseBtn = h('button', {class: 'win-btn', title: 'Свернуть', onclick: (e) => { e.stopPropagation(); setCollapsed(id, !rec.el.classList.contains('collapsed')); }}, '▾');
    const closeBtn = h('button', {class: 'win-btn', title: 'Закрыть', onclick: (e) => { e.stopPropagation(); close(id); }}, '×');
    const head = h('div', {class: 'win-head'}, h('span', {class: 'win-title'}, def.title), collapseBtn, closeBtn);
    const el = h('section', {class: 'win', 'data-win': id, style: {width: (s.w || def.width || 300) + 'px'}}, head, body);
    if (s.collapsed) el.classList.add('collapsed');
    el.addEventListener('pointerdown', () => { el.style.zIndex = ++z; });
    head.addEventListener('dblclick', () => setCollapsed(id, !el.classList.contains('collapsed')));
    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.win-btn') || e.button !== 0) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop;
      let lastLink = null;
      el.classList.add('dragging');
      let pend = null, raf = 0;
      const move = (ev) => { pend = ev; if (!raf) raf = requestAnimationFrame(apply); };
      const apply = () => {
        raf = 0; const ev = pend; if (!ev) return;
        let nx = Math.max(0, Math.min(areaW() - 60, ox + ev.clientX - sx));
        let ny = Math.max(0, Math.min(areaH() - 30, oy + ev.clientY - sy));
        if (ss.prefs.magnet !== false && !ev.altKey) { const r = snap(id, el, nx, ny); nx = r.x; ny = r.y; lastLink = r.link; } else { clearGuides(); lastLink = null; }
        el.style.left = nx + 'px'; el.style.top = ny + 'px';
        el.style.maxHeight = Math.max(120, areaH() - ny - GAP) + 'px';
        relayoutFollowers(id);
      };
      const up = () => {
        if (raf) { cancelAnimationFrame(raf); apply(); }
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
        el.classList.remove('dragging'); clearGuides();
        const st = L(id); st.link = lastLink || null;
        storeAnchor(id, el); saveLayout();
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    });
    // size changes (collapse, content, width handle) move linked windows along
    let lastW = 0;
    new ResizeObserver(() => {
      if (!el.isConnected || !el.offsetWidth) return;
      if (el.offsetWidth !== lastW) {
        const first = !lastW; lastW = el.offsetWidth; L(id).w = lastW;
        if (!first) { storeKeepSide(id, el); saveLayout(); }
      }
      relayoutFollowers(id);
    }).observe(el);
    const rec = {def, el, body, inst: null};
    try { rec.inst = def.render(body, ss) || null; } catch (e) { console.error('[window ' + id + ']', e); body.appendChild(h('div', {class: 'err'}, 'Ошибка окна: ' + e.message)); }
    return rec;
  }

  // windows can be limited to some levels (def.levels); others are hidden but stay "open"
  let curLevel = null;
  const levelOk = (def) => !def.levels || !curLevel || def.levels.includes(curLevel);
  function applyLevel(level) {
    curLevel = level;
    // windows that are "open" but were never built because their level was not active yet
    if (restored) for (const def of ss.reg.windows.list()) {
      const s = layout[def.id], want = s && s.open != null ? s.open : def.defaultOpen;
      if (want && levelOk(def) && !wins.has(def.id)) open(def.id);
    }
    for (const [id, r] of wins) { r.el.hidden = !levelOk(r.def); if (!r.el.hidden && r.el.isConnected) { const p = followPos(id); if (p) { r.el.style.left = p.l + 'px'; r.el.style.top = p.t + 'px'; } else placeFromAnchor(id, r.el); clampInto(r.el); } }
    for (const [id, r] of wins) if (r.el.isConnected && !r.el.hidden) relayoutFollowers(id);
  }
  function open(id) {
    let rec = wins.get(id);
    const def0 = ss.reg.windows.get(id);
    if (!rec && def0 && !levelOk(def0)) { L(id).open = true; saveLayout(); return; } // build later, on its level
    if (!rec) { rec = build(id); if (!rec) return; wins.set(id, rec); }
    rec.el.hidden = !levelOk(rec.def);
    if (!rec.el.isConnected) layer.appendChild(rec.el);
    rec.el.style.zIndex = ++z;
    const p = followPos(id);
    if (p) { rec.el.style.left = p.l + 'px'; rec.el.style.top = p.t + 'px'; } else placeFromAnchor(id, rec.el);
    clampInto(rec.el);
    L(id).open = true; saveLayout();
    rec.inst && rec.inst.update && rec.inst.update();
    relayoutFollowers(id);
    ss.hooks.emit('window:open', id);
  }
  function close(id) {
    const rec = wins.get(id); if (rec && rec.el.isConnected) rec.el.remove();
    L(id).open = false; saveLayout();
    ss.hooks.emit('window:close', id);
  }
  function setCollapsed(id, v) {
    const rec = wins.get(id); if (!rec) return;
    rec.el.classList.toggle('collapsed', v);
    L(id).collapsed = v; saveLayout();
    relayoutFollowers(id);
  }
  const isOpen = (id) => { const r = wins.get(id); return !!(r && r.el.isConnected && !r.el.hidden); };
  const toggle = (id) => (isOpen(id) ? close(id) : open(id));
  function clampInto(el) {
    const W = areaW(), H = areaH(); if (!W) return;
    el.style.left = Math.max(0, Math.min(W - 80, el.offsetLeft)) + 'px';
    el.style.top = Math.max(0, Math.min(H - 32, el.offsetTop)) + 'px';
    // never run past the bottom of the work area; the body scrolls instead
    el.style.maxHeight = Math.max(120, H - el.offsetTop - GAP) + 'px';
  }
  // Re-place everything after the work area changes size: anchored windows first, then their followers.
  function relayoutAll() {
    for (const [id, r] of wins) { if (!r.el.isConnected) continue; const s = layout[id]; if (!s || !s.link || !followPos(id)) { placeFromAnchor(id, r.el); clampInto(r.el); } }
    for (const [id, r] of wins) if (r.el.isConnected) { const s = layout[id]; if (!s || !s.link) relayoutFollowers(id); }
  }
  function refresh(id) {
    const rec = wins.get(id); if (!rec) return;
    if (rec.inst && rec.inst.destroy) rec.inst.destroy();
    rec.body.innerHTML = '';
    try { rec.inst = rec.def.render(rec.body, ss) || null; } catch (e) { console.error(e); }
  }
  function updateAll() { for (const [, r] of wins) if (r.el.isConnected && r.inst && r.inst.update) { try { r.inst.update(); } catch (e) { console.error(e); } } }
  let restored = false;
  function restore() {
    restored = true;
    const defs = ss.reg.windows.list();
    // open linked windows after the windows they follow
    const order = defs.filter(d => !(layout[d.id] && layout[d.id].link)).concat(defs.filter(d => layout[d.id] && layout[d.id].link));
    for (const def of order) { const s = layout[def.id]; if (s && s.open != null ? s.open : def.defaultOpen) open(def.id); }
  }
  function resetLayout() {
    for (const [, r] of wins) { if (r.inst && r.inst.destroy) r.inst.destroy(); r.el.remove(); }
    wins.clear(); layout = {}; saveLayout(); restore();
  }
  new ResizeObserver(() => relayoutAll()).observe(layer);
  ss.hooks.on('registry:windows', ({id, type}) => { if (type === 'update' && wins.has(id)) { const was = isOpen(id); const r = wins.get(id); r.el.remove(); wins.delete(id); if (was) open(id); } });

  return {open, close, toggle, isOpen, refresh, updateAll, restore, resetLayout, setCollapsed, relayoutAll, applyLevel, levelOk, get windows() { return wins; }};
}
