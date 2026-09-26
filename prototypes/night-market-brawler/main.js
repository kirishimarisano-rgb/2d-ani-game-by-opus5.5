// 《夜市拳姬》NIGHT MARKET BRAWLER：清版格鬥（橫向捲軸＋縱深移動）
// 夜市收攤前，一群穿布偶裝的混混跑來搗亂。愛吃芒果冰的阿芒從入口牌樓一路打到廟口廣場。
// 這個檔案負責：調參面板、場景（標題／夜市地圖／街道／結算／結局）、小吃攤、修行場與各種選單。
import { runPrototype } from '../engine/app.js';
import { makeLayer } from '../engine/pixel.js';
import { Menu, Dialog, Transition, drawWindow, drawCursor, drawParagraph, fmtTime } from '../engine/ui.js';
import { wrapLabel } from '../engine/text.js';
import { SaveData } from '../engine/save.js';
import { clamp } from '../engine/fx.js';
import { PALETTE, C, buildSprites } from './sprites.js';
import { STAGES } from './stages.js';
import { SONGS } from './songs.js';
import { createWorld } from './world.js';

const W = 320, H = 180;
const THEME = { ink: C.ink, panel: C.navy, border: C.pink, light: C.purple, text: C.white, dim: C.gray, accent: C.yellow, hilite: C.plum, selText: C.white };

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
      { key: 'chargeTime', label: '蓄力重拳所需時間', min: 0.1, max: 1.5, step: 0.05, value: 0.45, unit: '秒', hint: '在修行場學會「蓄力重拳」後，按住攻擊多久放開能打出重拳。' },
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
    { name: '敵人、鏡頭、難度', open: false, items: [
      { key: 'attackTokens', label: '同時出手上限', min: 1, max: 6, step: 1, value: 2, unit: '隻', hint: '同一時間最多幾隻敵人會出手，其他在旁邊繞圈（群戰節奏的關鍵）。' },
      { key: 'enemySpeed', label: '敵人速度倍率', min: 0.3, max: 2, step: 0.1, value: 1, unit: '×' },
      { key: 'enemyAggro', label: '敵人會主動攻擊', type: 'toggle', value: true },
      { key: 'superArmor', label: '熊熊保鑣霸體', type: 'toggle', value: true, hint: '保鑣出招時被打不會中斷，要先閃開或在出招前打斷（蓄力重拳可以破防）。' },
      { key: 'iframes', label: '起身無敵時間', min: 0, max: 3000, step: 50, value: 900, unit: 'ms' },
      { key: 'enemyHp', label: '敵人體力倍率', min: 0.3, max: 3, step: 0.1, value: 1, unit: '×' },
      { key: 'bossHp', label: '守護者體力倍率', min: 0.2, max: 3, step: 0.1, value: 1, unit: '×' },
      { key: 'enemyDamage', label: '敵人傷害倍率', min: 0, max: 3, step: 0.1, value: 1, unit: '×' },
      { key: 'playerDamage', label: '玩家傷害倍率', min: 0.5, max: 3, step: 0.1, value: 1, unit: '×' },
      { key: 'camLead', label: '鏡頭前瞻', min: 0, max: 80, step: 1, value: 30, unit: 'px' },
      { key: 'camSmooth', label: '鏡頭平滑', min: 0, max: 0.5, step: 0.01, value: 0.12, unit: '秒' },
    ] },
  ],
  presets: {
    '均衡（預設值）': {},
    '爽快連段': { juggleGravity: 500, juggleLimit: 12, juggleLift: 120, launch: 290, hitstop: 38, hitstopGrowth: 3.5, otg: true, comboCancel: 0.15, stepIn: 70 },
    '硬派格鬥': { hitstop: 70, hitstopFinisher: 170, hitstopGrowth: -2, juggleLimit: 3, juggleGravity: 1000, hitstun: 300, atkSpeed: 0.85, comboCancel: 0.55, enemySpeed: 1.3, attackTokens: 3, poseBlend: 0, enemyDamage: 1.3 },
    '輕飄飄空戰': { gravity: 520, jumpV: 230, juggleGravity: 380, launch: 310, airControl: 0.8 },
    '輕鬆模式': { enemyHp: 0.7, bossHp: 0.6, enemyDamage: 0.6, playerDamage: 1.3, attackTokens: 1, iframes: 1500 },
    '無特效對照組': { hitstop: 0, hitstopFinisher: 0, hitstopGrowth: 0, shake: 0, shakeFinisher: 0, impactFrame: false, flashFrames: 0, sparkSize: 0, damageNumbers: false, push: 0, stepIn: 0, poseBlend: 0, camLead: 0, camSmooth: 0 },
  },
};

const INTRO = {
  pitch: '夜市收攤前，一群穿布偶裝的混混跑來搗亂。愛吃芒果冰的阿芒用拳腳清場！四條街道、四隻守護者，橫向捲軸＋上下縱深的清版格鬥。',
  goals: [
    '四條街道各有 3～4 個戰鬥區與一隻守護者：兔兔老大、珍奶巨人、夾娃娃機大王、熊貓大仙。',
    '走進被打暈的敵人可以抓住：膝擊或丟出去砸倒一整排。塑膠椅可以撿起來揮、也可以丟。',
    '必殺量表滿了按 V 放出「芒果冰暴風」。紙箱和垃圾桶打破會掉出食物與金幣。',
    '通關評價（S／A／B／C）換修行點數，到修行場學新招；金幣可以在小吃攤買點心，下一條街有加成。',
    '倒下可以原地接關，但評價會變低。這裡的參數會即時影響遊戲；「輕鬆模式」可以降低難度。',
  ],
  controls: [
    ['方向鍵／WASD', '移動（上下＝往畫面深處）；連按兩下左右＝奔跑'],
    ['Z ／ J', '攻擊（連按四段；跳躍中＝飛踢；奔跑中＝滑壘踢；抓住時＝膝擊）'],
    ['X ／ K ／ Space', '跳躍（抓住敵人時＝丟出去）'],
    ['C ／ L', '旋風腿（打兩側、會浮空）'],
    ['V ／ ;', '必殺技（量表滿時）'],
    ['Shift', '按住奔跑'],
    ['Esc ／ P ／ Enter', '暫停選單'],
    ['手把', '左搖桿移動、X 攻擊、A 跳躍、B／Y 旋風腿、LB 必殺、RB 奔跑、Start 暫停'],
    ['F ／ N ／ H', '凍結畫面／逐格播放／顯示判定框（除錯）'],
  ],
};

const SNACKS = [
  { id: 'mango', name: '芒果冰', price: 60, desc: '攻擊力 +20%，撿到的芒果冰也會補滿更多必殺量表。阿芒的最愛！' },
  { id: 'sausage', name: '烤香腸', price: 40, desc: '最大體力 +30。' },
  { id: 'tea', name: '珍珠奶茶', price: 50, desc: '必殺量表累積速度 ×1.5。' },
  { id: 'tofu', name: '臭豆腐', price: 45, desc: '身上的味道很強烈：貼近你的敵人會持續受到傷害。' },
  { id: 'chicken', name: '炸雞排', price: 55, desc: '每清完一個戰鬥區，回復 20 體力。' },
  { id: 'candy', name: '糖葫蘆', price: 35, desc: '移動速度 +15%。' },
];
const SNACK = Object.fromEntries(SNACKS.map(s => [s.id, s]));

