// Planet document: everything that is saved to a .sspace file.
// Palette entries are local copies of terrain types; `src` points at the registry id they came from
// (e.g. "base:forest"), so packs can be updated later and re-applied.
import {u8ToB64, b64ToU8, cellCount, clamp, isHex} from './util.js';

export const FORMAT = 'sspace-planet';
export const DOC_VERSION = 1;
export const MAX_N = 100; // 10·n²+2 cells → up to 100 002

export function defaultSky() { return {dayMin: 2, theta: 0, paused: false, tilt: 23, night: 20}; }
export function defaultAtmo() { return {on: true, color: '#6badff'}; }
export function sanitizeAtmo(a) { const d = defaultAtmo(); if (!a || typeof a !== 'object') return d; return {on: a.on !== false, color: isHex(a.color) ? a.color : d.color}; }

export function createDoc(n, palette = []) {
  const V = cellCount(n);
  return {
    format: FORMAT, version: DOC_VERSION, name: 'Новая планета', n,
    palette: palette.map(normalizeEntry),
    cells: new Uint8Array(V), markers: new Uint8Array(V),
    markerColors: ['#e6372e'], pois: [], sky: defaultSky(), atmo: defaultAtmo(), relief: 1, meta: {},
  };
}

export function normalizeEntry(p) {
  const num = (x, lo, hi, d) => (typeof x === 'number' && isFinite(x) ? clamp(x, lo, hi) : d);
  return {
    src: typeof p.src === 'string' ? p.src : null,
    name: String(p.name || 'Тип').slice(0, 60),
    color: isHex(p.color) ? p.color : '#888888',
    h: num(p.h, -3, 3, 0), v: num(p.v, 0, 2, 0.1),
    fx: typeof p.fx === 'string' ? p.fx : '', tex: typeof p.tex === 'string' ? p.tex : '', bld: typeof p.bld === 'string' ? p.bld : '',
  };
}

export function entryFromTerrain(t) {
  return normalizeEntry({src: t.id, name: t.name, color: t.color, h: t.h, v: t.v, fx: t.fx, tex: t.tex, bld: t.bld});
}

export function serializeDoc(doc) {
  return JSON.stringify({
    format: FORMAT, version: DOC_VERSION, name: doc.name, n: doc.n,
    palette: doc.palette, cells: u8ToB64(doc.cells), markers: u8ToB64(doc.markers),
    markerColors: doc.markerColors, pois: doc.pois.map(p => ({c: p.c, kind: p.kind, name: p.name, note: p.note})),
    sky: doc.sky, atmo: doc.atmo || defaultAtmo(), relief: doc.relief, meta: doc.meta || {},
  });
}

function sanitizePois(list, V) {
  return (Array.isArray(list) ? list : []).filter(p => p && Number.isInteger(p.c) && p.c >= 0 && p.c < V).slice(0, 1000)
    .map(p => ({c: p.c, kind: String(p.kind || 'base:riddle'), name: String(p.name || '').slice(0, 60), note: String(p.note || '').slice(0, 4000)}));
}
function sanitizeSky(s) {
  const d = defaultSky(); if (!s || typeof s !== 'object') return d;
  const num = (x, lo, hi, def) => (typeof x === 'number' && isFinite(x) ? clamp(x, lo, hi) : def);
  return {dayMin: num(s.dayMin, 0.1, 1440, d.dayMin), theta: num(s.theta, -1e6, 1e6, 0), paused: !!s.paused, tilt: num(s.tilt, 0, 60, d.tilt), night: num(s.night, 0, 80, d.night)};
}

export function parseDoc(text) {
  const d = typeof text === 'string' ? JSON.parse(text) : text;
  if (d && d.format === 'hex-planet') return fromHexPlanet(d);
  if (!d || d.format !== FORMAT) throw new Error('Это не файл планеты SSpace');
  const n = clamp(d.n | 0, 1, MAX_N), V = cellCount(n);
  const palette = (Array.isArray(d.palette) ? d.palette : []).slice(0, 250).map(normalizeEntry);
  if (!palette.length) palette.push(normalizeEntry({name: 'Океан', color: '#2c6cb0'}));
  const cells = b64ToU8(String(d.cells || ''));
  if (cells.length !== V) throw new Error('Размер клеток не совпадает с сеткой');
  for (let i = 0; i < V; i++) if (cells[i] >= palette.length) cells[i] = 0;
  let markers = d.markers ? b64ToU8(String(d.markers)) : new Uint8Array(V);
  if (markers.length !== V) markers = new Uint8Array(V);
  const markerColors = (Array.isArray(d.markerColors) ? d.markerColors.filter(isHex) : []).slice(0, 250);
  if (!markerColors.length) markerColors.push('#e6372e');
  for (let i = 0; i < V; i++) if (markers[i] > markerColors.length) markers[i] = 0;
  return {
    format: FORMAT, version: DOC_VERSION, name: String(d.name || 'Планета').slice(0, 80), n, palette, cells, markers, markerColors,
    pois: sanitizePois(d.pois, V), sky: sanitizeSky(d.sky), atmo: sanitizeAtmo(d.atmo), relief: clamp(+d.relief || 1, 0, 3), meta: d.meta && typeof d.meta === 'object' ? d.meta : {},
  };
}

// Import of the earlier single-file "Гекс-планета" format.
const OLD_FX = ['', 'water', 'glow', 'sparkle', 'glass'];
const OLD_TEX = ['', 'forest', 'grass', 'dunes', 'rock', 'snow', 'city'];
const OLD_BLD = ['', 'houses', 'town', 'towers', 'fortress', 'domes', 'ruins'];
const OLD_POI = ['base:riddle', 'base:quest', 'base:star', 'base:danger', 'base:base', 'base:resource'];
function fromHexPlanet(d) {
  const n = clamp(d.n | 0, 1, MAX_N), V = cellCount(n);
  if (typeof d.cells !== 'string' || d.cells.length !== V) throw new Error('Старый файл повреждён');
  const palette = (d.palette || []).map(p => normalizeEntry({
    src: p.key ? 'base:' + p.key : null, name: p.name, color: p.color, h: p.h, v: p.v,
    fx: OLD_FX[p.fx | 0] || '', tex: OLD_TEX[p.tex | 0] || '', bld: OLD_BLD[p.bld | 0] || '',
  }));
  const cells = new Uint8Array(V), markers = new Uint8Array(V);
  for (let i = 0; i < V; i++) { const v = d.cells.charCodeAt(i) - 48; cells[i] = v >= 0 && v < palette.length ? v : 0; }
  const mc = (d.markerColors || []).filter(isHex);
  if (typeof d.markers === 'string' && d.markers.length === V) for (let i = 0; i < V; i++) { const v = d.markers.charCodeAt(i) - 48; markers[i] = v > 0 && v <= mc.length ? v : 0; }
  const pois = (d.pois || []).map(p => ({c: p.c, kind: OLD_POI[p.k | 0] || OLD_POI[0], name: p.n || '', note: p.t || ''}));
  return {
    format: FORMAT, version: DOC_VERSION, name: 'Импорт из Гекс-планеты', n, palette, cells, markers,
    markerColors: mc.length ? mc : ['#e6372e'], pois: sanitizePois(pois, V), sky: sanitizeSky(d.sky), atmo: defaultAtmo(), relief: clamp(+d.relief || 1, 0, 3), meta: {},
  };
}
