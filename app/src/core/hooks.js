// Event bus with priorities. emit() notifies, filter() lets handlers transform a value.
// A failing handler is logged and skipped, so one broken mod cannot stop the editor.
export class Hooks {
  constructor() { this._m = new Map(); }

  on(name, fn, priority = 0) {
    const list = this._m.get(name) || [];
    list.push({fn, priority});
    list.sort((a, b) => b.priority - a.priority);
    this._m.set(name, list);
    return () => this.off(name, fn);
  }

  once(name, fn, priority = 0) {
    const off = this.on(name, (...a) => { off(); fn(...a); }, priority);
    return off;
  }

  off(name, fn) {
    const list = this._m.get(name);
    if (!list) return;
    const i = list.findIndex(h => h.fn === fn);
    if (i >= 0) list.splice(i, 1);
  }

  emit(name, ...args) {
    const list = this._m.get(name);
    if (!list) return;
    for (const h of [...list]) {
      try { h.fn(...args); } catch (e) { console.error(`[hook ${name}]`, e); }
    }
  }

  filter(name, value, ...args) {
    const list = this._m.get(name);
    if (!list) return value;
    for (const h of [...list]) {
      try { const r = h.fn(value, ...args); if (r !== undefined) value = r; } catch (e) { console.error(`[filter ${name}]`, e); }
    }
    return value;
  }

  names() { return [...this._m.keys()]; }
}
