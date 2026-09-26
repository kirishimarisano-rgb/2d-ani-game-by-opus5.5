// 《溫室魔女的剪定日》像素美術：16 色調色盤，全部以字元陣列／程式產生。
// 主角茴香為俯視 3/4 視角：身體有 前／後／側 三個方向，腳步與鐮刀由程式即時繪製。
import { Sprite, gridRows as grid, outlineRows as outline, stampRows as stamp, rotateRows, flipRows, inEllipse } from '../engine/pixel.js';

export const PALETTE = [
  '#17111d', // 0 外框
  '#33283d', // 1 深影
  '#5b4a5e', // 2 梅紫：帽子、洋裝
  '#8f7a8a', // 3 灰紫：石材
  '#d8cfc4', // 4 米白
  '#fff8e7', // 5 白
  '#2c4a3a', // 6 深葉
  '#3f7a4a', // 7 葉
  '#7cbc5a', // 8 嫩葉：頭髮陰影
  '#c6e38a', // 9 萊姆：頭髮
  '#6b3f2a', // 10 土
  '#b0643a', // 11 陶土
  '#f0a86a', // 12 杏
  '#ffd9b3', // 13 膚
  '#e25a7a', // 14 花粉紅
  '#5ec6c9', // 15 玻璃青
];

// ================= 主角：茴香 =================
const FEN = { o: 0, T: 1, t: 2, b: 14, f: 5, y: 9, h: 9, H: 8, s: 13, S: 12, e: 15, p: 14, w: 5, c: 4, d: 2, D: 1, k: 10, K: 11 };

const HAT = [
  '.......oo.......',
  '......otto......',
  '.....ottTo......',
  '.....otttto.....',
  '....otttttto....',
  '...obbbfybbbo...',
  '.oottttttttttoo.',
  'otTTTTTTTTTTTTto',
];
const HAT_SIDE = [
  '...oo...........',
  '..ottoo.........',
  '...ottto........',
  '....otttto......',
  '....otttttto....',
  '...obbbbbfybo...',
  '.oottttttttttoo.',
  'otTTTTTTTTTTTTto',
];
const FACE_DOWN = [
  '.oohhhhhhhhhhoo.',
  '..ohhhsssshhho..',
  '..ohsoossoosho..',
  '..ohseesseesho..',
  '..oHspsssspsHo..',
  '....ooSssSoo....',
];
const FACE_DOWN_HURT = [
  '.oohhhhhhhhhhoo.',
  '..ohhhsssshhho..',
  '..ohsossssosho..',
  '..ohssossossho..',
  '..oHsssoossHo...',
  '....ooSssSoo....',
];
const FACE_UP = [
  '.oohhhhhhhhhhoo.',
  '..ohhhhhhhhhho..',
  '..ohHhhhhhhhHo..',
  '..ohHhhhhhhHho..',
  '...oHhhhhhhHo...',
  '....ooHhhHoo....',
];
const FACE_SIDE = [
  '..ohhhhhhhhhhoo.',
  '..ohhhhhhhhssso.',
  '..ohHhhhhhsosso.',
  '..ohHhhhhhseSso.',
  '...oHhhhhhspsso.',
  '....oHHoooSsoo..',
];
const FACE_SIDE_HURT = FACE_SIDE.map((r, i) => i === 2 ? '..ohHhhhhhsssso.' : i === 3 ? '..ohHhhhhhsosso.' : r);
const BODY_DOWN = [
  '...odwwwwwwdo...',
  '..osdwwccwwdso..',
  '..oSdwwwwwwdSo..',
  '...oddwwwwddo...',
  '..oddddccddddo..',
  '..oDDDDDDDDDDo..',
];
const BODY_UP = [
  '...oddddddddo...',
  '..osddddddddso..',
  '..oSddwwwwddSo..',
  '...oddwffwddo...',
  '..oddddddddddo..',
  '..oDDDDDDDDDDo..',
];
const BODY_SIDE = [
  '....odddwwo.....',
  '....oddwwwso....',
  '....oddwwwSo....',
  '....oddwwwwo....',
  '...odddddccdo...',
  '...oDDDDDDDDo...',
];
function fennel(hat, face, bodyRows) {
  return [...hat, ...face, ...bodyRows];
}
/** 翻滾用的球形（再旋轉出 4 個角度） */
const BALL = outline([
  '....tttt....',
  '..tttTTttt..',
  '.ttbbbbbttt.',
  '.tbfyhhhbtt.',
  'tthhhhhhhhtt',
  'tthhHhhhhhtt',
  'tdhhhHhhhhdt',
  'tddhhhhhhddt',
  '.dddwwwwddd.',
  '.dDddwwddDd.',
  '..kkDDDDkk..',
  '....kkkk....',
]);

