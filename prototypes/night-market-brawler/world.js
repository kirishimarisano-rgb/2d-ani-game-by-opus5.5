// 《夜市拳姬》遊戲世界：一條街道裡的所有事——阿芒、混混、守護者、戰鬥區、道具與小吃。
import { makeLayer, TAU } from '../engine/pixel.js';
import { Particles, Shaker, Camera, Floaters, clamp, approach, rand, sign, smoothK, pick } from '../engine/fx.js';
import { PALETTE, C } from './sprites.js';
import { STAGES } from './stages.js';

const W = 320, H = 180;
export const FLOOR_TOP = 118, FLOOR_BOT = 170;
const DEG = Math.PI / 180;
const angDiff = (a, b) => { let d = (b - a) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };

// ---------------- 姿勢 ----------------
const POSES = {
  guard: { lean: 0, hip: 0, fu: 55, fl: -75, bu: 105, bl: -70, ft: 75, fs: 100, bt: 105, bs: 95 },
  guard2: { lean: 0, hip: 1, fu: 60, fl: -70, bu: 108, bl: -65, ft: 70, fs: 105, bt: 110, bs: 95 },
  jabWind: { lean: -1, hip: 0, fu: 85, fl: -40, bu: 105, bl: -70, ft: 75, fs: 100, bt: 105, bs: 95 },
  jab: { lean: 2, hip: 0, fu: 2, fl: 0, bu: 105, bl: -70, ft: 70, fs: 95, bt: 110, bs: 95 },
  crossWind: { lean: -2, hip: 0, fu: 70, fl: -70, bu: 150, bl: -40, ft: 75, fs: 100, bt: 110, bs: 95 },
  cross: { lean: 3, hip: 1, fu: 120, fl: -80, bu: -2, bl: -2, ft: 60, fs: 95, bt: 120, bs: 95 },
  upperWind: { lean: -1, hip: 4, fu: 110, fl: 60, bu: 110, bl: -70, ft: 55, fs: 125, bt: 125, bs: 70 },
  upper: { lean: 2, hip: -4, fu: -80, fl: -95, bu: 120, bl: -40, ft: 88, fs: 90, bt: 115, bs: 105, head: 'shout' },
  powerWind: { lean: -4, hip: 2, fu: 150, fl: 60, bu: 60, bl: -80, ft: 60, fs: 110, bt: 125, bs: 80 },
  power: { lean: 5, hip: 2, fu: -4, fl: -2, bu: 150, bl: -40, ft: 50, fs: 90, bt: 130, bs: 100, head: 'shout' },
  jump: { lean: 0, hip: 0, fu: -20, fl: -80, bu: 150, bl: -110, ft: 25, fs: 110, bt: 75, bs: 150 },
  jumpKick: { lean: -2, hip: 0, fu: -120, fl: -150, bu: 165, bl: 130, ft: 35, fs: 32, bt: 110, bs: 175 },
  airPunch: { lean: 2, hip: 0, fu: 20, fl: 20, bu: 150, bl: -110, ft: 40, fs: 120, bt: 80, bs: 150 },
  spinWind: { lean: -1, hip: 2, fu: 170, fl: 150, bu: 10, bl: 30, ft: 70, fs: 110, bt: 110, bs: 80 },
  spinKick: { lean: 0, hip: -2, fu: -160, fl: -170, bu: 160, bl: 150, ft: 0, fs: 0, bt: 105, bs: 90, head: 'shout' },
  slideWind: { lean: 2, hip: 3, fu: 120, fl: 100, bu: -150, bl: -130, ft: 60, fs: 110, bt: 120, bs: 80 },
  slide: { lean: -3, hip: 8, fu: 150, fl: 110, bu: -160, bl: -140, ft: 8, fs: 2, bt: 150, bs: 60 },
  hurt: { lean: -3, hip: 1, fu: -130, fl: -160, bu: -110, bl: -140, ft: 65, fs: 100, bt: 115, bs: 85, head: 'hurt' },
  air: { lean: -3, hip: 0, fu: -150, fl: 170, bu: -165, bl: 150, ft: 40, fs: 90, bt: 60, bs: 130, head: 'hurt' },
  getup: { lean: 1, hip: 7, fu: 95, fl: 80, bu: 100, bl: 90, ft: 40, fs: 150, bt: 140, bs: 40 },
  wind: { lean: -2, hip: 0, fu: 160, fl: -100, bu: 110, bl: -60, ft: 70, fs: 100, bt: 110, bs: 95 },
  punch: { lean: 3, hip: 0, fu: 0, fl: 0, bu: 110, bl: -60, ft: 65, fs: 95, bt: 115, bs: 95 },
  slamWind: { lean: -3, hip: -1, fu: -100, fl: -95, bu: -80, bl: -90, ft: 75, fs: 100, bt: 105, bs: 95 },
  slam: { lean: 4, hip: 3, fu: 40, fl: 70, bu: 50, bl: 80, ft: 60, fs: 110, bt: 120, bs: 80 },
  grab: { lean: 1, hip: 0, fu: 10, fl: 30, bu: 20, bl: 30, ft: 70, fs: 100, bt: 110, bs: 95 },
  knee: { lean: 2, hip: -1, fu: 30, fl: 60, bu: 30, bl: 60, ft: -20, fs: 90, bt: 110, bs: 95 },
  throwWind: { lean: -3, hip: 1, fu: -60, fl: -80, bu: -70, bl: -80, ft: 80, fs: 100, bt: 100, bs: 95 },
  throw: { lean: 4, hip: 0, fu: 10, fl: 0, bu: 20, bl: 0, ft: 60, fs: 95, bt: 120, bs: 95, head: 'shout' },
  held: { lean: -2, hip: 2, fu: -120, fl: -150, bu: -100, bl: -140, ft: 80, fs: 120, bt: 110, bs: 130, head: 'hurt' },
  chair: { lean: -3, hip: 0, fu: -150, fl: -160, bu: -140, bl: -150, ft: 75, fs: 100, bt: 105, bs: 95 },
  chairSwing: { lean: 4, hip: 1, fu: 30, fl: 40, bu: 40, bl: 50, ft: 60, fs: 95, bt: 120, bs: 95, head: 'shout' },
  superPose: { lean: 0, hip: -2, fu: -90, fl: -90, bu: -90, bl: -90, ft: 80, fs: 100, bt: 100, bs: 80, head: 'shout' },
  cheer: { lean: 0, hip: 0, fu: -60, fl: -110, bu: 110, bl: -70, ft: 80, fs: 95, bt: 100, bs: 90, head: 'shout' },
};
const ANGLE_KEYS = ['fu', 'fl', 'bu', 'bl', 'ft', 'fs', 'bt', 'bs'];

// 招式：f＝[前搖, 判定, 後搖]，reach＝前方判定範圍，zr＝高度範圍
const MOVES = {
  jab1: { f: [3, 2, 7], dmg: 4, reach: [2, 19], zr: [12, 24], push: 1, poses: ['jabWind', 'jab', 'guard'], next: 'jab2', sound: 0 },
  jab2: { f: [3, 2, 8], dmg: 4, reach: [2, 19], zr: [12, 24], push: 1, poses: ['jabWind', 'jab', 'guard'], next: 'cross', sound: 1 },
  cross: { f: [4, 3, 10], dmg: 7, reach: [2, 22], zr: [12, 24], push: 1.3, poses: ['crossWind', 'cross', 'guard'], next: 'upper', sound: 2 },
  upper: { f: [5, 3, 16], dmg: 11, reach: [0, 17], zr: [8, 36], launch: 1, finisher: true, poses: ['upperWind', 'upper', 'guard'], sound: 3 },
  power: { f: [4, 3, 16], dmg: 20, reach: [0, 24], zr: [8, 28], knockdown: true, finisher: true, breaker: true, poses: ['powerWind', 'power', 'guard'], sound: 3 },
  airKick: { f: [2, 16, 4], dmg: 8, reach: [0, 19], zr: [-8, 14], knockdown: true, air: true, poses: ['jump', 'jumpKick', 'jump'], sound: 2 },
  airPunch: { f: [2, 5, 6], dmg: 6, reach: [0, 18], zr: [0, 20], air: true, poses: ['jump', 'airPunch', 'jump'], sound: 1 },
  slide: { f: [2, 16, 12], dmg: 9, reach: [-2, 21], zr: [-2, 12], knockdown: true, poses: ['slideWind', 'slide', 'getup'], sound: 2 },
  slideUp: { f: [2, 16, 12], dmg: 11, reach: [-2, 21], zr: [-2, 14], launch: 0.85, finisher: true, poses: ['slideWind', 'slide', 'getup'], sound: 3 },
  spin: { f: [4, 14, 10], dmg: 8, reach: [-20, 20], zr: [4, 26], launch: 0.6, finisher: true, spin: true, poses: ['spinWind', 'spinKick', 'guard'], sound: 3 },
  chair: { f: [5, 3, 12], dmg: 14, reach: [0, 27], zr: [6, 30], knockdown: true, finisher: true, poses: ['chair', 'chairSwing', 'chair'], sound: 3, chair: true },
  knee: { f: [2, 3, 8], dmg: 6, reach: [0, 16], zr: [4, 26], poses: ['grab', 'knee', 'grab'], sound: 1, knee: true },
};
const ENEMY = {
  rabbit: { hp: 60, speed: 46, windT: 0.36, dmg: 8, reach: [2, 20], name: '兔兔混混', weight: 1, score: 100 },
  bear: { hp: 130, speed: 30, windT: 0.62, dmg: 16, reach: [0, 26], name: '熊熊保鑣', weight: 1.6, heavy: true, score: 250 },
  cat: { hp: 48, speed: 72, windT: 0.32, dmg: 9, reach: [0, 22], name: '貓咪飛踢手', weight: 0.9, score: 150, leaper: true },
  dog: { hp: 55, speed: 40, windT: 0.5, dmg: 10, reach: [0, 18], name: '狗狗投手', weight: 1, score: 150, thrower: true },
  trainee: { hp: 99999, speed: 0, name: '練習用兔兔', weight: 1, score: 0 },
  bunnyBoss: { hp: 520, speed: 52, windT: 0.4, dmg: 14, reach: [0, 30], name: '兔兔老大', weight: 3, boss: true, score: 3000 },
  panda: { hp: 950, speed: 50, windT: 0.35, dmg: 16, reach: [0, 30], name: '熊貓大仙', weight: 3, boss: true, score: 5000 },
  bubbleTea: { hp: 740, name: '珍奶巨人', boss: true, sprite: true, bw: 22, score: 4000 },
  clawMachine: { hp: 840, name: '夾娃娃機大王', boss: true, sprite: true, bw: 26, score: 4500 },
  plush: { hp: 14, speed: 60, name: '布偶', weight: 0.6, score: 20, tiny: true },
};

