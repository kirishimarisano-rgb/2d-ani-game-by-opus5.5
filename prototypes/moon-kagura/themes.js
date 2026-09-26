// 《月下神樂》四個區域的畫面主題：遠景視差、地形圖塊、前景與環境粒子。
// 全部用調色盤畫筆即時產生（沒有圖檔）。
import { makeLayer, TAU } from '../engine/pixel.js';
import { rand } from '../engine/fx.js';
import { PALETTE } from './sprites.js';
import { TILE } from './levels.js';

export const C = { ink: 0, night: 1, indigo: 2, violet: 3, lav: 4, moon: 5, white: 6, dwood: 7, wood: 8, red: 9, orange: 10, gold: 11, skin: 12, pink: 13, dgreen: 14, green: 15 };
const T = 16;
const seeded = seed => () => (seed = seed * 16807 % 2147483647) / 2147483647;

function gradient(p, w, h, stops) {
  // stops: [[t, colorA, colorB]]：在 t 區段內由 A 以抖動漸變到 B
  for (let y = 0; y < h; y++) {
    const t = y / h;
    let a = stops[stops.length - 1][1], b = a, f = 0;
    for (let i = 0; i < stops.length; i++) {
      const [t0, ca, cb] = stops[i], t1 = i + 1 < stops.length ? stops[i + 1][0] : 1;
      if (t >= t0 && t < t1) { a = ca; b = cb; f = (t - t0) / (t1 - t0); break; }
    }
    p.rect(0, y, w, 1, a);
    p.dither(0, y, w, 1, b, Math.round(f * 16));
  }
}
function moon(p, mx, my, r, eclipse) {
  for (let y = -r - 10; y <= r + 10; y++) for (let x = -r - 10; x <= r + 10; x++) {
    const d = Math.hypot(x, y);
    if (d > r + 2 && d < r + 10 && ((x + y) & 1) === 0 && d < r + 2 + 8 * (1 - Math.abs(Math.sin(Math.atan2(y, x) * 3)) * 0.4)) p.px(mx + x, my + y, d < r + 6 ? C.violet : C.indigo);
  }
  p.circle(mx, my, r, C.moon);
  p.circle(mx - 2, my - 2, r - 2, C.white);
  p.circle(mx + r * 0.3, my + r * 0.25, r * 0.2, C.moon); p.circle(mx - r * 0.4, my + r * 0.4, r * 0.1, C.moon); p.circle(mx + r * 0.05, my - r * 0.45, r * 0.14, C.moon);
  if (eclipse) p.circle(mx + r * 0.55, my - r * 0.1, r * 0.95, C.ink);
}
function stars(p, w, h, n, seed) {
  const r = seeded(seed);
  for (let i = 0; i < n; i++) p.px(r() * w, r() * h, r() < 0.2 ? C.white : r() < 0.6 ? C.moon : C.lav);
}

/** 地圖的每一欄最上面的實心格（找地面） */
function surfaces(map) {
  const out = [];
  for (let tx = 0; tx < map.MW; tx++) {
    let s = -1;
    for (let ty = 0; ty < map.MH; ty++) if (map.at(tx, ty) === TILE.SOLID) { s = ty; break; }
    out.push(s);
  }
  return out;
}

// ---------------- 共用圖塊畫法 ----------------
function drawPlank(p, x, y, top, body, shade, left, right) {
  p.rect(x, y, T, 4, body); p.rect(x, y, T, 1, top); p.rect(x, y + 3, T, 1, shade); p.rect(x, y + 4, T, 1, C.ink);
  p.px(x + 3, y + 2, shade); p.px(x + 12, y + 2, shade);
  if (left) p.rect(x + 2, y + 5, 2, 5, shade);
  if (right) p.rect(x + 12, y + 5, 2, 5, shade);
}
function drawSpikes(p, x, y, base, mid, tip) {
  // 每格三根三角尖刺：墨色外框、本體、亮面、尖端白點
  for (let k = 0; k < 3; k++) {
    const cx = x + 3 + k * 5;
    for (let r = 0; r < 11; r++) {
      const half = Math.floor(r / 4);
      const yy = y + 5 + r;
      p.rect(cx - half - 1, yy, half * 2 + 3, 1, C.ink);
      p.rect(cx - half, yy, half * 2 + 1, 1, base);
      if (r > 1) p.px(cx - half, yy, mid);
    }
    p.px(cx, y + 4, C.ink); p.px(cx, y + 5, tip); p.px(cx, y + 6, tip);
  }
  p.rect(x, y + 15, T, 1, C.ink);
}

