// 《溫室魔女的剪定日》遊戲世界：一個房間裡的所有事——茴香、武器、魔物、守護者、門與獎勵。
// 一輪的進度（體力、金幣、祝福……）存在 main.js 的 run 物件，這裡直接讀寫它。
import { makeLayer, TAU, BAYER4 } from '../engine/pixel.js';
import { Particles, Shaker, Camera, Floaters, clamp, rand, sign, smoothK, lerp, pick } from '../engine/fx.js';
import { PALETTE } from './sprites.js';
import { TILE, FLOORS, buildRoom, roomTemplate, doorOptions, waveEnemies } from './rooms.js';
import { BOONS } from './boons.js';

export const C = { ink: 0, shadow: 1, plum: 2, mauve: 3, cream: 4, white: 5, dleaf: 6, leaf: 7, lleaf: 8, lime: 9, soil: 10, terra: 11, peach: 12, skin: 13, pink: 14, teal: 15 };
const W = 320, H = 180, T = 16, DEG = Math.PI / 180;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const easeOut = t => 1 - (1 - t) * (1 - t);

// ---------------- 武器 ----------------
// 近戰：sweep 揮動方向、arc 角度（null＝用面板的揮擊角度）、reach 距離倍率、dmg 傷害、f 影格修正 [前搖, 判定, 後搖]
export const WEAPONS = {
  scythe: {
    name: '園藝鐮刀', desc: '三段揮砍，最後一擊是大迴旋。揮完按住攻擊蓄力，放開使出迴旋斬。',
    combo: {
      c1: { sweep: 1, dmg: 12, next: 'c2' },
      c2: { sweep: -1, dmg: 12, next: 'c3' },
      c3: { sweep: 1, dmg: 24, fixedArc: 300, reach: 1.15, finisher: true, f: [1, 2, 5] },
    },
    first: 'c1', charge: 'spin', spinDmg: 18,
  },
  shears: {
    name: '雙刃剪', desc: '快速的四段剪擊，攻擊距離較短。蓄力放開會向前突進連剪。移動速度 +10%。',
    combo: {
      s1: { sweep: 1, dmg: 7, arc: 110, reach: 0.82, next: 's2', f: [-1, -2, -3] },
      s2: { sweep: -1, dmg: 7, arc: 110, reach: 0.82, next: 's3', f: [-1, -2, -3] },
      s3: { sweep: 1, dmg: 8, arc: 120, reach: 0.82, next: 's4', f: [-1, -2, -3] },
      s4: { sweep: -1, dmg: 16, arc: 200, reach: 0.95, finisher: true, f: [0, -1, 2] },
    },
    first: 's1', charge: 'snip', speed: 1.1,
  },
  can: {
    name: '澆水壺', desc: '射出水珠的遠程武器，第三擊是散射。蓄力放開會持續灑水，把魔物推開。',
    combo: {
      w1: { shot: 1, dmg: 9, next: 'w2', f: [-1, -3, -2] },
      w2: { shot: 1, dmg: 9, next: 'w3', f: [-1, -3, -2] },
      w3: { shot: 3, dmg: 9, finisher: true, f: [0, -2, 2] },
    },
    first: 'w1', charge: 'spray', ranged: true,
  },
};

// ---------------- 魔物 ----------------
const ENEMY = {
  slime: { r: 6, hp: 30, weight: 0.8, coins: 2 },
  slimeMini: { r: 4, hp: 12, weight: 0.6, coins: 1 },
  beetle: { r: 7, hp: 70, weight: 1.9, coins: 3 },
  mushroom: { r: 6, hp: 40, weight: 1.3, coins: 2 },
  cactus: { r: 7, hp: 55, weight: 2.4, coins: 3 },
  bee: { r: 5, hp: 20, weight: 0.6, coins: 1, fly: true },
  snapper: { r: 8, hp: 60, weight: 99, coins: 3 },
  slimeKing: { r: 17, hp: 700, weight: 99, coins: 0, boss: true },
  queenBee: { r: 13, hp: 820, weight: 99, coins: 0, boss: true, fly: true },
  rafflesia: { r: 24, hp: 1250, weight: 99, coins: 0, boss: true },
};

