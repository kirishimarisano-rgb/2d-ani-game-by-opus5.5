import { Bitmap } from './bitmap';
import { T } from './palette';

// 立繪：身體、頭髮、衣服用程式組裝；眼睛、眉毛、嘴巴是手畫的字元陣列印章。
// 立繪大小 112×150，畫面上以底部對齊。

export const SPR_W = 112;
export const SPR_H = 150;
const CX = 56;

type EyeShape = 'open' | 'half' | 'closed' | 'smile' | 'aside' | 'wide';
type Brow = 'normal' | 'up' | 'angry' | 'sad' | 'flat';
type Mouth = 'normal' | 'smile' | 'shy' | 'sad' | 'angry' | 'o' | 'flat';

interface ExprDef {
  eyes: EyeShape;
  brow: Brow;
  mouth: Mouth;
  blush?: boolean;
  tear?: boolean;
}

const EXPR: Record<string, ExprDef> = {
  normal: { eyes: 'open', brow: 'normal', mouth: 'normal' },
  smile: { eyes: 'smile', brow: 'up', mouth: 'smile' },
  shy: { eyes: 'aside', brow: 'sad', mouth: 'shy', blush: true },
  sad: { eyes: 'half', brow: 'sad', mouth: 'sad', tear: true },
  angry: { eyes: 'half', brow: 'angry', mouth: 'angry', blush: true },
  surprised: { eyes: 'wide', brow: 'up', mouth: 'o' },
  serious: { eyes: 'half', brow: 'flat', mouth: 'flat' },
  troubled: { eyes: 'open', brow: 'sad', mouth: 'shy' },
};

// ---- 手畫印章（左眼；右眼預設左右翻轉） ----
// k 睫毛　d 瞳孔深色　i 瞳孔　h 高光　w 眼白　l 下眼瞼
const EYES_F: Record<EyeShape, string[]> = {
  open: [
    '.kkkkkk.',
    'kkdddddk',
    '.wdhhidw',
    '.wdhiidw',
    '.wdiiidw',
    '.wdiiiiw',
    '..diiid.',
    '...ll...',
  ],
  half: [
    '........',
    '........',
    '.kkkkkk.',
    'kkdddddk',
    '.wdhiidw',
    '.wdiiiiw',
    '..diiid.',
    '...ll...',
  ],
  closed: ['........', '........', '........', '........', 'k......k', '.kkkkkk.', '........', '........'],
  smile: ['........', '........', '........', '..kkkk..', '.k....k.', 'k......k', '........', '........'],
  aside: [
    '........',
    '........',
    '.kkkkkk.',
    'kddddkkk',
    'wdhidww.',
    'wdiidw..',
    '.diid...',
    '...ll...',
  ],
  wide: [
    '.kkkkkk.',
    'kkwwwwkk',
    '.wwddww.',
    '.wdhidw.',
    '.wdiidw.',
    '.wwddww.',
    '..wwww..',
    '...ll...',
  ],
};
const EYES_M: Record<EyeShape, string[]> = {
  open: ['........', '........', '.kkkkkk.', 'kkdddddk', '.wdhidw.', '.wdiidw.', '..dddd..', '........'],
  half: ['........', '........', '........', '.kkkkkk.', 'kkdddddk', '.wdiidw.', '..dddd..', '........'],
  closed: ['........', '........', '........', '........', '........', 'kkkkkkkk', '........', '........'],
  smile: ['........', '........', '........', '........', '..kkkk..', '.k....k.', '........', '........'],
  aside: ['........', '........', '........', '.kkkkkk.', 'kddddkkk', 'wdhidww.', '.ddd....', '........'],
  wide: ['........', '.kkkkkk.', 'kkwwwwkk', '.wwddww.', '.wdhidw.', '.wwddww.', '..wwww..', '........'],
};
const NO_FLIP: EyeShape[] = ['aside'];

const BROWS: Record<Brow, { rows: string[]; dy: number }> = {
  normal: { rows: ['..kkkkk', 'kk.....'], dy: 0 },
  up: { rows: ['...kkk.', '.kk...k', 'k......'], dy: -2 },
  angry: { rows: ['kk.....', '..kkk..', '.....kk'], dy: 0 },
  sad: { rows: ['.....kk', '..kkk..', 'kk.....'], dy: -1 },
  flat: { rows: ['kkkkkkk'], dy: 1 },
};

