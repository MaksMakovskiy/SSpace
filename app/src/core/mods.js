// Mod loader. A mod is a folder in <project>/mods with mod.json and an ES module (main.js by default)
// exporting activate(ss, mod). Mods get the whole editor object: registries, hooks, scene, THREE,
// UI, document and ss.patch() for wrapping any core function.
//
// mod.json may also say:
//   "requires": ["orbitals"]  — needs these mods; without them the mod is not started (and says why)
//   "optional": ["orbitals"]  — uses them if they are on: loaded after them, works without them
//   "api": 2                  — the SSpace mod API it was written for; a newer one than this build is refused
//   "order": -10              — tie-break for the load order (lower first); dependencies always come first
import {PROJECT_ROOT} from './host.js';
import {Registry} from './registry.js';

export const API_VERSION = 2;

// order: dependencies first, then "order", then id; a cycle falls back to the plain order
function sortMods(list) {
  const byId = new Map(list.map(m => [m.id, m]));
  const base = [...list].sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.id).localeCompare(String(b.id)));
  const out = [], state = new Map();
  const visit = (m) => {
    const s = state.get(m.id); if (s === 2) return; if (s === 1) return; // cycle: leave as is
    state.set(m.id, 1);
    for (const d of [...(m.requires || []), ...(m.optional || [])]) { const dm = byId.get(d); if (dm) visit(dm); }
    state.set(m.id, 2); out.push(m);
  };
  for (const m of base) visit(m);
  return out;
}

export async function loadMods(ss) {
  let list = [];
  try { list = await ss.host.listMods(); } catch (e) { console.warn('[mods] list failed', e); }
  list = sortMods(list.map(m => ({...m, requires: Array.isArray(m.requires) ? m.requires : [], optional: Array.isArray(m.optional) ? m.optional : []})));
  const settings = ss.settings || {};
  const disabled = new Set(settings.disabledMods || []);
  ss.mods = [];
  ss.apiVersion = API_VERSION;
  ss.hasMod = (id) => ss.mods.some(r => r.id === id && r.status === 'on');
  const nameOf = (id) => { const m = list.find(x => x.id === id); return m ? (m.name || id) : id; };
  let i = 0;
  for (const m of list) {
    ss.hooks.emit('boot:mod', {i: i++, n: list.length, name: m.name || m.id});
    const rec = {
      id: m.id, name: m.name || m.id, version: m.version || '', author: m.author || '', license: m.license || '', description: m.description || '',
      folder: m.folder, main: m.main || 'main.js', enabled: !disabled.has(m.id), status: 'off', error: m.error || null,
      requires: m.requires, optional: m.optional,
    };
    ss.mods.push(rec);
    if (rec.error || !rec.enabled) { rec.status = rec.error ? 'error' : 'off'; continue; }
    if (m.api && +m.api > API_VERSION) { rec.status = 'error'; rec.error = `Мод написан для более новой версии SSpace (API ${m.api}, здесь ${API_VERSION}). Обнови SSpace.`; continue; }
    // hard dependencies must be present and already running (they load first)
    const missing = rec.requires.filter(d => !ss.hasMod(d));
    if (missing.length) {
      rec.status = 'error';
      rec.error = missing.map(d => list.some(x => x.id === d) ? (disabled.has(d) ? `Нужен мод «${nameOf(d)}»: включи его.` : `Нужен мод «${nameOf(d)}», но он не запустился.`) : `Нужен мод «${d}»: его нет в папке mods.`).join(' ');
      if (ss.log) ss.log.warn('mod', `Мод «${rec.name}» не запущен: ${rec.error}`); else console.warn(`[mod ${rec.id}] ${rec.error}`);
      continue;
    }
    // the mod's own translation (mods/<folder>/i18n/<lang>.json); without one the mod stays in its own language
    if (ss.i18n && ss.i18n.lang !== 'ru' || (ss.i18n && m.lang && m.lang !== ss.i18n.lang)) {
      try { const r = await fetch(new URL(`mods/${encodeURIComponent(rec.folder)}/i18n/${ss.i18n.lang}.json`, PROJECT_ROOT)); if (r.ok) { rec.i18n = ss.i18n.add(ss.i18n.lang, await r.json()); } } catch {}
    }
    try {
      const url = new URL(`mods/${encodeURIComponent(rec.folder)}/${rec.main}`, PROJECT_ROOT).href;
      const mod = await import(url);
      const activate = mod.activate || mod.default;
      if (typeof activate !== 'function') throw new Error('Мод не экспортирует activate(ss)');
      const ctx = {id: rec.id, folder: rec.folder, baseUrl: new URL(`mods/${encodeURIComponent(rec.folder)}/`, PROJECT_ROOT).href, manifest: m,
        has: (id) => ss.hasMod(id)};
      Registry.source = 'мод ' + rec.id;
      const t0 = performance.now();
      try { await activate(ss, ctx); } finally { Registry.source = null; }
      rec.ms = Math.round(performance.now() - t0);
      if (ss.metrics) ss.metrics.record('mod:' + rec.id, rec.ms);
      rec.status = 'on';
      rec.exports = mod;
    } catch (e) {
      rec.status = 'error';
      rec.error = String((e && e.message) || e);
      console.error(`[mod ${rec.id}]`, e);
      if (ss.log) ss.log.error('mod', `Мод «${rec.name}» не запустился`, e);
    }
  }
  ss.hooks.emit('mods:loaded', ss.mods);
  return ss.mods;
}

export async function setModEnabled(ss, id, enabled) {
  const s = ss.settings || (ss.settings = {});
  const set = new Set(s.disabledMods || []);
  if (enabled) set.delete(id); else set.add(id);
  s.disabledMods = [...set];
  await ss.saveSettings();
  const rec = ss.mods.find(m => m.id === id);
  if (rec) rec.enabled = enabled;
}
