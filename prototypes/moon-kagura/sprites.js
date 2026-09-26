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
const YOKAI = { o: 0, O: 7, k: 8, G: 10, g: 11, w: 6, v: 5, R: 9, p: 13, u: 4, U: 3, i: 2, F: 15, s: 12, n: 1 };

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
  };
}
