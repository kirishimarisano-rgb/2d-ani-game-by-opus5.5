// 冒煙測試：啟動本機伺服器，用無頭瀏覽器逐一開啟啟動器、每款遊戲與每個原型，
// 確認沒有錯誤、卡片與封面正常、「返回遊戲選單」可用，並做各自的基本操作檢查。
//
// 用法：node tools/smoke-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './lib/serve.mjs';
import { launchBrowser, trackErrors } from './lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const list = JSON.parse(fs.readFileSync(path.join(ROOT, 'games.json'), 'utf8'));
const entries = [...(list.games || []).map(e => ({ ...e, kind: 'game' })), ...(list.prototypes || []).map(e => ({ ...e, kind: 'proto' }))];

let failed = 0;
const ok = (cond, msg, detail) => {
  console.log(`${cond ? '  ✔' : '  ✘'} ${msg}${!cond && detail ? '\n      ' + detail : ''}`);
  if (!cond) failed++;
};

// 各遊戲專屬的額外檢查（在頁面載入後執行）
const GAME_CHECKS = {
  'magical-shooter': async page => {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    ok(await page.evaluate(() => state === 'play'), '按 Enter 後進入遊玩狀態');
    ok(await page.evaluate(() => PixelArcade.backButton.hidden), '遊玩中隱藏返回按鈕（避免誤觸）');
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(150);
    ok(await page.evaluate(() => state === 'pause' && !PixelArcade.backButton.hidden), '暫停時顯示返回按鈕');
  },
};

// 原型共用的引擎檢查（引擎在 window.__proto 提供除錯介面）
async function protoChecks(page) {
  const info = await page.evaluate(() => window.__proto && window.__proto.info());
  ok(!!info, '原型引擎已啟動（window.__proto）');
  if (!info) return;
  ok(info.width * info.height > 0 && Number.isInteger(info.scale) && info.scale >= 1, `低解析度 ${info.width}x${info.height} 以整數 ${info.scale} 倍放大`);
  ok(info.palette.length <= 16, `調色盤 ${info.palette.length} 色（上限 16）`);
  ok(info.params > 0, `調參面板共有 ${info.params} 個參數`);
  const f0 = info.frames;
  await page.waitForTimeout(500);
  const f1 = await page.evaluate(() => window.__proto.info().frames);
  ok(f1 > f0, '遊戲迴圈持續更新');
  // 隨機操作一小段時間，確認不會出錯
  await page.evaluate(() => window.__proto.fuzz && window.__proto.fuzz(240));
  const bad = await page.evaluate(() => window.__proto.paletteViolations());
  ok(bad === 0, '畫面上的每個像素都屬於 16 色調色盤', `超出調色盤的像素：${bad}`);
}

const server = await serve(ROOT);
const { browser, devices } = await launchBrowser();
try {
  console.log('▶ 啟動器');
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = trackErrors(page);
    await page.goto(server.url, { waitUntil: 'load' });
    await page.waitForFunction(() => document.body.dataset.loaded);
    ok(await page.evaluate(() => document.body.dataset.loaded === 'true'), 'games.json 載入成功');
    const n = await page.evaluate(() => document.querySelectorAll('.card').length);
    ok(n === entries.length, `卡片數量 ${n}（games.json 共 ${entries.length} 筆）`);
    await page.waitForTimeout(300);
    const covers = await page.evaluate(() => [...document.querySelectorAll('.card img')].map(i => ({ src: i.getAttribute('src').slice(0, 60), ok: i.complete && i.naturalWidth > 0 && !i.dataset.fallback })));
    covers.forEach(c => ok(c.ok, `封面載入：${c.src}`));
    const protoVisible = await page.evaluate(() => !document.getElementById('prototypes').hidden);
    ok(protoVisible === entries.some(e => e.kind === 'proto'), '「原型試玩」區塊依清單顯示／隱藏');
    ok(errors.length === 0, '沒有錯誤', errors.join('\n      '));
    await page.close();

    const mobile = await browser.newContext({ ...devices['iPhone 13'] });
    const mp = await mobile.newPage();
    const merr = trackErrors(mp);
    await mp.goto(server.url, { waitUntil: 'load' });
    await mp.waitForFunction(() => document.body.dataset.loaded);
    ok(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '手機寬度沒有水平捲動');
    ok(merr.length === 0, '手機版沒有錯誤', merr.join('\n      '));
    await mobile.close();
  }

  for (const e of entries) {
    console.log(`▶ ${e.kind === 'proto' ? '原型' : '遊戲'}：${e.title}（${e.path}）`);
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = trackErrors(page);
    await page.goto(server.url + e.path, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    ok(await page.evaluate(() => !!document.querySelector('canvas')), '畫面（canvas）存在');
    const back = await page.evaluate(() => { const a = document.querySelector('a.pa-back'); return a && a.href; });
    ok(back === server.url, '有「返回遊戲選單」按鈕且指向啟動器', `實際：${back}`);
    if (e.kind === 'proto') await protoChecks(page);
    if (GAME_CHECKS[e.id]) await GAME_CHECKS[e.id](page);
    // 點擊返回（若遊戲把按鈕藏起來，先讓它顯示）
    await page.evaluate(() => { window.PixelArcade && PixelArcade.setBackVisible(true); });
    await Promise.all([page.waitForURL(server.url), page.click('a.pa-back')]);
    ok(page.url() === server.url, '點擊返回後回到啟動器');
    ok(errors.length === 0, '沒有錯誤', errors.join('\n      '));
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(failed ? `\n✘ ${failed} 項檢查失敗` : '\n✔ 全部通過');
process.exit(failed ? 1 : 0);
