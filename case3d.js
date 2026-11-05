// Hudini: 3D-кейс за донат. Сцена на three.js (vendor/three.module.min.js, MIT), свой bloom, частицы и синтез звука.
// Всё считается от времени openAt, поэтому пульт и виджет показывают один и тот же кадр,
// а виджет, открытый посреди анимации, подхватывает её с нужного места (звуки прошлых моментов не догоняет).
(function(){
  'use strict';
  let THREE = null, loading = null, failed = false;
  function load(){
    if(!loading) loading = import(new URL('vendor/three.module.min.js', document.baseURI).href)
      .then(m => { THREE = m; }).catch(e => { failed = true; console.warn('3D недоступен:', e); });
    return loading;
  }
  const scenes = new Map();   // контейнер .case → сцена
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sstep = (a, b, v) => { const x = clamp((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  const easeOutCubic = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const easeOutBack = x => { x = clamp(x, 0, 1); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  // CASE_T, RARITY7, CaseFx объявлены в core.js (общая область видимости скриптов страницы)
  const T = () => typeof CASE_T !== 'undefined' ? CASE_T : { land:1300, lock1:3300, lock2:3650, open:4000, reel:4800, reelDur:8200, reveal:13200 };
  const FX = () => typeof CaseFx !== 'undefined' ? CaseFx : {};
  const RAR = () => typeof RARITY7 !== 'undefined' ? RARITY7 : ['#b0c3d9','#5e98d9','#4b69ff','#8847ff','#d32ce6','#eb4b4b','#e4ae39'];

  // ================== 3D ==================
  const FS_QUAD = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
  const FS_BRIGHT = `uniform sampler2D tex; uniform float th; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tex, vUv); float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c.rgb * smoothstep(th, th + .6, l), 1.); }`;
  const FS_BLUR = `uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
    void main(){ vec3 s = texture2D(tex, vUv).rgb * .227;
      s += (texture2D(tex, vUv + dir * 1.385).rgb + texture2D(tex, vUv - dir * 1.385).rgb) * .316;
      s += (texture2D(tex, vUv + dir * 3.231).rgb + texture2D(tex, vUv - dir * 3.231).rgb) * .07;
      gl_FragColor = vec4(s, 1.); }`;
  const FS_COMP = `uniform sampler2D scene; uniform sampler2D b1; uniform sampler2D b2; uniform float bloom; uniform float expo; uniform float flash; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
    vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
    void main(){ vec4 s = texture2D(scene, vUv); vec3 g = (texture2D(b1, vUv).rgb + texture2D(b2, vUv).rgb * 1.4) * bloom;
      vec3 col = aces((s.rgb + g) * expo) + flash;
      float a = clamp(max(s.a, max(col.r, max(col.g, col.b)) * (1. - s.a) * 1.15), 0., 1.);
      gl_FragColor = vec4(srgb(col), 1.) * a; }`;
  const VS_PTS = `attribute float size; attribute vec3 color; attribute float alpha; varying vec3 vC; varying float vA;
    void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = size * (300. / -mv.z); gl_Position = projectionMatrix * mv; }`;
  const FS_PTS = `varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - .5; float r = length(d); float a = smoothstep(.5, 0., r); a *= a; gl_FragColor = vec4(vC * a * vA * 3., a * vA); }`;
  const VS_BEAM = `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
  const FS_BEAM = `uniform vec3 col; uniform float k; uniform float time; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ float edge = pow(abs(dot(vN, vV)), 1.6); float h = pow(1. - vUv.y, 1.4) * smoothstep(0., .08, vUv.y);
      float streak = .75 + .25 * sin(vUv.x * 40. + time * 2.) * sin(vUv.x * 17. - time * 1.3);
      float a = edge * h * streak * k; gl_FragColor = vec4(col * a * 2.2, a * .6); }`;

  function roundedRect(THREE, w, d, r){
    const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  // Плита с фаской, лежит в плоскости XZ, высота по Y от 0 до h
  function slab(THREE, w, d, h, r, bevel){
    const g = new THREE.ExtrudeGeometry(roundedRect(THREE, w - bevel * 2, d - bevel * 2, Math.max(0.01, r - bevel)),
      { depth: Math.max(0.001, h - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 10 });
    g.rotateX(-Math.PI / 2); g.translate(0, bevel, 0); g.computeVertexNormals();
    return g;
  }
  // Карбон: плетение для цвета и шероховатости корпуса (блики «бегут» по волокнам)
  function carbon(THREE){
    const n = 256, cv = document.createElement('canvas'); cv.width = cv.height = n; const x = cv.getContext('2d');
    const cell = 16;
    for(let yy = 0; yy < n; yy += cell) for(let xx = 0; xx < n; xx += cell){
      const odd = ((xx + yy) / cell) % 2 === 0, g = odd ? x.createLinearGradient(xx, yy, xx + cell, yy) : x.createLinearGradient(xx, yy, xx, yy + cell);
      g.addColorStop(0, '#1a1c21'); g.addColorStop(0.5, '#2c2f36'); g.addColorStop(1, '#16181c');
      x.fillStyle = g; x.fillRect(xx, yy, cell, cell);
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(xx, yy, cell, 1); x.fillRect(xx, yy, 1, cell);
    }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  // Рамка с фаской: скруглённый прямоугольник с вырезом (для светящегося шва и окантовок)
  function ringSlab(THREE, w, d, h, r, t){
    const sh = roundedRect(THREE, w, d, r), hole = roundedRect(THREE, w - t * 2, d - t * 2, Math.max(0.01, r - t));
    sh.holes.push(new THREE.Path(hole.getPoints(24).reverse()));
    const g = new THREE.ExtrudeGeometry(sh, { depth:h, bevelEnabled:false, curveSegments:12 }); g.rotateX(-Math.PI / 2); g.computeVertexNormals(); return g;
  }
  function lidTexture(THREE, el, done){
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 640;
    const x = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const gold = g => { g.addColorStop(0, '#fff4cf'); g.addColorStop(0.35, '#e9c46a'); g.addColorStop(0.6, '#a7772b'); g.addColorStop(1, '#f6dc94'); return g; };
    const draw = img => {
      const W = cv.width, H = cv.height;
      const bg = x.createRadialGradient(W / 2, H * 0.4, 40, W / 2, H / 2, W * 0.7); bg.addColorStop(0, '#20232b'); bg.addColorStop(1, '#0b0c10');
      x.fillStyle = bg; x.fillRect(0, 0, W, H);
      // тонкая гильош-сетка
      x.strokeStyle = 'rgba(233,196,106,.07)'; x.lineWidth = 1.5;
      for(let r = 30; r < W; r += 26){ x.beginPath(); x.ellipse(W / 2, H / 2, r, r * 0.62, 0, 0, Math.PI * 2); x.stroke(); }
      // рамка с уголками
      x.lineWidth = 4; x.strokeStyle = gold(x.createLinearGradient(0, 0, W, H)); x.strokeRect(34, 34, W - 68, H - 68);
      x.lineWidth = 1.5; x.strokeRect(50, 50, W - 100, H - 100);
      for(const [cx, cy] of [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]]){ x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4); x.fillStyle = '#e9c46a'; x.fillRect(-9, -9, 18, 18); x.restore(); }
      if(img){ const k = Math.min(360 / img.width, 250 / img.height); const w = img.width * k, h = img.height * k; x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 18; x.drawImage(img, (W - w) / 2, 105, w, h); x.shadowBlur = 0; }
      const name = el.name.toUpperCase(), ty = img ? 470 : H / 2 + 6;
      let fsz = img ? 70 : 104; x.font = `900 ${fsz}px Montserrat, Arial, sans-serif`;
      while(x.measureText(name).width > W - 160 && fsz > 30){ fsz -= 4; x.font = `900 ${fsz}px Montserrat, Arial, sans-serif`; }
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = 'rgba(0,0,0,.65)'; x.fillText(name, W / 2 + 3, ty + 5);   // тиснение: тень, потом золото
      x.fillStyle = gold(x.createLinearGradient(0, ty - fsz / 2, 0, ty + fsz / 2)); x.fillText(name, W / 2, ty);
      x.font = `700 24px Montserrat, Arial, sans-serif`; x.fillStyle = 'rgba(233,196,106,.75)';
      x.fillText('— LIMITED EDITION —', W / 2, ty + fsz * 0.62 + 18);
      tex.needsUpdate = true;
    };
    draw(null);
    const src = el.logo ? (window.resolveSrc ? window.resolveSrc(el.logo) : el.logo) : '';
    if(src){ const im = new Image(); im.onload = () => { draw(im); done?.(); }; im.src = src; }
    if(document.fonts?.ready) document.fonts.ready.then(() => draw(null)).catch(() => {});
    return tex;
  }
  function radialTex(THREE, inner, outer){
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(cv);
  }

  function build(c, el){
    const host = c._gl; if(!host) return null;
    let renderer;
    try{ renderer = new THREE.WebGLRenderer({ alpha:true, antialias:false, premultipliedAlpha:true, powerPreference:'high-performance' }); }
    catch(e){ failed = true; return null; }
    const low = !!FX().low || el.q === 'low';
    renderer.setPixelRatio(low ? 0.6 : Math.min(1.5, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    host.replaceChildren(renderer.domElement);
    const S = { renderer, low, key:el.openAt, size:[0,0], shake:0, fired:new Set(), t:0, lastT:null };
    const scene = new THREE.Scene(); S.scene = scene;
    const cam = new THREE.PerspectiveCamera(26, 16 / 9, 0.1, 100); S.cam = cam;

    // отражения: тёмная студия с мягкими боксами — длинные чистые блики, как на дорогой технике
    const pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 16), new THREE.MeshBasicMaterial({ color:0x040406, side:THREE.BackSide })));
    const box = (w, h, x, y, z, col, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color:new THREE.Color(col).multiplyScalar(k), side:THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
    box(14, 1.4, 0, 10, 2, '#ffffff', 6); box(1.2, 10, -10, 3, 3, '#ffffff', 3); box(1.2, 10, 10, 3, 1, '#fff3dc', 3);
    box(10, 1, 0, 2, -11, el.cc, 1.1); box(8, 8, 0, 6, 11, '#d9e2ff', 0.6);
    scene.environment = pm.fromScene(env, 0.02).texture; pm.dispose();

    // ---- кейс: графитовый карбон, золотая фурнитура, тонкие неоновые линии ----
    const W = 3.6, D = 2.3, H = 0.78, LH = 0.4;
    const cTex = carbon(THREE); cTex.repeat.set(3, 2);
    const mBody = new THREE.MeshPhysicalMaterial({ color:new THREE.Color('#9aa0ab').lerp(new THREE.Color(el.cc), 0.12), map:cTex, metalness:0.7, roughness:0.34,
      clearcoat:1, clearcoatRoughness:0.06, sheen:0.12, sheenColor:new THREE.Color(el.cc) });
    const mGold = new THREE.MeshPhysicalMaterial({ color:'#d7ae5e', metalness:1, roughness:0.2, clearcoat:0.6, clearcoatRoughness:0.1 });
    const mChrome = new THREE.MeshStandardMaterial({ color:'#aeb3bd', metalness:1, roughness:0.2 });
    const mRubber = new THREE.MeshStandardMaterial({ color:'#0b0c0f', metalness:0, roughness:0.85 });
    const mSeam = new THREE.MeshStandardMaterial({ color:'#000000', emissive:new THREE.Color(el.cc), emissiveIntensity:1.2 });
    const mInner = new THREE.MeshStandardMaterial({ color:'#050506', emissive:new THREE.Color('#ffcf7a'), emissiveIntensity:0, roughness:1 });
    const mFoam = new THREE.MeshStandardMaterial({ color:'#08090b', roughness:1, metalness:0 });
    S.mSeam = mSeam; S.mInner = mInner;
    const root = new THREE.Group(); scene.add(root); S.root = root;
    // тень под кейсом и мягкое свечение за ним
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 5), new THREE.MeshBasicMaterial({ map:radialTex(THREE, 'rgba(0,0,0,.85)', 'rgba(0,0,0,0)'), transparent:true, depthWrite:false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.02; root.add(shadow); S.shadow = shadow;
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(22, 12), new THREE.MeshBasicMaterial({ map:radialTex(THREE, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color:new THREE.Color(el.cc).multiplyScalar(0.18), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }));
    haze.position.set(0, 1.5, -6); root.add(haze); S.haze = haze;
    const caseG = new THREE.Group(); root.add(caseG); S.caseG = caseG;
    const body = new THREE.Mesh(slab(THREE, W, D, H, 0.3, 0.09), mBody); caseG.add(body);
    // утопленная полоса по периметру корпуса и неоновая нить в ней
    const band = new THREE.Mesh(slab(THREE, W + 0.012, D + 0.012, 0.09, 0.3, 0), new THREE.MeshStandardMaterial({ color:'#07080a', metalness:0.8, roughness:0.5 })); band.position.y = 0.3; caseG.add(band);
    // резиновые ножки
    for(const [xx, zz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){ const f = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.06, 20), mRubber); f.position.set(xx * (W / 2 - 0.4), -0.02, zz * (D / 2 - 0.35)); caseG.add(f); }
    // золотые уголки: скруглённые колпачки сверху и снизу
    const capG = slab(THREE, 0.46, 0.46, 0.2, 0.2, 0.05);
    for(const [xx, zz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for(const yy of [-0.03, H + LH - 0.17]){
      const cp = new THREE.Mesh(capG, mGold); cp.position.set(xx * (W / 2 - 0.2), yy, zz * (D / 2 - 0.2)); caseG.add(cp);
    }
    // светящийся шов между корпусом и крышкой
    const seam = new THREE.Mesh(ringSlab(THREE, W + 0.004, D + 0.004, 0.03, 0.3, 0.05), mSeam); seam.position.y = H - 0.015; caseG.add(seam);
    // внутри: поролон с прорезью, из которой бьёт свет
    const foam = new THREE.Mesh(slab(THREE, W - 0.3, D - 0.3, 0.06, 0.2, 0.02), mFoam); foam.position.y = H - 0.12; caseG.add(foam);
    const slot = new THREE.Mesh(slab(THREE, W * 0.42, D * 0.26, 0.02, 0.08, 0), mInner); slot.position.y = H - 0.065; caseG.add(slot);
    // крышка на петлях сзади
    const lidP = new THREE.Group(); lidP.position.set(0, H, -D / 2 + 0.02); caseG.add(lidP); S.lidP = lidP;
    const lid = new THREE.Mesh(slab(THREE, W, D, LH, 0.3, 0.1), mBody); lid.position.z = D / 2 - 0.02; lidP.add(lid);
    const lidIn = new THREE.Mesh(slab(THREE, W - 0.34, D - 0.34, 0.03, 0.2, 0), mFoam); lidIn.position.set(0, -0.01, D / 2 - 0.02); lidP.add(lidIn);
    for(const xx of [-1.2, 1.2]){ const hg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.55, 20), mGold); hg.rotation.z = Math.PI / 2; hg.position.set(xx, 0.02, -0.02); lidP.add(hg); }
    // утопленная табличка с тиснением
    const plateEdge = new THREE.Mesh(slab(THREE, 2.34, 1.5, 0.035, 0.12, 0.012), mGold); plateEdge.position.set(0, LH - 0.005, D / 2 - 0.02); lidP.add(plateEdge);
    const lt = lidTexture(THREE, el);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.24, 1.4), new THREE.MeshPhysicalMaterial({ map:lt, metalness:0.5, roughness:0.32, clearcoat:1, clearcoatRoughness:0.05, emissive:new THREE.Color('#ffffff'), emissiveMap:lt, emissiveIntensity:0.12 }));
    plate.rotation.x = -Math.PI / 2; plate.position.set(0, LH + 0.032, D / 2 - 0.02); lidP.add(plate);
    // неоновая рамка на крышке вокруг таблички
    const ring = new THREE.Mesh(ringSlab(THREE, 2.56, 1.72, 0.012, 0.17, 0.05), mSeam); ring.position.set(0, LH - 0.004, D / 2 - 0.02); lidP.add(ring);
    // защёлки: хромированные пластины с золотым язычком
    S.latches = [];
    for(const xx of [-1.0, 1.0]){
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.05), mChrome); base.position.set(xx, H - 0.16, D / 2 + 0.02); caseG.add(base);
      const pv = new THREE.Group(); pv.position.set(xx, H + 0.2, D / 2 + 0.06); caseG.add(pv);
      const flap = new THREE.Mesh(slab(THREE, 0.42, 0.06, 0.44, 0.03, 0.015), mChrome); flap.position.set(0, -0.44, 0.03); pv.add(flap);
      const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.03), mGold); tongue.position.set(0, -0.4, 0.06); pv.add(tongue);
      const dot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.01), mSeam); dot.position.set(0, -0.2, 0.065); pv.add(dot);
      S.latches.push(pv);
    }
    // ---- свет: мягкий ключевой, два контровых по силуэту, тёплый снизу изнутри ----
    scene.add(new THREE.HemisphereLight(0x9aa6c0, 0x050507, 0.25));
    const key = new THREE.DirectionalLight(0xfff4e6, 1.6); key.position.set(3.5, 8, 6); scene.add(key);
    const rimA = new THREE.SpotLight(new THREE.Color(el.cc), 60, 25, 0.6, 0.7, 1.6); rimA.position.set(-6, 4, -5); rimA.target = caseG; scene.add(rimA);
    const rimB = new THREE.SpotLight(0xdfe8ff, 45, 25, 0.6, 0.7, 1.6); rimB.position.set(6, 3.5, -5); rimB.target = caseG; scene.add(rimB);
    const innerL = new THREE.PointLight(0xffcf7a, 0, 10, 2); innerL.position.set(0, H + 1.3, 0.3); caseG.add(innerL);
    S.rimA = rimA; S.innerL = innerL;
    // ---- луч из кейса ----
    const beamG = new THREE.CylinderGeometry(1.25, 0.7, 8, 64, 1, true); beamG.translate(0, 3.5, 0);
    const beamM = new THREE.ShaderMaterial({ vertexShader:VS_BEAM, fragmentShader:FS_BEAM, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
      uniforms:{ col:{ value:new THREE.Color('#ffd58a') }, k:{ value:0 }, time:{ value:0 } } });
    const beam = new THREE.Mesh(beamG, beamM); beam.position.y = H; caseG.add(beam); S.beamM = beamM;
    // ---- частицы ----
    const N = low ? 700 : 1800;
    const pg = new THREE.BufferGeometry();
    S.P = { n:N, pos:new Float32Array(N * 3), vel:new Float32Array(N * 3), col:new Float32Array(N * 3), size:new Float32Array(N), alpha:new Float32Array(N), life:new Float32Array(N), max:new Float32Array(N), drag:new Float32Array(N), grav:new Float32Array(N), i:0 };
    pg.setAttribute('position', new THREE.BufferAttribute(S.P.pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(S.P.col, 3));
    pg.setAttribute('size', new THREE.BufferAttribute(S.P.size, 1)); pg.setAttribute('alpha', new THREE.BufferAttribute(S.P.alpha, 1));
    const pts = new THREE.Points(pg, new THREE.ShaderMaterial({ vertexShader:VS_PTS, fragmentShader:FS_PTS, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }));
    pts.frustumCulled = false; scene.add(pts); S.pg = pg;
    // ---- пост: bloom ----
    const rtOpt = { type:THREE.HalfFloatType, colorSpace:THREE.LinearSRGBColorSpace };
    S.rtScene = new THREE.WebGLRenderTarget(4, 4, { ...rtOpt, samples: low ? 0 : 4 });
    S.rtA = new THREE.WebGLRenderTarget(4, 4, rtOpt); S.rtB = new THREE.WebGLRenderTarget(4, 4, rtOpt);
    S.rtC = new THREE.WebGLRenderTarget(4, 4, rtOpt); S.rtD = new THREE.WebGLRenderTarget(4, 4, rtOpt);
    const quad = (fs, u) => new THREE.ShaderMaterial({ vertexShader:FS_QUAD, fragmentShader:fs, uniforms:u, depthTest:false, depthWrite:false });
    S.mBright = quad(FS_BRIGHT, { tex:{ value:null }, th:{ value:1.1 } });
    S.mBlur = quad(FS_BLUR, { tex:{ value:null }, dir:{ value:new THREE.Vector2() } });
    S.mComp = quad(FS_COMP, { scene:{ value:null }, b1:{ value:null }, b2:{ value:null }, bloom:{ value:0.8 }, expo:{ value:1 }, flash:{ value:0 } });
    S.mComp.transparent = true; S.mComp.blending = THREE.NoBlending;
    S.fsScene = new THREE.Scene(); S.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    S.fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), S.mBright); S.fsQuad.frustumCulled = false; S.fsScene.add(S.fsQuad);
    return S;
  }
  function pass(S, mat, target){ S.fsQuad.material = mat; S.renderer.setRenderTarget(target); S.renderer.clear(); S.renderer.render(S.fsScene, S.fsCam); }
  function resize(S, host){
    const w = host.clientWidth | 0, h = host.clientHeight | 0; if(!w || !h || (w === S.size[0] && h === S.size[1])) return;
    S.size = [w, h]; S.renderer.setSize(w, h, false); S.cam.aspect = w / h; S.cam.updateProjectionMatrix();
    const pr = S.renderer.getPixelRatio(), W = Math.max(2, w * pr | 0), H = Math.max(2, h * pr | 0);
    S.rtScene.setSize(W, H); S.rtA.setSize(W / 2 | 0, H / 2 | 0); S.rtB.setSize(W / 2 | 0, H / 2 | 0); S.rtC.setSize(W / 6 | 0, H / 6 | 0); S.rtD.setSize(W / 6 | 0, H / 6 | 0);
  }
  // ---- частицы: выпускаем пачкой, считаем на процессоре ----
  function emit(S, n, o){
    const P = S.P, col = new THREE.Color();
    for(let k = 0; k < n; k++){
      const i = P.i; P.i = (P.i + 1) % P.n;
      const a = Math.random() * Math.PI * 2, el = (o.cone ?? 1) * (Math.random() - 0.5) * Math.PI, sp = o.speed * (0.35 + Math.random() * 0.9);
      const dx = o.dir ? o.dir[0] : Math.cos(a) * Math.cos(el), dy = o.dir ? o.dir[1] : Math.sin(el) + (o.up || 0), dz = o.dir ? o.dir[2] : Math.sin(a) * Math.cos(el);
      const sx = (o.spread || 0) * (Math.random() - 0.5), sz = (o.spread || 0) * (Math.random() - 0.5);
      P.pos[i * 3] = o.at[0] + sx; P.pos[i * 3 + 1] = o.at[1]; P.pos[i * 3 + 2] = o.at[2] + sz;
      P.vel[i * 3] = dx * sp + (o.dir ? (Math.random() - 0.5) * sp * 0.6 : 0); P.vel[i * 3 + 1] = dy * sp; P.vel[i * 3 + 2] = dz * sp + (o.dir ? (Math.random() - 0.5) * sp * 0.6 : 0);
      col.set(Math.random() < (o.white ?? 0.2) ? '#ffffff' : o.color); P.col.set([col.r, col.g, col.b], i * 3);
      P.size[i] = o.size * (0.5 + Math.random()); P.max[i] = P.life[i] = o.life * (0.6 + Math.random() * 0.8);
      P.drag[i] = o.drag ?? 0.9; P.grav[i] = o.grav ?? -2.5; P.alpha[i] = 1;
    }
  }
  function stepParticles(S, dt){
    const P = S.P;
    for(let i = 0; i < P.n; i++){
      if(P.life[i] <= 0){ P.alpha[i] = 0; continue; }
      P.life[i] -= dt; const d = Math.pow(P.drag[i], dt * 6);
      P.vel[i * 3] *= d; P.vel[i * 3 + 1] = P.vel[i * 3 + 1] * d + P.grav[i] * dt; P.vel[i * 3 + 2] *= d;
      P.pos[i * 3] += P.vel[i * 3] * dt; P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt; P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
      const k = P.life[i] / P.max[i]; P.alpha[i] = k < 0.3 ? k / 0.3 : 1;
    }
    for(const a of ['position', 'alpha']) S.pg.attributes[a].needsUpdate = true;
    S.pg.attributes.color.needsUpdate = true; S.pg.attributes.size.needsUpdate = true;
  }
  // разовые события сцены (не повторяются, если виджет открыли позже)
  function once(S, key, t, at, fn){ if(t >= at && !S.fired.has(key)){ S.fired.add(key); if(t - at < 400) fn(); } }

  function render(S, c, el, t){
    resize(S, c._gl);
    const ct = T(), now = performance.now(), dt = S.lastT == null ? 0 : Math.min(0.05, (now - S.lastT) / 1000); S.lastT = now;
    const win = el.items[el.win], rc = win ? RAR()[win.r] || '#4b69ff' : '#4b69ff', gold = win?.r === 6, top = win && win.r >= 5;
    const H = 0.78;
    // полёт и посадка
    const fly = clamp(t / ct.land, 0, 1), e = easeOutCubic(fly);
    const sx = (1 - e);
    S.caseG.position.set(Math.sin(fly * 3) * sx * 1.5, sx * 5.5, -16 * sx);
    S.caseG.rotation.set(sx * 0.9, sx * Math.PI * 3.2 + Math.sin(t / 1400) * 0.22 * sstep(ct.land, ct.land + 900, t), sx * 0.5);
    const sinceLand = (t - ct.land) / 1000; if(sinceLand > 0 && sinceLand < 0.6) S.caseG.position.y += Math.abs(Math.sin(sinceLand * 14)) * Math.exp(-sinceLand * 9) * 0.32;
    // напряжение: дрожь растёт, шов разгорается
    const tense = sstep(ct.land + 200, ct.open, t) * (t < ct.open + 200 ? 1 : 0);
    const tr = tense * tense * 0.035;
    S.caseG.rotation.x += Math.sin(t * 0.071) * tr + Math.sin(t * 0.113) * tr * 0.6;
    S.caseG.rotation.z += Math.sin(t * 0.093) * tr * 0.8;
    S.caseG.position.x += Math.sin(t * 0.13) * tr * 1.4;
    const pulse = 0.5 + 0.5 * Math.sin(t * (0.006 + tense * 0.018));
    S.mSeam.emissiveIntensity = 0.8 + tense * (1.5 + pulse * 4.5) + (t > ct.open ? 1.5 : 0);
    S.rimA.intensity = 60 + tense * 90 * pulse;
    // защёлки
    S.latches.forEach((l, i) => { const at = i ? ct.lock2 : ct.lock1; l.rotation.x = -easeOutBack((t - at) / 160) * 1.95; });
    // крышка
    const lidK = easeOutBack((t - ct.open) / 650);
    S.lidP.rotation.x = -lidK * 1.92;
    S.mInner.emissiveIntensity = t > ct.open ? 2.2 + 6 * Math.exp(-(t - ct.open) / 600) : tense * 0.3;
    S.innerL.intensity = t > ct.open ? 5 + 28 * Math.exp(-(t - ct.open) / 500) : 0;
    S.beamM.uniforms.time.value = t / 1000;
    const rev = t - ct.reveal;
    S.beamM.uniforms.k.value = t > ct.open ? Math.min(1, (t - ct.open) / 300) * (rev > 0 ? 1.1 + (top ? 0.8 : 0) : 0.55) : 0;
    if(rev > 0){ const k = clamp(rev / 500, 0, 1); S.beamM.uniforms.col.value.set('#ffe7b8').lerp(new THREE.Color(rc), k); S.innerL.color.set('#ffe2a8').lerp(new THREE.Color(rc), k); S.mInner.emissive.set('#ffe6b0').lerp(new THREE.Color(rc), k); }
    // события частиц и тряски
    once(S, 'land', t, ct.land, () => { emit(S, 120, { at:[0, 0.05, 0], speed:3.2, cone:0.15, color:'#9aa3b8', size:0.35, life:1.1, drag:0.82, grav:0.2, spread:3, white:0.1 }); S.shake = 0.12; });
    for(const [k, at, x] of [['l1', ct.lock1, -1.0], ['l2', ct.lock2, 1.0]]) once(S, k, t, at, () => { emit(S, 40, { at:[x, H + 0.1, 1.22], speed:3, color:'#ffd27a', size:0.12, life:0.5, drag:0.86, grav:-6, white:0.5 }); S.shake = 0.06; });
    once(S, 'open', t, ct.open, () => { emit(S, 420, { at:[0, H + 0.1, 0], speed:7, cone:0.5, up:1.6, color:'#ffd9a0', size:0.22, life:1.8, drag:0.9, grav:-3.5, spread:2.2, white:0.45 }); S.shake = 0.22; });
    once(S, 'rev', t, ct.reveal, () => {
      const n = gold ? 900 : top ? 650 : 380;
      emit(S, n, { at:[0, H + 0.2, 0], speed:gold ? 11 : 8, cone:1.2, up:0.8, color:rc, size:gold ? 0.3 : 0.24, life:gold ? 2.8 : 2.1, drag:0.92, grav:-2, spread:1.5, white:gold ? 0.35 : 0.2 });
      if(gold) emit(S, 300, { at:[0, 6, 0], speed:1.5, cone:2, color:'#ffe08a', size:0.2, life:3.5, drag:0.97, grav:-1.6, spread:9, white:0.3 });
      S.shake = gold ? 0.3 : 0.18;
    });
    if(rev > 0 && rev < 6000 && (top || gold) && Math.random() < (gold ? 0.7 : 0.35)) emit(S, gold ? 4 : 2, { at:[0, H + 0.3, 0], speed:4, cone:0.4, up:2.5, color:rc, size:0.18, life:1.6, drag:0.9, grav:-1.5, spread:1.6, white:0.3 });
    if(t > ct.open && rev < 0 && Math.random() < 0.5) emit(S, 1, { at:[0, H + 0.1, 0], speed:1.6, cone:0.2, up:3, color:'#ffe7b8', size:0.12, life:2.2, drag:0.95, grav:0.3, spread:2, white:0.5 });
    stepParticles(S, dt);
    // камера: подлёт ближе при напряжении, отъезд на ленте, толчки
    S.shake *= Math.pow(0.02, dt);
    const near = sstep(ct.land, ct.open, t) * (1 - sstep(ct.open + 300, ct.reel + 300, t));
    const back = sstep(ct.reel - 200, ct.reel + 600, t);
    const cx = Math.sin(t / 2600) * 0.7 * (1 - near * 0.6), cy = 3.3 - near * 0.5 + back * 1.1, cz = 11 - near * 2.6 + back * 2.2;
    const sh = S.shake;
    S.cam.position.set(cx + (Math.random() - 0.5) * sh, cy + (Math.random() - 0.5) * sh, cz);
    S.cam.lookAt(0, 0.4 + back * 0.9, 0);
    // свет и вспышки
    const openFlash = t > ct.open ? Math.exp(-(t - ct.open) / 180) : 0, revFlash = rev > 0 ? Math.exp(-rev / (gold ? 320 : 220)) : 0;
    S.mComp.uniforms.bloom.value = 0.55 + tense * 0.5 + openFlash * 1.8 + revFlash * (gold ? 2.6 : 1.6);
    S.mComp.uniforms.expo.value = 0.95 - back * 0.5 * (rev > 0 ? 0.3 : 1);
    S.mComp.uniforms.flash.value = openFlash * 0.18 + revFlash * (gold ? 0.32 : 0.18);
    // кадр: сцена → яркое → размытие в двух масштабах → сборка
    const r = S.renderer;
    r.setRenderTarget(S.rtScene); r.setClearColor(0x000000, 0); r.clear(); r.render(S.scene, S.cam);
    S.mBright.uniforms.tex.value = S.rtScene.texture; pass(S, S.mBright, S.rtA);
    const blur = (src, dst, x, y, rt) => { S.mBlur.uniforms.tex.value = src.texture; S.mBlur.uniforms.dir.value.set(x / rt.width, y / rt.height); pass(S, S.mBlur, dst); };
    blur(S.rtA, S.rtB, 1, 0, S.rtA); blur(S.rtB, S.rtA, 0, 1, S.rtA);
    S.mBlur.uniforms.tex.value = S.rtA.texture; S.mBlur.uniforms.dir.value.set(0, 0); pass(S, S.mBlur, S.rtC);
    blur(S.rtC, S.rtD, 1.5, 0, S.rtC); blur(S.rtD, S.rtC, 0, 1.5, S.rtC);
    S.mComp.uniforms.scene.value = S.rtScene.texture; S.mComp.uniforms.b1.value = S.rtA.texture; S.mComp.uniforms.b2.value = S.rtC.texture;
    r.setRenderTarget(null); r.setClearColor(0x000000, 0); r.clear(); S.fsQuad.material = S.mComp; r.render(S.fsScene, S.fsCam);
  }
  function dispose(c){
    const S = scenes.get(c); if(!S) return; scenes.delete(c);
    try{
      S.scene.traverse(o => { o.geometry?.dispose(); const m = o.material; if(m){ (Array.isArray(m) ? m : [m]).forEach(x => { x.map?.dispose(); x.dispose(); }); } });
      S.scene.environment?.dispose(); [S.rtScene, S.rtA, S.rtB, S.rtC, S.rtD].forEach(x => x.dispose());
      S.renderer.dispose(); S.renderer.forceContextLoss?.(); S.renderer.domElement.remove();
    }catch{}
  }

  // ================== ЗВУК ==================
  // Синтез без сэмплов: металлические щелчки из резонансов, суб-удары, подъём на фильтре, реверберация свёрткой.
  // Свой звук на любой момент модератор ставит в пульте, тогда синтез для этого момента молчит.
  const A = { ctx:null };
  function ac(vol){
    if(!A.ctx){
      try{ A.ctx = new AudioContext(); }catch{ return null; }
      const x = A.ctx;
      A.out = x.createGain(); A.comp = x.createDynamicsCompressor(); A.comp.threshold.value = -14; A.comp.ratio.value = 3.5; A.comp.attack.value = 0.004; A.comp.release.value = 0.18;
      A.out.connect(A.comp).connect(x.destination);
      // стерео-импульс зала: шум с затуханием и потемнением хвоста
      const len = x.sampleRate * 2.6 | 0, ir = x.createBuffer(2, len, x.sampleRate);
      for(let ch = 0; ch < 2; ch++){ const d = ir.getChannelData(ch); let lp = 0; for(let i = 0; i < len; i++){ const k = i / len; lp += ((Math.random() * 2 - 1) - lp) * (0.9 - k * 0.75); d[i] = lp * Math.pow(1 - k, 3.2) * (i < 80 ? i / 80 : 1); } }
      A.rev = x.createConvolver(); A.rev.buffer = ir; A.revIn = x.createGain(); A.revIn.gain.value = 0.9; A.revIn.connect(A.rev).connect(A.out);
      const nb = x.createBuffer(1, x.sampleRate * 2, x.sampleRate), nd = nb.getChannelData(0); for(let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; A.noise = nb;
    }
    if(A.ctx.state === 'suspended') A.ctx.resume();
    A.out.gain.value = vol;
    return A.ctx;
  }
  function voice(dest, send){ const x = A.ctx, g = x.createGain(); g.connect(dest || A.out); if(send){ const s = x.createGain(); s.gain.value = send; g.connect(s).connect(A.revIn); } return g; }
  function env(g, t0, a, peak, d, curve){ const p = g.gain; p.cancelScheduledValues(t0); p.setValueAtTime(0.0001, t0); p.linearRampToValueAtTime(peak, t0 + a); p.exponentialRampToValueAtTime(0.0001, t0 + a + d); }
  function noise(t0, dur, filt, out){ const x = A.ctx, s = x.createBufferSource(); s.buffer = A.noise; s.loop = true; s.loopStart = Math.random(); s.connect(filt); filt.connect(out); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05); return s; }
  function osc(type, f, t0, dur, out){ const o = A.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); o.connect(out); o.start(t0); o.stop(t0 + dur + 0.05); return o; }
  function bp(f, q){ const b = A.ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; return b; }
  function lp(f, q){ const b = A.ctx.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; b.Q.value = q || 0.7; return b; }
  function hp(f, q){ const b = A.ctx.createBiquadFilter(); b.type = 'highpass'; b.frequency.value = f; b.Q.value = q || 0.7; return b; }
  function pan(v){ const p = A.ctx.createStereoPanner(); p.pan.value = v; return p; }

  const SFX = {
    in(t0){   // свист подлёта, удар посадки и дребезг металла
      const x = A.ctx, land = t0 + 1.25;
      const g = voice(null, 0.35), pn = pan(-0.8); pn.connect(g); const f = bp(300, 1.3);
      f.frequency.setValueAtTime(260, t0); f.frequency.exponentialRampToValueAtTime(2200, t0 + 0.9); f.frequency.exponentialRampToValueAtTime(500, land);
      pn.pan.linearRampToValueAtTime(0.4, land);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.55, t0 + 0.85); g.gain.exponentialRampToValueAtTime(0.0001, land + 0.1);
      noise(t0, 1.4, f, pn);
      SFX.thud(land);
    },
    thud(t0){
      const g = voice(null, 0.2); env(g, t0, 0.004, 0.95, 0.5); const o = osc('sine', 95, t0, 0.6, g); o.frequency.exponentialRampToValueAtTime(36, t0 + 0.35);
      const g2 = voice(null, 0.15); env(g2, t0, 0.002, 0.6, 0.14); noise(t0, 0.2, lp(500), g2);
      [[2800, 0.03], [3650, 0.075], [5100, 0.12], [4300, 0.17]].forEach(([fq, d]) => { const gg = voice(null, 0.4); env(gg, t0 + d, 0.001, 0.14, 0.06); noise(t0 + d, 0.08, bp(fq, 14), gg); });
    },
    tense(t0, dur = 2.6){   // подъём: пилы под открывающимся фильтром, шипение и ускоряющееся сердцебиение
      const x = A.ctx, end = t0 + dur;
      const g = voice(null, 0.3); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.22, end - 0.05); g.gain.linearRampToValueAtTime(0.0001, end);
      const f = lp(180, 7); f.frequency.setValueAtTime(180, t0); f.frequency.exponentialRampToValueAtTime(3200, end); f.connect(g);
      for(const [fq, de] of [[55, 0], [55.4, 0.2], [82.5, -0.15], [110.6, 0.1]]){ const o = osc('sawtooth', fq, t0, dur, f); o.detune.value = de * 100; o.frequency.exponentialRampToValueAtTime(fq * 1.5, end); }
      const gn = voice(null, 0.4); gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(0.13, end - 0.03); gn.gain.linearRampToValueAtTime(0.0001, end);
      const h = hp(900, 1); h.frequency.setValueAtTime(900, t0); h.frequency.exponentialRampToValueAtTime(7000, end); noise(t0, dur, h, gn);
      let tt = t0 + 0.15, step = 0.62;
      while(tt < end - 0.1){ for(const [d, a] of [[0, 0.55], [0.13, 0.35]]){ const hb = voice(null, 0.05); env(hb, tt + d, 0.006, a, 0.16); const o = osc('sine', 62, tt + d, 0.2, hb); o.frequency.exponentialRampToValueAtTime(42, tt + d + 0.15); } tt += step; step = Math.max(0.24, step * 0.86); }
    },
    lock(t0, k = 1){   // защёлка: щелчок пружины, звон металла, глухой стук
      const g = voice(null, 0.3); env(g, t0, 0.0008, 0.7, 0.03); noise(t0, 0.05, bp(3300 * k, 6), g);
      [[1870, 0.11, 0.1], [2930, 0.08, 0.08], [4410, 0.05, 0.06], [6020, 0.03, 0.05]].forEach(([fq, d, a]) => { const gg = voice(null, 0.45); env(gg, t0, 0.001, a, d); osc('sine', fq * k, t0, d + 0.05, gg); });
      const gl = voice(null, 0.1); env(gl, t0 + 0.004, 0.002, 0.45, 0.07); osc('triangle', 150 * k, t0, 0.1, gl);
    },
    open(t0){   // крышка: суб-удар, взрыв воздуха и светлый аккорд в зале
      const g = voice(null, 0.25); env(g, t0, 0.005, 1, 1.25); const o = osc('sine', 64, t0, 1.4, g); o.frequency.exponentialRampToValueAtTime(27, t0 + 0.9);
      const gn = voice(null, 0.35); env(gn, t0, 0.003, 0.7, 0.8); const f = lp(2600, 1); f.frequency.setValueAtTime(2600, t0); f.frequency.exponentialRampToValueAtTime(260, t0 + 0.8); noise(t0, 0.9, f, gn);
      const ga = voice(null, 0.6); env(ga, t0 + 0.02, 0.05, 0.18, 1.6); noise(t0, 1.8, hp(4000), ga);
      [880, 1108.73, 1318.51, 1661.22, 2217.46].forEach((fq, i) => { const gg = voice(null, 1.1); env(gg, t0 + 0.04 + i * 0.03, 0.12, 0.045, 2.4); const oo = osc('sine', fq, t0, 2.8, gg); const l = A.ctx.createOscillator(), lg = A.ctx.createGain(); l.frequency.value = 5 + i; lg.gain.value = fq * 0.004; l.connect(lg).connect(oo.frequency); l.start(t0); l.stop(t0 + 2.8); });
    },
    tick(t0, p){   // щелчок ленты: короткий, чуть разный по высоте
      const g = voice(null, 0.06); env(g, t0, 0.0006, 0.2 + p * 0.05, 0.022);
      const f = hp(800); f.connect(g); osc('square', 1450 + Math.random() * 120, t0, 0.04, f);
      const gn = voice(null, 0); env(gn, t0, 0.0005, 0.12, 0.008); noise(t0, 0.02, hp(3000), gn);
    },
    creep(t0){   // «почти-почти»: тихое нарастание, пока лента ползёт
      const g = voice(null, 0.5); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.12, t0 + 1.4); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.75);
      const f = bp(400, 3); f.frequency.setValueAtTime(400, t0); f.frequency.exponentialRampToValueAtTime(2400, t0 + 1.6); noise(t0, 1.8, f, g);
      const g2 = voice(null, 0.3); g2.gain.setValueAtTime(0.0001, t0); g2.gain.exponentialRampToValueAtTime(0.06, t0 + 1.4); g2.gain.linearRampToValueAtTime(0.0001, t0 + 1.7);
      osc('sine', 220, t0, 1.8, g2).frequency.exponentialRampToValueAtTime(440, t0 + 1.6);
    },
    bell(t0, f, a, d){   // FM-колокол
      const x = A.ctx, g = voice(null, 0.9); env(g, t0, 0.003, a, d);
      const c = osc('sine', f, t0, d + 0.1, g), m = x.createOscillator(), mg = x.createGain();
      m.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 2.2, t0); mg.gain.exponentialRampToValueAtTime(f * 0.05, t0 + d * 0.6);
      m.connect(mg).connect(c.frequency); m.start(t0); m.stop(t0 + d + 0.1);
    },
    pad(t0, notes, dur, a, cut){   // подушка: расстроенные пилы под фильтром
      const g = voice(null, 0.8); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(a, t0 + 0.25); g.gain.setValueAtTime(a, t0 + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      const f = lp(cut, 1.2); f.frequency.setValueAtTime(cut * 0.4, t0); f.frequency.exponentialRampToValueAtTime(cut, t0 + 0.6); f.connect(g);
      for(const n of notes) for(const de of [-9, 0, 8]){ const o = osc('sawtooth', n, t0, dur, f); o.detune.value = de; }
    },
    win(t0, r){
      const big = r >= 5, gold = r === 6;
      if(big){ const g = voice(null, 0.3); env(g, t0, 0.004, 1, gold ? 2 : 1.4); const o = osc('sine', 70, t0, 2.2, g); o.frequency.exponentialRampToValueAtTime(30, t0 + 1.2);
        const gn = voice(null, 0.5); env(gn, t0, 0.002, 0.5, 1); noise(t0, 1.1, lp(1800), gn); }
      const base = gold ? [587.33, 739.99, 880, 1174.66] : big ? [523.25, 659.25, 783.99, 1046.5] : r >= 3 ? [493.88, 622.25, 739.99] : [440, 554.37, 659.25];
      base.forEach((f, i) => SFX.bell(t0 + i * (big ? 0.09 : 0.06), f, big ? 0.16 : 0.12, big ? 2.6 : 1.6));
      if(r >= 3) SFX.pad(t0 + 0.05, base.slice(0, 3).map(f => f / 2), gold ? 4.2 : big ? 3.2 : 2.2, gold ? 0.07 : 0.05, gold ? 2600 : 1900);
      if(gold) for(let i = 0; i < 26; i++){ const tt = t0 + 0.35 + i * 0.07 + Math.random() * 0.04; SFX.bell(tt, 2000 + Math.random() * 3200, 0.03, 0.5); }
      else if(big) for(let i = 0; i < 12; i++) SFX.bell(t0 + 0.3 + i * 0.08, 1800 + Math.random() * 2400, 0.025, 0.4);
    },
  };
  function playFile(src, vol){ try{ const u = window.resolveSrc ? window.resolveSrc(src) : src; if(!u) return; const a = new Audio(u); a.volume = vol; a.play().catch(() => {}); }catch{} }
  function sound(el, k, t0, extra){
    if(el.snd?.[k]){ if(k !== 'tick' || !sound.busy) playFile(el.snd[k], el.vol); return; }
    const sfxKey = k === 'lock2' ? 'lock' : k;
    SFX[sfxKey]?.(t0, extra);
  }
  function audio(c, el, t){
    if(!FX().audio) return;
    const ct = T(), x = ac(el.vol); if(!x) return;
    const S = c._snd && c._snd.key === el.openAt ? c._snd : (c._snd = { key:el.openAt, done:new Set() });
    const win = el.items[el.win];
    const events = [['in', 0], ['tense', ct.land + 150], ['lock', ct.lock1], ['lock2', ct.lock2], ['open', ct.open], ['creep', ct.reel + ct.reelDur * 0.78], ['win', ct.reveal]];
    for(const [k, at] of events){
      if(t >= at - 30 && !S.done.has(k)){ S.done.add(k); if(t - at < 350){
        const t0 = x.currentTime + Math.max(0, (at - t) / 1000);
        if(k === 'tense') sound(el, 'tense', t0, (ct.open - ct.land - 150) / 1000);
        else if(k === 'lock2') sound(el, 'lock2', t0, 1.12);
        else if(k === 'win') sound(el, 'win', t0, win ? win.r : 2);
        else sound(el, k, t0, 1);
      } }
    }
  }

  window.Case3D = {
    frame(c, el, t){
      audio(c, el, t);
      if(failed) { c._gl?.classList.add('nogl'); return; }
      if(!THREE){ load(); return; }
      let S = scenes.get(c);
      if(S && S.key !== el.openAt){ dispose(c); S = null; }
      if(!S){ S = build(c, el); if(!S){ c._gl?.classList.add('nogl'); return; } scenes.set(c, S); }
      try{ render(S, c, el, t); }catch(e){ console.warn(e); failed = true; dispose(c); }
    },
    tick(el, p){ if(!FX().audio) return; const x = ac(el.vol); if(!x) return; sound(el, 'tick', x.currentTime, p); },
    stop(c){ dispose(c); },
    preload: load,
  };
})();