// 嘴巴：[閉, 半開, 開]　k 線　m 口內　t 舌　w 牙
const MOUTHS: Record<Mouth, string[][]> = {
  normal: [['kkk'], ['.kk.', 'kmmk', '.kk.'], ['.kkk.', 'kmmmk', 'kmttk', '.kkk.']],
  smile: [['k...k', '.kkk.'], ['kkkkk', 'kmmmk', '.kkk.'], ['kkkkkk', 'kwwwwk', 'kmttmk', '.kkkk.']],
  shy: [['k.k.k', '.k.k.'], ['.kk.', 'kmmk', '.kk.'], ['.kkk.', 'kmmmk', '.kkk.']],
  sad: [['.kkk.', 'k...k'], ['.kkk.', 'kmmmk', 'k...k'], ['.kkk.', 'kmmmk', 'kmmmk', '.kkk.']],
  angry: [['kkkk.', '....k'], ['kkkkk', 'kmmmk', '.kkk.'], ['kkkkk', 'kwwwk', 'kmmmk', '.kkk.']],
  o: [['.k.', 'k.k', '.k.'], ['.kk.', 'kmmk', 'kmmk', '.kk.'], ['.kkk.', 'kmmmk', 'kmmmk', 'kmmmk', '.kkk.']],
  flat: [['kkkk'], ['kkkk', 'kmmk', '.kk.'], ['.kkk.', 'kmmmk', '.kkk.']],
};

// ---- 角色定義 ----
interface CharDef {
  skin: [number, number, number]; // 底、影、亮
  hair: [number, number, number];
  iris: [number, number];
  male?: boolean;
  draw: (b: Bitmap, d: CharDef) => { back: Bitmap; front: Bitmap };
}

const OUT = 1; // 輪廓色

function face(b: Bitmap, d: CharDef) {
  const [s, sh] = d.skin;
  // 脖子
  b.rect(CX - 6, 52, 12, 18, s);
  b.rect(CX - 6, 56, 12, 4, sh);
  // 頭與下巴
  b.ellipse(CX, 38, 18.5, 18, s);
  b.poly(
    d.male
      ? [[CX - 18, 40], [CX + 18, 40], [CX + 14, 53], [CX + 4, 60], [CX - 4, 60], [CX - 14, 53]]
      : [[CX - 18, 40], [CX + 18, 40], [CX + 12, 54], [CX, 61], [CX - 12, 54]],
    s,
  );
  // 耳朵
  b.ellipse(CX - 18, 44, 2.5, 4, s);
  b.ellipse(CX + 18, 44, 2.5, 4, s);
  b.px(CX - 18, 44, sh);
  b.px(CX + 18, 44, sh);
}

/** 瀏海：頭頂髮蓋＋一排垂下的髮尖 */
function bangs(f: Bitmap, d: CharDef, tips: [number, number][], capRy = 20, capY = 34) {
  const [h] = d.hair;
  f.ellipse(CX, capY, 22, capRy, h);
  // 把髮蓋下半切掉，再補上髮尖
  for (let y = capY - 4; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.get(x, y) === h) f.px(x, y, T);
  let prev: [number, number] = [CX - 22, capY - 4];
  for (const tip of tips) {
    f.poly([[prev[0], capY - 5], tip, [tip[0] + 1, capY - 5]], h);
    prev = tip;
  }
  f.poly([[CX - 22, capY - 5], [CX + 22, capY - 5], [CX + 22, capY - 2], [CX - 22, capY - 2]], h);
}

function hairShade(b: Bitmap, d: CharDef, shineY: number) {
  const [h, hs, hl] = d.hair;
  // 天使光圈（左右兩小段）
  for (const [x0, x1] of [[CX - 13, CX - 6], [CX + 4, CX + 10]]) {
    for (let x = x0; x <= x1; x++) {
      const y = Math.round(shineY + ((x - CX) * (x - CX)) / 50);
      if (b.get(x, y) === h) b.px(x, y, hl);
    }
  }
  // 髮尖下緣陰影
  b.recolorWhere(
    (c, x, y) => c === h && b.get(x, y + 2) !== h && b.get(x, y + 2) !== hs && b.get(x, y + 2) !== hl && y > shineY + 4,
    () => hs,
  );
}

