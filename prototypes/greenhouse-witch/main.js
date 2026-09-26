// 《溫室魔女的剪定日》PRUNE & BLOOM：俯視角動作 Roguelite
// 見習魔女茴香一層一層修剪暴走的溫室。每輪隨機的房間與祝福；倒下後回到小屋，用種子做永久強化。
// 這個檔案負責：調參面板、場景（標題／溫室小屋／探索／結算）與各種選單。
import { runPrototype } from '../engine/app.js';
import { makeLayer } from '../engine/pixel.js';
import { Menu, Dialog, Transition, drawWindow, drawCursor, drawParagraph } from '../engine/ui.js';
import { wrapLabel, labelWidth } from '../engine/text.js';
import { SaveData } from '../engine/save.js';
import { rand, clamp } from '../engine/fx.js';
import { PALETTE, buildSprites } from './sprites.js';
import { FLOORS } from './rooms.js';
import { BOONS, BOON_LIST, MAX_LV, boonChoices } from './boons.js';
import { createWorld, WEAPONS, C } from './world.js';
import { SONGS } from './songs.js';

const W = 320, H = 180;
const THEME = { ink: C.ink, panel: C.shadow, border: C.leaf, light: C.plum, text: C.white, dim: C.mauve, accent: C.lime, hilite: C.plum, selText: C.white };

const TUNING = {
  groups: [
    { name: '移動', items: [
      { key: 'moveSpeed', label: '最高速度', min: 40, max: 220, step: 1, value: 96, unit: 'px/s' },
      { key: 'accel', label: '加速度', min: 100, max: 9000, step: 50, value: 1100, unit: 'px/s²' },
      { key: 'friction', label: '減速度', min: 100, max: 9000, step: 50, value: 1400, unit: 'px/s²', hint: '放開方向鍵後停下的快慢，小＝會滑。' },
      { key: 'turnBoost', label: '轉向加成', min: 1, max: 4, step: 0.1, value: 1.8, unit: '×' },
      { key: 'diagNormalize', label: '斜向速度一致', type: 'toggle', value: true },
    ] },
    { name: '翻滾', items: [
      { key: 'rollSpeed', label: '翻滾速度', min: 80, max: 600, step: 10, value: 230, unit: 'px/s' },
      { key: 'rollTime', label: '翻滾時間', min: 0.1, max: 0.6, step: 0.01, value: 0.28, unit: '秒' },
      { key: 'rollCurve', label: '爆發曲線', min: 1, max: 4, step: 0.1, value: 1.8, unit: '' },
      { key: 'rollIframes', label: '無敵時段', min: 0, max: 1, step: 0.05, value: 0.75, unit: '×' },
      { key: 'rollCooldown', label: '翻滾間隔', min: 0, max: 1.5, step: 0.02, value: 0.16, unit: '秒' },
      { key: 'rollRecharge', label: '翻滾次數回復', min: 0.1, max: 2, step: 0.05, value: 0.55, unit: '秒', hint: '用掉的翻滾次數多久回復一次（小屋可以升級成兩次）。' },
      { key: 'rollCancel', label: '攻擊後搖可翻滾取消', type: 'toggle', value: true },
      { key: 'perfectDodge', label: '完美閃避（子彈時間）', type: 'toggle', value: true },
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
      { key: 'autoAim', label: '自動修正角度', min: 0, max: 90, step: 5, value: 35, unit: '°' },
      { key: 'cutSpores', label: '可以斬斷孢子彈', type: 'toggle', value: true },
    ] },
    { name: '蓄力', items: [
      { key: 'chargeTime', label: '蓄力時間', min: 0.1, max: 1.5, step: 0.05, value: 0.5, unit: '秒' },
      { key: 'chargeMove', label: '蓄力中移動倍率', min: 0, max: 1, step: 0.05, value: 0.45, unit: '×' },
      { key: 'spinRadius', label: '迴旋半徑', min: 16, max: 60, step: 1, value: 34, unit: 'px' },
      { key: 'spinTurns', label: '迴旋圈數', min: 1, max: 4, step: 1, value: 2, unit: '圈' },
    ] },
    { name: '打擊感', items: [
      { key: 'hitstop', label: '打擊停頓', min: 0, max: 250, step: 5, value: 55, unit: 'ms' },
      { key: 'hitstopFinisher', label: '終結技停頓', min: 0, max: 400, step: 5, value: 120, unit: 'ms' },
      { key: 'knock', label: '擊退力道', min: 0, max: 600, step: 10, value: 230, unit: 'px/s' },
      { key: 'finisherKnock', label: '終結技擊退倍率', min: 1, max: 4, step: 0.1, value: 1.9, unit: '×' },
      { key: 'enemyFriction', label: '敵人摩擦', min: 1, max: 20, step: 0.5, value: 6, unit: '' },
      { key: 'wallSlam', label: '撞牆／撞人傷害', type: 'toggle', value: true },
      { key: 'slamSpeed', label: '撞擊門檻速度', min: 40, max: 400, step: 10, value: 150, unit: 'px/s' },
      { key: 'hitstun', label: '敵人硬直', min: 0, max: 1000, step: 10, value: 300, unit: 'ms' },
      { key: 'shake', label: '畫面震動', min: 0, max: 8, step: 0.5, value: 2.5, unit: 'px' },
      { key: 'shakeFinisher', label: '終結技震動', min: 0, max: 12, step: 0.5, value: 5, unit: 'px' },
      { key: 'flashFrames', label: '命中閃白', min: 0, max: 10, step: 1, value: 3, unit: '格' },
      { key: 'sparks', label: '火花＋葉片數量', min: 0, max: 30, step: 1, value: 10, unit: '個' },
      { key: 'smear', label: '刀光殘影', type: 'toggle', value: true },
      { key: 'damageNumbers', label: '傷害數字', type: 'toggle', value: true },
    ] },
    { name: '受擊、鏡頭、難度', open: false, items: [
      { key: 'iframes', label: '受擊無敵時間', min: 0, max: 3000, step: 50, value: 900, unit: 'ms' },
      { key: 'hurtKnock', label: '受擊擊退', min: 0, max: 500, step: 10, value: 200, unit: 'px/s' },
      { key: 'hurtHitstop', label: '受擊停頓', min: 0, max: 300, step: 5, value: 90, unit: 'ms' },
      { key: 'camLead', label: '鏡頭前瞻', min: 0, max: 60, step: 1, value: 18, unit: 'px' },
      { key: 'camSmooth', label: '鏡頭平滑', min: 0, max: 0.5, step: 0.01, value: 0.1, unit: '秒' },
      { key: 'enemySpeed', label: '敵人速度倍率', min: 0.3, max: 2, step: 0.1, value: 1, unit: '×' },
      { key: 'enemyAggro', label: '敵人會主動攻擊', type: 'toggle', value: true },
      { key: 'enemyHp', label: '敵人體力倍率', min: 0.3, max: 3, step: 0.1, value: 1, unit: '×' },
      { key: 'bossHp', label: '守護者體力倍率', min: 0.2, max: 3, step: 0.1, value: 1, unit: '×' },
      { key: 'playerDamage', label: '玩家傷害倍率', min: 0.5, max: 3, step: 0.1, value: 1, unit: '×' },
      { key: 'coinMul', label: '金幣掉落倍率', min: 0.5, max: 3, step: 0.1, value: 1, unit: '×' },
    ] },
  ],
  presets: {
    '均衡（預設值）': {},
    '俐落閃避流': { accel: 2400, friction: 3000, rollSpeed: 280, rollTime: 0.24, rollCurve: 2.4, rollCooldown: 0.08, rollRecharge: 0.35, perfectWindow: 0.18, startup: 2, recovery: 6, comboCancel: 0.2, hitstop: 40 },
    '厚重揮砍流': { moveSpeed: 80, accel: 600, friction: 900, startup: 6, active: 6, recovery: 14, arc: 190, radius: 32, lunge: 180, hitstop: 95, hitstopFinisher: 190, knock: 360, finisherKnock: 2.4, enemyFriction: 4, shake: 3.5, shakeFinisher: 7 },
    '滑溜冰面': { accel: 300, friction: 250, turnBoost: 1, rollCurve: 1, enemyFriction: 2 },
    '輕鬆模式': { iframes: 1400, enemyHp: 0.7, bossHp: 0.6, playerDamage: 1.3, coinMul: 1.5, perfectWindow: 0.2 },
    '無特效對照組': { hitstop: 0, hitstopFinisher: 0, shake: 0, shakeFinisher: 0, flashFrames: 0, sparks: 0, smear: false, knock: 0, hitstun: 0, wallSlam: false, perfectDodge: false, damageNumbers: false, camLead: 0, camSmooth: 0 },
  },
};

