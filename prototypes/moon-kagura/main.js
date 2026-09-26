// 《月下神樂》MOONLIT KAGURA：橫向動作平台（銀河惡魔城 Lite）
// 巫女緋鈴揮舞神樂鈴杖，穿過四個區域驅散妖怪、找回被蝕影吞噬的月亮。
// 這個檔案負責：調參面板、場景流程（標題／神社繪卷／關卡／結算／結局）與各種選單。
import { runPrototype } from '../engine/app.js';
import { Sprite } from '../engine/pixel.js';
import { Menu, Dialog, Transition, drawWindow, drawCursor, drawParagraph, fmtTime } from '../engine/ui.js';
import { wrapLabel, labelWidth } from '../engine/text.js';
import { SaveData } from '../engine/save.js';
import { clamp, rand } from '../engine/fx.js';
import { PALETTE, buildSprites } from './sprites.js';
import { STAGES } from './levels.js';
import { createWorld } from './world.js';
import { nightBackdrop, C } from './themes.js';
import { SONGS } from './songs.js';

const W = 320, H = 180;
const THEME = { ink: C.ink, panel: C.night, border: C.violet, light: C.indigo, text: C.white, dim: C.lav, accent: C.gold, hilite: C.indigo, selText: C.white };

// ---------------- 調參面板 ----------------
const TUNING = {
  groups: [
    { name: '移動', items: [
      { key: 'runSpeed', label: '最高跑速', min: 40, max: 260, step: 1, value: 110, unit: 'px/s' },
      { key: 'groundAccel', label: '地面加速度', min: 100, max: 8000, step: 50, value: 1200, unit: 'px/s²', hint: '從靜止到全速有多快。大＝一按就到全速，小＝有起步的重量感。' },
      { key: 'groundDecel', label: '地面減速度', min: 100, max: 9000, step: 50, value: 1600, unit: 'px/s²', hint: '放開方向鍵後停下來的快慢。小＝會滑行。' },
      { key: 'turnAccel', label: '轉身加速度', min: 100, max: 12000, step: 50, value: 3000, unit: 'px/s²' },
      { key: 'airAccel', label: '空中加速度', min: 0, max: 8000, step: 50, value: 950, unit: 'px/s²', hint: '空中改變方向的能力（空中控制）。' },
      { key: 'airDecel', label: '空中減速度', min: 0, max: 8000, step: 50, value: 450, unit: 'px/s²' },
    ] },
    { name: '跳躍', items: [
      { key: 'jumpHeight', label: '跳躍高度', min: 16, max: 140, step: 1, value: 54, unit: 'px', hint: '長按跳躍的最高高度。一格地形是 16px。關卡是以預設值設計的。' },
      { key: 'jumpTime', label: '到頂時間', min: 0.15, max: 0.8, step: 0.01, value: 0.36, unit: '秒' },
      { key: 'fallMult', label: '下落重力倍率', min: 0.5, max: 4, step: 0.05, value: 1.7, unit: '×' },
      { key: 'jumpCut', label: '短按重力倍率', min: 1, max: 6, step: 0.1, value: 2.6, unit: '×', hint: '上升中放開跳躍鍵時的重力倍率。越大，短按跳得越低。' },
      { key: 'apexHang', label: '頂點滯空', min: 0.2, max: 1, step: 0.05, value: 0.55, unit: '×' },
      { key: 'apexWindow', label: '頂點判定速度', min: 0, max: 150, step: 5, value: 40, unit: 'px/s' },
      { key: 'maxFall', label: '最大下落速度', min: 100, max: 800, step: 10, value: 330, unit: 'px/s' },
      { key: 'coyote', label: '土狼時間', min: 0, max: 300, step: 5, value: 90, unit: 'ms', hint: '走出平台邊緣後，仍然可以起跳的寬限時間。' },
      { key: 'jumpBuffer', label: '跳躍輸入緩衝', min: 0, max: 300, step: 5, value: 110, unit: 'ms' },
      { key: 'airJumps', label: '空中跳躍次數', min: 0, max: 3, step: 1, value: 1, unit: '次', hint: '學會「二段跳」之後才會生效。' },
      { key: 'airJumpRatio', label: '二段跳高度比例', min: 0.3, max: 1.5, step: 0.05, value: 0.8, unit: '×' },
    ] },
    { name: '衝刺', items: [
      { key: 'dashSpeed', label: '衝刺速度', min: 100, max: 700, step: 10, value: 330, unit: 'px/s' },
      { key: 'dashTime', label: '衝刺時間', min: 0.05, max: 0.4, step: 0.01, value: 0.14, unit: '秒' },
      { key: 'dashCooldown', label: '衝刺冷卻', min: 0, max: 1.5, step: 0.05, value: 0.3, unit: '秒' },
      { key: 'dashKeep', label: '衝刺後保留速度', min: 0, max: 1, step: 0.05, value: 0.45, unit: '×' },
      { key: 'airDashes', label: '空中衝刺次數', min: 0, max: 3, step: 1, value: 1, unit: '次' },
      { key: 'dashIframes', label: '衝刺期間無敵', type: 'toggle', value: true },
    ] },
    { name: '壁跳與機關', open: false, items: [
      { key: 'wallSlide', label: '貼牆下滑速度', min: 10, max: 300, step: 5, value: 60, unit: 'px/s' },
      { key: 'wallJumpX', label: '壁跳水平速度', min: 40, max: 400, step: 5, value: 150, unit: 'px/s' },
      { key: 'wallJumpY', label: '壁跳高度比例', min: 0.4, max: 1.4, step: 0.05, value: 0.95, unit: '×' },
      { key: 'wallJumpLock', label: '壁跳後方向鎖定', min: 0, max: 0.4, step: 0.01, value: 0.14, unit: '秒', hint: '蹬牆後短暫忽略方向鍵，避免立刻黏回同一面牆。' },
      { key: 'drumBoost', label: '太鼓彈跳倍率', min: 1, max: 2.2, step: 0.05, value: 1.45, unit: '×' },
      { key: 'crumbleTime', label: '碎裂木板承重時間', min: 0.1, max: 1.5, step: 0.05, value: 0.35, unit: '秒' },
    ] },
    { name: '攻擊', items: [
      { key: 'atkStartup', label: '前搖', min: 0, max: 12, step: 1, value: 3, unit: '格' },
      { key: 'atkActive', label: '判定持續', min: 1, max: 12, step: 1, value: 4, unit: '格' },
      { key: 'atkRecovery', label: '後搖', min: 0, max: 30, step: 1, value: 10, unit: '格' },
      { key: 'comboCancel', label: '連段接續時機', min: 0, max: 1, step: 0.05, value: 0.4, unit: '×' },
      { key: 'comboWindow', label: '連段輸入窗口', min: 0, max: 800, step: 10, value: 280, unit: 'ms' },
      { key: 'atkReach', label: '攻擊距離', min: 12, max: 48, step: 1, value: 25, unit: 'px' },
      { key: 'atkLunge', label: '攻擊前衝', min: 0, max: 300, step: 5, value: 70, unit: 'px/s' },
      { key: 'atkMove', label: '攻擊中移動倍率', min: 0, max: 1, step: 0.05, value: 0.25, unit: '×' },
      { key: 'cancelDash', label: '後搖可用衝刺取消', type: 'toggle', value: true },
      { key: 'cancelJump', label: '後搖可用跳躍取消', type: 'toggle', value: true },
      { key: 'airHitHop', label: '空中命中滯空', min: 0, max: 300, step: 5, value: 90, unit: 'px/s' },
      { key: 'pogo', label: '下劈彈跳', min: 0, max: 600, step: 10, value: 280, unit: 'px/s', hint: '學會「下劈彈跳」後：空中按住「下」攻擊，打中時向上彈起。' },
    ] },
    { name: '靈力', open: false, items: [
      { key: 'spiritPerHit', label: '每次命中的靈力', min: 0, max: 0.5, step: 0.01, value: 0.12, unit: '顆' },
      { key: 'spellRadius', label: '鈴祓範圍', min: 20, max: 100, step: 2, value: 52, unit: 'px' },
      { key: 'spellDamage', label: '鈴祓傷害', min: 1, max: 10, step: 1, value: 3, unit: '' },
      { key: 'healTime', label: '回復所需時間', min: 0.2, max: 2.5, step: 0.05, value: 0.9, unit: '秒', hint: '按住 V 回復 1 點體力所需的時間（要站在地上）。' },
    ] },
    { name: '打擊感', items: [
      { key: 'hitstop', label: '打擊停頓', min: 0, max: 250, step: 5, value: 55, unit: 'ms' },
      { key: 'hitstopFinisher', label: '終結技停頓', min: 0, max: 400, step: 5, value: 110, unit: 'ms' },
      { key: 'knockX', label: '擊退（水平）', min: 0, max: 500, step: 5, value: 150, unit: 'px/s' },
      { key: 'knockY', label: '擊退（上挑）', min: 0, max: 400, step: 5, value: 90, unit: 'px/s' },
      { key: 'finisherKnock', label: '終結技擊退倍率', min: 1, max: 4, step: 0.1, value: 2, unit: '×' },
      { key: 'hitstun', label: '敵人硬直', min: 0, max: 1000, step: 10, value: 280, unit: 'ms' },
      { key: 'recoil', label: '自身反衝', min: 0, max: 300, step: 5, value: 40, unit: 'px/s' },
      { key: 'shake', label: '畫面震動', min: 0, max: 8, step: 0.5, value: 2, unit: 'px' },
      { key: 'shakeFinisher', label: '終結技震動', min: 0, max: 12, step: 0.5, value: 4, unit: 'px' },
      { key: 'flashFrames', label: '命中閃白', min: 0, max: 10, step: 1, value: 3, unit: '格' },
      { key: 'victimShake', label: '受擊者抖動', type: 'toggle', value: true },
      { key: 'sparks', label: '打擊火花數量', min: 0, max: 30, step: 1, value: 9, unit: '個' },
      { key: 'smear', label: '刀光殘影', type: 'toggle', value: true },
      { key: 'squash', label: '壓縮伸展', min: 0, max: 0.5, step: 0.02, value: 0.18, unit: '×' },
      { key: 'bellScale', label: '鈴聲隨連段升調', type: 'toggle', value: true },
    ] },
    { name: '受擊', open: false, items: [
      { key: 'iframes', label: '受擊無敵時間', min: 0, max: 3000, step: 50, value: 1000, unit: 'ms' },
      { key: 'hurtKnockX', label: '受擊擊退（水平）', min: 0, max: 400, step: 5, value: 140, unit: 'px/s' },
      { key: 'hurtKnockY', label: '受擊擊退（上彈）', min: 0, max: 400, step: 5, value: 170, unit: 'px/s' },
      { key: 'hurtStun', label: '受擊硬直', min: 0, max: 800, step: 10, value: 250, unit: 'ms' },
      { key: 'hurtHitstop', label: '受擊停頓', min: 0, max: 300, step: 5, value: 80, unit: 'ms' },
    ] },
    { name: '鏡頭與敵人', open: false, items: [
      { key: 'camLead', label: '鏡頭前瞻', min: 0, max: 80, step: 1, value: 28, unit: 'px' },
      { key: 'camSmooth', label: '鏡頭平滑', min: 0, max: 0.5, step: 0.01, value: 0.09, unit: '秒' },
      { key: 'camDeadY', label: '垂直死區', min: 0, max: 60, step: 1, value: 18, unit: 'px' },
      { key: 'enemyWeight', label: '敵人重量倍率', min: 0.3, max: 3, step: 0.1, value: 1, unit: '×' },
      { key: 'enemyAggro', label: '敵人會主動攻擊', type: 'toggle', value: true },
      { key: 'bossHp', label: '守護妖體力倍率', min: 0.2, max: 3, step: 0.1, value: 1, unit: '×', hint: '覺得守護妖太難或太簡單可以調整。' },
    ] },
  ],
  presets: {
    '均衡（預設值）': {},
    '輕快靈活': { groundAccel: 3000, groundDecel: 4000, turnAccel: 8000, airAccel: 2400, jumpTime: 0.3, fallMult: 2.1, jumpCut: 3.2, dashSpeed: 390, dashTime: 0.12, atkStartup: 2, atkRecovery: 7, comboCancel: 0.25, hitstop: 40, hitstopFinisher: 80, knockX: 120, coyote: 110, jumpBuffer: 130, camSmooth: 0.06 },
    '厚重扎實': { runSpeed: 92, groundAccel: 520, groundDecel: 800, turnAccel: 1000, airAccel: 450, jumpTime: 0.42, fallMult: 1.35, jumpCut: 1.8, atkStartup: 6, atkActive: 5, atkRecovery: 16, comboCancel: 0.6, atkLunge: 130, hitstop: 95, hitstopFinisher: 180, knockX: 230, knockY: 130, shake: 3, shakeFinisher: 6, recoil: 80, squash: 0.26, camSmooth: 0.14 },
    '漂浮夢幻': { jumpTime: 0.55, fallMult: 1, apexHang: 0.3, apexWindow: 80, maxFall: 200, airJumps: 2, airAccel: 1500, airDecel: 900, pogo: 340, airHitHop: 170 },
    '輕鬆模式': { iframes: 1600, bossHp: 0.6, spiritPerHit: 0.2, healTime: 0.6, coyote: 150, jumpBuffer: 160 },
    '無特效對照組': { hitstop: 0, hitstopFinisher: 0, shake: 0, shakeFinisher: 0, flashFrames: 0, victimShake: false, sparks: 0, smear: false, squash: 0, recoil: 0, knockX: 0, knockY: 0, hitstun: 0, coyote: 0, jumpBuffer: 0, camLead: 0, camSmooth: 0, bellScale: false },
  },
};

