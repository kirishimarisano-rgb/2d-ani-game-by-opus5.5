// 像素渲染核心：固定低解析度緩衝區 + 整數倍放大 + 16 色調色盤。
// 所有繪圖函式都只接受「調色盤索引」，保證畫面永遠不會出現調色盤以外的顏色。
import { FONT_5x7, FONT_3x5, glyphCanvas, measureText } from '../../shared/pixel-font.js';

export const TAU = Math.PI * 2;
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const hexToInt = h => parseInt(h.slice(1), 16);

/** 可以畫在任何 2D context 上的調色盤畫筆（螢幕、預先繪製的背景圖層都用它） */
export class Painter {
  constructor(ctx, palette) {
    this.ctx = ctx;
    this.palette = palette;
    ctx.imageSmoothingEnabled = false;
  }
  _fill(c) { this.ctx.fillStyle = this.palette[c]; }
  rect(x, y, w, h, c) {
    w = Math.round(w); h = Math.round(h);
    if (w <= 0 || h <= 0) return;
    this._fill(c); this.ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }
  px(x, y, c) { this._fill(c); this.ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
  /** Bresenham 直線；t 為筆刷粗細（方形） */
  line(x0, y0, x1, y1, c, t = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    this._fill(c);
    const g = this.ctx, o = (t - 1) >> 1;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      g.fillRect(x0 - o, y0 - o, t, t);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** 實心圓 */
  circle(cx, cy, r, c) {
    cx = Math.round(cx); cy = Math.round(cy);
    if (r < 1) { this.px(cx, cy, c); return; }
    this._fill(c);
    const R = r + 0.35, n = Math.floor(r);
    for (let dy = -n; dy <= n; dy++) {
      const dx = Math.floor(Math.sqrt(Math.max(0, R * R - dy * dy)));
      this.ctx.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
    }
  }
  /** 圓框（中點圓演算法） */
  ring(cx, cy, r, c) {
    cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
    this._fill(c);
    const g = this.ctx;
    if (r <= 0) { g.fillRect(cx, cy, 1, 1); return; }
    let x = r, y = 0, err = 1 - r;
    while (x >= y) {
      g.fillRect(cx + x, cy + y, 1, 1); g.fillRect(cx + y, cy + x, 1, 1);
      g.fillRect(cx - y, cy + x, 1, 1); g.fillRect(cx - x, cy + y, 1, 1);
      g.fillRect(cx - x, cy - y, 1, 1); g.fillRect(cx - y, cy - x, 1, 1);
      g.fillRect(cx + y, cy - x, 1, 1); g.fillRect(cx + x, cy - y, 1, 1);
      y++;
      if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
    }
  }
  /** 實心橢圓（用來畫影子） */
  ellipse(cx, cy, rx, ry, c) {
    cx = Math.round(cx); cy = Math.round(cy);
    this._fill(c);
    const n = Math.max(0, Math.round(ry));
    for (let dy = -n; dy <= n; dy++) {
      const k = n ? dy / (ry + 0.35) : 0;
      const dx = Math.floor(rx * Math.sqrt(Math.max(0, 1 - k * k)) + 0.35);
      this.ctx.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
    }
  }
  /**
   * 扇形環帶：半徑 r0..r1、角度 a0→a1 之間的像素（刀光殘影用）。
   * 以整列合併 fillRect，速度夠快可以每格重畫。
   */
  arcBand(cx, cy, r0, r1, a0, a1, c) {
    let lo = Math.min(a0, a1);
    const span = Math.abs(a1 - a0);
    if (span <= 0 || r1 <= 0) return;
    const full = span >= TAU;
    lo = ((lo % TAU) + TAU) % TAU;
    cx = Math.round(cx); cy = Math.round(cy);
    this._fill(c);
    const R = Math.ceil(r1), g = this.ctx, r0s = r0 * r0, r1s = r1 * r1;
    for (let y = -R; y <= R; y++) {
      let run = -1;
      for (let x = -R; x <= R + 1; x++) {
        let inside = false;
        if (x <= R) {
          const d2 = x * x + y * y;
          if (d2 >= r0s && d2 <= r1s) {
            if (full) inside = true;
            else {
              let a = Math.atan2(y, x) - lo;
              a = ((a % TAU) + TAU) % TAU;
              inside = a <= span;
            }
          }
        }
        if (inside) { if (run < 0) run = x; }
        else if (run >= 0) { g.fillRect(cx + run, cy + y, x - run, 1); run = -1; }
      }
    }
  }
  /** 以 4x4 有序抖動填滿矩形：level 0（全空）～16（全滿）。圖樣對齊世界座標，鏡頭移動時不會閃爍 */
  dither(x, y, w, h, c, level) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    if (level <= 0 || w <= 0 || h <= 0) return;
    if (level >= 16) { this.rect(x, y, w, h, c); return; }
    this._fill(c);
    const g = this.ctx;
    for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
      if (BAYER4[(py & 3) * 4 + (px & 3)] < level) g.fillRect(px, py, 1, 1);
    }
  }
  /**
   * 畫精靈圖。x,y 為左上角。
   * o.flip 左右翻轉；o.color 以單一調色盤色畫剪影（受擊閃白、殘影）；
   * o.sx / o.sy 壓縮伸展倍率（以底部中央為錨點，最近鄰取樣所以顏色不變）
   */
  spr(s, x, y, o = {}) {
    let img = o.flip ? s.flipped : s.canvas;
    if (o.color != null) img = s.silhouette(o.color, !!o.flip);
    const sx = o.sx || 1, sy = o.sy || 1;
    if (sx !== 1 || sy !== 1) {
      const w = Math.max(1, Math.round(s.w * sx)), h = Math.max(1, Math.round(s.h * sy));
      this.ctx.drawImage(img, Math.round(x + (s.w - w) / 2), Math.round(y + s.h - h), w, h);
    } else this.ctx.drawImage(img, Math.round(x), Math.round(y));
  }
  /** 點陣字。o: { small, align, outline, shadow, spacing, scale（整數倍） } */
  text(str, x, y, c, o = {}) {
    const font = o.small ? FONT_3x5 : FONT_5x7, sp = o.spacing ?? 1, sc = o.scale || 1;
    str = String(str);
    const w = measureText(str, font, sp) * sc;
    const x0 = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x), y0 = Math.round(y);
    if (o.outline != null) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) this._text(str, x0 + dx, y0 + dy, font, sp, o.outline, sc);
    if (o.shadow != null) this._text(str, x0 + sc, y0 + sc, font, sp, o.shadow, sc);
    this._text(str, x0, y0, font, sp, c, sc);
    return w;
  }
  _text(str, x, y, font, sp, c, sc = 1) {
    const col = this.palette[c];
    for (const ch of str) {
      const gc = glyphCanvas(font, ch, col);
      if (gc) this.ctx.drawImage(gc, x, y, font.w * sc, font.h * sc);
      x += (font.w + sp) * sc;
    }
  }
}