const INTRO = {
  pitch: '魔法溫室的植物全都暴走了！見習魔女茴香拿起園藝工具，一間一間修剪回來。三層樓、每輪隨機的房間與祝福。',
  goals: [
    '每清完一個房間，選一扇門決定下一間的獎勵（祝福、金幣、種子、商店、泉水、強敵）。',
    '祝福最多升到 Lv3，組合會大幅改變打法。每層最後有守護者。',
    '倒下後帶著種子回到溫室小屋，種出永久強化、解鎖新武器（雙刃剪、澆水壺）。',
    '翻滾剛開始時與攻擊擦身而過＝完美閃避，世界會變慢。',
    '這裡的參數會即時影響遊戲；「輕鬆模式」預設可以降低難度。',
  ],
  controls: [
    ['方向鍵／WASD', '八方向移動'],
    ['Z ／ J', '攻擊（連按連段；揮完繼續按住＝蓄力，放開放出蓄力技）'],
    ['X ／ K ／ Space', '翻滾閃避'],
    ['滑鼠', '左鍵攻擊、右鍵翻滾（瞄準方式可改成滑鼠游標）'],
    ['Esc ／ P ／ Enter', '暫停選單'],
    ['手把', '左搖桿移動、X 攻擊、A／B 翻滾、Start 暫停'],
    ['F ／ N ／ H', '凍結畫面／逐格播放／顯示判定框（除錯）'],
  ],
};

const UPGRADES = [
  { id: 'hp', name: '生命之根', desc: '最大體力 +1。', max: 3, cost: [10, 22, 36] },
  { id: 'roll', name: '翻滾之葉', desc: '翻滾次數 +1，可以連續翻滾兩次。', max: 1, cost: [30] },
  { id: 'start', name: '起始花苞', desc: '每一輪開始時先獲得一個隨機祝福。', max: 1, cost: [28] },
  { id: 'reroll', name: '幸運草盆', desc: '每一輪可以重擲祝福的次數 +1。', max: 2, cost: [14, 28] },
  { id: 'purse', name: '零錢罐', desc: '每一輪開始時多帶 30 金幣。', max: 2, cost: [12, 24] },
  { id: 'phoenix', name: '不死鳥花', desc: '每一輪可以復活一次（回復一半體力）。', max: 1, cost: [60] },
];
const WEAPON_COST = { scythe: 0, shears: 40, can: 55 };
const WEAPON_ORDER = ['scythe', 'shears', 'can'];

