// 《月下神樂》像素美術：全部以字元陣列定義，對應下方 16 色調色盤。
// 角色採「分件組合」：頭、身體、緋袴各自定義後疊合成每一格；
// 前手與神樂鈴杖、馬尾擺動在遊戲中以程式即時繪製，揮擊角度可以連續變化。
import { Sprite, composeRows, gridRows as grid, outlineRows as outline, stampRows as stamp, inEllipse } from '../engine/pixel.js';

export const PALETTE = [
  '#0d0b1a', // 0 墨黑：外框
  '#1d1a3b', // 1 夜：天空深處
  '#2f2b5e', // 2 靛：頭髮、遠山
  '#4d4596', // 3 紫：頭髮光澤、石
  '#7e74d6', // 4 薰衣草
  '#bfc0ff', // 5 月光：白衣陰影
  '#f5f2ff', // 6 白
  '#3b2626', // 7 深木
  '#74402f', // 8 木／緋袴陰影
  '#c23b2e', // 9 朱紅：緋袴、鳥居
  '#ef7a3a', // 10 燈籠橙
  '#ffd66b', // 11 金：神樂鈴
  '#f7c9aa', // 12 膚
  '#e0707e', // 13 櫻粉
  '#2f5a4e', // 14 深綠
  '#86c28f', // 15 靈火綠
];

// ================= 主角：緋鈴 =================
const HIRIN = { o: 0, h: 2, l: 3, L: 4, w: 6, v: 5, R: 9, d: 8, s: 12, p: 13, r: 9, g: 11, G: 10 };

const HEAD = [
  '....ooooo....',
  '..oohhhhhoo..',
  '.ohhhhllhhho.',
  'ohhhhlhhhhhho',
  'ohhhhhhhhhhho',
  'ohhhhhhhshsho',
  'ohhhhhsssssho',
  'ohhhhhossosho',
  'ohhhhhrssrsho',
  'ohhhhspssspho',
  '.ohhhosspsoho',
  '..ohhoooooho.',
  '...oo.....o..',
];
const HEAD_BLINK = HEAD.map((r, i) => i === 7 ? 'ohhhhhsssssho' : i === 8 ? 'ohhhhhossosho' : r);
const HEAD_HURT = HEAD.map((r, i) => i === 7 ? 'ohhhhhossosho' : i === 8 ? 'ohhhhhsssssho' : i === 10 ? '.ohhhossosoho' : r);

const TORSO = [
  '..owRRwo..',
  '.owwwRwwo.',
  '.owvwwwwo.',
  '.ovvwwwvo.',
  '..ovwwvo..',
];

const LEGS = {
  stand: [
    '...oRRRRRRo...',
    '...oRRdRRRo...',
    '..oRRRdRRRRo..',
    '..oRRdRRRdRo..',
    '..oRRdRRRdRRo.',
    '.oRRRdRRRdRRo.',
    '.oRRdRRooRdRo.',
    '.ooooo..ooooo.',
    '..owwo...owwo.',
  ],
  run: [
    ['...oRRRRRRo...', '...oRRRRRRRo..', '..odRRRRRRRRo.', '.oddoRRRRRRRRo', '.oddo.oRRRRRRo', 'oddo...oRRRRRo', 'odo.....ooooo.', 'oo......owwo..', '..............'],
    ['...oRRRRRRo...', '...oRRRRRRo...', '..odRRRRRRRo..', '..oddoRRRRRRo.', '.oddo.oRRRRRo.', '.oddo..oRRRRo.', '.oooo..ooooo..', '..oo...owwo...', '..............'],
    ['...oRRRRRRo...', '...oRRRRRRo...', '...oRRdRRRo...', '..oRRdddRRRo..', '..oRRdddRRRo..', '..oRRodoRRo...', '..ooo.oooo....', '...owwo.......', '..............'],
    ['...oRRRRRRo...', '...oRRRRRRo...', '..oRRRRRRddo..', '.oRRRRRRoddo..', '.oRRRRRo.oddo.', 'oRRRRRo...oddo', 'ooooo......ooo', '.owwo.......oo', '..............'],
    ['...oRRRRRRo...', '...oRRRRRRRo..', '..oRRRRRRRdRo.', '.oRRRRoRRRddo.', '.oRRRo.oRRddo.', 'oRRRo...oddddo', 'oooo.....oooo.', 'owwo.....owo..', '..............'],
    ['...oRRRRRRo...', '...oRRRRRRo...', '...oRRRRdRo...', '..oRRRRdddRo..', '..oRRRRdddRo..', '...oRRoddoo...', '....oooooo....', '.......owwo...', '..............'],
  ],
  jump: ['...oRRRRRRo...', '...oRRRRRRRo..', '..oRRRRdRRRRo.', '..oRRRRdoRRRo.', '..oRRRdo.oRRo.', '...oooo..oooo.', '...owwo..owwo.', '....oo....oo..', '..............'],
  fall: ['...oRRRRRRo...', '..oRRRRRRRRo..', '.oRRRdRRRdRRo.', '.oRRdRRRRRdRRo', 'oRRRdRRRRRdRRo', 'oRRdRRooRRRdRo', 'ooooo...ooooo.', '.owwo....owwo.', '..............'],
  dash: ['....oRRRRRRo..', '...oRRRRRRRRo.', '..oRRRRRRRRRRo', '.oRRRRRRRRRRo.', 'oRRRddddoooo..', 'oddddoooowwo..', 'oooo.....oo...', '..............', '..............'],
};

