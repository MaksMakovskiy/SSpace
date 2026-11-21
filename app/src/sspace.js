// The editor object `ss`. Everything — core content, UI and mods — talks to the editor through it.
import {Hooks} from './core/hooks.js';
import {Registry} from './core/registry.js';
import * as util from './core/util.js';
import {host} from './core/host.js';
import {createDoc, serializeDoc, parseDoc, entryFromTerrain, normalizeEntry} from './core/document.js';
import {History} from './core/history.js';
import {loadPacks, registerPack} from './core/packs.js';
import {loadMods} from './core/mods.js';
import {createLog} from './core/log.js';
import {createMetrics} from './core/metrics.js';
import {createSelfTest} from './core/selftest.js';
import {createThemes} from './ui/icons.js';
import {createScene} from './render/scene.js';
import {createPlanetView} from './render/planetView.js';
import {createBuildings} from './render/buildings.js';
import {createPois} from './render/pois.js';
import {createSky} from './render/sky.js';
import {createInput} from './input.js';
import {createUI} from './ui/ui.js';
import {createI18n, defaultLang} from './core/i18n.js';
import {registerPanels} from './ui/panels.js';
import {registerMenus} from './ui/menus.js';
import {registerCoreContent} from './content/core.js';
import {createSpace} from './space/space.js';
import {createSkyObjects} from './render/skyObjects.js';
import {createParticles} from './render/particles.js';
import {registerSpacePanels} from './space/spacePanels.js';
import {CFORMAT, parseCampaign, serializeCampaign, createCampaign, createGalaxy, createSystem, createPlanet, demoCampaign} from './space/campaign.js';

export const VERSION = '0.3.0';
const AUTOSAVE_KEY = 'sspace.autosave.v1';     // old single-planet autosave (migrated once)
const CAMPAIGN_KEY = 'sspace.campaign.v1';
const PREFS_KEY = 'sspace.prefs.v1';
const DEFAULT_PREFS = {grid: true, sameLines: 'half', textures: true, buildings: true, atmosphere: true, anim: true, markers: true, pois: true, markerOpacity: 0.55, magnet: true, fps: true, orbits: true, otherPlanets: true};