// =====================================================================
export function buildTheme(id, map, W, H) {
  const WW = map.MW * T, WH = map.MH * T;
  const farW = W + Math.ceil((WW - W) * 0.15) + 8, midW = W + Math.ceil((WW - W) * 0.4) + 8;
  const surf = surfaces(map);
  const th = THEMES[id];
  const ctx = { map, W, H, WW, WH, farW, midW, surf };
  const sky = makeLayer(W, H, PALETTE, p => th.sky(p, ctx));
  const far = makeLayer(farW, H, PALETTE, p => th.far(p, ctx));
  const mid = makeLayer(midW, H + 40, PALETTE, p => th.mid(p, ctx));
  const world = makeLayer(WW, WH, PALETTE, p => { th.decor && th.decor(p, ctx); drawTiles(p, ctx, th); });
  return {
    id, colors: th.colors,
    drawBg(g, camX, camY, time, o = {}) {
      g.screenSpace();
      g.ctx.drawImage(o.eclipseSky || sky, 0, 0);
      th.twinkle && th.twinkle(g, time, W);
      const vy = Math.round((camY - Math.max(0, WH - H)) * 0.1);
      g.ctx.drawImage(far, -Math.round(camX * 0.15), 10 - vy);
      g.ctx.drawImage(mid, -Math.round(camX * 0.4), 14 - Math.round((camY - Math.max(0, WH - H)) * 0.25));
    },
    world,
    drawFg(g, camX, camY, time) { th.fg && th.fg(g, camX, camY, time, ctx); },
    ambient(parts, cam, dt, time) { th.ambient && th.ambient(parts, cam, dt, time, ctx); },
    drawCrumble(g, x, y, shake) { th.crumble(g, x + shake, y); },
    drawBreak(g, x, y, cracks) { th.breakable(g, x, y, cracks); },
    spikeColors: th.spike,
  };
}

function drawTiles(p, ctx, th) {
  const { map } = ctx;
  for (let ty = 0; ty < map.MH; ty++) for (let tx = 0; tx < map.MW; tx++) {
    const t = map.at(tx, ty), x = tx * T, y = ty * T;
    if (t === TILE.SOLID) th.solid(p, x, y, tx, ty, ctx);
    else if (t === TILE.ONEWAY) th.plank(p, x, y, map.at(tx - 1, ty) !== TILE.ONEWAY, map.at(tx + 1, ty) !== TILE.ONEWAY);
    else if (t === TILE.SPIKE) drawSpikes(p, x, y, ...th.spike);
  }
}
const isSolid = (map, tx, ty) => map.at(tx, ty) === TILE.SOLID || map.at(tx, ty) === TILE.BREAK;

