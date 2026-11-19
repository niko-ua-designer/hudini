// Калибровка радара CS2: координаты мира → точка на квадратной подложке 1024×1024.
// Числа pos_x / pos_y / scale — из открытых файлов обзора карт CS2 (resource/overviews/<карта>.txt):
//   px = (x - pos_x) / scale,  py = (pos_y - y) / scale   (в пикселях подложки 1024×1024)
// Это факты о системе координат игры.
// low — высота (z), ниже которой нижний ярус (Nuke, Vertigo, Train): радар показывает подложку <карта>_lower, когда
// наблюдаемый игрок внизу, а игроков с другого яруса рисует бледнее. Пороги Nuke и Vertigo — из verticalsections
// файлов обзора, порог Train приблизительный.
// Подложки Hudini (web/shared/radar/<карта>-<тема>.webp, три темы HUD) делает tools/radar.py; img:false — подложки нет.
// Карта без записи здесь: радар сам подбирает границы по тому, где побывали игроки, и рисует сетку.
const CS2_MAPS = {
  de_dust2:   { x:-2476, y:3239, s:4.4 },
  de_mirage:  { x:-3230, y:1713, s:5 },
  de_inferno: { x:-2087, y:3870, s:4.9 },
  de_nuke:    { x:-3453, y:2887, s:7, low:-495 },
  de_overpass:{ x:-4831, y:1781, s:5.2 },
  de_vertigo: { x:-3168, y:1762, s:4, low:11700 },
  de_ancient: { x:-2953, y:2164, s:5 },
  de_anubis:  { x:-2796, y:3328, s:5.22 },
  de_train:   { x:-2308, y:2078, s:4.082077, low:-50 },
  de_cache:   { x:-2000, y:3250, s:5.5 },
  de_cbble:   { x:-3840, y:3072, s:6 },
  cs_office:  { x:-1838, y:1858, s:4.1 },
  cs_italy:   { x:-2647, y:2592, s:4.6 },
};
// [u, v] от 0 до 1 (доля ширины и высоты подложки) или null, если карты нет в списке
function cs2MapUV(map, pos){
  const m = typeof map==='string' && Object.hasOwn(CS2_MAPS, map) ? CS2_MAPS[map] : null;
  if(!m || !Array.isArray(pos)) return null;
  return [(pos[0] - m.x) / m.s / 1024, (m.y - pos[1]) / m.s / 1024];
}
// адрес подложки: <база>/<карта>[_lower]-<тема>.webp. База — папка shared/radar рядом с core.js (пульт, сайт, виджет у Host)
const CS2_RADAR_THEMES = ['classic', 'glass', 'ko'];
let CS2_RADAR_BASE = '../shared/radar/';
function cs2RadarImg(map, theme, lower){
  const m = typeof map==='string' && Object.hasOwn(CS2_MAPS, map) ? CS2_MAPS[map] : null;
  if(!m || m.img===false) return '';
  return CS2_RADAR_BASE + map + (lower && m.low!=null ? '_lower' : '') + '-' + (CS2_RADAR_THEMES.includes(theme) ? theme : 'glass') + '.webp';
}
// нижний ярус: высота игрока ниже порога карты
function cs2Lower(map, pos){
  const m = typeof map==='string' && Object.hasOwn(CS2_MAPS, map) ? CS2_MAPS[map] : null;
  return !!(m && m.low!=null && Array.isArray(pos) && pos[2] < m.low);
}
