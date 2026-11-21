// Data packs: JSON files with terrain types and point-of-interest kinds.
// Built-in packs live in app/packs, user packs in <project>/packs. Mods can call ss.registerPack().
import {APP_ROOT, PROJECT_ROOT} from './host.js';
import {isHex} from './util.js';

export const BUILTIN_PACKS = ['packs/base.json'];

export function registerPack(ss, pack, source = 'мод') {
  if (!pack || pack.format !== 'sspace-pack' || typeof pack.id !== 'string') throw new Error('Неверный формат набора (нужно format: "sspace-pack" и id)');
  const id = pack.id;
  const terrains = Array.isArray(pack.terrains) ? pack.terrains : [];
  const kinds = Array.isArray(pack.poiKinds) ? pack.poiKinds : [];
  ss.reg.packs.register({
    id, name: pack.name || id, version: pack.version || '1.0.0', author: pack.author || '', source,
    description: pack.description || '', terrainIds: terrains.map(t => `${id}:${t.id}`), poiIds: kinds.map(k => `${id}:${k.id}`),
    defaultPalette: (pack.defaultPalette || []).map(x => (x.includes(':') ? x : `${id}:${x}`)),
  });
  for (const t of terrains) {
    if (!t || !t.id) continue;
    ss.reg.terrains.register({
      id: `${id}:${t.id}`, pack: id, group: t.group || pack.name || id, name: t.name || t.id,
      color: isHex(t.color) ? t.color : '#888888', h: +t.h || 0, v: t.v == null ? 0.1 : +t.v,
      fx: t.fx || '', tex: t.tex || '', bld: t.bld || '', description: t.description || '',
    });
  }
  for (const k of kinds) {
    if (!k || !k.id) continue;
    ss.reg.poiKinds.register({id: `${id}:${k.id}`, pack: id, sym: String(k.sym || '?').slice(0, 2), name: k.name || k.id, color: isHex(k.color) ? k.color : '#f4c430'});
  }
  ss.hooks.emit('pack:registered', ss.reg.packs.get(id));
  return ss.reg.packs.get(id);
}

async function loadJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function loadPacks(ss) {
  const results = [];
  for (const rel of BUILTIN_PACKS) {
    try { registerPack(ss, await loadJson(new URL(rel, APP_ROOT)), 'встроенный'); results.push({rel, ok: true}); }
    catch (e) { console.error('[pack]', rel, e); results.push({rel, ok: false, error: e.message}); }
  }
  let user = [];
  try { user = await ss.host.listPacks(); } catch (e) { console.warn('[packs] list failed', e); }
  for (const rel of user) {
    try { registerPack(ss, await loadJson(new URL(rel, PROJECT_ROOT)), 'папка packs'); results.push({rel, ok: true}); }
    catch (e) { console.error('[pack]', rel, e); results.push({rel, ok: false, error: e.message}); }
  }
  ss.packLoadResults = results;
  return results;
}
