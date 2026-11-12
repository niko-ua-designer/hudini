// SPDX-License-Identifier: MIT
// Hudini ready-made animations. Free to copy into your own projects (MIT, see presets/LICENSE).
// Each preset builds keyframes from the element's current position: { mode, end, f:[{ x, y, r, s, o, d, e }] }
//   x, y  position in % of the 16:9 screen · r rotation in degrees · s scale · o opacity
//   d     duration of the step in ms · e easing: linear, in, out, inout, back, bounce
//   mode  once | loop | pingpong · end  stay | hide | back
// Готовые анимации. Строятся от текущего положения элемента.
const SPEED = 0.025; // % экрана за мс для «пролётов»
// DVD-заставка: элемент летит по диагонали и отскакивает краями своей рамки (box = { l, r, t, b } в % экрана), а не центром.
// Путь замкнутый: по x 3 пробега туда-обратно, по y 2, так что углы попадаются редко, как в оригинале.
function dvdPath(el, box, F){
  const hw=box ? Math.max(0, (box.r-box.l)/2) : 5, hh=box ? Math.max(0, (box.b-box.t)/2) : 5;
  const minX=Math.min(hw, 49), maxX=100-minX, minY=Math.min(hh, 49), maxY=100-minY, Wx=maxX-minX, Wy=maxY-minY;
  const clamp=(v,a,b)=>Math.min(b, Math.max(a, v));
  const sx=(clamp(el.x, minX, maxX)-minX)/Wx, sy=(clamp(el.y, minY, maxY)-minY)/Wy;   // где на пути сейчас элемент
  const KX=6, KY=4;   // полуциклов за круг
  const T=Math.hypot(KX*Wx*16, KY*Wy*9)/(SPEED*1.6*16);   // скорость как раньше: ~0.04 % ширины в мс
  const tri=ph=>{ const f=((ph%2)+2)%2; return f<=1 ? f : 2-f; };
  const ev=new Set([0]);
  for(let n=1;n<=KX;n++) ev.add(Math.round((n-sx)/KX*T));
  for(let n=1;n<=KY;n++) ev.add(Math.round((n-sy)/KY*T));
  const ts=[...ev].filter(t=>t>=0 && t<Math.round(T)).sort((a,b)=>a-b);
  return { mode:'loop', end:'stay', f:ts.map((t,i)=>F({ x:minX+Wx*tri(sx+KX*t/T), y:minY+Wy*tri(sy+KY*t/T), e:'linear', d:Math.max(1, (i+1<ts.length ? ts[i+1] : Math.round(T))-t) })) };
}
function kfPreset(name, el, box){
  const x=el.x, y=el.y, r=el.rot, F=(o)=>({ x, y, r, s:1, o:1, d:800, e:'inout', ...o });
  const dist=(a,b)=>Math.hypot(b.x-a.x, (b.y-a.y)*9/16);
  switch(name){
    case 'flyLR': return { mode:'once', end:'hide', f:[F({ x:-30, d:4500, e:'linear' }), F({ x:130 })] };
    case 'flyRL': return { mode:'once', end:'hide', f:[F({ x:130, d:4500, e:'linear' }), F({ x:-30 })] };
    case 'flyUp': return { mode:'once', end:'hide', f:[F({ y:130, d:6000, e:'linear' }), F({ y:-30 })] };
    case 'slideIn': return { mode:'once', end:'hide', f:[F({ x:-30, d:700, e:'out' }), F({ d:3000, e:'linear' }), F({ d:600, e:'in' }), F({ x:130 })] };
    case 'drop': return { mode:'once', end:'stay', f:[F({ y:-30, d:1100, e:'bounce' }), F({})] };
    case 'zoom': return { mode:'once', end:'hide', f:[F({ s:0, d:450, e:'back' }), F({ d:2500, e:'linear' }), F({ d:300, e:'in' }), F({ s:0 })] };
    case 'spinIn': return { mode:'once', end:'stay', f:[F({ s:0, r:r-360, o:0, d:900, e:'out' }), F({})] };
    case 'orbit': return { mode:'loop', end:'stay', f:Array.from({ length:12 }, (_,i)=>{ const a=i/12*Math.PI*2; return F({ x:x+Math.cos(a)*6, y:y+Math.sin(a)*6*16/9, d:250, e:'linear' }); }) };
    case 'zigzag': return { mode:'pingpong', end:'stay', f:[-2,-1,0,1,2].map(i=>F({ x:x+i*8, y:y-(i%2?7:0), d:450, e:'inout' })) };
    case 'swing': return { mode:'pingpong', end:'stay', f:[F({ r:r-15, d:900 }), F({ r:r+15 })] };
    case 'heart': return { mode:'loop', end:'stay', f:[F({ d:500, e:'out' }), F({ s:1.25, d:200, e:'in' }), F({ d:300, e:'out' }), F({ s:1.15, d:150, e:'in' })] };
    case 'dvd': return dvdPath(el, box, F);
  }
  return null;
}
const KF_PRESETS = { flyLR:'➡ Пролёт слева направо', flyRL:'⬅ Пролёт справа налево', flyUp:'⬆ Титры снизу вверх',
  slideIn:'↔ Въехал, постоял, уехал', drop:'⬇ Падение с отскоком', zoom:'💥 Зум-удар', spinIn:'🌀 Влёт с вращением',
  orbit:'⭕ По кругу', zigzag:'〰 Зигзаг', swing:'🎐 Маятник', heart:'💓 Сердцебиение', dvd:'📀 DVD-заставка' };
