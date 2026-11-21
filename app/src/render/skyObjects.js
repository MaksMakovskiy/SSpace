// What you see in the sky from a planet: the system's star (its color and size), the orbits of the
// system's planets, and the other planets themselves — click one to fly there.
// The star stays where it is in the planet view (SUN_DIR × 45); the system plane is mapped so that the
// direction "planet → star" points at it, so the other planets appear where they really are.
import {planetPos2D} from '../space/campaign.js';

const STAR_DIST = 45, MAX_DIST = 320;

export function createSkyObjects(ss) {
  const THREE = ss.THREE, S = ss.scene;
  const group = new THREE.Group(); S.world.add(group);
  const labelBox = document.getElementById('skyLabels');
  let items = [];

  function clear() {
    group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    group.clear(); labelBox.innerHTML = ''; items = [];
  }

  function rebuild() {
    clear();
    const sp = ss.space; if (!sp || !sp.campaign || sp.nav.level !== 'planet') return;
    const {s, p} = sp.current(); if (!s || !p) return;

    // the star lights the planet with its own color
    S.sun.color.set(s.starColor);
    S.star.material.color.set(s.starColor);
    S.star.scale.set(9 * s.starSize, 9 * s.starSize, 1);

    // system plane (x,z) → world: "toward the star" → SUN_DIR, the perpendicular → Wv
    const SUN = S.SUN_DIR.clone(), Y = new THREE.Vector3(0, 1, 0);
    const N = Y.clone().sub(SUN.clone().multiplyScalar(Y.dot(SUN))).normalize();
    const Wv = new THREE.Vector3().crossVectors(N, SUN).normalize();
    const [px, pz] = planetPos2D(s, p), len = Math.hypot(px, pz) || 1;
    const ux = -px / len, uz = -pz / len, vx = -uz, vz = ux, k = STAR_DIST / len;
    const map = (dx, dz) => SUN.clone().multiplyScalar((dx * ux + dz * uz) * k).addScaledVector(Wv, (dx * vx + dz * vz) * k);
    const C = SUN.clone().multiplyScalar(STAR_DIST);

    if (ss.prefs.orbits) {
      for (const q of s.planets) {
        const R = q.orbit * k; if (R > MAX_DIST * 1.5) continue;
        // planets orbit the star; moons orbit their planet
        const host = q.parent && s.planets.find(x => x.id === q.parent);
        let center = C;
        if (host) { const [hx, hz] = planetPos2D(s, host); center = map(hx - px, hz - pz); }
        const pts = [];
        for (let i = 0; i <= 160; i++) { const t = i / 160 * Math.PI * 2; pts.push(center.clone().addScaledVector(SUN, R * Math.cos(t)).addScaledVector(Wv, R * Math.sin(t))); }
        const own = q.id === p.id;
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color: own ? 0xffd38a : 0xc8d4ff, transparent: true, opacity: own ? 0.45 : 0.18, depthWrite: false}));
        line.renderOrder = -1; group.add(line);
      }
    }
    if (ss.prefs.otherPlanets) {
      for (const q of s.planets) {
        if (q.id === p.id) continue;
        const [qx, qz] = planetPos2D(s, q);
        const pos = map(qx - px, qz - pz); const dist = pos.length();
        if (dist > MAX_DIST) pos.setLength(MAX_DIST);
        const m = ss.space.view.planetMesh(q);
        // our own moon (or the planet we are a moon of) looks big and close
        const near = q.parent === p.id || p.parent === q.id;
        m.scale.setScalar((near ? Math.max(1.2, Math.min(MAX_DIST, dist) * 0.05) : Math.max(0.7, Math.min(MAX_DIST, dist) * 0.028)) * q.size / (near ? Math.max(0.3, p.size) : 1));
        if (pos.length() < m.scale.x + 1.6) pos.setLength(m.scale.x + 1.6); // never inside our planet
        m.position.copy(pos); m.userData.pid = q.id; group.add(m);
        const el = document.createElement('div'); el.className = 'slabel planet sky'; el.textContent = q.name; labelBox.appendChild(el);
        items.push({mesh: m, pid: q.id, el, name: q.name});
      }
    }
  }

  // hide labels of planets that are behind the planet we stand on
  const _w = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _v = new THREE.Vector3();
  function occluded(world) {
    const cam = S.camera.position; _d.copy(world).sub(cam); const L = _d.length(); _d.divideScalar(L);
    const t = -cam.dot(_d); if (t < 0 || t > L) return false;
    return _c.copy(cam).addScaledVector(_d, t).length() < 1.05;
  }
  ss.hooks.on('frame', () => {
    if (!items.length || !ss.space || ss.space.nav.level !== 'planet') return;
    const w = S.canvas.clientWidth, h = S.canvas.clientHeight;
    for (const it of items) {
      it.mesh.getWorldPosition(_w); it.mesh.rotation.y += 0.002;
      _v.copy(_w).project(S.camera);
      const hidden = _v.z > 1 || occluded(_w);
      if (hidden) { it.el.style.display = 'none'; continue; }
      const x = (_v.x * 0.5 + 0.5) * w, y = (-_v.y * 0.5 + 0.5) * h + 18;
      it.el.style.display = ''; it.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;
    }
  }, 5);

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(cx, cy) {
    if (!items.length) return null;
    const r = S.canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    S.scene.updateMatrixWorld(); ray.setFromCamera(ndc, S.camera);
    const hits = ray.intersectObjects(items.map(i => i.mesh), false);
    if (!hits.length) return null;
    const it = items.find(i => i.mesh === hits[0].object);
    if (!it) return null;
    it.mesh.getWorldPosition(_w);
    return occluded(_w) ? null : it;
  }

  for (const e of ['level:changed', 'space:changed', 'campaign:loaded']) ss.hooks.on(e, rebuild);
  ss.hooks.on('prefs:changed', ({key}) => { if (key === 'orbits' || key === 'otherPlanets') rebuild(); });
  return {rebuild, pick, get items() { return items; }};
}