// 馬尾：綁在頭後方，依動作切換擺動方向（遊戲中另加程式擺動）
const TAIL = {
  hang: ['..RRo', '.oRgo', 'ohhRo', 'ohlo.', 'ohho.', 'ohho.', '.oho.', '.oho.', '..o..'],
  swept: ['......oRRo', '..oooohRgo', '.ohhhhhhRo', 'ohhlhhhho.', '.oohhhoo..', '...oo.....'],
  lifted: ['.o....', 'oho...', 'ohho..', '.ohlo.', '.ohhRo', '..oRgo', '...RRo'],
};

/** 組合出一格全身圖（16x26），bob 為上半身下沉的像素數 */
function body(head, legs, bob = 0) {
  return composeRows(16, 26, [
    { rows: legs, x: 1, y: 17 },
    { rows: TORSO, x: 4, y: 12 + bob },
    { rows: head, x: 2, y: 0 + bob },
  ]);
}
// 相對於 16x26 圖框：前手肩膀位置、馬尾綁點
export const RIG = { shoulder: [9, 14], tail: [3, 3], w: 16, h: 26 };

// ================= 敵人 =================
const YOKAI = { o: 0, O: 7, k: 8, G: 10, g: 11, w: 6, v: 5, R: 9, p: 13, u: 4, U: 3, i: 2, F: 15, s: 12, n: 1, D: 14 };

/** 提燈妖：紙燈籠妖怪，一隻大眼與長舌。mode：0/1 舌頭擺動、blink、hurt */
function lanternRows(mode) {
  const W = 14, H = 17, cx = 6.5, cy = 7.5;
  let rows = grid(W, H, (x, y) => {
    if (y <= 1 && x >= 4 && x <= 9) return 'O';
    if (y >= 13 && y <= 14 && x >= 4 && x <= 9) return 'O';
    if (inEllipse(x, y, cx, cy, 6.2, 6.1) && y >= 2 && y <= 12) {
      if (x <= 2 || (x <= 3 && (y <= 3 || y >= 11))) return y % 2 ? 'k' : 'G';
      return y % 2 ? 'G' : 'g';
    }
    return '.';
  });
  const eye = mode === 'blink' ? ['.oooo.', '......', '......'] : mode === 'hurt' ? ['.o..o.', '..oo..', '.o..o.'] : ['.oooo.', 'owwvoo', 'owwooo', '.oooo.'];
  rows = stamp(rows, eye, 4, 4);
  const tongue = mode === 1 ? ['oooooo', '.oRpo.', '..pRo.', '...po.', '...o..'] : ['oooooo', '.oRpo.', '.oRp..', '.op...', '.o....'];
  rows = stamp(rows, tongue, 4, 9);
  return outline(rows);
}

/** 唐傘妖：一隻眼、一條腿的破傘妖怪。pose：stand / crouch / hop / hurt */
function umbrellaRows(pose) {
  const W = 16, H = 20;
  const top = pose === 'crouch' ? 3 : pose === 'hop' ? 0 : 1;
  let rows = grid(W, H, (x, y) => {
    const yy = y - top;
    if (yy >= 0 && yy <= 7 && inEllipse(x, yy, 7.5, 7.5, 7.6, 7.4)) {
      if (yy === 7) return (x % 3 === 0) ? 'U' : '.';
      return Math.floor((x + 0.5) / 4) % 2 ? 'u' : 'U';
    }
    return '.';
  });
  rows = stamp(rows, ['.o.', 'ooo'], 6, Math.max(0, top - 1));
  const eye = pose === 'hurt' ? ['o...o', '.o.o.', '..o..'] : ['.ooo.', 'owwvo', 'owooo', '.ooo.'];
  rows = stamp(rows, eye, 5, top + 2);
  rows = stamp(rows, ['RR', 'pR', '.p'], pose === 'hop' ? 11 : 10, top + 6);
  const legTop = top + 8;
  const legLen = pose === 'crouch' ? 5 : pose === 'hop' ? 9 : 7;
  for (let i = 0; i < legLen; i++) rows = stamp(rows, ['k'], 7 + (pose === 'crouch' && i > 2 ? 1 : 0), legTop + i);
  const footY = Math.min(H - 2, legTop + legLen);
  rows = stamp(rows, ['kkkkk', 'O...O'], 5, footY);
  return outline(rows);
}