function create(ctx) {
  const { screen: g, input, sound, music, touch, P } = ctx;
  const S = buildSprites();
  const save = new SaveData('stardust/greenhouse-witch/save', {
    v: 1, seeds: 0, up: { hp: 0, roll: 0, start: 0, reroll: 0, purse: 0, phoenix: 0 }, weapons: ['scythe'], weapon: 'scythe',
    runs: 0, wins: 0, bestFloor: 0, bestRoom: 0, kills: 0, seenIntro: false,
  });
  const D = () => save.data;
  let run = null;
  const env = {
    g, input, sound, P, S,
    get run() { return run; },
    playing: () => scene === 'run' && !overlay && !dialog.open,
    wrap: (s, w) => wrapLabel(s, w),
    hooks: {
      onDoor(opt) { go(() => nextRoom(opt)); },
      onBoon(kind) { openBoonChoice(kind); },
      onBossStart() { music.play(SONGS.boss); },
      onBossDefeated() { music.play(SONGS.victory); },
      onDeath() { go(() => finishRun(false)); },
    },
  };
  const world = createWorld(env);
  const trans = new Transition();
  const dialog = new Dialog(THEME, sound);
  let scene = 'title', overlay = null, time = 0, summary = null;
  const hutBack = buildHutBack();
  const titleBack = buildTitleBack();

  function go(fn) { trans.start(() => { overlay = null; fn(); }); }
  /** 精靈圖整數倍放大（左上角對齊） */
  function big(spr, x, y, k, color = null) { g.ctx.drawImage(color == null ? spr.canvas : spr.silhouette(color, false), Math.round(x), Math.round(y), spr.w * k, spr.h * k); }
  const owns = w => P.unlockAll || D().weapons.includes(w);
  const upLv = id => P.unlockAll ? UPGRADES.find(u => u.id === id).max : D().up[id];

  // ---------------- 一輪的流程 ----------------
  function startRun() {
    const up = id => upLv(id);
    const weapon = owns(D().weapon) ? D().weapon : 'scythe';
    run = {
      floor: 0, room: 0, hp: 5 + up('hp'), maxHp: 5 + up('hp'), coins: up('purse') * 30, seeds: 0, kills: 0, boons: {}, weapon,
      rerolls: up('reroll'), revive: up('phoenix') > 0, rollMax: 1 + up('roll'), shield: 0, usedShop: false, usedFountain: false, roomsCleared: 0, coinsTotal: 0, time: 0,
    };
    if (up('start')) { const id = BOON_LIST[Math.floor(Math.random() * BOON_LIST.length)]; applyBoon(id, 1); }
    D().runs++; save.save();
    scene = 'run';
    world.enterRoom({ floor: 0, room: 0, type: 'battle', reward: 'boon' });
    music.play(SONGS[FLOORS[0].song]);
    touch.setVisible(true);
  }
  function nextRoom(opt) {
    if (opt.type === 'stairs') {
      if (run.floor >= FLOORS.length - 1) { finishRun(true); return; }
      run.floor++; run.room = 0; run.usedShop = false; run.usedFountain = false;
      world.enterRoom({ floor: run.floor, room: 0, type: 'battle', reward: 'boon' });
      music.play(SONGS[FLOORS[run.floor].song]);
      return;
    }
    run.room++;
    world.enterRoom({ floor: run.floor, room: run.room, type: opt.type, reward: opt.reward });
    music.play(opt.type === 'shop' ? SONGS.shop : opt.type === 'boss' ? null : SONGS[FLOORS[run.floor].song]);
    if (opt.type === 'boss') music.stop(0.5);
  }
  function finishRun(win) {
    const bonus = win ? 40 : 0;
    const earned = run.seeds + bonus;
    const d = D();
    d.seeds += earned; d.kills += run.kills;
    if (win) d.wins++;
    const reached = run.floor * 10 + run.room;
    if (reached > d.bestFloor * 10 + d.bestRoom) { d.bestFloor = run.floor; d.bestRoom = run.room; }
    save.save();
    summary = { win, earned, bonus, run: { ...run, boons: { ...run.boons } }, t: 0 };
    scene = 'summary'; overlay = null;
    touch.setVisible(false);
    music.play(win ? SONGS.victory : SONGS.gameover);
    if (win) dialog.show([
      { text: '最後一朵暴走的花也安靜了下來。溫室裡，只剩下葉子沙沙作響的聲音。' },
      { name: '茴香', text: '呼……修剪完畢！明天，大家一定會開出漂亮的花吧。', voice: 990 },
    ]);
  }
  function applyBoon(id, to) {
    const from = run.boons[id] || 0;
    run.boons[id] = to;
    if (id === 'lifeBloom') { const add = (to - from) * 2; run.maxHp += add; run.hp += add; }
  }

  // ---------------- 祝福三選一 ----------------
  function openBoonChoice(kind) {
    let choices;
    if (kind === 'upgrade') {
      const owned = Object.keys(run.boons).filter(id => run.boons[id] < MAX_LV).sort(() => Math.random() - 0.5).slice(0, 3);
      choices = owned.map(id => ({ id, from: run.boons[id], to: run.boons[id] + 1 }));
    } else choices = boonChoices(run.boons, kind === 'rare');
    if (!choices.length) { run.coins += 50; sound.ui('coin'); return; }
    let sel = 0;
    touch.setVisible(false);
    sound.ui('open');
    const rects = [];
    const close = () => { overlay = null; touch.setVisible(true); input.eat(); };
    overlay = {
      t: 0,
      update(dt) {
        this.t += dt;
        if (this.t < 0.3) return;
        const n = choices.length + (run.rerolls > 0 && kind !== 'upgrade' ? 1 : 0);
        if (input.repeat('right')) { sel = Math.min(choices.length - 1, sel + 1); sound.ui('move'); }
        if (input.repeat('left')) { sel = Math.max(0, sel - 1); sound.ui('move'); }
        if (input.repeat('down') && n > choices.length) { sel = choices.length; sound.ui('move'); }
        if (input.repeat('up') && sel === choices.length) { sel = 0; sound.ui('move'); }
        let pickIdx = -1;
        for (const t of input.taps) { const k = rects.findIndex(r => t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h); if (k >= 0) { sel = k; pickIdx = k; } }
        if (input.pressed('confirm')) pickIdx = sel;
        if (pickIdx < 0) return;
        if (pickIdx === choices.length) { // 重擲
          run.rerolls--; choices = boonChoices(run.boons, kind === 'rare'); sel = 0; sound.ui('confirm'); this.t = 0.1; return;
        }
        const c = choices[pickIdx];
        applyBoon(c.id, c.to);
        sound.ui('confirm');
        sound.bell({ f: 1319, dur: 0.8, vol: 0.1 });
        close();
      },
      draw() {
        g.screenSpace();
        g.ditherFast(0, 0, W, H, C.ink, 10);
        g.label(kind === 'rare' ? '選擇一個稀有祝福' : kind === 'upgrade' ? '選擇要升級的祝福' : '選擇一個祝福', W / 2, 6, kind === 'rare' ? C.pink : C.lime, { align: 'center', outline: C.ink });
        const cw = 98, gap = 6, x0 = (W - (choices.length * cw + (choices.length - 1) * gap)) / 2;
        rects.length = 0;
        choices.forEach((c, i) => {
          const x = Math.round(x0 + i * (cw + gap)), y = 24, h = 124, on = i === sel;
          rects.push({ x, y, w: cw, h });
          drawWindow(g, x, y + (on ? -3 : 0), cw, h, THEME, { border: on ? (kind === 'rare' ? C.pink : C.lime) : C.leaf });
          const yy = y + (on ? -3 : 0);
          big(S.boons[c.id], x + cw / 2 - 12, yy + 6, 2);
          g.label(BOONS[c.id].name, x + cw / 2, yy + 30, C.white, { align: 'center' });
          g.text(c.from ? `LV ${c.from} > ${c.to}` : `NEW LV ${c.to}`, x + cw / 2, yy + 45, c.from ? C.teal : C.lime, { small: true, align: 'center' });
          drawParagraph(g, BOONS[c.id].desc(c.to), x + 7, yy + 54, cw - 14, C.cream);
        });
        if (run.rerolls > 0 && kind !== 'upgrade') {
          const on = sel === choices.length, bw = 110, bx = W / 2 - bw / 2, by = 154;
          rects[choices.length] = { x: bx, y: by, w: bw, h: 16 };
          g.rect(bx, by, bw, 16, C.ink); g.rect(bx + 1, by + 1, bw - 2, 14, on ? C.plum : C.shadow);
          if (on) drawCursor(g, bx + 4, by + 5, C.lime, time);
          g.label(`重擲（剩 ${run.rerolls} 次）`, W / 2, by + 1, C.white, { align: 'center' });
        } else g.label('← → 選擇　Z 決定', W / 2, 160, C.mauve, { align: 'center', outline: C.ink });
      },
    };
  }

  // ---------------- 其他覆蓋視窗 ----------------
  function openConfirm(text, yes) {
    const m = new Menu([{ id: 'no', label: '不要' }, { id: 'yes', label: '確定' }], { lineH: 16 });
    const prev = overlay;
    overlay = {
      update() { const r = m.update(input, sound); if (!r) return; input.eat(); overlay = prev && prev.keep ? prev : null; if (r.type === 'confirm' && r.item.id === 'yes') yes(); },
      draw() {
        if (prev && prev.draw && prev.keep) prev.draw();
        const lines = wrapLabel(text, 200), h = lines.length * 14 + 50;
        drawWindow(g, 50, 50, 220, h, THEME);
        lines.forEach((l, i) => g.label(l, 60, 58 + i * 14, C.white));
        m.draw(g, 100, 58 + lines.length * 14 + 6, 120, THEME, { time });
      },
    };
  }
  function openHelp(done) {
    const rows = [['方向鍵', '八方向移動'], ['Z', '攻擊（連按連段）'], ['Z 按住放開', '蓄力技（依武器不同）'], ['X／Space', '翻滾閃避（無敵）'], ['時機翻滾', '完美閃避：世界變慢'], ['Esc／P', '暫停選單'], ['商店', '走到商品前按 Z 購買'], ['門', '清完房間後走進門'], ['滑鼠', '左鍵攻擊、右鍵翻滾']];
    overlay = {
      update() { if (input.pressed('confirm') || input.pressed('cancel') || input.taps.length) { sound.ui('cancel'); input.eat(); overlay = null; if (done) done(); } },
      draw() {
        drawWindow(g, 16, 10, W - 32, H - 20, THEME, { title: '操作說明' });
        rows.forEach(([k, v], i) => { g.label(k, 30, 18 + i * 14, C.lime); g.label(v, 118, 18 + i * 14, C.white); });
        g.label('觸控：左半邊拖曳移動，右下按鈕操作，右上 Ⅱ 暫停', W / 2, H - 26, C.cream, { align: 'center' });
      },
    };
  }
  function openPause() {
    const m = new Menu([{ id: 'resume', label: '繼續' }, { id: 'boons', label: '目前的祝福' }, { id: 'help', label: '操作說明' }, { id: 'quit', label: '放棄這一輪' }], { lineH: 16 });
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
        else if (r.item.id === 'boons') openBoonList(() => openPause());
        else if (r.item.id === 'help') openHelp(() => openPause());
        else if (r.item.id === 'quit') openConfirm('放棄這一輪嗎？（收集到的種子會帶回小屋）', () => go(() => finishRun(false)));
      },
      draw() {
        g.screenSpace(); g.ditherFast(0, 0, W, H, C.ink, 9);
        drawWindow(g, 100, 34, 120, 82, THEME, { title: '暫停' });
        m.draw(g, 106, 46, 108, THEME, { time });
        g.label(`${run.floor + 1}F 第 ${run.room + 1} 間　武器：${WEAPONS[run.weapon].name}`, W / 2, 128, C.cream, { align: 'center', outline: C.ink });
        g.label(`擊倒 ${run.kills}　種子 ${run.seeds}　重擲 ${run.rerolls}${run.revive ? '　不死鳥花 1' : ''}`, W / 2, 144, C.mauve, { align: 'center', outline: C.ink });
      },
    };
  }
  function openBoonList(done) {
    const ids = Object.keys(run.boons);
    overlay = {
      update() { if (input.pressed('confirm') || input.pressed('cancel') || input.taps.length) { input.eat(); sound.ui('cancel'); overlay = null; if (done) done(); } },
      draw() {
        g.screenSpace(); g.ditherFast(0, 0, W, H, C.ink, 10);
        drawWindow(g, 10, 10, W - 20, H - 20, THEME, { title: '目前的祝福' });
        if (!ids.length) g.label('還沒有祝福。清完房間後撿起發光的花苞吧！', W / 2, 70, C.cream, { align: 'center' });
        ids.forEach((id, i) => {
          const col = i % 2, row = Math.floor(i / 2), x = 18 + col * 146, y = 20 + row * 24;
          g.spr(S.boons[id], x, y + 2);
          g.label(`${BOONS[id].name} Lv${run.boons[id]}`, x + 16, y, C.lime);
          const d = wrapLabel(BOONS[id].desc(run.boons[id]), 124)[0];
          g.label(d, x + 16, y + 11, C.cream, { size: 12 });
        });
      },
    };
  }

  // ---------------- 標題 ----------------
  let titleMenu = null;
  function buildTitleMenu() {
    const items = [{ id: 'start', label: D().runs ? '前往溫室小屋' : '開始' }, { id: 'help', label: '操作說明' }];
    if (D().runs) items.push({ id: 'erase', label: '刪除存檔' });
    return new Menu(items, { lineH: 16, cancel: false });
  }
  function enterTitle() { scene = 'title'; music.play(SONGS.title); touch.setVisible(false); titleMenu = buildTitleMenu(); }
  function updateTitle() {
    const r = titleMenu.update(input, sound);
    if (!r || r.type !== 'confirm') return;
    input.eat();
    if (r.item.id === 'start') go(enterHut);
    else if (r.item.id === 'help') openHelp();
    else if (r.item.id === 'erase') openConfirm('確定要刪除存檔嗎？（種子、強化、武器都會消失）', () => { save.reset(); titleMenu = buildTitleMenu(); });
  }
  function buildTitleBack() {
    return makeLayer(W, H, PALETTE, p => {
      // 溫室外觀：玻璃拱頂與植物
      for (let y = 0; y < H; y++) { p.rect(0, y, W, 1, y < 90 ? C.peach : C.terra); if (y < 90) p.dither(0, y, W, 1, C.skin, Math.round((1 - y / 90) * 10)); }
      p.circle(250, 50, 16, C.white); p.circle(250, 50, 13, C.skin);
      const cx = 160, base = 150;
      for (let a = 0; a <= 180; a += 2) { const r = a * Math.PI / 180; p.px(cx + Math.cos(r) * 110, base - 20 - Math.sin(r) * 90, C.ink); }
      for (let x = cx - 110; x <= cx + 110; x += 22) p.line(x, base - 20, cx + (x - cx) * 0.2, base - 20 - Math.sqrt(Math.max(0, 110 * 110 - (x - cx) ** 2)) * 0.82, C.ink);
      p.rect(cx - 112, base - 22, 224, 4, C.ink);
      for (let y = base - 110; y < base - 22; y++) for (let x = cx - 108; x < cx + 108; x++) {
        const dx = (x - cx) / 108, dy = (base - 20 - y) / 90;
        if (dx * dx + dy * dy < 1 && ((x + y) & 3) === 0) p.px(x, y, C.teal);
      }
      for (let k = 0; k < 40; k++) { const x = cx - 100 + (k * 37) % 200, y = base - 30 - (k * 13) % 50; p.circle(x, y, 5 + (k % 3), k % 2 ? C.leaf : C.dleaf); if (k % 4 === 0) { p.rect(x - 1, y - 6, 3, 3, C.pink); } }
      p.rect(0, base - 18, W, H, C.soil); p.rect(0, base - 18, W, 2, C.terra);
      for (let x = 0; x < W; x += 3) if ((x * 7) % 5 < 2) p.px(x, base - 19, C.leaf);
    });
  }
  function renderTitle() {
    g.screenSpace();
    g.ctx.drawImage(titleBack, 0, 0);
    g.label('溫室魔女的剪定日', W / 2, 10, C.white, { align: 'center', scale: 2, outline: C.ink, shadow: C.leaf });
    g.text('PRUNE AND BLOOM', W / 2, 44, C.lime, { align: 'center', outline: C.ink });
    g.spr(S.fennel.down, 64, 116, {});
    const mw = 112, mh = titleMenu.items.length * 16 + 10, mx = 188, my = 102;
    drawWindow(g, mx, my, mw, mh, THEME);
    titleMenu.draw(g, mx + 4, my + 6, mw - 8, THEME, { time });
    g.text('STARDUST ARCADE', 6, H - 9, C.cream, { small: true });
  }

  // ---------------- 溫室小屋 ----------------
  let hutMenu = null;
  function enterHut() {
    scene = 'hut'; music.play(SONGS.hut); touch.setVisible(false);
    hutMenu = new Menu([
      { id: 'go', label: '出發修剪' }, { id: 'garden', label: '種子苗圃（強化）' }, { id: 'weapon', label: '武器架' },
      { id: 'record', label: '紀錄' }, { id: 'help', label: '操作說明' }, { id: 'title', label: '回到標題' },
    ], { lineH: 15, cancel: false });
    if (!D().seenIntro) {
      D().seenIntro = true; save.save();
      dialog.show([
        { name: '茴香', text: '這裡是我的溫室小屋。溫室裡的植物全都暴走了……', voice: 990 },
        { name: '茴香', text: '一間一間修剪回去吧！清完房間可以選下一扇門，門上的牌子寫著獎勵。', voice: 990 },
        { name: '茴香', text: '就算倒下也沒關係，撿到的種子帶回來，就能在苗圃種出永久強化喔。', voice: 990 },
      ]);
    }
  }
  function updateHut() {
    const r = hutMenu.update(input, sound);
    if (!r || r.type !== 'confirm') return;
    input.eat();
    switch (r.item.id) {
      case 'go': go(startRun); break;
      case 'garden': openGarden(); break;
      case 'weapon': openWeapons(); break;
      case 'record': openRecord(); break;
      case 'help': openHelp(); break;
      case 'title': go(enterTitle); break;
    }
  }
  function buildHutBack() {
    return makeLayer(W, H, PALETTE, p => {
      p.rect(0, 0, W, H, C.soil);
      for (let y = 0; y < 110; y += 8) { p.rect(0, y, W, 1, C.shadow); for (let x = (y / 8 % 2) * 24; x < W; x += 48) p.rect(x, y, 1, 8, C.shadow); }
      // 窗戶
      p.rect(40, 16, 90, 56, C.ink); p.rect(42, 18, 86, 52, C.peach); p.dither(42, 18, 86, 52, C.skin, 6);
      p.circle(100, 50, 10, C.white); p.rect(84, 18, 2, 52, C.ink); p.rect(42, 43, 86, 2, C.ink);
      for (let k = 0; k < 6; k++) p.circle(48 + k * 15, 66, 5, k % 2 ? C.leaf : C.dleaf);
      // 層架與盆栽
      p.rect(150, 30, 60, 3, C.terra); p.rect(150, 60, 60, 3, C.terra);
      for (let k = 0; k < 4; k++) { const x = 156 + k * 14; p.rect(x, 22, 8, 8, C.terra); p.circle(x + 4, 20, 4, C.leaf); p.rect(x, 52, 8, 8, C.terra); p.circle(x + 4, 50, 4, k % 2 ? C.lleaf : C.dleaf); if (k % 2) p.rect(x + 3, 45, 3, 3, C.pink); }
      // 地板
      p.rect(0, 110, W, H - 110, C.terra);
      for (let y = 110; y < H; y += 10) { p.rect(0, y, W, 1, C.soil); for (let x = (y / 10 % 2) * 20; x < W; x += 40) p.rect(x, y, 1, 10, C.soil); }
      p.rect(0, 108, W, 3, C.ink);
      // 桌子與地毯
      p.ellipse(90, 150, 60, 14, C.plum); p.ellipse(90, 150, 54, 11, C.mauve);
      p.rect(50, 118, 80, 6, C.soil); p.rect(50, 118, 80, 2, C.peach); p.rect(56, 124, 4, 14, C.soil); p.rect(120, 124, 4, 14, C.soil);
      p.rect(62, 110, 10, 8, C.teal); p.rect(100, 112, 12, 6, C.cream);
    });
  }
  function renderHut() {
    g.screenSpace();
    g.ctx.drawImage(hutBack, 0, 0);
    g.spr(S.fennel.down, 82, 128 + (Math.floor(time * 1.5) % 2));
    g.spr(S.weapons[owns(D().weapon) ? D().weapon : 'scythe'], 100, 136);
    drawWindow(g, 206, 24, 108, hutMenu.items.length * 15 + 10, THEME, { title: '溫室小屋' });
    hutMenu.draw(g, 210, 30, 100, THEME, { time });
    g.rect(0, 0, W, 16, C.ink);
    g.spr(S.seed, 6, 4); g.text(String(D().seeds), 16, 5, C.lime);
    g.label(`武器：${WEAPONS[owns(D().weapon) ? D().weapon : 'scythe'].name}`, 60, 1, C.cream);
    g.label(`挑戰 ${D().runs}　通關 ${D().wins}`, W - 6, 1, C.mauve, { align: 'right' });
  }
  function openGarden() {
    const build = () => UPGRADES.map(u => { const lv = D().up[u.id]; return { id: u.id, label: `${u.name}`, right: lv >= u.max ? 'MAX' : `${u.cost[lv]} 種子`, rightColor: lv >= u.max ? C.mauve : D().seeds >= u.cost[lv] ? C.lime : C.pink }; }).concat([{ id: 'back', label: '返回' }]);
    const m = new Menu(build(), { lineH: 14 });
    let note = '';
    overlay = {
      update() {
        const r = m.update(input, sound);
        if (!r) return;
        input.eat();
        if (r.type === 'cancel' || (r.type === 'confirm' && r.item.id === 'back')) { overlay = null; return; }
        if (r.type !== 'confirm') return;
        const u = UPGRADES.find(x => x.id === r.item.id), lv = D().up[u.id];
        if (lv >= u.max) { note = '已經種到最大了。'; return; }
        if (D().seeds < u.cost[lv]) { sound.ui('buzz'); note = '種子不夠……出發修剪帶更多種子回來吧。'; return; }
        D().seeds -= u.cost[lv]; D().up[u.id]++; save.save(); sound.ui('coin');
        note = `種下了「${u.name}」！`;
        m.setItems(build());
      },
      draw() {
        drawWindow(g, 10, 10, W - 20, H - 20, THEME, { title: '種子苗圃' });
        m.draw(g, 16, 20, 150, THEME, { time });
        const u = UPGRADES.find(x => x.id === m.item.id);
        if (u) {
          const lv = D().up[u.id];
          g.label(u.name, 178, 20, C.lime);
          g.text(`LV ${lv}/${u.max}`, 178, 36, C.cream, { small: true });
          for (let i = 0; i < u.max; i++) g.rect(214 + i * 8, 36, 6, 5, i < lv ? C.lime : C.plum);
          drawParagraph(g, u.desc, 178, 48, 122, C.white);
        }
        g.spr(S.seed, 178, H - 32); g.text(String(D().seeds), 188, H - 31, C.lime);
        if (note) drawParagraph(g, note, 16, H - 42, 150, C.cream);
      },
    };
  }
  function openWeapons() {
    const build = () => WEAPON_ORDER.map(id => ({ id, label: WEAPONS[id].name, right: D().weapon === id ? '使用中' : owns(id) ? '' : `${WEAPON_COST[id]} 種子`, rightColor: D().weapon === id ? C.lime : D().seeds >= WEAPON_COST[id] ? C.cream : C.pink })).concat([{ id: 'back', label: '返回' }]);
    const m = new Menu(build(), { lineH: 16 });
    let note = '';
    overlay = {
      update() {
        const r = m.update(input, sound);
        if (!r) return;
        input.eat();
        if (r.type === 'cancel' || (r.type === 'confirm' && r.item.id === 'back')) { overlay = null; return; }
        if (r.type !== 'confirm') return;
        const id = r.item.id;
        if (!owns(id)) {
          if (D().seeds < WEAPON_COST[id]) { sound.ui('buzz'); note = '種子不夠。'; return; }
          D().seeds -= WEAPON_COST[id]; D().weapons.push(id); sound.ui('coin'); note = `解鎖了「${WEAPONS[id].name}」！`;
        }
        D().weapon = id; save.save();
        if (!note.startsWith('解鎖')) note = `裝備「${WEAPONS[id].name}」`;
        m.setItems(build());
      },
      draw() {
        drawWindow(g, 10, 10, W - 20, H - 20, THEME, { title: '武器架' });
        m.draw(g, 16, 22, 130, THEME, { time });
        const id = m.item.id;
        if (WEAPONS[id]) {
          big(S.weapons[id], 160, 22, 2, owns(id) ? null : C.plum);
          g.label(WEAPONS[id].name, 200, 30, C.lime);
          drawParagraph(g, WEAPONS[id].desc, 160, 60, 140, C.white);
        }
        if (note) g.label(note, 16, H - 30, C.cream);
      },
    };
  }
  function openRecord() {
    overlay = {
      update() { if (input.pressed('confirm') || input.pressed('cancel') || input.taps.length) { input.eat(); sound.ui('cancel'); overlay = null; } },
      draw() {
        drawWindow(g, 50, 24, 220, 118, THEME, { title: '紀錄' });
        const d = D();
        const rows = [['挑戰次數', d.runs], ['通關次數', d.wins], ['最遠到達', d.runs ? `${d.bestFloor + 1}F 第 ${d.bestRoom + 1} 間` : '—'], ['累計擊倒', d.kills], ['持有種子', d.seeds], ['武器', `${d.weapons.length}／3`]];
        rows.forEach(([k, v], i) => { g.label(k, 64, 34 + i * 16, C.cream); g.label(String(v), 256, 34 + i * 16, C.white, { align: 'right' }); });
      },
    };
  }

  // ---------------- 結算 ----------------
  function updateSummary(dt) {
    summary.t += dt;
    if (summary.t > 0.8 && (input.pressed('confirm') || input.taps.length)) { input.eat(); sound.ui('confirm'); go(enterHut); }
  }
  function renderSummary() {
    g.screenSpace();
    g.ctx.drawImage(hutBack, 0, 0);
    g.ditherFast(0, 0, W, H, C.ink, 8);
    const s = summary, r = s.run;
    g.label(s.win ? '溫室修剪完畢！' : '茴香累倒了……', W / 2, 8, s.win ? C.lime : C.pink, { align: 'center', scale: 2, outline: C.ink });
    drawWindow(g, 30, 42, 260, 106, THEME);
    const rows = [
      ['到達', s.win ? '全部三層' : `${r.floor + 1}F（${FLOORS[r.floor].name}）第 ${r.room + 1} 間`],
      ['清除房間', r.roomsCleared], ['擊倒', r.kills], ['撿到的金幣', r.coinsTotal],
      ['帶回的種子', s.bonus ? `${r.seeds} ＋ 通關獎勵 ${s.bonus}` : r.seeds],
    ];
    rows.forEach(([k, v], i) => { if (s.t > 0.2 + i * 0.1) { g.label(k, 44, 48 + i * 15, C.cream); g.label(String(v), 276, 48 + i * 15, C.white, { align: 'right' }); } });
    let bx = 44;
    for (const id of Object.keys(r.boons)) { g.spr(S.boons[id], bx, 128); bx += 14; }
    if (s.t > 0.8 && !dialog.open && Math.floor(time * 2) % 2) g.label('按 Z 回到溫室小屋', W / 2, 156, C.white, { align: 'center', outline: C.ink });
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
      case 'hut': updateHut(); break;
      case 'run':
        if (input.pressed('pause') && !world.dying) { input.eat(); openPause(); break; }
        run.time += dt;
        world.update(dt);
        break;
      case 'summary': updateSummary(dt); break;
    }
  }
  function render() {
    switch (scene) {
      case 'title': renderTitle(); break;
      case 'hut': renderHut(); break;
      case 'run': world.render(); break;
      case 'summary': renderSummary(); break;
    }
    g.screenSpace();
    if (overlay) overlay.draw();
    dialog.draw(g, W, H);
    trans.draw(g, C.ink);
  }
  function onBlur() { if (scene === 'run' && !overlay && !dialog.open) openPause(); }
  function stageCover() { run = { floor: 0, room: 0, hp: 5, maxHp: 5, coins: 0, seeds: 0, kills: 0, boons: {}, weapon: 'scythe', rerolls: 0, revive: false, rollMax: 1, shield: 0, roomsCleared: 0, coinsTotal: 0 }; scene = 'run'; overlay = null; world.stageCover(); }

  enterTitle();
  return {
    update, render, onBlur, stageCover, reset() {},
    debugLines: () => scene === 'run' ? world.debugLines() : [`SCENE ${scene.toUpperCase()}`],
    peek: () => ({ scene, overlay: !!overlay, dialog: dialog.open, run, ...(scene === 'run' ? world.peek() : {}) }),
    debug: {
      startRun: () => { D().seenIntro = true; startRun(); },
      clearRoom: () => world.debugClear(),
      goRoom: opt => nextRoom(opt),
      world, save,
      get scene() { return scene; }, get run() { return run; },
    },
  };
}

