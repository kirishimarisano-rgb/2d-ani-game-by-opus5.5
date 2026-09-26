// 《夜市拳姬》原型 C：清版格鬥（橫向捲軸＋縱深移動）
// 阿芒在夜市擊退穿布偶裝的混混。這個原型只測「移動與攻擊的手感」：連段、浮空追擊、擊倒、打擊停頓。
import { runPrototype } from '../engine/app.js';
import { makeLayer, TAU, BAYER4 } from '../engine/pixel.js';
import { Particles, Shaker, Camera, Floaters, clamp, approach, rand, sign, smoothK, pick } from '../engine/fx.js';
import { PALETTE, C, buildSprites } from './sprites.js';

const W = 320, H = 180, WW = 960;
const FLOOR_TOP = 118, FLOOR_BOT = 170;
const DEG = Math.PI / 180;

// ---------------- 調參面板 ----------------
const TUNING = {
  groups: [
    { name: '移動', items: [
      { key: 'walkX', label: '橫向走速', min: 30, max: 200, step: 1, value: 80, unit: 'px/s' },
      { key: 'walkZ', label: '縱深走速', min: 20, max: 160, step: 1, value: 50, unit: 'px/s', hint: '上下（往畫面深處）移動的速度，通常比橫向慢。' },
      { key: 'runSpeed', label: '跑步速度', min: 80, max: 320, step: 5, value: 155, unit: 'px/s', hint: '連按兩下左右，或按住 Shift 奔跑。跑步中攻擊＝滑壘踢。' },
      { key: 'doubleTap', label: '連按判定時間', min: 100, max: 500, step: 10, value: 260, unit: 'ms' },
      { key: 'accel', label: '加速度', min: 200, max: 9000, step: 100, value: 3200, unit: 'px/s²', hint: '清版動作通常接近「一按就到全速」。' },
      { key: 'jumpV', label: '跳躍初速', min: 120, max: 420, step: 5, value: 250, unit: 'px/s' },
      { key: 'gravity', label: '重力', min: 300, max: 2000, step: 25, value: 900, unit: 'px/s²' },
      { key: 'airControl', label: '空中控制', min: 0, max: 1, step: 0.05, value: 0.35, unit: '×' },
    ] },
    { name: '連段', items: [
      { key: 'atkSpeed', label: '出招速度倍率', min: 0.5, max: 2, step: 0.05, value: 1, unit: '×', hint: '所有攻擊動作的播放速度。' },
      { key: 'comboCancel', label: '連段接續時機', min: 0, max: 1, step: 0.05, value: 0.3, unit: '×', hint: '預先按下攻擊時，後搖進行到多少比例就接出下一招。' },
      { key: 'comboWindow', label: '連段輸入窗口', min: 0, max: 800, step: 10, value: 300, unit: 'ms' },
      { key: 'stepIn', label: '出拳前進', min: 0, max: 200, step: 5, value: 65, unit: 'px/s', hint: '每一招自動往前踏的量，讓連段能追著敵人打。' },
      { key: 'depthTol', label: '縱深判定寬容', min: 2, max: 20, step: 1, value: 8, unit: 'px', hint: '敵人與自己在縱深上差多少以內還打得到。' },
      { key: 'reachMul', label: '攻擊距離倍率', min: 0.6, max: 1.8, step: 0.05, value: 1, unit: '×' },
      { key: 'specialCD', label: '旋風腿冷卻', min: 0, max: 5, step: 0.1, value: 1.2, unit: '秒' },
      { key: 'poseBlend', label: '姿勢補間', min: 0, max: 0.1, step: 0.005, value: 0.02, unit: '秒', hint: '姿勢切換的平滑時間。0＝逐格切換的硬派感，越大越柔順。' },
    ] },
    { name: '打擊感', items: [
      { key: 'hitstop', label: '打擊停頓', min: 0, max: 200, step: 5, value: 45, unit: 'ms' },
      { key: 'hitstopFinisher', label: '終結技停頓', min: 0, max: 400, step: 5, value: 130, unit: 'ms' },
      { key: 'hitstopGrowth', label: '連段停頓累加', min: -10, max: 10, step: 0.5, value: 2, unit: 'ms/下', hint: '連段每多一下，停頓增加（負值＝越打越流暢）。上限 +60ms。' },
      { key: 'push', label: '普通拳推開', min: 0, max: 250, step: 5, value: 45, unit: 'px/s', hint: '刺拳、直拳把敵人往後推的力道；太大會讓後面的招式打不到。' },
      { key: 'knock', label: '擊飛力道', min: 50, max: 500, step: 10, value: 170, unit: 'px/s' },
      { key: 'launch', label: '上勾拳浮空力', min: 100, max: 500, step: 10, value: 250, unit: 'px/s' },
      { key: 'juggleGravity', label: '浮空重力', min: 200, max: 1600, step: 25, value: 700, unit: 'px/s²', hint: '被打飛的敵人落下的快慢；越小越好追擊。' },
      { key: 'juggleLift', label: '追擊托高', min: 0, max: 300, step: 5, value: 95, unit: 'px/s', hint: '空中的敵人再被打中時往上托的速度。' },
      { key: 'juggleLimit', label: '追擊上限', min: 1, max: 20, step: 1, value: 6, unit: '下', hint: '一次浮空最多能追打幾下，防止無限連段。' },
      { key: 'otg', label: '可以追打倒地的敵人', type: 'toggle', value: false },
      { key: 'hitstun', label: '敵人硬直', min: 100, max: 1000, step: 10, value: 380, unit: 'ms' },
      { key: 'downTime', label: '倒地時間', min: 0.2, max: 3, step: 0.1, value: 0.9, unit: '秒' },
      { key: 'shake', label: '畫面震動', min: 0, max: 8, step: 0.5, value: 2, unit: 'px' },
      { key: 'shakeFinisher', label: '終結技震動', min: 0, max: 12, step: 0.5, value: 5, unit: 'px' },
      { key: 'impactFrame', label: '衝擊格（黑白閃格）', type: 'toggle', value: true, hint: '終結技命中時插入 3 格高反差剪影，動畫常見的演出。' },
      { key: 'flashFrames', label: '命中閃白', min: 0, max: 10, step: 1, value: 3, unit: '格' },
      { key: 'sparkSize', label: '打擊火花大小', min: 0, max: 2, step: 0.1, value: 1, unit: '×' },
      { key: 'damageNumbers', label: '傷害數字', type: 'toggle', value: true },
    ] },
    { name: '敵人與鏡頭', open: false, items: [
      { key: 'enemyCount', label: '同時出現的敵人', min: 0, max: 8, step: 1, value: 3, unit: '隻' },
      { key: 'attackTokens', label: '同時出手上限', min: 1, max: 6, step: 1, value: 2, unit: '隻', hint: '同一時間最多幾隻敵人會出手，其他在旁邊繞圈（群戰節奏的關鍵）。' },
      { key: 'enemySpeed', label: '敵人速度倍率', min: 0.3, max: 2, step: 0.1, value: 1, unit: '×' },
      { key: 'enemyAggro', label: '敵人會主動攻擊', type: 'toggle', value: true },
      { key: 'superArmor', label: '熊熊保鑣霸體', type: 'toggle', value: true, hint: '保鑣出招時被打不會中斷，要先閃開或在出招前打斷。' },
      { key: 'iframes', label: '起身無敵時間', min: 0, max: 3000, step: 50, value: 900, unit: 'ms' },
      { key: 'camLead', label: '鏡頭前瞻', min: 0, max: 80, step: 1, value: 30, unit: 'px' },
      { key: 'camSmooth', label: '鏡頭平滑', min: 0, max: 0.5, step: 0.01, value: 0.12, unit: '秒' },
    ] },
  ],
  presets: {
    '均衡（預設值）': {},
    '爽快連段': { juggleGravity: 500, juggleLimit: 12, juggleLift: 120, launch: 290, hitstop: 38, hitstopGrowth: 3.5, otg: true, comboCancel: 0.15, stepIn: 70 },
    '硬派格鬥': { hitstop: 70, hitstopFinisher: 170, hitstopGrowth: -2, juggleLimit: 3, juggleGravity: 1000, hitstun: 300, atkSpeed: 0.85, comboCancel: 0.55, enemySpeed: 1.3, attackTokens: 3, poseBlend: 0 },
    '輕飄飄空戰': { gravity: 520, jumpV: 230, juggleGravity: 380, launch: 310, airControl: 0.8 },
    '無特效對照組': { hitstop: 0, hitstopFinisher: 0, hitstopGrowth: 0, shake: 0, shakeFinisher: 0, impactFrame: false, flashFrames: 0, sparkSize: 0, damageNumbers: false, push: 0, stepIn: 0, poseBlend: 0, camLead: 0, camSmooth: 0 },
  },
};