// =====================================================================
const THEMES = {
  // ---------------- 鳥居參道：月夜、五重塔、石磚與草 ----------------
  approach: {
    colors: { fly: [C.pink, C.pink, C.white, C.pink] },
    spike: [C.indigo, C.lav, C.white],
    sky(p, { W, H }) {
      gradient(p, W, H, [[0, C.ink, C.night], [0.45, C.night, C.indigo], [0.8, C.indigo, C.violet]]);
      stars(p, W, H * 0.7, 90, 3);
      moon(p, 246, 44, 21);
    },
    twinkle(g, time, W) {
      for (let i = 0; i < 6; i++) { const x = (i * 53 + 17) % W, y = (i * 29 + 11) % 100; if (Math.sin(time * 2.3 + i * 1.7) > 0.6) { g.px(x, y, C.white); g.px(x - 1, y, C.moon); g.px(x + 1, y, C.moon); g.px(x, y - 1, C.moon); g.px(x, y + 1, C.moon); } }
    },
    far(p, { farW, H }) {
      for (let x = 0; x < farW; x++) {
        const h = 62 + Math.sin(x * 0.021) * 18 + Math.sin(x * 0.053 + 1) * 9 + Math.sin(x * 0.13) * 3;
        const top = Math.round(H - h);
        p.rect(x, top, 1, H - top, C.indigo); p.px(x, top, C.violet);
        if (Math.sin(x * 0.021) > 0.5) p.px(x, top + 1, C.violet);
      }
      for (let y = 140; y < H; y++) p.dither(0, y, farW, 1, C.violet, Math.round((y - 140) / 40 * 7));
    },
    mid(p, { midW, H }) {
      const r = seeded(9);
      for (let x = -10; x < midW + 10; x += 9) p.circle(x, 150 - r() * 16, 9 + r() * 10, C.night);
      p.rect(0, 150, midW, H + 40 - 150, C.night);
      const pag = (cx, base) => {
        for (let i = 0; i < 5; i++) {
          const y = base - i * 17, w = 30 - i * 4;
          p.rect(cx - w / 2 + 5, y - 11, w - 10, 11, C.night);
          for (let k = 0; k < 4; k++) p.rect(cx - w / 2 - k, y - 13 - k, w + k * 2, 1, C.night);
          if (i < 4) { p.px(cx - 3, y - 6, C.orange); p.px(cx + 3, y - 6, C.orange); }
        }
        p.rect(cx - 1, base - 5 * 17 - 14, 2, 14, C.night);
      };
      for (let cx = 180; cx < midW; cx += 380) pag(cx, 150);
      for (let cx = 60; cx < midW; cx += 170) {
        for (let k = 0; k < 8; k++) p.rect(cx - 26 + k * 2, 132 - k * 2, 52 - k * 4, 2, C.night);
        p.rect(cx - 18, 132, 36, 20, C.night);
        p.rect(cx - 12, 140, 4, 3, C.orange); p.rect(cx + 8, 140, 4, 3, C.orange);
      }
    },
    decor(p, { map, surf }) {
      // 大鳥居與櫻花樹（在地形後面）
      const r = seeded(4);
      const nearSpike = tx => { for (let k = -6; k <= 6; k++) for (let y = 0; y < map.MH; y++) if (map.at(tx + k, y) === TILE.SPIKE) return true; return false; };
      for (let tx = 14; tx < map.MW - 8; tx += 36 + Math.floor(r() * 16)) {
        const s = surf[tx];
        if (s < 4 || surf[tx + 4] !== s || surf[tx - 4] !== s || nearSpike(tx)) continue;
        torii(p, tx * T + 8, s * T, 0.9 + r() * 0.3);
      }
      for (let tx = 6; tx < map.MW - 4; tx += 11 + Math.floor(r() * 12)) {
        const s = surf[tx];
        if (s < 5 || surf[tx + 1] !== s) continue;
        sakura(p, tx * T + 8, s * T, r);
      }
    },
    solid(p, x, y, tx, ty, { map }) {
      const topOpen = !isSolid(map, tx, ty - 1);
      p.rect(x, y, T, T, topOpen ? C.violet : C.indigo);
      const off = (ty % 2) * 8;
      for (let by = 0; by < T; by += 8) {
        p.rect(x, y + by, T, 1, topOpen ? C.indigo : C.night);
        for (let bx = (off + (by ? 8 : 0)) % 16; bx < T; bx += 16) p.rect(x + bx, y + by, 1, 8, topOpen ? C.indigo : C.night);
      }
      if (topOpen) {
        p.rect(x, y, T, 3, C.dgreen);
        for (let i = 0; i < T; i++) { if ((i * 7 + tx * 3) % 5 < 2) p.px(x + i, y + 3, C.dgreen); if ((i * 3 + tx) % 4 === 0) p.px(x + i, y - 1, C.dgreen); }
        p.rect(x, y, T, 1, C.green);
        for (let i = 0; i < T; i += 3) p.px(x + i + (tx % 3), y + 1, C.green);
      }
      if (!isSolid(map, tx - 1, ty) && !topOpen) p.rect(x, y, 1, T, C.violet);
    },
    plank(p, x, y, l, r) { drawPlank(p, x, y, C.gold, C.wood, C.dwood, l, r); },
    crumble(g, x, y) {
      g.rect(x, y, T, 4, C.wood); g.rect(x, y, T, 1, C.orange); g.rect(x, y + 4, T, 1, C.ink);
      g.px(x + 5, y + 1, C.dwood); g.px(x + 6, y + 2, C.dwood); g.px(x + 7, y + 3, C.dwood); g.px(x + 11, y + 1, C.dwood); g.px(x + 10, y + 2, C.dwood);
    },
    breakable(g, x, y, cracks) {
      g.rect(x, y, T, T, C.violet); g.rect(x, y, T, 1, C.lav); g.rect(x, y + 8, T, 1, C.indigo); g.rect(x + 8, y, 1, 8, C.indigo);
      if (cracks > 0) { g.line(x + 3, y + 2, x + 7, y + 7, C.ink); g.line(x + 7, y + 7, x + 5, y + 13, C.ink); }
      if (cracks > 1) { g.line(x + 12, y + 3, x + 9, y + 9, C.ink); g.line(x + 9, y + 9, x + 13, y + 14, C.ink); }
    },
    ambient(parts, cam, dt, time, { W, H }) {
      if (Math.random() < dt / 0.18) parts.add({ x: cam.x + rand(0, W + 60), y: cam.y - 4, vx: rand(-22, -8), vy: rand(12, 26), life: 8, colors: [C.pink, C.pink, C.white, C.pink], shape: 'px', petal: true });
      if (Math.random() < dt / 0.5) parts.add({ x: cam.x + rand(0, W), y: cam.y + rand(60, H), vx: rand(-6, 6), vy: rand(-8, -2), life: rand(2, 4), colors: [C.dgreen, C.green, C.white, C.green, C.dgreen], shape: 'px', drag: 0.2, glow: true });
    },
  },

  // ---------------- 竹林小徑：深綠、竹子層層、竹槍 ----------------
  bamboo: {
    colors: { fly: [C.green, C.dgreen, C.green] },
    spike: [C.dgreen, C.green, C.moon],
    sky(p, { W, H }) {
      gradient(p, W, H, [[0, C.ink, C.night], [0.5, C.night, C.dgreen], [0.85, C.dgreen, C.dgreen]]);
      stars(p, W, H * 0.4, 40, 12);
      moon(p, 70, 36, 14);
    },
    far(p, { farW, H }) {
      const r = seeded(21);
      for (let x = 0; x < farW; x += 5 + Math.floor(r() * 7)) {
        const w = 2 + Math.floor(r() * 2);
        p.rect(x, 0, w, H, C.night);
        for (let y = Math.floor(r() * 20); y < H; y += 22 + Math.floor(r() * 8)) p.rect(x - 1, y, w + 2, 1, C.ink);
      }
      for (let y = 120; y < H; y++) p.dither(0, y, farW, 1, C.dgreen, Math.round((y - 120) / 60 * 8));
    },
    mid(p, { midW, H }) {
      const r = seeded(31);
      for (let x = 0; x < midW; x += 14 + Math.floor(r() * 16)) {
        const w = 4 + Math.floor(r() * 3);
        p.rect(x, 0, w, H + 40, C.dgreen);
        p.rect(x + 1, 0, 1, H + 40, C.green);
        for (let y = Math.floor(r() * 30); y < H + 40; y += 26 + Math.floor(r() * 10)) {
          p.rect(x - 1, y, w + 2, 2, C.night); p.rect(x, y - 1, w, 1, C.green);
          if (r() < 0.4) { const d = r() < 0.5 ? -1 : 1; for (let k = 0; k < 7; k++) p.px(x + (d > 0 ? w : -1) + d * k, y - k / 2, C.green), p.px(x + (d > 0 ? w : -1) + d * k, y - k / 2 + 1, C.dgreen); }
        }
      }
    },
    decor(p, { map, surf }) {
      const r = seeded(8);
      // 石燈籠與小祠
      for (let tx = 10; tx < map.MW - 6; tx += 30 + Math.floor(r() * 20)) {
        const s = surf[tx];
        if (s < 4 || surf[tx + 1] !== s || surf[tx - 1] !== s) continue;
        const x = tx * T + 8, y = s * T;
        p.rect(x - 7, y - 20, 14, 3, C.indigo); p.rect(x - 5, y - 17, 10, 8, C.night); p.rect(x - 3, y - 15, 6, 4, C.orange); p.rect(x - 1, y - 9, 2, 9, C.indigo); p.rect(x - 4, y - 2, 8, 2, C.indigo);
      }
    },
    solid(p, x, y, tx, ty, { map }) {
      const topOpen = !isSolid(map, tx, ty - 1);
      p.rect(x, y, T, T, topOpen ? C.wood : C.dwood);
      const r = seeded(tx * 131 + ty * 17 + 1);
      for (let k = 0; k < 5; k++) p.px(x + Math.floor(r() * T), y + 4 + Math.floor(r() * 12), topOpen ? C.dwood : C.ink);
      if (topOpen) {
        p.rect(x, y, T, 4, C.dgreen); p.rect(x, y, T, 1, C.green);
        for (let i = 0; i < T; i++) { if ((i * 5 + tx) % 4 === 0) p.px(x + i, y - 1, C.green); if ((i * 3 + tx) % 5 < 2) p.px(x + i, y + 4, C.dgreen); }
        if ((tx * 7) % 5 === 0) { p.px(x + 4, y - 2, C.green); p.px(x + 5, y - 3, C.green); p.px(x + 3, y - 3, C.dgreen); }
      } else if (!isSolid(map, tx - 1, ty)) p.rect(x, y, 1, T, C.wood);
    },
    plank(p, x, y, l, r) {
      p.rect(x, y, T, 4, C.green); p.rect(x, y, T, 1, C.moon); p.rect(x, y + 3, T, 1, C.dgreen); p.rect(x, y + 4, T, 1, C.ink);
      p.rect(x + 7, y, 1, 4, C.dgreen);
      if (l) p.rect(x + 2, y + 5, 2, 6, C.dgreen);
      if (r) p.rect(x + 12, y + 5, 2, 6, C.dgreen);
    },
    crumble(g, x, y) {
      g.rect(x, y, T, 4, C.dgreen); g.rect(x, y, T, 1, C.green); g.rect(x, y + 4, T, 1, C.ink);
      g.px(x + 4, y + 1, C.ink); g.px(x + 5, y + 2, C.ink); g.px(x + 11, y + 1, C.ink); g.px(x + 12, y + 2, C.ink);
    },
    breakable(g, x, y, cracks) {
      g.rect(x, y, T, T, C.dwood); g.rect(x, y, T, 1, C.wood);
      for (let k = 0; k < 3; k++) g.rect(x + 2 + k * 5, y + 1, 2, T - 2, C.dgreen);
      if (cracks > 0) g.line(x + 2, y + 3, x + 12, y + 12, C.ink);
      if (cracks > 1) g.line(x + 13, y + 2, x + 4, y + 13, C.ink);
    },
    fg(g, camX, camY, time, { WW, H }) {
      // 最前景的竹子（視差 1.25）
      g.screenSpace();
      for (let x = 90; x < WW * 1.25 + 200; x += 260) {
        const sx = Math.round(x - camX * 1.25);
        if (sx < -10 || sx > 330) continue;
        g.rect(sx, 0, 6, H, C.ink); g.rect(sx + 1, 0, 1, H, C.night);
        for (let y = (x % 40); y < H; y += 34) g.rect(sx - 1, y, 8, 2, C.ink);
      }
    },
    ambient(parts, cam, dt, time, { W, H }) {
      if (Math.random() < dt / 0.35) parts.add({ x: cam.x + rand(0, W + 60), y: cam.y - 4, vx: rand(-18, -6), vy: rand(14, 24), life: 8, colors: [C.green, C.green, C.dgreen], shape: 'line', len: 0.08, petal: true });
      if (Math.random() < dt / 0.6) parts.add({ x: cam.x + rand(0, W), y: cam.y + rand(60, H), vx: rand(-6, 6), vy: rand(-8, -2), life: rand(2, 4), colors: [C.dgreen, C.green, C.white, C.green, C.dgreen], shape: 'px', drag: 0.2, glow: true });
    },
  },

  // ---------------- 本殿迴廊：室內木造、朱紅柱、紙拉門的月光 ----------------
  hall: {
    colors: { fly: [C.gold, C.orange, C.gold] },
    spike: [C.indigo, C.moon, C.white],
    sky(p, { W, H }) {
      gradient(p, W, H, [[0, C.ink, C.dwood], [0.6, C.dwood, C.dwood]]);
    },
    far(p, { farW, H }) {
      // 遠方的紙拉門（透出月光）
      for (let x = 0; x < farW; x += 48) {
        p.rect(x, 30, 44, 110, C.ink);
        p.rect(x + 2, 32, 40, 106, C.violet);
        p.dither(x + 2, 32, 40, 106, C.lav, 4);
        for (let k = 0; k < 4; k++) p.rect(x + 2 + k * 10, 32, 1, 106, C.ink);
        for (let k = 0; k < 7; k++) p.rect(x + 2, 32 + k * 15, 40, 1, C.ink);
        p.rect(x + 44, 20, 4, 140, C.dwood);
      }
      p.rect(0, 20, farW, 10, C.dwood); p.rect(0, 28, farW, 2, C.ink);
      p.rect(0, 140, farW, H - 140, C.dwood);
    },
    mid(p, { midW, H }) {
      // 朱紅柱與橫樑
      p.rect(0, 0, midW, 14, C.ink); p.rect(0, 14, midW, 4, C.red); p.rect(0, 18, midW, 1, C.ink);
      for (let x = 30; x < midW; x += 120) {
        p.rect(x, 18, 12, H + 40, C.red); p.rect(x, 18, 3, H + 40, C.orange); p.rect(x + 10, 18, 2, H + 40, C.wood);
        p.rect(x - 3, 18, 18, 4, C.gold); p.rect(x - 3, 21, 18, 1, C.ink);
      }
    },
    decor(p, { map }) {
      // 牆上的掛軸（只畫在有室內空間的位置）
      const r = seeded(5);
      for (let tx = 8; tx < map.MW - 4; tx += 24 + Math.floor(r() * 10)) {
        let ty = -1;
        for (let y = 2; y < map.MH - 4; y++) if (map.at(tx, y) === TILE.EMPTY && map.at(tx, y + 1) === TILE.EMPTY && map.at(tx, y + 2) === TILE.EMPTY && map.at(tx, y - 1) !== TILE.EMPTY) { ty = y; break; }
        if (ty < 0) continue;
        const x = tx * T + 2, y = ty * T + 4;
        p.rect(x, y, 12, 2, C.dwood); p.rect(x + 1, y + 2, 10, 26, C.moon); p.rect(x + 2, y + 3, 8, 24, C.white);
        p.rect(x + 5, y + 6, 2, 14, C.ink); p.rect(x + 3, y + 10, 6, 1, C.ink); p.rect(x + 3, y + 16, 6, 1, C.red);
        p.rect(x, y + 28, 12, 2, C.dwood);
      }
    },
    solid(p, x, y, tx, ty, { map }) {
      const topOpen = !isSolid(map, tx, ty - 1), botOpen = !isSolid(map, tx, ty + 1);
      p.rect(x, y, T, T, C.dwood);
      for (let k = 0; k < T; k += 4) p.rect(x, y + k, T, 1, C.ink);
      p.px(x + ((tx * 5) % 12) + 2, y + 2, C.wood); p.px(x + ((tx * 3 + ty) % 12) + 2, y + 10, C.wood);
      if (topOpen) { p.rect(x, y, T, 3, C.wood); p.rect(x, y, T, 1, C.gold); p.rect(x, y + 3, T, 1, C.ink); if (tx % 2 === 0) p.rect(x, y, 1, 3, C.dwood); }
      if (botOpen) { p.rect(x, y + T - 3, T, 3, C.red); p.rect(x, y + T - 1, T, 1, C.ink); }
      if (!isSolid(map, tx - 1, ty)) p.rect(x, y, 1, T, C.wood);
      if (!isSolid(map, tx + 1, ty)) p.rect(x + T - 1, y, 1, T, C.ink);
    },
    plank(p, x, y, l, r) { drawPlank(p, x, y, C.gold, C.red, C.wood, l, r); },
    crumble(g, x, y) {
      g.rect(x, y, T, 4, C.moon); g.rect(x, y, T, 1, C.white); g.rect(x, y + 4, T, 1, C.ink);
      for (let k = 2; k < T; k += 4) g.rect(x + k, y + 1, 1, 3, C.lav); // 紙糊的踏板
    },
    breakable(g, x, y, cracks) {
      g.rect(x, y, T, T, C.ink); g.rect(x + 1, y + 1, T - 2, T - 2, C.moon);
      for (let k = 0; k < 3; k++) g.rect(x + 1, y + 4 + k * 4, T - 2, 1, C.lav);
      g.rect(x + 8, y + 1, 1, T - 2, C.lav);
      if (cracks > 0) g.line(x + 3, y + 2, x + 10, y + 11, C.ink);
      if (cracks > 1) g.line(x + 12, y + 3, x + 5, y + 13, C.ink);
    },
    fg(g, camX, camY, time, { WW }) {
      g.screenSpace();
      // 前景垂掛的燈籠（視差 1.2，會輕輕搖晃）
      for (let x = 150; x < WW * 1.2 + 200; x += 310) {
        const sx = Math.round(x - camX * 1.2 + Math.sin(time * 1.3 + x) * 1.5);
        if (sx < -12 || sx > 332) continue;
        g.rect(sx + 4, 0, 1, 10, C.ink);
        g.rect(sx, 10, 9, 13, C.ink); g.rect(sx + 1, 11, 7, 11, C.orange); g.rect(sx + 1, 13, 7, 1, C.gold); g.rect(sx + 1, 18, 7, 1, C.gold); g.rect(sx + 3, 11, 3, 11, C.gold);
      }
    },
    ambient(parts, cam, dt, time, { W, H }) {
      if (Math.random() < dt / 0.25) parts.add({ x: cam.x + rand(0, W), y: cam.y + rand(20, H), vx: rand(-4, 4), vy: rand(-6, -1), life: rand(2, 4), colors: [C.wood, C.gold, C.wood], shape: 'px', drag: 0.3, glow: true });
    },
  },

  // ---------------- 地下祭壇：岩洞、發光苔蘚、水晶 ----------------
  altar: {
    colors: { fly: [C.green, C.dgreen, C.green] },
    spike: [C.violet, C.lav, C.white],
    sky(p, { W, H }) {
      gradient(p, W, H, [[0, C.ink, C.ink], [0.5, C.ink, C.night], [0.9, C.night, C.indigo]]);
    },
    far(p, { farW, H }) {
      const r = seeded(41);
      // 鐘乳石與遠方岩壁
      for (let x = 0; x < farW; x++) {
        const top = 20 + Math.sin(x * 0.05) * 10 + Math.sin(x * 0.13) * 6;
        p.rect(x, 0, 1, top, C.night);
        const bot = H - 30 - Math.sin(x * 0.03 + 2) * 14;
        p.rect(x, bot, 1, H - bot, C.night);
      }
      for (let k = 0; k < farW / 14; k++) { const x = r() * farW, l = 8 + r() * 26; for (let i = 0; i < l; i++) p.rect(x - (l - i) / 8, 20 + i, Math.max(1, (l - i) / 4), 1, C.night); }
      for (let k = 0; k < 40; k++) p.px(r() * farW, 30 + r() * 100, r() < 0.5 ? C.dgreen : C.indigo);
    },
    mid(p, { midW, H }) {
      const r = seeded(51);
      for (let x = 40; x < midW; x += 110 + Math.floor(r() * 60)) {
        p.rect(x, 30, 16, H + 10, C.indigo); p.rect(x + 2, 30, 2, H + 10, C.violet);
        for (let y = 50; y < H; y += 24) { p.rect(x + 6, y, 4, 1, C.green); p.rect(x + 7, y + 1, 2, 3, C.green); p.px(x + 7, y + 5, C.dgreen); }
        p.rect(x - 3, 28, 22, 4, C.violet);
      }
      // 沉在水中的小鳥居
      for (let x = 100; x < midW; x += 260) { p.rect(x, 120, 3, 40, C.night); p.rect(x + 30, 120, 3, 40, C.night); p.rect(x - 6, 118, 45, 3, C.night); p.rect(x - 2, 126, 37, 2, C.night); }
      p.rect(0, 160, midW, H + 40 - 160, C.night);
      for (let x = 0; x < midW; x += 3) if ((x * 7) % 11 < 4) p.px(x, 162, C.indigo);
    },
    solid(p, x, y, tx, ty, { map }) {
      const topOpen = !isSolid(map, tx, ty - 1), botOpen = !isSolid(map, tx, ty + 1);
      p.rect(x, y, T, T, C.night);
      p.dither(x, y, T, T, C.indigo, 3);
      const r = seeded(tx * 97 + ty * 31 + 3);
      // 岩層紋理：斜向裂紋與亮點
      const ox = Math.floor(r() * 8);
      p.line(x + ox, y + 4 + Math.floor(r() * 3), x + ox + 5, y + 7 + Math.floor(r() * 3), C.ink);
      for (let k = 0; k < 3; k++) { const px = x + Math.floor(r() * 14), py = y + Math.floor(r() * 14); p.rect(px, py, 2, 1, C.violet); }
      if (topOpen) { p.rect(x, y, T, 2, C.violet); p.rect(x, y, T, 1, C.lav); for (let i = 0; i < T; i++) if ((i * 5 + tx * 3) % 7 < 2) p.px(x + i, y + 2, C.dgreen); if ((tx * 5) % 7 === 0) { p.px(x + 6, y - 1, C.green); p.px(x + 7, y - 1, C.dgreen); } }
      if (botOpen) { p.rect(x, y + T - 1, T, 1, C.indigo); if ((tx * 3) % 5 === 0) { p.rect(x + 7, y + T, 2, 2, C.night); p.px(x + 7, y + T + 2, C.night); } }
      if (!isSolid(map, tx - 1, ty)) p.rect(x, y, 1, T, C.indigo);
      if (!isSolid(map, tx + 1, ty)) p.rect(x + T - 1, y, 1, T, C.ink);
    },
    plank(p, x, y, l, r) {
      p.rect(x, y, T, 5, C.indigo); p.rect(x, y, T, 1, C.lav); p.rect(x, y + 4, T, 1, C.ink);
      p.px(x + 4, y + 2, C.night); p.px(x + 11, y + 3, C.night);
      if (l) { p.rect(x, y + 5, 4, 3, C.indigo); p.rect(x, y + 8, 2, 2, C.night); }
      if (r) { p.rect(x + 12, y + 5, 4, 3, C.indigo); p.rect(x + 14, y + 8, 2, 2, C.night); }
    },
    crumble(g, x, y) {
      g.rect(x, y, T, 5, C.violet); g.rect(x, y, T, 1, C.lav); g.rect(x, y + 5, T, 1, C.ink);
      g.px(x + 4, y + 1, C.ink); g.px(x + 5, y + 2, C.ink); g.px(x + 5, y + 3, C.ink); g.px(x + 11, y + 2, C.ink); g.px(x + 12, y + 3, C.ink);
    },
    breakable(g, x, y, cracks) {
      g.rect(x, y, T, T, C.indigo); g.rect(x, y, T, 1, C.violet);
      g.rect(x + 3, y + 3, 10, 10, C.violet); g.rect(x + 5, y + 5, 6, 6, C.green); g.rect(x + 6, y + 6, 4, 4, C.dgreen); // 封印符文
      if (cracks > 0) g.line(x + 2, y + 2, x + 13, y + 13, C.ink);
      if (cracks > 1) g.line(x + 13, y + 2, x + 2, y + 13, C.ink);
    },
    ambient(parts, cam, dt, time, { W, H }) {
      if (Math.random() < dt / 0.3) parts.add({ x: cam.x + rand(0, W), y: cam.y + H + 4, vx: rand(-4, 4), vy: rand(-22, -10), life: rand(3, 6), colors: [C.dgreen, C.green, C.white, C.green, C.dgreen], shape: 'px', drag: 0.1, glow: true });
      if (Math.random() < dt / 1.2) parts.add({ x: cam.x + rand(0, W), y: cam.y + rand(0, 20), vx: 0, vy: 40, ay: 300, life: 1.2, colors: [C.moon, C.lav], shape: 'px' });
    },
  },
};