function clothesShade(b: Bitmap, base: number, shade: number) {
  // 手臂與身體的分界、兩側陰影
  b.recolorWhere((c, x, y) => c === base && y > 84 && (Math.abs(x - (CX - 25)) < 1 || Math.abs(x - (CX + 25)) < 1), () => shade);
  b.recolorWhere((c, x, y) => c === base && y > 76 && (x < CX - 31 || x > CX + 31), () => shade);
}

function torso(b: Bitmap, c: number, wide = 0) {
  const w = wide;
  b.poly(
    [[CX - 11, 63], [CX + 11, 63], [CX + 26 + w, 71], [CX + 33 + w, 80], [CX + 36 + w, 96], [CX + 40 + w, 150],
     [CX - 40 - w, 150], [CX - 36 - w, 96], [CX - 33 - w, 80], [CX - 26 - w, 71]],
    c,
  );
}

// 小滿：短馬尾、黃 T 恤、深藍圍裙
const XIAOMAN: CharDef = {
  skin: [8, 9, 7],
  hair: [22, 25, 23],
  iris: [10, 23],
  draw(b, d) {
    const back = new Bitmap(SPR_W, SPR_H);
    const [h] = d.hair;
    back.ellipse(CX, 36, 22, 21, h);
    // 馬尾（往右後）
    back.poly([[CX + 14, 22], [CX + 30, 20], [CX + 38, 40], [CX + 36, 62], [CX + 28, 48], [CX + 20, 34]], h);
    back.rect(CX + 14, 20, 6, 6, 11);
    torso(b, 14);
    // 領口
    b.ellipse(CX, 64, 9, 4, 13);
    b.ellipse(CX, 63, 7, 3, d.skin[0]);
    clothesShade(b, 14, 13);
    // 圍裙
    b.poly([[CX - 24, 100], [CX + 24, 100], [CX + 30, 150], [CX - 30, 150]], 19);
    b.line(CX - 24, 100, CX - 12, 66, 19);
    b.line(CX - 23, 100, CX - 11, 66, 19);
    b.line(CX + 24, 100, CX + 12, 66, 19);
    b.line(CX + 23, 100, CX + 11, 66, 19);
    b.rect(CX - 10, 116, 20, 10, 18);
    b.rect(CX - 10, 116, 20, 1, 20);
    b.rect(CX - 24, 100, 48, 2, 18);
    face(b, d);
    const front = new Bitmap(SPR_W, SPR_H);
    bangs(front, d, [[CX - 19, 42], [CX - 14, 37], [CX - 9, 35], [CX - 4, 39], [CX + 1, 33], [CX + 6, 36], [CX + 12, 34], [CX + 17, 38], [CX + 21, 44]]);
    // 側髮
    front.poly([[CX - 22, 30], [CX - 16, 30], [CX - 17, 50], [CX - 20, 54]], h);
    front.poly([[CX + 22, 30], [CX + 16, 30], [CX + 17, 48], [CX + 20, 52]], h);
    return { back, front };
  },
};

// 韶：黑長直、齊瀏海、白襯衫、脖子上的耳機
const SHAO: CharDef = {
  skin: [7, 8, 6],
  hair: [2, 1, 3],
  iris: [18, 19],
  draw(b, d) {
    const back = new Bitmap(SPR_W, SPR_H);
    const [h] = d.hair;
    back.ellipse(CX, 36, 23, 22, h);
    back.poly([[CX - 23, 36], [CX + 23, 36], [CX + 30, 132], [CX - 30, 132]], h);
    torso(b, 6, -2);
    clothesShade(b, 6, 5);
    // 領子與緞帶
    b.poly([[CX - 12, 64], [CX, 74], [CX - 4, 80], [CX - 16, 70]], 6);
    b.poly([[CX + 12, 64], [CX, 74], [CX + 4, 80], [CX + 16, 70]], 6);
    b.line(CX - 12, 64, CX - 16, 70, 5);
    b.line(CX + 12, 64, CX + 16, 70, 5);
    b.poly([[CX, 76], [CX - 8, 72], [CX - 8, 80]], 19);
    b.poly([[CX, 76], [CX + 8, 72], [CX + 8, 80]], 19);
    b.rect(CX - 1, 75, 3, 3, 18);
    b.poly([[CX - 2, 77], [CX - 5, 90], [CX - 1, 88]], 19);
    b.poly([[CX + 2, 77], [CX + 5, 90], [CX + 1, 88]], 19);
    face(b, d);
    // 耳機
    for (let x = CX - 13; x <= CX + 13; x++) b.px(x, Math.round(68 - Math.sqrt(Math.max(0, 169 - (x - CX) ** 2)) * 0.3), 1);
    b.ellipse(CX - 14, 68, 4, 5, 1);
    b.ellipse(CX + 14, 68, 4, 5, 1);
    b.ellipse(CX - 14, 68, 2, 3, 3);
    b.ellipse(CX + 14, 68, 2, 3, 3);
    const front = new Bitmap(SPR_W, SPR_H);
    // 齊瀏海
    const tips: [number, number][] = [];
    for (let x = CX - 20; x <= CX + 20; x += 4) tips.push([x, 34 + (x % 8 === 0 ? 1 : 0)]);
    bangs(front, d, tips);
    // 胸前的長髮
    front.poly([[CX - 23, 32], [CX - 16, 32], [CX - 17, 60], [CX - 22, 108], [CX - 30, 112], [CX - 26, 60]], h);
    front.poly([[CX + 23, 32], [CX + 16, 32], [CX + 17, 60], [CX + 22, 108], [CX + 30, 112], [CX + 26, 60]], h);
    return { back, front };
  },
};

