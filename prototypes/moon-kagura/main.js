// 《月下神樂》原型 A：橫向動作平台（銀河惡魔城風格）
// 主角緋鈴揮舞神樂鈴杖對抗妖怪。這個原型只測「移動與攻擊的手感」，所有數值都可在右側面板即時調整。
import { runPrototype } from '../engine/app.js';
import { Sprite, makeLayer, TAU } from '../engine/pixel.js';
import { Particles, Shaker, Camera, Floaters, clamp, approach, rand, sign, smoothK, lerp } from '../engine/fx.js';
import { PALETTE, RIG, buildSprites } from './sprites.js';

const W = 320, H = 180, T = 16, MW = 60, MH = 14, WW = MW * T, WH = MH * T;
const C = { ink: 0, night: 1, indigo: 2, violet: 3, lav: 4, moon: 5, white: 6, dwood: 7, wood: 8, red: 9, orange: 10, gold: 11, skin: 12, pink: 13, dgreen: 14, green: 15 };

// ---------------- 關卡（以區塊描述，避免手打對齊錯誤） ----------------
function buildMap() {
  const m = Array.from({ length: MH }, () => Array(MW).fill('.'));
  const fill = (x0, x1, y0, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y][x] = ch; };
  fill(0, 0, 0, MH - 1, '#'); fill(MW - 1, MW - 1, 0, MH - 1, '#');
  fill(0, 30, 12, 13, '#');   // 左側練習場
  fill(19, 20, 11, 11, '#');  // 台階
  fill(21, 30, 10, 11, '#');  // 高台
  fill(31, 34, 13, 13, '#');  // 凹地底部
  fill(35, 58, 12, 13, '#');  // 右側地面
  fill(47, 48, 7, 11, '#');   // 高柱（需要二段跳）
  fill(11, 15, 9, 9, '=');    // 單向木板（可從下方穿過、按下＋跳躍落下）
  fill(25, 28, 7, 7, '=');
  fill(28, 31, 4, 4, '=');
  fill(37, 40, 9, 9, '=');
  fill(41, 44, 6, 6, '=');
  fill(52, 55, 9, 9, '=');
  return m.map(r => r.join(''));
}
const MAP = buildMap();
const tileAt = (tx, ty) => (tx < 0 || tx >= MW || ty >= MH) ? '#' : ty < 0 ? '.' : MAP[ty][tx];
const solid = (tx, ty) => tileAt(tx, ty) === '#';
const oneWay = (tx, ty) => tileAt(tx, ty) === '=';
const GROUND = 12;
const SPAWN = { x: 9 * T + 8, y: GROUND * T };
const ENEMY_SPAWNS = [
  { type: 'dummy', tx: 4, ty: GROUND }, { type: 'dummy', tx: 56, ty: GROUND },
  { type: 'umbrella', tx: 32, ty: 13 }, { type: 'umbrella', tx: 52, ty: GROUND }, { type: 'umbrella', tx: 24, ty: 10 },
  { type: 'lantern', tx: 39, ty: 7 }, { type: 'lantern', tx: 44, ty: 4 }, { type: 'lantern', tx: 17, ty: 6 },
];
const TORO_AT = [7, 17, 36, 44, 57];