// ================= 敵人 =================
const MON = { o: 0, T: 1, t: 2, g: 7, G: 8, l: 9, L: 6, w: 5, c: 4, e: 0, p: 14, k: 10, K: 11, S: 12, s: 13, q: 15, u: 3 };

/** 芽芽史萊姆：頂著嫩芽的果凍。pose：idle / squash / stretch / hurt */
function slimeRows(pose) {
  const W = 16, H = 16;
  const rx = pose === 'squash' ? 7.4 : pose === 'stretch' ? 5.2 : 6.4;
  const ry = pose === 'squash' ? 4.2 : pose === 'stretch' ? 6.4 : 5.2;
  const cy = H - 1.5 - ry;
  let rows = grid(W, H, (x, y) => {
    if (!inEllipse(x, y, 7.5, cy, rx, ry)) return '.';
    if (y < cy - ry * 0.35 && x < 7) return 'l';
    return (y > cy + ry * 0.45) ? 'g' : 'G';
  });
  const top = Math.round(cy - ry);
  rows = stamp(rows, ['.ll.ll.', 'lLl.lLl', '..lgl..', '...g...'], 4, top - 4);
  const ey = Math.round(cy) - (pose === 'stretch' ? 1 : 0);
  rows = stamp(rows, pose === 'hurt' ? ['o.o..o.o', '.o....o.', 'o.o..o.o'] : ['ww...ww', 'we...we', '.......', '..ppp..'], pose === 'hurt' ? 4 : 4, ey - 1);
  return outline(rows);
}
/** 棘甲蟲（面向右）：pose：walk0 / walk1 / charge / stun / hurt */
function beetleRows(pose) {
  const W = 18, H = 16;
  let rows = grid(W, H, (x, y) => {
    if (inEllipse(x, y, 7.5, 7.5, 7, 5.6)) return y < 5 && x < 9 ? 'u' : (x + y) % 5 === 0 ? 'T' : 't';
    return '.';
  });
  // 殼中線與尖刺
  for (let x = 2; x <= 13; x++) rows = stamp(rows, ['T'], x, 7);
  rows = stamp(rows, ['p...p...p'], 3, 2);
  rows = stamp(rows, ['p...p...p'], 3, 12);
  rows = stamp(rows, ['.p..p..p.'], 2, 1);
  // 頭與大顎
  const hx = pose === 'charge' ? 14 : 13;
  rows = stamp(rows, ['.TT.', 'TTTT', 'TwTT', 'TTTT', '.TT.'], hx, 5);
  rows = stamp(rows, pose === 'charge' ? ['.o', 'o.', '..', '..', 'o.', '.o'] : ['o', '.', '.', '.', 'o'], hx + 3, pose === 'charge' ? 4 : 5);
  // 腳
  const legs = pose === 'walk1' ? [[4, 0], [8, 1], [11, 0]] : [[3, 1], [7, 0], [11, 1]];
  if (pose !== 'stun') for (const [lx, o] of legs) { rows = stamp(rows, ['o'], lx + o, 1); rows = stamp(rows, ['o'], lx - o + 1, 14); }
  if (pose === 'stun') rows = stamp(rows, ['w.w', '.w.', 'w.w'], 13, 6);
  if (pose === 'hurt') rows = stamp(rows, ['www', 'www'], 5, 5);
  return outline(rows);
}
/** 孢子菇：pose：idle / swell / shoot / hurt */
function mushroomRows(pose) {
  const W = 16, H = 18;
  const capRx = pose === 'swell' ? 7.4 : pose === 'shoot' ? 7 : 6.6;
  const capRy = pose === 'swell' ? 5.2 : pose === 'shoot' ? 3.8 : 4.6;
  const capCy = pose === 'shoot' ? 7 : 6;
  let rows = grid(W, H, (x, y) => {
    if (y <= capCy + 1 && inEllipse(x, y, 7.5, capCy, capRx, capRy)) return y > capCy - 1 ? 'k' : 'K';
    if (x >= 5 && x <= 10 && y > capCy && y <= 15) return x === 5 ? 'c' : 'w';
    return '.';
  });
  rows = stamp(rows, ['w..w', '.....', '..w..'], 4, capCy - 3);
  rows = stamp(rows, ['w'], 10, capCy - 2);
  const face = pose === 'hurt' ? ['o..o', '.oo.'] : ['o..o', '.pp.'];
  rows = stamp(rows, face, 6, capCy + 3);
  rows = stamp(rows, ['.cccc.', 'cc..cc'], 5, 15);
  return outline(rows);
}
/** 南瓜人偶（訓練靶）：lean -1/0/1 */
function pumpkinRows(lean) {
  const W = 20, H = 24;
  let rows = grid(W, H, () => '.');
  const sh = y => Math.round(lean * (16 - y) / 8);
  for (let y = 13; y < 24; y++) rows = stamp(rows, ['k'], 9 + sh(y), y);
  rows = stamp(rows, ['kkkkkkkkkkkkkk'], 3 + sh(13), 13);
  rows = stamp(rows, ['lGl', 'GlG'], 1 + sh(13), 13); rows = stamp(rows, ['lGl', 'GlG'], 16 + sh(13), 13);
  let head = grid(14, 11, (x, y) => inEllipse(x, y, 6.5, 5.5, 6.6, 5.2) ? ((x === 3 || x === 6 || x === 9) ? 'k' : 'K') : '.');
  head = stamp(head, ['.oo....oo.', '.oo....oo.', '..........', '..oooooo..', '...o..o...'], 2, 3);
  head = stamp(head, ['..gG', '.g..'], 5, 0);
  rows = stamp(rows, head, 3 + sh(4), 2);
  return outline(rows);
}
/** 花盆（可以打破） */
const POT = outline([
  '..g.lg...',
  '.lGgGgl..',
  '..lGGl...',
  'KKKKKKKKK',
  '.kKKKKKk.',
  '.kKKKKKk.',
  '..kKKKk..',
  '..kkkkk..',
]);

