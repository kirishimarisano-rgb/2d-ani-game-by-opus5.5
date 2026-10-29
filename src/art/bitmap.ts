import { PALETTE, T } from './palette';

/** 索引色點陣圖。所有美術先畫在這裡，最後才轉成 canvas。 */
export class Bitmap {
  data: Uint8Array;
  constructor(public w: number, public h: number, fill = T) {
    this.data = new Uint8Array(w * h).fill(fill);
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return T;
    return this.data[y * this.w + x];
  }

  px(x: number, y: number, c: number) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = c;
  }

  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c);
  }

  /** 4×4 Bayer 抖色：level 0–16，越大越多 c2 */
  dither(x: number, y: number, w: number, h: number, c1: number, c2: number, level: number) {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) this.px(i, j, BAYER[(j & 3) * 4 + (i & 3)] < level ? c2 : c1);
  }

  /** 垂直漸層，以抖色在色帶之間過渡 */
  vgrad(x: number, y: number, w: number, h: number, colors: number[]) {
    const bands = colors.length - 1;
    for (let j = 0; j < h; j++) {
      const t = (j / Math.max(1, h - 1)) * bands;
      const k = Math.min(bands - 1, Math.floor(t));
      const level = Math.round((t - k) * 16);
      for (let i = 0; i < w; i++)
        this.px(x + i, y + j, BAYER[((y + j) & 3) * 4 + ((x + i) & 3)] < level ? colors[k + 1] : colors[k]);
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, c);
      }
  }

  /** 填滿多邊形（偶奇規則，以像素中心取樣） */
  poly(pts: [number, number][], c: number) {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys));
    const y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if (ay <= sy !== by <= sy) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.px(x, y, c);
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: number) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** 手畫印章：字元陣列，key 對應色號，'.' 或空白為透明 */
  stamp(x: number, y: number, rows: string[], key: Record<string, number>, flip = false) {
    rows.forEach((row, j) => {
      [...row].forEach((ch, i) => {
        const c = key[ch];
        if (c === undefined) return;
        this.px(flip ? x + row.length - 1 - i : x + i, y + j, c);
      });
    });
  }

  /** 只在符合條件的像素上著色（例如只在頭髮上畫陰影） */
  recolorWhere(test: (c: number, x: number, y: number) => boolean, to: (c: number, x: number, y: number) => number) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.data[y * this.w + x];
        if (test(c, x, y)) this.data[y * this.w + x] = to(c, x, y);
      }
  }

  /** 外輪廓：透明像素若貼著不透明像素就塗成 c */
  outline(c: number) {
    const src = this.data.slice();
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? T : src[y * this.w + x]);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (at(x, y) === T && (at(x - 1, y) !== T || at(x + 1, y) !== T || at(x, y - 1) !== T || at(x, y + 1) !== T))
          this.data[y * this.w + x] = c;
  }

  /** 兩種顏色的交界畫線（例如頭髮與臉之間） */
  edge(a: number, b: number, c: number) {
    const src = this.data.slice();
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? T : src[y * this.w + x]);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (src[y * this.w + x] === a && [at(x, y + 1), at(x - 1, y), at(x + 1, y), at(x, y - 1)].includes(b))
          this.data[y * this.w + x] = c;
  }

  blit(src: Bitmap, dx: number, dy: number) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.data[y * src.w + x];
        if (c !== T) this.px(dx + x, dy + y, c);
      }
  }

  clone(): Bitmap {
    const b = new Bitmap(this.w, this.h);
    b.data.set(this.data);
    return b;
  }

  remap(map: number[]): Bitmap {
    const b = this.clone();
    for (let i = 0; i < b.data.length; i++) if (b.data[i] !== T) b.data[i] = map[b.data[i]];
    return b;
  }

  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.data.length; i++) {
      const c = this.data[i];
      if (c === T) continue;
      const [r, g, b] = RGB[c];
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export const RGB: [number, number, number][] = PALETTE.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]);

/** 可重現的亂數（同一張背景每次畫出來都一樣） */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
