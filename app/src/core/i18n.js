// Interface language. The editor and its mods are written in Russian; a dictionary per language
// (source text → translated text) turns the interface into that language as it is drawn:
//   • the core dictionary is app/src/i18n/<lang>.json;
//   • a mod adds its own: mods/<folder>/i18n/<lang>.json (loaded automatically) or ss.i18n.add(lang, {...});
//     a mod without a dictionary for the chosen language simply stays in its own language;
//   • a key with {} is a pattern: "планет: {}" → "planets: {}" (the parts in {} are translated too if they can be).
// Translation happens on the page itself (text, title, placeholder, aria-label), so code keeps its strings;
// for text drawn on a canvas or put into document.title, code calls ss.t(text).
export const LANGS = [{id: 'ru', name: 'Русский'}, {id: 'en', name: 'English'}];
const CYR = /[А-Яа-яЁё]/, LAT = /[A-Za-z]/;
// a glued sentence is split first at strong breaks (brackets, ·, —, quotes), and only where that is not enough
// at commas, colons and slashes
const SEP1 = /(\s*[·—|()«»"“”„\n]\s*|\s+[-–]\s+)/;
const SEP2 = /(\s*[:;,]\s*|\s*\/\s*|\s*…\s*)/;
const ATTRS = ['title', 'placeholder', 'aria-label'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CANVAS', 'svg', 'SVG', 'path']);

export function defaultLang() {
  const n = (navigator.languages && navigator.languages[0]) || navigator.language || 'ru';
  return /^(ru|uk|be|kk)/i.test(n) ? 'ru' : 'en';
}

export function createI18n(lang) {
  const dict = new Map();                // source → target for the current language
  const long = [];                       // longer keys, longest first: found inside glued text as a last resort
  const patterns = [];                   // [{re, out}] for keys with {}
  const cache = new Map();
  const orig = new WeakMap();            // node → {src, out} so text is never translated twice
  const attrOrig = new WeakMap();
  // which texts need work: Russian when translating into English; Latin when a mod gives Russian for English text
  const needs = lang === 'ru' ? (s) => LAT.test(s) && dict.size > 0 : (s) => CYR.test(s);
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const escRe = (s) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');

  function add(l, obj) {
    if (l !== lang || !obj || typeof obj !== 'object') return 0;
    let n = 0;
    for (const [k0, v] of Object.entries(obj)) {
      if (typeof v !== 'string' || !k0) continue;
      const k = norm(k0);
      if (k.includes('{}')) {
        const parts = k.split('{}');
        // a pattern with almost no words of its own ("{} из {}") only fits numbers, or it would eat ordinary sentences
        const weak = parts.length > 2 && parts.join('').replace(/[\s.,:;·—()«»%#№/-]/g, '').length < 5;
        patterns.push({re: new RegExp('^' + parts.map(escRe).join('(.+?)') + '$', 's'), out: v.trim(), weak, lit: parts.join('').length});
      }
      // the first translation of a text wins: the core loads first, so a mod cannot rename «Вид» in the menu
      if (!dict.has(k)) dict.set(k, v.trim()); n++;
      // "Кварталы (ночью огни)" also teaches "Кварталы" and "ночью огни"; "Газ: полосы (мод)" teaches "Газ: полосы"
      const pk = /^(.+?)\s*\(([^()]+)\)$/.exec(k), pv = /^(.+?)\s*\(([^()]+)\)$/.exec(v.trim());
      if (pk && pv) { if (!dict.has(pk[1])) dict.set(pk[1], pv[1]); if (!dict.has(pk[2])) dict.set(pk[2], pv[2]); }
      if (k.length >= 8 && !k.includes('{}')) long.push(k);
      // "Выбрано:" also answers for "Выбрано" (a sentence split at its colon)
      if (/[:：]$/.test(k) && !dict.has(k.slice(0, -1).trim())) dict.set(k.slice(0, -1).trim(), v.trim().replace(/[:：]$/, ''));
    }
    long.sort((a, b) => b.length - a.length);
    // the most specific pattern first: «Пересекаются: {} — подсвечены» before «Пересекаются: {}»
    patterns.sort((a, b) => b.lit - a.lit);
    cache.clear();
    if (n && started) schedule(document.body);
    return n;
  }
  // core lookups; whitespace around the text is kept as it was
  function exact(s) { return dict.get(s); }
  function viaPattern(s) {
    for (const p of patterns) {
      const m = p.re.exec(s); if (!m) continue;
      if (p.weak && m.slice(1).some(g => !/^[\d\s.,%#+\-−×°]+$/.test(g))) continue;
      let i = 1; return p.out.replace(/\{\}/g, () => { const g = m[i++] || ''; return needs(g) ? (translateCore(g) ?? viaSegments(g) ?? viaSegments(g, SEP2) ?? g) : g; });
    }
    return undefined;
  }
  // numbers in front or behind: "12 систем", "высота 0.4"
  function viaNumbers(s) {
    const m = /^([^\p{L}]*)(.*?)([^\p{L}]*)$/su.exec(s);
    if (!m || (!m[1] && !m[3]) || !m[2]) return undefined;
    const mid = exact(m[2]); return mid === undefined ? undefined : m[1] + mid + m[3];
  }
  // a sentence glued from pieces: translate every piece that is known, keep the rest
  function viaSegments(s, sep = SEP1) {
    const bits = s.split(sep); if (bits.length < 2) return undefined;
    let changed = false, missed = false;
    const out = bits.map((b, i) => {
      if (i % 2 || !b || !needs(b)) return b;
      const tb = b.trim();
      const r = translateCore(tb) ?? (sep === SEP1 ? viaSegments(tb, SEP2) : undefined);
      if (r === undefined) { missed = true; return b; } changed = true;
      return b.replace(tb, r);
    });
    // inside a phrase (commas, colons) it is all or nothing: half-translated sentences read worse than none
    if (sep === SEP2 && missed) return undefined;
    return changed ? out.join('') : undefined;
  }
  const rules = [];
  function viaRules(s) { for (const f of rules) { const r = f(s); if (r !== undefined && r !== s) return r; } return undefined; }
  function translateCore(s) { return exact(s) ?? viaPattern(s) ?? viaNumbers(s) ?? viaRules(s); }
  function t(text) {
    if (typeof text !== 'string' || !text || !needs(text)) return text;
    if (cache.has(text)) return cache.get(text);
    const s = norm(text);
    let r = translateCore(s);
    if (r === undefined) {
      // known longer phrases glued into the text ("Кисть (B) ЛКМ — рисовать…") go first, whole;
      // what is left is split into pieces
      let x = s; for (const k of long) if (x.length >= k.length && x.includes(k)) x = x.split(k).join(dict.get(k));
      const y = needs(x) ? (viaSegments(x) ?? viaSegments(x, SEP2)) : undefined;
      r = y ?? (x !== s ? x : undefined);
    }
    if (r === undefined) r = text; else { const lead = /^\s*/.exec(text)[0], tail = /\s*$/.exec(text)[0]; r = lead + r + tail; }
    if (cache.size > 6000) cache.clear();
    cache.set(text, r);
    return r;
  }

  // ---------- the page ----------
  let started = false, obs = null, queued = new Set(), raf = 0;
  const skip = (el) => !el || SKIP_TAGS.has(el.tagName) || (el.closest && el.closest('[data-i18n-skip], [contenteditable=true]'));
  function textNode(n) {
    const v = n.nodeValue; if (!v || !needs(v)) return;
    const o = orig.get(n); if (o && o.out === v) return;
    if (skip(n.parentElement)) return;
    const out = t(v); if (out === v) return;
    orig.set(n, {src: v, out}); n.nodeValue = out;
  }
  function attrs(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a); if (!v || !needs(v)) continue;
      const out = t(v); if (out !== v) el.setAttribute(a, out);
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (skip(root)) return; attrs(root); }
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = tw.nextNode())) { if (n.nodeType === 3) textNode(n); else attrs(n); }
  }
  function schedule(node) { queued.add(node); if (!raf) raf = requestAnimationFrame(flush); }
  function flush() { raf = 0; const list = [...queued]; queued.clear(); for (const n of list) if (n.isConnected !== false) walk(n); }
  function start() {
    if (started || lang === 'ru' && !dict.size) { started = true; }
    started = true;
    if (obs) return;
    obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') textNode(m.target);
        else if (m.type === 'attributes') { if (m.target.nodeType === 1) attrs(m.target); }
        else for (const n of m.addedNodes) walk(n); // at once, so new text never shows in the other language
      }
    });
    obs.observe(document.documentElement, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS});
    walk(document.body);
  }
  // a rule is a function (text) → translation or undefined, for things a dictionary cannot list (sector names…)
  const addRule = (l, fn) => { if (l === lang && typeof fn === 'function') { rules.push(fn); cache.clear(); } };
  return {lang, LANGS, add, addRule, t, start, walk, get size() { return dict.size; }};
}