// ================= 新增魔物 =================
/** 仙人掌砲台：pose：idle / charge / hurt */
function cactusRows(pose) {
  const W = 16, H = 20;
  const puff = pose === 'charge' ? 0.8 : 0;
  let rows = grid(W, H, (x, y) => {
    if (y >= 14 && y <= 18 && x >= 3 + (y - 14 > 2 ? 1 : 0) && x <= 12 - (y - 14 > 2 ? 1 : 0)) return y === 14 ? 'K' : 'k'; // 花盆
    if (inEllipse(x, y, 7.5, 8.5, 4.6 + puff, 6 + puff)) return (x === 5 || x === 7 || x === 10) ? 'L' : 'g';
    if (inEllipse(x, y, 2.5, 8, 1.6, 2.6) || inEllipse(x, y, 12.5, 7, 1.6, 2.6)) return 'g'; // 手臂
    return '.';
  });
  rows = stamp(rows, ['.pp.', 'pwwp', '.pp.'], 6, 1); // 頭上的花
  const spine = pose === 'charge' ? 'w' : 'c';
  for (const [sx, sy] of [[4, 6], [11, 5], [5, 11], [10, 11], [8, 4], [3, 9], [12, 9]]) rows = stamp(rows, [spine], sx, sy);
  rows = stamp(rows, pose === 'hurt' ? ['o.o..o.o'] : ['.o..o.', '......', '..pp..'], pose === 'hurt' ? 4 : 5, 8);
  return outline(rows);
}
/** 花蜂：面向右，pose：fly0 / fly1 / dive / hurt */
function beeRows(pose) {
  const W = 15, H = 13;
  let rows = grid(W, H, (x, y) => {
    if (inEllipse(x, y, 7, 8, 4.8, 3.3)) return (x === 5 || x === 8) ? 'o' : 'S';
    if (inEllipse(x, y, 11.5, 7, 2.4, 2.2)) return 'S';
    return '.';
  });
  if (pose === 'fly1') rows = stamp(rows, ['..qq..', '.qwwq.', '..qq..'], 3, 3);
  else if (pose !== 'dive') rows = stamp(rows, ['.qqq.', 'qwwwq', '.qq..'], 3, 1);
  else rows = stamp(rows, ['qqq..', '.qwq.'], 1, 4);
  rows = stamp(rows, pose === 'hurt' ? ['w.w'] : ['o.'], 11, 6);
  rows = stamp(rows, ['kk'], 1, 8); // 螫針（尾巴在左）
  rows = stamp(rows, ['.o', 'o.'], 12, 3); // 觸角
  return outline(rows);
}
/** 捕蠅草：面向右，pose：idle / open / bite / hurt */
function snapperRows(pose) {
  const W = 20, H = 20;
  let rows = grid(W, H, () => '.');
  // 莖與底部葉子
  for (let y = 12; y < 18; y++) rows = stamp(rows, ['g'], 7 + (y > 15 ? 0 : 1), y);
  rows = stamp(rows, ['GG.....GG', '.GGG.GGG.', '...GGG...'], 3, 16);
  const hx = pose === 'bite' ? 8 : 5, open = pose === 'open' ? 3 : pose === 'bite' ? 0 : 1;
  // 上顎
  let top = grid(12, 6, (x, y) => inEllipse(x, y, 5.5, 5, 5.6, 4.4) && y <= 4 ? (y >= 3 ? 'p' : 'G') : '.');
  let bot = grid(12, 6, (x, y) => inEllipse(x, y, 5.5, 0, 5.6, 4.4) && y >= 1 ? (y <= 2 ? 'p' : 'G') : '.');
  rows = stamp(rows, top, hx, 4 - open);
  rows = stamp(rows, bot, hx, 8 + open);
  if (open > 0) { rows = stamp(rows, ['w.w.w.w.w'], hx + 1, 8 - open); rows = stamp(rows, ['w.w.w.w.w'], hx + 1, 9 + open); }
  rows = stamp(rows, pose === 'hurt' ? ['w.w'] : ['oo'], hx + 3, 4 - open);
  return outline(rows);
}
// ================= 守護者（Boss） =================
/** 芽芽史萊姆王（40x34）：pose：idle / squash / jump / hurt */
function slimeKingRows(pose) {
  const W = 44, H = 36;
  const rx = pose === 'squash' ? 20 : pose === 'jump' ? 15 : 18, ry = pose === 'squash' ? 10 : pose === 'jump' ? 15 : 13;
  const cy = H - 2 - ry;
  let rows = grid(W, H, (x, y) => {
    if (!inEllipse(x, y, 21.5, cy, rx, ry)) return '.';
    if (y < cy - ry * 0.4 && x < 16 && inEllipse(x, y, 13, cy - ry * 0.5, 5, 3)) return 'l';
    return y > cy + ry * 0.5 ? 'g' : 'G';
  });
  const top = Math.round(cy - ry);
  rows = stamp(rows, ['..l.....l..', '.lLl...lLl.', 'lLgLl.lLgLl', '..lgggggl..', '....ppp....', '...pwwwp...', '....ppp....'], 16, Math.max(0, top - 5));
  const ey = Math.round(cy) - 2;
  rows = stamp(rows, pose === 'hurt' ? ['o.o......o.o', '.o........o.', 'o.o......o.o'] : ['www......www', 'wwe......wwe', 'wee......wee', '............', '....oooo....', '.....pp.....'], 16, ey - 2);
  return outline(rows);
}
/** 女王蜂（38x30）：pose：fly0 / fly1 / dive / hurt */
function queenBeeRows(pose) {
  const W = 40, H = 32;
  let rows = grid(W, H, (x, y) => {
    if (inEllipse(x, y, 15, 20, 11, 7.5)) return (x === 10 || x === 11 || x === 17 || x === 18) ? 'o' : 'S';
    if (inEllipse(x, y, 29, 17, 6, 5.5)) return 'S';
    return '.';
  });
  if (pose === 'fly1') rows = stamp(rows, grid(18, 8, (x, y) => inEllipse(x, y, 8.5, 4, 8.6, 3.6) ? (y === 3 ? 'w' : 'q') : '.'), 6, 11);
  else if (pose === 'dive') rows = stamp(rows, grid(18, 6, (x, y) => inEllipse(x, y, 8.5, 3, 8.6, 2.6) ? 'q' : '.'), 2, 14);
  else rows = stamp(rows, grid(16, 12, (x, y) => inEllipse(x, y, 7.5, 6, 7.6, 5.8) ? (x + y) % 5 === 0 ? 'w' : 'q' : '.'), 8, 1);
  rows = stamp(rows, ['.K.K.K.', 'KKKKKKK', 'KpKpKpK'], 25, 7); // 王冠
  rows = stamp(rows, pose === 'hurt' ? ['w.w..w.w', '.w....w.'] : ['.oo.', 'owwo', '.oo.'], 29, 14);
  rows = stamp(rows, ['kkk', '.kk', '..k'], 1, 19); // 螫針
  rows = stamp(rows, ['.pp.', 'p..p'], 28, 21);
  return outline(rows);
}
/** 巨大食人花「拉芙蕾西亞」（俯視，56x48）：pose：closed / open / hurt */
function rafflesiaRows(pose) {
  const W = 58, H = 50, cx = 28.5, cy = 24.5;
  let rows = grid(W, H, (x, y) => {
    const dx = x - cx, dy = (y - cy) * 1.15, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const petal = 17 + 9 * Math.pow(Math.abs(Math.cos(a * 2.5)), 0.6);
    if (d < 10) return pose === 'open' ? (d < 7 ? 'o' : 'p') : d < 3 ? 'k' : 'K';
    if (d < petal) {
      const spot = (Math.floor(x / 3) + Math.floor(y / 3)) % 4 === 0 && d > 12 && d < petal - 3;
      return spot ? 'c' : d > petal - 3 ? 'K' : 'p';
    }
    return '.';
  });
  if (pose === 'open') { rows = stamp(rows, ['w.w.w.w'], 25, 18); rows = stamp(rows, ['w.w.w.w'], 25, 30); }
  if (pose === 'hurt') rows = stamp(rows, ['o...o', '.o.o.', '..o..', '.o.o.', 'o...o'], 26, 22);
  return outline(rows);
}