/** 稻草人（訓練靶）。lean：-1 / 0 / 1 */
function scarecrowRows(lean) {
  const W = 18, H = 26;
  let rows = grid(W, H, () => '.');
  const sh = y => Math.round(lean * (22 - y) / 10);
  for (let y = 12; y < 26; y++) rows = stamp(rows, ['k'], 8 + sh(y), y);
  for (let y = 11; y <= 18; y++) {
    const half = y < 13 ? 3 : 4;
    const row = Array.from({ length: half * 2 + 1 }, (_, i) => ((i + y) % 3 === 0 ? 'G' : 'g')).join('');
    rows = stamp(rows, [row], 8 - half + sh(y), y);
  }
  rows = stamp(rows, ['kkkkkkkkkkkkkkkk'], 1 + sh(12), 12);
  rows = stamp(rows, ['gGg', 'ggG'], 0 + sh(12), 13);
  rows = stamp(rows, ['gGg', 'Ggg'], 15 + sh(12), 13);
  rows = stamp(rows, ['.wwwww.', 'wwwwwww', 'wowwwow', 'wwwRwww', '.wwwww.'], 5 + sh(6), 5);
  rows = stamp(rows, ['....ggg....', '..ggggggg..', 'gggRRRRRggg'], 3 + sh(2), 2);
  return outline(rows);
}

// ================= 場景物件 =================
const PROP = { o: 0, n: 1, i: 2, U: 3, u: 4, v: 5, w: 6, O: 7, k: 8, R: 9, G: 10, g: 11 };
/** 石燈籠（窗內燈火由遊戲另外畫出閃爍） */
const TORO = outline([
  '....uuuu....',
  '..uuUUUUuu..',
  'uuUUUUUUUUuu',
  '...UUUUUU...',
  '...UggggU...',
  '...UgGGgU...',
  '...UggggU...',
  '..uuUUUUuu..',
  '.....UU.....',
  '.....UU.....',
  '....uUUu....',
  '...uUUUUu...',
  '..uUUUUUUu..',
]);

// ================= 新增妖怪 =================
/** 石狐（砲台）：面向右，mode：idle / charge / hurt */
function foxRows(mode) {
  const W = 19, H = 20;
  let rows = grid(W, H, (x, y) => {
    if (y >= 16 && y <= 18 && x >= 2 && x <= 15) return y === 16 ? 'u' : 'U'; // 台座
    if (inEllipse(x, y, 4, 10.5, 2.4, 4.6)) return x <= 3 ? 'U' : 'v'; // 捲起的尾巴
    if (inEllipse(x, y, 8.5, 12.5, 4.6, 4)) return x < 7 ? 'U' : 'u'; // 身體
    if (x >= 10 && x <= 12 && y >= 12 && y <= 15) return 'u'; // 前腳
    if (inEllipse(x, y, 11.5, 6.5, 3.4, 3)) return 'u'; // 頭
    if (y >= 6 && y <= 8 && x >= 13 && x <= 16) return 'u'; // 鼻吻
    return '.';
  });
  rows = stamp(rows, ['.u..u', 'uu.uu', 'uu.uu'], 9, 1);
  rows = stamp(rows, ['.p..p'], 9, 2);
  rows = stamp(rows, ['RRRRR', '.RRR.'], 9, 9);
  rows = stamp(rows, [mode === 'charge' ? 'g' : mode === 'hurt' ? 'w' : 'o'], 12, 6);
  rows = stamp(rows, ['o'], 16, 6);
  if (mode === 'charge') rows = stamp(rows, ['G', 'g'], 16, 7);
  return outline(rows);
}

/** 鎌鼬（小）：面向右，pose：run0 / run1 / crouch / dash / hurt */
function weaselRows(pose) {
  const W = 24, H = 13;
  const low = pose === 'crouch' ? 2 : 0, long = pose === 'dash' ? 2 : 0;
  let rows = grid(W, H, (x, y) => {
    if (pose === 'dash' ? inEllipse(x, y, 3, 7, 3.2, 1.6) : inEllipse(x, y, 3.5, 4 + low, 2, 3.2)) return y % 3 === 0 ? 'k' : 'G'; // 尾巴
    if (inEllipse(x, y, 10, 7.5 + low, 6 + long, 2.8)) return y > 8 + low ? 's' : 'G'; // 身體
    if (inEllipse(x, y, 16.5 + long, 6 + low, 2.8, 2.3)) return 'G'; // 頭
    if (x === 15 + long && y === 3 + low) return 'G';
    return '.';
  });
  rows = stamp(rows, [pose === 'hurt' ? 'w' : 'o'], 17 + long, 5 + low);
  rows = stamp(rows, ['o'], 19 + long, 6 + low);
  rows = stamp(rows, ['RRRR'], 13 + long, 8 + low); // 紅圍巾
  // 月牙鐮刀
  if (pose === 'dash') rows = stamp(rows, ['..vvw', '.v...', 'v....'], 17 + long, 8);
  else rows = stamp(rows, ['.wv', 'v..', 'v..', '.v.'], 18, 7 + low);
  const legs = pose === 'run1' ? [[7, 10], [13, 10]] : pose === 'dash' ? [[5, 9], [15, 9]] : [[6, 10], [14, 10]];
  if (pose !== 'crouch') for (const [lx, ly] of legs) rows = stamp(rows, ['k', 'k'], lx, ly);
  return outline(rows);
}

