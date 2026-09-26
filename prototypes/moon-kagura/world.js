// 《月下神樂》遊戲世界：玩家、妖怪、守護妖、機關與收集品。
// 由 main.js 建立；main 負責場景切換（標題、地圖、選單），這裡只負責「一關裡面」發生的事。
import { TAU } from '../engine/pixel.js';
import { Particles, Shaker, Camera, Floaters, clamp, approach, rand, sign, smoothK, lerp, pick } from '../engine/fx.js';
import { RIG } from './sprites.js';
import { TILE, STAGES, parseStage } from './levels.js';
import { buildTheme, eclipseSky, C } from './themes.js';

export const T = 16;
const W = 320, H = 180;

// ---------------- 攻擊定義（角度以「面向右」為準：0＝正前方，負值＝往上） ----------------
const ATTACKS = {
  g1: { a0: -2.0, a1: 0.75, reach: 1, dmg: 1, next: 'g2', swing: 0 },
  g2: { a0: 1.05, a1: -1.85, reach: 1, dmg: 1, next: 'g3', swing: 1 },
  g3: { a0: -2.9, a1: 1.3, reach: 1.3, dmg: 2, finisher: true, extra: [1, 1, 4], swing: 2 },
  air: { a0: -1.9, a1: 1.05, reach: 1, dmg: 1, swing: 0 },
  up: { a0: 0.45, a1: -2.95, reach: 1.05, dmg: 1, swing: 1, dir: 'up' },
  down: { a0: 0.15, a1: 2.95, reach: 1.05, dmg: 1, swing: 1, dir: 'down' },
};
const REST = { idle: [1.15, -1.3], run: [0.55, -2.45], jump: [-0.4, -1.9], fall: [-1.2, -2.3], dash: [2.6, 3.0], hurt: [-2.2, -2.6], wall: [-2.4, -2.0], heal: [-1.4, -1.55] };
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const worldAng = (local, face) => face > 0 ? local : Math.PI - local;
const easeOut = t => 1 - (1 - t) * (1 - t);

// 妖怪基本資料：w/h 判定大小、hp、weight 擊退重量、coins 掉落錢幣、fly 飛行（以中心為座標）
const ED = {
  dummy: { w: 12, h: 24, hp: Infinity, weight: 99, coins: 0, harmless: true },
  lantern: { w: 12, h: 14, hp: 3, weight: 0.8, coins: 2, fly: true },
  umbrella: { w: 10, h: 18, hp: 4, weight: 1, coins: 2 },
  fox: { w: 14, h: 16, hp: 5, weight: 99, coins: 3 },
  weasel: { w: 16, h: 10, hp: 3, weight: 0.9, coins: 3 },
  tanuki: { w: 12, h: 16, hp: 4, weight: 1.1, coins: 3 },
  noh: { w: 12, h: 16, hp: 4, weight: 0.8, coins: 4, fly: true },
  momen: { w: 14, h: 9, hp: 3, weight: 0.7, coins: 3, fly: true },
  spider: { w: 12, h: 9, hp: 3, weight: 0.8, coins: 3 },
  onibi: { w: 10, h: 10, hp: 2, weight: 0.6, coins: 2, fly: true },
  bossLantern: { w: 34, h: 38, hp: 40, weight: 99, coins: 30, fly: true, boss: true },
  bossWeasel: { w: 28, h: 15, hp: 48, weight: 99, coins: 40, boss: true },
  bossFox: { w: 24, h: 26, hp: 56, weight: 99, coins: 50, boss: true },
  foxClone: { w: 24, h: 26, hp: 1, weight: 99, coins: 0, fly: false },
  bossSerpent: { w: 20, h: 16, hp: 72, weight: 99, coins: 60, fly: true, boss: true },
};
const CH_TYPE = { k: 'dummy', l: 'lantern', u: 'umbrella', f: 'fox', w: 'weasel', t: 'tanuki', n: 'noh', m: 'momen', s: 'spider', p: 'onibi' };
const BOSS_TYPE = { lantern: 'bossLantern', kamaitachi: 'bossWeasel', whitefox: 'bossFox', serpent: 'bossSerpent' };

