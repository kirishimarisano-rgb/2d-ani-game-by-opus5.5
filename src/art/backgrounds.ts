import { drawText } from '../ui/font';
import { Bitmap, rng } from './bitmap';
import { DUSK_MAP, NIGHT_MAP, RAIN_MAP, T } from './palette';

export const W = 320;
export const H = 180;

type Time = 'day' | 'dusk' | 'night';

// ---- 共用 ----
const SKY: Record<Time, number[]> = {
  day: [20, 20, 21, 21, 6],
  dusk: [30, 27, 31, 13],
  night: [0, 29, 29, 30],
};

function sky(b: Bitmap, time: Time, h: number, seed = 1, rain = false) {
  if (rain) {
    b.vgrad(0, 0, W, h, time === 'night' ? [0, 1, 2] : time === 'dusk' ? [2, 3, 26] : [3, 4, 4, 5]);
    return;
  }
  b.vgrad(0, 0, W, h, SKY[time]);
  const r = rng(seed);
  if (time === 'night') {
    for (let i = 0; i < 70; i++) b.px(r() * W, r() * h * 0.8, r() < 0.2 ? 6 : r() < 0.5 ? 5 : 4);
    b.ellipse(262, 26, 7, 7, 6);
    b.ellipse(265, 24, 6, 6, 29);
  }
  if (time === 'day') for (let i = 0; i < 4; i++) cloud(b, 20 + r() * 280, 10 + r() * h * 0.4, 10 + r() * 16, 6, 5);
  if (time === 'dusk') for (let i = 0; i < 4; i++) cloud(b, 20 + r() * 280, 14 + r() * h * 0.4, 12 + r() * 18, 28, 26);
}

function cloud(b: Bitmap, x: number, y: number, w: number, c: number, shade: number) {
  b.ellipse(x, y, w, w * 0.32, c);
  b.ellipse(x - w * 0.4, y + 1, w * 0.5, w * 0.25, c);
  b.ellipse(x + w * 0.2, y - w * 0.15, w * 0.45, w * 0.28, c);
  b.rect(Math.round(x - w * 0.8), Math.round(y + w * 0.18), Math.round(w * 1.6), 1, shade);
}

function mapFor(time: Time, rain: boolean) {
  const m = time === 'day' ? null : time === 'dusk' ? DUSK_MAP : NIGHT_MAP;
  if (!rain) return m;
  return m ? m.map((c) => RAIN_MAP[c]) : RAIN_MAP;
}

/** 疊上一層白天配色的景物，依時段換色 */
function layer(b: Bitmap, time: Time, rain: boolean, draw: (l: Bitmap) => void) {
  const l = new Bitmap(W, H);
  draw(l);
  const m = mapFor(time, rain);
  b.blit(m ? l.remap(m) : l, 0, 0);
}

function hills(l: Bitmap, y: number, seed: number, c1: number, c2: number) {
  const r = rng(seed);
  let h = 10;
  for (let x = 0; x < W; x++) {
    h += (r() - 0.5) * 2.2;
    h = Math.max(4, Math.min(22, h));
    const top = Math.round(y - h - 8 * Math.sin(x / 47 + seed));
    l.rect(x, top, 1, y - top, c1);
    if (r() < 0.5) l.px(x, top, c2);
  }
}

function pole(l: Bitmap, x: number, top: number, bottom: number) {
  l.rect(x, top, 2, bottom - top, 22);
  l.rect(x - 6, top + 3, 14, 1, 22);
  l.rect(x - 4, top + 7, 10, 1, 22);
  l.px(x - 6, top + 2, 4);
  l.px(x + 7, top + 2, 4);
}

function wire(l: Bitmap, x0: number, y0: number, x1: number, y1: number, sag: number, c = 1) {
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / (x1 - x0);
    l.px(x, Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag), c);
  }
}

function lightWindow(b: Bitmap, x: number, y: number, w: number, h: number, on: boolean) {
  if (!on) return;
  b.rect(x, y, w, h, 14);
  b.rect(x, y + h - 1, w, 1, 13);
}