runPrototype({
  id: 'greenhouse-witch',
  title: '溫室魔女的剪定日',
  subtitle: '俯視角動作 Roguelite',
  width: W, height: H, palette: PALETTE, ui: { text: C.white, dark: C.ink },
  input: {
    left: { keys: ['ArrowLeft', 'KeyA'] }, right: { keys: ['ArrowRight', 'KeyD'] },
    up: { keys: ['ArrowUp', 'KeyW'] }, down: { keys: ['ArrowDown', 'KeyS'] },
    attack: { keys: ['KeyZ', 'KeyJ'], pad: [2] },
    roll: { keys: ['KeyX', 'KeyK', 'Space'], pad: [0, 1] },
    pause: { keys: ['Escape', 'KeyP', 'Enter'], pad: [9] },
    confirm: { keys: ['Enter', 'KeyZ', 'Space', 'KeyJ'], pad: [0] },
    cancel: { keys: ['Escape', 'KeyX', 'Backspace'], pad: [1] },
  },
  touch: [{ action: 'roll', label: '滾' }, { action: 'attack', label: '砍', big: true }],
  touchPause: 'pause',
  tuning: TUNING,
  intro: INTRO,
  debugItems: [
    { key: 'godMode', label: '無敵（測試用）', type: 'toggle', value: false },
    { key: 'unlockAll', label: '解鎖全部武器與強化（測試用）', type: 'toggle', value: false },
    { key: 'allBoons', label: '所有祝福 Lv3（測試用）', type: 'toggle', value: false },
  ],
  create,
});