// ---------------- 調參面板 ----------------
const TUNING = {
  groups: [
    { name: '移動', items: [
      { key: 'runSpeed', label: '最高跑速', min: 40, max: 260, step: 1, value: 110, unit: 'px/s' },
      { key: 'groundAccel', label: '地面加速度', min: 100, max: 8000, step: 50, value: 1200, unit: 'px/s²', hint: '從靜止到全速有多快。大＝一按就到全速，小＝有起步的重量感。' },
      { key: 'groundDecel', label: '地面減速度', min: 100, max: 9000, step: 50, value: 1600, unit: 'px/s²', hint: '放開方向鍵後停下來的快慢。小＝會滑行。' },
      { key: 'turnAccel', label: '轉身加速度', min: 100, max: 12000, step: 50, value: 3000, unit: 'px/s²', hint: '反方向輸入時的煞車力。大＝靈活轉身，小＝有慣性。' },
      { key: 'airAccel', label: '空中加速度', min: 0, max: 8000, step: 50, value: 950, unit: 'px/s²', hint: '空中改變方向的能力（空中控制）。' },
      { key: 'airDecel', label: '空中減速度', min: 0, max: 8000, step: 50, value: 450, unit: 'px/s²' },
    ] },
    { name: '跳躍', items: [
      { key: 'jumpHeight', label: '跳躍高度', min: 16, max: 140, step: 1, value: 54, unit: 'px', hint: '長按跳躍的最高高度。一格地形是 16px。' },
      { key: 'jumpTime', label: '到頂時間', min: 0.15, max: 0.8, step: 0.01, value: 0.36, unit: '秒', hint: '起跳到最高點的時間。短＝俐落，長＝飄。' },
      { key: 'fallMult', label: '下落重力倍率', min: 0.5, max: 4, step: 0.05, value: 1.7, unit: '×', hint: '下落比上升更快會讓跳躍更有重量感。' },
      { key: 'jumpCut', label: '短按重力倍率', min: 1, max: 6, step: 0.1, value: 2.6, unit: '×', hint: '上升中放開跳躍鍵時的重力倍率。越大，短按跳得越低（可變跳躍高度）。' },
      { key: 'apexHang', label: '頂點滯空', min: 0.2, max: 1, step: 0.05, value: 0.55, unit: '×', hint: '按住跳躍、接近最高點時的重力倍率。越小越有滯空感，方便空中攻擊。' },
      { key: 'apexWindow', label: '頂點判定速度', min: 0, max: 150, step: 5, value: 40, unit: 'px/s' },
      { key: 'maxFall', label: '最大下落速度', min: 100, max: 800, step: 10, value: 330, unit: 'px/s' },
      { key: 'coyote', label: '土狼時間', min: 0, max: 300, step: 5, value: 90, unit: 'ms', hint: '走出平台邊緣後，仍然可以起跳的寬限時間。' },
      { key: 'jumpBuffer', label: '跳躍輸入緩衝', min: 0, max: 300, step: 5, value: 110, unit: 'ms', hint: '落地前提早按跳躍，會在落地瞬間自動起跳。' },
      { key: 'airJumps', label: '空中跳躍次數', min: 0, max: 3, step: 1, value: 1, unit: '次' },
      { key: 'airJumpRatio', label: '二段跳高度比例', min: 0.3, max: 1.5, step: 0.05, value: 0.8, unit: '×' },
    ] },
    { name: '衝刺', items: [
      { key: 'dashSpeed', label: '衝刺速度', min: 100, max: 700, step: 10, value: 330, unit: 'px/s' },
      { key: 'dashTime', label: '衝刺時間', min: 0.05, max: 0.4, step: 0.01, value: 0.14, unit: '秒' },
      { key: 'dashCooldown', label: '衝刺冷卻', min: 0, max: 1.5, step: 0.05, value: 0.3, unit: '秒' },
      { key: 'dashKeep', label: '衝刺後保留速度', min: 0, max: 1, step: 0.05, value: 0.45, unit: '×', hint: '衝刺結束時保留多少速度。1＝直接接續衝刺速度奔跑。' },
      { key: 'airDashes', label: '空中衝刺次數', min: 0, max: 3, step: 1, value: 1, unit: '次' },
      { key: 'dashIframes', label: '衝刺期間無敵', type: 'toggle', value: true },
    ] },
    { name: '攻擊', items: [
      { key: 'atkStartup', label: '前搖', min: 0, max: 12, step: 1, value: 3, unit: '格', hint: '按下攻擊到判定出現的格數（60 格＝1 秒）。越少越跟手。' },
      { key: 'atkActive', label: '判定持續', min: 1, max: 12, step: 1, value: 4, unit: '格', hint: '揮擊有攻擊判定的格數，也決定揮杖的速度。' },
      { key: 'atkRecovery', label: '後搖', min: 0, max: 30, step: 1, value: 10, unit: '格', hint: '揮完後無法行動的格數。' },
      { key: 'comboCancel', label: '連段接續時機', min: 0, max: 1, step: 0.05, value: 0.4, unit: '×', hint: '已預先按下攻擊時，後搖進行到多少比例就接出下一段。0＝立刻接。' },
      { key: 'comboWindow', label: '連段輸入窗口', min: 0, max: 800, step: 10, value: 280, unit: 'ms', hint: '後搖結束後多久內再按攻擊，仍會接成下一段。' },
      { key: 'atkReach', label: '攻擊距離', min: 12, max: 48, step: 1, value: 25, unit: 'px' },
      { key: 'atkLunge', label: '攻擊前衝', min: 0, max: 300, step: 5, value: 70, unit: 'px/s', hint: '每次揮擊時向前踏步的速度。' },
      { key: 'atkMove', label: '攻擊中移動倍率', min: 0, max: 1, step: 0.05, value: 0.25, unit: '×' },
      { key: 'cancelDash', label: '後搖可用衝刺取消', type: 'toggle', value: true },
      { key: 'cancelJump', label: '後搖可用跳躍取消', type: 'toggle', value: true },
      { key: 'airHitHop', label: '空中命中滯空', min: 0, max: 300, step: 5, value: 90, unit: 'px/s', hint: '空中打中敵人時往上托一下，方便連續空中攻擊。' },
      { key: 'pogo', label: '下劈彈跳', min: 0, max: 600, step: 10, value: 280, unit: 'px/s', hint: '空中按住「下」攻擊，打中時向上彈起，並恢復空中跳躍與衝刺次數。' },
    ] },
    { name: '打擊感', items: [
      { key: 'hitstop', label: '打擊停頓', min: 0, max: 250, step: 5, value: 55, unit: 'ms', hint: '命中瞬間整個畫面凍結的時間，是「打中了」的重量感來源。' },
      { key: 'hitstopFinisher', label: '終結技停頓', min: 0, max: 400, step: 5, value: 110, unit: 'ms' },
      { key: 'knockX', label: '擊退（水平）', min: 0, max: 500, step: 5, value: 150, unit: 'px/s' },
      { key: 'knockY', label: '擊退（上挑）', min: 0, max: 400, step: 5, value: 90, unit: 'px/s' },
      { key: 'finisherKnock', label: '終結技擊退倍率', min: 1, max: 4, step: 0.1, value: 2, unit: '×' },
      { key: 'hitstun', label: '敵人硬直', min: 0, max: 1000, step: 10, value: 280, unit: 'ms' },
      { key: 'recoil', label: '自身反衝', min: 0, max: 300, step: 5, value: 40, unit: 'px/s', hint: '打中時自己被往後推的力道。' },
      { key: 'shake', label: '畫面震動', min: 0, max: 8, step: 0.5, value: 2, unit: 'px' },
      { key: 'shakeFinisher', label: '終結技震動', min: 0, max: 12, step: 0.5, value: 4, unit: 'px' },
      { key: 'flashFrames', label: '命中閃白', min: 0, max: 10, step: 1, value: 3, unit: '格' },
      { key: 'victimShake', label: '受擊者抖動', type: 'toggle', value: true, hint: '打擊停頓期間，被打的敵人會快速抖動。' },
      { key: 'sparks', label: '打擊火花數量', min: 0, max: 30, step: 1, value: 9, unit: '個' },
      { key: 'smear', label: '刀光殘影', type: 'toggle', value: true },
      { key: 'squash', label: '壓縮伸展', min: 0, max: 0.5, step: 0.02, value: 0.18, unit: '×', hint: '起跳拉長、落地壓扁的幅度。' },
      { key: 'bellScale', label: '鈴聲隨連段升調', type: 'toggle', value: true, hint: '每一下命中的鈴聲沿五聲音階往上爬。' },
    ] },
    { name: '受擊', open: false, items: [
      { key: 'iframes', label: '受擊無敵時間', min: 0, max: 3000, step: 50, value: 1000, unit: 'ms' },
      { key: 'hurtKnockX', label: '受擊擊退（水平）', min: 0, max: 400, step: 5, value: 140, unit: 'px/s' },
      { key: 'hurtKnockY', label: '受擊擊退（上彈）', min: 0, max: 400, step: 5, value: 170, unit: 'px/s' },
      { key: 'hurtStun', label: '受擊硬直', min: 0, max: 800, step: 10, value: 250, unit: 'ms' },
      { key: 'hurtHitstop', label: '受擊停頓', min: 0, max: 300, step: 5, value: 80, unit: 'ms' },
    ] },
    { name: '鏡頭與敵人', open: false, items: [
      { key: 'camLead', label: '鏡頭前瞻', min: 0, max: 80, step: 1, value: 28, unit: 'px', hint: '鏡頭往面向的方向多看多少。' },
      { key: 'camSmooth', label: '鏡頭平滑', min: 0, max: 0.5, step: 0.01, value: 0.09, unit: '秒', hint: '鏡頭追上角色的半衰期。0＝完全鎖定。' },
      { key: 'camDeadY', label: '垂直死區', min: 0, max: 60, step: 1, value: 18, unit: 'px', hint: '小跳躍時鏡頭不跟著上下晃。' },
      { key: 'enemyWeight', label: '敵人重量倍率', min: 0.3, max: 3, step: 0.1, value: 1, unit: '×', hint: '越重，擊退距離越短。' },
      { key: 'enemyAggro', label: '敵人會主動攻擊', type: 'toggle', value: true, hint: '關閉後敵人只會待在原地，方便專心測試連段。' },
      { key: 'respawn', label: '敵人重生時間', min: 0.5, max: 10, step: 0.5, value: 3, unit: '秒' },
    ] },
  ],
  presets: {
    '均衡（預設值）': {},
    '輕快靈活': { groundAccel: 3000, groundDecel: 4000, turnAccel: 8000, airAccel: 2400, jumpTime: 0.3, fallMult: 2.1, jumpCut: 3.2, dashSpeed: 390, dashTime: 0.12, atkStartup: 2, atkRecovery: 7, comboCancel: 0.25, hitstop: 40, hitstopFinisher: 80, knockX: 120, coyote: 110, jumpBuffer: 130, camSmooth: 0.06 },
    '厚重扎實': { runSpeed: 92, groundAccel: 520, groundDecel: 800, turnAccel: 1000, airAccel: 450, jumpHeight: 46, jumpTime: 0.42, fallMult: 1.35, jumpCut: 1.8, airJumps: 0, atkStartup: 6, atkActive: 5, atkRecovery: 16, comboCancel: 0.6, atkLunge: 130, hitstop: 95, hitstopFinisher: 180, knockX: 230, knockY: 130, shake: 3, shakeFinisher: 6, recoil: 80, squash: 0.26, camSmooth: 0.14 },
    '漂浮夢幻': { jumpHeight: 72, jumpTime: 0.55, fallMult: 1, apexHang: 0.3, apexWindow: 80, maxFall: 200, airJumps: 2, airAccel: 1500, airDecel: 900, pogo: 340, airHitHop: 170 },
    '無特效對照組': { hitstop: 0, hitstopFinisher: 0, shake: 0, shakeFinisher: 0, flashFrames: 0, victimShake: false, sparks: 0, smear: false, squash: 0, recoil: 0, knockX: 0, knockY: 0, hitstun: 0, coyote: 0, jumpBuffer: 0, camLead: 0, camSmooth: 0, bellScale: false },
  },
};

const INTRO = {
  pitch: '月夜的山中神社，巫女緋鈴揮舞神樂鈴杖驅散妖怪。橫向捲軸動作平台：精準跳躍＋近戰連段。',
  goals: [
    '跳躍的弧線：長按／短按的高度差、落下的重量、頂點滯空。',
    '三段連擊的節奏（鈴聲會隨連段升調）與終結技的停頓、擊退。',
    '空中攻擊、上挑，以及按住「下」攻擊的下劈彈跳（可連續踩著敵人不落地）。',
    '衝刺取消後搖、土狼時間與跳躍緩衝帶來的「寬容度」。',
    '試試「無特效對照組」預設，比較打擊停頓與震動的差別。',
  ],
  controls: [
    ['← → ／ A D', '移動'],
    ['Z ／ Space', '跳躍（空中可二段跳；按住「下」＋跳躍穿過木板）'],
    ['X ／ J', '攻擊（↑＋攻擊＝上挑，空中 ↓＋攻擊＝下劈）'],
    ['C ／ Shift', '衝刺'],
    ['手把', '左搖桿移動、A 跳、X 攻擊、B／RB 衝刺'],
    ['P ／ N', '暫停／逐格播放'],
    ['H ／ R', '顯示判定框／重置場景'],
  ],
};