const SKILLS = [
  { id: 'hp', name: '鐵布衫', max: 2, cost: [1, 2], desc: '最大體力 +20（每級）。' },
  { id: 'airCombo', name: '空中連擊', max: 1, cost: [1], desc: '跳躍中飛踢之後，可以再按一次攻擊追加空中拳，並且稍微往上浮。' },
  { id: 'charge', name: '蓄力重拳', max: 1, cost: [1], desc: '按住攻擊鍵不放，放開打出重拳。重拳可以打破熊熊保鑣與守護者的霸體。' },
  { id: 'spinPlus', name: '旋風腿・改', max: 1, cost: [1], desc: '旋風腿的冷卻時間減半。' },
  { id: 'throwPlus', name: '過肩摔', max: 1, cost: [2], desc: '摔投傷害 ×1.5，連熊熊保鑣都抓得起來。' },
  { id: 'slideLaunch', name: '滑壘上挑', max: 1, cost: [1], desc: '奔跑中的滑壘踢改成把敵人挑上空中，可以接空中追擊。' },
  { id: 'meter', name: '氣勢', max: 2, cost: [1, 2], desc: '必殺量表累積速度 +30%（每級）。' },
];
const TUITION = { coins: 120, max: 4 };
const RANK_PTS = { S: 3, A: 2, B: 1, C: 1 };
const RANK_COINS = { S: 100, A: 60, B: 40, C: 20 };
const RANK_COLOR = { S: C.yellow, A: C.pink, B: C.cyan, C: C.gray };
const PAR = [200, 240, 270, 300];

const STAGE_INTRO = [
  [{ name: '阿芒', text: '夜市快收攤了，怎麼一堆穿布偶裝的傢伙在鬧事？', voice: 880 }, { name: '阿芒', text: '我的芒果冰還沒吃到欸……先把他們趕出去再說！', voice: 880 }],
  [{ name: '阿芒', text: '小吃街好香……不行不行，先打架！', voice: 880 }, { name: '攤販阿姨', text: '小心喔！狗狗會從遠處丟東西過來！', voice: 660 }],
  [{ name: '射氣球的老闆', text: '那台夾娃娃機……好像自己活過來了！', voice: 520 }, { name: '阿芒', text: '遊戲攤的燈怎麼閃成這樣……大家退後！', voice: 880 }],
  [{ name: '阿芒', text: '廟口廣場……帶頭鬧事的傢伙應該就在這裡。', voice: 880 }, { name: '阿芒', text: '把夜市還給大家！', voice: 880 }],
];
const BOSS_INTRO = {
  bunnyBoss: [{ name: '兔兔老大', text: '哪來的小不點？這條街是我們兔兔幫的地盤！', voice: 330 }, { name: '阿芒', text: '收攤前別來搗亂，我還沒吃到芒果冰！', voice: 880 }],
  bubbleTea: [{ name: '珍奶巨人', text: '咕嚕咕嚕……全糖、去冰、特大杯！', voice: 440 }, { name: '阿芒', text: '飲料怎麼會自己走路啦！', voice: 880 }],
  clawMachine: [{ name: '夾娃娃機大王', text: '投幣吧！夾到你，你就是我的收藏品！', voice: 600 }, { name: '阿芒', text: '才不要被你夾走！', voice: 880 }],
  panda: [{ name: '熊貓大仙', text: '年輕人，能一路打到廟口，算你有兩下子。', voice: 260 }, { name: '阿芒', text: '你就是帶頭鬧事的傢伙吧？看招！', voice: 880 }],
};
const BOSS_OUTRO = {
  bunnyBoss: [{ name: '兔兔老大', text: '嗚……老大說收攤前要熱鬧一下，我們只是照做而已啦……', voice: 330 }],
  bubbleTea: [{ name: '珍奶巨人', text: '咕嚕……珍珠……灑光了……', voice: 440 }],
  clawMachine: [{ name: '夾娃娃機大王', text: '保、保證夾得到……的說……', voice: 600 }],
  panda: [],
};
const ENDING = [
  { name: '熊貓大仙', text: '呼……好久沒有打得這麼痛快了。其實我們只是想在夜市辦一場熱鬧的祭典……', voice: 260 },
  { name: '阿芒', text: '那就一起來嘛！先幫大家把攤子擺回去！', voice: 880 },
  { text: '那天晚上，夜市比平常更晚收攤。' },
  { name: '阿芒', text: '老闆！芒果冰，特大碗！', voice: 880 },
];

