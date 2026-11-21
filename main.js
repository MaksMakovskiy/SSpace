'use strict';
// SSpace — Electron main process.
// Serves the project folder under app://local/ so the editor, built-in packs, user packs and mods
// all load as ordinary ES modules / JSON from one origin.
const {app, BrowserWindow, protocol, net, ipcMain, dialog, shell, Menu} = require('electron');
const path = require('path');
const fs = require('fs');
const {pathToFileURL} = require('url');

const ROOT = __dirname;
const MODS_DIR = path.join(ROOT, 'mods');
const PACKS_DIR = path.join(ROOT, 'packs');
const SELFTEST = process.env.SSPACE_SELFTEST || '';           // 'quick' | 'full': run the built-in tests and exit
const SMOKE = !!process.env.SSPACE_SMOKE || !!SELFTEST;
// a test run never touches your profile (autosave, settings, logs) unless a folder is given
// (scripts/selftest.js gives a temporary folder and removes it afterwards; this is the fallback for a direct start)
if (SELFTEST && !process.env.SSPACE_USERDATA) process.env.SSPACE_USERDATA = path.join(require('os').tmpdir(), 'sspace-selftest-' + process.pid);
// smoke runs (npm run smoke, dev scripts through SSPACE_EVAL) get their own temporary profile too: a script that
// generates or edits things must never end up in your autosave. SSPACE_REAL_PROFILE=1 opts out on purpose.
if (SMOKE && !process.env.SSPACE_USERDATA && process.env.SSPACE_REAL_PROFILE !== '1') process.env.SSPACE_USERDATA = path.join(require('os').tmpdir(), 'sspace-smoke');
// a separate profile lets a test run start while the normal app is open
if (process.env.SSPACE_USERDATA) app.setPath('userData', process.env.SSPACE_USERDATA);
let win = null;

protocol.registerSchemesAsPrivileged([
  {scheme: 'app', privileges: {standard: true, secure: true, supportFetchAPI: true, corsEnabled: true}},
]);

function inside(base, p) {
  const r = path.relative(base, p);
  return !!r && !r.startsWith('..') && !path.isAbsolute(r);
}

function settingsFile() { return path.join(app.getPath('userData'), 'settings.json'); }
// Campaign autosave lives in a file (localStorage holds only a few MB, too little for big planets).
// Written to a temp file first and renamed, so a crash mid-write never leaves a broken autosave.
// log files: one per day in <userData>/logs, the last 14 are kept
function logDir() { return path.join(app.getPath('userData'), 'logs'); }
function appendLog(text) {
  const dir = logDir(); fs.mkdirSync(dir, {recursive: true});
  const f = path.join(dir, 'sspace-' + new Date().toISOString().slice(0, 10) + '.log');
  fs.appendFileSync(f, String(text || ''), 'utf8');
  const old = fs.readdirSync(dir).filter(x => /^sspace-.*\.log$/.test(x)).sort();
  for (const x of old.slice(0, Math.max(0, old.length - 14))) { try { fs.unlinkSync(path.join(dir, x)); } catch {} }
  return true;
}
function autosaveFile() { return path.join(app.getPath('userData'), 'autosave.sspace'); }
function writeAutosave({text, filePath}) {
  const f = autosaveFile(), tmp = f + '.tmp';
  fs.mkdirSync(path.dirname(f), {recursive: true});
  fs.writeFileSync(tmp, text, 'utf8'); fs.renameSync(tmp, f);
  fs.writeFileSync(f + '.path', filePath || '', 'utf8');
  return true;
}
function readAutosave() {
  try { const text = fs.readFileSync(autosaveFile(), 'utf8'); let filePath = ''; try { filePath = fs.readFileSync(autosaveFile() + '.path', 'utf8'); } catch {} return {text, filePath}; } catch { return null; }
}
function readSettings() { try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; } }
function writeSettings(s) {
  fs.mkdirSync(path.dirname(settingsFile()), {recursive: true});
  fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2));
}

function listMods() {
  const out = [];
  for (const d of fs.readdirSync(MODS_DIR, {withFileTypes: true})) {
    if (!d.isDirectory() || d.name.startsWith('.')) continue; // .install-* are unfinished installs
    const mf = path.join(MODS_DIR, d.name, 'mod.json');
    try {
      const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
      out.push({...m, id: m.id || d.name, folder: d.name});
    } catch (e) {
      out.push({id: d.name, name: d.name, folder: d.name, error: 'Не читается mod.json: ' + e.message});
    }
  }
  return out.sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.id).localeCompare(String(b.id)));
}