export function createSS(THREE) {
  // the log goes first, so it also catches what goes wrong while the rest starts
  const log = createLog();
  const hooks = new Hooks();
  const reg = {};
  for (const k of ['packs', 'terrains', 'effects', 'textures', 'buildings', 'poiKinds', 'generators', 'genLayers', 'tools', 'windows', 'dialogs', 'themes', 'menus', 'routeTypes']) reg[k] = new Registry(k, hooks);

  let prefs = {...DEFAULT_PREFS};
  try { prefs = {...prefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')}; } catch {}

  // interface language (switching it reloads the window); the dictionary is loaded at boot
  const i18n = createI18n(prefs.lang || defaultLang());
  document.documentElement.lang = i18n.lang;
  const ss = {
    VERSION, THREE, hooks, reg, util, host, prefs, log, i18n, t: i18n.t,
    doc: null, mods: [], settings: {},
    editor: {sel: 0, tool: 'brush', radius: 0, layer: 'terrain', markerSel: 0, poiKind: null, poiSel: -1, filePath: null, dirty: false},
    registerPack: (pack, source) => registerPack(ss, pack, source),
    // Wrap any method: ss.patch(obj, 'name', (orig, ...args) => orig(...args)). Returns an undo function.
    patch(obj, name, wrap) {
      const orig = obj[name];
      if (typeof orig !== 'function') throw new Error(`patch: ${name} не функция`);
      const wrapped = function (...a) { return wrap.call(this, orig.bind(this), ...a); };
      obj[name] = wrapped;
      return () => { if (obj[name] === wrapped) obj[name] = orig; };
    },
  };

  ss.metrics = createMetrics(ss);
  ss.history = new History(ss);
  ss.scene = createScene(ss);
  ss.view = createPlanetView(ss);
  ss.buildings = createBuildings(ss);
  ss.pois = createPois(ss);
  ss.sky = createSky(ss);
  ss.ui = createUI(ss);
  ss.input = createInput(ss);
  createSpace(ss); // sets ss.space
  ss.skyObjects = createSkyObjects(ss);
  ss.particles = createParticles(ss);

  // ---------- preferences & settings ----------
  ss.setPref = (k, v) => {
    prefs[k] = v;
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
    ss.view.applyPrefs(); if (k === 'buildings') ss.buildings.markDirty();
    hooks.emit('prefs:changed', {key: k, value: v});
  };
  ss.saveSettings = () => host.setSettings(ss.settings);
  // themes and icons: the theme chosen last time is applied once the mods (which bring themes) are loaded
  ss.themes = createThemes(ss);
  ss.ui.icon = ss.themes.icon;

  // ---------- document lifecycle ----------
  // The whole campaign (with the open planet committed into it) is autosaved.
  // Desktop: a file in the app's data folder; browser: localStorage. A failure is shown once, not swallowed:
  // otherwise the next start would quietly bring back an old version.
  let autosaveFailed = false;
  const autosaveData = () => { ss.space.commitPlanet(); return {text: serializeCampaign(ss.space.campaign), filePath: ss.editor.filePath || ''}; };
  // ss.autosavePaused: the self-test works on a temporary campaign and must not overwrite yours
  // written when the editor is idle (not in the middle of a slider drag), at most 4 s late: packing a big planet takes
  // a moment and would show up as a hitch otherwise
  const whenIdle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, {timeout: 4000}) : setTimeout(fn, 0));
  const autosave = util.debounce(() => whenIdle(autosaveRun), 1200);
  async function autosaveRun() {
    if (!ss.space || !ss.space.campaign || ss.autosavePaused) return;
    let r;
    const stop = ss.metrics.start('autosave');
    let size = 0;
    try { const data = autosaveData(); size = data.text.length; r = await host.writeAutosave(data); } catch (e) { r = {error: e.message}; }
    stop({MB: Math.round(size / 10485.76) / 100}); ss.metrics.gauge('autosave.MB', Math.round(size / 10485.76) / 100);
    if (r && r.error) {
      ss.metrics.count('autosave.fail'); ss.log.error('autosave', 'Автосохранение не удалось', {error: r.error, MB: size / 1048576});
      console.warn('autosave', r.error);
      if (!autosaveFailed) ss.ui.toast('Автосохранение не удалось (' + r.error + '). Сохрани кампанию в файл: Ctrl+S', 8000);
      autosaveFailed = true;
    } else if (autosaveFailed) { autosaveFailed = false; ss.ui.toast('Автосохранение снова работает'); }
  }
  const autosaveNow = () => { try { if (ss.space && ss.space.campaign && !ss.autosavePaused) host.writeAutosaveSync(autosaveData()); } catch (e) { console.warn('autosave', e); } };
  ss.docChanged = (info = {}) => {
    if (!info.silent) { ss.editor.dirty = true; ss.ui.updateTitle(); }
    autosave();
    hooks.emit('doc:changed', info);
  };
  ss.campaignChanged = (info = {}) => {
    if (!info.silent) { ss.editor.dirty = true; ss.ui.updateTitle(); }
    ss.ui.updateStatus();
    autosave();
    hooks.emit('campaign:changed', info);
  };
  ss.undo = () => (ss.space.nav.level === 'planet' ? ss.history.undo() : ss.space.undo());
  ss.redo = () => (ss.space.nav.level === 'planet' ? ss.history.redo() : ss.space.redo());
  ss.loadDoc = (doc, {filePath = null, dirty = false, keepFile = false} = {}) => {
    // link palette entries without src to registry types with the same name (old files)
    for (const p of doc.palette) if (!p.src) { const t = reg.terrains.list().find(x => x.name === p.name); if (t) p.src = t.id; }
    // types saved before their library entry got a surface texture pick it up (a texture chosen by hand is kept)
    for (const p of doc.palette) if (p.src && !p.tex) { const t = reg.terrains.get(p.src); if (t && t.tex) p.tex = t.tex; }
    ss.doc = doc;
    ss.editor.sel = Math.min(ss.editor.sel, doc.palette.length - 1); ss.editor.poiSel = -1; ss.editor.markerSel = 0;
    if (!keepFile) { ss.editor.filePath = filePath; ss.editor.dirty = dirty; }
    ss.history.clear();
    ss.view.install();
    ss.sky.apply();
    ss.pois.rebuild();
    ss.ui.updateTitle(); ss.ui.renderToolbar(); ss.ui.updateStatus();
    hooks.emit('doc:loaded', doc);
    hooks.emit('selection:changed');
    autosave();
  };
  ss.defaultPalette = () => {
    const base = reg.packs.get('base'), ids = base ? base.defaultPalette : [];
    const list = ids.map(id => reg.terrains.get(id)).filter(Boolean).map(entryFromTerrain);
    return list.length ? list : [normalizeEntry({name: 'Океан', color: '#2c6cb0', fx: 'water', h: -1})];
  };
  // Replace the map of the planet that is open now (planet level only).
  ss.newPlanet = ({n = 10, generator = 'continents', seed, params} = {}) => {
    const name = ss.doc ? ss.doc.name : 'Планета';
    const d = createDoc(n, ss.defaultPalette()); d.name = name;
    ss.loadDoc(d, {keepFile: true});
    if (generator) ss.generate(generator, {seed: seed ?? Math.floor(Math.random() * 1e9), params, silent: true});
    ss.history.clear(); ss.space.commitPlanet(); ss.campaignChanged();
  };
  // generation layers (ss.reg.genLayers): {id, name, desc, params, run(ctx)} run after any generator when switched on;
  // ctx is the generator ctx plus `out` (palette index per cell, change it in place), `gen` (the generator def),
  // `palette` and `info(c)` → the cell's palette entry. Pass {layers: {id: {on: true, params}}} to ss.generate.
  // keep: true leaves what is on the orbit and the effect settings alone (by default a new world starts clean)
  ss.generate = (id, {seed = 1, params = {}, silent = false, layers = {}, keep = false} = {}) => {
    const g = reg.generators.get(id); if (!g) return ss.ui.toast('Генератор не найден');
    // make room for the generator's types: unused ones go; if the palette is still crowded, undo history is the price
    ss.compactPalette();
    if (ss.doc.palette.length > 150) ss.compactPalette({ignoreHistory: true});
    const before = ss.doc.palette.length;
    let full = false;
    const type = (tid) => {
      const i = ss.addTerrainToPalette(tid, {select: false, quiet: true});
      if (i === 0 && ss.doc.palette[0] && ss.doc.palette[0].src !== tid && !full) { full = true; console.warn('[generate] палитра переполнена, тип ' + tid + ' не добавлен'); }
      return i;
    };
    const defaults = {}; for (const p of g.params || []) defaults[p.id] = p.value;
    // a generator may describe the atmosphere: declaratively (def.atmosphere) or from run() via ctx.atmosphere({...})
    let atmoPatch = g.atmosphere ? {...g.atmosphere} : null;
    const atmosphere = (p) => { atmoPatch = {...(atmoPatch || {}), ...p}; };
    const lookPatch = {...(g.look || {})};
    const look = (p) => Object.assign(lookPatch, p);
    let out;
    try { out = g.run({ss, G: ss.view.G, V: ss.view.G.V, seed, params: {...defaults, ...params}, type, util, atmosphere, look}); } catch (e) { console.error(e); return ss.ui.toast('Ошибка генератора: ' + e.message); }
    if (!out || out.length !== ss.view.G.V) return ss.ui.toast('Генератор вернул неверный результат');
    const usedLayers = {};
    for (const L of reg.genLayers.list()) {
      const cfg = layers[L.id]; if (!cfg || !cfg.on) continue;
      const lp = {}; for (const p of L.params || []) lp[p.id] = p.value; Object.assign(lp, cfg.params || {});
      usedLayers[L.id] = {on: true, params: lp};
      try { L.run({ss, G: ss.view.G, V: ss.view.G.V, seed: seed + 7777, params: lp, out, gen: g, type, util, atmosphere, look, palette: ss.doc.palette, info: (c) => ss.doc.palette[out[c]]}); }
      catch (e) { console.error(e); ss.ui.toast(`Ошибка дополнения «${L.name}»: ${e.message}`); }
    }
    if (ss.doc.palette.length !== before) { ss.view.refreshTypes(); hooks.emit('palette:changed'); }
    ss.history.begin('terrain');
    for (let c = 0; c < out.length; c++) ss.history.set(c, out[c]);
    ss.history.commit('Генерация');
    if (atmoPatch) ss.setAtmosphere(atmoPatch);
    // a generator may also set a "look" for mods (e.g. {ghost: true}, {ash: true}); every generation replaces it
    ss.doc.meta = ss.doc.meta || {};
    if (keep) { const old = ss.doc.meta.look || {}; for (const [k, v] of Object.entries(old)) if (lookPatch[k] === undefined && k !== 'orbit') lookPatch[k] = v; }
    else ss.doc.meta.fx = {};
    ss.doc.meta.look = lookPatch;
    ss.doc.meta.gen = {id, seed, params: {...defaults, ...params}, layers: usedLayers, keep: !!keep};
    hooks.emit('look:changed', ss.doc.meta.look);
    hooks.emit('fx:changed', {key: null});
    hooks.emit('generate:done', ss.doc.meta.gen);
    if (!silent) ss.ui.toast('Планета сгенерирована');
  };
  ss.resizePlanet = (n) => { if (n === ss.doc.n) return; ss.view.resample(n); ss.history.clear(); ss.pois.rebuild(); ss.docChanged({layer: 'size'}); ss.ui.updateStatus(); hooks.emit('doc:resized', n); };
  ss.fillAll = () => { ss.history.begin('terrain'); for (let c = 0; c < ss.doc.cells.length; c++) ss.history.set(c, ss.editor.sel); ss.history.commit('Заливка всего'); };
  ss.clearMarkers = () => { ss.history.begin('mark'); for (let c = 0; c < ss.doc.markers.length; c++) ss.history.set(c, 0); if (ss.history.commit('Стереть маркеры')) ss.ui.toast('Маркеры стёрты'); };
  ss.setRelief = (k) => { ss.view.setRelief(k); ss.docChanged({layer: 'relief'}); };
  // per-planet atmosphere: {on, color}
  ss.setAtmosphere = (patch) => {
    if (!ss.doc) return;
    ss.doc.atmo = {...(ss.doc.atmo || {on: true, color: '#6badff'}), ...patch};
    ss.view.applyPrefs(); ss.docChanged({layer: 'atmo'}); hooks.emit('atmo:changed', ss.doc.atmo);
  };

  // ---------- palette ----------
  ss.selectType = (i) => { if (i < 0 || i >= ss.doc.palette.length) return; ss.editor.sel = i; if (ss.editor.layer === 'mark') ss.setLayer('terrain'); ss.ui.renderToolbar(); hooks.emit('selection:changed'); };
  ss.addTerrainToPalette = (terrainId, {select = true, quiet = false} = {}) => {
    const t = reg.terrains.get(terrainId); if (!t) return 0;
    let i = ss.doc.palette.findIndex(p => p.src === terrainId);
    if (i < 0) {
      if (ss.doc.palette.length >= 250) { if (!quiet) ss.ui.toast('В палитре максимум 250 типов'); return 0; }
      ss.doc.palette.push(entryFromTerrain(t)); i = ss.doc.palette.length - 1;
      if (!quiet) { ss.view.refreshTypes(); hooks.emit('palette:changed'); ss.docChanged({layer: 'palette'}); ss.ui.toast(`«${t.name}» добавлен в палитру`); }
    }
    if (select) ss.selectType(i);
    return i;
  };
  ss.addCustomType = () => {
    const c = new THREE.Color().setHSL(Math.random(), 0.55, 0.55);
    ss.doc.palette.push(normalizeEntry({name: 'Новый тип', color: '#' + c.getHexString(), tex: 'grass'}));
    ss.view.refreshTypes(); hooks.emit('palette:changed'); ss.docChanged({layer: 'palette'});
    ss.selectType(ss.doc.palette.length - 1); ss.ui.openWindow('props');
    setTimeout(() => { const el = document.getElementById('tpName'); if (el) { el.focus(); el.select(); } }, 30);
  };
  ss.updatePaletteEntry = (i, patch, light = false) => {
    const p = ss.doc.palette[i]; if (!p) return;
    Object.assign(p, normalizeEntry({...p, ...patch}));
    ss.view.refreshTypes(); if (!light || patch.color) ss.buildings.markDirty();
    hooks.emit('palette:changed', {index: i, patch}); ss.ui.renderToolbar();
    ss.docChanged({layer: 'palette'});
  };
  ss.resetPaletteEntry = (i) => {
    const p = ss.doc.palette[i], t = p && p.src && reg.terrains.get(p.src); if (!t) return;
    ss.updatePaletteEntry(i, entryFromTerrain(t)); ss.ui.toast('Тип сброшен к набору');
  };
  ss.syncPaletteFromPacks = () => {
    let n = 0;
    ss.doc.palette.forEach((p, i) => { const t = p.src && reg.terrains.get(p.src); if (t) { Object.assign(p, entryFromTerrain(t)); n++; } });
    ss.view.refreshTypes(); ss.buildings.markDirty(); hooks.emit('palette:changed'); ss.docChanged({layer: 'palette'});
    ss.ui.toast(`Обновлено типов из наборов: ${n}`);
  };
  // Drop library types that no cell uses (and that undo/redo does not need): generators keep adding their types,
  // and cells store a palette index in one byte, so an ever-growing palette would hit its limit.
  // Own types (no `src`) and the current brush always stay. Returns how many were removed.
  ss.compactPalette = ({ignoreHistory = false} = {}) => {
    const d = ss.doc, n = d.palette.length, keep = new Uint8Array(n);
    for (let c = 0; c < d.cells.length; c++) keep[d.cells[c]] = 1;
    const stacks = [ss.history.undoStack, ss.history.redoStack];
    if (!ignoreHistory) for (const st of stacks) for (const e of st) if (e.layer !== 'mark') for (const [, o, nv] of e.ch) { keep[o] = 1; keep[nv] = 1; }
    d.palette.forEach((p, i) => { if (!p.src) keep[i] = 1; });
    if (ss.editor.sel < n) keep[ss.editor.sel] = 1;
    if (keep.every(Boolean)) return 0;
    if (ignoreHistory) ss.history.clear();
    const map = new Int16Array(n), pal = [];
    for (let i = 0; i < n; i++) { map[i] = keep[i] ? pal.length : 0; if (keep[i]) pal.push(d.palette[i]); }
    for (let c = 0; c < d.cells.length; c++) d.cells[c] = map[d.cells[c]];
    for (const st of stacks) for (const e of st) if (e.layer !== 'mark') for (const x of e.ch) { x[1] = map[x[1]]; x[2] = map[x[2]]; }
    const removed = n - pal.length;
    d.palette = pal; ss.editor.sel = map[ss.editor.sel] || 0;
    ss.view.refreshTypes(); hooks.emit('palette:changed'); hooks.emit('selection:changed'); ss.docChanged({layer: 'palette'});
    return removed;
  };
  ss.removePaletteEntry = async (i) => {
    const d = ss.doc; if (d.palette.length <= 1) return ss.ui.toast('Нужен хотя бы один тип');
    const used = d.cells.some(v => v === i);
    const fallback = i === 0 ? 1 : 0;
    if (used && !(await ss.ui.confirm(`Клетки типа «${d.palette[i].name}» станут «${d.palette[fallback].name}». Убрать тип?`, 'Убрать'))) return;
    for (let c = 0; c < d.cells.length; c++) { if (d.cells[c] === i) d.cells[c] = fallback; if (d.cells[c] > i) d.cells[c]--; }
    d.palette.splice(i, 1);
    if (ss.editor.sel >= d.palette.length || ss.editor.sel === i) ss.editor.sel = 0; else if (ss.editor.sel > i) ss.editor.sel--;
    ss.history.clear(); ss.view.refreshTypes(); ss.buildings.markDirty();
    hooks.emit('palette:changed'); hooks.emit('selection:changed'); ss.docChanged({layer: 'palette'}); ss.ui.renderToolbar();
  };

  // ---------- tools, layers, markers ----------
  ss.setTool = (id) => {
    const T = reg.tools.get(id); if (!T) return;
    if (T.layer && ss.editor.layer !== T.layer) ss.setLayer(T.layer, true);
    ss.editor.tool = id;
    ss.scene.canvas.classList.toggle('mode-rotate', !!T.rotate);
    ss.ui.renderToolbar(); ss.ui.updateStatus(); ss.input.refreshHover();
    hooks.emit('tool:changed', id);
  };
  ss.setLayer = (L, keepTool) => {
    ss.editor.layer = L;
    if (!keepTool && L === 'terrain' && ss.editor.tool === 'erase') ss.editor.tool = 'brush';
    if (L === 'mark' && !prefs.markers) ss.setPref('markers', true);
    ss.ui.renderToolbar(); ss.ui.updateStatus(); hooks.emit('layer:changed', L);
  };
  ss.setRadius = (r) => { ss.editor.radius = Math.max(0, Math.min(8, r)); ss.ui.renderToolbar(); ss.input.refreshHover(); };
  ss.selectMarker = (color) => {
    const d = ss.doc; let i = d.markerColors.findIndex(c => c.toLowerCase() === color.toLowerCase());
    if (i < 0) { if (d.markerColors.length >= 250) d.markerColors.shift(); d.markerColors.push(color); i = d.markerColors.length - 1; ss.docChanged({layer: 'mark', silent: true}); }
    ss.editor.markerSel = i;
    if (ss.editor.tool === 'erase') ss.editor.tool = 'brush';
    ss.setLayer('mark'); hooks.emit('selection:changed');
  };

  // ---------- files ----------
  // A campaign file holds the whole universe. A planet file (or an old «Гекс-планета» file) is placed into the
  // current star system, or wrapped into a new campaign when you are not in a system.
  ss.loadCampaign = (c, {filePath = null} = {}) => {
    ss.editor.filePath = filePath; ss.editor.dirty = false;
    ss.space.load(c);
    ss.ui.updateTitle(); autosave();
  };
  function wrapPlanet(doc) {
    const c = createCampaign(doc.name || 'Кампания'), g = createGalaxy({name: 'Галактика'}), s = createSystem({name: 'Система', x: 40, z: 10});
    const p = createPlanet({name: doc.name || 'Планета', orbit: 34, doc: JSON.parse(serializeDoc(doc))});
    s.planets.push(p); g.systems.push(s); c.galaxies.push(g);
    c.meta.nav = {level: 'planet', gid: g.id, sid: s.id, pid: p.id};
    return c;
  }
  ss.openFile = async () => {
    const r = await host.openFile(); if (!r) return;
    let peek = null; try { peek = JSON.parse(r.text); } catch {}
    // a bundle asks its own questions (it may hold only mods); a project or planet replaces what is open
    if (!(peek && peek.format === 'sspace-bundle') && ss.editor.dirty && !(await ss.ui.confirm('Несохранённые изменения пропадут. Открыть другой файл?', 'Открыть'))) return;
    try {
      const data = JSON.parse(r.text);
      if (data.format === 'sspace-bundle') { await ss.share.importBundle(data); return; }
      if (data.format === CFORMAT) { ss.loadCampaign(parseCampaign(data), {filePath: r.path}); ss.ui.toast('Кампания открыта'); return; }
      const doc = parseDoc(data);
      if (ss.space.nav.level === 'system') { ss.space.importPlanet(doc); ss.ui.toast(`Планета «${doc.name}» добавлена в систему`); return; }
      ss.loadCampaign(wrapPlanet(doc)); ss.ui.toast('Планета открыта в новой кампании');
    } catch (e) { ss.ui.toast('Не получилось открыть: ' + e.message, 4000); }
  };
  ss.importPlanetFile = async () => {
    const r = await host.openFile(); if (!r) return;
    try { const doc = parseDoc(r.text); ss.space.importPlanet(doc); ss.ui.toast(`Планета «${doc.name}» добавлена в систему`); } catch (e) { ss.ui.toast('Не получилось открыть: ' + e.message, 4000); }
  };
  ss.saveFile = async (as) => {
    ss.space.commitPlanet();
    const c = ss.space.campaign, name = util.slug(c.name) + '.sspace';
    const p = await host.saveFile({path: as ? null : ss.editor.filePath, text: serializeCampaign(c), defaultName: name});
    if (p === null && host.desktop) return;
    ss.editor.filePath = p || ss.editor.filePath; ss.editor.dirty = false; ss.ui.updateTitle(); ss.ui.toast('Сохранено');
    hooks.emit('campaign:saved', ss.editor.filePath);
  };
  ss.newCampaignDialog = () => {
    const h = util.h, name = h('input', {class: 'field', id: 'ncName', value: 'Новая кампания', maxlength: 80});
    let demo = true;
    const kind = ss.ui.w.segmented({options: [{value: 'demo', label: 'С примером'}, {value: 'empty', label: 'Пустая'}], value: 'demo', onChange: v => { demo = v === 'demo'; }});
    ss.ui.modal({title: 'Новая кампания', body: h('div', {class: 'stack'}, h('div', {class: 'field-row'}, h('label', {class: 'lbl', for: 'ncName'}, 'Название'), name), kind,
      h('div', {class: 'note'}, 'С примером: одна галактика с несколькими системами и маршрутами. Пустая: одна галактика без систем.')), buttons: [
      {label: 'Отмена'},
      {label: 'Создать', primary: true, action: async () => {
        if (ss.editor.dirty && !(await ss.ui.confirm('Несохранённые изменения пропадут. Создать новую кампанию?', 'Создать'))) return false;
        let c;
        if (demo) c = demoCampaign(); else { c = createCampaign(); c.galaxies.push(createGalaxy({name: 'Галактика'})); }
        c.name = name.value || 'Новая кампания';
        ss.loadCampaign(c);
      }},
    ]});
  };
  ss.reloadApp = () => { autosaveNow(); host.reload(); };
  ss.exportPng = async () => {
    if (ss.space.nav.level === 'planet') { ss.view.flush(); ss.scene.renderer.render(ss.scene.scene, ss.scene.camera); }
    else ss.space.view.render(0);
    const url = ss.scene.renderer.domElement.toDataURL('image/png');
    const nm = ss.space.nav.level === 'planet' ? ss.doc.name : ss.space.campaign.name;
    const p = await host.saveBinary({dataUrl: url, defaultName: util.slug(nm) + '.png', filters: [{name: 'PNG', extensions: ['png']}]});
    if (p || !host.desktop) ss.ui.toast('Картинка сохранена');
  };
  ss.exportPalettePack = async () => {
    const id = util.slug(ss.doc.name) || 'my-pack';
    const pack = {format: 'sspace-pack', id, name: 'Палитра: ' + ss.doc.name, version: '1.0.0', terrains: ss.doc.palette.map(p => ({
      id: util.slug(p.name), name: p.name, color: p.color, h: p.h, v: p.v, fx: p.fx, tex: p.tex, bld: p.bld, group: ss.doc.name,
    })), defaultPalette: ss.doc.palette.map(p => util.slug(p.name))};
    const p = await host.saveFile({text: JSON.stringify(pack, null, 2), defaultName: id + '.json', filters: [{name: 'Набор SSpace', extensions: ['json']}], inPacks: true});
    if (p || !host.desktop) ss.ui.toast('Набор сохранён. Он появится в библиотеке после перезапуска');
  };
  ss.newPlanetDialog = () => {
    const h = util.h;
    let n = ss.doc ? ss.doc.n : 10, gen = reg.generators.ids()[0];
    const count = h('div', {class: 'count'});
    const show = () => { const t = util.cellCount(n); count.innerHTML = `<b>${util.fmt(t)}</b> ${util.plural(t, 'клетка', 'клетки', 'клеток')}`; };
    const size = ss.ui.w.slider({id: 'npSize', label: 'Частота сетки', min: 1, max: 100, value: n, onInput: v => { n = v; show(); }});
    const g = ss.ui.w.select({id: 'npGen', label: 'Начать с', options: reg.generators.list().map(x => ({value: x.id, label: x.name})), value: gen, onChange: v => { gen = v; }});
    show();
    ss.ui.modal({title: 'Новая карта планеты', body: h('div', {class: 'stack'}, size, count, g, h('div', {class: 'note'}, 'Текущая карта этой планеты будет заменена.')), buttons: [
      {label: 'Отмена'},
      {label: 'Создать', primary: true, action: async () => {
        if (!(await ss.ui.confirm('Заменить карту этой планеты новой?', 'Заменить'))) return false;
        ss.newPlanet({n, generator: gen});
      }},
    ]});
  };

  // ---------- boot ----------
  // switching the language rebuilds the interface: the project is saved and the window reloads
  ss.setLang = (l) => {
    if (!l || l === i18n.lang) return;
    ss.setPref('lang', l);
    try { if (host.writeAutosaveSync && ss.space && ss.space.campaign) { ss.space.commitPlanet(); host.writeAutosaveSync({text: serializeCampaign(ss.space.campaign), filePath: ss.editor.filePath || ''}); } } catch (e) { console.warn(e); }
    setTimeout(() => (host.reload ? host.reload() : location.reload()), 50);
  };
  ss.boot = async () => {
    const S = window.sspaceSplash || {step() {}, done() {}};
    // let the loading screen repaint; a hidden window gets no animation frames, so a timer settles it too
    const tick = () => new Promise(r => { let d = false; const f = () => { if (!d) { d = true; r(); } }; requestAnimationFrame(f); setTimeout(f, 60); });
    const bootT0 = performance.now(); let stageT = bootT0;
    const stage = (name) => { const now = performance.now(); ss.metrics.record('boot:' + name, now - stageT); stageT = now; };
    ss.metrics.record('boot:engine', bootT0); // page start → editor code running (loading three.js and modules)
    ss.log.info('boot', `SSpace ${VERSION}: старт`, {ua: navigator.userAgent.split(' ').slice(-2).join(' '), desktop: !!host.desktop});
    if (i18n.lang !== 'ru') {
      // the core dictionary and the English help; translation starts at once, so even the loading screen switches
      try { const r = await fetch(new URL(`./i18n/${i18n.lang}.json`, import.meta.url)); if (r.ok) i18n.add(i18n.lang, await r.json()); } catch (e) { console.warn('[i18n]', e); }
      try { const r = await fetch(new URL(`./i18n/help.${i18n.lang}.html`, import.meta.url)); if (r.ok) ss.helpHtml = await r.text(); } catch {}
    }
    // sector names: «А-1» → «A-1» (rings are lettered)
    i18n.addRule('en', (s) => { const m = /^([А-Я])-(\d+)$/.exec(s); return m ? String.fromCharCode(65 + m[1].charCodeAt(0) - 1040) + '-' + m[2] : undefined; });
    // coordinates: «5.9°с 12°в» → «5.9°N 12°E»
    const SIDE = {'с': 'N', 'ю': 'S', 'в': 'E', 'з': 'W'};
    i18n.addRule('en', (s) => (/^[\d.,\s°сюзв-]+$/.test(s) && /°[сюзв]/.test(s) ? s.replace(/°([сюзв])/g, (_, c) => '°' + SIDE[c]) : undefined));
    i18n.start();
    S.step(0.32, 'Ландшафты, эффекты и окна…', `three.js r${THREE.REVISION}`); await tick();
    registerCoreContent(ss);
    registerPanels(ss);
    registerSpacePanels(ss);
    registerMenus(ss);
    try { ss.settings = (await host.getSettings()) || {}; } catch { ss.settings = {}; }
    stage('core');
    S.step(0.4, 'Наборы ландшафтов…'); await tick();
    await loadPacks(ss);
    hooks.emit('core:ready', ss);
    stage('packs');
    const offMod = hooks.on('boot:mod', ({i, n, name}) => S.step(0.45 + 0.35 * i / Math.max(1, n), `Моды: ${i + 1} из ${n}`, name));
    await loadMods(ss);
    offMod();
    stage('mods');
    ss.themes.apply(prefs.theme || 'base');
    S.step(0.82, 'Открываю кампанию…', `модов: ${ss.mods.filter(m => m.status === 'on').length}, типов местности: ${reg.terrains.size}`); await tick();
    ss.ui.renderMenubar();
    // restore: campaign autosave → old single-planet autosave → new example campaign
    let camp = null, path = null;
    try { const a = await host.readAutosave(); if (a && a.text) { camp = parseCampaign(a.text); path = a.filePath || null; } } catch (e) { console.warn('campaign restore failed', e); }
    // older versions autosaved into localStorage only
    if (!camp) try { const raw = localStorage.getItem(CAMPAIGN_KEY); if (raw) { camp = parseCampaign(raw); path = localStorage.getItem(CAMPAIGN_KEY + '.path') || null; } } catch (e) { console.warn('campaign restore failed', e); }
    if (!camp) { try { const old = localStorage.getItem(AUTOSAVE_KEY); if (old) camp = wrapPlanet(parseDoc(old)); } catch (e) { console.warn('planet restore failed', e); } }
    if (!camp) camp = demoCampaign(20261120);
    ss.loadCampaign(camp, {filePath: path});
    stage('campaign');
    S.step(0.9, 'Окна и первый кадр…', 'сборка шейдеров планеты'); await tick();
    ss.ui.wm.restore();
    ss.scene.start();
    ss.ui.updateStatus();
    await tick(); await tick(); // the first frames compile the shaders
    stage('firstframe'); ss.metrics.record('boot:total', performance.now()); // from the page start
    S.done();
    console.info(`[SSpace ${VERSION}] готов: наборов ${reg.packs.size}, типов ${reg.terrains.size}, модов включено ${ss.mods.filter(m => m.status === 'on').length}/${ss.mods.length}, уровень ${ss.space.nav.level}`);
    ss.log.info('boot', `Готов за ${Math.round(performance.now())} мс`, {mods: ss.mods.filter(m => m.status === 'on').length + '/' + ss.mods.length, errors: ss.mods.filter(m => m.status === 'error').map(m => m.id)});
    hooks.emit('app:ready', ss);
    // the desktop app keeps a log file per day (info and above)
    if (host.appendLog) {
      let pending = [];
      ss.log.on(e => { if (e.level !== 'debug') pending.push(ss.log.line(e)); });
      for (const e of ss.log.entries({level: 'info'})) pending.push(ss.log.line(e));
      setInterval(() => { if (pending.length) { const lines = pending; pending = []; host.appendLog(lines.join(String.fromCharCode(10)) + String.fromCharCode(10)).catch(() => {}); } }, 2000);
    }
    // npm run selftest: the main process asks for a test run and waits for the report
    try { const mode = host.selftestMode && await host.selftestMode(); if (mode) { const rep = await ss.test.run(typeof mode === 'object' ? mode : {mode}); await host.selftestDone(rep); } } catch (e) { console.error('[selftest]', e); }
    window.addEventListener('beforeunload', autosaveNow);
  };
  // ---------- timing of the main operations (see «Журнал и метрики») ----------
  const timed = (obj, name, key, logIt) => ss.patch(obj, name, (orig, ...a) => {
    const k = typeof key === 'function' ? key(...a) : key, t = performance.now();
    const r = orig(...a), ms = performance.now() - t;
    ss.metrics.record(k, ms); if (logIt) ss.log.info(logIt, `${k}: ${Math.round(ms)} мс`);
    return r;
  });
  timed(ss, 'generate', (id, o = {}) => 'generate:' + id + (o.layers && Object.keys(o.layers).length ? '+' + Object.keys(o.layers).join('+') : ''), 'generate');
  timed(ss, 'resizePlanet', (n) => 'planet:resize', 'planet');
  timed(ss, 'loadDoc', () => 'planet:load');
  timed(ss, 'compactPalette', () => 'palette:compact');
  timed(ss, 'fillAll', () => 'planet:fill');
  timed(ss.history, 'commit', () => 'history:commit');
  timed(ss.history, 'undo', () => 'history:undo');
  timed(ss.space, 'go', (level) => 'space:go:' + level, 'space');
  ss.test = createSelfTest(ss);
  hooks.on('registry:menus', () => ss.ui.renderMenubar());
  hooks.on('registry:tools', () => ss.ui.renderToolbar());
  return ss;
}
