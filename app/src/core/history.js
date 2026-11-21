// Undo/redo for cell layers ("terrain" -> doc.cells, "mark" -> doc.markers).
// Paint in strokes: begin(layer) → set(c, v)… → commit().
export class History {
  constructor(ss) { this.ss = ss; this.undoStack = []; this.redoStack = []; this.stroke = null; }

  arr(layer) { return layer === 'mark' ? this.ss.doc.markers : this.ss.doc.cells; }

  begin(layer) { this.stroke = {layer, m: new Map()}; }

  set(c, v) {
    const s = this.stroke; if (!s) return;
    const A = this.arr(s.layer);
    if (A[c] === v) return;
    if (!s.m.has(c)) s.m.set(c, A[c]);
    A[c] = v;
    this.ss.view.cellChanged(s.layer, c);
  }

  setMany(list, v) { for (const c of list) this.set(c, v); }

  commit(label) {
    const s = this.stroke; this.stroke = null;
    if (!s || !s.m.size) return false;
    const A = this.arr(s.layer), ch = [];
    s.m.forEach((old, c) => ch.push([c, old, A[c]]));
    this.undoStack.push({layer: s.layer, ch, label});
    if (this.undoStack.length > 300) this.undoStack.shift();
    this.redoStack = [];
    this.ss.docChanged({layer: s.layer});
    return true;
  }

  apply(e, useNew) {
    const A = this.arr(e.layer);
    for (const [c, o, n] of e.ch) { A[c] = useNew ? n : o; this.ss.view.cellChanged(e.layer, c); }
    this.ss.docChanged({layer: e.layer});
  }

  undo() { const e = this.undoStack.pop(); if (!e) return false; this.redoStack.push(e); this.apply(e, false); return true; }
  redo() { const e = this.redoStack.pop(); if (!e) return false; this.undoStack.push(e); this.apply(e, true); return true; }
  clear() { this.undoStack = []; this.redoStack = []; this.stroke = null; }
}
