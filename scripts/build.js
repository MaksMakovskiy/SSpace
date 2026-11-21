// Builds a portable Windows version (no installer) and the mod downloads for a release.
//   npm run build            → dist/SSpace-<ver>-win-x64.zip   (the editor without mods)
//                              dist/SSpace-<ver>-win-x64-full.zip (the editor with every mod of this folder)
//                              dist/mods/<id>.sspack, dist/mods/all-mods.sspack, dist/mods/themes-pack.sspack
// A .sspack opens in SSpace through «Файл → Открыть…» and installs its mods (see app/src/ui/share.js).
// Uses the Electron that npm already installed (node_modules/electron/dist): nothing is downloaded.
'use strict';
const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const ROOT = path.join(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));
const VERSION = (fs.readFileSync(path.join(ROOT, 'app/src/sspace.js'), 'utf8').match(/VERSION = '([^']+)'/) || [])[1] || pkg.version;
const DIST = path.join(ROOT, 'dist');
const ELECTRON = path.join(ROOT, 'node_modules/electron/dist');
const TEXT_EXT = new Set(['.js', '.mjs', '.json', '.css', '.md', '.txt', '.html', '.svg', '.glsl']);

const rm = (p) => fs.rmSync(p, {recursive: true, force: true});
const copy = (from, to, filter) => fs.cpSync(from, to, {recursive: true, filter: filter || (() => true)});
const log = (...a) => console.log('[build]', ...a);

function modList() {
  const dir = path.join(ROOT, 'mods');
  return fs.readdirSync(dir, {withFileTypes: true}).filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => ({folder: d.name, ...JSON.parse(fs.readFileSync(path.join(dir, d.name, 'mod.json'), 'utf8'))}));
}
function modFiles(folder) {
  const base = path.join(ROOT, 'mods', folder), out = [];
  const walk = (dir) => { for (const d of fs.readdirSync(dir, {withFileTypes: true})) {
    if (d.name.startsWith('.')) continue;
    const full = path.join(dir, d.name), rel = path.relative(base, full).split(path.sep).join('/');
    if (d.isDirectory()) walk(full);
    else { const buf = fs.readFileSync(full); out.push(TEXT_EXT.has(path.extname(d.name).toLowerCase()) ? {path: rel, text: buf.toString('utf8')} : {path: rel, b64: buf.toString('base64')}); }
  } };
  walk(base); return out;
}
const bundle = (name, mods, extra = {}) => JSON.stringify({format: 'sspace-bundle', version: 1, name, created: new Date().toISOString(), app: 'SSpace ' + VERSION,
  mods: mods.map(m => ({id: m.id, folder: m.folder, name: m.name, version: m.version, author: m.author, files: modFiles(m.folder)})), ...extra});

function appFolder(name, withMods) {
  const out = path.join(DIST, name);
  rm(out);
  log('Electron →', name);
  copy(ELECTRON, out);
  fs.renameSync(path.join(out, 'electron.exe'), path.join(out, 'SSpace.exe'));
  rm(path.join(out, 'resources', 'default_app.asar'));
  const app = path.join(out, 'resources', 'app');
  fs.mkdirSync(app, {recursive: true});
  for (const f of ['main.js', 'preload.js', 'LICENSE', 'README.md', 'README.ru.md']) fs.copyFileSync(path.join(ROOT, f), path.join(app, f));
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({name: pkg.name, version: VERSION, description: pkg.description, main: 'main.js', author: pkg.author, license: pkg.license}, null, 2));
  copy(path.join(ROOT, 'app'), path.join(app, 'app'));
  copy(path.join(ROOT, 'packs'), path.join(app, 'packs'));
  // three.js: only the module the editor loads, with its licence
  const three = path.join(app, 'node_modules', 'three');
  fs.mkdirSync(path.join(three, 'build'), {recursive: true});
  fs.copyFileSync(path.join(ROOT, 'node_modules/three/build/three.module.js'), path.join(three, 'build/three.module.js'));
  fs.copyFileSync(path.join(ROOT, 'node_modules/three/LICENSE'), path.join(three, 'LICENSE'));
  fs.copyFileSync(path.join(ROOT, 'node_modules/three/package.json'), path.join(three, 'package.json'));
  // mods: all of them, or an empty folder (mods are then installed from .sspack files)
  const mods = path.join(app, 'mods');
  fs.mkdirSync(mods, {recursive: true});
  if (withMods) for (const m of modList()) copy(path.join(ROOT, 'mods', m.folder), path.join(mods, m.folder), (src) => !path.basename(src).startsWith('.'));
  fs.writeFileSync(path.join(mods, 'index.json'), JSON.stringify(withMods ? modList().map(m => m.folder) : []));
  fs.writeFileSync(path.join(out, 'README.txt'),
`SSpace ${VERSION} — a 3D editor of universes and hex planets for tabletop campaigns.
Run SSpace.exe. No installation needed: everything lives in this folder and in your user profile.
${withMods ? 'All mods are already included.' : 'No mods included. Download the .sspack files you want from the release page and open them in SSpace: "File > Open...".'}
Language: English or Russian — Settings > Windows and interface > Language.
License: MIT, (c) 2026 Maksym Makovskyi (Snvok) — resources/app/LICENSE. Source: https://github.com/MaksMakovskiy/SSpace

SSpace ${VERSION} — 3D-редактор вселенных и гекс-планет для настольных кампаний.
Запуск: SSpace.exe. Установка не нужна.
${withMods ? 'Внутри уже есть все моды.' : 'Моды не включены: скачай нужные .sspack со страницы релиза и открой их в SSpace — «Файл → Открыть…».'}
Язык: русский или английский — «Настройки → Окна и интерфейс → Язык».
`);
  return out;
}
function zip(folder) {
  const z = folder + '.zip'; rm(z);
  log('zip', path.basename(z));
  execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${folder}\\*' -DestinationPath '${z}' -CompressionLevel Optimal`], {stdio: 'inherit'});
  return z;
}

fs.mkdirSync(DIST, {recursive: true});
const mods = modList();
const modsOut = path.join(DIST, 'mods'); rm(modsOut); fs.mkdirSync(modsOut, {recursive: true});
// a single mod's file also carries the mods it needs (requires), so it works on its own
const withDeps = (m) => { const out = [], add = (x) => { if (!x || out.includes(x)) return; for (const d of x.requires || []) add(mods.find(y => y.id === d)); out.push(x); }; add(m); return out; };
for (const m of mods) fs.writeFileSync(path.join(modsOut, m.id + '.sspack'), bundle(m.name, withDeps(m)));
fs.writeFileSync(path.join(modsOut, 'all-mods.sspack'), bundle('Все моды SSpace ' + VERSION, mods));
const themeMods = mods.filter(m => m.id === 'themes' || m.id === 'wide-ui');
fs.writeFileSync(path.join(modsOut, 'themes-pack.sspack'), bundle('Темы и просторный интерфейс', themeMods));
log('моды:', mods.length, '+ all-mods.sspack + themes-pack.sspack');

const bare = appFolder(`SSpace-${VERSION}-win-x64`, false);
const full = appFolder(`SSpace-${VERSION}-win-x64-full`, true);
if (!process.argv.includes('--no-zip')) { zip(bare); zip(full); }
log('готово:', path.relative(ROOT, DIST));
