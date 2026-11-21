// 3D view for the space levels: universe (galaxies), galaxy (particles, sectors, systems), system (star, orbits, planets).
// Uses its own scene and a top-down orbit camera; the planet level keeps the original scene.
import {galaxyParticles, particleMaterial, glowTexture} from './galaxyGen.js';
import {GALAXY_R, CORE_R, sectorGeom, sectorName, findGalaxy, findSystem, planetPos2D} from './campaign.js';
import {buildGeodesic, nearestCell} from '../core/geometry.js';
import {b64ToU8, hexToRgb} from '../core/util.js';

const LIMITS = {universe: [60, 6000], galaxy: [22, 420], system: [14, 420]};

export function createSpaceView(ss) {
  const THREE = ss.THREE, S = ss.scene;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(45, 1, 0.5, 60000);
  const root = new THREE.Group(); scene.add(root);
  scene.add(new THREE.AmbientLight(0xb8c4e8, 0.35));
  const labelsEl = document.getElementById('spaceLabels');
  const glowTex = glowTexture(THREE);
  const cs = {tx: 0, tz: 0, dist: 240, tilt: 0.62, yaw: 0, min: 22, max: 420};
  let level = null, labels = [], picks = [], linkObjs = [], selMesh = null, hoverMesh = null, previewLine = null;
  let selection = null, hoverSector = null, ringCount = 0;
  const geoCache = new Map(), gridCache = new Map(), lookCache = new Map(), spinners = [];

  // background stars (follow the camera, so they never get closer)
  const bg = (() => {
    const N = 3000, p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u); p[i * 3] = s * Math.cos(a) * 20000; p[i * 3 + 1] = u * 20000; p[i * 3 + 2] = s * Math.sin(a) * 20000; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({color: 0x8a94b0, size: 1.2, sizeAttenuation: false}));
  })();
  scene.add(bg);

  const camp = () => ss.space.campaign;
  const nav = () => ss.space.nav;

  function applyCam() {
    const d = cs.dist, t = cs.tilt;
    cam.position.set(cs.tx + d * Math.sin(t) * Math.sin(cs.yaw), d * Math.cos(t), cs.tz + d * Math.sin(t) * Math.cos(cs.yaw));
    cam.lookAt(cs.tx, 0, cs.tz);
    bg.position.copy(cam.position);
  }

  // ---------- helpers ----------
  function clear() {
    root.traverse(o => { if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose(); if (o.material && !o.userData.sharedMat) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
    root.clear(); spinners.length = 0; labels = []; labelsDirty = true; picks = []; linkObjs = []; selMesh = hoverMesh = previewLine = null;
  }
  // Labels are drawn on one canvas, and only when the camera or the labels change: hundreds of separate HTML
  // elements, each its own compositor layer, cost far more than a few hundred fillText calls.
  const lcv = document.createElement('canvas'); lcv.className = 'slabel-canvas'; labelsEl.appendChild(lcv);
  const lctx = lcv.getContext('2d');
  let labelsDirty = true, lastKey = '';
  function label(text, pos, cls, data) {
    const L = {text, pos: pos.clone(), cls: cls || '', id: data || null, style: {}};
    labels.push(L); labelsDirty = true;
    return L;
  }
  const fonts = () => {
    const cs2 = getComputedStyle(document.body), body = cs2.fontFamily || 'system-ui', disp = cs2.getPropertyValue('--font-display').trim() || body;
    return {
      galaxy: {font: `600 15px ${disp}`, color: '#dfe6ff', ls: '0.6px'},
      system: {font: `600 12px ${body}`, color: '#dfe6ff'},
      planet: {font: `12.5px ${body}`, color: '#dfe6ff'},
      moon: {font: `11.5px ${body}`, color: '#cfd7ee'},
      sector: {font: `10.5px ${body}`, color: 'rgba(200,212,255,.45)', ls: '1px', upper: true},
      named: {font: `600 10.5px ${body}`, color: 'rgba(230,236,255,.8)', ls: '1px', upper: true},
      route: {font: `10.5px ${body}`, color: '#ffffff', box: 'rgba(10,13,22,.7)'},
    };
  };
  let F = null;
  ss.hooks.on('theme:changed', () => { F = null; labelsDirty = true; });
  const styleOf = (L) => { const c = L.cls; return c.includes('named') ? F.named : c.includes('sector') ? F.sector : c.includes('moon') ? F.moon : c.includes('galaxy') ? F.galaxy : c.includes('route') ? F.route : c.includes('planet') ? F.planet : F.system; };
  function drawLabels(w, h, showSectors) {
    const dpr = window.devicePixelRatio || 1, W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (lcv.width !== W || lcv.height !== H) { lcv.width = W; lcv.height = H; lcv.style.width = w + 'px'; lcv.style.height = h + 'px'; }
    if (!F) F = fonts();
    const c = lctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    for (const L of labels) {
      if (L.sector === undefined) L.sector = L.cls.includes('sector');
      if (L.sector && !showSectors && !L.mark) continue;
      const p = project(L.pos, w, h);
      if (!p.ok || p.x < -60 || p.y < -20 || p.x > w + 60 || p.y > h + 20) continue;
      const t0 = L.sector || L.cls.includes('route') ? ss.t(L.text) : L.text; // sector names are the editor's; names of things are yours
      const st = styleOf(L), text = st.upper ? t0.toUpperCase() : t0;
      c.font = st.font; if ('letterSpacing' in c) c.letterSpacing = st.ls || '0px';
      if (st.box) { const tw = c.measureText(text).width + 12; c.fillStyle = st.box; c.beginPath(); c.roundRect ? c.roundRect(p.x - tw / 2, p.y - 8, tw, 16, 4) : c.rect(p.x - tw / 2, p.y - 8, tw, 16); c.fill(); }
      else { c.strokeStyle = 'rgba(0,0,0,.75)'; c.lineWidth = 3.2; c.strokeText(text, p.x, p.y + 0.5); }
      c.fillStyle = L.style.color || st.color; c.fillText(text, p.x, p.y);
      if (L.mark) {
        // a little flag to the left of the name
        const tw = c.measureText(text).width, fx = p.x - tw / 2 - 13, fy = p.y - 7;
        c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.8)';
        c.beginPath(); c.moveTo(fx, fy + 14); c.lineTo(fx, fy); c.stroke();
        c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + 9, fy); c.lineTo(fx + 7, fy + 3.2); c.lineTo(fx + 9, fy + 6.4); c.lineTo(fx, fy + 6.4); c.closePath(); c.lineWidth = 2.4; c.stroke();
        c.fillStyle = L.mark; c.fill(); c.lineWidth = 1.5; c.strokeStyle = L.mark; c.beginPath(); c.moveTo(fx, fy + 14); c.lineTo(fx, fy); c.stroke();
      }
    }
  }
  function glow(color, scale, pos) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTex, color: new THREE.Color(color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true}));
    sp.userData.sharedGeo = true; // three.js sprites share one geometry
    sp.scale.set(scale, scale, 1); sp.position.copy(pos); root.add(sp); return sp;
  }
  // ---------- batched sprites: hundreds of star glows / visited rings in one draw call each ----------
  // size is in world units (like a THREE.Sprite scale); uProj turns it into pixels for the current viewport
  const uProj = {value: 800}, maxPt = (() => { try { return S.renderer.getContext().getParameter(S.renderer.getContext().ALIASED_POINT_SIZE_RANGE)[1] || 512; } catch { return 512; } })();
  const spriteVS = `attribute float size;attribute vec3 color;attribute float phase;varying vec3 vC;varying float vPh;uniform float uProj;uniform float uMax;
    void main(){vC=color;vPh=phase;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=min(uMax,size*uProj/max(0.5,-mv.z));gl_Position=projectionMatrix*mv;}`;
  const glowMat = new THREE.ShaderMaterial({uniforms: {uTex: {value: glowTex}, uProj, uMax: {value: maxPt}}, vertexShader: spriteVS,
    fragmentShader: `uniform sampler2D uTex;varying vec3 vC;varying float vPh;void main(){vec4 t=texture2D(uTex,gl_PointCoord);gl_FragColor=vec4(vC*t.rgb,t.a);}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending});
  // the ring around visited systems: the theme gives its picture (theme.spaceRing = {svg, spin, pulse}); it turns
  // and breathes in the shader, so a few hundred of them cost nothing
  const ringTex = new THREE.Texture(); ringTex.minFilter = THREE.LinearFilter;
  const ringU = {uTex: {value: ringTex}, uProj, uMax: {value: maxPt}, uTime: S.uniforms.uTime, uSpin: {value: 0}, uPulse: {value: 0}};
  const ringMat = new THREE.ShaderMaterial({uniforms: ringU, vertexShader: spriteVS,
    fragmentShader: `uniform sampler2D uTex;uniform float uTime;uniform float uSpin;uniform float uPulse;varying vec3 vC;varying float vPh;
      void main(){vec2 p=gl_PointCoord-0.5;float a=uTime*uSpin+vPh*6.2832*step(0.001,abs(uSpin));float k=1.0+uPulse*sin(uTime*1.8+vPh*6.2832);
        p=mat2(cos(a),-sin(a),sin(a),cos(a))*p*k;vec2 uv=p+0.5;if(uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0)discard;
        vec4 t=texture2D(uTex,vec2(uv.x,1.0-uv.y));if(t.a<0.02)discard;gl_FragColor=t;}`,
    transparent: true, depthWrite: false});
  const DEFAULT_RING = (accent) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><circle cx="64" cy="64" r="56" fill="none" stroke="${accent}" stroke-width="5" stroke-opacity=".85"/><circle cx="64" cy="64" r="60" fill="none" stroke="${accent}" stroke-width="2" stroke-opacity=".25"/></svg>`;
  function loadRingLook() {
    const th = ss.themes && ss.themes.current, look = (th && th.spaceRing) || {};
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff5a3c';
    ringU.uSpin.value = (ss.prefs.themeAnim === false) ? 0 : (look.spin || 0); ringU.uPulse.value = (ss.prefs.themeAnim === false) ? 0 : (look.pulse || 0);
    const svg = typeof look.svg === 'function' ? look.svg(accent) : look.svg || DEFAULT_RING(accent);
    const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 256; c.getContext('2d').drawImage(img, 0, 0, 256, 256); ringTex.image = c; ringTex.needsUpdate = true; };
    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
  setTimeout(loadRingLook, 0);
  ss.hooks.on('theme:changed', () => setTimeout(loadRingLook, 30));
  ss.hooks.on('prefs:changed', () => loadRingLook());
  function spriteBatch(items, mat, order) {
    if (!items.length) return null;
    const n = items.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), ph = new Float32Array(n), c = new THREE.Color();
    items.forEach((it, i) => { pos.set([it.pos.x, it.pos.y, it.pos.z], i * 3); c.set(it.color || '#ffffff'); col.set([c.r, c.g, c.b], i * 3); size[i] = it.size; ph[i] = it.phase || 0; });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1)); g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    const pts = new THREE.Points(g, mat); pts.userData.sharedMat = true; pts.frustumCulled = false; pts.renderOrder = order || 0; root.add(pts); return pts;
  }
  // a planet counts as visited once its map exists: maps are made the first time you open a planet
  const visited = (p) => !!p.doc;

  function circle(r, color, opacity, segments = 128, y = 0) {
    const p = [];
    for (let i = 0; i <= segments; i++) { const a = i / segments * Math.PI * 2; p.push(Math.cos(a) * r, y, Math.sin(a) * r); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    return new THREE.Line(g, new THREE.LineBasicMaterial({color, transparent: true, opacity, depthWrite: false}));
  }
  function galaxyGeo(g, count) {
    const key = [g.seed, g.arms, g.twist, g.coreColor, g.armColor, count].join('|');
    if (!geoCache.has(key)) { if (geoCache.size > 40) geoCache.clear(); geoCache.set(key, galaxyParticles(THREE, g, count)); }
    return geoCache.get(key);
  }
  function galaxyPoints(g, count, scale) {
    const pts = new THREE.Points(galaxyGeo(g, count), particleMaterial(THREE, S.uniforms));
    pts.userData.sharedGeo = true; pts.material.uniforms.uScale.value = scale; return pts;
  }

  // ---------- routes ----------
  function addLinks(list, posOf) {
    const hidden = ss.prefs.routeHidden || {};
    const plain = [], plainC = [];
    for (const l of list) {
      const a = posOf(l.a), b = posOf(l.b); if (!a || !b) continue;
      const type = ss.reg.routeTypes.get(l.type) || {color: '#8899bb', dash: false, name: l.type};
      if (hidden[l.type]) continue;
      const sel = selection && selection.kind === 'link' && selection.id === l.id;
      const color = sel ? '#ffffff' : (l.color || type.color);
      const lift = new THREE.Vector3(0, 0.4, 0);
      linkObjs.push({id: l.id, a: a.clone(), b: b.clone()});
      if (l.name) label(l.name, a.clone().lerp(b, 0.5), 'route');
      // plain lines go into one batch (one draw call for all of them); dashed and selected ones stay separate
      if (!type.dash && !sel) { const c = new THREE.Color(color); plain.push(a.x, a.y + 0.4, a.z, b.x, b.y + 0.4, b.z); plainC.push(c.r, c.g, c.b, c.r, c.g, c.b); continue; }
      const g = new THREE.BufferGeometry().setFromPoints([a.clone().add(lift), b.clone().add(lift)]);
      const len = a.distanceTo(b);
      const mat = type.dash ? new THREE.LineDashedMaterial({color, dashSize: Math.max(1, len / 40), gapSize: Math.max(0.6, len / 70), transparent: true, opacity: sel ? 1 : 0.85, depthWrite: false})
        : new THREE.LineBasicMaterial({color, transparent: true, opacity: sel ? 1 : 0.8, depthWrite: false});
      const line = new THREE.Line(g, mat); if (type.dash) line.computeLineDistances(); line.renderOrder = 5;
      root.add(line);
    }
    if (plain.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(plain, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(plainC, 3));
      const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial({vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false})); ls.renderOrder = 5; root.add(ls);
    }
  }

  // ---------- universe ----------
  function buildUniverse() {
    const c = camp();
    for (const g of c.galaxies) {
      const pos = new THREE.Vector3(g.x, 0, g.z);
      const pts = galaxyPoints(g, 6000, 2.2); pts.position.copy(pos); pts.scale.setScalar(0.6); root.add(pts);
      glow(g.coreColor, 34, pos);
      label(g.name, pos.clone().add(new THREE.Vector3(0, 0, 66)), 'galaxy', g.id).mark = markIn(g);
      picks.push({kind: 'galaxy', id: g.id, pos, r: 60});
    }
    const P = new Map(c.galaxies.map(g => [g.id, new THREE.Vector3(g.x, 0, g.z)]));
    addLinks(c.links, id => P.get(id));
    cs.min = LIMITS.universe[0]; cs.max = LIMITS.universe[1];
  }

  // ---------- galaxy ----------
  function sectorFill(g, key, color, opacity) {
    const {r0, r1, a0, a1} = sectorGeom(g, key);
    const geo = new THREE.RingGeometry(Math.max(0.01, r0), r1, Math.max(8, Math.round((a1 - a0) * 12)), 1, a0, a1 - a0);
    geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false}));
    m.position.y = -0.2; m.renderOrder = 1; return m;
  }
  const markIn = (g) => { for (const k in g.sectors) if (g.sectors[k] && g.sectors[k].mark) return g.sectors[k].mark; for (const s of g.systems) { if (s.mark) return s.mark; for (const p of s.planets) if (p.mark) return p.mark; } return ''; };
  // a marked sector: its border drawn dashed in the mark colour
  function sectorOutline(g, key, color) {
    const {r0, r1, a0, a1} = sectorGeom(g, key), pts = [], n = Math.max(8, Math.round((a1 - a0) * 24));
    const arc = (r, from, to) => { for (let i = 0; i <= n; i++) { const a = from + (to - from) * i / n; pts.push(new THREE.Vector3(Math.cos(a) * r, 0.1, Math.sin(a) * r)); } };
    if (key === 'core') arc(r1, 0, Math.PI * 2); else { arc(r1, a0, a1); arc(r0, a1, a0); pts.push(pts[0].clone()); }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({color, dashSize: 2.2, gapSize: 1.4, transparent: true, opacity: 0.9, depthWrite: false}));
    line.computeLineDistances(); line.renderOrder = 4; return line;
  }
  function buildGalaxy(g) {
    const pts = galaxyPoints(g, 42000, 1); root.add(pts);
    glow(g.coreColor, 70, new THREE.Vector3(0, 0, 0));
    glow('#ffffff', 22, new THREE.Vector3(0, 0, 0));
    // sector grid
    const band = (GALAXY_R - CORE_R) / g.rings;
    for (let i = 0; i <= g.rings; i++) root.add(circle(CORE_R + i * band, 0xc8d4ff, i === g.rings ? 0.28 : 0.16));
    const rad = [];
    for (let s = 0; s < g.slices; s++) { const a = s / g.slices * Math.PI * 2; rad.push(Math.cos(a) * CORE_R, 0, Math.sin(a) * CORE_R, Math.cos(a) * GALAXY_R, 0, Math.sin(a) * GALAXY_R); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rad, 3));
    root.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({color: 0xc8d4ff, transparent: true, opacity: 0.14, depthWrite: false})));
    // sector fills and names
    const keys = ['core']; for (let r = 0; r < g.rings; r++) for (let s = 0; s < g.slices; s++) keys.push(`${r}:${s}`);
    for (const key of keys) {
      const info = g.sectors[key] || {};
      if (info.color) root.add(sectorFill(g, key, info.color, 0.16));
      const {r0, r1, a0, a1} = sectorGeom(g, key), rm = key === 'core' ? 0 : (r0 + r1) / 2, am = (a0 + a1) / 2;
      const el = label(sectorName(g, key), new THREE.Vector3(Math.cos(am) * rm, 0, Math.sin(am) * rm), 'sector' + (info.name ? ' named' : ''));
      if (info.color) el.style.color = info.color;
      if (info.mark) { el.mark = info.mark; root.add(sectorOutline(g, key, info.mark)); }
    }
    // systems: all star glows in two draw calls; systems with a planet you have opened get a ring
    const glows = [], cores = [], rings = [];
    for (const s of g.systems) {
      const pos = new THREE.Vector3(s.x, 0.5, s.z);
      glows.push({pos, color: s.starColor, size: 7 * s.starSize});
      cores.push({pos, color: '#ffffff', size: 2.2 * s.starSize});
      if (s.planets.some(visited)) rings.push({pos, size: 7.5 + s.starSize * 4, phase: (s.x * 0.37 + s.z * 0.61) % 1});
      label(s.name, pos.clone().add(new THREE.Vector3(0, 0, 3.2 + s.starSize * 1.6)), 'system', s.id).mark = s.mark || (s.planets.find(p => p.mark) || {}).mark || '';
      picks.push({kind: 'system', id: s.id, pos, r: 3 + s.starSize * 2});
    }
    spriteBatch(glows, glowMat, 2); spriteBatch(cores, glowMat, 3); spriteBatch(rings, ringMat, 4); ringCount = rings.length;
    const P = new Map(g.systems.map(s => [s.id, new THREE.Vector3(s.x, 0.5, s.z)]));
    addLinks(g.links, id => P.get(id));
    cs.min = LIMITS.galaxy[0]; cs.max = LIMITS.galaxy[1];
  }

  // ---------- system ----------
  function geoFor(n) {
    if (!gridCache.has(n)) { const G = buildGeodesic(THREE, n); G.geo.dispose(); G.bgeo.dispose(); G.sgeo.dispose(); gridCache.set(n, {centers: G.centers, nbr: G.nbr, V: G.V}); }
    return gridCache.get(n);
  }
  // Mini planet: icosphere colored from the planet's real map.
  function planetMesh(p) {
    const geo = new THREE.IcosahedronGeometry(1, 4);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
    let cached = lookCache.get(p.id);
    if (!cached || cached.doc !== p.doc) {
      cached = {doc: p.doc, cols: null};
      if (p.doc && p.doc.cells) {
        try {
          const d = p.doc, G = geoFor(d.n), cells = b64ToU8(d.cells), pal = d.palette.map(e => hexToRgb(e.color));
          const water = d.palette.map(e => { const ef = e.fx && ss.reg.effects.get(e.fx); return !!(ef && ef.water); });
          const cols = new Float32Array(pos.count * 3); let s = 0;
          for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), l = Math.hypot(x, y, z);
            s = nearestCell(G, x / l, y / l, z / l, s); const t = cells[s], c = pal[t] || [0.5, 0.5, 0.5], k = water[t] ? 0.85 : 1;
            cols[i * 3] = c[0] * k; cols[i * 3 + 1] = c[1] * k; cols[i * 3 + 2] = c[2] * k;
          }
          cached.cols = cols;
        } catch (e) { console.warn('planet preview', e); }
      }
      lookCache.set(p.id, cached);
    }
    if (cached.cols) colors.set(cached.cols); else colors.fill(0.45);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({vertexColors: true}));
    m.scale.setScalar(2.6 * p.size);
    return m;
  }
  let curSys = null;
  const planetPos = (p) => { const [x, z] = planetPos2D(curSys, p); return new THREE.Vector3(x, 0, z); };
  function buildSystem(sys) {
    curSys = sys;
    const star = new THREE.Mesh(new THREE.SphereGeometry(4.5 * sys.starSize, 32, 24), new THREE.MeshBasicMaterial({color: sys.starColor}));
    root.add(star);
    glow(sys.starColor, 46 * sys.starSize, new THREE.Vector3());
    const light = new THREE.PointLight(sys.starColor, 1.6, 0, 0); root.add(light);
    picks.push({kind: 'star', id: sys.id, pos: new THREE.Vector3(), r: 5 * sys.starSize});
    label(sys.name, new THREE.Vector3(0, 0, 7 * sys.starSize + 4), 'system', sys.id).mark = sys.mark || '';
    const sysRings = [];
    for (const p of sys.planets) {
      const par = p.parent && sys.planets.find(x => x.id === p.parent);
      const orbitLine = circle(p.orbit, par ? 0xffd38a : 0xc8d4ff, par ? 0.3 : 0.16, par ? 64 : 128);
      if (par) orbitLine.position.copy(planetPos(par));   // a moon's orbit goes around its planet
      root.add(orbitLine);
      const pos = planetPos(p), m = planetMesh(p); m.position.copy(pos); m.userData.spin = true; spinners.push(m); root.add(m);
      label(p.name, pos.clone().add(new THREE.Vector3(0, 0, 3.2 * p.size + 3)), par ? 'planet moon' : 'planet', p.id).mark = p.mark || '';
      if (visited(p)) sysRings.push({pos, size: 2.6 * p.size * 2 + 3.5, phase: (p.orbit * 0.13) % 1});
      picks.push({kind: 'planet', id: p.id, pos, r: 2.8 * p.size});
    }
    spriteBatch(sysRings, ringMat, 4);
    const P = new Map(sys.planets.map(p => [p.id, planetPos(p)]));
    addLinks(sys.links, id => P.get(id));
    cs.min = LIMITS.system[0]; cs.max = LIMITS.system[1];
  }

  // ---------- selection / hover overlays ----------
  function updateOverlays() {
    if (selMesh) { root.remove(selMesh); selMesh.geometry.dispose(); selMesh.material.dispose(); selMesh = null; }
    if (hoverMesh) { root.remove(hoverMesh); hoverMesh.geometry.dispose(); hoverMesh.material.dispose(); hoverMesh = null; }
    const n = nav();
    if (selection && ['galaxy', 'system', 'planet', 'star'].includes(selection.kind)) {
      const pk = picks.find(p => p.id === selection.id && (p.kind === selection.kind || (selection.kind === 'system' && p.kind === 'star')));
      if (pk) { selMesh = circle(pk.r * 1.6 + 1, 0xff5a3c, 0.95, 64); selMesh.position.copy(pk.pos); selMesh.position.y += 0.6; root.add(selMesh); }
    }
    if (n.level === 'galaxy') {
      const g = findGalaxy(camp(), n.gid);
      const key = selection && selection.kind === 'sector' ? selection.key : null;
      if (g && key) { selMesh = sectorFill(g, key, 0xff5a3c, 0.14); root.add(selMesh); }
      if (g && hoverSector && hoverSector !== key) { hoverMesh = sectorFill(g, hoverSector, 0xffffff, 0.05); root.add(hoverMesh); }
    }
  }

  // ---------- public ----------
  function rebuild() {
    clear();
    const n = nav(), c = camp(); if (!c) return;
    level = n.level;
    if (n.level === 'universe') buildUniverse();
    else if (n.level === 'galaxy') { const g = findGalaxy(c, n.gid); if (g) buildGalaxy(g); }
    else if (n.level === 'system') { const s = findSystem(c, n.gid, n.sid); if (s) buildSystem(s); }
    cs.dist = Math.max(cs.min, Math.min(cs.max, cs.dist));
    updateOverlays();
  }
  function frameAll() {
    const n = nav(), c = camp();
    if (n.level === 'universe') {
      if (!c.galaxies.length) { cs.tx = 0; cs.tz = 0; cs.dist = 600; return; }
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const g of c.galaxies) { minX = Math.min(minX, g.x); maxX = Math.max(maxX, g.x); minZ = Math.min(minZ, g.z); maxZ = Math.max(maxZ, g.z); }
      cs.tx = (minX + maxX) / 2; cs.tz = (minZ + maxZ) / 2; cs.dist = Math.min(cs.max, Math.max(420, Math.max(maxX - minX, maxZ - minZ) * 1.4 + 300));
    } else if (n.level === 'galaxy') { cs.tx = 0; cs.tz = 0; cs.dist = 250; }
    else if (n.level === 'system') {
      const s = findSystem(c, n.gid, n.sid), far = s && s.planets.length ? Math.max(...s.planets.map(p => p.orbit)) : 40;
      cs.tx = 0; cs.tz = 0; cs.dist = Math.min(cs.max, Math.max(60, far * 2.6));
    }
    cs.tilt = 0.62; cs.yaw = 0;
  }
  function focus(x, z, dist) { cs.tx = x; cs.tz = z; if (dist) cs.dist = dist; }

  const _v = new THREE.Vector3();
  function project(p, w, h) { _v.copy(p).project(cam); return {x: (_v.x * 0.5 + 0.5) * w, y: (-_v.y * 0.5 + 0.5) * h, ok: _v.z < 1 && _v.z > -1}; }
  function pxRadius(pos, r, h) { const d = cam.position.distanceTo(pos); return r / d * (h / 2) / Math.tan(cam.fov * Math.PI / 360); }

  function render(dt) {
    const w = S.canvas.clientWidth, h = S.canvas.clientHeight; if (!w || !h) return;
    if (Math.abs(cam.aspect - w / h) > 1e-3) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
    applyCam();
    uProj.value = h / (2 * Math.tan(cam.fov * Math.PI / 360)) * (S.renderer.getPixelRatio ? S.renderer.getPixelRatio() : 1);
    for (const o of spinners) o.rotation.y += dt * 0.15;
    S.renderer.render(scene, cam);
    // labels: redrawn only when the view or the labels changed
    const showSectors = level === 'galaxy' && cs.dist < 330;
    const key = w + ',' + h + ',' + cam.position.x.toFixed(3) + ',' + cam.position.y.toFixed(3) + ',' + cam.position.z.toFixed(3) + ',' + cs.tx.toFixed(3) + ',' + cs.tz.toFixed(3) + ',' + cam.fov;
    if (labelsDirty || key !== lastKey) { labelsDirty = false; lastKey = key; drawLabels(w, h, showSectors); }
  }

  // nearest object (or route) under the cursor
  function pick(cx, cy) {
    const rect = S.canvas.getBoundingClientRect(), x = cx - rect.left, y = cy - rect.top, w = rect.width, h = rect.height;
    applyCam(); cam.updateMatrixWorld();
    let best = null, bd = Infinity;
    for (const pk of picks) {
      const p = project(pk.pos, w, h); if (!p.ok) continue;
      const d = Math.hypot(p.x - x, p.y - y), lim = Math.max(12, pxRadius(pk.pos, pk.r, h));
      if (d < lim && d < bd) { bd = d; best = pk; }
    }
    if (best) return {kind: best.kind === 'star' ? 'system' : best.kind, id: best.id};
    for (const l of linkObjs) {
      const a = project(l.a, w, h), b = project(l.b, w, h); if (!a.ok || !b.ok) continue;
      const vx = b.x - a.x, vy = b.y - a.y, t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy || 1)));
      if (Math.hypot(a.x + vx * t - x, a.y + vy * t - y) < 6) return {kind: 'link', id: l.id};
    }
    return null;
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function groundPoint(cx, cy) {
    const rect = S.canvas.getBoundingClientRect();
    ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    applyCam(); cam.updateMatrixWorld(); ray.setFromCamera(ndc, cam);
    const out = new THREE.Vector3(); return ray.ray.intersectPlane(plane, out) ? out : null;
  }
  function screenOf(pos) { const rect = S.canvas.getBoundingClientRect(); return project(pos, rect.width, rect.height); }
  function setPreview(a, b) {
    if (previewLine) { root.remove(previewLine); previewLine.geometry.dispose(); previewLine.material.dispose(); previewLine = null; }
    if (!a || !b) return;
    previewLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineDashedMaterial({color: 0xffffff, dashSize: 2, gapSize: 1.5, transparent: true, opacity: 0.8}));
    previewLine.computeLineDistances(); root.add(previewLine);
  }
  function posOf(kind, id) { const pk = picks.find(p => p.id === id && (p.kind === kind || (kind === 'system' && p.kind === 'star'))); return pk ? pk.pos.clone() : null; }

  return {
    cam: cs, camera: cam, scene, root, rebuild, render, pick, groundPoint, screenOf, posOf, frameAll, focus, setPreview,
    setSelection(sel) { selection = sel; rebuild(); },
    setHoverSector(key) { if (key !== hoverSector) { hoverSector = key; updateOverlays(); } },
    invalidatePlanet(id) { lookCache.delete(id); },
    planetMesh,
    get picks() { return picks; },
    get ringCount() { return ringCount; },
  };
}