/** 狸貓：面向右，pose：idle / throw / hurt */
function tanukiRows(pose) {
  const W = 17, H = 19;
  let rows = grid(W, H, (x, y) => {
    if (inEllipse(x, y, 3, 13, 2.2, 3.4)) return y % 3 === 0 ? 'O' : 'k'; // 條紋尾巴
    if (inEllipse(x, y, 8, 12.5, 5, 4.6)) return inEllipse(x, y, 9, 13.5, 2.8, 2.8) ? 's' : 'k'; // 身體＋肚子
    if (inEllipse(x, y, 8.5, 6.5, 4.4, 3.8)) return 'k'; // 頭
    return '.';
  });
  rows = stamp(rows, ['O.......O', 'OO.....OO'], 4, 2);
  rows = stamp(rows, pose === 'hurt' ? ['o.o..o.o', '.o....o.', 'o.o..o.o'] : ['OO..OO', 'ow..ow'], pose === 'hurt' ? 4 : 6, 5);
  rows = stamp(rows, ['oo'], 8, 8);
  rows = stamp(rows, ['..F', '.FF', 'FF.'], 7, 0);
  if (pose === 'throw') rows = stamp(rows, ['.FF', 'kF.', 'k..', 'k..'], 13, 5);
  else rows = stamp(rows, ['kk'], 12, 12);
  rows = stamp(rows, ['kk.kk'], 6, 17);
  return outline(rows);
}

/** 能面：浮空的面具妖，pose：idle / attack / hurt */
function nohRows(pose) {
  const W = 15, H = 19;
  let rows = grid(W, H, (x, y) => {
    if (inEllipse(x, y, 7, 9, 5.4, 7.4)) {
      if (y < 4 || ((x < 3 || x > 11) && y < 12)) return 'n';
      return x < 4 ? 'v' : 'w';
    }
    if (y >= 12 && y <= 17 && (x === 2 || x === 12) && (y + x) % 2 === 0) return 'n'; // 垂髮
    return '.';
  });
  rows = stamp(rows, ['i.....i'], 4, 5);
  rows = stamp(rows, pose === 'attack' ? ['gg...gg'] : pose === 'hurt' ? ['o.o.o.o'] : ['oo...oo'], 4, 8);
  rows = stamp(rows, ['.RRR.', '..p..'], 5, 12);
  return outline(rows);
}

/** 土蜘蛛（小）：pose：walk0 / walk1 / hang */
function spiderRows(pose) {
  const W = 17, H = 12;
  let rows = grid(W, H, (x, y) => {
    if (inEllipse(x, y, 6, 5, 4.2, 3.4)) return (x + y) % 4 === 0 ? 'u' : (x + y) % 2 ? 'U' : 'i';
    if (inEllipse(x, y, 11, 5.5, 2.4, 2)) return 'U';
    return '.';
  });
  rows = stamp(rows, ['RR'], 11, 5);
  const legs = pose === 'hang'
    ? [[3, 1], [4, 0], [9, 1], [10, 0], [2, 7], [3, 8], [9, 8], [10, 9]]
    : pose === 'walk1'
      ? [[3, 8], [2, 9], [2, 10], [5, 8], [5, 9], [4, 10], [8, 8], [8, 9], [9, 10], [10, 8], [11, 9], [12, 10]]
      : [[3, 8], [3, 9], [2, 10], [5, 8], [6, 9], [6, 10], [8, 8], [7, 9], [7, 10], [10, 8], [10, 9], [11, 10]];
  for (const [lx, ly] of legs) rows = stamp(rows, ['U'], lx, ly);
  return outline(rows);
}

