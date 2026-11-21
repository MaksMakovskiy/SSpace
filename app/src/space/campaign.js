// Campaign = the whole universe in one file: galaxies → star systems → planets, plus routes on every level.
// Planet editor documents are stored inside planets (planet.doc, in saved form).
import {mulberry, isHex, clamp} from '../core/util.js';

export const CFORMAT = 'sspace-campaign';
export const CVERSION = 1;
export const GALAXY_R = 100;     // galaxy radius in galaxy units
export const CORE_R = 14;        // radius of the core sector
export const SYSTEM_R = 120;     // max orbit in system units

let counter = 0;
export const uid = (p) => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

const SYL = ['ар', 'ве', 'ки', 'ло', 'ми', 'но', 'ра', 'се', 'та', 'ус', 'фа', 'хе', 'це', 'зо', 'ла', 'эр', 'ин', 'ос', 'да', 'ни', 'кс', 'ор', 'ал', 'те'];
export function randomName(rnd = Math.random, parts = 2) {
  let s = ''; const n = parts + (rnd() < 0.4 ? 1 : 0);
  for (let i = 0; i < n; i++) s += SYL[Math.floor(rnd() * SYL.length)];
  return s[0].toUpperCase() + s.slice(1);
}
export const STAR_COLORS = ['#ffe9b0', '#fff4e0', '#ffd27a', '#ff9e5e', '#ff6b4a', '#bcd4ff', '#8fb4ff', '#ffffff'];

export function createGalaxy(o = {}) {
  return {
    id: uid('g'), name: o.name || 'Галактика', x: o.x || 0, z: o.z || 0,
    seed: o.seed ?? Math.floor(Math.random() * 1e9), arms: o.arms ?? 4, twist: o.twist ?? 2.4,
    coreColor: o.coreColor || '#ffd9a0', armColor: o.armColor || '#8fb4ff',
    rings: o.rings ?? 4, slices: o.slices ?? 8, sectors: {}, systems: [], links: [], note: '',
  };
}
export function createSystem(o = {}) {
  return {id: uid('s'), name: o.name || 'Система', x: o.x || 0, z: o.z || 0, starColor: o.starColor || '#ffe9b0', starSize: o.starSize ?? 1, planets: [], links: [], note: '', mark: ''};
}
export function createPlanet(o = {}) {
  // parent: id of the planet this one orbits (a moon); orbit is then measured around that planet
  return {id: uid('p'), name: o.name || 'Планета', orbit: o.orbit ?? 40, angle: o.angle ?? 0, size: o.size ?? 1, parent: o.parent || null, gen: o.gen || '', doc: o.doc || null, preview: o.preview || null, note: '', mark: ''};
}
export function createLink(a, b, type, o = {}) {
  return {id: uid('l'), a, b, type: type || 'hyperlane', name: o.name || '', note: '', color: ''};
}

export function createCampaign(name = 'Новая кампания') {
  return {format: CFORMAT, version: CVERSION, name, galaxies: [], links: [], meta: {}};
}

// A ready-to-use campaign: one galaxy with a few systems and planets (planet maps are generated on first visit).
export function demoCampaign(seed = Math.floor(Math.random() * 1e9)) {
  const rnd = mulberry(seed), c = createCampaign('Новая кампания');
  const g = createGalaxy({name: randomName(rnd, 2), seed});
  c.galaxies.push(g);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const r = CORE_R + 10 + rnd() * (GALAXY_R - CORE_R - 18), a = rnd() * Math.PI * 2;
    const s = createSystem({name: randomName(rnd, 2), x: Math.cos(a) * r, z: Math.sin(a) * r, starColor: STAR_COLORS[Math.floor(rnd() * STAR_COLORS.length)], starSize: 0.7 + rnd() * 0.8});
    const np = 1 + Math.floor(rnd() * 3);
    for (let j = 0; j < np; j++) s.planets.push(createPlanet({name: s.name + ' ' + ['I', 'II', 'III', 'IV', 'V'][j], orbit: 26 + j * 22 + rnd() * 8, angle: rnd() * Math.PI * 2, size: 0.7 + rnd() * 0.7}));
    g.systems.push(s);
  }
  for (let i = 1; i < g.systems.length; i++) g.links.push(createLink(g.systems[i - 1].id, g.systems[i].id, i % 3 ? 'hyperlane' : 'trade'));
  return c;
}

// ---------- lookup helpers ----------
export function findGalaxy(c, id) { return c.galaxies.find(g => g.id === id) || null; }
export function findSystem(c, gid, sid) { const g = findGalaxy(c, gid); return g ? g.systems.find(s => s.id === sid) || null : null; }
// Position of a planet in its system (x, z). Moons orbit their parent planet (one level of moons).
export function planetPos2D(s, p) {
  if (p.parent) {
    const par = s.planets.find(x => x.id === p.parent);
    if (par && !par.parent) return [Math.cos(par.angle) * par.orbit + Math.cos(p.angle) * p.orbit, Math.sin(par.angle) * par.orbit + Math.sin(p.angle) * p.orbit];
  }
  return [Math.cos(p.angle) * p.orbit, Math.sin(p.angle) * p.orbit];
}
export const moonsOf = (s, pid) => s.planets.filter(x => x.parent === pid);
export function findPlanet(c, gid, sid, pid) { const s = findSystem(c, gid, sid); return s ? s.planets.find(p => p.id === pid) || null : null; }