// ================= 道具、門、祝福圖示 =================
const IT = { o: 0, T: 1, t: 2, u: 3, c: 4, w: 5, L: 6, g: 7, G: 8, l: 9, k: 10, K: 11, S: 12, s: 13, p: 14, q: 15 };
const COIN = [['.oooo.', 'oSSSSo', 'oSwKSo', 'oSKKSo', 'oKSSKo', '.oooo.'], ['..oo..', '.oSSo.', '.oSKo.', '.oKSo.', '.oSSo.', '..oo..']];
const SEED = ['...l..', '..lG..', '.oooo.', 'okkkko', 'okKkko', 'okkkko', '.oooo.'];
const HEART = ['.oo.oo.', 'oppoppo', 'opwpppo', 'opppppo', '.opppo.', '..opo..', '...o...'];
/** 門：木拱門＋獎勵牌子（牌子由遊戲另外畫） */
const DOOR = [
  '..oooooooooooooooooooo..',
  '.okkkkkkkkkkkkkkkkkkkko.',
  'okKKKKKKKKKKKKKKKKKKKKko',
  'okKooooooooooooooooooKko',
  'okKo................oKko',
  'okKo................oKko',
  'okKo................oKko',
  'okKo................oKko',
  'okKo................oKko',
  'okKo................oKko',
  'okKo................oKko',
  'okKo................oKko',
];
const VINES = [
  '..gG..Gg..gG..Gg..',
  '.g..GG..gg..GG..g.',
  'G.Gg..gG..Gg..gG.G',
  '.gG..Gg..gG..Gg..g',
  'g..gG..Gg..gG..Gg.',
  '.Gg..gG..Gg..gG..G',
  'G..Gg..gG..Gg..gG.',
  '.gG..Gg..gG..Gg..g',
];
const FOUNTAIN = outline([
  '..........uuuu..........',
  '.........uccccu.........',
  '..........uccu..........',
  '...........uu...........',
  '....uuuuuuuuuuuuuuuu....',
  '..uuccccccccccccccccuu..',
  '.uccqqqqqqqqqqqqqqqqccu.',
  'ucqqqqwqqqqqqqqwqqqqqqcu',
  'ucqqqqqqqqqqqqqqqqqqqqcu',
  '.ucqqqqqqwqqqqqqqqqqqcu.',
  '..uuccccccccccccccccuu..',
  '....uuuuuuuuuuuuuuuu....',
]);
/** 祝福圖示（12x12）：B 主色、b 陰影 */
const BOON_ICONS = {
  vineDash: ['....gg......', '...gGGg.....', '..gG..Gg..p.', '.gG....Ggpp.', 'gG......Gg..', 'G..........G'],
  crescent: ['...wwww.....', '.ww....w....', 'w.......q...', 'w.......q...', '.ww....w....', '...wwww.....'],
  pollen: ['..p..p..p...', '...ppppp....', '.pppwwwppp..', '...ppppp....', '..p..p..p...', '............'],
  honeyShield: ['...SSSSS....', '..SkkkkkS...', '..SkSSSkS...', '..SkkkkkS...', '...SkkkS....', '....SSS.....'],
  dew: ['.....q......', '....qqq.....', '...qqwqq....', '...qqqqq....', '....qqq.....', '............'],
  steelLeaf: ['......cc....', '....ccwc....', '..ccwcc.....', '.cwcc.......', 'cc..........', 'c...........'],
  longHandle: ['k...........', '.k..........', '..k.........', '...k....cc..', '....k.cwc...', '.....kcc....'],
  tailwind: ['..wwww......', '......ww....', 'wwwwwwww....', '......ww....', '..wwww......', '............'],
  thornArmor: ['.G..G..G....', 'GGGGGGGGG...', 'GuuuuuuuG...', 'GuuuuuuuG...', 'GGGGGGGGG...', '.G..G..G....'],
  sunflower: ['.S..S..S....', '..SSSSS.....', 'SSSkkkSSS...', '..SSSSS.....', '.S..S..S....', '............'],
  dandelion: ['w..w..w.....', '.w.w.w......', '..www.......', '...g........', '...g........', '..GG........'],
  rootBind: ['k.k.k.k.....', '.kkkkk......', '..kkk.......', '.k.k.k......', 'k..k..k.....', '............'],
  fertilizer: ['...pp.......', '..pwwp......', '.pwwwwp.....', 'kkkkkkkk....', 'kKKKKKKk....', 'kkkkkkkk....'],
  harvest: ['.oooo..l....', 'oSSSSolG....', 'oSwKSo......', 'oSKKSo......', '.oooo.......', '............'],
  mint: ['.l...l......', 'lll.lll.....', '.lllll......', '..lGl.......', '...G........', '...G........'],
  lifeBloom: ['.pp.pp......', 'pppppppp....', 'ppwppppp....', '.pppppp.....', '..pppp......', '...pp.......'],
};
function iconRows(r) { return outline(['............', ...r.map(x => '.' + x.slice(0, 10) + '.'), '............']); }
/** 刺蝟商人（頭像 30x28） */
function hedgehogPortrait(smile) {
  const W = 30, H = 28;
  let rows = grid(W, H, (x, y) => {
    if (inEllipse(x, y, 15, 16, 12, 10)) {
      if (inEllipse(x, y, 19, 18, 8, 7)) return 's';
      return (x + y) % 3 === 0 ? 'T' : 'k';
    }
    if (y < 16 && inEllipse(x, y, 13, 12, 14, 10) && (x * 3 + y) % 4 < 2) return 'k';
    return '.';
  });
  rows = stamp(rows, smile ? ['.o...o.', 'o.o.o.o'] : ['.o...o.', '.o...o.'], 15, 14);
  rows = stamp(rows, ['.oo.', 'oooo'], 25, 17);
  rows = stamp(rows, smile ? ['o...o', '.ooo.'] : ['.ooo.'], 17, 21);
  rows = stamp(rows, ['p', 'p'], 14, 18);
  rows = stamp(rows, ['.cccc.', 'cttttc', 'cttttc'], 4, 2); // 小帽子
  return outline(rows);
}
/** 武器圖示（16x16） */
const WEAPON_ICONS = {
  scythe: ['..........cccc..', '........cc..qq..', '.......c.....q..', '......k.......q.', '.....k..........', '....k...........', '...k............', '..k.............', '.k..............', 'k...............'],
  shears: ['cq.........qc...', '.cq.......qc....', '..cq.....qc.....', '...cq...qc......', '....cqoqc.......', '.....kok........', '....kk.kk.......', '...kk...kk......', '...kk...kk......', '....kk.kk.......'],
  can: ['..............q.', '.............q..', '...uuuuuuuu.uu..', '..uqqqqqqqquu...', '.uu.qqqqqqquu...', 'uu..qqqwqqqu....', 'u...qqqqqqqu....', 'uu..qqqqqqqu....', '.uu.qqqqqqqu....', '....uuuuuuuu....'],
};