const INTRO = {
  pitch: '月夜的山中神社，巫女緋鈴揮舞神樂鈴杖，穿過四個區域驅散妖怪，找回被蝕影吞噬的月亮。',
  goals: [
    '四個區域各有守護妖。打倒守護妖會學會新的「神樂之舞」（下劈彈跳、二段跳、壁跳）。',
    '每關藏著 3 個金鈴：每收集 3 個，最大體力 +1。有些金鈴要學會後面的能力才拿得到。',
    '寶箱裡的御守、茶屋賣的御守可以裝備 2 個，改變打法。',
    '打中妖怪累積靈力：點按 V 放出「鈴祓」，按住 V 回復體力。',
    '這裡的參數會即時影響遊戲；「輕鬆模式」預設可以降低難度。',
  ],
  controls: [
    ['← → ／ A D', '移動'],
    ['Z ／ Space', '跳躍（按住跳更高；↓＋跳躍穿過木板）'],
    ['X ／ J', '攻擊（↑＋攻擊＝上挑，空中 ↓＋攻擊＝下劈）'],
    ['C ／ Shift', '衝刺'],
    ['V', '點按：鈴祓　按住：回復'],
    ['Esc ／ P ／ Enter', '暫停選單'],
    ['手把', '左搖桿移動、A 跳、X 攻擊、B／RB 衝刺、Y 靈力、Start 暫停'],
    ['F ／ N ／ H', '凍結畫面／逐格播放／顯示判定框（除錯）'],
  ],
};

