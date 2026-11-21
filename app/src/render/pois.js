// Points of interest: pin sprites drawn on top of everything; pins on the far side are hidden
// and shown as clickable badges at the planet's edge instead.
// Kinds come from ss.reg.poiKinds {id, sym, name, color}. Pins live in ss.doc.pois {c, kind, name, note}.
export function createPois(ss) {
  const THREE = ss.THREE, S = ss.scene;
  const group = new THREE.Group(); S.globe.add(group);
  const edgeBox = document.getElementById('poiEdge');
  const W = 256, Hh = 200, TIP = 192;
  let sprites = [], edges = [];
  const kindOf = (id) => ss.reg.poiKinds.get(id) || {sym: '?', name: 'Метка', color: '#f4c430'};

  function canvasFor(p, selected) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
    const x = cv.getContext('2d'), K = kindOf(p.kind), cx = 128, cy = 110, r = 46;
    if (p.name) {
      x.font = '700 26px "Segoe UI", sans-serif'; const tw = Math.min(240, x.measureText(p.name).width + 22);
      x.fillStyle = 'rgba(10,13,22,0.82)'; x.beginPath(); if (x.roundRect) x.roundRect(cx - tw / 2, 6, tw, 38, 10); else x.rect(cx - tw / 2, 6, tw, 38); x.fill();
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(p.name, cx, 26, 220);
    }
    x.fillStyle = K.color; x.strokeStyle = selected ? '#ff5a3c' : '#ffffff'; x.lineWidth = selected ? 9 : 6;
    x.beginPath(); x.moveTo(cx - 22, cy + 38); x.lineTo(cx, TIP); x.lineTo(cx + 22, cy + 38); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = '#16130f'; x.font = '800 54px "Segoe UI Symbol","Segoe UI",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(K.sym, cx, cy + 3);
    return cv;
  }
  function makeSprite(i) {
    const p = ss.doc.pois[i];
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: new THREE.CanvasTexture(canvasFor(p, i === ss.editor.poiSel)), sizeAttenuation: false, depthWrite: false, depthTest: false, transparent: true}));
    sp.center.set(0.5, (Hh - TIP) / Hh); sp.scale.set(0.13 * W / Hh, 0.13, 1); sp.renderOrder = 30;
    return sp;
  }
  function badgeHtml(kindId) { const K = kindOf(kindId); return `<span class="badge" style="background:${K.color}">${K.sym}</span>`; }

  function rebuild() {
    for (const sp of sprites) { group.remove(sp); sp.material.map.dispose(); sp.material.dispose(); }
    sprites = []; edgeBox.innerHTML = ''; edges = [];
    if (!ss.doc) return;
    ss.doc.pois.forEach((p, i) => {
      const sp = makeSprite(i); group.add(sp); sprites.push(sp);
      const b = document.createElement('button');
      b.className = 'edgePin' + (i === ss.editor.poiSel ? ' sel' : ''); b.hidden = true;
      b.title = (p.name || kindOf(p.kind).name) + ' — на другой стороне, нажми, чтобы повернуть';
      b.innerHTML = badgeHtml(p.kind) + '<i class="chev"></i>';
      b.onclick = () => { select(i); flyTo(p.c); };
      edgeBox.appendChild(b); edges.push(b);
    });
    ss.hooks.emit('pois:changed');
  }

  const _w = new THREE.Vector3(), _n = new THREE.Vector3(), _c = new THREE.Vector3();
  function update({t}) {
    const V = ss.view, G = V.G; if (!G || !V.H || !ss.doc) return;
    if (ss.space && ss.space.nav.level !== 'planet') { for (const el of edges) el.hidden = true; return; }
    const show = ss.prefs.pois; group.visible = show;
    const cam = S.camera, w = S.canvas.clientWidth, h = S.canvas.clientHeight, cx = w / 2, cy = h / 2;
    S.scene.updateMatrixWorld(); cam.updateMatrixWorld();
    const ang = Math.asin(Math.min(1, 1.02 / cam.position.z));
    const Rpx = Math.tan(ang) / Math.tan(cam.fov * Math.PI / 360) * (h / 2);
    ss.doc.pois.forEach((p, i) => {
      const sp = sprites[i], el = edges[i]; if (!sp || p.c >= G.V) return;
      const r = V.topR(p.c) + 0.006 + 0.004 * (0.5 + 0.5 * Math.sin(t * 2 + i));
      sp.position.set(G.centers[p.c * 3] * r, G.centers[p.c * 3 + 1] * r, G.centers[p.c * 3 + 2] * r);
      _w.copy(sp.position).applyMatrix4(S.globe.matrixWorld);
      _c.copy(cam.position).sub(_w).normalize();
      const front = _n.copy(_w).normalize().dot(_c) > 0.04;
      sp.visible = front;
      if (front || !show) { el.hidden = true; return; }
      _n.copy(_w).applyMatrix4(cam.matrixWorldInverse);
      let dx = _n.x, dy = -_n.y, L = Math.hypot(dx, dy); if (L < 1e-4) { dx = 0; dy = 1; L = 1; } dx /= L; dy /= L;
      el.hidden = false;
      el.style.left = Math.max(18, Math.min(w - 18, cx + dx * (Rpx + 20))) + 'px';
      el.style.top = Math.max(18, Math.min(h - 18, cy + dy * (Rpx + 20))) + 'px';
      el.querySelector('.chev').style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    });
  }
  ss.hooks.on('frame', update, 10);

  function flyTo(c) {
    const G = ss.view.G; if (!G) return;
    S.scene.updateMatrixWorld();
    S.flyToDir(new THREE.Vector3(G.centers[c * 3], G.centers[c * 3 + 1], G.centers[c * 3 + 2]).applyMatrix4(S.globe.matrixWorld));
  }
  function select(i) { ss.editor.poiSel = i; rebuild(); ss.hooks.emit('pois:selected', i); }
  function add(c, kind) {
    ss.doc.pois.push({c, kind: kind || ss.editor.poiKind || (ss.reg.poiKinds.ids()[0] || 'base:riddle'), name: '', note: ''});
    ss.docChanged({layer: 'pois'}); select(ss.doc.pois.length - 1);
    return ss.doc.pois.length - 1;
  }
  function update1(i, patch) { Object.assign(ss.doc.pois[i], patch); ss.docChanged({layer: 'pois'}); rebuild(); }
  function remove(i) { if (i < 0) return; ss.doc.pois.splice(i, 1); ss.editor.poiSel = -1; ss.docChanged({layer: 'pois'}); rebuild(); ss.hooks.emit('pois:selected', -1); }
  const at = (c) => ss.doc.pois.findIndex(p => p.c === c);

  ss.hooks.on('registry:poiKinds', () => { if (ss.doc) rebuild(); });
  return {rebuild, select, add, update: update1, remove, flyTo, at, kindOf, badgeHtml};
}