function create(ctx) {
  const { screen: g, input, sound, music, touch, P } = ctx;
  const S = buildSprites();
  const blankRec = () => Object.fromEntries(STAGES.map(s => [s.id, { rank: '', score: 0, time: 0, combo: 0 }]));
  const flags = v => Object.fromEntries(STAGES.map(s => [s.id, v]));
  const save = new SaveData('stardust/night-market-brawler/save', {
    v: 1, coins: 0, points: 0, tuition: 0, snack: null,
    skills: Object.fromEntries(SKILLS.map(s => [s.id, 0])),
    cleared: flags(false), rankPts: flags(0), best: blankRec(), seenStage: flags(false), seenBoss: flags(false),
    plays: 0, clears: 0, kills: 0, bestCombo: 0, continues: 0, ending: false, seenIntro: false,
  });
  const D = () => save.data;
  let runSnack = null, bossOn = false, results = null, ending = null;
  const env = {
    g, input, sound, P, S,
    skills: () => D().skills,
    snack: () => runSnack,
    addCoins(n) { D().coins += n; },
    coins: () => D().coins,
    hooks: {
      onBossStart(st) {
        bossOn = true;
        music.play(world.stageIndex === STAGES.length - 1 ? SONGS.final : SONGS.boss);
        if (!D().seenBoss[st.id]) { D().seenBoss[st.id] = true; save.save(); dialog.show(BOSS_INTRO[st.boss]); }
      },
      onDeath() { openContinue(); },
      onClear(stats) { go(() => enterResults(stats)); },
      onSuper() {},
    },
  };
  const world = createWorld(env);
  const trans = new Transition();
  const dialog = new Dialog(THEME, sound);
  let scene = 'title', overlay = null, time = 0;
  let mapBack = null;

  function go(fn) { trans.start(() => { overlay = null; fn(); }); }
  function big(spr, x, y, k) { g.ctx.drawImage(spr.canvas, Math.round(x), Math.round(y), spr.w * k, spr.h * k); }
  const unlocked = i => P.unlockAll || i === 0 || D().cleared[STAGES[i - 1].id];
  const skillLv = id => P.unlockAll ? SKILLS.find(s => s.id === id).max : D().skills[id];

  // ---------------- 街道 ----------------
  function startStage(i) {
    runSnack = D().snack; D().snack = null;
    D().plays++; save.save();
    world.load(i);
    world.hudOff = false;
    bossOn = false;
    scene = 'play'; overlay = null;
    music.play(SONGS[STAGES[i].song]);
    touch.setVisible(true);
    const st = STAGES[i];
    if (!D().seenStage[st.id]) { D().seenStage[st.id] = true; save.save(); dialog.show(STAGE_INTRO[i]); }
  }
  function leaveStage() {
    save.save();
    enterMap();
  }
  function openContinue() {
    save.save();
    music.play(SONGS.gameover);
    touch.setVisible(false);
    const m = new Menu([{ id: 'yes', label: '接關（從這裡繼續）' }, { id: 'no', label: '回到夜市地圖' }], { lineH: 16, cancel: false });
    overlay = {
      t: 0, count: 9,
      update(dt) {
        this.t += dt;
        if (this.t < 0.5) return;
        this.count -= dt;
        const r = m.update(input, sound);
        if (this.count <= 0) { overlay = null; go(leaveStage); return; }
        if (!r || r.type !== 'confirm') return;
        input.eat();
        if (r.item.id === 'yes') {
          overlay = null; D().continues++; save.save();
          world.continueHere();
          music.play(bossOn ? (world.stageIndex === STAGES.length - 1 ? SONGS.final : SONGS.boss) : SONGS[world.stage.song], { restart: true });
          touch.setVisible(true);
        } else { overlay = null; go(leaveStage); }
      },
      draw() {
        g.screenSpace();
        g.ditherFast(0, 0, W, H, C.ink, 11);
        g.label('阿芒倒下了……', W / 2, 30, C.pink, { align: 'center', scale: 2, outline: C.ink });
        g.text(String(Math.max(0, Math.ceil(this.count))), W / 2, 62, Math.floor(time * 4) % 2 ? C.yellow : C.white, { align: 'center', scale: 3, outline: C.ink });
        drawWindow(g, 90, 96, 140, 44, THEME);
        m.draw(g, 96, 104, 128, THEME, { time });
        g.label('接關會讓這條街的評價降低', W / 2, 148, C.gray, { align: 'center', outline: C.ink });
      },
    };
  }
  function openPause() {
    const m = new Menu([{ id: 'resume', label: '繼續' }, { id: 'moves', label: '招式表' }, { id: 'help', label: '操作說明' }, { id: 'quit', label: '離開這條街' }], { lineH: 16 });
    touch.setVisible(false); sound.ui('open');
    const close = () => { overlay = null; touch.setVisible(true); };
    overlay = {
      keep: true,
      update() {
        if (input.pressed('pause') && !input.pressed('confirm')) { input.eat(); close(); return; }
        const r = m.update(input, sound);
        if (!r) return;
        input.eat();
        if (r.type === 'cancel') { close(); return; }
        if (r.type !== 'confirm') return;
        if (r.item.id === 'resume') close();
        else if (r.item.id === 'moves') openMoves(() => openPause());
        else if (r.item.id === 'help') openHelp(() => openPause());
        else if (r.item.id === 'quit') openConfirm('離開這條街嗎？（撿到的金幣會保留，帶來的小吃就吃掉了）', () => go(leaveStage), () => openPause());
      },
      draw() {
        g.screenSpace(); g.ditherFast(0, 0, W, H, C.ink, 9);
        drawWindow(g, 100, 30, 120, 82, THEME, { title: '暫停' });
        m.draw(g, 106, 42, 108, THEME, { time });
        const st = world.stage, s = world.peek().stats;
        g.label(`第 ${world.stageIndex + 1} 條街　${st.name}`, W / 2, 122, C.white, { align: 'center', outline: C.ink });
        g.label(`時間 ${fmtTime(s.time)}　得分 ${s.score}　打倒 ${s.kills}`, W / 2, 138, C.gray, { align: 'center', outline: C.ink });
        if (runSnack) g.label(`小吃：${SNACK[runSnack].name}`, W / 2, 154, C.lpink, { align: 'center', outline: C.ink });
      },
    };
  }

  // ---------------- 共用視窗 ----------------
  function openConfirm(text, yes, no) {
    const m = new Menu([{ id: 'no', label: '不要' }, { id: 'yes', label: '確定' }], { lineH: 16 });
    overlay = {
      update() {
        const r = m.update(input, sound);
        if (!r || r.type === 'move') return;
        input.eat(); overlay = null;
        if (r.type === 'confirm' && r.item.id === 'yes') yes(); else if (no) no();
      },
      draw() {
        g.screenSpace(); g.ditherFast(0, 0, W, H, C.ink, 9);
        const lines = wrapLabel(text, 200), h = lines.length * 14 + 50;
        drawWindow(g, 50, 44, 220, h, THEME);
        lines.forEach((l, i) => g.label(l, 60, 52 + i * 14, C.white));
        m.draw(g, 100, 52 + lines.length * 14 + 6, 120, THEME, { time });
      },
    };
  }
  function closable(draw, done) {
    return {
      update() { if (input.pressed('confirm') || input.pressed('cancel') || input.pressed('pause') || input.taps.length) { input.eat(); sound.ui('cancel'); overlay = null; if (done) done(); } },
      draw() { g.screenSpace(); g.ditherFast(0, 0, W, H, C.ink, 9); draw(); },
    };
  }
  function openHelp(done) {
    const rows = [['方向鍵', '移動（上下＝往深處）'], ['連按左右／Shift', '奔跑'], ['Z', '攻擊（連按出連段）'], ['X／Space', '跳躍'], ['C', '旋風腿（打兩側）'], ['V', '必殺技（量表滿時）'], ['Esc／P', '暫停選單']];
    overlay = closable(() => {
      drawWindow(g, 16, 10, W - 32, H - 20, THEME, { title: '操作說明' });
      rows.forEach(([k, v], i) => { g.label(k, 30, 20 + i * 15, C.yellow); g.label(v, 132, 20 + i * 15, C.white); });
      g.label('觸控：左半邊拖曳移動，右下按鈕操作', W / 2, H - 40, C.lpink, { align: 'center' });
      g.label('（按兩下「跑」或按住「跑」奔跑）', W / 2, H - 26, C.gray, { align: 'center' });
    }, done);
  }
  function openMoves(done) {
    const has = id => skillLv(id) > 0;
    const rows = [
      ['Z 連按', '刺拳、刺拳、直拳、上勾拳', true],
      ['跳躍中 Z', has('airCombo') ? '飛踢 → 再按 Z 空中拳' : '飛踢', true],
      ['奔跑中 Z', has('slideLaunch') ? '滑壘上挑（挑空）' : '滑壘踢（擊倒）', true],
      ['C', has('spinPlus') ? '旋風腿・改（冷卻減半）' : '旋風腿（打兩側、會浮空）', true],
      ['走進暈眩的敵人', '抓住 → Z 膝擊／跳躍鍵 丟出', true],
      ['靠近椅子按 Z', '撿起 → Z 揮擊／跳躍中 Z 丟出', true],
      ['按住 Z 放開', has('charge') ? '蓄力重拳（破霸體）' : '蓄力重拳（到修行場學）', has('charge')],
      ['V（量表滿）', '必殺技「芒果冰暴風」', true],
    ];
    overlay = closable(() => {
      drawWindow(g, 8, 8, W - 16, H - 16, THEME, { title: '招式表' });
      rows.forEach(([k, v, on], i) => { g.label(k, 18, 18 + i * 18, on ? C.yellow : C.gray); g.label(v, 124, 18 + i * 18, on ? C.white : C.gray); });
    }, done);
  }

  // ---------------- 標題 ----------------
  let titleMenu = null;
  function buildTitleMenu() {
    const items = [{ id: 'start', label: D().plays ? '夜市地圖' : '開始遊戲' }, { id: 'help', label: '操作說明' }];
    if (D().plays) items.push({ id: 'erase', label: '刪除存檔' });
    return new Menu(items, { lineH: 16, cancel: false });
  }
  function enterTitle() { scene = 'title'; overlay = null; music.play(SONGS.title); touch.setVisible(false); titleMenu = buildTitleMenu(); }
  function updateTitle() {
    const r = titleMenu.update(input, sound);
    if (!r || r.type !== 'confirm') return;
    input.eat();
    if (r.item.id === 'start') go(enterMap);
    else if (r.item.id === 'help') openHelp();
    else if (r.item.id === 'erase') openConfirm('確定要刪除存檔嗎？（金幣、修行、通關紀錄都會消失）', () => { save.reset(); titleMenu = buildTitleMenu(); });
  }
  const TITLE_SEQ = ['guard', 'guard2', 'guard', 'guard2', 'jabWind', 'jab', 'guard', 'jabWind', 'jab', 'crossWind', 'cross', 'cross', 'guard2', 'upperWind', 'upper', 'upper', 'guard', 'guard2'];
  function renderTitle() {
    const camX = 160 + Math.sin(time * 0.15) * 150;
    const step = Math.floor(time / 0.16) % TITLE_SEQ.length, pose = TITLE_SEQ[step];
    const hit = pose === 'cross' || pose === 'upper';
    world.showcase('gate', camX, [
      { kind: 'player', x: camX + 70, y: 152, pose, face: 1 },
      { kind: 'rabbit', x: camX + 94 + (hit ? 3 : 0), y: 152, pose: hit ? 'hurt' : step % 2 ? 'guard' : 'guard2', face: -1, state: hit ? 'hurt' : 'idle' },
      { kind: 'bear', x: camX + 30, y: 140, pose: step % 4 < 2 ? 'guard' : 'guard2', face: 1 },
      { kind: 'cat', x: camX + 130, y: 136, pose: step % 3 ? 'guard2' : 'guard', face: -1 },
    ], time);
    g.ditherFast(0, 0, W, 60, C.ink, 6);
    g.label('夜市拳姬', 96, 8, C.yellow, { align: 'center', scale: 2, outline: C.ink, shadow: C.pink });
    g.text('NIGHT MARKET BRAWLER', 96, 42, C.lpink, { align: 'center', outline: C.ink });
    const mw = 108, mh = titleMenu.items.length * 16 + 10, mx = 204, my = 18;
    drawWindow(g, mx, my, mw, mh, THEME);
    titleMenu.draw(g, mx + 4, my + 6, mw - 8, THEME, { time });
    g.text('STARDUST ARCADE', 6, H - 9, C.gray, { small: true, outline: C.ink });
  }

  // ---------------- 夜市地圖 ----------------
  // 節點依畫面由左到右排列：左右鍵依序移動
  const NODES = [
    { kind: 'stage', i: 0, x: 40, y: 104 },
    { kind: 'snack', x: 84, y: 50 },
    { kind: 'stage', i: 1, x: 120, y: 96 },
    { kind: 'dojo', x: 168, y: 44 },
    { kind: 'stage', i: 2, x: 208, y: 102 },
    { kind: 'stage', i: 3, x: 276, y: 62 },
  ];
  const STREET = [[40, 104], [80, 110], [120, 96], [164, 106], [208, 102], [244, 80], [276, 62]];
  let mapSel = 0, mapAm = { x: 40, y: 104 };
  function enterMap() {
    scene = 'map'; overlay = null; touch.setVisible(false);
    music.play(SONGS.map);
    world.hudOff = true;
    // 預設選到「下一條還沒通關的街道」
    const next = STAGES.findIndex(s => !D().cleared[s.id]);
    const want = NODES.findIndex(n => n.kind === 'stage' && n.i === (next < 0 ? STAGES.length - 1 : next));
    if (want >= 0) { mapSel = want; mapAm = { x: NODES[want].x, y: NODES[want].y }; }
    if (!D().seenIntro) {
      D().seenIntro = true; save.save();
      dialog.show([
        { name: '阿芒', text: '這是夜市的地圖。從入口牌樓開始，一路打到廟口廣場！', voice: 880 },
        { name: '阿芒', text: '打倒每條街的守護者會拿到修行點數，可以去「修行場」學新招。', voice: 880 },
        { name: '阿芒', text: '撿到的金幣可以在「小吃攤」買點心，吃了下一條街會有加成喔。', voice: 880 },
      ]);
    }
  }
  function nodeRect(n) { return { x: n.x - 13, y: n.y - 20, w: 26, h: 28 }; }
  function confirmNode(n) {
    if (n.kind === 'stage') {
      if (!unlocked(n.i)) { sound.ui('buzz'); return; }
      sound.ui('confirm'); go(() => startStage(n.i));
    } else if (n.kind === 'snack') { sound.ui('open'); openSnack(); }
    else if (n.kind === 'dojo') { sound.ui('open'); openDojo(); }
  }
  function updateMap(dt) {
    const tgt = NODES[mapSel];
    mapAm.x += (tgt.x - mapAm.x) * Math.min(1, dt * 12); mapAm.y += (tgt.y - mapAm.y) * Math.min(1, dt * 12);
    if (input.repeat('right') || input.repeat('down')) { mapSel = Math.min(NODES.length - 1, mapSel + 1); sound.ui('move'); }
    if (input.repeat('left') || input.repeat('up')) { mapSel = Math.max(0, mapSel - 1); sound.ui('move'); }
    for (const t of input.taps) {
      const k = NODES.findIndex(n => { const r = nodeRect(n); return t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h; });
      if (k >= 0) { if (k === mapSel) { confirmNode(NODES[k]); input.eat(); return; } mapSel = k; sound.ui('move'); }
      else if (t.y < 16 && t.x > W - 40) { openMapMenu(); input.eat(); return; }
    }
    if (input.pressed('confirm')) { input.eat(); confirmNode(NODES[mapSel]); return; }
    if (input.pressed('cancel') || input.pressed('pause')) { input.eat(); openMapMenu(); }
  }
  function openMapMenu() {
    const m = new Menu([{ id: 'back', label: '返回地圖' }, { id: 'record', label: '紀錄' }, { id: 'moves', label: '招式表' }, { id: 'help', label: '操作說明' }, { id: 'title', label: '回到標題' }], { lineH: 16 });
    sound.ui('open');
    overlay = {
      update() {
        const r = m.update(input, sound);
        if (!r || r.type === 'move') return;
        input.eat();
        if (r.type === 'cancel' || r.item.id === 'back') { overlay = null; return; }
        if (r.item.id === 'record') openRecord(() => openMapMenu());
        else if (r.item.id === 'moves') openMoves(() => openMapMenu());
        else if (r.item.id === 'help') openHelp(() => openMapMenu());
        else if (r.item.id === 'title') { overlay = null; go(enterTitle); }
      },
      draw() {
        g.screenSpace(); g.ditherFast(0, 0, W, H, C.ink, 8);
        drawWindow(g, 110, 36, 100, 92, THEME, { title: '選單' });
        m.draw(g, 114, 48, 92, THEME, { time });
      },
    };
  }
  function openRecord(done) {
    overlay = closable(() => {
      const d = D();
      drawWindow(g, 10, 8, W - 20, H - 16, THEME, { title: '紀錄' });
      const rows = [['通關的街道', `${STAGES.filter(s => d.cleared[s.id]).length}／${STAGES.length}`], ['出擊次數', d.plays], ['打倒的敵人', d.kills], ['最高連段', d.bestCombo], ['接關次數', d.continues]];
      rows.forEach(([k, v], i) => { g.label(k, 22, 18 + i * 15, C.lpink); g.label(String(v), 150, 18 + i * 15, C.white, { align: 'right' }); });
      STAGES.forEach((s, i) => {
        const b = d.best[s.id], y = 18 + i * 22;
        g.label(`${i + 1} ${s.name}`, 170, y, d.cleared[s.id] ? C.white : C.gray);
        if (b.rank) {
          g.text(b.rank, 294, y + 2, RANK_COLOR[b.rank], { align: 'right', scale: 2, outline: C.ink });
          g.text(`${b.score}`, 272, y + 12, C.yellow, { small: true, align: 'right' });
        } else g.label('—', 290, y, C.gray, { align: 'right' });
      });
      g.label(d.ending ? '已經看過結局了！' : '打倒熊貓大仙就能看到結局。', W / 2, H - 30, d.ending ? C.yellow : C.gray, { align: 'center' });
    }, done);
  }
  function renderMap() {
    g.screenSpace();
    if (!mapBack) mapBack = buildMapBack();
    g.ctx.drawImage(mapBack, 0, 0);
    // 路上的串燈閃爍
    for (let k = 0; k < STREET.length - 1; k++) {
      const [x0, y0] = STREET[k], [x1, y1] = STREET[k + 1];
      const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / 7);
      for (let j = 0; j < n; j++) { const u = j / n; if ((j + k + Math.floor(time * 3)) % 3 === 0) g.px(Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u) - 6, C.yellow); }
    }
    NODES.forEach((n, k) => {
      const sel = k === mapSel;
      if (n.kind === 'stage') {
        const open = unlocked(n.i), rec = D().best[STAGES[n.i].id];
        if (!open) { g.ditherFast(n.x - 13, n.y - 22, 26, 26, C.ink, 10); g.rect(n.x - 3, n.y - 12, 7, 6, C.gray); g.rect(n.x - 2, n.y - 15, 5, 3, C.ink); g.rect(n.x - 2, n.y - 16, 1, 4, C.gray); g.rect(n.x + 2, n.y - 16, 1, 4, C.gray); }
        g.rect(n.x - 15, n.y + 4, 9, 9, C.ink); g.text(String(n.i + 1), n.x - 13, n.y + 6, open ? C.white : C.gray);
        if (rec.rank) { g.rect(n.x + 6, n.y + 3, 11, 11, C.ink); g.text(rec.rank, n.x + 8, n.y + 5, RANK_COLOR[rec.rank]); }
      }
      if (sel) {
        const c = Math.floor(time * 4) % 2 ? C.yellow : C.white;
        const r = nodeRect(n);
        g.rect(r.x, r.y, 4, 1, c); g.rect(r.x, r.y, 1, 4, c); g.rect(r.x + r.w - 4, r.y, 4, 1, c); g.rect(r.x + r.w - 1, r.y, 1, 4, c);
        g.rect(r.x, r.y + r.h - 1, 4, 1, c); g.rect(r.x, r.y + r.h - 4, 1, 4, c); g.rect(r.x + r.w - 4, r.y + r.h - 1, 4, 1, c); g.rect(r.x + r.w - 1, r.y + r.h - 4, 1, 4, c);
      }
    });
    // 阿芒（地圖上的小頭像）
    const bob = Math.floor(time * 3) % 2;
    g.spr(S.amang.head, Math.round(mapAm.x - 6), Math.round(mapAm.y - 36 - bob));
    // 上方狀態列
    g.rect(0, 0, W, 15, C.ink);
    g.spr(S.token, 4, 4); g.text(String(D().coins), 13, 5, C.yellow);
    g.spr(S.point, 56, 3); g.text(String(D().points), 66, 5, C.cyan);
    if (D().snack) { g.spr(S.food[D().snack], 88, 1, {}); g.label(`帶著：${SNACK[D().snack].name}`, 104, 1, C.lpink); }
    g.label('選單', W - 6, 1, C.gray, { align: 'right' });
    // 下方說明
    const n = NODES[mapSel];
    drawWindow(g, 4, 130, W - 8, 46, THEME);
    if (n.kind === 'stage') {
      const st = STAGES[n.i], rec = D().best[st.id];
      g.label(`第 ${n.i + 1} 條街　${st.name}`, 12, 136, C.yellow);
      g.text(st.en, W - 12, 139, C.lpink, { align: 'right', small: true });
      if (!unlocked(n.i)) g.label('先打倒前一條街的守護者才能前往。', 12, 154, C.gray);
      else {
        g.label(`守護者：${st.bossName}`, 12, 154, C.white);
        if (rec.rank) { g.label('最佳', 190, 154, C.gray); g.text(rec.rank, 218, 156, RANK_COLOR[rec.rank], { outline: C.ink }); g.text(String(rec.score), W - 12, 157, C.white, { align: 'right' }); }
        else g.label('Z 出發', W - 12, 154, Math.floor(time * 2) % 2 ? C.white : C.gray, { align: 'right' });
      }
    } else if (n.kind === 'snack') {
      g.label('小吃攤', 12, 136, C.yellow);
      g.label(D().snack ? `已經買了${SNACK[D().snack].name}，下一條街生效。` : '用金幣買一份點心，下一條街會有加成。', 12, 154, C.white);
    } else {
      g.label('修行場', 12, 136, C.yellow);
      g.label(`用修行點數學新招。目前有 ${D().points} 點。`, 12, 154, C.white);
    }
  }
  function buildMapBack() {
    return makeLayer(W, H, PALETTE, p => {
      p.rect(0, 0, W, H, C.ink);
      for (let y = 15; y < H; y++) p.dither(0, y, W, 1, C.navy, Math.round(clamp((y - 15) / 110, 0, 1) * 10));
      let s = 5; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
      // 街區（屋頂）
      for (let by = 20; by < 128; by += 22) for (let bx = 2; bx < W; bx += 26) {
        const w = 18 + Math.floor(r() * 6), h = 14 + Math.floor(r() * 5);
        p.rect(bx, by, w, h, C.ink); p.rect(bx + 1, by + 1, w - 2, h - 2, r() < 0.5 ? C.purple : C.navy);
        for (let k = 0; k < 3; k++) if (r() < 0.6) p.px(bx + 3 + Math.floor(r() * (w - 6)), by + 3 + Math.floor(r() * (h - 6)), r() < 0.5 ? C.yellow : C.orange);
      }
      // 小巷（通往小吃攤與修行場）
      p.line(100, 102, 84, 54, C.ink, 7); p.line(100, 102, 84, 54, C.gray, 4);
      p.line(164, 106, 168, 48, C.ink, 7); p.line(164, 106, 168, 48, C.gray, 4);
      // 主街
      for (let k = 0; k < STREET.length - 1; k++) { const [x0, y0] = STREET[k], [x1, y1] = STREET[k + 1]; p.line(x0, y0, x1, y1, C.ink, 13); }
      for (let k = 0; k < STREET.length - 1; k++) { const [x0, y0] = STREET[k], [x1, y1] = STREET[k + 1]; p.line(x0, y0, x1, y1, C.plum, 9); p.line(x0, y0, x1, y1, C.purple, 3); }
      // 各站的圖示
      for (const n of NODES) { p.circle(n.x, n.y - 6, 12, C.ink); p.circle(n.x, n.y - 6, 10, C.plum); }
      const [g0, g1, g2, g3] = NODES.filter(n => n.kind === 'stage');
      // 1 牌樓
      p.rect(g0.x - 8, g0.y - 14, 3, 14, C.red); p.rect(g0.x + 6, g0.y - 14, 3, 14, C.red);
      p.rect(g0.x - 11, g0.y - 18, 23, 3, C.yellow); p.rect(g0.x - 9, g0.y - 14, 19, 2, C.red); p.rect(g0.x - 11, g0.y - 19, 23, 1, C.ink);
      // 2 小吃：大碗與熱氣
      p.ellipse(g1.x, g1.y - 6, 8, 3, C.white); p.rect(g1.x - 7, g1.y - 6, 15, 4, C.white); p.rect(g1.x - 5, g1.y - 2, 11, 2, C.gray); p.rect(g1.x - 6, g1.y - 7, 13, 1, C.orange);
      for (const dx of [-3, 1, 5]) { p.px(g1.x + dx, g1.y - 11, C.gray); p.px(g1.x + dx - 1, g1.y - 13, C.gray); p.px(g1.x + dx, g1.y - 15, C.gray); }
      // 3 遊戲攤：氣球
      [[-5, -14, C.pink], [1, -17, C.cyan], [6, -12, C.yellow]].forEach(([dx, dy, c]) => { p.circle(g2.x + dx, g2.y + dy, 3, c); p.px(g2.x + dx - 1, g2.y + dy - 1, C.white); p.line(g2.x + dx, g2.y + dy + 3, g2.x, g2.y, C.white); });
      // 4 廟：屋頂與柱子
      p.rect(g3.x - 11, g3.y - 16, 23, 3, C.orange); p.rect(g3.x - 9, g3.y - 18, 19, 2, C.orange); p.px(g3.x - 12, g3.y - 17, C.orange); p.px(g3.x + 12, g3.y - 17, C.orange);
      p.rect(g3.x - 8, g3.y - 13, 17, 11, C.red); p.rect(g3.x - 3, g3.y - 9, 7, 7, C.ink); p.rect(g3.x - 6, g3.y - 13, 2, 11, C.yellow); p.rect(g3.x + 5, g3.y - 13, 2, 11, C.yellow);
      // 小吃攤：條紋遮雨棚
      const sn = NODES[1];
      for (let k = 0; k < 9; k++) p.rect(sn.x - 9 + k * 2, sn.y - 16, 2, 5, k % 2 ? C.white : C.pink);
      p.rect(sn.x - 8, sn.y - 11, 17, 7, C.wood); p.rect(sn.x - 8, sn.y - 11, 17, 1, C.yellow); p.rect(sn.x - 3, sn.y - 9, 3, 2, C.orange); p.rect(sn.x + 2, sn.y - 9, 3, 2, C.lpink);
      // 修行場：瓦頂與拳頭旗
      const dj = NODES[3];
      p.rect(dj.x - 10, dj.y - 16, 21, 3, C.wood); p.rect(dj.x - 8, dj.y - 13, 17, 10, C.white); p.rect(dj.x - 2, dj.y - 9, 5, 6, C.wood);
      p.rect(dj.x + 7, dj.y - 22, 1, 9, C.gray); p.rect(dj.x + 8, dj.y - 22, 5, 4, C.red);
    });
  }

  // ---------------- 小吃攤 ----------------
  function openSnack() {
    music.play(SONGS.shop);
    const build = () => SNACKS.map(s => ({ id: s.id, label: s.name, right: D().snack === s.id ? '已購買' : `${s.price}`, rightColor: D().snack === s.id ? C.lpink : D().coins >= s.price ? C.yellow : C.gray })).concat([{ id: 'back', label: '返回' }]);
    const m = new Menu(build(), { lineH: 15 });
    let note = D().snack ? '一次只能帶一份。買新的會換掉現在的。' : '選一份點心，下一條街開始時吃掉。';
    const close = () => { overlay = null; music.play(SONGS.map); };
    overlay = {
      update() {
        const r = m.update(input, sound);
        if (!r || r.type === 'move') return;
        input.eat();
        if (r.type === 'cancel' || r.item.id === 'back') { close(); return; }
        const sn = SNACK[r.item.id];
        if (D().snack === sn.id) { note = `已經買了${sn.name}。`; return; }
        if (D().coins < sn.price) { sound.ui('buzz'); note = '金幣不夠……打破紙箱和垃圾桶可以撿到金幣。'; return; }
        D().coins -= sn.price; D().snack = sn.id; save.save(); sound.ui('coin');
        note = `買了${sn.name}！下一條街開始時吃掉。`;
        m.setItems(build());
      },
      draw() {
        g.screenSpace(); g.ditherFast(0, 0, W, H, C.ink, 6);
        drawWindow(g, 8, 8, W - 16, H - 16, THEME, { title: '小吃攤' });
        m.draw(g, 14, 20, 118, THEME, { time });
        const sn = SNACK[m.item.id];
        if (sn) {
          const spr = S.food[sn.id];
          big(spr, 170 - spr.w, 22, 2);
          g.label(sn.name, 186, 22, C.yellow);
          g.spr(S.token, 186, 40); g.text(String(sn.price), 195, 41, D().coins >= sn.price ? C.yellow : C.gray);
          drawParagraph(g, sn.desc, 146, 56, 156, C.white);
        }
        g.spr(S.token, 14, H - 26); g.text(String(D().coins), 23, H - 25, C.yellow);
        drawParagraph(g, note, 146, H - 44, 156, C.lpink);
      },
    };
  }

  // ---------------- 修行場 ----------------
  function openDojo() {
    music.play(SONGS.shop);
    const build = () => SKILLS.map(sk => {
      const lv = D().skills[sk.id];
      const done = lv >= sk.max;
      return { id: sk.id, label: sk.name + (sk.max > 1 && lv ? ` ${lv}` : ''), right: done ? '習得' : `${sk.cost[lv]} 點`, rightColor: done ? C.gray : D().points >= sk.cost[lv] ? C.cyan : C.pink };
    }).concat([
      { id: 'tuition', label: '繳學費', right: D().tuition >= TUITION.max ? '—' : `${TUITION.coins}`, rightColor: D().tuition < TUITION.max && D().coins >= TUITION.coins ? C.yellow : C.gray },
      { id: 'back', label: '返回' },
    ]);
    const m = new Menu(build(), { lineH: 14 });
    let note = '';
    const close = () => { overlay = null; music.play(SONGS.map); };
    overlay = {
      update() {
        const r = m.update(input, sound);
        if (!r || r.type === 'move') return;
        input.eat();
        if (r.type === 'cancel' || r.item.id === 'back') { close(); return; }
        if (r.item.id === 'tuition') {
          if (D().tuition >= TUITION.max) { note = '師父：學費已經收夠了，剩下的靠實戰吧！'; return; }
          if (D().coins < TUITION.coins) { sound.ui('buzz'); note = '金幣不夠。'; return; }
          D().coins -= TUITION.coins; D().tuition++; D().points++; save.save(); sound.ui('coin');
          note = '修行點數 +1！'; m.setItems(build()); return;
        }
        const sk = SKILLS.find(s => s.id === r.item.id), lv = D().skills[sk.id];
        if (lv >= sk.max) { note = '已經學會了。'; return; }
        if (D().points < sk.cost[lv]) { sound.ui('buzz'); note = '修行點數不夠……街道評價越高，拿到的點數越多。'; return; }
        D().points -= sk.cost[lv]; D().skills[sk.id]++; save.save();
        sound.ui('confirm'); sound.bell({ f: 1175, dur: 0.6, vol: 0.1 });
        note = `學會了「${sk.name}」！`;
        m.setItems(build());
      },
      draw() {
        g.screenSpace(); g.ditherFast(0, 0, W, H, C.ink, 6);
        drawWindow(g, 8, 8, W - 16, H - 16, THEME, { title: '修行場' });
        m.draw(g, 14, 18, 120, THEME, { time });
        const id = m.item.id, sk = SKILLS.find(s => s.id === id);
        if (sk) {
          const lv = D().skills[sk.id];
          g.label(sk.name, 146, 18, C.yellow);
          for (let i = 0; i < sk.max; i++) g.rect(146 + i * 9, 36, 7, 4, i < lv ? C.cyan : C.purple);
          drawParagraph(g, sk.desc, 146, 46, 156, C.white);
        } else if (id === 'tuition') {
          g.label('繳學費', 146, 18, C.yellow);
          drawParagraph(g, `用 ${TUITION.coins} 金幣換 1 修行點數（還可以繳 ${TUITION.max - D().tuition} 次）。`, 146, 36, 156, C.white);
        }
        g.spr(S.point, 14, H - 27); g.text(String(D().points), 24, H - 25, C.cyan);
        g.spr(S.token, 50, H - 26); g.text(String(D().coins), 59, H - 25, C.yellow);
        if (note) drawParagraph(g, note, 146, H - 44, 156, C.lpink);
      },
    };
  }

  // ---------------- 結算 ----------------
  function rankOf(s, i) {
    let pts = 0;
    pts += s.continues === 0 ? 2 : s.continues === 1 ? 0.5 : 0;
    const r = s.dmgTaken / s.maxHp;
    pts += r <= 0.6 ? 2 : r <= 1.2 ? 1 : r <= 2 ? 0.5 : 0;
    pts += s.time <= PAR[i] ? 1 : s.time <= PAR[i] * 1.4 ? 0.5 : 0;
    pts += s.bestCombo >= 25 ? 1 : s.bestCombo >= 15 ? 0.5 : 0;
    return pts >= 5 ? 'S' : pts >= 3.5 ? 'A' : pts >= 2 ? 'B' : 'C';
  }
  function enterResults(stats) {
    const i = world.stageIndex, st = STAGES[i], d = D();
    const rank = rankOf(stats, i);
    const timeBonus = Math.max(0, Math.round(PAR[i] - stats.time)) * 20;
    const hpBonus = Math.round(Math.max(0, 1 - stats.dmgTaken / stats.maxHp) * 3000);
    const comboBonus = stats.bestCombo * 100;
    const total = Math.max(0, stats.score + timeBonus + hpBonus + comboBonus - stats.continues * 2000);
    const first = !d.cleared[st.id];
    const gainRank = Math.max(0, RANK_PTS[rank] - d.rankPts[st.id]);
    const pts = gainRank + (first ? 1 : 0);
    const coins = RANK_COINS[rank];
    const rec = d.best[st.id];
    const newRecord = total > rec.score;
    const better = !rec.rank || 'CBAS'.indexOf(rank) > 'CBAS'.indexOf(rec.rank);
    d.cleared[st.id] = true; d.rankPts[st.id] = Math.max(d.rankPts[st.id], RANK_PTS[rank]);
    d.points += pts; d.coins += coins; d.clears++; d.kills += stats.kills; d.bestCombo = Math.max(d.bestCombo, stats.bestCombo);
    if (newRecord) rec.score = total;
    if (better) rec.rank = rank;
    if (!rec.time || stats.time < rec.time) rec.time = Math.round(stats.time);
    rec.combo = Math.max(rec.combo, stats.bestCombo);
    save.save();
    const toEnding = i === STAGES.length - 1 && !d.ending;
    results = { stats, rank, timeBonus, hpBonus, comboBonus, total, first, pts, coins, newRecord, t: 0, i, toEnding };
    scene = 'results'; overlay = null;
    touch.setVisible(false);
    music.play(SONGS.clear);
    runSnack = null;
    const outro = BOSS_OUTRO[st.boss];
    if (outro && outro.length && first) dialog.show(outro);
  }
  function updateResults(dt) {
    const r = results;
    r.t += dt;
    const shown = r.t > 3.2;
    if ((input.pressed('confirm') || input.taps.length) && !shown) { r.t = 3.2; input.eat(); return; }
    if (shown && (input.pressed('confirm') || input.taps.length)) { input.eat(); sound.ui('confirm'); go(r.toEnding ? enterEnding : enterMap); }
  }
  function renderResults() {
    const r = results, s = r.stats, st = STAGES[r.i];
    world.showcase(st.style, 120, [], time);
    g.ditherFast(0, 0, W, H, C.ink, 9);
    g.label(`${st.name}　清場！`, W / 2, 6, C.yellow, { align: 'center', scale: 2, outline: C.ink, shadow: C.pink });
    drawWindow(g, 10, 40, 196, 132, THEME);
    const rows = [
      ['打倒的敵人', s.kills], ['最高連段', s.bestCombo], ['通關時間', fmtTime(s.time)], ['受到的傷害', s.dmgTaken], ['接關', s.continues],
      ['時間獎勵', `+${r.timeBonus}`], ['體力獎勵', `+${r.hpBonus}`], ['連段獎勵', `+${r.comboBonus}`],
    ];
    rows.forEach(([k, v], i) => { if (r.t > 0.3 + i * 0.18) { g.label(k, 20, 46 + i * 13, C.lpink); g.label(String(v), 196, 46 + i * 13, C.white, { align: 'right' }); } });
    if (r.t > 2) { g.rect(18, 152, 180, 1, C.purple); g.label('得分', 20, 155, C.yellow); g.text(String(r.total), 196, 158, C.yellow, { align: 'right', outline: C.ink }); if (r.newRecord && Math.floor(time * 3) % 2) g.text('NEW RECORD', 110, 158, C.pink, { small: true }); }
    if (r.t > 2.6) {
      drawWindow(g, 214, 40, 96, 132, THEME);
      g.label('評價', 262, 46, C.gray, { align: 'center' });
      const k = Math.max(1, 4 - Math.floor((r.t - 2.6) * 12));
      g.text(r.rank, 262, 66, k > 1 && Math.floor(time * 20) % 2 ? C.white : RANK_COLOR[r.rank], { align: 'center', scale: 4, outline: C.ink });
      if (r.t > 3) {
        g.spr(S.point, 222, 112); g.label(r.pts ? `修行點數 +${r.pts}` : '修行點數 +0', 232, 108, r.pts ? C.cyan : C.gray);
        g.spr(S.token, 222, 128); g.label(`金幣 +${r.coins}`, 232, 124, C.yellow);
        if (r.first) g.label('首次通關！', 262, 142, C.lpink, { align: 'center' });
      }
    }
    if (r.t > 3.2 && !dialog.open && Math.floor(time * 2) % 2) g.label('按 Z 繼續', 262, 156, C.white, { align: 'center' });
  }

  // ---------------- 結局 ----------------
  function enterEnding() {
    scene = 'ending'; overlay = null;
    D().ending = true; save.save();
    ending = { t: 0, talk: true };
    music.play(SONGS.map);
    dialog.show(ENDING, () => { ending.talk = false; ending.t = 0; music.play(SONGS.title); });
  }
  const CREDITS = [
    ['夜市拳姬', C.yellow], ['NIGHT MARKET BRAWLER', C.lpink], ['', 0],
    ['主角　阿芒', C.white], ['守護者　兔兔老大／珍奶巨人', C.white], ['夾娃娃機大王／熊貓大仙', C.white], ['', 0],
    ['所有圖像與音樂都是由程式即時產生', C.gray], ['', 0], ['感謝遊玩！', C.yellow],
  ];
  function updateEnding(dt) {
    ending.t += dt;
    if (!ending.talk && ending.t > 2 && (input.pressed('confirm') || input.taps.length)) { input.eat(); go(enterMap); }
  }
  function renderEnding() {
    const step = Math.floor(time * 2) % 2;
    world.showcase('temple', 200, [
      { kind: 'player', x: 360, y: 130, pose: step ? 'cheer' : 'guard2', face: 1 },
      { kind: 'panda', x: 404, y: 126, pose: 'guard', face: -1 },
      { kind: 'bunnyBoss', x: 312, y: 124, pose: step ? 'guard2' : 'guard', face: 1 },
      { kind: 'rabbit', x: 440, y: 132, pose: step ? 'guard' : 'guard2', face: -1 },
      { kind: 'cat', x: 276, y: 132, pose: step ? 'guard2' : 'guard', face: 1 },
      { kind: 'bear', x: 244, y: 126, pose: 'guard', face: 1 },
      { kind: 'dog', x: 470, y: 124, pose: step ? 'guard' : 'guard2', face: -1 },
    ], time);
    if (ending.talk) return;
    g.ditherFast(0, 0, W, H, C.ink, Math.min(10, Math.floor(ending.t * 8)));
    const y0 = Math.round(H - ending.t * 22);
    CREDITS.forEach(([t, c], i) => {
      const y = Math.max(8 + i * 14, y0 + i * 14);
      if (!t || y > H - 10) return;
      if (/^[A-Z ]+$/.test(t)) g.text(t, W / 2, y + 2, c, { align: 'center', outline: C.ink });
      else g.label(t, W / 2, y, c, { align: 'center', outline: C.ink });
    });
    if (ending.t > 6 && Math.floor(time * 2) % 2) g.label('按 Z 回到夜市地圖', W / 2, H - 16, C.white, { align: 'center', outline: C.ink });
  }

  // ---------------- 主迴圈 ----------------
  function update(dt) {
    time += dt;
    trans.update(dt);
    if (trans.phase === 'out') return;
    if (dialog.open) { dialog.update(dt, input); return; }
    if (overlay) { overlay.update(dt); return; }
    switch (scene) {
      case 'title': updateTitle(); break;
      case 'map': updateMap(dt); break;
      case 'play': {
        const pl = world.player;
        if (input.pressed('pause') && !world.finale && pl.state !== 'dead') { input.eat(); openPause(); break; }
        world.update(dt);
        break;
      }
      case 'results': updateResults(dt); break;
      case 'ending': updateEnding(dt); break;
    }
  }
  function render() {
    switch (scene) {
      case 'title': renderTitle(); break;
      case 'map': renderMap(); break;
      case 'play': world.render(); break;
      case 'results': renderResults(); break;
      case 'ending': renderEnding(); break;
    }
    g.screenSpace();
    if (overlay) overlay.draw();
    dialog.draw(g, W, H);
    trans.draw(g, C.ink);
  }
  function onBlur() {
    save.save();
    if (scene === 'play' && !overlay && !dialog.open && !world.finale && world.player.state !== 'dead') openPause();
  }
  function stageCover() { runSnack = null; scene = 'play'; overlay = null; world.stageCover(); }

  enterTitle();
  return {
    update, render, onBlur, stageCover, reset() {},
    debugLines: () => scene === 'play' ? world.debugLines() : [`SCENE ${scene.toUpperCase()}`],
    peek: () => ({ scene, overlay: !!overlay, dialog: dialog.open, ...(scene === 'play' ? world.peek() : {}) }),
    debug: {
      startStage: i => { STAGES.forEach(s => { D().seenStage[s.id] = true; }); D().seenIntro = true; startStage(i); },
      boss: () => world.debugBoss(),
      clearZone: () => world.debugClearZone(),
      toMap: () => enterMap(),
      world, save,
      get scene() { return scene; }, get results() { return results; },
    },
  };
}

