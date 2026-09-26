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
const MASCOT = { o: 0, p: 5, P: 4, w: 15, W: 7, e: 0, r: 10, R: 10, k: 1, K: 2, b: 11, B: 3, g: 14, c: 6, C: 7, y: 8, Y: 9, u: 2 };
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

// ================= 新增混混與守護者 =================
/** 貓咪布偶頭（尖耳、鬍鬚） */
function catHead(mode) {
  const W = 17, H = 16;
  let rows = grid(W, H, (x, y) => {
    if (inEllipse(x, y, 8, 9.5, 7.6, 6)) return y > 12 || x < 3 ? 'g' : 'w';
    if ((y >= 1 && y <= 5) && (Math.abs(x - 3.5) <= (y - 0.5) * 0.7 || Math.abs(x - 12.5) <= (y - 0.5) * 0.7)) return (x === 3 || x === 12) && y > 2 ? 'P' : 'w';
    return '.';
  });
  rows = stamp(rows, mode === 'hurt' ? ['o.o...o.o', '.o.....o.', 'o.o...o.o'] : ['.C.....C.', 'CCo...CCo', '.C.....C.'], 4, 6);
  rows = stamp(rows, ['.P.', 'o.o'], 7, 10);
  rows = stamp(rows, ['oo.......oo', '..o.....o..'], 3, 11);
  return outline(rows);
}
/** 狗狗布偶頭（垂耳） */
function dogHead(mode) {
  const W = 18, H = 17;
  let rows = grid(W, H, (x, y) => {
    if (inEllipse(x, y, 9, 9, 7, 6.8)) return y > 12 || x < 4 ? 'b' : 'y';
    if (inEllipse(x, y, 2.5, 9, 2.2, 5) || inEllipse(x, y, 15.5, 9, 2.2, 5)) return 'b';
    return '.';
  });
  rows = stamp(rows, ['.wwww.', 'wwwwww', '.wwww.'], 6, 10);
  rows = stamp(rows, mode === 'hurt' ? ['o.o..o.o', '.o....o.', 'o.o..o.o'] : ['oo....oo', 'ow....ow'], 5, 6);
  rows = stamp(rows, ['oo', 'P.'], 8, 11);
  return outline(rows);
}
/** 熊貓頭（守護者：熊貓大仙） */
function pandaHead(mode) {
  const W = 23, H = 21;
  let rows = grid(W, H, (x, y) => {
    if (inEllipse(x, y, 11, 12, 10, 8.6)) return y > 17 ? 'g' : 'w';
    if (inEllipse(x, y, 3.5, 4.5, 3.4, 3.4) || inEllipse(x, y, 18.5, 4.5, 3.4, 3.4)) return 'k';
    return '.';
  });
  rows = stamp(rows, mode === 'hurt' ? ['kk.k.....k.kk', '.kk.......kk.', 'kk.k.....k.kk'] : ['.kkk.....kkk.', 'kkwkk...kkwkk', 'kkkk.....kkkk', '.kk.......kk.'], 5, 8);
  rows = stamp(rows, ['.kkk.', 'kkkkk', '..k..'], 9, 13);
  rows = stamp(rows, mode === 'rage' ? ['RRRRRRRRR'] : ['.o..o..o.'], 7, 17);
  rows = stamp(rows, ['RRRRRRRRRRRRR'], 5, 1); // 紅頭巾
  return outline(rows);
}
/** 大兔兔頭（守護者） */
function bigRabbitHead(mode) {
  const W = 27, H = 29;
  let rows = grid(W, H, (x, y) => {
    if (inEllipse(x, y, 13, 19, 12, 9.4)) return y > 24 || x < 4 ? 'P' : 'p';
    if ((inEllipse(x, y, 7, 6, 2.8, 7) || inEllipse(x, y, 19, 5, 2.8, 7)) && y < 13) return x === 7 || x === 19 ? 'P' : 'p';
    return '.';
  });
  rows = stamp(rows, ['..www..', '.wwwww.', 'wwwwwww', '.wwwww.'], 10, 21);
  rows = stamp(rows, mode === 'hurt' ? ['o.o.......o.o', '.o.........o.', 'o.o.......o.o'] : ['ooo.......ooo', 'oRo.......oRo', 'ooo.......ooo'], 7, 14);
  rows = stamp(rows, ['kkkkkkkkkkkkk', 'kCCkkkkkkkCCk'], 7, 12); // 墨鏡
  rows = stamp(rows, ['o.o.o', '.ooo.'], 11, 25);
  return outline(rows);
}
/** 珍奶巨人（杯身，52x60）：mode：idle / open / hurt */
function bubbleTeaRows(mode) {
  const W = 50, H = 62;
  let rows = grid(W, H, (x, y) => {
    if (y >= 8 && y <= 11 && x >= 6 && x <= 43) return y === 8 ? 'w' : 'C'; // 杯蓋
    const top = 12, bot = 58, t = (y - top) / (bot - top);
    const half = 18 - t * 4;
    if (y >= top && y <= bot && Math.abs(x - 24.5) <= half) {
      if (y > 44 && ((x * 3 + y * 5) % 11 < 3)) return 'k'; // 珍珠
      if (y > 44) return 'K';
      return x < 24.5 - half + 3 ? 'b' : 'y';
    }
    return '.';
  });
  // 吸管
  for (let y = 0; y < 9; y++) rows = stamp(rows, ['PP'], 30 + Math.floor(y / 3), y);
  // 臉
  rows = stamp(rows, mode === 'hurt' ? ['o.o......o.o', '.o........o.', 'o.o......o.o'] : ['.oo......oo.', 'owwo....owwo', 'owoo....owoo', '.oo......oo.'], 13, 20);
  rows = stamp(rows, mode === 'open' ? ['..oooooo..', '.oRRRRRRo.', '..oooooo..'] : ['..o....o..', '...oooo...'], 14, 28);
  rows = stamp(rows, ['pp', 'pp'], 10, 27); rows = stamp(rows, ['pp', 'pp'], 36, 27);
  return outline(rows);
}
/** 夾娃娃機大王（機台，56x66） */
function clawMachineRows(mode) {
  const W = 56, H = 66;
  let rows = grid(W, H, (x, y) => {
    if (y < 8 && x >= 4 && x <= 51) return y < 2 ? 'k' : (Math.floor(x / 4) % 2 ? 'P' : 'p'); // 招牌
    if (y >= 8 && y < 44 && x >= 4 && x <= 51) { if (x <= 6 || x >= 49) return 'P'; return 'C'; } // 玻璃
    if (y >= 44 && y < 64 && x >= 2 && x <= 53) return y === 44 ? 'w' : x <= 4 || x >= 51 ? 'P' : 'p';
    return '.';
  });
  // 玻璃反光與裡面的布偶
  for (let k = 0; k < 8; k++) rows = stamp(rows, ['w'], 10 + k, 10 + k);
  rows = stamp(rows, ['.pp.pp.', 'ppppppp', 'pwpppwp', '.ppppp.'], 10, 36);
  rows = stamp(rows, ['.cc.cc.', 'ccccccc', 'cwcccwc', '.ccccc.'], 30, 35);
  rows = stamp(rows, ['.yy.', 'yyyy', 'ywyw'], 22, 38);
  // 投幣口、按鈕（臉）
  rows = stamp(rows, mode === 'hurt' ? ['o.o..........o.o', '.o............o.', 'o.o..........o.o'] : mode === 'angry' ? ['RR............RR', '.RR..........RR.', '..R..........R..'] : ['.oo..........oo.', 'oyyo........oyyo', '.oo..........oo.'], 20, 48);
  rows = stamp(rows, ['kkkk', 'k..k', 'kkkk'], 26, 56);
  return outline(rows);
}
// 道具與小吃
const PROPS = { o: 0, k: 0, n: 1, u: 2, P: 3, p: 4, l: 5, c: 6, C: 7, y: 8, Y: 9, R: 10, b: 11, s: 12, S: 13, g: 14, w: 15 };
const CHAIR = outline([
  '............',
  '.RRRRRRRRRR.',
  '.RlRRRRRRRR.',
  '.RRRRRRRRRR.',
  '.R........R.',
  '.RRRRRRRRRR.',
  '.RlllllllRR.',
  '.RRRRRRRRRR.',
  '..R......R..',
  '..R......R..',
  '.RR......RR.',
  '............',
]);
const TRASH = outline([
  '..........',
  '.gggggggg.',
  '.wwwwwwww.',
  '..gugugu..',
  '..gugugu..',
  '..gugugu..',
  '..gugugu..',
  '..gugugu..',
  '..gggggg..',
  '..........',
]);
const CRATE = outline([
  '..............',
  '.bbbbbbbbbbbb.',
  '.bYbbbbbbbbYb.',
  '.bbYbbbbbbYbb.',
  '.bbbYbbbbYbbb.',
  '.bbbbYbbYbbbb.',
  '.bbbbbYYbbbbb.',
  '.bbbbYbbYbbbb.',
  '.bbbYbbbbYbbb.',
  '.bbbbbbbbbbbb.',
  '..............',
]);
const FOOD = {
  chicken: ['...bbbb...', '..bYYYYb..', '.bYYbYYYb.', '.bYYYYbYb.', '.bYbYYYYb.', '..bYYYYb..', '...bwwb...', '....ww....'],
  candy: ['..R.', '.RwR', '.RRR', '.RwR', '.RRR', '.RwR', '..b.', '..b.'],
  mango: ['..yyyy..', '.yyYyyy.', 'yyyyyYyy', 'wwwwwwww', '.cccccc.', '..cccc..', '...cc...'],
  tea: ['...PP...', '...P....', '.wwwwww.', '.CCCCCC.', '.yyyyyy.', '.yykyky.', '.ykykyk.', '..kkkk..'],
  sausage: ['..RR..', '.RlRR.', '.RlRR.', '.RRRR.', '.RRRR.', '.RRRR.', '..RR..', '..bb..', '..bb..'],
  tofu: ['.YYY.YYY.', '.YyY.YyY.', '.YYY.YYY.', '...YYY...', '...YyY...', 'wwwwwwwww', '.ggggggg.'],
};
const TOKEN = ['.oooo.', 'oyyyyo', 'oyRyyo', 'oyyRyo', 'oYyyYo', '.oooo.'];
const POINT = ['..y..', '.yyy.', 'yywyy', '.yyy.', '..y..'];

