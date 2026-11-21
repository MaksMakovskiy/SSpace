// Log: levelled entries with a category, kept in a ring buffer, also caught from console.warn/error,
// uncaught errors and rejected promises. Listeners get every entry (the «Журнал» window, the file sink, tests).
//   ss.log.info('generate', 'Сгенерировано', {id, ms})   levels: debug · info · warn · error
//   ss.log.entries({level: 'warn', cat: 'mod', text: 'орбит', since: t}) → [...]
//   ss.log.on(fn) → off()
export const LEVELS = {debug: 0, info: 1, warn: 2, error: 3};

export function createLog({max = 3000} = {}) {
  const buf = [], listeners = new Set(), t0 = performance.now();
  let seq = 0, busy = false;
  const fmt = (x) => { if (x instanceof Error) return x.message; if (typeof x === 'object' && x) { try { return JSON.stringify(x).slice(0, 400); } catch { return String(x); } } return String(x); };

  function add(level, cat, msg, data) {
    const e = {id: ++seq, t: Math.round(performance.now() - t0), time: Date.now(), level, cat: cat || 'app', msg: String(msg), data: data === undefined ? undefined : data};
    if (data instanceof Error) { e.data = {message: data.message, stack: String(data.stack || '').split('\n').slice(0, 6).join('\n')}; }
    buf.push(e); if (buf.length > max) buf.splice(0, buf.length - max);
    if (!busy) { busy = true; try { for (const f of listeners) { try { f(e); } catch {} } } finally { busy = false; } }
    return e;
  }
  const api = {
    debug: (cat, msg, data) => add('debug', cat, msg, data),
    info: (cat, msg, data) => add('info', cat, msg, data),
    warn: (cat, msg, data) => add('warn', cat, msg, data),
    error: (cat, msg, data) => add('error', cat, msg, data),
    on(f) { listeners.add(f); return () => listeners.delete(f); },
    entries({level = 'debug', cat = '', text = '', since = 0, limit = 0} = {}) {
      const min = LEVELS[level] ?? 0, q = text.toLowerCase();
      let out = buf.filter(e => LEVELS[e.level] >= min && e.id > since && (!cat || e.cat === cat) && (!q || (e.cat + ' ' + e.msg + ' ' + (e.data ? fmt(e.data) : '')).toLowerCase().includes(q)));
      if (limit) out = out.slice(-limit);
      return out;
    },
    get last() { return seq; },
    counts() { const c = {debug: 0, info: 0, warn: 0, error: 0}; for (const e of buf) c[e.level]++; return c; },
    clear() { buf.length = 0; },
    line(e) { const d = new Date(e.time); const hh = d.toTimeString().slice(0, 8); return `${hh} ${e.level.toUpperCase().padEnd(5)} [${e.cat}] ${e.msg}${e.data !== undefined ? ' ' + fmt(e.data) : ''}`; },
    text(opts) { return api.entries(opts).map(api.line).join('\n'); },
  };

  // catch what the rest of the code (and mods) prints, without changing what the console shows
  const orig = {warn: console.warn.bind(console), error: console.error.bind(console)};
  const catOf = (a) => { const m = typeof a[0] === 'string' && a[0].match(/^\[([^\]]+)\]/); return m ? m[1] : 'console'; };
  console.warn = (...a) => { orig.warn(...a); if (!busy) add('warn', catOf(a), a.map(fmt).join(' ').slice(0, 1000)); };
  console.error = (...a) => { orig.error(...a); if (!busy) add('error', catOf(a), a.map(fmt).join(' ').slice(0, 1000), a.find(x => x instanceof Error)); };
  window.addEventListener('error', (ev) => add('error', 'crash', ev.message + ' @ ' + String(ev.filename || '').split('/').slice(-2).join('/') + ':' + ev.lineno, ev.error));
  window.addEventListener('unhandledrejection', (ev) => add('error', 'promise', fmt(ev.reason && ev.reason.message || ev.reason), ev.reason instanceof Error ? ev.reason : undefined));
  return api;
}
