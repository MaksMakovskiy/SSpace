export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

export function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// 3D value noise with fBm; returns (x,y,z,octaves) -> ~0..1
export function makeNoise(seed) {
  const rnd = mulberry(seed), perm = new Uint8Array(512), val = new Float32Array(256);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) val[i] = rnd();
  const h = (x, y, z) => val[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
  const sm = t => t * t * (3 - 2 * t);
  function n3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
    const L = (a, b, t) => a + (b - a) * t;
    return L(L(L(h(xi, yi, zi), h(xi + 1, yi, zi), xf), L(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), xf), yf),
             L(L(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), xf), L(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), xf), yf), zf);
  }
  return (x, y, z, oct = 4) => {
    let s = 0, a = 1, f = 1, norm = 0;
    for (let o = 0; o < oct; o++) { s += a * n3(x * f + o * 17.3, y * f + o * 5.1, z * f + o * 11.7); norm += a; a *= 0.5; f *= 2.03; }
    return s / norm;
  };
}

export function hash01(i) {
  let h = (i * 2654435761) >>> 0; h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b) >>> 0; h ^= h >>> 16;
  return (h % 10000) / 10000;
}

export function hexToRgb(hex) {
  const v = parseInt(String(hex).slice(1), 16) || 0;
  return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
}

export function u8ToB64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
export function b64ToU8(b) {
  const s = atob(b), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

export const fmt = (n) => Number(n).toLocaleString('ru-RU');
export function plural(n, one, few, many) {
  const m = n % 100, d = n % 10;
  if (m >= 11 && m <= 14) return many;
  if (d === 1) return one;
  if (d >= 2 && d <= 4) return few;
  return many;
}
export const cellCount = (n) => 10 * n * n + 2;

export function debounce(fn, ms) {
  let t = 0;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function slug(s) {
  const map = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
  return String(s).toLowerCase().split('').map(ch => map[ch] ?? ch).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

// Tiny DOM builder: h('div', {class:'x', onclick:fn, style:{...}}, child, 'text', [more])
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return el;
}
