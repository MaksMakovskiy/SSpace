// Space controller: campaign, navigation between levels, selection, editing, undo, mouse/keyboard on space levels.
// Levels: 'universe' → 'galaxy' → 'system' → 'planet' (the planet editor).
import {createSpaceView} from './spaceView.js';
import {
  GALAXY_R, CORE_R, createGalaxy, createSystem, createPlanet, createLink, randomName, STAR_COLORS,
  findGalaxy, findSystem, findPlanet, sectorAt, sectorName, planetPos2D, moonsOf,
} from './campaign.js';
import {createDoc, serializeDoc, parseDoc} from '../core/document.js';

export const SPACE_LEVELS = ['universe', 'galaxy', 'system'];
const LEVEL_NAMES = {universe: 'Вселенная', galaxy: 'Галактика', system: 'Система', planet: 'Планета'};

export function createSpace(ss) {
  const S = ss.scene;
  const sp = {
    campaign: null, nav: {level: 'galaxy', gid: null, sid: null, pid: null}, sel: null, linkFrom: null, routeType: 'hyperlane',
    undoStack: [], redoStack: [], LEVEL_NAMES,
  };
  ss.space = sp;
  const view = createSpaceView(ss);
  sp.view = view;
  const C = () => sp.campaign;
  const cur = () => {
    const n = sp.nav, g = findGalaxy(C(), n.gid), s = g ? g.systems.find(x => x.id === n.sid) || null : null, p = s ? s.planets.find(x => x.id === n.pid) || null : null;
    return {g, s, p};
  };
  sp.current = cur;

  // ---------- undo (planet maps are kept by reference, not copied) ----------
  function snapshot() {
    const docs = new Map();
    for (const g of C().galaxies) for (const s of g.systems) for (const p of s.planets) { docs.set(p.id, p.doc); p.doc = null; }
    const json = JSON.stringify(C());
    for (const g of C().galaxies) for (const s of g.systems) for (const p of s.planets) p.doc = docs.get(p.id);
    return json;
  }
  function restore(json) {
    const docs = new Map();
    for (const g of C().galaxies) for (const s of g.systems) for (const p of s.planets) docs.set(p.id, p.doc);
    const c = JSON.parse(json);
    for (const g of c.galaxies) for (const s of g.systems) for (const p of s.planets) p.doc = docs.has(p.id) ? docs.get(p.id) : p.doc;
    sp.campaign = c;
    if (!validNav(sp.nav)) sp.nav = {level: 'universe', gid: null, sid: null, pid: null};
    sp.sel = null; view.setSelection(null); changedUI();
  }
  sp.mutate = (fn, label) => {
    const before = snapshot();
    const r = fn();
    if (r === false) return false;
    sp.undoStack.push({json: before, label}); if (sp.undoStack.length > 100) sp.undoStack.shift(); sp.redoStack = [];
    sp.changed();
    return r;
  };
  sp.undo = () => { const e = sp.undoStack.pop(); if (!e) return false; sp.redoStack.push({json: snapshot(), label: e.label}); restore(e.json); ss.campaignChanged(); return true; };
  sp.redo = () => { const e = sp.redoStack.pop(); if (!e) return false; sp.undoStack.push({json: snapshot(), label: e.label}); restore(e.json); ss.campaignChanged(); return true; };
  sp.changed = () => { view.rebuild(); ss.campaignChanged(); changedUI(); };
  function changedUI() { ss.hooks.emit('space:changed'); updateCrumbs(); }

  // ---------- navigation ----------
  function validNav(n) {
    const c = C(); if (!c) return false;
    if (n.level === 'universe') return true;
    const g = findGalaxy(c, n.gid); if (!g) return false;
    if (n.level === 'galaxy') return true;
    const s = findSystem(c, n.gid, n.sid); if (!s) return false;
    if (n.level === 'system') return true;
    return !!findPlanet(c, n.gid, n.sid, n.pid);
  }
  sp.commitPlanet = () => {
    if (sp.nav.level !== 'planet' || !ss.doc) return;
    const {p} = cur(); if (!p) return;
    p.doc = JSON.parse(serializeDoc(ss.doc)); p.name = ss.doc.name || p.name;
    view.invalidatePlanet(p.id);
  };
  sp.go = (level, ids = {}, {select = null, keepCamera = false} = {}) => {
    const prev = sp.nav;
    if (prev.level === 'planet') sp.commitPlanet();
    const n = {level, gid: ids.gid ?? prev.gid, sid: ids.sid ?? prev.sid, pid: ids.pid ?? prev.pid};
    if (level === 'universe') { /* keep ids for "back into" */ }
    if (!validNav(n)) return false;
    sp.nav = n; sp.linkFrom = null; view.setPreview(null);
    C().meta.nav = {...n};
    ss.hooks.emit('level:beforeChange', n);
    if (level === 'planet') {
      const {p} = cur();
      let doc;
      if (p.doc) { try { doc = parseDoc(p.doc); } catch (e) { ss.ui.toast('Карта планеты повреждена, создаю новую'); } }
      const fresh = !doc;
      if (fresh) doc = createDoc(10, ss.defaultPalette());
      doc.name = p.name;
      S.override = null;
      ss.loadDoc(doc, {keepFile: true});
      if (fresh) {
        // first visit: moons default to the moon generator when a mod provides it
        let h = 7; for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        const gen = (p.gen && ss.reg.generators.has(p.gen)) ? p.gen : (p.parent && ss.reg.generators.has('moon') ? 'moon' : 'continents');
        ss.generate(gen, {seed: h, silent: true}); ss.history.clear(); sp.commitPlanet();
      }
      S.resetView();
    } else {
      S.override = (dt) => view.render(dt);
      sp.sel = select; view.setSelection(select);
      if (!keepCamera) {
        view.frameAll();
        // coming up a level: center on the place we came from
        if (prev.level === 'galaxy' && level === 'universe') { const g = findGalaxy(C(), prev.gid); if (g) view.focus(g.x, g.z, 700); }
        if (prev.level === 'system' && level === 'galaxy') { const s = findSystem(C(), prev.gid, prev.sid); if (s) view.focus(s.x, s.z, 140); }
      }
    }
    document.body.dataset.level = level;
    ss.ui.wm.applyLevel(level);
    const T = ss.reg.tools.get(ss.editor.tool), lv = (T && T.levels) || ['planet'];
    if (!lv.includes(level)) ss.editor.tool = level === 'planet' ? 'brush' : 'sp-select';
    ss.ui.renderToolbar(); ss.ui.updateStatus(); ss.ui.updateTitle();
    fade();
    changedUI();
    ss.hooks.emit('level:changed', n);
    ss.campaignChanged({silent: true});
    return true;
  };
  sp.up = () => {
    const l = sp.nav.level;
    if (l === 'planet') return sp.go('system', {}, {select: {kind: 'planet', id: sp.nav.pid}});
    if (l === 'system') return sp.go('galaxy', {}, {select: {kind: 'system', id: sp.nav.sid}});
    if (l === 'galaxy') return sp.go('universe', {}, {select: {kind: 'galaxy', id: sp.nav.gid}});
    return false;
  };
  sp.enter = (kind, id) => {
    if (kind === 'galaxy') return sp.go('galaxy', {gid: id});
    if (kind === 'system') return sp.go('system', {sid: id});
    if (kind === 'planet') return sp.go('planet', {pid: id});
    if (kind === 'sector') return false;
    return false;
  };
  function fade() { const el = document.getElementById('levelFade'); if (!el) return; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }

  sp.load = (c) => {
    sp.campaign = c; sp.undoStack = []; sp.redoStack = [];
    if (!c.galaxies.length) c.galaxies.push(createGalaxy({name: randomName()}));
    const want = c.meta && c.meta.nav;
    const n = want && validNav(want) ? want : {level: 'galaxy', gid: c.galaxies[0].id, sid: null, pid: null};
    sp.nav = {level: 'universe', gid: n.gid, sid: n.sid, pid: n.pid};
    sp.go(n.level, n);
    ss.hooks.emit('campaign:loaded', c);
  };

  // ---------- selection & editing ----------
  sp.select = (sel) => { sp.sel = sel; view.setSelection(sel); ss.hooks.emit('space:selected', sel); };
  sp.objectOf = (sel) => {
    if (!sel) return null; const c = C(), {g, s} = cur();
    if (sel.kind === 'galaxy') return findGalaxy(c, sel.id);
    // anywhere in the campaign, not only in the open galaxy / system (search and marks work from any level)
    if (sel.kind === 'system') return (g && g.systems.find(x => x.id === sel.id)) || sp.findAny('system', sel.id);
    if (sel.kind === 'planet') return (s && s.planets.find(x => x.id === sel.id)) || sp.findAny('planet', sel.id);
    if (sel.kind === 'sector') return g ? (g.sectors[sel.key] || (g.sectors[sel.key] = {name: '', color: '', note: '', mark: ''})) : null;
    if (sel.kind === 'link') return linksHere().find(l => l.id === sel.id) || null;
    return null;
  };
  function linksHere() { const l = sp.nav.level, {g, s} = cur(); return l === 'universe' ? C().links : l === 'galaxy' ? (g ? g.links : []) : l === 'system' ? (s ? s.links : []) : []; }
  sp.linksHere = linksHere;
  sp.update = (sel, patch, label = 'Изменение') => sp.mutate(() => { const o = sp.objectOf(sel); if (!o) return false; Object.assign(o, patch); if (sel.kind === 'planet' && patch.name && o.doc) o.doc.name = patch.name; }, label);

  sp.addAt = (x, z) => {
    const l = sp.nav.level, {g, s} = cur();
    return sp.mutate(() => {
      if (l === 'universe') {
        const ng = createGalaxy({name: randomName(), x, z, arms: 2 + Math.floor(Math.random() * 4), twist: 1.6 + Math.random() * 2, armColor: ['#8fb4ff', '#ffb38f', '#c39bff', '#9fffd8'][Math.floor(Math.random() * 4)]});
        C().galaxies.push(ng); sp.sel = {kind: 'galaxy', id: ng.id};
      } else if (l === 'galaxy') {
        const r = Math.hypot(x, z); if (r > GALAXY_R + 5) { ss.ui.toast('Система должна быть внутри галактики'); return false; }
        const ns = createSystem({name: randomName(), x, z, starColor: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)], starSize: 0.7 + Math.random() * 0.8});
        g.systems.push(ns); sp.sel = {kind: 'system', id: ns.id};
      } else if (l === 'system') {
        const orbit = Math.max(12, Math.hypot(x, z));
        const np = createPlanet({name: `${s.name} ${s.planets.length + 1}`, orbit, angle: Math.atan2(z, x), size: 0.7 + Math.random() * 0.6});
        s.planets.push(np); sp.sel = {kind: 'planet', id: np.id};
      }
    }, 'Добавить') !== false ? (view.setSelection(sp.sel), ss.hooks.emit('space:selected', sp.sel), true) : false;
  };
  sp.addRandom = () => {
    const l = sp.nav.level;
    if (l === 'universe') { const a = Math.random() * Math.PI * 2, r = 250 + Math.random() * 350 * Math.sqrt(C().galaxies.length); return sp.addAt(Math.cos(a) * r, Math.sin(a) * r); }
    if (l === 'galaxy') { const a = Math.random() * Math.PI * 2, r = CORE_R + 6 + Math.random() * (GALAXY_R - CORE_R - 10); return sp.addAt(Math.cos(a) * r, Math.sin(a) * r); }
    if (l === 'system') { const {s} = cur(), far = s.planets.length ? Math.max(...s.planets.map(p => p.orbit)) : 10, a = Math.random() * Math.PI * 2; return sp.addAt(Math.cos(a) * (far + 20), Math.sin(a) * (far + 20)); }
    return false;
  };
  sp.remove = async (sel = sp.sel) => {
    if (!sel) return;
    const any = ['galaxy', 'system', 'planet'].includes(sel.kind);
    const o = any ? sp.findAny(sel.kind, sel.id) : sp.objectOf(sel); if (!o) return;
    if (any && sp.nav.level === 'planet' && (sel.id === sp.nav.pid || sel.id === sp.nav.sid || sel.id === sp.nav.gid)) return ss.ui.toast('Нельзя удалить то, что сейчас открыто. Выйди на уровень выше');
    if (any && ((sel.kind === 'system' && sel.id === sp.nav.sid && sp.nav.level === 'system') || (sel.kind === 'galaxy' && sel.id === sp.nav.gid && sp.nav.level !== 'universe'))) return ss.ui.toast('Нельзя удалить то, что сейчас открыто. Выйди на уровень выше');
    const deep = (sel.kind === 'galaxy' && o.systems.length) || (sel.kind === 'system' && o.planets.length) || (sel.kind === 'planet' && o.doc);
    if (sel.kind === 'sector') return sp.update(sel, {name: '', color: '', note: '', mark: ''}, 'Сбросить сектор');
    if (deep && !(await ss.ui.confirm(`Удалить «${o.name || 'объект'}» вместе со всем содержимым? Это можно отменить (Ctrl+Z).`, 'Удалить'))) return;
    sp.mutate(() => {
      const w = any ? where(sel.kind, sel.id) : null, g = w ? w.g : cur().g, s = w ? w.s : cur().s, c = C();
      const dropLinks = (list, id) => list.filter(l => l.a !== id && l.b !== id);
      if (sel.kind === 'galaxy') { c.galaxies = c.galaxies.filter(x => x.id !== sel.id); c.links = dropLinks(c.links, sel.id); }
      else if (sel.kind === 'system') { g.systems = g.systems.filter(x => x.id !== sel.id); g.links = dropLinks(g.links, sel.id); }
      else if (sel.kind === 'planet') {
        // moons of a removed planet stay in the system on their own orbits
        const gone = s.planets.find(x => x.id === sel.id);
        for (const m of moonsOf(s, sel.id)) { const [x, z] = planetPos2D(s, m); m.parent = null; m.orbit = Math.max(8, Math.hypot(x, z)); m.angle = Math.atan2(z, x); }
        s.planets = s.planets.filter(x => x !== gone); s.links = dropLinks(s.links, sel.id);
      }
      else if (sel.kind === 'link') { const arr = linksHere(), i = arr.findIndex(l => l.id === sel.id); if (i >= 0) arr.splice(i, 1); }
      sp.sel = null;
    }, 'Удалить');
    view.setSelection(null); ss.hooks.emit('space:selected', null);
  };
  sp.link = (a, b) => {
    if (a === b) return false;
    const arr = linksHere();
    if (arr.some(l => (l.a === a && l.b === b) || (l.a === b && l.b === a))) { ss.ui.toast('Эти объекты уже соединены'); return false; }
    let created = null;
    sp.mutate(() => { created = createLink(a, b, sp.routeType); arr.push(created); }, 'Маршрут');
    if (created) sp.select({kind: 'link', id: created.id});
    return true;
  };
  // ---------- anywhere in the campaign (not only the open level) ----------
  function where(kind, id) {
    for (const g of C().galaxies) {
      if (kind === 'galaxy' && g.id === id) return {g};
      for (const s of g.systems) {
        if (kind === 'system' && s.id === id) return {g, s};
        for (const p of s.planets) if (kind === 'planet' && p.id === id) return {g, s, p};
      }
    }
    return null;
  }
  sp.where = where;
  sp.findAny = (kind, id) => { const w = where(kind, id); return w ? (w.p || w.s || w.g) : null; };
  sp.renameAny = (kind, id, name) => sp.mutate(() => { const o = sp.findAny(kind, id); if (!o || !name) return false; o.name = name; if (kind === 'planet' && o.doc) o.doc.name = name; }, 'Переименовать');
  const dropLinksOf = (list, id) => list.filter(l => l.a !== id && l.b !== id);

  // Moons: a planet can orbit another planet (one level deep).
  sp.addMoon = (pid) => {
    const w = where('planet', pid); if (!w || w.p.parent) return false;
    const {s, p: par} = w, n = moonsOf(s, pid).length;
    let made = null;
    sp.mutate(() => {
      made = createPlanet({name: `${par.name} — луна ${n + 1}`, parent: pid, orbit: 6 + n * 3.5, angle: Math.random() * Math.PI * 2, size: 0.45, gen: ss.reg.generators.has('moon') ? 'moon' : ''});
      s.planets.push(made);
    }, 'Спутник');
    if (made && sp.nav.level === 'system' && sp.nav.sid === s.id) sp.select({kind: 'planet', id: made.id});
    return true;
  };
  // Attach a planet to another planet as its moon (moving it into that system if needed), or free it (parentId = null).
  sp.setParent = (pid, parentId) => {
    const w = where('planet', pid); if (!w) return false;
    const p = w.p;
    if (parentId) {
      const t = where('planet', parentId);
      if (!t || t.p.id === pid || t.p.parent) { ss.ui.toast('Луну можно повесить только на планету, которая сама не луна'); return false; }
      if (moonsOf(w.s, pid).length) { ss.ui.toast('У этой планеты свои луны: сначала освободи их'); return false; }
      if (p.parent === parentId) return false;
      return sp.mutate(() => {
        if (w.s !== t.s) { w.s.planets = w.s.planets.filter(x => x !== p); w.s.links = dropLinksOf(w.s.links, pid); t.s.planets.push(p); fixNav('planet', pid, t); }
        p.parent = parentId; p.orbit = 6 + moonsOf(t.s, parentId).filter(x => x !== p).length * 3.5; p.size = Math.min(p.size, t.p.size * 0.6);
      }, 'Сделать спутником');
    }
    if (!p.parent) return false;
    const [x, z] = planetPos2D(w.s, p);
    return sp.mutate(() => { p.parent = null; p.orbit = Math.max(8, Math.hypot(x, z)); p.angle = Math.atan2(z, x); }, 'Освободить спутник');
  };
  // keep navigation pointing at a moved object
  function fixNav(kind, id, to) {
    const n = sp.nav;
    if (kind === 'planet' && n.pid === id) { n.gid = to.g.id; n.sid = to.s.id; }
    if (kind === 'system' && n.sid === id) n.gid = to.g.id;
    C().meta.nav = {...n};
  }
  // Move a planet (with its moons) into another star system.
  sp.movePlanet = (pid, sid) => {
    const w = where('planet', pid), t = where('system', sid); if (!w || !t || w.s === t.s) return false;
    return sp.mutate(() => {
      const p = w.p, group = [p, ...moonsOf(w.s, pid)];
      if (p.parent) { const [x, z] = planetPos2D(w.s, p); p.parent = null; p.orbit = Math.max(8, Math.hypot(x, z)); p.angle = Math.atan2(z, x); }
      const far = t.s.planets.filter(x => !x.parent).reduce((m, x) => Math.max(m, x.orbit), 10);
      p.orbit = Math.max(p.orbit, far + 18);
      w.s.planets = w.s.planets.filter(x => !group.includes(x));
      for (const x of group) { w.s.links = dropLinksOf(w.s.links, x.id); t.s.planets.push(x); }
      fixNav('planet', pid, t); for (const m of group.slice(1)) fixNav('planet', m.id, t);
    }, 'Перенести планету');
  };
  // Move a star system (with everything in it) into another galaxy.
  sp.moveSystem = (sid, gid) => {
    const w = where('system', sid), t = where('galaxy', gid); if (!w || !t || w.g === t.g) return false;
    return sp.mutate(() => {
      w.g.systems = w.g.systems.filter(x => x !== w.s); w.g.links = dropLinksOf(w.g.links, sid);
      const r = Math.hypot(w.s.x, w.s.z); if (r > GALAXY_R) { w.s.x *= GALAXY_R / r; w.s.z *= GALAXY_R / r; }
      t.g.systems.push(w.s); fixNav('system', sid, t);
    }, 'Перенести систему');
  };
  // ---------- right-click menus ----------
  // marks: a coloured flag on a planet, system or sector, to find things again (search shows them, the map flags them)
  const MARK_COLORS = ['#ff4d4d', '#ffb020', '#f4e04d', '#3fbf6f', '#4cc9f0', '#8e5cf7', '#e0457b', '#ffffff'];
  sp.MARK_COLORS = MARK_COLORS;
  sp.setMark = (sel, color) => sp.update(sel, {mark: color || ''}, color ? 'Отметка' : 'Снять отметку');
  const markItem = (sel, cur) => ({label: cur ? 'Отметка' : 'Отметить…', swatch: cur || null,
    sub: [{palette: {colors: MARK_COLORS, value: cur || '', none: 'Снять отметку', pick: c => sp.setMark(sel, c)}}]});
  const SECTOR_COLORS = ['#ff5a3c', '#f4c430', '#7fe3b0', '#4cc9f0', '#8e5cf7', '#e0457b', '#c8d4ff', '#ff9e5e', '#3fbf6f', '#2f6fdf', '#c39bff', '#8a8f9c'];
  // star palette: spectral classes first, then exotic colours
  const STAR_PALETTE = sp.STAR_PALETTE = [
    {color: '#9bb0ff', name: 'Голубой гигант (O)'}, {color: '#aabfff', name: 'Бело-голубая (B)'}, {color: '#cad7ff', name: 'Белая (A)'},
    {color: '#f8f7ff', name: 'Жёлто-белая (F)'}, {color: '#fff4e0', name: 'Жёлтая, как Солнце (G)'}, {color: '#ffe9b0', name: 'Тёплая жёлтая'},
    {color: '#ffd27a', name: 'Оранжевая (K)'}, {color: '#ff9e5e', name: 'Красно-оранжевая'}, {color: '#ff6b4a', name: 'Красный карлик (M)'},
    {color: '#d8402a', name: 'Красный гигант'}, {color: '#bcd4ff', name: 'Холодная голубая'}, {color: '#8fb4ff', name: 'Синяя'},
    {color: '#ffffff', name: 'Белый карлик'}, {color: '#c39bff', name: 'Фиолетовая (экзотика)'}, {color: '#ff7ad9', name: 'Розовая (экзотика)'},
    {color: '#7fe3b0', name: 'Зелёная (экзотика)'}, {color: '#4cf0e0', name: 'Бирюзовая (экзотика)'}, {color: '#5a3d8a', name: 'Тусклая аномалия'},
  ];
  const ARM_COLORS = ['#8fb4ff', '#ffb38f', '#c39bff', '#9fffd8', '#ff7ad9', '#ffe08a', '#7fe3b0', '#4cc9f0', '#ff6b4a', '#ffffff', '#c8d4ff', '#8e5cf7'];
  async function rename(kind, id) {
    const o = sp.findAny(kind, id) || sp.objectOf({kind, id}); if (!o) return;
    const v = await ss.ui.prompt('Переименовать', o.name || ''); if (v) sp.renameAny(kind, id, v);
  }
  // open a level and select something there
  function show(kind, id) {
    const w = where(kind, id); if (!w) return;
    const level = kind === 'galaxy' ? 'universe' : kind === 'system' ? 'galaxy' : 'system';
    sp.go(level, {gid: w.g.id, sid: w.s && w.s.id}, {select: {kind, id}});
  }
  sp.show = show;
  function startLink(kind, id) {
    const levelOf = {galaxy: 'universe', system: 'galaxy', planet: 'system'}[kind];
    if (sp.nav.level !== levelOf || !sp.view.posOf(kind, id)) show(kind, id);
    ss.setTool('sp-link'); sp.linkFrom = {kind, id}; sp.select({kind, id});
    ss.ui.toast('Кликни второй объект, чтобы проложить маршрут (Esc — отмена)');
  }
  sp.contextItems = (hit, gp) => {
    const L = sp.nav.level, items = [];
    if (!hit) {
      if (gp && L !== 'planet') items.push({label: {universe: 'Добавить галактику здесь', galaxy: 'Добавить систему здесь', system: 'Добавить планету здесь'}[L], action: () => sp.addAt(gp.x, gp.z)});
      if (ss.quickGen && (L === 'galaxy' || L === 'system')) items.push({label: L === 'galaxy' ? 'Заполнить звёздами…' : 'Заполнить планетами…', accel: 'Ctrl+Shift+G', action: () => ss.quickGen.open(L === 'galaxy' ? 'stars' : 'planets')});
      if (L !== 'universe') items.push({label: 'Уровень выше', accel: 'Ctrl+↑', action: () => sp.up()});
      if (L !== 'planet') items.push({label: 'Показать всё', accel: 'Home', action: () => view.frameAll()});
      return items;
    }
    const {kind, id} = hit;
    if (kind === 'galaxy') {
      const g = sp.findAny('galaxy', id); if (!g) return items;
      items.push({title: 'Галактика «' + g.name + '»'},
        {label: 'Войти', action: () => sp.go('galaxy', {gid: id})},
        {label: 'Переименовать…', action: () => rename('galaxy', id)},
        {label: '+ Звёздная система', action: () => { sp.go('galaxy', {gid: id}); sp.addRandom(); }},
        ss.quickGen ? {label: 'Заполнить звёздами…', action: () => { sp.go('galaxy', {gid: id}); ss.quickGen.open('stars'); }} : null,
        {label: 'Цвет рукавов', swatch: g.armColor, sub: [{palette: {colors: ARM_COLORS, value: g.armColor, pick: c => sp.update({kind: 'galaxy', id}, {armColor: c}, 'Цвет рукавов')}}]},
        {label: 'Цвет ядра', swatch: g.coreColor, sub: [{palette: {colors: STAR_PALETTE, value: g.coreColor, pick: c => sp.update({kind: 'galaxy', id}, {coreColor: c}, 'Цвет ядра')}}]},
        {label: 'Проложить маршрут отсюда', action: () => startLink('galaxy', id)},
        {label: 'Свойства', action: () => { show('galaxy', id); ss.ui.openWindow('object'); }},
        {sep: true}, {label: 'Удалить', danger: true, action: () => sp.remove({kind: 'galaxy', id})});
    } else if (kind === 'system') {
      const w = where('system', id); if (!w) return items;
      items.push({title: 'Система «' + w.s.name + '»'},
        {label: 'Войти', action: () => sp.go('system', {gid: w.g.id, sid: id})},
        {label: 'Переименовать…', action: () => rename('system', id)},
        {label: '+ Планета', action: () => { sp.go('system', {gid: w.g.id, sid: id}); sp.addRandom(); }},
        ss.quickGen ? {label: 'Заполнить планетами…', action: () => { if (sp.nav.level !== 'system' || sp.nav.sid !== id) sp.select({kind: 'system', id}); ss.quickGen.open('planets'); }} : null,
        markItem({kind: 'system', id}, w.s.mark),
        {label: 'Цвет звезды', swatch: w.s.starColor, sub: [{palette: {colors: STAR_PALETTE, value: w.s.starColor, pick: c => sp.update({kind: 'system', id}, {starColor: c}, 'Цвет звезды')}}]},
        {label: 'Проложить маршрут отсюда', action: () => startLink('system', id)},
        {label: 'Перенести в галактику', sub: C().galaxies.filter(g => g !== w.g).map(g => ({label: g.name, action: () => sp.moveSystem(id, g.id)}))},
        {sep: true}, {label: 'Удалить', danger: true, action: () => sp.remove({kind: 'system', id})});
    } else if (kind === 'planet') {
      const w = where('planet', id); if (!w) return items;
      const p = w.p, s = w.s, hosts = s.planets.filter(x => x !== p && !x.parent), hasMoons = moonsOf(s, id).length > 0;
      items.push({title: (p.parent ? 'Луна «' : 'Планета «') + p.name + '»'},
        {label: 'Открыть карту', action: () => sp.go('planet', {gid: w.g.id, sid: s.id, pid: id})},
        markItem({kind: 'planet', id}, p.mark),
        {label: 'Переименовать…', action: () => rename('planet', id)},
        p.parent ? null : {label: '+ Луна', action: () => sp.addMoon(id)},
        p.parent
          ? {label: 'Освободить (сделать планетой)', action: () => sp.setParent(id, null)}
          : {label: 'Сделать луной планеты', disabled: hasMoons, sub: hosts.map(x => ({label: x.name, action: () => sp.setParent(id, x.id)}))},
        {label: 'Перенести в систему', sub: C().galaxies.flatMap(g => g.systems.filter(x => x !== s).map(x => ({label: (C().galaxies.length > 1 ? g.name + ' › ' : '') + x.name, action: () => sp.movePlanet(id, x.id)})))},
        {label: 'Проложить маршрут отсюда', action: () => startLink('planet', id)},
        {sep: true}, {label: 'Удалить', danger: true, action: () => sp.remove({kind: 'planet', id})});
    } else if (kind === 'sector') {
      const sel = {kind: 'sector', key: hit.key}, {g} = cur();
      items.push({title: 'Сектор ' + sectorName(g, hit.key)},
        {label: 'Название…', action: async () => { const v = await ss.ui.prompt('Название сектора', (g.sectors[hit.key] || {}).name || ''); if (v !== null) sp.update(sel, {name: v}, 'Имя сектора'); }},
        markItem(sel, (g.sectors[hit.key] || {}).mark),
        {label: 'Цвет заливки', swatch: (g.sectors[hit.key] || {}).color || null, sub: [{palette: {colors: SECTOR_COLORS, value: (g.sectors[hit.key] || {}).color || '', none: 'Без цвета', pick: c => sp.update(sel, {color: c}, 'Цвет сектора')}}]},
        {sep: true}, {label: 'Сбросить сектор', danger: true, action: () => sp.remove(sel)});
    } else if (kind === 'link') {
      const sel = {kind: 'link', id}, l = sp.objectOf(sel); if (!l) return items;
      items.push({title: 'Маршрут'},
        {label: 'Тип', sub: ss.reg.routeTypes.list().map(t => ({label: t.name, checked: l.type === t.id, action: () => sp.update(sel, {type: t.id}, 'Тип маршрута')}))},
        {label: 'Подпись…', action: async () => { const v = await ss.ui.prompt('Подпись маршрута', l.name || '', 'Подпись'); if (v !== null) sp.update(sel, {name: v}, 'Подпись'); }},
        {sep: true}, {label: 'Удалить маршрут', danger: true, action: () => sp.remove(sel)});
    }
    return items.filter(Boolean);
  };
  sp.openContext = (x, y, hit, gp) => ss.ui.contextMenu(x, y, sp.contextItems(hit, gp));

  // Put an object before another of the same kind in the same list (only order changes).
  sp.reorder = (kind, id, beforeId) => {
    if (id === beforeId) return false;
    const a = where(kind, id), b = where(kind, beforeId); if (!a || !b) return false;
    const list = kind === 'galaxy' ? C().galaxies : kind === 'system' ? (a.g === b.g ? a.g.systems : null) : (a.s === b.s ? a.s.planets : null);
    if (!list) return false;
    return sp.mutate(() => { const o = list.splice(list.indexOf(sp.findAny(kind, id)), 1)[0]; list.splice(list.indexOf(sp.findAny(kind, beforeId)), 0, o); }, 'Порядок');
  };
  sp.importPlanet = (doc) => {
    const {s} = cur(); if (sp.nav.level !== 'system' || !s) return false;
    const far = s.planets.length ? Math.max(...s.planets.map(p => p.orbit)) : 10;
    sp.mutate(() => { const p = createPlanet({name: doc.name || 'Планета', orbit: far + 20, angle: Math.random() * Math.PI * 2, doc: JSON.parse(serializeDoc(doc))}); s.planets.push(p); sp.sel = {kind: 'planet', id: p.id}; }, 'Импорт планеты');
    view.setSelection(sp.sel); return true;
  };
  sp.describe = (sel) => {
    const o = sp.objectOf(sel); if (!o) return '';
    const {g} = cur();
    if (sel.kind === 'galaxy') return `Галактика «${o.name}» · систем: ${o.systems.length}`;
    if (sel.kind === 'system') return `Система «${o.name}» · планет: ${o.planets.length} · сектор ${sectorName(g, sectorAt(g, o.x, o.z))}`;
    if (sel.kind === 'planet') {
      const {s} = cur(), par = o.parent && s && s.planets.find(x => x.id === o.parent), moons = s ? moonsOf(s, o.id).length : 0;
      return `${par ? `Спутник планеты «${par.name}»` : `Планета «${o.name}»`} · орбита ${o.orbit.toFixed(0)}${moons ? ` · лун: ${moons}` : ''}${o.doc ? '' : ' · карта ещё не создана'}`;
    }
    if (sel.kind === 'link') { const t = ss.reg.routeTypes.get(o.type); return `${t ? t.name : o.type}${o.name ? ' «' + o.name + '»' : ''}`; }
    return '';
  };
  sp.nameOf = (kind, id) => { const o = sp.objectOf({kind, id}); return o ? o.name : '?'; };

  // ---------- breadcrumbs ----------
  function updateCrumbs() {
    const el = document.getElementById('crumbs'); if (!el || !C()) return;
    const n = sp.nav, {g, s, p} = cur();
    const parts = [{label: C().name || 'Вселенная', level: 'universe'}];
    if (g && n.level !== 'universe') parts.push({label: g.name, level: 'galaxy'});
    if (s && (n.level === 'system' || n.level === 'planet')) parts.push({label: s.name, level: 'system'});
    if (p && n.level === 'planet') parts.push({label: p.name, level: 'planet'});
    el.innerHTML = '';
    parts.forEach((x, i) => {
      if (i) el.appendChild(Object.assign(document.createElement('span'), {className: 'crumb-sep', textContent: '›'}));
      const b = document.createElement('button'); b.className = 'crumb' + (x.level === n.level ? ' on' : ''); b.textContent = x.label; b.title = LEVEL_NAMES[x.level];
      b.onclick = () => { if (x.level !== n.level) sp.go(x.level); };
      el.appendChild(b);
    });
    const lvl = document.createElement('span'); lvl.className = 'crumb-level'; lvl.textContent = LEVEL_NAMES[n.level]; el.appendChild(lvl);
  }
  sp.updateCrumbs = updateCrumbs;

  // ---------- mouse ----------
  const canvas = S.canvas, cs = view.cam;
  const st = {mode: null, sx: 0, sy: 0, lx: 0, ly: 0, moved: false, hit: null, before: null, lastBuild: 0, wheelAcc: 0};
  const active = () => !!sp.campaign && sp.nav.level !== 'planet';
  canvas.addEventListener('pointerdown', (e) => {
    if (!active()) return;
    canvas.setPointerCapture(e.pointerId);
    st.sx = st.lx = e.clientX; st.sy = st.ly = e.clientY; st.moved = false; st.before = null;
    if (e.button === 2 || e.button === 1) { st.mode = e.button === 2 ? 'orbit-r' : 'orbit'; canvas.classList.add('rotating'); return; }
    const tool = ss.editor.tool, hit = view.pick(e.clientX, e.clientY); st.hit = hit;
    if (tool === 'sp-select' && hit && ['galaxy', 'system', 'planet'].includes(hit.kind)) { st.mode = 'drag'; sp.select(hit); return; }
    st.mode = 'pan';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!active()) return;
    const dx = e.clientX - st.lx, dy = e.clientY - st.ly;
    if (st.mode && Math.hypot(e.clientX - st.sx, e.clientY - st.sy) > 4) st.moved = true;
    if (st.mode === 'orbit' || (st.mode === 'orbit-r' && st.moved)) { cs.yaw -= dx * 0.005; cs.tilt = Math.max(0.02, Math.min(1.3, cs.tilt - dy * 0.004)); }
    else if (st.mode === 'pan' && st.moved) {
      const a = view.groundPoint(st.lx, st.ly), b = view.groundPoint(e.clientX, e.clientY);
      if (a && b) { cs.tx -= b.x - a.x; cs.tz -= b.z - a.z; }
    } else if (st.mode === 'drag' && st.moved) {
      const gp = view.groundPoint(e.clientX, e.clientY);
      if (gp) {
        if (!st.before) st.before = snapshot();
        const o = sp.objectOf(st.hit);
        if (st.hit.kind === 'planet') {
          const {s} = cur(), par = o.parent && s.planets.find(x => x.id === o.parent);
          if (par) { const [px, pz] = planetPos2D(s, par); o.orbit = Math.max(3, Math.min(60, Math.hypot(gp.x - px, gp.z - pz))); o.angle = Math.atan2(gp.z - pz, gp.x - px); }
          else { o.orbit = Math.max(8, Math.hypot(gp.x, gp.z)); o.angle = Math.atan2(gp.z, gp.x); }
        }
        else if (st.hit.kind === 'system') { const r = Math.hypot(gp.x, gp.z), k = r > GALAXY_R ? GALAXY_R / r : 1; o.x = gp.x * k; o.z = gp.z * k; }
        else { o.x = gp.x; o.z = gp.z; }
        const now = performance.now(); if (now - st.lastBuild > 40) { st.lastBuild = now; view.rebuild(); }
      }
    }
    st.lx = e.clientX; st.ly = e.clientY;
    if (!st.mode || st.mode === 'pan') { st.hx = e.clientX; st.hy = e.clientY; if (!st.hoverRaf) st.hoverRaf = requestAnimationFrame(() => { st.hoverRaf = 0; if (active()) hover(st.hx, st.hy); }); }
  });
  function endPointer(e) {
    if (!active() || !st.mode) return;
    const mode = st.mode; st.mode = null; canvas.classList.remove('rotating');
    // right click without dragging: context menu for what is under the cursor (sector in a galaxy, or empty space)
    if (mode === 'orbit-r' && !st.moved) {
      let hit = view.pick(e.clientX, e.clientY);
      const gp = view.groundPoint(e.clientX, e.clientY);
      if (!hit && sp.nav.level === 'galaxy') { const {g} = cur(), key = g && gp ? sectorAt(g, gp.x, gp.z) : null; if (key) hit = {kind: 'sector', key}; }
      if (hit) sp.select(hit);
      sp.openContext(e.clientX, e.clientY, hit, gp);
      return;
    }
    if (mode === 'drag' && st.before) { sp.undoStack.push({json: st.before, label: 'Перемещение'}); sp.redoStack = []; sp.changed(); return; }
    if (st.moved) return;
    click(e.clientX, e.clientY, st.hit);
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('dblclick', (e) => {
    if (!active()) return;
    const hit = view.pick(e.clientX, e.clientY);
    if (hit && ['galaxy', 'system', 'planet'].includes(hit.kind)) sp.enter(hit.kind, hit.id);
  });
  canvas.addEventListener('wheel', (e) => {
    if (!active()) return;
    e.preventDefault();
    const f = Math.exp(e.deltaY * 0.0012), old = cs.dist, nd = Math.max(cs.min, Math.min(cs.max, old * f));
    // zoom toward the cursor
    const gp = view.groundPoint(e.clientX, e.clientY);
    if (gp && nd !== old) { const k = nd / old; cs.tx = gp.x + (cs.tx - gp.x) * k; cs.tz = gp.z + (cs.tz - gp.z) * k; }
    cs.dist = nd;
    // keep scrolling past the limits to change level
    if ((old >= cs.max - 1e-6 && e.deltaY > 0) || (old <= cs.min + 1e-6 && e.deltaY < 0)) st.wheelAcc += e.deltaY; else st.wheelAcc = 0;
    if (st.wheelAcc > 400) { st.wheelAcc = 0; sp.up(); }
    if (st.wheelAcc < -400) {
      st.wheelAcc = 0;
      const rect = canvas.getBoundingClientRect(), hit = view.pick(e.clientX, e.clientY) || view.pick(rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (hit && ['galaxy', 'system', 'planet'].includes(hit.kind)) sp.enter(hit.kind, hit.id);
    }
  }, {passive: false});
  canvas.addEventListener('pointerleave', () => { if (active()) { view.setHoverSector(null); ss.ui.setInfo(''); } });

  function hover(x, y) {
    const hit = view.pick(x, y);
    let text = hit ? sp.describe(hit) : '';
    if (sp.nav.level === 'galaxy') {
      const {g} = cur(), gp = view.groundPoint(x, y), key = g && gp ? sectorAt(g, gp.x, gp.z) : null;
      view.setHoverSector(hit ? null : key);
      if (!hit && g) text = `Сектор ${sectorName(g, key)}`;
    }
    if (sp.linkFrom) {
      const a = view.posOf(sp.linkFrom.kind, sp.linkFrom.id), b = view.groundPoint(x, y);
      if (a && b) view.setPreview(a.setY(0.4), b.setY(0.4));
      text = `Маршрут от «${sp.nameOf(sp.linkFrom.kind, sp.linkFrom.id)}»: кликни второй объект (Esc — отмена)`;
    }
    ss.ui.setInfo(ss.hooks.filter('spaceInfo', text, hit));
  }
  function click(x, y, hit) {
    const tool = ss.editor.tool;
    if (tool === 'sp-add') { const gp = view.groundPoint(x, y); if (gp) sp.addAt(gp.x, gp.z); return; }
    if (tool === 'sp-link') {
      const ok = hit && ['galaxy', 'system', 'planet'].includes(hit.kind);
      if (!ok) { sp.linkFrom = null; view.setPreview(null); return; }
      if (!sp.linkFrom) { sp.linkFrom = hit; sp.select(hit); return; }
      sp.link(sp.linkFrom.id, hit.id); sp.linkFrom = null; view.setPreview(null); return;
    }
    // select tool
    if (hit) { sp.select(hit); return; }
    if (sp.nav.level === 'galaxy') {
      const {g} = cur(), gp = view.groundPoint(x, y), key = g && gp ? sectorAt(g, gp.x, gp.z) : null;
      sp.select(key ? {kind: 'sector', key} : null);
    } else sp.select(null);
  }

  sp.onKey = (key, e) => {
    if (key === 'Escape') { if (sp.linkFrom) { sp.linkFrom = null; view.setPreview(null); } else sp.select(null); return true; }
    if ((key === 'Delete' || key === 'Backspace') && sp.sel) { e.preventDefault(); sp.remove(); return true; }
    if (key === 'Enter' && sp.sel && ['galaxy', 'system', 'planet'].includes(sp.sel.kind)) { sp.enter(sp.sel.kind, sp.sel.id); return true; }
    return false;
  };

  // ---------- tools ----------
  const ICON = (d) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  ss.reg.tools.register({id: 'sp-select', name: 'Выбор и перенос', key: 'V', levels: SPACE_LEVELS, icon: ICON('<path d="M5 3l14 8-6 2-3 6Z"/>'),
    hint: 'Клик — выбрать, тянуть объект — переместить, тянуть пустоту — сдвинуть вид, двойной клик — войти внутрь'});
  ss.reg.tools.register({id: 'sp-add', name: 'Добавить', key: 'A', levels: SPACE_LEVELS, icon: ICON('<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>'),
    hint: 'Клик по пустому месту — новая галактика, система или планета (по уровню)'});
  ss.reg.tools.register({id: 'sp-link', name: 'Маршрут', key: 'L', levels: SPACE_LEVELS, icon: ICON('<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8 16L16 8"/>'),
    hint: 'Клик по первому объекту, затем по второму — соединить маршрутом выбранного типа'});

  return sp;
}