function listPacks() {
  // index.json is only the file list for the browser fallback, not a pack
  return fs.readdirSync(PACKS_DIR).filter(f => f.toLowerCase().endsWith('.json') && f.toLowerCase() !== 'index.json').sort().map(f => 'packs/' + f);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1480, height: 920, minWidth: 960, minHeight: 600,
    backgroundColor: '#0b0e15', title: 'SSpace', show: false,
    webPreferences: {preload: path.join(ROOT, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: !SMOKE},
  });
  win.once('ready-to-show', () => win.show());
  if (SMOKE) {
    win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      if (SELFTEST && level < 3) return; // a test run prints only its summary and real errors
      console.log(`[renderer:${level}] ${message}${sourceId ? ` (${sourceId}:${line})` : ''}`);
    });
    // a self-test ends itself; the timeout only guards against a hang
    setTimeout(() => { if (SELFTEST) console.log('[selftest] FAIL — не закончился вовремя'); app.exit(SELFTEST ? 2 : 0); }, Number(process.env.SSPACE_SMOKE_MS || (SELFTEST ? (SELFTEST === 'full' ? 600000 : 240000) : 9000)));
    // dev: run a script file in the editor once it is up (benchmarks, checks)
    if (process.env.SSPACE_EVAL) {
      win.webContents.once('did-finish-load', () => setTimeout(() => {
        win.webContents.executeJavaScript(fs.readFileSync(process.env.SSPACE_EVAL, 'utf8')).catch(e => console.log('[eval error]', e.message));
      }, 2500));
    }
  }
  win.loadURL('app://local/app/index.html');
}