export function createWorld(env) {
  const { g, input, sound, P, S, hooks } = env;
  const parts = new Particles(1200), floats = new Floaters(), shake = new Shaker(), cam = new Camera(W, H);
  let st, stageIndex, map, theme, WW, WH, eclipse = null;
  let pl, enemies, shots, pshots, pickups, props, movers, crumbles, breaks, bursts;
  let hitstop, combo, comboT, lastHit, time, stageTime, checkpoint, arena, boss, deaths, coinsGot, toasts, fade, bannerT, finale, hudOff = false;
  let charmMod = null, frozen = false;

  // ---------------- 音效 ----------------
  const sfx = {
    swing(step) { if (!sound.throttle('swing', 0.05)) return; sound.noise({ dur: 0.13, vol: 0.13, filter: 'bandpass', f0: 1400 + step * 350, f1: 500 + step * 150, q: 1.2 }); },
    hit(n, fin) {
      const semi = P.bellScale ? PENTA[Math.min(n, PENTA.length - 1)] : 0;
      const f = 523.25 * Math.pow(2, semi / 12);
      sound.bell({ f, dur: fin ? 1.2 : 0.7, vol: fin ? 0.2 : 0.15 });
      if (fin) { sound.bell({ f: f * 1.5, dur: 1.2, vol: 0.1, delay: 0.02 }); sound.tone({ type: 'sine', f0: 150, f1: 45, dur: 0.3, vol: 0.35 }); }
      sound.noise({ dur: 0.05, vol: 0.18, filter: 'highpass', f0: 2500, q: 0.7 });
    },
    clink() { if (!sound.throttle('clink', 0.05)) return; sound.tone({ type: 'square', f0: 1800, f1: 1400, dur: 0.05, vol: 0.06 }); sound.noise({ dur: 0.04, vol: 0.1, filter: 'highpass', f0: 4000 }); },
    jump(air) { sound.tone({ type: air ? 'triangle' : 'sine', f0: air ? 520 : 260, f1: air ? 1100 : 560, dur: 0.09, vol: 0.08 }); if (air) sound.bell({ f: 1568, dur: 0.4, vol: 0.05 }); },
    land(v) { if (!sound.throttle('land', 0.08)) return; sound.noise({ dur: 0.07, vol: clamp(v / 900, 0.03, 0.2), filter: 'lowpass', f0: 900, f1: 200 }); },
    step() { if (!sound.throttle('step', 0.1)) return; sound.noise({ dur: 0.025, vol: 0.035, filter: 'lowpass', f0: 1400, f1: 600 }); },
    dash() { sound.noise({ dur: 0.18, vol: 0.14, filter: 'bandpass', f0: 2600, f1: 700, q: 0.8 }); },
    die(kind) { sound.bell({ f: kind === 'lantern' ? 880 : 740, dur: 0.6, vol: 0.12, delay: 0.05 }); sound.bell({ f: kind === 'lantern' ? 659 : 554, dur: 0.8, vol: 0.1, delay: 0.14 }); sound.noise({ dur: 0.3, vol: 0.2, filter: 'lowpass', f0: 1800, f1: 120 }); },
    hurt() { sound.tone({ type: 'square', f0: 420, f1: 110, dur: 0.25, vol: 0.14 }); sound.noise({ dur: 0.2, vol: 0.2, filter: 'lowpass', f0: 2200, f1: 200 }); },
    pogo() { sound.tone({ type: 'square', f0: 330, f1: 880, dur: 0.1, vol: 0.07 }); },
    coin() { if (!sound.throttle('coin', 0.04)) return; sound.tone({ type: 'pulse25', f0: 1976, dur: 0.04, vol: 0.045 }); sound.tone({ type: 'pulse25', f0: 2637, dur: 0.09, vol: 0.045, delay: 0.04 }); },
    bellGet() { [0, 4, 7, 12].forEach((s, i) => sound.bell({ f: 784 * Math.pow(2, s / 12), dur: 1.1, vol: 0.12, delay: i * 0.09 })); },
    toro() { sound.bell({ f: 587, dur: 1.4, vol: 0.13 }); sound.bell({ f: 880, dur: 1.4, vol: 0.09, delay: 0.12 }); sound.noise({ dur: 0.4, vol: 0.08, filter: 'bandpass', f0: 600, f1: 1400 }); },
    drum() { sound.tone({ type: 'sine', f0: 120, f1: 55, dur: 0.3, vol: 0.4 }); sound.noise({ dur: 0.08, vol: 0.15, filter: 'lowpass', f0: 700 }); },
    chime() { if (!sound.throttle('chime', 0.06)) return; sound.bell({ f: 2093, dur: 0.9, vol: 0.09, bright: 1.4 }); sound.bell({ f: 3136, dur: 0.6, vol: 0.05, delay: 0.03 }); },
    brk() { sound.noise({ dur: 0.25, vol: 0.25, filter: 'lowpass', f0: 1600, f1: 150 }); sound.tone({ type: 'square', f0: 200, f1: 60, dur: 0.15, vol: 0.08 }); },
    crumble() { if (!sound.throttle('crumble', 0.1)) return; sound.noise({ dur: 0.2, vol: 0.12, filter: 'lowpass', f0: 900, f1: 200 }); },
    burst() { [523, 659, 784, 1047].forEach((f, i) => sound.bell({ f, dur: 1.2, vol: 0.1, delay: i * 0.03 })); sound.noise({ dur: 0.4, vol: 0.18, filter: 'bandpass', f0: 3000, f1: 600, q: 0.7 }); },
    heal() { [784, 988, 1175, 1568].forEach((f, i) => sound.bell({ f, dur: 0.8, vol: 0.08, delay: i * 0.07 })); },
    fizzle() { sound.tone({ type: 'triangle', f0: 300, f1: 150, dur: 0.12, vol: 0.06 }); },
    shoot() { if (!sound.throttle('shoot', 0.08)) return; sound.noise({ dur: 0.15, vol: 0.1, filter: 'bandpass', f0: 1200, f1: 400, q: 1.2 }); sound.tone({ type: 'triangle', f0: 400, f1: 200, dur: 0.12, vol: 0.05 }); },
    roar() { sound.tone({ type: 'sawtooth', f0: 110, f1: 70, dur: 0.8, vol: 0.12 }); sound.noise({ dur: 0.8, vol: 0.2, filter: 'lowpass', f0: 800, f1: 200 }); },
    slam() { sound.tone({ type: 'sine', f0: 90, f1: 30, dur: 0.5, vol: 0.5 }); sound.noise({ dur: 0.4, vol: 0.3, filter: 'lowpass', f0: 1200, f1: 80 }); },
    chest() { [523, 659, 784, 1047, 1319].forEach((f, i) => sound.tone({ type: 'pulse25', f0: f, dur: 0.14, vol: 0.06, delay: i * 0.07 })); },
    death() { sound.tone({ type: 'square', f0: 600, f1: 80, dur: 0.9, vol: 0.12 }); sound.bell({ f: 440, dur: 1.6, vol: 0.12, delay: 0.3 }); },
    telegraph() { if (!sound.throttle('tele', 0.2)) return; sound.tone({ type: 'triangle', f0: 880, f1: 1320, dur: 0.12, vol: 0.05 }); },
  };

  // ---------------- 地圖查詢與碰撞 ----------------
  const tileAt = (tx, ty) => map.at(tx, ty);
  const tileIdx = (tx, ty) => ty * map.MW + tx;
  function isSolidT(tx, ty) { const t = tileAt(tx, ty); return t === TILE.SOLID || t === TILE.BREAK || t === TILE.DRUM; }
  function isOneWayT(tx, ty) {
    const t = tileAt(tx, ty);
    if (t === TILE.ONEWAY) return true;
    if (t === TILE.CRUMBLE) { const c = crumbles.get(tileIdx(tx, ty)); return !(c && c.broken > 0); }
    return false;
  }
  function moveX(e, dx) {
    e.x += dx;
    const top = e.y - e.h + 0.01, bot = e.y - 0.01;
    const edge = dx > 0 ? e.x + e.w / 2 : e.x - e.w / 2;
    const tx = Math.floor(edge / T);
    for (let ty = Math.floor(top / T); ty <= Math.floor(bot / T); ty++) {
      if (isSolidT(tx, ty)) { e.x = dx > 0 ? tx * T - e.w / 2 - 0.001 : (tx + 1) * T + e.w / 2 + 0.001; return true; }
    }
    return false;
  }
  /** 回傳 1＝落地、2＝落在太鼓上、-1＝撞到天花板、0＝沒碰到 */
  function moveY(e, dy) {
    const prevBot = e.y;
    e.y += dy;
    const l = Math.floor((e.x - e.w / 2 + 0.01) / T), r = Math.floor((e.x + e.w / 2 - 0.01) / T);
    if (dy > 0) {
      const ty = Math.floor(e.y / T);
      if (ty * T < prevBot - 0.02) return 0; // 已經在這格裡面（例如從下方穿過單向木板）
      let hit = 0;
      for (let tx = l; tx <= r; tx++) {
        if (isSolidT(tx, ty)) hit = Math.max(hit, tileAt(tx, ty) === TILE.DRUM ? 2 : 1);
        else if (isOneWayT(tx, ty) && prevBot <= ty * T + 0.01 && !(e.dropT > 0)) hit = Math.max(hit, 1);
      }
      if (hit) { e.y = ty * T; return hit; }
    } else if (dy < 0) {
      const ty = Math.floor((e.y - e.h) / T);
      for (let tx = l; tx <= r; tx++) if (isSolidT(tx, ty)) { e.y = (ty + 1) * T + e.h; return -1; }
    }
    return 0;
  }
  function groundBelow(e) {
    const l = Math.floor((e.x - e.w / 2 + 0.01) / T), r = Math.floor((e.x + e.w / 2 - 0.01) / T);
    const ty = Math.floor((e.y + 0.5) / T);
    if (Math.abs(e.y - ty * T) > 0.02) return false;
    for (let tx = l; tx <= r; tx++) if (isSolidT(tx, ty) || (isOneWayT(tx, ty) && !(e.dropT > 0))) return true;
    return false;
  }
  /** 從 (tx, ty) 往下找第一個能站的地方，回傳像素 y */
  function groundY(tx, ty) {
    for (let y = ty; y < map.MH; y++) if (isSolidT(tx, y) || isOneWayT(tx, y)) return y * T;
    return (ty + 1) * T;
  }
  function edgeAhead(e, dir) {
    const x = e.x + dir * (e.w / 2 + 2), ty = Math.floor((e.y + 1) / T), tx = Math.floor(x / T);
    return !(isSolidT(tx, ty) || isOneWayT(tx, ty)) || isSolidT(tx, Math.floor((e.y - 4) / T));
  }
  function standingOnOneWay() {
    const l = Math.floor((pl.x - pl.w / 2 + 0.01) / T), r = Math.floor((pl.x + pl.w / 2 - 0.01) / T), ty = Math.floor((pl.y + 0.5) / T);
    let any = !!pl.onPlat;
    for (let tx = l; tx <= r; tx++) { if (isSolidT(tx, ty)) return false; if (isOneWayT(tx, ty)) any = true; }
    return any;
  }
  function touchingWall() {
    for (const side of [-1, 1]) {
      const tx = Math.floor((pl.x + side * (pl.w / 2 + 1.5)) / T);
      for (let y = pl.y - pl.h + 3; y <= pl.y - 3; y += 6) if (isSolidT(tx, Math.floor(y / T))) return side;
    }
    return 0;
  }

  // ---------------- 能力與御守 ----------------
  const abil = id => env.unlocked(id);
  const airJumpsMax = () => abil('airjump') ? P.airJumps : 0;
  function computeMods() {
    const has = id => env.equipped(id);
    charmMod = {
      reach: has('longbell') ? 1.25 : 1,
      dashCD: has('swift') ? 0.5 : 1,
      dashHit: has('swift'),
      spirit: has('resonance') ? 1.6 : 1,
      iframes: has('moonshade') ? 1.6 : 1,
      coins: has('fortune') ? 2 : 1,
      magnet: has('fortune') ? 72 : 20,
      crescent: has('breaker'),
      vigor: has('vigor'),
    };
    return charmMod;
  }
  const maxHp = () => env.maxHp();

  // ---------------- 載入關卡 ----------------
  function makeRope(x, y) { return Array.from({ length: 6 }, () => ({ x, y, px: x, py: y })); }
  function load(i) {
    stageIndex = i; st = STAGES[i];
    map = parseStage(st);
    WW = map.MW * T; WH = map.MH * T;
    theme = buildTheme(st.theme, map, W, H);
    eclipse = st.boss === 'serpent' ? { normal: eclipseSky(W, H, false), red: eclipseSky(W, H, true) } : null;
    computeMods();
    const sx = map.spawn.tx * T + 8, sy = groundY(map.spawn.tx, map.spawn.ty);
    checkpoint = { x: sx, y: sy };
    deaths = 0; coinsGot = 0; stageTime = 0; time = 0; toasts = []; fade = 0; bannerT = 3; finale = null; frozen = false;
    spawnAll(true);
    placePlayer(sx, sy, true);
  }
  /** 建立（或重置）關卡物件；first＝剛進關卡 */
  function spawnAll(first) {
    enemies = []; shots = []; pshots = []; bursts = [];
    arena = null; boss = null;
    cam.bounds = { w: WW, h: WH };
    if (first) {
      pickups = []; props = []; movers = []; crumbles = new Map(); breaks = new Map();
      for (const m of map.movers) {
        const x0 = m.tx * T, y0 = m.ty * T;
        const range = m.kind === 'h' ? m.range * T : m.range * T;
        movers.push({ kind: m.kind, x0, y0, x: x0, y: y0, w: 32, range, t: 0, dx: 0, dy: 0, speed: Math.PI * 36 / Math.max(16, range) });
      }
      for (const e of map.ents) {
        const cx = e.tx * T + 8, cy = e.ty * T + 8;
        switch (e.ch) {
          case 'T': props.push({ kind: 'toro', x: cx, y: groundY(e.tx, e.ty), lit: false }); break;
          case '?': props.push({ kind: 'sign', x: cx, y: groundY(e.tx, e.ty), text: st.hints[e.index] || '' }); break;
          case 'K': props.push({ kind: 'chest', x: cx, y: groundY(e.tx, e.ty), open: !!env.save.chests[st.id] }); break;
          case '$': props.push({ kind: 'offering', x: cx, y: groundY(e.tx, e.ty), hp: 3, broken: false, flash: 0 }); break;
          case 'C': props.push({ kind: 'chime', x: cx, y: cy - 2, ring: 0, t: rand(0, 6) }); break;
          case 'D': props.push({ kind: 'drum', tx: e.tx, ty: e.ty, x: cx, y: e.ty * T, squash: 0 }); break;
          case 'o': pickups.push({ kind: 'coin', x: cx, y: cy, t: rand(0, 1), fixed: true }); break;
          case 'h': pickups.push({ kind: 'dango', x: cx, y: cy, t: 0, fixed: true }); break;
          case 'B': pickups.push({ kind: 'bell', x: cx, y: cy, t: rand(0, 3), fixed: true, index: e.index, had: !!(env.save.bells[st.id] || [])[e.index] }); break;
          default: break;
        }
      }
    }
    for (const e of map.ents) if (CH_TYPE[e.ch]) enemies.push(makeEnemy(CH_TYPE[e.ch], e.tx, e.ty));
  }
  function placePlayer(x, y, first) {
    const prevSpirit = pl ? pl.spirit : 0;
    pl = {
      x, y, vx: 0, vy: 0, vy0: 0, face: 1, w: 8, h: 22, onGround: true, onPlat: null,
      coyote: 0, buffer: 0, airJumps: airJumpsMax(), dashes: P.airDashes, dashT: 0, dashCD: 0, jumping: false, dashHit: new Set(),
      atk: null, chain: null, chainT: 0, hp: maxHp(), inv: first ? 0 : 1.2, hurtT: 0, runPhase: 0, idleT: 0, blinkT: 2,
      armA: REST.idle[0], staffA: REST.idle[1], sx: 1, sy: 1, ghosts: [], ghostT: 0, dropT: 0,
      ropes: [makeRope(x, y - 30), makeRope(x, y - 30)], flashRed: 0,
      spirit: first ? 0 : prevSpirit, spellHold: 0, healing: false, healT: 0, healedHold: false,
      wallCoyote: 0, lastWall: 0, wallLock: 0, wallLockDir: 0, sliding: false,
      safe: { x, y }, dead: false, deathT: 0, vigorN: 0,
    };
    computeRig();
    for (const rope of pl.ropes) for (const q of rope) { q.x = q.px = pl.tip.x; q.y = q.py = pl.tip.y; }
    hitstop = 0; combo = 0; comboT = 0; lastHit = -1;
    parts.clear(); floats.list.length = 0; shake.reset();
    cam.bounds = { w: WW, h: WH };
    cam.center(pl.x + P.camLead, pl.y - 54);
  }
  function makeEnemy(type, tx, ty) {
    const d = ED[type];
    const x = tx * T + 8;
    const base = { type, d, hp: d.hp, maxHp: d.hp, flash: 0, hitstun: 0, vx: 0, vy: 0, dead: false, t: rand(0, 6), shakeT: 0, face: -1, w: d.w, h: d.h, weight: d.weight, state: 'idle', stateT: rand(0.5, 1.5), cd: rand(0.5, 1.5), onGround: false };
    if (d.fly) {
      const y = ty * T + 8;
      return { ...base, x, y, hx: x, hy: y, trail: type === 'momen' ? Array.from({ length: 9 }, () => ({ x, y })) : null, dir: -1 };
    }
    const y = type === 'spider' ? ty * T + 8 : groundY(tx, ty);
    const e = { ...base, x, y, hx: x, hy: y };
    if (type === 'dummy') Object.assign(e, { lean: 0, leanV: 0 });
    if (type === 'umbrella') Object.assign(e, { hopT: rand(0.5, 1.5), onGround: true });
    if (type === 'spider') {
      let cy = ty; while (cy > 0 && !isSolidT(tx, cy - 1)) cy--;
      Object.assign(e, { state: 'hang', anchorY: cy * T, hangY: ty * T + 8 });
    }
    return e;
  }

  // ---------------- 玩家 ----------------
  const gravity = () => 2 * P.jumpHeight / (P.jumpTime * P.jumpTime);
  const jumpV = () => 2 * P.jumpHeight / P.jumpTime;
  function shoulder() {
    const sx = pl.face > 0 ? RIG.shoulder[0] : RIG.w - 1 - RIG.shoulder[0];
    return { x: pl.x - 8 + sx + 0.5, y: pl.y - 26 + RIG.shoulder[1] * pl.sy + (26 - 26 * pl.sy) };
  }
  function startJump(air) {
    const v = air ? jumpV() * Math.sqrt(P.airJumpRatio) : jumpV();
    pl.vy = -v; pl.jumping = true; pl.onGround = false; pl.onPlat = null; pl.coyote = 0; pl.buffer = 0;
    pl.sx = 1 - P.squash * 0.6; pl.sy = 1 + P.squash;
    if (air) {
      parts.add({ x: pl.x, y: pl.y - 4, shape: 'ring', r0: 2, r1: 11, life: 0.25, colors: [C.white, C.gold, C.lav] });
      parts.burst(pl.x, pl.y - 2, 6, { dir: Math.PI / 2, spread: 1.6, speed: [30, 70], colors: [C.gold, C.moon], life: [0.2, 0.4] });
    } else dust(pl.x, pl.y, 5);
    sfx.jump(air);
    if (pl.atk && pl.atk.f >= pl.atk.S + pl.atk.A) pl.atk = null;
  }
  function wallJump(side) {
    pl.vx = -side * P.wallJumpX; pl.vy = -jumpV() * P.wallJumpY;
    pl.face = -side; pl.jumping = true; pl.buffer = 0; pl.wallCoyote = 0; pl.sliding = false;
    pl.wallLock = P.wallJumpLock; pl.wallLockDir = -side;
    pl.dashes = P.airDashes;
    pl.sx = 1 - P.squash * 0.6; pl.sy = 1 + P.squash;
    parts.burst(pl.x + side * 5, pl.y - 10, 7, { dir: side > 0 ? Math.PI : 0, spread: 1.4, speed: [30, 80], colors: [C.moon, C.lav, C.violet], shape: 'sq', size: 2, life: [0.2, 0.4] });
    sfx.jump(false);
    if (pl.atk) pl.atk = null;
  }
  function dust(x, y, n, dir = 0) {
    parts.burst(x, y - 1, n, { dir: dir ? (dir > 0 ? 0 : Math.PI) : -Math.PI / 2, spread: dir ? 1.2 : 2.8, speed: [15, 55], gravity: -30, drag: 5, colors: [C.moon, C.lav, C.violet], shape: 'sq', size: 2, life: [0.25, 0.45] });
  }
  function startAttack(kind) {
    const def = ATTACKS[kind];
    const extra = def.extra || [0, 0, 0];
    const airK = (kind === 'air' || kind === 'down') ? -2 : 0;
    // 下劈：前搖較短、判定多一格（高速下墜時也打得到風鈴）
    const down = kind === 'down';
    pl.atk = { kind, def, f: 0, S: Math.max(down ? 1 : 0, P.atkStartup + extra[0] - (down ? 2 : 0)), A: Math.max(1, P.atkActive + extra[1] + (down ? 1 : 0)), R: Math.max(0, P.atkRecovery + extra[2] + airK), hit: new Set(), hitProps: new Set(), queued: false, startAng: pl.staffA, prevAng: pl.staffA };
    if (pl.onGround && (kind === 'g1' || kind === 'g2' || kind === 'g3')) pl.chain = kind;
  }
  function attackAngle(a) {
    const { def, f, S, A, R } = a;
    const wind = def.a0 - 0.3 * sign(def.a1 - def.a0);
    if (f < S) return lerp(a.startAng, wind, easeOut((f + 1) / (S + 1)));
    if (f < S + A) return lerp(wind, def.a1, easeOut((f - S + 1) / A));
    const t = R ? (f - S - A) / R : 1;
    return def.a1 + 0.12 * sign(def.a1 - def.a0) * Math.sin(Math.min(1, t) * Math.PI);
  }
  function tryDash(ax) {
    if (pl.dashCD > 0 || pl.hurtT > 0) return;
    if (!pl.onGround && pl.dashes <= 0) return;
    if (pl.atk && !(P.cancelDash && pl.atk.f >= pl.atk.S + pl.atk.A)) return;
    if (!pl.onGround) pl.dashes--;
    if (ax) pl.face = sign(ax);
    pl.atk = null; pl.dashT = P.dashTime; pl.dashCD = P.dashCooldown * charmMod.dashCD + P.dashTime;
    pl.vx = pl.face * P.dashSpeed; pl.vy = 0; pl.jumping = false; pl.onPlat = null; pl.dashHit.clear();
    pl.spellHold = 0; pl.healing = false;
    if (P.dashIframes) pl.inv = Math.max(pl.inv, P.dashTime);
    parts.burst(pl.x - pl.face * 4, pl.y - 12, 8, { dir: pl.face > 0 ? Math.PI : 0, spread: 0.5, speed: [60, 140], colors: [C.white, C.moon, C.lav], shape: 'line', len: 0.04, life: [0.15, 0.3] });
    if (pl.onGround) dust(pl.x, pl.y, 4, -pl.face);
    sfx.dash();
  }
  function hurtPlayer(src, dmg = 1) {
    if (pl.dead || pl.inv > 0 || pl.hurtT > 0 || finale) return false;
    if (!P.godMode) pl.hp -= dmg;
    const dir = sign(pl.x - src.x) || -pl.face;
    pl.vx = dir * P.hurtKnockX; pl.vy = -P.hurtKnockY; pl.onGround = false; pl.onPlat = null;
    pl.hurtT = P.hurtStun / 1000; pl.inv = P.iframes / 1000 * charmMod.iframes; pl.atk = null; pl.dashT = 0; pl.flashRed = 0.08;
    pl.spellHold = 0; pl.healing = false;
    hitstop = Math.max(hitstop, P.hurtHitstop / 1000);
    shake.add(P.shake + 2, 220, dir, 0);
    combo = 0; comboT = 0;
    parts.burst(pl.x, pl.y - 12, 14, { speed: [40, 120], colors: [C.white, C.red, C.pink], shape: 'sq', size: 2, life: [0.3, 0.5] });
    sfx.hurt();
    if (pl.hp <= 0) killPlayer();
    return true;
  }
  /** 掉進深淵或踩到尖刺：扣血並回到最後站穩的地方 */
  function hazard() {
    if (pl.dead || finale) return;
    if (pl.inv <= 0 && !P.godMode) {
      pl.hp--;
      sfx.hurt(); shake.add(3, 200);
      parts.burst(pl.x, pl.y - 10, 12, { speed: [40, 120], colors: [C.white, C.red, C.pink], shape: 'sq', size: 2, life: [0.3, 0.5] });
      if (pl.hp <= 0) { killPlayer(); return; }
    }
    pl.x = pl.safe.x; pl.y = pl.safe.y; pl.vx = pl.vy = pl.vy0 = 0; pl.atk = null; pl.dashT = 0; pl.onPlat = null; pl.hurtT = 0;
    pl.inv = Math.max(pl.inv, 1.0); pl.flashRed = 0.1;
    parts.add({ x: pl.x, y: pl.y - 11, shape: 'ring', r0: 16, r1: 2, life: 0.3, colors: [C.white, C.moon] });
  }
  function killPlayer() {
    pl.dead = true; pl.deathT = 0; pl.hp = 0; pl.atk = null; pl.vx = 0; pl.vy = -160;
    hitstop = 0.25;
    shake.add(5, 400);
    sfx.death();
    hooks.onDeath && hooks.onDeath();
  }
  function updateDeath(dt) {
    pl.deathT += dt;
    pl.vy += 500 * dt; pl.y += pl.vy * dt * 0.4;
    if (Math.random() < 0.5) parts.add({ x: pl.x + rand(-6, 6), y: pl.y - rand(0, 20), vx: rand(-10, 10), vy: rand(-40, -15), life: 0.8, colors: [C.white, C.moon, C.lav, C.violet], shape: 'sq', size: 2 });
    fade = clamp((pl.deathT - 0.9) / 0.5, 0, 1);
    if (pl.deathT >= 1.5) {
      deaths++;
      spawnAll(false);
      for (const p of props) if (p.kind === 'offering') { /* 箱子維持打破的狀態 */ }
      placePlayer(checkpoint.x, checkpoint.y, false);
      pl.spirit = Math.max(pl.spirit, 0);
      fade = 1;
      hooks.onRespawn && hooks.onRespawn();
    }
  }

  // ---------------- 靈力：鈴祓（點按）與回復（長按） ----------------
  function addSpirit(v) { pl.spirit = Math.min(env.spiritMax(), pl.spirit + v * charmMod.spirit); }
  function handleSpell(dt) {
    const canAct = pl.hurtT <= 0 && pl.dashT <= 0;
    if (input.pressed('spell') && canAct) { pl.spellHold = 0.0001; pl.healedHold = false; pl.healT = 0; }
    if (pl.spellHold <= 0) { pl.healing = false; return; }
    if (!input.down('spell')) {
      if (pl.spellHold < 0.28 && !pl.healedHold) castBurst();
      pl.spellHold = 0; pl.healing = false; pl.healT = 0;
      return;
    }
    pl.spellHold += dt;
    const canHeal = pl.onGround && pl.spirit >= 1 && pl.hp < maxHp() && !pl.atk && pl.hurtT <= 0;
    pl.healing = pl.spellHold >= 0.28 && canHeal;
    if (pl.healing) {
      pl.healT += dt;
      if (Math.random() < 0.6) { const a = rand(0, TAU), r = rand(16, 24); parts.add({ x: pl.x + Math.cos(a) * r, y: pl.y - 11 + Math.sin(a) * r, vx: -Math.cos(a) * 70, vy: -Math.sin(a) * 70, life: 0.28, colors: [C.white, C.green, C.green], shape: 'px' }); }
      if (pl.healT >= P.healTime) {
        pl.healT = 0; pl.healedHold = true;
        pl.spirit -= 1; pl.hp = Math.min(maxHp(), pl.hp + 1);
        floats.add(pl.x, pl.y - 30, '+1', C.green, { small: false, outline: C.ink });
        parts.add({ x: pl.x, y: pl.y - 11, shape: 'ring', r0: 3, r1: 20, life: 0.3, colors: [C.white, C.green] });
        sfx.heal();
      }
    } else pl.healT = 0;
  }
  function castBurst() {
    if (pl.spirit < 1) { sfx.fizzle(); floats.add(pl.x, pl.y - 30, 'NO SPIRIT', C.lav, { outline: C.ink, life: 0.6 }); return; }
    pl.spirit -= 1;
    bursts.push({ x: pl.x, y: pl.y - 11, r: 4, max: P.spellRadius, t: 0, hit: new Set() });
    hitstop = Math.max(hitstop, 0.05);
    shake.add(3, 250);
    if (!pl.onGround) pl.vy = Math.min(pl.vy, -70);
    pl.inv = Math.max(pl.inv, 0.25);
    parts.burst(pl.x, pl.y - 11, 24, { speed: [60, 180], colors: [C.white, C.gold, C.moon], shape: 'line', len: 0.04, life: [0.2, 0.4], drag: 4 });
    sfx.burst();
  }
  function updateBursts(dt) {
    for (const b of bursts) {
      b.t += dt;
      b.r = Math.min(b.max, 4 + (b.max - 4) * easeOut(Math.min(1, b.t / 0.22)));
      for (const e of enemies) {
        if (e.dead || b.hit.has(e) || e.invisible) continue;
        const c = bodyCenter(e);
        if (Math.hypot(c.x - b.x, c.y - b.y) < b.r + Math.min(e.w, e.h) / 2) {
          b.hit.add(e);
          damageEnemy(e, P.spellDamage, Math.atan2(c.y - b.y, c.x - b.x), { spell: true });
        }
      }
      for (const s of shots) if (!s.dead && Math.hypot(s.x - b.x, s.y - b.y) < b.r + 4) { s.dead = true; popShot(s); }
    }
    bursts = bursts.filter(b => b.t < 0.4);
  }

  // ---------------- 玩家更新 ----------------
  function updatePlayer(dt) {
    if (pl.dead) { updateDeath(dt); return; }
    const ax = input.axis().x;
    let mx = Math.abs(ax) > 0.3 ? sign(ax) : 0;
    pl.coyote -= dt; pl.buffer -= dt; pl.dashCD -= dt; pl.inv -= dt; pl.hurtT -= dt; pl.chainT -= dt; pl.dropT -= dt; pl.flashRed -= dt; pl.wallCoyote -= dt;
    if (pl.wallLock > 0) { pl.wallLock -= dt; if (pl.wallLock > 0) mx = pl.wallLockDir; }
    if (input.pressed('jump')) pl.buffer = P.jumpBuffer / 1000;
    const wasGround = pl.onGround;

    handleSpell(dt);
    const rooted = pl.healing;
    pl.sliding = false;

    if (pl.dashT > 0) {
      pl.dashT -= dt;
      pl.vx = pl.face * P.dashSpeed; pl.vy = 0;
      if ((pl.ghostT -= dt) <= 0) { pl.ghostT = 0.03; pl.ghosts.push({ spr: S.hirin.dash, x: pl.x, y: pl.y, face: pl.face, age: 0 }); }
      if (pl.dashT <= 0) pl.vx *= P.dashKeep;
      pl.vy0 = 0;
      if (input.pressed('jump') && pl.onGround) { pl.dashT = 0; pl.vx *= Math.max(P.dashKeep, 0.6); startJump(false); }
      if (charmMod.dashHit) for (const e of enemies) {
        if (e.dead || pl.dashHit.has(e) || e.invisible || e.d.harmless) continue;
        const c = bodyCenter(e);
        if (Math.abs(c.x - pl.x) < e.w / 2 + 6 && Math.abs(c.y - (pl.y - 11)) < e.h / 2 + 11) { pl.dashHit.add(e); damageEnemy(e, 1, pl.face > 0 ? 0 : Math.PI, { dash: true }); }
      }
    } else {
      const canAct = pl.hurtT <= 0 && !rooted;
      if (canAct && input.pressed('attack')) {
        if (!pl.atk) {
          let kind;
          if (input.down('up')) kind = 'up';
          else if (!pl.onGround) kind = input.down('down') && abil('pogo') ? 'down' : 'air';
          else kind = (pl.chain && pl.chainT > 0 && ATTACKS[pl.chain].next) ? ATTACKS[pl.chain].next : 'g1';
          if (mx) pl.face = mx;
          startAttack(kind);
          pl.spellHold = 0;
        } else pl.atk.queued = true;
      }
      if (canAct && input.pressed('dash')) tryDash(mx);

      const a = pl.atk;
      if (a) {
        const prev = a.f;
        a.f++;
        if (a.f === a.S + 1 || (a.S === 0 && prev === 0)) {
          if (pl.onGround) pl.vx = pl.face * P.atkLunge * (a.def.finisher ? 1.6 : 1) + pl.vx * 0.2;
          sfx.swing(a.def.swing);
          if (a.def.finisher && charmMod.crescent) {
            const sh = shoulder();
            pshots.push({ x: sh.x + pl.face * 14, y: sh.y - 2, vx: pl.face * 240, life: 0.55, hit: new Set(), face: pl.face });
          }
        }
        const recStart = a.S + a.A;
        const cancelAt = recStart + Math.ceil(a.R * P.comboCancel);
        if (a.queued && a.f >= cancelAt && a.def.next && pl.onGround) startAttack(input.down('up') ? 'up' : a.def.next);
        else if (a.f >= a.S + a.A + a.R) {
          pl.atk = null;
          pl.chainT = P.comboWindow / 1000;
          if (a.queued && !a.def.next && (a.kind === 'air' || a.kind === 'down' || a.kind === 'up')) {
            startAttack(input.down('up') ? 'up' : !pl.onGround ? (input.down('down') && abil('pogo') ? 'down' : 'air') : 'g1');
          } else if (a.def.finisher) pl.chain = null;
        }
      }

      // 水平移動
      const attacking = !!pl.atk;
      if (!attacking && pl.hurtT <= 0 && mx && !rooted) pl.face = mx;
      const target = pl.hurtT > 0 ? pl.vx : rooted ? 0 : mx * P.runSpeed * (attacking ? P.atkMove : 1);
      let acc;
      if (pl.hurtT > 0) acc = 300;
      else if (pl.onGround) acc = !mx || rooted ? P.groundDecel : (pl.vx && sign(pl.vx) !== mx ? P.turnAccel : P.groundAccel);
      else acc = mx ? P.airAccel : P.airDecel;
      if (attacking && pl.onGround && !mx) acc = P.groundDecel * 0.6;
      pl.vx = approach(pl.vx, target, acc * dt);

      // 牆壁：滑落與壁跳
      if (abil('wall') && !pl.onGround && pl.hurtT <= 0) {
        const side = touchingWall();
        if (side) {
          pl.lastWall = side; pl.wallCoyote = 0.1;
          if (mx === side && pl.vy > -20 && !pl.atk) {
            pl.sliding = true; pl.face = -side;
            if (Math.random() < 0.3) parts.add({ x: pl.x + side * 4, y: pl.y - rand(4, 18), vx: -side * 10, vy: -10, life: 0.25, colors: [C.moon, C.lav], shape: 'px' });
          }
        }
      }

      // 跳躍（土狼時間、輸入緩衝、壁跳、空中跳、取消後搖）
      const atkBlocks = pl.atk && !(P.cancelJump && pl.atk.f >= pl.atk.S + pl.atk.A);
      if (pl.buffer > 0 && pl.hurtT <= 0 && !atkBlocks && !rooted) {
        if (pl.onGround && input.down('down') && standingOnOneWay()) { pl.dropT = 0.22; pl.onGround = false; pl.onPlat = null; pl.buffer = 0; pl.y += 1; }
        else if (pl.onGround || pl.coyote > 0) startJump(false);
        else if (abil('wall') && pl.wallCoyote > 0 && pl.lastWall) wallJump(pl.lastWall);
        else if (pl.airJumps > 0 && input.pressed('jump')) { pl.airJumps--; startJump(true); }
      }
      // 重力（梯形積分，跳躍高度會精確等於設定值）
      pl.vy0 = pl.vy;
      let gmul = 1;
      if (pl.vy > 0) gmul = P.fallMult;
      else if (pl.jumping && !input.down('jump')) gmul = P.jumpCut;
      if (Math.abs(pl.vy) < P.apexWindow && input.down('jump') && pl.jumping) gmul = Math.min(gmul, P.apexHang);
      if (!pl.onGround) pl.vy = Math.min(pl.sliding ? P.wallSlide : P.maxFall, pl.vy + gravity() * gmul * dt);
      if (pl.sliding && pl.vy > P.wallSlide) pl.vy = approach(pl.vy, P.wallSlide, 2400 * dt);
    }

    // ---- 移動與碰撞
    const prevY = pl.y;
    if (moveX(pl, pl.vx * dt)) { if (pl.dashT > 0) pl.dashT = Math.min(pl.dashT, 0.02); pl.vx = 0; }
    const vyBefore = pl.vy;
    const hitY = moveY(pl, (pl.vy0 + pl.vy) / 2 * dt);
    if (hitY === -1) pl.vy = Math.max(0, pl.vy);
    let landedPlat = null;
    if (hitY <= 0 && pl.vy >= 0 && !(pl.dropT > 0)) {
      for (const m of movers) {
        if (pl.x + pl.w / 2 > m.x && pl.x - pl.w / 2 < m.x + m.w && prevY <= m.y - m.dy + 1 && pl.y >= m.y) { pl.y = m.y; landedPlat = m; break; }
      }
    }
    if (hitY === 2) { bounceDrum(); }
    else {
      if (landedPlat) pl.onPlat = landedPlat;
      if (pl.onPlat && (pl.x + pl.w / 2 <= pl.onPlat.x || pl.x - pl.w / 2 >= pl.onPlat.x + pl.onPlat.w || pl.vy < 0 || pl.dropT > 0)) pl.onPlat = null;
      pl.onGround = hitY === 1 || !!pl.onPlat || (pl.vy >= 0 && groundBelow(pl));
      if (pl.onGround) {
        if (!wasGround) {
          pl.sx = 1 + P.squash; pl.sy = 1 - P.squash * (vyBefore > 250 ? 1 : 0.6);
          dust(pl.x, pl.y, vyBefore > 250 ? 7 : 3);
          sfx.land(vyBefore);
          pl.jumping = false;
        }
        pl.vy = 0; pl.coyote = P.coyote / 1000; pl.airJumps = airJumpsMax(); pl.dashes = P.airDashes;
        trackSafe();
        stepCrumbles(dt);
      } else if (wasGround && pl.vy >= 0) pl.coyote = P.coyote / 1000;
    }
    if (pl.vy >= 0) pl.jumping = pl.jumping && pl.vy < 0;
    const minX = arena ? arena.x0 + 6 : 6, maxX = arena ? arena.x1 - 6 : WW - 6;
    if (pl.x < minX) { pl.x = minX; pl.vx = Math.max(0, pl.vx); }
    if (pl.x > maxX) { pl.x = maxX; pl.vx = Math.min(0, pl.vx); }
    if (pl.y > WH + 30) hazard();
    checkSpikes();

    // ---- 壓縮伸展回彈、跑步相位
    const k = smoothK(dt, 0.05);
    pl.sx += (1 - pl.sx) * k; pl.sy += (1 - pl.sy) * k;
    if (pl.onGround && Math.abs(pl.vx) > 12 && !pl.atk) {
      const before = Math.floor(pl.runPhase);
      pl.runPhase = (pl.runPhase + Math.abs(pl.vx) * dt / 7.5) % 6;
      const now = Math.floor(pl.runPhase);
      if (now !== before && (now === 1 || now === 4)) { sfx.step(); if (Math.random() < 0.5) parts.add({ x: pl.x - pl.face * 3, y: pl.y - 1, vx: -pl.face * 12, vy: -8, life: 0.25, colors: [C.lav, C.violet], shape: 'sq', size: 1 }); }
    }
    if ((pl.blinkT -= dt) < 0) pl.blinkT = rand(2, 4.5);

    // ---- 前手與鈴杖角度
    if (pl.atk) {
      const ang = attackAngle(pl.atk);
      pl.atk.prevAng = pl.staffA;
      pl.staffA = ang; pl.armA = ang;
    } else {
      const stt = pl.hurtT > 0 ? 'hurt' : pl.healing ? 'heal' : pl.dashT > 0 ? 'dash' : pl.sliding ? 'wall' : !pl.onGround ? (pl.vy < 0 ? 'jump' : 'fall') : Math.abs(pl.vx) > 12 ? 'run' : 'idle';
      const [ta, ts] = REST[stt];
      pl.armA += angDiff(pl.armA, ta) * smoothK(dt, 0.045);
      pl.staffA += angDiff(pl.staffA, ts) * smoothK(dt, 0.07);
    }
  }
  function bounceDrum() {
    const tx = Math.floor(pl.x / T), ty = Math.floor((pl.y + 1) / T);
    const d = props.find(p => p.kind === 'drum' && (p.tx === tx || p.tx === Math.floor((pl.x - 3) / T) || p.tx === Math.floor((pl.x + 3) / T)) && p.ty === ty);
    if (d) d.squash = 0.2;
    pl.vy = -jumpV() * P.drumBoost; pl.vy0 = pl.vy; pl.jumping = false; pl.onGround = false; pl.onPlat = null;
    pl.airJumps = airJumpsMax(); pl.dashes = P.airDashes;
    pl.sx = 1 - P.squash; pl.sy = 1 + P.squash * 1.3;
    parts.add({ x: pl.x, y: pl.y, shape: 'ring', r0: 3, r1: 16, life: 0.25, colors: [C.white, C.gold, C.red] });
    shake.add(1.5, 120, 0, 1);
    sfx.drum();
  }
  function trackSafe() {
    if (pl.onPlat) return;
    const l = Math.floor((pl.x - 4) / T), r = Math.floor((pl.x + 4) / T), ty = Math.floor((pl.y + 0.5) / T);
    for (let tx = l; tx <= r; tx++) {
      const t = tileAt(tx, ty);
      if (t !== TILE.SOLID && t !== TILE.ONEWAY) return;
    }
    for (let tx = l - 1; tx <= r + 1; tx++) if (tileAt(tx, ty) === TILE.SPIKE || tileAt(tx, ty - 1) === TILE.SPIKE) return;
    pl.safe = { x: pl.x, y: pl.y };
  }
  function stepCrumbles(dt) {
    const l = Math.floor((pl.x - pl.w / 2 + 0.01) / T), r = Math.floor((pl.x + pl.w / 2 - 0.01) / T), ty = Math.floor((pl.y + 0.5) / T);
    for (let tx = l; tx <= r; tx++) {
      if (tileAt(tx, ty) !== TILE.CRUMBLE) continue;
      const k = tileIdx(tx, ty);
      let c = crumbles.get(k);
      if (!c) { c = { t: 0, broken: 0 }; crumbles.set(k, c); }
      if (c.broken > 0) continue;
      c.t += dt;
      if (c.t > 0.05 && Math.random() < 0.2) parts.add({ x: tx * T + rand(2, 14), y: ty * T + 5, vx: 0, vy: 20, ay: 300, life: 0.4, colors: theme.id === 'bamboo' ? [C.dgreen] : [C.dwood, C.wood], shape: 'px' });
    }
  }
  function updateCrumbles(dt) {
    for (const [k, c] of crumbles) {
      if (c.broken > 0) { c.broken -= dt; if (c.broken <= 0) { c.t = 0; const tx = k % map.MW, ty = Math.floor(k / map.MW); parts.add({ x: tx * T + 8, y: ty * T + 2, shape: 'ring', r0: 2, r1: 9, life: 0.2, colors: [C.moon, C.lav] }); } }
      else if (c.t >= P.crumbleTime) {
        c.broken = 2.8; c.t = 0;
        const tx = k % map.MW, ty = Math.floor(k / map.MW);
        parts.burst(tx * T + 8, ty * T + 2, 8, { speed: [10, 60], gravity: 400, colors: theme.id === 'bamboo' ? [C.green, C.dgreen] : [C.wood, C.dwood, C.orange], shape: 'sq', size: 2, life: [0.4, 0.8], drag: 1 });
        sfx.crumble();
      } else if (!(Math.abs(pl.y - (Math.floor(k / map.MW)) * T) < 1 && Math.abs(pl.x - ((k % map.MW) * T + 8)) < 12)) c.t = Math.max(0, c.t - dt * 0.5);
    }
  }
  function checkSpikes() {
    if (pl.dead) return;
    const x0 = pl.x - pl.w / 2 + 1, x1 = pl.x + pl.w / 2 - 1, y0 = pl.y - pl.h + 2, y1 = pl.y;
    for (let ty = Math.floor(y0 / T); ty <= Math.floor(y1 / T); ty++) for (let tx = Math.floor(x0 / T); tx <= Math.floor(x1 / T); tx++) {
      if (tileAt(tx, ty) !== TILE.SPIKE) continue;
      if (x1 > tx * T + 2 && x0 < tx * T + 14 && y1 > ty * T + 6) { hazard(); return; }
    }
  }

  // ---------------- 攻擊判定 ----------------
  function inSweep(sh, R, a, x, y, r) {
    const dx = x - sh.x, dy = y - sh.y, d = Math.hypot(dx, dy);
    if (d > R + r) return false;
    if (d < 8) return true;
    const w0 = worldAng(a.prevAng, pl.face), w1 = worldAng(pl.staffA, pl.face);
    const lo = Math.min(w0, w1) - 0.15, hi = Math.max(w0, w1) + 0.15;
    let ang = Math.atan2(dy, dx);
    const margin = Math.asin(Math.min(1, r / d));
    while (ang < lo - margin) ang += TAU;
    while (ang > lo - margin + TAU) ang -= TAU;
    return ang <= hi + margin;
  }
  function checkHits() {
    const a = pl.atk;
    if (!a || a.f <= a.S || a.f > a.S + a.A || pl.dead) return;
    const sh = shoulder();
    const R = P.atkReach * a.def.reach * charmMod.reach;
    for (const e of enemies) {
      if (e.dead || a.hit.has(e) || e.invisible) continue;
      const hb = hurtboxes(e);
      for (const b of hb) {
        if (inSweep(sh, R, a, b.x, b.y, b.r)) {
          a.hit.add(e);
          const d = Math.min(Math.hypot(b.x - sh.x, b.y - sh.y), R);
          onHit(e, a, sh, d, b);
          break;
        }
      }
    }
    // 打消敵人的飛行道具
    for (const s of shots) if (!s.dead && s.deflect !== false && inSweep(sh, R, a, s.x, s.y, s.r || 3)) {
      s.dead = true; popShot(s, true); addSpirit(0.05);
      if (a.def.dir === 'down' && !pl.onGround) pogo();
    }
    // 場景物件
    for (const p of props) {
      if (a.hitProps.has(p)) continue;
      if (p.kind === 'chime' && inSweep(sh, R, a, p.x, p.y + 2, 8)) {
        a.hitProps.add(p); p.ring = 1; sfx.chime(); addSpirit(0.03);
        parts.add({ x: p.x, y: p.y + 2, shape: 'ring', r0: 2, r1: 12, life: 0.25, colors: [C.white, C.moon] });
        if (a.def.dir === 'down' && !pl.onGround) { pogo(); hitstop = Math.max(hitstop, 0.04); }
      } else if (p.kind === 'offering' && !p.broken && inSweep(sh, R, a, p.x, p.y - 5, 8)) {
        a.hitProps.add(p); p.hp--; p.flash = 0.08; sfx.clink(); shake.add(1, 80);
        if (p.hp <= 0) { p.broken = true; sfx.brk(); spawnCoins(p.x, p.y - 8, 7 + Math.floor(rand(0, 4))); parts.burst(p.x, p.y - 6, 12, { speed: [30, 120], gravity: 300, colors: [C.wood, C.dwood, C.gold], shape: 'sq', size: 2, life: [0.4, 0.8] }); }
      } else if (p.kind === 'chest' && !p.open && inSweep(sh, R, a, p.x, p.y - 5, 8)) { a.hitProps.add(p); openChest(p); }
    }
    // 可破壞的牆
    const tx0 = Math.floor((sh.x - R) / T), tx1 = Math.floor((sh.x + R) / T), ty0 = Math.floor((sh.y - R) / T), ty1 = Math.floor((sh.y + R) / T);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (tileAt(tx, ty) !== TILE.BREAK) continue;
      const k = tileIdx(tx, ty);
      if (a.hitProps.has(k)) continue;
      if (!inSweep(sh, R, a, tx * T + 8, ty * T + 8, 8)) continue;
      a.hitProps.add(k);
      const n = (breaks.get(k) || 0) + 1;
      breaks.set(k, n);
      shake.add(1.5, 100);
      parts.burst(tx * T + 8, ty * T + 8, 5, { speed: [30, 90], colors: [C.moon, C.lav], shape: 'sq', size: 2, life: [0.2, 0.4], gravity: 200 });
      if (n >= 2) breakTile(tx, ty); else sfx.clink();
    }
  }
  function breakTile(tx, ty) {
    map.set(tx, ty, TILE.EMPTY);
    parts.burst(tx * T + 8, ty * T + 8, 16, { speed: [40, 150], gravity: 380, colors: [C.lav, C.violet, C.moon, C.indigo], shape: 'sq', size: 3, life: [0.4, 0.9], drag: 1 });
    sfx.brk();
    // 相連的可破壞牆一起倒下
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) if (tileAt(tx + dx, ty + dy) === TILE.BREAK) setTimeoutFrames(() => breakTile(tx + dx, ty + dy), 4);
  }
  let delayed = [];
  function setTimeoutFrames(fn, n) { delayed.push({ fn, n }); }
  function pogo() {
    pl.vy = -P.pogo; pl.vy0 = pl.vy; pl.jumping = false; pl.airJumps = airJumpsMax(); pl.dashes = P.airDashes;
    sfx.pogo();
  }
  function bodyCenter(e) { return e.d.fly ? { x: e.x, y: e.y } : { x: e.x, y: e.y - e.h / 2 }; }
  /** 受擊判定（圓）：大部分敵人一個，守護妖可能有舌頭、蛇頭等 */
  function hurtboxes(e) {
    const c = bodyCenter(e);
    const list = [{ x: c.x, y: c.y, r: Math.min(e.w, e.h) / 2 + 2 }];
    if (e.type === 'bossLantern' && e.tongue && e.tongue.len > 10) list.push({ x: e.tongue.tx, y: e.tongue.ty, r: 6, tongue: true });
    if (e.type === 'bossWeasel' || e.type === 'bossFox' || e.type === 'bossLantern') { list.push({ x: c.x - e.w / 3, y: c.y, r: e.h / 2 }); list.push({ x: c.x + e.w / 3, y: c.y, r: e.h / 2 }); }
    return list;
  }
  function onHit(e, a, sh, dist, box) {
    const def = a.def, fin = !!def.finisher;
    const c = box || bodyCenter(e);
    const ang = Math.atan2(c.y - sh.y, c.x - sh.x);
    const px = sh.x + Math.cos(ang) * dist, py = sh.y + Math.sin(ang) * dist;
    combo++; comboT = 1.8; lastHit = time;
    addSpirit(P.spiritPerHit * (fin ? 1.5 : 1));
    if (charmMod.vigor && ++pl.vigorN >= 20) { pl.vigorN = 0; if (pl.hp < maxHp()) { pl.hp++; floats.add(pl.x, pl.y - 30, '+1', C.green, { small: false, outline: C.ink }); sfx.heal(); } }
    const kb = fin ? P.finisherKnock : 1;
    let kx = pl.face * P.knockX * kb, ky = -P.knockY * kb;
    if (def.dir === 'up') { kx = pl.face * P.knockX * 0.3; ky = -P.knockY * 2.4; }
    if (def.dir === 'down') { kx = pl.face * P.knockX * 0.5; ky = P.knockY * 1.4; }
    const stop = (fin ? P.hitstopFinisher : P.hitstop) / 1000;
    if (e.type === 'dummy') { e.leanV += pl.face * (fin ? 9 : 5); e.flash = P.flashFrames / 60; }
    else damageEnemy(e, def.dmg, ang, { kx, ky, fin });
    hitstop = Math.max(hitstop, stop);
    e.shakeT = P.victimShake ? stop : 0;
    shake.add(fin ? P.shakeFinisher : P.shake, fin ? 260 : 150, Math.cos(ang), Math.sin(ang));
    if (pl.onGround) pl.vx -= pl.face * P.recoil;
    else if (def.dir === 'down') pogo();
    else pl.vy = Math.min(pl.vy, -P.airHitHop);
    const n = P.sparks;
    if (n > 0) {
      parts.burst(px, py, n, { speed: [60, 190], colors: [C.white, C.gold, C.orange], shape: 'line', len: 0.035, life: [0.12, 0.28], drag: 6 });
      parts.burst(px, py, Math.ceil(n / 2), { speed: [20, 80], colors: [C.gold, C.orange, C.red], shape: 'sq', size: 2, life: [0.2, 0.4], gravity: 200 });
      parts.add({ x: px, y: py, shape: 'star', size: fin ? 6 : 4, life: 0.12, colors: [C.white, C.gold] });
      if (fin) parts.add({ x: px, y: py, shape: 'ring', r0: 3, r1: 20, life: 0.22, colors: [C.white, C.gold, C.orange] });
    }
    const cc = bodyCenter(e);
    floats.add(cc.x + rand(-4, 4), cc.y - e.h / 2 - 4, e.type === 'dummy' ? (def.dmg * 10 + Math.floor(rand(0, 9))) : def.dmg, fin ? C.gold : C.white, { outline: C.ink });
    sfx.hit(combo - 1, fin);
  }
  /** 對敵人造成傷害（揮擊、鈴祓、劍氣、衝刺共用） */
  function damageEnemy(e, dmg, ang, o = {}) {
    if (e.dead || e.invisible || e.type === 'dummy') return;
    if (e.type === 'foxClone') { popClone(e); return; }
    e.hp -= dmg;
    e.flash = P.flashFrames / 60;
    const wgt = e.weight * P.enemyWeight;
    if (!e.d.boss && e.weight < 50) {
      const kx = o.kx ?? Math.cos(ang) * P.knockX * 1.4, ky = o.ky ?? Math.min(-40, Math.sin(ang) * P.knockY * 1.5);
      e.vx = kx / wgt; e.vy = ky / wgt;
      e.hitstun = P.hitstun / 1000 * (o.fin ? 1.5 : 1);
      if (!e.d.fly) e.onGround = false;
      if (e.type === 'spider' && e.state === 'hang') e.state = 'fall';
      if (e.type === 'weasel' && (e.state === 'dash' || e.state === 'crouch')) { e.state = 'rest'; e.stateT = 0.6; }
    } else if (e.weight >= 50 && !e.d.boss) e.hitstun = 0.12;
    if (e.d.boss) { e.hurtT = 0.12; if (o.spell) floats.add(e.x, e.y - 30, dmg, C.gold, { outline: C.ink }); }
    if (o.spell || o.dash || o.shot) { const c = bodyCenter(e); parts.add({ x: c.x, y: c.y, shape: 'star', size: 5, life: 0.12, colors: [C.white, C.gold] }); if (!o.spell) floats.add(c.x, c.y - e.h / 2 - 4, dmg, C.white, { outline: C.ink }); sfx.hit(combo, false); combo++; comboT = 1.8; lastHit = time; }
    if (e.hp <= 0) killEnemy(e);
  }
  function killEnemy(e) {
    if (e.dead) return;
    if (e.d.boss) { bossDefeated(e); return; }
    e.dead = true;
    const c = bodyCenter(e);
    const cols = e.type === 'lantern' || e.type === 'fox' ? [C.gold, C.orange, C.red, C.dwood] : e.type === 'onibi' ? [C.green, C.dgreen, C.white] : e.type === 'weasel' || e.type === 'tanuki' ? [C.orange, C.wood, C.gold, C.skin] : [C.lav, C.violet, C.pink, C.indigo];
    parts.burst(c.x, c.y, 22, { speed: [40, 160], colors: cols, shape: 'sq', size: 3, shrink: 1, life: [0.35, 0.7], gravity: 160, drag: 2 });
    parts.add({ x: c.x, y: c.y, shape: 'ring', r0: 2, r1: 22, life: 0.3, colors: [C.white, C.green, C.dgreen] });
    for (let i = 0; i < 6; i++) parts.add({ x: c.x + rand(-6, 6), y: c.y + rand(-4, 4), vx: rand(-10, 10), vy: rand(-45, -20), life: rand(0.8, 1.4), colors: [C.white, C.green, C.green, C.dgreen], shape: 'sq', size: 2, shrink: 0.5, drag: 1 });
    shake.add(P.shake + 1, 200);
    sfx.die(e.type);
    if (!e.noDrop) {
      spawnCoins(c.x, c.y, e.d.coins);
      if (Math.random() < 0.08) pickups.push({ kind: 'dango', x: c.x, y: c.y, vx: rand(-30, 30), vy: -140, t: 0 });
    }
  }
  function spawnCoins(x, y, n) {
    n *= charmMod.coins;
    for (let i = 0; i < n; i++) pickups.push({ kind: 'coin', x: x + rand(-3, 3), y: y + rand(-3, 3), vx: rand(-70, 70), vy: rand(-190, -100), t: rand(0, 1), life: 9 });
  }
  function openChest(p) {
    if (p.open) return;
    p.open = true;
    sfx.chest();
    parts.burst(p.x, p.y - 10, 24, { speed: [40, 140], colors: [C.white, C.gold, C.orange], shape: 'star', size: 2, life: [0.4, 0.8], gravity: 60 });
    env.save.chests[st.id] = true;
    const id = st.chest;
    if (id && !env.save.charms.includes(id)) {
      env.save.charms.push(id);
      env.persist();
      hooks.onCharm && hooks.onCharm(id);
    } else { spawnCoins(p.x, p.y - 10, 10); env.persist(); }
  }

  // ---------------- 敵人 ----------------
  function groundPhys(e, dt, grav = 900) {
    const wasG = e.onGround;
    e.vy = Math.min(420, e.vy + grav * dt);
    const hx = moveX(e, e.vx * dt);
    const hy = moveY(e, e.vy * dt);
    if (hy === -1) e.vy = 0;
    e.onGround = hy >= 1 || (e.vy >= 0 && groundBelow(e));
    if (e.onGround) { if (!wasG && e.vy > 150) parts.burst(e.x, e.y, 3, { dir: -Math.PI / 2, spread: 2.5, speed: [10, 30], colors: [C.lav, C.violet], shape: 'sq', size: 1, life: [0.2, 0.3] }); e.vy = 0; }
    if (e.y > WH + 30) { e.dead = true; }
    return hx;
  }
  function fireShot(o) { shots.push({ r: 3, life: 4, deflect: true, grav: 0, dead: false, t: 0, ...o }); sfx.shoot(); }
  function aimAt(x, y, speed, tx = pl.x, ty = pl.y - 11) { const a = Math.atan2(ty - y, tx - x); return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed }; }
  function lob(x, y, t, grav, tx = pl.x, ty = pl.y - 8) { return { vx: (tx - x) / t, vy: (ty - y - 0.5 * grav * t * t) / t }; }

  function updateEnemy(e, dt) {
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.hurtT > 0) e.hurtT -= dt;
    if (e.dead) return;
    if (e.d.boss || e.type === 'foxClone') { BOSS_AI[e.type](e, dt); bossContact(e); return; }
    const aggro = P.enemyAggro && !pl.dead;
    const dxp = pl.x - e.x, c0 = bodyCenter(e), dist = Math.hypot(dxp, pl.y - 12 - c0.y);
    if (e.type === 'dummy') { e.leanV += -e.lean * 140 * dt; e.leanV *= Math.exp(-5 * dt); e.lean += e.leanV * dt; return; }
    if (e.hitstun > 0) {
      e.hitstun -= dt;
      if (e.d.fly) { const k = Math.exp(-3.5 * dt); e.vx *= k; e.vy *= k; e.x += e.vx * dt; e.y += e.vy * dt; flyerWalls(e, dt); }
      else if (e.weight < 50) { if (e.onGround) e.vx = approach(e.vx, 0, 500 * dt); groundPhys(e, dt); }
      return;
    }
    switch (e.type) {
      case 'lantern': {
        let tx = e.hx + Math.sin(e.t * 1.3) * 14, ty = e.hy + Math.sin(e.t * 2.1) * 6;
        if (aggro && dist < 120 && Math.hypot(pl.x - e.hx, pl.y - e.hy) < 170) { tx = pl.x; ty = pl.y - 14; }
        steer(e, tx, ty, 34, dt);
        e.face = sign(pl.x - e.x) || e.face;
        flyerWalls(e, dt);
        break;
      }
      case 'umbrella': {
        if (e.onGround) {
          e.vx = approach(e.vx, 0, 900 * dt);
          e.hopT -= dt;
          if (e.hopT <= 0) {
            const chase = aggro && Math.abs(dxp) < 170 && Math.abs(pl.y - e.y) < 70;
            e.face = chase ? (sign(dxp) || 1) : (Math.abs(e.x - e.hx) > 40 ? sign(e.hx - e.x) : (Math.random() < 0.5 ? -1 : 1));
            e.vx = e.face * (chase ? 62 : 25); e.vy = chase ? -210 : -150; e.onGround = false;
            e.hopT = chase ? rand(0.7, 1.2) : rand(1.2, 2);
          }
        }
        if (groundPhys(e, dt)) e.vx *= -0.4;
        break;
      }
      case 'fox': {
        e.face = sign(dxp) || e.face;
        groundPhys(e, dt);
        if (e.state === 'charge') {
          e.stateT -= dt;
          if (Math.random() < 0.4) parts.add({ x: e.x + e.face * 9 + rand(-5, 5), y: e.y - 11 + rand(-5, 5), vx: 0, vy: 0, ax: 0, life: 0.2, colors: [C.gold, C.orange], shape: 'px' });
          if (e.stateT <= 0) {
            const mx = e.x + e.face * 9, my = e.y - 11;
            fireShot({ kind: 'fire', x: mx, y: my, ...aimAt(mx, my, 95), r: 4 });
            e.state = 'idle'; e.cd = 2.4;
          }
        } else if (aggro && Math.abs(dxp) < 210 && Math.abs(pl.y - e.y) < 100 && (e.cd -= dt) <= 0) { e.state = 'charge'; e.stateT = 0.6; sfx.telegraph(); }
        break;
      }
      case 'weasel': {
        e.stateT -= dt; e.cd -= dt;
        if (e.state === 'crouch') {
          e.vx = 0;
          if (e.stateT <= 0) { e.state = 'dash'; e.stateT = 0.5; }
        } else if (e.state === 'dash') {
          e.vx = e.face * 250;
          if (Math.random() < 0.6) parts.add({ x: e.x - e.face * 8, y: e.y - rand(2, 10), vx: -e.face * 60, vy: 0, life: 0.2, colors: [C.moon, C.lav], shape: 'line', len: 0.05 });
          if (e.stateT <= 0 || edgeAhead(e, e.face)) { e.state = 'rest'; e.stateT = 0.7; e.cd = 1.3; }
        } else if (e.state === 'rest') {
          e.vx = approach(e.vx, 0, 900 * dt);
          if (e.stateT <= 0) e.state = 'idle';
        } else {
          if (Math.abs(e.x - e.hx) > 48 || edgeAhead(e, e.face)) e.face = sign(e.hx - e.x) || -e.face;
          e.vx = e.face * 32;
          if (aggro && e.cd <= 0 && Math.abs(dxp) < 140 && Math.abs(pl.y - e.y) < 40) { e.face = sign(dxp) || e.face; e.state = 'crouch'; e.stateT = 0.45; sfx.telegraph(); floats.add(e.x, e.y - 18, '!', C.gold, { small: false, outline: C.ink, life: 0.4, vy: -10 }); }
        }
        if (groundPhys(e, dt)) { e.face = -e.face; if (e.state === 'dash') { e.state = 'rest'; e.stateT = 0.7; } }
        break;
      }
      case 'tanuki': {
        e.face = sign(dxp) || e.face;
        e.stateT -= dt;
        if (e.onGround) e.vx = approach(e.vx, 0, 700 * dt);
        if (e.state === 'throw') {
          if (e.stateT <= 0) { e.state = 'idle'; e.cd = rand(1.8, 2.6); }
        } else if (aggro && e.onGround && Math.abs(dxp) < 40 && Math.abs(pl.y - e.y) < 30 && e.cd < 1.5) {
          e.vx = -sign(dxp) * 90; e.vy = -190; e.onGround = false; e.cd = 1.5;
        } else if (aggro && Math.abs(dxp) < 180 && Math.abs(pl.y - e.y) < 120 && (e.cd -= dt) <= 0 && e.onGround) {
          e.state = 'throw'; e.stateT = 0.35;
          const hx = e.x + e.face * 6, hy = e.y - 16;
          fireShot({ kind: 'leaf', x: hx, y: hy, ...lob(hx, hy, 0.95, 420), grav: 420, r: 4, spin: 0 });
        }
        groundPhys(e, dt);
        break;
      }
      case 'noh': {
        e.stateT -= dt;
        e.invisible = e.state === 'hidden';
        if (e.state === 'hidden') {
          if (e.stateT <= 0) {
            // 在玩家附近現身
            const side = Math.random() < 0.5 ? -1 : 1;
            let nx = pl.x + side * rand(55, 80), ny = pl.y - rand(30, 50);
            for (let k = 0; k < 6 && (isSolidT(Math.floor(nx / T), Math.floor(ny / T)) || nx < (arena ? arena.x0 : 20) || nx > WW - 20); k++) { nx = pl.x - side * rand(40, 80); ny -= 10; }
            e.x = nx; e.y = ny; e.state = 'appear'; e.stateT = 0.45;
            parts.add({ x: e.x, y: e.y, shape: 'ring', r0: 14, r1: 2, life: 0.3, colors: [C.moon, C.white] });
          }
        } else if (e.state === 'appear') { if (e.stateT <= 0) { e.state = 'idle'; e.stateT = rand(0.8, 1.3); } }
        else if (e.state === 'idle') {
          e.y += Math.sin(e.t * 3) * 6 * dt;
          e.face = sign(dxp) || e.face;
          if (e.stateT <= 0) { if (aggro && dist < 200) { e.state = 'attack'; e.stateT = 0.5; sfx.telegraph(); } else e.stateT = 0.8; }
        } else if (e.state === 'attack') {
          if (e.stateT <= 0) {
            const base = Math.atan2(pl.y - 11 - e.y, pl.x - e.x);
            for (const off of [-0.3, 0, 0.3]) fireShot({ kind: 'wisp', x: e.x, y: e.y + 2, vx: Math.cos(base + off) * 62, vy: Math.sin(base + off) * 62, r: 3, life: 4, noWall: true });
            e.state = 'vanishWait'; e.stateT = 0.8;
          }
        } else if (e.state === 'vanishWait') { if (e.stateT <= 0) { e.state = 'vanish'; e.stateT = 0.4; } }
        else if (e.state === 'vanish') { if (e.stateT <= 0) { e.state = 'hidden'; e.stateT = rand(0.8, 1.4); } }
        break;
      }
      case 'momen': {
        e.stateT -= dt;
        if (e.state === 'swoop') {
          steer(e, e.tx, e.ty, 150, dt, 0.08);
          if (e.stateT <= 0 || Math.hypot(e.tx - e.x, e.ty - e.y) < 6) { e.state = 'rise'; e.stateT = 1.5; }
        } else if (e.state === 'rise') {
          steer(e, e.x + e.dir * 40, e.hy, 70, dt, 0.2);
          if (Math.abs(e.y - e.hy) < 6 || e.stateT <= 0) { e.state = 'idle'; e.cd = 1.2; }
        } else {
          e.cd -= dt;
          if (Math.abs(e.x - e.hx) > 90) e.dir = sign(e.hx - e.x);
          e.vx = approach(e.vx, e.dir * 50, 200 * dt);
          e.vy = Math.cos(e.t * 2.2) * 26;
          e.x += e.vx * dt; e.y += e.vy * dt;
          if (aggro && e.cd <= 0 && Math.abs(dxp) < 60 && pl.y - 10 > e.y && pl.y - e.y < 120) { e.state = 'swoop'; e.stateT = 0.9; e.tx = pl.x + sign(dxp) * 10; e.ty = pl.y - 10; sfx.telegraph(); }
        }
        flyerWalls(e, dt);
        e.face = sign(e.vx) || e.face;
        e.trail.unshift({ x: e.x, y: e.y }); e.trail.length = 9;
        break;
      }
      case 'spider': {
        if (e.state === 'hang') {
          e.y = e.hangY + Math.sin(e.t * 2) * 2;
          if (aggro && Math.abs(dxp) < 34 && pl.y > e.y && pl.y - e.y < 200) { e.state = 'fall'; e.vy = 60; sfx.telegraph(); }
        } else if (e.state === 'fall') {
          groundPhys(e, dt, 1100);
          if (e.onGround) { e.state = 'crawl'; e.face = sign(dxp) || 1; parts.burst(e.x, e.y, 4, { dir: -Math.PI / 2, spread: 2.6, speed: [15, 40], colors: [C.lav, C.violet], shape: 'sq', size: 1, life: [0.2, 0.3] }); }
        } else {
          if (aggro && Math.abs(dxp) > 6 && Math.abs(pl.y - e.y) < 40) e.face = sign(dxp);
          if (edgeAhead(e, e.face)) e.face = -e.face;
          e.vx = e.face * 55;
          if (groundPhys(e, dt)) e.face = -e.face;
        }
        break;
      }
      case 'onibi': {
        e.stateT -= dt;
        if (e.state === 'aim') {
          e.x += rand(-0.6, 0.6);
          if (e.stateT <= 0) { e.state = 'dive'; e.stateT = 0.8; const v = aimAt(e.x, e.y, 150); e.vx = v.vx; e.vy = v.vy; }
        } else if (e.state === 'dive') {
          e.x += e.vx * dt; e.y += e.vy * dt;
          if (Math.random() < 0.8) parts.add({ x: e.x, y: e.y, vx: -e.vx * 0.2, vy: -e.vy * 0.2, life: 0.3, colors: [C.white, C.green, C.dgreen], shape: 'sq', size: 2 });
          if (e.stateT <= 0) { e.state = 'return'; }
        } else if (e.state === 'return') {
          steer(e, e.hx, e.hy, 60, dt);
          if (Math.hypot(e.hx - e.x, e.hy - e.y) < 6) { e.state = 'idle'; e.cd = rand(1.2, 2); }
        } else {
          const a = e.t * 1.6;
          steer(e, e.hx + Math.cos(a) * 14, e.hy + Math.sin(a * 1.3) * 8, 40, dt);
          if (aggro && (e.cd -= dt) <= 0 && dist < 120) { e.state = 'aim'; e.stateT = 0.55; sfx.telegraph(); }
        }
        break;
      }
    }
    // 接觸傷害
    if (!e.dead && !e.d.harmless && e.hitstun <= 0 && !e.invisible && !(e.type === 'noh' && e.state !== 'idle' && e.state !== 'attack') && P.enemyAggro) {
      const c = bodyCenter(e);
      if (Math.abs(c.x - pl.x) < (e.w / 2 + pl.w / 2 - 2) && Math.abs(c.y - (pl.y - pl.h / 2)) < (e.h / 2 + pl.h / 2 - 3)) hurtPlayer(e);
    }
  }
  function steer(e, tx, ty, speed, dt, half = 0.25) {
    const dx = tx - e.x, dy = ty - e.y, m = Math.hypot(dx, dy) || 1;
    const sp = Math.min(speed, m * 2.5);
    e.vx += (dx / m * sp - e.vx) * smoothK(dt, half);
    e.vy += (dy / m * sp - e.vy) * smoothK(dt, half);
    e.x += e.vx * dt; e.y += e.vy * dt;
  }
  function flyerWalls(e, dt) {
    if (e.type === 'onibi' || e.type === 'noh') return;
    const tx = Math.floor(e.x / T), ty = Math.floor(e.y / T);
    if (isSolidT(tx, ty)) { e.x -= e.vx * dt * 2; e.y -= e.vy * dt * 2; e.vx *= -0.5; e.vy *= -0.5; if (e.dir) e.dir = -e.dir; }
    e.x = clamp(e.x, 10, WW - 10); e.y = clamp(e.y, 8, WH - 8);
  }

  // ---------------- 飛行道具 ----------------
  function popShot(s, deflected) {
    const cols = s.kind === 'leaf' ? [C.green, C.dgreen] : s.kind === 'wisp' || s.kind === 'foxfire' ? [C.white, C.moon, C.lav] : s.kind === 'shard' ? [C.white, C.red, C.pink] : [C.gold, C.orange, C.red];
    parts.burst(s.x, s.y, deflected ? 8 : 5, { speed: [30, 100], colors: cols, shape: 'sq', size: 2, life: [0.15, 0.35] });
    if (deflected) { parts.add({ x: s.x, y: s.y, shape: 'star', size: 4, life: 0.1, colors: [C.white, C.gold] }); sfx.clink(); }
  }
  function updateShots(dt) {
    for (const s of shots) {
      s.t += dt;
      if (s.kind === 'sickle') {
        s.vx += s.ax * dt;
        if (s.owner && !s.owner.dead && s.t > 0.4 && Math.abs(s.x - s.owner.x) < 14 && Math.sign(s.vx) === Math.sign(s.owner.x - s.x)) s.dead = true;
      }
      if (s.kind === 'foxfire' && s.orbit) {
        const o = s.orbit;
        if (o.owner.dead || o.owner.invisible && o.owner.type !== 'bossFox') { s.dead = true; continue; }
        o.a += dt * 3.2;
        s.x = o.owner.x + Math.cos(o.a) * o.r; s.y = o.owner.y - 16 + Math.sin(o.a) * o.r;
        if (s.t >= o.release) { const v = aimAt(s.x, s.y, 120); s.vx = v.vx; s.vy = v.vy; s.orbit = null; sfx.shoot(); }
        continue;
      }
      if (s.kind === 'rock') {
        if (s.t < s.delay) continue;
        s.vy = Math.min(360, s.vy + 900 * dt);
      }
      s.vy += s.grav * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.life -= dt;
      if (s.kind === 'wave') {
        s.x = clamp(s.x, arena ? arena.x0 : 0, arena ? arena.x1 : WW);
        if (arena && (s.x <= arena.x0 + 2 || s.x >= arena.x1 - 2)) s.dead = true;
      }
      if (s.life <= 0) s.dead = true;
      if (!s.noWall && s.kind !== 'wave' && isSolidT(Math.floor(s.x / T), Math.floor(s.y / T))) {
        s.dead = true; popShot(s);
        if (s.kind === 'rock') { shake.add(2, 120); sfx.brk(); }
      }
      if (s.dead) continue;
      const hh = s.kind === 'wave' ? 10 : s.r;
      if (!pl.dead && Math.abs(s.x - pl.x) < pl.w / 2 + s.r - 1 && Math.abs(s.y - (pl.y - 11)) < 11 + hh - 2) {
        if (hurtPlayer(s)) { if (s.kind !== 'wave' && s.kind !== 'sickle') { s.dead = true; popShot(s); } }
      }
    }
    shots = shots.filter(s => !s.dead);
    for (const p of pshots) {
      p.x += p.vx * dt; p.life -= dt;
      if (isSolidT(Math.floor(p.x / T), Math.floor(p.y / T))) p.life = 0;
      for (const e of enemies) {
        if (e.dead || p.hit.has(e) || e.invisible || e.type === 'dummy') continue;
        const c = bodyCenter(e);
        if (Math.abs(c.x - p.x) < e.w / 2 + 8 && Math.abs(c.y - p.y) < e.h / 2 + 8) { p.hit.add(e); damageEnemy(e, 2, p.vx > 0 ? 0 : Math.PI, { shot: true }); }
      }
      for (const s of shots) if (!s.dead && s.deflect !== false && Math.hypot(s.x - p.x, s.y - p.y) < 10) { s.dead = true; popShot(s, true); }
    }
    pshots = pshots.filter(p => p.life > 0);
  }

  // ---------------- 收集品 ----------------
  function updatePickups(dt) {
    for (const k of pickups) {
      k.t += dt;
      if (!k.fixed) {
        if (k.life != null && (k.life -= dt) <= 0) { k.done = true; continue; }
        k.vy = Math.min(300, k.vy + 520 * dt);
        k.x += k.vx * dt;
        if (isSolidT(Math.floor(k.x / T), Math.floor(k.y / T))) { k.x -= k.vx * dt; k.vx *= -0.5; }
        const ny = k.y + k.vy * dt;
        const ty = Math.floor((ny + 3) / T);
        if (k.vy > 0 && (isSolidT(Math.floor(k.x / T), ty) || isOneWayT(Math.floor(k.x / T), ty)) && k.y + 3 <= ty * T + 1) { k.y = ty * T - 3; k.vy = k.vy > 60 ? -k.vy * 0.4 : 0; k.vx *= 0.7; }
        else k.y = ny;
        if (k.y > WH + 20) k.done = true;
      }
      if (pl.dead) continue;
      const dx = pl.x - k.x, dy = pl.y - 11 - k.y, d = Math.hypot(dx, dy);
      if (k.kind === 'coin' && d < charmMod.magnet && (!k.fixed || d < 20) && k.t > 0.25) { const sp = 160 + (charmMod.magnet - d) * 4; k.x += dx / d * sp * dt; k.y += dy / d * sp * dt; }
      if (d < 11) collect(k);
    }
    pickups = pickups.filter(k => !k.done);
  }
  function collect(k) {
    if (k.kind === 'coin') {
      if (k.t < 0.15 && !k.fixed) return;
      k.done = true; coinsGot++; env.save.coins++;
      parts.add({ x: k.x, y: k.y, shape: 'star', size: 2, life: 0.12, colors: [C.white, C.gold] });
      sfx.coin();
    } else if (k.kind === 'dango') {
      k.done = true;
      pl.hp = Math.min(maxHp(), pl.hp + 1);
      floats.add(k.x, k.y - 10, '+1', C.pink, { small: false, outline: C.ink });
      sfx.heal();
    } else if (k.kind === 'bell') {
      k.done = true;
      const arr = env.save.bells[st.id] || (env.save.bells[st.id] = [false, false, false]);
      const before = env.totalBells();
      const wasHad = arr[k.index];
      arr[k.index] = true;
      env.persist();
      parts.add({ x: k.x, y: k.y, shape: 'ring', r0: 4, r1: 30, life: 0.5, colors: [C.white, C.gold, C.orange] });
      parts.burst(k.x, k.y, 20, { speed: [40, 140], colors: [C.white, C.gold], shape: 'star', size: 2, life: [0.4, 0.8] });
      sfx.bellGet();
      if (!wasHad) {
        const after = env.totalBells();
        const up = Math.floor(after / 3) > Math.floor(before / 3);
        if (up) pl.hp = maxHp();
        toast(up ? `金鈴 ${after}／12　最大體力提升！` : `獲得金鈴　${after}／12`);
      } else toast('這個金鈴已經收集過了');
    }
  }
  function toast(text) { toasts.push({ text, t: 0 }); if (toasts.length > 3) toasts.shift(); }

  // ---------------- 場景物件 ----------------
  function updateProps(dt) {
    for (const p of props) {
      if (p.kind === 'toro') {
        if (!p.lit && !pl.dead && Math.abs(pl.x - p.x) < 14 && Math.abs(pl.y - p.y) < 20) {
          p.lit = true; checkpoint = { x: p.x, y: p.y };
          pl.hp = maxHp();
          parts.add({ x: p.x, y: p.y - 8, shape: 'ring', r0: 3, r1: 26, life: 0.45, colors: [C.white, C.gold, C.orange] });
          parts.burst(p.x, p.y - 8, 14, { speed: [20, 70], colors: [C.gold, C.orange, C.white], shape: 'sq', size: 1, life: [0.4, 0.8], gravity: -40 });
          toast('點亮石燈籠：重生點已更新，體力全滿');
          sfx.toro();
        }
      } else if (p.kind === 'chime') { p.t += dt; if (p.ring > 0) p.ring = Math.max(0, p.ring - dt * 1.4); }
      else if (p.kind === 'drum') { if (p.squash > 0) p.squash -= dt; }
      else if (p.kind === 'offering') { if (p.flash > 0) p.flash -= dt; }
      else if (p.kind === 'chest') {
        if (!p.open && !pl.dead && pl.onGround && Math.abs(pl.x - p.x) < 12 && Math.abs(pl.y - p.y) < 6) openChest(p);
      }
    }
  }
  function updateMovers(dt) {
    for (const m of movers) {
      m.t += dt;
      const px = m.x, py = m.y;
      const u = 0.5 - 0.5 * Math.cos(m.t * m.speed);
      if (m.kind === 'h') m.x = m.x0 + m.range * u; else m.y = m.y0 + m.range * u;
      m.dx = m.x - px; m.dy = m.y - py;
    }
    if (pl.onPlat && !pl.dead) {
      const m = pl.onPlat;
      if (m.dx) moveX(pl, m.dx);
      pl.y = m.y;
    }
  }

  // ---------------- 結界與守護妖 ----------------
  function checkArena() {
    if (arena || !map.gate || pl.dead) return;
    const x0 = (map.gate.tx - 1) * T;
    if (pl.x > x0 + 3 * T) startBoss(x0);
  }
  function startBoss(x0) {
    const groundTop = groundY(map.gate.tx + 2, map.gate.ty);
    arena = { x0, x1: WW, ground: groundTop, top: groundTop - 150, camY: clamp(groundTop + 24 - H, 0, WH - H), cleared: false };
    const type = BOSS_TYPE[st.boss];
    boss = makeBoss(type);
    enemies.push(boss);
    enemies = enemies.filter(e => e === boss || e.x > x0 - 40 || e.dead); // 結界外的小怪不理它
    parts.add({ x: x0 + 4, y: groundTop - 40, shape: 'ring', r0: 4, r1: 40, life: 0.5, colors: [C.white, C.lav] });
    sfx.roar();
    hooks.onBossStart && hooks.onBossStart(st);
  }
  function makeBoss(type) {
    const d = ED[type];
    const hp = Math.round(d.hp * P.bossHp);
    const cx = (arena.x0 + arena.x1) / 2;
    const b = { type, d, boss: true, hp, maxHp: hp, flash: 0, hurtT: 0, hitstun: 0, vx: 0, vy: 0, dead: false, t: 0, shakeT: 0, face: -1, w: d.w, h: d.h, weight: 99, phase: 1, state: 'intro', stateT: 0, last: null, onGround: false };
    if (type === 'bossLantern') Object.assign(b, { x: cx + 40, y: arena.top - 30, hoverY: arena.ground - 66 });
    if (type === 'bossWeasel') Object.assign(b, { x: arena.x1 - 30, y: arena.ground, onGround: true, dashes: 0 });
    if (type === 'bossFox') Object.assign(b, { x: cx + 60, y: arena.ground, baseY: arena.ground, alpha: 0, anchors: foxAnchors() });
    if (type === 'bossSerpent') Object.assign(b, { x: arena.x1 - 26, y: arena.ground + 20, hist: [], segs: [], hidden: true, pool: 1 });
    return b;
  }
  function foxAnchors() {
    const g0 = arena.ground;
    // 兩片木板（第 8 列）與地面
    let plankY = g0;
    for (let ty = map.MH - 1; ty > 0; ty--) if (tileAt(map.gate.tx + 2, ty) === TILE.ONEWAY) { plankY = ty * T; break; }
    return [
      { x: arena.x0 + 64, y: plankY }, { x: arena.x1 - 64, y: plankY },
      { x: arena.x0 + 56, y: g0 }, { x: arena.x1 - 56, y: g0 }, { x: (arena.x0 + arena.x1) / 2, y: g0 },
    ];
  }
  function bossContact(e) {
    if (e.dead || e.state === 'intro' || e.state === 'dying' || e.invisible || !P.enemyAggro) return;
    if (e.type === 'bossSerpent') {
      if (!e.hidden && Math.hypot(pl.x - e.x, pl.y - 11 - e.y) < 13) hurtPlayer(e);
      for (const s of e.segs) if (s.vis && Math.hypot(pl.x - s.x, pl.y - 11 - s.y) < s.r + 5) { hurtPlayer(s); break; }
      return;
    }
    if (e.type === 'bossLantern' && e.tongue && e.tongue.len > 8) {
      const t = e.tongue;
      // 點到線段距離
      const ax = t.x, ay = t.y, bx = t.tx, by = t.ty, px = pl.x, py = pl.y - 11;
      const vx = bx - ax, vy = by - ay, u = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
      if (Math.hypot(ax + vx * u - px, ay + vy * u - py) < 8) hurtPlayer({ x: t.tx, y: t.ty });
    }
    const c = bodyCenter(e);
    if (Math.abs(c.x - pl.x) < e.w / 2 + pl.w / 2 - 4 && Math.abs(c.y - (pl.y - pl.h / 2)) < e.h / 2 + pl.h / 2 - 4) hurtPlayer(e);
  }
  function setPhase(b) {
    if (b.phase === 1 && b.hp <= b.maxHp / 2) {
      b.phase = 2;
      sfx.roar(); shake.add(4, 500);
      parts.add({ x: b.x, y: bodyCenter(b).y, shape: 'ring', r0: 6, r1: 60, life: 0.6, colors: [C.white, C.red, C.pink] });
      floats.add(b.x, b.y - 40, 'RAGE', C.red, { small: false, outline: C.ink, life: 1.2 });
      return true;
    }
    return false;
  }
  function choose(b, list) {
    const opts = list.filter(s => s !== b.last || list.length === 1);
    const s = pick(opts);
    b.last = s;
    return s;
  }
  function bossDefeated(b) {
    if (b.state === 'dying') return;
    b.state = 'dying'; b.stateT = 0; b.hp = 0;
    hitstop = 0.3;
    shake.add(6, 800);
    for (const s of shots) { s.dead = true; popShot(s); }
    for (const e of enemies) if (e !== b && !e.dead) { e.dead = true; killEnemy(e); }
    sfx.roar();
    finale = { t: 0, boss: b };
  }
  function updateFinale(dt) {
    const b = finale.boss;
    finale.t += dt;
    const c = bodyCenter(b);
    if (finale.t < 1.6) {
      if (Math.random() < 0.5) {
        parts.burst(c.x + rand(-b.w / 2, b.w / 2), c.y + rand(-b.h / 2, b.h / 2), 6, { speed: [30, 120], colors: [C.white, C.gold, C.orange, C.lav], shape: 'sq', size: 2, life: [0.3, 0.6] });
        if (Math.random() < 0.3) sound.bell({ f: pick([523, 659, 784, 1047]), dur: 0.8, vol: 0.08 });
      }
      b.shakeT = 0.1;
    } else if (!b.dead) {
      b.dead = true;
      parts.add({ x: c.x, y: c.y, shape: 'ring', r0: 6, r1: 90, life: 0.7, colors: [C.white, C.gold, C.moon] });
      parts.burst(c.x, c.y, 50, { speed: [60, 220], colors: [C.white, C.gold, C.moon, C.pink], shape: 'star', size: 3, life: [0.6, 1.2], drag: 2 });
      spawnCoins(c.x, c.y, b.d.coins / charmMod.coins);
      shake.add(6, 500);
      sfx.burst();
    }
    if (finale.t > 3.2 && !finale.done) {
      finale.done = true;
      arena.cleared = true;
      for (const k of pickups) if (k.kind === 'coin' && !k.fixed) { k.done = true; coinsGot++; env.save.coins++; }
      pickups = pickups.filter(k => !k.done);
      env.persist();
      hooks.onClear && hooks.onClear({ stage: stageIndex, time: stageTime, deaths, coins: coinsGot, bells: (env.save.bells[st.id] || []).filter(Boolean).length });
    }
  }

  // ---- 守護妖 AI
  const BOSS_AI = {
    bossLantern(b, dt) {
      if (b.state === 'dying') return;
      b.stateT += dt;
      const p2 = b.phase === 2;
      const minX = arena.x0 + 34, maxX = arena.x1 - 34;
      const floatTo = (tx, ty, sp) => { b.x += clamp(tx - b.x, -sp * dt, sp * dt); b.y += (ty - b.y) * smoothK(dt, 0.25); };
      b.face = sign(pl.x - b.x) || b.face;
      if (setPhase(b)) { b.state = 'float'; b.stateT = 0; b.tongue = null; }
      switch (b.state) {
        case 'intro':
          b.y += (b.hoverY - b.y) * smoothK(dt, 0.35);
          if (b.stateT > 1.8) { b.state = 'float'; b.stateT = 0; }
          break;
        case 'float':
          floatTo(clamp(pl.x, minX, maxX), b.hoverY + Math.sin(b.stateT * 2.2) * 6, p2 ? 60 : 40);
          if (b.stateT > (p2 ? 0.9 : 1.4)) { b.state = choose(b, ['spit', 'tongue', 'slam']); b.stateT = 0; b.shotN = 0; }
          break;
        case 'spit': {
          floatTo(b.x, b.hoverY, 20);
          b.mouth = b.stateT > 0.1;
          const n = p2 ? 5 : 3, gap = p2 ? 0.18 : 0.25;
          if (b.stateT > 0.55 + b.shotN * gap && b.shotN < n) {
            const mx = b.x, my = b.y + 10;
            const spread = (b.shotN - (n - 1) / 2) * 26;
            fireShot({ kind: 'fire', x: mx, y: my, ...lob(mx, my, 0.9, 380, pl.x + spread, arena.ground - 4), grav: 380, r: 4 });
            b.shotN++;
          }
          if (b.stateT > 0.8 + n * gap) { b.mouth = false; b.state = 'float'; b.stateT = 0; }
          break;
        }
        case 'tongue': {
          b.mouth = true;
          const mx = b.x + b.face * 4, my = b.y + 12;
          if (!b.tongue) b.tongue = { x: mx, y: my, tx: mx, ty: my, len: 0, ang: 0, sweep: 0 };
          const t = b.tongue;
          t.x = mx; t.y = my;
          const L = p2 ? 116 : 96;
          if (b.stateT < 0.5) { t.len = 6 + Math.sin(b.stateT * 40) * 2; t.ang = Math.atan2(pl.y - 10 - my, pl.x - mx); if (b.stateT < 0.05) sfx.telegraph(); }
          else if (b.stateT < 0.75) t.len = lerp(6, L, (b.stateT - 0.5) / 0.25);
          else if (b.stateT < (p2 ? 1.5 : 1.1)) { t.len = L; if (p2) t.ang += dt * 1.6 * (b.face > 0 ? 1 : -1); }
          else t.len = Math.max(0, t.len - L * dt / 0.3);
          t.tx = mx + Math.cos(t.ang) * t.len; t.ty = my + Math.sin(t.ang) * t.len;
          if (t.ty > arena.ground - 2) { t.ty = arena.ground - 2; }
          if (b.stateT > (p2 ? 1.85 : 1.45)) { b.tongue = null; b.mouth = false; b.state = 'float'; b.stateT = 0; }
          break;
        }
        case 'slam':
          b.mouth = false;
          b.vy = -320; b.y += b.vy * dt;
          if (b.y < arena.top - 70) { b.state = 'hover'; b.stateT = 0; }
          break;
        case 'hover':
          b.x += clamp(pl.x - b.x, -200 * dt, 200 * dt);
          b.x = clamp(b.x, minX, maxX);
          if (b.stateT > (p2 ? 0.7 : 0.95)) { b.state = 'drop'; b.stateT = 0; b.vy = 120; }
          break;
        case 'drop':
          b.vy = Math.min(560, b.vy + 1400 * dt); b.y += b.vy * dt;
          if (b.y + b.h / 2 >= arena.ground) {
            b.y = arena.ground - b.h / 2;
            sfx.slam(); shake.add(6, 400, 0, 1);
            parts.burst(b.x, arena.ground, 20, { dir: -Math.PI / 2, spread: 2.8, speed: [40, 140], colors: [C.moon, C.lav, C.violet], shape: 'sq', size: 2, life: [0.3, 0.6], gravity: 300 });
            for (const d of [-1, 1]) fireShot({ kind: 'wave', x: b.x + d * 18, y: arena.ground - 6, vx: d * (p2 ? 190 : 150), vy: 0, r: 5, life: 3, deflect: false });
            if (p2) for (const d of [-1, 1]) { const m = makeEnemy('lantern', 0, 0); m.x = m.hx = b.x + d * 50; m.y = m.hy = arena.ground - 90; m.noDrop = true; enemies.push(m); }
            b.state = 'dizzy'; b.stateT = 0;
          }
          break;
        case 'dizzy':
          if (b.stateT > (p2 ? 1.3 : 1.8)) { b.state = 'rise'; b.stateT = 0; }
          break;
        case 'rise':
          b.y += (b.hoverY - b.y) * smoothK(dt, 0.2);
          if (b.stateT > 0.7) { b.state = 'float'; b.stateT = 0; }
          break;
      }
      b.x = clamp(b.x, minX, maxX);
    },
    bossWeasel(b, dt) {
      if (b.state === 'dying') return;
      b.stateT += dt;
      const p2 = b.phase === 2;
      const wallL = arena.x0 + 16, wallR = arena.x1 - T - 16;
      if (setPhase(b)) { b.state = 'idle'; b.stateT = 0; }
      const grav = () => { b.vy = Math.min(500, b.vy + 1100 * dt); b.y += b.vy * dt; if (b.y >= arena.ground) { b.y = arena.ground; b.vy = 0; b.onGround = true; } else b.onGround = false; };
      switch (b.state) {
        case 'intro':
          b.vx = -200; b.x += b.vx * dt; b.face = -1;
          if (b.x < arena.x1 - 90) { b.vx = 0; b.state = 'idle'; b.stateT = -0.6; }
          break;
        case 'idle':
          b.face = sign(pl.x - b.x) || b.face;
          b.vx = approach(b.vx, 0, 900 * dt); b.x += b.vx * dt;
          grav();
          if (b.stateT > (p2 ? 0.45 : 0.7)) { b.state = choose(b, ['dash', 'dash', 'leap', 'throw']); b.stateT = 0; b.dashes = 0; if (b.state === 'dash') { b.state = 'dashPrep'; sfx.telegraph(); } }
          break;
        case 'dashPrep':
          b.face = sign(pl.x - b.x) || b.face;
          if (b.stateT > (b.dashes ? 0.28 : 0.45)) { b.state = 'dash'; b.stateT = 0; }
          break;
        case 'dash':
          b.vx = b.face * (p2 ? 360 : 320); b.x += b.vx * dt;
          if (Math.random() < 0.8) parts.add({ x: b.x - b.face * 14, y: b.y - rand(2, 14), vx: -b.face * 80, vy: 0, life: 0.2, colors: [C.moon, C.lav, C.white], shape: 'line', len: 0.06 });
          if (p2 && b.stateT % 0.06 < dt) b.ghosts = [...(b.ghosts || []).slice(-3), { x: b.x, y: b.y, age: 0, face: b.face }];
          if ((b.face > 0 && b.x >= wallR) || (b.face < 0 && b.x <= wallL)) {
            b.x = clamp(b.x, wallL, wallR); b.vx = 0; shake.add(2, 150);
            b.dashes++;
            if (p2 && b.dashes < 2) { b.face = -b.face; b.state = 'dashPrep'; b.stateT = 0; }
            else { b.state = 'dizzy'; b.stateT = 0; }
          }
          break;
        case 'leap': {
          if (b.stateT < dt * 1.5) { const wall = pl.x > (arena.x0 + arena.x1) / 2 ? wallL : wallR; b.leapWall = wall; b.vx = sign(wall - b.x) * 260; b.vy = -330; b.onGround = false; }
          b.x += b.vx * dt; grav();
          if ((b.vx > 0 && b.x >= wallR) || (b.vx < 0 && b.x <= wallL)) { b.x = clamp(b.x, wallL, wallR); b.state = 'cling'; b.stateT = 0; b.clingSide = b.x > (arena.x0 + arena.x1) / 2 ? 1 : -1; b.y = Math.min(b.y, arena.ground - 40); sfx.telegraph(); }
          else if (b.onGround && b.stateT > 0.2) { b.state = 'skid'; b.stateT = 0; }
          break;
        }
        case 'cling':
          b.face = -b.clingSide;
          if (b.stateT > (p2 ? 0.35 : 0.55)) {
            const t = 0.55, gv = 1100;
            b.vx = clamp((pl.x - b.x) / t, -380, 380); b.vy = (pl.y - 8 - b.y - 0.5 * gv * t * t) / t;
            b.state = 'pounce'; b.stateT = 0;
          }
          break;
        case 'pounce':
          b.x += b.vx * dt; grav(); b.x = clamp(b.x, wallL, wallR);
          if (Math.random() < 0.6) parts.add({ x: b.x, y: b.y - 8, vx: -b.vx * 0.2, vy: 0, life: 0.2, colors: [C.moon, C.lav], shape: 'line', len: 0.05 });
          if (b.onGround) { b.state = 'skid'; b.stateT = 0; shake.add(2.5, 150); parts.burst(b.x, b.y, 8, { dir: -Math.PI / 2, spread: 2.5, speed: [30, 90], colors: [C.green, C.dgreen], shape: 'sq', size: 2, life: [0.2, 0.4] }); }
          break;
        case 'skid':
          b.vx = approach(b.vx, 0, 700 * dt); b.x += b.vx * dt; b.x = clamp(b.x, wallL, wallR);
          if (b.stateT > 0.4) { b.state = 'idle'; b.stateT = 0; }
          break;
        case 'throw':
          b.face = sign(pl.x - b.x) || b.face;
          if (b.stateT > 0.3 && !b.thrown) {
            b.thrown = true;
            fireShot({ kind: 'sickle', x: b.x + b.face * 16, y: b.y - 8, vx: b.face * 300, vy: 0, ax: -b.face * 420, r: 6, life: 3, deflect: true, noWall: true, owner: b });
            if (p2) fireShot({ kind: 'sickle', x: b.x + b.face * 16, y: b.y - 36, vx: b.face * 260, vy: 0, ax: -b.face * 380, r: 6, life: 3, deflect: true, noWall: true, owner: b });
          }
          if (b.stateT > 1.3) { b.thrown = false; b.state = 'idle'; b.stateT = 0; }
          break;
        case 'dizzy':
          if (b.stateT > (p2 ? 0.8 : 1.1)) { b.state = 'idle'; b.stateT = 0; }
          break;
      }
      if (b.ghosts) { for (const gh of b.ghosts) gh.age += dt; b.ghosts = b.ghosts.filter(gh => gh.age < 0.2); }
    },
    bossFox(b, dt) {
      if (b.state === 'dying') return;
      b.stateT += dt;
      const p2 = b.phase === 2;
      if (setPhase(b)) { b.state = 'teleOut'; b.stateT = 0; b.next = 'clones'; }
      b.invisible = b.alpha < 0.5;
      const bob = -Math.abs(Math.sin(b.t * 2.5)) * 3;
      switch (b.state) {
        case 'intro':
          b.alpha = Math.min(1, b.stateT / 1.2);
          if (b.stateT > 1.6) { b.state = 'idle'; b.stateT = 0; }
          break;
        case 'idle':
          b.face = sign(pl.x - b.x) || b.face;
          b.y = b.baseY != null ? b.baseY + bob : b.y;
          if (b.stateT > (p2 ? 0.55 : 0.85)) {
            const near = Math.abs(pl.x - b.x) < 90 && Math.abs(pl.y - b.y) < 24;
            b.state = near ? 'claw' : choose(b, p2 ? ['foxfire', 'teleport', 'clones', 'foxfire'] : ['foxfire', 'teleport', 'foxfire']);
            if (b.state === 'teleport') { b.state = 'teleOut'; b.next = 'idle'; }
            if (b.state === 'clones') { b.state = 'teleOut'; b.next = 'clones'; }
            b.stateT = 0;
          }
          break;
        case 'foxfire':
          b.casting = true;
          if (b.stateT < dt * 1.5) {
            const n = p2 ? 6 : 5;
            for (let i = 0; i < n; i++) shots.push({ kind: 'foxfire', x: b.x, y: b.y - 16, vx: 0, vy: 0, r: 4, life: 5, grav: 0, t: 0, deflect: true, noWall: true, dead: false, orbit: { owner: b, a: i / n * TAU, r: 26, release: 1.0 + i * 0.18 } });
            sfx.telegraph();
          }
          if (b.stateT > 1.2 + (p2 ? 6 : 5) * 0.18) { b.casting = false; b.state = 'idle'; b.stateT = 0; }
          break;
        case 'claw':
          if (b.stateT < 0.3) { b.face = sign(pl.x - b.x) || b.face; if (b.stateT < dt * 1.5) sfx.telegraph(); }
          else if (b.stateT < 0.75) { b.x += b.face * 250 * dt; if (Math.random() < 0.7) parts.add({ x: b.x - b.face * 10, y: b.y - rand(6, 22), vx: -b.face * 60, vy: 0, life: 0.2, colors: [C.white, C.moon], shape: 'line', len: 0.05 }); }
          else { b.state = 'teleOut'; b.next = 'idle'; b.stateT = 0; }
          b.x = clamp(b.x, arena.x0 + 20, arena.x1 - 20);
          break;
        case 'teleOut':
          b.alpha = Math.max(0, 1 - b.stateT / 0.3);
          if (b.stateT > 0.35) {
            const cur = b.anchors.findIndex(a => Math.abs(a.x - b.x) < 4 && Math.abs(a.y - b.baseY) < 4);
            const choices = b.anchors.map((a, i) => i).filter(i => i !== cur);
            const ai = pick(choices), a = b.anchors[ai];
            b.x = a.x; b.baseY = a.y; b.y = a.y;
            if (b.next === 'clones') {
              const others = choices.filter(i => i !== ai).sort(() => Math.random() - 0.5).slice(0, 2);
              for (const i of others) { const cl = { ...makeEnemyRaw('foxClone'), x: b.anchors[i].x, y: b.anchors[i].y, baseY: b.anchors[i].y, alpha: 0, state: 'teleIn', stateT: 0, anchors: b.anchors, owner: b, face: -1 }; enemies.push(cl); }
            }
            b.state = 'teleIn'; b.stateT = 0;
          }
          break;
        case 'teleIn':
          b.alpha = Math.min(1, b.stateT / 0.3);
          if (b.stateT > 0.35) { b.state = b.next === 'clones' ? 'foxfire' : 'idle'; b.stateT = 0; b.next = null; }
          break;
      }
    },
    foxClone(c, dt) {
      c.stateT += dt;
      c.face = sign(pl.x - c.x) || c.face;
      c.invisible = c.alpha < 0.5;
      if (c.state === 'teleIn') { c.alpha = Math.min(1, c.stateT / 0.3); if (c.stateT > 0.35) { c.state = 'cast'; c.stateT = 0; } }
      else if (c.state === 'cast') {
        c.casting = true;
        c.y = c.baseY + Math.sin(c.t * 2.5) * 2;
        if (c.stateT < dt * 1.5) for (let i = 0; i < 3; i++) shots.push({ kind: 'foxfire', x: c.x, y: c.y - 16, vx: 0, vy: 0, r: 4, life: 5, grav: 0, t: 0, deflect: true, noWall: true, dead: false, orbit: { owner: c, a: i / 3 * TAU, r: 22, release: 1.1 + i * 0.25 } });
        if (c.stateT > 2.2) { c.state = 'fade'; c.stateT = 0; }
      } else if (c.state === 'fade') { c.alpha = Math.max(0, 1 - c.stateT / 0.3); if (c.stateT > 0.35) c.dead = true; }
      if (c.owner.dead || c.owner.state === 'dying') c.dead = true;
    },
    bossSerpent(b, dt) {
      if (b.state === 'dying') return;
      b.stateT += dt;
      const p2 = b.phase === 2;
      if (setPhase(b)) { hooks.onPhase && hooks.onPhase(2); }
      const poolX = [arena.x0 + 26, arena.x1 - 26];
      const G = arena.ground;
      b.hist.unshift({ x: b.x, y: b.y });
      if (b.hist.length > 400) b.hist.length = 400;
      switch (b.state) {
        case 'intro':
          b.hidden = true; b.x = poolX[1]; b.y = G + 24;
          if (b.stateT > 1.2) { b.state = 'arc'; b.stateT = 0; b.from = 1; }
          break;
        case 'submerged':
          b.hidden = true;
          if (b.stateT < dt * 1.5) { b.nextMove = Math.random() < (p2 ? 0.65 : 0.6) ? 'arc' : 'rise'; b.from = Math.random() < 0.5 ? 0 : 1; }
          b.x = poolX[b.from]; b.y = G + 24;
          if (b.stateT > (p2 ? 0.6 : 0.9)) { b.state = b.nextMove; b.stateT = 0; sfx.slam(); }
          break;
        case 'arc': {
          const dur = p2 ? 1.7 : 2.2;
          const u = Math.min(1, b.stateT / dur);
          const xa = poolX[b.from], xb = poolX[1 - b.from];
          b.x = lerp(xa, xb, u); b.y = G + 22 - Math.sin(Math.PI * u) * (p2 ? 132 : 118);
          b.face = sign(xb - xa);
          b.hidden = b.y > G + 6;
          b.angle = Math.atan2(-(p2 ? 132 : 118) * Math.PI * Math.cos(Math.PI * u) / dur, (xb - xa) / dur);
          if (p2 && Math.floor(b.stateT / 0.55) !== Math.floor((b.stateT - dt) / 0.55)) fireShot({ kind: 'rock', x: clamp(pl.x + rand(-40, 40), arena.x0 + 20, arena.x1 - 20), y: arena.top - 20, vx: 0, vy: 0, r: 5, delay: 0.7, life: 3, deflect: false, grav: 0 });
          if (u >= 1 && b.stateT > dur + 0.9) { b.state = 'submerged'; b.stateT = 0; }
          break;
        }
        case 'rise': {
          const top = G - 92;
          b.face = sign(pl.x - b.x) || b.face;
          b.angle = -Math.PI / 2;
          if (b.stateT < 0.6) b.y = lerp(G + 22, top, easeOut(b.stateT / 0.6));
          else if (b.stateT < 3.1) {
            b.y = top + Math.sin(b.stateT * 3) * 6;
            b.x = poolX[b.from] + Math.sin(b.stateT * 1.7) * 10;
            b.open = (b.stateT > 0.9 && b.stateT < 1.25) || (b.stateT > 1.9 && b.stateT < 2.25);
            for (const tt of [1.2, 2.2]) if (b.stateT >= tt && b.stateT - dt < tt) {
              const n = p2 ? 7 : 5, base = Math.atan2(pl.y - 11 - b.y, pl.x - b.x);
              for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.22; fireShot({ kind: 'shard', x: b.x + Math.cos(base) * 12, y: b.y + 4, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, r: 3, life: 4 }); }
            }
          } else { b.open = false; b.y += 260 * dt; if (b.y > G + 24) { b.state = 'submerged'; b.stateT = 0; } }
          b.hidden = b.y > G + 6;
          break;
        }
      }
      // 身體：沿著頭走過的路徑排列
      const segs = [];
      let acc = 0, idx = 0;
      for (let i = 0; i < 14; i++) {
        const spacing = 9;
        while (idx < b.hist.length - 1 && acc < spacing * (i + 1)) { acc += Math.hypot(b.hist[idx + 1].x - b.hist[idx].x, b.hist[idx + 1].y - b.hist[idx].y); idx++; }
        const p = b.hist[idx] || { x: b.x, y: G + 30 };
        const r = Math.max(4, 9 - i * 0.35);
        segs.push({ x: p.x, y: p.y, r, vis: p.y < G + 2 });
      }
      b.segs = segs;
      b.invisible = b.hidden;
    },
  };
  function makeEnemyRaw(type) {
    const d = ED[type];
    return { type, d, hp: d.hp, maxHp: d.hp, flash: 0, hitstun: 0, vx: 0, vy: 0, dead: false, t: 0, shakeT: 0, face: -1, w: d.w, h: d.h, weight: d.weight, state: 'idle', stateT: 0, cd: 0 };
  }
  function popClone(c) {
    c.dead = true;
    parts.burst(c.x, c.y - 14, 18, { speed: [30, 120], colors: [C.white, C.moon, C.lav], shape: 'sq', size: 2, life: [0.3, 0.6] });
    parts.add({ x: c.x, y: c.y - 14, shape: 'ring', r0: 3, r1: 22, life: 0.3, colors: [C.white, C.lav] });
    sound.noise({ dur: 0.2, vol: 0.12, filter: 'highpass', f0: 2000 });
    floats.add(c.x, c.y - 34, 'FAKE', C.lav, { outline: C.ink });
    if (c.owner && !c.owner.dead) c.owner.hurtT = 0.1;
  }

  // ---------------- 主更新 ----------------
  function update(dt) {
    time += dt;
    shake.update(dt);
    for (const t of toasts) t.t += dt;
    toasts = toasts.filter(t => t.t < 2.6);
    if (bannerT > 0) bannerT -= dt;
    if (fade > 0 && !pl.dead) fade = Math.max(0, fade - dt * 2.5);
    if (hitstop > 0) { hitstop -= dt; for (const e of enemies) if (e.shakeT > 0) e.shakeT -= dt; return; }
    if (!finale && !pl.dead) stageTime += dt;
    delayed = delayed.filter(d => { if (--d.n <= 0) { d.fn(); return false; } return true; });
    updateMovers(dt);
    updatePlayer(dt);
    checkHits();
    for (const e of enemies) updateEnemy(e, dt);
    enemies = enemies.filter(e => !e.dead || e.type === 'dummy');
    updateShots(dt);
    updateBursts(dt);
    updatePickups(dt);
    updateProps(dt);
    updateCrumbles(dt);
    updateRopes(dt);
    checkArena();
    if (finale) updateFinale(dt);
    parts.update(dt); floats.update(dt);
    for (const gh of pl.ghosts) gh.age += dt;
    pl.ghosts = pl.ghosts.filter(gh => gh.age < 0.18);
    if (comboT > 0 && (comboT -= dt) <= 0) combo = 0;
    theme.ambient(parts, cam, dt, time);
    for (const p of parts.list) if (p.petal) p.vx += Math.sin(time * 2 + p.y * 0.05) * 18 * dt;
    // 鏡頭
    if (arena) {
      const tx = clamp(arena.x0 + (arena.x1 - arena.x0 - W) / 2, 0, WW - W);
      cam.x += (tx - cam.x) * smoothK(dt, 0.12);
      cam.y += (arena.camY - cam.y) * smoothK(dt, 0.12);
    } else {
      const lead = pl.face * P.camLead + clamp(pl.vx * 0.08, -12, 12);
      cam.follow(pl.x + lead, pl.y - 54, dt, { smoothX: P.camSmooth, smoothY: P.camSmooth * 1.6, deadY: P.camDeadY });
    }
  }
  function computeRig() {
    const sh = shoulder();
    const reach = P.atkReach * (pl.atk ? pl.atk.def.reach : 1) * (charmMod ? charmMod.reach : 1);
    const handX = sh.x + Math.cos(worldAng(pl.armA, pl.face)) * 5, handY = sh.y + Math.sin(worldAng(pl.armA, pl.face)) * 5;
    const sa = worldAng(pl.staffA, pl.face);
    const staffLen = pl.atk ? reach - 5 : reach - 7;
    pl.tip = { x: handX + Math.cos(sa) * staffLen, y: handY + Math.sin(sa) * staffLen };
    pl.hand = { x: handX, y: handY };
  }
  function updateRopes(dt) {
    computeRig();
    pl.ropes.forEach((rope, ri) => {
      rope[0].x = pl.tip.x + (ri ? 1 : -1); rope[0].y = pl.tip.y + 1;
      for (let i = 1; i < rope.length; i++) {
        const p = rope[i];
        const vx = (p.x - p.px) * 0.86, vy = (p.y - p.py) * 0.86;
        p.px = p.x; p.py = p.y;
        p.x += vx + Math.sin(time * 3 + i + ri) * 0.03; p.y += vy + 320 * dt * dt;
      }
      const seg = ri ? 2.6 : 2.2;
      for (let it = 0; it < 3; it++) for (let i = 1; i < rope.length; i++) {
        const a = rope[i - 1], b = rope[i];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.001, diff = (d - seg) / d;
        if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
        else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
      }
    });
  }

  // =====================================================================
  // 繪製
  // =====================================================================
  function drawProps(front) {
    for (const p of props) {
      switch (p.kind) {
        case 'toro': if (front) break; {
          g.spr(S.toro, p.x - 6, p.y - 13);
          if (p.lit) {
            const fl = Math.sin(time * 9 + p.x) > 0.2;
            g.rect(p.x - 2, p.y - 8, 4, 2, fl ? C.gold : C.orange);
            if (fl) g.px(p.x, p.y - 9, C.white);
            if (Math.random() < 0.05) parts.add({ x: p.x + rand(-2, 2), y: p.y - 10, vx: rand(-3, 3), vy: -18, life: 0.8, colors: [C.gold, C.orange], shape: 'px' });
          } else g.rect(p.x - 2, p.y - 8, 4, 2, C.indigo);
          break;
        }
        case 'sign': if (!front) g.spr(S.sign, p.x - 6, p.y - 12); break;
        case 'chest': if (!front) g.spr(p.open ? S.chestOpen : S.chest, p.x - 8, p.y - 10); if (!front && !p.open && Math.sin(time * 4) > 0.7) g.px(p.x + rand(-6, 6), p.y - rand(8, 14), C.white); break;
        case 'offering': if (!front) g.spr(p.broken ? S.offeringBroken : S.offering, p.x - 8, p.y - 10, { color: p.flash > 0 ? C.white : null }); break;
        case 'drum': if (!front) g.spr(p.squash > 0 ? S.drumSquash : S.drum, p.x - 9, p.y); break;
        case 'chime': if (front) {
          const sw = Math.sin(p.t * 1.7) * 1 + (p.ring > 0 ? Math.sin(time * 30) * 2 * p.ring : 0);
          g.line(p.x, p.y - 12, p.x + sw * 0.5, p.y - 4, C.ink);
          g.spr(S.chime, Math.round(p.x - 4 + sw), p.y - 2);
          break;
        }
      }
    }
  }
  function drawPickups() {
    for (const k of pickups) {
      if (k.life != null && k.life < 2 && Math.floor(k.life * 10) % 2) continue;
      if (k.kind === 'coin') { const fr = Math.floor(k.t * 6) % 4 === 3 ? 1 : 0; g.spr(S.coin[fr], Math.round(k.x - 3), Math.round(k.y - 3 + (k.fixed ? Math.sin(k.t * 3) : 0))); }
      else if (k.kind === 'dango') g.spr(S.dango, Math.round(k.x - 3), Math.round(k.y - 8));
      else if (k.kind === 'bell') {
        const by = Math.round(Math.sin(k.t * 2.5) * 2);
        if (k.had) g.spr(S.goldBell, Math.round(k.x - 6), Math.round(k.y - 7 + by), { color: C.violet });
        else {
          g.spr(S.goldBell, Math.round(k.x - 6), Math.round(k.y - 7 + by));
          if (Math.sin(k.t * 5) > 0.6) { const a = k.t * 3; g.px(k.x + Math.cos(a) * 9, k.y + Math.sin(a) * 9 + by, C.white); }
        }
      }
    }
  }
  function drawMovers() {
    for (const m of movers) {
      const x = Math.round(m.x), y = Math.round(m.y);
      if (theme.id === 'hall') {
        g.rect(x, y, m.w, 5, C.wood); g.rect(x, y, m.w, 1, C.gold); g.rect(x, y + 5, m.w, 1, C.ink);
        g.line(x + 3, y, x + 3, y - 200, C.ink); g.line(x + m.w - 4, y, x + m.w - 4, y - 200, C.ink);
      } else {
        // 浮雲
        const c1 = theme.id === 'altar' ? C.lav : C.moon, c2 = theme.id === 'altar' ? C.violet : C.lav;
        g.circle(x + 7, y + 3, 5, C.ink); g.circle(x + 16, y + 2, 6, C.ink); g.circle(x + 25, y + 3, 5, C.ink);
        g.circle(x + 7, y + 3, 4, c2); g.circle(x + 16, y + 2, 5, c1); g.circle(x + 25, y + 3, 4, c2);
        g.rect(x + 2, y + 1, m.w - 4, 1, C.white);
        g.rect(x + 3, y + 6, m.w - 6, 1, c2);
      }
    }
  }
  function drawDynamicTiles() {
    const x0 = Math.floor(cam.x / T) - 1, x1 = Math.ceil((cam.x + W) / T) + 1;
    const y0 = Math.floor(cam.y / T) - 1, y1 = Math.ceil((cam.y + H) / T) + 1;
    for (let ty = Math.max(0, y0); ty <= Math.min(map.MH - 1, y1); ty++) for (let tx = Math.max(0, x0); tx <= Math.min(map.MW - 1, x1); tx++) {
      const t = tileAt(tx, ty);
      if (t === TILE.CRUMBLE) {
        const c = crumbles.get(tileIdx(tx, ty));
        if (c && c.broken > 0) { if (c.broken < 0.4 && Math.floor(c.broken * 20) % 2) theme.drawCrumble(g, tx * T, ty * T, 0); continue; }
        const sh = c && c.t > 0 ? (Math.floor(time * 40) % 2 ? 1 : -1) : 0;
        theme.drawCrumble(g, tx * T, ty * T, sh);
      } else if (t === TILE.BREAK) theme.drawBreak(g, tx * T, ty * T, breaks.get(tileIdx(tx, ty)) || 0);
    }
  }
  function drawPlayer() {
    if (pl.dead && pl.deathT > 0.9) return;
    const hirin = S.hirin;
    const sx = pl.face > 0 ? RIG.tail[0] : RIG.w - 1 - RIG.tail[0];
    let spr;
    const hurt = pl.hurtT > 0 || pl.dead;
    if (hurt) spr = hirin.hurt;
    else if (pl.dashT > 0) spr = hirin.dash;
    else if (pl.healing) spr = hirin.idle[1];
    else if (!pl.onGround) spr = pl.sliding ? hirin.fall : pl.vy < -20 ? hirin.jump : hirin.fall;
    else if (pl.atk) spr = hirin.fall;
    else if (Math.abs(pl.vx) > 12) spr = hirin.run[Math.floor(pl.runPhase) % 6];
    else spr = pl.blinkT < 0.12 ? hirin.blink : hirin.idle[Math.floor(time * 1.6) % 2];
    const x0 = Math.round(pl.x - 8), y0 = Math.round(pl.y - 26);
    for (const gh of pl.ghosts) {
      const c = gh.age < 0.06 ? C.lav : gh.age < 0.12 ? C.violet : C.indigo;
      g.spr(gh.spr, Math.round(gh.x - 8), Math.round(gh.y - 26), { flip: gh.face < 0, color: c });
    }
    const blinkOff = pl.inv > 0 && !hurt && pl.dashT <= 0 && Math.floor(pl.inv * 20) % 2 === 1;
    if (blinkOff) return;
    const color = pl.dead ? (Math.floor(pl.deathT * 20) % 2 ? C.white : C.lav) : pl.flashRed > 0 ? C.red : null;
    if (pl.healing) { // 回復中的光環
      const k = clamp(pl.healT / P.healTime, 0, 1);
      g.arcBand(pl.x, pl.y - 11, 15, 16, -Math.PI / 2, -Math.PI / 2 + TAU * k, C.green);
    }
    const tail = pl.dashT > 0 || (pl.onGround && Math.abs(pl.vx) > 70) ? S.tail.swept : (!pl.onGround && pl.vy > 60) ? S.tail.lifted : S.tail.hang;
    const tw = tail.w, th = tail.h;
    const sway = tail === S.tail.hang ? Math.round(Math.sin(time * 3) * 0.6) : 0;
    const tx = pl.face > 0 ? x0 + sx - tw + 2 + sway : x0 + sx - 1 - sway;
    const ty = y0 + RIG.tail[1] + (tail === S.tail.lifted ? -th + 3 : -1) + Math.round((1 - pl.sy) * 26);
    g.spr(tail, tx, ty, { flip: pl.face < 0, color });
    g.spr(spr, x0, y0, { flip: pl.face < 0, sx: pl.sx, sy: pl.sy, color });
    const sh = shoulder(), hd = pl.hand, tip = pl.tip;
    const sa = worldAng(pl.staffA, pl.face);
    const back = { x: hd.x - Math.cos(sa) * 4, y: hd.y - Math.sin(sa) * 4 };
    g.line(back.x, back.y, tip.x, tip.y, C.ink, 3);
    g.line(back.x, back.y, tip.x, tip.y, C.gold);
    g.line(sh.x, sh.y, hd.x, hd.y, C.ink, 3);
    g.line(sh.x, sh.y, hd.x, hd.y, color ?? C.white, 2);
    g.rect(hd.x - 1, hd.y - 1, 2, 2, color ?? C.skin);
    pl.ropes.forEach((rope, ri) => { for (let i = 1; i < rope.length; i++) g.line(rope[i - 1].x, rope[i - 1].y, rope[i].x, rope[i].y, ri ? C.pink : C.red); });
    g.spr(S.bell, tip.x - 1, tip.y - 1);
  }
  function drawSmear() {
    const a = pl.atk;
    if (!a || !P.smear || pl.dead) return;
    const activeEnd = a.S + a.A;
    if (a.f <= a.S || a.f > activeEnd + 3) return;
    const sh = shoulder();
    const R = P.atkReach * a.def.reach * charmMod.reach;
    const wind = a.def.a0 - 0.3 * sign(a.def.a1 - a.def.a0);
    const fadeK = Math.max(0, a.f - activeEnd) / 3;
    const startLocal = lerp(wind, pl.staffA, Math.min(1, 0.15 + fadeK));
    const w0 = worldAng(startLocal, pl.face), w1 = worldAng(pl.staffA, pl.face);
    const big = a.def.finisher;
    g.arcBand(sh.x, sh.y, R - (big ? 9 : 7), R - 3, w0, w1, C.lav);
    g.arcBand(sh.x, sh.y, R - 4, R - 1, w0, w1, C.moon);
    g.arcBand(sh.x, sh.y, R - 1, R + 2, w0, w1, fadeK > 0.5 ? C.moon : C.white);
  }
  function jitterOf(e) { return e.shakeT > 0 && hitstop > 0 ? (Math.floor(time * 60) % 2 ? 2 : -2) : 0; }
  function drawEnemy(e) {
    if (e.dead) return;
    const jit = jitterOf(e);
    const flash = e.flash > 0 ? C.white : null;
    const fl = e.face > 0;
    switch (e.type) {
      case 'dummy': {
        const spr = e.lean < -0.35 ? S.scarecrow.left : e.lean > 0.35 ? S.scarecrow.right : S.scarecrow.mid;
        g.spr(spr, Math.round(e.x - 9) + jit, Math.round(e.y - 26), { color: flash });
        break;
      }
      case 'lantern': {
        const spr = e.hitstun > 0 ? S.lantern.hurt : (Math.sin(e.t * 0.9) > 0.97 ? S.lantern.blink : S.lantern.float[Math.floor(e.t * 3) % 2]);
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + e.t * 0.8; if (Math.sin(e.t * 7 + i * 2.1) > 0.1) g.px(e.x + Math.cos(a) * 11, e.y + Math.sin(a) * 10, i % 3 ? C.orange : C.gold); }
        g.spr(spr, Math.round(e.x - 7) + jit, Math.round(e.y - 8 + Math.sin(e.t * 2.5) * 1.5), { flip: fl, color: flash });
        break;
      }
      case 'umbrella': {
        const spr = e.hitstun > 0 ? S.umbrella.hurt : !e.onGround ? S.umbrella.hop : e.hopT < 0.2 ? S.umbrella.crouch : S.umbrella.stand;
        g.spr(spr, Math.round(e.x - 8) + jit, Math.round(e.y - 20), { flip: fl, color: flash });
        break;
      }
      case 'fox': {
        const spr = e.hitstun > 0 ? S.fox.hurt : e.state === 'charge' ? S.fox.charge : S.fox.idle;
        g.spr(spr, Math.round(e.x - 9) + jit + (e.state === 'charge' ? (Math.floor(time * 30) % 2) : 0), Math.round(e.y - 19), { flip: !fl, color: flash });
        break;
      }
      case 'weasel': {
        const spr = e.hitstun > 0 ? S.weasel.hurt : e.state === 'crouch' ? S.weasel.crouch : e.state === 'dash' ? S.weasel.dash : S.weasel.run[Math.floor(e.t * 8) % 2];
        const blink = e.state === 'crouch' && Math.floor(time * 20) % 2;
        g.spr(spr, Math.round(e.x - 12) + jit, Math.round(e.y - 12), { flip: !fl, color: flash ?? (blink ? C.gold : null) });
        if (e.state === 'rest') for (let i = 0; i < 3; i++) { const a = time * 6 + i * TAU / 3; g.px(e.x + Math.cos(a) * 6, e.y - 14 + Math.sin(a) * 2, C.white); }
        break;
      }
      case 'tanuki': {
        const spr = e.hitstun > 0 ? S.tanuki.hurt : e.state === 'throw' ? S.tanuki.throw : S.tanuki.idle;
        g.spr(spr, Math.round(e.x - 8) + jit, Math.round(e.y - 18), { flip: !fl, color: flash });
        break;
      }
      case 'noh': {
        if (e.state === 'hidden') break;
        const fading = e.state === 'appear' || e.state === 'vanish';
        const k = e.state === 'appear' ? e.stateT / 0.45 : e.state === 'vanish' ? 1 - e.stateT / 0.4 : 0;
        if (fading && Math.floor(time * 30) % 3 === 0) break;
        const spr = e.hitstun > 0 ? S.noh.hurt : e.state === 'attack' ? S.noh.attack : S.noh.idle;
        const col = flash ?? (fading ? (k > 0.5 ? C.lav : C.moon) : null);
        g.spr(spr, Math.round(e.x - 7) + jit, Math.round(e.y - 9), { color: col });
        break;
      }
      case 'momen': {
        const tr = e.trail;
        for (let i = tr.length - 1; i > 0; i--) g.line(tr[i - 1].x, tr[i - 1].y + Math.sin(e.t * 8 + i) * 1, tr[i].x, tr[i].y + Math.sin(e.t * 8 + i + 1) * 1, C.ink, 7 - Math.floor(i / 3));
        for (let i = tr.length - 1; i > 0; i--) g.line(tr[i - 1].x, tr[i - 1].y + Math.sin(e.t * 8 + i) * 1, tr[i].x, tr[i].y + Math.sin(e.t * 8 + i + 1) * 1, flash ?? (i > 5 ? C.moon : C.white), 5 - Math.floor(i / 3));
        const f = e.face;
        g.px(e.x + f * 3 + jit, e.y - 1, C.ink); g.px(e.x + f * 1 + jit, e.y - 1, C.ink);
        if (e.state === 'swoop') { g.px(e.x + f * 3, e.y - 1, C.red); g.px(e.x + f * 1, e.y - 1, C.red); }
        break;
      }
      case 'spider': {
        if (e.state === 'hang' || e.state === 'fall') g.line(e.x, e.anchorY, e.x, e.y - 5, C.moon);
        const spr = e.state === 'hang' ? S.spider.hang : S.spider.walk[Math.floor(e.t * 10) % 2];
        g.spr(spr, Math.round(e.x - 8) + jit, Math.round(e.y - (e.state === 'hang' ? 6 : 11)), { flip: e.face < 0, color: flash });
        break;
      }
      case 'onibi': {
        const r = e.state === 'aim' ? 5 + Math.sin(time * 40) : 4;
        const x = Math.round(e.x) + jit, y = Math.round(e.y);
        g.circle(x, y - 1, r + 1, C.ink);
        g.circle(x - Math.sign(e.vx || 1) * 2, y - 4, r - 1, C.dgreen);
        g.circle(x, y - 1, r, flash ?? C.dgreen); g.circle(x, y - 1, r - 1, flash ?? C.green); g.circle(x - 1, y - 2, r - 3, C.white);
        g.px(x - 2, y - 1, C.ink); g.px(x + 1, y - 1, C.ink);
        if (Math.random() < 0.4) parts.add({ x: e.x + rand(-2, 2), y: e.y - 4, vx: rand(-5, 5), vy: rand(-30, -15), life: 0.35, colors: [C.green, C.dgreen], shape: 'px' });
        break;
      }
      case 'bossLantern': drawBossLantern(e, jit, flash); break;
      case 'bossWeasel': drawBossWeasel(e, jit, flash); break;
      case 'bossFox': case 'foxClone': drawFox(e, jit, flash); break;
      case 'bossSerpent': drawSerpent(e, jit, flash); break;
    }
  }
  function bossFlash(e, flash) { return flash ?? (e.hurtT > 0 && Math.floor(time * 40) % 2 ? C.white : e.state === 'dying' && Math.floor(time * 20) % 2 ? C.white : null); }
  function drawBossLantern(b, jit, flash) {
    const col = bossFlash(b, flash);
    if (b.state === 'hover') { // 地面上的影子預告
      const k = clamp(b.stateT / 0.9, 0, 1);
      g.ellipse(b.x, arena.ground - 1, 8 + 12 * k, 2 + k * 2, C.ink);
      return;
    }
    const spr = b.state === 'dizzy' ? S.bigLantern.dizzy : b.hurtT > 0 || b.state === 'dying' ? S.bigLantern.hurt : b.mouth ? S.bigLantern.open : S.bigLantern.idle;
    // 火光
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + b.t; if (Math.sin(time * 6 + i * 1.7) > 0.3) g.px(b.x + Math.cos(a) * 26, b.y + Math.sin(a) * 25, i % 3 ? C.orange : (b.phase === 2 ? C.red : C.gold)); }
    if (b.tongue && b.tongue.len > 2) {
      const t = b.tongue;
      g.line(t.x, t.y, t.tx, t.ty, C.ink, 7); g.line(t.x, t.y, t.tx, t.ty, C.red, 5); g.line(t.x, t.y, t.tx, t.ty, C.pink, 1);
      g.circle(t.tx, t.ty, 4, C.ink); g.circle(t.tx, t.ty, 3, C.pink);
    }
    g.spr(spr, Math.round(b.x - 21) + jit, Math.round(b.y - 23), { flip: b.face > 0, color: col ?? (b.phase === 2 && Math.floor(time * 4) % 4 === 0 ? C.red : null) });
  }
  function drawBossWeasel(b, jit, flash) {
    const col = bossFlash(b, flash);
    for (const gh of b.ghosts || []) g.spr(S.kamaitachi.dash, Math.round(gh.x - 18), Math.round(gh.y - 21), { flip: gh.face < 0, color: gh.age < 0.1 ? C.lav : C.violet });
    let spr = S.kamaitachi.stand;
    if (b.state === 'dashPrep' || b.state === 'cling') spr = S.kamaitachi.crouch;
    else if (b.state === 'dash' || b.state === 'pounce' || b.state === 'leap') spr = S.kamaitachi.dash;
    else if (b.state === 'throw') spr = S.kamaitachi.throw;
    else if (b.hurtT > 0 || b.state === 'dying') spr = S.kamaitachi.hurt;
    const blink = b.state === 'dashPrep' && Math.floor(time * 20) % 2;
    if (b.state === 'cling') {
      // 貼在牆上：用旋轉的畫布（以蹲姿轉 90 度）
      g.ctx.save(); g.ctx.translate(Math.round(b.x) + jit, Math.round(b.y - 10)); g.ctx.rotate(b.clingSide > 0 ? -Math.PI / 2 : Math.PI / 2);
      g.spr(spr, -18, -11, { flip: b.clingSide < 0, color: col ?? (Math.floor(time * 16) % 2 ? C.gold : null) });
      g.ctx.restore();
    } else g.spr(spr, Math.round(b.x - 18) + jit, Math.round(b.y - 21), { flip: b.face < 0, color: col ?? (blink ? C.gold : null) });
    if (b.state === 'dizzy') for (let i = 0; i < 3; i++) { const a = time * 6 + i * TAU / 3; g.px(b.x + Math.cos(a) * 10, b.y - 24 + Math.sin(a) * 3, C.white); }
  }
  function drawFox(b, jit, flash) {
    if (b.alpha <= 0.02) return;
    const col = b.type === 'bossFox' ? bossFlash(b, flash) : flash;
    const fading = b.alpha < 1;
    if (fading && Math.floor(time * 30) % 2) return;
    const spr = b.hurtT > 0 || b.state === 'dying' ? S.whiteFox.hurt : b.casting || b.state === 'claw' ? S.whiteFox.cast : S.whiteFox.sit;
    const c2 = col ?? (fading ? C.lav : b.type === 'foxClone' && Math.floor(time * 8) % 7 === 0 ? C.moon : null);
    // 狐火光暈
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + time * 1.5; if (Math.sin(time * 5 + i) > 0) g.px(b.x + Math.cos(a) * 20, b.y - 16 + Math.sin(a) * 18, C.green); }
    g.spr(spr, Math.round(b.x - 18) + jit, Math.round(b.y - 31), { flip: b.face < 0, color: c2 });
  }
  function drawSerpent(b, jit, flash) {
    const col = bossFlash(b, flash);
    const G = arena.ground;
    // 兩側水池
    for (const px of [arena.x0 + 26, arena.x1 - 26]) {
      g.ellipse(px, G - 1, 20, 3, C.ink); g.ellipse(px, G - 1, 18, 2, C.indigo);
      const rip = Math.sin(time * 3 + px) * 3;
      g.rect(px - 10 + rip, G - 2, 6, 1, C.lav); g.rect(px + 4 - rip, G - 1, 5, 1, C.violet);
    }
    if (b.state === 'submerged' && b.stateT > 0.2) { const px = [arena.x0 + 26, arena.x1 - 26][b.from]; for (let i = 0; i < 3; i++) g.ring(px, G - 1, 4 + ((time * 20 + i * 6) % 18), C.lav); }
    // 身體（從尾巴畫到頭）
    for (let i = b.segs.length - 1; i >= 0; i--) {
      const s = b.segs[i];
      if (!s.vis) continue;
      g.circle(s.x, s.y, s.r + 1, C.ink);
      g.circle(s.x, s.y, s.r, col ?? (i % 2 ? C.violet : C.indigo));
      g.rect(s.x - s.r * 0.4, s.y - s.r * 0.6, 2, 2, C.lav);
      if (i % 3 === 0) g.px(s.x, s.y + s.r - 2, C.moon);
    }
    if (!b.hidden) {
      const spr = b.hurtT > 0 || b.state === 'dying' ? S.serpent.hurt : b.open ? S.serpent.open : S.serpent.closed;
      g.ctx.save();
      g.ctx.translate(Math.round(b.x) + jit, Math.round(b.y));
      const ang = b.angle ?? 0;
      const flipX = Math.cos(ang) < 0;
      g.ctx.rotate(flipX ? ang - Math.PI : ang);
      g.spr(spr, -14, -10, { flip: flipX, color: col ?? (b.phase === 2 && Math.floor(time * 4) % 4 === 0 ? C.red : null) });
      g.ctx.restore();
    }
  }
  function drawShots() {
    for (const s of shots) {
      const x = Math.round(s.x), y = Math.round(s.y);
      switch (s.kind) {
        case 'fire': g.circle(x, y, 4, C.ink); g.circle(x, y, 3, C.orange); g.circle(x, y, 2, C.gold); g.px(x - 1, y - 1, C.white); if (Math.random() < 0.5) parts.add({ x: s.x, y: s.y, vx: rand(-10, 10), vy: -20, life: 0.2, colors: [C.orange, C.red], shape: 'px' }); break;
        case 'leaf': { const a = s.t * 12; g.line(x - Math.cos(a) * 4, y - Math.sin(a) * 2, x + Math.cos(a) * 4, y + Math.sin(a) * 2, C.ink, 3); g.line(x - Math.cos(a) * 3, y - Math.sin(a) * 2, x + Math.cos(a) * 3, y + Math.sin(a) * 2, C.green, 1); break; }
        case 'wisp': case 'foxfire': { const c = s.kind === 'foxfire' ? C.green : C.moon; g.circle(x, y, 4, C.ink); g.circle(x, y, 3, c); g.circle(x, y - 1, 1, C.white); break; }
        case 'shard': g.circle(x, y, 3, C.ink); g.rect(x - 1, y - 2, 3, 5, C.pink); g.px(x, y - 1, C.white); break;
        case 'wave': { const h = 10 + Math.sin(s.t * 30) * 2; g.rect(x - 4, arena.ground - h, 8, h, C.ink); g.rect(x - 3, arena.ground - h + 1, 6, h - 1, C.lav); g.rect(x - 2, arena.ground - h + 2, 4, h - 3, C.white); break; }
        case 'sickle': { const a = s.t * 18; g.arcBand(x, y, 5, 8, a, a + 3.6, C.ink); g.arcBand(x, y, 6, 7, a, a + 3.4, C.white); break; }
        case 'rock':
          if (s.t < s.delay) { const k = s.t / s.delay; g.ellipse(s.x, arena.ground - 1, 3 + k * 6, 1 + k, C.ink); }
          else { g.circle(x, y, 5, C.ink); g.circle(x, y, 4, C.indigo); g.px(x - 1, y - 2, C.lav); }
          break;
      }
    }
    for (const p of pshots) {
      const a = p.vx > 0 ? 0 : Math.PI;
      g.arcBand(p.x - Math.cos(a) * 8, p.y, 7, 11, a - 1, a + 1, C.lav);
      g.arcBand(p.x - Math.cos(a) * 8, p.y, 10, 12, a - 0.8, a + 0.8, C.white);
    }
    for (const b of bursts) {
      const k = b.t / 0.4;
      g.ring(b.x, b.y, b.r, k < 0.5 ? C.white : C.gold);
      g.ring(b.x, b.y, b.r - 2, C.gold);
      if (k < 0.6) g.ring(b.x, b.y, b.r * 0.6, C.moon);
    }
  }
  function drawArenaBarrier() {
    if (!arena || arena.cleared) return;
    const x = arena.x0 + 2;
    for (let y = arena.top - 40; y < arena.ground; y += 3) {
      const wig = Math.sin(time * 6 + y * 0.3) > 0 ? 1 : 0;
      g.px(x + wig, y, C.lav); g.px(x + 1 - wig, y + 1, C.white);
    }
    for (let y = arena.top - 20; y < arena.ground; y += 24) { g.rect(x - 3, y, 7, 5, C.white); g.rect(x - 2, y + 5, 5, 3, C.moon); }
  }
  function drawHitboxes() {
    const box = (x, y, w, h, c) => { g.rect(x, y, w, 1, c); g.rect(x, y + h - 1, w, 1, c); g.rect(x, y, 1, h, c); g.rect(x + w - 1, y, 1, h, c); };
    box(pl.x - pl.w / 2, pl.y - pl.h, pl.w, pl.h, pl.inv > 0 ? C.gold : C.green);
    for (const e of enemies) if (!e.dead) for (const b of hurtboxes(e)) g.ring(b.x, b.y, b.r, C.green);
    for (const s of shots) g.ring(s.x, s.y, s.r, C.red);
    const a = pl.atk;
    if (a && a.f > a.S && a.f <= a.S + a.A) {
      const sh = shoulder(), R = P.atkReach * a.def.reach * charmMod.reach;
      const w0 = worldAng(a.prevAng, pl.face), w1 = worldAng(pl.staffA, pl.face);
      g.arcBand(sh.x, sh.y, R - 1, R + 1, w0, w1, C.red);
    }
  }
  const heartOf = full => full ? S.heart : S.heartEmpty;
  function drawHUD() {
    g.screenSpace();
    const mh = maxHp();
    for (let i = 0; i < mh; i++) g.spr(heartOf(i < pl.hp), 5 + i * 9, 5);
    // 靈力珠（未滿的顯示部分填滿）
    const sm = env.spiritMax();
    for (let i = 0; i < sm; i++) {
      const x = 5 + i * 9, y = 14;
      g.spr(S.orbEmpty, x, y);
      const f = clamp(pl.spirit - i, 0, 1);
      if (f > 0) { const hpx = Math.max(1, Math.round(7 * f)); g.ctx.drawImage(S.orb.canvas, 0, 7 - hpx, 7, hpx, x, y + 7 - hpx, 7, hpx); }
      if (f >= 1 && Math.floor(time * 2 + i) % 5 === 0) g.px(x + 4, y + 2, C.white);
    }
    // 空中跳躍與衝刺剩餘次數
    for (let i = 0; i < airJumpsMax(); i++) g.rect(6 + i * 5 + sm * 9, 17, 3, 3, i < pl.airJumps ? C.gold : C.indigo);
    // 錢幣與金鈴
    g.spr(S.coin[0], W - 42, 5);
    g.text(String(env.save.coins), W - 5, 5, C.gold, { align: 'right', outline: C.ink });
    const bells = env.save.bells[st.id] || [];
    for (let i = 0; i < 3; i++) g.spr(S.goldBell, W - 44 + i * 13, 14, bells[i] ? {} : { color: C.indigo });
    if (combo >= 2) {
      const pop = time - lastHit < 0.06 ? 1 : 0;
      g.text(String(combo), W - 34, 36 - pop, combo >= 10 ? C.gold : C.white, { scale: 2, align: 'right', outline: C.ink });
      g.text('HIT', W - 31, 41, C.pink, { outline: C.ink });
      g.rect(W - 58, 53, Math.round(52 * clamp(comboT / 1.8, 0, 1)), 1, C.pink);
    }
    // 告示牌
    const sign = !pl.dead && props.find(p => p.kind === 'sign' && Math.abs(p.x - pl.x) < 22 && Math.abs(p.y - pl.y) < 30);
    if (sign && sign.text) {
      const lines = wrapCache(sign.text);
      const w = Math.max(...lines.map(l => l.w)) + 14, h = lines.length * 13 + 8;
      const x = clamp(Math.round(sign.x - cam.x - w / 2), 4, W - w - 4), y = Math.max(24, Math.round(sign.y - cam.y - 34 - h));
      g.rect(x, y, w, h, C.ink); g.rect(x + 1, y + 1, w - 2, h - 2, C.night); g.rect(x + 1, y + 1, w - 2, 1, C.indigo);
      lines.forEach((l, i) => g.label(l.s, x + 7, y + 3 + i * 13, C.white));
    }
    // 守護妖血條
    if (boss && !boss.dead && boss.state !== 'intro') {
      const bw = 200, bx = (W - bw) / 2, by = H - 12;
      g.label(st.bossName, bx, by - 14, C.white, { outline: C.ink });
      g.rect(bx - 1, by - 1, bw + 2, 7, C.ink);
      g.rect(bx, by, bw, 5, C.indigo);
      g.rect(bx, by, Math.round(bw * clamp(boss.hp / boss.maxHp, 0, 1)), 5, boss.phase === 2 ? C.red : C.orange);
      g.rect(bx, by, Math.round(bw * clamp(boss.hp / boss.maxHp, 0, 1)), 1, C.gold);
      g.rect(bx + bw / 2, by, 1, 5, C.ink);
    }
    // 提示訊息
    toasts.forEach((t, i) => {
      if (t.t > 2.2 && Math.floor(t.t * 10) % 2) return;
      g.label(t.text, W / 2, 28 + i * 14, C.white, { align: 'center', outline: C.ink });
    });
    // 關卡名稱
    if (bannerT > 0 && bannerT < 2.8 && !(bannerT < 0.5 && Math.floor(bannerT * 10) % 2)) {
      g.rect(0, 58, W, 34, C.ink); g.rect(0, 59, W, 1, C.gold); g.rect(0, 90, W, 1, C.gold);
      g.label(st.name, W / 2, 60, C.white, { align: 'center', scale: 2 });
      g.text(`STAGE ${stageIndex + 1}  ${st.en}`, W / 2, 84, C.gold, { small: true, align: 'center' });
    }
    if (boss && boss.state === 'intro' && boss.stateT > 0.2) {
      g.rect(0, 116, W, 22, C.ink); g.rect(0, 117, W, 1, C.red); g.rect(0, 137, W, 1, C.red);
      g.label('守護妖　' + st.bossName, W / 2, 120, C.white, { align: 'center' });
    }
  }
  const wrapMemo = new Map();
  function wrapCache(s) {
    let v = wrapMemo.get(s);
    if (!v) { v = env.wrap(s, 220).map(x => ({ s: x, w: env.measure(x) })); wrapMemo.set(s, v); }
    return v;
  }
  function render() {
    const cx = cam.x + shake.x, cy = cam.y + shake.y;
    theme.drawBg(g, cx, cy, time, eclipse && arena ? { eclipseSky: boss && boss.phase === 2 ? eclipse.red : eclipse.normal } : {});
    g.camera(cx, cy);
    g.ctx.drawImage(theme.world, 0, 0);
    drawDynamicTiles();
    drawProps(false);
    drawMovers();
    parts.draw(g, p => p.glow);
    drawPickups();
    for (const e of enemies) if (e.type !== 'bossSerpent') drawEnemy(e);
    if (boss && boss.type === 'bossSerpent') drawEnemy(boss);
    drawPlayer();
    drawSmear();
    drawProps(true);
    drawShots();
    parts.draw(g, p => !p.glow);
    floats.draw(g);
    drawArenaBarrier();
    if (P.showHitbox) drawHitboxes();
    theme.drawFg(g, cx, cy, time);
    if (!hudOff) drawHUD();
    if (fade > 0) { g.screenSpace(); g.ditherFast(0, 0, W, H, C.ink, Math.round(fade * 16)); }
  }
  function debugLines() {
    const a = pl.atk;
    return [
      `STATE ${pl.dead ? 'DEAD' : pl.hurtT > 0 ? 'HURT' : pl.dashT > 0 ? 'DASH' : a ? 'ATK ' + a.kind.toUpperCase() + ' F' + a.f : pl.sliding ? 'WALL' : pl.onGround ? 'GROUND' : 'AIR'}`,
      `X ${pl.x.toFixed(0)} Y ${pl.y.toFixed(0)} VX ${pl.vx.toFixed(0)} VY ${pl.vy.toFixed(0)}`,
      `COYOTE ${Math.max(0, pl.coyote * 1000).toFixed(0)}  BUF ${Math.max(0, pl.buffer * 1000).toFixed(0)}  SPIRIT ${pl.spirit.toFixed(2)}`,
      `AIRJ ${pl.airJumps}  DASH ${pl.dashes}  HITSTOP ${Math.max(0, hitstop * 1000).toFixed(0)}`,
      boss ? `BOSS ${boss.state} HP ${boss.hp}` : `ENEMY ${enemies.filter(e => !e.dead).length}`,
    ];
  }
  /** 封面構圖：主角在稻草人前揮出終結技 */
  function stageCover() {
    load(0);
    hudOff = true; bannerT = 0;
    pl.x = 12 * T + 8 + 24; pl.face = -1; pl.y = groundY(12, 13);
    enemies = enemies.filter(e => e.type === 'dummy');
    cam.center(pl.x - 10, pl.y - 36);
    for (let i = 0; i < 40; i++) updateRopes(1 / 60);
    startAttack('g3');
  }
  return {
    load, update, render, debugLines, stageCover,
    get stage() { return st; }, get stageIndex() { return stageIndex; }, get player() { return pl; }, get arena() { return arena; }, get boss() { return boss; },
    get finale() { return finale; },
    set hudOff(v) { hudOff = v; },
    refreshMods: computeMods,
    peek: () => ({ pl, enemies, shots, pickups, props, combo, hitstop, cam, arena, boss, map, checkpoint, stageTime, deaths, coinsGot }),
    // 測試用
    debugTeleport(x, y) { pl.x = x; pl.y = y; pl.vx = pl.vy = 0; cam.center(x, y - 30); },
    debugBoss() { const x0 = (map.gate.tx - 1) * T; pl.x = x0 + 4 * T; pl.y = groundY(map.gate.tx + 3, map.gate.ty); checkArena(); },
  };
}
