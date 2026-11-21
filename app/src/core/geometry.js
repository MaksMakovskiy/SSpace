// Goldberg sphere: dual of a subdivided icosahedron. Frequency n gives 10n²+2 cells (12 are pentagons).
// Each cell is a prism: a top fan (center + k corners) and k wall quads, with its own vertices,
// so height, color, effect and texture can be set per cell.
import {makeNoise, hash01} from './util.js';

export function buildGeodesic(THREE, n) {
  const t = (1 + Math.sqrt(5)) / 2;
  const base = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  const faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const P = [];
  const add = (x, y, z) => { const l = Math.hypot(x, y, z); P.push(x / l, y / l, z / l); return P.length / 3 - 1; };
  base.forEach(v => add(v[0], v[1], v[2]));
  const edges = new Map();
  function edgeAt(u, v, k) {
    const a = Math.min(u, v), b = Math.max(u, v), key = a * 12 + b;
    let arr = edges.get(key);
    if (!arr) {
      arr = [];
      for (let s = 1; s < n; s++) { const f = s / n; arr.push(add(P[a * 3] * (1 - f) + P[b * 3] * f, P[a * 3 + 1] * (1 - f) + P[b * 3 + 1] * f, P[a * 3 + 2] * (1 - f) + P[b * 3 + 2] * f)); }
      edges.set(key, arr);
    }
    return u < v ? arr[k - 1] : arr[n - k - 1];
  }
  const tris = [];
  for (const [A, B, C] of faces) {
    const memo = new Map();
    const idx = (i, j) => {
      if (i === 0 && j === 0) return A; if (i === n) return B; if (j === n) return C;
      if (j === 0) return edgeAt(A, B, i); if (i === 0) return edgeAt(A, C, j); if (i + j === n) return edgeAt(B, C, j);
      const k = i * (n + 1) + j; let r = memo.get(k);
      if (r === undefined) {
        const a = (n - i - j) / n, b = i / n, c = j / n;
        r = add(P[A * 3] * a + P[B * 3] * b + P[C * 3] * c, P[A * 3 + 1] * a + P[B * 3 + 1] * b + P[C * 3 + 1] * c, P[A * 3 + 2] * a + P[B * 3 + 2] * b + P[C * 3 + 2] * c);
        memo.set(k, r);
      }
      return r;
    };
    for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
      tris.push(idx(i, j), idx(i + 1, j), idx(i, j + 1));
      if (i + j < n - 1) tris.push(idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1));
    }
  }
  const V = P.length / 3, T = tris.length / 3;
  const centers = new Float32Array(P), tc = new Float32Array(T * 3);
  const vt = Array.from({length: V}, () => []), nbs = Array.from({length: V}, () => new Set());
  for (let f = 0; f < T; f++) {
    const a = tris[f * 3], b = tris[f * 3 + 1], c = tris[f * 3 + 2];
    const x = P[a * 3] + P[b * 3] + P[c * 3], y = P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1], z = P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2];
    const l = Math.hypot(x, y, z); tc[f * 3] = x / l; tc[f * 3 + 1] = y / l; tc[f * 3 + 2] = z / l;
    vt[a].push(f); vt[b].push(f); vt[c].push(f);
    nbs[a].add(b); nbs[a].add(c); nbs[b].add(a); nbs[b].add(c); nbs[c].add(a); nbs[c].add(b);
  }
  for (let v = 0; v < V; v++) {
    const nx = P[v * 3], ny = P[v * 3 + 1], nz = P[v * 3 + 2];
    let rx = 0, ry = 1, rz = 0; if (Math.abs(ny) > 0.9) { rx = 1; ry = 0; }
    let ux = ny * rz - nz * ry, uy = nz * rx - nx * rz, uz = nx * ry - ny * rx; const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    const wx = ny * uz - nz * uy, wy = nz * ux - nx * uz, wz = nx * uy - ny * ux;
    const ang = new Map();
    for (const f of vt[v]) { const dx = tc[f * 3] - nx, dy = tc[f * 3 + 1] - ny, dz = tc[f * 3 + 2] - nz; ang.set(f, Math.atan2(dx * wx + dy * wy + dz * wz, dx * ux + dy * uy + dz * uz)); }
    vt[v].sort((p, q) => ang.get(p) - ang.get(q));
  }
  const nbr = nbs.map(s => Int32Array.from(s));

  // fixed per-cell noise 0..1 (smooth ridges + per-cell randomness) used for roughness
  const nz = makeNoise(424242), noise = new Float32Array(V); let mn = 1e9, mx = -1e9;
  for (let v = 0; v < V; v++) { const r = nz(P[v * 3] * 3.3 + 7, P[v * 3 + 1] * 3.3 + 7, P[v * 3 + 2] * 3.3 + 7, 4); noise[v] = r; if (r < mn) mn = r; if (r > mx) mx = r; }
  for (let v = 0; v < V; v++) noise[v] = 0.65 * ((noise[v] - mn) / ((mx - mn) || 1)) + 0.35 * hash01(v);

  let totalV = 0, totalT = 0, totalL = 0, topT = 0;
  for (let v = 0; v < V; v++) { const k = vt[v].length; totalV += 1 + 5 * k; totalT += 3 * k; topT += k; totalL += 2 * k; }
  const pos = new Float32Array(totalV * 3), dir = new Float32Array(totalV * 3), nor = new Float32Array(totalV * 3), col = new Float32Array(totalV * 3),
    fx = new Float32Array(totalV), shore = new Float32Array(totalV), wcol = new Float32Array(totalV * 3), tex = new Float32Array(totalV),
    top = new Uint8Array(totalV), index = new Uint32Array(totalT * 3);
  const cellStart = new Int32Array(V), cellLen = new Uint16Array(V), lineStart = new Int32Array(V);
  const lpos = new Float32Array(totalL * 3), lposS = new Float32Array(totalL * 3), edgeNbr = new Int32Array(totalL / 2);
  {
    let e = 0;
    for (let v = 0; v < V; v++) {
      const cs = vt[v], k = cs.length;
      for (let i = 0; i < k; i++) {
        const fa = cs[i], fb = cs[(i + 1) % k]; let nb = -1;
        for (let q = 0; q < 3 && nb < 0; q++) { const x = tris[fa * 3 + q]; if (x !== v && (tris[fb * 3] === x || tris[fb * 3 + 1] === x || tris[fb * 3 + 2] === x)) nb = x; }
        edgeNbr[e++] = nb;
      }
    }
  }
  let vp = 0, ip = 0, lp = 0;
  const put = (dx, dy, dz, nx, ny, nz2, isTop) => { const o = vp * 3; dir[o] = dx; dir[o + 1] = dy; dir[o + 2] = dz; nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz2; top[vp] = isTop; return vp++; };
  for (let v = 0; v < V; v++) {
    const cs = vt[v], k = cs.length, b = vp, cx = P[v * 3], cy = P[v * 3 + 1], cz = P[v * 3 + 2];
    cellStart[v] = b; cellLen[v] = 1 + 5 * k; lineStart[v] = lp; lp += 2 * k;
    put(cx, cy, cz, cx, cy, cz, 1);
    for (const f of cs) put(tc[f * 3], tc[f * 3 + 1], tc[f * 3 + 2], cx, cy, cz, 1);
    for (let i = 0; i < k; i++) { index[ip++] = b; index[ip++] = b + 1 + i; index[ip++] = b + 1 + ((i + 1) % k); }
    for (let i = 0; i < k; i++) {
      const a = cs[i], c = cs[(i + 1) % k];
      let mx2 = (tc[a * 3] + tc[c * 3]) / 2, my = (tc[a * 3 + 1] + tc[c * 3 + 1]) / 2, mz = (tc[a * 3 + 2] + tc[c * 3 + 2]) / 2;
      const d = mx2 * cx + my * cy + mz * cz; mx2 -= cx * d; my -= cy * d; mz -= cz * d; const ml = Math.hypot(mx2, my, mz) || 1; mx2 /= ml; my /= ml; mz /= ml;
      const w = put(tc[a * 3], tc[a * 3 + 1], tc[a * 3 + 2], mx2, my, mz, 1);
      put(tc[c * 3], tc[c * 3 + 1], tc[c * 3 + 2], mx2, my, mz, 1);
      put(tc[a * 3], tc[a * 3 + 1], tc[a * 3 + 2], mx2, my, mz, 0);
      put(tc[c * 3], tc[c * 3 + 1], tc[c * 3 + 2], mx2, my, mz, 0);
      index[ip++] = w; index[ip++] = w + 2; index[ip++] = w + 1; index[ip++] = w + 1; index[ip++] = w + 2; index[ip++] = w + 3;
    }
  }
  const dyn = a => a.setUsage(THREE.DynamicDrawUsage);
  const norAttr = new THREE.BufferAttribute(nor, 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', dyn(new THREE.BufferAttribute(pos, 3)));
  geo.setAttribute('normal', norAttr);
  geo.setAttribute('color', dyn(new THREE.BufferAttribute(col, 3)));
  geo.setAttribute('fx', dyn(new THREE.BufferAttribute(fx, 1)));
  geo.setAttribute('shore', dyn(new THREE.BufferAttribute(shore, 1)));
  geo.setAttribute('wcol', dyn(new THREE.BufferAttribute(wcol, 3)));
  geo.setAttribute('tex', dyn(new THREE.BufferAttribute(tex, 1)));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.4);
  const mkLines = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', dyn(new THREE.BufferAttribute(arr, 3))); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.4); return g; };
  return {
    n, V, centers, tc, tri: Int32Array.from(tris), corners: vt, nbr, noise, geo, bgeo: mkLines(lpos), sgeo: mkLines(lposS), norAttr,
    cellStart, cellLen, lineStart, edgeNbr, topT, pos, dir, col, fx, shore, wcol, tex, top, lpos, lposS,
  };
}

// Greedy walk to the cell whose center is closest to the unit vector (x,y,z).
export function nearestCell(g, x, y, z, start = 0) {
  let c = start >= 0 && start < g.V ? start : 0; const cs = g.centers;
  let best = cs[c * 3] * x + cs[c * 3 + 1] * y + cs[c * 3 + 2] * z;
  for (;;) {
    let moved = false; const nb = g.nbr[c];
    for (let i = 0; i < nb.length; i++) { const k = nb[i], d = cs[k * 3] * x + cs[k * 3 + 1] * y + cs[k * 3 + 2] * z; if (d > best) { best = d; c = k; moved = true; } }
    if (!moved) return c;
  }
}
