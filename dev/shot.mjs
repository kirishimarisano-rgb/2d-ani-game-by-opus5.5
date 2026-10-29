// 開發用：node dev/shot.mjs <url> <out.png> [width]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [url, out, w = '1300'] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(w), height: 800 } });
p.on('console', (m) => console.log('console:', m.text()));
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto(url);
await p.waitForFunction(() => window.done, null, { timeout: 15000 }).catch(() => console.log('timeout'));
await p.screenshot({ path: out, fullPage: true });
await b.close();