export function textWidth(str, small = false, scale = 1) { return measureText(String(str), small ? FONT_3x5 : FONT_5x7, 1) * scale; }

/** 預先繪製的圖層（背景、地圖），用同一套調色盤畫筆 */
export function makeLayer(w, h, palette, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(new Painter(c.getContext('2d'), palette), c);
  return c;
}

/**
 * 精靈圖：以字元陣列定義，legend 把字元對應到調色盤索引，'.' 或空白為透明。
 * 例：new Sprite(['.KK.', 'KWWK'], { K: 0, W: 6 }, palette)
 */
export class Sprite {
  constructor(rows, legend, palette) {
    this.rows = rows;
    this.h = rows.length;
    this.w = Math.max(...rows.map(r => r.length));
    this.palette = palette;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w; this.canvas.height = this.h;
    const g = this.canvas.getContext('2d');
    for (let y = 0; y < this.h; y++) for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      const idx = legend[ch];
      if (idx == null) throw new Error(`Sprite：字元「${ch}」沒有對應的顏色`);
      g.fillStyle = palette[idx];
      g.fillRect(x, y, 1, 1);
    }
    this.flipped = document.createElement('canvas');
    this.flipped.width = this.w; this.flipped.height = this.h;
    const f = this.flipped.getContext('2d');
    f.translate(this.w, 0); f.scale(-1, 1); f.drawImage(this.canvas, 0, 0);
    this._sil = new Map();
  }
  silhouette(c, flip) {
    const key = c * 2 + (flip ? 1 : 0);
    let s = this._sil.get(key);
    if (!s) {
      s = document.createElement('canvas');
      s.width = this.w; s.height = this.h;
      const g = s.getContext('2d');
      g.drawImage(flip ? this.flipped : this.canvas, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = this.palette[c];
      g.fillRect(0, 0, this.w, this.h);
      this._sil.set(key, s);
    }
    return s;
  }
}

