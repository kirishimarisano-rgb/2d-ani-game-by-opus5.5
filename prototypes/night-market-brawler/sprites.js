// 《夜市拳姬》像素美術：16 色霓虹調色盤。
// 角色採「骨架＋分件」：頭與身體是像素圖，四肢在遊戲中以帶外框的像素線條即時繪製，
// 因此每個出拳、踢腿的姿勢都能用角度調整並平滑補間。敵人共用同一套骨架、換上布偶裝。
import { Sprite, gridRows as grid, outlineRows as outline, stampRows as stamp, rotateRows, inEllipse } from '../engine/pixel.js';

export const PALETTE = [
  '#0f0e17', // 0 外框
  '#1f1d36', // 1 夜藍
  '#3a2d5c', // 2 紫影
  '#6b3e75', // 3 洋紅影
  '#e8458b', // 4 霓虹粉
  '#ff9ec4', // 5 淺粉
  '#27c0d9', // 6 霓虹青
  '#a6f6ff', // 7 淺青
  '#ffd23f', // 8 燈籠黃（芒果色帽T）
  '#ff7b2e', // 9 橘
  '#c2302e', // 10 紅
  '#6b4432', // 11 木
  '#f5c6a0', // 12 膚
  '#d18f6b', // 13 膚影
  '#8a8ca8', // 14 灰（水泥）
  '#fdf6e3', // 15 白
];
export const C = { ink: 0, navy: 1, purple: 2, plum: 3, pink: 4, lpink: 5, cyan: 6, lcyan: 7, yellow: 8, orange: 9, red: 10, wood: 11, skin: 12, dskin: 13, gray: 14, white: 15 };

// ================= 主角：阿芒 =================
const AM = { o: 0, h: 2, l: 3, P: 4, g: 8, s: 12, S: 13, r: 9, p: 5, y: 8, Y: 9, c: 6, w: 15, k: 1, K: 2, R: 10 };
const HEAD = [
  '....ooooo....',
  '..oohhhhhoo..',
  '.ohhhhllhhho.',
  'ohhhhlhhhghho',
  'ohhhhhhhgggho',
  'ohhhhhhPshsho',
  'ohhhhPsssssho',
  'ohhhhhossosho',
  'ohhhhhrssrsho',
  'ohhhhspssspho',
  '.ohhhosspsoho',
  '..ohhoooooho.',
  '...oo.....o..',
];
const HEAD_HURT = HEAD.map((r, i) => i === 7 ? 'ohhhhhossosho' : i === 8 ? 'ohhhhhsssssho' : i === 10 ? '.ohhhossosoho' : r);
const HEAD_SHOUT = HEAD.map((r, i) => i === 10 ? '.ohhhosoooho.' : i === 11 ? '..ohhooRRooo.' : r);
// 芒果色帽 T＋短褲（身體，面向右）
const TORSO = [
  '..oooo....',
  '.oyyyyoo..',
  'oYyywcyyo.',
  'oyyyywcyyo',
  'oyyyyyyyyo',
  '.oyyyyyyyo',
  '.oYyyyyyyo',
  '.oyYYYYYyo',
  '.oYYYYYYYo',
  '.okkkkkkko',
  '.okkKkkkko',
];

