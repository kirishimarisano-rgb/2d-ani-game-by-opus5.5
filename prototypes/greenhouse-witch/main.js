// 《溫室魔女的剪定日》原型 B：俯視角動作 Roguelite
// 見習魔女茴香用園藝鐮刀修剪暴走的植物魔物。這個原型只測「移動與攻擊的手感」，一個房間、無限波次。
import { runPrototype } from '../engine/app.js';
import { Sprite, makeLayer, TAU, BAYER4 } from '../engine/pixel.js';
import { Particles, Shaker, Camera, Floaters, clamp, rand, sign, smoothK, lerp, pick } from '../engine/fx.js';
import { PALETTE, buildSprites } from './sprites.js';

const W = 320, H = 180, T = 16, MW = 30, MH = 19, WW = MW * T, WH = MH * T;
const C = { ink: 0, shadow: 1, plum: 2, mauve: 3, cream: 4, white: 5, dleaf: 6, leaf: 7, lleaf: 8, lime: 9, soil: 10, terra: 11, peach: 12, skin: 13, pink: 14, teal: 15 };
const DEG = Math.PI / 180;

// ---------------- 房間 ----------------
const PLANTERS = [[6, 5], [21, 5], [6, 12], [21, 12]];
const POTS = [[3, 4], [26, 4], [3, 15], [26, 15], [12, 3], [17, 3], [12, 16], [17, 16], [14, 10]];
function buildMap() {
  const m = Array.from({ length: MH }, () => Array(MW).fill('.'));
  const fill = (x0, x1, y0, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y][x] = ch; };
  fill(0, MW - 1, 0, 1, '#'); fill(0, MW - 1, MH - 1, MH - 1, '#');
  fill(0, 0, 0, MH - 1, '#'); fill(MW - 1, MW - 1, 0, MH - 1, '#');
  for (const [x, y] of PLANTERS) fill(x, x + 2, y, y + 1, 'P');
  return m.map(r => r.join(''));
}
const MAP = buildMap();
const solid = (tx, ty) => tx < 0 || ty < 0 || tx >= MW || ty >= MH || MAP[ty][tx] !== '.';
const SPAWN = { x: 15 * T, y: 13 * T };
const DUMMY_AT = { x: 15 * T, y: 6 * T + 8 };

// ---------------- 調參面板 ----------------
const TUNING = {
  groups: [
    { name: '移動', items: [
      { key: 'moveSpeed', label: '最高速度', min: 40, max: 220, step: 1, value: 96, unit: 'px/s' },
      { key: 'accel', label: '加速度', min: 100, max: 9000, step: 50, value: 1100, unit: 'px/s²', hint: '從靜止到全速的快慢。' },
      { key: 'friction', label: '減速度', min: 100, max: 9000, step: 50, value: 1400, unit: 'px/s²', hint: '放開方向鍵後停下的快慢，小＝會滑。' },
      { key: 'turnBoost', label: '轉向加成', min: 1, max: 4, step: 0.1, value: 1.8, unit: '×', hint: '往反方向輸入時的加速度倍率，越大轉身越俐落。' },
      { key: 'diagNormalize', label: '斜向速度一致', type: 'toggle', value: true, hint: '關閉時斜走會比直走快 1.4 倍（早期遊戲的感覺）。' },
    ] },
    { name: '翻滾', items: [
      { key: 'rollSpeed', label: '翻滾速度', min: 80, max: 600, step: 10, value: 230, unit: 'px/s', hint: '平均速度；翻滾距離＝速度 × 時間。' },
      { key: 'rollTime', label: '翻滾時間', min: 0.1, max: 0.6, step: 0.01, value: 0.28, unit: '秒' },
      { key: 'rollCurve', label: '爆發曲線', min: 1, max: 4, step: 0.1, value: 1.8, unit: '', hint: '1＝等速；越大越是「一開始爆衝、後段減速」。' },
      { key: 'rollIframes', label: '無敵時段', min: 0, max: 1, step: 0.05, value: 0.75, unit: '×', hint: '翻滾開始後多少比例的時間是無敵的。' },
      { key: 'rollCooldown', label: '翻滾冷卻', min: 0, max: 1.5, step: 0.02, value: 0.16, unit: '秒' },
      { key: 'rollCancel', label: '攻擊後搖可翻滾取消', type: 'toggle', value: true },
      { key: 'perfectDodge', label: '完美閃避（子彈時間）', type: 'toggle', value: true, hint: '翻滾剛開始時與攻擊擦身而過，敵人會暫時變慢。' },
      { key: 'perfectWindow', label: '完美閃避判定', min: 0.02, max: 0.4, step: 0.01, value: 0.12, unit: '秒' },
      { key: 'perfectSlow', label: '子彈時間倍率', min: 0.1, max: 0.9, step: 0.05, value: 0.3, unit: '×' },
      { key: 'perfectDur', label: '子彈時間長度', min: 0.2, max: 3, step: 0.1, value: 1.2, unit: '秒' },
    ] },
    { name: '攻擊', items: [
      { key: 'startup', label: '前搖', min: 0, max: 12, step: 1, value: 3, unit: '格' },
      { key: 'active', label: '判定持續', min: 1, max: 12, step: 1, value: 5, unit: '格' },
      { key: 'recovery', label: '後搖', min: 0, max: 30, step: 1, value: 9, unit: '格' },
      { key: 'comboCancel', label: '連段接續時機', min: 0, max: 1, step: 0.05, value: 0.35, unit: '×' },
      { key: 'comboWindow', label: '連段輸入窗口', min: 0, max: 800, step: 10, value: 320, unit: 'ms' },
      { key: 'arc', label: '揮擊角度', min: 40, max: 300, step: 5, value: 150, unit: '°' },
      { key: 'radius', label: '揮擊半徑', min: 12, max: 48, step: 1, value: 27, unit: 'px' },
      { key: 'lunge', label: '攻擊前衝', min: 0, max: 400, step: 5, value: 110, unit: 'px/s' },
      { key: 'atkMove', label: '攻擊中移動倍率', min: 0, max: 1, step: 0.05, value: 0.2, unit: '×' },
      { key: 'aimMode', label: '瞄準方式', type: 'select', value: 'auto', options: [['move', '移動方向'], ['auto', '移動方向＋自動修正'], ['mouse', '滑鼠游標']] },
      { key: 'autoAim', label: '自動修正角度', min: 0, max: 90, step: 5, value: 35, unit: '°', hint: '在這個角度內有敵人時，揮擊會自動轉向它。' },
      { key: 'cutSpores', label: '可以斬斷孢子彈', type: 'toggle', value: true },
    ] },
    { name: '蓄力迴旋', items: [
      { key: 'chargeTime', label: '蓄力時間', min: 0.1, max: 1.5, step: 0.05, value: 0.5, unit: '秒', hint: '揮擊後繼續按住攻擊鍵開始蓄力，蓄滿放開＝迴旋斬。' },
      { key: 'chargeMove', label: '蓄力中移動倍率', min: 0, max: 1, step: 0.05, value: 0.45, unit: '×' },
      { key: 'spinRadius', label: '迴旋半徑', min: 16, max: 60, step: 1, value: 34, unit: 'px' },
      { key: 'spinTurns', label: '迴旋圈數', min: 1, max: 4, step: 1, value: 2, unit: '圈' },
    ] },
    { name: '打擊感', items: [
      { key: 'hitstop', label: '打擊停頓', min: 0, max: 250, step: 5, value: 55, unit: 'ms' },
      { key: 'hitstopFinisher', label: '終結技停頓', min: 0, max: 400, step: 5, value: 120, unit: 'ms' },
      { key: 'knock', label: '擊退力道', min: 0, max: 600, step: 10, value: 230, unit: 'px/s' },
      { key: 'finisherKnock', label: '終結技擊退倍率', min: 1, max: 4, step: 0.1, value: 1.9, unit: '×' },
      { key: 'enemyFriction', label: '敵人摩擦', min: 1, max: 20, step: 0.5, value: 6, unit: '', hint: '擊退後減速的快慢；小＝滑得遠。' },
      { key: 'wallSlam', label: '撞牆／撞人傷害', type: 'toggle', value: true, hint: '被擊飛的敵人撞到牆壁或其他敵人時，額外受傷並彈開。' },
      { key: 'slamSpeed', label: '撞擊門檻速度', min: 40, max: 400, step: 10, value: 150, unit: 'px/s' },
      { key: 'hitstun', label: '敵人硬直', min: 0, max: 1000, step: 10, value: 300, unit: 'ms' },
      { key: 'shake', label: '畫面震動', min: 0, max: 8, step: 0.5, value: 2.5, unit: 'px' },
      { key: 'shakeFinisher', label: '終結技震動', min: 0, max: 12, step: 0.5, value: 5, unit: 'px' },
      { key: 'flashFrames', label: '命中閃白', min: 0, max: 10, step: 1, value: 3, unit: '格' },
      { key: 'sparks', label: '火花＋葉片數量', min: 0, max: 30, step: 1, value: 10, unit: '個' },
      { key: 'smear', label: '刀光殘影', type: 'toggle', value: true },
      { key: 'damageNumbers', label: '傷害數字', type: 'toggle', value: true },
    ] },
    { name: '祝福（成長系統試玩）', note: '正式版中，每清完一個房間可以三選一獲得「祝福」，讓每一輪的打法都不同。這裡先開放三種讓你試手感：', items: [
      { key: 'vineDash', label: '荊棘衝刺：翻滾留下藤蔓', type: 'toggle', value: false },
      { key: 'crescent', label: '新月剪：第三擊射出劍氣', type: 'toggle', value: false },
      { key: 'pollen', label: '花粉爆裂：擊倒時爆炸連鎖', type: 'toggle', value: false },
    ] },
    { name: '受擊、鏡頭、敵人', open: false, items: [
      { key: 'iframes', label: '受擊無敵時間', min: 0, max: 3000, step: 50, value: 900, unit: 'ms' },
      { key: 'hurtKnock', label: '受擊擊退', min: 0, max: 500, step: 10, value: 200, unit: 'px/s' },
      { key: 'hurtHitstop', label: '受擊停頓', min: 0, max: 300, step: 5, value: 90, unit: 'ms' },
      { key: 'camLead', label: '鏡頭前瞻', min: 0, max: 60, step: 1, value: 18, unit: 'px' },
      { key: 'camSmooth', label: '鏡頭平滑', min: 0, max: 0.5, step: 0.01, value: 0.1, unit: '秒' },
      { key: 'enemyCount', label: '同時出現的敵人', min: 0, max: 10, step: 1, value: 4, unit: '隻' },
      { key: 'enemySpeed', label: '敵人速度倍率', min: 0.3, max: 2, step: 0.1, value: 1, unit: '×' },
      { key: 'enemyAggro', label: '敵人會主動攻擊', type: 'toggle', value: true },
    ] },
  ],
  presets: {
    '均衡（預設值）': {},
    '俐落閃避流': { accel: 2400, friction: 3000, rollSpeed: 280, rollTime: 0.24, rollCurve: 2.4, rollCooldown: 0.08, perfectWindow: 0.18, startup: 2, recovery: 6, comboCancel: 0.2, hitstop: 40 },
    '厚重揮砍流': { moveSpeed: 80, accel: 600, friction: 900, startup: 6, active: 6, recovery: 14, arc: 190, radius: 32, lunge: 180, hitstop: 95, hitstopFinisher: 190, knock: 360, finisherKnock: 2.4, enemyFriction: 4, shake: 3.5, shakeFinisher: 7 },
    '滑溜冰面': { accel: 300, friction: 250, turnBoost: 1, rollCurve: 1, enemyFriction: 2 },
    '祝福全開': { vineDash: true, crescent: true, pollen: true, enemyCount: 7 },
    '無特效對照組': { hitstop: 0, hitstopFinisher: 0, shake: 0, shakeFinisher: 0, flashFrames: 0, sparks: 0, smear: false, knock: 0, hitstun: 0, wallSlam: false, perfectDodge: false, damageNumbers: false, camLead: 0, camSmooth: 0 },
  },
};