export const BOON_IDS = Object.keys(BOON_ICONS);

export function buildSprites() {
  const mk = (rows, legend) => new Sprite(rows, legend, PALETTE);
  const F = rows => mk(rows, FEN), M = rows => mk(rows, MON);
  const ballRows = [BALL, rotateRows(BALL), rotateRows(rotateRows(BALL)), rotateRows(rotateRows(rotateRows(BALL)))];
  const beetle = pose => { const r = beetleRows(pose); return { right: M(r), down: M(rotateRows(r)), left: M(flipRows(r)), up: M(rotateRows(rotateRows(rotateRows(r)))) }; };
  return {
    fennel: {
      down: F(fennel(HAT, FACE_DOWN, BODY_DOWN)),
      up: F(fennel(HAT, FACE_UP, BODY_UP)),
      side: F(fennel(HAT_SIDE, FACE_SIDE, BODY_SIDE)),
      hurtDown: F(fennel(HAT, FACE_DOWN_HURT, BODY_DOWN)),
      hurtSide: F(fennel(HAT_SIDE, FACE_SIDE_HURT, BODY_SIDE)),
      ball: ballRows.map(F),
      boot: mk(['okko', 'oKko', 'oooo'], FEN),
    },
    slime: { idle: M(slimeRows('idle')), squash: M(slimeRows('squash')), stretch: M(slimeRows('stretch')), hurt: M(slimeRows('hurt')) },
    beetle: { walk0: beetle('walk0'), walk1: beetle('walk1'), charge: beetle('charge'), stun: beetle('stun'), hurt: beetle('hurt') },
    mushroom: { idle: M(mushroomRows('idle')), swell: M(mushroomRows('swell')), shoot: M(mushroomRows('shoot')), hurt: M(mushroomRows('hurt')) },
    pumpkin: { mid: M(pumpkinRows(0)), left: M(pumpkinRows(-1)), right: M(pumpkinRows(1)) },
    pot: M(POT),
    cactus: { idle: M(cactusRows('idle')), charge: M(cactusRows('charge')), hurt: M(cactusRows('hurt')) },
    bee: { fly: [M(beeRows('fly0')), M(beeRows('fly1'))], dive: M(beeRows('dive')), hurt: M(beeRows('hurt')) },
    snapper: { idle: M(snapperRows('idle')), open: M(snapperRows('open')), bite: M(snapperRows('bite')), hurt: M(snapperRows('hurt')) },
    slimeKing: { idle: M(slimeKingRows('idle')), squash: M(slimeKingRows('squash')), jump: M(slimeKingRows('jump')), hurt: M(slimeKingRows('hurt')) },
    queenBee: { fly: [M(queenBeeRows('fly0')), M(queenBeeRows('fly1'))], dive: M(queenBeeRows('dive')), hurt: M(queenBeeRows('hurt')) },
    rafflesia: { closed: M(rafflesiaRows('closed')), open: M(rafflesiaRows('open')), hurt: M(rafflesiaRows('hurt')) },
    coin: COIN.map(r => mk(r, IT)), seed: mk(SEED, IT), heart: mk(HEART, IT),
    door: mk(DOOR, IT), vines: mk(VINES, IT), fountain: mk(FOUNTAIN, IT),
    boons: Object.fromEntries(BOON_IDS.map(id => [id, mk(iconRows(BOON_ICONS[id]), IT)])),
    weapons: Object.fromEntries(Object.entries(WEAPON_ICONS).map(([id, r]) => [id, mk(outline(['................', ...r.map(x => x.padEnd(16, '.')), '................']), IT)])),
    hedgehog: mk(hedgehogPortrait(false), IT), hedgehogSmile: mk(hedgehogPortrait(true), IT),
    fennelFace: F([...HAT, ...FACE_DOWN]),
  };
}
