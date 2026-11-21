// Built-in content. Registered through the same public API a mod would use.
import {makeNoise} from '../core/util.js';

export function registerCoreContent(ss) {
  const R = ss.reg;

  // ---------- route types (lines between galaxies, systems, planets) ----------
  R.routeTypes.register({id: 'hyperlane', name: 'Гиперпуть', color: '#4cc9f0', dash: false});
  R.routeTypes.register({id: 'trade', name: 'Торговый путь', color: '#f4c430', dash: true});
  R.routeTypes.register({id: 'border', name: 'Граница / фронт', color: '#e0457b', dash: true});
  R.routeTypes.register({id: 'wormhole', name: 'Червоточина', color: '#b48cff', dash: true});
  R.routeTypes.register({id: 'supply', name: 'Снабжение', color: '#7fe3b0', dash: false});

  // ---------- effects (GLSL fragment snippets) ----------
  R.effects.register({
    id: 'water', name: 'Вода: гладь, волны, прибой', water: true,
    vertex: 'transformed*=1.0+0.0009*sin(dot(position,vec3(41.0,33.0,27.0))+uTime*1.7);',
    glsl: `vec3 q=nP*85.0;
      float w=sin(q.x+uTime*1.5)*sin(q.z*0.9-uTime*1.2)+0.6*sin((q.y+q.x)*1.4+uTime*2.1);
      diffuseColor.rgb*=0.92+0.07*w;
      totalEmissiveRadiance+=diffuseColor.rgb*0.2*smoothstep(0.5,1.6,w)+vec3(0.12,0.16,0.2)*smoothstep(1.15,1.6,w);`,
  });
  R.effects.register({
    id: 'glow', name: 'Свечение: пульсирует',
    glsl: `vec3 q=nP*28.0;
      float p=0.5+0.5*sin(uTime*2.0+q.x+q.y*1.3+q.z*0.7);
      float f=0.6+0.4*sin(q.x*3.1-uTime*1.3)*sin(q.z*2.7+uTime*0.9);
      totalEmissiveRadiance+=diffuseColor.rgb*(0.3+0.6*p*f);`,
  });
  R.effects.register({
    id: 'sparkle', name: 'Блеск: искры',
    glsl: `vec3 c=floor(vP*150.0);
      float h=fract(sin(dot(c,vec3(12.9898,78.233,37.719)))*43758.5453);
      float s=pow(max(0.0,sin(uTime*2.2+h*60.0)),28.0)*step(0.55,h);
      totalEmissiveRadiance+=vec3(s)*0.95+diffuseColor.rgb*0.07;`,
  });
  R.effects.register({
    id: 'glass', name: 'Стекло: блики от звезды',
    glsl: `vec3 cid=floor(vP*130.0);
      vec3 rnd=vec3(fract(sin(dot(cid,vec3(12.9898,78.233,37.719)))*43758.5453),
                    fract(sin(dot(cid,vec3(39.346,11.135,83.155)))*24634.6345),
                    fract(sin(dot(cid,vec3(73.156,52.235,9.151)))*12345.6789))-0.5;
      vec3 Nb=normalize(vNv);vec3 N=normalize(Nb+rnd*0.6);vec3 Hh=normalize(uLight+vec3(0.0,0.0,1.0));
      float lt=smoothstep(-0.05,0.25,dot(Nb,uLight));
      float sp=pow(max(dot(N,Hh),0.0),40.0)*lt;float wide=pow(max(dot(Nb,Hh),0.0),12.0)*lt;
      float fres=pow(1.0-max(Nb.z,0.0),3.0);
      totalEmissiveRadiance+=vec3(1.0,0.98,0.93)*(sp*1.7+wide*0.35)+diffuseColor.rgb*(0.06+0.3*fres);`,
  });

  // ---------- surface textures (height fields, bumped against the star) ----------
  R.textures.register({id: 'forest', name: 'Кроны деревьев', scale: 1.0, strength: 0.09, tone: [0.68, 0.42],
    height: 'return 1.0-smoothstep(0.05,0.85,worley(q))+0.12*vnz(q*3.0);'});
  R.textures.register({id: 'grass', name: 'Трава', scale: 1.3, strength: 0.04, tone: [0.9, 0.2],
    height: 'return 0.6*fbm3(q)+0.4*vnz(q*4.0);'});
  R.textures.register({id: 'dunes', name: 'Дюны', scale: 0.6, strength: 0.07, tone: [0.88, 0.2],
    height: 'float wv=fbm3(q*0.7);float s=0.5+0.5*sin(q.x*1.7+q.z*1.1+q.y*0.6+wv*6.0);return s*s;'});
  R.textures.register({id: 'rock', name: 'Камень', scale: 0.8, strength: 0.1, tone: [0.75, 0.4],
    height: 'float r=1.0-abs(vnz(q)*2.0-1.0);return r*r*0.65+0.35*fbm3(q*2.5);'});
  R.textures.register({id: 'snow', name: 'Снег', scale: 0.7, strength: 0.03, tone: [0.95, 0.08],
    height: 'return fbm3(q);'});
  R.textures.register({id: 'city', name: 'Кварталы (ночью огни)', scale: 1.6, strength: 0.08, tone: [0.6, 0.5],
    height: 'vec3 f=fract(q);float m=step(0.16,f.x)*step(0.16,f.y)*step(0.16,f.z);return m*(0.35+0.65*hsh(floor(q)));',
    extra: 'float win=step(0.78,hsh(floor(q*3.0)+3.0))*step(0.1,h0);totalEmissiveRadiance+=vec3(1.0,0.78,0.45)*win*(1.0-lit)*0.9;'});

  // water floors, crystals, metal, paving, molten crust, flowing matter, fungus caps, jungle canopy, circuits
  R.textures.register({id: 'seabed', name: 'Рябь дна', scale: 0.9, strength: 0.05, tone: [0.8, 0.3],
    height: 'float w=fbm3(q*0.5);float r=0.5+0.5*sin(q.x*3.0+q.z*2.0+q.y*1.3+w*5.0);return r*0.55+0.45*(1.0-smoothstep(0.0,0.5,worley(q*1.5)));'});
  R.textures.register({id: 'cracked', name: 'Трещины и корка', scale: 0.9, strength: 0.06, tone: [0.72, 0.32],
    height: 'float c1=smoothstep(0.0,0.05,abs(vnz(q)-0.5)),c2=smoothstep(0.0,0.04,abs(vnz(q*2.3+5.0)-0.5));return 0.25+0.75*c1*c2*(0.85+0.15*fbm3(q*3.0));'});
  R.textures.register({id: 'crystal', name: 'Кристаллические грани', scale: 1.1, strength: 0.12, tone: [0.7, 0.45],
    height: 'float w=worley(q);return pow(1.0-w,2.5)+0.25*hsh(floor(q*3.0));',
    extra: 'float gl=step(0.94,hsh(floor(q*5.0)+floor(uTime*1.5)));totalEmissiveRadiance+=vec3(0.75,0.92,1.0)*gl*(0.25+0.5*lit)*h0;'});
  R.textures.register({id: 'plates', name: 'Металлические плиты', scale: 0.8, strength: 0.07, tone: [0.7, 0.4],
    height: 'vec3 f=fract(q);float seam=step(0.05,f.x)*step(0.05,f.y)*step(0.05,f.z);float riv=1.0-smoothstep(0.0,0.07,length(f-vec3(0.12)));return seam*(0.55+0.45*hsh(floor(q)))+riv*0.4;'});
  R.textures.register({id: 'paving', name: 'Брусчатка и плиты', scale: 1.8, strength: 0.06, tone: [0.75, 0.35],
    height: 'return 1.0-smoothstep(0.25,0.55,worley(q))+0.1*vnz(q*5.0);'});
  R.textures.register({id: 'lavacrust', name: 'Корка лавы (светятся швы)', scale: 1.0, strength: 0.1, tone: [0.55, 0.6],
    height: 'return smoothstep(0.08,0.55,worley(q*1.2))*(0.8+0.2*vnz(q*4.0));',
    extra: 'float seam=1.0-smoothstep(0.0,0.3,h0);totalEmissiveRadiance+=vec3(1.0,0.38,0.06)*seam*(0.7+0.3*sin(uTime*2.0+q.x*3.0+q.z*2.0));'});
  R.textures.register({id: 'flow', name: 'Текучие струи', scale: 0.7, strength: 0.05, tone: [0.75, 0.45],
    height: 'vec3 w=q+vec3(fbm3(q+vec3(uTime*0.06,0.0,0.0)),fbm3(q+vec3(3.1,uTime*0.05,1.7)),fbm3(q+vec3(5.2,1.3,uTime*0.04)))*2.2;return fbm3(w);'});
  R.textures.register({id: 'caps', name: 'Шляпки грибов', scale: 1.4, strength: 0.1, tone: [0.65, 0.5],
    height: 'float w=worley(q);float cap=1.0-smoothstep(0.0,0.48,w);return cap*cap+0.12*vnz(q*7.0);',
    extra: 'float sp=step(0.9,hsh(floor(q*4.0)))*step(0.4,h0);totalEmissiveRadiance+=vec3(0.55,1.0,0.85)*sp*(1.0-lit)*0.6;'});
  R.textures.register({id: 'canopy', name: 'Густой полог джунглей', scale: 1.2, strength: 0.11, tone: [0.6, 0.5],
    height: 'return 0.55*(1.0-smoothstep(0.0,0.75,worley(q)))+0.45*(1.0-smoothstep(0.0,0.6,worley(q*2.3+4.0)));'});
  R.textures.register({id: 'circuit', name: 'Дорожки схем', scale: 0.9, strength: 0.06, tone: [0.6, 0.5],
    height: 'vec3 c=floor(q);vec3 f=fract(q);float r=hsh(c);float lx=1.0-smoothstep(0.0,0.07,abs(f.x-0.5)),lz=1.0-smoothstep(0.0,0.07,abs(f.z-0.5));float pad=1.0-smoothstep(0.08,0.14,length(f-vec3(0.5)));return 0.3+0.7*max(max(r<0.5?lx:lz,pad),step(0.75,r)*max(lx,lz));',
    extra: 'totalEmissiveRadiance+=vec3(0.3,0.85,1.0)*smoothstep(0.85,1.0,h0)*(0.15+0.6*(1.0-lit))*(0.6+0.4*sin(uTime*3.0+q.x*2.0));'});
  R.textures.register({id: 'coral', name: 'Коралловые наросты', scale: 2.2, strength: 0.09, tone: [0.7, 0.45],
    height: 'float a=1.0-smoothstep(0.0,0.42,worley(q));float b=1.0-smoothstep(0.0,0.3,worley(q*2.1+3.0));return max(a,b*0.8);'});

  // ---------- building styles ----------
  R.buildings.register({id: 'houses', name: 'Домики с крышами', build({rnd, pick, spots, put, PALS}) {
    for (const [x, y] of spots(5 + Math.floor(rnd() * 3), 0.62, 0.3)) {
      const sw = 0.16 + rnd() * 0.07, sd = sw * (0.8 + rnd() * 0.4), sh = 0.1 + rnd() * 0.06, rot = rnd() * Math.PI;
      put('box', x, y, rot, sw, sh, sd, pick(PALS.houseWall));
      put('roof', x, y, rot, sw * 1.05, sh * 0.9, sd * 1.05, pick(PALS.houseRoof), sh);
    }
  }});
  R.buildings.register({id: 'town', name: 'Город', build({rnd, pick, spots, put, PALS}) {
    for (const [x, y] of spots(7 + Math.floor(rnd() * 4), 0.66, 0.27)) { const sw = 0.14 + rnd() * 0.08; put('box', x, y, rnd() * 0.4, sw, 0.25 + rnd() * 0.35, sw * (0.8 + rnd() * 0.5), pick(PALS.town)); }
  }});
  R.buildings.register({id: 'towers', name: 'Высотки', build({rnd, pick, spots, put, PALS}) {
    put('box', 0, 0, 0.3, 0.2, 1.4 + rnd() * 0.5, 0.2, pick(PALS.tower));
    for (const [x, y] of spots(7 + Math.floor(rnd() * 4), 0.62, 0.27)) { if (Math.hypot(x, y) < 0.22) continue; const sw = 0.12 + rnd() * 0.06; put('box', x, y, rnd() * 0.5, sw, 0.5 + rnd() * 0.8, sw, pick(PALS.tower)); }
  }});
  R.buildings.register({id: 'fortress', name: 'Крепость', build({corners, pick, put, PALS}) {
    const pts = corners.map(([x, y]) => [x * 0.68, y * 0.68]), k = pts.length;
    for (let i = 0; i < k; i++) {
      const [x, y] = pts[i], [x2, y2] = pts[(i + 1) % k];
      put('box', x, y, 0, 0.15, 0.55, 0.15, pick(PALS.stone));
      put('box', (x + x2) / 2, (y + y2) / 2, Math.atan2(y2 - y, x2 - x), Math.hypot(x2 - x, y2 - y), 0.32, 0.06, PALS.stone[1]);
    }
    put('box', 0, 0, 0.4, 0.28, 0.8, 0.28, PALS.stone[0]);
    put('roof', 0, 0, 0.4, 0.3, 0.25, 0.3, '#5b4a6b', 0.8);
  }});
  R.buildings.register({id: 'domes', name: 'Купола', build({rnd, pick, spots, put, PALS}) {
    for (const [x, y] of spots(3 + Math.floor(rnd() * 2), 0.5, 0.42)) { const rr = 0.18 + rnd() * 0.12; put('dome', x, y, 0, rr, rr * 0.9, rr, pick(PALS.dome)); }
    for (const [x, y] of spots(3, 0.7, 0.5)) put('box', x, y, rnd(), 0.08, 0.12, 0.08, '#d0d7e2');
  }});
  R.buildings.register({id: 'ruins', name: 'Руины', build({rnd, pick, spots, put, PALS}) {
    for (const [x, y] of spots(5 + Math.floor(rnd() * 4), 0.65, 0.24)) { const sw = 0.08 + rnd() * 0.12; put('box', x, y, rnd() * Math.PI, sw, 0.04 + rnd() * 0.22, sw * (0.4 + rnd() * 0.8), pick(PALS.ruin), 0, (rnd() - 0.5) * 0.6); }
  }});

  // Lean a piece toward the cell center: for a piece at angle φ around the center use rot = φ − π/2, tilt > 0.
  const inward = (phi) => phi - Math.PI / 2;

  R.buildings.register({id: 'spaceport', name: 'Космопорт: магнитная пушка', build({rnd, pick, put, PALS}) {
    const H = 2.7;
    put('box', 0, 0, 0, 0.92, 0.06, 0.92, '#5c636e');                       // launch pad
    put('cyl', 0, 0, 0, 0.3, 0.16, 0.3, '#8f9aa8');                          // breech
    put('cyl', 0, 0, 0, 0.11, H, 0.11, '#d8dee6');                           // barrel
    for (let i = 0; i < 9; i++) put('glowRing', 0, 0, 0, 0.36 - i * 0.012, 1.4, 0.36 - i * 0.012, i % 2 ? '#7fe3ff' : '#4cc9f0', 0.32 + i * 0.27); // accelerator coils
    for (let k = 0; k < 3; k++) {                                            // pylons leaning on the barrel
      const phi = k / 3 * Math.PI * 2 + 0.4, r = 0.38;
      put('box', Math.cos(phi) * r, Math.sin(phi) * r, inward(phi), 0.05, 1.55, 0.05, '#aeb8c4', 0, 0.24);
    }
    put('glow', 0, 0, 0, 0.17, 0.17, 0.17, '#bff3ff', H - 0.05);              // muzzle glow
    put('box', -0.52, 0.42, 0.3, 0.26, 0.14, 0.18, pick(PALS.metal));          // hangars
    put('box', 0.5, -0.46, -0.2, 0.22, 0.12, 0.3, pick(PALS.metal));
    put('dome', 0.5, 0.42, 0, 0.14, 0.12, 0.14, '#cfe9f2');                    // control dome
    put('cyl', -0.5, -0.45, 0, 0.03, 0.5, 0.03, '#d8dee6');                    // antenna mast
    put('glow', -0.5, -0.45, 0, 0.05, 0.05, 0.05, '#ff5a3c', 0.5);
  }});
  R.buildings.register({id: 'industry', name: 'Промзона', build({rnd, pick, spots, put, PALS}) {
    for (const [x, y] of spots(4 + Math.floor(rnd() * 2), 0.6, 0.34)) {
      const w = 0.2 + rnd() * 0.1, h = 0.16 + rnd() * 0.14, rot = rnd() * 0.5;
      put('box', x, y, rot, w, h, w * (0.7 + rnd() * 0.5), pick(PALS.industry));
      if (rnd() < 0.7) { const cx = x + (rnd() - 0.5) * w * 0.6, cy = y + (rnd() - 0.5) * w * 0.6, ch = 0.45 + rnd() * 0.35;
        put('cyl', cx, cy, 0, 0.05, ch, 0.05, '#5a5450'); put('ring', cx, cy, 0, 0.065, 0.6, 0.065, '#c4472f', ch - 0.06); }
    }
    for (const [x, y] of spots(2, 0.68, 0.4)) put('cyl', x, y, 0, 0.16, 0.18, 0.16, '#aeb8c4');   // tanks
  }});
  R.buildings.register({id: 'farmstead', name: 'Ферма: амбар, силосы, поля', build({rnd, pick, put, PALS}) {
    const a = rnd() * Math.PI;
    for (let i = -2; i <= 2; i++) {                                           // crop rows
      const ox = Math.cos(a + Math.PI / 2) * i * 0.13, oy = Math.sin(a + Math.PI / 2) * i * 0.13;
      put('box', ox + Math.cos(a) * 0.2, oy + Math.sin(a) * 0.2, a, 0.62, 0.012, 0.1, pick(PALS.field));
    }
    const bx = Math.cos(a) * -0.42, by = Math.sin(a) * -0.42;
    put('box', bx, by, a, 0.2, 0.12, 0.14, '#9b3b2e'); put('roof', bx, by, a, 0.22, 0.09, 0.16, '#5a3a2a', 0.12);
    for (let s = 0; s < 2; s++) { const sx = bx + Math.cos(a + 1.4) * (0.16 + s * 0.1), sy = by + Math.sin(a + 1.4) * (0.16 + s * 0.1);
      put('cyl', sx, sy, 0, 0.08, 0.26, 0.08, '#d8dee6'); put('dome', sx, sy, 0, 0.04, 0.04, 0.04, '#aeb8c4', 0.26); }
  }});
  R.buildings.register({id: 'harbor', name: 'Гавань: склады и краны', build({rnd, pick, spots, put, PALS}) {
    for (const [x, y] of spots(3, 0.55, 0.36)) put('box', x, y, 0, 0.26, 0.12, 0.16, pick(PALS.town));
    for (let k = 0; k < 2; k++) {                                             // cranes
      const phi = rnd() * Math.PI * 2, x = Math.cos(phi) * 0.6, y = Math.sin(phi) * 0.6, rot = rnd() * Math.PI;
      put('box', x, y, rot, 0.05, 0.6, 0.05, '#e0a33a');
      put('box', x + Math.cos(rot) * 0.12, y + Math.sin(rot) * 0.12, rot, 0.4, 0.04, 0.04, '#e0a33a', 0.6);
    }
    for (let i = 0; i < 10; i++) { const x = (rnd() - 0.5) * 0.9, y = (rnd() - 0.5) * 0.9; if (Math.hypot(x, y) > 0.68) continue;
      put('box', x, y, 0, 0.09, 0.05 * (1 + Math.floor(rnd() * 3)), 0.045, pick(PALS.container)); }
  }});
  R.buildings.register({id: 'minehead', name: 'Шахта: копёр и отвалы', build({rnd, pick, spots, put}) {
    for (let k = 0; k < 4; k++) { const phi = k / 4 * Math.PI * 2 + Math.PI / 4, r = 0.2; put('box', Math.cos(phi) * r, Math.sin(phi) * r, inward(phi), 0.04, 0.7, 0.04, '#6d5a3e', 0, 0.26); }
    put('box', 0, 0, 0, 0.12, 0.05, 0.12, '#4a3f33', 0.66);
    put('ring', 0, 0, 0, 0.14, 1.2, 0.14, '#3a3a3a', 0.72);
    put('box', 0.4, 0.2, 0.3, 0.24, 0.12, 0.16, '#7a6a55');
    for (const [x, y] of spots(3, 0.7, 0.3)) if (Math.hypot(x, y) > 0.35) put('cone', x, y, 0, 0.26, 0.16 + rnd() * 0.1, 0.26, rnd() < 0.5 ? '#4d3b33' : '#5f5a55');
  }});
  R.buildings.register({id: 'tents', name: 'Лагерь: палатки и костёр', build({rnd, pick, spots, put, PALS}) {
    for (const [x, y] of spots(6, 0.6, 0.24)) if (Math.hypot(x, y) > 0.2) put('cone', x, y, rnd(), 0.18, 0.16, 0.18, pick(PALS.tent));
    put('glow', 0, 0, 0, 0.07, 0.09, 0.07, '#ff9f1c'); put('glow', 0, 0, 0, 0.035, 0.05, 0.035, '#fff1a8', 0.06);
  }});
  R.buildings.register({id: 'temple', name: 'Храм-зиккурат', build({put}) {
    const steps = 5;
    for (let i = 0; i < steps; i++) { const s = 0.8 - i * 0.14; put('box', 0, 0, 0, s, 0.1, s, i % 2 ? '#c8b27a' : '#b59f68', i * 0.1); }
    put('box', 0, 0, 0, 0.14, 0.14, 0.14, '#e8d8a8', steps * 0.1);
    put('glow', 0, 0, 0, 0.08, 0.08, 0.08, '#ffe08a', steps * 0.1 + 0.16);
  }});
  R.buildings.register({id: 'research', name: 'Научная станция: антенна', build({rnd, pick, put, PALS}) {
    put('dome', -0.25, 0.1, 0, 0.26, 0.2, 0.26, '#e8f4f8');
    put('box', 0.25, 0.25, 0.4, 0.22, 0.1, 0.16, pick(PALS.metal));
    put('cyl', 0.25, -0.3, 0, 0.05, 0.45, 0.05, '#aeb8c4');
    put('cone', 0.25, -0.3, 0, 0.36, 0.1, 0.36, '#d8dee6', 0.45, 0.7);        // tilted dish
    put('glow', 0.25, -0.3, 0, 0.04, 0.04, 0.04, '#7fe3ff', 0.6);
    put('cyl', -0.45, -0.4, 0, 0.02, 0.6, 0.02, '#d8dee6'); put('glow', -0.45, -0.4, 0, 0.04, 0.04, 0.04, '#ff5a3c', 0.6);
  }});

  // ---------- generators ----------
  R.generators.register({
    id: 'continents', name: 'Континенты (земного типа)', icon: 'globe', group: 'Базовые', desc: 'Материки, океаны, горы, леса и пустыни — как Земля.', preview: ['#1d3b6e', '#3fae4a', '#2e7d32', '#d8c16a', '#8a8580', '#eef3f7'], atmosphere: {on: true, color: '#6badff'},
    params: [{id: 'water', name: 'Доля воды', min: 0, max: 95, step: 1, value: 60, unit: '%'}],
    run(ctx) {
      const {G, seed, params, type} = ctx;
      const nE = makeNoise(seed), nM = makeNoise(seed + 7), nW = makeNoise(seed + 13);
      const V = G.V, e = new Float32Array(V), m = new Float32Array(V);
      for (let c = 0; c < V; c++) {
        let x = G.centers[c * 3] * 1.7 + 10, y = G.centers[c * 3 + 1] * 1.7 + 10, z = G.centers[c * 3 + 2] * 1.7 + 10;
        const w = nW(x, y, z, 3) - 0.5; x += w * 1.2; y += w * 1.2; z += w * 1.2;
        e[c] = nE(x, y, z, 6); m[c] = nM(x * 1.3, y * 1.3, z * 1.3, 4);
      }
      const sorted = Float32Array.from(e).sort(), q = f => sorted[Math.min(V - 1, Math.max(0, Math.floor(f * V)))];
      const wf = (params.water ?? 60) / 100;
      const sea = wf <= 0 ? -1 : q(wf), deep = q(wf * 0.55), shallow = q(wf * 0.88), beach = q(wf + (1 - wf) * 0.05), mount = q(wf + (1 - wf) * 0.86), peak = q(wf + (1 - wf) * 0.96);
      const I = {};
      for (const k of ['deep', 'sea', 'shallow', 'sand', 'plains', 'forest', 'jungle', 'swamp', 'desert', 'waste', 'mount', 'snow', 'ice']) I[k] = type('base:' + k);
      const out = new Uint8Array(V);
      for (let c = 0; c < V; c++) {
        const lat = Math.abs(G.centers[c * 3 + 1]), h = e[c], mo = m[c]; let k;
        if (h < sea) k = lat > 0.9 ? 'ice' : h < deep ? 'deep' : h > shallow ? 'shallow' : 'sea';
        else {
          const temp = 1 - lat * 1.15 - (h - sea) * 0.8;
          if (h >= peak) k = 'snow';
          else if (lat > 0.86 || temp < 0.05) k = h >= mount ? 'snow' : 'ice';
          else if (h >= mount) k = 'mount';
          else if (h < beach && wf > 0) k = 'sand';
          else if (temp < 0.28) k = mo > 0.5 ? 'forest' : 'waste';
          else if (mo < 0.36) k = temp > 0.45 ? 'desert' : 'waste';
          else if (mo < 0.52) k = 'plains';
          else if (mo < 0.66) k = 'forest';
          else k = temp > 0.62 ? 'jungle' : 'swamp';
        }
        out[c] = I[k];
      }
      return out;
    },
  });
  R.generators.register({
    id: 'ocean', name: 'Пустая: весь океан', icon: 'ocean', group: 'Базовые', desc: 'Чистый лист: вся планета — океан. Рисуй сам.', preview: ['#1d3b6e', '#2a5ea8'], params: [], atmosphere: {on: true, color: '#6badff'},
    run({G, type}) { return new Uint8Array(G.V).fill(type('base:sea')); },
  });

  // ---------- built-in particle effects (window «Эффекты»; any planet) ----------
  const P = ss.particles;
  P.forLook('rain', {name: 'Дождь', icon: 'rain', count: 4000, r0: 1.01, r1: 1.25, size: 0.008, opacity: 0.6, motion: 'fall', speed: 0.12, jitter: 0.001,
    colors: [{color: '#9fc8ff', weight: 3}, {color: '#d8ecff', weight: 2}]});
  P.forLook('spores', {name: 'Пыльца и споры', icon: 'flower', count: 2500, r0: 1.01, r1: 1.12, size: 0.01, opacity: 0.7, motion: 'drift', speed: 0.025,
    colors: [{color: '#e8f08a', weight: 3}, {color: '#b8f0a0', weight: 2}, {color: '#ffffff', weight: 1}]});
  P.forLook('meteors', {name: 'Метеоритный дождь', icon: 'meteor', count: 500, r0: 1.0, r1: 1.8, size: 0.02, opacity: 1, additive: true, motion: 'fall', speed: 0.35, jitter: 0,
    colors: [{color: '#ffe08a', weight: 2}, {color: '#ffb347', weight: 2}, {color: '#ffffff', weight: 1}]});
  P.forLook('stardust', {name: 'Звёздная пыль на орбите', icon: 'halo', count: 3000, r0: 1.15, r1: 1.7, size: 0.008, opacity: 0.7, additive: true, motion: 'orbit', speed: 0.02,
    colors: [{color: '#ffffff', weight: 3}, {color: '#bcd4ff', weight: 2}, {color: '#ffd9a0', weight: 1}]});
}
