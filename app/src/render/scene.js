// Renderer, camera, star, axial tilt and the planet group. Everything per-frame runs through
// ss.hooks 'frame' ({dt, t}); higher priority runs first.
export function createScene(ss) {
  const THREE = ss.THREE;
  const canvas = document.getElementById('view');
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x05070c, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 400);
  camera.position.set(0, 0, 3.3); scene.add(camera);

  // world (turned by the viewer) -> star + tilted axis -> planet (spins once per day)
  const world = new THREE.Group(); world.rotation.x = 0.25; scene.add(world);
  const SUN_DIR = new THREE.Vector3(-1, 0.18, 0.42).normalize();
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.05); sun.position.copy(SUN_DIR).multiplyScalar(10); world.add(sun);
  const ambient = new THREE.AmbientLight(0xa9b8e0, 0.2); scene.add(ambient);
  const starCanvas = document.createElement('canvas'); starCanvas.width = starCanvas.height = 128;
  {
    const x = starCanvas.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,244,214,1)'); g.addColorStop(0.4, 'rgba(255,200,120,0.35)'); g.addColorStop(1, 'rgba(255,170,80,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  }
  const star = new THREE.Sprite(new THREE.SpriteMaterial({map: new THREE.CanvasTexture(starCanvas), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true}));
  star.position.copy(SUN_DIR).multiplyScalar(45); star.scale.set(9, 9, 1); world.add(star);
  const tiltGroup = new THREE.Group(); tiltGroup.rotation.z = 23 * Math.PI / 180; world.add(tiltGroup);
  const globe = new THREE.Group(); tiltGroup.add(globe);

  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.15, 64, 48), new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 uColor;varying vec3 vN;void main(){float i=pow(max(0.0,0.72-dot(vN,vec3(0.,0.,1.))),2.6);gl_FragColor=vec4(uColor,1.0)*i;}',
    uniforms: {uColor: {value: new THREE.Color(0.42, 0.68, 1.0)}},
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
  scene.add(atmo);
  {
    const N = 2200, sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 60, s = Math.sqrt(1 - u * u); sp[i * 3] = r * s * Math.cos(a); sp[i * 3 + 1] = r * u; sp[i * 3 + 2] = r * s * Math.sin(a); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    world.add(new THREE.Points(g, new THREE.PointsMaterial({color: 0xaab4d0, size: 1.4, sizeAttenuation: false})));
  }

  const uniforms = {
    uTime: {value: 0}, uLight: {value: new THREE.Vector3(0, 0, 1)}, uLightObj: {value: new THREE.Vector3(0, 0, 1)},
    uSunW: {value: new THREE.Vector3(1, 0, 0)}, uFreq: {value: 30}, uTexOn: {value: 1},
  };

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const a = Math.min(1, camera.aspect * 0.85);
    camera.fov = 2 * Math.atan(Math.tan(20 * Math.PI / 180) / a) * 180 / Math.PI;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);

  function zoomBy(f) { camera.position.z = Math.max(1.22, Math.min(6, 1 + (camera.position.z - 1) * f)); }
  const _qx = new THREE.Quaternion(), _qy = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  function rotateBy(dx, dy) {
    const k = 0.0042 * (camera.position.z - 1) / 2.3;
    _qy.setFromAxisAngle(Y, dx * k); _qx.setFromAxisAngle(X, dy * k);
    world.quaternion.premultiply(_qy).premultiply(_qx);
  }
  let fly = null;
  // turn the view so that a world-space direction faces the camera
  function flyToDir(worldDir) {
    const q = new THREE.Quaternion().setFromUnitVectors(worldDir.clone().normalize(), new THREE.Vector3(0, 0, 1));
    fly = {from: world.quaternion.clone(), to: q.multiply(world.quaternion.clone()), t: 0};
  }
  function resetView() { world.quaternion.setFromEuler(new THREE.Euler(0.25, 0, 0)); camera.position.z = 3.3; }

  let last = performance.now(), running = false;
  function frame(now) {
    requestAnimationFrame(frame);
    const t = now || performance.now(), dt = Math.min(0.1, (t - last) / 1000); last = t;
    if (ss.prefs.anim) uniforms.uTime.value += dt;
    if (fly) { fly.t = Math.min(1, fly.t + dt / 0.6); const e = 1 - Math.pow(1 - fly.t, 3); world.quaternion.copy(fly.from).slerp(fly.to, e); if (fly.t >= 1) fly = null; }
    ss.hooks.emit('frame', {dt, t: t / 1000});
    // other views (space levels) can take over drawing
    if (api.override) api.override(dt); else renderer.render(scene, camera);
  }
  function start() { if (running) return; running = true; resize(); requestAnimationFrame(frame); }

  const api = {renderer, scene, camera, world, sun, ambient, star, tiltGroup, globe, atmo, SUN_DIR, uniforms, canvas, resize, zoomBy, rotateBy, flyToDir, resetView, start, override: null};
  return api;
}