// ================= 守護妖（Boss） =================
/** 大提燈「火袋」：mode：idle / open / hurt / dizzy */
function bigLanternRows(mode) {
  const W = 42, H = 46, cx = 20.5, cy = 22.5;
  let rows = grid(W, H, (x, y) => {
    if (y >= 1 && y <= 4 && x >= 13 && x <= 28) return y === 1 ? 'O' : 'k';
    if (y >= 40 && y <= 43 && x >= 13 && x <= 28) return y === 43 ? 'O' : 'k';
    if (inEllipse(x, y, cx, cy, 18.6, 18.4) && y >= 5 && y <= 39) {
      const rib = y % 5 === 0;
      if (x <= 6 || (x <= 8 && (y <= 9 || y >= 35))) return rib ? 'k' : 'G';
      return rib ? 'G' : 'g';
    }
    return '.';
  });
  // 破洞與「火」字
  rows = stamp(rows, ['.R...R.', '..R.R..', '...R...', '..R.R..', '.R...R.', 'R.....R'], 9, 12);
  rows = stamp(rows, ['OO', 'O.'], 31, 30);
  // 大眼睛
  const eye = mode === 'hurt' ? grid(12, 9, (x, y) => ((x - y === 1 || x + y === 10) && x > 0 && x < 11) ? 'o' : '.')
    : mode === 'dizzy' ? grid(12, 9, (x, y) => { const d = Math.hypot(x - 5.5, y - 4); return d < 4.6 ? (Math.floor(d + Math.atan2(y - 4, x - 5.5) * 0.6) % 2 ? 'o' : 'w') : '.'; })
    : grid(12, 9, (x, y) => inEllipse(x, y, 5.5, 4, 5.6, 4.2) ? (inEllipse(x, y, 6.5, 4.4, 2.2, 2.4) ? 'o' : (x === 4 && y === 2 ? 'w' : 'w')) : '.');
  rows = stamp(rows, eye, 18, 13);
  if (mode !== 'hurt' && mode !== 'dizzy') rows = stamp(rows, ['w'], 23, 16);
  // 嘴巴
  if (mode === 'open' || mode === 'dizzy') {
    const mouth = grid(16, 9, (x, y) => inEllipse(x, y, 7.5, 3.5, 7.6, 4.4) ? (y >= 5 && x >= 5 && x <= 10 ? 'R' : 'o') : '.');
    rows = stamp(rows, mouth, 14, 26);
    rows = stamp(rows, ['w.w.......w.w'], 15, 26);
    if (mode === 'dizzy') rows = stamp(rows, ['RRp', 'RRp', 'Rp.', 'p..'], 19, 34);
  } else rows = stamp(rows, ['o............o', '.oo........oo.', '...oooooooo...'], 14, 27);
  return outline(rows);
}

/** 鎌鼬（守護妖）：面向右，pose：stand / crouch / dash / throw / hurt */
function kamaitachiRows(pose) {
  const W = 36, H = 22;
  const low = pose === 'crouch' ? 3 : 0, st = pose === 'dash' ? 3 : 0;
  let rows = grid(W, H, (x, y) => {
    if (pose === 'dash' ? inEllipse(x, y, 5, 11, 5, 2.4) : inEllipse(x, y, 5.5, 6 + low, 3, 5.4)) return (x + y) % 4 === 0 ? 'k' : 'G';
    if (inEllipse(x, y, 16, 12 + low, 8.5 + st, 4.2)) return y > 13 + low ? 's' : 'G';
    if (inEllipse(x, y, 25.5 + st, 9 + low, 4.2, 3.6)) return 'G';
    if ((x === 23 + st || x === 24 + st) && y >= 4 + low && y <= 5 + low) return 'G';
    return '.';
  });
  rows = stamp(rows, [pose === 'hurt' ? 'w.w' : 'oo'], 26 + st, 8 + low);
  rows = stamp(rows, ['o'], 29 + st, 9 + low);
  rows = stamp(rows, ['RRRRRR', '.RR...', '..R...'], 18 + st, 12 + low);
  const blade = ['...vvw', '..v...', '.v....', 'v.....', 'v.....', '.v....'];
  if (pose === 'dash') rows = stamp(rows, ['....vvvw', '..vv....', 'vv......'], 27 + st, 13);
  else if (pose === 'throw') rows = stamp(rows, ['kk'], 28, 11 + low);
  else rows = stamp(rows, blade, 28, 10 + low);
  if (pose !== 'crouch' && pose !== 'dash') for (const lx of [11, 20]) rows = stamp(rows, ['k', 'k', 'k'], lx, 16);
  if (pose === 'dash') for (const lx of [8, 24]) rows = stamp(rows, ['kk'], lx, 16);
  return outline(rows);
}