const CHARMS = {
  swift: { name: '迅風守', desc: '衝刺冷卻減半，衝刺時撞到的妖怪會受傷。', from: '狸貓茶屋' },
  adamant: { name: '金剛守', desc: '最大體力 +1。', from: '竹林小徑的寶箱' },
  resonance: { name: '共鳴守', desc: '靈力累積速度提升 60%。', from: '狸貓茶屋' },
  moonshade: { name: '月影守', desc: '受傷後的無敵時間延長 60%。', from: '本殿迴廊的寶箱' },
  breaker: { name: '破魔守', desc: '三段連擊的最後一擊會放出月牙劍氣。', from: '地下祭壇的寶箱' },
  fortune: { name: '招福守', desc: '妖怪掉落的錢幣加倍，錢幣會自動飛過來。', from: '鳥居參道的寶箱' },
  longbell: { name: '長鈴守', desc: '攻擊距離增加 25%。', from: '狸貓茶屋' },
  vigor: { name: '回春守', desc: '每命中 20 次，回復 1 點體力。', from: '狸貓茶屋' },
};
const CHARM_ORDER = ['fortune', 'adamant', 'moonshade', 'breaker', 'swift', 'resonance', 'longbell', 'vigor'];
const SHOP = [
  { id: 'swift', price: 80 }, { id: 'resonance', price: 70 }, { id: 'longbell', price: 110 }, { id: 'vigor', price: 150 },
  { id: 'spirit1', price: 100, name: '靈力珠 ＋1', desc: '靈力上限增加 1 顆（最多 4 顆）。' },
  { id: 'spirit2', price: 160, name: '靈力珠 ＋1', desc: '靈力上限再增加 1 顆。' },
];
const SLOTS = 2;
const ABIL = {
  pogo: { name: '下劈彈跳', desc: '在空中按 下鍵＋X 往下揮杖。打中妖怪、風鈴或飛行道具會彈起來，並恢復空中衝刺。' },
  airjump: { name: '二段跳', desc: '在空中再按一次 Z，可以再跳一次。' },
  wall: { name: '壁跳', desc: '在空中貼著牆壁、按住朝牆的方向鍵會慢慢滑下；這時按 Z 蹬牆跳起。' },
};
const BOSS_LINES = [
  ['大提燈：嗚嗚……燈油……燒完了……', '緋鈴：月光的氣息，從竹林那邊傳過來了。'],
  ['鎌鼬：好快的鈴聲……在下，認輸了。', '緋鈴：本殿那邊……好像有誰在等我。'],
  ['白狐：巫女啊，蝕影來自祭壇的地底。月亮的哭聲，你聽見了嗎？', '緋鈴：聽見了。所以我一定要去。'],
];
const MAP_NODES = [
  { x: 40, y: 142, kind: 'shop' }, { x: 92, y: 126 }, { x: 150, y: 108 }, { x: 206, y: 86 }, { x: 262, y: 60 },
];