// 佩：灰紫短鮑伯、黃髮夾、大號綠襯衫
const PEI: CharDef = {
  skin: [7, 8, 6],
  hair: [26, 25, 27],
  iris: [25, 27],
  draw(b, d) {
    const back = new Bitmap(SPR_W, SPR_H);
    const [h] = d.hair;
    back.ellipse(CX, 36, 24, 22, h);
    back.poly([[CX - 24, 36], [CX + 24, 36], [CX + 27, 60], [CX + 20, 62], [CX - 20, 62], [CX - 27, 60]], h);
    torso(b, 16, 3);
    clothesShade(b, 16, 17);
    // 敞開的領口與白背心
    b.poly([[CX - 10, 64], [CX + 10, 64], [CX + 4, 92], [CX - 4, 92]], 6);
    b.poly([[CX - 12, 64], [CX - 4, 92], [CX - 8, 92], [CX - 18, 70]], 15);
    b.poly([[CX + 12, 64], [CX + 4, 92], [CX + 8, 92], [CX + 18, 70]], 15);
    // 顏料痕
    for (const [x, y, c] of [[CX - 30, 110, 11], [CX - 26, 114, 11], [CX + 28, 104, 20], [CX + 20, 124, 13], [CX - 14, 132, 27]])
      b.rect(x, y, 2, 2, c);
    face(b, d);
    const front = new Bitmap(SPR_W, SPR_H);
    bangs(front, d, [[CX - 20, 40], [CX - 15, 38], [CX - 11, 33], [CX - 6, 36], [CX - 1, 32], [CX + 4, 34], [CX + 9, 31], [CX + 14, 35], [CX + 20, 40]]);
    front.poly([[CX - 24, 30], [CX - 17, 30], [CX - 16, 56], [CX - 20, 62], [CX - 27, 62]], h);
    front.poly([[CX + 24, 30], [CX + 17, 30], [CX + 16, 56], [CX + 20, 62], [CX + 27, 62]], h);
    // 外翹的髮尾
    front.px(CX - 28, 61, h);
    front.px(CX + 28, 61, h);
    // 髮夾
    front.rect(CX - 19, 24, 2, 7, 14);
    front.rect(CX - 17, 25, 2, 7, 13);
    return { back, front };
  },
};

// 晏：黑色亂髮，只用頭像
const YAN: CharDef = {
  skin: [7, 8, 6],
  hair: [1, 0, 2],
  iris: [1, 3],
  male: true,
  draw(b, d) {
    const back = new Bitmap(SPR_W, SPR_H);
    const [h] = d.hair;
    back.ellipse(CX, 35, 21, 20, h);
    torso(b, 5, -4);
    b.ellipse(CX, 64, 9, 4, 4);
    b.ellipse(CX, 63, 7, 3, d.skin[0]);
    face(b, d);
    const front = new Bitmap(SPR_W, SPR_H);
    bangs(front, d, [[CX - 20, 38], [CX - 16, 33], [CX - 11, 37], [CX - 6, 32], [CX - 1, 36], [CX + 4, 31], [CX + 9, 35], [CX + 14, 32], [CX + 19, 38]], 20, 33);
    // 翹起的髮梢
    front.poly([[CX - 6, 15], [CX - 2, 8], [CX + 2, 15]], h);
    front.poly([[CX + 8, 16], [CX + 14, 11], [CX + 13, 18]], h);
    front.poly([[CX - 22, 30], [CX - 17, 30], [CX - 18, 44]], h);
    front.poly([[CX + 22, 30], [CX + 17, 30], [CX + 18, 44]], h);
    return { back, front };
  },
};

