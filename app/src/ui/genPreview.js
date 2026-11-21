// Little planet pictures for the generator gallery: runs a generator (and generation layers) on a small
// geodesic grid without touching the open planet, then draws a lit globe with its atmosphere on a 2D canvas.
import {buildGeodesic} from '../core/geometry.js';
import * as util from '../core/util.js';

export function createPreviewer(ss) {
  let G = null;
  const grid = () => G || (G = buildGeodesic(ss.THREE, 14));
  const cache = new Map();

  // run → {rgb: Float32Array(V*3), water: Uint8Array, atmo: {on, color} | null}
  function compute(gen, {seed = 1, params = {}, layers = {}} = {}) {
    const key = gen.id + '|' + seed + '|' + JSON.stringify(params) + '|' + JSON.stringify(layers);
    if (cache.has(key)) return cache.get(key);
    const tStart = performance.now();
    const g = grid(), list = [], index = new Map();
    const type = (id) => {
      if (index.has(id)) return index.get(id);
      const t = ss.reg.terrains.get(id) || {id, name: id, color: '#7a7f88', h: 0};
      index.set(id, list.length); list.push({src: t.id, name: t.name, color: t.color, h: t.h || 0, fx: t.fx || '', bld: t.bld || ''});
      return list.length - 1;
    };
    const defaults = {}; for (const p of gen.params || []) defaults[p.id] = p.value;
    let atmo = gen.atmosphere ? {...gen.atmosphere} : {on: true, color: '#6badff'};
    const ctx = {ss, G: g, V: g.V, seed, params: {...defaults, ...params}, type, util, atmosphere: (p) => { atmo = {...atmo, ...p}; }, look() {}, preview: true};
    let out;
    try { out = gen.run(ctx); } catch (e) { console.warn('[preview ' + gen.id + ']', e); out = null; }
    if (!out || out.length !== g.V) { const r = {rgb: null, atmo}; cache.set(key, r); return r; }
    for (const L of ss.reg.genLayers.list()) {
      const cfg = layers[L.id]; if (!cfg || !cfg.on) continue;
      const lp = {}; for (const p of L.params || []) lp[p.id] = p.value; Object.assign(lp, cfg.params || {});
      try { L.run({...ctx, seed: seed + 7777, params: lp, out, gen, palette: list, info: (c) => list[out[c]]}); } catch (e) { console.warn('[preview layer ' + L.id + ']', e); }
    }
    const rgb = new Float32Array(g.V * 3), water = new Uint8Array(g.V), col = new ss.THREE.Color();
    for (let c = 0; c < g.V; c++) {
      const t = list[out[c]] || {color: '#7a7f88', h: 0};
      col.set(t.color); rgb[c * 3] = col.r; rgb[c * 3 + 1] = col.g; rgb[c * 3 + 2] = col.b;
      water[c] = (t.fx === 'water' || t.h < -0.05) ? 1 : t.bld ? 2 : 0;
    }
    const r = {rgb, water, atmo};
    if (ss.metrics) ss.metrics.record('preview:' + gen.id, performance.now() - tStart);
    if (cache.size > 120) cache.clear();
    cache.set(key, r);
    return r;
  }

  // draw the result centred in the canvas; spin turns the globe (radians)
  function draw(canvas, data, {spin = 0.6, stars = true} = {}) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth || canvas.width, H = canvas.clientHeight || canvas.height;
    if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const x = canvas.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = x.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
    bg.addColorStop(0, '#131a2a'); bg.addColorStop(1, '#06080e');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    if (stars) { const r = util.mulberry(W * 7 + H); x.fillStyle = '#ffffff'; for (let i = 0; i < W * H / 900; i++) { x.globalAlpha = 0.2 + r() * 0.6; x.fillRect(r() * W, r() * H, r() < 0.1 ? 1.5 : 1, r() < 0.1 ? 1.5 : 1); } x.globalAlpha = 1; }
    const R = Math.min(W, H) * 0.4, cx = W / 2, cy = H / 2;
    const atmo = data && data.atmo;
    if (atmo && atmo.on !== false) {
      const glow = x.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.22);
      glow.addColorStop(0, hexA(atmo.color, 0.55)); glow.addColorStop(1, hexA(atmo.color, 0));
      x.fillStyle = glow; x.beginPath(); x.arc(cx, cy, R * 1.22, 0, 7); x.fill();
    }
    if (!data || !data.rgb) { x.fillStyle = '#2a3140'; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill(); x.fillStyle = '#8a93a6'; x.font = '12px system-ui'; x.textAlign = 'center'; x.fillText('нет предпросмотра', cx, cy + 4); return; }
    const g = grid(), cs = Math.cos(spin), sn = Math.sin(spin), tilt = 0.35, ct = Math.cos(tilt), st = Math.sin(tilt);
    const Lx = -0.55, Ly = 0.45, Lz = 0.7, cell = Math.sqrt(4 * Math.PI / g.V) * R * 0.62;
    const order = [];
    for (let c = 0; c < g.V; c++) {
      const px = g.centers[c * 3], py = g.centers[c * 3 + 1], pz = g.centers[c * 3 + 2];
      const rx = px * cs + pz * sn, rz = -px * sn + pz * cs;           // spin around the axis
      const ry = py * ct - rz * st, rz2 = py * st + rz * ct;           // tilt toward the viewer
      if (rz2 > -0.08) order.push([rz2, c, rx, ry]);
    }
    order.sort((a, b) => a[0] - b[0]);
    for (const [z, c, rx, ry] of order) {
      const lam = Math.max(0, rx * Lx + ry * Ly + z * Lz), k = 0.18 + 0.95 * lam, w = data.water[c];
      let r = data.rgb[c * 3] * k, gg = data.rgb[c * 3 + 1] * k, b = data.rgb[c * 3 + 2] * k;
      if (w === 1) { const sp = Math.pow(lam, 18) * 0.6; r += sp; gg += sp; b += sp; }
      x.fillStyle = `rgb(${Math.min(255, r * 255) | 0},${Math.min(255, gg * 255) | 0},${Math.min(255, b * 255) | 0})`;
      x.beginPath(); x.arc(cx + rx * R, cy - ry * R, cell * (0.55 + 0.45 * Math.max(0, z)) + 0.6, 0, 7); x.fill();
      if (w === 2 && lam < 0.25) { x.fillStyle = 'rgba(255,200,120,.9)'; x.fillRect(cx + rx * R - 0.75, cy - ry * R - 0.75, 1.5, 1.5); } // city lights at night
    }
    // soft limb shading
    const limb = x.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.2, cx, cy, R * 1.02);
    limb.addColorStop(0, 'rgba(0,0,0,0)'); limb.addColorStop(0.75, 'rgba(0,0,0,0)'); limb.addColorStop(1, 'rgba(0,0,0,.45)');
    x.fillStyle = limb; x.beginPath(); x.arc(cx, cy, R + 0.5, 0, 7); x.fill();
  }
  function hexA(hex, a) { const c = new ss.THREE.Color(hex || '#6badff'); return `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},${a})`; }

  return {compute, draw, grid};
}
