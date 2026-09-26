// 手感特效：粒子、畫面震動、鏡頭、浮動文字，以及常用數學工具。
import { TAU } from './pixel.js';

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const sign = v => v > 0 ? 1 : v < 0 ? -1 : 0;
/** 以固定加速度把 v 推向 target（不會超過） */
export const approach = (v, target, amount) => v < target ? Math.min(v + amount, target) : Math.max(v - amount, target);
/** 與幀率無關的指數平滑係數 */
export const smoothK = (dt, halfLife) => halfLife <= 0 ? 1 : 1 - Math.pow(0.5, dt / halfLife);
export const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
export const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/**
 * 粒子。每個粒子的 colors 是調色盤索引陣列，依壽命由前往後切換（用色階代替半透明淡出）。
 * shape：'px' 單點、'sq' 方塊（可縮小）、'ring' 擴散圓環、'star' 十字星、'line' 速度線
 */
export class Particles {
  constructor(max = 700) { this.list = []; this.max = max; }
  add(p) {
    if (this.list.length >= this.max) this.list.shift();
    p.age = 0;
    p.life = p.life || 0.5;
    p.vx = p.vx || 0; p.vy = p.vy || 0;
    p.shape = p.shape || 'px';
    this.list.push(p);
    return p;
  }
  /** 放射狀噴發：dir 方向、spread 角度範圍、speed [min,max] */
  burst(x, y, n, o) {
    for (let i = 0; i < n; i++) {
      const a = (o.dir ?? 0) + (Math.random() - 0.5) * (o.spread ?? TAU);
      const s = rand(o.speed?.[0] ?? 20, o.speed?.[1] ?? 80);
      this.add({
        x: x + rand(-(o.jitter || 0), o.jitter || 0), y: y + rand(-(o.jitter || 0), o.jitter || 0),
        vx: Math.cos(a) * s, vy: Math.sin(a) * s, ay: o.gravity || 0, drag: o.drag ?? 3,
        life: rand(o.life?.[0] ?? 0.3, o.life?.[1] ?? 0.6), colors: o.colors, shape: o.shape || 'px',
        size: o.size || 1, shrink: o.shrink ?? 1, len: o.len, r0: o.r0, r1: o.r1, z: o.z,
      });
    }
  }
  update(dt) {
    for (const p of this.list) {
      p.age += dt;
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
      p.vx += (p.ax || 0) * dt; p.vy += (p.ay || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    if (this.list.length) this.list = this.list.filter(p => p.age < p.life);
  }
  draw(g, filter) {
    for (const p of this.list) {
      if (filter && !filter(p)) continue;
      const t = p.age / p.life;
      const c = p.colors[Math.min(p.colors.length - 1, Math.floor(t * p.colors.length))];
      switch (p.shape) {
        case 'sq': {
          const s = Math.max(1, Math.round(p.size * (1 - t * p.shrink)));
          g.rect(p.x - s / 2, p.y - s / 2, s, s, c); break;
        }
        case 'ring': g.ring(p.x, p.y, (p.r0 ?? 1) + ((p.r1 ?? 10) - (p.r0 ?? 1)) * Math.sqrt(t), c); break;
        case 'star': {
          const s = Math.max(1, Math.round(p.size * (1 - t)));
          g.rect(p.x - s, p.y, s * 2 + 1, 1, c); g.rect(p.x, p.y - s, 1, s * 2 + 1, c); break;
        }
        case 'line': {
          const L = p.len || 0.03;
          g.line(p.x, p.y, p.x - p.vx * L, p.y - p.vy * L, c); break;
        }
        default: g.px(p.x, p.y, c);
      }
    }
  }
  clear() { this.list.length = 0; }
}

/** 畫面震動：振幅（像素）＋持續時間（毫秒），可指定方向（沿打擊方向震動更有力） */
export class Shaker {
  constructor() { this.amp = 0; this.dur = 0; this.t = 0; this.dx = 0; this.dy = 0; this.x = 0; this.y = 0; this.flip = 1; }
  add(amp, ms, dx = 0, dy = 0) {
    if (amp <= 0 || ms <= 0) return;
    const cur = this.t < this.dur ? this.amp * (1 - this.t / this.dur) : 0;
    if (amp >= cur) { this.amp = amp; this.dur = ms / 1000; this.t = 0; this.dx = dx; this.dy = dy; }
  }
  update(dt) {
    if (this.t >= this.dur) { this.x = this.y = 0; return; }
    this.t += dt;
    const a = this.amp * Math.max(0, 1 - this.t / this.dur);
    this.flip = -this.flip;
    const m = Math.hypot(this.dx, this.dy);
    if (m > 0) {
      this.x = Math.round(this.flip * a * this.dx / m + (Math.random() - 0.5) * a * 0.6);
      this.y = Math.round(this.flip * a * this.dy / m + (Math.random() - 0.5) * a * 0.6);
    } else {
      this.x = Math.round((Math.random() * 2 - 1) * a);
      this.y = Math.round((Math.random() * 2 - 1) * a);
    }
  }
  reset() { this.t = this.dur = 0; this.x = this.y = 0; }
}

/** 鏡頭：跟隨目標（死區＋平滑＋前瞻），可限制在世界邊界內 */
export class Camera {
  constructor(vw, vh) { this.x = 0; this.y = 0; this.vw = vw; this.vh = vh; this.bounds = null; }
  center(x, y) { this.x = x - this.vw / 2; this.y = y - this.vh / 2; this.clamp(); }
  follow(tx, ty, dt, o = {}) {
    const cx = this.x + this.vw / 2, cy = this.y + this.vh / 2;
    const dzx = o.deadX || 0, dzy = o.deadY || 0;
    let gx = cx, gy = cy;
    if (tx > cx + dzx) gx = tx - dzx; else if (tx < cx - dzx) gx = tx + dzx;
    if (ty > cy + dzy) gy = ty - dzy; else if (ty < cy - dzy) gy = ty + dzy;
    const kx = smoothK(dt, o.smoothX ?? o.smooth ?? 0.08), ky = smoothK(dt, o.smoothY ?? o.smooth ?? 0.08);
    this.x += (gx - cx) * kx; this.y += (gy - cy) * ky;
    this.clamp();
  }
  clamp() {
    const b = this.bounds;
    if (!b) return;
    this.x = b.w <= this.vw ? (b.w - this.vw) / 2 : clamp(this.x, 0, b.w - this.vw);
    this.y = b.h <= this.vh ? (b.h - this.vh) / 2 : clamp(this.y, 0, b.h - this.vh);
  }
}

/** 浮動文字（傷害數字、連段評價） */
export class Floaters {
  constructor() { this.list = []; }
  add(x, y, text, color, o = {}) {
    this.list.push({ x, y, text: String(text), color, outline: o.outline ?? 0, small: o.small ?? true, vy: o.vy ?? -38, life: o.life ?? 0.6, age: 0, pop: o.pop ?? true });
  }
  update(dt) {
    for (const f of this.list) { f.age += dt; f.y += f.vy * dt; f.vy *= Math.exp(-4 * dt); }
    if (this.list.length) this.list = this.list.filter(f => f.age < f.life);
  }
  draw(g) {
    for (const f of this.list) {
      // 前 60ms 往上彈一下
      const dy = f.pop && f.age < 0.06 ? -2 : 0;
      if (f.age > f.life * 0.75 && Math.floor(f.age * 30) % 2) continue; // 結束前閃爍
      g.text(f.text, f.x, f.y + dy, f.color, { small: f.small, align: 'center', outline: f.outline });
    }
  }
}
