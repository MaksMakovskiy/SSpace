// Themes: colours, fonts, icons and little touches of the interface. Pick one in «Настройки → Тема».
//   Светлая · Полночь · Ангелы · Машины · Эмодзи   (the built-in «Космос» stays the default)
export async function activate(ss, mod) {
  const T = ss.reg.themes;
  // the two big themes keep their styles in files next to this one
  const load = async (f) => { try { const r = await fetch(new URL(f, mod.baseUrl)); return r.ok ? await r.text() : ''; } catch { return ''; } };
  const [ANGELS_CSS, MACHINES_CSS, VOID_CSS, SWARM_CSS] = await Promise.all([load('angels.css'), load('machines.css'), load('angels-void.css'), load('swarm.css')]);
  const anim = () => ss.prefs.themeAnim !== false;
  // ---------- cursors: every themed theme has its own set, different in shape, not just in colour ----------
  //   arrow · hand (things you click) · cross (aiming in the 3D view) · grab / grabbing (rotate tool «R», dragging the
  //   view) · text · move (window headers) · no (disabled)
  const curUrl = (svg, x, y, fb) => `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${x} ${y}, ${fb}`;
  const cursorCss = (c) => {
    const h = c.hot || {};
    const at = (k, fb, dx, dy) => curUrl(c[k], ...(h[k] || [dx, dy]), fb);
    return `
    body { cursor: ${at('arrow', 'auto', 3, 3)}; }
    button, summary, .check, label.check, input[type=checkbox], input.color, select, .route-row, .tree-row, .pal-row, .chip, .genx-card, .theme-card,
    .bigd-tab, .genx-chip, .menu-title, .menu-item, .ctx-item, .poi-row, .orbit-row, .switch, .crumb, input[type=range], a, .bar-btn, .st-log, .fx-off { cursor: ${at('hand', 'pointer', 3, 3)}; }
    button:disabled, .menu-item.disabled, [aria-disabled=true] { cursor: ${at('no', 'not-allowed', 3, 3)}; }
    #view { cursor: ${at('cross', 'crosshair', 16, 16)}; }
    #view.mode-rotate { cursor: ${at('grab', 'grab', 16, 16)}; }
    #view.rotating, #view.mode-rotate.rotating { cursor: ${at('grabbing', 'grabbing', 16, 16)}; }
    #view.over-sky { cursor: ${at('hand', 'pointer', 3, 3)}; }
    .field, textarea, input[type=text], input[type=search], input[type=number], [contenteditable=true] { cursor: ${at('text', 'text', 16, 16)}; }
    .win-head, .bigd-head .drag { cursor: ${at('move', 'move', 16, 16)}; }
    .win-head button { cursor: ${at('hand', 'pointer', 3, 3)}; }`;
  };
  const SVG = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${body}</svg>`;
  const CURSORS = {
    // ---- Ангелы: a slim silver dart trailed by nanites; hexagons; a cloud of nanites that gathers when you grab ----
    angels: (() => {
      const G = '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#c3ccd8"/><stop offset="1" stop-color="#6f7b90"/></linearGradient></defs>';
      const dart = '<path d="M2 2L23 10.5L13.6 13.6L10.5 23Z" fill="url(#g)" stroke="#1c2028" stroke-width="1" stroke-linejoin="round"/><path d="M2 2L13.6 13.6" stroke="#ffffff" stroke-width=".8" opacity=".9"/>';
      const trail = '<circle cx="17" cy="17" r="1.5" fill="#c3ccd8" stroke="#1c2028" stroke-width=".5"/><circle cx="21" cy="21" r="1.2" fill="#c3ccd8" stroke="#1c2028" stroke-width=".5"/><circle cx="24.6" cy="24.6" r="1" fill="#ff1f4a"/>';
      const hex = (cx, cy, r) => 'M' + [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 3 * i - Math.PI / 6; return (cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2); }).join('L') + 'Z';
      const cloud = (r, red) => [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 3 * i; return `<circle cx="${(16 + r * Math.cos(a)).toFixed(2)}" cy="${(16 + r * Math.sin(a)).toFixed(2)}" r="2.2" fill="url(#g)" stroke="#1c2028" stroke-width=".7"/>`; }).join('') + `<circle cx="16" cy="16" r="${red ? 3 : 1.6}" fill="${red ? '#ff1f4a' : '#c3ccd8'}" stroke="#1c2028" stroke-width=".7"/>`;
      return {
        arrow: SVG(G + dart + trail),
        hand: SVG(G + dart + `<path d="${hex(4.5, 4.5, 4.4)}" fill="none" stroke="#ff1f4a" stroke-width="1.4"/>` + trail),
        cross: SVG(G + `<path d="${hex(16, 16, 10)}" fill="none" stroke="#e6ecf4" stroke-width="1.6" stroke-dasharray="3.5 2"/><path d="${hex(16, 16, 10)}" fill="none" stroke="#1c2028" stroke-width=".5"/><path d="M16 2v5M16 25v5M2 16h5M25 16h5" stroke="#e6ecf4" stroke-width="1.3"/><path d="${hex(16, 16, 2.2)}" fill="#ff1f4a"/>`),
        grab: SVG(G + cloud(9, false)),
        grabbing: SVG(G + cloud(5, true)),
        text: SVG(G + '<path d="M16 6v20M12 6h8M12 26h8" stroke="#1c2028" stroke-width="3" stroke-linecap="round"/><path d="M16 6v20M12 6h8M12 26h8" stroke="#e6ecf4" stroke-width="1.4" stroke-linecap="round"/><circle cx="16" cy="16" r="1.4" fill="#ff1f4a"/>'),
        move: SVG(G + [0, 90, 180, 270].map(r => `<path transform="rotate(${r} 16 16)" d="M16 2L20.5 8.5H11.5Z" fill="url(#g)" stroke="#1c2028" stroke-width=".8"/>`).join('') + `<path d="${hex(16, 16, 3.4)}" fill="none" stroke="#ff1f4a" stroke-width="1.3"/>`),
        no: SVG(G + dart + '<circle cx="22" cy="22" r="6" fill="#f4f6f9" stroke="#ff1f4a" stroke-width="1.8"/><path d="M17.8 26.2L26.2 17.8" stroke="#ff1f4a" stroke-width="1.8"/>'),
        hot: {arrow: [2, 2], hand: [2, 2], no: [2, 2]},
      };
    })(),
    // ---- Ангелы: Сбой: a black shard broken in two with a cyan ghost; torn rings; shards that fly apart and snap together ----
    'angels-void': (() => {
      const R = '#ff1f3d', C = '#19d6ff';
      const ghost = `<path d="M2 2L2 24L19 17Z" transform="translate(-1.4 .6)" fill="none" stroke="${C}" stroke-opacity=".6" stroke-width="1"/>`;
      const shard = `<path d="M2 2L12 10.8L7 12L5 10L2 12Z" fill="#0a0708" stroke="${R}" stroke-width="1.3" stroke-linejoin="round"/><path d="M2 12L5 10L7 12L12 10.8L19 17L2 24Z" transform="translate(1.6 1.8)" fill="#0a0708" stroke="${R}" stroke-width="1.3" stroke-linejoin="round"/><rect x="21.5" y="21" width="2" height="2" fill="${R}"/><rect x="25" y="23.5" width="1.5" height="1.5" fill="${R}" opacity=".7"/><rect x="19" y="25" width="1.5" height="1.5" fill="${C}" opacity=".7"/>`;
      const four = (d, fill) => [45, 135, 225, 315].map(r => `<path transform="rotate(${r} 16 16)" d="M16 ${16 - d}l-3.2 -6.5h6.4Z" fill="${fill}" stroke="${R}" stroke-width="1.2" stroke-linejoin="round"/>`).join('');
      return {
        arrow: SVG(ghost + shard),
        hand: SVG(ghost + shard + `<path d="M-0.5 6V-0.5H6M10 -0.5" fill="none" stroke="${R}" stroke-width="1.6"/><path d="M9 1h3" stroke="${C}" stroke-width="1"/>`),
        cross: SVG(`<path d="M16 6a10 10 0 0 1 9.2 6M26 17a10 10 0 0 1-6 8.6M14 26a10 10 0 0 1-7.6-5M6 15a10 10 0 0 1 6-8.2" fill="none" stroke="${R}" stroke-width="1.7"/><path d="M16 1v6M16 25v6M1 16h6M25 16h6" stroke="${R}" stroke-width="1.2"/><rect x="14.5" y="14.5" width="3" height="3" fill="${R}"/><path d="M18 3h3M4 22v3" stroke="${C}" stroke-width="1"/>`),
        grab: SVG(four(5, '#0a0708') + `<rect x="15" y="15" width="2" height="2" fill="${C}"/>`),
        grabbing: SVG(four(-1.5, '#2a060c') + `<rect x="14" y="14" width="4" height="4" fill="${R}"/>`),
        text: SVG(`<path d="M15 6v20M11 6h8M11 26h8" stroke="${C}" stroke-opacity=".6" stroke-width="1.3"/><path d="M16.5 6v9M16.5 17v9M12.5 6h8M12.5 26h8" stroke="${R}" stroke-width="1.8"/>`),
        move: SVG([0, 90, 180, 270].map(r => `<path transform="rotate(${r} 16 16)" d="M16 2L20 8H17.5V12H14.5V8H12Z" fill="#0a0708" stroke="${R}" stroke-width="1.1"/>`).join('') + `<rect x="14" y="14" width="4" height="4" fill="none" stroke="${C}" stroke-width="1"/>`),
        no: SVG(ghost + shard.replace(/#0a0708/g, '#1a0508') + `<path d="M17 17l10 10M27 17l-10 10" stroke="${R}" stroke-width="2.2"/>`),
        hot: {arrow: [2, 2], hand: [2, 2], no: [2, 2]},
      };
    })(),
    // ---- Машины: an amber targeting corner with a pointer stub; lock-on brackets that close in when you grab ----
    machines: (() => {
      const A = '#ffb000', K = '#0b0b0a';
      const corner = `<path d="M2 15V2H15" fill="none" stroke="${K}" stroke-width="5"/><path d="M2 15V2H15" fill="none" stroke="${A}" stroke-width="2.6"/><path d="M5 5L17 17" stroke="${K}" stroke-width="4.4"/><path d="M5 5L17 17" stroke="${A}" stroke-width="2"/><rect x="15.5" y="15.5" width="5" height="5" fill="${K}" stroke="${A}" stroke-width="1.4"/>`;
      const brackets = (o, fill) => `<path d="M${o} ${o + 6}V${o}H${o + 6}M${32 - o - 6} ${o}H${32 - o}V${o + 6}M${32 - o} ${32 - o - 6}V${32 - o}H${32 - o - 6}M${o + 6} ${32 - o}H${o}V${32 - o - 6}" fill="none" stroke="${K}" stroke-width="4"/><path d="M${o} ${o + 6}V${o}H${o + 6}M${32 - o - 6} ${o}H${32 - o}V${o + 6}M${32 - o} ${32 - o - 6}V${32 - o}H${32 - o - 6}M${o + 6} ${32 - o}H${o}V${32 - o - 6}" fill="none" stroke="${A}" stroke-width="2"/>` + (fill ? `<rect x="13" y="13" width="6" height="6" fill="${A}"/>` : `<rect x="14.5" y="14.5" width="3" height="3" fill="none" stroke="${A}" stroke-width="1.2"/>`);
      return {
        arrow: SVG(corner),
        hand: SVG(corner + `<path d="M23 23h7M23 26.5h5M23 30h7" stroke="${A}" stroke-width="1.6"/><rect x="17" y="17" width="2" height="2" fill="${A}"/>`),
        cross: SVG(`<path d="M5 10V5h5M22 5h5v5M27 22v5h-5M10 27H5v-5" fill="none" stroke="${A}" stroke-width="1.8"/><path d="M16 9v5M16 18v5M9 16h5M18 16h5" stroke="${A}" stroke-width="1.4"/><circle cx="16" cy="16" r="1.2" fill="${A}"/>`),
        grab: SVG(brackets(3, false)),
        grabbing: SVG(brackets(8, true)),
        text: SVG(`<rect x="12" y="7" width="8" height="16" fill="${K}" stroke="${A}" stroke-width="1.6"/><path d="M10 26h12" stroke="${A}" stroke-width="2"/>`),
        move: SVG(`<path d="M16 2l4 5h-8zM16 30l4-5h-8zM2 16l5-4v8zM30 16l-5-4v8z" fill="${A}" stroke="${K}" stroke-width=".8"/><path d="M16 7v18M7 16h18" stroke="${A}" stroke-width="1.4"/><rect x="13" y="13" width="6" height="6" fill="${K}" stroke="${A}" stroke-width="1.4"/>`),
        no: SVG(corner + `<rect x="19" y="19" width="11" height="11" fill="${K}" stroke="#ff5a3a" stroke-width="1.6"/><path d="M21.5 21.5l6 6M27.5 21.5l-6 6" stroke="#ff5a3a" stroke-width="1.6"/>`),
        hot: {arrow: [2, 2], hand: [2, 2], no: [2, 2]},
      };
    })(),
    // ---- Рой: a beetle crawling head-first to where you point; mandibles that open to grab and bite down when dragging ----
    swarm: (() => {
      const D = '#1d1610', B = '#8a6a40', L = '#a8c45a', Y = '#c9973e';
      const beetle = (open, glow) => `<defs><linearGradient id="c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${glow ? '#d9a94c' : '#9a7848'}"/><stop offset="1" stop-color="#3a2a18"/></linearGradient></defs>
        <g transform="rotate(-45 16 16)">
          <path d="M10.5 15L5.5 12.5M10 19.5L4.5 19.5M10.5 24L6 27.5M21.5 15L26.5 12.5M22 19.5L27.5 19.5M21.5 24L26 27.5" stroke="${D}" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M14.6 6.2C13 3.8 11.2 3 9.6 3.4M17.4 6.2C19 3.8 20.8 3 22.4 3.4" fill="none" stroke="${D}" stroke-width="1"/>
          ${open ? `<path d="M14.5 4.5L12 .8M17.5 4.5L20 .8" stroke="${D}" stroke-width="1.8" stroke-linecap="round"/>` : `<path d="M14.8 4.2L15.6 .8M17.2 4.2L16.4 .8" stroke="${D}" stroke-width="1.8" stroke-linecap="round"/>`}
          <ellipse cx="16" cy="6.8" rx="3" ry="2.6" fill="url(#c)" stroke="${D}" stroke-width="1"/>
          <path d="M16 9.6C21 9.6 22.6 14 22.6 19.5C22.6 26 19 30 16 30C13 30 9.4 26 9.4 19.5C9.4 14 11 9.6 16 9.6Z" fill="url(#c)" stroke="${D}" stroke-width="1.1"/>
          <path d="M16 12.4V29.4M10.6 13.4H21.4" stroke="${D}" stroke-width=".9"/>
          <circle cx="13" cy="18" r="1" fill="${glow ? L : Y}"/><circle cx="19" cy="18" r="1" fill="${glow ? L : Y}"/>
        </g>`;
      const pincers = (open) => `<g stroke="${D}" stroke-width="1.1" fill="${B}">${open
        ? '<path d="M14 24C6 22 4 13 9 6C9.6 10 11.5 14 15 16.5Z"/><path d="M18 24C26 22 28 13 23 6C22.4 10 20.5 14 17 16.5Z"/>'
        : '<path d="M14.5 25C9 22.5 9.5 13 15.6 9C14.4 13 14.2 17 15.6 20.5Z"/><path d="M17.5 25C23 22.5 22.5 13 16.4 9C17.6 13 17.8 17 16.4 20.5Z"/>'}</g><circle cx="16" cy="26" r="3" fill="${D}"/><circle cx="16" cy="${open ? 15 : 12}" r="1.6" fill="${L}"/>`;
      return {
        arrow: SVG(beetle(false, false)),
        hand: SVG(beetle(true, true)),
        cross: SVG(`<ellipse cx="16" cy="16" rx="6" ry="7.5" fill="none" stroke="${Y}" stroke-width="1.6"/><path d="M10.5 12L4 8M10 16H2.5M10.5 20L4 24M21.5 12L28 8M22 16h7.5M21.5 20L28 24" stroke="${Y}" stroke-width="1.3" stroke-linecap="round"/><circle cx="16" cy="16" r="1.6" fill="${L}"/>`),
        grab: SVG(pincers(true)),
        grabbing: SVG(pincers(false)),
        text: SVG(`<path d="M16 6v20" stroke="${D}" stroke-width="3.4" stroke-linecap="round"/><path d="M16 6v20" stroke="${Y}" stroke-width="1.8" stroke-dasharray="3 1.2"/><path d="M16 6C14 3 11 3 10 4.5M16 6C18 3 21 3 22 4.5M16 26C14 29 11 29 10 27.5M16 26C18 29 21 29 22 27.5" fill="none" stroke="${Y}" stroke-width="1.2"/>`),
        move: SVG(`<ellipse cx="16" cy="16" rx="4.5" ry="5.5" fill="${B}" stroke="${D}" stroke-width="1.1"/>` + [0, 90, 180, 270].map(r => `<path transform="rotate(${r} 16 16)" d="M16 10C15 7 13.5 5 16 2C18.5 5 17 7 16 10Z" fill="${Y}" stroke="${D}" stroke-width=".8"/>`).join('') + `<circle cx="16" cy="16" r="1.5" fill="${L}"/>`),
        no: SVG(beetle(false, false).replace(/fill="\$\{L\}"/g, '') + `<circle cx="24" cy="24" r="6" fill="${D}" stroke="#e0705a" stroke-width="1.8"/><path d="M19.8 28.2L28.2 19.8" stroke="#e0705a" stroke-width="1.8"/>`),
        hot: {arrow: [5, 5], hand: [5, 5], no: [5, 5]},
      };
    })(),
  };

  const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255}`; };
  const accent = (hex, soft = 0.16) => ({'--accent': hex, '--accent-rgb': rgb(hex), '--accent-soft': `rgba(${rgb(hex)}, ${soft})`});
  // an overlay of things drawn over the whole window (motes, readouts…) that never catches the mouse
  const layer = (cls) => { const el = document.createElement('div'); el.className = 'theme-layer ' + cls; document.body.appendChild(el); return el; };

  // ---------------- Светлая ----------------
  T.register({id: 'light', name: 'Светлая', desc: 'Светлые окна и панели, синий акцент. Космос в окне просмотра остаётся тёмным.', colorScheme: 'light',
    swatches: ['#f7f8fb', '#e2e7ef', '#2f6fdf', '#1d2430'],
    vars: {'--bg': '#dfe4ec', '--chrome': '#f7f8fb', '--chrome-2': '#eef1f6', '--chrome-3': '#e2e7ef', '--line': '#d3d9e4', '--line-2': '#b9c2d2',
      '--fg': '#1d2430', '--muted': '#5f6b80', ...accent('#2f6fdf', 0.14), '--tint-rgb': '20, 30, 50', '--fg-2': '#3a4558', '--warn': '#a36200', '--bad-soft': '#c0392b',
      '--ok-soft': '#1f8a55', '--win-bg': 'rgba(250, 251, 253, .97)', '--dialog-bg': '#f7f8fb', '--card-bg': '#ffffff', '--log-bg': '#f1f3f7',
      '--overlay': 'rgba(20, 30, 50, .3)', '--shadow': '0 10px 30px rgba(20, 30, 50, .18)'},
    css: `.win { box-shadow: 0 10px 30px rgba(20,30,50,.18); } .slabel { color: #fff; }
      .bigd, .genx { box-shadow: 0 30px 80px rgba(20,30,50,.25); }`});

  // ---------------- Полночь ----------------
  T.register({id: 'midnight', name: 'Полночь', desc: 'Темнее тёмного: чистый чёрный, фиолетовый акцент, тонкие значки и мерцающие звёзды в верхней панели.',
    swatches: ['#000000', '#0c0e14', '#8e5cf7', '#d9deea'],
    vars: {'--bg': '#000', '--chrome': '#07080c', '--chrome-2': '#0c0e14', '--chrome-3': '#12151d', '--line': '#1a1e28', '--line-2': '#262c3a',
      '--fg': '#d9deea', '--muted': '#6f7890', ...accent('#8e5cf7', 0.18), '--fg-2': '#a9b0c4', '--dialog-bg': '#07080c', '--card-bg': '#0c0e14', '--log-bg': '#030406',
      '--win-bg': 'rgba(7, 8, 12, .97)', '--overlay': 'rgba(0, 0, 0, .65)'},
    iconTransform: (svg) => svg.replace('stroke-width="1.7"', 'stroke-width="1.35"'),
    css: `.win-head, .bigd-head { box-shadow: inset 0 -1px 0 rgba(142,92,247,.25); }
      #menubar { position: relative; }
      .theme-layer.stars { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
      .theme-layer.stars i { position: absolute; width: 2px; height: 2px; border-radius: 50%; background: #cfc4ff; animation: tw 3s ease-in-out infinite; }
      @keyframes tw { 0%,100% { opacity: .1 } 50% { opacity: .9 } }`,
    fx() {
      const bar = document.getElementById('menubar'); if (!bar) return null;
      const el = layer('stars'); bar.prepend(el);
      for (let i = 0; i < 40; i++) { const s = document.createElement('i'); s.style.left = Math.random() * 100 + '%'; s.style.top = Math.random() * 100 + '%'; s.style.animationDelay = (Math.random() * 3).toFixed(2) + 's'; s.style.animationDuration = (2 + Math.random() * 3).toFixed(2) + 's'; el.appendChild(s); }
      return () => el.remove();
    }});

  // ---------------- Ангелы ----------------
  // «Ангелы» is the name of a nanite civilisation, not a religious theme: platinum and silver high tech, panels that
  // rise and assemble out of nanites, chrome glints, and now and then a crimson alert
  const nodes = '<circle cx="2.2" cy="2.2" r=".9" fill="currentColor" stroke="none" opacity=".7"/><circle cx="21.8" cy="21.8" r=".9" fill="currentColor" stroke="none" opacity=".7"/>';
  T.register({id: 'angels', name: 'Ангелы', desc: 'Наниты и серебро: платиновые стеклянные окна с хромовой кромкой, окна всплывают и собираются из частиц, хромовые кнопки с бликом, потоки нанитов над планетой и редкие алые тревожные вспышки.', colorScheme: 'light',
    swatches: ['#f4f6f9', '#c9d1dc', '#4b5566', '#ff1f4a'],
    vars: {'--bg': '#c9cfd8', '--chrome': '#f4f6f9', '--chrome-2': '#e9edf2', '--chrome-3': '#dde2ea', '--line': '#cdd3dc', '--line-2': '#aab3c1',
      '--fg': '#1c2028', '--muted': '#667186', ...accent('#4b5566', 0.14), '--tint-rgb': '40, 50, 70', '--fg-2': '#3a4252', '--warn': '#b3541e', '--bad-soft': '#d81b3f', '--ok-soft': '#2f8a5a',
      '--win-bg': 'rgba(240, 243, 247, .95)', '--dialog-bg': '#f4f6f9', '--card-bg': '#ffffff', '--log-bg': '#eef1f5', '--overlay': 'rgba(10, 14, 22, .45)',
      '--font-display': '"Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif', '--on-accent': '#ffffff'},
    iconTransform: (svg) => svg.replace('stroke-width="1.7"', 'stroke-width="1.45"').replace('>', '>' + nodes),
    css: ANGELS_CSS + cursorCss(CURSORS.angels),
    spaceRing: {spin: 0.25, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M64 8L112 36V92L64 120L16 92V36Z" fill="none" stroke="#1c2028" stroke-width="7" stroke-opacity=".5"/><path d="M64 8L112 36V92L64 120L16 92V36Z" fill="none" stroke="#eef2f8" stroke-width="4" stroke-dasharray="14 7"/><circle cx="64" cy="8" r="7" fill="#ff1f4a"/><circle cx="16" cy="92" r="5" fill="#eef2f8"/><circle cx="112" cy="92" r="5" fill="#eef2f8"/></svg>'},
    fx(ss) {
      const off = [];
      // streams of nanites drifting over the 3D view, a soft silver edge, and a crimson ping now and then
      const vp = document.getElementById('viewport');
      let ping = null;
      if (vp) {
        const sky = document.createElement('div'); sky.className = 'na-sky';
        sky.innerHTML = '<div class="edge"></div><div class="ping"></div>';
        ping = sky.querySelector('.ping');
        if (anim()) for (let i = 0; i < 5; i++) {
          const st = document.createElement('div'); st.className = 'stream';
          st.style.top = (8 + Math.random() * 80) + '%'; st.style.setProperty('--sk', ((Math.random() - 0.5) * 14).toFixed(1) + 'deg');
          st.style.animationDuration = (9 + Math.random() * 12) + 's'; st.style.animationDirection = Math.random() < 0.5 ? 'normal' : 'reverse';
          st.style.opacity = (0.3 + Math.random() * 0.35).toFixed(2); st.style.height = (20 + Math.random() * 40) + 'px';
          sky.appendChild(st);
        }
        vp.appendChild(sky); off.push(() => sky.remove());
      }
      // the crimson alert: a random open panel flashes, sometimes with a ping over the planet
      if (anim()) {
        let t = 0;
        const alert = () => {
          const panels = [...document.querySelectorAll('.win:not([hidden]), .bigd')];
          const el = panels[Math.floor(Math.random() * panels.length)];
          if (el) { el.classList.add('na-alert'); setTimeout(() => el.classList.remove('na-alert'), 1600); }
          if (ping && Math.random() < 0.6) { ping.style.left = (30 + Math.random() * 40) + '%'; ping.style.top = (30 + Math.random() * 40) + '%'; ping.classList.remove('go'); void ping.offsetWidth; ping.classList.add('go'); }
          t = setTimeout(alert, 9000 + Math.random() * 14000);
        };
        t = setTimeout(alert, 4000 + Math.random() * 5000);
        off.push(() => clearTimeout(t));
      }
      return () => off.forEach(f => f());
    }});

  // ---------------- Ангелы: Сбой ----------------
  // the same nanites gone unstable: near-black panels outlined in crimson; slices of panels jump aside, cracks open
  // and fade, the interface tears for a frame, static flickers
  const crackPath = () => {
    // a jagged line from an edge inwards, with a couple of thin branches (coordinates in % of the box)
    const edge = Math.floor(Math.random() * 4), r = Math.random() * 100;
    let x = edge === 0 ? r : edge === 1 ? 100 : edge === 2 ? r : 0, y = edge === 0 ? 0 : edge === 1 ? r : edge === 2 ? 100 : r;
    let ang = Math.atan2(50 - y, 50 - x) + (Math.random() - 0.5) * 0.9;
    const main = [[x, y]], branches = [];
    const n = 7 + Math.floor(Math.random() * 7);
    for (let i = 0; i < n; i++) {
      ang += (Math.random() - 0.5) * 0.9; const len = 3 + Math.random() * 7;
      x += Math.cos(ang) * len; y += Math.sin(ang) * len; main.push([x, y]);
      if (Math.random() < 0.28) { let bx = x, by = y, ba = ang + (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.6); const bp = [[bx, by]];
        for (let k = 0; k < 3 + Math.floor(Math.random() * 3); k++) { ba += (Math.random() - 0.5) * 0.8; const l = 2 + Math.random() * 5; bx += Math.cos(ba) * l; by += Math.sin(ba) * l; bp.push([bx, by]); }
        branches.push(bp); }
    }
    const d = (pts) => 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
    return `<svg class="nd-crack" viewBox="0 0 100 100" preserveAspectRatio="none"><path vector-effect="non-scaling-stroke" d="${d(main)}"/>${branches.map(b => `<path class="thin" vector-effect="non-scaling-stroke" d="${d(b)}"/>`).join('')}</svg>`;
  };
  T.register({id: 'angels-void', name: 'Ангелы: Сбой', desc: 'Наниты на грани распада: почти чёрные панели в алой обводке, красное зерно, окна собираются из частиц — а потом сбоят: куски окон сдвигаются, по панелям и над планетой расходятся трещины, интерфейс рвётся и шипит помехами.',
    swatches: ['#050405', '#140c0f', '#ff1f3d', '#ffd6dc'],
    vars: {'--bg': '#030203', '--chrome': '#0a0708', '--chrome-2': '#110c0e', '--chrome-3': '#1a1114', '--line': '#2a1418', '--line-2': '#4a1a24',
      '--fg': '#f1d9dd', '--muted': '#8a6870', ...accent('#ff1f3d', 0.18), '--tint-rgb': '255, 60, 80', '--fg-2': '#d4a9b1', '--warn': '#ff8a3a', '--bad-soft': '#ff4a5f', '--ok-soft': '#7fe3b0',
      '--win-bg': 'rgba(10, 7, 8, .97)', '--dialog-bg': '#0a0708', '--card-bg': '#0b0809', '--log-bg': '#050405', '--overlay': 'rgba(0, 0, 0, .7)', '--on-accent': '#ffffff',
      '--font-display': '"Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif'},
    iconTransform: (svg) => svg.replace('stroke-width="1.7"', 'stroke-width="1.45"').replace('>', '>' + nodes),
    css: VOID_CSS + cursorCss(CURSORS['angels-void']),
    spaceRing: {spin: -0.6, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M64 8a56 56 0 0 1 52 36M118 70a56 56 0 0 1-38 46M50 118a56 56 0 0 1-40-30M8 56a56 56 0 0 1 32-44" fill="none" stroke="#ff1f3d" stroke-width="5"/><path d="M64 8a56 56 0 0 1 52 36M118 70a56 56 0 0 1-38 46M50 118a56 56 0 0 1-40-30M8 56a56 56 0 0 1 32-44" fill="none" stroke="#ff1f3d" stroke-width="12" stroke-opacity=".18"/><path d="M84 4h22" stroke="#19d6ff" stroke-width="4"/></svg>'},
    fx(ss) {
      const off = [];
      const glitchOn = () => anim() && ss.prefs.themeGlitch !== false;
      const pick = (a) => a[Math.floor(Math.random() * a.length)];
      const hex = (n = 4) => Math.floor(Math.random() * 16 ** n).toString(16).toUpperCase().padStart(n, '0');
      const vp = document.getElementById('viewport');
      let sky = null;
      if (vp) {
        sky = document.createElement('div'); sky.className = 'nd-sky';
        if (anim()) for (let i = 0; i < 4; i++) { const st = document.createElement('div'); st.className = 'stream'; st.style.top = (10 + Math.random() * 75) + '%'; st.style.setProperty('--sk', ((Math.random() - 0.5) * 14).toFixed(1) + 'deg'); st.style.animationDuration = (8 + Math.random() * 10) + 's'; st.style.animationDirection = Math.random() < 0.5 ? 'normal' : 'reverse'; sky.appendChild(st); }
        vp.appendChild(sky); off.push(() => sky.remove());
      }
      const stat = layer('nd-static'); off.push(() => stat.remove());
      off.push(() => document.querySelectorAll('.nd-crack, .nd-flip, .nd-callout').forEach(c => c.remove()), () => document.querySelectorAll('.nd-glitch').forEach(c => c.classList.remove('nd-glitch')));

      // ---- what is on screen right now: objects of the space map or visible cells of the planet ----
      const lvlName = {universe: 'вселенная', galaxy: 'галактика', system: 'система', planet: 'планета'};
      const targets = () => {
        const nav = ss.space && ss.space.nav; if (!nav || !vp) return [];
        const W = vp.clientWidth, H = vp.clientHeight, out = [];
        if (nav.level !== 'planet') {
          for (const p of ss.space.view.picks || []) {
            if (!['galaxy', 'system', 'star', 'planet'].includes(p.kind)) continue;
            const sc = ss.space.view.screenOf(p.pos); if (!sc.ok || sc.x < 40 || sc.y < 40 || sc.x > W - 40 || sc.y > H - 40) continue;
            out.push({x: sc.x, y: sc.y, kind: p.kind === 'star' ? 'system' : p.kind, id: p.id, pk: p});
          }
        } else if (ss.view && ss.view.G && ss.doc) {
          const G = ss.view.G, cam = ss.scene.camera, gm = ss.scene.globe.matrixWorld, v = new ss.THREE.Vector3(), n = new ss.THREE.Vector3(), cp = new ss.THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
          for (let k = 0; k < 40; k++) {
            const c = Math.floor(Math.random() * G.V);
            v.set(G.centers[c * 3], G.centers[c * 3 + 1], G.centers[c * 3 + 2]).applyMatrix4(gm);
            n.copy(v).sub(new ss.THREE.Vector3().setFromMatrixPosition(gm)).normalize();
            if (n.dot(cp.clone().sub(v).normalize()) < 0.35) continue; // facing us
            v.project(cam); const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
            if (x < 60 || y < 60 || x > W - 60 || y > H - 60) continue;
            out.push({x, y, kind: 'cell', id: c}); if (out.length > 6) break;
          }
        }
        return out;
      };
      // what the console says about a thing
      const about = (t, brief) => {
        const sp = ss.space, lines = [];
        let head = '';
        if (t.kind === 'cell') {
          const d = ss.doc, p = d.palette[d.cells[t.id]], ll = ss.view.cellLatLon(t.id), h = ss.view.H ? ss.view.H[t.id] : 0;
          head = `клетка #${t.id}`;
          lines.push(`тип: ${p ? p.name : '?'}`, `${Math.abs(ll.lat).toFixed(1)}°${ll.lat >= 0 ? 'с' : 'ю'} ${Math.abs(ll.lon).toFixed(1)}°${ll.lon >= 0 ? 'в' : 'з'} · высота ${h.toFixed(2)}`);
        } else {
          const o = sp.findAny(t.kind, t.id) || {};
          head = `${t.kind === 'galaxy' ? 'галактика' : t.kind === 'system' ? 'система' : o.parent ? 'луна' : 'планета'} «${o.name || '?'}»`;
          if (t.kind === 'galaxy') lines.push(`систем: ${(o.systems || []).length}`);
          if (t.kind === 'system') lines.push(`планет: ${(o.planets || []).length} · звезда ${o.starColor || '?'}`);
          if (t.kind === 'planet') { const g = o.doc && o.doc.meta && o.doc.meta.gen; lines.push(`карта: ${o.doc ? o.doc.n * o.doc.n * 10 + 2 + ' клеток' : 'не создана'}${g ? ' · ' + g.id : ''}`); }
        }
        if (brief) return {head, lines};
        const diag = [
          ['err', `ОШИБКА 0x${hex()}: пакет нанитов потерян`], ['err', `сбой синхронизации роя · ${Math.floor(Math.random() * 900 + 100)} мс`], ['err', `отказ узла N-${hex(3)}`],
          ['dim', `целостность ${(85 + Math.random() * 15).toFixed(1)}%`], ['dim', `дрейф орбиты ${(Math.random() * 0.09).toFixed(3)}%`], ['dim', `плотность роя ${(Math.random() * 100).toFixed(0)} ед/км³`],
          ['ok', `перестройка ячеек… ок`], ['ok', `канал ${hex(2)}:${hex(2)} восстановлен`], ['dim', `сигнал: ${['чистый', 'шум', 'эхо', 'искажён'][Math.floor(Math.random() * 4)]}`],
        ];
        for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) { const [cls, text] = pick(diag); lines.push({cls, text}); }
        return {head, lines};
      };
      const renderLines = (el, info, typing) => {
        el.innerHTML = '';
        const hd = document.createElement('div'); hd.className = 'hd'; hd.textContent = '> ' + info.head; el.appendChild(hd);
        const rows = info.lines.map(l => { const d = document.createElement('div'); d.className = 'ln ' + (typeof l === 'string' ? '' : l.cls); d.dataset.t = typeof l === 'string' ? l : l.text; el.appendChild(d); return d; });
        if (!typing) { rows.forEach(r => { r.textContent = r.dataset.t; }); return; }
        let i = 0, j = 0;
        const step = () => { if (!el.isConnected || i >= rows.length) { rows.forEach(r => r.classList.remove('cur')); return; }
          const r = rows[i]; r.classList.add('cur'); r.textContent = r.dataset.t.slice(0, ++j);
          if (j >= r.dataset.t.length) { r.classList.remove('cur'); i++; j = 0; } setTimeout(step, 16); };
        step();
      };
      // where a target is on screen right now: {x, y, state} — 'on' (visible), 'limb' (behind the planet → its edge),
      // 'edge' (off screen → the screen border), or null when it no longer exists
      const V3 = () => new ss.THREE.Vector3();
      const locate = (t) => {
        const W = vp.clientWidth, H = vp.clientHeight, M = 14;
        const clampEdge = (x, y, behind) => {
          // off screen (or behind the camera): slide the point along the ray from the centre to the border
          let dx = x - W / 2, dy = y - H / 2; if (behind) { dx = -dx; dy = -dy; }
          const k = Math.min((W / 2 - M) / Math.max(1e-6, Math.abs(dx)), (H / 2 - M) / Math.max(1e-6, Math.abs(dy)));
          return {x: W / 2 + dx * k, y: H / 2 + dy * k, state: 'edge'};
        };
        if (t.kind === 'cell') {
          if (!ss.view || !ss.view.G || ss.space.nav.level !== 'planet') return null;
          const G = ss.view.G, cam = ss.scene.camera, gm = ss.scene.globe.matrixWorld;
          const v = V3().set(G.centers[t.id * 3], G.centers[t.id * 3 + 1], G.centers[t.id * 3 + 2]).applyMatrix4(gm);
          const c = V3().setFromMatrixPosition(gm), cp = V3().setFromMatrixPosition(cam.matrixWorld);
          const facing = v.clone().sub(c).normalize().dot(cp.clone().sub(v).normalize());
          const p = v.clone().project(cam), x = (p.x * 0.5 + 0.5) * W, y = (-p.y * 0.5 + 0.5) * H;
          let pt = {x, y, state: 'on'};
          if (facing < 0.02) {
            // on the far side: point at the rim of the planet, in the direction of the cell
            const R = v.distanceTo(c) * 1.03, right = V3().setFromMatrixColumn(cam.matrixWorld, 0);
            const cs = c.clone().project(cam), rs = c.clone().addScaledVector(right, R).project(cam);
            const cx = (cs.x * 0.5 + 0.5) * W, cy = (-cs.y * 0.5 + 0.5) * H, rad = Math.abs((rs.x - cs.x) * 0.5 * W);
            let dx = x - cx, dy = y - cy; const L = Math.hypot(dx, dy) || 1; if (L < 1e-3) { dx = 0; dy = -1; }
            pt = {x: cx + dx / L * rad, y: cy + dy / L * rad, state: 'limb'};
          }
          if (p.z > 1 || pt.x < M || pt.y < M || pt.x > W - M || pt.y > H - M) return clampEdge(pt.x, pt.y, p.z > 1);
          return pt;
        }
        if (ss.space.nav.level === 'planet' || !ss.space.view.picks.includes(t.pk)) return null;
        const sc = ss.space.view.screenOf(t.pk.pos);
        if (!sc.ok || sc.x < M || sc.y < M || sc.x > W - M || sc.y > H - M) return clampEdge(sc.x, sc.y, !sc.ok);
        return {x: sc.x, y: sc.y, state: 'on'};
      };
      // a console pops up over something on screen and stays where it popped up; its arrow follows the thing as the
      // camera moves (to the rim of the planet when it went round the back, to the screen border when it left the view)
      const live = new Set();
      let raf = 0;
      const follow = () => {
        raf = 0;
        for (const c of live) {
          if (!c.box.isConnected) { live.delete(c); continue; }
          const at = locate(c.t);
          if (!at) { c.box.classList.add('lost'); continue; }
          c.box.classList.toggle('lost', false);
          c.mark.style.left = at.x + 'px'; c.mark.style.top = at.y + 'px';
          c.mark.className = 'mark ' + at.state;
          // the arrow leaves the console from the point of its frame nearest to the target
          const L = c.con.offsetLeft, T2 = c.con.offsetTop, Wc = c.con.offsetWidth, Hc = c.con.offsetHeight;
          const ax = Math.max(L, Math.min(L + Wc, at.x)), ay = Math.max(T2, Math.min(T2 + Hc, at.y));
          const inside = ax === at.x && ay === at.y;
          c.line.style.display = inside ? 'none' : '';
          // stop the line short of the ring so the arrow head sits on it
          const dx = at.x - ax, dy = at.y - ay, d = Math.hypot(dx, dy) || 1, cut = at.state === 'on' ? 10 : 4;
          c.line.setAttribute('x1', ax); c.line.setAttribute('y1', ay);
          c.line.setAttribute('x2', at.x - dx / d * cut); c.line.setAttribute('y2', at.y - dy / d * cut);
          c.mark.style.setProperty('--a', Math.atan2(dy, dx) + 'rad');
        }
        if (live.size) raf = requestAnimationFrame(follow);
      };
      off.push(() => { cancelAnimationFrame(raf); live.clear(); });
      const callout = () => {
        const ts = targets(); if (!ts.length || !sky) return;
        const t = pick(ts), W = vp.clientWidth, H = vp.clientHeight;
        const box = document.createElement('div'); box.className = 'nd-callout';
        const right = t.x < W * 0.6, up = t.y > H * 0.45;
        const cx = t.x + (right ? 70 : -70), cy = t.y + (up ? -90 : 70);
        const con = document.createElement('div'); con.className = 'nd-con';
        box.innerHTML = `<svg width="1" height="1"><defs><marker id="nd-ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10L3 5Z" fill="#ff1f3d"/></marker></defs><line marker-end="url(#nd-ah)" x1="${cx}" y1="${cy}" x2="${t.x}" y2="${t.y}"/></svg><div class="mark on" style="left:${t.x}px;top:${t.y}px"><i></i></div>`;
        box.appendChild(con);
        sky.appendChild(box);
        // measure with the whole text, then type it out
        const info = about(t, false);
        renderLines(con, info, false);
        const r = con.getBoundingClientRect();
        renderLines(con, info, true);
        con.style.left = Math.max(6, Math.min(W - r.width - 6, right ? cx : cx - r.width)) + 'px';
        con.style.top = Math.max(6, Math.min(H - r.height - 6, up ? cy - r.height : cy)) + 'px';
        live.add({t, box, con, mark: box.querySelector('.mark'), line: box.querySelector('line')});
        if (!raf) raf = requestAnimationFrame(follow);
        setTimeout(() => { box.classList.add('out'); setTimeout(() => box.remove(), 500); }, 7500);
      };
      // a patch of the screen made of nanite tiles flips over and back
      const flip = (host) => {
        if (!host) return;
        const W = host.clientWidth, H = host.clientHeight, s = 28 + Math.floor(Math.random() * 14);
        const cols = 3 + Math.floor(Math.random() * 6), rows = 2 + Math.floor(Math.random() * 4);
        const g = document.createElement('div'); g.className = 'nd-flip';
        g.style.gridTemplateColumns = `repeat(${cols}, ${s}px)`;
        g.style.left = Math.max(0, Math.random() * (W - cols * s)) + 'px'; g.style.top = Math.max(0, Math.random() * (H - rows * s)) + 'px';
        const sideways = Math.random() < 0.5;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const tile = document.createElement('div'); tile.className = 'nd-tile' + (sideways ? '' : ' x');
          tile.style.width = tile.style.height = s + 'px'; tile.style.animationDelay = ((r + c) * 45 + Math.random() * 60) + 'ms';
          if (Math.random() < 0.4) tile.textContent = hex(2);
          g.appendChild(tile);
        }
        host.appendChild(g); setTimeout(() => g.remove(), 1000 + (rows + cols) * 50 + 200);
      };
      // hover: brief info next to the cursor (space objects, planet cells)
      if (vp) {
        const tip = document.createElement('div'); tip.className = 'nd-tip'; tip.hidden = true; vp.appendChild(tip); off.push(() => tip.remove());
        let cell = -1, last = 0, key = '';
        off.push(ss.hooks.on('cellInfo', (text, c) => { cell = c; return text; }));
        const move = (e) => {
          if (!glitchOn()) { tip.hidden = true; return; }
          const now = performance.now(); if (now - last < 90) return; last = now;
          const r = vp.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
          if (x < 0 || y < 0 || x > r.width || y > r.height || (e.target && e.target.closest && e.target.closest('.win, .bigd, .genx, #crumbs, #zoomCtl'))) { tip.hidden = true; return; }
          let t = null;
          if (ss.space.nav.level === 'planet') { if (cell >= 0) t = {kind: 'cell', id: cell}; }
          else { const h = ss.space.view.pick(e.clientX, e.clientY); if (h && ['galaxy', 'system', 'star', 'planet'].includes(h.kind)) t = {kind: h.kind === 'star' ? 'system' : h.kind, id: h.id}; }
          if (!t) { tip.hidden = true; key = ''; return; }
          const k = t.kind + ':' + t.id; if (k !== key) { key = k; renderLines(tip, about(t, true), false); }
          tip.hidden = false;
          const tw = tip.offsetWidth, th = tip.offsetHeight;
          tip.style.left = Math.min(r.width - tw - 6, x + 18) + 'px'; tip.style.top = Math.min(r.height - th - 6, y + 18) + 'px';
        };
        window.addEventListener('pointermove', move, {passive: true}); off.push(() => window.removeEventListener('pointermove', move));
        // what was said about the previous level goes away with it
        off.push(ss.hooks.on('level:changed', () => { tip.hidden = true; key = ''; cell = -1; document.querySelectorAll('.nd-callout').forEach(c => c.remove()); }));
      }
      // ---- instability: every few seconds something goes wrong (unless glitches are switched off) ----
      if (anim()) {
        const flash = (el, cls, ms) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); };
        const panels = () => [...document.querySelectorAll('.win:not([hidden]), .bigd, .genx, #menubar')];
        const crack = (host) => { host.insertAdjacentHTML('beforeend', crackPath()); const c = host.lastElementChild; setTimeout(() => c.remove(), 4000); };
        let t = 0, t2 = 0;
        const tick = () => {
          if (glitchOn()) {
            const r = Math.random(), ps = panels(), p = ps[Math.floor(Math.random() * ps.length)];
            if (r < 0.3 && p) flash(p, 'nd-glitch', 450);
            else if (r < 0.55) { const host = Math.random() < 0.5 && p && p.id !== 'menubar' ? p : sky; if (host) crack(host); }
            else if (r < 0.85) { flip(Math.random() < 0.6 ? sky : (p && p.id !== 'menubar' ? p : sky)); if (Math.random() < 0.35) flip(sky); }
            else { flash(document.documentElement, 'nd-tear', 200); flash(stat, 'on', 260); }
          }
          t = setTimeout(tick, 1800 + Math.random() * 4200);
        };
        const tick2 = () => { if (glitchOn()) callout(); t2 = setTimeout(tick2, 6500 + Math.random() * 7000); };
        t = setTimeout(tick, 1500); t2 = setTimeout(tick2, 3000);
        off.push(() => { clearTimeout(t); clearTimeout(t2); });
      }
      return () => off.forEach(f => f());
    }});

  // ---------------- Рой ----------------
  // a living insect colony: chitin plates, hatching and breathing windows, twitching buttons, beetles crawling over the view
  const antennae = '<path d="M10 2.4L8 -.8M14 2.4l2-3.2" stroke-width="1.2"/>';
  T.register({id: 'swarm', name: 'Рой', desc: 'Живая колония в буро-серой хитиновой броне: панели-панцири с неровными углами и сегментами, окна вылупляются и дышат, кнопки подёргиваются, слайдер-брюшко, соты по углам, споры и жуки, ползающие по экрану и удирающие от курсора.',
    swatches: ['#1d1915', '#3a3129', '#c9973e', '#a8c45a'],
    vars: {'--bg': '#14110e', '--chrome': '#24201b', '--chrome-2': '#2d2822', '--chrome-3': '#39322a', '--line': '#4a4136', '--line-2': '#625646',
      '--fg': '#eadfca', '--muted': '#9a8c78', ...accent('#c9973e', 0.2), '--tint-rgb': '230, 210, 170', '--fg-2': '#cbbd9f', '--warn': '#e0b04a', '--bad-soft': '#e0705a', '--ok-soft': '#a8c45a',
      '--win-bg': 'rgba(38, 33, 28, .96)', '--dialog-bg': '#26211c', '--card-bg': '#2a241e', '--log-bg': '#1a1612', '--overlay': 'rgba(10, 8, 6, .6)', '--on-accent': '#1d1610',
      '--font-display': '"Bahnschrift", "Segoe UI Variable Display", "Segoe UI", sans-serif'},
    iconTransform: (svg) => svg.replace('viewBox="0 0 24 24"', 'viewBox="0 -2.5 24 26.5"').replace('stroke-width="1.7"', 'stroke-width="1.85"').replace('>', '>' + antennae),
    css: SWARM_CSS + cursorCss(CURSORS.swarm),
    spaceRing: {spin: 0.15, pulse: 0.07, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M64 10C96 8 120 32 118 64C116 98 92 120 62 118C30 116 8 94 10 62C12 32 34 12 64 10Z" fill="none" stroke="#1d1610" stroke-width="10"/><path d="M64 10C96 8 120 32 118 64C116 98 92 120 62 118C30 116 8 94 10 62C12 32 34 12 64 10Z" fill="none" stroke="#c9973e" stroke-width="5"/><path d="M40 20l-4-8M88 20l4-8M20 88l-9 3M108 88l9 3" stroke="#c9973e" stroke-width="4" stroke-linecap="round"/><circle cx="108" cy="30" r="7" fill="#a8c45a"/></svg>'},
    fx(ss) {
      const off = [];
      const vp = document.getElementById('viewport');
      if (vp) {
        const nest = document.createElement('div'); nest.className = 'sw-nest';
        nest.innerHTML = '<div class="hive tr"></div><div class="hive bl"></div>';
        if (anim()) for (let i = 0; i < 14; i++) { const s = document.createElement('div'); s.className = 'spore'; s.style.left = (Math.random() * 100) + '%'; s.style.bottom = (-5 + Math.random() * 30) + '%'; s.style.animationDuration = (10 + Math.random() * 14) + 's'; s.style.animationDelay = (-Math.random() * 20) + 's'; nest.appendChild(s); }
        vp.appendChild(nest); off.push(() => nest.remove());
        // beetles: wander, keep inside the view, rest now and then, run from the cursor
        if (anim()) {
          let mx = -999, my = -999;
          const onMove = (e) => { const r = vp.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; };
          window.addEventListener('pointermove', onMove, {passive: true}); off.push(() => window.removeEventListener('pointermove', onMove));
          const bugs = [];
          for (let i = 0; i < 6; i++) {
            const el = document.createElement('div'); el.className = 'sw-bug walk'; nest.appendChild(el);
            const r = vp.getBoundingClientRect();
            bugs.push({el, x: Math.random() * r.width, y: Math.random() * r.height, a: Math.random() * 6.28, rest: 0, s: 0.6 + Math.random() * 0.6});
            el.style.transform = `scale(${(0.7 + Math.random() * 0.5).toFixed(2)})`;
          }
          let last = performance.now();
          const step = () => {
            const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
            const W = vp.clientWidth, H = vp.clientHeight;
            for (const b of bugs) {
              const dx = b.x - mx, dy = b.y - my, d = Math.hypot(dx, dy);
              let speed = b.s * 38;
              if (d < 140) { b.a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.4; speed = 190; b.rest = 0; }           // flee
              else if (b.rest > 0) { b.rest -= dt; b.el.classList.remove('walk'); speed = 0; }
              else { b.a += (Math.random() - 0.5) * 3 * dt; if (Math.random() < 0.004) b.rest = 1 + Math.random() * 3; }
              // turn back from the edges
              const m = 30; if (b.x < m) b.a = 0; else if (b.x > W - m) b.a = Math.PI; if (b.y < m) b.a = Math.PI / 2; else if (b.y > H - m) b.a = -Math.PI / 2;
              if (speed) { b.el.classList.add('walk'); b.x += Math.cos(b.a) * speed * dt; b.y += Math.sin(b.a) * speed * dt; }
              b.el.style.left = b.x.toFixed(1) + 'px'; b.el.style.top = b.y.toFixed(1) + 'px';
              b.el.style.rotate = (b.a * 180 / Math.PI + 90).toFixed(0) + 'deg';
            }
            raf = requestAnimationFrame(step);
          };
          let raf = requestAnimationFrame(step); off.push(() => cancelAnimationFrame(raf));
        }
      }
      // the colony reports in the status bar
      const bar = document.getElementById('statusbar');
      if (bar) {
        const el = document.createElement('span'); el.className = 'theme-layer colony'; bar.insertBefore(el, document.getElementById('stFps'));
        let n = 12000 + Math.floor(Math.random() * 4000), larvae = 200 + Math.floor(Math.random() * 300);
        const moods = ['спокойна', 'спокойна', 'спокойна', 'голодна', 'откладывает яйца', 'беспокоится'];
        let mood = moods[0];
        const tick = () => { n += Math.floor((Math.random() - 0.35) * 40); larvae = Math.max(0, larvae + Math.floor((Math.random() - 0.45) * 12)); if (Math.random() < 0.08) mood = moods[Math.floor(Math.random() * moods.length)];
          el.textContent = `РОЙ ${n.toLocaleString('ru-RU')} · ЛИЧИНОК ${larvae} · МАТКА ${mood}`; };
        tick(); const t = setInterval(tick, 1800); off.push(() => { clearInterval(t); el.remove(); });
      }
      return () => off.forEach(f => f());
    }});

  // ---------------- Машины ----------------
  // an amber terminal: monospace, square corners, scan lines, blinking cursors, hazard stripes, live telemetry in the status bar
  const brackets = '<path d="M2 6.5V2h4.5M17.5 2H22v4.5M22 17.5V22h-4.5M6.5 22H2v-4.5" stroke-width="1" opacity=".7"/>';
  T.register({id: 'machines', name: 'Машины', desc: 'Янтарный терминал: моноширинный шрифт, прямые углы, строки развёртки, мигающий курсор, предупреждающие полосы и телеметрия в строке состояния.',
    swatches: ['#050505', '#11110f', '#ffb000', '#e8e2c8'],
    vars: {'--bg': '#050505', '--chrome': '#0b0b0a', '--chrome-2': '#11110f', '--chrome-3': '#191915', '--line': '#2a2a20', '--line-2': '#4a4a30',
      '--fg': '#e8e2c8', '--muted': '#8a8468', ...accent('#ffb000', 0.16), '--tint-rgb': '255, 200, 90', '--fg-2': '#c9c09a', '--warn': '#ffd000', '--bad-soft': '#ff6a3a', '--ok-soft': '#9dff5c',
      '--win-bg': 'rgba(11, 11, 10, .97)', '--dialog-bg': '#0b0b0a', '--card-bg': '#11110f', '--log-bg': '#050505', '--on-accent': '#0b0b0a',
      '--font': '"Cascadia Mono", Consolas, "Lucida Console", monospace', '--font-display': '"Cascadia Mono", Consolas, monospace'},
    iconTransform: (svg) => svg.replace('stroke-linecap="round" stroke-linejoin="round"', 'stroke-linecap="square" stroke-linejoin="miter"').replace('stroke-width="1.7"', 'stroke-width="1.5"').replace('>', '>' + brackets),
    css: MACHINES_CSS + cursorCss(CURSORS.machines),
    spaceRing: {spin: 0, pulse: 0.06, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M10 40V10H40M88 10H118V40M118 88V118H88M40 118H10V88" fill="none" stroke="#0b0b0a" stroke-width="12"/><path d="M10 40V10H40M88 10H118V40M118 88V118H88M40 118H10V88" fill="none" stroke="#ffb000" stroke-width="6"/></svg>'},
    fx(ss) {
      const off = [];
      const crt = layer('mx-crt'); off.push(() => crt.remove());
      // HUD over the 3D view: corners, rulers, a crosshair, a radar and live readouts of the camera
      const vp = document.getElementById('viewport');
      if (vp) {
        const hud = document.createElement('div'); hud.className = 'mx-hud';
        hud.innerHTML = '<div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div><div class="ruler-top"></div><div class="ruler-left"></div><div class="cross"></div><div class="radar"></div><div class="bars"></div><div class="readout"></div><div class="readout r"></div>';
        const radar = hud.querySelector('.radar'), bars = hud.querySelector('.bars');
        for (let i = 0; i < 5; i++) { const b = document.createElement('i'); b.style.left = (15 + Math.random() * 65) + '%'; b.style.top = (15 + Math.random() * 65) + '%'; b.style.animationDelay = (-Math.random() * 3.2) + 's'; radar.appendChild(b); }
        for (let i = 0; i < 7; i++) { const b = document.createElement('i'); b.style.animationDelay = (-Math.random() * 1.2) + 's'; b.style.animationDuration = (0.6 + Math.random() * 0.9) + 's'; bars.appendChild(b); }
        vp.appendChild(hud); off.push(() => hud.remove());
        const [rl, rr] = hud.querySelectorAll('.readout');
        const e = new ss.THREE.Euler(), deg = (r) => ((r * 180 / Math.PI + 360) % 360).toFixed(1).padStart(5, '0');
        const lvl = {universe: 'ВСЕЛЕННАЯ', galaxy: 'ГАЛАКТИКА', system: 'СИСТЕМА', planet: 'ПЛАНЕТА'};
        const read = () => {
          const w = ss.scene && ss.scene.world; if (w) e.setFromQuaternion(w.quaternion, 'YXZ');
          const d = ss.doc, nav = ss.space && ss.space.nav;
          rl.textContent = `AZ ${deg(e.y)}°  EL ${deg(e.x)}°\nZOOM ${ss.scene ? ss.scene.camera.position.z.toFixed(2) : '-'}\nУРОВЕНЬ ${nav ? lvl[nav.level] || nav.level : '-'}`;
          rr.textContent = `ОБЪЕКТ ${d && nav && nav.level === 'planet' ? d.name.toUpperCase().slice(0, 18) : '—'}\nЧАСТОТА ${d ? d.n : '-'}  КЛЕТОК ${d ? d.cells.length : '-'}\nТИПОВ ${d ? d.palette.length : '-'}`;
        };
        read(); const t = setInterval(read, 200); off.push(() => clearInterval(t));
      }
      // live telemetry in the status bar
      const bar = document.getElementById('statusbar');
      if (bar) {
        const tele = document.createElement('span'); tele.className = 'theme-layer telemetry';
        bar.insertBefore(tele, document.getElementById('stFps'));
        let cyc = Math.floor(Math.random() * 0xffff);
        const tick = () => { const f = ss.metrics ? ss.metrics.frame() : {fps: 0}; cyc = (cyc + 1) & 0xffff; tele.textContent = `ЯДРО ${String(Math.min(100, Math.round(f.fps / 1.2))).padStart(3, '0')}% · ЦИКЛ 0x${cyc.toString(16).toUpperCase().padStart(4, '0')} · [ОНЛАЙН]`; };
        tick(); const t = setInterval(tick, 1000); off.push(() => { clearInterval(t); tele.remove(); });
      }
      // window titles type themselves out when a window opens
      if (anim()) {
        const type = (el) => {
          if (!el || el.dataset.typing) return;
          const full = el.textContent; el.dataset.typing = '1'; el.classList.add('typing'); let i = 0;
          const step = () => { i += 1; el.textContent = full.slice(0, i); if (i < full.length) setTimeout(step, 22); else { el.classList.remove('typing'); delete el.dataset.typing; } };
          el.textContent = ''; setTimeout(step, 180);
        };
        off.push(ss.hooks.on('window:open', (id) => { const r = ss.ui.wm.windows.get(id); if (r) type(r.el.querySelector('.win-title')); }));
        off.push(ss.hooks.on('dialog:opened', () => type(document.querySelector('.bigd-title b, .genx-title b'))));
      }
      return () => off.forEach(f => f());
    }});

  // ---------------- Эмодзи ----------------
  // the colourful icons as they were — now as one theme among others
  const E = {
    dice: '🎲', sparkles: '✨', orbit: '🪐', ring: '💍', puzzle: '🧩', gear: '⚙️', help: '❓', chart: '📈', warning: '⚠️', planet: '🪐', window: '🪟', disk: '💾', info: 'ℹ️', box: '📦',
    galaxy: '🌌', brush: '🖌️', list: '📜', timer: '⏱️', check: '✅', target: '🎯', close: '✖️', globe: '🌍', ocean: '🌊', moon: '🌙', waves: '🌊', halo: '😇', nanite: '💠', machine: '🤖',
    snowflake: '❄️', flame: '🔥', radiation: '☢️', blast: '💣', ghost: '👻', swarm: '🐝', leaf: '🌴', crack: '💥', rocket: '🚀', station: '🛰️', burb: '🔴', houses: '🏘️',
    crown: '👑', tower: '🗼', cloud: '☁️', rain: '🌧️', flower: '🌸', meteor: '☄️', stardust: '✨', wind: '🌬️', ash: '🌫️', spark: '💫', wisp: '🕯️', diamond: '💎', dots: '🫧',
    arrow: '🛸', satellite: '🛰️', shard: '🪨', wheel: '🎡', cylinder: '🥫', modules: '🧱', citadel: '🏰', grid: '🏗️', dock: '⚓', panels: '🔋', beacon: '🚨', elevator: '🛗',
    up: '⬆️', energy: '⚡', scrap: '🔩', anchor: '⚓', mine: '💣', shield: '🛡️', network: '🕸️',
  };
  T.register({id: 'emoji', name: 'Эмодзи', desc: 'Цвета «Космоса», а вместо линейных значков — цветные эмодзи. Значки на кнопках подпрыгивают при наведении.', emojiIcons: true,
    swatches: ['#05070c', '#161b27', '#ffcc33', '#e6e9f2'], icons: E,
    css: `.bar-btn:hover .ico, .bigd-tab:hover .ico, .genx-card:hover .genx-card-ico { animation: hop .45s ease; }
      @keyframes hop { 0%,100% { transform: translateY(0) } 40% { transform: translateY(-4px) scale(1.15) } }`});

  // «Сбои» on/off: for the «Ангелы: Сбой» theme (a button in the top bar shows while that theme is on)
  ss.reg.menus.register({id: 'theme:glitch', menu: 'Вид', order: 410, label: 'Сбои темы «Ангелы: Сбой»',
    enabled: () => !!(ss.themes && ss.themes.current && ss.themes.current.id === 'angels-void'),
    checked: () => ss.prefs.themeGlitch !== false,
    action: () => { ss.setPref('themeGlitch', ss.prefs.themeGlitch === false); ss.ui.toast(ss.prefs.themeGlitch === false ? 'Сбои выключены' : 'Сбои включены'); },
    bar: {icon: 'warning', side: 'right', order: 5, active: () => ss.prefs.themeGlitch !== false}});
}
