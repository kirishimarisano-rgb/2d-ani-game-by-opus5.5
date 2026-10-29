// 截圖檢查：用 Playwright 開打包後的 dist/index.html，截圖到 screenshots/，
// 並檢查 (1) 放大 3 倍後每個邏輯像素都是整齊的 3×3 色塊 (2) 畫面上只有調色盤裡的顏色。
// 執行：npm run shots
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'screenshots');
mkdirSync(out, { recursive: true });

const palette = [...readFileSync(join(root, 'src/art/palette.ts'), 'utf8').matchAll(/'#([0-9a-f]{6})'/g)].map((m) => m[1]);
const SCALE = 3;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 320 * SCALE, height: 180 * SCALE } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(pathToFileURL(join(root, 'dist/index.html')).href);
await page.waitForTimeout(400);

const canvas = await page.$('#screen');
const problems = [];

/** 截圖並檢查像素 */
async function shot(name) {
  const file = join(out, name + '.png');
  await canvas.screenshot({ path: file });
  const result = await page.evaluate(
    async ({ src, scale, palette }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const pal = new Set(palette);
      let misaligned = 0;
      const offPalette = new Set();
      for (let by = 0; by < c.height; by += scale)
        for (let bx = 0; bx < c.width; bx += scale) {
          const i0 = (by * c.width + bx) * 4;
          for (let j = 0; j < scale; j++)
            for (let i = 0; i < scale; i++) {
              const k = ((by + j) * c.width + bx + i) * 4;
              if (d[k] !== d[i0] || d[k + 1] !== d[i0 + 1] || d[k + 2] !== d[i0 + 2]) misaligned++;
            }
          const hex = [d[i0], d[i0 + 1], d[i0 + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
          if (!pal.has(hex)) offPalette.add(hex);
        }
      return { w: c.width, h: c.height, misaligned, offPalette: [...offPalette].slice(0, 5) };
    },
    { src: 'data:image/png;base64,' + readFileSync(file).toString('base64'), scale: SCALE, palette },
  );
  const status = result.misaligned || result.offPalette.length ? '✗' : '✓';
  console.log(`${status} ${name}.png  ${result.w}×${result.h}  未對齊像素 ${result.misaligned}  調色盤外 ${result.offPalette.length ? result.offPalette.join(',') : '無'}`);
  if (status === '✗') problems.push(name);
}

const game = (fn, ...args) => page.evaluate(([f, a]) => window.__game[f](...a), [fn, args]);
const settle = (ms = 700) => page.waitForTimeout(ms);
await page.evaluate(() => (window.__game.settings.textSpeed = 4));

await shot('01_press');
await canvas.click();
await settle(600);
await shot('02_title');

// 每張背景、每個角色、每個系統畫面
const scenes = [
  ['03_train_dusk', 'start', 2, {}, {}],
  ['04_station_shao', 'pro_wait', 2, {}, {}],
  ['05_shop_xiaoman', 'xm_start', 0, {}, {}],
  ['06_shop_day', 'day1', 2, {}, {}],
  ['07_street_xiaoman', 'd1_honest', 5, {}, {}],
  ['08_warehouse_pei', 'd1_pei_honest', 5, {}, {}],
  ['09_street_rain', 'd2_out', 1, {}, {}],
  ['10_station_rain_shao', 'd2_shao', 5, {}, {}],
  ['11_room_night', 'd2_night', 2, {}, {}],
  ['12_lunch_three', 'd3_after', 6, {}, {}],
  ['13_seawall_dusk', 'd3_ask_sh', 1, {}, {}],
  ['14_warehouse_night', 'd3_pei_night', 1, {}, {}],
  ['15_temple_choice', 'd4_evening', 8, { xiaoman: 5 }, {}],
  ['16_temple_fireworks', 'sh_start', 9, { shao: 5 }, {}],
  ['17_seawall_night', 'xm_promise', 1, { xiaoman: 5 }, {}],
  ['18_station_night_shao', 'sh_send', 3, { shao: 5 }, {}],
  ['19_station_day_pei', 'pe_start', 40, { pei: 5 }, {}],
  ['20_train_day', 'sh_end_b', 4, { shao: 5 }, {}],
];
for (const [name, label, steps, vars, flags] of scenes) {
  await game('debugJump', label, vars, flags);
  await settle(500);
  for (let i = 0; i < steps; i++) {
    await game('advance');
    await game('advance');
    await page.waitForTimeout(30);
  }
  await settle(800);
  await shot(name);
}

// 表情一覽：把每個表情都叫出來
for (const [id, exprs] of Object.entries({ xiaoman: ['normal', 'smile', 'shy', 'sad', 'angry'], shao: ['normal', 'smile', 'shy', 'sad', 'surprised'], pei: ['normal', 'smile', 'shy', 'sad', 'serious'] })) {
  await game('debugJump', 'd3_after', {}, {});
  await settle(300);
  for (const e of exprs) {
    await page.evaluate(([id, e]) => {
      const g = window.__game;
      g.vm.st.scene.chars = { [id]: { expr: e, pos: 'center' } };
      g.uiHidden = true;
    }, [id, e]);
    await settle(250);
    await shot(`expr_${id}_${e}`);
  }
  await page.evaluate(() => (window.__game.uiHidden = false));
}

// 系統畫面
await game('debugJump', 'day1', {}, {});
await settle(600);
for (let i = 0; i < 6; i++) await game('advance');
await settle(300);
await game('openOverlay', 'log');
await settle(300);
await shot('30_log');
await game('closeOverlay');
await game('saveTo', 0);
await game('openOverlay', 'save');
await settle(300);
await shot('31_save');
await game('closeOverlay');
// 讀檔回來要能繼續
await game('debugJump', 'd3_after', {}, {});
await settle(300);
await game('loadFrom', 0);
await settle(800);
const loaded = await page.evaluate(() => ({ t: window.__game.block?.t, bg: window.__game.vm?.st.scene.bg }));
if (loaded.t !== 'say' || loaded.bg !== 'shop') problems.push(`讀檔失敗：${JSON.stringify(loaded)}`);
await shot('31b_loaded');
await game('openOverlay', 'config');
await settle(300);
await shot('32_config');
await game('closeOverlay');
await game('debugJump', 'day1', {}, {});
await settle(300);
await page.evaluate(() => {
  const g = window.__game;
  for (let i = 0; i < 5000 && g.block?.t !== 'ending'; i++) {
    if (g.block?.t === 'choice') g.choose(0);
    else if (g.block?.t === 'wait') {
      g.vm.advance();
      g.proceed();
    } else g.advance();
    g.chapterShownAt = -1e9;
  }
});
await settle(2500);
await shot('33_ending');
await game('toTitle');
await game('openOverlay', 'gallery');
await settle(700);
await shot('34_gallery');

await browser.close();
if (errors.length) {
  console.error('\n頁面錯誤：\n' + errors.join('\n'));
  process.exit(1);
}
if (problems.length) {
  console.error(`\n✗ ${problems.length} 張截圖有像素問題：${problems.join(', ')}`);
  process.exit(1);
}
console.log(`\n✓ 截圖都在 screenshots/，像素全部對齊、只用調色盤顏色`);
