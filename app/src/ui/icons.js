// Icons and themes.
// The interface asks for an icon by name (ss.ui.icon('dice')); the current theme decides what is drawn:
// the built-in set is line SVG, a theme may replace any icon, change all of them at once (iconTransform),
// or draw glyphs instead (e.g. emoji). Older content that still gives an emoji or a symbol is mapped to a name
// through ALIAS; anything unknown is drawn as a plain monochrome glyph.
//   ss.reg.themes.register({id, name, desc, swatches: [...], vars: {'--bg': '#…'}, css: '…', icons: {name: svg|glyph},
//     iconTransform(svg, name) → svg, emojiIcons: true, colorScheme: 'light' | 'dark', fx(ss, root) → cleanup})
//   ss.themes.apply(id) · ss.themes.current

const I = (body, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"${extra}>${body}</svg>`;
const dot = (x, y, r = 1.1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;

export const BASE_ICONS = {
  // interface
  dice: I('<rect x="4" y="4" width="16" height="16" rx="3"/>' + dot(8.5, 8.5) + dot(15.5, 15.5) + dot(15.5, 8.5) + dot(8.5, 15.5) + dot(12, 12)),
  sparkles: I('<path d="M11 3.5l1.7 5 5 1.7-5 1.7-1.7 5-1.7-5-5-1.7 5-1.7z"/><path d="M18.5 14.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'),
  orbit: I('<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(-20 12 12)"/>'),
  ring: I('<ellipse cx="12" cy="12" rx="9.5" ry="3.8"/><ellipse cx="12" cy="12" rx="6" ry="2"/>'),
  puzzle: I('<path d="M5 7h3.5a2 2 0 1 1 4 0H16v3.5a2 2 0 1 1 0 4V18h-3.5a2 2 0 1 0-4 0H5v-3.5a2 2 0 1 0 0-4z"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/><circle cx="12" cy="12" r="6.2"/>'),
  help: I('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.7.3-1.2.9-1.2 1.7v.4"/>' + dot(12, 17)),
  chart: I('<path d="M4 20h16M7 16v-4M11 16V8M15 16v-6M19 16V5"/>'),
  warning: I('<path d="M12 4l9 16H3z"/><path d="M12 10v4"/>' + dot(12, 17)),
  planet: I('<circle cx="12" cy="12" r="5.5"/><path d="M5.2 15.5C2.6 17.3 1.8 19 2.6 19.7c1.4 1.2 7-1.3 12.4-5.6s8.9-9 7.6-10.1c-.8-.7-2.6-.1-4.9 1.4"/>'),
  window: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/>'),
  disk: I('<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>'),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/>' + dot(12, 7.6)),
  box: I('<path d="M3 7.5l9-4 9 4-9 4zM3 7.5v9l9 4 9-4v-9M12 11.5v9"/>'),
  galaxy: I('<path d="M12 12c.8-1.6 3.2-1.6 3.6.4.6 2.6-2.8 4.4-5.4 3.2C6.6 14 7 8.6 11 7.4c5.2-1.6 9.4 3 7.4 7.8M12 12c-.8 1.6-3.2 1.6-3.6-.4M3.2 9.8C5 4.6 11.4 2.8 15.6 5.4"/>'),
  brush: I('<path d="M14.5 4.5l5 5-8 8-5-5z"/><path d="M6.5 12.5c-2 .5-3 2.5-3 4.5 0 1.5-.5 2.5-1 3 3.5 0 7-1 7.5-4.5"/>'),
  list: I('<path d="M9 6h11M9 12h11M9 18h11"/>' + dot(4.5, 6) + dot(4.5, 12) + dot(4.5, 18)),
  timer: I('<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2.5M9.5 2.5h5"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  target: I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>' + dot(12, 12, 1.4)),
  up: I('<path d="M12 20V8.5M7 13.5l5-5 5 5M5 4h14"/>'),
  close: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  share: I('<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.3 10.8l7.4-3.6M8.3 13.2l7.4 3.6"/>'),
  folder: I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  search: I('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20.5 20.5"/>'),
  flag: I('<path d="M6 21V4"/><path d="M6 4.5h11l-2.5 4 2.5 4H6"/>'),
  // worlds
  globe: I('<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3.5 9h17M3.5 15h17"/>'),
  ocean: I('<circle cx="12" cy="12" r="9"/><path d="M4.5 12.5c1.7 1.3 3.2 1.3 5 0s3.3-1.3 5 0 3.3 1.3 5 0M6 16.5c1.3 1 2.7 1 4 0s2.7-1 4 0 2.7 1 4 0"/>'),
  moon: I('<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.4 6.4 0 0 0 10 10z"/>' + dot(9, 12, 1) + dot(12.5, 16.5, 0.8)),
  waves: I('<path d="M3 8.5c2.5 2 4.5 2 7 0s4.5-2 7 0 3 2 4 1.5M3 14c2.5 2 4.5 2 7 0s4.5-2 7 0 3 2 4 1.5M3 19.5c2.5 2 4.5 2 7 0s4.5-2 7 0"/>'),
  halo: I('<ellipse cx="12" cy="5.5" rx="6" ry="2"/><path d="M12 9.5l1.6 4.4 4.4 1.6-4.4 1.6L12 21.5l-1.6-4.4L6 15.5l4.4-1.6z"/>'),
  nanite: I('<path d="M12 3.5l3.5 2v4l-3.5 2-3.5-2v-4zM6 13.5l3.5 2v4L6 21.5l-3.5-2v-4zM18 13.5l3.5 2v4l-3.5 2-3.5-2v-4z"/><path d="M12 11.5v2.5M9.5 15.5L12 14l2.5 1.5"/>' + dot(12, 14, 1.2)),
  machine: I('<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/><path d="M10 7h4M7 10v4M17 10v4M10 17h4"/>'),
  snowflake: I('<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.6 4.6L12 6.2l2.4-1.6M9.6 19.4L12 17.8l2.4 1.6M4.7 11l2.4.8-.6 2.6M19.3 13l-2.4-.8.6-2.6"/>'),
  flame: I('<path d="M12 21c-3.9 0-6.5-2.7-6.5-6.2 0-4.3 4-5.9 4.8-10.3 3.6 2.3 8.2 5.9 8.2 10.3 0 3.5-2.6 6.2-6.5 6.2z"/><path d="M12 21c-1.7 0-3-1.2-3-2.9 0-2 2-3 3-4.9 1 1.9 3 2.9 3 4.9 0 1.7-1.3 2.9-3 2.9z"/>'),
  radiation: I('<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4L8.3 4a9 9 0 0 1 7.4 0zM13.4 12.8l7.4.1a9 9 0 0 1-3.7 6.4zM10.6 12.8l-3.7 6.5A9 9 0 0 1 3.2 12.9z"/>'),
  blast: I('<path d="M12 2.5l1.8 5.6 5.3-2.6-2.6 5.3 5.6 1.8-5.6 1.8 2.6 5.3-5.3-2.6L12 21.5l-1.8-5.6-5.3 2.6 2.6-5.3L1.9 12l5.6-1.8-2.6-5.3 5.3 2.6z"/>'),
  ghost: I('<path d="M5.5 20.5V11a6.5 6.5 0 0 1 13 0v9.5l-2.2-1.7-2.2 1.7-2.1-1.7-2.1 1.7-2.2-1.7z"/>' + dot(9.8, 11) + dot(14.2, 11)),
  swarm: I(dot(6, 6, 1.2) + dot(12, 5, 1) + dot(18, 7, 1.2) + dot(8, 11, 1) + dot(14, 10, 1.3) + dot(19, 13, 1) + dot(5, 16, 1.1) + dot(11, 16, 1.3) + dot(17, 18, 1.1) + dot(13, 20.5, .9)),
  leaf: I('<path d="M5 19C5 10.5 10 4.5 20 4.5c0 10-6 14.5-15 14.5z"/><path d="M5 19l8.5-8.5"/>'),
  crack: I('<circle cx="12" cy="12" r="9"/><path d="M12 3l-1.8 5.5 3.6 2.6-2.8 3.6 2 6.3M10.2 8.5L6 9.5M13 14.5l4.5 1"/>'),
  rocket: I('<path d="M12 2.8c3 2 5 6 5 10.2l-2.2 3H9.2L7 13c0-4.2 2-8.2 5-10.2z"/><path d="M9.2 16l-2.4 4.2 3.3-1.2M14.8 16l2.4 4.2-3.3-1.2"/><circle cx="12" cy="9.5" r="1.6"/>'),
  station: I('<circle cx="12" cy="12" r="3"/><path d="M2.5 12H9M15 12h6.5M12 2.5V9M12 15v6.5"/><rect x="2.5" y="9.5" width="3" height="5" rx=".5"/><rect x="18.5" y="9.5" width="3" height="5" rx=".5"/>'),
  burb: I('<circle cx="12" cy="12" r="9"/><circle cx="14" cy="10" r="3.3"/><path d="M3 12h4.5M16 17.5l3.5 1.8M12 3v4M7.5 4.3l1.5 3"/>'),
  houses: I('<path d="M3 20.5V11l5-4 5 4v9.5M13 20.5v-7l4-3 4 3v7M2 20.5h20M6.6 20.5v-4h2.8v4"/>'),
  crown: I('<path d="M4 18h16l-1.3-10-4.2 4.2L12 6l-2.5 6.2L5.3 8z"/>'),
  tower: I('<path d="M8 21V9h8v12M7 9h10M8 9V5h2v2h1.5V5h1V7H14V5h2v4M5 21h14"/>'),
  // weather and effects
  cloud: I('<path d="M7 18.5h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.6 1.5A3.4 3.4 0 0 0 7 18.5z"/>'),
  rain: I('<path d="M7 14.5h10a3.4 3.4 0 0 0 .3-6.8 5.2 5.2 0 0 0-10 1.3A2.8 2.8 0 0 0 7 14.5z"/><path d="M8.5 17.5l-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5"/>'),
  flower: I('<circle cx="12" cy="12" r="2"/><circle cx="12" cy="6.5" r="2.6"/><circle cx="17.2" cy="10.3" r="2.6"/><circle cx="15.2" cy="16.5" r="2.6"/><circle cx="8.8" cy="16.5" r="2.6"/><circle cx="6.8" cy="10.3" r="2.6"/>'),
  meteor: I('<circle cx="15.5" cy="8.5" r="4"/><path d="M12.6 11.4L3.5 20.5M9.5 7.5l-5 5M16.5 14.5l-5 5"/>'),
  stardust: I('<path d="M7 4l.9 2.6L10.5 7.5l-2.6.9L7 11l-.9-2.6L3.5 7.5l2.6-.9zM16.5 9l1.1 3.2 3.2 1.1-3.2 1.1-1.1 3.2-1.1-3.2-3.2-1.1 3.2-1.1z"/>' + dot(8, 17, 1) + dot(19, 5, .9)),
  wind: I('<path d="M3 8.5h11.5a2.8 2.8 0 1 0-2.8-2.8M3 12.5h15.5a2.8 2.8 0 1 1-2.8 2.8M3 16.5h7.5"/>'),
  ash: I('<circle cx="12" cy="12" r="7.5" stroke-dasharray="2.4 3"/>' + dot(12, 12, 1.4) + dot(8.5, 9.5, .9) + dot(15.5, 14.5, .9)),
  spark: I('<path d="M12 3.5l1.6 6.9 6.9 1.6-6.9 1.6-1.6 6.9-1.6-6.9L3.5 12l6.9-1.6z"/>'),
  wisp: I('<path d="M12 21c-3.2 0-5.3-2.2-5.3-5.2 0-4.2 5.3-5.3 5.3-11.3 0 0 5.3 4.2 5.3 10.5 0 3.7-2.1 6-5.3 6z"/>' + dot(12, 15.5, 1.4)),
  diamond: I('<path d="M12 3l7.5 9L12 21l-7.5-9z"/><path d="M4.5 12h15"/>'),
  dots: I(dot(6, 8, 1.3) + dot(11, 5.5, 1) + dot(16, 9, 1.4) + dot(9, 13, 1.1) + dot(15, 15, 1.2) + dot(6, 17.5, 1) + dot(19, 18, 1.1) + dot(12, 19.5, .9)),
  // orbit
  arrow: I('<path d="M3.5 12L20.5 5l-5 7 5 7z"/>'),
  satellite: I('<rect x="9.5" y="9.5" width="5" height="5" rx="1" transform="rotate(45 12 12)"/><path d="M3 9l4.5-4.5 3 3L6 12zM21 15l-4.5 4.5-3-3L18 12z"/>'),
  shard: I('<path d="M7 3.5l10.5 4-2.3 12.8-8.7-4.8z"/><path d="M7 3.5l3 8.5 5.2 8.3"/>'),
  wheel: I('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M12 3.5V10M12 14v6.5M3.5 12H10M14 12h6.5"/>'),
  cylinder: I('<ellipse cx="12" cy="6" rx="6" ry="2.6"/><path d="M6 6v12c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6V6M9 9.6v8M15 9.6v8"/>'),
  modules: I('<path d="M2 12h20"/><rect x="6" y="8.5" width="4.5" height="7" rx="1"/><rect x="13.5" y="8.5" width="4.5" height="7" rx="1"/><path d="M3.5 5v14M20.5 5v14"/>'),
  citadel: I('<circle cx="12" cy="12" r="8"/><path d="M4.3 10h15.4M4.3 14h15.4M12 2v2M12 20v2M2 12h2M20 12h2"/>'),
  grid: I('<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M9 6v12M15 6v12M3 12h18"/>'),
  dock: I('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.2"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3"/>'),
  panels: I('<rect x="3" y="6.5" width="7.5" height="11" rx="1"/><rect x="13.5" y="6.5" width="7.5" height="11" rx="1"/><path d="M6.7 6.5v11M17.3 6.5v11M10.5 12h3"/>'),
  beacon: I('<path d="M12 10v11M8.5 21h7"/><circle cx="12" cy="7.5" r="2.5"/><path d="M6.5 3.5a7 7 0 0 0 0 8M17.5 3.5a7 7 0 0 1 0 8"/>'),
  elevator: I('<path d="M12 2.5v19M8.5 5h7M8.5 19h7"/><rect x="9.5" y="10" width="5" height="4" rx="1"/>'),
  energy: I('<ellipse cx="12" cy="12" rx="9.5" ry="4"/><path d="M13 6.5l-2.5 5h3L11 17.5"/>'),
  scrap: I('<path d="M3.5 8l5-3 3 4-4 3zM13 13.5l6-2 1.2 5-5.2 2zM9.5 16l2 4M15 4.5l3 1.5-1.5 2.5"/>'),
  anchor: I('<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 10h8M4.5 13.5c0 4.2 3.3 7.5 7.5 7.5s7.5-3.3 7.5-7.5"/>'),
  mine: I('<circle cx="12" cy="12" r="5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.2 2.2M16.2 16.2l2.2 2.2M5.6 18.4l2.2-2.2M16.2 7.8l2.2-2.2"/>'),
  shield: I('<path d="M12 3l8 3v6c0 5-3.5 8.2-8 9-4.5-.8-8-4-8-9V6z"/>'),
  network: I('<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="12" cy="10" r="1.5"/><path d="M7 6h10M6 7.7l5 9M18 7.7l-5 9M6.6 7.2l4.2 2M17.4 7.2l-4.2 2M12 11.5v4.5"/>'),
};

// glyphs used by older content (and by other mods) → icon names
export const ALIAS = {
  '🎲': 'dice', '✦': 'sparkles', '◎': 'orbit', '◯': 'ring', '🧩': 'puzzle', '⚙': 'gear', '?': 'help', '📈': 'chart', '⚠': 'warning',
  '🪐': 'planet', '🪟': 'window', '💾': 'disk', 'ℹ': 'info', '📦': 'box', '🌌': 'galaxy', '🖌': 'brush', '≡': 'list', '⏱': 'timer', '✓': 'check',
  '🌍': 'globe', '☾': 'moon', '🌊': 'waves', '✧': 'nanite', '⌬': 'machine', '❄': 'snowflake', '🔥': 'flame', '☢': 'radiation', '✸': 'blast', '💥': 'crack',
  '◐': 'ghost', '⁘': 'swarm', '🌴': 'leaf', '🚀': 'rocket', '⊕': 'station', '◉': 'burb', '🏘': 'houses', '♛': 'crown', '🌀': 'blast',
  '☁': 'cloud', '☂': 'rain', '✿': 'flower', '☄': 'meteor', '≈': 'wind', '≋': 'wind', '◌': 'ash', '✶': 'spark', '✺': 'wisp', '⋄': 'diamond', '〰': 'waves', '·': 'dots',
  '∴': 'dots', '➤': 'arrow', '⊛': 'station', '◆': 'shard', '⎔': 'wheel', '▭': 'cylinder', '⊞': 'modules', '◍': 'citadel', '⌗': 'grid', '⊚': 'dock',
  '▦': 'panels', '✳': 'beacon', '⇡': 'elevator', '⦿': 'energy', '◇': 'diamond', '⧈': 'scrap', '⚓': 'anchor', '⛨': 'shield', '⋰': 'network', '●': 'moon',
};

export function createThemes(ss) {
  let cur = null, fxCleanup = null;
  const styleEl = document.createElement('style'); styleEl.id = 'theme-css'; document.head.appendChild(styleEl);
  const setVars = new Set();

  const nameOf = (v) => (v == null ? '' : ALIAS[v] || String(v));
  function render(el, value) {
    const name = nameOf(value), th = cur || {};
    let out = th.icons && th.icons[name] !== undefined ? th.icons[name] : BASE_ICONS[name];
    el.className = 'ico'; el.innerHTML = '';
    if (typeof out === 'string' && out.startsWith('<svg')) {
      if (th.iconTransform) { try { out = th.iconTransform(out, name) || out; } catch {} }
      el.innerHTML = out; el.classList.add('svg');
    } else {
      // no svg: a glyph (the theme's, or the original value when the name is unknown)
      el.textContent = out != null ? out : String(value ?? '');
      el.classList.add(th.emojiIcons ? 'emoji' : 'glyph');
    }
    el.dataset.ico = value == null ? '' : String(value);
    return el;
  }
  // how an icon looks in a given theme (for previews in the theme picker)
  function preview(th, name) {
    const el = document.createElement('span'), was = cur; cur = th; try { render(el, name); } finally { cur = was; }
    el.dataset.preview = '1'; // keeps its own theme when the current one changes
    return el;
  }
  const icon = (value, cls = '') => { const el = render(document.createElement('span'), value); if (cls) el.classList.add(...cls.split(' ')); return el; };
  const refresh = () => { for (const el of document.querySelectorAll('.ico[data-ico]:not([data-preview])')) { const extra = [...el.classList].filter(c => !['ico', 'svg', 'glyph', 'emoji'].includes(c)); render(el, el.dataset.ico); if (extra.length) el.classList.add(...extra); } };

  // «Анимации темы» off: one class on <html> stops every theme animation (and the theme's fx can check ss.prefs.themeAnim)
  const syncAnim = () => document.documentElement.classList.toggle('theme-still', ss.prefs.themeAnim === false);
  ss.hooks.on('prefs:changed', ({key}) => { if (key === 'themeAnim') { syncAnim(); if (cur) apply(cur.id); } });
  function apply(id) {
    syncAnim();
    const th = ss.reg.themes.get(id) || ss.reg.themes.get('base');
    if (!th) return;
    if (fxCleanup) { try { fxCleanup(); } catch {} fxCleanup = null; }
    const root = document.documentElement;
    for (const k of setVars) root.style.removeProperty(k); setVars.clear();
    for (const [k, v] of Object.entries(th.vars || {})) { root.style.setProperty(k, v); setVars.add(k); }
    root.style.colorScheme = th.colorScheme || 'dark';
    root.dataset.theme = th.id;
    styleEl.textContent = th.css || '';
    cur = th;
    refresh();
    if (typeof th.fx === 'function') { try { fxCleanup = th.fx(ss, root) || null; } catch (e) { console.error('[theme ' + th.id + ']', e); } }
    if (ss.prefs.theme !== th.id) ss.setPref('theme', th.id);
    ss.hooks.emit('theme:changed', {id: th.id});
    if (ss.log) ss.log.info('theme', 'Тема: ' + th.name);
  }
  // the built-in look: the dark editor with line icons
  ss.reg.themes.register({id: 'base', name: 'Космос', desc: 'Тёмный редактор с оранжевым акцентом и линейными значками — как было.', swatches: ['#05070c', '#161b27', '#ff5a3c', '#e6e9f2']});
  ss.hooks.on('registry:themes', ({id}) => { if (cur && cur.id === id) apply(id); });
  return {apply, icon, render, refresh, nameOf, preview, get current() { return cur; }};
}
