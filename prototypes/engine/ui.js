// 遊戲內介面：像素視窗、選單（鍵盤／手把／點擊）、對話框、淡入淡出轉場。
// 全部畫在低解析度畫面上，只使用調色盤顏色。
import { wrapLabel, labelWidth } from './text.js';

/**
 * 主題：各遊戲自訂視窗配色（調色盤索引）
 * { ink, panel, border, light, text, dim, accent, hilite }
 */

/** 像素視窗：墨色外框＋雙層邊框＋底色，四角內縮 */
export function drawWindow(g, x, y, w, h, t, o = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  g.rect(x + 1, y, w - 2, h, t.ink);
  g.rect(x, y + 1, w, h - 2, t.ink);
  g.rect(x + 1, y + 1, w - 2, h - 2, o.border ?? t.border);
  g.rect(x + 2, y + 2, w - 4, h - 4, t.panel);
  if (t.light != null) g.rect(x + 2, y + 2, w - 4, 1, t.light);
  if (o.title) {
    const tw = labelWidth(o.title) + 12;
    const tx = Math.round(x + (o.titleAlign === 'left' ? 8 : (w - tw) / 2));
    g.rect(tx, y - 6, tw, 14, t.ink);
    g.rect(tx + 1, y - 5, tw - 2, 12, o.titleBg ?? t.border);
    g.label(o.title, tx + tw / 2, y - 6, o.titleColor ?? t.text, { align: 'center' });
  }
}

/** 選單游標（小三角形） */
export function drawCursor(g, x, y, c, time = 0) {
  const b = Math.floor(time * 4) % 2;
  x = Math.round(x) + b; y = Math.round(y);
  g.rect(x, y, 1, 7, c); g.rect(x + 1, y + 1, 1, 5, c); g.rect(x + 2, y + 2, 1, 3, c); g.rect(x + 3, y + 3, 1, 1, c);
}

/**
 * 直式選單。items: [{ label, right?, desc?, disabled?, id? }]
 * update() 回傳 { type: 'move' | 'confirm' | 'cancel' | 'denied', item, index } 或 null
 */
export class Menu {
  constructor(items = [], o = {}) {
    this.items = items;
    this.i = o.index || 0;
    this.lineH = o.lineH || 15;
    this.wrap = o.wrap ?? true;
    this.cancel = o.cancel ?? true;
    this.rects = [];
    this.scroll = 0;
    this.visible = o.visible || 99;
    this._fixIndex(1);
  }
  get item() { return this.items[this.i]; }
  setItems(items, keep = true) { this.items = items; if (!keep) this.i = 0; this.i = Math.min(this.i, items.length - 1); this._fixIndex(1); }
  _fixIndex(dir) {
    const n = this.items.length;
    if (!n) { this.i = 0; return; }
    for (let k = 0; k < n && this.items[this.i] && this.items[this.i].skip; k++) this.i = (this.i + dir + n) % n;
  }
  update(input, sound) {
    const n = this.items.length;
    if (!n) return input.pressed('cancel') && this.cancel ? { type: 'cancel' } : null;
    let mv = 0;
    if (input.repeat('down')) mv = 1;
    else if (input.repeat('up')) mv = -1;
    if (mv) {
      let j = this.i;
      for (let k = 0; k < n; k++) {
        j = this.wrap ? (j + mv + n) % n : Math.max(0, Math.min(n - 1, j + mv));
        if (!this.items[j].skip) break;
      }
      if (j !== this.i) { this.i = j; sound && sound.ui('move'); return { type: 'move', index: j, item: this.items[j] }; }
    }
    for (const t of input.taps) {
      const k = this.rects.findIndex(r => r && t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h);
      if (k >= 0 && !this.items[k].skip) {
        this.i = k;
        if (this.items[k].disabled) { sound && sound.ui('buzz'); return { type: 'denied', index: k, item: this.items[k] }; }
        sound && sound.ui('confirm');
        return { type: 'confirm', index: k, item: this.items[k] };
      }
    }
    if (input.pressed('confirm')) {
      if (this.item.disabled) { sound && sound.ui('buzz'); return { type: 'denied', index: this.i, item: this.item }; }
      sound && sound.ui('confirm');
      return { type: 'confirm', index: this.i, item: this.item };
    }
    if (this.cancel && input.pressed('cancel')) { sound && sound.ui('cancel'); return { type: 'cancel' }; }
    return null;
  }
  /** 畫在 (x, y)，寬度 w。t：主題；o: { time, size, center } */
  draw(g, x, y, w, t, o = {}) {
    this.rects = [];
    const n = this.items.length;
    if (this.i < this.scroll) this.scroll = this.i;
    if (this.i >= this.scroll + this.visible) this.scroll = this.i - this.visible + 1;
    for (let k = 0; k < n; k++) {
      if (k < this.scroll || k >= this.scroll + this.visible) { this.rects[k] = null; continue; }
      const it = this.items[k], yy = y + (k - this.scroll) * this.lineH;
      this.rects[k] = { x, y: yy - 1, w, h: this.lineH };
      if (it.skip) { if (it.label) g.label(it.label, x + 10, yy, t.dim); continue; }
      const sel = k === this.i;
      if (sel) { g.rect(x, yy - 1, w, this.lineH - 1, t.hilite ?? t.border); drawCursor(g, x + 2, yy + 3, t.accent, o.time || 0); }
      const col = it.disabled ? t.dim : sel ? (t.selText ?? t.text) : t.text;
      if (o.center) g.label(it.label, x + w / 2, yy, col, { align: 'center' });
      else g.label(it.label, x + 10, yy, col);
      if (it.right != null) g.label(String(it.right), x + w - 4, yy, it.rightColor ?? (it.disabled ? t.dim : t.accent), { align: 'right' });
    }
    if (this.scroll > 0) g.rect(x + w / 2 - 1, y - 3, 3, 1, t.accent);
    if (this.scroll + this.visible < n) g.rect(x + w / 2 - 1, y + this.visible * this.lineH - 1, 3, 1, t.accent);
  }
}