const DEFS: Record<string, CharDef> = { xiaoman: XIAOMAN, shao: SHAO, pei: PEI, yan: YAN };

// ---- 組裝 ----
const bases = new Map<string, Bitmap>();

function base(id: string): Bitmap {
  let b = bases.get(id);
  if (b) return b;
  const d = DEFS[id];
  const body = new Bitmap(SPR_W, SPR_H);
  const { back, front } = d.draw(body, d);
  b = new Bitmap(SPR_W, SPR_H);
  b.blit(back, 0, 0);
  b.blit(body, 0, 0);
  // 瀏海下的陰影
  const fs = d.skin[1];
  for (let y = 0; y < SPR_H - 2; y++)
    for (let x = 0; x < SPR_W; x++)
      if (front.get(x, y) !== T && front.get(x, y + 1) === T && b.get(x, y + 1) === d.skin[0] && y < 50) b.px(x, y + 1, fs);
  b.blit(front, 0, 0);
  hairShade(b, d, 22);
  b.edge(d.hair[0], d.skin[0], d.hair[1]);
  b.outline(OUT);
  // 鼻子
  b.px(CX, 48, fs);
  bases.set(id, b);
  return b;
}

const EYE_Y = 37;
const EYE_LX = CX - 13;
const EYE_RX = CX + 5;

function stampEyes(b: Bitmap, d: CharDef, shape: EyeShape) {
  const rows = (d.male ? EYES_M : EYES_F)[shape];
  const key = { k: 0, d: d.iris[0], i: d.iris[1], h: 6, w: 6, l: d.skin[1] };
  b.stamp(EYE_LX, EYE_Y, rows, key);
  b.stamp(EYE_RX, EYE_Y, rows, key, !NO_FLIP.includes(shape));
}

export type EyeFrame = 0 | 1 | 2; // 開、半、閉
export type MouthFrame = 0 | 1 | 2; // 閉、半、開

function eyeFor(e: ExprDef, f: EyeFrame): EyeShape {
  if (e.eyes === 'smile') return 'smile';
  if (f === 2) return 'closed';
  if (f === 1) return e.eyes === 'half' || e.eyes === 'aside' ? 'closed' : 'half';
  return e.eyes;
}

function compose(id: string, expr: string, eye: EyeFrame, mouth: MouthFrame): Bitmap {
  const d = DEFS[id];
  const e = EXPR[expr] ?? EXPR.normal;
  const b = base(id).clone();
  // 眉毛
  const brow = BROWS[e.brow];
  const bk = { k: d.hair[1] };
  b.stamp(EYE_LX, EYE_Y - 4 + brow.dy, brow.rows, bk);
  b.stamp(EYE_RX + 1, EYE_Y - 4 + brow.dy, brow.rows, bk, true);
  stampEyes(b, d, eyeFor(e, eye));
  if (e.blush) {
    for (const x of [EYE_LX, EYE_RX + 1]) {
      b.rect(x, EYE_Y + 9, 7, 2, 28);
      for (let i = 0; i < 7; i += 2) b.px(x + i, EYE_Y + 9, 27);
    }
  }
  if (e.tear && eye === 0) b.px(EYE_LX + 6, EYE_Y + 8, 21);
  const m = MOUTHS[e.mouth][mouth];
  const mw = m[0].length;
  b.stamp(CX - Math.floor(mw / 2), 52, m, { k: 10, m: 25, t: 11, w: 6 });
  return b;
}

const canvases = new Map<string, HTMLCanvasElement>();

export function getSprite(id: string, expr: string, eye: EyeFrame, mouth: MouthFrame): HTMLCanvasElement {
  const key = `${id}|${expr}|${eye}|${mouth}`;
  let cv = canvases.get(key);
  if (!cv) {
    cv = compose(id, expr, eye, mouth).toCanvas();
    canvases.set(key, cv);
  }
  return cv;
}

/** 主角頭像（從立繪裁出頭部） */
export const FACE = { x: 32, y: 12, w: 48, h: 48 };