const INTRO = {
  pitch: '溫室裡的植物魔物暴走了！見習魔女茴香揮舞園藝鐮刀修剪牠們。俯視角動作 Roguelite：一個房間、無限波次。',
  goals: [
    '八方向移動的加減速與轉身、翻滾的爆發感與無敵時段。',
    '在敵人撞上來前一刻翻滾，觸發「完美閃避」子彈時間。',
    '三段揮砍（第三段是大迴旋）、按住攻擊蓄力放開的迴旋斬。',
    '把敵人打飛去撞牆、撞其他敵人的連鎖快感（打擊感分組可調）。',
    '打開「祝福」三個開關，感受成長系統會怎麼改變打法。',
  ],
  controls: [
    ['方向鍵／WASD', '八方向移動'],
    ['Z ／ J', '攻擊（連按三段；揮完繼續按住＝蓄力，放開迴旋斬）'],
    ['X ／ K ／ Space', '翻滾閃避'],
    ['滑鼠', '左鍵攻擊、右鍵翻滾（瞄準方式可改成滑鼠游標）'],
    ['手把', '左搖桿移動、X 攻擊、A／B 翻滾'],
    ['P ／ N', '暫停／逐格播放'],
    ['H ／ R', '顯示判定框／重置場景'],
  ],
};

const ATTACKS = {
  c1: { sweep: 1, next: 'c2', arcMul: 1 },
  c2: { sweep: -1, next: 'c3', arcMul: 1 },
  c3: { sweep: 1, finisher: true, fixedArc: 300 * DEG, reach: 1.15, extra: [1, 2, 5] },
};
const ENEMY = {
  slime: { r: 6, hp: 3, weight: 0.8 },
  beetle: { r: 7, hp: 7, weight: 1.9 },
  mushroom: { r: 6, hp: 4, weight: 1.3 },
  pumpkin: { r: 8, hp: Infinity, weight: 99 },
};
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const easeOut = t => 1 - (1 - t) * (1 - t);

