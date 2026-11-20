// Калибровка радара CS2: координаты мира → точка на квадратной подложке 1024×1024.
// Числа pos_x / pos_y / scale — из открытых файлов обзора карт CS2 (resource/overviews/<карта>.txt):
//   px = (x - pos_x) / scale,  py = (pos_y - y) / scale   (в пикселях подложки 1024×1024)
// Это факты о системе координат игры.
// low — высота (z), ниже которой нижний ярус (Nuke, Vertigo, Train): радар показывает подложку <карта>_lower, когда
// наблюдаемый игрок внизу, а игроков с другого яруса рисует бледнее. Пороги Nuke и Vertigo — из verticalsections
// файлов обзора, порог Train приблизительный.
// Подложки Hudini (web/shared/radar/<карта>-<тема>.webp, три темы HUD) делает tools/radar.py; img:false — подложки нет.
// b — рамка содержимого подложки [u0, v0, u1, v1] (доли 0..1, считает tools/radar.py --bbox): карточка радара режется по ней, без пустых полей.
// Карта без записи здесь: радар сам подбирает границы по тому, где побывали игроки, и рисует сетку.
const CS2_MAPS = {
  de_dust2:   { x:-2476, y:3239, s:4.4, b:[0.035,0.0,0.969,0.999] },
  de_mirage:  { x:-3230, y:1713, s:5, b:[0.088,0.135,0.939,0.867] },
  de_inferno: { x:-2087, y:3870, s:4.9, b:[0.051,0.047,0.968,0.944] },
  de_nuke:    { x:-3453, y:2887, s:7, low:-495, b:[0.044,0.256,0.992,0.771] },
  de_overpass:{ x:-4831, y:1781, s:5.2, b:[0.142,0.004,0.930,1.0] },
  de_vertigo: { x:-3168, y:1762, s:4, low:11700, b:[0.108,0.125,0.817,0.862] },
  de_ancient: { x:-2953, y:2164, s:5, b:[0.108,0.057,0.870,0.930] },
  de_anubis:  { x:-2796, y:3328, s:5.22, b:[0.136,0.010,0.882,0.978] },
  de_train:   { x:-2308, y:2078, s:4.082077, low:-50, b:[0.010,0.049,1.0,0.950] },
  de_cache:   { x:-2000, y:3250, s:5.5, b:[0.013,0.155,0.961,0.873] },
  de_cbble:   { x:-3840, y:3072, s:6, b:[0.028,0.002,0.940,0.979] },
  cs_office:  { x:-1838, y:1858, s:4.1, b:[0.0,0.123,1.0,0.986] },
  cs_italy:   { x:-2647, y:2592, s:4.6, b:[0.216,0.0,0.813,1.0] },
};
// [u, v] от 0 до 1 (доля ширины и высоты подложки) или null, если карты нет в списке
function cs2MapUV(map, pos){
  const m = typeof map==='string' && Object.hasOwn(CS2_MAPS, map) ? CS2_MAPS[map] : null;
  if(!m || !Array.isArray(pos)) return null;
  return [(pos[0] - m.x) / m.s / 1024, (m.y - pos[1]) / m.s / 1024];
}
// обратное: [u, v] на подложке → [x, y] мира (для редактора пролётов); null, если карты нет в списке
function cs2MapXY(map, uv){
  const m = typeof map==='string' && Object.hasOwn(CS2_MAPS, map) ? CS2_MAPS[map] : null;
  if(!m || !Array.isArray(uv)) return null;
  return [m.x + uv[0] * m.s * 1024, m.y - uv[1] * m.s * 1024];
}
// рамка содержимого подложки; без записи — вся подложка
function cs2MapBox(map){
  const m = typeof map==='string' && Object.hasOwn(CS2_MAPS, map) ? CS2_MAPS[map] : null;
  return m && m.b ? m.b : [0, 0, 1, 1];
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
