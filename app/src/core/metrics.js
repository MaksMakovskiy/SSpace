// Metrics: timers (with avg / p50 / p95 / max over recent samples), counters, gauges and live frame stats.
//   ss.metrics.time('generate:jungle', () => …)      — sync or async, returns fn's result
//   const stop = ss.metrics.start('autosave'); …; stop({bytes})
//   ss.metrics.count('autosave.fail'); ss.metrics.gauge('palette', n)
//   ss.metrics.snapshot() → everything at once (for the window, reports and tests)
export function createMetrics(ss) {
  const timers = new Map(), counters = new Map(), gauges = new Map(), SAMPLES = 200;
  const frames = new Float32Array(600); let fi = 0, fn = 0, lastFrame = 0, longFrames = 0;

  function record(name, ms, extra) {
    let t = timers.get(name);
    if (!t) { t = {n: 0, total: 0, max: 0, min: Infinity, last: 0, s: [], extra: null}; timers.set(name, t); }
    t.n++; t.total += ms; t.last = ms; if (ms > t.max) t.max = ms; if (ms < t.min) t.min = ms;
    t.s.push(ms); if (t.s.length > SAMPLES) t.s.shift();
    if (extra) t.extra = extra;
    if (ms > 500 && ss.log) ss.log.warn('perf', `${name}: ${Math.round(ms)} мс`, extra);
    return ms;
  }
  const pct = (arr, p) => { if (!arr.length) return 0; const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };
  const round = (x) => Math.round(x * 100) / 100;

  const api = {
    record,
    start(name) { const t = performance.now(); return (extra) => record(name, performance.now() - t, extra); },
    time(name, fn) {
      const t = performance.now();
      let r; try { r = fn(); } catch (e) { record(name, performance.now() - t, {error: e.message}); throw e; }
      if (r && typeof r.then === 'function') return r.then(v => { record(name, performance.now() - t); return v; }, e => { record(name, performance.now() - t, {error: e.message}); throw e; });
      record(name, performance.now() - t); return r;
    },
    count(name, k = 1) { counters.set(name, (counters.get(name) || 0) + k); },
    gauge(name, v) { gauges.set(name, v); },
    stats(name) {
      const t = timers.get(name); if (!t) return null;
      return {n: t.n, avg: round(t.total / t.n), p50: round(pct(t.s, 0.5)), p95: round(pct(t.s, 0.95)), max: round(t.max), min: round(t.min), last: round(t.last), total: round(t.total), extra: t.extra};
    },
    timers() { return [...timers.keys()].sort().map(k => ({name: k, ...api.stats(k)})); },
    // frame stats over the last frames (or only those after a mark from frameMark())
    frameMark() { return fn; },
    frame(mark = null) {
      const all = Math.min(fn, frames.length), n = mark == null ? all : Math.min(all, Math.max(0, fn - mark));
      const arr = []; for (let k = 1; k <= n; k++) arr.push(frames[(fi - k + frames.length) % frames.length]);
      const avg = n ? arr.reduce((a, b) => a + b, 0) / n : 0;
      return {fps: avg ? round(1000 / avg) : 0, avgMs: round(avg), p95Ms: round(pct(arr, 0.95)), worstMs: round(n ? Math.max(...arr) : 0), longFrames, samples: n};
    },
    render() {
      const r = ss.scene && ss.scene.renderer, i = r && r.info;
      const mem = performance.memory;
      return {
        calls: i ? i.render.calls : 0, triangles: i ? i.render.triangles : 0, points: i ? i.render.points : 0,
        geometries: i ? i.memory.geometries : 0, textures: i ? i.memory.textures : 0, programs: i && i.programs ? i.programs.length : 0,
        heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null, heapLimitMB: mem ? Math.round(mem.jsHeapSizeLimit / 1048576) : null,
      };
    },
    world() {
      const d = ss.doc, out = {level: ss.space && ss.space.nav.level};
      if (d) Object.assign(out, {cells: d.cells.length, n: d.n, palette: d.palette.length, pois: d.pois.length, orbit: ss.orbit ? ss.orbit.items().length : 0, effects: Object.values((d.meta && d.meta.look) || {}).filter(v => v === true).length});
      let pieces = 0; if (ss.scene && ss.scene.globe) ss.scene.globe.traverse(o => { if (o.isInstancedMesh) pieces += o.count; }); out.pieces3D = pieces;
      return out;
    },
    snapshot() {
      return {at: new Date().toISOString(), frame: api.frame(), render: api.render(), world: api.world(), timers: api.timers(),
        counters: Object.fromEntries(counters), gauges: Object.fromEntries(gauges)};
    },
    reset() { timers.clear(); counters.clear(); gauges.clear(); fn = 0; fi = 0; longFrames = 0; },
  };
  // frame times, measured between frames (includes rendering)
  ss.hooks.on('frame', () => {
    const now = performance.now();
    if (lastFrame && document.visibilityState === 'visible') { const ms = now - lastFrame; frames[fi] = ms; fi = (fi + 1) % frames.length; fn++; if (ms > 50) longFrames++; }
    lastFrame = now;
  }, -100);
  return api;
}
