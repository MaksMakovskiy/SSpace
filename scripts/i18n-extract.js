// Lists the Russian strings of the editor or of a mod, to find what still needs an English translation.
//   node scripts/i18n-extract.js app            → strings of the core (app/src, app/index.html)
//   node scripts/i18n-extract.js mods/<folder>  → strings of one mod
//   --missing <en.json>  only those that have no translation there;  --json  print as a JSON array
'use strict';
const fs = require('fs'), path = require('path');
const CYR = /[А-Яа-яЁё]/;
const BS = String.fromCharCode(92);
function walk(dir, out = []) {
  for (const d of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) { if (d.name !== 'lib' && d.name !== 'i18n') walk(p, out); }
    else if (/\.(js|html|json)$/.test(d.name) && d.name !== 'package.json' && d.name !== 'index.json') out.push(p);
  }
  return out;
}
// a small tokenizer: string literals (', ", `) outside comments; ${…} inside templates becomes {}
function strings(src) {
  const out = []; let i = 0; const n = src.length;
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (c === '/' && c2 === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && c2 === '*') { i = src.indexOf('*/', i + 2); if (i < 0) break; i += 2; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1, s = '';
      while (j < n && src[j] !== c && src[j] !== '\n') { if (src[j] === BS) { s += src[j + 1]; j += 2; } else s += src[j++]; }
      if (CYR.test(s)) out.push(s); i = j + 1; continue;
    }
    if (c === '`') {
      let j = i + 1, s = '';
      while (j < n && src[j] !== '`') {
        if (src[j] === BS) { s += src[j + 1]; j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') {
          let k = j + 2, depth = 1;
          while (k < n && depth) { if (src[k] === '{') depth++; else if (src[k] === '}') depth--; k++; }
          s += '{}'; j = k; continue;
        }
        s += src[j++];
      }
      if (CYR.test(s)) out.push(s); i = j + 1; continue;
    }
    i++;
  }
  return out;
}
module.exports = {strings, walk};
if (require.main === module) {
  const target = process.argv[2] || 'app';
  const files = fs.statSync(target).isDirectory() ? walk(target) : [target];
  const mi = process.argv.indexOf('--missing');
  const have = mi > 0 && fs.existsSync(process.argv[mi + 1]) ? JSON.parse(fs.readFileSync(process.argv[mi + 1], 'utf8')) : null;
  const all = new Set();
  for (const f of files) for (const s of strings(fs.readFileSync(f, 'utf8'))) all.add(s);
  const list = [...all].filter(s => !have || !(s in have));
  if (process.argv.includes('--json')) console.log(JSON.stringify(list, null, 1));
  else { for (const s of list) console.log(s); console.error(`${list.length} строк, ${list.reduce((a, s) => a + s.length, 0)} символов`); }
}
