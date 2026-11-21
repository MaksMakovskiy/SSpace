// Star, day/night cycle and axial tilt. State lives in ss.doc.sky (saved with the planet).
export function createSky(ss) {
  const THREE = ss.THREE, S = ss.scene, TAU = Math.PI * 2;
  let anim = null, lastClock = '';
  const _q = new THREE.Quaternion(), _gq = new THREE.Quaternion(), _s = new THREE.Vector3(), _lw = new THREE.Vector3();
  const sky = () => ss.doc.sky;

  // local solar time at longitude 0
  function hourNow() {
    _q.copy(S.tiltGroup.quaternion).invert(); _s.copy(S.SUN_DIR).applyQuaternion(_q);
    const th = sky().theta, mx = Math.sin(th), mz = Math.cos(th);
    const phi = Math.atan2(_s.z * mx - _s.x * mz, _s.x * mx + _s.z * mz);
    return ((12 + phi / TAU * 24) % 24 + 24) % 24;
  }
  function phaseName(h) { if (h < 4.5 || h >= 21) return 'ночь'; if (h < 7.5) return 'рассвет'; if (h < 11.5) return 'утро'; if (h < 12.5) return 'полдень'; if (h < 16.5) return 'день'; return 'закат'; }
  function jump(dir) {
    if (anim) { sky().theta = anim.to; anim = null; }
    const h = hourNow(), target = dir > 0 ? (Math.floor(h / 6 + 1e-3) + 1) * 6 : (Math.ceil(h / 6 - 1e-3) - 1) * 6;
    anim = {from: sky().theta, to: sky().theta + (target - h) / 24 * TAU, t: 0};
  }
  function apply() {
    const s = sky();
    S.tiltGroup.rotation.z = s.tilt * Math.PI / 180;
    S.ambient.intensity = s.night / 100;
    ss.hooks.emit('sky:changed', s);
  }
  function set(patch) { Object.assign(sky(), patch); apply(); ss.docChanged({layer: 'sky', silent: true}); }

  ss.hooks.on('frame', ({dt}) => {
    if (!ss.doc) return;
    const s = sky();
    if (anim) {
      anim.t = Math.min(1, anim.t + dt / 0.7); const t = anim.t, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      s.theta = anim.from + (anim.to - anim.from) * e;
      if (t >= 1) { anim = null; s.theta = ((s.theta % TAU) + TAU) % TAU; }
    } else if (!s.paused && !ss.input.holding) {
      s.theta = (s.theta + dt * TAU / (s.dayMin * 60)) % TAU;
    }
    S.globe.rotation.y = s.theta;
    S.sun.getWorldPosition(_lw);
    S.uniforms.uLight.value.copy(_lw).transformDirection(S.camera.matrixWorldInverse);
    S.globe.getWorldQuaternion(_gq).invert();
    S.uniforms.uLightObj.value.copy(_lw).normalize().applyQuaternion(_gq);
    S.uniforms.uSunW.value.copy(_lw).normalize();
    const h = hourNow(), hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    const txt = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    if (txt !== lastClock) { lastClock = txt; ss.hooks.emit('sky:tick', {hour: h, text: txt, phase: phaseName(h)}); }
  }, 50);

  return {
    hourNow, phaseName, jump, apply, set,
    togglePause() { set({paused: !sky().paused}); },
    get clock() { return lastClock; },
  };
}