// Sector key for a point in galaxy units.
export function sectorAt(g, x, z) {
  const r = Math.hypot(x, z);
  if (r < CORE_R) return 'core';
  if (r > GALAXY_R) return null;
  const ring = Math.min(g.rings - 1, Math.floor((r - CORE_R) / ((GALAXY_R - CORE_R) / g.rings)));
  let a = Math.atan2(z, x); if (a < 0) a += Math.PI * 2;
  const slice = Math.floor(a / (Math.PI * 2 / g.slices)) % g.slices;
  return `${ring}:${slice}`;
}
export function sectorName(g, key) {
  if (!key) return 'Межгалактическая пустота';
  const custom = g.sectors[key] && g.sectors[key].name;
  if (custom) return custom;
  if (key === 'core') return 'Ядро';
  const [r, s] = key.split(':').map(Number);
  return `${String.fromCharCode(1040 + r)}-${s + 1}`; // А-1, Б-3 …
}
export function sectorGeom(g, key) {
  if (key === 'core') return {r0: 0, r1: CORE_R, a0: 0, a1: Math.PI * 2};
  const [r, s] = key.split(':').map(Number), band = (GALAXY_R - CORE_R) / g.rings, step = Math.PI * 2 / g.slices;
  return {r0: CORE_R + r * band, r1: CORE_R + (r + 1) * band, a0: s * step, a1: (s + 1) * step};
}

// ---------- save / load ----------
export function serializeCampaign(c) { return JSON.stringify(c); }

export function parseCampaign(text) {
  const d = typeof text === 'string' ? JSON.parse(text) : text;
  if (!d || d.format !== CFORMAT) throw new Error('Это не файл кампании SSpace');
  const num = (x, lo, hi, def) => (typeof x === 'number' && isFinite(x) ? clamp(x, lo, hi) : def);
  const str = (x, def, max = 80) => (typeof x === 'string' ? x.slice(0, max) : def);
  const link = (l) => ({id: str(l.id, uid('l'), 60), a: str(l.a, ''), b: str(l.b, ''), type: str(l.type, 'hyperlane', 60), name: str(l.name, ''), note: str(l.note, '', 4000), color: isHex(l.color) ? l.color : ''});
  const c = createCampaign(str(d.name, 'Кампания'));
  c.meta = d.meta && typeof d.meta === 'object' ? d.meta : {};
  c.links = (d.links || []).map(link);
  for (const g0 of d.galaxies || []) {
    const g = createGalaxy({
      name: str(g0.name, 'Галактика'), x: num(g0.x, -1e5, 1e5, 0), z: num(g0.z, -1e5, 1e5, 0), seed: num(g0.seed, 0, 1e10, 1),
      arms: num(g0.arms, 1, 8, 4), twist: num(g0.twist, 0, 8, 2.4), rings: num(g0.rings, 1, 12, 4), slices: num(g0.slices, 1, 36, 8),
      coreColor: isHex(g0.coreColor) ? g0.coreColor : undefined, armColor: isHex(g0.armColor) ? g0.armColor : undefined,
    });
    g.id = str(g0.id, g.id, 60); g.note = str(g0.note, '', 4000);
    for (const [k, v] of Object.entries(g0.sectors || {})) if (v && typeof v === 'object') g.sectors[k] = {name: str(v.name, ''), color: isHex(v.color) ? v.color : '', note: str(v.note, '', 4000), mark: isHex(v.mark) ? v.mark : ''};
    g.links = (g0.links || []).map(link);
    for (const s0 of g0.systems || []) {
      const s = createSystem({name: str(s0.name, 'Система'), x: num(s0.x, -500, 500, 0), z: num(s0.z, -500, 500, 0), starColor: isHex(s0.starColor) ? s0.starColor : undefined, starSize: num(s0.starSize, 0.2, 4, 1)});
      s.id = str(s0.id, s.id, 60); s.note = str(s0.note, '', 4000); s.mark = isHex(s0.mark) ? s0.mark : ''; s.links = (s0.links || []).map(link);
      for (const p0 of s0.planets || []) {
        const p = createPlanet({name: str(p0.name, 'Планета'), orbit: num(p0.orbit, 4, 400, 40), angle: num(p0.angle, -1e6, 1e6, 0), size: num(p0.size, 0.2, 4, 1),
          doc: p0.doc && typeof p0.doc === 'object' ? p0.doc : null, preview: p0.preview && typeof p0.preview === 'object' ? p0.preview : null});
        p.id = str(p0.id, p.id, 60); p.note = str(p0.note, '', 4000); p.mark = isHex(p0.mark) ? p0.mark : '';
        p.parent = typeof p0.parent === 'string' ? p0.parent.slice(0, 60) : null; p.gen = str(p0.gen, '', 60);
        s.planets.push(p);
      }
      g.systems.push(s);
    }
    c.galaxies.push(g);
  }
  return c;
}
