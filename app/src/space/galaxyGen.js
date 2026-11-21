// Deterministic spiral galaxy particle cloud. Coordinates in galaxy units (radius 100), y is thickness.
import {mulberry} from '../core/util.js';

export function galaxyParticles(THREE, g, count) {
  const rnd = mulberry(g.seed);
  const gauss = () => { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count);
  const core = new THREE.Color(g.coreColor), arm = new THREE.Color(g.armColor), white = new THREE.Color('#ffffff'), pink = new THREE.Color('#ff7aa8'), dust = new THREE.Color('#5a4a70');
  const c = new THREE.Color();
  const arms = Math.max(1, g.arms | 0), twist = g.twist;
  for (let i = 0; i < count; i++) {
    const t = rnd(); let x, y, z, s;
    if (t < 0.16) { // bulge
      const r = Math.abs(gauss()) * 9;
      const a = rnd() * Math.PI * 2;
      x = Math.cos(a) * r; z = Math.sin(a) * r; y = gauss() * 3.2 * Math.max(0.2, 1 - r / 30);
      c.copy(core).lerp(white, rnd() * 0.6); s = 1.6 + rnd() * 2.2;
    } else if (t < 0.84) { // arms (logarithmic spirals)
      const k = Math.floor(rnd() * arms), f = Math.pow(rnd(), 0.75);
      const r = 8 + f * 92 + gauss() * 3;
      const base = k / arms * Math.PI * 2;
      const a = base + twist * Math.log(Math.max(1, r) / 8) + gauss() * (0.32 + 0.25 * (1 - f));
      x = Math.cos(a) * r; z = Math.sin(a) * r; y = gauss() * (0.6 + 2 * (1 - f));
      c.copy(arm).lerp(core, Math.max(0, 0.6 - f)).lerp(white, rnd() * 0.35);
      if (rnd() < 0.05) c.copy(pink);
      else if (rnd() < 0.08) c.copy(dust);
      s = 0.8 + rnd() * 1.6;
    } else { // faint disc
      const r = Math.sqrt(rnd()) * 105, a = rnd() * Math.PI * 2;
      x = Math.cos(a) * r; z = Math.sin(a) * r; y = gauss() * 1.2;
      c.copy(arm).lerp(white, 0.3).multiplyScalar(0.55); s = 0.6 + rnd() * 0.8;
    }
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; size[i] = s;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.computeBoundingSphere();
  return geo;
}

// Soft additive points; uScale multiplies point size, uTime adds a faint twinkle.
export function particleMaterial(THREE, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms: {uScale: {value: 1}, uTime: uniforms.uTime, uAlpha: {value: 1}},
    vertexShader: `attribute float size;attribute vec3 color;varying vec3 vC;varying float vTw;uniform float uScale;uniform float uTime;
      void main(){vC=color;vec4 mv=modelViewMatrix*vec4(position,1.0);
        vTw=0.8+0.2*sin(uTime*1.7+position.x*3.1+position.z*2.3);
        gl_PointSize=size*uScale*(320.0/max(1.0,-mv.z));gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying vec3 vC;varying float vTw;uniform float uAlpha;
      void main(){vec2 p=gl_PointCoord-0.5;float d=length(p);float a=smoothstep(0.5,0.0,d);a*=a;
        gl_FragColor=vec4(vC*vTw,a*uAlpha);}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

export function glowTexture(THREE, inner = 'rgba(255,255,255,1)', mid = 'rgba(255,220,170,0.5)') {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(0.2, mid); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}