const INTRO = {
  pitch: '夜市收攤前，一群穿布偶裝的混混跑來搗亂。愛吃芒果冰的阿芒用拳腳清場！清版格鬥：橫向捲軸＋上下縱深移動。',
  goals: [
    '四段連擊（刺拳、刺拳、直拳、上勾拳）的節奏與「接招時機」。',
    '上勾拳打飛後，在空中繼續追打（浮空追擊）——試試調整浮空重力與追擊上限。',
    '跳躍踢、跑步中的滑壘踢、旋風腿（特殊技）各自的用途。',
    '熊熊保鑣的「霸體」：出招時打不斷，要學會閃開或先發制人。',
    '終結技的衝擊格與停頓累加：連段越長，每一下越重。',
  ],
  controls: [
    ['方向鍵／WASD', '移動（上下＝往畫面深處）；連按兩下左右＝奔跑'],
    ['Z ／ J', '攻擊（連按四段；跳躍中＝飛踢；奔跑中＝滑壘踢）'],
    ['X ／ K ／ Space', '跳躍'],
    ['C ／ L', '旋風腿（打兩側、會浮空）'],
    ['Shift', '按住奔跑'],
    ['手把', '左搖桿移動、X 攻擊、A 跳躍、B／Y 旋風腿、RB 奔跑'],
    ['P ／ N ／ H ／ R', '暫停／逐格／判定框／重置'],
  ],
};

// ---------------- 姿勢（角度以面向右為準：0＝前、90＝下；f＝前手／前腳、b＝後手／後腳） ----------------
const POSES = {
  guard: { lean: 0, hip: 0, fu: 55, fl: -75, bu: 105, bl: -70, ft: 75, fs: 100, bt: 105, bs: 95 },
  guard2: { lean: 0, hip: 1, fu: 60, fl: -70, bu: 108, bl: -65, ft: 70, fs: 105, bt: 110, bs: 95 },
  jabWind: { lean: -1, hip: 0, fu: 85, fl: -40, bu: 105, bl: -70, ft: 75, fs: 100, bt: 105, bs: 95 },
  jab: { lean: 2, hip: 0, fu: 2, fl: 0, bu: 105, bl: -70, ft: 70, fs: 95, bt: 110, bs: 95 },
  crossWind: { lean: -2, hip: 0, fu: 70, fl: -70, bu: 150, bl: -40, ft: 75, fs: 100, bt: 110, bs: 95 },
  cross: { lean: 3, hip: 1, fu: 120, fl: -80, bu: -2, bl: -2, ft: 60, fs: 95, bt: 120, bs: 95, twist: true },
  upperWind: { lean: -1, hip: 4, fu: 110, fl: 60, bu: 110, bl: -70, ft: 55, fs: 125, bt: 125, bs: 70 },
  upper: { lean: 2, hip: -4, fu: -80, fl: -95, bu: 120, bl: -40, ft: 88, fs: 90, bt: 115, bs: 105, head: 'shout' },
  jump: { lean: 0, hip: 0, fu: -20, fl: -80, bu: 150, bl: -110, ft: 25, fs: 110, bt: 75, bs: 150 },
  jumpKick: { lean: -2, hip: 0, fu: -120, fl: -150, bu: 165, bl: 130, ft: 35, fs: 32, bt: 110, bs: 175 },
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
};
const ANGLE_KEYS = ['fu', 'fl', 'bu', 'bl', 'ft', 'fs', 'bt', 'bs'];

// 招式：f＝[前搖, 判定, 後搖]（60fps 格數），reach＝前方判定範圍，zr＝高度範圍
const MOVES = {
  jab1: { f: [3, 2, 7], dmg: 4, reach: [2, 19], zr: [12, 24], push: 1, poses: ['jabWind', 'jab', 'guard'], next: 'jab2', sound: 0 },
  jab2: { f: [3, 2, 8], dmg: 4, reach: [2, 19], zr: [12, 24], push: 1, poses: ['jabWind', 'jab', 'guard'], next: 'cross', sound: 1 },
  cross: { f: [4, 3, 10], dmg: 7, reach: [2, 22], zr: [12, 24], push: 1.3, poses: ['crossWind', 'cross', 'guard'], next: 'upper', sound: 2 },
  upper: { f: [5, 3, 16], dmg: 11, reach: [0, 17], zr: [8, 36], launch: 1, finisher: true, poses: ['upperWind', 'upper', 'guard'], sound: 3 },
  airKick: { f: [2, 16, 4], dmg: 8, reach: [0, 19], zr: [-8, 14], knockdown: true, air: true, poses: ['jump', 'jumpKick', 'jump'], sound: 2 },
  slide: { f: [2, 16, 12], dmg: 9, reach: [-2, 21], zr: [-2, 12], knockdown: true, poses: ['slideWind', 'slide', 'getup'], sound: 2 },
  spin: { f: [4, 14, 10], dmg: 8, reach: [-20, 20], zr: [4, 26], launch: 0.6, finisher: true, spin: true, poses: ['spinWind', 'spinKick', 'guard'], sound: 3 },
};
const ENEMY = {
  rabbit: { hp: 60, speed: 46, windT: 0.36, dmg: 8, reach: [2, 20], name: 'BUNNY', weight: 1 },
  bear: { hp: 130, speed: 30, windT: 0.62, dmg: 16, reach: [0, 26], name: 'BEAR GUARD', weight: 1.6, heavy: true },
  trainee: { hp: 99999, speed: 0, name: 'TRAINEE', weight: 1 },
};
const angDiff = (a, b) => { let d = (b - a) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };

