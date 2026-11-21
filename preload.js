'use strict';
// Exposes a small, explicit host API to the editor. Mods reach it through ss.host.
const {contextBridge, ipcRenderer} = require('electron');
const inv = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('sspaceHost', {
  desktop: true,
  listMods: inv('mods:list'),
  listPacks: inv('packs:list'),
  openFile: inv('file:open'),
  saveFile: inv('file:save'),
  saveBinary: inv('file:saveBinary'),
  openModsFolder: inv('mods:openFolder'),
  readModFiles: inv('mods:readFiles'),
  installMod: inv('mods:install'),
  openPacksFolder: inv('packs:openFolder'),
  reload: inv('app:reload'),
  toggleDevTools: inv('app:devtools'),
  getSettings: inv('settings:get'),
  setSettings: inv('settings:set'),
  writeAutosave: inv('autosave:write'),
  readAutosave: inv('autosave:read'),
  writeAutosaveSync: (data) => ipcRenderer.sendSync('autosave:writeSync', data),
  appendLog: inv('log:append'),
  openLogFolder: inv('log:openFolder'),
  selftestMode: inv('selftest:mode'),
  captureTo: inv('debug:capture'),
  selftestDone: inv('selftest:done'),
});
