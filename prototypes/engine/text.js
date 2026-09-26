// 中文點陣文字：用系統字型在離屏畫布上以小字級（預設 12px）繪製，
// 再把灰階邊緣「二值化」成實心像素。著色時只使用調色盤裡的顏色，所以畫面仍然維持 16 色。
// 英文數字建議用 Painter.text（內建點陣字），中文、說明文字用 Painter.label。

const STACK = '"PingFang TC","Heiti TC","Microsoft JhengHei","Microsoft YaHei","Noto Sans CJK TC","Noto Sans TC","Source Han Sans TC","WenQuanYi Zen Hei",sans-serif';
const THRESHOLD = 100; // alpha ≥ 此值的像素視為筆畫
const MAX_CACHE = 900;
const cache = new Map();
let measurer = null;

const fontOf = (size, bold) => `${bold ? 'bold ' : ''}${size}px ${STACK}`;
function measureCtx() {
  if (!measurer) measurer = document.createElement('canvas').getContext('2d');
  return measurer;
}

/** 取得（並快取）一段文字的單色遮罩 */
function mask(str, size, bold) {
  const key = size + (bold ? 'b|' : '|') + str;
  let m = cache.get(key);
  if (m) { cache.delete(key); cache.set(key, m); return m; }
  const mc = measureCtx();
  mc.font = fontOf(size, bold);
  const adv = Math.ceil(mc.measureText(str).width);
  const w = Math.max(1, adv + 3), h = size + 5;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const x = cv.getContext('2d', { willReadFrequently: true });
  x.font = fontOf(size, bold);
  x.textBaseline = 'top';
  x.fillStyle = '#fff';
  x.fillText(str, 1, 1);
  const img = x.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < w * h; i++) {
    const on = d[i * 4 + 3] >= THRESHOLD;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255;
    d[i * 4 + 3] = on ? 255 : 0;
  }
  x.putImageData(img, 0, 0);
  m = { cv, adv, tint: new Map() };
  cache.set(key, m);
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
  return m;
}
function tinted(m, color) {
  let c = m.tint.get(color);
  if (!c) {
    c = document.createElement('canvas');
    c.width = m.cv.width; c.height = m.cv.height;
    const g = c.getContext('2d');
    g.drawImage(m.cv, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    m.tint.set(color, c);
  }
  return c;
}

/** 文字寬度（像素，未乘 scale） */
export function labelWidth(str, size = 12, bold = false) {
  const mc = measureCtx();
  mc.font = fontOf(size, bold);
  return Math.ceil(mc.measureText(String(str)).width);
}

/**
 * 畫文字。p：Painter；o: { size（預設 12）, bold, align, outline, shadow, scale（整數倍） }
 * y 為文字框頂端，12px 字的筆畫大約落在 y+1 ～ y+12。回傳寬度。
 */
export function drawLabel(p, str, x, y, c, o = {}) {
  str = String(str);
  if (!str) return 0;
  const size = o.size || 12, sc = o.scale || 1;
  const m = mask(str, size, !!o.bold);
  const w = m.adv * sc;
  const x0 = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x) - sc;
  const y0 = Math.round(y) - sc;
  const W = m.cv.width * sc, H = m.cv.height * sc;
  const g = p.ctx;
  if (o.outline != null) {
    const oc = tinted(m, p.palette[o.outline]);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) g.drawImage(oc, x0 + dx, y0 + dy, W, H);
  }
  if (o.shadow != null) g.drawImage(tinted(m, p.palette[o.shadow]), x0 + sc, y0 + sc, W, H);
  g.drawImage(tinted(m, p.palette[c]), x0, y0, W, H);
  return w;
}

// 行首不可出現的標點（避頭點）
const NO_START = new Set('，。、！？；：」』）》〉…─～,.!?;:)]}'.split(''));

/** 依寬度自動換行（逐字斷行，支援 \n 與避頭點），回傳各行字串 */
export function wrapLabel(str, maxW, size = 12, bold = false) {
  const mc = measureCtx();
  mc.font = fontOf(size, bold);
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    const chars = [...para];
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      // 英數單字不拆開
      let tok = ch;
      if (/[A-Za-z0-9%+\-.]/.test(ch)) { while (i + 1 < chars.length && /[A-Za-z0-9%+\-.]/.test(chars[i + 1])) tok += chars[++i]; }
      const test = line + tok;
      if (line && mc.measureText(test).width > maxW && !NO_START.has(tok[0])) { out.push(line); line = tok.trimStart(); }
      else line = test;
    }
    out.push(line);
  }
  return out;
}