// ---------------- 攻擊定義（角度以「面向右」為準：0＝正前方，負值＝往上） ----------------
const ATTACKS = {
  g1: { a0: -2.0, a1: 0.75, reach: 1, dmg: 1, next: 'g2', swing: 0 },
  g2: { a0: 1.05, a1: -1.85, reach: 1, dmg: 1, next: 'g3', swing: 1 },
  g3: { a0: -2.9, a1: 1.3, reach: 1.3, dmg: 2, finisher: true, extra: [1, 1, 4], swing: 2 },
  air: { a0: -1.9, a1: 1.05, reach: 1, dmg: 1, swing: 0 },
  up: { a0: 0.45, a1: -2.95, reach: 1.05, dmg: 1, swing: 1, dir: 'up' },
  down: { a0: 0.15, a1: 2.95, reach: 1.05, dmg: 1, swing: 1, dir: 'down' },
};
const REST = { // 各狀態下前手／鈴杖的放鬆角度
  idle: [1.15, -1.3], run: [0.55, -2.45], jump: [-0.4, -1.9], fall: [-1.2, -2.3], dash: [2.6, 3.0], hurt: [-2.2, -2.6],
};
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const worldAng = (local, face) => face > 0 ? local : Math.PI - local;
const easeOut = t => 1 - (1 - t) * (1 - t);