// ---- 1. 浪尾站月台 ----
function station(time: Time, rain: boolean): Bitmap {
  const b = new Bitmap(W, H);
  sky(b, time, 80, 3, rain);
  layer(b, time, rain, (l) => {
    // 遠山與海
    hills(l, 70, 7, 16, 15);
    l.rect(150, 66, 170, 6, 19);
    l.dither(150, 70, 170, 2, 19, 20, 6);
    // 遠方平交道
    l.rect(250, 52, 1, 18, 2);
    l.rect(246, 54, 9, 3, 0);
    l.px(247, 55, 11);
    l.px(253, 55, 11);
    // 軌道（往右上的消失點）
    l.poly([[150, 74], [320, 74], [320, 180], [190, 180]], 24);
    l.dither(150, 74, 170, 106, 24, 23, 3);
    for (let i = 0; i < 18; i++) {
      const t = i / 17;
      const y = Math.round(76 + t * t * 104);
      const x0 = Math.round(160 + t * 70);
      l.rect(x0, y, Math.round(40 + t * 110), Math.max(1, Math.round(t * 4)), 22);
    }
    l.line(165, 74, 225, 180, 4);
    l.line(166, 74, 226, 180, 3);
    l.line(185, 74, 320, 170, 4);
    l.line(186, 74, 320, 171, 3);
    // 月台
    l.poly([[0, 78], [160, 76], [210, 180], [0, 180]], 5);
    l.dither(0, 120, 210, 60, 5, 4, 3);
    l.poly([[158, 76], [161, 76], [212, 180], [204, 180]], 14);
    l.line(160, 76, 208, 180, 13);
    // 柵欄
    for (let x = 4; x < 150; x += 9) l.rect(x, 64 + Math.round(x * 0.01), 1, 14, 22);
    l.rect(0, 66, 150, 1, 23);
    l.rect(0, 71, 150, 1, 23);
    // 站房（左側木造）
    l.rect(0, 20, 70, 100, 23);
    for (let y = 22; y < 120; y += 5) l.rect(0, y, 70, 1, 22);
    l.rect(8, 50, 22, 40, 2);
    l.rect(9, 51, 20, 38, 21);
    l.rect(18, 51, 1, 38, 22);
    l.rect(9, 70, 20, 1, 22);
    l.rect(40, 60, 22, 60, 22);
    l.rect(42, 62, 18, 58, 10);
    // 屋簷
    l.poly([[0, 8], [104, 26], [104, 31], [0, 16]], 10);
    l.poly([[0, 16], [104, 31], [104, 33], [0, 19]], 25);
    l.rect(96, 31, 3, 70, 22);
    // 站名牌
    l.rect(100, 84, 40, 14, 6);
    l.rect(100, 84, 40, 1, 4);
    l.rect(100, 97, 40, 1, 3);
    l.rect(108, 98, 2, 12, 3);
    l.rect(130, 98, 2, 12, 3);
    // 長椅
    l.rect(70, 104, 26, 3, 23);
    l.rect(70, 99, 26, 2, 23);
    l.rect(72, 107, 2, 6, 22);
    l.rect(92, 107, 2, 6, 22);
    // 燈柱
    l.rect(146, 30, 2, 48, 3);
    l.rect(141, 28, 12, 3, 2);
    l.rect(143, 31, 8, 2, 5);
    // 電線桿
    pole(l, 290, 18, 76);
    wire(l, 0, 25, 290, 22, 6);
    wire(l, 0, 30, 290, 26, 6);
    wire(l, 292, 22, 320, 24, 2);
  });
  // 站名字與夜燈
  if (time !== 'day') {
    b.rect(143, 31, 8, 2, 14);
    if (time === 'night') {
      for (let y = 33; y < 76; y++) {
        const w = Math.round((y - 33) * 0.4);
        for (let x = 147 - w; x <= 147 + w; x++) if (b.get(x, y) !== T && (x + y) % 3 === 0) b.px(x, y, 13);
      }
    }
    lightWindow(b, 9, 51, 9, 19, true);
    lightWindow(b, 19, 51, 10, 19, true);
    lightWindow(b, 9, 71, 9, 18, true);
    lightWindow(b, 19, 71, 10, 18, true);
  }
  return b;
}