/** 白狐（守護妖）：面向右，pose：sit / cast / hurt */
function whiteFoxRows(pose) {
  const W = 36, H = 32;
  let rows = grid(W, H, (x, y) => {
    // 三條尾巴（扇形展開在身後）
    for (const [tx, ty, rx, ry] of [[6, 9, 3.4, 7], [4, 16, 4, 4], [7, 23, 4.4, 3]]) if (inEllipse(x, y, tx, ty, rx, ry)) return (x + y) % 5 === 0 ? 'v' : 'w';
    if (inEllipse(x, y, 16, 20, 7, 8.5)) return x < 13 ? 'v' : 'w';
    if (inEllipse(x, y, 22.5, 10, 5.2, 4.6)) return 'w';
    if (y >= 10 && y <= 12 && x >= 25 && x <= 30) return 'w';
    return '.';
  });
  rows = stamp(rows, ['.w...w', 'ww..ww', 'wp..wp', 'ww..ww'], 19, 2);
  rows = stamp(rows, ['RRRRRRR', 'RgggggR', '.RRRRR.'], 13, 14); // 神社紅圍兜與金鈴
  rows = stamp(rows, pose === 'hurt' ? ['o.o', '.o.', 'o.o'] : ['RR', 'Rg'], 23, 8);
  rows = stamp(rows, ['o'], 30, 10);
  rows = stamp(rows, ['.RR', 'R..'], 26, 13);
  if (pose === 'cast') rows = stamp(rows, ['..FF', '.FwF', 'wwF.', 'ww..', 'ww..'], 26, 14);
  else rows = stamp(rows, ['ww', 'ww', 'ww', 'vw'], 21, 25);
  rows = stamp(rows, ['wwww.wwww'], 12, 28);
  return outline(rows);
}

/** 月蝕大蛇的頭：面向右，pose：closed / open / hurt */
function serpentHeadRows(pose) {
  const W = 28, H = 20;
  const open = pose === 'open';
  let rows = grid(W, H, (x, y) => {
    if (inEllipse(x, y, 11, 9, 9.5, 7)) return y > 12 ? 'v' : (x + y * 2) % 7 === 0 ? 'u' : 'U';
    if (open ? (y >= 4 && y <= 8 && x >= 17 && x <= 25 - Math.floor((8 - y) / 2)) : (y >= 5 && y <= 11 && x >= 17 && x <= 25)) return y > 9 ? 'v' : 'U';
    if (open && y >= 12 && y <= 16 && x >= 16 && x <= 24 - (y - 12)) return 'v';
    return '.';
  });
  rows = stamp(rows, ['..UU', '.UU.', 'UU..'], 4, 0); // 角
  rows = stamp(rows, pose === 'hurt' ? ['w.w', '.w.', 'w.w'] : ['ggo', 'ggg'], 14, 5);
  if (open) {
    rows = stamp(rows, ['RRRRRR', 'RRRRR.', 'RRRR..'], 18, 9);
    rows = stamp(rows, ['w.w.w', '.....', 'w.w..'], 18, 9);
    rows = stamp(rows, ['....RRp', '......p'], 20, 11);
  } else rows = stamp(rows, ['oooooooo'], 17, 9);
  rows = stamp(rows, ['o'], 24, 6);
  return outline(rows);
}