function create(ctx) {
  const { screen: g, input, sound, music, touch, P } = ctx;
  const S = buildSprites();
  S.heart = new Sprite(['.oo.oo.', 'oRRoRRo', 'oRwRRRo', 'oRRRRRo', '.oRRRo.', '..oRo..', '...o...'], { o: 0, R: 9, w: 6 }, PALETTE);
  S.heartEmpty = new Sprite(['.oo.oo.', 'oiioiio', 'oiiiiio', 'oiiiiio', '.oiiio.', '..oio..', '...o...'], { o: 0, i: 2 }, PALETTE);
  const save = new SaveData('stardust/moon-kagura/save', {
    v: 1, started: false, cleared: [false, false, false, false], abil: { pogo: false, airjump: false, wall: false },
    bells: {}, chests: {}, charms: [], equipped: [], coins: 0, spiritMax: 2, bought: [], best: [null, null, null, null], ending: false, deaths: 0,
  });
  const D = () => save.data;
  const totalBells = () => Object.values(D().bells).reduce((n, a) => n + a.filter(Boolean).length, 0);
  const env = {
    g, input, sound, P, S,
    get save() { return D(); },
    unlocked: id => P.unlockAll || D().abil[id],
    equipped: id => D().equipped.includes(id),
    maxHp: () => 5 + Math.floor(totalBells() / 3) + (D().equipped.includes('adamant') ? 1 : 0),
    spiritMax: () => P.unlockAll ? 4 : D().spiritMax,
    totalBells,
    persist: () => save.save(),
    wrap: (s, w) => wrapLabel(s, w),
    measure: s => labelWidth(s),
    hooks: {
      onBossStart(st) { music.play(st.boss === 'serpent' ? SONGS.final : SONGS.boss); },
      onRespawn() { music.play(SONGS[world.stage.song]); },
      onCharm(id) { openMessage({ title: '獲得御守', icon: S.charms[id], name: CHARMS[id].name, desc: CHARMS[id].desc + '\n（在暫停選單或神社繪卷按 C 可以裝備）' }); },
      onClear(stats) { go(() => stageClear(stats)); },
    },
  };
  const world = createWorld(env);
  const backdrop = nightBackdrop(W, H, { moonX: 248, moonY: 44, moonR: 22 });
  const titleBack = nightBackdrop(W, H, { moonX: 160, moonY: 58, moonR: 34, seed: 3 });
  const trans = new Transition();
  const dialog = new Dialog(THEME, sound);
  let scene = 'title', overlay = null, time = 0, mapSel = 1, result = null, ending = null;
  const petals = [];

  // ---------------- 場景切換 ----------------
  function go(fn) { trans.start(() => { overlay = null; fn(); }); }
  function enterTitle() {
    scene = 'title'; music.play(SONGS.title); touch.setVisible(false);
    titleMenu = buildTitleMenu();
  }
  function enterMap() {
    scene = 'map'; music.play(SONGS.map); touch.setVisible(false);
    if (!nodeUnlocked(mapSel)) mapSel = 1;
  }
  function startStage(i) {
    save.save();
    world.load(i);
    scene = 'play'; overlay = null;
    music.play(SONGS[STAGES[i].song]);
    touch.setVisible(true);
  }
  function stageClear(stats) {
    const i = stats.stage, st = STAGES[i];
    const first = !D().cleared[i];
    D().cleared[i] = true;
    if (st.reward) D().abil[st.reward] = true;
    const best = D().best[i];
    const newBest = best == null || stats.time < best;
    if (newBest) D().best[i] = stats.time;
    save.save();
    result = { ...stats, first, newBest, reward: first ? st.reward : null, final: i === STAGES.length - 1, t: 0 };
    scene = 'result'; overlay = null;
    music.play(SONGS.clear);
    touch.setVisible(false);
  }
  const nodeUnlocked = i => i <= 1 || P.unlockAll || D().cleared[i - 2];

  // ---------------- 標題 ----------------
  let titleMenu = null;
  function buildTitleMenu() {
    const items = [];
    if (D().started) items.push({ id: 'continue', label: '繼續冒險' });
    items.push({ id: 'new', label: '新的冒險' });
    items.push({ id: 'help', label: '操作說明' });
    if (D().started) items.push({ id: 'erase', label: '刪除存檔' });
    return new Menu(items, { lineH: 16, cancel: false });
  }
  function startNew() {
    save.reset(); D().started = true; save.save();
    trans.start(() => {
      scene = 'map'; music.play(SONGS.title); mapSel = 1;
      dialog.show([
        { text: '滿月之夜。月亮被不知從何而來的「蝕影」，一點一點地吞噬了。' },
        { text: '月光變得黯淡，神社裡的器物紛紛化為妖怪，四處作亂。' },
        { name: '緋鈴', text: '神樂鈴，拜託你了……今晚一定要讓月亮恢復原狀！', voice: 880 },
        { text: '【神社繪卷】用左右鍵選擇地點，按 Z 出發。按 C 可以裝備御守。' },
      ], () => enterMap());
    });
  }
  function updateTitle(dt) {
    const r = titleMenu.update(input, sound);
    if (!r || r.type !== 'confirm') return;
    input.eat();
    switch (r.item.id) {
      case 'continue': go(enterMap); break;
      case 'new':
        if (D().started) openConfirm('開始新的冒險會覆蓋目前的存檔，確定嗎？', startNew);
        else startNew();
        break;
      case 'help': openHelp(); break;
      case 'erase': openConfirm('確定要刪除存檔嗎？（所有進度都會消失）', () => { save.reset(); titleMenu = buildTitleMenu(); }); break;
    }
  }
  function renderTitle() {
    g.screenSpace();
    g.ctx.drawImage(titleBack, 0, 0);
    // 月前的鳥居剪影
    const cx = 160, base = 150;
    g.rect(cx - 52, base - 88, 8, 88, C.ink); g.rect(cx + 44, base - 88, 8, 88, C.ink);
    g.rect(cx - 66, base - 72, 132, 6, C.ink); g.rect(cx - 74, base - 92, 148, 8, C.ink); g.rect(cx - 78, base - 96, 156, 4, C.ink);
    g.rect(cx - 6, base - 84, 12, 12, C.ink);
    g.rect(0, base, W, H - base, C.ink);
    for (let x = 0; x < W; x += 3) if ((x * 7) % 5 < 2) g.px(x, base - 1, C.ink);
    // 飄落的櫻花
    if (petals.length < 40 && Math.random() < 0.3) petals.push({ x: rand(0, W + 60), y: -4, vx: rand(-22, -8), vy: rand(12, 26), t: rand(0, 6) });
    for (const p of petals) { p.t += 1 / 60; p.x += (p.vx + Math.sin(p.t * 2) * 12) / 60; p.y += p.vy / 60; g.px(p.x, p.y, Math.floor(p.t * 3) % 3 ? C.pink : C.white); }
    for (let i = petals.length - 1; i >= 0; i--) if (petals[i].y > H) petals.splice(i, 1);
    // 緋鈴
    g.spr(S.hirin.idle[Math.floor(time * 1.6) % 2], 60, base - 26, {});
    // 標誌
    g.label('月下神樂', W / 2, 8, C.white, { align: 'center', scale: 3, outline: C.ink, shadow: C.violet });
    g.text('MOONLIT KAGURA', W / 2, 60, C.gold, { align: 'center', outline: C.ink });
    const mw = 108, mh = titleMenu.items.length * 16 + 10, mx = 196, my = 88;
    drawWindow(g, mx, my, mw, mh, THEME);
    titleMenu.draw(g, mx + 4, my + 6, mw - 8, THEME, { time });
    g.text('STARDUST ARCADE', 6, H - 9, C.lav, { small: true });
    if (D().started) {
      const b = totalBells(), cl = D().cleared.filter(Boolean).length;
      g.label(`金鈴 ${b}／12　通過區域 ${cl}／4`, W - 6, H - 16, C.moon, { align: 'right', outline: C.ink });
    }
  }

  // ---------------- 神社繪卷（地圖） ----------------
  function nodeLabel(i) { return i === 0 ? '狸貓茶屋' : STAGES[i - 1].name; }
  function updateMap(dt) {
    let mv = 0;
    if (input.repeat('right') || input.repeat('up')) mv = 1;
    else if (input.repeat('left') || input.repeat('down')) mv = -1;
    if (mv) {
      let j = mapSel + mv;
      while (j >= 0 && j < MAP_NODES.length && !nodeUnlocked(j)) j += mv;
      if (j >= 0 && j < MAP_NODES.length) { mapSel = j; sound.ui('move'); }
      else sound.ui('buzz');
    }
    for (const t of input.taps) {
      // 右上角的按鈕
      if (t.y < 22 && t.x > W - 124 && t.x < W - 64) { openCharms(); sound.ui('open'); input.eat(); return; }
      if (t.y < 22 && t.x > W - 62) { sound.ui('cancel'); go(enterTitle); return; }
      MAP_NODES.forEach((n, i) => {
        if (Math.abs(t.x - n.x) < 16 && Math.abs(t.y - n.y) < 16 && nodeUnlocked(i)) {
          if (mapSel === i) confirmNode(); else { mapSel = i; sound.ui('move'); }
        }
      });
    }
    if (input.pressed('confirm')) confirmNode();
    else if (input.pressed('menu')) { openCharms(); sound.ui('open'); input.eat(); }
    else if (input.pressed('cancel')) { sound.ui('cancel'); go(enterTitle); }
  }
  function confirmNode() {
    if (!nodeUnlocked(mapSel)) { sound.ui('buzz'); return; }
    sound.ui('confirm');
    input.eat();
    if (mapSel === 0) openShop();
    else { const i = mapSel - 1; go(() => startStage(i)); }
  }
  function drawToriiIcon(x, y, col, dark) {
    g.rect(x - 7, y - 8, 14, 2, C.ink); g.rect(x - 6, y - 7, 12, 1, col);
    g.rect(x - 5, y - 5, 10, 1, col);
    g.rect(x - 4, y - 6, 2, 10, col); g.rect(x + 2, y - 6, 2, 10, col);
    if (dark) { g.rect(x - 4, y - 6, 1, 10, dark); g.rect(x + 2, y - 6, 1, 10, dark); }
  }
  function renderMap() {
    g.screenSpace();
    g.ctx.drawImage(backdrop, 0, 0);
    // 參道（點狀路徑＋燈籠）
    for (let i = 0; i < MAP_NODES.length - 1; i++) {
      const a = MAP_NODES[i], b = MAP_NODES[i + 1];
      const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5);
      const lit = nodeUnlocked(i + 1);
      for (let k = 1; k < n; k++) { const u = k / n; const x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * 6; g.rect(x - 1, y - 1, 2, 2, lit ? (k % 3 === 0 ? C.gold : C.moon) : C.violet); }
    }
    // 節點
    MAP_NODES.forEach((n, i) => {
      const un = nodeUnlocked(i), sel = i === mapSel;
      const by = sel ? Math.round(Math.sin(time * 5) * 1.5) : 0;
      if (i === 0) {
        // 茶屋
        g.rect(n.x - 10, n.y - 6 + by, 20, 10, C.ink); g.rect(n.x - 9, n.y - 5 + by, 18, 8, C.wood);
        for (let k = 0; k < 6; k++) g.rect(n.x - 12 + k, n.y - 7 - k + by, 24 - k * 2, 1, C.dwood);
        g.rect(n.x - 3, n.y - 3 + by, 6, 6, C.gold); g.rect(n.x - 2, n.y - 2 + by, 4, 4, C.orange);
        g.rect(n.x + 7, n.y - 10 + by, 3, 4, C.red);
      } else {
        const cleared = D().cleared[i - 1];
        g.ellipse(n.x, n.y + 5, 9, 2, C.ink);
        drawToriiIcon(n.x, n.y + by, un ? C.red : C.indigo, un ? C.wood : C.night);
        if (!un) { g.rect(n.x - 2, n.y - 1, 5, 4, C.lav); g.rect(n.x - 1, n.y - 3, 3, 2, C.lav); }
        if (cleared) { g.rect(n.x + 6, n.y - 14 + by, 1, 9, C.moon); g.rect(n.x + 7, n.y - 14 + by, 5, 3, C.gold); }
        const bells = (D().bells[STAGES[i - 1].id] || []).filter(Boolean).length;
        for (let k = 0; k < 3; k++) g.rect(n.x - 5 + k * 4, n.y + 9, 3, 3, k < bells ? C.gold : C.indigo);
      }
      if (sel) {
        drawCursor(g, n.x - 18, n.y - 3, C.gold, time);
        g.spr(S.hirin.idle[Math.floor(time * 1.6) % 2], n.x - 8, n.y - 36 + by);
      }
    });
    // 上方資訊列
    g.rect(0, 0, W, 20, C.ink); g.rect(0, 20, W, 1, C.violet);
    g.spr(S.coin[0], 6, 7); g.text(String(D().coins), 15, 7, C.gold);
    const mh = env.maxHp();
    g.spr(S.heart, 48, 6); g.text('x' + mh, 57, 7, C.white);
    g.spr(S.orb, 78, 6); g.text('x' + env.spiritMax(), 87, 7, C.white);
    let ax = 108;
    for (const [id, short] of [['pogo', '下劈'], ['airjump', '二段'], ['wall', '壁跳']]) { if (env.unlocked(id)) { g.label(short, ax, 3, C.moon); ax += labelWidth(short) + 6; } }
    const btn = (x, w, text) => { g.rect(x, 3, w, 14, C.violet); g.rect(x + 1, 4, w - 2, 12, C.indigo); g.label(text, x + w / 2, 3, C.white, { align: 'center' }); };
    btn(W - 122, 58, 'C 御守'); btn(W - 60, 56, 'X 標題');
    // 下方資訊視窗
    const wy = 146;
    drawWindow(g, 4, wy, W - 8, H - wy - 3, THEME);
    if (mapSel === 0) {
      g.label('狸貓茶屋', 12, wy + 4, C.gold);
      g.label('用妖怪掉的錢幣買御守和靈力珠。', 12, wy + 17, C.moon);
    } else {
      const i = mapSel - 1, st = STAGES[i];
      g.label(`${i + 1}　${st.name}`, 12, wy + 4, C.gold);
      g.text(st.en, 12 + labelWidth(`${i + 1}　${st.name}`) + 8, wy + 8, C.lav, { small: true });
      const bells = (D().bells[st.id] || []).filter(Boolean).length;
      const best = D().best[i];
      const info = `金鈴 ${bells}／3　寶箱 ${D().chests[st.id] ? '已開啟' : '未開啟'}　守護妖 ${D().cleared[i] ? '已驅散' : '未驅散'}${best != null ? '　最佳 ' + fmtTime(best) : ''}`;
      g.label(info, 12, wy + 17, C.moon);
    }
    g.text('Z GO  C CHARMS  X TITLE', W - 10, wy + 8, C.lav, { small: true, align: 'right' });
  }

  // ---------------- 覆蓋視窗 ----------------
  function openConfirm(text, yes) {
    const m = new Menu([{ id: 'no', label: '不要' }, { id: 'yes', label: '確定' }], { lineH: 16 });
    overlay = {
      update() { const r = m.update(input, sound); if (!r) return; input.eat(); if (r.type === 'cancel' || r.item.id === 'no') overlay = null; else { overlay = null; yes(); } },
      draw() {
        const lines = wrapLabel(text, 200);
        const h = lines.length * 14 + 50;
        drawWindow(g, 50, 50, 220, h, THEME);
        lines.forEach((l, i) => g.label(l, 60, 58 + i * 14, C.white));
        m.draw(g, 100, 58 + lines.length * 14 + 6, 120, THEME, { time });
      },
    };
  }
  function openMessage({ title, icon, name, desc }, done) {
    sound.ui('open');
    overlay = {
      t: 0,
      update(dt) { this.t += dt; if (this.t > 0.35 && (input.pressed('confirm') || input.pressed('cancel') || input.taps.length)) { input.eat(); overlay = null; if (done) done(); } },
      draw() {
        const lines = wrapLabel(desc, 216);
        const h = 58 + lines.length * 14;
        const y = Math.round((H - h) / 2);
        drawWindow(g, 42, y, 236, h, THEME, { title });
        if (icon) g.spr(icon, 56, y + 14, {});
        g.label(name, icon ? 74 : 54, y + 14, C.gold, { scale: 1 });
        lines.forEach((l, i) => g.label(l, 54, y + 34 + i * 14, C.white));
        if (Math.floor(this.t * 3) % 2) drawCursor(g, 264, y + h - 12, C.gold);
      },
    };
  }
  function openHelp(done) {
    const rows = [
      ['左右鍵', '移動'], ['Z', '跳躍（按住跳更高）'], ['下＋Z', '從木板上跳下'], ['X', '攻擊（連按三段）'], ['上＋X', '上挑'], ['空中下＋X', '下劈彈跳（學會後）'],
      ['C', '衝刺（空中一次）'], ['V 點按', '鈴祓：消耗 1 顆靈力攻擊周圍'], ['V 按住', '回復 1 點體力（站在地上）'], ['Esc／P', '暫停選單'],
    ];
    overlay = {
      update() { if (input.pressed('confirm') || input.pressed('cancel') || input.taps.length) { sound.ui('cancel'); input.eat(); overlay = null; if (done) done(); } },
      draw() {
        drawWindow(g, 16, 10, W - 32, H - 20, THEME, { title: '操作說明' });
        rows.forEach(([k, v], i) => { g.label(k, 30, 18 + i * 14, C.gold); g.label(v, 110, 18 + i * 14, C.white); });
        g.label('觸控：左半邊拖曳移動，右下按鈕操作，右上 Ⅱ 暫停', W / 2, H - 26, C.moon, { align: 'center' });
      },
    };
  }
  function openCharms(done) {
    const build = () => CHARM_ORDER.map(id => {
      const own = D().charms.includes(id);
      return { id, label: own ? CHARMS[id].name : '？？？', right: own ? (D().equipped.includes(id) ? '裝備中' : '') : '', rightColor: C.green, disabled: !own };
    });
    const m = new Menu(build(), { lineH: 14 });
    let note = '';
    overlay = {
      update() {
        const r = m.update(input, sound);
        if (!r) return;
        if (r.type === 'cancel') { input.eat(); overlay = null; world.refreshMods(); if (done) done(); return; }
        if (r.type === 'denied') { note = `還沒有取得。來源：${CHARMS[r.item.id].from}`; return; }
        if (r.type === 'confirm') {
          const id = r.item.id, eq = D().equipped;
          if (eq.includes(id)) { eq.splice(eq.indexOf(id), 1); note = `卸下了「${CHARMS[id].name}」`; }
          else if (eq.length >= SLOTS) { sound.ui('buzz'); note = `裝備格已滿（最多 ${SLOTS} 個），先卸下其他御守。`; }
          else { eq.push(id); note = `裝備了「${CHARMS[id].name}」`; }
          save.save(); m.setItems(build());
        }
        input.eat();
      },
      draw() {
        drawWindow(g, 10, 8, W - 20, H - 16, THEME, { title: '御守' });
        m.draw(g, 16, 18, 120, THEME, { time });
        const it = m.item, own = D().charms.includes(it.id);
        g.spr(S.charms[it.id], 150, 20, own ? {} : { color: C.indigo });
        g.label(own ? CHARMS[it.id].name : '？？？', 166, 20, C.gold);
        drawParagraph(g, own ? CHARMS[it.id].desc : `來源：${CHARMS[it.id].from}`, 150, 40, 150, C.white);
        g.label(`裝備格　${D().equipped.length}／${SLOTS}`, 150, 110, C.moon);
        for (let i = 0; i < SLOTS; i++) { const id = D().equipped[i]; g.rect(150 + i * 22, 126, 18, 20, C.ink); g.rect(151 + i * 22, 127, 16, 18, C.indigo); if (id) g.spr(S.charms[id], 153 + i * 22, 130); }
        if (note) drawParagraph(g, note, 20, H - 38, W - 40, C.moon);
        else g.label('Z 裝備／卸下　X 關閉', 20, H - 26, C.lav);
      },
    };
  }
  function openShop() {
    music.play(SONGS.shop);
    const owned = it => it.id.startsWith('spirit') ? D().bought.includes(it.id) : D().charms.includes(it.id);
    const avail = it => it.id !== 'spirit2' || D().bought.includes('spirit1');
    const build = () => SHOP.filter(avail).map(it => ({ ...it, label: it.name || CHARMS[it.id].name, right: owned(it) ? '已購買' : `${it.price} 文`, rightColor: owned(it) ? C.lav : C.gold })).concat([{ id: 'leave', label: '離開' }]);
    const m = new Menu(build(), { lineH: 14 });
    let line = '歡迎光臨～今晚妖怪特別多，要買點護身的東西嗎？', smile = true;
    overlay = {
      update() {
        const r = m.update(input, sound);
        if (!r) return;
        input.eat();
        if (r.type === 'cancel' || (r.type === 'confirm' && r.item.id === 'leave')) { overlay = null; music.play(SONGS.map); return; }
        if (r.type !== 'confirm') return;
        const it = r.item;
        if (owned(it)) { line = '這個已經賣給你囉。'; smile = true; return; }
        if (D().coins < it.price) { sound.ui('buzz'); line = '錢不太夠喔～去打倒一些妖怪再來吧。'; smile = false; return; }
        D().coins -= it.price;
        if (it.id.startsWith('spirit')) { D().bought.push(it.id); D().spiritMax = Math.min(4, D().spiritMax + 1); }
        else D().charms.push(it.id);
        save.save(); sound.ui('coin');
        line = '謝謝惠顧！要好好帶在身上喔。'; smile = true;
        m.setItems(build());
      },
      draw() {
        g.screenSpace();
        g.ditherFast(0, 0, W, H, C.ink, 10);
        drawWindow(g, 8, 8, W - 16, 58, THEME, { title: '狸貓茶屋', titleAlign: 'left' });
        g.spr(smile ? S.tanukiSmile : S.tanukiFace, 16, 18);
        drawParagraph(g, line, 56, 22, W - 80, C.white);
        drawWindow(g, 8, 72, 150, H - 80, THEME);
        m.draw(g, 12, 80, 142, THEME, { time });
        drawWindow(g, 164, 72, W - 172, H - 80, THEME);
        const it = m.item;
        if (it && it.id !== 'leave') {
          const icon = it.id.startsWith('spirit') ? S.orb : S.charms[it.id];
          g.spr(icon, 172, 80);
          g.label(it.label, 188, 79, C.gold);
          drawParagraph(g, it.desc || CHARMS[it.id].desc, 172, 96, W - 190, C.white);
        }
        g.spr(S.coin[0], 172, H - 22); g.text(String(D().coins), 182, H - 22, C.gold);
      },
    };
  }
  function openPause() {
    const m = new Menu([
      { id: 'resume', label: '繼續' }, { id: 'charms', label: '御守' }, { id: 'help', label: '操作說明' },
      { id: 'restart', label: '從頭開始這一關' }, { id: 'map', label: '回到神社繪卷' },
    ], { lineH: 16 });
    touch.setVisible(false);
    sound.ui('open');
    const close = () => { overlay = null; touch.setVisible(true); };
    overlay = {
      pause: true,
      update() {
        if (input.pressed('pause') && !input.pressed('confirm')) { input.eat(); close(); return; }
        const r = m.update(input, sound);
        if (!r) return;
        input.eat();
        if (r.type === 'cancel') { close(); return; }
        if (r.type !== 'confirm') return;
        switch (r.item.id) {
          case 'resume': close(); break;
          case 'charms': openCharms(() => openPauseAgain()); break;
          case 'help': openHelp(() => openPauseAgain()); break;
          case 'restart': openConfirm('從頭開始這一關嗎？（已收集的金鈴會保留）', () => { const i = world.stageIndex; go(() => startStage(i)); }); break;
          case 'map': openConfirm('回到神社繪卷嗎？（已收集的金鈴與錢幣會保留）', () => go(enterMap)); break;
        }
      },
      draw() {
        g.screenSpace();
        g.ditherFast(0, 0, W, H, C.ink, 9);
        drawWindow(g, 96, 30, 128, 98, THEME, { title: '暫停' });
        m.draw(g, 102, 42, 116, THEME, { time });
        const st = world.stage, pk = world.peek();
        const bells = (D().bells[st.id] || []).filter(Boolean).length;
        g.label(`${st.name}　金鈴 ${bells}／3　時間 ${fmtTime(pk.stageTime)}`, W / 2, 138, C.moon, { align: 'center', outline: C.ink });
        const eq = D().equipped.map(id => CHARMS[id].name).join('、') || '（沒有）';
        g.label('裝備的御守：' + eq, W / 2, 154, C.lav, { align: 'center', outline: C.ink });
      },
    };
    function openPauseAgain() { openPause(); }
  }

  // ---------------- 結算與結局 ----------------
  function updateResult(dt) {
    result.t += dt;
    if (result.t < 0.8) return;
    if (input.pressed('confirm') || input.taps.length) {
      input.eat(); sound.ui('confirm');
      const i = result.stage;
      const after = () => {
        if (result.final) { go(startEnding); return; }
        if (result.reward) {
          const ab = ABIL[result.reward];
          openMessage({ title: '習得新的神樂之舞', name: `「${ab.name}」`, desc: ab.desc }, () => { mapSel = Math.min(4, i + 2); go(enterMap); });
        } else { mapSel = Math.min(4, i + 2); go(enterMap); }
      };
      if (result.first && BOSS_LINES[i]) dialog.show(BOSS_LINES[i].map(t => { const [n, s] = t.split('：'); return { name: n, text: s, voice: n === '緋鈴' ? 880 : 520 }; }), after);
      else after();
    }
  }
  function renderResult() {
    g.screenSpace();
    g.ctx.drawImage(backdrop, 0, 0);
    const st = STAGES[result.stage];
    g.label('除妖成功！', W / 2, 14, C.gold, { align: 'center', scale: 2, outline: C.ink });
    g.label(`${result.stage + 1}　${st.name}`, W / 2, 44, C.white, { align: 'center', outline: C.ink });
    drawWindow(g, 60, 64, 200, 86, THEME);
    const rows = [
      ['通關時間', fmtTime(result.time) + (result.newBest ? '　新紀錄！' : '')],
      ['最佳紀錄', fmtTime(D().best[result.stage])],
      ['力竭次數', String(result.deaths)],
      ['金鈴', `${result.bells}／3`],
      ['獲得錢幣', `${result.coins} 文`],
    ];
    rows.forEach(([k, v], i) => { if (result.t > 0.25 + i * 0.12) { g.label(k, 74, 70 + i * 15, C.moon); g.label(v, 246, 70 + i * 15, i === 0 && result.newBest ? C.gold : C.white, { align: 'right' }); } });
    if (result.t > 0.8 && Math.floor(time * 2) % 2) g.label('按 Z 繼續', W / 2, 158, C.white, { align: 'center', outline: C.ink });
  }
  function startEnding() {
    scene = 'ending'; D().ending = true; save.save();
    music.play(SONGS.ending);
    ending = { t: 0, credits: false };
    dialog.show([
      { text: '月蝕大蛇化為點點月光，消散在祭壇之上。' },
      { text: '被蝕影遮住的月亮，終於露出了原本的光輝。' },
      { name: '緋鈴', text: '……鈴聲，傳到了呢。', voice: 880 },
      { text: '山中的神社，又回到了寧靜的月夜。' },
    ], () => { ending.credits = true; ending.t = 0; });
  }
  const CREDITS = ['月下神樂', 'MOONLIT KAGURA', '', '主角　緋鈴', '', '守護妖', '大提燈・火袋', '疾風・鎌鼬', '千年白狐', '月蝕大蛇', '', '所有圖像以程式繪製', '所有聲音以 Web Audio 即時合成', '', '星屑遊樂場', '', '感謝遊玩！'];
  function updateEnding(dt) {
    if (!ending.credits) return;
    ending.t += dt;
    const done = ending.t > CREDITS.length * 1.1 + 5;
    if ((done || ending.t > 3) && (input.pressed('confirm') || input.taps.length)) { input.eat(); go(() => { mapSel = 4; enterMap(); }); }
  }
  function renderEnding() {
    g.screenSpace();
    g.ctx.drawImage(titleBack, 0, 0);
    if (!ending.credits) return;
    const y0 = H - ending.t * 16;
    CREDITS.forEach((l, i) => { const y = y0 + i * 20; if (y > -16 && y < H) g.label(l, W / 2, y, i === 0 ? C.gold : C.white, { align: 'center', outline: C.ink, scale: i === 0 ? 2 : 1 }); });
    const b = totalBells();
    if (ending.t > CREDITS.length * 1.1 + 2) {
      g.label(`收集的金鈴　${b}／12`, W / 2, 80, C.gold, { align: 'center', outline: C.ink });
      g.label(b >= 12 ? '全部收集！月之社的鈴聲響徹山谷。' : '還有金鈴沒找到……帶著新的能力回去看看吧。', W / 2, 98, C.white, { align: 'center', outline: C.ink });
      if (Math.floor(time * 2) % 2) g.label('按 Z 回到神社繪卷', W / 2, 150, C.moon, { align: 'center', outline: C.ink });
    }
  }

  // ---------------- 主迴圈 ----------------
  function update(dt) {
    time += dt;
    trans.update(dt);
    if (trans.phase === 'out') return;
    if (dialog.open) { dialog.update(dt, input); if (scene === 'play') return; return; }
    if (overlay) { overlay.update(dt); if (!overlay || overlay.pause || scene !== 'play') return; return; }
    switch (scene) {
      case 'title': updateTitle(dt); break;
      case 'map': updateMap(dt); break;
      case 'play':
        if (input.pressed('pause') && !world.finale) { input.eat(); openPause(); break; }
        world.update(dt);
        break;
      case 'result': updateResult(dt); break;
      case 'ending': updateEnding(dt); break;
    }
  }
  function render() {
    switch (scene) {
      case 'title': renderTitle(); break;
      case 'map': renderMap(); break;
      case 'play': world.render(); break;
      case 'result': renderResult(); break;
      case 'ending': renderEnding(); break;
    }
    g.screenSpace();
    if (overlay) overlay.draw();
    dialog.draw(g, W, H);
    trans.draw(g, C.ink);
  }
  function reset() { if (scene === 'play') startStage(world.stageIndex); }
  function onBlur() { if (scene === 'play' && !overlay && !dialog.open) openPause(); }
  function stageCover() { world.stageCover(); scene = 'play'; overlay = null; }

  enterTitle();
  return {
    update, render, reset, onBlur, stageCover,
    debugLines: () => scene === 'play' ? world.debugLines() : [`SCENE ${scene.toUpperCase()}`],
    peek: () => ({ scene, overlay: !!overlay, dialog: dialog.open, ...(scene === 'play' ? world.peek() : {}) }),
    // 測試用：直接進入某一關、跳到守護妖
    debug: {
      startStage: i => { D().started = true; trans.phase = null; trans.cb = null; dialog.lines = null; startStage(i); },
      boss: () => world.debugBoss(),
      world, save,
      get scene() { return scene; },
    },
  };
}