// ---- 2. 區間車車廂（窗戶是透明的，窗外風景另外捲動） ----
export const TRAIN_WINDOWS: [number, number, number, number][] = [
  [18, 30, 76, 52],
  [122, 30, 76, 52],
  [226, 30, 76, 52],
];

function train(time: Time): Bitmap {
  const b = new Bitmap(W, H);
  layer(b, time, false, (l) => {
    l.rect(0, 0, W, H, 5);
    l.dither(0, 0, W, 20, 5, 4, 4);
    // 天花板燈
    l.rect(0, 0, W, 8, 4);
    for (let x = 30; x < W; x += 104) l.rect(x, 4, 50, 3, 6);
    // 行李架
    l.rect(0, 22, W, 2, 3);
    l.rect(0, 24, W, 1, 2);
    // 窗框
    for (const [x, y, w, h] of TRAIN_WINDOWS) {
      l.rect(x - 3, y - 3, w + 6, h + 6, 3);
      l.rect(x - 2, y - 2, w + 4, h + 4, 4);
      l.rect(x, y, w, h, T);
      l.rect(x, y + 22, w, 2, 3);
    }
    // 吊環
    for (let x = 10; x < W; x += 26) {
      l.rect(x, 24, 1, 8, 2);
      l.ellipse(x + 0.5, 35, 3, 3, 2);
      l.ellipse(x + 0.5, 35, 2, 2, T);
    }
    // 牆板與座椅
    l.rect(0, 86, W, 4, 4);
    l.rect(0, 90, W, 30, 19);
    l.dither(0, 112, W, 8, 19, 18, 8);
    l.rect(0, 90, W, 2, 20);
    l.rect(0, 120, W, 8, 18);
    // 地板
    l.rect(0, 128, W, 52, 3);
    l.dither(0, 128, W, 52, 3, 2, 3);
    for (let x = 0; x < W; x += 20) l.rect(x, 128, 1, 52, 2);
    // 門
    l.rect(104, 26, 14, 102, 4);
    l.rect(106, 30, 10, 40, 21);
    l.rect(208, 26, 14, 102, 4);
    l.rect(210, 30, 10, 40, 21);
  });
  if (time === 'night') for (let x = 30; x < W; x += 104) b.rect(x, 4, 50, 3, 6);
  return b;
}

/** 窗外風景：寬 640 的長條，用三層視差捲動 */
function trainScenery(time: Time): Bitmap[] {
  const far = new Bitmap(640, 52);
  const mid = new Bitmap(640, 52);
  const near = new Bitmap(640, 52);
  const sk = new Bitmap(640, 52);
  sk.vgrad(0, 0, 640, 52, SKY[time]);
  const r = rng(11);
  if (time === 'night') for (let i = 0; i < 40; i++) sk.px(r() * 640, r() * 30, 5);
  const m = time === 'day' ? null : time === 'dusk' ? DUSK_MAP : NIGHT_MAP;
  // 遠：海
  far.rect(0, 30, 640, 22, 19);
  for (let i = 0; i < 120; i++) far.rect(Math.floor(r() * 640), 31 + Math.floor(r() * 20), 3, 1, 20);
  far.rect(0, 30, 640, 1, 21);
  // 中：田與防風林
  for (let x = 0; x < 640; x++) {
    const h = Math.round(6 + 4 * Math.sin(x / 13) + 3 * Math.sin(x / 5.3));
    if (Math.sin(x / 70) > -0.2) mid.rect(x, 44 - h, 1, h + 8, 17);
    if (Math.sin(x / 70) > -0.2 && x % 3 === 0) mid.px(x, 44 - h, 16);
  }
  // 近：電線桿與草
  for (let x = 0; x < 640; x += 160) {
    near.rect(x, 0, 3, 52, 22);
    near.rect(x - 5, 6, 13, 2, 22);
  }
  for (let x = 0; x < 640; x++) {
    const g = 3 + Math.round(2 * Math.sin(x * 1.7));
    near.rect(x, 52 - g, 1, g, 16);
  }
  return [sk, far, mid, near].map((l) => (m ? l.remap(m) : l));
}

