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
  };
}
