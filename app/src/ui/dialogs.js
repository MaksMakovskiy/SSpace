// Big dialogs over the editor (like the world generator): a header, sections on the left, the content on the right.
// For things used now and then that need room — mods, settings, help, the log. Mods add their own the same way:
//   ss.reg.dialogs.register({id, title, icon, sections: [{id, label, icon, render(pane, api) → optional cleanup}]})
//   ss.ui.openDialog(id, sectionId?) · ss.ui.closeDialog() · api = {setSection(id), close(), refresh()}
// A dialog with a single `render(pane, api)` instead of sections has no left column.
// side: true — a big panel along the right edge that does not cover the 3D view (you keep seeing and turning the
// planet while you tune it); its left edge can be dragged to make it wider or narrower.
import {h} from '../core/util.js';

export function createDialogs(ss) {
  let el = null, cur = null, section = null, cleanup = null, curApi = null;
  const remembered = new Map(); // dialog id → last section

  function open(id, sectionId) {
    const def = ss.reg.dialogs.get(id); if (!def) return ss.ui.toast('Нет такого окна: ' + id);
    // already open: just switch the section (through the open dialog's own api)
    if (el && cur === id) { if (sectionId && curApi) curApi.setSection(sectionId); return; }
    close();
    cur = id;
    const secs = (def.sections || []).filter(s => !s.enabled || s.enabled(ss));
    section = sectionId || remembered.get(id) || (secs[0] && secs[0].id) || null;
    const nav = h('nav', {class: 'bigd-nav'});
    const pane = h('div', {class: 'bigd-pane'});
    const head = h('header', {class: 'bigd-head'},
      h('div', {class: 'bigd-title'}, def.icon ? ss.themes.icon(def.icon, 'bigd-ico') : null, h('b', null, def.title), def.subtitle ? h('small', null, typeof def.subtitle === 'function' ? def.subtitle(ss) : def.subtitle) : null),
      h('button', {class: 'bigd-close', title: 'Закрыть (Esc)', onclick: close}, ss.themes.icon('close')));
    const side = !!def.side, sideW = side ? ((ss.prefs.sideWidths || {})[id] || def.width || 900) : 0;
    const box = h('div', {class: 'bigd' + (secs.length ? '' : ' single') + (side ? ' side' : ''), style: side ? {width: sideW + 'px'} : def.width ? {maxWidth: def.width + 'px'} : null, role: 'dialog', 'aria-label': def.title},
      head, h('div', {class: 'bigd-body'}, secs.length ? nav : null, pane));
    el = h('div', {class: 'bigd-back' + (side ? ' side' : '')}, box);
    if (side) {
      const grip = h('div', {class: 'bigd-grip', title: 'Потяни, чтобы сделать шире или уже'}); box.appendChild(grip);
      grip.addEventListener('pointerdown', (e) => {
        e.preventDefault(); grip.setPointerCapture(e.pointerId);
        const x0 = e.clientX, w0 = box.offsetWidth; let raf = 0, w = w0;
        const mv = (ev) => { w = Math.max(520, Math.min(window.innerWidth - 120, w0 + x0 - ev.clientX)); if (!raf) raf = requestAnimationFrame(() => { raf = 0; box.style.width = w + 'px'; }); };
        const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); ss.setPref('sideWidths', {...(ss.prefs.sideWidths || {}), [id]: Math.round(w)}); };
        grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up);
      });
    }
    el.addEventListener('pointerdown', (e) => { if (e.target === el && !side) close(); });
    document.body.appendChild(el);
    document.addEventListener('keydown', onKey, true);
    const api = {setSection, close, refresh: () => render(), get pane() { return pane; }};
    function render() {
      if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
      nav.innerHTML = '';
      for (const s of secs) nav.appendChild(h('button', {class: 'bigd-tab' + (s.id === section ? ' on' : ''), onclick: () => setSection(s.id)},
        s.icon ? ss.themes.icon(s.icon, 'bigd-tab-ico') : null, h('span', null, typeof s.label === 'function' ? s.label(ss) : s.label)));
      pane.innerHTML = ''; pane.scrollTop = 0;
      const s = secs.find(x => x.id === section);
      try { const r = s ? s.render(pane, api) : def.render ? def.render(pane, api) : null; cleanup = typeof r === 'function' ? r : (r && r.destroy) || null; }
      catch (e) { console.error('[dialog ' + id + ']', e); pane.appendChild(h('pre', {class: 'err'}, 'Ошибка: ' + e.message)); }
    }
    function setSection(sid) { section = sid; remembered.set(id, sid); render(); }
    api.setSection = setSection; curApi = api;
    render();
    ss.hooks.emit('dialog:opened', {id});
  }
  function close() {
    if (!el) return;
    if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
    el.remove(); el = null; curApi = null;
    const was = cur; cur = null;
    document.removeEventListener('keydown', onKey, true);
    ss.hooks.emit('dialog:closed', {id: was});
  }
  // Esc closes the dialog, but not while a confirmation or menu sits on top of it
  function onKey(e) { if (e.key === 'Escape' && !document.querySelector('.modal-back') && !document.querySelector('.ctx')) { e.stopPropagation(); close(); } }
  const toggle = (id, sid) => (cur === id ? close() : open(id, sid));
  // a dialog that disappears from the registry closes
  ss.hooks.on('registry:dialogs', ({id, type}) => { if (type === 'remove' && cur === id) close(); });
  return {open, close, toggle, isOpen: (id) => (id ? cur === id : !!cur), get current() { return cur; }};
}