function torii(p, cx, base, s) {
  const pillarH = 70 * s, span = 64 * s;
  p.rect(cx - span / 2 - 3, base - pillarH, 6 * s, pillarH, C.red);
  p.rect(cx + span / 2 - 3, base - pillarH, 6 * s, pillarH, C.red);
  p.rect(cx - span / 2 - 3, base - pillarH, 2, pillarH, C.wood);
  p.rect(cx + span / 2 - 3, base - pillarH, 2, pillarH, C.wood);
  p.rect(cx - span / 2 - 12, base - pillarH + 12, span + 24, 5, C.red);
  p.rect(cx - span / 2 - 18, base - pillarH - 2, span + 36, 6, C.ink);
  p.rect(cx - span / 2 - 16, base - pillarH - 1, span + 32, 4, C.red);
  p.rect(cx - span / 2 - 20, base - pillarH - 4, span + 40, 2, C.ink);
  p.rect(cx - 5, base - pillarH + 2, 10, 10, C.ink); p.rect(cx - 4, base - pillarH + 3, 8, 8, C.gold);
}
function sakura(p, cx, base, r) {
  p.rect(cx - 1, base - 34, 3, 34, C.dwood); p.line(cx, base - 22, cx - 9, base - 34, C.dwood, 2); p.line(cx + 1, base - 26, cx + 10, base - 38, C.dwood, 2);
  for (let k = 0; k < 16; k++) {
    const a = r() * TAU, d = r() * 16;
    p.circle(cx + Math.cos(a) * d, base - 40 + Math.sin(a) * d * 0.6, 4 + r() * 3, r() < 0.3 ? C.pink : C.pink);
  }
  for (let k = 0; k < 26; k++) { const a = r() * TAU, d = r() * 20; p.px(cx + Math.cos(a) * d, base - 40 + Math.sin(a) * d * 0.6, r() < 0.5 ? C.white : C.red); }
}