// ---- 3. 福興商店（柑仔店） ----
function shop(time: Time): Bitmap {
  const b = new Bitmap(W, H);
  const night = time === 'night';
  layer(b, time, false, (l) => {
    l.rect(0, 0, W, H, 24);
    l.dither(0, 0, W, 30, 24, 23, 6);
    // 天花板與吊扇
    l.rect(0, 0, W, 10, 22);
    l.rect(158, 10, 2, 8, 2);
    l.rect(140, 18, 38, 2, 3);
    l.rect(156, 16, 6, 4, 2);
    // 門口（右側）
    l.rect(240, 24, 70, 104, 22);
    l.rect(244, 28, 62, 100, night ? 29 : 21);
    if (!night) {
      l.dither(244, 28, 62, 60, 21, 6, 6);
      l.rect(244, 96, 62, 32, 5);
    }
    // 門簾
    l.rect(244, 28, 62, 12, 19);
    for (let x = 252; x < 306; x += 13) l.rect(x, 28, 1, 12, 18);
    // 左側貨架
    const r = rng(5);
    const goods = [11, 12, 13, 14, 15, 20, 27, 28, 6, 16];
    for (let s = 0; s < 4; s++) {
      const y = 28 + s * 24;
      l.rect(6, y + 18, 120, 3, 22);
      for (let x = 8; x < 124; ) {
        const w = 4 + Math.floor(r() * 7);
        const h = 8 + Math.floor(r() * 9);
        const c = goods[Math.floor(r() * goods.length)];
        l.rect(x, y + 18 - h, w - 1, h, c);
        l.rect(x, y + 18 - h, w - 1, 1, 6);
        x += w;
      }
    }
    l.rect(4, 24, 2, 104, 22);
    l.rect(126, 24, 2, 104, 22);
    // 冰箱（中間）
    l.rect(140, 40, 46, 88, 5);
    l.rect(143, 43, 40, 80, 21);
    for (let s = 0; s < 4; s++) {
      l.rect(143, 60 + s * 18, 40, 1, 4);
      for (let x = 145; x < 181; x += 5) l.rect(x, 50 + s * 18, 3, 10, [11, 16, 13, 20][(x + s) % 4]);
    }
    l.rect(140, 40, 46, 4, 11);
    // 櫃台與玻璃罐
    l.rect(0, 122, 240, 58, 22);
    l.rect(0, 122, 240, 3, 23);
    l.dither(0, 130, 240, 50, 22, 10, 4);
    for (let i = 0; i < 5; i++) {
      const x = 20 + i * 22;
      l.rect(x, 104, 16, 18, 5);
      l.rect(x + 1, 108, 14, 14, [11, 13, 15, 27, 12][i]);
      l.dither(x + 1, 108, 14, 14, [11, 13, 15, 27, 12][i], 6, 3);
      l.rect(x + 2, 101, 12, 3, 11);
    }
    // 收銀機
    l.rect(170, 104, 40, 18, 3);
    l.rect(174, 98, 24, 8, 2);
    l.rect(176, 100, 20, 4, 15);
    for (let x = 174; x < 206; x += 5) l.rect(x, 110, 3, 2, 5);
    // 月曆
    l.rect(196, 30, 26, 34, 6);
    l.rect(196, 30, 26, 8, 11);
    for (let y = 42; y < 62; y += 4) for (let x = 199; x < 220; x += 4) l.rect(x, y, 2, 2, 3);
  });
  if (night) {
    b.rect(143, 43, 40, 80, 21);
    for (let s = 0; s < 4; s++) {
      b.rect(143, 60 + s * 18, 40, 1, 5);
      for (let x = 145; x < 181; x += 5) b.rect(x, 50 + s * 18, 3, 10, [11, 16, 13, 20][(x + s) % 4]);
    }
    b.rect(140, 40, 46, 4, 11);
    // 日光燈
    b.rect(60, 11, 60, 2, 6);
  }
  return b;
}