function create({ screen: g, input, sound, P }) {
  const S = buildSprites();
  const RIGS = {
    amang: { p: S.amang, len: [6, 5, 7, 7], hipH: 15, thick: [3, 3], col: [C.yellow, C.skin, C.navy, C.skin], sock: C.white, fist: S.fist, shoe: S.shoe, t: { hip: [5, 10], sf: [7, 3], sb: [3, 3], neck: [5, 1] }, chin: [7, 11] },
    rabbit: { p: S.rabbit, len: [5, 4, 5, 6], hipH: 12, thick: [3, 3], col: [C.lpink, C.lpink, C.lpink, C.lpink], fist: S.mitten, shoe: S.bigShoe, t: { hip: [6, 11], sf: [9, 4], sb: [3, 4], neck: [6, 1] }, chin: [8, 17] },
    trainee: { p: S.trainee, len: [5, 4, 5, 6], hipH: 12, thick: [3, 3], col: [C.cyan, C.cyan, C.cyan, C.cyan], fist: S.mitten, shoe: S.bigShoeC, t: { hip: [6, 11], sf: [9, 4], sb: [3, 4], neck: [6, 1] }, chin: [8, 17] },
    bear: { p: S.bear, len: [6, 6, 6, 8], hipH: 15, thick: [4, 4], col: [C.navy, C.navy, C.navy, C.navy], fist: S.paw, shoe: S.dressShoe, t: { hip: [6, 11], sf: [10, 3], sb: [2, 3], neck: [6, 0] }, chin: [9, 15] },
  };
  const bg = buildBackground();
  const parts = new Particles(900), floats = new Floaters(), shake = new Shaker(), cam = new Camera(W, H);
  cam.bounds = { w: WW, h: H };
  let pl, enemies, hitstop, time, combo, comboT, lastHit, bestCombo, impactT, target, spawnT, tapDir, tapT, hintT, rankText;

  // ---------------- 音效 ----------------
  const sfx = {
    whiff() { if (!sound.throttle('whiff', 0.05)) return; sound.noise({ dur: 0.08, vol: 0.07, filter: 'bandpass', f0: 2200, f1: 900, q: 1.3 }); },
    hit(level, n) {
      if (!sound.throttle('hit', 0.025)) return;
      const heavy = level >= 2;
      sound.noise({ dur: heavy ? 0.14 : 0.07, vol: heavy ? 0.3 : 0.22, filter: 'lowpass', f0: heavy ? 3000 : 4200, f1: 300 });
      sound.tone({ type: 'sine', f0: heavy ? 180 : 240, f1: 45, dur: heavy ? 0.22 : 0.1, vol: heavy ? 0.4 : 0.25 });
      sound.noise({ dur: 0.03, vol: 0.12, filter: 'highpass', f0: 3000 + Math.min(n, 12) * 150 });
      if (level >= 3) { sound.tone({ type: 'square', f0: 220, f1: 880, dur: 0.18, vol: 0.06, delay: 0.02 }); }
    },
    squeak() { if (!sound.throttle('squeak', 0.08)) return; sound.tone({ type: 'square', f0: rand(900, 1200), f1: 500, dur: 0.07, vol: 0.05 }); },
    jump() { sound.tone({ type: 'triangle', f0: 300, f1: 620, dur: 0.1, vol: 0.07 }); },
    land() { if (!sound.throttle('land', 0.08)) return; sound.noise({ dur: 0.06, vol: 0.1, filter: 'lowpass', f0: 800, f1: 200 }); },
    thud() { if (!sound.throttle('thud', 0.06)) return; sound.tone({ type: 'sine', f0: 120, f1: 40, dur: 0.2, vol: 0.35 }); sound.noise({ dur: 0.12, vol: 0.2, filter: 'lowpass', f0: 900, f1: 100 }); },
    hurt() { sound.tone({ type: 'sawtooth', f0: 380, f1: 120, dur: 0.2, vol: 0.12 }); sound.noise({ dur: 0.15, vol: 0.2, filter: 'lowpass', f0: 2500, f1: 300 }); },
    rank(n) { [659, 784, 988, 1319].slice(0, 2 + Math.min(2, n)).forEach((f, i) => sound.tone({ type: 'square', f0: f, dur: 0.1, vol: 0.05, delay: i * 0.07 })); },
    wind() { if (!sound.throttle('wind', 0.2)) return; sound.tone({ type: 'triangle', f0: 200, f1: 330, dur: 0.12, vol: 0.05 }); },
    spin() { sound.noise({ dur: 0.3, vol: 0.13, filter: 'bandpass', f0: 700, f1: 2400, q: 1 }); },
  };

  // ---------------- 建立角色 ----------------
  function fighter(kind, x, y) {
    const pose = { ...POSES.guard };
    return { kind, rig: RIGS[kind === 'player' ? 'amang' : kind], x, y, z: 0, vx: 0, vy: 0, vz: 0, face: 1, state: 'idle', stateT: 0,
      pose, hp: 0, maxHp: 0, flash: 0, inv: 0, atk: null, juggles: 0, bounced: false, dead: false, cd: rand(0.5, 1.5), token: false, side: 1, t: rand(0, 5), shakeT: 0, armor: false };
  }
  function makeEnemy(kind, x, y) {
    const e = fighter(kind, x, y);
    const d = ENEMY[kind];
    e.hp = e.maxHp = d.hp; e.def = d; e.face = x < pl.x ? 1 : -1;
    return e;
  }
  function reset() {
    pl = fighter('player', 90, 146);
    pl.hp = pl.maxHp = 100; pl.chain = null; pl.chainT = 0; pl.running = false; pl.airAttacked = false; pl.specialCD = 0; pl.queued = false;
    enemies = [makeEnemy('trainee', 170, 140)];
    hitstop = 0; time = 0; combo = 0; comboT = 0; lastHit = -1; bestCombo = 0; impactT = 0; target = null; spawnT = 1.2; tapDir = 0; tapT = 0; hintT = 7; rankText = null;
    parts.clear(); floats.list.length = 0; shake.reset();
    cam.center(pl.x + 40, H / 2);
  }

  // ---------------- 骨架繪製 ----------------
  function limb(ax, ay, a1, l1, a2, l2, face) {
    const d1 = face > 0 ? a1 : 180 - a1, d2 = face > 0 ? a2 : 180 - a2;
    const bx = ax + Math.cos(d1 * DEG) * l1, by = ay + Math.sin(d1 * DEG) * l1;
    const cx = bx + Math.cos(d2 * DEG) * l2, cy = by + Math.sin(d2 * DEG) * l2;
    return { ax, ay, bx, by, cx, cy };
  }
  /** 依姿勢畫出角色。sil：剪影色（衝擊格用），col：閃色 */
  function drawRig(f, sil) {
    const r = f.rig, p = f.pose, face = f.face;
    const gx = Math.round(f.x), gy = Math.round(f.y - f.z);
    const flash = sil ?? (f.flash > 0 ? C.white : null);
    const jit = f.shakeT > 0 && hitstop > 0 ? (Math.floor(time * 60) % 2 ? 2 : -2) : 0;
    const blink = f.inv > 0 && f.state !== 'hurt' && Math.floor(f.inv * 20) % 2;
    if (blink && !sil) return;
    if (f.state === 'dead' && !sil && Math.floor(time * 20) % 2) return;
    if (f.state === 'down' || f.state === 'dead') { drawLying(f, flash); return; }
    const hip = { x: gx + jit + p.lean, y: gy - r.hipH + p.hip };
    const tor = p.twist && f.kind === 'player' ? r.p.torso : r.p.torso;
    const tw = tor.w, th = tor.h;
    const fx = (x, w) => face > 0 ? x : w - 1 - x;
    const tx = hip.x - fx(r.t.hip[0], tw), ty = hip.y - r.t.hip[1];
    const sf = { x: tx + fx(r.t.sf[0], tw), y: ty + r.t.sf[1] }, sb = { x: tx + fx(r.t.sb[0], tw), y: ty + r.t.sb[1] };
    const neck = { x: tx + fx(r.t.neck[0], tw), y: ty + r.t.neck[1] };
    const [ua, fa, thl, shl] = r.len;
    const armF = limb(sf.x, sf.y, p.fu, ua, p.fl, fa, face), armB = limb(sb.x, sb.y, p.bu, ua, p.bl, fa, face);
    const hipF = { x: hip.x + face * 1, y: hip.y }, hipB = { x: hip.x - face * 2, y: hip.y };
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
    const head = p.head === 'hurt' || f.state === 'hurt' ? r.p.headHurt : p.head === 'shout' && r.p.headShout ? r.p.headShout : r.p.head;
    g.spr(head, neck.x - fx(r.chin[0], head.w), neck.y - r.chin[1], { flip: face < 0, color: flash });
    drawLimb(armF, ta, cSleeve, cArm, r.fist);
    f.handF = { x: armF.cx, y: armF.cy }; f.footF = { x: legF.cx, y: legF.cy };
  }
  // 後側的手腳用比較暗的顏色，增加前後層次
  function shade(c) { return { [C.yellow]: C.orange, [C.skin]: C.dskin, [C.lpink]: C.pink, [C.cyan]: C.plum, [C.white]: C.gray, [C.navy]: C.ink }[c] ?? c; }
  function drawLying(f, flash) {
    const r = f.rig, face = f.face;
    const gx = Math.round(f.x), gy = Math.round(f.y - f.z);
    const tor = r.p.torsoLie, head = r.p.headLie;
    // 頭朝向遠離攻擊者的一側
    const dir = -face;
    const tx = gx - Math.round(tor.w / 2), ty = gy - tor.h;
    g.line(gx - dir * 2, gy - 3, gx - dir * 12, gy - 2, C.ink, r.thick[1] + 2);
    g.line(gx - dir * 2, gy - 3, gx - dir * 12, gy - 2, r.col[3], r.thick[1]);
    g.spr(r.shoe, gx - dir * 13 - 3, gy - 5, { flip: dir > 0, color: flash });
    g.spr(tor, tx, ty, { flip: dir > 0, color: flash });
    g.spr(head, dir > 0 ? tx + tor.w - 2 : tx - head.w + 2, gy - head.h, { flip: dir > 0, color: flash });
    g.line(gx, gy - tor.h + 1, gx + dir * 4, gy - tor.h - 4, C.ink, r.thick[0] + 2);
    g.line(gx, gy - tor.h + 1, gx + dir * 4, gy - tor.h - 4, r.col[0], r.thick[0]);
  }

  // ---------------- 姿勢更新 ----------------
  function setPose(f, dt, name, override) {
    const tp = POSES[name] || POSES.guard;
    const k = P.poseBlend <= 0 ? 1 : smoothK(dt, P.poseBlend);
    for (const key of ANGLE_KEYS) f.pose[key] += angDiff(f.pose[key], tp[key]) * k;
    f.pose.lean += (tp.lean - f.pose.lean) * k; f.pose.hip += (tp.hip - f.pose.hip) * k;
    f.pose.head = tp.head; f.pose.twist = tp.twist;
    if (override) Object.assign(f.pose, override);
  }
  function walkPose(f, dt, speed, run) {
    const ph = f.t * (run ? 14 : 9);
    const s = Math.sin(ph), c = Math.cos(ph);
    const sw = run ? 38 : 24;
    setPose(f, dt, 'guard');
    Object.assign(f.pose, {
      ft: 90 - s * sw, fs: 95 - Math.max(0, -s) * 50 + (run ? 10 : 0), bt: 90 + s * sw, bs: 95 - Math.max(0, s) * 50 + (run ? 10 : 0),
      hip: Math.abs(c) * (run ? -2 : -1) + 1, lean: run ? 3 : 1,
    });
    if (run) Object.assign(f.pose, { fu: 110 + s * 50, fl: 60 + s * 30, bu: 110 - s * 50, bl: 60 - s * 30 });
  }

  // ---------------- 玩家 ----------------
  function startMove(name) {
    const m = MOVES[name];
    const sc = 1 / P.atkSpeed;
    pl.atk = { name, m, f: 0, S: Math.max(0, Math.round(m.f[0] * sc)), A: Math.max(1, Math.round(m.f[1] * sc)), R: Math.max(0, Math.round(m.f[2] * sc)), hit: new Set(), queued: false, hitAny: false };
    pl.state = 'attack';
    if (!m.air && name !== 'slide') { pl.vx = pl.face * P.stepIn * (m.finisher ? 1.4 : 1); pl.vy = 0; }
    if (name === 'slide') { pl.vx = pl.face * Math.max(P.runSpeed, 160); pl.vy = 0; }
    if (name === 'spin') { pl.specialCD = P.specialCD; sfx.spin(); }
    if (['jab1', 'jab2', 'cross', 'upper'].includes(name)) pl.chain = name;
  }
  function updatePlayer(dt) {
    pl.t += dt; pl.inv -= dt; pl.flash -= dt; pl.chainT -= dt; pl.specialCD -= dt; tapT -= dt;
    const ax = input.axis();
    const mx = Math.abs(ax.x) > 0.3 ? sign(ax.x) : 0;
    // 連按兩下奔跑
    for (const [act, d] of [['left', -1], ['right', 1]]) if (input.pressed(act)) { if (tapDir === d && tapT > 0) pl.running = true; tapDir = d; tapT = P.doubleTap / 1000; }
    if (input.down('run') && mx) pl.running = true;
    if (!mx) pl.running = false;
    const st = pl.state;
    if (st === 'hurt') {
      pl.stateT -= dt; pl.vx = approach(pl.vx, 0, 500 * dt);
      setPose(pl, dt, 'hurt');
      if (pl.stateT <= 0) pl.state = 'idle';
    } else if (st === 'air' || st === 'down' || st === 'getup') {
      updateFallen(pl, dt, true);
    } else if (st === 'jump') {
      pl.vx = approach(pl.vx, mx * (pl.running ? P.runSpeed : P.walkX), P.accel * P.airControl * dt);
      pl.vy = approach(pl.vy, ax.y * P.walkZ, P.accel * P.airControl * dt);
      if (mx) pl.face = pl.atk ? pl.face : mx;
      if (input.pressed('attack') && !pl.atk && !pl.airAttacked) { pl.airAttacked = true; startMove('airKick'); pl.state = 'jump'; }
      if (pl.atk) { pl.atk.f++; setPose(pl, dt, movePose(pl.atk)); if (pl.atk.f >= pl.atk.S + pl.atk.A + pl.atk.R) pl.atk = null; }
      else setPose(pl, dt, 'jump');
    } else if (st === 'attack') {
      const a = pl.atk;
      a.f++;
      if (a.f === a.S + 1) { if (!a.m.spin) sfx.whiff(); }
      if (input.pressed('attack')) a.queued = true;
      setPose(pl, dt, movePose(a), a.m.spin ? { } : null);
      if (a.m.spin && a.f > a.S && a.f <= a.S + a.A) pl.face = Math.floor((a.f - a.S) / 4) % 2 ? -pl.spinFace : pl.spinFace;
      const fric = a.name === 'slide' ? 420 : 620;
      pl.vx = approach(pl.vx, 0, fric * dt); pl.vy = approach(pl.vy, 0, fric * dt);
      const end = a.S + a.A + a.R, cancelAt = a.S + a.A + Math.ceil(a.R * P.comboCancel);
      if (a.queued && a.m.next && a.f >= cancelAt) { if (mx) pl.face = mx; startMove(a.m.next); }
      else if (input.pressed('special') && pl.specialCD <= 0 && a.f >= a.S + a.A) { pl.spinFace = pl.face; startMove('spin'); }
      else if (a.f >= end) {
        if (a.m.spin) pl.face = pl.spinFace;
        pl.atk = null; pl.state = 'idle'; pl.chainT = P.comboWindow / 1000;
        if (a.m.finisher) pl.chain = null;
      }
    } else { // idle / walk / run
      if (input.pressed('jump')) {
        pl.state = 'jump'; pl.vz = P.jumpV; pl.airAttacked = false; sfx.jump();
        parts.burst(pl.x, pl.y, 5, { dir: -Math.PI / 2, spread: 2.6, speed: [15, 50], colors: [C.gray, C.purple], shape: 'sq', size: 2, life: [0.2, 0.35] });
      } else if (input.pressed('special') && pl.specialCD <= 0) { pl.spinFace = pl.face; startMove('spin'); }
      else if (input.pressed('attack')) {
        if (mx) pl.face = mx;
        if (pl.running) startMove('slide');
        else startMove(pl.chain && pl.chainT > 0 && MOVES[pl.chain].next ? MOVES[pl.chain].next : 'jab1');
      } else {
        const sp = pl.running ? P.runSpeed : P.walkX;
        pl.vx = approach(pl.vx, mx * sp, P.accel * dt);
        pl.vy = approach(pl.vy, ax.y * P.walkZ, P.accel * dt);
        if (mx) pl.face = mx;
        const moving = Math.abs(pl.vx) > 5 || Math.abs(pl.vy) > 5;
        pl.state = moving ? 'walk' : 'idle';
        if (moving) walkPose(pl, dt, sp, pl.running && Math.abs(pl.vx) > P.walkX);
        else setPose(pl, dt, Math.floor(time * 2.5) % 2 ? 'guard2' : 'guard');
        if (pl.running && moving && Math.random() < 0.3) parts.add({ x: pl.x - pl.face * 5, y: pl.y, vx: -pl.face * 20, vy: -10, life: 0.25, colors: [C.gray, C.purple], shape: 'sq', size: 2 });
      }
    }
    // 物理（被打飛／倒地時由 updateFallen 處理）
    if (pl.state === 'air' || pl.state === 'down' || pl.state === 'getup') { pl.x = clamp(pl.x, 10, WW - 10); return; }
    pl.x += pl.vx * dt; pl.y += pl.vy * dt;
    if (pl.state === 'jump' || pl.z > 0) {
      pl.vz -= P.gravity * dt; pl.z += pl.vz * dt;
      if (pl.z <= 0 && pl.state === 'jump') {
        pl.z = 0; pl.vz = 0; pl.state = pl.atk && pl.atk.name === 'airKick' ? 'idle' : 'idle'; pl.atk = null;
        sfx.land(); parts.burst(pl.x, pl.y, 4, { dir: -Math.PI / 2, spread: 2.8, speed: [15, 40], colors: [C.gray, C.purple], shape: 'sq', size: 2, life: [0.2, 0.3] });
      }
    }
    pl.x = clamp(pl.x, 10, WW - 10); pl.y = clamp(pl.y, FLOOR_TOP, FLOOR_BOT);
  }
  function movePose(a) {
    const [pw, pa, pr] = a.m.poses;
    return a.f <= a.S ? pw : a.f <= a.S + a.A + (a.m.spin ? 0 : 2) ? pa : pr;
  }

  // ---------------- 命中判定 ----------------
  function checkPlayerHits() {
    const a = pl.atk;
    if (!a || a.f <= a.S || a.f > a.S + a.A) return;
    const m = a.m;
    for (const e of enemies) {
      if (e.dead || a.hit.has(e) || e.inv > 0) continue;
      if (e.state === 'down' && !P.otg) continue;
      if (e.state === 'air' && e.juggles >= P.juggleLimit) continue;
      if (Math.abs(e.y - pl.y) > P.depthTol) continue;
      const rx = (e.x - pl.x) * (m.spin ? sign(e.x - pl.x) || 1 : pl.face);
      const r0 = m.reach[0] * P.reachMul, r1 = m.reach[1] * P.reachMul;
      if (m.spin ? Math.abs(e.x - pl.x) > r1 + 6 : (rx < r0 - 6 || rx > r1 + 6)) continue;
      const ez0 = e.state === 'down' ? e.z : e.z + 2, ez1 = e.state === 'down' ? e.z + 10 : e.z + 30;
      const az0 = pl.z + m.zr[0], az1 = pl.z + m.zr[1];
      if (az1 < ez0 || az0 > ez1) continue;
      a.hit.add(e);
      hitEnemy(e, a, m.spin ? (sign(e.x - pl.x) || 1) : pl.face);
    }
  }
  function hitEnemy(e, a, dir) {
    const m = a.m;
    combo++; comboT = 2.2; lastHit = time; bestCombo = Math.max(bestCombo, combo);
    target = e;
    e.hp -= m.dmg;
    e.flash = P.flashFrames / 60;
    const armored = e.kind === 'bear' && P.superArmor && (e.state === 'wind' || e.state === 'attack');
    const air = e.state === 'air' || e.z > 1;
    {
      if (armored && e.hp > 0) {
        e.vx += dir * 15;
        floats.add(e.x, e.y - e.z - 44, 'ARMOR', C.lcyan, { outline: C.ink });
      } else if (air) {
        e.juggles++;
        e.vz = Math.max(e.vz, m.launch ? P.launch * m.launch * 0.8 : P.juggleLift);
        e.vx = dir * (m.launch ? 40 : 25);
        e.state = 'air'; e.bounced = false;
      } else if (m.launch) {
        e.state = 'air'; e.z = Math.max(e.z, 1); e.vz = P.launch * m.launch; e.vx = dir * 45; e.juggles = 0; e.bounced = false;
      } else if (m.knockdown) {
        e.state = 'air'; e.z = Math.max(e.z, 1); e.vz = 150; e.vx = dir * P.knock; e.juggles = P.juggleLimit; e.bounced = false;
      } else {
        e.state = 'hurt'; e.stateT = P.hitstun / 1000; e.vx = dir * P.push * (m.push || 1) / e.def.weight; e.atk = null;
        releaseToken(e);
      }
      if (!armored) { e.face = -dir; releaseToken(e); if (e.state !== 'hurt') e.atk = null; }
    }
    if (e.kind === 'trainee' && e.hp < 1000) e.hp = e.maxHp;
    const fin = !!m.finisher;
    const stop = (fin ? P.hitstopFinisher : P.hitstop) + clamp(P.hitstopGrowth * (combo - 1), -40, 60);
    hitstop = Math.max(hitstop, Math.max(0, stop) / 1000);
    e.shakeT = hitstop;
    pl.shakeT = 0;
    shake.add(fin ? P.shakeFinisher : P.shake, fin ? 280 : 140, dir, fin && m.launch ? -1 : 0);
    if (fin && P.impactFrame) impactT = 3 / 60;
    // 火花
    // 火花位置：敵人身體靠攻擊方向的一側，高度取招式判定的中段
    const hx = e.x - dir * 5;
    const hy = e.y - e.z - clamp(pl.z - e.z + (m.zr[0] + m.zr[1]) / 2, 4, e.state === 'down' ? 8 : 26);
    const sz = P.sparkSize;
    if (sz > 0) {
      parts.add({ x: hx, y: hy, shape: 'star', size: Math.round((fin ? 9 : 5) * sz), life: fin ? 0.14 : 0.09, colors: [C.white, C.yellow] });
      parts.burst(hx, hy, Math.round((fin ? 12 : 7) * sz), { dir: dir > 0 ? 0 : Math.PI, spread: 2.2, speed: [80, 220], colors: [C.white, C.lcyan, C.cyan], shape: 'line', len: 0.03, life: [0.1, 0.22], drag: 6 });
      parts.burst(hx, hy, Math.round(5 * sz), { speed: [30, 90], colors: [C.yellow, C.pink, C.orange], shape: 'sq', size: 2, life: [0.2, 0.4], gravity: 150 });
      if (fin) parts.add({ x: hx, y: hy, shape: 'ring', r0: 4, r1: 26, life: 0.25, colors: [C.white, C.pink, C.plum] });
      if (e.kind !== 'bear') parts.burst(e.x, e.y - e.z - 18, 3, { speed: [20, 60], colors: [e.kind === 'trainee' ? C.lcyan : C.lpink, C.white], shape: 'sq', size: 2, life: [0.4, 0.7], gravity: 60, drag: 1 }); // 布偶的絨毛
    }
    if (P.damageNumbers) floats.add(e.x + rand(-6, 6), e.y - e.z - 40 - (combo % 3) * 4, m.dmg, fin ? C.yellow : C.white, { small: !fin, outline: C.ink });
    sfx.hit(m.sound, combo);
    if (e.kind !== 'bear') sfx.squeak();
    // 連段評價
    for (const [n, t, i] of [[5, 'NICE', 0], [10, 'GREAT', 1], [20, 'AWESOME', 2], [35, 'WILD!', 3]]) if (combo === n) { rankText = { t, age: 0 }; sfx.rank(i); }
    if (e.hp <= 0 && e.kind !== 'trainee') { e.dying = true; if (e.state !== 'air') { e.state = 'air'; e.z = Math.max(e.z, 1); e.vz = 160; e.vx = dir * P.knock; } }
  }

  // ---------------- 敵人 ----------------
  function releaseToken(e) { e.token = false; }
  function tokensInUse() { return enemies.filter(x => x.token && !x.dead).length; }
  function updateFallen(f, dt, isPlayer) {
    if (f.state === 'air') {
      f.vz -= (isPlayer ? P.gravity : P.juggleGravity) * dt; f.z += f.vz * dt;
      f.x += f.vx * dt; f.vx = approach(f.vx, 0, 30 * dt);
      setPose(f, dt, 'air');
      if (f.z <= 0 && f.vz < 0) {
        f.z = 0;
        if (!f.bounced) { f.bounced = true; f.vz = 95; f.z = 0.5; f.vx *= 0.5; sfx.thud(); shake.add(1.5, 100); parts.burst(f.x, f.y, 8, { dir: -Math.PI / 2, spread: 2.8, speed: [20, 70], colors: [C.gray, C.purple, C.navy], shape: 'sq', size: 2, life: [0.25, 0.45] }); }
        else { f.state = 'down'; f.stateT = isPlayer ? 0.6 : P.downTime; f.vx = 0; f.vz = 0; sfx.land(); }
      }
    } else if (f.state === 'down') {
      f.stateT -= dt;
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
    if (e.state === 'dead') { e.stateT -= dt; if (e.stateT <= 0) e.dead = true; return; }
    if (e.state === 'air' || e.state === 'down' || e.state === 'getup') { updateFallen(e, dt, false); e.x = clamp(e.x, 8, WW - 8); return; }
    const d = e.def, spd = d.speed * P.enemySpeed;
    const dx = pl.x - e.x, dy = pl.y - e.y;
    if (e.state === 'hurt') {
      e.stateT -= dt; e.vx = approach(e.vx, 0, 700 * dt); setPose(e, dt, 'hurt');
      if (e.stateT <= 0) { e.state = 'idle'; e.cd = Math.max(e.cd, 0.3); }
    } else if (e.state === 'wind') {
      e.stateT -= dt; e.vx = approach(e.vx, 0, 600 * dt); e.vy = 0;
      setPose(e, dt, e.kind === 'bear' ? 'slamWind' : 'wind');
      if (e.stateT <= 0) { e.state = 'attack'; e.stateT = e.kind === 'bear' ? 0.22 : 0.12; e.hitDone = false; e.vx = e.face * (e.kind === 'bear' ? 70 : 90); }
    } else if (e.state === 'attack') {
      e.stateT -= dt; e.vx = approach(e.vx, 0, 500 * dt);
      setPose(e, dt, e.kind === 'bear' ? 'slam' : 'punch');
      if (!e.hitDone) enemyHitCheck(e);
      if (e.stateT <= 0) { e.state = 'recover'; e.stateT = e.kind === 'bear' ? 0.6 : 0.35; }
    } else if (e.state === 'recover') {
      e.stateT -= dt; setPose(e, dt, 'guard');
      if (e.stateT <= 0) { e.state = 'idle'; e.cd = rand(0.6, 1.4); releaseToken(e); }
    } else if (e.kind === 'trainee') {
      setPose(e, dt, Math.floor(e.t * 2) % 2 ? 'guard2' : 'guard'); e.vx = approach(e.vx, 0, 400 * dt);
      e.face = sign(dx) || e.face;
    } else {
      // 追蹤：站到玩家左右兩側，拿到「出手權」才靠近出拳
      e.side = e.x < pl.x ? -1 : 1;
      const want = e.token ? 22 : 58;
      const tx = pl.x + e.side * want, ty = pl.y + (e.token ? 0 : (e.t % 6 < 3 ? -10 : 10));
      const ddx = tx - e.x, ddy = ty - e.y;
      const moving = P.enemyAggro && (Math.abs(ddx) > 3 || Math.abs(ddy) > 2);
      e.vx = approach(e.vx, moving ? sign(ddx) * spd * (Math.abs(ddx) > 3 ? 1 : 0) : 0, 600 * dt);
      e.vy = approach(e.vy, moving ? sign(ddy) * spd * 0.6 * (Math.abs(ddy) > 2 ? 1 : 0) : 0, 600 * dt);
      e.face = sign(dx) || e.face;
      if (Math.abs(e.vx) > 5 || Math.abs(e.vy) > 5) walkPose(e, dt, spd, false); else setPose(e, dt, Math.floor(e.t * 2) % 2 ? 'guard2' : 'guard');
      if (P.enemyAggro && !e.token && e.cd <= 0 && tokensInUse() < P.attackTokens && pl.state !== 'down') e.token = true;
      if (e.token && Math.abs(Math.abs(dx) - 22) < 8 && Math.abs(dy) < 5 && e.cd <= 0 && pl.z < 10) {
        e.state = 'wind'; e.stateT = d.windT / P.enemySpeed; sfx.wind();
        floats.add(e.x, e.y - 46, '!', C.yellow, { small: false, outline: C.ink, life: 0.4, vy: -15 });
      }
    }
    e.x += e.vx * dt; e.y += e.vy * dt;
    e.x = clamp(e.x, 8, WW - 8); e.y = clamp(e.y, FLOOR_TOP, FLOOR_BOT);
  }
  function enemyHitCheck(e) {
    if (pl.inv > 0 || pl.state === 'down' || pl.state === 'getup' || pl.state === 'air') return;
    const d = e.def;
    const rx = (pl.x - e.x) * e.face;
    if (rx < d.reach[0] - 5 || rx > d.reach[1] + 6 || Math.abs(pl.y - e.y) > 8 || pl.z > 20) return;
    e.hitDone = true;
    pl.hp -= d.dmg; pl.flash = 0.08; combo = 0; pl.atk = null; pl.chain = null;
    hitstop = Math.max(hitstop, 0.07);
    shake.add(d.heavy ? 4 : 2.5, 200, e.face, 0);
    parts.add({ x: pl.x - e.face * 3, y: pl.y - 22, shape: 'star', size: 5, life: 0.1, colors: [C.white, C.red] });
    parts.burst(pl.x, pl.y - 20, 8, { speed: [40, 120], colors: [C.white, C.red, C.pink], shape: 'sq', size: 2, life: [0.2, 0.4] });
    sfx.hurt();
    if (d.heavy) { pl.state = 'air'; pl.z = 1; pl.vz = 170; pl.vx = e.face * 110; pl.bounced = false; pl.inv = 0; }
    else { pl.state = 'hurt'; pl.stateT = 0.3; pl.vx = e.face * 90; pl.inv = 0.25; }
    if (pl.hp <= 0) { pl.hp = pl.maxHp; floats.add(pl.x, pl.y - 50, 'RESTORE', C.cyan, { small: false, outline: C.ink, life: 1.2 }); }
  }
  function spawnEnemy() {
    const left = Math.random() < 0.5;
    const x = clamp(left ? cam.x - 20 : cam.x + W + 20, 10, WW - 10);
    const e = makeEnemy(Math.random() < 0.3 ? 'bear' : 'rabbit', x, rand(FLOOR_TOP + 4, FLOOR_BOT - 4));
    e.cd = rand(0.8, 1.6);
    enemies.push(e);
  }

  // ---------------- 主更新 ----------------
  function update(dt) {
    time += dt;
    shake.update(dt);
    if (impactT > 0) impactT -= dt;
    if (hitstop > 0) { hitstop -= dt; return; }
    updatePlayer(dt);
    checkPlayerHits();
    for (const e of enemies) updateEnemy(e, dt);
    // 敵人之間輕微推開
    for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i], b = enemies[j];
      if (a.state === 'air' || b.state === 'air' || a.dead || b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 6) { const s = dx >= 0 ? 1 : -1; a.x -= s * 20 * dt; b.x += s * 20 * dt; }
    }
    enemies = enemies.filter(e => !e.dead);
    const alive = enemies.filter(e => e.kind !== 'trainee').length;
    if (alive < P.enemyCount) { spawnT -= dt; if (spawnT <= 0) { spawnEnemy(); spawnT = 1.4; } }
    parts.update(dt); floats.update(dt);
    if (comboT > 0 && (comboT -= dt) <= 0) combo = 0;
    if (rankText) { rankText.age += dt; if (rankText.age > 1.2) rankText = null; }
    if (hintT > 0) hintT -= dt;
    if (target && (target.dead || !enemies.includes(target))) target = null;
    // 攤位蒸氣
    if (Math.random() < 0.25) { const sx = pick([128, 318, 530, 742, 900]); parts.add({ x: sx + rand(-4, 4), y: 88, vx: rand(-4, 4), vy: rand(-18, -10), life: rand(1, 1.8), colors: [C.gray, C.gray, C.purple], shape: 'sq', size: 2, shrink: 0.3, drag: 0.5, bg: true }); }
    cam.follow(pl.x + pl.face * P.camLead, H / 2, dt, { smooth: P.camSmooth });
  }

  // ---------------- 背景 ----------------
  function buildBackground() {
    const sky = makeLayer(W, FLOOR_TOP, PALETTE, p => {
      for (let y = 0; y < FLOOR_TOP; y++) {
        const t = y / FLOOR_TOP;
        const [a, b, f] = t < 0.5 ? [C.ink, C.navy, t / 0.5] : [C.navy, C.purple, (t - 0.5) / 0.5 * 0.7];
        p.rect(0, y, W, 1, a); p.dither(0, y, W, 1, b, Math.round(f * 16));
      }
      let s = 7; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
      for (let i = 0; i < 30; i++) p.px(r() * W, r() * 40, r() < 0.3 ? C.white : C.gray);
    });
    const farW = W + Math.ceil((WW - W) * 0.3) + 4;
    const far = makeLayer(farW, FLOOR_TOP, PALETTE, p => {
      let s = 11; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
      let x = 0;
      while (x < farW) {
        const w = 18 + Math.floor(r() * 26), h = 30 + Math.floor(r() * 50);
        p.rect(x, FLOOR_TOP - h, w, h, r() < 0.5 ? C.navy : C.ink);
        for (let wy = FLOOR_TOP - h + 4; wy < FLOOR_TOP - 20; wy += 5) for (let wx = x + 3; wx < x + w - 3; wx += 4) if (r() < 0.35) p.rect(wx, wy, 2, 2, pick([C.yellow, C.cyan, C.plum, C.purple]));
        if (r() < 0.25) { const bw = Math.min(w - 4, 16); p.rect(x + 2, FLOOR_TOP - h - 9, bw, 8, C.ink); p.rect(x + 3, FLOOR_TOP - h - 8, bw - 2, 6, pick([C.pink, C.cyan])); }
        x += w + Math.floor(r() * 6);
      }
      // 遠方廟宇屋頂
      const cx = farW * 0.55;
      for (let k = 0; k < 10; k++) p.rect(cx - 40 + k * 2, 70 - k * 2, 80 - k * 4, 2, C.plum);
      p.rect(cx - 30, 70, 60, FLOOR_TOP - 70, C.navy);
      p.px(cx - 40, 69, C.yellow); p.px(cx + 39, 69, C.yellow);
    });
    const stalls = makeLayer(WW, FLOOR_TOP + 4, PALETTE, p => {
      let s = 21; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
      const base = FLOOR_TOP;
      // 地面邊緣（人行道）
      p.rect(0, base - 6, WW, 6, C.gray);
      p.rect(0, base - 6, WW, 1, C.white);
      p.rect(0, base - 1, WW, 1, C.ink);
      const colors = [[C.red, C.white], [C.pink, C.white], [C.cyan, C.white], [C.orange, C.yellow]];
      let x = 30;
      let i = 0;
      while (x < WW - 60) {
        const w = 76 + Math.floor(r() * 30), top = base - 64;
        const [c1, c2] = colors[i % colors.length];
        // 攤位骨架與櫃台
        p.rect(x, top + 16, 3, 48, C.wood); p.rect(x + w - 3, top + 16, 3, 48, C.wood);
        p.rect(x - 2, base - 26, w + 4, 20, C.wood);
        p.rect(x - 2, base - 26, w + 4, 2, C.orange);
        p.rect(x - 2, base - 8, w + 4, 2, C.ink);
        for (let k = x; k < x + w; k += 10) p.rect(k, base - 22, 1, 13, C.ink);
        // 攤位內部（暖光）
        p.rect(x + 3, top + 16, w - 6, 22, C.plum);
        p.dither(x + 3, top + 16, w - 6, 22, C.orange, 3);
        // 食物與鍋子
        for (let k = 0; k < 5; k++) { const fx = x + 8 + k * (w - 16) / 5; p.circle(fx, base - 29, 3, pick([C.yellow, C.orange, C.red, C.lpink, C.white])); p.px(fx - 1, base - 30, C.white); }
        // 條紋遮雨棚
        for (let k = 0; k < w + 8; k++) {
          const cc = Math.floor(k / 6) % 2 ? c1 : c2;
          p.rect(x - 4 + k, top + 6, 1, 10, cc);
          if (k % 6 === 3) p.rect(x - 4 + k, top + 16, 1, 2, cc);
        }
        p.rect(x - 4, top + 5, w + 8, 1, C.ink);
        // 霓虹招牌（仿文字的像素圖樣）
        const sw = Math.min(w - 10, 44), sx = x + (w - sw) / 2;
        p.rect(sx - 1, top - 9, sw + 2, 14, C.ink);
        p.rect(sx, top - 8, sw, 12, C.navy);
        const nc = i % 2 ? C.pink : C.cyan;
        p.rect(sx, top - 8, sw, 1, nc); p.rect(sx, top + 3, sw, 1, nc); p.rect(sx, top - 8, 1, 12, nc); p.rect(sx + sw - 1, top - 8, 1, 12, nc);
        for (let gx = sx + 4; gx < sx + sw - 7; gx += 9) {
          const gl = Math.floor(r() * 4);
          p.rect(gx, top - 5, 6, 1, C.yellow); p.rect(gx + 2, top - 5, 1, 6, C.yellow);
          if (gl & 1) p.rect(gx, top - 2, 6, 1, C.yellow); else p.rect(gx + 4, top - 3, 1, 4, C.yellow);
          if (gl & 2) p.rect(gx, top, 3, 1, C.yellow);
        }
        x += w + 24 + Math.floor(r() * 14); i++;
      }
      // 廟口牌樓（右端地標）
      const gx = WW - 70;
      p.rect(gx, base - 70, 6, 64, C.red); p.rect(gx + 50, base - 70, 6, 64, C.red);
      p.rect(gx - 10, base - 78, 76, 8, C.red); p.rect(gx - 14, base - 82, 84, 4, C.yellow);
      p.rect(gx + 14, base - 70, 28, 10, C.yellow); p.rect(gx + 16, base - 68, 24, 6, C.red);
    });
    const floor = makeLayer(WW, H - FLOOR_TOP, PALETTE, p => {
      const h = H - FLOOR_TOP;
      p.rect(0, 0, WW, h, C.purple);
      // 透視地磚：越近越寬
      const rows = [0, 5, 11, 18, 26, 35, 45, 56];
      for (const ry of rows) p.rect(0, ry, WW, 1, C.navy);
      for (let k = 0; k < rows.length - 1; k++) {
        const y0 = rows[k], y1 = rows[k + 1], step = 24 + k * 6;
        for (let x = (k % 2) * step / 2; x < WW; x += step) p.rect(Math.round(x + k * 1.5), y0, 1, y1 - y0, C.navy);
      }
      p.dither(0, 0, WW, 8, C.navy, 5);
      // 霓虹倒影（水窪）
      let s = 31; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
      for (let i = 0; i < 14; i++) {
        const px = r() * WW, py = 12 + r() * (h - 18), pw = 14 + r() * 22, c = pick([C.pink, C.cyan, C.yellow]);
        p.ellipse(px, py, pw / 2, 2.5, C.navy);
        for (let k = 0; k < pw * 0.6; k++) if (r() < 0.6) p.px(px - pw / 3 + k, py + Math.round(r() * 2 - 1), c);
      }
      // 人孔蓋
      for (const mx of [220, 610]) { p.ellipse(mx, 30, 10, 4, C.navy); p.ellipse(mx, 30, 8, 3, C.gray); for (let k = -6; k <= 6; k += 3) p.rect(mx + k, 29, 1, 3, C.navy); }
    });
    return { sky, far, stalls, floor };
  }
  function drawLanterns() {
    // 攤位間的燈籠串（執行時繪製，會輕微搖晃）
    for (let x = 16; x < WW; x += 34) {
      if (x + 30 < cam.x - 20 || x > cam.x + W + 20) continue;
      const sway = Math.sin(time * 1.6 + x * 0.05) * 1.5;
      const ly = 40 + Math.sin(x * 0.02) * 3;
      g.line(x - 17, 34, x, ly - 6, C.ink);
      g.line(x, ly - 6, x + 17, 34, C.ink);
      const lx = x + sway;
      g.rect(lx - 3, ly - 5, 7, 9, C.ink);
      g.rect(lx - 2, ly - 4, 5, 7, (x / 34) % 3 === 0 ? C.yellow : C.red);
      g.rect(lx - 2, ly - 1, 5, 1, C.orange);
      g.px(lx, ly + 4, C.yellow);
    }
    // 招牌閃爍：隨機一兩個招牌暗掉
  }
  function drawShadow(f) {
    const w = f.kind === 'bear' ? 9 : 7;
    const k = clamp(1 - f.z / 80, 0.4, 1);
    g.ellipse(f.x, f.y, Math.round(w * k), Math.max(1, Math.round(2 * k)), C.navy);
  }
  function drawHUD() {
    g.screenSpace();
    // 玩家血條
    g.text('AMANG', 6, 5, C.yellow, { outline: C.ink });
    g.rect(40, 6, 72, 7, C.ink); g.rect(41, 7, 70, 5, C.plum);
    g.rect(41, 7, Math.round(70 * clamp(pl.hp / pl.maxHp, 0, 1)), 5, C.yellow); g.rect(41, 7, Math.round(70 * clamp(pl.hp / pl.maxHp, 0, 1)), 1, C.white);
    if (pl.specialCD > 0) g.rect(41, 14, Math.round(70 * (1 - clamp(pl.specialCD / Math.max(0.01, P.specialCD), 0, 1))), 1, C.cyan);
    else g.text('SPECIAL OK', 41, 15, C.cyan, { small: true });
    // 目標敵人血條
    if (target && target.kind !== 'trainee') {
      g.text(target.def.name, 6, 24, C.lpink, { small: true, outline: C.ink });
      g.rect(6, 31, 60, 4, C.ink);
      g.rect(7, 32, Math.round(58 * clamp(target.hp / target.maxHp, 0, 1)), 2, C.pink);
    } else if (target) g.text('TRAINEE', 6, 24, C.lcyan, { small: true, outline: C.ink });
    // 連段
    if (combo >= 2) {
      const pop = time - lastHit < 0.06 ? 1 : 0;
      g.text(String(combo), W - 40, 6 - pop, combo >= 20 ? C.pink : combo >= 10 ? C.yellow : C.white, { scale: 2, align: 'right', outline: C.ink });
      g.text('HITS', W - 36, 11, C.cyan, { outline: C.ink });
      g.rect(W - 70, 23, Math.round(64 * clamp(comboT / 2.2, 0, 1)), 1, C.cyan);
    }
    if (rankText && Math.floor(rankText.age * 12) % 2 === 0) g.text(rankText.t, W - 8, 28, C.yellow, { align: 'right', outline: C.ink, scale: rankText.t.length > 5 ? 1 : 2 });
    g.text('BEST ' + bestCombo, W - 6, H - 10, C.gray, { small: true, align: 'right', outline: C.ink });
    if (hintT > 0 && (hintT > 1.5 || Math.floor(hintT * 6) % 2)) g.text('Z PUNCH  X JUMP  C SPIN  2xDIR RUN', W / 2, H - 10, C.white, { small: true, align: 'center', outline: C.ink });
  }
  function drawHitboxes() {
    const box = (x0, y0, x1, y1, c) => { g.rect(x0, y0, x1 - x0, 1, c); g.rect(x0, y1, x1 - x0, 1, c); g.rect(x0, y0, 1, y1 - y0, c); g.rect(x1, y0, 1, y1 - y0 + 1, c); };
    for (const f of [pl, ...enemies]) {
      if (f.dead) continue;
      const top = f.state === 'down' ? 10 : 30;
      box(f.x - 6, f.y - f.z - top, f.x + 6, f.y - f.z - 2, f.inv > 0 ? C.yellow : C.cyan);
      g.rect(f.x - 12, f.y - P.depthTol, 1, P.depthTol * 2, C.gray);
    }
    const a = pl.atk;
    if (a && a.f > a.S && a.f <= a.S + a.A) {
      const m = a.m, r0 = m.reach[0] * P.reachMul, r1 = m.reach[1] * P.reachMul;
      const x0 = m.spin ? pl.x - r1 : pl.face > 0 ? pl.x + r0 : pl.x - r1, x1 = m.spin ? pl.x + r1 : pl.face > 0 ? pl.x + r1 : pl.x - r0;
      box(x0, pl.y - pl.z - m.zr[1], x1, pl.y - pl.z - m.zr[0], C.pink);
    }
  }
  function render() {
    g.screenSpace();
    const cx = Math.round(cam.x + shake.x), cy = Math.round(shake.y);
    if (impactT > 0) { // 衝擊格：白底＋黑色剪影
      g.clear(C.white);
      g.camera(cx, cy);
      const all = [pl, ...enemies].filter(f => !f.dead).sort((a, b) => a.y - b.y);
      for (const f of all) drawRig(f, C.ink);
      g.screenSpace();
      g.text(String(combo), W - 40, 6, C.ink, { scale: 2, align: 'right' });
      return;
    }
    g.ctx.drawImage(bg.sky, 0, 0);
    g.ctx.drawImage(bg.far, -Math.round(cx * 0.3), 0);
    g.camera(cx, cy);
    g.ctx.drawImage(bg.stalls, 0, -4);
    g.ctx.drawImage(bg.floor, 0, FLOOR_TOP);
    parts.draw(g, p => p.bg);
    drawLanterns();
    const all = [pl, ...enemies].filter(f => !f.dead);
    for (const f of all) drawShadow(f);
    all.sort((a, b) => a.y - b.y);
    for (const f of all) drawRig(f);
    parts.draw(g, p => !p.bg);
    floats.draw(g);
    if (P.showHitbox) drawHitboxes();
    // 前景：路燈柱（視差 1.3，比場景移動得快，增加縱深感）
    g.screenSpace();
    for (let x = 260; x < WW * 1.3; x += 430) {
      const sx = Math.round(x - cx * 1.3);
      if (sx < -12 || sx > W + 12) continue;
      g.rect(sx, 64, 3, H - 64, C.ink);
      g.rect(sx - 5, 60, 13, 5, C.ink); g.rect(sx - 4, 61, 11, 2, C.yellow);
    }
    drawHUD();
  }
  function debugLines() {
    const a = pl.atk;
    return [
      `STATE ${pl.state.toUpperCase()}${a ? ' ' + a.name.toUpperCase() + ' F' + a.f : ''}  ${pl.running ? 'RUN' : ''}`,
      `X ${pl.x.toFixed(0)} Y ${pl.y.toFixed(0)} Z ${pl.z.toFixed(0)}`,
      `COMBO ${combo}  BEST ${bestCombo}  HITSTOP ${Math.max(0, hitstop * 1000).toFixed(0)}`,
      `ENEMY ${enemies.length}  TOKENS ${tokensInUse()}`,
    ];
  }
  function stageCover() {
    reset();
    P.enemyAggro = P.enemyAggro;
    const e = enemies[0];
    e.x = pl.x + 18; e.y = pl.y;
    startMove('upper'); pl.atk.f = pl.atk.S;
    cam.center(pl.x + 40, H / 2);
  }

  reset();
  return { update, render, reset, debugLines, stageCover, peek: () => ({ pl, enemies, combo, bestCombo, hitstop }) };
}

runPrototype({
  id: 'night-market-brawler',
  title: '夜市拳姬',
  subtitle: '原型 C・清版格鬥',
  width: W, height: H, palette: PALETTE, ui: { text: C.white, dark: C.ink },
  input: {
    left: { keys: ['ArrowLeft', 'KeyA'] }, right: { keys: ['ArrowRight', 'KeyD'] },
    up: { keys: ['ArrowUp', 'KeyW'] }, down: { keys: ['ArrowDown', 'KeyS'] },
    attack: { keys: ['KeyZ', 'KeyJ'], pad: [2] },
    jump: { keys: ['KeyX', 'KeyK', 'Space'], pad: [0] },
    special: { keys: ['KeyC', 'KeyL'], pad: [1, 3] },
    run: { keys: ['ShiftLeft', 'ShiftRight'], pad: [5] },
  },
  touch: [{ action: 'special', label: '旋' }, { action: 'jump', label: '跳' }, { action: 'run', label: '跑' }, { action: 'attack', label: '拳', big: true }],
  tuning: TUNING,
  intro: INTRO,
  create,
});