function create({ screen: g, input, sound, P }) {
  const S = buildSprites();
  const heart = new Sprite(['.oo.oo.', 'oRRoRRo', 'oRwRRRo', 'oRRRRRo', '.oRRRo.', '..oRo..', '...o...'], { o: 0, R: 9, w: 6 }, PALETTE);
  const heartEmpty = new Sprite(['.oo.oo.', 'oiioiio', 'oiiiiio', 'oiiiiio', '.oiiio.', '..oio..', '...o...'], { o: 0, i: 2 }, PALETTE);
  const bg = buildBackground();
  const world = buildWorldLayer();
  const parts = new Particles(900), floats = new Floaters(), shake = new Shaker(), cam = new Camera(W, H);
  cam.bounds = { w: WW, h: WH };
  let pl, enemies, hitstop, combo, comboT, time, hintT, ambientT, lastHit;

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
    jump(air) { sound.tone({ type: air ? 'triangle' : 'sine', f0: air ? 520 : 260, f1: air ? 1100 : 560, dur: 0.09, vol: 0.08 }); if (air) sound.bell({ f: 1568, dur: 0.4, vol: 0.05 }); },
    land(v) { if (!sound.throttle('land', 0.08)) return; sound.noise({ dur: 0.07, vol: clamp(v / 900, 0.03, 0.2), filter: 'lowpass', f0: 900, f1: 200 }); },
    step() { if (!sound.throttle('step', 0.1)) return; sound.noise({ dur: 0.025, vol: 0.035, filter: 'lowpass', f0: 1400, f1: 600 }); },
    dash() { sound.noise({ dur: 0.18, vol: 0.14, filter: 'bandpass', f0: 2600, f1: 700, q: 0.8 }); },
    die(kind) { sound.bell({ f: kind === 'lantern' ? 880 : 740, dur: 0.6, vol: 0.12, delay: 0.05 }); sound.bell({ f: kind === 'lantern' ? 659 : 554, dur: 0.8, vol: 0.1, delay: 0.14 }); sound.noise({ dur: 0.3, vol: 0.2, filter: 'lowpass', f0: 1800, f1: 120 }); },
    hurt() { sound.tone({ type: 'square', f0: 420, f1: 110, dur: 0.25, vol: 0.14 }); sound.noise({ dur: 0.2, vol: 0.2, filter: 'lowpass', f0: 2200, f1: 200 }); },
    pogo() { sound.tone({ type: 'square', f0: 330, f1: 880, dur: 0.1, vol: 0.07 }); },
    spawn() { if (!sound.throttle('spawn', 0.2)) return; sound.tone({ type: 'sine', f0: 200, f1: 700, dur: 0.25, vol: 0.05 }); },
  };

  // ---------------- 初始化 ----------------
  function makeRope() { return Array.from({ length: 6 }, () => ({ x: SPAWN.x, y: SPAWN.y - 30, px: SPAWN.x, py: SPAWN.y - 30 })); }
  function reset() {
    pl = {
      x: SPAWN.x, y: SPAWN.y, vx: 0, vy: 0, face: 1, w: 8, h: 22, onGround: true,
      coyote: 0, buffer: 0, airJumps: P.airJumps, dashes: P.airDashes, dashT: 0, dashCD: 0, jumping: false,
      atk: null, chain: null, chainT: 0, hp: 5, inv: 0, hurtT: 0, runPhase: 0, idleT: 0, blinkT: 2,
      armA: REST.idle[0], staffA: REST.idle[1], sx: 1, sy: 1, ghosts: [], ghostT: 0, dropT: 0,
      ropes: [makeRope(), makeRope()], flashRed: 0, vy0: 0,
    };
    computeRig();
    for (const rope of pl.ropes) for (const q of rope) { q.x = q.px = pl.tip.x; q.y = q.py = pl.tip.y; }
    enemies = ENEMY_SPAWNS.map(makeEnemy);
    hitstop = 0; combo = 0; comboT = 0; time = 0; hintT = 7; ambientT = 0; lastHit = null;
    parts.clear(); floats.list.length = 0; shake.reset();
    cam.center(pl.x + P.camLead, pl.y - 30);
  }
  function makeEnemy(sp) {
    const base = { type: sp.type, sp, hp: 0, flash: 0, hitstun: 0, vx: 0, vy: 0, dead: false, respawnT: 0, t: rand(0, 6), shakeT: 0, face: -1 };
    const x = sp.tx * T + 8, y = sp.ty * T;
    if (sp.type === 'dummy') return { ...base, x, y, w: 12, h: 24, hp: Infinity, lean: 0, leanV: 0, weight: 99 };
    if (sp.type === 'umbrella') return { ...base, x, y, w: 10, h: 18, hp: 5, maxHp: 5, onGround: true, hopT: rand(0.5, 1.5), weight: 1 };
    return { ...base, x, y: y + 8, hx: x, hy: y + 8, w: 12, h: 14, hp: 3, maxHp: 3, weight: 0.8 }; // lantern：以中心為座標
  }

  // ---------------- 碰撞 ----------------
  function moveX(e, dx) {
    e.x += dx;
    const top = e.y - e.h + 0.01, bot = e.y - 0.01;
    const edge = dx > 0 ? e.x + e.w / 2 : e.x - e.w / 2;
    const tx = Math.floor(edge / T);
    for (let ty = Math.floor(top / T); ty <= Math.floor(bot / T); ty++) {
      if (solid(tx, ty)) {
        e.x = dx > 0 ? tx * T - e.w / 2 - 0.001 : (tx + 1) * T + e.w / 2 + 0.001;
        return true;
      }
    }
    return false;
  }
  function moveY(e, dy) {
    const prevBot = e.y;
    e.y += dy;
    const l = Math.floor((e.x - e.w / 2 + 0.01) / T), r = Math.floor((e.x + e.w / 2 - 0.01) / T);
    if (dy > 0) {
      const ty = Math.floor(e.y / T);
      for (let tx = l; tx <= r; tx++) {
        if (solid(tx, ty) || (oneWay(tx, ty) && prevBot <= ty * T + 0.01 && !(e.dropT > 0))) { e.y = ty * T; return 1; }
      }
    } else if (dy < 0) {
      const ty = Math.floor((e.y - e.h) / T);
      for (let tx = l; tx <= r; tx++) if (solid(tx, ty)) { e.y = (ty + 1) * T + e.h; return -1; }
    }
    return 0;
  }
  function groundBelow(e) {
    const l = Math.floor((e.x - e.w / 2 + 0.01) / T), r = Math.floor((e.x + e.w / 2 - 0.01) / T);
    const ty = Math.floor((e.y + 0.5) / T);
    const onTop = Math.abs(e.y - ty * T) < 0.02;
    for (let tx = l; tx <= r; tx++) if (onTop && (solid(tx, ty) || (oneWay(tx, ty) && !(e.dropT > 0)))) return true;
    return false;
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
    pl.vy = -v; pl.jumping = true; pl.onGround = false; pl.coyote = 0; pl.buffer = 0;
    pl.sx = 1 - P.squash * 0.6; pl.sy = 1 + P.squash;
    if (air) {
      parts.add({ x: pl.x, y: pl.y - 4, shape: 'ring', r0: 2, r1: 11, life: 0.25, colors: [C.white, C.gold, C.lav] });
      parts.burst(pl.x, pl.y - 2, 6, { dir: Math.PI / 2, spread: 1.6, speed: [30, 70], colors: [C.gold, C.moon], life: [0.2, 0.4] });
    } else dust(pl.x, pl.y, 5);
    sfx.jump(air);
    if (pl.atk && pl.atk.f >= pl.atk.S + pl.atk.A) pl.atk = null; // 跳躍取消後搖
  }
  function dust(x, y, n, dir = 0) {
    parts.burst(x, y - 1, n, { dir: dir ? (dir > 0 ? 0 : Math.PI) : -Math.PI / 2, spread: dir ? 1.2 : 2.8, speed: [15, 55], gravity: -30, drag: 5, colors: [C.moon, C.lav, C.violet], shape: 'sq', size: 2, life: [0.25, 0.45] });
  }
  function startAttack(kind) {
    const def = ATTACKS[kind];
    const extra = def.extra || [0, 0, 0];
    const airK = (kind === 'air' || kind === 'down') ? -2 : 0;
    pl.atk = { kind, def, f: 0, S: P.atkStartup + extra[0], A: Math.max(1, P.atkActive + extra[1]), R: Math.max(0, P.atkRecovery + extra[2] + airK), hit: new Set(), queued: false, startAng: pl.staffA, prevAng: pl.staffA };
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
    pl.atk = null; pl.dashT = P.dashTime; pl.dashCD = P.dashCooldown + P.dashTime;
    pl.vx = pl.face * P.dashSpeed; pl.vy = 0; pl.jumping = false;
    if (P.dashIframes) pl.inv = Math.max(pl.inv, P.dashTime);
    parts.burst(pl.x - pl.face * 4, pl.y - 12, 8, { dir: pl.face > 0 ? Math.PI : 0, spread: 0.5, speed: [60, 140], colors: [C.white, C.moon, C.lav], shape: 'line', len: 0.04, life: [0.15, 0.3] });
    if (pl.onGround) dust(pl.x, pl.y, 4, -pl.face);
    sfx.dash();
  }
  function hurtPlayer(src) {
    if (pl.inv > 0 || pl.hurtT > 0) return;
    pl.hp--;
    const dir = sign(pl.x - src.x) || -pl.face;
    pl.vx = dir * P.hurtKnockX; pl.vy = -P.hurtKnockY; pl.onGround = false;
    pl.hurtT = P.hurtStun / 1000; pl.inv = P.iframes / 1000; pl.atk = null; pl.dashT = 0; pl.flashRed = 0.08;
    hitstop = Math.max(hitstop, P.hurtHitstop / 1000);
    shake.add(P.shake + 2, 220, dir, 0);
    combo = 0; comboT = 0;
    parts.burst(pl.x, pl.y - 12, 14, { speed: [40, 120], colors: [C.white, C.red, C.pink], shape: 'sq', size: 2, life: [0.3, 0.5] });
    sfx.hurt();
    if (pl.hp <= 0) { pl.hp = 5; floats.add(pl.x, pl.y - 34, 'RESTORE', C.green, { small: false, outline: C.ink, life: 1.2 }); }
  }

  function updatePlayer(dt) {
    const ax = input.axis().x;
    const mx = Math.abs(ax) > 0.3 ? sign(ax) : 0;
    pl.coyote -= dt; pl.buffer -= dt; pl.dashCD -= dt; pl.inv -= dt; pl.hurtT -= dt; pl.chainT -= dt; pl.dropT -= dt; pl.flashRed -= dt;
    if (input.pressed('jump')) pl.buffer = P.jumpBuffer / 1000;
    const wasGround = pl.onGround;

    // ---- 衝刺中
    if (pl.dashT > 0) {
      pl.dashT -= dt;
      pl.vx = pl.face * P.dashSpeed; pl.vy = 0;
      if ((pl.ghostT -= dt) <= 0) { pl.ghostT = 0.03; pl.ghosts.push({ spr: S.hirin.dash, x: pl.x, y: pl.y, face: pl.face, age: 0 }); }
      if (pl.dashT <= 0) pl.vx *= P.dashKeep;
      pl.vy0 = 0;
      if (input.pressed('jump') && pl.onGround) { pl.dashT = 0; pl.vx *= Math.max(P.dashKeep, 0.6); startJump(false); }
    } else {
      // ---- 攻擊輸入
      const canAct = pl.hurtT <= 0;
      if (canAct && input.pressed('attack')) {
        if (!pl.atk) {
          let kind;
          if (input.down('up')) kind = 'up';
          else if (!pl.onGround) kind = input.down('down') ? 'down' : 'air';
          else kind = (pl.chain && pl.chainT > 0 && ATTACKS[pl.chain].next) ? ATTACKS[pl.chain].next : 'g1';
          if (mx) pl.face = mx;
          startAttack(kind);
        } else pl.atk.queued = true;
      }
      if (canAct && input.pressed('dash')) tryDash(mx);

      // ---- 攻擊進行
      const a = pl.atk;
      if (a) {
        const prev = a.f;
        a.f++;
        if (a.f === a.S + 1 || (a.S === 0 && prev === 0)) { // 判定開始：前衝與揮擊音
          if (pl.onGround) pl.vx = pl.face * P.atkLunge * (a.def.finisher ? 1.6 : 1) + pl.vx * 0.2;
          sfx.swing(a.def.swing);
        }
        const recStart = a.S + a.A;
        const cancelAt = recStart + Math.ceil(a.R * P.comboCancel);
        if (a.queued && a.f >= cancelAt && a.def.next && pl.onGround) {
          const next = a.def.next;
          startAttack(input.down('up') ? 'up' : next);
        } else if (a.f >= a.S + a.A + a.R) {
          pl.atk = null;
          pl.chainT = P.comboWindow / 1000;
          if (a.queued && !a.def.next && (a.kind === 'air' || a.kind === 'down' || a.kind === 'up')) {
            startAttack(input.down('up') ? 'up' : !pl.onGround ? (input.down('down') ? 'down' : 'air') : 'g1');
          } else if (a.def.finisher) pl.chain = null;
        }
        if (pl.atk && P.cancelJump && pl.atk.f >= pl.atk.S + pl.atk.A && pl.buffer > 0 && (pl.onGround || pl.coyote > 0 || pl.airJumps > 0)) { /* 由下方跳躍處理取消 */ }
      }

      // ---- 水平移動
      const attacking = !!pl.atk;
      if (!attacking && pl.hurtT <= 0 && mx) pl.face = mx;
      const target = pl.hurtT > 0 ? pl.vx : mx * P.runSpeed * (attacking ? P.atkMove : 1);
      let acc;
      if (pl.hurtT > 0) acc = 300;
      else if (pl.onGround) acc = !mx ? P.groundDecel : (pl.vx && sign(pl.vx) !== mx ? P.turnAccel : P.groundAccel);
      else acc = mx ? P.airAccel : P.airDecel;
      if (attacking && pl.onGround && !mx) acc = P.groundDecel * 0.6;
      pl.vx = approach(pl.vx, target, acc * dt);

      // ---- 跳躍（含土狼時間、輸入緩衝、空中跳、取消後搖）
      const atkBlocks = pl.atk && !(P.cancelJump && pl.atk.f >= pl.atk.S + pl.atk.A);
      if (pl.buffer > 0 && pl.hurtT <= 0 && !atkBlocks) {
        if (pl.onGround && input.down('down') && standingOnOneWay()) { pl.dropT = 0.2; pl.onGround = false; pl.buffer = 0; pl.y += 1; }
        else if (pl.onGround || pl.coyote > 0) startJump(false);
        else if (pl.airJumps > 0 && input.pressed('jump')) { pl.airJumps--; startJump(true); }
      }
      // ---- 重力（位移用前後速度平均＝梯形積分，跳躍高度會精確等於設定值）
      pl.vy0 = pl.vy;
      let gmul = 1;
      if (pl.vy > 0) gmul = P.fallMult;
      else if (pl.jumping && !input.down('jump')) gmul = P.jumpCut;
      if (Math.abs(pl.vy) < P.apexWindow && input.down('jump') && pl.jumping) gmul = Math.min(gmul, P.apexHang);
      if (!pl.onGround) pl.vy = Math.min(P.maxFall, pl.vy + gravity() * gmul * dt);
    }

    // ---- 移動與碰撞
    if (moveX(pl, pl.vx * dt)) { if (pl.dashT > 0) pl.dashT = Math.min(pl.dashT, 0.02); pl.vx = 0; }
    const vyBefore = pl.vy;
    const hitY = moveY(pl, (pl.vy0 + pl.vy) / 2 * dt);
    if (hitY === -1) pl.vy = Math.max(0, pl.vy);
    pl.onGround = hitY === 1 || (pl.vy >= 0 && groundBelow(pl));
    if (pl.onGround) {
      if (!wasGround) { // 落地
        pl.sx = 1 + P.squash; pl.sy = 1 - P.squash * (vyBefore > 250 ? 1 : 0.6);
        dust(pl.x, pl.y, vyBefore > 250 ? 7 : 3);
        sfx.land(vyBefore);
        pl.jumping = false;
      }
      pl.vy = 0; pl.coyote = P.coyote / 1000; pl.airJumps = P.airJumps; pl.dashes = P.airDashes;
    } else if (wasGround && pl.vy >= 0) {
      pl.coyote = P.coyote / 1000; // 剛走出邊緣
    }
    if (pl.vy >= 0) pl.jumping = pl.jumping && pl.vy < 0;
    pl.x = clamp(pl.x, 8, WW - 8);
    if (pl.y > WH + 40) { pl.x = SPAWN.x; pl.y = SPAWN.y; pl.vx = pl.vy = 0; }

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
      const st = pl.hurtT > 0 ? 'hurt' : pl.dashT > 0 ? 'dash' : !pl.onGround ? (pl.vy < 0 ? 'jump' : 'fall') : Math.abs(pl.vx) > 12 ? 'run' : 'idle';
      const [ta, ts] = REST[st];
      pl.armA += angDiff(pl.armA, ta) * smoothK(dt, 0.045);
      pl.staffA += angDiff(pl.staffA, ts) * smoothK(dt, 0.07);
    }
  }
  function standingOnOneWay() {
    const l = Math.floor((pl.x - pl.w / 2 + 0.01) / T), r = Math.floor((pl.x + pl.w / 2 - 0.01) / T), ty = Math.floor((pl.y + 0.5) / T);
    let any = false;
    for (let tx = l; tx <= r; tx++) { if (solid(tx, ty)) return false; if (oneWay(tx, ty)) any = true; }
    return any;
  }

  // ---------------- 攻擊判定 ----------------
  function checkHits() {
    const a = pl.atk;
    if (!a || a.f <= a.S || a.f > a.S + a.A) return;
    const sh = shoulder();
    const R = P.atkReach * a.def.reach;
    const w0 = worldAng(a.prevAng, pl.face), w1 = worldAng(pl.staffA, pl.face);
    const lo = Math.min(w0, w1) - 0.15, hi = Math.max(w0, w1) + 0.15;
    for (const e of enemies) {
      if (e.dead || a.hit.has(e)) continue;
      const c = bodyCenter(e);
      const dx = c.x - sh.x, dy = c.y - sh.y, d = Math.hypot(dx, dy);
      const er = Math.min(e.w, e.h) / 2 + 2;
      if (d > R + er) continue;
      let ang = Math.atan2(dy, dx);
      const margin = d > 0 ? Math.asin(Math.min(1, er / d)) : Math.PI;
      // 把角度換到 [lo, lo+2π) 之間比較
      while (ang < lo - margin) ang += TAU;
      while (ang > lo - margin + TAU) ang -= TAU;
      if (d < 8 || ang <= hi + margin) { a.hit.add(e); onHit(e, a, sh, Math.min(d, R)); }
    }
  }
  function bodyCenter(e) { return e.type === 'lantern' ? { x: e.x, y: e.y } : { x: e.x, y: e.y - e.h / 2 }; }
  function onHit(e, a, sh, dist) {
    const def = a.def, fin = !!def.finisher;
    const c = bodyCenter(e);
    const ang = Math.atan2(c.y - sh.y, c.x - sh.x);
    const px = sh.x + Math.cos(ang) * dist, py = sh.y + Math.sin(ang) * dist;
    combo++; comboT = 1.8; lastHit = time;
    // 擊退
    const wgt = e.weight * P.enemyWeight;
    const kb = fin ? P.finisherKnock : 1;
    let kx = pl.face * P.knockX * kb, ky = -P.knockY * kb;
    if (def.dir === 'up') { kx = pl.face * P.knockX * 0.3; ky = -P.knockY * 2.4; }
    if (def.dir === 'down') { kx = pl.face * P.knockX * 0.5; ky = P.knockY * 1.4; }
    if (e.type === 'dummy') { e.leanV += pl.face * (fin ? 9 : 5); }
    else {
      e.vx = kx / wgt; e.vy = ky / wgt;
      e.hitstun = P.hitstun / 1000 * (fin ? 1.5 : 1);
      if (e.type === 'umbrella') e.onGround = false;
      e.hp -= def.dmg;
    }
    e.flash = P.flashFrames / 60;
    const stop = (fin ? P.hitstopFinisher : P.hitstop) / 1000;
    hitstop = Math.max(hitstop, stop);
    e.shakeT = P.victimShake ? stop : 0;
    shake.add(fin ? P.shakeFinisher : P.shake, fin ? 260 : 150, Math.cos(ang), Math.sin(ang));
    // 自身反衝／空中托起／下劈彈跳
    if (pl.onGround) pl.vx -= pl.face * P.recoil;
    else if (def.dir === 'down') { pl.vy = -P.pogo; pl.jumping = false; pl.airJumps = P.airJumps; pl.dashes = P.airDashes; sfx.pogo(); }
    else pl.vy = Math.min(pl.vy, -P.airHitHop);
    // 火花
    const n = P.sparks;
    if (n > 0) {
      parts.burst(px, py, n, { speed: [60, 190], colors: [C.white, C.gold, C.orange], shape: 'line', len: 0.035, life: [0.12, 0.28], drag: 6 });
      parts.burst(px, py, Math.ceil(n / 2), { speed: [20, 80], colors: [C.gold, C.orange, C.red], shape: 'sq', size: 2, life: [0.2, 0.4], gravity: 200 });
      parts.add({ x: px, y: py, shape: 'star', size: fin ? 6 : 4, life: 0.12, colors: [C.white, C.gold] });
      if (fin) parts.add({ x: px, y: py, shape: 'ring', r0: 3, r1: 20, life: 0.22, colors: [C.white, C.gold, C.orange] });
    }
    floats.add(c.x + rand(-4, 4), c.y - 12, e.type === 'dummy' ? (def.dmg * 10 + Math.floor(rand(0, 9))) : def.dmg, fin ? C.gold : C.white, { outline: C.ink });
    sfx.hit(combo - 1, fin);
    if (e.hp <= 0 && !e.dead) killEnemy(e);
  }
  function killEnemy(e) {
    e.dead = true; e.respawnT = P.respawn;
    const c = bodyCenter(e);
    const cols = e.type === 'lantern' ? [C.gold, C.orange, C.red, C.dwood] : [C.lav, C.violet, C.pink, C.indigo];
    parts.burst(c.x, c.y, 22, { speed: [40, 160], colors: cols, shape: 'sq', size: 3, shrink: 1, life: [0.35, 0.7], gravity: 160, drag: 2 });
    parts.add({ x: c.x, y: c.y, shape: 'ring', r0: 2, r1: 22, life: 0.3, colors: [C.white, C.green, C.dgreen] });
    for (let i = 0; i < 6; i++) parts.add({ x: c.x + rand(-6, 6), y: c.y + rand(-4, 4), vx: rand(-10, 10), vy: rand(-45, -20), life: rand(0.8, 1.4), colors: [C.white, C.green, C.green, C.dgreen], shape: 'sq', size: 2, shrink: 0.5, drag: 1 });
    shake.add(P.shake + 1, 200);
    sfx.die(e.type);
  }

  // ---------------- 敵人 ----------------
  function updateEnemy(e, dt) {
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.dead) {
      if ((e.respawnT -= dt) <= 0) {
        Object.assign(e, makeEnemy(e.sp));
        const c = bodyCenter(e);
        parts.add({ x: c.x, y: c.y, shape: 'ring', r0: 16, r1: 1, life: 0.35, colors: [C.green, C.white] });
        sfx.spawn();
      }
      return;
    }
    const dx = pl.x - e.x, dist = Math.hypot(dx, pl.y - 12 - (e.type === 'lantern' ? e.y : e.y - e.h / 2));
    if (e.type === 'dummy') {
      e.leanV += -e.lean * 140 * dt; e.leanV *= Math.exp(-5 * dt); e.lean += e.leanV * dt;
      return;
    }
    if (e.hitstun > 0) e.hitstun -= dt;
    if (e.type === 'lantern') {
      if (e.hitstun > 0) {
        const k = Math.exp(-3.5 * dt); e.vx *= k; e.vy *= k;
      } else {
        let tx = e.hx + Math.sin(e.t * 1.3) * 14, ty = e.hy + Math.sin(e.t * 2.1) * 6;
        if (P.enemyAggro && dist < 120 && Math.hypot(pl.x - e.hx, pl.y - e.hy) < 170) { tx = pl.x; ty = pl.y - 14; }
        const ddx = tx - e.x, ddy = ty - e.y, m = Math.hypot(ddx, ddy) || 1;
        const sp = Math.min(34, m * 2);
        e.vx += (ddx / m * sp - e.vx) * smoothK(dt, 0.25);
        e.vy += (ddy / m * sp - e.vy) * smoothK(dt, 0.25);
        e.face = sign(pl.x - e.x) || e.face;
      }
      e.x += e.vx * dt; e.y += e.vy * dt;
      // 撞到地形就反彈
      const tx = Math.floor(e.x / T), ty = Math.floor(e.y / T);
      if (solid(tx, ty)) { e.x -= e.vx * dt * 2; e.y -= e.vy * dt * 2; e.vx *= -0.5; e.vy *= -0.5; }
      e.x = clamp(e.x, 10, WW - 10); e.y = clamp(e.y, 8, WH - 8);
    } else { // umbrella
      const wasG = e.onGround;
      e.vy = Math.min(420, e.vy + 900 * dt);
      if (e.hitstun > 0) { if (e.onGround) e.vx = approach(e.vx, 0, 500 * dt); }
      else if (e.onGround) {
        e.vx = approach(e.vx, 0, 900 * dt);
        e.hopT -= dt;
        if (e.hopT <= 0) {
          const chase = P.enemyAggro && Math.abs(dx) < 170 && Math.abs(pl.y - e.y) < 70;
          e.face = chase ? (sign(dx) || 1) : (Math.random() < 0.5 ? -1 : 1);
          e.vx = e.face * (chase ? 62 : 25); e.vy = chase ? -210 : -150; e.onGround = false;
          e.hopT = chase ? rand(0.7, 1.2) : rand(1.2, 2);
        }
      }
      if (moveX(e, e.vx * dt)) e.vx *= -0.4;
      const hy = moveY(e, e.vy * dt);
      if (hy === -1) e.vy = 0;
      e.onGround = hy === 1 || (e.vy >= 0 && groundBelow(e));
      if (e.onGround) { if (!wasG) { parts.burst(e.x, e.y, 3, { dir: -Math.PI / 2, spread: 2.5, speed: [10, 30], colors: [C.lav, C.violet], shape: 'sq', size: 1, life: [0.2, 0.3] }); } e.vy = 0; }
      if (e.y > WH + 30) Object.assign(e, makeEnemy(e.sp));
    }
    // 接觸傷害
    if (e.hitstun <= 0 && P.enemyAggro) {
      const c = bodyCenter(e);
      if (Math.abs(c.x - pl.x) < (e.w / 2 + pl.w / 2 - 2) && Math.abs(c.y - (pl.y - pl.h / 2)) < (e.h / 2 + pl.h / 2 - 3)) hurtPlayer(e);
    }
  }

  // ---------------- 主更新 ----------------
  function update(dt) {
    time += dt;
    shake.update(dt);
    if (hitstop > 0) { hitstop -= dt; for (const e of enemies) if (e.shakeT > 0) e.shakeT -= dt; return; }
    updatePlayer(dt);
    checkHits();
    for (const e of enemies) updateEnemy(e, dt);
    updateRopes(dt);
    parts.update(dt); floats.update(dt);
    for (const gh of pl.ghosts) gh.age += dt;
    pl.ghosts = pl.ghosts.filter(gh => gh.age < 0.18);
    if (comboT > 0 && (comboT -= dt) <= 0) combo = 0;
    if (hintT > 0) hintT -= dt;
    // 環境：櫻花瓣與螢火
    ambientT -= dt;
    if (ambientT <= 0) {
      ambientT = 0.18;
      parts.add({ x: cam.x + rand(0, W + 60), y: cam.y - 4, vx: rand(-22, -8), vy: rand(12, 26), life: 8, colors: [C.pink, C.pink, C.white, C.pink], shape: 'px', petal: true });
      if (Math.random() < 0.35) parts.add({ x: cam.x + rand(0, W), y: cam.y + rand(60, H), vx: rand(-6, 6), vy: rand(-8, -2), life: rand(2, 4), colors: [C.dgreen, C.green, C.white, C.green, C.dgreen], shape: 'px', drag: 0.2 });
    }
    for (const p of parts.list) if (p.petal) p.vx += Math.sin(time * 2 + p.y * 0.05) * 18 * dt;
    // 鏡頭
    const lead = pl.face * P.camLead + clamp(pl.vx * 0.08, -12, 12);
    cam.follow(pl.x + lead, pl.y - 34, dt, { smoothX: P.camSmooth, smoothY: P.camSmooth * 1.6, deadY: P.camDeadY });
  }
  /** 由肩膀、手臂與鈴杖角度算出手與杖尖位置 */
  function computeRig() {
    const sh = shoulder();
    const reach = P.atkReach * (pl.atk ? pl.atk.def.reach : 1);
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

  // ---------------- 繪製 ----------------
  function buildBackground() {
    const sky = makeLayer(W, H, PALETTE, p => {
      // 夜空：有序抖動的三段漸層
      for (let y = 0; y < H; y++) {
        const t = y / H;
        const [a, b, f] = t < 0.45 ? [C.ink, C.night, t / 0.45] : t < 0.8 ? [C.night, C.indigo, (t - 0.45) / 0.35] : [C.indigo, C.violet, (t - 0.8) / 0.2 * 0.6];
        p.rect(0, y, W, 1, a);
        p.dither(0, y, W, 1, b, Math.round(f * 16));
      }
      let seed = 3; const r = () => (seed = seed * 16807 % 2147483647) / 2147483647;
      for (let i = 0; i < 90; i++) p.px(r() * W, r() * H * 0.7, r() < 0.2 ? C.white : r() < 0.6 ? C.moon : C.lav);
      // 月亮與月暈
      const mx = 246, my = 44;
      p.dither(mx - 34, my - 34, 69, 69, C.indigo, 0);
      for (let y = -32; y <= 32; y++) for (let x = -32; x <= 32; x++) { const d = Math.hypot(x, y); if (d > 23 && d < 32 && ((x + y) & 1) === 0 && d < 23 + (32 - 23) * (1 - Math.abs(Math.sin(Math.atan2(y, x) * 3)) * 0.4)) p.px(mx + x, my + y, d < 27 ? C.violet : C.indigo); }
      p.circle(mx, my, 21, C.moon);
      p.circle(mx - 2, my - 2, 19, C.white);
      p.circle(mx + 6, my + 5, 4, C.moon); p.circle(mx - 8, my + 8, 2, C.moon); p.circle(mx + 1, my - 10, 3, C.moon);
    });
    const farW = W + Math.ceil((WW - W) * 0.15) + 8;
    const far = makeLayer(farW, H, PALETTE, p => {
      for (let x = 0; x < farW; x++) {
        const h = 62 + Math.sin(x * 0.021) * 18 + Math.sin(x * 0.053 + 1) * 9 + Math.sin(x * 0.13) * 3;
        const top = Math.round(H - h);
        p.rect(x, top, 1, H - top, C.indigo);
        p.px(x, top, C.violet);
        if (Math.sin(x * 0.021) > 0.5) p.px(x, top + 1, C.violet);
      }
      // 山間霧
      for (let y = 140; y < H; y++) p.dither(0, y, farW, 1, C.violet, Math.round((y - 140) / 40 * 7));
    });
    const midW = W + Math.ceil((WW - W) * 0.4) + 8;
    const mid = makeLayer(midW, H, PALETTE, p => {
      // 樹叢
      let seed = 9; const r = () => (seed = seed * 16807 % 2147483647) / 2147483647;
      for (let x = -10; x < midW + 10; x += 9) { const rr = 9 + r() * 10; p.circle(x, 150 - r() * 16, rr, C.night); }
      p.rect(0, 150, midW, H - 150, C.night);
      // 五重塔剪影
      const pag = (cx, base) => {
        for (let i = 0; i < 5; i++) {
          const y = base - i * 17, w = 30 - i * 4;
          p.rect(cx - w / 2 + 5, y - 11, w - 10, 11, C.night);
          for (let k = 0; k < 4; k++) p.rect(cx - w / 2 - k, y - 13 - k, w + k * 2, 1, C.night);
          if (i < 4) { p.px(cx - 3, y - 6, C.orange); p.px(cx + 3, y - 6, C.orange); }
        }
        p.rect(cx - 1, base - 5 * 17 - 14, 2, 14, C.night);
        for (let k = 0; k < 5; k++) p.px(cx - 2, base - 5 * 17 - 12 + k * 3, C.night), p.px(cx + 1, base - 5 * 17 - 12 + k * 3, C.night);
      };
      pag(180, 150); pag(560, 150);
      // 遠方神社屋頂
      for (const cx of [60, 360, 470]) {
        for (let k = 0; k < 8; k++) p.rect(cx - 26 + k * 2, 132 - k * 2, 52 - k * 4, 2, C.night);
        p.rect(cx - 18, 132, 36, 20, C.night);
        p.rect(cx - 12, 140, 4, 3, C.orange); p.rect(cx + 8, 140, 4, 3, C.orange);
      }
    });
    return { sky, far, mid };
  }
  function buildWorldLayer() {
    return makeLayer(WW, WH, PALETTE, p => {
      // 大鳥居（背景）
      const torii = (cx, base, s) => {
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
      };
      torii(53 * T, GROUND * T, 1.15);
      torii(3 * T + 8, GROUND * T, 0.8);
      // 地形
      for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
        const ch = MAP[ty][tx], x = tx * T, y = ty * T;
        if (ch === '#') {
          const topOpen = ty > 0 && MAP[ty - 1][tx] !== '#';
          p.rect(x, y, T, T, topOpen ? C.violet : C.indigo);
          // 石磚
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
          if (tx > 0 && MAP[ty][tx - 1] !== '#' && !topOpen) p.rect(x, y, 1, T, C.violet);
        } else if (ch === '=') {
          p.rect(x, y, T, 4, C.wood);
          p.rect(x, y, T, 1, C.gold);
          p.rect(x, y + 4, T, 1, C.ink);
          p.rect(x, y + 3, T, 1, C.dwood);
          p.px(x + 3, y + 2, C.dwood); p.px(x + 12, y + 2, C.dwood);
          if (MAP[ty][tx - 1] !== '=') p.rect(x + 2, y + 5, 2, 5, C.dwood);
          if (MAP[ty][tx + 1] !== '=') p.rect(x + 12, y + 5, 2, 5, C.dwood);
        }
      }
    });
  }
  function drawBackground() {
    g.screenSpace();
    g.ctx.drawImage(bg.sky, 0, 0);
    // 星星閃爍
    for (let i = 0; i < 6; i++) { const x = (i * 53 + 17) % W, y = (i * 29 + 11) % 100; if (Math.sin(time * 2.3 + i * 1.7) > 0.6) { g.px(x, y, C.white); g.px(x - 1, y, C.moon); g.px(x + 1, y, C.moon); g.px(x, y - 1, C.moon); g.px(x, y + 1, C.moon); } }
    const cx = Math.round(cam.x), cy = Math.round(cam.y);
    const vy = Math.round((cy - (WH - H)) * 0.1);
    g.ctx.drawImage(bg.far, -Math.round(cx * 0.15), 10 - vy);
    g.ctx.drawImage(bg.mid, -Math.round(cx * 0.4), 14 - Math.round((cy - (WH - H)) * 0.25));
  }
  function drawToro(x, y) {
    g.spr(S.toro, x - 6, y - 13);
    const fl = Math.sin(time * 9 + x) > 0.2;
    g.rect(x - 2, y - 8, 4, 2, fl ? C.gold : C.orange);
    if (fl) g.px(x, y - 9, C.white);
  }
  function drawPlayer() {
    const sx = pl.face > 0 ? RIG.tail[0] : RIG.w - 1 - RIG.tail[0];
    let spr;
    const hurt = pl.hurtT > 0;
    if (hurt) spr = S.hirin.hurt;
    else if (pl.dashT > 0) spr = S.hirin.dash;
    else if (!pl.onGround) spr = pl.vy < -20 ? S.hirin.jump : S.hirin.fall;
    else if (pl.atk) spr = S.hirin.fall;
    else if (Math.abs(pl.vx) > 12) spr = S.hirin.run[Math.floor(pl.runPhase) % 6];
    else spr = pl.blinkT < 0.12 ? S.hirin.blink : S.hirin.idle[Math.floor(time * 1.6) % 2];
    const x0 = Math.round(pl.x - 8), y0 = Math.round(pl.y - 26);
    // 殘影（色階淡出）
    for (const gh of pl.ghosts) {
      const c = gh.age < 0.06 ? C.lav : gh.age < 0.12 ? C.violet : C.indigo;
      g.spr(gh.spr, Math.round(gh.x - 8), Math.round(gh.y - 26), { flip: gh.face < 0, color: c });
    }
    const blinkOff = pl.inv > 0 && !hurt && Math.floor(pl.inv * 20) % 2 === 1;
    if (blinkOff) return;
    const color = pl.flashRed > 0 ? C.red : null;
    // 馬尾（在身體後面）
    const tail = pl.dashT > 0 || (pl.onGround && Math.abs(pl.vx) > 70) ? S.tail.swept : (!pl.onGround && pl.vy > 60) ? S.tail.lifted : S.tail.hang;
    const tw = tail.w, th = tail.h;
    const sway = tail === S.tail.hang ? Math.round(Math.sin(time * 3) * 0.6) : 0;
    const tx = pl.face > 0 ? x0 + sx - tw + 2 + sway : x0 + sx - 1 - sway;
    const ty = y0 + RIG.tail[1] + (tail === S.tail.lifted ? -th + 3 : -1) + Math.round((1 - pl.sy) * 26);
    g.spr(tail, tx, ty, { flip: pl.face < 0, color });
    g.spr(spr, x0, y0, { flip: pl.face < 0, sx: pl.sx, sy: pl.sy, color });
    // 前手與神樂鈴杖
    const sh = shoulder(), hd = pl.hand, tip = pl.tip;
    const sa = worldAng(pl.staffA, pl.face);
    const back = { x: hd.x - Math.cos(sa) * 4, y: hd.y - Math.sin(sa) * 4 };
    g.line(back.x, back.y, tip.x, tip.y, C.ink, 3);
    g.line(back.x, back.y, tip.x, tip.y, C.gold);
    g.line(sh.x, sh.y, hd.x, hd.y, C.ink, 3);
    g.line(sh.x, sh.y, hd.x, hd.y, color ?? C.white, 2);
    g.rect(hd.x - 1, hd.y - 1, 2, 2, color ?? C.skin);
    // 緞帶（繩索模擬）
    pl.ropes.forEach((rope, ri) => { for (let i = 1; i < rope.length; i++) g.line(rope[i - 1].x, rope[i - 1].y, rope[i].x, rope[i].y, ri ? C.pink : C.red); });
    g.spr(S.bell, tip.x - 1, tip.y - 1);
  }
  function drawSmear() {
    const a = pl.atk;
    if (!a || !P.smear) return;
    const activeEnd = a.S + a.A;
    if (a.f <= a.S || a.f > activeEnd + 3) return;
    const sh = shoulder();
    const R = P.atkReach * a.def.reach;
    const wind = a.def.a0 - 0.3 * sign(a.def.a1 - a.def.a0);
    // 殘影從揮擊起點延伸到目前角度；結束後尾端向前收
    const fade = Math.max(0, a.f - activeEnd) / 3;
    const startLocal = lerp(wind, pl.staffA, Math.min(1, 0.15 + fade));
    const w0 = worldAng(startLocal, pl.face), w1 = worldAng(pl.staffA, pl.face);
    const big = a.def.finisher;
    g.arcBand(sh.x, sh.y, R - (big ? 9 : 7), R - 3, w0, w1, C.lav);
    g.arcBand(sh.x, sh.y, R - 4, R - 1, w0, w1, C.moon);
    g.arcBand(sh.x, sh.y, R - 1, R + 2, w0, w1, fade > 0.5 ? C.moon : C.white);
  }
  function drawEnemy(e) {
    if (e.dead) return;
    const jitter = e.shakeT > 0 && hitstop > 0 ? (Math.floor(time * 60) % 2 ? 2 : -2) : 0;
    const flash = e.flash > 0 ? C.white : null;
    if (e.type === 'dummy') {
      const spr = e.lean < -0.35 ? S.scarecrow.left : e.lean > 0.35 ? S.scarecrow.right : S.scarecrow.mid;
      g.spr(spr, Math.round(e.x - 9) + jitter, Math.round(e.y - 26), { color: flash });
    } else if (e.type === 'lantern') {
      const spr = e.hitstun > 0 ? S.lantern.hurt : (Math.sin(e.t * 0.9) > 0.97 ? S.lantern.blink : S.lantern.float[Math.floor(e.t * 3) % 2]);
      // 燈籠光暈：一圈閃爍的橘色光點
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + e.t * 0.8; if (Math.sin(e.t * 7 + i * 2.1) > 0.1) g.px(e.x + Math.cos(a) * 11, e.y + Math.sin(a) * 10, i % 3 ? C.orange : C.gold); }
      g.spr(spr, Math.round(e.x - 7) + jitter, Math.round(e.y - 8 + Math.sin(e.t * 2.5) * 1.5), { flip: e.face > 0, color: flash });
    } else {
      const spr = e.hitstun > 0 ? S.umbrella.hurt : !e.onGround ? S.umbrella.hop : e.hopT < 0.2 ? S.umbrella.crouch : S.umbrella.stand;
      g.spr(spr, Math.round(e.x - 8) + jitter, Math.round(e.y - 20), { flip: e.face > 0, color: flash });
    }
  }
  function drawHitboxes() {
    const box = (x, y, w, h, c) => { g.rect(x, y, w, 1, c); g.rect(x, y + h - 1, w, 1, c); g.rect(x, y, 1, h, c); g.rect(x + w - 1, y, 1, h, c); };
    box(pl.x - pl.w / 2, pl.y - pl.h, pl.w, pl.h, pl.inv > 0 ? C.gold : C.green);
    for (const e of enemies) if (!e.dead) { const c = bodyCenter(e); box(c.x - e.w / 2, c.y - e.h / 2, e.w, e.h, C.green); }
    const a = pl.atk;
    if (a && a.f > a.S && a.f <= a.S + a.A) {
      const sh = shoulder(), R = P.atkReach * a.def.reach;
      const w0 = worldAng(a.prevAng, pl.face), w1 = worldAng(pl.staffA, pl.face);
      g.arcBand(sh.x, sh.y, R - 1, R + 1, w0, w1, C.red);
      g.line(sh.x, sh.y, sh.x + Math.cos(w0) * R, sh.y + Math.sin(w0) * R, C.red);
      g.line(sh.x, sh.y, sh.x + Math.cos(w1) * R, sh.y + Math.sin(w1) * R, C.red);
    }
  }
  function drawHUD() {
    g.screenSpace();
    for (let i = 0; i < 5; i++) g.spr(i < pl.hp ? heart : heartEmpty, 5 + i * 9, 5);
    // 空中跳躍與衝刺剩餘次數（小點）
    for (let i = 0; i < P.airJumps; i++) g.rect(6 + i * 5, 15, 3, 3, i < pl.airJumps ? C.gold : C.indigo);
    for (let i = 0; i < P.airDashes; i++) g.rect(6 + i * 5, 20, 3, 2, i < pl.dashes ? C.moon : C.indigo);
    if (combo >= 2) {
      const pop = time - lastHit < 0.06 ? 1 : 0;
      g.text(String(combo), W - 34, 7 - pop, combo >= 10 ? C.gold : C.white, { scale: 2, align: 'right', outline: C.ink });
      g.text('HIT', W - 31, 12, C.pink, { outline: C.ink });
      g.rect(W - 58, 24, Math.round(52 * clamp(comboT / 1.8, 0, 1)), 1, C.pink);
    }
    if (hintT > 0 && (hintT > 1.5 || Math.floor(hintT * 6) % 2)) g.text('Z JUMP   X ATTACK   C DASH', W / 2, H - 10, C.moon, { small: true, align: 'center', outline: C.ink });
  }
  function render() {
    drawBackground();
    g.camera(cam.x + shake.x, cam.y + shake.y);
    g.ctx.drawImage(world, 0, 0);
    for (const tx of TORO_AT) drawToro(tx * T + 8, GROUND * T);
    parts.draw(g, p => !p.petal && p.colors[0] === C.dgreen); // 螢火在角色後面
    for (const e of enemies) drawEnemy(e);
    drawPlayer();
    drawSmear();
    parts.draw(g, p => !(p.colors[0] === C.dgreen && !p.petal));
    floats.draw(g);
    if (P.showHitbox) drawHitboxes();
    drawHUD();
  }
  function debugLines() {
    const a = pl.atk;
    return [
      `STATE ${pl.hurtT > 0 ? 'HURT' : pl.dashT > 0 ? 'DASH' : a ? 'ATK ' + a.kind.toUpperCase() + ' F' + a.f : pl.onGround ? 'GROUND' : 'AIR'}`,
      `VX ${pl.vx.toFixed(0)}  VY ${pl.vy.toFixed(0)}`,
      `COYOTE ${Math.max(0, pl.coyote * 1000).toFixed(0)}  BUF ${Math.max(0, pl.buffer * 1000).toFixed(0)}`,
      `AIRJ ${pl.airJumps}  DASH ${pl.dashes}  HITSTOP ${Math.max(0, hitstop * 1000).toFixed(0)}`,
    ];
  }
  /** 封面構圖：主角在稻草人前揮出終結技 */
  function stageCover() {
    reset();
    pl.x = 4 * T + 8 + 22; pl.face = -1; hintT = 0;
    cam.center(pl.x - 40, pl.y - 40);
    startAttack('g3'); pl.atk.f = pl.atk.S + pl.atk.A - 1;
  }

  reset();
  return { update, render, reset, debugLines, stageCover, peek: () => ({ pl, enemies, combo, hitstop, cam }) };
}

runPrototype({
  id: 'moon-kagura',
  title: '月下神樂',
  subtitle: '原型 A・橫向動作平台',
  width: W, height: H, palette: PALETTE, ui: { text: C.white, dark: C.ink },
  input: {
    left: { keys: ['ArrowLeft', 'KeyA'] }, right: { keys: ['ArrowRight', 'KeyD'] },
    up: { keys: ['ArrowUp', 'KeyW'] }, down: { keys: ['ArrowDown', 'KeyS'] },
    jump: { keys: ['KeyZ', 'Space', 'KeyK'], pad: [0] },
    attack: { keys: ['KeyX', 'KeyJ'], pad: [2] },
    dash: { keys: ['KeyC', 'ShiftLeft', 'ShiftRight', 'KeyL'], pad: [1, 5] },
  },
  touch: [{ action: 'dash', label: '衝' }, { action: 'attack', label: '攻', big: true }, { action: 'up', label: '↑' }, { action: 'jump', label: '跳', big: true }],
  tuning: TUNING,
  intro: INTRO,
  create,
});