// ================= 敵人：布偶裝混混 =================
const MASCOT = { o: 0, p: 5, P: 4, w: 15, W: 7, e: 0, r: 10, k: 1, K: 2, b: 11, B: 3, g: 14, c: 6, C: 7, y: 8 };
/** 兔兔布偶頭（大頭＋長耳朵、鈕扣眼、縫線嘴）。skin：主色／陰影色字元 */
function rabbitHead(main, shade, mode) {
  const W = 17, H = 19;
  let rows = grid(W, H, (x, y) => {
    if (inEllipse(x, y, 8, 12.5, 7.6, 6.2)) return y > 15 || x < 3 ? shade : main;
    if ((inEllipse(x, y, 5, 4, 1.8, 4.6) || inEllipse(x, y, 11, 3.5, 1.8, 4.6)) && y < 9) return x === 5 || x === 11 ? 'P' : main;
    return '.';
  });
  rows = stamp(rows, ['.www.', 'wwwww', '.www.'], 9, 13);
  if (mode === 'hurt') rows = stamp(rows, ['o.o...o.o', '.o.....o.', 'o.o...o.o'], 5, 9);
  else rows = stamp(rows, ['oo....oo', 'ow....ow'], 5, 9);
  rows = stamp(rows, mode === 'hurt' ? ['ooo'] : ['o.o', '.o.'], 10, 15);
  return outline(rows);
}
/** 熊熊保鑣頭（戴墨鏡） */
function bearHead(mode) {
  const W = 19, H = 17;
  let rows = grid(W, H, (x, y) => {
    if (inEllipse(x, y, 9, 9.5, 8.4, 7)) return y > 13 || x < 3 ? 'B' : 'b';
    if (inEllipse(x, y, 3.5, 3.5, 3, 3) || inEllipse(x, y, 14.5, 3.5, 3, 3)) return inEllipse(x, y, 3.5, 3.5, 1.4, 1.4) || inEllipse(x, y, 14.5, 3.5, 1.4, 1.4) ? 'P' : 'b';
    return '.';
  });
  rows = stamp(rows, ['..wwwww..', '.wwwwwww.', '..wwoww..'], 8, 11);
  rows = stamp(rows, mode === 'hurt' ? ['o.o...o.o', '.o.....o.', 'o.o...o.o'] : ['kkkkk.kkkkk', 'kcCkkokcCkk', '.kkk...kkk.'], 5, 7);
  return outline(rows);
}
/** 布偶身體（毛茸茸的連身裝） */
function suitTorso(main, shade, belly) {
  const W = 12, H = 12;
  let rows = grid(W, H, (x, y) => {
    if (inEllipse(x, y, 5.5, 6, 5.4, 6)) return x < 3 || y > 9 ? shade : main;
    return '.';
  });
  rows = stamp(rows, belly, 4, 4);
  return outline(rows);
}
/** 保鑣西裝身體（黑西裝紅領帶） */
const SUIT = outline([
  '...kkkkkk...',
  '..kkkwwkkk..',
  '.kkkkwrwkkkk',
  '.kkkkwrwkkkk',
  'kkkkkkrrkkkk',
  'kkkkkkrrkkkk',
  'kKkkkkrkkkKk',
  'kKkkkkkkkkKk',
  '.kKkkkkkkKk.',
  '.kkkkkkkkkk.',
  '.KKKKKKKKKK.',
  '.KKKK..KKKK.',
]);

// 拳頭、鞋子等小零件
const PARTS = { o: 0, s: 12, S: 13, R: 10, w: 15, p: 5, P: 4, b: 11, B: 3, k: 1, K: 2, c: 6, C: 7 };
const FIST = ['.oo.', 'oRso', 'oRSo', '.oo.'];
const SHOE = ['.oooo.', 'oRRRRo', 'owwwwo', '.oooo.'];
const MITTEN = ['.oo.', 'owwo', 'owwo', '.oo.'];
const PAW = ['.oo.', 'obbo', 'oBbo', '.oo.'];
const BIG_SHOE = ['.ooooo.', 'oppppPo', 'opppppo', '.ooooo.'];
const BIG_SHOE_C = ['.ooooo.', 'occccCo', 'ocCccco', '.ooooo.'];
const DRESS_SHOE = ['.ooooo.', 'okkkkko', 'oKkkkko', '.ooooo.'];

export function buildSprites() {
  const mk = (rows, legend) => new Sprite(rows, legend, PALETTE);
  const lie = s => mk(rotateRows(rotateRows(rotateRows(s.rows))), s.legend);
  const A = rows => { const s = mk(rows, AM); s.legend = AM; return s; };
  const M = rows => { const s = mk(rows, MASCOT); s.legend = MASCOT; return s; };
  const amang = { head: A(HEAD), headHurt: A(HEAD_HURT), headShout: A(HEAD_SHOUT), torso: A(TORSO) };
  amang.torsoLie = lie(amang.torso); amang.headLie = lie(amang.headHurt);
  const rabbit = { head: M(rabbitHead('p', 'P', 'normal')), headHurt: M(rabbitHead('p', 'P', 'hurt')), torso: M(suitTorso('p', 'P', ['ww', 'ww', 'ww'])) };
  rabbit.torsoLie = lie(rabbit.torso); rabbit.headLie = lie(rabbit.headHurt);
  const trainee = { head: M(rabbitHead('c', 'C', 'normal')), headHurt: M(rabbitHead('c', 'C', 'hurt')), torso: M(suitTorso('c', 'C', ['yy', 'yy', 'yy'])) };
  trainee.torsoLie = lie(trainee.torso); trainee.headLie = lie(trainee.headHurt);
  const bear = { head: M(bearHead('normal')), headHurt: M(bearHead('hurt')), torso: M(SUIT) };
  bear.torsoLie = lie(bear.torso); bear.headLie = lie(bear.headHurt);
  return {
    amang, rabbit, trainee, bear,
    fist: mk(FIST, PARTS), shoe: mk(SHOE, PARTS), mitten: mk(MITTEN, PARTS), paw: mk(PAW, PARTS),
    bigShoe: mk(BIG_SHOE, PARTS), bigShoeC: mk(BIG_SHOE_C, PARTS), dressShoe: mk(DRESS_SHOE, PARTS),
  };
}