export const FOOD_IDS = Object.keys(FOOD);

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
    cat: withLie({ head: M(catHead('normal')), headHurt: M(catHead('hurt')), torso: M(suitTorso('w', 'g', ['CC', 'CC', 'CC'])) }),
    dog: withLie({ head: M(dogHead('normal')), headHurt: M(dogHead('hurt')), torso: M(suitTorso('y', 'b', ['ww', 'ww', 'ww'])) }),
    boss1: withLie({ head: M(bigRabbitHead('normal')), headHurt: M(bigRabbitHead('hurt')), torso: M(SUIT) }),
    panda: withLie({ head: M(pandaHead('normal')), headHurt: M(pandaHead('hurt')), headShout: M(pandaHead('rage')), torso: M(suitTorso('w', 'g', ['kk', 'kk', 'kk'])) }),
    bubbleTea: { idle: M(bubbleTeaRows('idle')), open: M(bubbleTeaRows('open')), hurt: M(bubbleTeaRows('hurt')) },
    clawMachine: { idle: M(clawMachineRows('idle')), angry: M(clawMachineRows('angry')), hurt: M(clawMachineRows('hurt')) },
    blackShoe: mk(['.ooooo.', 'okkkkko', 'oKkkkko', '.ooooo.'], { ...PARTS, k: 0, K: 1 }), whitePaw: mk(['.oo.', 'owwo', 'owwo', '.oo.'], PARTS),
    chair: mk(CHAIR, PROPS), trash: mk(TRASH, PROPS), crate: mk(CRATE, PROPS),
    food: Object.fromEntries(FOOD_IDS.map(id => [id, mk(outline(['.'.repeat(FOOD[id][0].length + 2), ...FOOD[id].map(r => '.' + r + '.'), '.'.repeat(FOOD[id][0].length + 2)]), PROPS)])),
    token: mk(TOKEN, { ...PROPS, o: 0 }), point: mk(outline(['.......', ...POINT.map(r => '.' + r + '.'), '.......']), PROPS),
  };
  function withLie(o) { o.torsoLie = lie(o.torso); o.headLie = lie(o.headHurt); return o; }
}
