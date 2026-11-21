import * as THREE from './lib/three.js';
import {createSS} from './sspace.js';

const ss = createSS(THREE);
window.ss = ss; // handy in DevTools (F12) and for quick experiments
ss.boot().catch((e) => {
  console.error(e);
  window.sspaceSplash && window.sspaceSplash.fail((e && e.message) || String(e));
  const el = document.getElementById('bootError');
  if (el) { el.hidden = false; el.textContent = 'Не удалось запустить SSpace: ' + (e && e.message || e); }
});