// ---- 4. 站前老街 ----
function street(time: Time, rain: boolean): Bitmap {
  const b = new Bitmap(W, H);
  sky(b, time, 70, 9, rain);
  const r = rng(21);
  const houses = [
    { x: 0, w: 70, h: 92, c: 23, sign: 11 },
    { x: 70, w: 64, h: 78, c: 5, sign: 20 },
    { x: 134, w: 56, h: 100, c: 24, sign: 13 },
    { x: 190, w: 70, h: 84, c: 4, sign: 16 },
    { x: 260, w: 60, h: 96, c: 9, sign: 27 },
  ];
  layer(b, time, rain, (l) => {
    for (const hs of houses) {
      const top = 126 - hs.h;
      l.rect(hs.x, top, hs.w, hs.h, hs.c);
      l.dither(hs.x, top, hs.w, hs.h, hs.c, 3, 2);
      l.rect(hs.x, top, hs.w, 3, 3);
      // 二樓窗
      for (let wx = hs.x + 8; wx + 12 < hs.x + hs.w; wx += 20) {
        l.rect(wx, top + 10, 12, 14, 2);
        l.rect(wx + 1, top + 11, 10, 12, 21);
        for (let gx = wx + 1; gx < wx + 11; gx += 3) l.rect(gx, top + 11, 1, 12, 3);
      }
      // 招牌
      l.rect(hs.x + 6, top + 30, hs.w - 12, 12, hs.sign);
      l.rect(hs.x + 6, top + 30, hs.w - 12, 1, 6);
      for (let k = 0; k < 3; k++) l.rect(hs.x + 12 + k * 12, top + 34, 7, 5, 6);
      // 騎樓
      l.rect(hs.x, top + 46, hs.w, 4, 3);
      l.rect(hs.x, top + 50, hs.w, hs.h - 50, 2);
      l.rect(hs.x + 4, top + 50, 3, hs.h - 50, hs.c);
      l.rect(hs.x + hs.w - 7, top + 50, 3, hs.h - 50, hs.c);
      l.rect(hs.x + 12, top + 56, hs.w - 24, hs.h - 56, 1);
      // 冷氣
      if (r() < 0.6) {
        l.rect(hs.x + hs.w - 18, top + 14, 12, 8, 5);
        l.rect(hs.x + hs.w - 16, top + 16, 8, 4, 4);
      }
    }
    // 街道
    l.rect(0, 126, W, 54, 3);
    l.dither(0, 126, W, 54, 3, 2, 4);
    l.rect(0, 126, W, 3, 4);
    for (let x = 10; x < W; x += 40) l.rect(x, 152, 18, 2, 5);
    // 機車
    for (const mx of [30, 210]) {
      l.ellipse(mx, 124, 4, 4, 0);
      l.ellipse(mx + 18, 124, 4, 4, 0);
      l.rect(mx - 2, 114, 24, 7, mx === 30 ? 11 : 20);
      l.rect(mx + 14, 106, 2, 10, 2);
      l.rect(mx + 10, 105, 10, 2, 2);
    }
    // 電線桿
    pole(l, 128, 8, 128);
    wire(l, 0, 14, 128, 12, 5);
    wire(l, 130, 12, 320, 16, 6);
    wire(l, 0, 20, 128, 16, 7);
  });
  if (time !== 'day') {
    for (const hs of houses) {
      const top = 126 - hs.h;
      b.rect(hs.x + 12, top + 56, hs.w - 24, hs.h - 56, time === 'night' ? 13 : 12);
      b.dither(hs.x + 12, top + 56, hs.w - 24, hs.h - 56, 13, 14, 5);
      b.rect(hs.x + 6, top + 30, hs.w - 12, 12, hs.sign);
      for (let k = 0; k < 3; k++) b.rect(hs.x + 12 + k * 12, top + 34, 7, 5, 6);
      if (time === 'night') lightWindow(b, hs.x + 9, top + 11, 10, 12, r() < 0.5);
    }
  }
  return b;
}