// ---------- 字元圖工具：用程式產生、描邊、疊圖、旋轉 ----------
/** 以函式產生 w×h 的字元圖，fn(x, y) 回傳字元（falsy＝透明） */
export function gridRows(w, h, fn) {
  const rows = [];
  for (let y = 0; y < h; y++) { let r = ''; for (let x = 0; x < w; x++) r += fn(x, y) || '.'; rows.push(r); }
  return rows;
}
/** 在所有不透明像素外側加一圈外框字元（四方向） */
export function outlineRows(rows, ch = 'o') {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const at = (x, y) => (y >= 0 && y < h && x >= 0 && x < rows[y].length) ? rows[y][x] : '.';
  return gridRows(w, h, (x, y) => {
    const c = at(x, y);
    if (c !== '.') return c;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = at(x + dx, y + dy); if (n !== '.' && n !== ch) return ch; }
    return '.';
  });
}
/** 把 sub 疊到 rows 的 (ox, oy) 位置（'.' 不覆蓋） */
export function stampRows(rows, sub, ox, oy) {
  const out = rows.map(r => r.split(''));
  sub.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      if (r[x] !== '.' && out[oy + y] && ox + x >= 0 && ox + x < out[oy + y].length) out[oy + y][ox + x] = r[x];
    }
  });
  return out.map(r => r.join(''));
}
/** 順時針旋轉 90 度（像素完全不失真） */
export function rotateRows(rows) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  return gridRows(h, w, (x, y) => (rows[h - 1 - x][y] || '.'));
}
export const flipRows = rows => rows.map(r => [...r].reverse().join(''));
export const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** 把多個字元圖層疊合成一張（後面的覆蓋前面的非透明字元），用來組合角色的分件動畫 */
export function composeRows(w, h, parts) {
  const grid = Array.from({ length: h }, () => Array(w).fill('.'));
  for (const p of parts) {
    if (!p) continue;
    const ox = p.x || 0, oy = p.y || 0;
    p.rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        const ch = r[x];
        if (ch === '.' || ch === ' ') continue;
        const gx = ox + (p.flip ? r.length - 1 - x : x), gy = oy + y;
        if (gx >= 0 && gx < w && gy >= 0 && gy < h) grid[gy][gx] = ch;
      }
    });
  }
  return grid.map(r => r.join(''));
}

/** 顯示用的螢幕：原生低解析度緩衝區，依容器大小取「整數倍」放大後呈現 */
export class Screen extends Painter {
  constructor(host, { width, height, palette }) {
    if (!Array.isArray(palette) || palette.length > 16) throw new Error('調色盤最多只能有 16 色');
    const buf = document.createElement('canvas');
    buf.width = width; buf.height = height;
    super(buf.getContext('2d', { willReadFrequently: false }), palette.map(c => c.toLowerCase()));
    this.buf = buf;
    this.w = width; this.h = height;
    this.paletteSet = new Set(this.palette.map(hexToInt));
    this.view = document.createElement('canvas');
    this.view.className = 'pa-view';
    this.vctx = this.view.getContext('2d');
    host.prepend(this.view);
    this.host = host;
    this.scale = 1;
    this.camX = 0; this.camY = 0;
    new ResizeObserver(() => this.fit()).observe(host);
    addEventListener('resize', () => this.fit());
    this.fit();
  }
  fit() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const s = Math.max(1, Math.floor(Math.min(r.width * dpr / this.w, r.height * dpr / this.h)));
    this.scale = s;
    if (this.view.width !== this.w * s) { this.view.width = this.w * s; this.view.height = this.h * s; }
    this.view.style.width = this.w * s / dpr + 'px';
    this.view.style.height = this.h * s / dpr + 'px';
  }
  /** 把瀏覽器座標（clientX/Y）換算成原生畫面座標 */
  toNative(cx, cy) {
    const r = this.view.getBoundingClientRect();
    return { x: (cx - r.left) / r.width * this.w, y: (cy - r.top) / r.height * this.h };
  }
  /** 設定鏡頭（整數平移，確保像素對齊）。之後的繪圖都是世界座標 */
  camera(x, y) {
    this.camX = Math.round(x); this.camY = Math.round(y);
    this.ctx.setTransform(1, 0, 0, 1, -this.camX, -this.camY);
  }
  /** 回到螢幕座標（畫 HUD 用） */
  screenSpace() { this.ctx.setTransform(1, 0, 0, 1, 0, 0); }
  clear(c) { this.screenSpace(); this.rect(0, 0, this.w, this.h, c); }
  present() {
    const v = this.vctx;
    v.imageSmoothingEnabled = false;
    v.drawImage(this.buf, 0, 0, this.view.width, this.view.height);
  }
  /** 檢查原生緩衝區內有幾個像素不屬於調色盤（測試用） */
  paletteViolations() {
    const d = this.ctx.getImageData(0, 0, this.w, this.h).data;
    let bad = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] !== 255 || !this.paletteSet.has((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])) bad++;
    }
    return bad;
  }
}