/** 多行文字（自動換行），回傳總高度 */
export function drawParagraph(g, str, x, y, maxW, c, o = {}) {
  const lines = wrapLabel(str, maxW, o.size || 12);
  const lh = o.lineH || 14;
  lines.forEach((l, i) => g.label(l, x, y + i * lh, c, { outline: o.outline, align: o.align, size: o.size }));
  return lines.length * lh;
}

/**
 * 對話框：逐字顯示，確認鍵＝顯示整句／下一句。
 * lines: [{ name?, text, color? }]
 */
export class Dialog {
  constructor(theme, sound) { this.t = theme; this.sound = sound; this.lines = null; this.i = 0; this.chars = 0; this.done = null; this.time = 0; }
  get open() { return !!this.lines; }
  show(lines, done) {
    this.lines = lines.map(l => (typeof l === 'string' ? { text: l } : l));
    this.i = 0; this.chars = 0; this.done = done || null;
  }
  update(dt, input) {
    if (!this.lines) return;
    this.time += dt;
    const line = this.lines[this.i];
    const full = [...line.text].length;
    const before = Math.floor(this.chars);
    this.chars = Math.min(full, this.chars + dt * 34);
    if (Math.floor(this.chars) !== before && Math.floor(this.chars) % 3 === 0 && this.sound && this.sound.ready) this.sound.tone({ type: 'pulse25', f0: line.voice || 740, dur: 0.02, vol: 0.025 });
    const adv = input.pressed('confirm') || input.pressed('cancel') || input.taps.length > 0;
    if (adv) {
      if (this.chars < full) this.chars = full;
      else if (++this.i >= this.lines.length) {
        const cb = this.done;
        this.lines = null; this.done = null;
        if (cb) cb();
      } else this.chars = 0;
      input.eat();
    }
  }
  draw(g, W, H) {
    if (!this.lines) return;
    const t = this.t, line = this.lines[this.i];
    const h = 58, y = H - h - 4;
    g.screenSpace();
    drawWindow(g, 6, y, W - 12, h, t, { title: line.name, titleAlign: 'left', titleColor: line.color ?? t.accent });
    const text = [...line.text].slice(0, Math.floor(this.chars)).join('');
    drawParagraph(g, text, 16, y + 9, W - 36, t.text);
    if (this.chars >= [...line.text].length && Math.floor(this.time * 3) % 2) drawCursor(g, W - 22, y + h - 13, t.accent);
  }
}

/** 淡出→切換→淡入（用有序抖動畫墨色，不使用半透明） */
export class Transition {
  constructor() { this.phase = null; this.t = 0; this.dur = 0.22; this.cb = null; }
  get busy() { return !!this.phase; }
  start(cb, dur = 0.22) {
    if (this.phase === 'out') return false;
    this.t = this.phase === 'in' ? this.t / this.dur * dur : 0;
    this.phase = 'out'; this.dur = dur; this.cb = cb;
    return true;
  }
  update(dt) {
    if (this.phase === 'out') {
      this.t += dt;
      if (this.t >= this.dur) { this.t = this.dur; const cb = this.cb; this.cb = null; this.phase = 'hold'; if (cb) cb(); this.phase = 'in'; }
    } else if (this.phase === 'in') {
      this.t -= dt;
      if (this.t <= 0) { this.t = 0; this.phase = null; }
    }
  }
  /** 0～16 */
  get level() { return this.phase ? Math.round(16 * Math.min(1, this.t / this.dur)) : 0; }
  draw(g, c) {
    const lv = this.level;
    if (lv <= 0) return;
    g.screenSpace();
    g.ditherFast(0, 0, g.w, g.h, c, lv);
  }
}

/** 數字補零（計時器顯示用） */
export function fmtTime(sec) {
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60), cs = Math.floor((sec * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