// ================= 道具與場景物件 =================
const ITEM = { o: 0, n: 1, i: 2, U: 3, u: 4, v: 5, w: 6, O: 7, k: 8, R: 9, G: 10, g: 11, s: 12, p: 13, D: 14, F: 15 };
const COIN = [['.oooo.', 'oggggo', 'ogoogo', 'ogoogo', 'oGgggo', '.oooo.'], ['..oo..', '.oggo.', '.oGgo.', '.ogGo.', '.oggo.', '..oo..']];
const GOLD_BELL = outline([
  '............',
  '.....RR.....',
  '....R..R....',
  '.....gg.....',
  '....gggg....',
  '...gwgggG...',
  '..ggwggggG..',
  '..gggggggG..',
  '.gggggggggG.',
  '.GGGGGGGGGG.',
  '....GooG....',
  '.....GG.....',
  '............',
]);
const CHEST = [
  '..oooooooooooo..',
  '.oRRRRRRRRRRRRo.',
  'oRRRRRRRRRRRRRRo',
  'oggggggggggggggo',
  'oRRRRRRgoRRRRRRo',
  'oRRRRRRggRRRRRRo',
  'oRRRRRRRRRRRRRRo',
  'oOOOOOOOOOOOOOOo',
  'oggggggggggggggo',
  '.oooooooooooooo.',
];
const CHEST_OPEN = [
  '..oooooooooooo..',
  '.oRRRRRRRRRRRRo.',
  'oggggggggggggggo',
  'oooooooooooooooo',
  'owgwgwgwgwgwgwgo',
  'oOgggggggggggggo',
  'oRRRRRRRRRRRRRRo',
  'oOOOOOOOOOOOOOOo',
  'oggggggggggggggo',
  '.oooooooooooooo.',
];
const OFFERING = [
  'oooooooooooooooo',
  'okOkOkOkOkOkOkOo',
  'oOOOOOOOOOOOOOOo',
  'okkkkkkkkkkkkkko',
  'okkkggggggggkkko',
  'okkkgRRRRRRgkkko',
  'okkkggggggggkkko',
  'okkkkkkkkkkkkkko',
  'oOOOOOOOOOOOOOOo',
  'oo.oo......oo.oo',
];
const OFFERING_BROKEN = [
  '................',
  '................',
  '................',
  '..o.......oo....',
  'okko..o..okko.oo',
  'okkkoogoookkkoko',
  'okOkgRRgkkOkkkko',
  'okkkkkkkkkkkkkko',
  'oOOOOOOOOOOOOOOo',
  'oo.oo......oo.oo',
];
function drumRows(squash) {
  const W = 18, H = 16, top = squash ? 3 : 0;
  let rows = grid(W, H, (x, y) => {
    if (y < top) return '.';
    const yy = y - top;
    if (yy <= 3 && inEllipse(x, yy, 8.5, 1.8, 7.6, 1.9)) return yy <= 1 && x > 6 && x < 11 ? 'v' : 'w';
    if (yy >= 2 && yy <= 11 && x >= 1 && x <= 16) return yy === 3 || yy === 10 ? (x % 3 === 1 ? 'g' : 'R') : (x <= 3 ? 'O' : x >= 13 ? 'O' : 'R');
    if (yy >= 12 && (x === 3 || x === 14 || x === 4 || x === 13)) return 'k';
    return '.';
  });
  rows = stamp(rows, ['.gg.', 'g..g', '.gg.'], 7, 5 + top);
  return outline(rows);
}
const CHIME = [
  '....o....',
  '....o....',
  '..ooooo..',
  '.ovvvwvo.',
  'ovvvvvwvo',
  'ooooooooo',
  '....o....',
  '...oRo...',
  '...oRo...',
  '...oRo...',
  '...oRo...',
  '....o....',
];
const DANGO = [
  '..ooo..',
  '.opwpo.',
  '.opppo.',
  '.ooooo.',
  '.owwvo.',
  '.owwwo.',
  '.ooooo.',
  '.oFwFo.',
  '.oFFDo.',
  '..ooo..',
  '...k...',
  '...k...',
];
const SIGN = [
  'oooooooooooo',
  'okkkkkkkkkko',
  'okwwwwwwwwko',
  'okkkkkkkkkko',
  'okwwwwwwkkko',
  'okkkkkkkkkko',
  'oooooooooooo',
  '....oko.....',
  '....oko.....',
  '....oko.....',
  '....oko.....',
  '...ooooo....',
];
const ORB = ['..ooo..', '.ouuvo.', 'ouuvwvo', 'ouuuvuo', 'ouUuuuo', '.oUUuo.', '..ooo..'];
const ORB_EMPTY = ['..ooo..', '.oiiio.', 'oiiiiio', 'oiiiiio', 'oiiiiio', '.oiiio.', '..ooo..'];
/** 御守圖示：B 主色、b 陰影、M 圖紋 */
function charmRows(mark) {
  let rows = [
    '...o...o...',
    '..oRo.oRo..',
    '...oRRRo...',
    '....oRo....',
    '..ooooooo..',
    '.oBBBBBBBo.',
    '.oBgggggBo.',
    '.oBBBBBBBo.',
    '.oBBBBBBBo.',
    '.oBBBBBBBo.',
    '.oBBBBBBbo.',
    '.obbbbbbbo.',
    '..ooooooo..',
  ];
  return stamp(rows, mark, 3, 7);
}
const CHARM_MARKS = {
  swift: ['M...M', '.M.M.', 'MM.MM'],
  adamant: ['.MMM.', 'MM.MM', '.MMM.'],
  resonance: ['..M..', '.MMM.', 'M.M.M'],
  moonshade: ['.MM..', 'M....', '.MM..'],
  breaker: ['M...M', '.MMM.', 'M...M'],
  fortune: ['MMMMM', 'M.M.M', 'MMMMM'],
  longbell: ['..M..', '..M..', '.MMM.'],
  vigor: ['.M.M.', 'MMMMM', '..M..'],
};
const CHARM_COLORS = {
  swift: [4, 3, 6], adamant: [9, 7, 11], resonance: [15, 14, 6], moonshade: [3, 2, 5],
  breaker: [5, 4, 9], fortune: [11, 10, 9], longbell: [13, 9, 6], vigor: [14, 1, 15],
};

/** 狸貓茶屋老闆（對話頭像 32x30） */
function tanukiPortrait(smile) {
  const W = 32, H = 30;
  let rows = grid(W, H, (x, y) => {
    if (y >= 1 && y <= 7 && Math.abs(x - 15.5) <= (y - 0.5) * 2.4) return y === 7 ? 'O' : (x + y) % 4 === 0 ? 'G' : 'g'; // 斗笠
    if (inEllipse(x, y, 15.5, 17, 11.5, 10)) return inEllipse(x, y, 15.5, 22, 6, 5) ? 's' : 'k';
    if (inEllipse(x, y, 5, 8, 2.6, 3.2) || inEllipse(x, y, 26, 8, 2.6, 3.2)) return 'O';
    return '.';
  });
  rows = stamp(rows, ['OOOO......OOOO', 'OOOOO....OOOOO', '.OOO......OOO.'], 9, 13);
  rows = stamp(rows, smile ? ['.o......o.', 'o.o....o.o'] : ['ow......ow', 'oo......oo'], 11, 14);
  rows = stamp(rows, ['.oo.', 'oooo', '.oo.'], 14, 18);
  rows = stamp(rows, smile ? ['o......o', '.oooooo.'] : ['..oooo..'], 12, 22);
  rows = stamp(rows, ['p', 'p'], 10, 20); rows = stamp(rows, ['p', 'p'], 21, 20);
  return outline(rows);
}

