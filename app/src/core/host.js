// Host bridge. In the desktop app it is window.sspaceHost from preload.js.
// In a plain browser (for quick testing) a fallback keeps the editor usable.
const projectRoot = new URL('../../../', import.meta.url);

function downloadBlob(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

async function fetchJson(rel) {
  try { const r = await fetch(new URL(rel, projectRoot)); return r.ok ? await r.json() : null; } catch { return null; }
}

const browserHost = {
  desktop: false,
  async listMods() {
    const ids = await fetchJson('mods/index.json');
    if (!Array.isArray(ids)) return [];
    const out = [];
    for (const folder of ids) {
      const m = await fetchJson(`mods/${folder}/mod.json`);
      out.push(m ? {...m, id: m.id || folder, folder} : {id: folder, folder, error: 'Нет mod.json'});
    }
    return out;
  },
  async listPacks() { const l = await fetchJson('packs/index.json'); return Array.isArray(l) ? l.map(f => 'packs/' + f) : []; },
  openFile() {
    return new Promise((resolve) => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.sspace,.json';
      inp.onchange = () => {
        const f = inp.files[0]; if (!f) return resolve(null);
        const r = new FileReader(); r.onload = () => resolve({path: null, name: f.name, text: r.result}); r.readAsText(f);
      };
      inp.click();
    });
  },
  async saveFile({text, defaultName}) { downloadBlob(defaultName || 'planet.sspace', new Blob([text], {type: 'application/json'})); return null; },
  async saveBinary({dataUrl, defaultName}) { const b = await (await fetch(dataUrl)).blob(); downloadBlob(defaultName || 'image.png', b); return null; },
  async openModsFolder() { return false; },
  async openPacksFolder() { return false; },
  async reload() { location.reload(); },
  async toggleDevTools() {},
  async getSettings() { try { return JSON.parse(localStorage.getItem('sspace.settings') || '{}'); } catch { return {}; } },
  async setSettings(s) { try { localStorage.setItem('sspace.settings', JSON.stringify(s)); } catch {} return true; },
  // the browser version keeps the autosave in localStorage (a few MB at most)
  async writeAutosave({text, filePath}) { try { localStorage.setItem('sspace.campaign.v1', text); localStorage.setItem('sspace.campaign.v1.path', filePath || ''); return true; } catch (e) { return {error: e.message}; } },
  async readAutosave() { const text = localStorage.getItem('sspace.campaign.v1'); return text ? {text, filePath: localStorage.getItem('sspace.campaign.v1.path') || ''} : null; },
  writeAutosaveSync(data) { return this.writeAutosave(data) && true; },
};

export const host = window.sspaceHost || browserHost;
export const PROJECT_ROOT = projectRoot;
export const APP_ROOT = new URL('../../', import.meta.url);