export function createWorld(env) {
  const { g, input, sound, P, S, hooks } = env;
  const run = () => env.run;
  const parts = new Particles(1000), floats = new Floaters(), shake = new Shaker(), cam = new Camera(W, H);
  let room, spec, floorLayer, pl, enemies, pots, puffs, spores, waves, pshots, vines, bursts, zones, pickups, doors, props;
  let hitstop, time, combo, comboT, lastHit, waveQ, waveIdx, spawnDelay, cleared, banner, boss, dying, deathT, hudOff = false, rewardT, clearT, promptItem;
  const mouse = { x: 0, y: 0, inside: false };
  g.view.addEventListener('pointermove', e => { const p = g.toNative(e.clientX, e.clientY); mouse.x = p.x; mouse.y = p.y; mouse.inside = true; });
  g.view.addEventListener('pointerleave', () => { mouse.inside = false; });
  g.view.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' || !env.playing()) return;
    const act = e.button === 2 ? 'roll' : e.button === 0 ? 'attack' : null;
    if (!act) return;
    e.preventDefault(); input.qPress.add(act); input.touchHeld.add(act);
    const up = ev => { if (ev.button === e.button) { input.touchHeld.delete(act); input.qRelease.add(act); removeEventListener('pointerup', up); } };
    addEventListener('pointerup', up);
  });
  g.view.addEventListener('contextmenu', e => e.preventDefault());

  // ---------------- 音效 ----------------
  const sfx = {
    swing(step) { if (!sound.throttle('swing', 0.04)) return; sound.noise({ dur: 0.12, vol: 0.12, filter: 'bandpass', f0: 1800 + step * 300, f1: 600, q: 1.1 }); sound.noise({ dur: 0.02, vol: 0.08, filter: 'highpass', f0: 5000, delay: 0.04 }); },
    snip() { if (!sound.throttle('snip', 0.04)) return; sound.noise({ dur: 0.05, vol: 0.12, filter: 'highpass', f0: 3500 }); sound.tone({ type: 'square', f0: 2400, f1: 1800, dur: 0.03, vol: 0.04 }); },
    splash() { if (!sound.throttle('splash', 0.05)) return; sound.noise({ dur: 0.1, vol: 0.09, filter: 'bandpass', f0: 1200, f1: 2600, q: 2 }); },
    hit(n, fin) {
      if (!sound.throttle('hit', 0.03)) return;
      sound.noise({ dur: 0.09, vol: 0.25, filter: 'lowpass', f0: 2600, f1: 400 });
      sound.tone({ type: 'square', f0: 300 + Math.min(n, 20) * 30, f1: 90, dur: 0.08, vol: 0.09 });
      if (fin) { sound.tone({ type: 'sine', f0: 130, f1: 40, dur: 0.3, vol: 0.35 }); sound.bell({ f: 1046, dur: 0.5, vol: 0.08 }); }
    },
    roll() { sound.noise({ dur: 0.22, vol: 0.12, filter: 'bandpass', f0: 900, f1: 2400, q: 0.9 }); },
    perfect() { sound.bell({ f: 1568, dur: 1, vol: 0.14 }); sound.bell({ f: 2093, dur: 1.2, vol: 0.08, delay: 0.06 }); sound.tone({ type: 'sine', f0: 1200, f1: 200, dur: 0.5, vol: 0.08 }); },
    slam() { sound.tone({ type: 'sine', f0: 110, f1: 35, dur: 0.25, vol: 0.4 }); sound.noise({ dur: 0.15, vol: 0.25, filter: 'lowpass', f0: 1200, f1: 100 }); },
    die() { if (!sound.throttle('die', 0.04)) return; sound.tone({ type: 'square', f0: 280, f1: 900, dur: 0.1, vol: 0.07 }); sound.noise({ dur: 0.2, vol: 0.18, filter: 'lowpass', f0: 1600, f1: 200 }); },
    shoot() { if (!sound.throttle('shoot', 0.08)) return; sound.noise({ dur: 0.12, vol: 0.08, filter: 'lowpass', f0: 600, f1: 300 }); },
    pot() { sound.bell({ f: 2400, dur: 0.15, vol: 0.06 }); sound.noise({ dur: 0.15, vol: 0.2, filter: 'highpass', f0: 1800 }); },
    charged() { sound.bell({ f: 1319, dur: 0.5, vol: 0.12 }); },
    spin() { sound.noise({ dur: 0.35, vol: 0.14, filter: 'bandpass', f0: 800, f1: 2200, q: 1 }); sound.noise({ dur: 0.35, vol: 0.12, filter: 'bandpass', f0: 2200, f1: 800, q: 1, delay: 0.3 }); },
    hurt() { sound.tone({ type: 'triangle', f0: 500, f1: 150, dur: 0.22, vol: 0.14 }); sound.noise({ dur: 0.2, vol: 0.18, filter: 'lowpass', f0: 2000, f1: 200 }); },
    heal() { [784, 988, 1319].forEach((f, i) => sound.tone({ type: 'triangle', f0: f, dur: 0.12, vol: 0.07, delay: i * 0.06 })); },
    coin() { if (!sound.throttle('coin', 0.04)) return; sound.tone({ type: 'pulse25', f0: 1976, dur: 0.04, vol: 0.04 }); sound.tone({ type: 'pulse25', f0: 2637, dur: 0.08, vol: 0.04, delay: 0.04 }); },
    seed() { if (!sound.throttle('seed', 0.05)) return; sound.tone({ type: 'triangle', f0: 660, f1: 990, dur: 0.1, vol: 0.06 }); },
    wave() { [523, 659, 784, 1047].forEach((f, i) => sound.tone({ type: 'square', f0: f, dur: 0.12, vol: 0.05, delay: i * 0.08 })); },
    clear() { [784, 988, 1175, 1568].forEach((f, i) => sound.bell({ f, dur: 0.9, vol: 0.09, delay: i * 0.08 })); },
    spawn() { if (!sound.throttle('spawn', 0.15)) return; sound.noise({ dur: 0.3, vol: 0.06, filter: 'lowpass', f0: 400, f1: 900 }); },
    boom() { sound.noise({ dur: 0.3, vol: 0.25, filter: 'lowpass', f0: 2000, f1: 200 }); sound.tone({ type: 'sine', f0: 90, f1: 40, dur: 0.25, vol: 0.3 }); },
    shield() { sound.bell({ f: 1760, dur: 0.4, vol: 0.1 }); sound.tone({ type: 'triangle', f0: 880, f1: 1760, dur: 0.1, vol: 0.06 }); },
    tele() { if (!sound.throttle('tele', 0.2)) return; sound.tone({ type: 'triangle', f0: 880, f1: 1320, dur: 0.1, vol: 0.05 }); },
    roar() { sound.tone({ type: 'sawtooth', f0: 140, f1: 70, dur: 0.7, vol: 0.1 }); sound.noise({ dur: 0.7, vol: 0.18, filter: 'lowpass', f0: 900, f1: 200 }); },
    door() { sound.noise({ dur: 0.4, vol: 0.1, filter: 'lowpass', f0: 500, f1: 1500 }); sound.bell({ f: 1047, dur: 0.6, vol: 0.06, delay: 0.1 }); },
  };

  // ---------------- 地圖與碰撞 ----------------
  const tileAt = (tx, ty) => room.at(tx, ty);
  const solid = (tx, ty) => { const t = tileAt(tx, ty); return t === TILE.WALL || t === TILE.PLANTER; };
  function pushOut(e, flying) {
    let nx = 0, ny = 0, hit = false;
    const x0 = Math.floor((e.x - e.r) / T), x1 = Math.floor((e.x + e.r) / T), y0 = Math.floor((e.y - e.r) / T), y1 = Math.floor((e.y + e.r) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      if (!(t === TILE.WALL || (t === TILE.PLANTER && !flying))) continue;
      const cx = clamp(e.x, tx * T, tx * T + T), cy = clamp(e.y, ty * T, ty * T + T);
      const dx = e.x - cx, dy = e.y - cy, d = Math.hypot(dx, dy);
      if (d >= e.r) continue;
      if (d < 0.0001) {
        const l = e.x - tx * T, r = tx * T + T - e.x, u = e.y - ty * T, b = ty * T + T - e.y, m = Math.min(l, r, u, b);
        if (m === l) { e.x -= l + e.r; nx -= 1; } else if (m === r) { e.x += r + e.r; nx += 1; } else if (m === u) { e.y -= u + e.r; ny -= 1; } else { e.y += b + e.r; ny += 1; }
      } else { const push = e.r - d; e.x += dx / d * push; e.y += dy / d * push; nx += dx / d; ny += dy / d; }
      hit = true;
    }
    // 花盆也擋路
    if (!flying) for (const p of pots) {
      if (p.broken) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy), min = e.r + 5;
      if (d < min && d > 0.001) { e.x += dx / d * (min - d); e.y += dy / d * (min - d); nx += dx / d; ny += dy / d; hit = true; }
    }
    if (!hit) return null;
    const m = Math.hypot(nx, ny) || 1;
    return { nx: nx / m, ny: ny / m };
  }
  function move(e, dt, flying) {
    const dist = Math.hypot(e.vx, e.vy) * dt;
    const n = Math.max(1, Math.ceil(dist / 4));
    let normal = null;
    for (let i = 0; i < n; i++) {
      e.x += e.vx * dt / n; e.y += e.vy * dt / n;
      const c = pushOut(e, flying);
      if (c) {
        normal = c;
        const vn = e.vx * c.nx + e.vy * c.ny;
        if (vn < 0) { e.vx -= c.nx * vn; e.vy -= c.ny * vn; }
      }
    }
    return normal;
  }
  const tileUnder = e => tileAt(Math.floor(e.x / T), Math.floor(e.y / T));

  // ---------------- 祝福與數值 ----------------
  const boon = id => P.allBoons ? 3 : (run().boons[id] || 0);
  const weapon = () => WEAPONS[run().weapon] || WEAPONS.scythe;
  const dmgMul = () => (1 + boon('steelLeaf') * 0.2) * P.playerDamage;
  const reachMul = () => 1 + boon('longHandle') * 0.12;
  const speedMul = () => (1 + boon('tailwind') * 0.08) * (weapon().speed || 1);
  const enemyHpMul = () => (1 + 0.28 * spec.floor) * P.enemyHp;

  // ---------------- 進入房間 ----------------
  function enterRoom(s) {
    spec = s;
    const tpl = roomTemplate(s.type);
    room = buildRoom(tpl);
    floorLayer = buildFloor(room, s.floor);
    const sx = room.start.tx * T + 8, sy = room.start.ty * T + 8;
    const r = run();
    pl = {
      x: sx, y: sy, vx: 0, vy: 0, r: 5, aim: -Math.PI / 2, dir: 'up', flip: false, inv: 0.6, hurtT: 0,
      roll: null, rollCD: 0, charges: r.rollMax, chargeT: 0, atk: null, chain: null, chainT: 0, charge: 0, charging: false,
      walk: 0, blade: Math.PI * 0.75, prevBlade: 0, slowT: 0, vineDist: 0, flash: 0, mintT: 0, snip: null, spray: null,
    };
    r.shield = boon('honeyShield');
    enemies = []; pots = room.pots.map(({ tx, ty }) => ({ x: tx * T + 8, y: ty * T + 12, broken: false }));
    puffs = room.puffs.map(({ tx, ty }) => ({ x: tx * T + 8, y: ty * T + 10, t: 0, blown: false, hitT: 0 }));
    spores = []; waves = []; pshots = []; vines = []; bursts = []; zones = []; pickups = []; props = []; doors = [];
    hitstop = 0; time = 0; combo = 0; comboT = 0; lastHit = -1; waveIdx = 0; spawnDelay = 0.9; cleared = false; boss = null; dying = false; deathT = 0; rewardT = 0; clearT = 0;
    parts.clear(); floats.list.length = 0; shake.reset();
    cam.bounds = { w: room.MW * T, h: room.MH * T };
    cam.center(pl.x, pl.y - 20);
    // 門（先上鎖，清完房間才打開）
    const opts = s.type === 'boss' ? [{ type: 'stairs', reward: null }] : doorOptions(s.floor, s.room, r);
    const slots = opts.length === 1 ? [room.doorSlots[1]] : opts.length === 2 ? [room.doorSlots[0], room.doorSlots[2]] : room.doorSlots;
    opts.forEach((o, i) => doors.push({ x: slots[i] * T + T, y: 2 * T, option: o, open: false, t: 0 }));
    // 房間種類
    waveQ = [];
    if (s.type === 'battle' || s.type === 'elite') {
      const nw = s.type === 'elite' ? 3 : s.room === 0 && s.floor === 0 ? 1 : 2;
      for (let i = 0; i < nw; i++) waveQ.push(waveEnemies(s.floor, s.room, i, s.type === 'elite' && i === 0));
      banner = { text: s.type === 'elite' ? '強敵出現' : null, t: 1.4 };
    } else if (s.type === 'boss') {
      banner = { text: FLOORS[s.floor].bossName, t: 2.2, boss: true };
      spawnDelay = 1.6;
    } else if (s.type === 'fountain') {
      props.push({ kind: 'fountain', x: room.MW * T / 2, y: room.MH * T / 2 + 4, used: false });
      banner = { text: '泉水', t: 1.2 };
      roomCleared(true);
    } else if (s.type === 'shop') {
      makeShop();
      banner = { text: '刺蝟的行商', t: 1.2 };
      roomCleared(true);
    }
    if (P.showHitbox) { /* 無 */ }
  }
  const SHOP_ITEMS = [
    { id: 'heal', name: '生命花蜜', desc: '回復 3 點體力。', price: 30 },
    { id: 'maxhp', name: '生命之葉', desc: '最大體力 +1（同時回復 1 點）。', price: 65 },
    { id: 'boon', name: '祝福花苞', desc: '從三個祝福中選一個。', price: 85 },
    { id: 'upgrade', name: '陽光肥料', desc: '讓一個已有的祝福升一級。', price: 70, needBoon: true },
    { id: 'seeds', name: '種子袋', desc: '這一輪多得 10 顆種子（回到小屋可用）。', price: 45 },
    { id: 'reroll', name: '幸運草', desc: '重擲次數 +1（選祝福時可以換一組）。', price: 35 },
  ];
  function makeShop() {
    const r = run();
    const list = SHOP_ITEMS.filter(it => !it.needBoon || Object.keys(r.boons).length).sort(() => Math.random() - 0.5).slice(0, 4);
    const cx = room.MW * T / 2, y = 6 * T;
    list.forEach((it, i) => props.push({ kind: 'item', ...it, price: Math.round(it.price * (1 + spec.floor * 0.15)), x: cx + (i - 1.5) * 44, y: y + 34, sold: false }));
    props.push({ kind: 'merchant', x: cx, y: y - 10 });
  }

  // ---------------- 波次與清場 ----------------
  function spawnWave(list) {
    for (const it of list) {
      for (let tries = 0; tries < 60; tries++) {
        const x = rand(2 * T, (room.MW - 2) * T), y = rand(3 * T, (room.MH - 2) * T);
        if (Math.hypot(x - pl.x, y - pl.y) < 90) continue;
        const tx = Math.floor(x / T), ty = Math.floor(y / T);
        if (tileAt(tx, ty) !== TILE.FLOOR || solid(Math.floor((x - 8) / T), ty) || solid(Math.floor((x + 8) / T), ty)) continue;
        enemies.push(makeEnemy(it.type, x, y, it.elite));
        break;
      }
    }
    sfx.spawn();
  }
  function makeEnemy(type, x, y, elite = false) {
    const d = ENEMY[type];
    const hp = Math.round(d.hp * (d.boss ? P.bossHp : enemyHpMul()) * (elite ? 2.6 : 1));
    return {
      type, d, x, y, vx: 0, vy: 0, r: d.r * (elite ? 1.35 : 1), hp, maxHp: hp, weight: d.weight * (elite ? 1.5 : 1), elite, flash: 0, hitstun: 0,
      state: 'idle', t: rand(0, 2), stateT: rand(0.5, 1.5), dirX: 1, dirY: 0, dead: false, spawnT: d.boss ? 0 : 0.7, slammed: false,
      vineHitT: 0, thornT: 0, shots: 0, rootT: 0, face: 1, n: 0, phase: 1,
    };
  }
  function updateWaves(dt) {
    if (cleared || dying) return;
    const alive = enemies.filter(e => !e.dead).length;
    if (spec.type === 'boss') {
      if (!boss && (spawnDelay -= dt) <= 0) {
        const t = FLOORS[spec.floor].boss;
        boss = makeEnemy(t, room.MW * T / 2, (t === 'rafflesia' ? 6 : 7) * T);
        boss.state = 'intro'; boss.stateT = 0;
        enemies.push(boss);
        sfx.roar(); shake.add(3, 400);
        hooks.onBossStart && hooks.onBossStart();
      }
      if (boss && boss.dead && !dying) roomCleared();
      return;
    }
    if (alive === 0) {
      if (waveIdx < waveQ.length) {
        if ((spawnDelay -= dt) <= 0) { spawnWave(waveQ[waveIdx]); waveIdx++; spawnDelay = 0.8; }
      } else if (waveQ.length) roomCleared();
    }
  }
  function roomCleared(silent) {
    if (cleared) return;
    cleared = true; clearT = 0;
    for (const d of doors) d.open = true;
    const r = run();
    if (!silent) {
      r.roomsCleared++;
      sfx.clear();
      banner = { text: '清除完畢', t: 1.4, good: true };
      const dew = boon('dew');
      if (dew && r.hp < r.maxHp) { r.hp = Math.min(r.maxHp, r.hp + dew); floats.add(pl.x, pl.y - 30, '+' + dew, C.pink, { small: false, outline: C.ink }); sfx.heal(); }
      if (boon('harvest')) addSeeds(boon('harvest'), pl.x, pl.y - 20);
      for (const s of spores) s.dead = true;
      spawnReward();
    }
  }
  function spawnReward() {
    const cx = room.MW * T / 2, cy = room.MH * T / 2 + 8;
    const rw = spec.type === 'boss' ? 'boss' : spec.reward;
    if (rw === 'boon' || rw === 'rare' || rw === 'upgrade') pickups.push({ kind: 'boonOrb', x: cx, y: cy, t: 0, reward: rw });
    else if (rw === 'coins') spawnCoins(cx, cy, 22 + spec.floor * 8 + Math.floor(rand(0, 10)), true);
    else if (rw === 'seeds') for (let i = 0; i < 3 + spec.floor * 2; i++) pickups.push({ kind: 'seed', x: cx + rand(-10, 10), y: cy + rand(-6, 6), vx: rand(-60, 60), vy: rand(-60, 60), t: 0 });
    else if (rw === 'boss') {
      for (let i = 0; i < FLOORS[spec.floor].seeds / 5; i++) pickups.push({ kind: 'seed', x: cx + rand(-10, 10), y: cy + rand(-6, 6), vx: rand(-80, 80), vy: rand(-80, 80), t: 0, value: 5 });
      pickups.push({ kind: 'heart', x: cx - 20, y: cy, t: 0, full: true });
      pickups.push({ kind: 'boonOrb', x: cx + 20, y: cy, t: 0, reward: 'rare' });
    }
  }

  // ---------------- 玩家 ----------------
  const pivot = () => ({ x: pl.x, y: pl.y - 9 });
  function aimVector() {
    const ax = input.axis();
    if (P.aimMode === 'mouse' && mouse.inside) return Math.atan2(mouse.y + cam.y - (pl.y - 9), mouse.x + cam.x - pl.x);
    let a = (Math.abs(ax.x) > 0.2 || Math.abs(ax.y) > 0.2) ? Math.atan2(ax.y, ax.x) : pl.aim;
    if (P.aimMode === 'auto') {
      let best = null, bestD = Infinity;
      const range = weapon().ranged ? 150 : P.radius * 2.3;
      for (const e of enemies) {
        if (e.dead || e.spawnT > 0) continue;
        const dx = e.x - pl.x, dy = e.y - pl.y, d = Math.hypot(dx, dy);
        if (d > range + e.r) continue;
        const da = Math.abs(angDiff(a, Math.atan2(dy, dx)));
        if (da <= P.autoAim * DEG * (weapon().ranged ? 1.3 : 1) && d < bestD) { bestD = d; best = Math.atan2(dy, dx); }
      }
      if (best != null) a = best;
    }
    return a;
  }
  function setFacing(a) {
    const cx = Math.cos(a), cy = Math.sin(a);
    if (Math.abs(cx) > Math.abs(cy) * 0.8) { pl.dir = 'side'; pl.flip = cx < 0; }
    else pl.dir = cy < 0 ? 'up' : 'down';
  }
  function startAttack(kind) {
    const w = weapon(), def = w.combo[kind];
    const ex = def.f || [0, 0, 0];
    pl.aim = aimVector(); setFacing(pl.aim);
    const arc = (def.fixedArc || def.arc || P.arc) * DEG;
    pl.atk = { kind, def, f: 0, S: Math.max(1, P.startup + ex[0]), A: Math.max(1, P.active + ex[1]), R: Math.max(1, P.recovery + ex[2]), hit: new Set(), queued: false,
      a0: pl.aim - (def.sweep || 1) * arc / 2, a1: pl.aim + (def.sweep || 1) * arc / 2, reach: P.radius * (def.reach || 1) * reachMul(), mint: pl.mintT > 0 };
    pl.mintT = 0;
    pl.chain = kind; pl.charging = false; pl.charge = 0;
  }
  function startSpin() {
    const turns = P.spinTurns;
    pl.atk = { kind: 'spin', def: { spin: true, finisher: true, sweep: 1, dmg: weapon().spinDmg || 18 }, f: 0, S: 2, A: 10 * turns, R: 8, hit: new Set(), lap: 0, queued: false, a0: pl.aim, a1: pl.aim + TAU * turns, reach: P.spinRadius * reachMul() };
    pl.charging = false; pl.charge = 0; pl.chain = null;
    sfx.spin();
    if (boon('sunflower')) pshots.push({ kind: 'sun', x: pl.x, y: pl.y - 9, r: 6, max: 70, t: 0, life: 0.5, dmg: 12 * boon('sunflower'), hit: new Set() });
  }
  function startSnip() {
    pl.snip = { t: 0, dx: Math.cos(pl.aim), dy: Math.sin(pl.aim), hits: new Map(), tick: 0 };
    pl.charging = false; pl.charge = 0; pl.chain = null; pl.atk = null;
    sfx.spin();
  }
  function startSpray() {
    pl.spray = { t: 0 };
    pl.charging = false; pl.charge = 0; pl.chain = null; pl.atk = null;
  }
  function bladeAngle(a) {
    const { f, S, A } = a;
    const wind = a.a0 - 0.35 * sign(a.a1 - a.a0);
    if (f < S) return pl.blade + angDiff(pl.blade, wind) * easeOut((f + 1) / (S + 1));
    if (f < S + A) return lerp(wind, a.a1, a.def.spin ? (f - S + 1) / A : easeOut((f - S + 1) / A));
    return a.a1;
  }
  function startRoll() {
    const ax = input.axis();
    const a = (Math.abs(ax.x) > 0.2 || Math.abs(ax.y) > 0.2) ? Math.atan2(ax.y, ax.x) : pl.aim;
    pl.roll = { t: 0, dx: Math.cos(a), dy: Math.sin(a), perfect: false };
    pl.atk = null; pl.charging = false; pl.charge = 0; pl.snip = null; pl.spray = null;
    pl.aim = a; setFacing(a);
    pl.charges--;
    parts.burst(pl.x, pl.y - 2, 6, { dir: a + Math.PI, spread: 1.2, speed: [30, 80], colors: [C.cream, C.mauve, C.plum], shape: 'sq', size: 2, life: [0.2, 0.4] });
    sfx.roll();
  }
  const invulnerable = () => pl.inv > 0 || (pl.roll && pl.roll.t <= P.rollTime * P.rollIframes) || P.godMode || dying;
  function hurtPlayer(src, dmg = 1) {
    if (invulnerable()) return false;
    const r = run();
    const dx = pl.x - src.x, dy = pl.y - src.y, d = Math.hypot(dx, dy) || 1;
    if (r.shield > 0) {
      r.shield--;
      pl.inv = 0.8;
      parts.add({ x: pl.x, y: pl.y - 9, shape: 'ring', r0: 4, r1: 20, life: 0.3, colors: [C.white, C.peach, C.skin] });
      floats.add(pl.x, pl.y - 30, 'BLOCK', C.peach, { small: false, outline: C.ink });
      sfx.shield();
      return true;
    }
    r.hp -= dmg;
    pl.vx = dx / d * P.hurtKnock; pl.vy = dy / d * P.hurtKnock;
    pl.inv = P.iframes / 1000; pl.hurtT = 0.25; pl.atk = null; pl.charging = false; pl.charge = 0; pl.flash = 0.08; pl.snip = null; pl.spray = null;
    hitstop = Math.max(hitstop, P.hurtHitstop / 1000);
    shake.add(P.shake + 2, 220, dx / d, dy / d);
    combo = 0;
    parts.burst(pl.x, pl.y - 10, 14, { speed: [40, 120], colors: [C.white, C.pink, C.plum], shape: 'sq', size: 2, life: [0.3, 0.5] });
    sfx.hurt();
    const ta = boon('thornArmor');
    if (ta) {
      parts.add({ x: pl.x, y: pl.y - 9, shape: 'ring', r0: 4, r1: 44, life: 0.3, colors: [C.lleaf, C.leaf] });
      for (const e of enemies) if (!e.dead && e.spawnT <= 0 && Math.hypot(e.x - pl.x, e.y - pl.y) < 44 + e.r) hitEnemy(e, 20 * ta, Math.atan2(e.y - pl.y, e.x - pl.x), { knock: 1.2 });
    }
    if (r.hp <= 0) {
      if (r.revive) {
        r.revive = false; r.hp = Math.ceil(r.maxHp / 2);
        pl.inv = 2;
        parts.add({ x: pl.x, y: pl.y - 9, shape: 'ring', r0: 4, r1: 60, life: 0.6, colors: [C.white, C.pink, C.peach] });
        parts.burst(pl.x, pl.y - 9, 30, { speed: [40, 160], colors: [C.pink, C.peach, C.white], shape: 'star', size: 2, life: [0.4, 0.9] });
        floats.add(pl.x, pl.y - 34, 'REVIVE', C.pink, { small: false, outline: C.ink, life: 1.4 });
        for (const e of enemies) if (!e.dead && !e.d.boss && Math.hypot(e.x - pl.x, e.y - pl.y) < 70) hitEnemy(e, 40, Math.atan2(e.y - pl.y, e.x - pl.x), { knock: 1.5 });
        sfx.heal();
      } else {
        r.hp = 0; dying = true; deathT = 0;
        hitstop = 0.3; shake.add(5, 500);
        sound.tone({ type: 'square', f0: 600, f1: 80, dur: 0.9, vol: 0.12 });
      }
    }
    return true;
  }
  function dodged() {
    if (!pl.roll || pl.roll.perfect || !P.perfectDodge || pl.roll.t > P.perfectWindow) return;
    pl.roll.perfect = true;
    pl.slowT = P.perfectDur;
    parts.add({ x: pl.x, y: pl.y - 9, shape: 'ring', r0: 4, r1: 40, life: 0.4, colors: [C.white, C.teal, C.lime] });
    floats.add(pl.x, pl.y - 30, 'PERFECT', C.teal, { small: false, outline: C.ink, life: 1 });
    sfx.perfect();
    const dd = boon('dandelion');
    if (dd) for (let i = 0; i < 2 + dd; i++) { const a = i / (2 + dd) * TAU; pshots.push({ kind: 'seed', x: pl.x, y: pl.y - 9, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 2.5, dmg: 10, hit: new Set(), t: 0 }); }
  }

  function updatePlayer(dt) {
    const r = run();
    pl.inv -= dt; pl.hurtT -= dt; pl.rollCD -= dt; pl.chainT -= dt; pl.flash -= dt; pl.mintT -= dt;
    // 翻滾次數回復
    if (pl.charges < r.rollMax) { pl.chargeT += dt * (1 + boon('tailwind') * 0.25); if (pl.chargeT >= P.rollRecharge) { pl.chargeT = 0; pl.charges++; } } else pl.chargeT = 0;
    const ax = input.axis();
    let mx = ax.x, my = ax.y;
    if (!P.diagNormalize) { mx = sign(Math.round(mx * 1.4)); my = sign(Math.round(my * 1.4)); }
    const moving = Math.abs(mx) > 0.15 || Math.abs(my) > 0.15;
    if (moving && !pl.atk && !pl.roll && !pl.snip) { pl.aim = Math.atan2(my, mx); setFacing(pl.aim); }
    if (P.aimMode === 'mouse' && mouse.inside && !pl.roll && !pl.atk && !pl.snip) { pl.aim = aimVector(); setFacing(pl.aim); }
    const w = weapon();
    const slowTile = tileUnder(pl) === TILE.WATER ? 0.6 : 1;
    const zoneSlow = zones.some(z => z.kind === 'honey' && Math.hypot(z.x - pl.x, z.y - pl.y) < z.r) ? 0.55 : 1;

    if (pl.roll) {
      const ro = pl.roll;
      ro.t += dt;
      const u = clamp(ro.t / P.rollTime, 0, 1);
      const sp = P.rollSpeed * P.rollCurve * Math.pow(1 - u, P.rollCurve - 1) * slowTile;
      pl.vx = ro.dx * sp; pl.vy = ro.dy * sp;
      const vd = boon('vineDash');
      if (vd) { pl.vineDist += sp * dt; if (pl.vineDist > 7) { pl.vineDist = 0; vines.push({ x: pl.x, y: pl.y, life: 1.2 + vd * 0.4, max: 1.6, v: Math.floor(rand(0, 3)), dmg: 6 + vd * 4 }); } }
      if (Math.floor(ro.t * 60) % 3 === 0) parts.add({ x: pl.x + rand(-3, 3), y: pl.y, vx: -ro.dx * 20, vy: -ro.dy * 20 - 10, life: 0.3, colors: [C.cream, C.mauve], shape: 'sq', size: 2 });
      if (ro.t >= P.rollTime) {
        pl.roll = null; pl.rollCD = P.rollCooldown;
        pl.vx = ro.dx * P.moveSpeed * 0.8; pl.vy = ro.dy * P.moveSpeed * 0.8;
        if (boon('mint')) pl.mintT = 1;
      }
    } else if (pl.snip) {
      // 雙刃剪蓄力：向前突進連剪
      const sn = pl.snip;
      sn.t += dt;
      const sp = 260 * (1 - sn.t / 0.45);
      pl.vx = sn.dx * sp; pl.vy = sn.dy * sp;
      if ((sn.tick -= dt) <= 0) {
        sn.tick = 0.07; sfx.snip();
        const hx = pl.x + sn.dx * 12, hy = pl.y - 9 + sn.dy * 12;
        for (const e of enemies) {
          if (e.dead || e.spawnT > 0) continue;
          const n = sn.hits.get(e) || 0;
          if (n >= 4 || Math.hypot(e.x - hx, e.y - 6 - hy) > e.r + 16) continue;
          sn.hits.set(e, n + 1);
          hitEnemy(e, 8, Math.atan2(sn.dy, sn.dx), { knock: 0.35, fin: n === 3 });
        }
        pl.blade = Math.atan2(sn.dy, sn.dx) + (Math.floor(sn.t * 30) % 2 ? 0.6 : -0.6);
        parts.add({ x: hx, y: hy, shape: 'star', size: 3, life: 0.06, colors: [C.white, C.teal] });
      }
      if (sn.t >= 0.45) { pl.snip = null; pl.vx *= 0.3; pl.vy *= 0.3; }
    } else {
      const canAct = pl.hurtT <= 0;
      const a = pl.atk;
      const inRecovery = a && a.f >= a.S + a.A;
      if (canAct && input.pressed('roll') && pl.rollCD <= 0 && pl.charges >= 1 && (!a || (P.rollCancel && inRecovery)) ) { pl.spray = null; startRoll(); }
      else if (canAct && input.pressed('attack') && !pl.spray) {
        if (!a) {
          const next = pl.chain && pl.chainT > 0 && w.combo[pl.chain] && w.combo[pl.chain].next;
          startAttack(next || w.first);
        } else a.queued = true;
      }
      // 蓄力：揮擊結束後仍按住攻擊
      if (!pl.atk && !pl.roll && !pl.spray && input.down('attack') && canAct) {
        pl.charging = true;
        const before = pl.charge;
        pl.charge += dt;
        if (before < P.chargeTime && pl.charge >= P.chargeTime) { parts.add({ x: pl.x, y: pl.y - 9, shape: 'ring', r0: 14, r1: 3, life: 0.2, colors: [C.white, C.teal] }); sfx.charged(); }
        if (Math.random() < 0.5) { const an = rand(0, TAU), rr = rand(14, 20); parts.add({ x: pl.x + Math.cos(an) * rr, y: pl.y - 9 + Math.sin(an) * rr, vx: -Math.cos(an) * 60, vy: -Math.sin(an) * 60, life: 0.25, colors: pl.charge >= P.chargeTime ? [C.white, C.teal] : [C.lime, C.lleaf], shape: 'px' }); }
      }
      if (pl.charging && !input.down('attack')) {
        if (pl.charge >= P.chargeTime) { pl.aim = aimVector(); setFacing(pl.aim); if (w.charge === 'spin') startSpin(); else if (w.charge === 'snip') startSnip(); else startSpray(); }
        pl.charging = false; pl.charge = 0;
      }
      // 澆水壺蓄力：持續灑水
      if (pl.spray) {
        const sp = pl.spray;
        sp.t += dt;
        pl.aim = aimVector(); setFacing(pl.aim);
        if (Math.floor(sp.t * 30) !== Math.floor((sp.t - dt) * 30)) {
          const a2 = pl.aim + rand(-0.35, 0.35);
          pshots.push({ kind: 'drop', x: pl.x + Math.cos(pl.aim) * 8, y: pl.y - 9 + Math.sin(pl.aim) * 8, vx: Math.cos(a2) * rand(200, 260), vy: Math.sin(a2) * rand(200, 260), life: 0.4, dmg: 6, knock: 0.9, hit: new Set(), t: 0 });
          sfx.splash();
        }
        if (sp.t > 0.8) pl.spray = null;
      }
      if (pl.atk) {
        const at = pl.atk;
        at.f++;
        if (at.f === at.S + 1) {
          if (at.def.shot) {
            const n = at.def.shot, spread = n > 1 ? 0.28 : 0;
            for (let i = 0; i < n; i++) {
              const a2 = pl.aim + (i - (n - 1) / 2) * spread + rand(-0.04, 0.04);
              pshots.push({ kind: 'drop', x: pl.x + Math.cos(pl.aim) * 8, y: pl.y - 9 + Math.sin(pl.aim) * 8, vx: Math.cos(a2) * 280, vy: Math.sin(a2) * 280, life: 0.55, dmg: at.def.dmg * (at.mint ? 1 + boon('mint') * 0.5 : 1), knock: 0.5, hit: new Set(), t: 0, fin: at.def.finisher });
            }
            pl.vx -= Math.cos(pl.aim) * 30; pl.vy -= Math.sin(pl.aim) * 30;
            sfx.splash();
          } else {
            const lunge = P.lunge * (at.def.finisher ? 1.4 : 1) * (at.def.spin ? 0.3 : 1);
            pl.vx = Math.cos(pl.aim) * lunge; pl.vy = Math.sin(pl.aim) * lunge;
            if (!at.def.spin) { if (run().weapon === 'shears') sfx.snip(); else sfx.swing(at.kind === 'c3' ? 2 : at.kind === 'c2' ? 1 : 0); }
          }
          const cr = boon('crescent');
          if (at.def.finisher && !at.def.spin && cr) {
            const angs = cr >= 3 ? [pl.aim - 0.25, pl.aim + 0.25] : [pl.aim];
            for (const an of angs) waves.push({ x: pl.x, y: pl.y - 9, vx: Math.cos(an) * 230, vy: Math.sin(an) * 230, a: an, life: 0.62, hit: new Set(), dmg: 10 + cr * 8 });
          }
        }
        if (at.def.spin) { const lap = Math.floor((at.f - at.S) / (at.A / P.spinTurns)); if (lap !== at.lap && at.f < at.S + at.A) { at.lap = lap; at.hit.clear(); } }
        const cancelAt = at.S + at.A + Math.ceil(at.R * P.comboCancel);
        if (at.queued && at.f >= cancelAt && at.def.next) startAttack(at.def.next);
        else if (at.f >= at.S + at.A + at.R) { pl.atk = null; pl.chainT = P.comboWindow / 1000; if (at.def.finisher) pl.chain = null; }
      }
      const slow = pl.atk ? (w.ranged ? 0.55 : P.atkMove) : pl.charging ? P.chargeMove : pl.spray ? 0.35 : 1;
      const spd = P.moveSpeed * speedMul() * slowTile * zoneSlow;
      const tx = mx * spd * slow, ty = my * spd * slow;
      let dvx = tx - pl.vx, dvy = ty - pl.vy;
      const dvm = Math.hypot(dvx, dvy);
      let accel = moving ? P.accel : P.friction;
      if (moving && pl.vx * tx + pl.vy * ty < 0) accel *= P.turnBoost;
      if (pl.atk && pl.atk.f <= pl.atk.S + 2 && !pl.atk.def.shot) accel = P.friction * 0.25;
      if (pl.hurtT > 0) accel = 400;
      const step = accel * dt;
      if (dvm > step) { dvx *= step / dvm; dvy *= step / dvm; }
      pl.vx += dvx; pl.vy += dvy;
    }
    move(pl, dt);
    const sp = Math.hypot(pl.vx, pl.vy);
    if (!pl.roll && sp > 10) pl.walk += sp * dt / 16;
    pl.prevBlade = pl.blade;
    if (pl.atk && !pl.atk.def.shot) pl.blade = bladeAngle(pl.atk);
    else if (!pl.snip) {
      const rest = pl.charging ? pl.aim + Math.PI * 0.85 : pl.aim + Math.PI * 0.72;
      pl.blade += angDiff(pl.blade, w.ranged ? pl.aim : rest) * smoothK(dt, pl.charging ? 0.03 : 0.06);
    }
    // 荊棘地面
    if (tileUnder(pl) === TILE.THORN && !pl.roll) hurtPlayer({ x: pl.x, y: pl.y + 4 });
  }

  // ---------------- 攻擊判定 ----------------
  function sweepHits(cx, cy, a0, a1, reach) {
    const lo = Math.min(a0, a1) - 0.12, hi = Math.max(a0, a1) + 0.12;
    return (x, y, r) => {
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
      if (d > reach + r) return false;
      if (d < 7) return true;
      const m = Math.asin(Math.min(1, r / d));
      let ang = Math.atan2(dy, dx);
      while (ang < lo - m) ang += TAU;
      while (ang > lo - m + TAU) ang -= TAU;
      return ang <= hi + m;
    };
  }
  function checkHits() {
    const a = pl.atk;
    if (!a || a.def.shot || a.f <= a.S || a.f > a.S + a.A) return;
    const pv = pivot();
    const test = sweepHits(pv.x, pv.y, pl.prevBlade, pl.blade, a.reach);
    for (const e of enemies) {
      if (e.dead || e.spawnT > 0 || a.hit.has(e) || e.hidden) continue;
      if (test(e.x, e.y - 6, e.r)) {
        a.hit.add(e);
        const dmg = a.def.dmg * (a.mint ? 1 + boon('mint') * 0.5 : 1);
        hitEnemy(e, dmg, Math.atan2(e.y - pl.y, e.x - pl.x), { fin: !!a.def.finisher, melee: true });
      }
    }
    for (const p of pots) if (!p.broken && test(p.x, p.y - 5, 5)) breakPot(p);
    for (const p of puffs) if (!p.blown && test(p.x, p.y - 4, 6)) blowPuff(p);
    if (P.cutSpores) for (const s of spores) if (!s.dead && s.cuttable !== false && test(s.x, s.y, 3)) { s.dead = true; parts.burst(s.x, s.y, 6, { speed: [20, 70], colors: [C.pink, C.lime, C.white], life: [0.2, 0.35] }); if (sound.throttle('cutText', 0.35)) floats.add(s.x, s.y - 6, 'CUT', C.white, { outline: C.ink }); sfx.shoot(); }
  }
  /** 對魔物造成傷害。o: { fin, melee, knock（擊退倍率）, noCombo } */
  function hitEnemy(e, dmg, ang, o = {}) {
    if (e.dead || e.hidden) return;
    dmg = Math.round(dmg * dmgMul());
    if (!o.noCombo) { combo++; comboT = 1.6; lastHit = time; }
    const fin = !!o.fin;
    if (e.d.weight < 50 && !e.d.boss) {
      const kb = P.knock * (fin ? P.finisherKnock : 1) * (o.knock ?? 1) / e.weight;
      e.vx = Math.cos(ang) * kb; e.vy = Math.sin(ang) * kb;
      e.hitstun = P.hitstun / 1000 * (fin ? 1.4 : 1) * (e.elite ? 0.6 : 1);
      e.slammed = false;
      if (e.state === 'charge' || e.state === 'aim' || e.state === 'dive') { e.state = 'walk'; e.stateT = 1.2; }
    } else if (!e.d.boss) e.hitstun = 0.15;
    e.hp -= dmg;
    e.flash = P.flashFrames / 60;
    const rb = boon('rootBind');
    if (rb && !e.d.boss && Math.random() < rb * 0.15) { e.rootT = 1.5; floats.add(e.x, e.y - 26, 'ROOT', C.lleaf, { outline: C.ink }); }
    if (o.melee || fin) {
      const stop = (fin ? P.hitstopFinisher : P.hitstop) / 1000;
      hitstop = Math.max(hitstop, stop);
      e.shakeT = stop;
      shake.add(fin ? P.shakeFinisher : P.shake, fin ? 260 : 150, Math.cos(ang), Math.sin(ang));
    }
    const px = e.x - Math.cos(ang) * e.r, py = e.y - 6 - Math.sin(ang) * e.r;
    const n = P.sparks;
    if (n) {
      parts.burst(px, py, n, { dir: ang, spread: 2.2, speed: [60, 180], colors: [C.white, C.teal, C.lime], shape: 'line', len: 0.035, life: [0.12, 0.25], drag: 6 });
      parts.burst(px, py, Math.ceil(n * 0.6), { dir: ang, spread: 2.6, speed: [30, 110], colors: [C.lime, C.lleaf, C.leaf], shape: 'sq', size: 2, shrink: 0.6, life: [0.35, 0.7], gravity: 60, drag: 3 });
      parts.add({ x: px, y: py, shape: 'star', size: fin ? 6 : 4, life: 0.12, colors: [C.white, C.teal] });
      if (fin) parts.add({ x: px, y: py, shape: 'ring', r0: 3, r1: 22, life: 0.22, colors: [C.white, C.teal, C.lime] });
    }
    if (P.damageNumbers) floats.add(e.x + rand(-5, 5), e.y - 20 - (combo % 3) * 3 - (e.d.boss ? e.r : 0), dmg, fin ? C.lime : C.white, { outline: C.ink });
    sfx.hit(combo, fin);
    if (e.hp <= 0 && !e.dead) killEnemy(e);
  }
  function killEnemy(e) {
    e.dead = true;
    const r = run();
    r.kills++;
    const cols = e.type.startsWith('slime') ? [C.lime, C.lleaf, C.leaf] : e.type === 'beetle' ? [C.plum, C.pink, C.shadow] : e.type === 'bee' ? [C.peach, C.soil, C.white] : e.type === 'cactus' || e.type === 'snapper' ? [C.leaf, C.lleaf, C.pink] : [C.terra, C.cream, C.soil];
    const big = e.d.boss ? 3 : 1;
    parts.burst(e.x, e.y - 6, 18 * big, { speed: [40, 150 * big], colors: cols, shape: 'sq', size: 3, life: [0.3, 0.6 * big], gravity: 120, drag: 2 });
    parts.add({ x: e.x, y: e.y - 6, shape: 'ring', r0: 2, r1: 18 * big, life: 0.25 * big, colors: [C.white, C.lime] });
    shake.add(P.shake + 1, 180);
    sfx.die();
    const pl2 = boon('pollen');
    if (pl2 && !e.d.boss) bursts.push({ x: e.x, y: e.y - 6, t: 0.22, dmg: 10 + pl2 * 8, r: 30 });
    if (!e.d.boss) {
      spawnCoins(e.x, e.y, Math.round(e.d.coins * (e.elite ? 4 : 1)));
      if (Math.random() < 0.05 + (e.elite ? 0.3 : 0)) pickups.push({ kind: 'heart', x: e.x, y: e.y, t: 0 });
      if (e.elite) addSeeds(2, e.x, e.y);
    }
    if (e.type === 'slime' && e.elite) for (let i = 0; i < 3; i++) { const m = makeEnemy('slimeMini', e.x + rand(-6, 6), e.y + rand(-6, 6)); m.spawnT = 0; m.vx = rand(-120, 120); m.vy = rand(-120, 120); m.hitstun = 0.3; enemies.push(m); }
    if (e.d.boss) {
      hitstop = 0.35;
      shake.add(7, 900);
      for (const x of enemies) if (!x.dead && x !== e) { x.dead = true; parts.burst(x.x, x.y - 6, 10, { speed: [30, 100], colors: [C.lime, C.white], shape: 'sq', size: 2, life: [0.3, 0.6] }); }
      for (const s of spores) s.dead = true;
      zones = [];
      sfx.roar();
      hooks.onBossDefeated && hooks.onBossDefeated();
    }
  }
  function breakPot(p) {
    p.broken = true;
    parts.burst(p.x, p.y - 4, 12, { speed: [40, 130], colors: [C.terra, C.soil, C.peach], shape: 'sq', size: 2, life: [0.3, 0.6], gravity: 220, drag: 1 });
    parts.burst(p.x, p.y - 8, 8, { speed: [20, 80], colors: [C.lime, C.lleaf, C.leaf], shape: 'sq', size: 2, life: [0.4, 0.8], gravity: 40, drag: 2 });
    shake.add(1.5, 100);
    sfx.pot();
    const r = Math.random();
    if (r < 0.15) pickups.push({ kind: 'heart', x: p.x, y: p.y, t: 0 });
    else if (r < 0.6) spawnCoins(p.x, p.y, 2 + Math.floor(rand(0, 3)));
  }
  function blowPuff(p) {
    if (p.blown) return;
    p.blown = true;
    parts.add({ x: p.x, y: p.y - 4, shape: 'ring', r0: 4, r1: 34, life: 0.3, colors: [C.white, C.pink, C.peach] });
    parts.burst(p.x, p.y - 4, 20, { speed: [40, 150], colors: [C.pink, C.peach, C.cream], shape: 'sq', size: 2, life: [0.3, 0.6] });
    shake.add(3, 200); sfx.boom();
    for (const e of enemies) if (!e.dead && e.spawnT <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < 34 + e.r) hitEnemy(e, 30, Math.atan2(e.y - p.y, e.x - p.x), { knock: 1.3, noCombo: true });
    for (const q of puffs) if (!q.blown && Math.hypot(q.x - p.x, q.y - p.y) < 40) setTimeout(() => blowPuff(q), 120);
    for (const q of pots) if (!q.broken && Math.hypot(q.x - p.x, q.y - p.y) < 34) breakPot(q);
    if (Math.hypot(pl.x - p.x, pl.y - p.y) < 26) hurtPlayer(p);
  }
  function spawnCoins(x, y, n, pile) {
    n = Math.round(n * (1 + boon('harvest') * 0.4) * P.coinMul);
    for (let i = 0; i < n; i++) pickups.push({ kind: 'coin', x: x + rand(-4, 4), y: y + rand(-4, 4), vx: rand(-90, 90) * (pile ? 0.6 : 1), vy: rand(-90, 90) * (pile ? 0.6 : 1), t: 0 });
  }
  function addSeeds(n, x, y) {
    run().seeds += n;
    floats.add(x, y - 10, `+${n} SEED`, C.lime, { outline: C.ink });
    sfx.seed();
  }

  // ---------------- 魔物 AI ----------------
  function fire(e, a, speed, o = {}) { spores.push({ x: e.x, y: e.y - 8, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: o.life || 3.2, dead: false, kind: o.kind || 'spore', r: o.r || 3, cuttable: o.cuttable, honey: o.honey }); }
  function updateEnemy(e, dt) {
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.spawnT > 0) { e.spawnT -= dt; if (Math.random() < 0.3) parts.add({ x: e.x + rand(-5, 5), y: e.y, vx: rand(-15, 15), vy: rand(-30, -10), life: 0.3, colors: [C.soil, C.terra], shape: 'sq', size: 1 }); return; }
    if (e.d.boss) { BOSS[e.type](e, dt); bossContact(e); return; }
    const dx = pl.x - e.x, dy = pl.y - e.y, dist = Math.hypot(dx, dy) || 1;
    const spd = P.enemySpeed * (1 + spec.floor * 0.08);
    const aggro = P.enemyAggro && !dying;
    if (e.vineHitT > 0) e.vineHitT -= dt;
    if (e.thornT > 0) e.thornT -= dt;
    if (e.rootT > 0) { e.rootT -= dt; e.vx *= 0.8; e.vy *= 0.8; move(e, dt); contact(e); return; }
    if (e.hitstun > 0) {
      e.hitstun -= dt;
      const k = Math.exp(-P.enemyFriction * dt); e.vx *= k; e.vy *= k;
    } else {
      const k = Math.exp(-10 * dt);
      e.stateT -= dt;
      switch (e.type) {
        case 'slime': case 'slimeMini':
          if (e.state === 'hop') { if (e.stateT <= 0) { e.state = 'idle'; e.stateT = rand(0.6, 1.2) / spd; } }
          else {
            e.vx *= k; e.vy *= k;
            if (e.stateT <= 0) {
              const chase = aggro && dist < 170;
              const a = chase ? Math.atan2(dy, dx) + rand(-0.4, 0.4) : rand(0, TAU);
              const v = (e.type === 'slimeMini' ? 130 : 105) * spd;
              e.vx = Math.cos(a) * v; e.vy = Math.sin(a) * v; e.state = 'hop'; e.stateT = 0.26;
            }
          }
          break;
        case 'beetle':
          if (e.state === 'aim') {
            e.vx *= k; e.vy *= k;
            if (Math.random() < 0.3) parts.add({ x: e.x - e.dirX * 6, y: e.y, vx: -e.dirX * 30, vy: rand(-15, -5), life: 0.25, colors: [C.cream, C.mauve], shape: 'sq', size: 1 });
            if (e.stateT <= 0) { e.state = 'charge'; e.stateT = 1.1; }
          } else if (e.state === 'charge') {
            e.vx = e.dirX * 270 * spd; e.vy = e.dirY * 270 * spd;
            if (Math.random() < 0.5) parts.add({ x: e.x, y: e.y, vx: -e.dirX * 40, vy: -e.dirY * 40, life: 0.2, colors: [C.cream, C.mauve], shape: 'sq', size: 2 });
            if (e.stateT <= 0) { e.state = 'walk'; e.stateT = 1.5; }
          } else if (e.state === 'stun') {
            e.vx *= k; e.vy *= k;
            if (e.stateT <= 0) {
              if (e.elite && e.n++ % 2 === 0) { e.state = 'aim'; e.stateT = 0.35; e.dirX = dx / dist; e.dirY = dy / dist; }
              else { e.state = 'walk'; e.stateT = 1; }
            }
          } else {
            const a = Math.atan2(dy, dx), wv = aggro ? 30 : 0;
            e.vx += (Math.cos(a) * wv * spd - e.vx) * smoothK(dt, 0.3); e.vy += (Math.sin(a) * wv * spd - e.vy) * smoothK(dt, 0.3);
            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) { e.dirX = Math.cos(a); e.dirY = Math.sin(a); }
            if (aggro && dist < 150 && e.stateT <= 0) { e.state = 'aim'; e.stateT = 0.55 / spd; e.dirX = dx / dist; e.dirY = dy / dist; floats.add(e.x, e.y - 22, '!', C.pink, { small: false, outline: C.ink, life: 0.5, vy: -10 }); }
          }
          break;
        case 'mushroom':
          e.vx *= k; e.vy *= k;
          if (e.state === 'swell') { if (e.stateT <= 0) { e.state = 'shoot'; e.stateT = 0.3; const a = Math.atan2(pl.y - e.y, pl.x - e.x); e.shots++; const list = e.elite || e.shots % 3 === 0 ? Array.from({ length: 8 }, (_, i) => i / 8 * TAU + (e.elite ? e.shots * 0.2 : 0)) : [a - 0.3, a, a + 0.3]; for (const an of list) fire(e, an, 68); sfx.shoot(); } }
          else if (e.state === 'shoot') { if (e.stateT <= 0) { e.state = 'idle'; e.stateT = rand(1.8, 2.8) / spd / (e.elite ? 1.5 : 1); } }
          else if (e.stateT <= 0 && aggro && dist < 210) { e.state = 'swell'; e.stateT = 0.45; }
          break;
        case 'cactus':
          if (e.state === 'charge') {
            e.vx *= k; e.vy *= k;
            if (e.stateT <= 0) { const n = e.elite ? 16 : 8, off = e.shots++ * 0.2; for (let i = 0; i < n; i++) fire(e, i / n * TAU + off, 92, { kind: 'needle', r: 2 }); sfx.shoot(); e.state = 'idle'; e.stateT = rand(2.2, 3) / spd; }
          } else {
            if (Math.random() < dt * 0.6) e.walkA = rand(0, TAU);
            const a = e.walkA ?? 0;
            e.vx += (Math.cos(a) * 14 - e.vx) * smoothK(dt, 0.4); e.vy += (Math.sin(a) * 14 - e.vy) * smoothK(dt, 0.4);
            if (e.stateT <= 0 && aggro && dist < 220) { e.state = 'charge'; e.stateT = 0.6; sfx.tele(); }
          }
          break;
        case 'bee':
          if (e.state === 'aim') {
            e.vx *= k; e.vy *= k;
            if (e.stateT <= 0) { e.state = 'dive'; e.stateT = 0.35; e.vx = e.dirX * 280 * spd; e.vy = e.dirY * 280 * spd; }
          } else if (e.state === 'dive') {
            if (Math.random() < 0.6) parts.add({ x: e.x, y: e.y - 6, vx: -e.vx * 0.1, vy: -e.vy * 0.1, life: 0.2, colors: [C.peach, C.white], shape: 'px' });
            if (e.stateT <= 0) { if (e.elite && ++e.n % 3 !== 0) { e.state = 'aim'; e.stateT = 0.25; e.dirX = dx / dist; e.dirY = dy / dist; } else { e.state = 'idle'; e.stateT = rand(0.8, 1.4) / spd; } }
          } else {
            const ring = 60, a = Math.atan2(e.y - pl.y, e.x - pl.x) + dt * 1.2;
            const tx = pl.x + Math.cos(a) * ring, ty = pl.y + Math.sin(a) * ring;
            e.vx += ((tx - e.x) * 2.5 - e.vx) * smoothK(dt, 0.2); e.vy += ((ty - e.y) * 2.5 - e.vy) * smoothK(dt, 0.2);
            if (e.stateT <= 0 && aggro && dist < 120) { e.state = 'aim'; e.stateT = 0.45 / spd; e.dirX = dx / dist; e.dirY = dy / dist; sfx.tele(); }
          }
          e.face = sign(e.vx) || e.face;
          break;
        case 'snapper':
          e.vx = 0; e.vy = 0;
          e.face = sign(dx) || e.face;
          if (e.state === 'open') { if (e.stateT <= 0) { e.state = 'bite'; e.stateT = 0.22; e.biteA = Math.atan2(dy, dx); } }
          else if (e.state === 'bite') {
            const reach = e.elite ? 34 : 24;
            const bx = e.x + Math.cos(e.biteA) * reach, by = e.y - 8 + Math.sin(e.biteA) * reach;
            e.bite = { x: bx, y: by };
            if (Math.hypot(pl.x - bx, pl.y - 8 - by) < 10) { if (invulnerable()) dodged(); else hurtPlayer(e); }
            if (e.stateT <= 0) { e.state = 'recover'; e.stateT = 0.7; e.bite = null; }
          } else if (e.state === 'recover') { if (e.stateT <= 0) e.state = 'idle'; }
          else if (aggro && dist < (e.elite ? 56 : 46) && e.stateT <= 0) { e.state = 'open'; e.stateT = 0.45; sfx.tele(); }
          break;
      }
    }
    const wasFast = Math.hypot(e.vx, e.vy);
    const n = e.type === 'snapper' ? null : move(e, dt, e.d.fly);
    if (n) {
      if (e.state === 'charge' && e.type === 'beetle') {
        e.state = 'stun'; e.stateT = e.elite ? 0.8 : 1.4; e.vx = n.nx * 60; e.vy = n.ny * 60;
        shake.add(2, 150); sfx.slam();
        parts.burst(e.x - n.nx * 6, e.y - n.ny * 6 - 4, 10, { dir: Math.atan2(n.ny, n.nx), spread: 2, speed: [30, 100], colors: [C.cream, C.mauve, C.white], shape: 'sq', size: 2, life: [0.2, 0.4] });
      } else if (P.wallSlam && e.hitstun > 0 && !e.slammed && wasFast > P.slamSpeed) slam(e, n.nx, n.ny, wasFast);
    }
    // 荊棘地面也會傷到魔物
    if (!e.d.fly && tileUnder(e) === TILE.THORN && e.thornT <= 0) { e.thornT = 0.5; hitEnemy(e, 10, -Math.PI / 2, { knock: 0.2, noCombo: true }); }
    const vd = boon('vineDash');
    if (vd && e.vineHitT <= 0) for (const v of vines) if (Math.hypot(v.x - e.x, v.y - e.y) < e.r + 4) { e.vineHitT = 0.45; hitEnemy(e, v.dmg, Math.atan2(e.y - v.y, e.x - v.x), { knock: 0.3, noCombo: true }); break; }
    contact(e);
  }
  function contact(e) {
    if (e.dead || e.hitstun > 0 || !P.enemyAggro || e.state === 'stun' || e.type === 'snapper' || dying) return;
    if (Math.hypot(pl.x - e.x, pl.y - e.y) < e.r + pl.r - 1) { if (invulnerable()) dodged(); else hurtPlayer(e); }
  }
  function slam(e, nx, ny, speed) {
    e.slammed = true;
    e.vx = nx * speed * 0.35; e.vy = ny * speed * 0.35;
    const mult = 1 + boon('fertilizer') * 0.5;
    const dmg = Math.round(20 * mult * dmgMul());
    e.hp -= dmg; e.flash = P.flashFrames / 60;
    hitstop = Math.max(hitstop, P.hitstop * 0.8 / 1000);
    shake.add(P.shake + 1.5, 200, nx, ny);
    parts.burst(e.x - nx * e.r, e.y - ny * e.r - 5, 12, { dir: Math.atan2(ny, nx), spread: 2.4, speed: [40, 140], colors: [C.white, C.cream, C.mauve], shape: 'sq', size: 2, life: [0.2, 0.45], gravity: 120 });
    parts.add({ x: e.x - nx * e.r, y: e.y - ny * e.r - 5, shape: 'star', size: 6, life: 0.14, colors: [C.white, C.cream] });
    if (P.damageNumbers) floats.add(e.x, e.y - 24, 'SLAM ' + dmg, C.pink, { outline: C.ink });
    if (boon('fertilizer')) bursts.push({ x: e.x, y: e.y - 6, t: 0.05, dmg: 8 * boon('fertilizer'), r: 22, small: true });
    sfx.slam();
    if (e.hp <= 0 && !e.dead) killEnemy(e);
  }
  function separate() {
    const list = enemies.filter(e => !e.dead && e.spawnT <= 0);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.d.fly !== b.d.fly) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = a.r + b.r;
      if (d >= min) continue;
      const nx = dx / d, ny = dy / d;
      const sa = Math.hypot(a.vx, a.vy), sb = Math.hypot(b.vx, b.vy);
      if (P.wallSlam) {
        if (a.hitstun > 0 && !a.slammed && sa > P.slamSpeed && !b.d.boss) { slam(a, -nx, -ny, sa); hitEnemy(b, 10, Math.atan2(ny, nx), { knock: 0.8, noCombo: true }); continue; }
        if (b.hitstun > 0 && !b.slammed && sb > P.slamSpeed && !a.d.boss) { slam(b, nx, ny, sb); hitEnemy(a, 10, Math.atan2(-ny, -nx), { knock: 0.8, noCombo: true }); continue; }
      }
      const push = (min - d) / 2;
      const wa = a.d.weight >= 50 ? 0 : 1, wb = b.d.weight >= 50 ? 0 : 1;
      a.x -= nx * push * wa * (wb ? 1 : 2); a.y -= ny * push * wa * (wb ? 1 : 2);
      b.x += nx * push * wb * (wa ? 1 : 2); b.y += ny * push * wb * (wa ? 1 : 2);
    }
    // 玩家不能穿過大型守護者
    if (boss && !boss.dead && boss.type !== 'queenBee') {
      const dx = pl.x - boss.x, dy = pl.y - boss.y, d = Math.hypot(dx, dy) || 0.01, min = boss.r + pl.r;
      if (d < min && !pl.roll) { pl.x = boss.x + dx / d * min; pl.y = boss.y + dy / d * min; }
    }
  }

  // ---------------- 守護者 ----------------
  function bossPhase(b) {
    if (b.phase === 1 && b.hp <= b.maxHp / 2) {
      b.phase = 2; sfx.roar(); shake.add(4, 500);
      parts.add({ x: b.x, y: b.y - 10, shape: 'ring', r0: 6, r1: 70, life: 0.6, colors: [C.white, C.pink, C.plum] });
      floats.add(b.x, b.y - b.r - 20, 'RAGE', C.pink, { small: false, outline: C.ink, life: 1.2 });
      return true;
    }
    return false;
  }
  function bossContact(b) {
    if (b.dead || b.state === 'intro' || b.airborne || dying) return;
    if (Math.hypot(pl.x - b.x, pl.y - b.y) < b.r + pl.r - 2) { if (invulnerable()) dodged(); else hurtPlayer(b); }
  }
  const pickState = (b, list) => { const opts = list.filter(s => s !== b.last); const s = pick(opts.length ? opts : list); b.last = s; return s; };
  const BOSS = {
    slimeKing(b, dt) {
      b.stateT += dt;
      const p2 = b.phase === 2;
      bossPhase(b);
      const dx = pl.x - b.x, dy = pl.y - b.y;
      switch (b.state) {
        case 'intro': if (b.stateT > 1.4) { b.state = 'idle'; b.stateT = 0; } break;
        case 'idle': b.vx *= 0.85; b.vy *= 0.85; if (b.stateT > (p2 ? 0.45 : 0.8)) { b.state = pickState(b, b.n++ % 3 === 2 ? ['spit'] : ['hop', 'hop', 'bigHop']); b.stateT = 0; } break;
        case 'hop': case 'bigHop': {
          const big = b.state === 'bigHop';
          if (b.stateT < 0.45) { b.pose = 'squash'; if (b.stateT < dt * 1.5) sfx.tele(); }
          else if (!b.airborne && !b.landed) {
            b.airborne = true; b.pose = 'jump';
            const dist = Math.min(big ? 160 : 90, Math.hypot(dx, dy));
            const a = Math.atan2(dy, dx);
            b.from = { x: b.x, y: b.y }; b.to = { x: clamp(b.x + Math.cos(a) * dist, 3 * T, (room.MW - 3) * T), y: clamp(b.y + Math.sin(a) * dist, 4 * T, (room.MH - 3) * T) };
            b.jt = 0; b.jdur = big ? 0.9 : 0.6;
          }
          if (b.airborne) {
            b.jt += dt;
            const u = Math.min(1, b.jt / b.jdur);
            b.x = lerp(b.from.x, b.to.x, u); b.y = lerp(b.from.y, b.to.y, u);
            b.z = Math.sin(u * Math.PI) * (big ? 70 : 38);
            if (u >= 1) {
              b.airborne = false; b.landed = true; b.z = 0; b.pose = 'squash';
              shake.add(big ? 6 : 4, 300, 0, 1); sfx.slam();
              zones.push({ kind: 'shock', x: b.x, y: b.y, r: b.r, max: big ? 110 : 80, t: 0, life: 0.55, hit: false });
              if (p2) zones.push({ kind: 'shock', x: b.x, y: b.y, r: b.r, max: big ? 150 : 110, t: -0.25, life: 0.8, hit: false });
              parts.burst(b.x, b.y, 20, { speed: [40, 140], colors: [C.lime, C.lleaf, C.leaf], shape: 'sq', size: 2, life: [0.3, 0.6] });
              if (big && enemies.filter(e => !e.dead && e.type === 'slime').length < 4) for (let i = 0; i < (p2 ? 3 : 2); i++) { const m = makeEnemy('slime', b.x + rand(-20, 20), b.y + rand(-10, 10)); m.spawnT = 0.2; enemies.push(m); }
            }
          }
          if (b.landed && b.stateT > b.jdur + 0.45 + 0.5) { b.landed = false; b.state = 'idle'; b.stateT = 0; b.pose = null; }
          break;
        }
        case 'spit':
          b.pose = b.stateT < 0.5 ? 'squash' : null;
          if (b.stateT >= 0.5 && b.stateT - dt < 0.5) { const n = p2 ? 9 : 6, base = Math.atan2(dy, dx); for (let i = 0; i < n; i++) fire(b, base + (i - (n - 1) / 2) * 0.22, 80, { kind: 'goo', r: 4 }); sfx.shoot(); }
          if (b.stateT > 1) { b.state = 'idle'; b.stateT = 0; }
          break;
      }
    },
    queenBee(b, dt) {
      b.stateT += dt;
      const p2 = b.phase === 2;
      bossPhase(b);
      const dx = pl.x - b.x, dy = pl.y - b.y, dist = Math.hypot(dx, dy) || 1;
      b.face = sign(dx) || b.face;
      const hoverTo = (tx, ty, k = 0.5) => { b.vx += ((tx - b.x) * 2 - b.vx) * smoothK(dt, k); b.vy += ((ty - b.y) * 2 - b.vy) * smoothK(dt, k); b.x += b.vx * dt; b.y += b.vy * dt; };
      switch (b.state) {
        case 'intro': hoverTo(room.MW * T / 2, 5 * T); if (b.stateT > 1.5) { b.state = 'idle'; b.stateT = 0; } break;
        case 'idle':
          hoverTo(pl.x + Math.cos(time) * 60, Math.max(4 * T, pl.y - 70));
          if (b.stateT > (p2 ? 0.8 : 1.3)) { b.state = pickState(b, ['aim', 'honey', 'summon', 'aim']); b.stateT = 0; b.n = 0; }
          break;
        case 'aim':
          b.vx *= 0.85; b.vy *= 0.85;
          if (b.stateT < dt * 1.5) { b.dirX = dx / dist; b.dirY = dy / dist; sfx.tele(); }
          if (b.stateT < 0.35) { b.dirX = dx / dist; b.dirY = dy / dist; }
          if (b.stateT > (b.n ? 0.4 : 0.65)) { b.state = 'dive'; b.stateT = 0; }
          break;
        case 'dive':
          b.vx = b.dirX * 360; b.vy = b.dirY * 360; b.x += b.vx * dt; b.y += b.vy * dt;
          if (Math.random() < 0.8) parts.add({ x: b.x, y: b.y - 8, vx: -b.vx * 0.1, vy: -b.vy * 0.1, life: 0.25, colors: [C.peach, C.white], shape: 'sq', size: 2 });
          if (b.stateT > 0.5 || b.x < 2 * T || b.x > (room.MW - 2) * T || b.y < 3 * T || b.y > (room.MH - 2) * T) {
            b.x = clamp(b.x, 2 * T, (room.MW - 2) * T); b.y = clamp(b.y, 3 * T, (room.MH - 2) * T);
            b.n++;
            if (b.n < (p2 ? 3 : 1)) { b.state = 'aim'; b.stateT = 0.2; } else { b.state = 'idle'; b.stateT = 0; }
          }
          break;
        case 'honey':
          hoverTo(b.x, b.y);
          if (b.stateT >= 0.5 && b.stateT - dt < 0.5) {
            const n = p2 ? 8 : 5, base = Math.atan2(dy, dx);
            for (let i = 0; i < n; i++) fire(b, base + (i - (n - 1) / 2) * 0.3, 95, { kind: 'honey', r: 4, honey: true, life: 1.4 });
            sfx.shoot();
          }
          if (b.stateT > 1.1) { b.state = 'idle'; b.stateT = 0; }
          break;
        case 'summon':
          hoverTo(b.x, b.y);
          if (b.stateT >= 0.4 && b.stateT - dt < 0.4 && enemies.filter(e => !e.dead && e.type === 'bee').length < 5) {
            for (let i = 0; i < (p2 ? 3 : 2); i++) { const m = makeEnemy('bee', b.x + rand(-20, 20), b.y + rand(-10, 10)); m.spawnT = 0.1; enemies.push(m); }
            sfx.tele();
          }
          if (b.stateT > 1) { b.state = 'idle'; b.stateT = 0; }
          break;
      }
      b.x = clamp(b.x, 2 * T, (room.MW - 2) * T); b.y = clamp(b.y, 3 * T, (room.MH - 2) * T);
    },
    rafflesia(b, dt) {
      b.stateT += dt;
      const p2 = b.phase === 2;
      if (bossPhase(b)) { b.state = 'uproot'; b.stateT = 0; }
      const dx = pl.x - b.x, dy = pl.y - b.y, dist = Math.hypot(dx, dy) || 1;
      if (p2 && b.state !== 'uproot') { // 第二階段：拔起根慢慢追過來
        b.x += dx / dist * 16 * dt; b.y += dy / dist * 16 * dt;
        b.x = clamp(b.x, 4 * T, (room.MW - 4) * T); b.y = clamp(b.y, 5 * T, (room.MH - 4) * T);
      }
      switch (b.state) {
        case 'intro': if (b.stateT > 1.6) { b.state = 'idle'; b.stateT = 0; } break;
        case 'idle': b.open = false; if (b.stateT > (p2 ? 0.5 : 0.9)) { b.state = pickState(b, ['spiral', 'vines', 'snap', 'spiral']); b.stateT = 0; b.n = 0; } break;
        case 'spiral':
          b.open = true;
          if (Math.floor(b.stateT / 0.09) !== Math.floor((b.stateT - dt) / 0.09) && b.stateT > 0.4) {
            const arms = p2 ? 4 : 3, rot = b.stateT * (p2 ? 2.4 : 1.8);
            for (let i = 0; i < arms; i++) fire(b, rot + i / arms * TAU, 75, { kind: 'seed', r: 3 });
            sfx.shoot();
          }
          if (b.stateT > 2.4) { b.state = 'idle'; b.stateT = 0; }
          break;
        case 'vines':
          if (b.stateT < dt * 1.5) {
            const base = Math.atan2(dy, dx), n = p2 ? 5 : 3;
            for (let i = 0; i < n; i++) zones.push({ kind: 'vine', x: b.x, y: b.y, a: base + (i - (n - 1) / 2) * 0.45, len: 200, t: -0.75, life: 0.45, hit: false });
            sfx.tele();
          }
          if (b.stateT > 1.4) { b.state = 'idle'; b.stateT = 0; }
          break;
        case 'snap':
          if (b.stateT < dt * 1.5 && enemies.filter(e => !e.dead && e.type === 'snapper').length < (p2 ? 3 : 2)) {
            for (let i = 0; i < (p2 ? 2 : 1); i++) {
              const a = rand(0, TAU), r = rand(60, 90);
              const x = clamp(b.x + Math.cos(a) * r, 3 * T, (room.MW - 3) * T), y = clamp(b.y + Math.sin(a) * r, 4 * T, (room.MH - 3) * T);
              if (tileAt(Math.floor(x / T), Math.floor(y / T)) === TILE.FLOOR) { const m = makeEnemy('snapper', x, y); enemies.push(m); }
            }
          }
          if (b.stateT > 0.8) { b.state = 'idle'; b.stateT = 0; }
          break;
        case 'uproot':
          b.open = true;
          shake.add(2, 100);
          if (Math.random() < 0.5) parts.add({ x: b.x + rand(-30, 30), y: b.y + rand(-10, 20), vx: rand(-30, 30), vy: rand(-60, -20), life: 0.6, colors: [C.soil, C.terra], shape: 'sq', size: 2, gravity: 200 });
          if (b.stateT > 1.4) { b.state = 'idle'; b.stateT = 0; }
          break;
      }
    },
  };

  // ---------------- 其他物件更新 ----------------
  function updateShots(dt, wdt) {
    for (const s of spores) {
      s.x += s.vx * wdt; s.y += s.vy * wdt; s.life -= wdt;
      if (s.life <= 0 || solid(Math.floor(s.x / T), Math.floor(s.y / T))) {
        s.dead = true;
        if (s.honey) zones.push({ kind: 'honey', x: s.x, y: s.y, r: 16, t: 0, life: 5 });
      }
      if (!s.dead && Math.hypot(s.x - pl.x, s.y - (pl.y - 8)) < 5 + s.r) { if (invulnerable()) dodged(); else { s.dead = true; hurtPlayer(s); } }
    }
    spores = spores.filter(s => !s.dead);
    for (const w of waves) {
      w.x += w.vx * dt; w.y += w.vy * dt; w.life -= dt;
      for (const e of enemies) if (!e.dead && e.spawnT <= 0 && !w.hit.has(e) && Math.hypot(e.x - w.x, e.y - 6 - w.y) < e.r + 10) { w.hit.add(e); hitEnemy(e, w.dmg, w.a, { noCombo: false }); }
      if (solid(Math.floor(w.x / T), Math.floor(w.y / T))) w.life = 0;
    }
    waves = waves.filter(w => w.life > 0);
    for (const p of pshots) {
      p.t += dt; p.life -= dt;
      if (p.kind === 'sun') { p.r = 6 + (p.max - 6) * easeOut(Math.min(1, p.t / p.life)); for (const e of enemies) if (!e.dead && e.spawnT <= 0 && !p.hit.has(e) && Math.abs(Math.hypot(e.x - p.x, e.y - 6 - p.y) - p.r) < e.r + 4) { p.hit.add(e); hitEnemy(e, p.dmg, Math.atan2(e.y - p.y, e.x - p.x), { noCombo: true }); } continue; }
      if (p.kind === 'seed') {
        let best = null, bd = 160;
        for (const e of enemies) if (!e.dead && e.spawnT <= 0 && !p.hit.has(e)) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
        if (best && p.t > 0.2) { const a = Math.atan2(best.y - 6 - p.y, best.x - p.x); p.vx += (Math.cos(a) * 200 - p.vx) * smoothK(dt, 0.1); p.vy += (Math.sin(a) * 200 - p.vy) * smoothK(dt, 0.1); }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (solid(Math.floor(p.x / T), Math.floor(p.y / T))) { p.life = 0; if (p.kind === 'drop') parts.burst(p.x, p.y, 4, { speed: [20, 60], colors: [C.teal, C.white], life: [0.1, 0.25] }); continue; }
      for (const e of enemies) {
        if (e.dead || e.spawnT > 0 || p.hit.has(e) || e.hidden) continue;
        if (Math.hypot(e.x - p.x, e.y - 6 - p.y) < e.r + 4) {
          p.hit.add(e); hitEnemy(e, p.dmg, Math.atan2(p.vy, p.vx), { knock: p.knock ?? 0.4, fin: p.fin });
          parts.burst(p.x, p.y, 5, { speed: [30, 90], colors: [C.teal, C.white], life: [0.1, 0.25] });
          if (p.kind !== 'sun') { p.life = 0; break; }
        }
      }
      for (const q of pots) if (!q.broken && Math.hypot(q.x - p.x, q.y - 5 - p.y) < 7) { breakPot(q); p.life = 0; }
      for (const q of puffs) if (!q.blown && Math.hypot(q.x - p.x, q.y - 4 - p.y) < 7) { blowPuff(q); p.life = 0; }
    }
    pshots = pshots.filter(p => p.life > 0);
    for (const b of bursts) {
      b.t -= dt;
      if (b.t <= 0 && !b.done) {
        b.done = true;
        parts.add({ x: b.x, y: b.y, shape: 'ring', r0: 4, r1: b.r, life: 0.3, colors: [C.white, C.pink, C.lime] });
        parts.burst(b.x, b.y, b.small ? 6 : 16, { speed: [40, 130], colors: [C.pink, C.lime, C.white], shape: 'sq', size: 2, life: [0.3, 0.6] });
        for (const e of enemies) if (!e.dead && e.spawnT <= 0 && Math.hypot(e.x - b.x, e.y - 6 - b.y) < b.r + e.r) hitEnemy(e, b.dmg, Math.atan2(e.y - b.y, e.x - b.x), { knock: 0.9, noCombo: true });
        sound.noise({ dur: 0.25, vol: 0.2, filter: 'lowpass', f0: 2000, f1: 300 });
      }
    }
    bursts = bursts.filter(b => !b.done);
    for (const v of vines) v.life -= dt;
    vines = vines.filter(v => v.life > 0);
    // 區域：衝擊波、藤蔓、蜂蜜
    for (const z of zones) {
      z.t += wdt;
      if (z.kind === 'shock' && z.t > 0) {
        z.r = lerp(10, z.max, easeOut(Math.min(1, z.t / z.life)));
        const d = Math.hypot(pl.x - z.x, pl.y - z.y);
        if (!z.hit && Math.abs(d - z.r) < 7) { z.hit = true; if (invulnerable()) dodged(); else hurtPlayer(z); }
      } else if (z.kind === 'vine' && z.t > 0 && !z.hit) {
        const ex = z.x + Math.cos(z.a) * z.len, ey = z.y + Math.sin(z.a) * z.len;
        const vx = ex - z.x, vy = ey - z.y, u = clamp(((pl.x - z.x) * vx + (pl.y - z.y) * vy) / (vx * vx + vy * vy), 0, 1);
        if (Math.hypot(z.x + vx * u - pl.x, z.y + vy * u - pl.y) < 9) { z.hit = true; if (invulnerable()) dodged(); else hurtPlayer({ x: z.x + vx * u, y: z.y + vy * u }); }
        if (z.t < wdt * 1.5) { shake.add(2, 150); for (let k = 0; k < 10; k++) { const u2 = k / 10; parts.add({ x: z.x + vx * u2, y: z.y + vy * u2, vx: rand(-20, 20), vy: rand(-50, -20), life: 0.4, colors: [C.lleaf, C.leaf, C.dleaf], shape: 'sq', size: 2 }); } }
      }
    }
    zones = zones.filter(z => z.t < z.life);
  }
  function updatePickups(dt) {
    const r = run();
    for (const k of pickups) {
      k.t += dt;
      if (k.vx != null) { k.vx *= Math.exp(-4 * dt); k.vy *= Math.exp(-4 * dt); k.x += k.vx * dt; k.y += k.vy * dt; const c = { x: k.x, y: k.y, r: 3 }; pushOut(c); k.x = c.x; k.y = c.y; }
      const dx = pl.x - k.x, dy = pl.y - k.y, d = Math.hypot(dx, dy);
      const magnet = (k.kind === 'coin' || k.kind === 'seed') && (cleared ? 400 : 40);
      if (magnet && d < magnet && k.t > 0.4) { const sp = cleared ? 240 : 140; k.x += dx / d * sp * dt; k.y += dy / d * sp * dt; }
      if (d < 10 && k.t > 0.2 && !dying) {
        if (k.kind === 'coin') { k.done = true; r.coins++; r.coinsTotal++; sfx.coin(); parts.add({ x: k.x, y: k.y - 4, shape: 'star', size: 2, life: 0.1, colors: [C.white, C.peach] }); }
        else if (k.kind === 'seed') { k.done = true; addSeeds(k.value || 1, k.x, k.y); }
        else if (k.kind === 'heart') { if (r.hp < r.maxHp || k.full) { k.done = true; const add = k.full ? r.maxHp : 1; r.hp = Math.min(r.maxHp, r.hp + add); floats.add(k.x, k.y - 16, k.full ? 'FULL' : '+1', C.pink, { outline: C.ink }); sfx.heal(); } }
        else if (k.kind === 'boonOrb' && k.t > 0.6) { k.done = true; parts.add({ x: k.x, y: k.y - 8, shape: 'ring', r0: 4, r1: 30, life: 0.4, colors: [C.white, C.lime, C.lleaf] }); hooks.onBoon && hooks.onBoon(k.reward); }
      }
    }
    pickups = pickups.filter(k => !k.done);
  }
  /** 商店：站在商品前按攻擊鍵購買（在玩家動作之前處理，才不會先揮武器） */
  function shopInput() {
    const p = promptItem;
    if (!p || p.sold || !input.pressed('attack')) return;
    input.eat();
    if (run().coins < p.price) { sound.ui('buzz'); floats.add(p.x, p.y - 24, '金幣不足', C.pink, { outline: C.ink }); }
    else buyItem(p);
  }
  function updateProps(dt) {
    const r = run();
    promptItem = null;
    for (const p of props) {
      if (p.kind === 'fountain' && !p.used && Math.hypot(pl.x - p.x, pl.y - p.y - 6) < 34) {
        p.used = true; r.usedFountain = true;
        const add = Math.max(3, Math.ceil(r.maxHp * 0.5));
        r.hp = Math.min(r.maxHp, r.hp + add);
        floats.add(pl.x, pl.y - 30, '+' + add, C.pink, { small: false, outline: C.ink });
        parts.add({ x: p.x, y: p.y - 6, shape: 'ring', r0: 6, r1: 40, life: 0.5, colors: [C.white, C.teal] });
        sfx.heal();
      }
      if (p.kind === 'item' && !p.sold && Math.hypot(pl.x - p.x, pl.y - p.y) < 16) promptItem = p;
    }
  }
  function buyItem(p) {
    const r = run();
    r.coins -= p.price; p.sold = true; r.usedShop = true;
    sound.ui('coin');
    parts.add({ x: p.x, y: p.y - 8, shape: 'ring', r0: 4, r1: 20, life: 0.3, colors: [C.white, C.peach] });
    switch (p.id) {
      case 'heal': r.hp = Math.min(r.maxHp, r.hp + 3); sfx.heal(); break;
      case 'maxhp': r.maxHp++; r.hp++; sfx.heal(); break;
      case 'seeds': addSeeds(10, p.x, p.y); break;
      case 'reroll': r.rerolls++; break;
      case 'boon': hooks.onBoon && hooks.onBoon('boon'); break;
      case 'upgrade': hooks.onBoon && hooks.onBoon('upgrade'); break;
    }
  }
  function checkDoors() {
    if (!cleared || dying) return;
    for (const d of doors) {
      d.t += 1 / 60;
      if (d.open && Math.abs(pl.x - d.x) < 13 && pl.y < d.y + 14) { sfx.door(); hooks.onDoor && hooks.onDoor(d.option); return; }
    }
  }

  // ---------------- 主更新 ----------------
  function update(dt) {
    time += dt;
    shake.update(dt);
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
    if (hitstop > 0) { hitstop -= dt; return; }
    if (dying) {
      deathT += dt;
      if (Math.random() < 0.5) parts.add({ x: pl.x + rand(-6, 6), y: pl.y - rand(0, 20), vx: rand(-10, 10), vy: rand(-40, -15), life: 0.8, colors: [C.white, C.pink, C.plum], shape: 'sq', size: 2 });
      parts.update(dt); floats.update(dt);
      if (deathT > 1.6 && !dying.done) { dying = { done: true }; hooks.onDeath && hooks.onDeath(); }
      return;
    }
    const wdt = pl.slowT > 0 ? dt * P.perfectSlow : dt;
    if (pl.slowT > 0) pl.slowT -= dt;
    if (cleared) clearT += dt;
    shopInput();
    updatePlayer(dt);
    checkHits();
    for (const e of enemies) updateEnemy(e, wdt);
    separate();
    enemies = enemies.filter(e => !e.dead);
    updateWaves(dt);
    updateShots(dt, wdt);
    updatePickups(dt);
    updateProps(dt);
    checkDoors();
    for (const p of puffs) p.t += dt;
    parts.update(dt); floats.update(dt);
    if (comboT > 0 && (comboT -= dt) <= 0) combo = 0;
    const lead = P.camLead;
    cam.follow(pl.x + Math.cos(pl.aim) * lead, pl.y - 10 + Math.sin(pl.aim) * lead * 0.7, dt, { smooth: P.camSmooth });
  }

  // =====================================================================
  // 繪製
  // =====================================================================
  const FLOOR_STYLE = [
    { base: C.terra, line: C.soil, hi: C.peach, path: C.mauve, pathHi: C.cream, pathLo: C.plum, light: C.peach, wall: C.plum, glass: C.teal },
    { base: C.leaf, line: C.dleaf, hi: C.lleaf, path: C.soil, pathHi: C.terra, pathLo: C.shadow, light: C.lleaf, wall: C.dleaf, glass: C.teal },
    { base: C.cream, line: C.mauve, hi: C.white, path: C.mauve, pathHi: C.cream, pathLo: C.plum, light: C.white, wall: C.plum, glass: C.teal },
  ];
  function buildFloor(rm, fi) {
    const st = FLOOR_STYLE[fi];
    const WW = rm.MW * T, WH = rm.MH * T;
    return makeLayer(WW, WH, PALETTE, p => {
      let seed = 5 + fi * 17; const r = () => (seed = seed * 16807 % 2147483647) / 2147483647;
      p.rect(0, 0, WW, WH, st.base);
      for (let ty = 0; ty < rm.MH; ty++) for (let tx = 0; tx < rm.MW; tx++) {
        const x = tx * T, y = ty * T;
        if (fi === 1) { // 草地：短草點綴
          for (let k = 0; k < 5; k++) p.px(x + Math.floor(r() * 16), y + Math.floor(r() * 16), r() < 0.5 ? st.line : st.hi);
        } else if (fi === 2) { // 大理石：菱形格
          if ((tx + ty) % 2 === 0) p.rect(x, y, T, T, C.white);
          p.rect(x, y, T, 1, st.line); p.rect(x, y, 1, T, st.line);
        } else {
          p.rect(x, y + T - 1, T, 1, st.line); p.rect(x + T - 1, y, 1, T, st.line); p.rect(x, y, T - 1, 1, st.hi);
          const v = r();
          if (v < 0.12) p.dither(x + 1, y + 2, T - 3, T - 4, st.line, 2);
        }
      }
      // 中央步道
      const px0 = Math.floor(rm.MW / 2 - 2) * T, px1 = px0 + 4 * T;
      for (let y = 2 * T; y < WH - T; y += 12) {
        const off = (Math.floor(y / 12) % 2) * 8;
        for (let x = px0 - off; x < px1; x += 16) {
          const x0 = Math.max(px0, x), x1 = Math.min(px1, x + 16);
          p.rect(x0, y, x1 - x0, 12, st.path); p.rect(x0, y, x1 - x0, 1, st.pathHi); p.rect(x0, y + 11, x1 - x0, 1, st.pathLo);
          if (x1 - x0 > 2) p.rect(x1 - 1, y, 1, 12, st.pathLo);
        }
      }
      for (let i = 0; i < 24; i++) {
        const cx = r() * WW, cy = 2 * T + r() * (WH - 3 * T);
        for (let k = 0; k < 10; k++) p.px(cx + (r() - 0.5) * 12, cy + (r() - 0.5) * 6, r() < 0.5 ? C.leaf : C.dleaf);
      }
      // 陽光光帶
      for (let y = 2 * T; y < WH - T; y++) for (let x = T; x < WW - T; x++) {
        const band = (x + y * 0.8) % 160;
        if (band < 30 && BAYER4[(y & 3) * 4 + (x & 3)] < (band < 4 || band > 26 ? 1 : 3)) p.px(x, y, st.light);
      }
      // 地形：花台、荊棘、水窪
      for (let ty = 0; ty < rm.MH; ty++) for (let tx = 0; tx < rm.MW; tx++) {
        const t = rm.at(tx, ty), x = tx * T, y = ty * T;
        if (t === TILE.THORN) {
          p.rect(x, y, T, T, C.dleaf);
          for (let k = 0; k < 6; k++) { const sx = x + 1 + ((k * 5 + tx * 3) % 13), sy = y + 2 + ((k * 7 + ty * 5) % 11); p.px(sx, sy, C.leaf); p.px(sx, sy - 1, C.pink); p.px(sx + 1, sy + 1, C.cream); }
        } else if (t === TILE.WATER) {
          p.rect(x, y, T, T, C.teal); p.dither(x, y, T, T, C.white, 2);
          if (rm.at(tx, ty - 1) !== TILE.WATER) p.rect(x, y, T, 1, C.white);
          if (rm.at(tx, ty + 1) !== TILE.WATER) p.rect(x, y + T - 1, T, 1, C.plum);
        }
      }
      // 牆：上方玻璃、四周
      p.rect(0, 0, WW, 2 * T, st.wall);
      for (let x = 0; x < WW; x += 24) {
        p.rect(x + 2, 3, 20, 2 * T - 7, st.glass);
        for (let k = 0; k < 6; k++) p.px(x + 4 + k, 5 + k, C.white);
        for (let k = 0; k < 5; k++) p.circle(x + 6 + k * 3, 2 * T - 6 - (k % 2) * 3, 3, k % 2 ? C.leaf : C.dleaf);
      }
      p.rect(0, 2 * T - 3, WW, 3, C.ink); p.rect(0, 2 * T - 4, WW, 1, C.mauve);
      p.rect(0, 2 * T, T, WH, st.wall); p.rect(WW - T, 2 * T, T, WH, st.wall);
      p.rect(T - 1, 2 * T, 1, WH, C.ink); p.rect(WW - T, 2 * T, 1, WH, C.ink);
      p.rect(0, WH - T, WW, T, st.wall); p.rect(0, WH - T, WW, 1, C.ink);
      for (let y = 2 * T; y < WH; y += 8) { p.rect(0, y, T - 1, 1, C.shadow); p.rect(WW - T + 1, y, T, 1, C.shadow); }
    });
  }
  function drawPlanter(tx, ty) {
    const x = tx * T, y = ty * T;
    const top = room.at(tx, ty - 1) !== TILE.PLANTER;
    g.rect(x, y, T, T, C.soil);
    if (top) { g.rect(x, y, T, 3, C.terra); g.circle(x + 5, y + 1, 4, (tx + ty) % 2 ? C.leaf : C.dleaf); g.circle(x + 11, y, 4, (tx + ty) % 2 ? C.dleaf : C.leaf); g.px(x + 4, y - 2, C.lleaf); if ((tx * 3 + ty) % 4 === 0) { g.rect(x + 9, y - 3, 3, 3, C.pink); g.px(x + 10, y - 2, C.white); } }
    if (room.at(tx, ty + 1) !== TILE.PLANTER) { g.rect(x, y + T - 2, T, 2, C.ink); g.rect(x, y + T - 4, T, 2, C.terra); }
    if (room.at(tx - 1, ty) !== TILE.PLANTER) g.rect(x, y, 1, T, C.ink);
    if (room.at(tx + 1, ty) !== TILE.PLANTER) g.rect(x + T - 1, y, 1, T, C.ink);
  }
  function drawShadow(x, y, rx) { g.ellipse(x, y, rx, Math.max(1, rx * 0.4), C.shadow); }
  function drawWeapon(front) {
    const pv = pivot(), a = pl.blade, w = run().weapon;
    const behind = Math.sin(a) < -0.25;
    if (behind === front) return;
    const dx = Math.cos(a), dy = Math.sin(a);
    if (w === 'can') {
      const hx = pv.x + dx * 6, hy = pv.y + dy * 6 + 2;
      g.rect(hx - 4, hy - 3, 8, 6, C.ink); g.rect(hx - 3, hy - 2, 6, 4, C.teal); g.px(hx - 2, hy - 2, C.white);
      g.line(hx + dx * 3, hy + dy * 3 - 1, hx + dx * 9, hy + dy * 9 - 2, C.ink, 2); g.px(hx + dx * 9, hy + dy * 9 - 2, C.teal);
      return;
    }
    if (w === 'shears') {
      const R = (pl.atk ? pl.atk.reach : P.radius * 0.82) - 4;
      for (const off of [-0.18, 0.18]) {
        const b = a + off * (pl.atk ? 0.4 : 1), ex = pv.x + Math.cos(b) * R, ey = pv.y + Math.sin(b) * R;
        g.line(pv.x + Math.cos(b) * 4, pv.y + Math.sin(b) * 4, ex, ey, C.ink, 3);
        g.line(pv.x + Math.cos(b) * 4, pv.y + Math.sin(b) * 4, ex, ey, off < 0 ? C.cream : C.white);
      }
      g.rect(pv.x + dx * 3 - 1, pv.y + dy * 3 - 1, 3, 3, C.soil);
      return;
    }
    const R = pl.atk ? pl.atk.reach : P.radius * reachMul();
    const hx = pv.x + dx * 3, hy = pv.y + dy * 3;
    const ex = pv.x + dx * (R - 5), ey = pv.y + dy * (R - 5);
    g.line(hx - dx * 3, hy - dy * 3, ex, ey, C.ink, 3);
    g.line(hx - dx * 3, hy - dy * 3, ex, ey, C.soil);
    const s = pl.atk ? sign(pl.atk.a1 - pl.atk.a0) || 1 : 1;
    const px = -dy * s, py = dx * s;
    const pts = [];
    for (let k = 0; k <= 9; k++) pts.push([ex + px * k - dx * (k * k * 0.07), ey + py * k - dy * (k * k * 0.07)]);
    for (let k = 1; k < pts.length; k++) g.line(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], C.ink, 3);
    for (let k = 1; k < pts.length; k++) g.line(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], k < 3 ? C.cream : C.teal);
    for (let k = 2; k < pts.length - 1; k++) g.px(pts[k][0] - dx, pts[k][1] - dy, C.white);
  }
  function drawSmear() {
    const a = pl.atk;
    if (!a || !P.smear || a.def.shot) return;
    const end = a.S + a.A;
    if (a.f <= a.S || a.f > end + 3) return;
    const pv = pivot(), R = a.reach;
    const fade = Math.max(0, a.f - end) / 3;
    const span = a.def.spin ? Math.PI * 1.2 : Math.abs(pl.blade - (a.a0 - 0.35 * sign(a.a1 - a.a0)));
    const tail = span * (1 - Math.min(1, 0.1 + fade));
    const s = sign(a.a1 - a.a0);
    const w0 = pl.blade - s * tail, w1 = pl.blade;
    const thin = run().weapon === 'shears';
    if (!thin) g.arcBand(pv.x, pv.y, R - 9, R - 5, w0, w1, C.leaf);
    g.arcBand(pv.x, pv.y, R - 5, R - 2, w0, w1, C.lime);
    g.arcBand(pv.x, pv.y, R - 2, R + 1, w0, w1, fade > 0.5 ? C.teal : C.white);
  }
  function drawPlayer() {
    const x0 = Math.round(pl.x - 8), y0 = Math.round(pl.y - 22);
    if (dying && Math.floor(deathT * 20) % 2) return;
    if (pl.inv > 0 && !pl.roll && pl.hurtT <= 0 && !dying && Math.floor(pl.inv * 20) % 2) return;
    const col = dying ? C.white : pl.flash > 0 ? C.pink : null;
    if (pl.roll) {
      const u = pl.roll.t / P.rollTime;
      const fr = Math.floor(u * 8) % 4;
      const idx = pl.roll.dx >= 0 ? fr : (4 - fr) % 4;
      g.spr(S.fennel.ball[idx], Math.round(pl.x - 6), Math.round(pl.y - 13), { color: col });
      return;
    }
    const moving = Math.hypot(pl.vx, pl.vy) > 10;
    const bob = moving ? (Math.floor(pl.walk * 2) % 2) : (Math.floor(time * 1.5) % 2);
    const hurt = pl.hurtT > 0 || dying;
    const spr = pl.dir === 'side' ? (hurt ? S.fennel.hurtSide : S.fennel.side) : pl.dir === 'up' ? S.fennel.up : (hurt ? S.fennel.hurtDown : S.fennel.down);
    const ph = pl.walk * Math.PI;
    const step = moving ? Math.sin(ph) : 0;
    if (pl.dir === 'side') {
      const f = pl.flip ? -1 : 1;
      g.spr(S.fennel.boot, Math.round(pl.x - 2 + step * 3 * f) - 2, Math.round(pl.y - 3 - Math.max(0, -step)), { flip: pl.flip, color: col });
      g.spr(S.fennel.boot, Math.round(pl.x - 2 - step * 3 * f) - 1, Math.round(pl.y - 3 - Math.max(0, step)), { flip: pl.flip, color: col });
    } else {
      g.spr(S.fennel.boot, Math.round(pl.x - 5), Math.round(pl.y - 3 - Math.max(0, step) * 2), { color: col });
      g.spr(S.fennel.boot, Math.round(pl.x + 1), Math.round(pl.y - 3 - Math.max(0, -step) * 2), { color: col });
    }
    drawWeapon(false);
    g.spr(spr, x0, y0 + bob - (moving ? 1 : 0), { flip: pl.dir === 'side' && pl.flip, color: col });
    drawWeapon(true);
    if (run().shield > 0) { const a = time * 2; for (let i = 0; i < run().shield; i++) { const b = a + i * Math.PI; g.circle(pl.x + Math.cos(b) * 11, pl.y - 10 + Math.sin(b) * 6, 2, C.peach); g.px(pl.x + Math.cos(b) * 11, pl.y - 11 + Math.sin(b) * 6, C.white); } }
    if (pl.charging && pl.charge > 0.08) {
      const k = clamp(pl.charge / P.chargeTime, 0, 1);
      g.rect(pl.x - 9, pl.y - 30, 18, 3, C.ink);
      g.rect(pl.x - 8, pl.y - 29, Math.round(16 * k), 1, k >= 1 ? (Math.floor(time * 20) % 2 ? C.white : C.teal) : C.lime);
    }
  }
  function drawEnemy(e) {
    if (e.dead) return;
    if (e.spawnT > 0) {
      const k = 1 - e.spawnT / 0.7;
      g.ellipse(e.x, e.y, 3 + k * 5, 1 + k * 2, C.soil);
      g.rect(e.x - 1, e.y - 1 - k * 3, 2, k * 3, C.leaf);
      return;
    }
    if (e.d.boss) { drawBoss(e); return; }
    const jit = e.shakeT > 0 && hitstop > 0 ? (Math.floor(time * 60) % 2 ? 2 : -2) : 0;
    let col = e.flash > 0 ? C.white : null;
    let spr, ox = 8, oy = 15, flip = false;
    switch (e.type) {
      case 'slime': case 'slimeMini': spr = e.hitstun > 0 ? S.slime.hurt : e.state === 'hop' ? S.slime.stretch : e.stateT < 0.15 ? S.slime.squash : S.slime.idle; break;
      case 'mushroom': spr = e.hitstun > 0 ? S.mushroom.hurt : S.mushroom[e.state === 'swell' ? 'swell' : e.state === 'shoot' ? 'shoot' : 'idle']; oy = 17; break;
      case 'cactus': spr = e.hitstun > 0 ? S.cactus.hurt : e.state === 'charge' ? S.cactus.charge : S.cactus.idle; oy = 19; if (e.state === 'charge' && Math.floor(time * 30) % 2) col = col ?? C.cream; break;
      case 'bee': spr = e.hitstun > 0 ? S.bee.hurt : e.state === 'dive' ? S.bee.dive : S.bee.fly[Math.floor(time * 20) % 2]; ox = 7; oy = 20; flip = e.face < 0; if (e.state === 'aim' && Math.floor(time * 30) % 2) col = col ?? C.pink; break;
      case 'snapper': spr = e.hitstun > 0 ? S.snapper.hurt : e.state === 'open' ? S.snapper.open : e.state === 'bite' ? S.snapper.bite : S.snapper.idle; ox = 8; oy = 19; flip = e.face < 0; break;
      case 'beetle': {
        const set = e.hitstun > 0 ? S.beetle.hurt : e.state === 'stun' ? S.beetle.stun : e.state === 'charge' || e.state === 'aim' ? S.beetle.charge : S.beetle[Math.floor(e.t * 8) % 2 ? 'walk1' : 'walk0'];
        const d = Math.abs(e.dirX) > Math.abs(e.dirY) ? (e.dirX > 0 ? 'right' : 'left') : (e.dirY > 0 ? 'down' : 'up');
        spr = set[d]; ox = spr.w / 2; oy = spr.h - 2;
        if (e.state === 'aim' && Math.floor(time * 30) % 2) col = col ?? C.pink;
        break;
      }
    }
    const sc = e.elite ? 1.3 : e.type === 'slimeMini' ? 0.7 : 1;
    if (e.elite) { const rr = e.r + 3 + Math.sin(time * 6); g.ellipse(e.x, e.y, rr, rr * 0.45, Math.floor(time * 4) % 2 ? C.pink : C.plum); }
    const aimJit = e.state === 'aim' ? (Math.floor(time * 40) % 2 ? 1 : -1) : 0;
    if (e.rootT > 0) { g.ellipse(e.x, e.y, e.r + 2, 3, C.soil); }
    g.spr(spr, Math.round(e.x - ox) + jit + aimJit, Math.round(e.y - oy), { color: col, flip, sx: sc, sy: sc });
    if (e.rootT > 0) for (let k = -1; k <= 1; k++) { g.line(e.x + k * 4, e.y, e.x + k * 5, e.y - 8, C.soil, 2); g.px(e.x + k * 5, e.y - 9, C.lleaf); }
    if (e.state === 'stun') for (let i = 0; i < 3; i++) { const a = time * 5 + i * TAU / 3; g.px(e.x + Math.cos(a) * 7, e.y - 16 + Math.sin(a) * 2, C.white); }
    if (e.type === 'snapper' && e.bite) { g.line(e.x, e.y - 8, e.bite.x, e.bite.y, C.leaf, 3); g.circle(e.bite.x, e.bite.y, 5, C.ink); g.circle(e.bite.x, e.bite.y, 4, C.pink); }
    if (e.type === 'snapper' && e.state === 'open') g.ring(e.x, e.y - 6, e.elite ? 34 : 24, Math.floor(time * 12) % 2 ? C.pink : C.plum);
    if (e.type === 'bee' && e.state === 'aim') { for (let k = 1; k < 8; k++) if (k % 2) g.px(e.x + e.dirX * k * 12, e.y - 6 + e.dirY * k * 12, C.pink); }
    if (e.elite || (e.hp < e.maxHp && e.maxHp >= 50)) { const bw = 16; g.rect(e.x - bw / 2, e.y + 3, bw, 2, C.ink); g.rect(e.x - bw / 2, e.y + 3, Math.round(bw * clamp(e.hp / e.maxHp, 0, 1)), 1, e.elite ? C.pink : C.lime); }
  }
  function drawBoss(b) {
    const col = b.flash > 0 ? C.white : b.phase === 2 && Math.floor(time * 4) % 5 === 0 ? C.pink : null;
    if (b.type === 'slimeKing') {
      const z = b.z || 0;
      drawShadow(b.x, b.y, b.r * (1 - z / 140));
      const spr = b.flash > 0 ? S.slimeKing.hurt : b.pose === 'squash' ? S.slimeKing.squash : b.pose === 'jump' ? S.slimeKing.jump : S.slimeKing.idle;
      if (b.state === 'bigHop' && b.airborne) { g.ring(b.to.x, b.to.y, 12 + Math.sin(time * 20) * 2, C.pink); }
      g.spr(spr, Math.round(b.x - 22), Math.round(b.y - 34 - z), { color: col });
    } else if (b.type === 'queenBee') {
      drawShadow(b.x, b.y + 6, 12);
      const spr = b.flash > 0 ? S.queenBee.hurt : b.state === 'dive' ? S.queenBee.dive : S.queenBee.fly[Math.floor(time * 16) % 2];
      if (b.state === 'aim') for (let k = 1; k < 16; k++) if (k % 2) g.px(b.x + b.dirX * k * 12, b.y - 10 + b.dirY * k * 12, Math.floor(time * 20) % 2 ? C.pink : C.white);
      g.spr(spr, Math.round(b.x - 20), Math.round(b.y - 30), { color: col ?? (b.state === 'aim' && Math.floor(time * 30) % 2 ? C.pink : null), flip: b.face < 0 });
    } else {
      // 拉芙蕾西亞：藤蔓根＋大花
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; g.line(b.x, b.y, b.x + Math.cos(a) * 40, b.y + Math.sin(a) * 26, C.dleaf, 3); }
      const spr = b.flash > 0 ? S.rafflesia.hurt : b.open ? S.rafflesia.open : S.rafflesia.closed;
      g.spr(spr, Math.round(b.x - 29), Math.round(b.y - 32), { color: col });
    }
  }
  function drawDoors() {
    for (const d of doors) {
      const x = Math.round(d.x - 12), y = d.y - 12;
      g.spr(S.door, x, y);
      if (d.open) { g.rect(x + 4, y + 4, 16, 8, C.ink); if (Math.floor(time * 3 + d.x) % 2) g.px(x + 12, y + 8, C.lime); }
      else g.spr(S.vines, x + 3, y + 4);
      // 獎勵牌
      const o = d.option, sx = Math.round(d.x), sy = y - 6;
      g.rect(sx - 8, sy - 5, 16, 11, C.ink); g.rect(sx - 7, sy - 4, 14, 9, o.type === 'elite' ? C.pink : o.type === 'boss' || o.type === 'stairs' ? C.plum : C.cream);
      drawRewardIcon(o, sx, sy);
    }
  }
  function drawRewardIcon(o, x, y) {
    if (o.type === 'shop') { g.spr(S.coin[0], x - 3, y - 3); return; }
    if (o.type === 'fountain') { g.circle(x, y, 3, C.teal); g.px(x - 1, y - 1, C.white); return; }
    if (o.type === 'boss') { g.circle(x, y, 3, C.pink); g.px(x - 1, y - 1, C.white); g.px(x + 1, y + 1, C.ink); return; }
    if (o.type === 'stairs') { for (let k = 0; k < 3; k++) g.rect(x - 4 + k * 3, y + 2 - k * 2, 3, 2 + k * 2, C.cream); return; }
    switch (o.reward) {
      case 'coins': g.spr(S.coin[0], x - 3, y - 3); break;
      case 'seeds': g.spr(S.seed, x - 3, y - 4); break;
      case 'upgrade': g.rect(x - 1, y - 3, 2, 6, C.teal); g.rect(x - 3, y - 1, 6, 1, C.teal); g.px(x, y - 4, C.white); break;
      case 'rare': g.circle(x, y, 3, C.pink); g.circle(x, y, 1, C.white); break;
      default: g.circle(x, y, 3, C.lime); g.px(x - 1, y - 1, C.white);
    }
  }
  function drawPickups() {
    for (const k of pickups) {
      const by = Math.round(Math.sin(k.t * 5) * 1.5);
      if (k.kind === 'coin') { drawShadow(k.x, k.y + 3, 2); g.spr(S.coin[Math.floor(k.t * 6) % 4 === 3 ? 1 : 0], Math.round(k.x - 3), Math.round(k.y - 4 + by)); }
      else if (k.kind === 'seed') { drawShadow(k.x, k.y + 3, 2); g.spr(S.seed, Math.round(k.x - 3), Math.round(k.y - 6 + by)); }
      else if (k.kind === 'heart') { drawShadow(k.x, k.y, 3); g.spr(S.heart, Math.round(k.x - 3), Math.round(k.y - 9 + by)); }
      else if (k.kind === 'boonOrb') {
        const rare = k.reward === 'rare', c1 = rare ? C.pink : k.reward === 'upgrade' ? C.teal : C.lime;
        drawShadow(k.x, k.y + 2, 6);
        const y = k.y - 12 + by * 2;
        g.circle(k.x, y, 7, C.ink); g.circle(k.x, y, 6, c1); g.circle(k.x - 2, y - 2, 2, C.white);
        for (let i = 0; i < 5; i++) { const a = k.t * 2 + i * TAU / 5; g.px(k.x + Math.cos(a) * 10, y + Math.sin(a) * 10, i % 2 ? C.white : c1); }
      }
    }
  }
  function drawProps(list = props) {
    for (const p of list) {
      if (p.kind === 'fountain') {
        g.spr(S.fountain, Math.round(p.x - 12), Math.round(p.y - 10), { sx: 2, sy: 2 });
        if (!p.used && Math.random() < 0.4) parts.add({ x: p.x + rand(-2, 2), y: p.y - 8, vx: rand(-20, 20), vy: rand(-50, -30), ay: 120, life: 0.6, colors: [C.white, C.teal], shape: 'px' });
      } else if (p.kind === 'merchant') {
        g.rect(p.x - 70, p.y + 12, 140, 6, C.soil); g.rect(p.x - 70, p.y + 12, 140, 1, C.terra); g.rect(p.x - 70, p.y + 18, 140, 1, C.ink);
        g.spr(Math.floor(time) % 4 === 0 ? S.hedgehogSmile : S.hedgehog, Math.round(p.x - 15), Math.round(p.y - 16));
      } else if (p.kind === 'item') {
        drawShadow(p.x, p.y, 7);
        g.rect(p.x - 8, p.y - 4, 16, 6, C.mauve); g.rect(p.x - 8, p.y - 4, 16, 1, C.cream); g.rect(p.x - 8, p.y + 2, 16, 1, C.ink);
        if (p.sold) continue;
        const by = Math.round(Math.sin(time * 3 + p.x) * 1.5);
        drawItemIcon(p.id, p.x, p.y - 12 + by);
        g.text(String(p.price), p.x, p.y + 5, run().coins >= p.price ? C.white : C.pink, { small: true, align: 'center', outline: C.ink });
      }
    }
  }
  function drawItemIcon(id, x, y) {
    switch (id) {
      case 'heal': g.circle(x, y, 4, C.ink); g.circle(x, y, 3, C.peach); g.px(x - 1, y - 1, C.white); g.rect(x - 1, y - 6, 2, 2, C.soil); break;
      case 'maxhp': g.spr(S.heart, x - 3, y - 3); g.px(x + 4, y - 4, C.white); break;
      case 'boon': g.circle(x, y, 5, C.ink); g.circle(x, y, 4, C.lime); g.px(x - 1, y - 2, C.white); break;
      case 'upgrade': g.circle(x, y, 5, C.ink); g.circle(x, y, 4, C.teal); g.rect(x - 1, y - 2, 2, 5, C.white); break;
      case 'seeds': g.spr(S.seed, x - 3, y - 3); g.spr(S.seed, x, y - 1); break;
      case 'reroll': for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) g.circle(x + dx, y + dy, 2, C.lleaf); g.px(x, y + 5, C.leaf); break;
    }
  }
  function drawZones() {
    for (const z of zones) {
      if (z.kind === 'honey') { const lv = Math.round(clamp((z.life - z.t) / 1, 0, 1) * 10) + 3; g.ellipse(z.x, z.y, z.r, z.r * 0.5, C.soil); g.ditherFast(z.x - z.r + 2, z.y - z.r * 0.4, z.r * 2 - 4, z.r * 0.8, C.peach, lv); }
      else if (z.kind === 'shock' && z.t > 0) { g.ellipse(z.x, z.y, z.r, z.r * 0.5, C.ink); g.ellipse(z.x, z.y, z.r - 2, (z.r - 2) * 0.5, C.lime); g.ellipse(z.x, z.y, z.r - 5, (z.r - 5) * 0.5, C.leaf); g.ellipse(z.x, z.y, Math.max(0, z.r - 8), Math.max(0, z.r - 8) * 0.5, C.shadow); }
      else if (z.kind === 'vine') {
        const ex = z.x + Math.cos(z.a) * z.len, ey = z.y + Math.sin(z.a) * z.len;
        if (z.t < 0) { if (Math.floor(time * 16) % 2) for (let k = 0; k < 20; k++) { const u = k / 20; g.px(z.x + (ex - z.x) * u, z.y + (ey - z.y) * u, C.pink); } }
        else { g.line(z.x, z.y, ex, ey, C.ink, 7); g.line(z.x, z.y, ex, ey, C.leaf, 5); g.line(z.x, z.y, ex, ey, C.lleaf, 1); for (let k = 1; k < 10; k++) { const u = k / 10; g.px(z.x + (ex - z.x) * u, z.y + (ey - z.y) * u - 3, C.pink); } }
      }
    }
  }
  const heartFull = () => S.heart;
  function drawHUD() {
    g.screenSpace();
    const r = run();
    for (let i = 0; i < r.maxHp; i++) { const x = 5 + (i % 10) * 9, y = 5 + Math.floor(i / 10) * 8; g.spr(S.heart, x, y, i < r.hp ? {} : { color: C.plum }); }
    for (let i = 0; i < r.rollMax; i++) g.rect(6 + i * 6, 15 + Math.floor((r.maxHp - 1) / 10) * 8, 4, 2, i < pl.charges ? C.teal : C.plum);
    g.spr(S.coin[0], W - 32, 5); g.text(String(r.coins), W - 5, 5, C.peach, { align: 'right', outline: C.ink });
    g.spr(S.seed, W - 32, 14); g.text(String(r.seeds), W - 5, 15, C.lime, { align: 'right', outline: C.ink });
    // 樓層進度
    const F = FLOORS[spec.floor];
    const label = `${spec.floor + 1}F`;
    g.text(label, W / 2 - (F.rooms + 1) * 3 - 12, 5, C.white, { outline: C.ink });
    for (let i = 0; i <= F.rooms; i++) {
      const x = W / 2 - (F.rooms + 1) * 3 + i * 7, y = 7;
      const done = i < spec.room || (i === spec.room && cleared), cur = i === spec.room;
      if (i === F.rooms) { g.rect(x - 1, y - 2, 5, 5, C.ink); g.rect(x, y - 1, 3, 3, done ? C.pink : cur ? C.white : C.plum); }
      else { g.rect(x, y - 1, 4, 3, C.ink); g.rect(x, y - 1, 3, 2, done ? C.lime : cur ? C.white : C.plum); }
    }
    // 祝福列
    let bx = 5;
    for (const id of Object.keys(r.boons)) { g.spr(S.boons[id], bx, H - 12); g.text(String(r.boons[id]), bx + 11, H - 8, C.white, { small: true, outline: C.ink }); bx += 16; }
    if (combo >= 2) {
      const pop = time - lastHit < 0.06 ? 1 : 0;
      g.text(String(combo), W - 34, 30 - pop, combo >= 10 ? C.lime : C.white, { scale: 2, align: 'right', outline: C.ink });
      g.text('HIT', W - 31, 35, C.pink, { outline: C.ink });
    }
    if (pl.slowT > 0) { const lv = Math.round(clamp(pl.slowT / P.perfectDur, 0, 1) * 5) + 1; g.dither(0, 0, W, 5, C.teal, lv); g.dither(0, H - 5, W, 5, C.teal, lv); }
    if (boss && !boss.dead && boss.state !== 'intro') {
      const bw = 200, bx2 = (W - bw) / 2, by = H - 24;
      g.label(FLOORS[spec.floor].bossName, bx2, by - 13, C.white, { outline: C.ink });
      g.rect(bx2 - 1, by - 1, bw + 2, 7, C.ink); g.rect(bx2, by, bw, 5, C.plum);
      g.rect(bx2, by, Math.round(bw * clamp(boss.hp / boss.maxHp, 0, 1)), 5, boss.phase === 2 ? C.pink : C.lime);
      g.rect(bx2, by, Math.round(bw * clamp(boss.hp / boss.maxHp, 0, 1)), 1, C.white);
    }
    if (banner && banner.text && !(banner.t < 0.4 && Math.floor(banner.t * 10) % 2)) {
      if (banner.boss) { g.rect(0, 64, W, 26, C.ink); g.rect(0, 65, W, 1, C.pink); g.rect(0, 89, W, 1, C.pink); g.label('守護者　' + banner.text, W / 2, 70, C.white, { align: 'center' }); }
      else g.label(banner.text, W / 2, 20, banner.good ? C.lime : C.white, { align: 'center', outline: C.ink });
    }
    // 商品說明
    if (promptItem) {
      const p = promptItem, lines = env.wrap(p.desc, 170);
      const w = 184, h = 30 + lines.length * 13, x = W / 2 - w / 2, y = H - h - 18;
      g.rect(x, y, w, h, C.ink); g.rect(x + 1, y + 1, w - 2, h - 2, C.shadow);
      g.label(`${p.name}　${p.price} 金幣`, x + 7, y + 3, C.peach);
      lines.forEach((l, i) => g.label(l, x + 7, y + 17 + i * 13, C.white));
      g.text('Z BUY', x + w - 6, y + 6, C.lime, { small: true, align: 'right' });
    }
    if (cleared && spec.type !== 'shop' && spec.type !== 'fountain' && clearT > 1.2 && clearT < 5 && !pickups.some(k => k.kind === 'boonOrb') && Math.floor(clearT * 2) % 2) g.label('門打開了，選一扇門前進', W / 2, 30, C.cream, { align: 'center', outline: C.ink });
  }
  function render() {
    g.clear(C.ink);
    g.camera(cam.x + shake.x, cam.y + shake.y);
    g.ctx.drawImage(floorLayer, 0, 0);
    drawDoors();
    for (const v of vines) { const c = v.life < 0.4 ? C.dleaf : C.leaf; g.rect(v.x - 3, v.y - 1, 6, 2, c); g.px(v.x - 2 + v.v, v.y - 2, C.pink); g.px(v.x + 2 - v.v, v.y + 1, C.lleaf); }
    drawZones();
    drawPickups();
    for (const p of pots) if (!p.broken) drawShadow(p.x, p.y, 5);
    for (const e of enemies) if (!e.dead && e.spawnT <= 0 && !e.d.boss && !e.d.fly) drawShadow(e.x, e.y, e.r + 1);
    for (const e of enemies) if (!e.dead && e.spawnT <= 0 && e.d.fly && !e.d.boss) drawShadow(e.x, e.y + 4, e.r);
    drawShadow(pl.x, pl.y, 5);
    const list = [];
    for (let ty = 0; ty < room.MH; ty++) for (let tx = 0; tx < room.MW; tx++) if (room.at(tx, ty) === TILE.PLANTER) list.push({ y: ty * T + T, draw: () => drawPlanter(tx, ty) });
    for (const p of pots) if (!p.broken) list.push({ y: p.y, draw: () => g.spr(S.pot, p.x - 5, p.y - 8) });
    for (const p of puffs) if (!p.blown) list.push({ y: p.y, draw: () => { const s = 4 + Math.sin(p.t * 3) * 0.6; g.circle(p.x, p.y - 4, s + 1, C.ink); g.circle(p.x, p.y - 4, s, C.pink); g.px(p.x - 1, p.y - 6, C.white); g.px(p.x + 2, p.y - 3, C.cream); } });
    for (const p of props) if (p.kind !== 'item') list.push({ y: p.y + (p.kind === 'merchant' ? 20 : 0), draw: () => drawProps([p]) });
    for (const p of props) if (p.kind === 'item') list.push({ y: p.y, draw: () => drawProps([p]) });
    for (const e of enemies) list.push({ y: e.y + (e.d.fly ? 10 : 0), draw: () => drawEnemy(e) });
    list.push({ y: pl.y, draw: drawPlayer });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.draw();
    for (const s of spores) {
      if (s.kind === 'needle') { g.line(s.x - s.vx * 0.04, s.y - s.vy * 0.04, s.x, s.y, C.ink, 3); g.line(s.x - s.vx * 0.03, s.y - s.vy * 0.03, s.x, s.y, C.cream); continue; }
      const c1 = s.kind === 'goo' ? C.lime : s.kind === 'honey' ? C.peach : s.kind === 'seed' ? C.terra : (Math.floor(time * 10 + s.x) % 2 ? C.pink : C.lime);
      g.circle(s.x, s.y, s.r, C.ink); g.circle(s.x, s.y, s.r - 1, c1); g.px(s.x - 1, s.y - 1, C.white);
    }
    for (const w of waves) {
      g.arcBand(w.x - Math.cos(w.a) * 8, w.y - Math.sin(w.a) * 8, 8, 12, w.a - 1.1, w.a + 1.1, C.teal);
      g.arcBand(w.x - Math.cos(w.a) * 8, w.y - Math.sin(w.a) * 8, 11, 13, w.a - 0.9, w.a + 0.9, C.white);
    }
    for (const p of pshots) {
      if (p.kind === 'drop') { g.circle(p.x, p.y, 2, C.ink); g.px(p.x, p.y, C.teal); g.px(p.x - 1, p.y - 1, C.white); }
      else if (p.kind === 'seed') { g.circle(p.x, p.y, 2, C.ink); g.px(p.x, p.y, C.white); g.px(p.x - 1, p.y, C.lime); }
      else if (p.kind === 'sun') { g.ring(p.x, p.y, p.r, C.peach); g.ring(p.x, p.y, p.r - 1, C.white); }
    }
    drawSmear();
    parts.draw(g);
    floats.draw(g);
    if (P.showHitbox) drawHitboxes();
    if (!hudOff) drawHUD();
    if (dying) { g.screenSpace(); g.ditherFast(0, 0, W, H, C.ink, Math.round(clamp((deathT - 0.8) / 0.8, 0, 1) * 16)); }
  }
  function drawHitboxes() {
    g.ring(pl.x, pl.y, pl.r, invulnerable() ? C.lime : C.teal);
    for (const e of enemies) if (!e.dead && e.spawnT <= 0) g.ring(e.x, e.y, e.r, C.teal);
    for (const s of spores) g.ring(s.x, s.y, s.r, C.pink);
    const a = pl.atk;
    if (a && !a.def.shot && a.f > a.S && a.f <= a.S + a.A) {
      const pv = pivot();
      g.arcBand(pv.x, pv.y, a.reach - 1, a.reach + 1, pl.prevBlade, pl.blade, C.pink);
    }
  }
  function debugLines() {
    const a = pl.atk;
    return [
      `STATE ${pl.roll ? 'ROLL' : a ? 'ATK ' + a.kind.toUpperCase() + ' F' + a.f : pl.charging ? 'CHARGE ' + pl.charge.toFixed(2) : 'MOVE'}`,
      `SPEED ${Math.hypot(pl.vx, pl.vy).toFixed(0)}  INV ${Math.max(0, pl.inv * 1000).toFixed(0)}`,
      `ROOM ${spec.floor + 1}-${spec.room + 1} ${spec.type}  WAVE ${waveIdx}/${waveQ.length}`,
      `ENEMY ${enemies.length}  SPORE ${spores.length}`,
    ];
  }
  /** 封面構圖 */
  function stageCover() {
    enterRoom({ floor: 0, room: 0, type: 'fountain', reward: null });
    hudOff = true; banner = null;
    doors = [];
    props = [];
    pl.x = 10 * T; pl.y = 8 * T + 8; pl.aim = 0; setFacing(0);
    const add = (t, x, y, o = {}) => { const e = makeEnemy(t, x, y); e.spawnT = 0; e.stateT = 9; Object.assign(e, o); enemies.push(e); };
    add('slime', pl.x + 21, pl.y - 1); add('mushroom', pl.x + 58, pl.y - 26); add('beetle', pl.x - 44, pl.y + 12, { dirX: 1, dirY: 0 }); add('bee', pl.x + 40, pl.y + 20);
    cam.center(pl.x + 8, pl.y - 12);
    startAttack(weapon().first); pl.atk.f = pl.atk.S;
  }
  return {
    enterRoom, update, render, debugLines, stageCover,
    set hudOff(v) { hudOff = v; },
    get spec() { return spec; }, get cleared() { return cleared; }, get dying() { return dying; },
    peek: () => ({ pl, enemies, spores, pickups, doors, props, combo, cleared, boss, spec, waveIdx, waves: waveQ.length }),
    debugClear() { for (const e of enemies) if (!e.dead) killEnemy(e); waveIdx = waveQ.length; enemies = []; if (boss) boss.dead = true; roomCleared(); },
  };
}