/** 月蝕的天空（最終戰用，phase2 變紅） */
export function eclipseSky(W, H, red) {
  return makeLayer(W, H, PALETTE, p => {
    gradient(p, W, H, [[0, C.ink, C.night], [0.6, C.night, red ? C.dwood : C.indigo]]);
    stars(p, W, H * 0.6, 60, 77);
    const mx = W / 2, my = 48, r = 26;
    for (let y = -r - 12; y <= r + 12; y++) for (let x = -r - 12; x <= r + 12; x++) { const d = Math.hypot(x, y); if (d > r && d < r + 12 && ((x + y) & 1) === 0 && d < r + 4 + 8 * (1 - Math.abs(Math.sin(Math.atan2(y, x) * 5)) * 0.5)) p.px(mx + x, my + y, red ? C.red : C.violet); }
    p.circle(mx, my, r, red ? C.red : C.moon);
    p.circle(mx, my, r - 2, red ? C.orange : C.white);
    p.circle(mx + 8, my - 3, r - 3, C.ink);
    p.ring(mx + 8, my - 3, r - 3, red ? C.red : C.lav);
  });
}

/** 標題與地圖用的夜空背景（月亮、星星、遠山） */
export function nightBackdrop(W, H, o = {}) {
  return makeLayer(W, H, PALETTE, p => {
    gradient(p, W, H, [[0, C.ink, C.night], [0.45, C.night, C.indigo], [0.85, C.indigo, C.violet]]);
    stars(p, W, H * 0.75, 110, o.seed || 7);
    moon(p, o.moonX ?? 250, o.moonY ?? 42, o.moonR ?? 24);
    for (let x = 0; x < W; x++) {
      const h = 58 + Math.sin(x * 0.024 + 1) * 16 + Math.sin(x * 0.061) * 8;
      const top = Math.round(H - h);
      p.rect(x, top, 1, H - top, C.indigo); p.px(x, top, C.violet);
    }
    for (let x = 0; x < W; x++) {
      const h = 30 + Math.sin(x * 0.037 + 3) * 10 + Math.sin(x * 0.11) * 4;
      const top = Math.round(H - h);
      p.rect(x, top, 1, H - top, C.night);
    }
    for (let y = H - 40; y < H; y++) p.dither(0, y, W, 1, C.violet, Math.round((y - (H - 40)) / 40 * 4));
  });
}