export const CHARM_IDS = Object.keys(CHARM_MARKS);

export function buildSprites() {
  const mk = (rows, legend = HIRIN) => new Sprite(rows, legend, PALETTE);
  const Y = rows => mk(rows, YOKAI);
  return {
    hirin: {
      idle: [mk(body(HEAD, LEGS.stand)), mk(body(HEAD, LEGS.stand, 1))],
      blink: mk(body(HEAD_BLINK, LEGS.stand)),
      run: LEGS.run.map((l, i) => mk(body(HEAD, l, i === 1 || i === 4 ? 1 : 0))),
      jump: mk(body(HEAD, LEGS.jump)),
      fall: mk(body(HEAD, LEGS.fall)),
      dash: mk(body(HEAD, LEGS.dash, 1)),
      hurt: mk(body(HEAD_HURT, LEGS.fall)),
    },
    tail: { hang: mk(TAIL.hang), swept: mk(TAIL.swept), lifted: mk(TAIL.lifted) },
    lantern: { float: [Y(lanternRows(0)), Y(lanternRows(1))], blink: Y(lanternRows('blink')), hurt: Y(lanternRows('hurt')) },
    umbrella: { stand: Y(umbrellaRows('stand')), crouch: Y(umbrellaRows('crouch')), hop: Y(umbrellaRows('hop')), hurt: Y(umbrellaRows('hurt')) },
    scarecrow: { mid: Y(scarecrowRows(0)), left: Y(scarecrowRows(-1)), right: Y(scarecrowRows(1)) },
    toro: mk(TORO, PROP),
    bell: mk(['.g.', 'gGg', 'oGo'], { o: 0, g: 11, G: 10 }),
    fox: { idle: Y(foxRows('idle')), charge: Y(foxRows('charge')), hurt: Y(foxRows('hurt')) },
    weasel: { run: [Y(weaselRows('run0')), Y(weaselRows('run1'))], crouch: Y(weaselRows('crouch')), dash: Y(weaselRows('dash')), hurt: Y(weaselRows('hurt')) },
    tanuki: { idle: Y(tanukiRows('idle')), throw: Y(tanukiRows('throw')), hurt: Y(tanukiRows('hurt')) },
    noh: { idle: Y(nohRows('idle')), attack: Y(nohRows('attack')), hurt: Y(nohRows('hurt')) },
    spider: { walk: [Y(spiderRows('walk0')), Y(spiderRows('walk1'))], hang: Y(spiderRows('hang')) },
    bigLantern: { idle: Y(bigLanternRows('idle')), open: Y(bigLanternRows('open')), hurt: Y(bigLanternRows('hurt')), dizzy: Y(bigLanternRows('dizzy')) },
    kamaitachi: { stand: Y(kamaitachiRows('stand')), crouch: Y(kamaitachiRows('crouch')), dash: Y(kamaitachiRows('dash')), throw: Y(kamaitachiRows('throw')), hurt: Y(kamaitachiRows('hurt')) },
    whiteFox: { sit: Y(whiteFoxRows('sit')), cast: Y(whiteFoxRows('cast')), hurt: Y(whiteFoxRows('hurt')) },
    serpent: { closed: Y(serpentHeadRows('closed')), open: Y(serpentHeadRows('open')), hurt: Y(serpentHeadRows('hurt')) },
    coin: COIN.map(r => mk(r, ITEM)),
    goldBell: mk(GOLD_BELL, ITEM),
    chest: mk(CHEST, ITEM), chestOpen: mk(CHEST_OPEN, ITEM),
    offering: mk(OFFERING, ITEM), offeringBroken: mk(OFFERING_BROKEN, ITEM),
    drum: mk(drumRows(false), ITEM), drumSquash: mk(drumRows(true), ITEM),
    chime: mk(CHIME, ITEM), dango: mk(DANGO, ITEM), sign: mk(SIGN, ITEM),
    orb: mk(ORB, ITEM), orbEmpty: mk(ORB_EMPTY, ITEM),
    charms: Object.fromEntries(CHARM_IDS.map(id => { const [B, b, M] = CHARM_COLORS[id]; return [id, mk(charmRows(CHARM_MARKS[id]), { ...ITEM, B, b, M })]; })),
    tanukiFace: mk(tanukiPortrait(false), ITEM), tanukiSmile: mk(tanukiPortrait(true), ITEM),
    hirinFace: mk(HEAD, HIRIN), hirinFaceHurt: mk(HEAD_HURT, HIRIN),
  };
}
