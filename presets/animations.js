// SPDX-License-Identifier: MIT
// Hudini ready-made animations. Free to copy into your own projects (MIT, see presets/LICENSE).
// Each preset builds keyframes from the element's current position: { mode, end, f:[{ x, y, r, s, o, d, e }] }
//   x, y  position in % of the 16:9 screen · r rotation in degrees · s scale · o opacity
//   d     duration of the step in ms · e easing: linear, in, out, inout, back, bounce
//   mode  once | loop | pingpong · end  stay | hide | back
// Готовые анимации. Строятся от текущего положения элемента.
const SPEED = 0.025; // % экрана за мс для «пролётов»
function kfPreset(name, el){
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
    case 'dvd': {
      const pts=[[8,12],[70,88],[92,40],[30,10],[8,55],[50,88],[92,70],[60,12]].map(([px,py])=>F({ x:px, y:py, e:'linear' }));
      pts.forEach((p,i)=>p.d=dist(p, pts[(i+1)%pts.length])/SPEED*1.6);
      return { mode:'loop', end:'stay', f:pts };
    }
  }
  return null;
}
const KF_PRESETS = { flyLR:'➡ Пролёт слева направо', flyRL:'⬅ Пролёт справа налево', flyUp:'⬆ Титры снизу вверх',
  slideIn:'↔ Въехал, постоял, уехал', drop:'⬇ Падение с отскоком', zoom:'💥 Зум-удар', spinIn:'🌀 Влёт с вращением',
  orbit:'⭕ По кругу', zigzag:'〰 Зигзаг', swing:'🎐 Маятник', heart:'💓 Сердцебиение', dvd:'📀 DVD-заставка' };