// ---- 5. 海堤 ----
export const SEA_TOP = 96;
function seawall(time: Time): Bitmap {
  const b = new Bitmap(W, H);
  sky(b, time, SEA_TOP, 13);
  if (time === 'dusk') {
    b.ellipse(210, SEA_TOP - 4, 12, 12, 14);
    b.ellipse(210, SEA_TOP - 4, 10, 10, 13);
  }
  layer(b, time, false, (l) => {
    // 遠方岬角
    l.poly([[0, SEA_TOP], [0, 78], [30, 74], [70, 84], [110, SEA_TOP]], 17);
    l.poly([[0, 84], [40, 82], [70, 90], [80, SEA_TOP], [0, SEA_TOP]], 18);
    // 海
    l.vgrad(0, SEA_TOP, W, 84, [20, 19, 19, 18]);
    const r = rng(17);
    for (let i = 0; i < 160; i++) {
      const y = SEA_TOP + Math.floor(r() * 84);
      l.rect(Math.floor(r() * W), y, 2 + Math.floor(((y - SEA_TOP) / 84) * 6), 1, 21);
    }
    // 海堤
    l.poly([[0, 120], [320, 150], [320, 180], [0, 180]], 4);
    l.poly([[0, 116], [320, 144], [320, 150], [0, 120]], 5);
    l.dither(0, 140, W, 40, 4, 3, 5);
    for (let x = 0; x < W; x += 40) l.line(x, 120 + Math.round(x * 0.094), x, 180, 3);
    // 欄杆
    for (let x = 6; x < W; x += 18) l.rect(x, 104 + Math.round(x * 0.087), 2, 14, 3);
    l.line(0, 104, 320, 132, 3);
    l.line(0, 105, 320, 133, 2);
    // 消波塊（左下）
    for (const [x, y] of [[20, 170], [44, 176], [8, 160]]) {
      l.poly([[x - 10, y], [x, y - 10], [x + 10, y], [x, y + 6]], 4);
      l.poly([[x - 10, y], [x, y - 10], [x, y + 6]], 3);
    }
  });
  if (time === 'dusk') {
    for (let y = SEA_TOP + 2; y < 140; y += 3) {
      const w = 6 + (y - SEA_TOP) * 0.3;
      b.rect(Math.round(210 - w / 2), y, Math.round(w), 1, 13);
    }
  }
  if (time === 'night') {
    for (let y = SEA_TOP + 3; y < 130; y += 4) b.rect(258 + ((y * 7) % 5), y, 6, 1, 4);
  }
  return b;
}

// ---- 6. 倉庫二樓（佩的工作室） ----
function warehouse(time: Time): Bitmap {
  const b = new Bitmap(W, H);
  // 拱窗裡的天空
  const win = new Bitmap(W, H);
  sky(win, time, 90, 19);
  b.blit(win, 0, 0);
  layer(b, time, false, (l) => {
    // 紅磚牆，挖出拱窗
    l.rect(0, 0, W, 132, 9);
    for (let y = 0; y < 132; y += 4) {
      l.rect(0, y, W, 1, 10);
      for (let x = (y / 4) % 2 ? 0 : 6; x < W; x += 12) l.rect(x, y, 1, 4, 10);
    }
    l.rect(110, 26, 100, 70, T);
    l.ellipse(160, 26, 50, 22, T);
    l.rect(108, 96, 104, 4, 23);
    l.rect(159, 4, 2, 92, 22);
    l.rect(110, 60, 100, 2, 22);
    // 窗外的車站屋頂
    l.poly([[110, 96], [110, 80], [150, 76], [190, 84], [210, 84], [210, 96]], 25);
    // 木地板
    l.rect(0, 132, W, 48, 23);
    for (let y = 134; y < H; y += 6) l.rect(0, y, W, 1, 22);
    // 空白布條
    l.rect(8, 22, 88, 4, 22);
    l.rect(10, 26, 84, 60, 6);
    l.dither(10, 70, 84, 16, 6, 5, 4);
    l.rect(10, 26, 84, 1, 5);
    // 畫布靠牆
    l.poly([[230, 132], [236, 70], [284, 70], [290, 132]], 6);
    l.poly([[232, 132], [237, 74], [283, 74], [288, 132]], 21);
    l.dither(232, 100, 58, 32, 21, 16, 7);
    l.poly([[270, 132], [282, 90], [312, 90], [320, 132]], 22);
    // 工作桌與顏料罐
    l.rect(20, 110, 100, 4, 22);
    l.rect(24, 114, 3, 30, 22);
    l.rect(112, 114, 3, 30, 22);
    [11, 13, 20, 16, 27].forEach((c, i) => {
      l.rect(30 + i * 14, 100, 10, 10, 4);
      l.rect(31 + i * 14, 100, 8, 3, c);
    });
    // 書堆
    for (let i = 0; i < 6; i++) l.rect(130 + (i % 2), 120 - i * 4, 30, 4, [19, 11, 16, 13, 26, 5][i]);
    // 掛燈串
    wire(l, 0, 8, 320, 10, 10, 1);
  });
  if (time !== 'day') {
    for (let x = 6; x < W; x += 16) {
      const y = Math.round(8 + (10 - 8) * (x / 320) + Math.sin((x / 320) * Math.PI) * 10) + 1;
      b.rect(x, y, 2, 2, time === 'night' ? 14 : 13);
    }
  }
  return b;
}

