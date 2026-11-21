// Particle clouds around the planet for mods: snow, ash, dust, swarms, rising sparks.
// ss.particles.forLook(key, opts) creates a cloud that is visible on the planet level while doc.meta.look[key] is set.
//   opts: name, icon (for the «Эффекты» window), count, r0, r1 (shell radii, planet = 1), size, opacity, additive,
//         colors: [{color, weight}], motion: 'fall' | 'rise' | 'orbit' | 'drift', speed, jitter,
//         when(look) — extra condition.
// Per-planet tuning lives in doc.meta.fx[key] = {density, speed, size, opacity (multipliers, 1 = default), color ('' = own colours)}.
// ss.particles.addToggle({key, name, icon, note, mod}) lists a non-particle look flag (e.g. a translucent surface) in the window.
// Returns {points, refresh()}.
export const FX_DEFAULT = {density: 1, speed: 1, size: 1, opacity: 1, color: ''};
const MAX_DENSITY = 3;

export function createParticles(ss) {
  const THREE = ss.THREE, S = ss.scene;
  const clouds = [], effects = [];

  const lookOf = () => (ss.doc && ss.doc.meta && ss.doc.meta.look) || {};
  const fxOf = (key) => ({...FX_DEFAULT, ...((ss.doc && ss.doc.meta && ss.doc.meta.fx && ss.doc.meta.fx[key]) || {})});

  function forLook(key, o = {}) {
    // two mods asking for the same effect key would draw two clouds: the first one stays
    const dup = clouds.find(c => c.key === key);
    if (dup) { console.warn(`[эффекты] «${key}» уже есть, второй раз не добавлен`); return dup; }
    const N = o.count || 3000, CAP = Math.ceil(N * MAX_DENSITY), r0 = o.r0 ?? 1.02, r1 = o.r1 ?? 1.4, motion = o.motion || 'fall', speed = o.speed ?? 0.03, jit = o.jitter ?? 0.004;
    const pos = new Float32Array(CAP * 3), col = new Float32Array(CAP * 3), axis = new Float32Array(CAP * 3), rate = new Float32Array(CAP), shade = new Float32Array(CAP);
    const own = (o.colors || [{color: '#ffffff', weight: 1}]).map(c => ({c: new THREE.Color(c.color), w: c.weight ?? 1}));
    const total = own.reduce((a, c) => a + c.w, 0);
    let tint = null; // THREE.Color when the user picked a colour for this planet
    const pickOwn = () => { let r = Math.random() * total; for (const c of own) { r -= c.w; if (r <= 0) return c.c; } return own[0].c; };
    const paint = (i) => {
      if (tint) { const s = shade[i]; col[i * 3] = Math.min(1, tint.r * s); col[i * 3 + 1] = Math.min(1, tint.g * s); col[i * 3 + 2] = Math.min(1, tint.b * s); return; }
      const c = pickOwn(); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    };
    const seed = (i, fresh) => {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const r = fresh || motion === 'orbit' || motion === 'drift' ? r0 + Math.random() * (r1 - r0) : motion === 'fall' ? r1 : r0;
      pos[i * 3] = s * Math.cos(a) * r; pos[i * 3 + 1] = u * r; pos[i * 3 + 2] = s * Math.sin(a) * r;
      // orbit: each particle circles around its own axis (perpendicular to its position) → a swarm of crossing bands
      const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2];
      let ax = Math.random() - 0.5, ay = Math.random() - 0.5, az = Math.random() - 0.5;
      const d = (ax * px + ay * py + az * pz) / (r * r); ax -= px * d; ay -= py * d; az -= pz * d;
      const l = Math.hypot(ax, ay, az) || 1; axis[i * 3] = ax / l; axis[i * 3 + 1] = ay / l; axis[i * 3 + 2] = az / l;
      rate[i] = 0.5 + Math.random(); shade[i] = 0.7 + Math.random() * 0.5;
      paint(i);
    };
    for (let i = 0; i < CAP; i++) seed(i, true);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    const baseSize = o.size || 0.014, baseOpacity = o.opacity ?? 0.85;
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: baseSize, vertexColors: true, transparent: true, opacity: baseOpacity, depthWrite: false,
      blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    points.frustumCulled = false; points.visible = false; S.tiltGroup.add(points);

    let live = N, spd = 1, tintKey = '';
    const refresh = () => {
      const L = lookOf(), f = fxOf(key);
      live = Math.max(1, Math.min(CAP, Math.round(N * Math.max(0.05, Math.min(MAX_DENSITY, +f.density || 0.05)))));
      geo.setDrawRange(0, live);
      spd = Number.isFinite(+f.speed) ? Math.max(0, +f.speed) : 1;
      points.material.size = baseSize * Math.max(0.2, +f.size || 1);
      points.material.opacity = Math.max(0.03, Math.min(1, baseOpacity * (+f.opacity || 1)));
      const tk = /^#[0-9a-f]{6}$/i.test(f.color || '') ? f.color.toLowerCase() : '';
      if (tk !== tintKey) { tintKey = tk; tint = tk ? new THREE.Color(tk) : null; for (let i = 0; i < CAP; i++) paint(i); geo.attributes.color.needsUpdate = true; }
      points.visible = !!(ss.space && ss.space.nav.level === 'planet' && L[key] && (!o.when || o.when(L)));
    };
    function update(dt) {
      const sp = speed * spd;
      if (!sp) return;
      let recolor = false;
      for (let i = 0; i < live; i++) {
        const k = i * 3; let x = pos[k], y = pos[k + 1], z = pos[k + 2]; const r = Math.hypot(x, y, z);
        if (motion === 'fall' || motion === 'rise') {
          const f = (motion === 'fall' ? -1 : 1) * sp * rate[i] * dt / r;
          x += x * f + (Math.random() - 0.5) * jit; y += y * f + (Math.random() - 0.5) * jit; z += z * f + (Math.random() - 0.5) * jit;
          pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
          if ((motion === 'fall' && r < r0) || (motion === 'rise' && r > r1)) { seed(i, false); recolor = true; }
        } else if (motion === 'orbit') {
          // Rodrigues rotation around the particle's own axis
          const t = sp * rate[i] * dt * 6, c = Math.cos(t), s = Math.sin(t), ax = axis[k], ay = axis[k + 1], az = axis[k + 2];
          const cx = ay * z - az * y, cy = az * x - ax * z, cz = ax * y - ay * x, dp = ax * x + ay * y + az * z;
          pos[k] = x * c + cx * s + ax * dp * (1 - c); pos[k + 1] = y * c + cy * s + ay * dp * (1 - c); pos[k + 2] = z * c + cz * s + az * dp * (1 - c);
        } else { // drift: wind around the planet's axis, faster at the equator, with gusts
          const t = sp * rate[i] * dt * 4 * (1.2 - Math.abs(y / r)), c = Math.cos(t), s = Math.sin(t);
          pos[k] = x * c - z * s; pos[k + 2] = x * s + z * c; pos[k + 1] = y + (Math.random() - 0.5) * jit * 0.75;
          const nr = Math.hypot(pos[k], pos[k + 1], pos[k + 2]); if (nr < r0 || nr > r1) { seed(i, true); recolor = true; }
        }
      }
      geo.attributes.position.needsUpdate = true;
      if (recolor) geo.attributes.color.needsUpdate = true;
    }
    const cloud = {points, refresh, update, key};
    clouds.push(cloud);
    effects.push({key, kind: 'particles', name: o.name || key, icon: o.icon || 'sparkles', note: o.note || '', mod: o.mod || '', colors: (o.colors || []).map(c => c.color)});
    for (const e of ['doc:loaded', 'look:changed', 'level:changed', 'fx:changed']) ss.hooks.on(e, refresh);
    refresh();
    ss.hooks.emit('particles:registered', {key});
    return cloud;
  }

  // a look flag that is not a particle cloud (e.g. a translucent surface) — only listed in the «Эффекты» window
  function addToggle({key, name, icon = '◐', note = '', mod = '', tune = []}) {
    if (effects.some(e => e.key === key)) { console.warn(`[эффекты] «${key}» уже есть`); return; }
    effects.push({key, kind: 'toggle', name: name || key, icon, note, mod, tune});
    ss.hooks.emit('particles:registered', {key});
  }

  ss.hooks.on('frame', ({dt}) => {
    if (!ss.prefs.anim) return;
    for (const c of clouds) if (c.points.visible) c.update(dt);
  }, 8);

  // turn a look flag on/off for the open planet (for "Моды" menu toggles and the «Эффекты» window)
  function toggleLook(key, value) {
    if (!ss.doc) return;
    ss.doc.meta = ss.doc.meta || {};
    const L = {...(ss.doc.meta.look || {})};
    L[key] = value === undefined ? !L[key] : value;
    ss.doc.meta.look = L; ss.docChanged({layer: 'look'}); ss.hooks.emit('look:changed', L);
  }
  // tune an effect on the open planet: patch = {density, speed, size, opacity, color}; null resets it
  function setFx(key, patch) {
    if (!ss.doc) return;
    ss.doc.meta = ss.doc.meta || {};
    const all = {...(ss.doc.meta.fx || {})};
    if (patch === null) delete all[key]; else all[key] = {...(all[key] || {}), ...patch};
    ss.doc.meta.fx = all; ss.docChanged({layer: 'look'}); ss.hooks.emit('fx:changed', {key, fx: all[key] || null});
  }
  const list = () => effects.slice();
  return {forLook, addToggle, toggleLook, lookOf, setFx, fxOf, list};
}
