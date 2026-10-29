import { BAYER, rng } from './bitmap';
import { LANTERNS, SEA_TOP, TRAIN_WINDOWS, type BgArt } from './backgrounds';
import { PALETTE } from './palette';

// 每一幀畫的動態效果：車窗外風景、雨、海面反光、燈籠、煙火。

const W = 320;
const H = 180;

const RAIN = (() => {
  const r = rng(99);
  return Array.from({ length: 140 }, () => ({ x: r() * W, y: r() * H, s: 0.7 + r() * 0.6, c: r() < 0.3 ? 21 : 5 }));
})();

export function drawScenery(ctx: CanvasRenderingContext2D, art: BgArt, t: number) {
  if (!art.scenery) return;
  const speeds = [0, 4, 28, 170];
  ctx.save();
  ctx.beginPath();
  for (const [x, y, w, h] of TRAIN_WINDOWS) ctx.rect(x, y, w, h);
  ctx.clip();
  art.scenery.forEach((layer, i) => {
    const off = Math.floor((t / 1000) * speeds[i]) % 640;
    for (const [x, y] of TRAIN_WINDOWS) {
      // 每扇窗看到的是同一條風景的不同段落
      const base = Math.floor(off + x * 1.4) % 640;
      ctx.drawImage(layer, -base + x, y);
      ctx.drawImage(layer, -base + x + 640, y);
    }
  });
  ctx.restore();
}

export function drawRain(ctx: CanvasRenderingContext2D, t: number) {
  const k = t / 1000;
  for (const d of RAIN) {
    const y = (d.y + k * 260 * d.s) % (H + 8) - 8;
    const x = (d.x - k * 50 * d.s + W * 4) % W;
    ctx.fillStyle = PALETTE[d.c];
    ctx.fillRect(Math.floor(x), Math.floor(y), 1, 4);
    ctx.fillRect(Math.floor(x) - 1, Math.floor(y) + 4, 1, 2);
    if (y > 150 && ((d.x * 7) | 0) % 5 === 0) {
      ctx.fillRect(Math.floor(x) - 2, 176 - ((d.x | 0) % 20), 1, 1);
      ctx.fillRect(Math.floor(x) + 2, 176 - ((d.x | 0) % 20), 1, 1);
    }
  }
}

export function drawSeaSparkle(ctx: CanvasRenderingContext2D, time: string, t: number) {
  const r = rng(Math.floor(t / 180) + 7);
  ctx.fillStyle = PALETTE[time === 'night' ? 4 : time === 'dusk' ? 14 : 6];
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(r() * W);
    const yMax = 102 + x * 0.087;
    const y = Math.floor(SEA_TOP + 2 + r() * (yMax - SEA_TOP - 2));
    ctx.fillRect(x, y, 2 + Math.floor(r() * 3), 1);
  }
}

export function drawLanterns(ctx: CanvasRenderingContext2D, t: number) {
  const r = rng(Math.floor(t / 140) + 3);
  for (const [x, y] of LANTERNS) {
    if (r() < 0.35) {
      ctx.fillStyle = PALETTE[13];
      ctx.fillRect(x - 1, y + 3, 3, 3);
      ctx.fillStyle = PALETTE[14];
      ctx.fillRect(x, y + 4, 1, 1);
    }
  }
}

export function drawFireworks(ctx: CanvasRenderingContext2D, t: number) {
  const period = 1600;
  for (let k = 0; k < 2; k++) {
    const tt = t + k * 800;
    const n = Math.floor(tt / period);
    const p = (tt % period) / period;
    const r = rng(n * 13 + k + 1);
    const cx = 40 + r() * 240;
    const cy = 20 + r() * 40;
    const colors = [14, 28, 21, 31, 15];
    const c = colors[Math.floor(r() * colors.length)];
    const rad = p * 26;
    if (p > 0.85) continue;
    ctx.fillStyle = PALETTE[p > 0.6 ? 13 : c];
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(ang) * rad), Math.round(cy + Math.sin(ang) * rad + p * p * 8), 1, 1);
    }
  }
}

// 抖色溶接用的 4×4 圖樣（level 0–16）
const patterns: CanvasPattern[] = [];
export function ditherPattern(ctx: CanvasRenderingContext2D, level: number): CanvasPattern {
  if (!patterns.length) {
    for (let l = 0; l <= 16; l++) {
      const c = document.createElement('canvas');
      c.width = c.height = 4;
      const x = c.getContext('2d')!;
      x.fillStyle = '#000';
      for (let i = 0; i < 16; i++) if (BAYER[i] >= l) x.fillRect(i & 3, i >> 2, 1, 1);
      patterns.push(ctx.createPattern(c, 'repeat')!);
    }
  }
  return patterns[Math.max(0, Math.min(16, level))];
}