// ---- 7. 晏的房間（阿嬤家） ----
function room(time: Time): Bitmap {
  const b = new Bitmap(W, H);
  const night = time === 'night';
  const win = new Bitmap(W, H);
  sky(win, time, 90, 23);
  hills(win, 92, 4, night ? 18 : 16, night ? 17 : 15);
  b.blit(win, 0, 0);
  layer(b, time, false, (l) => {
    l.rect(0, 0, W, 130, 6);
    l.dither(0, 0, W, 130, 6, 5, 5);
    l.rect(0, 0, W, 6, 23);
    // 窗戶＋鐵窗
    l.rect(180, 20, 110, 72, T);
    l.rect(176, 16, 118, 4, 22);
    l.rect(176, 92, 118, 4, 22);
    l.rect(176, 16, 4, 80, 22);
    l.rect(290, 16, 4, 80, 22);
    for (let x = 186; x < 290; x += 10) l.rect(x, 20, 1, 72, 2);
    l.rect(180, 50, 110, 1, 2);
    // 牆角木板
    l.rect(0, 126, W, 4, 22);
    // 地板（磨石子）
    l.rect(0, 130, W, 50, 5);
    l.dither(0, 130, W, 50, 5, 4, 4);
    // 書桌
    l.rect(170, 100, 130, 5, 22);
    l.rect(174, 105, 4, 40, 22);
    l.rect(292, 105, 4, 40, 22);
    l.rect(250, 105, 40, 20, 23);
    l.rect(266, 113, 8, 2, 22);
    // 檯燈
    l.rect(186, 96, 10, 4, 2);
    l.rect(190, 80, 2, 16, 2);
    l.poly([[182, 80], [200, 80], [196, 72], [186, 72]], 16);
    // 床（左）
    l.rect(0, 108, 130, 30, 23);
    l.rect(0, 96, 130, 14, 28);
    for (let x = 4; x < 130; x += 14) {
      l.ellipse(x, 102, 3, 3, 11);
      l.px(x, 102, 14);
    }
    l.rect(0, 90, 30, 10, 6);
    // 電風扇
    l.ellipse(150, 70, 14, 14, 5);
    l.ellipse(150, 70, 12, 12, 21);
    l.ellipse(150, 70, 3, 3, 4);
    for (let a = 0; a < 6; a++) l.line(150, 70, 150 + 11 * Math.cos(a), 70 + 11 * Math.sin(a), 5);
    l.rect(149, 84, 3, 40, 4);
    l.rect(142, 124, 17, 4, 4);
    // 月曆
    l.rect(60, 30, 30, 40, 6);
    l.rect(60, 30, 30, 9, 11);
    for (let y = 44; y < 68; y += 5) for (let x = 63; x < 88; x += 5) l.rect(x, y, 3, 3, 3);
  });
  if (night) {
    // 檯燈光
    b.poly([[182, 80], [200, 80], [196, 72], [186, 72]], 14);
    for (let y = 81; y < 100; y++) {
      const w = (y - 80) * 0.9;
      for (let x = Math.round(191 - w); x <= 191 + w; x++) if ((x + y) % 2 === 0) b.px(x, y, 13);
    }
  }
  return b;
}