app.whenReady().then(() => {
  fs.mkdirSync(MODS_DIR, {recursive: true});
  fs.mkdirSync(PACKS_DIR, {recursive: true});

  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    const file = path.normalize(path.join(ROOT, decodeURIComponent(u.pathname)));
    if (!inside(ROOT, file) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return new Response('Not found', {status: 404});
    }
    return net.fetch(pathToFileURL(file).toString());
  });

  Menu.setApplicationMenu(null);

  const fileFilters = [{name: 'SSpace: кампания, планета или сборка', extensions: ['sspace', 'sspack', 'json']}];
  ipcMain.handle('mods:list', () => listMods());
  ipcMain.handle('packs:list', () => listPacks());
  ipcMain.handle('file:open', async (_e, opts = {}) => {
    const r = await dialog.showOpenDialog(win, {filters: opts.filters || fileFilters, properties: ['openFile']});
    if (r.canceled || !r.filePaths[0]) return null;
    const p = r.filePaths[0];
    return {path: p, text: fs.readFileSync(p, 'utf8')};
  });
  ipcMain.handle('file:save', async (_e, {path: p, text, defaultName, filters, inPacks}) => {
    if (!p) {
      const defaultPath = inPacks ? path.join(PACKS_DIR, defaultName || 'pack.json') : defaultName;
      const r = await dialog.showSaveDialog(win, {defaultPath, filters: filters || fileFilters});
      if (r.canceled || !r.filePath) return null;
      p = r.filePath;
    }
    fs.writeFileSync(p, text, 'utf8');
    return p;
  });
  ipcMain.handle('file:saveBinary', async (_e, {dataUrl, defaultName, filters}) => {
    const r = await dialog.showSaveDialog(win, {defaultPath: defaultName, filters});
    if (r.canceled || !r.filePath) return null;
    const b64 = String(dataUrl).split(',')[1] || '';
    fs.writeFileSync(r.filePath, Buffer.from(b64, 'base64'));
    return r.filePath;
  });
  ipcMain.handle('mods:openFolder', () => shell.openPath(MODS_DIR));
  // ---- sharing: read a mod's files into a bundle / install a mod from a bundle ----
  const SAFE_FOLDER = /^[A-Za-z0-9._-]{1,64}$/;
  const TEXT_EXT = new Set(['.js', '.mjs', '.json', '.css', '.md', '.txt', '.html', '.svg', '.glsl']);
  ipcMain.handle('mods:readFiles', (_e, folder) => {
    if (!SAFE_FOLDER.test(String(folder))) return {error: 'Плохое имя папки мода'};
    const base = path.join(MODS_DIR, folder);
    if (!inside(MODS_DIR, base) || !fs.existsSync(base)) return {error: 'Нет такого мода'};
    const files = []; let total = 0;
    const walk = (dir) => {
      for (const d of fs.readdirSync(dir, {withFileTypes: true})) {
        const full = path.join(dir, d.name), rel = path.relative(base, full).split(path.sep).join('/');
        if (d.name.startsWith('.')) continue;
        if (d.isDirectory()) { walk(full); continue; }
        const buf = fs.readFileSync(full); total += buf.length;
        if (total > 30 * 1024 * 1024) throw new Error('Мод больше 30 МБ');
        files.push(TEXT_EXT.has(path.extname(d.name).toLowerCase()) ? {path: rel, text: buf.toString('utf8')} : {path: rel, b64: buf.toString('base64')});
      }
    };
    try { walk(base); } catch (e) { return {error: e.message}; }
    return {files, bytes: total};
  });
  ipcMain.handle('mods:install', (_e, {folder, files, overwrite} = {}) => {
    if (!SAFE_FOLDER.test(String(folder))) return {error: 'Плохое имя папки мода: ' + folder};
    if (!Array.isArray(files) || !files.some(f => f && f.path === 'mod.json')) return {error: 'В моде нет mod.json'};
    const dest = path.join(MODS_DIR, folder);
    if (!inside(MODS_DIR, dest)) return {error: 'Плохой путь'};
    if (fs.existsSync(dest) && !overwrite) return {exists: true};
    // written into a temporary folder first, then swapped in: a broken bundle never leaves half a mod behind
    const tmp = path.join(MODS_DIR, '.install-' + folder + '-' + Date.now());
    try {
      for (const f of files) {
        const rel = String(f.path || '');
        const out = path.normalize(path.join(tmp, rel));
        if (!rel || rel.includes('\x00') || !inside(tmp, out)) throw new Error('Плохой путь файла: ' + rel);
        fs.mkdirSync(path.dirname(out), {recursive: true});
        fs.writeFileSync(out, typeof f.b64 === 'string' ? Buffer.from(f.b64, 'base64') : String(f.text ?? ''));
      }
      if (fs.existsSync(dest)) fs.rmSync(dest, {recursive: true, force: true});
      fs.renameSync(tmp, dest);
      return {ok: true};
    } catch (e) {
      try { fs.rmSync(tmp, {recursive: true, force: true}); } catch {}
      return {error: e.message};
    }
  });
  ipcMain.handle('packs:openFolder', () => shell.openPath(PACKS_DIR));
  ipcMain.handle('app:reload', () => win && win.reload());
  ipcMain.handle('app:devtools', () => win && win.webContents.toggleDevTools());
  ipcMain.handle('settings:get', () => readSettings());
  ipcMain.handle('autosave:write', (_e, data) => { try { return writeAutosave(data || {}); } catch (e) { return {error: e.message}; } });
  ipcMain.handle('autosave:read', () => readAutosave());
  ipcMain.handle('log:append', (_e, text) => { try { return appendLog(text); } catch (e) { return {error: e.message}; } });
  ipcMain.handle('log:openFolder', () => { fs.mkdirSync(logDir(), {recursive: true}); return shell.openPath(logDir()); });
  // test runs only: save a picture of the window (for visual checks)
  ipcMain.handle('debug:capture', async (_e, file) => { if (!SMOKE) return false; const img = await win.webContents.capturePage(); fs.writeFileSync(file, img.toPNG()); return file; });
  ipcMain.handle('selftest:mode', () => SELFTEST ? {mode: SELFTEST, filter: process.env.SSPACE_SELFTEST_FILTER || ''} : null);
  ipcMain.handle('selftest:done', (_e, rep) => {
    // print a short summary, save the whole report, exit with 0 / 1
    const out = process.env.SSPACE_REPORT || path.join(ROOT, 'selftest-report.json');
    try { fs.writeFileSync(out, JSON.stringify(rep, null, 2)); } catch (e) { console.log('[selftest] report not saved:', e.message); }
    console.log(`
[selftest] ${rep.ok ? 'OK' : 'FAIL'} — тестов ${rep.passed}/${rep.total}, ошибок ${rep.failed}, предупреждений ${rep.warnings}, ${(rep.ms / 1000).toFixed(1)} с`);
    for (const t of rep.tests) if (!t.ok || t.warnings.length) console.log(`  ${t.ok ? '!' : '✗'} ${t.id}: ${[...t.errors, ...t.warnings].slice(0, 4).join(' | ')}`);
    console.log('[selftest] отчёт: ' + out);
    setTimeout(() => app.exit(rep.ok ? 0 : 1), 200);
    return true;
  });
  // the page is closing: must finish before it goes
  ipcMain.on('autosave:writeSync', (e, data) => { try { e.returnValue = writeAutosave(data || {}); } catch (er) { e.returnValue = {error: er.message}; } });
  ipcMain.handle('settings:set', (_e, s) => { writeSettings(s || {}); return true; });

  createWindow();
});

app.on('window-all-closed', () => app.quit());