function create({ screen: g, input, sound, P }) {
  const S = buildSprites();
  const heart = new Sprite(['.oo.oo.', 'oppoppo', 'opwpppo', 'opppppo', '.opppo.', '..opo..', '...o...'], { o: 0, p: 14, w: 5 }, PALETTE);
  const heartEmpty = new Sprite(['.oo.oo.', 'oiioiio', 'oiiiiio', 'oiiiiio', '.oiiio.', '..oio..', '...o...'], { o: 0, i: 2 }, PALETTE);
  const floor = buildFloor();
  const parts = new Particles(900), floats = new Floaters(), shake = new Shaker(), cam = new Camera(W, H);
  cam.bounds = { w: WW, h: WH };
  let pl, enemies, pots, spores, vines, waves, bursts, pickups, hitstop, time, kills, wave, waveBanner, spawnT, hintT, combo, comboT, lastHit, hudOff = false;
  const mouse = { x: 0, y: 0, inside: false };
  g.view.addEventListener('pointermove', e => { const p = g.toNative(e.clientX, e.clientY); mouse.x = p.x; mouse.y = p.y; mouse.inside = true; });
  g.view.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return;
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
    hit(n, fin) {
      if (!sound.throttle('hit', 0.03)) return;
      sound.noise({ dur: 0.09, vol: 0.25, filter: 'lowpass', f0: 2600, f1: 400 });
      sound.tone({ type: 'square', f0: 300 + n * 30, f1: 90, dur: 0.08, vol: 0.09 });
      sound.noise({ dur: 0.04, vol: 0.1, filter: 'highpass', f0: 3500, delay: 0.01 });
      if (fin) { sound.tone({ type: 'sine', f0: 130, f1: 40, dur: 0.3, vol: 0.35 }); sound.bell({ f: 1046, dur: 0.5, vol: 0.08 }); }
    },
    roll() { sound.noise({ dur: 0.22, vol: 0.12, filter: 'bandpass', f0: 900, f1: 2400, q: 0.9 }); },
    perfect() { sound.bell({ f: 1568, dur: 1, vol: 0.14 }); sound.bell({ f: 2093, dur: 1.2, vol: 0.08, delay: 0.06 }); sound.tone({ type: 'sine', f0: 1200, f1: 200, dur: 0.5, vol: 0.08 }); },
    slam() { sound.tone({ type: 'sine', f0: 110, f1: 35, dur: 0.25, vol: 0.4 }); sound.noise({ dur: 0.15, vol: 0.25, filter: 'lowpass', f0: 1200, f1: 100 }); },
    die() { sound.tone({ type: 'square', f0: 280, f1: 900, dur: 0.1, vol: 0.07 }); sound.noise({ dur: 0.2, vol: 0.18, filter: 'lowpass', f0: 1600, f1: 200 }); },
    spore() { if (!sound.throttle('spore', 0.1)) return; sound.noise({ dur: 0.12, vol: 0.08, filter: 'lowpass', f0: 600, f1: 300 }); },
    pot() { sound.bell({ f: 2400, dur: 0.15, vol: 0.06 }); sound.noise({ dur: 0.15, vol: 0.2, filter: 'highpass', f0: 1800 }); },
    charged() { sound.bell({ f: 1319, dur: 0.5, vol: 0.12 }); },
    spin() { sound.noise({ dur: 0.35, vol: 0.14, filter: 'bandpass', f0: 800, f1: 2200, q: 1 }); sound.noise({ dur: 0.35, vol: 0.12, filter: 'bandpass', f0: 2200, f1: 800, q: 1, delay: 0.3 }); },
    hurt() { sound.tone({ type: 'triangle', f0: 500, f1: 150, dur: 0.22, vol: 0.14 }); sound.noise({ dur: 0.2, vol: 0.18, filter: 'lowpass', f0: 2000, f1: 200 }); },
    heal() { [784, 988, 1319].forEach((f, i) => sound.tone({ type: 'triangle', f0: f, dur: 0.12, vol: 0.07, delay: i * 0.06 })); },
    wave() { [523, 659, 784, 1047].forEach((f, i) => sound.tone({ type: 'square', f0: f, dur: 0.12, vol: 0.05, delay: i * 0.08 })); },
    spawn() { if (!sound.throttle('spawn', 0.2)) return; sound.noise({ dur: 0.3, vol: 0.06, filter: 'lowpass', f0: 400, f1: 900 }); },
  };

  // ---------------- 初始化 ----------------
  function reset() {
    pl = { x: SPAWN.x, y: SPAWN.y, vx: 0, vy: 0, r: 5, aim: -Math.PI / 2, dir: 'up', flip: false, hp: 6, maxHp: 6, inv: 0, hurtT: 0,
      roll: null, rollCD: 0, atk: null, chain: null, chainT: 0, charge: 0, charging: false, chargedFx: false,
      walk: 0, blade: Math.PI * 0.75, prevBlade: 0, slowT: 0, vineDist: 0, flash: 0 };
    enemies = [makeEnemy('pumpkin', DUMMY_AT.x, DUMMY_AT.y)];
    pots = POTS.map(([tx, ty]) => ({ x: tx * T + 8, y: ty * T + 12, r: 5, broken: false, t: 0 }));
    spores = []; vines = []; waves = []; bursts = []; pickups = [];
    hitstop = 0; time = 0; kills = 0; wave = 1; waveBanner = 2; spawnT = 1; hintT = 7; combo = 0; comboT = 0; lastHit = -1;
    parts.clear(); floats.list.length = 0; shake.reset();
    cam.center(pl.x, pl.y - 10);
  }
  function makeEnemy(type, x, y) {
    const d = ENEMY[type];
    return { type, x, y, vx: 0, vy: 0, r: d.r, hp: d.hp, weight: d.weight, flash: 0, hitstun: 0, state: 'idle', t: rand(0, 2), stateT: rand(0.5, 1.5),
      face: 'down', dirX: 1, dirY: 0, dead: false, spawnT: type === 'pumpkin' ? 0 : 0.7, slammed: false, lean: 0, leanV: 0, vineHitT: 0, shots: 0 };
  }

  // ---------------- 碰撞 ----------------
  /** 圓形與地形碰撞：推出並回傳法線（沒碰到回傳 null） */
  function pushOut(e) {
    let nx = 0, ny = 0, hit = false;
    const x0 = Math.floor((e.x - e.r) / T), x1 = Math.floor((e.x + e.r) / T), y0 = Math.floor((e.y - e.r) / T), y1 = Math.floor((e.y + e.r) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!solid(tx, ty)) continue;
      const cx = clamp(e.x, tx * T, tx * T + T), cy = clamp(e.y, ty * T, ty * T + T);
      const dx = e.x - cx, dy = e.y - cy, d = Math.hypot(dx, dy);
      if (d >= e.r) continue;
      if (d < 0.0001) { // 圓心在方塊裡：往最近的邊推
        const l = e.x - tx * T, r = tx * T + T - e.x, u = e.y - ty * T, b = ty * T + T - e.y, m = Math.min(l, r, u, b);
        if (m === l) { e.x -= l + e.r; nx -= 1; } else if (m === r) { e.x += r + e.r; nx += 1; } else if (m === u) { e.y -= u + e.r; ny -= 1; } else { e.y += b + e.r; ny += 1; }
      } else { const push = e.r - d; e.x += dx / d * push; e.y += dy / d * push; nx += dx / d; ny += dy / d; }
      hit = true;
    }
    if (!hit) return null;
    const m = Math.hypot(nx, ny) || 1;
    return { nx: nx / m, ny: ny / m };
  }
  /** 分段移動（避免高速穿牆），回傳碰撞法線 */
  function move(e, dt) {
    const dist = Math.hypot(e.vx, e.vy) * dt;
    const n = Math.max(1, Math.ceil(dist / 4));
    let normal = null;
    for (let i = 0; i < n; i++) {
      e.x += e.vx * dt / n; e.y += e.vy * dt / n;
      const c = pushOut(e);
      if (c) {
        normal = c;
        const vn = e.vx * c.nx + e.vy * c.ny;
        if (vn < 0) { e.hitSpeed = Math.hypot(e.vx, e.vy); e.vx -= c.nx * vn; e.vy -= c.ny * vn; e.lastVn = vn; }
      }
    }
    return normal;
  }

  // ---------------- 玩家 ----------------
  const pivot = () => ({ x: pl.x, y: pl.y - 9 });
  function aimVector() {
    const ax = input.axis();
    if (P.aimMode === 'mouse' && mouse.inside) return Math.atan2(mouse.y + cam.y - (pl.y - 9), mouse.x + cam.x - pl.x);
    let a = (Math.abs(ax.x) > 0.2 || Math.abs(ax.y) > 0.2) ? Math.atan2(ax.y, ax.x) : pl.aim;
    if (P.aimMode === 'auto') {
      let best = null, bestD = Infinity;
      for (const e of enemies) {
        if (e.dead || e.spawnT > 0) continue;
        const dx = e.x - pl.x, dy = e.y - pl.y, d = Math.hypot(dx, dy);
        if (d > P.radius * 2.3 + e.r) continue;
        const da = Math.abs(angDiff(a, Math.atan2(dy, dx)));
        if (da <= P.autoAim * DEG && d < bestD) { bestD = d; best = Math.atan2(dy, dx); }
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
    const def = ATTACKS[kind];
    const ex = def.extra || [0, 0, 0];
    pl.aim = aimVector(); setFacing(pl.aim);
    const arc = def.fixedArc || P.arc * DEG;
    pl.atk = { kind, def, f: 0, S: P.startup + ex[0], A: Math.max(1, P.active + ex[1]), R: P.recovery + ex[2], hit: new Set(), queued: false, a0: pl.aim - def.sweep * arc / 2, a1: pl.aim + def.sweep * arc / 2, reach: P.radius * (def.reach || 1), startBlade: pl.blade };
    pl.chain = kind; pl.charging = false; pl.charge = 0;
  }
  function startSpin() {
    const turns = P.spinTurns;
    pl.atk = { kind: 'spin', def: { spin: true, finisher: true, sweep: 1 }, f: 0, S: 2, A: 10 * turns, R: 8, hit: new Set(), lap: 0, queued: false, a0: pl.aim, a1: pl.aim + TAU * turns, reach: P.spinRadius, startBlade: pl.blade };
    pl.charging = false; pl.charge = 0; pl.chain = null;
    sfx.spin();
  }
  function bladeAngle(a) {
    const { f, S, A, R } = a;
    const wind = a.a0 - 0.35 * sign(a.a1 - a.a0);
    if (f < S) return pl.blade + angDiff(pl.blade, wind) * easeOut((f + 1) / (S + 1));
    if (f < S + A) return lerp(wind, a.a1, a.def.spin ? (f - S + 1) / A : easeOut((f - S + 1) / A));
    return a.a1;
  }
  function startRoll() {
    const ax = input.axis();
    const a = (Math.abs(ax.x) > 0.2 || Math.abs(ax.y) > 0.2) ? Math.atan2(ax.y, ax.x) : pl.aim;
    pl.roll = { t: 0, dx: Math.cos(a), dy: Math.sin(a), perfect: false };
    pl.atk = null; pl.charging = false; pl.charge = 0;
    pl.aim = a; setFacing(a);
    parts.burst(pl.x, pl.y - 2, 6, { dir: a + Math.PI, spread: 1.2, speed: [30, 80], colors: [C.cream, C.mauve, C.plum], shape: 'sq', size: 2, life: [0.2, 0.4] });
    sfx.roll();
  }
  /** 受擊無敵中，或翻滾的無敵時段內（從翻滾第一格就生效） */
  const invulnerable = () => pl.inv > 0 || (pl.roll && pl.roll.t <= P.rollTime * P.rollIframes);
  function hurtPlayer(src) {
    if (invulnerable()) return;
    pl.hp--;
    const dx = pl.x - src.x, dy = pl.y - src.y, d = Math.hypot(dx, dy) || 1;
    pl.vx = dx / d * P.hurtKnock; pl.vy = dy / d * P.hurtKnock;
    pl.inv = P.iframes / 1000; pl.hurtT = 0.25; pl.atk = null; pl.charging = false; pl.charge = 0; pl.flash = 0.08;
    hitstop = Math.max(hitstop, P.hurtHitstop / 1000);
    shake.add(P.shake + 2, 220, dx / d, dy / d);
    combo = 0;
    parts.burst(pl.x, pl.y - 10, 14, { speed: [40, 120], colors: [C.white, C.pink, C.plum], shape: 'sq', size: 2, life: [0.3, 0.5] });
    sfx.hurt();
    if (pl.hp <= 0) { pl.hp = pl.maxHp; floats.add(pl.x, pl.y - 30, 'RESTORE', C.lime, { small: false, outline: C.ink, life: 1.2 }); }
  }
  /** 翻滾無敵中碰到危險：判斷是否為完美閃避 */
  function dodged() {
    if (!pl.roll || pl.roll.perfect || !P.perfectDodge || pl.roll.t > P.perfectWindow) return;
    pl.roll.perfect = true;
    pl.slowT = P.perfectDur;
    parts.add({ x: pl.x, y: pl.y - 9, shape: 'ring', r0: 4, r1: 40, life: 0.4, colors: [C.white, C.teal, C.lime] });
    parts.add({ x: pl.x, y: pl.y - 9, shape: 'ring', r0: 2, r1: 26, life: 0.3, colors: [C.teal, C.white] });
    floats.add(pl.x, pl.y - 30, 'PERFECT', C.teal, { small: false, outline: C.ink, life: 1 });
    sfx.perfect();
  }

  function updatePlayer(dt) {
    pl.inv -= dt; pl.hurtT -= dt; pl.rollCD -= dt; pl.chainT -= dt; pl.flash -= dt;
    const ax = input.axis();
    let mx = ax.x, my = ax.y;
    if (!P.diagNormalize) { mx = sign(Math.round(mx * 1.4)); my = sign(Math.round(my * 1.4)); }
    const moving = Math.abs(mx) > 0.15 || Math.abs(my) > 0.15;
    if (moving && !pl.atk && !pl.roll) { pl.aim = Math.atan2(my, mx); setFacing(pl.aim); }
    if (P.aimMode === 'mouse' && mouse.inside && !pl.roll && !pl.atk) { pl.aim = aimVector(); setFacing(pl.aim); }

    // ---- 翻滾
    if (pl.roll) {
      const r = pl.roll;
      r.t += dt;
      const u = clamp(r.t / P.rollTime, 0, 1);
      const sp = P.rollSpeed * P.rollCurve * Math.pow(1 - u, P.rollCurve - 1);
      pl.vx = r.dx * sp; pl.vy = r.dy * sp;
      if (P.vineDash) {
        pl.vineDist += sp * dt;
        if (pl.vineDist > 7) { pl.vineDist = 0; vines.push({ x: pl.x, y: pl.y, life: 1.6, max: 1.6, v: Math.floor(rand(0, 3)) }); }
      }
      if (Math.floor(r.t * 60) % 3 === 0) parts.add({ x: pl.x + rand(-3, 3), y: pl.y, vx: -r.dx * 20, vy: -r.dy * 20 - 10, life: 0.3, colors: [C.cream, C.mauve], shape: 'sq', size: 2 });
      if (r.t >= P.rollTime) {
        pl.roll = null; pl.rollCD = P.rollCooldown;
        pl.vx = r.dx * P.moveSpeed * 0.8; pl.vy = r.dy * P.moveSpeed * 0.8;
      }
    } else {
      // ---- 輸入
      const canAct = pl.hurtT <= 0;
      const a = pl.atk;
      const inRecovery = a && a.f >= a.S + a.A;
      if (canAct && input.pressed('roll') && pl.rollCD <= 0 && (!a || (P.rollCancel && inRecovery))) startRoll();
      else if (canAct && input.pressed('attack')) {
        if (!a) {
          const next = pl.chain && pl.chainT > 0 && ATTACKS[pl.chain] && ATTACKS[pl.chain].next;
          startAttack(next || 'c1');
        } else a.queued = true;
      }
      // ---- 蓄力：揮擊結束後仍按住攻擊鍵
      if (!pl.atk && !pl.roll && input.down('attack') && canAct) {
        pl.charging = true;
        const before = pl.charge;
        pl.charge += dt;
        if (before < P.chargeTime && pl.charge >= P.chargeTime) {
          parts.add({ x: pl.x, y: pl.y - 9, shape: 'ring', r0: 14, r1: 3, life: 0.2, colors: [C.white, C.teal] });
          sfx.charged();
        }
        if (Math.random() < 0.5) { const an = rand(0, TAU), rr = rand(14, 20); parts.add({ x: pl.x + Math.cos(an) * rr, y: pl.y - 9 + Math.sin(an) * rr, vx: -Math.cos(an) * 60, vy: -Math.sin(an) * 60, life: 0.25, colors: pl.charge >= P.chargeTime ? [C.white, C.teal] : [C.lime, C.lleaf], shape: 'px' }); }
      }
      if (pl.charging && !input.down('attack')) {
        if (pl.charge >= P.chargeTime) startSpin();
        pl.charging = false; pl.charge = 0;
      }
      // ---- 攻擊進行
      if (pl.atk) {
        const at = pl.atk;
        at.f++;
        if (at.f === at.S + 1) {
          const lunge = P.lunge * (at.def.finisher ? 1.4 : 1) * (at.def.spin ? 0.3 : 1);
          pl.vx = Math.cos(pl.aim) * lunge; pl.vy = Math.sin(pl.aim) * lunge;
          if (!at.def.spin) sfx.swing(at.kind === 'c3' ? 2 : at.kind === 'c2' ? 1 : 0);
          if (at.kind === 'c3' && P.crescent) waves.push({ x: pl.x, y: pl.y - 9, vx: Math.cos(pl.aim) * 230, vy: Math.sin(pl.aim) * 230, a: pl.aim, life: 0.62, hit: new Set() });
        }
        if (at.def.spin) { const lap = Math.floor((at.f - at.S) / (at.A / P.spinTurns)); if (lap !== at.lap && at.f < at.S + at.A) { at.lap = lap; at.hit.clear(); } }
        const cancelAt = at.S + at.A + Math.ceil(at.R * P.comboCancel);
        if (at.queued && at.f >= cancelAt && at.def.next) startAttack(at.def.next);
        else if (at.f >= at.S + at.A + at.R) { pl.atk = null; pl.chainT = P.comboWindow / 1000; if (at.def.finisher) pl.chain = null; }
      }
      // ---- 移動（向量加速度）
      const slow = pl.atk ? P.atkMove : pl.charging ? P.chargeMove : 1;
      const tx = mx * P.moveSpeed * slow, ty = my * P.moveSpeed * slow;
      let dvx = tx - pl.vx, dvy = ty - pl.vy;
      const dvm = Math.hypot(dvx, dvy);
      let accel = moving ? P.accel : P.friction;
      if (moving && pl.vx * tx + pl.vy * ty < 0) accel *= P.turnBoost;
      if (pl.atk && pl.atk.f <= pl.atk.S + 2) accel = P.friction * 0.25; // 前衝期間保持慣性
      if (pl.hurtT > 0) accel = 400;
      const step = accel * dt;
      if (dvm > step) { dvx *= step / dvm; dvy *= step / dvm; }
      pl.vx += dvx; pl.vy += dvy;
    }
    move(pl, dt);
    const sp = Math.hypot(pl.vx, pl.vy);
    if (!pl.roll && sp > 10) pl.walk += sp * dt / 16;
    // 鐮刀角度
    pl.prevBlade = pl.blade;
    if (pl.atk) pl.blade = bladeAngle(pl.atk);
    else {
      const rest = pl.charging ? pl.aim + Math.PI * 0.85 : pl.aim + Math.PI * 0.72;
      pl.blade += angDiff(pl.blade, rest) * smoothK(dt, pl.charging ? 0.03 : 0.06);
    }
  }

  // ---------------- 攻擊判定 ----------------
  function sweepHits(cx, cy, a0, a1, reach, test) {
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
    if (!a || a.f <= a.S || a.f > a.S + a.A) return;
    const pv = pivot();
    const test = sweepHits(pv.x, pv.y, pl.prevBlade, pl.blade, a.reach);
    for (const e of enemies) {
      if (e.dead || e.spawnT > 0 || a.hit.has(e)) continue;
      if (test(e.x, e.y - 6, e.r)) { a.hit.add(e); hitEnemy(e, a.def.finisher ? 2 : 1, Math.atan2(e.y - pl.y, e.x - pl.x), !!a.def.finisher, a.kind); }
    }
    for (const p of pots) if (!p.broken && test(p.x, p.y - 5, 5)) breakPot(p);
    if (P.cutSpores) for (const s of spores) if (!s.dead && test(s.x, s.y, 3)) { s.dead = true; parts.burst(s.x, s.y, 6, { speed: [20, 70], colors: [C.pink, C.lime, C.white], life: [0.2, 0.35] }); floats.add(s.x, s.y - 6, 'CUT', C.white, { outline: C.ink }); sfx.spore(); }
  }
  function hitEnemy(e, dmg, ang, fin, kind, knockMul = 1) {
    combo++; comboT = 1.6; lastHit = time;
    if (e.type === 'pumpkin') e.leanV += Math.cos(ang) * (fin ? 10 : 6);
    else {
      const kb = P.knock * (fin ? P.finisherKnock : 1) * knockMul / e.weight;
      e.vx = Math.cos(ang) * kb; e.vy = Math.sin(ang) * kb;
      e.hitstun = P.hitstun / 1000 * (fin ? 1.4 : 1);
      e.slammed = false;
      e.hp -= dmg;
      if (e.state === 'charge' || e.state === 'aim') { e.state = 'walk'; e.stateT = 1.2; }
    }
    e.flash = P.flashFrames / 60;
    const stop = (fin ? P.hitstopFinisher : P.hitstop) / 1000;
    hitstop = Math.max(hitstop, stop);
    e.shakeT = stop;
    shake.add(fin ? P.shakeFinisher : P.shake, fin ? 260 : 150, Math.cos(ang), Math.sin(ang));
    const px = e.x - Math.cos(ang) * e.r, py = e.y - 6 - Math.sin(ang) * e.r;
    const n = P.sparks;
    if (n) {
      parts.burst(px, py, n, { dir: ang, spread: 2.2, speed: [60, 180], colors: [C.white, C.teal, C.lime], shape: 'line', len: 0.035, life: [0.12, 0.25], drag: 6 });
      parts.burst(px, py, Math.ceil(n * 0.8), { dir: ang, spread: 2.6, speed: [30, 110], colors: [C.lime, C.lleaf, C.leaf], shape: 'sq', size: 2, shrink: 0.6, life: [0.35, 0.7], gravity: 60, drag: 3 });
      parts.add({ x: px, y: py, shape: 'star', size: fin ? 6 : 4, life: 0.12, colors: [C.white, C.teal] });
      if (fin) parts.add({ x: px, y: py, shape: 'ring', r0: 3, r1: 22, life: 0.22, colors: [C.white, C.teal, C.lime] });
    }
    if (P.damageNumbers) floats.add(e.x + rand(-5, 5), e.y - 20 - (combo % 3) * 3, e.type === 'pumpkin' ? dmg * 10 + Math.floor(rand(0, 9)) : dmg, fin ? C.lime : C.white, { outline: C.ink });
    sfx.hit(combo, fin);
    if (e.hp <= 0 && !e.dead) killEnemy(e);
  }
  function killEnemy(e) {
    e.dead = true; kills++;
    const cols = e.type === 'slime' ? [C.lime, C.lleaf, C.leaf] : e.type === 'beetle' ? [C.plum, C.pink, C.shadow] : [C.terra, C.cream, C.soil];
    parts.burst(e.x, e.y - 6, 18, { speed: [40, 150], colors: cols, shape: 'sq', size: 3, life: [0.3, 0.6], gravity: 120, drag: 2 });
    parts.add({ x: e.x, y: e.y - 6, shape: 'ring', r0: 2, r1: 18, life: 0.25, colors: [C.white, C.lime] });
    shake.add(P.shake + 1, 180);
    sfx.die();
    if (P.pollen) bursts.push({ x: e.x, y: e.y - 6, t: 0.22 });
    if (Math.random() < 0.12) pickups.push({ x: e.x, y: e.y, t: 0 });
    if (kills % 10 === 0) { wave++; waveBanner = 2; sfx.wave(); }
  }
  function breakPot(p) {
    p.broken = true; p.t = 12;
    parts.burst(p.x, p.y - 4, 12, { speed: [40, 130], colors: [C.terra, C.soil, C.peach], shape: 'sq', size: 2, life: [0.3, 0.6], gravity: 220, drag: 1 });
    parts.burst(p.x, p.y - 8, 8, { speed: [20, 80], colors: [C.lime, C.lleaf, C.leaf], shape: 'sq', size: 2, life: [0.4, 0.8], gravity: 40, drag: 2 });
    shake.add(1.5, 100);
    sfx.pot();
    if (Math.random() < 0.3) pickups.push({ x: p.x, y: p.y, t: 0 });
  }

  // ---------------- 敵人 ----------------
  function spawnEnemy() {
    for (let tries = 0; tries < 40; tries++) {
      const x = rand(2 * T, WW - 2 * T), y = rand(3 * T, WH - 2 * T);
      if (Math.hypot(x - pl.x, y - pl.y) < 100) continue;
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (solid(tx, ty) || solid(Math.floor((x - 8) / T), ty) || solid(Math.floor((x + 8) / T), ty)) continue;
      const r = Math.random();
      enemies.push(makeEnemy(r < 0.45 ? 'slime' : r < 0.72 ? 'mushroom' : 'beetle', x, y));
      sfx.spawn();
      return;
    }
  }
  function updateEnemy(e, dt) {
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.spawnT > 0) { e.spawnT -= dt; if (Math.random() < 0.3) parts.add({ x: e.x + rand(-5, 5), y: e.y, vx: rand(-15, 15), vy: rand(-30, -10), life: 0.3, colors: [C.soil, C.terra], shape: 'sq', size: 1 }); return; }
    if (e.type === 'pumpkin') { e.leanV += -e.lean * 140 * dt; e.leanV *= Math.exp(-5 * dt); e.lean += e.leanV * dt; return; }
    const dx = pl.x - e.x, dy = pl.y - e.y, dist = Math.hypot(dx, dy) || 1;
    const spd = P.enemySpeed;
    if (e.vineHitT > 0) e.vineHitT -= dt;
    if (e.hitstun > 0) {
      e.hitstun -= dt;
      const k = Math.exp(-P.enemyFriction * dt); e.vx *= k; e.vy *= k;
    } else {
      const k = Math.exp(-10 * dt);
      switch (e.type) {
        case 'slime':
          e.stateT -= dt;
          if (e.state === 'hop') { if (e.stateT <= 0) { e.state = 'idle'; e.stateT = rand(0.6, 1.2) / spd; } }
          else {
            e.vx *= k; e.vy *= k;
            if (e.stateT <= 0) {
              const chase = P.enemyAggro && dist < 170;
              const a = chase ? Math.atan2(dy, dx) + rand(-0.4, 0.4) : rand(0, TAU);
              e.vx = Math.cos(a) * 105 * spd; e.vy = Math.sin(a) * 105 * spd; e.state = 'hop'; e.stateT = 0.26;
            }
          }
          break;
        case 'beetle':
          e.stateT -= dt;
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
            if (e.stateT <= 0) { e.state = 'walk'; e.stateT = 1; }
          } else {
            const a = Math.atan2(dy, dx);
            const walk = P.enemyAggro ? 30 : 0;
            e.vx += (Math.cos(a) * walk * spd - e.vx) * smoothK(dt, 0.3); e.vy += (Math.sin(a) * walk * spd - e.vy) * smoothK(dt, 0.3);
            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) { e.dirX = Math.cos(a); e.dirY = Math.sin(a); }
            if (P.enemyAggro && dist < 140 && e.stateT <= 0) {
              e.state = 'aim'; e.stateT = 0.55 / spd;
              e.dirX = dx / dist; e.dirY = dy / dist;
              floats.add(e.x, e.y - 22, '!', C.pink, { small: false, outline: C.ink, life: 0.5, vy: -10 });
            }
          }
          break;
        case 'mushroom':
          e.vx *= k; e.vy *= k;
          e.stateT -= dt;
          if (e.state === 'swell') { if (e.stateT <= 0) { e.state = 'shoot'; e.stateT = 0.3; fireSpores(e); } }
          else if (e.state === 'shoot') { if (e.stateT <= 0) { e.state = 'idle'; e.stateT = rand(1.8, 2.8) / spd; } }
          else if (e.stateT <= 0 && P.enemyAggro && dist < 200) { e.state = 'swell'; e.stateT = 0.45; }
          break;
      }
    }
    const wasFast = Math.hypot(e.vx, e.vy);
    e.hitSpeed = 0;
    const n = move(e, dt);
    if (n) {
      if (e.state === 'charge') { // 甲蟲撞牆昏眩
        e.state = 'stun'; e.stateT = 1.4; e.vx = n.nx * 60; e.vy = n.ny * 60;
        shake.add(2, 150); sfx.slam();
        parts.burst(e.x - n.nx * 6, e.y - n.ny * 6 - 4, 10, { dir: Math.atan2(n.ny, n.nx), spread: 2, speed: [30, 100], colors: [C.cream, C.mauve, C.white], shape: 'sq', size: 2, life: [0.2, 0.4] });
      } else if (P.wallSlam && e.hitstun > 0 && !e.slammed && wasFast > P.slamSpeed) slam(e, n.nx, n.ny, wasFast);
    }
    if (e.type === 'slime' && e.state === 'hop') e.face = 'down';
    // 荊棘藤蔓
    if (P.vineDash && e.vineHitT <= 0) for (const v of vines) if (Math.hypot(v.x - e.x, v.y - e.y) < e.r + 4) { e.vineHitT = 0.45; hitEnemy(e, 1, Math.atan2(e.y - v.y, e.x - v.x), false, 'vine', 0.3); break; }
    // 接觸傷害
    if (!e.dead && e.hitstun <= 0 && P.enemyAggro && e.state !== 'stun' && Math.hypot(pl.x - e.x, pl.y - e.y) < e.r + pl.r - 1) {
      if (invulnerable()) dodged(); else hurtPlayer(e);
    }
  }
  function slam(e, nx, ny, speed) {
    e.slammed = true;
    e.vx = nx * speed * 0.35; e.vy = ny * speed * 0.35;
    e.hp -= 2; e.flash = P.flashFrames / 60;
    hitstop = Math.max(hitstop, P.hitstop * 0.8 / 1000);
    shake.add(P.shake + 1.5, 200, nx, ny);
    parts.burst(e.x - nx * e.r, e.y - ny * e.r - 5, 12, { dir: Math.atan2(ny, nx), spread: 2.4, speed: [40, 140], colors: [C.white, C.cream, C.mauve], shape: 'sq', size: 2, life: [0.2, 0.45], gravity: 120 });
    parts.add({ x: e.x - nx * e.r, y: e.y - ny * e.r - 5, shape: 'star', size: 6, life: 0.14, colors: [C.white, C.cream] });
    if (P.damageNumbers) floats.add(e.x, e.y - 24, 'SLAM 2', C.pink, { outline: C.ink });
    sfx.slam();
    if (e.hp <= 0 && !e.dead) killEnemy(e);
  }
  function fireSpores(e) {
    const a = Math.atan2(pl.y - e.y, pl.x - e.x);
    e.shots++;
    const list = e.shots % 3 === 0 ? Array.from({ length: 8 }, (_, i) => i / 8 * TAU) : [a - 0.3, a, a + 0.3];
    for (const an of list) spores.push({ x: e.x, y: e.y - 8, vx: Math.cos(an) * 68, vy: Math.sin(an) * 68, life: 3.2, dead: false });
    sfx.spore();
  }
  /** 敵人之間互相推開；被擊飛的敵人撞到其他敵人會造成傷害 */
  function separate() {
    const list = enemies.filter(e => !e.dead && e.spawnT <= 0);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = a.r + b.r;
      if (d >= min) continue;
      const nx = dx / d, ny = dy / d;
      const sa = Math.hypot(a.vx, a.vy), sb = Math.hypot(b.vx, b.vy);
      if (P.wallSlam) {
        if (a.hitstun > 0 && !a.slammed && sa > P.slamSpeed && b.type !== 'pumpkin') { slam(a, -nx, -ny, sa); hitEnemy(b, 1, Math.atan2(ny, nx), false, 'bump', 0.8); continue; }
        if (b.hitstun > 0 && !b.slammed && sb > P.slamSpeed && a.type !== 'pumpkin') { slam(b, nx, ny, sb); hitEnemy(a, 1, Math.atan2(-ny, -nx), false, 'bump', 0.8); continue; }
      }
      const push = (min - d) / 2;
      const wa = a.type === 'pumpkin' ? 0 : 1, wb = b.type === 'pumpkin' ? 0 : 1;
      a.x -= nx * push * wa * (wb ? 1 : 2); a.y -= ny * push * wa * (wb ? 1 : 2);
      b.x += nx * push * wb * (wa ? 1 : 2); b.y += ny * push * wb * (wa ? 1 : 2);
    }
  }

  // ---------------- 主更新 ----------------
  function update(dt) {
    time += dt;
    shake.update(dt);
    if (hitstop > 0) { hitstop -= dt; return; }
    const wdt = pl.slowT > 0 ? dt * P.perfectSlow : dt; // 子彈時間：只有世界變慢
    if (pl.slowT > 0) pl.slowT -= dt;
    updatePlayer(dt);
    checkHits();
    for (const e of enemies) updateEnemy(e, wdt);
    separate();
    enemies = enemies.filter(e => !e.dead || e.type === 'pumpkin');
    // 補充敵人
    const alive = enemies.filter(e => e.type !== 'pumpkin').length;
    if (alive < P.enemyCount) { spawnT -= wdt; if (spawnT <= 0) { spawnEnemy(); spawnT = 0.9; } }
    // 孢子彈
    for (const s of spores) {
      s.x += s.vx * wdt; s.y += s.vy * wdt; s.life -= wdt;
      if (s.life <= 0 || solid(Math.floor(s.x / T), Math.floor(s.y / T))) s.dead = true;
      if (!s.dead && Math.hypot(s.x - pl.x, s.y - (pl.y - 8)) < 7) { if (invulnerable()) dodged(); else { s.dead = true; hurtPlayer(s); } }
    }
    spores = spores.filter(s => !s.dead);
    // 新月劍氣
    for (const w of waves) {
      w.x += w.vx * dt; w.y += w.vy * dt; w.life -= dt;
      for (const e of enemies) if (!e.dead && e.spawnT <= 0 && !w.hit.has(e) && Math.hypot(e.x - w.x, e.y - 6 - w.y) < e.r + 10) { w.hit.add(e); hitEnemy(e, 2, w.a, false, 'wave'); }
      if (solid(Math.floor(w.x / T), Math.floor(w.y / T))) w.life = 0;
    }
    waves = waves.filter(w => w.life > 0);
    // 花粉爆裂
    for (const b of bursts) {
      b.t -= dt;
      if (b.t <= 0 && !b.done) {
        b.done = true;
        parts.add({ x: b.x, y: b.y, shape: 'ring', r0: 4, r1: 30, life: 0.3, colors: [C.white, C.pink, C.lime] });
        parts.burst(b.x, b.y, 16, { speed: [40, 130], colors: [C.pink, C.lime, C.white], shape: 'sq', size: 2, life: [0.3, 0.6] });
        for (const e of enemies) if (!e.dead && e.spawnT <= 0 && e.type !== 'pumpkin' && Math.hypot(e.x - b.x, e.y - 6 - b.y) < 30 + e.r) hitEnemy(e, 2, Math.atan2(e.y - b.y, e.x - b.x), false, 'pollen', 0.9);
        sound.noise({ dur: 0.25, vol: 0.2, filter: 'lowpass', f0: 2000, f1: 300 });
      }
    }
    bursts = bursts.filter(b => !b.done);
    for (const v of vines) v.life -= dt;
    vines = vines.filter(v => v.life > 0);
    for (const p of pots) if (p.broken && (p.t -= dt) <= 0) p.broken = false;
    for (const k of pickups) {
      k.t += dt;
      if (Math.hypot(k.x - pl.x, k.y - pl.y) < 10) { k.done = true; pl.hp = Math.min(pl.maxHp, pl.hp + 1); floats.add(k.x, k.y - 16, '+1', C.pink, { outline: C.ink }); sfx.heal(); }
    }
    pickups = pickups.filter(k => !k.done && k.t < 12);
    parts.update(dt); floats.update(dt);
    if (comboT > 0 && (comboT -= dt) <= 0) combo = 0;
    if (hintT > 0) hintT -= dt;
    if (waveBanner > 0) waveBanner -= dt;
    // 鏡頭
    const lead = P.camLead;
    cam.follow(pl.x + Math.cos(pl.aim) * lead, pl.y - 10 + Math.sin(pl.aim) * lead * 0.7, dt, { smooth: P.camSmooth });
  }

  // ---------------- 繪製 ----------------
  function buildFloor() {
    return makeLayer(WW, WH, PALETTE, p => {
      // 地磚：單色陶土＋深色磚縫，少數磚塊有缺角與色差
      let seed = 5; const r = () => (seed = seed * 16807 % 2147483647) / 2147483647;
      p.rect(0, 0, WW, WH, C.terra);
      for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
        const x = tx * T, y = ty * T;
        p.rect(x, y + T - 1, T, 1, C.soil);
        p.rect(x + T - 1, y, 1, T, C.soil);
        p.rect(x, y, T - 1, 1, C.peach);
        const v = r();
        if (v < 0.12) p.dither(x + 1, y + 2, T - 3, T - 4, C.soil, 2);
        else if (v < 0.2) { p.px(x + 3 + Math.floor(r() * 8), y + 4 + Math.floor(r() * 8), C.soil); p.px(x + 5 + Math.floor(r() * 6), y + 3 + Math.floor(r() * 9), C.peach); }
      }
      // 中央石板步道
      for (let y = 2 * T; y < WH - T; y += 12) {
        const off = (Math.floor(y / 12) % 2) * 8;
        for (let x = 13 * T - off; x < 17 * T; x += 16) {
          const x0 = Math.max(13 * T, x), x1 = Math.min(17 * T, x + 16);
          p.rect(x0, y, x1 - x0, 12, C.mauve);
          p.rect(x0, y, x1 - x0, 1, C.cream);
          p.rect(x0, y + 11, x1 - x0, 1, C.plum);
          if (x1 - x0 > 2) p.rect(x1 - 1, y, 1, 12, C.plum);
        }
      }
      // 苔蘚與小草
      for (let i = 0; i < 30; i++) {
        const cx = r() * WW, cy = 2 * T + r() * (WH - 3 * T);
        for (let k = 0; k < 12; k++) p.px(cx + (r() - 0.5) * 12, cy + (r() - 0.5) * 6, r() < 0.5 ? C.leaf : C.dleaf);
        if (r() < 0.5) { p.px(cx, cy - 2, C.lleaf); p.px(cx + 1, cy - 3, C.lleaf); }
      }
      // 陽光斜射：溫暖的抖動光帶
      for (let y = 2 * T; y < WH - T; y++) for (let x = T; x < WW - T; x++) {
        const band = (x + y * 0.8) % 160;
        if (band < 30 && BAYER4[(y & 3) * 4 + (x & 3)] < (band < 4 || band > 26 ? 1 : 3)) p.px(x, y, (x >= 13 * T && x < 17 * T) ? C.cream : C.peach);
      }
      // 上方玻璃牆
      p.rect(0, 0, WW, 2 * T, C.plum);
      for (let x = 0; x < WW; x += 24) {
        p.rect(x + 2, 3, 20, 2 * T - 7, C.teal);
        for (let k = 0; k < 6; k++) p.px(x + 4 + k, 5 + k, C.white);
        p.px(x + 14, 6, C.white); p.px(x + 15, 7, C.white);
        // 玻璃後的植物
        for (let k = 0; k < 5; k++) p.circle(x + 6 + k * 3, 2 * T - 6 - (k % 2) * 3, 3, k % 2 ? C.leaf : C.dleaf);
      }
      p.rect(0, 2 * T - 3, WW, 3, C.ink);
      p.rect(0, 2 * T - 4, WW, 1, C.mauve);
      // 左右與下方牆
      p.rect(0, 2 * T, T, WH, C.plum); p.rect(WW - T, 2 * T, T, WH, C.plum);
      p.rect(T - 1, 2 * T, 1, WH, C.ink); p.rect(WW - T, 2 * T, 1, WH, C.ink);
      p.rect(0, WH - T, WW, T, C.plum); p.rect(0, WH - T, WW, 1, C.ink);
      for (let y = 2 * T; y < WH; y += 8) { p.rect(0, y, T - 1, 1, C.shadow); p.rect(WW - T + 1, y, T, 1, C.shadow); }
    });
  }
  function drawPlanter(tx, ty) {
    const x = tx * T, y = ty * T, w = 3 * T, h = 2 * T;
    g.rect(x, y + 6, w, h - 6, C.soil);
    g.rect(x, y + 6, w, 2, C.terra);
    g.rect(x, y + h - 2, w, 2, C.ink);
    for (let k = 0; k < w; k += 8) g.rect(x + k, y + 8, 1, h - 10, C.ink);
    g.rect(x + 2, y + 2, w - 4, 6, C.soil);
    for (let k = 0; k < 7; k++) {
      const cx = x + 5 + k * 6.5, cy = y + 2 - (k % 3) * 2;
      g.circle(cx, cy, 4, k % 2 ? C.leaf : C.dleaf);
      g.px(cx - 1, cy - 2, C.lleaf); g.px(cx + 1, cy - 1, C.lleaf);
      if (k % 3 === 1) { g.rect(cx - 1, cy - 4, 3, 3, C.pink); g.px(cx, cy - 3, C.white); }
    }
  }
  function drawShadow(x, y, rx) { g.ellipse(x, y, rx, Math.max(1, rx * 0.4), C.shadow); }
  function drawScythe(front) {
    const pv = pivot();
    const a = pl.blade;
    const behind = Math.sin(a) < -0.25;
    if (behind === front) return;
    const R = pl.atk ? pl.atk.reach : P.radius;
    const dx = Math.cos(a), dy = Math.sin(a);
    const hx = pv.x + dx * 3, hy = pv.y + dy * 3;
    const ex = pv.x + dx * (R - 5), ey = pv.y + dy * (R - 5);
    g.line(hx - dx * 3, hy - dy * 3, ex, ey, C.ink, 3);
    g.line(hx - dx * 3, hy - dy * 3, ex, ey, C.soil);
    // 刀刃：沿揮動方向彎曲
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
    if (!a || !P.smear) return;
    const end = a.S + a.A;
    if (a.f <= a.S || a.f > end + 3) return;
    const pv = pivot(), R = a.reach;
    const fade = Math.max(0, a.f - end) / 3;
    const span = a.def.spin ? Math.PI * 1.2 : Math.abs(pl.blade - (a.a0 - 0.35 * sign(a.a1 - a.a0)));
    const tail = span * (1 - Math.min(1, 0.1 + fade));
    const s = sign(a.a1 - a.a0);
    const w0 = pl.blade - s * tail, w1 = pl.blade;
    g.arcBand(pv.x, pv.y, R - 9, R - 5, w0, w1, C.leaf);
    g.arcBand(pv.x, pv.y, R - 5, R - 2, w0, w1, C.lime);
    g.arcBand(pv.x, pv.y, R - 2, R + 1, w0, w1, fade > 0.5 ? C.teal : C.white);
  }
  function drawPlayer() {
    const x0 = Math.round(pl.x - 8), y0 = Math.round(pl.y - 22);
    if (pl.inv > 0 && !pl.roll && pl.hurtT <= 0 && Math.floor(pl.inv * 20) % 2) return;
    const col = pl.flash > 0 ? C.pink : null;
    if (pl.roll) {
      const u = pl.roll.t / P.rollTime;
      const fr = Math.floor(u * 8) % 4;
      const idx = pl.roll.dx >= 0 ? fr : (4 - fr) % 4;
      g.spr(S.fennel.ball[idx], Math.round(pl.x - 6), Math.round(pl.y - 13), { color: col });
      return;
    }
    const moving = Math.hypot(pl.vx, pl.vy) > 10;
    const bob = moving ? (Math.floor(pl.walk * 2) % 2) : (Math.floor(time * 1.5) % 2);
    const hurt = pl.hurtT > 0;
    const spr = pl.dir === 'side' ? (hurt ? S.fennel.hurtSide : S.fennel.side) : pl.dir === 'up' ? S.fennel.up : (hurt ? S.fennel.hurtDown : S.fennel.down);
    // 腳步（程式繪製）
    const ph = pl.walk * Math.PI;
    const step = moving ? Math.sin(ph) : 0;
    if (pl.dir === 'side') {
      const f = pl.flip ? -1 : 1;
      g.spr(S.fennel.boot, Math.round(pl.x - 2 + step * 3 * f) - 2, Math.round(pl.y - 3 - Math.max(0, -step) * 1), { flip: pl.flip, color: col });
      g.spr(S.fennel.boot, Math.round(pl.x - 2 - step * 3 * f) - 1, Math.round(pl.y - 3 - Math.max(0, step) * 1), { flip: pl.flip, color: col });
    } else {
      g.spr(S.fennel.boot, Math.round(pl.x - 5), Math.round(pl.y - 3 - Math.max(0, step) * 2), { color: col });
      g.spr(S.fennel.boot, Math.round(pl.x + 1), Math.round(pl.y - 3 - Math.max(0, -step) * 2), { color: col });
    }
    drawScythe(false);
    g.spr(spr, x0, y0 + bob - (moving ? 1 : 0), { flip: pl.dir === 'side' && pl.flip, color: col });
    drawScythe(true);
    // 蓄力量表
    if (pl.charging && pl.charge > 0.08) {
      const k = clamp(pl.charge / P.chargeTime, 0, 1);
      g.rect(pl.x - 9, pl.y - 30, 18, 3, C.ink);
      g.rect(pl.x - 8, pl.y - 29, Math.round(16 * k), 1, k >= 1 ? (Math.floor(time * 20) % 2 ? C.white : C.teal) : C.lime);
    }
  }
  function drawEnemy(e) {
    if (e.dead && e.type !== 'pumpkin') return;
    if (e.spawnT > 0) { // 從土裡冒出的預告
      const k = 1 - e.spawnT / 0.7;
      g.ellipse(e.x, e.y, 3 + k * 5, 1 + k * 2, C.soil);
      g.rect(e.x - 1, e.y - 1 - k * 3, 2, k * 3, C.leaf);
      return;
    }
    const jit = e.shakeT > 0 && hitstop > 0 ? (Math.floor(time * 60) % 2 ? 2 : -2) : 0;
    const col = e.flash > 0 ? C.white : null;
    let spr, ox = 8, oy = 15;
    switch (e.type) {
      case 'pumpkin': spr = e.lean < -0.35 ? S.pumpkin.left : e.lean > 0.35 ? S.pumpkin.right : S.pumpkin.mid; ox = 10; oy = 23; break;
      case 'slime': spr = e.hitstun > 0 ? S.slime.hurt : e.state === 'hop' ? S.slime.stretch : e.stateT < 0.15 ? S.slime.squash : S.slime.idle; ox = 8; oy = 15; break;
      case 'mushroom': spr = e.hitstun > 0 ? S.mushroom.hurt : S.mushroom[e.state === 'swell' ? 'swell' : e.state === 'shoot' ? 'shoot' : 'idle']; ox = 8; oy = 17; break;
      case 'beetle': {
        const set = e.hitstun > 0 ? S.beetle.hurt : e.state === 'stun' ? S.beetle.stun : e.state === 'charge' || e.state === 'aim' ? S.beetle.charge : S.beetle[Math.floor(e.t * 8) % 2 ? 'walk1' : 'walk0'];
        const d = Math.abs(e.dirX) > Math.abs(e.dirY) ? (e.dirX > 0 ? 'right' : 'left') : (e.dirY > 0 ? 'down' : 'up');
        spr = set[d];
        ox = spr.w / 2; oy = spr.h - 2;
        if (e.state === 'aim' && Math.floor(time * 30) % 2) spr = set[d], e._blink = true; else e._blink = false;
        break;
      }
    }
    const aimJit = e.state === 'aim' ? (Math.floor(time * 40) % 2 ? 1 : -1) : 0;
    g.spr(spr, Math.round(e.x - ox) + jit + aimJit, Math.round(e.y - oy), { color: col ?? (e._blink ? C.pink : null) });
    if (e.state === 'stun') for (let i = 0; i < 3; i++) { const a = time * 5 + i * TAU / 3; g.px(e.x + Math.cos(a) * 7, e.y - 16 + Math.sin(a) * 2, C.white); }
  }
  function drawHitboxes() {
    const circ = (x, y, r, c) => g.ring(x, y, r, c);
    circ(pl.x, pl.y, pl.r, invulnerable() ? C.lime : C.teal);
    for (const e of enemies) if (!e.dead && e.spawnT <= 0) circ(e.x, e.y, e.r, C.teal);
    for (const s of spores) circ(s.x, s.y, 3, C.teal);
    const a = pl.atk;
    if (a && a.f > a.S && a.f <= a.S + a.A) {
      const pv = pivot();
      g.arcBand(pv.x, pv.y, a.reach - 1, a.reach + 1, pl.prevBlade, pl.blade, C.pink);
      g.line(pv.x, pv.y, pv.x + Math.cos(pl.blade) * a.reach, pv.y + Math.sin(pl.blade) * a.reach, C.pink);
    }
  }
  function drawHUD() {
    g.screenSpace();
    for (let i = 0; i < pl.maxHp; i++) g.spr(i < pl.hp ? heart : heartEmpty, 5 + i * 9, 5);
    g.text('WAVE ' + wave, W - 5, 5, C.white, { align: 'right', outline: C.ink });
    g.text('KO ' + kills, W - 5, 14, C.lime, { small: true, align: 'right', outline: C.ink });
    let by = H - 9;
    for (const [k, label] of [['pollen', 'POLLEN'], ['crescent', 'CRESCENT'], ['vineDash', 'VINE DASH']]) if (P[k]) { g.text('* ' + label, 5, by, C.lime, { small: true, outline: C.ink }); by -= 7; }
    if (combo >= 2) {
      const pop = time - lastHit < 0.06 ? 1 : 0;
      g.text(String(combo), W / 2 + 2, 6 - pop, combo >= 10 ? C.lime : C.white, { scale: 2, align: 'right', outline: C.ink });
      g.text('HIT', W / 2 + 5, 11, C.pink, { outline: C.ink });
    }
    if (pl.slowT > 0) { // 子彈時間：畫面四邊的抖動框
      const lv = Math.round(clamp(pl.slowT / P.perfectDur, 0, 1) * 5) + 1;
      g.dither(0, 0, W, 6, C.teal, lv); g.dither(0, H - 6, W, 6, C.teal, lv); g.dither(0, 6, 6, H - 12, C.teal, lv); g.dither(W - 6, 6, 6, H - 12, C.teal, lv);
    }
    if (waveBanner > 0 && Math.floor(waveBanner * 8) % 2 === 0) g.text('WAVE ' + wave, W / 2, 26, C.white, { scale: 2, align: 'center', outline: C.ink });
    if (hintT > 0 && (hintT > 1.5 || Math.floor(hintT * 6) % 2)) g.text('Z ATTACK (HOLD = CHARGE)   X ROLL', W / 2, H - 9, C.white, { small: true, align: 'center', outline: C.ink });
  }
  function render() {
    g.clear(C.ink);
    g.camera(cam.x + shake.x, cam.y + shake.y);
    g.ctx.drawImage(floor, 0, 0);
    // 荊棘藤蔓
    for (const v of vines) {
      const c = v.life < 0.4 ? C.dleaf : C.leaf;
      g.rect(v.x - 3, v.y - 1, 6, 2, c); g.px(v.x - 2 + v.v, v.y - 2, C.pink); g.px(v.x + 2 - v.v, v.y + 1, C.lleaf);
    }
    for (const k of pickups) { const by = Math.round(Math.sin(k.t * 5) * 1.5); drawShadow(k.x, k.y, 3); g.rect(k.x - 2, k.y - 7 + by, 5, 4, C.pink); g.px(k.x - 1, k.y - 6 + by, C.white); g.rect(k.x, k.y - 10 + by, 1, 3, C.leaf); }
    // 影子
    for (const p of pots) if (!p.broken) drawShadow(p.x, p.y, 5);
    for (const e of enemies) if (!e.dead && e.spawnT <= 0) drawShadow(e.x, e.y, e.r + 1);
    if (!pl.roll || true) drawShadow(pl.x, pl.y, 5);
    // 依 y 排序繪製
    const list = [];
    for (const [tx, ty] of PLANTERS) list.push({ y: ty * T + 2 * T, draw: () => drawPlanter(tx, ty) });
    for (const p of pots) if (!p.broken) list.push({ y: p.y, draw: () => g.spr(S.pot, p.x - 5, p.y - 8) });
    for (const e of enemies) list.push({ y: e.y, draw: () => drawEnemy(e) });
    list.push({ y: pl.y, draw: drawPlayer });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.draw();
    for (const s of spores) { g.circle(s.x, s.y, 2, C.ink); g.circle(s.x, s.y, 1, Math.floor(time * 10 + s.x) % 2 ? C.pink : C.lime); g.px(s.x - 1, s.y - 1, C.white); }
    for (const w of waves) {
      const s = 1;
      g.arcBand(w.x - Math.cos(w.a) * 8, w.y - Math.sin(w.a) * 8, 8, 12, w.a - 1.1 * s, w.a + 1.1 * s, C.teal);
      g.arcBand(w.x - Math.cos(w.a) * 8, w.y - Math.sin(w.a) * 8, 11, 13, w.a - 0.9, w.a + 0.9, C.white);
    }
    drawSmear();
    parts.draw(g);
    floats.draw(g);
    if (P.showHitbox) drawHitboxes();
    if (!hudOff) drawHUD();
  }
  function debugLines() {
    const a = pl.atk;
    return [
      `STATE ${pl.roll ? 'ROLL ' + (pl.roll.t * 1000).toFixed(0) : a ? 'ATK ' + a.kind.toUpperCase() + ' F' + a.f : pl.charging ? 'CHARGE ' + pl.charge.toFixed(2) : 'MOVE'}`,
      `SPEED ${Math.hypot(pl.vx, pl.vy).toFixed(0)}  INV ${Math.max(0, pl.inv * 1000).toFixed(0)}`,
      `SLOW ${Math.max(0, pl.slowT).toFixed(2)}  HITSTOP ${Math.max(0, hitstop * 1000).toFixed(0)}`,
      `ENEMY ${enemies.length - 1}  SPORE ${spores.length}`,
    ];
  }
  function stageCover() {
    reset();
    hudOff = true; hintT = 0; waveBanner = 0; spawnT = 99;
    pl.x = 10 * T; pl.y = 10 * T + 8; pl.aim = 0; setFacing(0);
    enemies.push(Object.assign(makeEnemy('slime', pl.x + 21, pl.y - 1), { spawnT: 0, stateT: 9 }));
    enemies.push(Object.assign(makeEnemy('mushroom', pl.x + 58, pl.y - 26), { spawnT: 0, stateT: 9 }));
    enemies.push(Object.assign(makeEnemy('beetle', pl.x - 44, pl.y + 12), { spawnT: 0, dirX: 1, dirY: 0, stateT: 9 }));
    enemies.push(Object.assign(makeEnemy('slime', pl.x + 40, pl.y + 20), { spawnT: 0, stateT: 9 }));
    cam.center(pl.x + 8, pl.y - 12);
    startAttack('c1'); pl.atk.f = pl.atk.S;
  }

  reset();
  return { update, render, reset, debugLines, stageCover, peek: () => ({ pl, enemies, spores, combo, hitstop, kills }) };
}

runPrototype({
  id: 'greenhouse-witch',
  title: '溫室魔女的剪定日',
  subtitle: '原型 B・俯視角動作 Roguelite',
  width: W, height: H, palette: PALETTE, ui: { text: C.white, dark: C.ink },
  input: {
    left: { keys: ['ArrowLeft', 'KeyA'] }, right: { keys: ['ArrowRight', 'KeyD'] },
    up: { keys: ['ArrowUp', 'KeyW'] }, down: { keys: ['ArrowDown', 'KeyS'] },
    attack: { keys: ['KeyZ', 'KeyJ'], pad: [2] },
    roll: { keys: ['KeyX', 'KeyK', 'Space'], pad: [0, 1] },
  },
  touch: [{ action: 'roll', label: '滾' }, { action: 'attack', label: '砍', big: true }],
  tuning: TUNING,
  intro: INTRO,
  create,
});