runPrototype({
  id: 'night-market-brawler',
  title: '夜市拳姬',
  subtitle: '清版格鬥',
  width: W, height: H, palette: PALETTE, ui: { text: C.white, dark: C.ink },
  input: {
    left: { keys: ['ArrowLeft', 'KeyA'] }, right: { keys: ['ArrowRight', 'KeyD'] },
    up: { keys: ['ArrowUp', 'KeyW'] }, down: { keys: ['ArrowDown', 'KeyS'] },
    attack: { keys: ['KeyZ', 'KeyJ'], pad: [2] },
    jump: { keys: ['KeyX', 'KeyK', 'Space'], pad: [0] },
    special: { keys: ['KeyC', 'KeyL'], pad: [1, 3] },
    super: { keys: ['KeyV', 'Semicolon'], pad: [4, 6] },
    run: { keys: ['ShiftLeft', 'ShiftRight'], pad: [5] },
    pause: { keys: ['Escape', 'KeyP', 'Enter'], pad: [9] },
    confirm: { keys: ['Enter', 'KeyZ', 'Space', 'KeyJ'], pad: [0] },
    cancel: { keys: ['Escape', 'KeyX', 'Backspace'], pad: [1] },
  },
  touch: [{ action: 'super', label: '必' }, { action: 'special', label: '旋' }, { action: 'run', label: '跑' }, { action: 'jump', label: '跳' }, { action: 'attack', label: '拳', big: true }],
  touchPause: 'pause',
  tuning: TUNING,
  intro: INTRO,
  debugItems: [
    { key: 'godMode', label: '無敵（測試用）', type: 'toggle', value: false },
    { key: 'unlockAll', label: '解鎖全部街道與招式（測試用）', type: 'toggle', value: false },
    { key: 'fullMeter', label: '開場必殺量表全滿（測試用）', type: 'toggle', value: false },
  ],
  create,
});
