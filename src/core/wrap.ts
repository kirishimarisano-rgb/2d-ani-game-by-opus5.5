// 點陣字排版：全形字 12px，半形字 6px。決定性的寬度讓 Node 測試也能檢查換行。
export const GLYPH = 12;
export const LINE_H = 14;
export const LINES_PER_PAGE = 3;

export function charWidth(ch: string): number {
  return ch.charCodeAt(0) < 0x80 ? GLYPH / 2 : GLYPH;
}

export function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += charWidth(ch);
  return w;
}

// 不能放在行首的字（避頭點）
const NO_START = new Set('，。、！？；：」』）》…—～,.!?;:)』'.split(''));
// 不能放在行尾的字（避尾點）
const NO_END = new Set('「『（《('.split(''));

/** 換行。避頭點可以懸掛超出一格（對話框右側預留了邊界）。 */
export function wrap(text: string, maxW: number): string[] {
  const chars = [...text];
  const lines: string[] = [];
  let cur = '';
  let w = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const cw = charWidth(ch);
    if (w + cw > maxW && cur) {
      if (NO_START.has(ch) && w + cw <= maxW + GLYPH) {
        cur += ch;
        lines.push(cur);
        cur = '';
        w = 0;
        continue;
      }
      // 行尾是開括號的話，把它帶到下一行
      const last = [...cur].pop()!;
      if (NO_END.has(last) && cur.length > 1) {
        lines.push(cur.slice(0, -last.length));
        cur = last;
        w = charWidth(last);
      } else {
        lines.push(cur);
        cur = '';
        w = 0;
      }
    }
    cur += ch;
    w += cw;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** 分頁：每頁 LINES_PER_PAGE 行。 */
export function paginate(text: string, maxW: number): string[][] {
  const lines = wrap(text, maxW);
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) pages.push(lines.slice(i, i + LINES_PER_PAGE));
  return pages.length ? pages : [[]];
}

// 對話框文字區寬度（有頭像時較窄）
export const TEXT_W = 288;
export const TEXT_W_FACE = 240;
