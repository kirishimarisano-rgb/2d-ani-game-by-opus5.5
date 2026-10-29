// 開發用：把所有背景與立繪排在一頁上檢查
import { getBg } from '../src/art/backgrounds';
import { BACKGROUNDS } from '../src/core/cast';
const out = document.getElementById('out')!;
const mode = new URLSearchParams(location.search).get('m') ?? 'bg';
function add(cv: HTMLCanvasElement, scale = 2) {
  cv.style.width = cv.width * scale + 'px';
  cv.style.imageRendering = 'pixelated';
  out.appendChild(cv);
}
if (mode === 'bg') {
  for (const [name, times] of Object.entries(BACKGROUNDS)) for (const t of times) {
    const art = getBg(name, t, []);
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180;
    const ctx = cv.getContext('2d')!;
    if (art.scenery) art.scenery.forEach((s) => { ctx.drawImage(s, 0, 0, 76, 52, 18, 30, 76, 52); ctx.drawImage(s, 100, 0, 76, 52, 122, 30, 76, 52); ctx.drawImage(s, 200, 0, 76, 52, 226, 30, 76, 52); });
    ctx.drawImage(art.base, 0, 0);
    add(cv);
  }
  for (const n of ['station', 'street']) { const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; cv.getContext('2d')!.drawImage(getBg(n, 'day', ['rain']).base, 0, 0); add(cv); }
}
(window as any).done = true;
import { getSprite } from '../src/art/characters';
import { EXPRESSIONS } from '../src/core/cast';
if (mode === 'chr') {
  for (const id of ['xiaoman', 'shao', 'pei', 'yan']) {
    const row = document.createElement('div');
    for (const e of EXPRESSIONS[id]) {
      const cv = document.createElement('canvas'); cv.width = 112; cv.height = 150;
      const ctx = cv.getContext('2d')!; ctx.fillStyle = '#94d2e6'; ctx.fillRect(0, 0, 112, 150);
      ctx.drawImage(getSprite(id, e, 0, 0), 0, 0); add(cv, 2);
    }
    for (const [ey, m] of [[1, 1], [2, 2]] as const) {
      const cv = document.createElement('canvas'); cv.width = 112; cv.height = 150;
      const ctx = cv.getContext('2d')!; ctx.fillStyle = '#94d2e6'; ctx.fillRect(0, 0, 112, 150);
      ctx.drawImage(getSprite(id, 'normal', ey, m), 0, 0); add(cv, 2);
    }
  }
}
(window as any).done = true;
