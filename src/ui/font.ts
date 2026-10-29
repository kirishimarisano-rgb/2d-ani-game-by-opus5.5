import { PALETTE } from '../art/palette';
import { charWidth, GLYPH } from '../core/wrap';

// 12px 點陣字：用系統字型畫一次，alpha 門檻化成單色點陣，再快取。
const FONT_STACK =
  '"WenQuanYi Zen Hei Sharp","Microsoft JhengHei","PingFang TC","Noto Sans CJK TC","Noto Sans TC","Heiti TC",sans-serif';

const scratch = document.createElement('canvas');
scratch.width = scratch.height = 16;
const sctx = scratch.getContext('2d', { willReadFrequently: true })!;

const masks = new Map<string, Uint8Array>();
const tinted = new Map<string, HTMLCanvasElement>();

function mask(ch: string): Uint8Array {
  let m = masks.get(ch);
  if (m) return m;
  sctx.clearRect(0, 0, 16, 16);
  sctx.font = `${GLYPH}px ${FONT_STACK}`;
  sctx.textBaseline = 'top';
  sctx.fillStyle = '#fff';
  sctx.fillText(ch, 0, 1);
  const d = sctx.getImageData(0, 0, 16, 16).data;
  m = new Uint8Array(16 * 16);
  for (let i = 0; i < 256; i++) m[i] = d[i * 4 + 3] > 110 ? 1 : 0;
  masks.set(ch, m);
  return m;
}

function glyph(ch: string, color: number): HTMLCanvasElement {
  const key = ch + '|' + color;
  let cv = tinted.get(key);
  if (cv) return cv;
  const m = mask(ch);
  cv = document.createElement('canvas');
  cv.width = cv.height = 16;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = PALETTE[color];
  for (let i = 0; i < 256; i++) if (m[i]) ctx.fillRect(i & 15, i >> 4, 1, 1);
  tinted.set(key, cv);
  return cv;
}

export function drawText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color = 6, shadow: number | null = 0) {
  let cx = x;
  for (const ch of s) {
    if (ch !== ' ' && ch !== '　') {
      if (shadow !== null) ctx.drawImage(glyph(ch, shadow), cx + 1, y + 1);
      ctx.drawImage(glyph(ch, color), cx, y);
    }
    cx += charWidth(ch);
  }
  return cx - x;
}

/** 放大的標題字（每個點陣字像素畫成 scale×scale） */
export function drawBigText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, scale: number, color: number, shadow: number) {
  let cx = x;
  for (const ch of s) {
    const m = mask(ch);
    for (let i = 0; i < 256; i++)
      if (m[i]) {
        ctx.fillStyle = PALETTE[shadow];
        ctx.fillRect(cx + (i & 15) * scale + 1, y + (i >> 4) * scale + 1, scale, scale);
      }
    for (let i = 0; i < 256; i++)
      if (m[i]) {
        ctx.fillStyle = PALETTE[color];
        ctx.fillRect(cx + (i & 15) * scale, y + (i >> 4) * scale, scale, scale);
      }
    cx += charWidth(ch) * scale;
  }
}

// ---- 3×5 手畫小字（UI 標籤用） ----
const TINY: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', K: '101101110101101', L: '100100100100111', M: '101111111101101',
  N: '110101101101101', O: '010101101101010', P: '110101110100100', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010',
  W: '101101111111101', X: '101101010101101', Y: '101101010010010', Q: '010101101111011',
  '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010',
  '8': '111101111101111', '9': '111101111001110', '/': '001001010100100', ':': '000010000010000',
  '.': '000000000000010', '-': '000000111000000', '>': '100010001010100', '<': '001010100010001',
  '!': '010010010000010', '?': '110001010000010',
};

export function tinyWidth(s: string) {
  return s.length * 4 - 1;
}

export function drawTiny(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: number) {
  ctx.fillStyle = PALETTE[color];
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = TINY[ch];
    if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + (i % 3), y + Math.floor(i / 3), 1, 1);
    cx += 4;
  }
}
