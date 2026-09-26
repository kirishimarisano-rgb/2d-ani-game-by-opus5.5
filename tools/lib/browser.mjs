// 載入 Playwright：優先使用專案內安裝，找不到時改用全域安裝。
// 瀏覽器路徑可用環境變數 CHROMIUM_PATH 指定。
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';

export function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch { /* 改用全域安裝 */ }
  try {
    const globalRoot = execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return require(path.join(globalRoot, 'playwright'));
  } catch {
    console.error('找不到 Playwright。請先執行：npm i -D playwright && npx playwright install chromium');
    process.exit(2);
  }
}

export async function launchBrowser() {
  const { chromium, devices } = loadPlaywright();
  const opts = { args: ['--autoplay-policy=no-user-gesture-required'] };
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(opts);
  return { browser, devices };
}

/** 收集頁面錯誤（例外、console.error、載入失敗、HTTP 4xx/5xx） */
export function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('例外：' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error：' + m.text()); });
  page.on('requestfailed', r => errors.push('載入失敗：' + r.url()));
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}：${r.url()}`); });
  return errors;
}