// ---- 8. 福德廟（廟會的晚上） ----
export const LANTERNS: [number, number][] = [];
function temple(): Bitmap {
  const b = new Bitmap(W, H);
  sky(b, 'night', 100, 29);
  layer(b, 'night', false, (l) => {
    // 樹影
    for (let i = 0; i < 6; i++) l.ellipse(i * 64, 60, 36, 28, 17);
    // 廟（中央）
    l.rect(100, 62, 120, 60, 11);
    l.rect(96, 58, 128, 6, 10);
    l.poly([[86, 60], [160, 30], [234, 60], [224, 56], [160, 36], [96, 56]], 10);
    l.poly([[96, 56], [160, 36], [224, 56]], 11);
    // 燕尾脊
    l.poly([[84, 62], [80, 46], [92, 56]], 10);
    l.poly([[236, 62], [240, 46], [228, 56]], 10);
    l.rect(150, 26, 20, 6, 13);
    // 門
    l.rect(136, 76, 48, 46, 10);
    l.rect(140, 80, 19, 42, 22);
    l.rect(161, 80, 19, 42, 22);
    l.rect(108, 80, 20, 20, 25);
    l.rect(192, 80, 20, 20, 25);
    // 廣場
    l.rect(0, 122, W, 58, 2);
    l.dither(0, 122, W, 58, 2, 3, 3);
    // 攤販
    for (const [x, c] of [[8, 11], [256, 20]] as [number, number][]) {
      l.rect(x, 96, 56, 6, c);
      for (let k = 0; k < 56; k += 8) l.rect(x + k, 96, 4, 6, 6);
      l.rect(x + 2, 102, 2, 28, 22);
      l.rect(x + 52, 102, 2, 28, 22);
      l.rect(x, 114, 56, 16, 23);
    }
    // 人群剪影
    const r = rng(31);
    for (let i = 0; i < 26; i++) {
      const x = r() * W;
      const y = 140 + r() * 30;
      l.ellipse(x, y - 14, 4, 4, 1);
      l.poly([[x - 6, y + 10], [x - 4, y - 9], [x + 4, y - 9], [x + 6, y + 10]], 1);
    }
  });
  // 廟燈
  b.rect(140, 80, 19, 42, 12);
  b.rect(161, 80, 19, 42, 12);
  b.dither(140, 80, 40, 42, 12, 13, 6);
  b.rect(159, 80, 2, 42, 10);
  for (const x of [8, 256]) b.rect(x, 114, 56, 2, 14);
  // 燈籠串
  LANTERNS.length = 0;
  for (let x = 0; x < W; x += 14) {
    const y = Math.round(22 + Math.sin((x / W) * Math.PI) * 14 + (x > 80 && x < 240 ? -4 : 0));
    LANTERNS.push([x, y]);
  }
  wire(b, 0, 22, 320, 22, 14, 0);
  for (const [x, y] of LANTERNS) {
    b.ellipse(x + 0.5, y + 4, 3, 4, 11);
    b.rect(x - 1, y + 2, 3, 1, 12);
    b.px(x, y, 13);
  }
  return b;
}

function black(): Bitmap {
  return new Bitmap(W, H, 0);
}

// ---- 對外介面 ----
export interface BgArt {
  base: HTMLCanvasElement;
  scenery?: HTMLCanvasElement[]; // 車窗外
}

const cache = new Map<string, BgArt>();

export function getBg(name: string, time: string, fx: string[]): BgArt {
  const rain = fx.includes('rain');
  const key = `${name}|${time}|${rain}`;
  let art = cache.get(key);
  if (art) return art;
  const t = time as Time;
  let bmp: Bitmap;
  let scenery: HTMLCanvasElement[] | undefined;
  switch (name) {
    case 'station': bmp = station(t, rain); break;
    case 'train':
      bmp = train(t);
      scenery = trainScenery(t).map((s) => s.toCanvas());
      break;
    case 'shop': bmp = shop(t); break;
    case 'street': bmp = street(t, rain); break;
    case 'seawall': bmp = seawall(t); break;
    case 'warehouse': bmp = warehouse(t); break;
    case 'room': bmp = room(t); break;
    case 'temple': bmp = temple(); break;
    default: bmp = black();
  }
  const base = bmp.toCanvas();
  if (name === 'station') drawText(base.getContext('2d')!, '浪尾', 108, 85, time === 'night' ? 2 : 0, null);
  art = { base, scenery };
  cache.set(key, art);
  return art;
}