export function createWorld(env) {
  const { g, input, sound, P, S, hooks } = env;
  const RIGS = {
    amang: { p: S.amang, len: [6, 5, 7, 7], hipH: 15, thick: [3, 3], col: [C.yellow, C.skin, C.navy, C.skin], sock: C.white, fist: S.fist, shoe: S.shoe, t: { hip: [5, 10], sf: [7, 3], sb: [3, 3], neck: [5, 1] }, chin: [7, 11] },
    rabbit: { p: S.rabbit, len: [5, 4, 5, 6], hipH: 12, thick: [3, 3], col: [C.lpink, C.lpink, C.lpink, C.lpink], fist: S.mitten, shoe: S.bigShoe, t: { hip: [6, 11], sf: [9, 4], sb: [3, 4], neck: [6, 1] }, chin: [8, 17] },
    trainee: { p: S.trainee, len: [5, 4, 5, 6], hipH: 12, thick: [3, 3], col: [C.cyan, C.cyan, C.cyan, C.cyan], fist: S.mitten, shoe: S.bigShoeC, t: { hip: [6, 11], sf: [9, 4], sb: [3, 4], neck: [6, 1] }, chin: [8, 17] },
    bear: { p: S.bear, len: [6, 6, 6, 8], hipH: 15, thick: [4, 4], col: [C.navy, C.navy, C.navy, C.navy], fist: S.paw, shoe: S.dressShoe, t: { hip: [6, 11], sf: [10, 3], sb: [2, 3], neck: [6, 0] }, chin: [9, 15] },
    cat: { p: S.cat, len: [5, 4, 5, 6], hipH: 12, thick: [3, 3], col: [C.white, C.white, C.white, C.gray], fist: S.whitePaw, shoe: S.bigShoeC, t: { hip: [6, 11], sf: [9, 4], sb: [3, 4], neck: [6, 1] }, chin: [8, 14] },
    dog: { p: S.dog, len: [5, 4, 5, 6], hipH: 12, thick: [3, 3], col: [C.yellow, C.yellow, C.yellow, C.wood], fist: S.paw, shoe: S.dressShoe, t: { hip: [6, 11], sf: [9, 4], sb: [3, 4], neck: [6, 1] }, chin: [9, 15] },
    plush: { p: S.rabbit, len: [3, 3, 3, 3], hipH: 7, thick: [2, 2], col: [C.lpink, C.lpink, C.lpink, C.lpink], fist: S.mitten, shoe: S.mitten, t: { hip: [6, 11], sf: [9, 4], sb: [3, 4], neck: [6, 1] }, chin: [8, 17] },
    bunnyBoss: { p: S.boss1, len: [8, 8, 8, 10], hipH: 19, thick: [5, 5], col: [C.navy, C.navy, C.navy, C.navy], fist: S.mitten, shoe: S.dressShoe, t: { hip: [6, 11], sf: [10, 3], sb: [2, 3], neck: [6, 0] }, chin: [13, 26] },
    panda: { p: S.panda, len: [8, 7, 8, 10], hipH: 19, thick: [6, 6], col: [C.ink, C.ink, C.ink, C.ink], fist: S.blackShoe, shoe: S.blackShoe, t: { hip: [6, 11], sf: [10, 4], sb: [2, 4], neck: [6, 1] }, chin: [11, 19] },
  };
  const parts = new Particles(1000), floats = new Floaters(), shake = new Shaker(), cam = new Camera(W, H);
  let st, stageIndex, bg, WW, pl, enemies, shots, props, pickups, zoneIdx, zone, locked, waveI, spawnQ, spawnT, goT, hitstop, time, combo, comboT, lastHit, bestCombo, impactT, target, rankText, boss, finale, stats, hudOff = false, tipI, tipT, superFx, deadT, ended;

  // ---------------- 音效 ----------------
  const sfx = {
    whiff() { if (!sound.throttle('whiff', 0.05)) return; sound.noise({ dur: 0.08, vol: 0.07, filter: 'bandpass', f0: 2200, f1: 900, q: 1.3 }); },
    hit(level, n) {
      if (!sound.throttle('hit', 0.025)) return;
      const heavy = level >= 2;
      sound.noise({ dur: heavy ? 0.14 : 0.07, vol: heavy ? 0.3 : 0.22, filter: 'lowpass', f0: heavy ? 3000 : 4200, f1: 300 });
      sound.tone({ type: 'sine', f0: heavy ? 180 : 240, f1: 45, dur: heavy ? 0.22 : 0.1, vol: heavy ? 0.4 : 0.25 });
      sound.noise({ dur: 0.03, vol: 0.12, filter: 'highpass', f0: 3000 + Math.min(n, 12) * 150 });
      if (level >= 3) sound.tone({ type: 'square', f0: 220, f1: 880, dur: 0.18, vol: 0.06, delay: 0.02 });
    },
    squeak() { if (!sound.throttle('squeak', 0.08)) return; sound.tone({ type: 'square', f0: rand(900, 1200), f1: 500, dur: 0.07, vol: 0.05 }); },
    jump() { sound.tone({ type: 'triangle', f0: 300, f1: 620, dur: 0.1, vol: 0.07 }); },
    land() { if (!sound.throttle('land', 0.08)) return; sound.noise({ dur: 0.06, vol: 0.1, filter: 'lowpass', f0: 800, f1: 200 }); },
    thud() { if (!sound.throttle('thud', 0.06)) return; sound.tone({ type: 'sine', f0: 120, f1: 40, dur: 0.2, vol: 0.35 }); sound.noise({ dur: 0.12, vol: 0.2, filter: 'lowpass', f0: 900, f1: 100 }); },
    hurt() { sound.tone({ type: 'sawtooth', f0: 380, f1: 120, dur: 0.2, vol: 0.12 }); sound.noise({ dur: 0.15, vol: 0.2, filter: 'lowpass', f0: 2500, f1: 300 }); },
    rank(n) { [659, 784, 988, 1319].slice(0, 2 + Math.min(2, n)).forEach((f, i) => sound.tone({ type: 'square', f0: f, dur: 0.1, vol: 0.05, delay: i * 0.07 })); },
    wind() { if (!sound.throttle('wind', 0.2)) return; sound.tone({ type: 'triangle', f0: 200, f1: 330, dur: 0.12, vol: 0.05 }); },
    spin() { sound.noise({ dur: 0.3, vol: 0.13, filter: 'bandpass', f0: 700, f1: 2400, q: 1 }); },
    grab() { sound.noise({ dur: 0.06, vol: 0.12, filter: 'bandpass', f0: 1200, q: 2 }); sound.tone({ type: 'square', f0: 330, dur: 0.05, vol: 0.05 }); },
    brk() { sound.noise({ dur: 0.25, vol: 0.22, filter: 'lowpass', f0: 1800, f1: 200 }); sound.tone({ type: 'square', f0: 240, f1: 80, dur: 0.12, vol: 0.06 }); },
    pick() { sound.tone({ type: 'pulse25', f0: 880, f1: 1320, dur: 0.08, vol: 0.05 }); },
    eat() { [784, 988, 1319].forEach((f, i) => sound.tone({ type: 'triangle', f0: f, dur: 0.1, vol: 0.07, delay: i * 0.06 })); },
    coin() { if (!sound.throttle('coin', 0.04)) return; sound.tone({ type: 'pulse25', f0: 1976, dur: 0.04, vol: 0.04 }); sound.tone({ type: 'pulse25', f0: 2637, dur: 0.08, vol: 0.04, delay: 0.04 }); },
    go() { [523, 659, 784].forEach((f, i) => sound.tone({ type: 'pulse25', f0: f, dur: 0.08, vol: 0.05, delay: i * 0.07 })); },
    superStart() { [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => sound.tone({ type: 'pulse25', f0: f, dur: 0.12, vol: 0.06, delay: i * 0.05 })); sound.noise({ dur: 1.2, vol: 0.15, filter: 'bandpass', f0: 800, f1: 4000, q: 0.8 }); },
    superHit() { sound.tone({ type: 'sine', f0: 100, f1: 30, dur: 0.6, vol: 0.5 }); sound.noise({ dur: 0.6, vol: 0.3, filter: 'lowpass', f0: 3000, f1: 200 }); },
    roar() { sound.tone({ type: 'sawtooth', f0: 130, f1: 60, dur: 0.7, vol: 0.12 }); sound.noise({ dur: 0.7, vol: 0.2, filter: 'lowpass', f0: 900, f1: 200 }); },
    ko() { sound.tone({ type: 'square', f0: 880, f1: 110, dur: 0.8, vol: 0.1 }); sound.noise({ dur: 0.6, vol: 0.25, filter: 'lowpass', f0: 2000, f1: 100 }); },
  };

  // ---------------- 能力（招式修行）與小吃 ----------------
  const skill = id => P.unlockAll ? 2 : (env.skills()[id] || 0);
  const snack = () => env.snack();
  const atkMul = () => (snack() === 'mango' ? 1.2 : 1) * P.playerDamage;
  const meterMul = () => (1 + skill('meter') * 0.3) * (snack() === 'tea' ? 1.5 : 1);
  const speedMul = () => snack() === 'candy' ? 1.15 : 1;

  // ---------------- 建立角色 ----------------
  function fighter(kind, x, y) {
    return { kind, rig: RIGS[kind === 'player' ? 'amang' : kind], x, y, z: 0, vx: 0, vy: 0, vz: 0, face: 1, state: 'idle', stateT: 0,
      pose: { ...POSES.guard }, hp: 0, maxHp: 0, flash: 0, inv: 0, atk: null, juggles: 0, bounced: false, dead: false, cd: rand(0.5, 1.5), token: false, t: rand(0, 5), shakeT: 0 };
  }
  function makeEnemy(kind, x, y) {
    const e = fighter(kind, x, y);
    const d = ENEMY[kind];
    const hp = Math.round(d.hp * (d.boss ? P.bossHp : P.enemyHp) * (1 + stageIndex * 0.12 * (d.boss ? 0 : 1)));
    e.hp = e.maxHp = hp; e.def = d; e.face = x < pl.x ? 1 : -1;
    e.bw = d.bw || (d.boss ? 10 : 6);
    return e;
  }
  function load(i) {
    stageIndex = i; st = STAGES[i];
    WW = st.length;
    bg = buildBackground(st.style);
    cam.bounds = { w: WW, h: H };
    pl = fighter('player', 70, 146);
    pl.maxHp = 100 + skill('hp') * 20 + (snack() === 'sausage' ? 30 : 0);
    pl.hp = pl.maxHp; pl.chain = null; pl.chainT = 0; pl.running = false; pl.airAttacks = 0; pl.specialCD = 0; pl.meter = P.fullMeter ? 100 : 0; pl.chair = null; pl.grab = null; pl.charge = 0; pl.tapDir = 0; pl.tapT = 0;
    enemies = []; shots = []; pickups = []; props = [];
    for (const [kind, x, y] of st.props) props.push({ kind, x, y, hp: kind === 'crate' ? 30 : 20, flash: 0, broken: false });
    zoneIdx = 0; zone = null; locked = false; waveI = 0; spawnQ = []; spawnT = 0; goT = 0; hitstop = 0; time = 0; combo = 0; comboT = 0; lastHit = -1; bestCombo = 0; impactT = 0; target = null; rankText = null; boss = null; finale = null; superFx = null; deadT = 0; ended = false;
    tipI = 0; tipT = 1.2;
    stats = { time: 0, dmgTaken: 0, score: 0, kills: 0, continues: 0, coins: 0, food: 0 };
    parts.clear(); floats.list.length = 0; shake.reset();
    cam.center(pl.x + 60, H / 2);
  }

  // ---------------- 骨架繪製 ----------------
  function limb(ax, ay, a1, l1, a2, l2, face) {
    const d1 = face > 0 ? a1 : 180 - a1, d2 = face > 0 ? a2 : 180 - a2;
    const bx = ax + Math.cos(d1 * DEG) * l1, by = ay + Math.sin(d1 * DEG) * l1;
    return { ax, ay, bx, by, cx: bx + Math.cos(d2 * DEG) * l2, cy: by + Math.sin(d2 * DEG) * l2 };
  }
  function shade(c) { return { [C.yellow]: C.orange, [C.skin]: C.dskin, [C.lpink]: C.pink, [C.cyan]: C.plum, [C.white]: C.gray, [C.navy]: C.ink, [C.gray]: C.purple, [C.ink]: C.navy }[c] ?? c; }
  function drawRig(f, sil) {
    const r = f.rig, p = f.pose, face = f.face;
    const gx = Math.round(f.x), gy = Math.round(f.y - f.z);
    const flash = sil ?? (f.flash > 0 ? C.white : f.rage && Math.floor(time * 10) % 4 === 0 ? C.red : null);
    const jit = f.shakeT > 0 && hitstop > 0 ? (Math.floor(time * 60) % 2 ? 2 : -2) : 0;
    const blink = f.inv > 0 && f.state !== 'hurt' && f.state !== 'held' && Math.floor(f.inv * 20) % 2;
    if (blink && !sil) return;
    if (f.state === 'dead' && !sil && Math.floor(time * 20) % 2) return;
    if (f.state === 'down' || f.state === 'dead') { drawLying(f, flash); return; }
    const hip = { x: gx + jit + p.lean, y: gy - r.hipH + p.hip };
    const tor = r.p.torso, tw = tor.w;
    const fx = (x, w) => face > 0 ? x : w - 1 - x;
    const tx = hip.x - fx(r.t.hip[0], tw), ty = hip.y - r.t.hip[1];
    const sf = { x: tx + fx(r.t.sf[0], tw), y: ty + r.t.sf[1] }, sb = { x: tx + fx(r.t.sb[0], tw), y: ty + r.t.sb[1] };
    const neck = { x: tx + fx(r.t.neck[0], tw), y: ty + r.t.neck[1] };
    const [ua, fa, thl, shl] = r.len;
    const armF = limb(sf.x, sf.y, p.fu, ua, p.fl, fa, face), armB = limb(sb.x, sb.y, p.bu, ua, p.bl, fa, face);
    const hipF = { x: hip.x + face, y: hip.y }, hipB = { x: hip.x - face * 2, y: hip.y };
    const legF = limb(hipF.x, hipF.y, p.ft, thl, p.fs, shl, face), legB = limb(hipB.x, hipB.y, p.bt, thl, p.bs, shl, face);
    const [ta, tl] = r.thick;
    const drawLimb = (L, t, cUp, cLow, end, tip) => {
      g.line(L.ax, L.ay, L.bx, L.by, C.ink, t + 2); g.line(L.bx, L.by, L.cx, L.cy, C.ink, t + 2);
      g.line(L.ax, L.ay, L.bx, L.by, flash ?? cUp, t); g.line(L.bx, L.by, L.cx, L.cy, flash ?? cLow, t);
      if (tip != null) g.line(L.cx - (L.cx - L.bx) * 0.25, L.cy - (L.cy - L.by) * 0.25, L.cx, L.cy, flash ?? tip, t);
      g.spr(end, Math.round(L.cx - end.w / 2), Math.round(L.cy - end.h / 2), { flip: face < 0, color: flash });
    };
    const [cSleeve, cArm, cThigh, cShin] = r.col;
    drawLimb(armB, ta, sil ?? shade(cSleeve), sil ?? shade(cArm), r.fist);
    drawLimb(legB, tl, sil ?? shade(cThigh), sil ?? shade(cShin), r.shoe, r.sock != null ? shade(r.sock) : null);
    g.spr(tor, tx, ty, { flip: face < 0, color: flash });
    drawLimb(legF, tl, cThigh, cShin, r.shoe, r.sock);
    const head = p.head === 'hurt' || f.state === 'hurt' || f.state === 'held' ? r.p.headHurt : (p.head === 'shout' || f.rage) && r.p.headShout ? r.p.headShout : r.p.head;
    g.spr(head, neck.x - fx(r.chin[0], head.w), neck.y - r.chin[1], { flip: face < 0, color: flash });
    drawLimb(armF, ta, cSleeve, cArm, r.fist);
    f.handF = { x: armF.cx, y: armF.cy };
    if (f === pl && pl.chair) { // 手上的塑膠椅
      const cx = armF.cx, cy = armF.cy;
      const swinging = pl.atk && pl.atk.m.chair && pl.atk.f > pl.atk.S;
      g.spr(S.chair, Math.round(cx - 6 + (swinging ? face * 6 : 0)), Math.round(cy - (swinging ? 6 : 14)), { flip: face < 0, color: sil ?? null });
    }
  }
  function drawLying(f, flash) {
    const r = f.rig, dir = -f.face;
    const gx = Math.round(f.x), gy = Math.round(f.y - f.z);
    const tor = r.p.torsoLie, head = r.p.headLie;
    const tx = gx - Math.round(tor.w / 2), ty = gy - tor.h;
    g.line(gx - dir * 2, gy - 3, gx - dir * 12, gy - 2, C.ink, r.thick[1] + 2);
    g.line(gx - dir * 2, gy - 3, gx - dir * 12, gy - 2, r.col[3], r.thick[1]);
    g.spr(r.shoe, gx - dir * 13 - 3, gy - 5, { flip: dir > 0, color: flash });
    g.spr(tor, tx, ty, { flip: dir > 0, color: flash });
    g.spr(head, dir > 0 ? tx + tor.w - 2 : tx - head.w + 2, gy - head.h, { flip: dir > 0, color: flash });
    g.line(gx, gy - tor.h + 1, gx + dir * 4, gy - tor.h - 4, C.ink, r.thick[0] + 2);
    g.line(gx, gy - tor.h + 1, gx + dir * 4, gy - tor.h - 4, r.col[0], r.thick[0]);
  }
  function setPose(f, dt, name, override) {
    const tp = POSES[name] || POSES.guard;
    const k = P.poseBlend <= 0 ? 1 : smoothK(dt, P.poseBlend);
    for (const key of ANGLE_KEYS) f.pose[key] += angDiff(f.pose[key], tp[key]) * k;
    f.pose.lean += (tp.lean - f.pose.lean) * k; f.pose.hip += (tp.hip - f.pose.hip) * k;
    f.pose.head = tp.head;
    if (override) Object.assign(f.pose, override);
  }
  function walkPose(f, dt, run) {
    const ph = f.t * (run ? 14 : 9), s = Math.sin(ph), c = Math.cos(ph), sw = run ? 38 : 24;
    setPose(f, dt, f === pl && pl.chair ? 'chair' : 'guard');
    Object.assign(f.pose, { ft: 90 - s * sw, fs: 95 - Math.max(0, -s) * 50 + (run ? 10 : 0), bt: 90 + s * sw, bs: 95 - Math.max(0, s) * 50 + (run ? 10 : 0), hip: Math.abs(c) * (run ? -2 : -1) + 1, lean: run ? 3 : 1 });
    if (run && !(f === pl && pl.chair)) Object.assign(f.pose, { fu: 110 + s * 50, fl: 60 + s * 30, bu: 110 - s * 50, bl: 60 - s * 30 });
  }

  // ---------------- 玩家 ----------------
  function startMove(name) {
    const m = name === 'slide' && skill('slideLaunch') ? MOVES.slideUp : MOVES[name];
    const sc = 1 / P.atkSpeed;
    pl.atk = { name, m, f: 0, S: Math.max(0, Math.round(m.f[0] * sc)), A: Math.max(1, Math.round(m.f[1] * sc)), R: Math.max(0, Math.round(m.f[2] * sc)), hit: new Set(), queued: false };
    pl.state = pl.state === 'jump' || pl.state === 'grab' ? pl.state : 'attack';
    if (!m.air && name !== 'slide' && !m.knee) { pl.vx = pl.face * P.stepIn * (m.finisher ? 1.4 : 1); pl.vy = 0; }
    if (name === 'slide') { pl.vx = pl.face * Math.max(P.runSpeed, 160); pl.vy = 0; }
    if (name === 'spin') { pl.specialCD = P.specialCD * (skill('spinPlus') ? 0.5 : 1); sfx.spin(); }
    if (['jab1', 'jab2', 'cross', 'upper'].includes(name)) pl.chain = name;
  }
  function movePose(a) {
    const [pw, pa, pr] = a.m.poses;
    return a.f <= a.S ? pw : a.f <= a.S + a.A + (a.m.spin ? 0 : 2) ? pa : pr;
  }
  function tryGrab() {
    // 走進站著暈眩（硬直中）的敵人就會抓住
    if (pl.grab || pl.chair || pl.atk || pl.state !== 'walk' && pl.state !== 'idle') return;
    for (const e of enemies) {
      if (e.dead || e.state !== 'hurt' || e.def.boss || e.def.sprite || (e.def.heavy && !skill('throwPlus')) || e.kind === 'trainee') continue;
      if (Math.abs(e.y - pl.y) < 6 && Math.abs(e.x - pl.x) < 14 && sign(e.x - pl.x) === pl.face && Math.abs(pl.vx) > 10) {
        pl.grab = { e, t: 0, knees: 0 };
        pl.state = 'grab'; pl.vx = 0; pl.vy = 0;
        e.state = 'held'; e.face = -pl.face; e.atk = null; releaseToken(e);
        sfx.grab();
        return;
      }
    }
  }
  function doThrow(forward) {
    const gr = pl.grab, e = gr.e;
    pl.grab = null; pl.state = 'throwing'; pl.stateT = 0.3;
    const dir = forward ? pl.face : -pl.face;
    if (!forward) pl.face = -pl.face;
    e.state = 'air'; e.thrown = true; e.z = 20; e.vz = 150; e.vx = dir * 250; e.bounced = true; e.juggles = 99;
    e.x = pl.x + dir * 10;
    const dmg = Math.round(14 * (skill('throwPlus') ? 1.5 : 1) * atkMul());
    e.hp -= dmg; e.throwDmg = dmg;
    floats.add(e.x, e.y - 44, dmg, C.yellow, { small: false, outline: C.ink });
    shake.add(3, 200, dir, 0); sfx.hit(3, combo);
    addMeter(6);
  }
  function updatePlayer(dt) {
    pl.t += dt; pl.inv -= dt; pl.flash -= dt; pl.chainT -= dt; pl.specialCD -= dt; pl.tapT -= dt;
    const ax = input.axis();
    const mx = Math.abs(ax.x) > 0.3 ? sign(ax.x) : 0;
    for (const [act, d] of [['left', -1], ['right', 1]]) if (input.pressed(act)) { if (pl.tapDir === d && pl.tapT > 0) pl.running = true; pl.tapDir = d; pl.tapT = P.doubleTap / 1000; }
    if (input.down('run') && mx) pl.running = true;
    if (!mx) pl.running = false;
    if (input.pressed('super') && pl.meter >= 100 && ['idle', 'walk', 'attack'].includes(pl.state)) { startSuper(); return; }
    const stt = pl.state;
    if (stt === 'super') { updateSuper(dt); return; }
    if (stt === 'hurt') {
      pl.stateT -= dt; pl.vx = approach(pl.vx, 0, 500 * dt);
      setPose(pl, dt, 'hurt');
      if (pl.stateT <= 0) pl.state = 'idle';
    } else if (stt === 'air' || stt === 'down' || stt === 'getup' || stt === 'dead') {
      updateFallen(pl, dt, true);
    } else if (stt === 'grab') {
      const gr = pl.grab;
      gr.t += dt;
      if (!gr.e || gr.e.dead) { pl.grab = null; pl.state = 'idle'; }
      else {
        gr.e.x = pl.x + pl.face * 11; gr.e.y = pl.y; gr.e.z = 0; setPose(gr.e, dt, 'held');
        if (pl.atk) {
          pl.atk.f++; setPose(pl, dt, movePose(pl.atk));
          if (pl.atk.f === pl.atk.S + 1) { hitEnemy(gr.e, pl.atk, pl.face, true); gr.knees++; }
          if (pl.atk.f >= pl.atk.S + pl.atk.A + pl.atk.R) pl.atk = null;
        } else {
          setPose(pl, dt, 'grab');
          if (input.pressed('jump') || (input.pressed('attack') && mx && mx !== pl.face) || gr.knees >= 3) doThrow(!(mx && mx !== pl.face) || gr.knees >= 3 && !(mx && mx !== pl.face));
          else if (input.pressed('attack')) startMove('knee');
          else if (gr.t > 2.2) { gr.e.state = 'hurt'; gr.e.stateT = 0.2; pl.grab = null; pl.state = 'idle'; }
        }
        if (pl.grab && gr.e.hp <= 0) { const e = gr.e; pl.grab = null; pl.state = 'idle'; e.dying = true; e.state = 'air'; e.z = 1; e.vz = 160; e.vx = pl.face * P.knock; }
      }
    } else if (stt === 'throwing') {
      pl.stateT -= dt; setPose(pl, dt, pl.stateT > 0.18 ? 'throwWind' : 'throw');
      if (pl.stateT <= 0) pl.state = 'idle';
    } else if (stt === 'jump') {
      pl.vx = approach(pl.vx, mx * (pl.running ? P.runSpeed : P.walkX) * speedMul(), P.accel * P.airControl * dt);
      pl.vy = approach(pl.vy, ax.y * P.walkZ, P.accel * P.airControl * dt);
      if (mx && !pl.atk) pl.face = mx;
      if (input.pressed('attack')) {
        // 空中連擊：飛踢出腿之後就能接空中拳（不必等飛踢收招）
        const kickOut = pl.atk && pl.atk.name === 'airKick' && pl.atk.f > pl.atk.S + 5;
        if (pl.chair && !pl.atk) { throwChair(); }
        else if (pl.airAttacks === 0 && !pl.atk) { pl.airAttacks++; startMove('airKick'); }
        else if (pl.airAttacks === 1 && skill('airCombo') && (!pl.atk || kickOut)) { pl.airAttacks++; startMove('airPunch'); pl.vz = Math.max(pl.vz, 90); }
      }
      if (pl.atk) { pl.atk.f++; setPose(pl, dt, movePose(pl.atk)); if (pl.atk.f >= pl.atk.S + pl.atk.A + pl.atk.R) pl.atk = null; }
      else setPose(pl, dt, 'jump');
    } else if (stt === 'attack') {
      const a = pl.atk;
      a.f++;
      if (a.f === a.S + 1 && !a.m.spin) sfx.whiff();
      if (input.pressed('attack')) a.queued = true;
      setPose(pl, dt, movePose(a));
      if (a.m.spin && a.f > a.S && a.f <= a.S + a.A) pl.face = Math.floor((a.f - a.S) / 4) % 2 ? -pl.spinFace : pl.spinFace;
      const fric = a.name === 'slide' ? 420 : 620;
      pl.vx = approach(pl.vx, 0, fric * dt); pl.vy = approach(pl.vy, 0, fric * dt);
      const end = a.S + a.A + a.R, cancelAt = a.S + a.A + Math.ceil(a.R * P.comboCancel);
      if (a.queued && a.m.next && a.f >= cancelAt) { if (mx) pl.face = mx; startMove(a.m.next); }
      else if (input.pressed('special') && pl.specialCD <= 0 && a.f >= a.S + a.A && !pl.chair) { pl.spinFace = pl.face; startMove('spin'); }
      else if (a.f >= end) {
        if (a.m.spin) pl.face = pl.spinFace;
        pl.atk = null; pl.state = 'idle'; pl.chainT = P.comboWindow / 1000;
        if (a.m.finisher) pl.chain = null;
        if (a.m.chair && pl.chair && --pl.chair.uses <= 0) { breakChairInHand(); }
      }
    } else { // idle / walk / run
      // 蓄力拳：按住攻擊
      if (skill('charge') && input.down('attack') && !pl.chair) {
        pl.charge += dt;
        if (pl.charge > 0.2 && Math.random() < 0.4) parts.add({ x: pl.x + pl.face * 6 + rand(-6, 6), y: pl.y - 22 + rand(-6, 6), vx: 0, vy: -20, life: 0.25, colors: pl.charge >= P.chargeTime ? [C.white, C.yellow] : [C.orange, C.red], shape: 'px' });
      }
      const releasedCharge = skill('charge') && !input.down('attack') && pl.charge >= P.chargeTime;
      if (!input.down('attack')) pl.charge = 0;
      if (releasedCharge) { startMove('power'); }
      else if (input.pressed('jump')) {
        pl.state = 'jump'; pl.vz = P.jumpV; pl.airAttacks = 0; sfx.jump();
        parts.burst(pl.x, pl.y, 5, { dir: -Math.PI / 2, spread: 2.6, speed: [15, 50], colors: [C.gray, C.purple], shape: 'sq', size: 2, life: [0.2, 0.35] });
      } else if (input.pressed('special') && pl.specialCD <= 0 && !pl.chair) { pl.spinFace = pl.face; startMove('spin'); }
      else if (input.pressed('attack')) {
        if (mx) pl.face = mx;
        const item = !pl.chair && props.find(p => p.kind === 'chair' && !p.taken && Math.abs(p.x - pl.x) < 14 && Math.abs(p.y - pl.y) < 8);
        if (item) { item.taken = true; pl.chair = { uses: 4 }; sfx.pick(); setPose(pl, 1, 'chair'); }
        else if (pl.chair) startMove('chair');
        else if (pl.running) startMove('slide');
        else startMove(pl.chain && pl.chainT > 0 && MOVES[pl.chain].next ? MOVES[pl.chain].next : 'jab1');
      } else {
        const sp = (pl.running ? P.runSpeed : P.walkX) * speedMul();
        pl.vx = approach(pl.vx, mx * sp, P.accel * dt);
        pl.vy = approach(pl.vy, ax.y * P.walkZ * speedMul(), P.accel * dt);
        if (mx) pl.face = mx;
        const moving = Math.abs(pl.vx) > 5 || Math.abs(pl.vy) > 5;
        pl.state = moving ? 'walk' : 'idle';
        if (moving) walkPose(pl, dt, pl.running && Math.abs(pl.vx) > P.walkX);
        else setPose(pl, dt, pl.chair ? 'chair' : pl.charge > 0.2 ? 'powerWind' : Math.floor(time * 2.5) % 2 ? 'guard2' : 'guard');
        if (pl.running && moving && Math.random() < 0.3) parts.add({ x: pl.x - pl.face * 5, y: pl.y, vx: -pl.face * 20, vy: -10, life: 0.25, colors: [C.gray, C.purple], shape: 'sq', size: 2 });
        tryGrab();
      }
    }
    if (pl.state === 'air' || pl.state === 'down' || pl.state === 'getup' || pl.state === 'dead') { clampPlayer(); return; }
    pl.x += pl.vx * dt; pl.y += pl.vy * dt;
    if (pl.state === 'jump' || pl.z > 0) {
      pl.vz -= P.gravity * dt; pl.z += pl.vz * dt;
      if (pl.z <= 0 && pl.state === 'jump') {
        pl.z = 0; pl.vz = 0; pl.state = 'idle'; pl.atk = null;
        sfx.land(); parts.burst(pl.x, pl.y, 4, { dir: -Math.PI / 2, spread: 2.8, speed: [15, 40], colors: [C.gray, C.purple], shape: 'sq', size: 2, life: [0.2, 0.3] });
      }
    }
    clampPlayer();
  }
  function clampPlayer() {
    const lo = locked ? cam.x + 8 : 10, hi = locked ? cam.x + W - 8 : WW - 10;
    pl.x = clamp(pl.x, lo, hi); pl.y = clamp(pl.y, FLOOR_TOP, FLOOR_BOT);
  }
  function throwChair() {
    pl.chair = null;
    shots.push({ kind: 'chair', x: pl.x + pl.face * 8, y: pl.y, z: pl.z + 16, vx: pl.face * 240, vz: 40, life: 1.2, friendly: true, hit: new Set(), spin: 0 });
    sfx.whiff();
  }
  function breakChairInHand() {
    parts.burst(pl.x + pl.face * 14, pl.y - 20, 12, { speed: [40, 120], colors: [C.red, C.lpink, C.white], shape: 'sq', size: 2, life: [0.3, 0.6], gravity: 300 });
    pl.chair = null; sfx.brk();
  }
  function addMeter(v) { pl.meter = Math.min(100, pl.meter + v * meterMul()); }

  // ---------------- 必殺技「芒果冰暴風」 ----------------
  function startSuper() {
    pl.state = 'super'; pl.stateT = 0; pl.atk = null; pl.meter = 0; pl.inv = 3; pl.grab = null;
    superFx = { t: 0, hitDone: false };
    sfx.superStart();
    hooks.onSuper && hooks.onSuper();
  }
  function updateSuper(dt) {
    const s = superFx;
    s.t += dt;
    setPose(pl, dt, s.t < 0.6 ? 'superPose' : 'cheer');
    pl.z = Math.min(20, s.t * 40);
    if (Math.random() < 0.8) parts.add({ x: cam.x + rand(0, W), y: rand(-10, 40), vx: rand(-40, -10), vy: rand(80, 160), life: 1.4, colors: Math.random() < 0.5 ? [C.white, C.lcyan] : [C.yellow, C.orange], shape: 'sq', size: 2, bg: false });
    if (s.t > 0.9 && !s.hitDone) {
      s.hitDone = true;
      sfx.superHit(); shake.add(8, 700);
      impactT = 5 / 60;
      for (const e of enemies) {
        if (e.dead || e.kind === 'trainee' || e.x < cam.x - 10 || e.x > cam.x + W + 10) continue;
        const dmg = Math.round((e.def.boss ? 60 : 45) * atkMul());
        e.hp -= dmg; e.flash = 0.1;
        floats.add(e.x, e.y - e.z - 46, dmg, C.yellow, { small: false, outline: C.ink });
        stats.score += dmg * 10;
        if (!e.def.sprite) { e.state = 'air'; e.z = Math.max(e.z, 1); e.vz = 200; e.vx = sign(e.x - pl.x || 1) * 90; e.bounced = false; e.juggles = 99; releaseToken(e); e.atk = null; }
        if (e.hp <= 0) markDying(e, sign(e.x - pl.x || 1));
        parts.burst(e.x, e.y - 20, 16, { speed: [40, 160], colors: [C.yellow, C.orange, C.white, C.lcyan], shape: 'sq', size: 3, life: [0.4, 0.8] });
      }
    }
    if (s.t > 1.5) { pl.state = 'idle'; pl.z = 0; superFx = null; pl.inv = 0.5; }
  }

  // ---------------- 命中判定 ----------------
  function checkPlayerHits() {
    const a = pl.atk;
    if (!a || a.m.knee || a.f <= a.S || a.f > a.S + a.A) return;
    const m = a.m;
    for (const e of enemies) {
      if (e.dead || a.hit.has(e) || e.inv > 0 || e.state === 'held') continue;
      if (e.state === 'down' && !P.otg) continue;
      if (e.state === 'air' && e.juggles >= P.juggleLimit && !e.def.boss) continue;
      if (Math.abs(e.y - pl.y) > P.depthTol + (e.def.sprite ? 6 : 0)) continue;
      const rx = (e.x - pl.x) * (m.spin ? sign(e.x - pl.x) || 1 : pl.face);
      const r0 = m.reach[0] * P.reachMul, r1 = m.reach[1] * P.reachMul + e.bw - 6;
      if (m.spin ? Math.abs(e.x - pl.x) > r1 + 6 : (rx < r0 - 6 || rx > r1 + 6)) continue;
      const tall = e.def.sprite ? 60 : e.def.boss ? 40 : 30;
      const ez0 = e.state === 'down' ? e.z : e.z + 2, ez1 = e.state === 'down' ? e.z + 10 : e.z + tall;
      const az0 = pl.z + m.zr[0], az1 = pl.z + m.zr[1];
      if (az1 < ez0 || az0 > ez1) continue;
      a.hit.add(e);
      hitEnemy(e, a, m.spin ? (sign(e.x - pl.x) || 1) : pl.face);
    }
    for (const p of props) {
      if (p.broken || p.kind === 'chair' || a.hit.has(p)) continue;
      if (Math.abs(p.y - pl.y) > P.depthTol + 4) continue;
      const rx = (p.x - pl.x) * pl.face;
      if (rx < -6 || rx > m.reach[1] * P.reachMul + 8) continue;
      a.hit.add(p); hitProp(p, m.dmg * 2);
    }
  }
  function hitProp(p, dmg) {
    p.hp -= dmg; p.flash = 0.08;
    shake.add(1.5, 100); sfx.hit(1, combo);
    parts.burst(p.x, p.y - 10, 5, { speed: [30, 90], colors: p.kind === 'crate' ? [C.wood, C.yellow] : [C.gray, C.white], shape: 'sq', size: 2, life: [0.2, 0.4], gravity: 200 });
    if (p.hp <= 0) {
      p.broken = true; sfx.brk();
      parts.burst(p.x, p.y - 10, 16, { speed: [40, 150], colors: p.kind === 'crate' ? [C.wood, C.yellow, C.orange] : [C.gray, C.white, C.purple], shape: 'sq', size: 3, life: [0.4, 0.8], gravity: 350 });
      const r = Math.random();
      if (r < 0.45) dropFood(p.x, p.y, Math.random() < 0.3 ? 'chicken' : pick(['candy', 'mango', 'tea']));
      dropCoins(p.x, p.y, 3 + Math.floor(rand(0, 4)));
    }
  }
  function dropFood(x, y, kind) { pickups.push({ kind: 'food', food: kind, x, y, z: 10, vz: 120, t: 0 }); }
  function dropCoins(x, y, n) { for (let i = 0; i < n; i++) pickups.push({ kind: 'coin', x: x + rand(-8, 8), y: clamp(y + rand(-6, 6), FLOOR_TOP, FLOOR_BOT), z: 8, vz: rand(80, 150), vx: rand(-40, 40), t: 0 }); }
  function hitEnemy(e, a, dir, fromGrab) {
    const m = a.m;
    combo++; comboT = 2.2; lastHit = time; bestCombo = Math.max(bestCombo, combo);
    target = e;
    const dmg = Math.round(m.dmg * atkMul());
    e.hp -= dmg;
    e.flash = P.flashFrames / 60;
    stats.score += dmg * 10 + combo * 5;
    addMeter(m.finisher ? 5 : 3);
    const armoredBear = e.kind === 'bear' && P.superArmor && (e.state === 'wind' || e.state === 'attack');
    const bossArmor = e.def.boss && (e.armor || e.def.sprite);
    const armored = (armoredBear || bossArmor) && !(m.breaker && !e.def.sprite);
    const air = e.state === 'air' || e.z > 1;
    if (fromGrab) { e.state = 'held'; }
    else if (e.def.sprite) { e.hurtT = 0.12; }
    else if (armored && e.hp > 0) {
      e.vx += dir * 15;
      if (sound.throttle('armor', 0.3)) floats.add(e.x, e.y - e.z - 50, 'ARMOR', C.lcyan, { outline: C.ink });
    } else if (air) {
      e.juggles++;
      e.vz = Math.max(e.vz, m.launch ? P.launch * m.launch * 0.8 : P.juggleLift);
      e.vx = dir * (m.launch ? 40 : 25);
      e.state = 'air'; e.bounced = false;
    } else if (m.launch && !(e.def.boss && e.hp > e.maxHp * 0.02)) {
      e.state = 'air'; e.z = Math.max(e.z, 1); e.vz = P.launch * m.launch; e.vx = dir * 45; e.juggles = 0; e.bounced = false;
    } else if (m.knockdown && !e.def.boss) {
      e.state = 'air'; e.z = Math.max(e.z, 1); e.vz = 150; e.vx = dir * P.knock; e.juggles = P.juggleLimit; e.bounced = false;
    } else if (e.def.boss) {
      e.hurtT = 0.15; e.vx += dir * 20;
      if (m.finisher || m.breaker) { e.stagger = (e.stagger || 0) + 1; if (e.stagger >= (e.rage ? 5 : 3)) { e.stagger = 0; e.state = 'hurt'; e.stateT = 0.5; e.atk = null; } }
    } else {
      e.state = 'hurt'; e.stateT = P.hitstun / 1000; e.vx = dir * P.push * (m.push || 1) / e.def.weight; e.atk = null;
    }
    if (!armored && !e.def.boss && !fromGrab) { e.face = -dir; releaseToken(e); if (e.state !== 'hurt') e.atk = null; }
    if (e.kind === 'trainee' && e.hp < 1000) e.hp = e.maxHp;
    const fin = !!m.finisher;
    const stop = (fin ? P.hitstopFinisher : P.hitstop) + clamp(P.hitstopGrowth * (combo - 1), -40, 60);
    hitstop = Math.max(hitstop, Math.max(0, stop) / 1000);
    e.shakeT = hitstop;
    shake.add(fin ? P.shakeFinisher : P.shake, fin ? 280 : 140, dir, fin && m.launch ? -1 : 0);
    if (fin && P.impactFrame && !hudOff && (m.launch || m.breaker)) impactT = 3 / 60;
    const hx = e.x - dir * (e.bw - 1);
    const hy = e.y - e.z - clamp(pl.z - e.z + (m.zr[0] + m.zr[1]) / 2, 4, e.state === 'down' ? 8 : e.def.sprite ? 40 : 26);
    const sz = P.sparkSize;
    if (sz > 0) {
      parts.add({ x: hx, y: hy, shape: 'star', size: Math.round((fin ? 9 : 5) * sz), life: fin ? 0.14 : 0.09, colors: [C.white, C.yellow] });
      parts.burst(hx, hy, Math.round((fin ? 12 : 7) * sz), { dir: dir > 0 ? 0 : Math.PI, spread: 2.2, speed: [80, 220], colors: [C.white, C.lcyan, C.cyan], shape: 'line', len: 0.03, life: [0.1, 0.22], drag: 6 });
      parts.burst(hx, hy, Math.round(5 * sz), { speed: [30, 90], colors: [C.yellow, C.pink, C.orange], shape: 'sq', size: 2, life: [0.2, 0.4], gravity: 150 });
      if (fin) parts.add({ x: hx, y: hy, shape: 'ring', r0: 4, r1: 26, life: 0.25, colors: [C.white, C.pink, C.plum] });
    }
    if (P.damageNumbers) floats.add(e.x + rand(-6, 6), e.y - e.z - 40 - (combo % 3) * 4 - (e.def.sprite ? 24 : 0), dmg, fin ? C.yellow : C.white, { small: !fin, outline: C.ink });
    sfx.hit(m.sound, combo);
    if (!['bear', 'panda', 'bubbleTea', 'clawMachine'].includes(e.kind)) sfx.squeak();
    for (const [n, t, i] of [[5, 'NICE', 0], [10, 'GREAT', 1], [20, 'AWESOME', 2], [35, 'WILD!', 3], [50, 'LEGEND!', 3]]) if (combo === n) { rankText = { t, age: 0 }; sfx.rank(i); }
    if (e.hp <= 0) markDying(e, dir);
  }
  /** 體力歸零：一般敵人被打飛後消失；看板守護者進入爆炸演出 */
  function markDying(e, dir = 1) {
    if (e.dying || e.kind === 'trainee') return;
    e.dying = true;
    if (e.def.sprite) { e.state = 'dying'; e.stateT = 0; }
    else if (e.state !== 'air' && e.state !== 'held') { e.state = 'air'; e.z = Math.max(e.z, 1); e.vz = 160; e.vx = dir * P.knock; e.bounced = false; }
  }

  // ---------------- 敵人 ----------------
  function releaseToken(e) { e.token = false; }
  function tokensInUse() { return enemies.filter(x => x.token && !x.dead).length; }
  function updateFallen(f, dt, isPlayer) {
    if (f.state === 'air') {
      f.vz -= (isPlayer ? P.gravity : P.juggleGravity) * dt; f.z += f.vz * dt;
      f.x += f.vx * dt; f.vx = approach(f.vx, 0, 30 * dt);
      setPose(f, dt, 'air');
      if (f.thrown) { // 被丟出去的敵人撞倒其他人
        for (const o of enemies) {
          if (o === f || o.dead || o.state === 'air' || o.state === 'down' || o.state === 'dying' || o.def.sprite && !o.def.boss) continue;
          if (Math.abs(o.x - f.x) < 14 + (o.bw || 6) && Math.abs(o.y - f.y) < 10) {
            f.thrown = false;
            const dmg = Math.round(12 * atkMul());
            o.hp -= dmg; o.flash = 0.08; stats.score += dmg * 10;
            floats.add(o.x, o.y - 44, dmg, C.yellow, { outline: C.ink });
            if (!o.def.boss) { o.state = 'air'; o.z = 1; o.vz = 150; o.vx = sign(f.vx) * 120; o.juggles = 99; o.bounced = false; releaseToken(o); }
            else o.hurtT = 0.2;
            if (o.hp <= 0) markDying(o, sign(f.vx || 1));
            shake.add(3, 200); sfx.hit(3, combo);
            break;
          }
        }
      }
      if (f.z <= 0 && f.vz < 0) {
        f.z = 0;
        if (!f.bounced) { f.bounced = true; f.vz = 95; f.z = 0.5; f.vx *= 0.5; sfx.thud(); shake.add(1.5, 100); parts.burst(f.x, f.y, 8, { dir: -Math.PI / 2, spread: 2.8, speed: [20, 70], colors: [C.gray, C.purple, C.navy], shape: 'sq', size: 2, life: [0.25, 0.45] }); }
        else {
          if (f.thrown) { f.thrown = false; sfx.thud(); shake.add(2.5, 150); parts.burst(f.x, f.y, 10, { dir: -Math.PI / 2, spread: 2.8, speed: [20, 70], colors: [C.gray, C.purple], shape: 'sq', size: 2, life: [0.25, 0.45] }); }
          f.state = 'down'; f.stateT = isPlayer ? (pl.hp <= 0 ? 99 : 0.6) : P.downTime; f.vx = 0; f.vz = 0; sfx.land();
        }
      }
    } else if (f.state === 'down') {
      f.stateT -= dt;
      if (isPlayer && pl.hp <= 0) { f.state = 'dead'; return; }
      if (f.stateT <= 0) {
        if (f.dying) { f.state = 'dead'; f.stateT = 0.9; }
        else { f.state = 'getup'; f.stateT = 0.3; f.inv = Math.max(f.inv, isPlayer ? P.iframes / 1000 : 0.35); }
      }
    } else if (f.state === 'getup') {
      f.stateT -= dt; setPose(f, dt, 'getup');
      if (f.stateT <= 0) { f.state = 'idle'; f.juggles = 0; f.bounced = false; setPose(f, 1, 'guard'); }
    }
  }
  function updateEnemy(e, dt) {
    e.t += dt; e.flash -= dt; e.inv -= dt; e.cd -= dt;
    if (e.hurtT > 0) e.hurtT -= dt;
    if (e.state === 'dead') { e.stateT -= dt; if (e.stateT <= 0) killEnemy(e); return; }
    if (e.def.sprite) { SPRITE_BOSS[e.kind](e, dt); return; }
    if (e.state === 'held') return;
    if (e.state === 'air' || e.state === 'down' || e.state === 'getup') { updateFallen(e, dt, false); e.x = clamp(e.x, cam.x - 30, cam.x + W + 30); e.x = clamp(e.x, 8, WW - 8); return; }
    if (e.def.boss) { RIG_BOSS[e.kind](e, dt); e.x += e.vx * dt; e.y += e.vy * dt; e.x = clamp(e.x, cam.x + 12, cam.x + W - 12); e.y = clamp(e.y, FLOOR_TOP, FLOOR_BOT); return; }
    const d = e.def, spd = (d.speed || 0) * P.enemySpeed;
    const dx = pl.x - e.x, dy = pl.y - e.y;
    const plDown = pl.state === 'down' || pl.state === 'dead' || pl.state === 'super';
    if (e.state === 'hurt') {
      e.stateT -= dt; e.vx = approach(e.vx, 0, 700 * dt); setPose(e, dt, 'hurt');
      if (e.stateT <= 0) { e.state = 'idle'; e.cd = Math.max(e.cd, 0.3); }
    } else if (e.state === 'wind') {
      e.stateT -= dt; e.vx = approach(e.vx, 0, 600 * dt); e.vy = 0;
      setPose(e, dt, e.kind === 'bear' ? 'slamWind' : e.kind === 'dog' ? 'throwWind' : e.kind === 'cat' ? 'getup' : 'wind');
      if (e.stateT <= 0) {
        if (d.thrower) {
          e.state = 'recover'; e.stateT = 0.5;
          const t = 0.7;
          shots.push({ kind: 'can', x: e.x + e.face * 8, y: e.y, z: 26, vx: (pl.x - e.x) / t, vy: (pl.y - e.y) / t, vz: 150, life: 2, friendly: false, owner: e });
          setPose(e, 1, 'throw');
        } else if (d.leaper) {
          e.state = 'leap'; e.vz = 200; e.z = 1; e.vx = e.face * 190; e.hitDone = false; sfx.jump();
        } else { e.state = 'attack'; e.stateT = e.kind === 'bear' ? 0.22 : 0.12; e.hitDone = false; e.vx = e.face * (e.kind === 'bear' ? 70 : 90); }
      }
    } else if (e.state === 'leap') {
      e.vz -= 700 * dt; e.z += e.vz * dt; e.x += 0;
      setPose(e, dt, 'jumpKick');
      if (!e.hitDone) enemyHitCheck(e, true);
      if (e.z <= 0) { e.z = 0; e.state = 'recover'; e.stateT = 0.6; e.vx = 0; sfx.land(); }
    } else if (e.state === 'attack') {
      e.stateT -= dt; e.vx = approach(e.vx, 0, 500 * dt);
      setPose(e, dt, e.kind === 'bear' ? 'slam' : 'punch');
      if (!e.hitDone) enemyHitCheck(e);
      if (e.stateT <= 0) { e.state = 'recover'; e.stateT = e.kind === 'bear' ? 0.6 : 0.35; }
    } else if (e.state === 'recover') {
      e.stateT -= dt; e.vx = approach(e.vx, 0, 600 * dt); setPose(e, dt, 'guard');
      if (e.stateT <= 0) { e.state = 'idle'; e.cd = rand(0.6, 1.4); releaseToken(e); }
    } else if (e.kind === 'trainee') {
      setPose(e, dt, Math.floor(e.t * 2) % 2 ? 'guard2' : 'guard'); e.vx = approach(e.vx, 0, 400 * dt);
      e.face = sign(dx) || e.face;
    } else {
      let side = e.x < pl.x ? -1 : 1;
      const want = d.thrower ? 110 : d.leaper && !e.token ? 80 : e.token ? 22 : 58;
      // 戰鬥區鎖定時，站位目標要留在畫面內（放不下就換到另一側）
      const lo = cam.x + 14, hi = cam.x + W - 14;
      if (locked) { const t0 = pl.x + side * want, alt = pl.x - side * want; if ((t0 < lo || t0 > hi) && alt >= lo && alt <= hi) side = -side; }
      const tx = locked ? clamp(pl.x + side * want, lo, hi) : pl.x + side * want, ty = pl.y + (e.token ? 0 : (e.t % 6 < 3 ? -10 : 10));
      const ddx = tx - e.x, ddy = ty - e.y;
      const moving = P.enemyAggro && (Math.abs(ddx) > 3 || Math.abs(ddy) > 2);
      e.vx = approach(e.vx, moving ? sign(ddx) * spd * (Math.abs(ddx) > 3 ? 1 : 0) : 0, 600 * dt);
      e.vy = approach(e.vy, moving ? sign(ddy) * spd * 0.6 * (Math.abs(ddy) > 2 ? 1 : 0) : 0, 600 * dt);
      e.face = sign(dx) || e.face;
      if (Math.abs(e.vx) > 5 || Math.abs(e.vy) > 5) walkPose(e, dt, d.leaper); else setPose(e, dt, Math.floor(e.t * 2) % 2 ? 'guard2' : 'guard');
      if (P.enemyAggro && !e.token && e.cd <= 0 && tokensInUse() < P.attackTokens && !plDown) e.token = true;
      if (e.token && e.cd <= 0 && pl.z < 10 && !plDown) {
        const ok = d.thrower ? Math.abs(Math.abs(dx) - want) < 30 && Math.abs(dy) < 30 : d.leaper ? Math.abs(Math.abs(dx) - 80) < 20 && Math.abs(dy) < 5 : Math.abs(Math.abs(dx) - 22) < 8 && Math.abs(dy) < 5;
        if (ok) { e.state = 'wind'; e.stateT = d.windT / P.enemySpeed; sfx.wind(); floats.add(e.x, e.y - 46, '!', C.yellow, { small: false, outline: C.ink, life: 0.4, vy: -15 }); }
      }
      if (snack() === 'tofu' && Math.abs(dx) < 26 && Math.abs(dy) < 8 && (e.tofuT = (e.tofuT || 0) - dt) <= 0) { e.tofuT = 0.5; e.hp -= 2; e.flash = 0.04; parts.add({ x: e.x, y: e.y - 30, vx: 0, vy: -20, life: 0.5, colors: [C.gray, C.purple], shape: 'sq', size: 2 }); if (e.hp <= 0) { e.dying = true; e.state = 'air'; e.z = 1; e.vz = 120; e.vx = -side * 60; } }
    }
    e.x += e.vx * dt; e.y += e.vy * dt;
    e.x = clamp(e.x, 8, WW - 8); e.y = clamp(e.y, FLOOR_TOP, FLOOR_BOT);
    if (locked) { if (e.x > cam.x + 6 && e.x < cam.x + W - 6) e.entered = true; if (e.entered) e.x = clamp(e.x, cam.x + 6, cam.x + W - 6); }
  }
  function enemyHitCheck(e, leap) {
    if (pl.inv > 0 || ['down', 'getup', 'air', 'dead', 'super'].includes(pl.state)) return;
    const d = e.def;
    const rx = (pl.x - e.x) * e.face;
    if (rx < (d.reach || [0, 20])[0] - 5 || rx > (d.reach || [0, 20])[1] + 6 + (e.bw - 6) || Math.abs(pl.y - e.y) > 8 || Math.abs(pl.z - e.z) > 24) return;
    e.hitDone = true;
    damagePlayer(d.dmg || 8, e.face, d.heavy || leap);
  }
  function damagePlayer(dmg, dir, knockdown) {
    if (pl.inv > 0 || ['down', 'getup', 'air', 'dead', 'super'].includes(pl.state) || finale) return;
    dmg = Math.round(dmg * P.enemyDamage);
    if (!P.godMode) pl.hp -= dmg;
    stats.dmgTaken += dmg;
    pl.flash = 0.08; combo = 0; pl.atk = null; pl.chain = null; pl.charge = 0;
    if (pl.grab) { pl.grab.e.state = 'hurt'; pl.grab.e.stateT = 0.3; pl.grab = null; }
    if (pl.chair && Math.random() < 0.5) { const c = pl.chair; pl.chair = null; props.push({ kind: 'chair', x: pl.x - dir * 10, y: pl.y, hp: 1, flash: 0, broken: false, taken: false }); }
    hitstop = Math.max(hitstop, 0.07);
    shake.add(knockdown ? 4 : 2.5, 200, dir, 0);
    parts.add({ x: pl.x - dir * 3, y: pl.y - 22, shape: 'star', size: 5, life: 0.1, colors: [C.white, C.red] });
    parts.burst(pl.x, pl.y - 20, 8, { speed: [40, 120], colors: [C.white, C.red, C.pink], shape: 'sq', size: 2, life: [0.2, 0.4] });
    sfx.hurt();
    addMeter(4);
    if (knockdown || pl.hp <= 0) { pl.state = 'air'; pl.z = 1; pl.vz = 170; pl.vx = dir * 110; pl.bounced = false; pl.inv = 0; }
    else { pl.state = 'hurt'; pl.stateT = 0.3; pl.vx = dir * 90; pl.inv = 0.25; }
    if (pl.hp <= 0) { pl.hp = 0; }
  }
  function killEnemy(e) {
    e.dead = true;
    stats.kills++;
    stats.score += e.def.score || 0;
    if (!e.def.boss && e.kind !== 'plush') {
      if (Math.random() < 0.18) dropFood(e.x, e.y, Math.random() < 0.25 ? 'chicken' : pick(['candy', 'mango', 'tea']));
      dropCoins(e.x, e.y, 2 + Math.floor(rand(0, 3)));
    }
  }

  // ---------------- 守護者（骨架型：兔兔老大、熊貓大仙） ----------------
  function bossRage(b) {
    if (!b.rage && b.hp <= b.maxHp / 2) {
      b.rage = true; sfx.roar(); shake.add(4, 500);
      floats.add(b.x, b.y - 70, 'RAGE', C.red, { small: false, outline: C.ink, life: 1.2 });
      parts.add({ x: b.x, y: b.y - 30, shape: 'ring', r0: 6, r1: 60, life: 0.6, colors: [C.white, C.red, C.pink] });
      if (b.kind === 'bunnyBoss' || b.kind === 'panda') for (let i = 0; i < 2; i++) spawnEnemy(b.kind === 'panda' ? pick(['rabbit', 'cat', 'bear']) : 'rabbit', i ? 1 : -1);
    }
  }
  const RIG_BOSS = {
    bunnyBoss(b, dt) { rigBossAI(b, dt, { speed: 52, combo: 3, dmg: 14 }); },
    panda(b, dt) { rigBossAI(b, dt, { speed: 56, combo: 4, dmg: 16 }); },
  };
  function rigBossAI(b, dt, o) {
    bossRage(b);
    const dx = pl.x - b.x, dy = pl.y - b.y;
    const spd = o.speed * (b.rage ? 1.3 : 1) * P.enemySpeed;
    b.stateT -= dt;
    b.armor = b.rage && b.kind === 'panda' ? b.state !== 'dizzy' : ['combo', 'rush', 'slamUp', 'slamDown'].includes(b.state);
    const plDown = ['down', 'dead', 'super'].includes(pl.state);
    switch (b.state) {
      case 'intro': setPose(b, dt, 'cheer'); b.vx = 0; if (b.stateT <= 0) { b.state = 'idle'; b.stateT = 0.6; } break;
      case 'hurt': setPose(b, dt, 'hurt'); b.vx = approach(b.vx, 0, 500 * dt); if (b.stateT <= 0) { b.state = 'idle'; b.stateT = 0.3; } break;
      case 'dizzy': setPose(b, dt, 'hurt'); b.vx = 0; if (b.stateT <= 0) { b.state = 'idle'; b.stateT = 0.4; } break;
      case 'idle': case 'walk': {
        b.face = sign(dx) || b.face;
        const want = 26;
        const tx = pl.x - sign(dx || 1) * want;
        b.vx = approach(b.vx, Math.abs(tx - b.x) > 4 ? sign(tx - b.x) * spd : 0, 500 * dt);
        b.vy = approach(b.vy, Math.abs(dy) > 3 ? sign(dy) * spd * 0.6 : 0, 500 * dt);
        if (Math.abs(b.vx) > 5 || Math.abs(b.vy) > 5) walkPose(b, dt, false); else setPose(b, dt, 'guard');
        if (b.stateT <= 0 && !plDown) {
          const close = Math.abs(Math.abs(dx) - want) < 14 && Math.abs(dy) < 8;
          const choice = close ? pick(['combo', 'combo', 'slam']) : pick(['rush', 'slam', 'walk']);
          if (choice === 'walk') { b.stateT = 0.5; break; }
          b.state = choice === 'combo' ? 'comboWind' : choice === 'rush' ? 'rushWind' : 'slamWind';
          b.stateT = (choice === 'rush' ? 0.6 : 0.45) / (b.rage ? 1.3 : 1); b.vx = 0; b.vy = 0; b.hits = 0;
          sfx.wind(); floats.add(b.x, b.y - 70, '!', C.red, { small: false, outline: C.ink, life: 0.4, vy: -15 });
        }
        break;
      }
      case 'comboWind': setPose(b, dt, 'wind'); if (b.stateT <= 0) { b.state = 'combo'; b.stateT = 0.16; b.hitDone = false; b.vx = b.face * 90; } break;
      case 'combo':
        setPose(b, dt, b.hits % 2 ? 'cross' : 'punch'); b.vx = approach(b.vx, 0, 500 * dt);
        if (!b.hitDone) { const rx = (pl.x - b.x) * b.face; if (rx > -4 && rx < 34 && Math.abs(pl.y - b.y) < 9 && pl.z < 30) { b.hitDone = true; damagePlayer(o.dmg, b.face, b.hits === o.combo - 1); } }
        if (b.stateT <= 0) { b.hits++; if (b.hits < o.combo) { b.stateT = 0.16; b.hitDone = false; b.vx = b.face * 90; b.face = sign(pl.x - b.x) || b.face; } else { b.state = 'recover'; b.stateT = 0.7; } }
        break;
      case 'rushWind': setPose(b, dt, 'powerWind'); b.face = sign(dx) || b.face; b.vy = approach(b.vy, sign(dy) * 30, 300 * dt); if (b.stateT <= 0) { b.state = 'rush'; b.stateT = 0.7; b.hitDone = false; } break;
      case 'rush':
        setPose(b, dt, 'power'); b.vx = b.face * (b.rage ? 300 : 240); b.vy = 0;
        if (Math.random() < 0.6) parts.add({ x: b.x - b.face * 10, y: b.y - rand(4, 30), vx: -b.face * 60, vy: 0, life: 0.2, colors: [C.white, C.gray], shape: 'line', len: 0.05 });
        if (!b.hitDone) { const rx = (pl.x - b.x) * b.face; if (rx > -6 && rx < 26 && Math.abs(pl.y - b.y) < 10 && pl.z < 24) { b.hitDone = true; damagePlayer(o.dmg + 4, b.face, true); } }
        if (b.stateT <= 0 || b.x < cam.x + 20 || b.x > cam.x + W - 20) { b.state = 'dizzy'; b.stateT = b.rage ? 0.7 : 1.1; b.vx = 0; shake.add(2, 150); }
        break;
      case 'slamWind': setPose(b, dt, 'slamWind'); if (b.stateT <= 0) { b.state = 'slamUp'; b.vz = 320; b.z = 1; b.tx = pl.x; b.ty = pl.y; } break;
      case 'slamUp':
        b.vz -= 900 * dt; b.z += b.vz * dt; b.x += (b.tx - b.x) * smoothK(dt, 0.2); b.y += (b.ty - b.y) * smoothK(dt, 0.2); b.vx = 0; b.vy = 0;
        setPose(b, dt, 'jump');
        if (b.z <= 0 && b.vz < 0) {
          b.z = 0; b.state = 'recover'; b.stateT = 0.8;
          sfx.thud(); shake.add(6, 400, 0, 1);
          shots.push({ kind: 'shock', x: b.x, y: b.y, r: 6, max: 90, t: 0, life: 0.45, hit: false });
          parts.burst(b.x, b.y, 20, { dir: -Math.PI / 2, spread: 2.8, speed: [30, 120], colors: [C.gray, C.purple, C.white], shape: 'sq', size: 2, life: [0.3, 0.6], gravity: 300 });
        }
        break;
      case 'recover': setPose(b, dt, 'guard'); b.vx = approach(b.vx, 0, 500 * dt); if (b.stateT <= 0) { b.state = 'idle'; b.stateT = b.rage ? 0.35 : 0.7; } break;
    }
  }

  // ---------------- 守護者（圖像型：珍奶巨人、夾娃娃機大王） ----------------
  const SPRITE_BOSS = {
    bubbleTea(b, dt) {
      bossRage(b);
      b.stateT -= dt;
      if (b.state === 'dying') { b.stateT += dt * 2; if (Math.random() < 0.4) parts.burst(b.x + rand(-20, 20), b.y - rand(10, 60), 6, { speed: [30, 120], colors: [C.yellow, C.wood, C.white], shape: 'sq', size: 2, life: [0.3, 0.6] }); if (b.stateT > 1.8) { b.state = 'dead'; b.stateT = 0.3; } return; }
      const dx = pl.x - b.x, dy = pl.y - b.y;
      b.face = sign(dx) || b.face;
      switch (b.state) {
        case 'intro': b.z = Math.max(0, b.z - 200 * dt); if (b.stateT <= 0) { b.state = 'idle'; b.stateT = 0.8; } break;
        case 'idle':
          b.vx = approach(b.vx, Math.abs(dx) > 70 ? sign(dx) * 30 : 0, 200 * dt);
          b.vy = approach(b.vy, Math.abs(dy) > 4 ? sign(dy) * 20 : 0, 200 * dt);
          if (b.stateT <= 0) { b.state = pick(Math.abs(dx) < 50 && Math.abs(dy) < 10 ? ['straw', 'hop'] : ['pearls', 'pearls', 'hop']); b.stateT = 0; b.n = 0; b.vx = 0; b.vy = 0; }
          break;
        case 'pearls':
          b.open = true;
          if (b.stateT <= -0.4 && b.n < (b.rage ? 5 : 3)) { b.n++; b.stateT = -0.4 + 0.22; shots.push({ kind: 'pearl', x: b.x + b.face * 18, y: b.y + rand(-10, 10), z: 30, vx: b.face * rand(90, 130), vy: rand(-20, 20), vz: 60, life: 5, bounce: 0, friendly: false }); sound.tone({ type: 'square', f0: 300, f1: 150, dur: 0.06, vol: 0.06 }); }
          if (b.n >= (b.rage ? 5 : 3) && b.stateT < -1.2) { b.open = false; b.state = b.rage ? 'rain' : 'idle'; b.stateT = b.rage ? 0 : 1; }
          break;
        case 'rain':
          if (b.stateT <= 0) { b.stateT = 0.18; b.n++; shots.push({ kind: 'drop', x: clamp(pl.x + rand(-60, 60), cam.x + 10, cam.x + W - 10), y: clamp(pl.y + rand(-15, 15), FLOOR_TOP, FLOOR_BOT), z: 160, vz: 0, delay: 0.6, t: 0, life: 3, friendly: false }); }
          if (b.n > 14) { b.state = 'idle'; b.stateT = 1; }
          break;
        case 'straw':
          if (b.stateT <= -0.45 && !b.strawT) { b.strawT = 0.3; sfx.whiff(); }
          if (b.strawT > 0) {
            b.strawT -= dt;
            const rx = (pl.x - b.x) * b.face;
            if (!b.hitDone && rx > 10 && rx < 62 && Math.abs(pl.y - b.y) < 9 && pl.z < 40) { b.hitDone = true; damagePlayer(14, b.face, true); }
            if (b.strawT <= 0) { b.strawT = 0; b.hitDone = false; b.state = 'idle'; b.stateT = 1.1; }
          }
          break;
        case 'hop':
          if (b.stateT > -0.35) break;
          if (!b.air) { b.air = true; b.vz = 330; b.tx = pl.x; b.ty = pl.y; sfx.jump(); }
          b.vz -= 900 * dt; b.z += b.vz * dt;
          b.x += (b.tx - b.x) * smoothK(dt, 0.25); b.y += (b.ty - b.y) * smoothK(dt, 0.25);
          if (b.z <= 0 && b.vz < 0) {
            b.z = 0; b.air = false; sfx.thud(); shake.add(6, 400, 0, 1);
            shots.push({ kind: 'shock', x: b.x, y: b.y, r: 10, max: 100, t: 0, life: 0.5, hit: false });
            b.state = 'idle'; b.stateT = 1.2;
          }
          break;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.x = clamp(b.x, cam.x + 30, cam.x + W - 30); b.y = clamp(b.y, FLOOR_TOP + 2, FLOOR_BOT);
      // 身體接觸
      if (b.state !== 'intro' && b.z < 20 && Math.abs(pl.x - b.x) < 18 && Math.abs(pl.y - b.y) < 8 && pl.z < 30) damagePlayer(10, sign(pl.x - b.x) || 1, true);
    },
    clawMachine(b, dt) {
      bossRage(b);
      b.stateT -= dt;
      if (b.state === 'dying') { b.stateT += dt * 2; if (Math.random() < 0.4) parts.burst(b.x + rand(-24, 24), b.y - rand(10, 60), 6, { speed: [30, 120], colors: [C.lpink, C.lcyan, C.white], shape: 'sq', size: 2, life: [0.3, 0.6] }); if (b.stateT > 1.8) { b.state = 'dead'; b.stateT = 0.3; } return; }
      const dx = pl.x - b.x;
      b.y = FLOOR_TOP + 4;
      if (!b.claws) b.claws = [];
      switch (b.state) {
        case 'intro': if (b.stateT <= 0) { b.state = 'idle'; b.stateT = 1; } break;
        case 'idle':
          b.vx = approach(b.vx, Math.abs(dx) > 40 ? sign(dx) * (b.rage ? 45 : 30) : 0, 200 * dt);
          if (b.stateT <= 0) { b.state = pick(['claw', 'claw', 'plush', 'coins']); b.stateT = 0; b.vx = 0; }
          break;
        case 'claw':
          if (b.stateT < -dt * 0.5 && !b.clawStarted) {
            b.clawStarted = true;
            const n = b.rage ? 2 : 1;
            for (let i = 0; i < n; i++) b.claws.push({ x: pl.x + (i ? rand(-50, 50) : 0), y: pl.y, z: 150, state: 'track', t: 0, caught: false });
          }
          if (b.clawStarted && b.claws.length === 0) { b.clawStarted = false; b.state = 'idle'; b.stateT = 1.2; }
          break;
        case 'plush':
          if (b.stateT <= -0.5 && !b.thrown) {
            b.thrown = true;
            const n = b.rage ? 3 : 2;
            for (let i = 0; i < n && enemies.filter(e => e.kind === 'plush' && !e.dead).length < 5; i++) {
              const e = makeEnemy('plush', b.x + rand(-20, 20), clamp(b.y + 10 + rand(0, 30), FLOOR_TOP, FLOOR_BOT)); e.state = 'air'; e.z = 50; e.vz = 120; e.vx = rand(-80, 80); e.bounced = false; e.juggles = 99; enemies.push(e);
            }
            sfx.whiff();
          }
          if (b.stateT < -1.2) { b.thrown = false; b.state = 'idle'; b.stateT = 1; }
          break;
        case 'coins':
          if (b.stateT <= 0 && (b.n = (b.n || 0) + 1) <= (b.rage ? 10 : 6)) { b.stateT = 0.14; shots.push({ kind: 'token', x: b.x + rand(-20, 20), y: b.y + 6, z: 20, vx: rand(-60, 60), vy: rand(30, 60), vz: 80, life: 3, bounce: 0, friendly: false }); sound.tone({ type: 'pulse25', f0: 1600, dur: 0.04, vol: 0.04 }); }
          if (b.n > (b.rage ? 10 : 6)) { b.n = 0; b.state = 'idle'; b.stateT = 1; }
          break;
      }
      // 夾子
      for (const c of b.claws) {
        c.t += dt;
        if (c.state === 'track') { c.x += (pl.x - c.x) * smoothK(dt, 0.2); c.y += (pl.y - c.y) * smoothK(dt, 0.2); if (c.t > 1.1) { c.state = 'drop'; c.t = 0; } }
        else if (c.state === 'drop') {
          c.z = Math.max(0, c.z - 500 * dt);
          if (c.z <= 20 && !c.caught && Math.abs(pl.x - c.x) < 10 && Math.abs(pl.y - c.y) < 7 && pl.inv <= 0 && !['down', 'air', 'dead', 'super'].includes(pl.state)) { c.caught = true; pl.state = 'held'; pl.inv = 0; sfx.grab(); }
          if (c.z <= 0) { c.state = 'lift'; c.t = 0; if (!c.caught) { shake.add(2, 120); sfx.thud(); } }
        } else if (c.state === 'lift') {
          c.z += 160 * dt;
          if (c.caught) { pl.x = c.x; pl.y = c.y; pl.z = Math.max(0, c.z - 26); setPose(pl, dt, 'held'); }
          if (c.z > 90) {
            if (c.caught) { pl.state = 'air'; pl.z = Math.max(1, pl.z); pl.vz = 60; pl.vx = rand(-80, 80); pl.bounced = false; damagePlayer(0, 1, true); pl.hp -= P.godMode ? 0 : Math.round(16 * P.enemyDamage); stats.dmgTaken += 16; pl.state = 'air'; }
            c.done = true;
          }
        }
      }
      b.claws = b.claws.filter(c => !c.done);
      b.x += b.vx * dt;
      b.x = clamp(b.x, cam.x + 40, cam.x + W - 40);
    },
  };

  // ---------------- 飛行道具與收集品 ----------------
  function updateShots(dt) {
    for (const s of shots) {
      if (s.kind === 'shock') {
        s.t += dt; s.r = s.r + (s.max - s.r) * smoothK(dt, 0.08);
        if (!s.hit && Math.abs(pl.y - s.y) < 10 && Math.abs(Math.abs(pl.x - s.x) - s.r) < 10 && pl.z < 6) { s.hit = true; damagePlayer(12, sign(pl.x - s.x) || 1, true); }
        if (s.t > s.life) s.dead = true;
        continue;
      }
      if (s.kind === 'drop') {
        s.t += dt;
        if (s.t < s.delay) continue;
        s.vz -= 900 * dt; s.z += s.vz * dt;
        if (s.z <= 0) { s.dead = true; parts.burst(s.x, s.y, 8, { speed: [20, 80], colors: [C.navy, C.wood], shape: 'sq', size: 2, life: [0.2, 0.4] }); if (Math.abs(pl.x - s.x) < 10 && Math.abs(pl.y - s.y) < 7 && pl.z < 20) damagePlayer(10, sign(pl.x - s.x) || 1, false); }
        continue;
      }
      s.life -= dt;
      s.vz -= 700 * dt; s.z += s.vz * dt;
      s.x += s.vx * dt; s.y += (s.vy || 0) * dt;
      s.y = clamp(s.y, FLOOR_TOP, FLOOR_BOT);
      if (s.z <= 0) {
        if (s.kind === 'pearl' && s.bounce++ < 5) { s.z = 0; s.vz = 150; }
        else if (s.kind === 'token' && s.bounce++ < 2) { s.z = 0; s.vz = 80; }
        else { s.dead = true; if (s.kind === 'chair') parts.burst(s.x, s.y, 10, { speed: [30, 100], colors: [C.red, C.lpink], shape: 'sq', size: 2, life: [0.3, 0.5], gravity: 300 }); }
      }
      if (s.life <= 0 || s.x < cam.x - 60 || s.x > cam.x + W + 60) s.dead = true;
      if (s.dead) continue;
      if (s.friendly) {
        for (const e of enemies) {
          if (e.dead || s.hit.has(e) || e.state === 'down') continue;
          if (Math.abs(e.x - s.x) < 10 + e.bw && Math.abs(e.y - s.y) < 9 && s.z < e.z + 40) {
            s.hit.add(e);
            hitEnemy(e, { m: { dmg: 16, knockdown: true, finisher: true, zr: [0, 30], sound: 3 } }, sign(s.vx));
          }
        }
      } else if (Math.abs(pl.x - s.x) < 9 && Math.abs(pl.y - s.y) < 7 && Math.abs(pl.z - s.z + 12) < 18) {
        s.dead = true; damagePlayer(s.kind === 'can' ? 10 : s.kind === 'token' ? 6 : 9, sign(s.vx) || 1, false);
        parts.burst(s.x, s.y - s.z, 6, { speed: [20, 80], colors: [C.white, C.yellow], shape: 'sq', size: 2, life: [0.2, 0.3] });
      }
      // 打掉敵人丟來的東西
      if (!s.friendly && pl.atk && pl.atk.f > pl.atk.S && pl.atk.f <= pl.atk.S + pl.atk.A && Math.abs(pl.y - s.y) < 8 && (s.x - pl.x) * pl.face > -4 && (s.x - pl.x) * pl.face < 26 && s.z < 34) {
        s.dead = true; parts.add({ x: s.x, y: s.y - s.z, shape: 'star', size: 4, life: 0.1, colors: [C.white, C.yellow] }); sfx.hit(1, combo); addMeter(2);
      }
    }
    shots = shots.filter(s => !s.dead);
  }
  function updatePickups(dt) {
    for (const k of pickups) {
      k.t += dt;
      if (k.z > 0 || k.vz > 0) { k.vz -= 600 * dt; k.z += k.vz * dt; k.x += (k.vx || 0) * dt; if (k.z <= 0) { k.z = 0; k.vz = 0; k.vx = 0; } }
      if (pl.state === 'dead' || pl.state === 'down') continue;
      const near = Math.abs(k.x - pl.x) < 10 && Math.abs(k.y - pl.y) < 7;
      if (k.kind === 'coin' && near && k.t > 0.3) { k.done = true; env.addCoins(1); stats.coins++; sfx.coin(); }
      if (k.kind === 'food' && near && k.t > 0.4) {
        const heal = { chicken: 45, candy: 15, mango: 25, tea: 15 }[k.food];
        if (pl.hp < pl.maxHp || k.food === 'mango' || k.food === 'tea') {
          k.done = true; stats.food++;
          pl.hp = Math.min(pl.maxHp, pl.hp + heal);
          if (k.food === 'mango' || k.food === 'tea') addMeter(30);
          floats.add(k.x, k.y - 20, '+' + heal, C.lpink, { small: false, outline: C.ink });
          sfx.eat();
        }
      }
      if (k.t > 14) k.done = true;
    }
    pickups = pickups.filter(k => !k.done);
  }

  // ---------------- 戰鬥區與波次 ----------------
  function spawnEnemy(kind, side) {
    const x = side < 0 ? cam.x - 24 : cam.x + W + 24;
    const e = makeEnemy(kind, clamp(x, 10, WW - 10), rand(FLOOR_TOP + 4, FLOOR_BOT - 4));
    e.cd = rand(0.8, 1.6);
    if (kind === 'trainee') { e.x = cam.x + W / 2 + 60; e.y = 144; }
    enemies.push(e);
    return e;
  }
  function updateZones(dt) {
    if (finale) return;
    if (!locked) {
      if (goT > 0) goT -= dt;
      const next = st.zones[zoneIdx];
      if (next && pl.x > next.x - 40) {
        zone = { ...next }; locked = true; waveI = 0; spawnT = 0.4;
        spawnQ = [];
      } else if (!next && !boss && pl.x > st.bossX - 150) startBoss();
      return;
    }
    // 鏡頭鎖在戰鬥區
    if (boss) return;
    const alive = enemies.filter(e => !e.dead && e.kind !== 'trainee').length;
    if (spawnQ.length) {
      if ((spawnT -= dt) <= 0) { spawnEnemy(spawnQ.shift(), Math.random() < 0.5 ? -1 : 1); spawnT = 0.45; }
    } else if (alive === 0) {
      const trainee = enemies.find(e => e.kind === 'trainee' && !e.dead);
      if (waveI < zone.waves.length) {
        if (trainee && waveI > 0 && combo < 6 && !zone.skipTrainee) { zone.skipTrainee = time > 0 && pl.x > 0 && (zone.tt = (zone.tt || 0) + dt) > 8; if (!zone.skipTrainee) return; }
        if (trainee && waveI > 0) { trainee.dying = true; trainee.state = 'dead'; trainee.stateT = 0.5; }
        const wave = zone.waves[waveI++];
        for (const k of wave) { if (k === 'trainee') spawnEnemy('trainee', 1); else spawnQ.push(k); }
        spawnT = 0.3;
      } else {
        locked = false; zoneIdx++; goT = 3; sfx.go();
        if (snack() === 'chicken') { pl.hp = Math.min(pl.maxHp, pl.hp + 20); floats.add(pl.x, pl.y - 50, '+20', C.lpink, { small: false, outline: C.ink }); }
      }
    }
  }
  function startBoss() {
    locked = true;
    const k = st.boss;
    boss = makeEnemy(k, Math.min(WW - 60, st.bossX + 90), 146);
    boss.state = 'intro'; boss.stateT = 1.8;
    if (ENEMY[k].sprite) { boss.z = k === 'bubbleTea' ? 120 : 0; }
    if (k === 'clawMachine') { boss.x = st.bossX + 40; }
    enemies.push(boss);
    zone = { x: st.bossX, waves: [] };
    sfx.roar();
    hooks.onBossStart && hooks.onBossStart(st);
  }
  function updateFinale(dt) {
    finale.t += dt;
    if (finale.t > 3 && !ended) {
      ended = true;
      for (const k of pickups) if (k.kind === 'coin') { env.addCoins(1); stats.coins++; }
      pickups = [];
      hooks.onClear && hooks.onClear({ ...stats, bestCombo, time: stats.time, maxHp: pl.maxHp });
    }
  }

  // ---------------- 主更新 ----------------
  function update(dt) {
    time += dt;
    shake.update(dt);
    if (impactT > 0) impactT -= dt;
    if (tipT > 0) { tipT -= dt; if (tipT <= 0 && tipI < st.tips.length - 1) { tipI++; tipT = 5; } }
    if (hitstop > 0) { hitstop -= dt; return; }
    if (finale) { finale.slow = Math.max(0.25, 1 - finale.t); updateFinale(dt); dt *= finale.t < 1.2 ? 0.3 : 1; }
    if (!finale && pl.state !== 'dead') stats.time += dt;
    if (pl.state === 'dead') {
      deadT += dt;
      setPose(pl, dt, 'air');
      if (deadT > 1.4 && !pl.deathReported) { pl.deathReported = true; hooks.onDeath && hooks.onDeath(); }
    }
    if (pl.state !== 'dead') updatePlayer(dt);
    checkPlayerHits();
    for (const e of enemies) updateEnemy(e, dt);
    for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i], b = enemies[j];
      if (a.state === 'air' || b.state === 'air' || a.dead || b.dead || a.def.sprite || b.def.sprite || a.state === 'held' || b.state === 'held') continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 6) { const s = dx >= 0 ? 1 : -1; a.x -= s * 20 * dt; b.x += s * 20 * dt; }
    }
    enemies = enemies.filter(e => !e.dead);
    updateShots(dt);
    updatePickups(dt);
    updateZones(dt);
    for (const p of props) if (p.flash > 0) p.flash -= dt;
    parts.update(dt); floats.update(dt);
    if (comboT > 0 && (comboT -= dt) <= 0) combo = 0;
    if (rankText) { rankText.age += dt; if (rankText.age > 1.2) rankText = null; }
    if (target && (target.dead || !enemies.includes(target))) target = null;
    if (boss && boss.dead && !finale) { finale = { t: 0 }; sfx.ko(); shake.add(6, 800); impactT = 6 / 60; }
    if (Math.random() < 0.25) { const sx = cam.x + rand(0, W); parts.add({ x: sx, y: 88, vx: rand(-4, 4), vy: rand(-18, -10), life: rand(1, 1.8), colors: [C.gray, C.gray, C.purple], shape: 'sq', size: 2, shrink: 0.3, drag: 0.5, bg: true }); }
    // 鏡頭
    if (locked && zone) {
      const tx = clamp(zone.x - W / 2, 0, WW - W);
      cam.x += (tx - cam.x) * smoothK(dt, 0.15);
    } else cam.follow(pl.x + pl.face * P.camLead, H / 2, dt, { smooth: P.camSmooth });
  }

  // =====================================================================
  // 背景
  // =====================================================================
  function buildBackground(style) {
    const sky = makeLayer(W, FLOOR_TOP, PALETTE, p => {
      for (let y = 0; y < FLOOR_TOP; y++) {
        const t = y / FLOOR_TOP;
        const [a, b, f] = t < 0.5 ? [C.ink, C.navy, t / 0.5] : [C.navy, style === 'temple' ? C.plum : C.purple, (t - 0.5) / 0.5 * 0.7];
        p.rect(0, y, W, 1, a); p.dither(0, y, W, 1, b, Math.round(f * 16));
      }
      let s = 7; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
      for (let i = 0; i < 30; i++) p.px(r() * W, r() * 40, r() < 0.3 ? C.white : C.gray);
      if (style === 'temple') { p.circle(250, 30, 14, C.lpink); p.circle(250, 30, 12, C.white); }
    });
    const farW = W + Math.ceil((WW - W) * 0.3) + 4;
    const far = makeLayer(farW, FLOOR_TOP, PALETTE, p => {
      let s = 11 + style.length; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
      let x = 0;
      while (x < farW) {
        const w = 18 + Math.floor(r() * 26), h = 30 + Math.floor(r() * 50);
        p.rect(x, FLOOR_TOP - h, w, h, r() < 0.5 ? C.navy : C.ink);
        for (let wy = FLOOR_TOP - h + 4; wy < FLOOR_TOP - 20; wy += 5) for (let wx = x + 3; wx < x + w - 3; wx += 4) if (r() < 0.35) p.rect(wx, wy, 2, 2, pick([C.yellow, C.cyan, C.plum, C.purple]));
        if (r() < 0.25) { const bw = Math.min(w - 4, 16); p.rect(x + 2, FLOOR_TOP - h - 9, bw, 8, C.ink); p.rect(x + 3, FLOOR_TOP - h - 8, bw - 2, 6, pick([C.pink, C.cyan])); }
        x += w + Math.floor(r() * 6);
      }
      if (style === 'temple') { const cx = farW * 0.7; for (let k = 0; k < 12; k++) p.rect(cx - 60 + k * 3, 60 - k * 2, 120 - k * 6, 2, C.red); p.rect(cx - 45, 60, 90, FLOOR_TOP - 60, C.plum); }
    });
    const stalls = makeLayer(WW, FLOOR_TOP + 4, PALETTE, p => {
      let s = 21 + style.length * 3; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
      const base = FLOOR_TOP;
      p.rect(0, base - 6, WW, 6, style === 'temple' ? C.dskin : C.gray);
      p.rect(0, base - 6, WW, 1, C.white); p.rect(0, base - 1, WW, 1, C.ink);
      const colors = [[C.red, C.white], [C.pink, C.white], [C.cyan, C.white], [C.orange, C.yellow]];
      let x = style === 'gate' ? 170 : 30, i = 0;
      while (x < WW - 60) {
        const w = 76 + Math.floor(r() * 30), top = base - 64;
        if (style === 'temple') {
          // 廟：朱紅柱與屋簷
          p.rect(x, top - 10, w, 74, C.red); p.rect(x + 6, top + 4, w - 12, 50, C.plum);
          for (let k = 0; k < 3; k++) p.rect(x + 10 + k * (w - 24) / 2, top + 4, 4, 58, C.orange);
          for (let k = 0; k < 6; k++) p.rect(x - 8 + k * 2, top - 16 - k * 2, w + 16 - k * 4, 2, k % 2 ? C.orange : C.red);
          p.rect(x + w / 2 - 12, top + 14, 24, 12, C.yellow); p.rect(x + w / 2 - 10, top + 16, 20, 8, C.red);
          x += w + 30 + Math.floor(r() * 20); i++;
          continue;
        }
        const [c1, c2] = colors[i % colors.length];
        p.rect(x, top + 16, 3, 48, C.wood); p.rect(x + w - 3, top + 16, 3, 48, C.wood);
        p.rect(x - 2, base - 26, w + 4, 20, C.wood); p.rect(x - 2, base - 26, w + 4, 2, C.orange); p.rect(x - 2, base - 8, w + 4, 2, C.ink);
        for (let k = x; k < x + w; k += 10) p.rect(k, base - 22, 1, 13, C.ink);
        p.rect(x + 3, top + 16, w - 6, 22, C.plum); p.dither(x + 3, top + 16, w - 6, 22, C.orange, 3);
        if (style === 'games') {
          // 射氣球牆與布偶架
          if (i % 2 === 0) for (let by = top + 18; by < top + 36; by += 6) for (let bx = x + 6; bx < x + w - 6; bx += 6) { p.circle(bx, by, 2, pick([C.pink, C.cyan, C.yellow, C.lpink])); p.px(bx - 1, by - 1, C.white); }
          else for (let k = 0; k < 5; k++) { const fx = x + 8 + k * (w - 16) / 5; p.circle(fx, top + 30, 4, pick([C.lpink, C.lcyan, C.yellow])); p.rect(fx - 3, top + 34, 6, 2, C.wood); }
        } else {
          for (let k = 0; k < 5; k++) { const fx = x + 8 + k * (w - 16) / 5; p.circle(fx, base - 29, 3, pick([C.yellow, C.orange, C.red, C.lpink, C.white])); p.px(fx - 1, base - 30, C.white); }
        }
        for (let k = 0; k < w + 8; k++) { const cc = Math.floor(k / 6) % 2 ? c1 : c2; p.rect(x - 4 + k, top + 6, 1, 10, cc); if (k % 6 === 3) p.rect(x - 4 + k, top + 16, 1, 2, cc); }
        p.rect(x - 4, top + 5, w + 8, 1, C.ink);
        const sw = Math.min(w - 10, 44), sx = x + (w - sw) / 2;
        p.rect(sx - 1, top - 9, sw + 2, 14, C.ink); p.rect(sx, top - 8, sw, 12, C.navy);
        const nc = i % 2 ? C.pink : C.cyan;
        p.rect(sx, top - 8, sw, 1, nc); p.rect(sx, top + 3, sw, 1, nc); p.rect(sx, top - 8, 1, 12, nc); p.rect(sx + sw - 1, top - 8, 1, 12, nc);
        for (let gx = sx + 4; gx < sx + sw - 7; gx += 9) { const gl = Math.floor(r() * 4); p.rect(gx, top - 5, 6, 1, C.yellow); p.rect(gx + 2, top - 5, 1, 6, C.yellow); if (gl & 1) p.rect(gx, top - 2, 6, 1, C.yellow); else p.rect(gx + 4, top - 3, 1, 4, C.yellow); if (gl & 2) p.rect(gx, top, 3, 1, C.yellow); }
        x += w + 24 + Math.floor(r() * 14); i++;
      }
      // 牌樓（入口與街尾）
      const arch = gx => { p.rect(gx, base - 70, 6, 64, C.red); p.rect(gx + 50, base - 70, 6, 64, C.red); p.rect(gx - 10, base - 78, 76, 8, C.red); p.rect(gx - 14, base - 82, 84, 4, C.yellow); p.rect(gx + 14, base - 70, 28, 10, C.yellow); p.rect(gx + 16, base - 68, 24, 6, C.red); };
      if (style === 'gate') arch(40);
      arch(WW - 70);
    });
    const floor = makeLayer(WW, H - FLOOR_TOP, PALETTE, p => {
      const h = H - FLOOR_TOP;
      p.rect(0, 0, WW, h, style === 'temple' ? C.gray : C.purple);
      const lineC = style === 'temple' ? C.purple : C.navy;
      const rows = [0, 5, 11, 18, 26, 35, 45, 56];
      for (const ry of rows) p.rect(0, ry, WW, 1, lineC);
      for (let k = 0; k < rows.length - 1; k++) { const y0 = rows[k], y1 = rows[k + 1], step = 24 + k * 6; for (let x = (k % 2) * step / 2; x < WW; x += step) p.rect(Math.round(x + k * 1.5), y0, 1, y1 - y0, lineC); }
      p.dither(0, 0, WW, 8, C.navy, 5);
      let s = 31; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
      if (style !== 'temple') for (let i = 0; i < WW / 70; i++) { const px = r() * WW, py = 12 + r() * (h - 18), pw = 14 + r() * 22, c = pick([C.pink, C.cyan, C.yellow]); p.ellipse(px, py, pw / 2, 2.5, C.navy); for (let k = 0; k < pw * 0.6; k++) if (r() < 0.6) p.px(px - pw / 3 + k, py + Math.round(r() * 2 - 1), c); }
    });
    return { sky, far, stalls, floor };
  }
  function drawLanterns() {
    for (let x = 16; x < WW; x += 34) {
      if (x + 30 < cam.x - 20 || x > cam.x + W + 20) continue;
      const sway = Math.sin(time * 1.6 + x * 0.05) * 1.5, ly = 40 + Math.sin(x * 0.02) * 3;
      g.line(x - 17, 34, x, ly - 6, C.ink); g.line(x, ly - 6, x + 17, 34, C.ink);
      const lx = x + sway;
      g.rect(lx - 3, ly - 5, 7, 9, C.ink); g.rect(lx - 2, ly - 4, 5, 7, (x / 34) % 3 === 0 ? C.yellow : C.red); g.rect(lx - 2, ly - 1, 5, 1, C.orange); g.px(lx, ly + 4, C.yellow);
    }
  }
  function drawShadow(f) {
    const w = f.def && f.def.sprite ? 20 : f.kind === 'bear' || (f.def && f.def.boss) ? 10 : 7;
    const k = clamp(1 - f.z / 80, 0.4, 1);
    g.ellipse(f.x, f.y, Math.round(w * k), Math.max(1, Math.round(2 * k)), C.navy);
  }
  function drawSpriteBoss(b, sil) {
    const flash = sil ?? (b.flash > 0 || b.hurtT > 0 && Math.floor(time * 40) % 2 ? C.white : b.state === 'dying' && Math.floor(time * 20) % 2 ? C.white : b.rage && Math.floor(time * 8) % 5 === 0 ? C.red : null);
    if (b.kind === 'bubbleTea') {
      const spr = b.state === 'dying' || b.hurtT > 0 ? S.bubbleTea.hurt : b.open ? S.bubbleTea.open : S.bubbleTea.idle;
      const bob = b.state === 'idle' ? Math.round(Math.sin(b.t * 4)) : 0;
      g.spr(spr, Math.round(b.x - 25), Math.round(b.y - b.z - 62 + bob), { flip: b.face < 0, color: flash });
      if (b.strawT > 0) { const len = 50; g.line(b.x + b.face * 10, b.y - 30, b.x + b.face * len, b.y - 24, C.ink, 5); g.line(b.x + b.face * 10, b.y - 30, b.x + b.face * len, b.y - 24, C.pink, 3); }
      // 短手
      if (!sil) { g.line(b.x - 20, b.y - b.z - 30, b.x - 26, b.y - b.z - 20 + bob, C.ink, 5); g.line(b.x + 20, b.y - b.z - 30, b.x + 26, b.y - b.z - 20 - bob, C.ink, 5); g.line(b.x - 20, b.y - b.z - 30, b.x - 26, b.y - b.z - 20 + bob, C.yellow, 3); g.line(b.x + 20, b.y - b.z - 30, b.x + 26, b.y - b.z - 20 - bob, C.yellow, 3); }
    } else {
      const spr = b.state === 'dying' || b.hurtT > 0 ? S.clawMachine.hurt : b.rage ? S.clawMachine.angry : S.clawMachine.idle;
      g.spr(spr, Math.round(b.x - 28), Math.round(b.y - 66), { color: flash });
    }
  }
  function drawClaws(b) {
    for (const c of b.claws || []) {
      const y = c.y - c.z;
      g.line(c.x, 0, c.x, y - 8, C.gray, 1);
      if (c.state === 'track') { const k = clamp(c.t / 1.1, 0, 1); g.ellipse(c.x, c.y, 5 + k * 6, 2, Math.floor(time * 12) % 2 ? C.red : C.navy); }
      g.rect(c.x - 5, y - 10, 10, 4, C.ink); g.rect(c.x - 4, y - 9, 8, 2, C.lcyan);
      const open = c.state === 'track' || (c.state === 'drop' && c.z > 20) ? 5 : 2;
      g.line(c.x - 3, y - 6, c.x - 3 - open, y + 2, C.ink, 3); g.line(c.x + 3, y - 6, c.x + 3 + open, y + 2, C.ink, 3);
      g.line(c.x - 3, y - 6, c.x - 3 - open, y + 2, C.gray); g.line(c.x + 3, y - 6, c.x + 3 + open, y + 2, C.gray);
    }
  }
  function drawProp(p) {
    if (p.kind === 'chair') { if (!p.taken) g.spr(S.chair, Math.round(p.x - 6), Math.round(p.y - 12)); return; }
    if (p.broken) return;
    const spr = p.kind === 'crate' ? S.crate : S.trash;
    g.ellipse(p.x, p.y, 8, 2, C.navy);
    g.spr(spr, Math.round(p.x - spr.w / 2), Math.round(p.y - spr.h), { color: p.flash > 0 ? C.white : null });
  }
  function drawPickup(k) {
    const y = Math.round(k.y - k.z);
    if (k.kind === 'coin') { g.ellipse(k.x, k.y, 3, 1, C.navy); g.spr(S.token, Math.round(k.x - 3), y - 7 + (k.z <= 0 ? Math.round(Math.sin(k.t * 5)) : 0)); }
    else { const s = S.food[k.food]; g.ellipse(k.x, k.y, 5, 1, C.navy); g.spr(s, Math.round(k.x - s.w / 2), y - s.h - 1 + (k.z <= 0 ? Math.round(Math.sin(k.t * 4)) : 0)); if (k.t > 11 && Math.floor(k.t * 10) % 2) return; }
  }
  function drawShot(s) {
    if (s.kind === 'shock') { g.rect(s.x - s.r, s.y - 3, 4, 3, C.white); g.rect(s.x + s.r - 4, s.y - 3, 4, 3, C.white); g.rect(s.x - s.r, s.y - 1, s.r * 2, 1, C.gray); return; }
    if (s.kind === 'drop') { if (s.t < s.delay) { const k = s.t / s.delay; g.ellipse(s.x, s.y, 3 + k * 4, 1 + k, Math.floor(time * 16) % 2 ? C.red : C.navy); } else { g.ellipse(s.x, s.y, 4, 1, C.navy); g.circle(s.x, s.y - s.z - 3, 3, C.ink); g.circle(s.x, s.y - s.z - 3, 2, C.wood); } return; }
    g.ellipse(s.x, s.y, 4, 1, C.navy);
    const y = s.y - s.z;
    if (s.kind === 'chair') { g.spr(S.chair, Math.round(s.x - 6), Math.round(y - 12), { flip: s.vx < 0 }); return; }
    if (s.kind === 'pearl') { g.circle(s.x, y - 4, 4, C.ink); g.circle(s.x, y - 4, 3, C.wood); g.px(s.x - 1, y - 5, C.gray); return; }
    if (s.kind === 'token') { g.spr(S.token, Math.round(s.x - 3), Math.round(y - 6)); return; }
    g.rect(s.x - 3, y - 8, 6, 7, C.ink); g.rect(s.x - 2, y - 7, 4, 5, C.red); g.rect(s.x - 2, y - 7, 4, 1, C.white);
  }
  function drawHUD() {
    g.screenSpace();
    g.label('阿芒', 6, 1, C.yellow, { outline: C.ink });
    g.rect(40, 6, 82, 7, C.ink); g.rect(41, 7, 80, 5, C.plum);
    const hpw = Math.round(80 * clamp(pl.hp / pl.maxHp, 0, 1));
    g.rect(41, 7, hpw, 5, pl.hp < pl.maxHp * 0.3 && Math.floor(time * 6) % 2 ? C.red : C.yellow); g.rect(41, 7, hpw, 1, C.white);
    // 必殺量表
    g.rect(40, 14, 62, 4, C.ink); g.rect(41, 15, 60, 2, C.navy);
    const full = pl.meter >= 100;
    g.rect(41, 15, Math.round(60 * pl.meter / 100), 2, full ? (Math.floor(time * 10) % 2 ? C.white : C.lcyan) : C.cyan);
    if (full) g.text('V SUPER', 106, 13, C.lcyan, { small: true, outline: C.ink });
    else if (pl.specialCD > 0) g.rect(106, 16, Math.round(20 * (1 - clamp(pl.specialCD / Math.max(0.01, P.specialCD), 0, 1))), 1, C.pink);
    if (pl.chair) g.spr(S.chair, 136, 3);
    // 金幣與分數
    g.spr(S.token, W - 44, 4); g.text(String(env.coins()), W - 36, 4, C.yellow, { outline: C.ink });
    g.text(String(stats.score).padStart(7, '0'), W - 6, 13, C.white, { small: true, align: 'right', outline: C.ink });
    // 目標血條
    if (target && target.kind !== 'trainee' && !target.def.boss) {
      g.label(target.def.name, 6, 20, C.lpink, { outline: C.ink });
      g.rect(6, 35, 60, 4, C.ink); g.rect(7, 36, Math.round(58 * clamp(target.hp / target.maxHp, 0, 1)), 2, C.pink);
    }
    if (boss && !boss.dead && boss.state !== 'intro') {
      const bw = 200, bx = (W - bw) / 2, by = H - 8;
      g.label(boss.def.name, bx, by - 14, C.white, { outline: C.ink });
      g.rect(bx - 1, by - 1, bw + 2, 6, C.ink); g.rect(bx, by, bw, 4, C.plum);
      g.rect(bx, by, Math.round(bw * clamp(boss.hp / boss.maxHp, 0, 1)), 4, boss.rage ? C.red : C.pink); g.rect(bx, by, Math.round(bw * clamp(boss.hp / boss.maxHp, 0, 1)), 1, C.white);
    }
    if (combo >= 2) {
      const pop = time - lastHit < 0.06 ? 1 : 0;
      g.text(String(combo), W - 40, 24 - pop, combo >= 20 ? C.pink : combo >= 10 ? C.yellow : C.white, { scale: 2, align: 'right', outline: C.ink });
      g.text('HITS', W - 36, 29, C.cyan, { outline: C.ink });
      g.rect(W - 70, 41, Math.round(64 * clamp(comboT / 2.2, 0, 1)), 1, C.cyan);
    }
    if (rankText && Math.floor(rankText.age * 12) % 2 === 0) g.text(rankText.t, W - 8, 46, C.yellow, { align: 'right', outline: C.ink, scale: rankText.t.length > 5 ? 1 : 2 });
    if (goT > 0 && Math.floor(goT * 4) % 2 === 0) { g.text('GO', W - 34, 70, C.yellow, { scale: 2, outline: C.ink }); for (let k = 0; k < 3; k++) g.rect(W - 12 + k, 74 - (2 - k), 1, 5 + (2 - k) * 2, C.yellow); }
    if (tipT > 0 && tipI < st.tips.length && !(tipT < 0.5 && Math.floor(tipT * 10) % 2)) g.label(st.tips[tipI], W / 2, H - 16, C.white, { align: 'center', outline: C.ink });
    if (boss && boss.state === 'intro') { g.rect(0, 60, W, 24, C.ink); g.rect(0, 61, W, 1, C.pink); g.rect(0, 83, W, 1, C.pink); g.label('BOSS　' + boss.def.name, W / 2, 65, C.white, { align: 'center' }); }
    if (finale && finale.t > 0.2 && finale.t < 2.6) g.text('K.O.', W / 2, 70, Math.floor(time * 10) % 2 ? C.yellow : C.pink, { align: 'center', scale: 3, outline: C.ink });
    if (superFx && superFx.t < 0.9) { g.rect(0, 70, W, 30, C.ink); g.rect(0, 71, W, 1, C.yellow); g.rect(0, 99, W, 1, C.yellow); g.label('必殺！芒果冰暴風', W / 2, 78, C.yellow, { align: 'center' }); }
  }
  function drawHitboxes() {
    const box = (x0, y0, x1, y1, c) => { g.rect(x0, y0, x1 - x0, 1, c); g.rect(x0, y1, x1 - x0, 1, c); g.rect(x0, y0, 1, y1 - y0, c); g.rect(x1, y0, 1, y1 - y0 + 1, c); };
    for (const f of [pl, ...enemies]) { if (f.dead) continue; const top = f.state === 'down' ? 10 : f.def && f.def.sprite ? 60 : 30; box(f.x - (f.bw || 6), f.y - f.z - top, f.x + (f.bw || 6), f.y - f.z - 2, f.inv > 0 ? C.yellow : C.cyan); }
    const a = pl.atk;
    if (a && a.f > a.S && a.f <= a.S + a.A) { const m = a.m, r0 = m.reach[0] * P.reachMul, r1 = m.reach[1] * P.reachMul; const x0 = m.spin ? pl.x - r1 : pl.face > 0 ? pl.x + r0 : pl.x - r1, x1 = m.spin ? pl.x + r1 : pl.face > 0 ? pl.x + r1 : pl.x - r0; box(x0, pl.y - pl.z - m.zr[1], x1, pl.y - pl.z - m.zr[0], C.pink); }
  }
  function render() {
    g.screenSpace();
    const cx = Math.round(cam.x + shake.x), cy = Math.round(shake.y);
    const all = [pl, ...enemies].filter(f => !f.dead);
    if (impactT > 0) {
      g.clear(C.white); g.camera(cx, cy);
      for (const f of all.sort((a, b) => a.y - b.y)) { if (f.def && f.def.sprite) drawSpriteBoss(f, C.ink); else drawRig(f, C.ink); }
      g.screenSpace();
      return;
    }
    g.ctx.drawImage(bg.sky, 0, 0);
    g.ctx.drawImage(bg.far, -Math.round(cx * 0.3), 0);
    g.camera(cx, cy);
    g.ctx.drawImage(bg.stalls, 0, -4);
    g.ctx.drawImage(bg.floor, 0, FLOOR_TOP);
    parts.draw(g, p => p.bg);
    drawLanterns();
    const list = [];
    for (const p of props) list.push({ y: p.y, d: () => drawProp(p) });
    for (const k of pickups) list.push({ y: k.y, d: () => drawPickup(k) });
    for (const f of all) { list.push({ y: f.y - 0.5, d: () => drawShadow(f) }); list.push({ y: f.y, d: () => f.def && f.def.sprite ? drawSpriteBoss(f) : drawRig(f) }); }
    for (const s of shots) list.push({ y: s.y, d: () => drawShot(s) });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.d();
    if (boss && boss.kind === 'clawMachine') drawClaws(boss);
    parts.draw(g, p => !p.bg);
    floats.draw(g);
    if (P.showHitbox) drawHitboxes();
    g.screenSpace();
    for (let x = 260; x < WW * 1.3; x += 430) { const sx = Math.round(x - cx * 1.3); if (sx < -12 || sx > W + 12) continue; g.rect(sx, 64, 3, H - 64, C.ink); g.rect(sx - 5, 60, 13, 5, C.ink); g.rect(sx - 4, 61, 11, 2, C.yellow); }
    if (superFx) { const k = superFx.t; if (k > 0.8 && k < 1.1) g.ditherFast(0, 0, W, H, C.white, Math.round((1 - Math.abs(k - 0.95) / 0.15) * 10)); }
    if (!hudOff) drawHUD();
    if (pl.state === 'dead') g.ditherFast(0, 0, W, H, C.ink, Math.round(clamp((deadT - 0.6) / 0.8, 0, 1) * 12));
  }
  function debugLines() {
    const a = pl.atk;
    return [
      `STATE ${pl.state.toUpperCase()}${a ? ' ' + a.name.toUpperCase() + ' F' + a.f : ''}  ${pl.running ? 'RUN' : ''}`,
      `X ${pl.x.toFixed(0)} Y ${pl.y.toFixed(0)} Z ${pl.z.toFixed(0)}  HP ${pl.hp}  METER ${pl.meter.toFixed(0)}`,
      `COMBO ${combo}  BEST ${bestCombo}  ZONE ${zoneIdx}${locked ? ' LOCK' : ''}`,
      `ENEMY ${enemies.length}  TOKENS ${tokensInUse()}  SCORE ${stats.score}`,
    ];
  }
  /** 從目前的戰鬥區重來（接關） */
  function continueHere() {
    stats.continues++;
    pl.hp = pl.maxHp; pl.state = 'getup'; pl.stateT = 0.3; pl.inv = 2.5; pl.deathReported = false; pl.meter = 100; deadT = 0;
    parts.add({ x: pl.x, y: pl.y - 20, shape: 'ring', r0: 4, r1: 60, life: 0.6, colors: [C.white, C.yellow, C.pink] });
    for (const e of enemies) if (!e.def.boss && e.kind !== 'trainee' && Math.abs(e.x - pl.x) < 80) { e.state = 'air'; e.z = 1; e.vz = 150; e.vx = sign(e.x - pl.x || 1) * 120; e.bounced = false; e.juggles = 99; }
  }
  function stageCover() {
    load(0);
    hudOff = true; tipT = 0;
    zoneIdx = 99;
    const e = makeEnemy('trainee', pl.x + 17, pl.y);
    const bun = makeEnemy('rabbit', pl.x - 34, pl.y - 6); bun.face = 1; bun.state = 'wind'; bun.stateT = 9; bun.cd = 9;
    const bear = makeEnemy('bear', pl.x + 62, pl.y + 10); bear.face = -1; bear.cd = 9;
    enemies.push(e, bun, bear);
    startMove('upper'); pl.atk.f = pl.atk.S;
    cam.center(pl.x + 14, H / 2);
  }
  /** 標題與地圖用的「擺拍」：指定街道背景與幾個角色姿勢（不需要載入關卡） */
  const showBg = {};
  function showcase(style, camX, figs, t) {
    const keepWW = WW;
    WW = 900;
    const b = showBg[style] || (showBg[style] = buildBackground(style));
    WW = keepWW;
    const keepTime = time; time = t;
    g.screenSpace();
    g.ctx.drawImage(b.sky, 0, 0);
    g.ctx.drawImage(b.far, -Math.round(camX * 0.3), 0);
    g.camera(Math.round(camX), 0);
    g.ctx.drawImage(b.stalls, 0, -4);
    g.ctx.drawImage(b.floor, 0, FLOOR_TOP);
    const list = figs.map(d => { const f = fighter(d.kind, d.x, d.y); f.face = d.face || 1; f.pose = { ...POSES.guard, ...POSES[d.pose || 'guard'] }; f.z = d.z || 0; if (d.state) f.state = d.state; return f; });
    for (const f of list.sort((a, b) => a.y - b.y)) { drawShadow(f); drawRig(f); }
    g.screenSpace();
    time = keepTime;
  }
  return {
    load, update, render, debugLines, stageCover, continueHere,
    showcase,
    set hudOff(v) { hudOff = v; },
    get stage() { return st; }, get stageIndex() { return stageIndex; }, get player() { return pl; }, get finale() { return finale; },
    peek: () => ({ pl, enemies, shots, pickups, props, combo, bestCombo, zoneIdx, locked, boss, stats, cam }),
    debugSpawn(kind, dx = 20, dy = 0) { const e = makeEnemy(kind, pl.x + dx, clamp(pl.y + dy, FLOOR_TOP, FLOOR_BOT)); e.entered = true; enemies.push(e); return e; },
    debugBoss() { zoneIdx = st.zones.length; pl.x = st.bossX - 140; cam.x = pl.x - 100; locked = false; },
    debugClearZone() { for (const e of enemies) if (e.kind !== 'trainee') { e.hp = 0; e.dying = true; e.state = 'dead'; e.stateT = 0.1; } spawnQ = []; if (zone) waveI = zone.waves.length; },
  };
}