runPrototype({
  id: 'moon-kagura',
  title: '月下神樂',
  subtitle: '橫向動作平台',
  width: W, height: H, palette: PALETTE, ui: { text: C.white, dark: C.ink },
  input: {
    left: { keys: ['ArrowLeft', 'KeyA'] }, right: { keys: ['ArrowRight', 'KeyD'] },
    up: { keys: ['ArrowUp', 'KeyW'] }, down: { keys: ['ArrowDown', 'KeyS'] },
    jump: { keys: ['KeyZ', 'Space', 'KeyK'], pad: [0] },
    attack: { keys: ['KeyX', 'KeyJ'], pad: [2] },
    dash: { keys: ['KeyC', 'ShiftLeft', 'ShiftRight', 'KeyL'], pad: [1, 5] },
    spell: { keys: ['KeyV', 'KeyI'], pad: [3, 4] },
    pause: { keys: ['Escape', 'KeyP', 'Enter'], pad: [9] },
    confirm: { keys: ['Enter', 'KeyZ', 'Space'], pad: [0] },
    cancel: { keys: ['Escape', 'KeyX', 'Backspace'], pad: [1] },
    menu: { keys: ['KeyC'], pad: [3] },
  },
  touch: [{ action: 'spell', label: '靈' }, { action: 'dash', label: '衝' }, { action: 'attack', label: '攻', big: true }, { action: 'jump', label: '跳', big: true }],
  touchPause: 'pause',
  tuning: TUNING,
  intro: INTRO,
  debugItems: [
    { key: 'godMode', label: '無敵（測試用）', type: 'toggle', value: false },
    { key: 'unlockAll', label: '解鎖全部能力與關卡（測試用）', type: 'toggle', value: false },
  ],
  create,
});
