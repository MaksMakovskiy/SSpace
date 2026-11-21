// Generic id -> definition store. Every kind of content (terrains, effects, tools, windows, menus...)
// lives in one of these, so core content and mods use exactly the same path.
export class Registry {
  static source = null;
  constructor(kind, hooks) {
    this.kind = kind;
    this.hooks = hooks;
    this.map = new Map();
    this.version = 0;
  }

  register(def) {
    if (!def || typeof def.id !== 'string' || !def.id) throw new Error(`${this.kind}: у записи должен быть строковый id`);
    const prev = this.map.get(def.id), had = !!prev;
    const item = {...def};
    // remember who added it (the mod loader sets Registry.source while a mod starts); say so when a mod replaces another's entry
    Object.defineProperty(item, 'source', {value: def.source || Registry.source || (prev && prev.source) || 'ядро', enumerable: false, writable: true});
    if (prev && Registry.source && prev.source !== item.source) console.info(`[реестр] ${this.kind} «${def.id}»: запись из «${prev.source}» заменена: ${item.source}`);
    this.map.set(def.id, item);
    this.version++;
    this.hooks.emit('registry:' + this.kind, {type: had ? 'update' : 'add', id: def.id, item});
    return item;
  }

  update(id, patch) {
    const cur = this.map.get(id);
    if (!cur) return null;
    return this.register({...cur, ...patch, id});
  }

  remove(id) {
    if (this.map.delete(id)) {
      this.version++;
      this.hooks.emit('registry:' + this.kind, {type: 'remove', id});
    }
  }

  get(id) { return this.map.get(id); }
  has(id) { return this.map.has(id); }
  list() { return [...this.map.values()]; }
  ids() { return [...this.map.keys()]; }
  get size() { return this.map.size; }
}
