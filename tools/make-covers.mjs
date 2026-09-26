// 以程式產生啟動器卡片用的像素封面（原生 176x99，卡片上以 2 倍整數放大）。
// 封面直接取用各遊戲自己的像素圖資料，確保與遊戲內一致。
//
// 用法：node tools/make-covers.mjs            產生全部封面
//       node tools/make-covers.mjs <id> ...   只產生指定項目
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './lib/serve.mjs';
import { launchBrowser } from './lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const COVER_W = 176, COVER_H = 99;

// 每個封面：開啟哪個頁面、在頁面內執行的構圖函式（回傳 PNG dataURL）、輸出位置
const COVERS = {
  'magical-shooter': {
    page: 'games/magical-shooter/',
    out: 'games/magical-shooter/cover.png',
    compose: async ({ W, H }) => {
      const { drawText } = await import('/shared/pixel-font.js');
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      let seed = 11; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
      const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      const bands = ['#0b0618', '#140a2c', '#1c0f3a', '#2b1448', '#3a1a52'];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const t = y / H * (bands.length - 1), i = Math.min(bands.length - 2, t | 0);
        g.fillStyle = t - i > BAYER[(y & 3) * 4 + (x & 3)] / 16 ? bands[i + 1] : bands[i];
        g.fillRect(x, y, 1, 1);
      }
      for (let i = 0; i < 80; i++) {
        const l = rnd(); g.fillStyle = l > 0.85 ? '#ffffff' : l > 0.45 ? '#b9a8ff' : '#5a4a8a';
        g.fillRect(rnd() * W | 0, rnd() * H | 0, 1, l > 0.93 ? 2 : 1);
      }
      const px = (x, y, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
      const circle = (cx, cy, r, col) => { for (let a = 0; a < 360; a += 1) px(cx + Math.cos(a * Math.PI / 180) * r, cy + Math.sin(a * Math.PI / 180) * r, col); };
      // Boss 與魔法陣
      const bx = 132, by = 31;
      circle(bx, by, 27, '#6d3fb0');
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; g.fillStyle = '#d2c0ff'; g.fillRect(Math.round(bx + Math.cos(a) * 27) - 1, Math.round(by + Math.sin(a) * 27) - 1, 3, 3); }
      g.drawImage(SPR_BOSS1, bx - 32, by - 29, 64, 58);
      // 彈幕：兩圈環狀彈 + 一道螺旋
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.drawImage(BUL.violet, Math.round(bx + Math.cos(a) * 40) - 3, Math.round(by + Math.sin(a) * 36) - 3); }
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + 0.26; const x = bx + Math.cos(a) * 57, y = by + Math.sin(a) * 50; if (x < W - 2 && y < H - 30) g.drawImage(BUL.pink, Math.round(x) - 3, Math.round(y) - 3); }
      for (let i = 0; i < 7; i++) { const a = 2.1 + i * 0.22, r = 20 + i * 7; g.drawImage(BUL.gold, Math.round(bx + Math.cos(a) * r) - 3, Math.round(by + Math.sin(a) * r) - 3); }
      // 夜蝠精
      g.drawImage(SPR_BAT, 84, 8); g.drawImage(SPR_BAT, 60, 20);
      // 主角艾菈（3 倍）與星之使魔、星彈
      const ax = 18, ay = 30;
      for (let i = 0; i < 3; i++) { g.drawImage(SPR_PSHOT, ax + 15, ay - 6 - i * 13, 8, 12); g.drawImage(SPR_PSHOT, ax + 25, ay - 6 - i * 13, 8, 12); }
      g.drawImage(SPR_OPTION, ax - 8, ay + 30, 10, 10); g.drawImage(SPR_OPTION, ax + 46, ay + 30, 10, 10);
      g.drawImage(SPR_PLAYER, ax, ay, 48, 66);
      // 標題
      drawText(g, 'STARLIGHT', W - 5, H - 27, '#ffd94a', { align: 'right', outline: '#12061f' });
      drawText(g, 'AIRA', W - 5, H - 18, '#ff8fc4', { align: 'right', scale: 2, outline: '#12061f' });
      return c.toDataURL('image/png');
    },
  },
};

// 原型的封面：呼叫原型自己的 stageCover() 擺出一個動作瞬間，擷取原生解析度畫面並以主角為中心裁切
const protoCover = (id, frames) => ({
  page: `prototypes/${id}/`,
  out: `prototypes/${id}/cover.png`,
  compose: async ({ W, H, frames }) => {
    const X = window.__proto;
    X.setPaused(true);
    X.game.stageCover();
    X.advance(frames);
    const s = X.screen, pl = X.game.peek().pl;
    const px = pl.x - s.camX, py = pl.y - (pl.z || 0) - s.camY - 12;
    const cx = Math.round(Math.min(Math.max(px - W / 2, 0), s.w - W)), cy = Math.round(Math.min(Math.max(py - H / 2, 0), s.h - H));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.getContext('2d').drawImage(s.buf, cx, cy, W, H, 0, 0, W, H);
    return c.toDataURL('image/png');
  },
  frames,
});
COVERS['moon-kagura'] = protoCover('moon-kagura', 8);
COVERS['greenhouse-witch'] = protoCover('greenhouse-witch', 5);
COVERS['night-market-brawler'] = protoCover('night-market-brawler', 4);

export async function makeCovers(ids = Object.keys(COVERS)) {
  const server = await serve(ROOT);
  const { browser } = await launchBrowser();
  try {
    for (const id of ids) {
      const def = COVERS[id];
      if (!def) { console.warn('未知的封面 id：', id); continue; }
      const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
      await page.goto(server.url + def.page, { waitUntil: 'load' });
      await page.waitForTimeout(400);
      if (def.prepare) await def.prepare(page);
      const dataUrl = await page.evaluate(def.compose, { W: COVER_W, H: COVER_H, frames: def.frames || 0 });
      const out = path.join(ROOT, def.out);
      fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
      console.log('封面已產生：', path.relative(ROOT, out));
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const ids = process.argv.slice(2);
  makeCovers(ids.length ? ids : undefined).catch(e => { console.error(e); process.exit(1); });
}
