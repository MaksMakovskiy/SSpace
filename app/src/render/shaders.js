// Builds the terrain shader from the effects and textures registries.
// Each effect gets a numeric slot (registry order, 1-based); each surface texture likewise.
// Snippet variables available to effect/texture GLSL:
//   diffuseColor (vec4), totalEmissiveRadiance (vec3), nP (unit position, planet space), vP (position),
//   vNv (view-space normal), uTime, uLight (view-space star dir), uLightObj (planet-space star dir), sunDot.
//   Texture `height` snippets get `vec3 q` and must return a float; `extra` snippets see h0, lit, q, k.
//   Helper GLSL: hsh(vec3), vnz(vec3), fbm3(vec3), worley(vec3).

export const GLSL_LIB = `
float hsh(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vnz(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hsh(i),hsh(i+vec3(1,0,0)),f.x),mix(hsh(i+vec3(0,1,0)),hsh(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hsh(i+vec3(0,0,1)),hsh(i+vec3(1,0,1)),f.x),mix(hsh(i+vec3(0,1,1)),hsh(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm3(vec3 p){float s=0.0,a=0.5;for(int i=0;i<4;i++){s+=a*vnz(p);p=p*2.03+7.1;a*=0.5;}return s/0.9375;}
vec3 h33(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return fract(sin(p)*43758.5453);}
float worley(vec3 p){vec3 i=floor(p),f=fract(p);float d=8.0;
  for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 g=vec3(float(x),float(y),float(z));vec3 r=g+h33(i+g)*0.85-f;d=min(d,dot(r,r));}
  return sqrt(d);}
`;

const f = (x) => { const s = String(Number(x)); return /[.e]/.test(s) ? s : s + '.0'; };

export function terrainKey(ss) { return ss.reg.effects.version + '.' + ss.reg.textures.version; }

export function terrainHook(ss) {
  const U = ss.scene.uniforms;
  return (sh) => {
    Object.assign(sh.uniforms, {uTime: U.uTime, uLight: U.uLight, uLightObj: U.uLightObj, uFreq: U.uFreq, uTexOn: U.uTexOn});
    const effects = ss.reg.effects.list(), texs = ss.reg.textures.list();

    let vx = '';
    effects.forEach((e, i) => { if (e.vertex) vx += `if(fx>${f(i + 0.5)}&&fx<${f(i + 1.5)}){${e.vertex}}\n`; });
    sh.vertexShader = 'uniform float uTime;\nattribute float fx;\nattribute float shore;\nattribute vec3 wcol;\nattribute float tex;\n' +
      'varying float vFx;\nvarying float vShore;\nvarying float vTex;\nvarying vec3 vWcol;\nvarying vec3 vP;\nvarying vec3 vNv;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFx=fx;vShore=shore;vTex=tex;vWcol=wcol;vP=position;vNv=normalize(normalMatrix*objectNormal);\n' + vx);

    let texF = '', hf = 'float hField(float k,vec3 q){float r=0.0;\n', par = '', extra = '';
    texs.forEach((t, i) => {
      const k = i + 1, tone = t.tone || [0.85, 0.25];
      texF += `float texH${k}(vec3 q){${t.height || 'return 0.0;'}}\n`;
      hf += `${i ? 'else ' : ''}if(k<${f(k + 0.5)})r=texH${k}(q);\n`;
      par += `${i ? 'else ' : ''}if(k<${f(k + 0.5)}){S=${f(t.scale ?? 1)};str=${f(t.strength ?? 0.05)};ta=${f(tone[0])};tb=${f(tone[1])};}\n`;
      if (t.extra) extra += `if(k>${f(k - 0.5)}&&k<${f(k + 0.5)}){${t.extra}}\n`;
    });
    hf += 'return r;}\n';

    let fxc = '';
    effects.forEach((e, i) => { fxc += `${i ? 'else ' : ''}if(vFx>${f(i + 0.5)}&&vFx<${f(i + 1.5)}){${e.glsl || ''}}\n`; });

    // The height field is evaluated once per pixel; the bump comes from screen-space derivatives
    // (Mikkelsen's surface-gradient bump). Sampling it 4 times made the shader so large with many textures
    // that some GPU drivers crashed while compiling it. Derivatives need uniform control flow, so they are taken
    // before the branch.
    const texBlock = texs.length ? `
  float k=floor(vTex+0.5);float S=1.0,str=0.05,ta=0.85,tb=0.25;
  ${par}
  vec3 q=vP*uFreq*S;float h0=k>0.5?hField(k,q):0.0;
  float hs=h0*str/(uFreq*S);vec2 dH=vec2(dFdx(hs),dFdy(hs));
  vec3 sx=dFdx(vP),sy=dFdy(vP);
  if(vTex>0.5&&uTexOn>0.5){
    vec3 r1=cross(sy,nP),r2=cross(nP,sx);float det=dot(sx,r1);
    vec3 Np=normalize(abs(det)*nP-sign(det)*(dH.x*r1+dH.y*r2));
    float d0=dot(nP,uLightObj),d1=dot(Np,uLightObj),lit=smoothstep(-0.1,0.2,d0);
    diffuseColor.rgb*=clamp(1.0+2.2*(d1-d0)*lit,0.55,1.5);
    diffuseColor.rgb*=ta+tb*h0;
    ${extra}
  }` : '';

    sh.fragmentShader = 'uniform float uTime;\nuniform vec3 uLight;\nuniform vec3 uLightObj;\nuniform float uFreq;\nuniform float uTexOn;\n' +
      'varying float vFx;\nvarying float vShore;\nvarying float vTex;\nvarying vec3 vWcol;\nvarying vec3 vP;\nvarying vec3 vNv;\n' +
      GLSL_LIB + texF + (texs.length ? hf : '') +
      sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  vec3 nP=normalize(vP);float sunDot=dot(nP,uLightObj);
  ${texBlock}
  if(vShore>0.01){
    float ph=dot(nP,vec3(31.0,17.0,23.0));
    float tide=0.56+0.17*sin(uTime*1.25+ph)+0.05*sin(uTime*3.1+ph*2.3);
    float wet=smoothstep(tide-0.06,tide+0.06,vShore);
    float foam=(1.0-smoothstep(0.0,0.11,abs(vShore-tide)))*0.42;
    float damp=smoothstep(tide-0.28,tide,vShore)*(1.0-wet);
    diffuseColor.rgb*=1.0-0.28*damp;
    diffuseColor.rgb=mix(diffuseColor.rgb,vWcol,wet*0.88);
    diffuseColor.rgb+=vec3(foam);
  }
  ${fxc}`);
  };
}
