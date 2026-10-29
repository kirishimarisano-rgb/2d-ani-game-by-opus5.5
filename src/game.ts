import { chip } from './audio/audio';
import { getBg } from './art/backgrounds';
import { FACE, getSprite, SPR_H, SPR_W, type EyeFrame, type MouthFrame } from './art/characters';
import { drawFireworks, drawLanterns, drawRain, drawScenery, drawSeaSparkle, ditherPattern } from './art/effects';
import { PALETTE } from './art/palette';
import { VOICE } from './core/cast';
import { parse, type ScriptFile } from './core/parser';
import type { ChoiceOption, Program, Stmt } from './core/types';
import { VM, newState, visibleOptions, type Block } from './core/vm';
import { LINE_H, paginate, TEXT_W, TEXT_W_FACE } from './core/wrap';
import { SLOTS, store, type LogEntry, type SaveData, type Settings } from './storage';
import { drawBigText, drawText, drawTiny, tinyWidth } from './ui/font';
import { charWidth } from './core/wrap';

export const W = 320;
export const H = 180;

const POS_X: Record<string, number> = { left: 84, center: 160, right: 236 };
const NAME_COLOR: Record<string, number> = { xiaoman: 13, shao: 20, pei: 28, yan: 15 };
const TEXT_CPS = [16, 28, 45, 80, 100000];
const AUTO_WAIT = [3200, 2400, 1700, 1100, 600];
const ENDINGS = [
  { id: 'xiaoman', title: '第一班車', who: '小滿' },
  { id: 'shao', title: '錄音帶的 B 面', who: '韶' },
  { id: 'pei', title: '留白', who: '佩' },
  { id: 'normal', title: '夏天停靠', who: '—' },
];

type Overlay = null | 'save' | 'load' | 'log' | 'config' | 'gallery' | 'confirmTitle';

interface Button {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  act: () => void;
  tiny?: boolean;
  active?: boolean;
  disabled?: boolean;
}

interface SayView {
  stmt: Extract<Stmt, { t: 'say' }>;
  pages: string[][];
  page: number;
  shown: number; // 本頁已顯示的字數（小數）
  total: number;
  doneAt: number;
}

function loadScripts(): ScriptFile[] {
  const mods = import.meta.glob('../script/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  return Object.keys(mods)
    .sort()
    .map((k) => ({ name: k.split('/').pop()!, text: mods[k] }));
}

export class Game {
  ctx: CanvasRenderingContext2D;
  scene = document.createElement('canvas');
  sctx: CanvasRenderingContext2D;
  snap = document.createElement('canvas');
  tmp = document.createElement('canvas');
  prog: Program;
  vm: VM | null = null;

  mode: 'press' | 'title' | 'play' = 'press';
  overlay: Overlay = null;
  overlayFrom: 'title' | 'play' = 'play';
  block: Block | null = null;
  say: SayView | null = null;
  choices: { opt: ChoiceOption; index: number }[] = [];
  choiceHover = -1;
  waitUntil = 0;
  chapterText = '';
  chapterShownAt = 0;
  ending: { id: string; title: string } | null = null;

  settings: Settings;
  readSet: Set<string>;
  endings: string[];
  log: LogEntry[] = [];
  logScroll = 0;
  auto = false;
  skip = false;
  ctrlHeld = false;
  uiHidden = false;
  speaker: string | null = null;
  yanExpr = 'normal';

  transStart = 0;
  transDur = 0;
  transScene = false;
  shakeUntil = 0;
  flashStart = -1;
  toast = '';
  toastUntil = 0;

  mouse = { x: -1, y: -1 };
  buttons: Button[] = [];
  titleCursor = 0;
  now = 0;
  lastStep = 0;
  blink: Record<string, { next: number; start: number }> = {};
  thumbs = new Map<string, HTMLImageElement>();

  constructor(public canvas: HTMLCanvasElement) {
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    for (const c of [this.scene, this.snap, this.tmp]) {
      c.width = W;
      c.height = H;
    }
    this.sctx = this.scene.getContext('2d')!;
    this.prog = parse(loadScripts());
    if (this.prog.errors.length) console.error(this.prog.errors);
    this.settings = store.settings();
    this.readSet = store.read();
    this.endings = store.endings();
    this.applyVolume();
    this.bindInput();
    this.fit();
    window.addEventListener('resize', () => this.fit());
    (window as unknown as { __game: Game }).__game = this;
  }

  start() {
    const loop = (t: number) => {
      this.now = t;
      this.update();
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  fit() {
    const k = Math.max(1, Math.floor(Math.min(window.innerWidth / W, window.innerHeight / H)));
    this.canvas.style.width = W * k + 'px';
    this.canvas.style.height = H * k + 'px';
  }

  applyVolume() {
    chip.setVolumes(this.settings.bgm / 10, this.settings.se / 10);
  }

  // ================= 流程 =================

  newGame() {
    this.vm = new VM(this.prog, newState(this.prog.labels.start ?? 0));
    this.log = [];
    this.auto = this.skip = false;
    this.chapterText = '';
    this.mode = 'play';
    this.overlay = null;
    this.beginTransition(600);
    this.proceed();
  }

  toTitle() {
    this.mode = 'title';
    this.overlay = null;
    this.vm = null;
    this.block = null;
    this.say = null;
    this.ending = null;
    this.auto = this.skip = false;
    this.beginTransition(500);
    chip.play('title');
  }

  /** 讓 VM 往下跑到下一個阻塞點，並處理途中的場景指令 */
  proceed() {
    const vm = this.vm!;
    this.captureSnap();
    let visual = false;
    const block = vm.run((s) => {
      switch (s.t) {
        case 'bg':
        case 'show':
        case 'hide':
          visual = true;
          break;
        case 'music':
          chip.play(s.name === 'stop' ? null : s.name);
          break;
        case 'sfx':
          if (!this.skipping()) chip.sfx(s.name);
          break;
        case 'fx':
          if (s.name === 'shake') this.shakeUntil = this.now + 350;
          if (s.name === 'flash') this.flashStart = this.now;
          break;
      }
    });
    if (visual) this.beginTransition(this.skipping() ? 80 : 380, false);
    this.present(block);
  }

  present(block: Block | null) {
    this.block = block;
    // 選項出現時保留上一句台詞在對話框裡
    if (block?.t !== 'choice') this.say = null;
    else if (this.say) this.finishPage();
    this.choices = [];
    if (!block) {
      this.toTitle();
      return;
    }
    switch (block.t) {
      case 'say': {
        const face = block.who === 'yan';
        const pages = paginate(block.text, face ? TEXT_W_FACE : TEXT_W);
        this.say = { stmt: block, pages, page: 0, shown: 0, total: [...pages[0].join('')].length, doneAt: 0 };
        this.speaker = block.who;
        if (block.who === 'yan') this.yanExpr = block.expr ?? 'normal';
        else if (block.who && block.expr && this.vm!.st.scene.chars[block.who]) this.vm!.st.scene.chars[block.who].expr = block.expr;
        if (this.skipping()) this.finishPage();
        break;
      }
      case 'choice':
        this.choices = visibleOptions(this.vm!.st, block);
        this.choiceHover = -1;
        this.titleCursor = -1;
        this.skip = false;
        break;
      case 'wait':
        this.waitUntil = this.now + (this.skipping() ? 0 : block.ms);
        break;
      case 'chapter':
        this.chapterText = block.text;
        this.chapterShownAt = this.now;
        this.beginTransition(500);
        break;
      case 'ending':
        this.ending = { id: block.id, title: block.title };
        if (!this.endings.includes(block.id)) {
          this.endings.push(block.id);
          store.saveEndings(this.endings);
        }
        this.auto = this.skip = false;
        this.beginTransition(1200);
        chip.play(null);
        break;
    }
  }

  skipping() {
    if (!(this.skip || this.ctrlHeld)) return false;
    const b = this.block;
    if (b && b.t === 'say') return this.settings.skipAll || this.readSet.has(this.key(b));
    return true;
  }

  key(s: { src: { file: string; line: number } }) {
    return `${s.src.file}:${s.src.line}`;
  }

  finishPage() {
    if (this.say) {
      this.say.shown = this.say.total;
      this.say.doneAt = this.now;
    }
  }

  /** 點擊或按鍵：推進劇情 */
  advance() {
    const b = this.block;
    if (!b || !this.vm) return;
    if (b.t === 'say' && this.say) {
      const sv = this.say;
      if (sv.shown < sv.total) {
        this.finishPage();
        return;
      }
      if (sv.page + 1 < sv.pages.length) {
        sv.page++;
        sv.shown = 0;
        sv.total = [...sv.pages[sv.page].join('')].length;
        if (this.skipping()) this.finishPage();
        return;
      }
      this.readSet.add(this.key(b));
      this.pushLog({ name: b.name, who: b.who, text: b.text });
      if (this.log.length % 10 === 0) store.saveRead(this.readSet);
      this.vm.advance();
      this.proceed();
      return;
    }
    if (b.t === 'chapter') {
      if (this.now - this.chapterShownAt < 400) return;
      this.chapterText = '';
      this.vm.advance();
      this.proceed();
      return;
    }
    if (b.t === 'ending') {
      if (this.now - this.transStart < 1500) return;
      store.saveRead(this.readSet);
      this.toTitle();
      return;
    }
  }

  choose(i: number) {
    const c = this.choices[i];
    if (!c || !this.vm) return;
    chip.sfx('select');
    this.pushLog({ name: null, who: null, text: '→ ' + c.opt.text });
    this.vm.choose(c.index);
    this.proceed();
  }

  pushLog(e: LogEntry) {
    this.log.push(e);
    if (this.log.length > 300) this.log.shift();
  }

  /** 測試與截圖用：直接跳到某個標籤 */
  debugJump(label: string, vars: Record<string, number> = {}, flags: Record<string, boolean> = {}) {
    const st = newState(this.prog.labels[label]);
    st.vars = vars;
    st.flags = flags;
    // 依檔案順序重播前面的場景指令，讓畫面接近實際玩到這裡的樣子
    for (let i = 0; i < st.pc; i++) {
      const s = this.prog.stmts[i];
      if (s.t === 'bg') st.scene = { ...st.scene, bg: s.name, time: s.time, fx: s.fx, chars: {} };
      if (s.t === 'show') st.scene.chars[s.who] = { expr: s.expr, pos: s.pos ?? st.scene.chars[s.who]?.pos ?? 'center' };
      if (s.t === 'hide') {
        if (s.who === 'all') st.scene.chars = {};
        else delete st.scene.chars[s.who];
      }
      if (s.t === 'music') st.scene.music = s.name === 'stop' ? null : s.name;
    }
    this.vm = new VM(this.prog, st);
    this.mode = 'play';
    this.overlay = null;
    this.ending = null;
    this.chapterText = '';
    this.proceed();
  }

  // ================= 存讀檔 =================

  saveTo(i: number) {
    if (!this.vm || !this.block) return;
    const text = this.block.t === 'say' ? this.block.text : this.block.t === 'choice' ? '（選擇中）' : '';
    const thumb = document.createElement('canvas');
    thumb.width = 64;
    thumb.height = 36;
    const t = thumb.getContext('2d')!;
    t.imageSmoothingEnabled = false;
    t.drawImage(this.scene, 0, 0, 64, 36);
    const data: SaveData = {
      v: 1,
      state: JSON.parse(JSON.stringify(this.vm.st)),
      chapter: this.chapterTitle(),
      text,
      time: Date.now(),
      thumb: thumb.toDataURL(),
      log: this.log.slice(-60),
    };
    store.saveSlot(i, data);
    store.saveRead(this.readSet);
    this.showToast(`已存到第 ${i + 1} 欄`);
    chip.sfx('select');
  }

  loadFrom(i: number) {
    const d = store.slot(i);
    if (!d) return;
    chip.sfx('select');
    this.vm = new VM(this.prog, d.state);
    this.log = d.log ?? [];
    this.lastChapter = d.chapter;
    this.mode = 'play';
    this.overlay = null;
    this.ending = null;
    this.chapterText = '';
    this.auto = this.skip = false;
    chip.play(d.state.scene.music);
    this.beginTransition(500);
    this.present(this.vm.run());
  }

  lastChapter = '';
  chapterTitle() {
    for (let i = this.vm!.st.pc; i >= 0; i--) {
      const s = this.prog.stmts[i];
      if (s.t === 'chapter') return s.text;
    }
    return this.lastChapter || '序章';
  }

  showToast(s: string) {
    this.toast = s;
    this.toastUntil = this.now + 1500;
  }

  // ================= 每幀更新 =================

  update() {
    const b = this.block;
    if (this.mode !== 'play' || this.overlay || !b) return;
    if (b.t === 'say' && this.say) {
      const sv = this.say;
      if (sv.shown < sv.total) {
        const before = Math.floor(sv.shown);
        sv.shown = Math.min(sv.total, sv.shown + (TEXT_CPS[this.settings.textSpeed] * 16.7) / 1000);
        const after = Math.floor(sv.shown);
        if (after > before && after % 2 === 0) {
          const ch = [...sv.pages[sv.page].join('')][after - 1] ?? '';
          if (!/[\s，。、！？…—「」]/.test(ch)) chip.blip(VOICE[sv.stmt.who ?? (sv.stmt.name ? 'other' : 'narration')] ?? VOICE.other);
        }
        if (sv.shown >= sv.total) sv.doneAt = this.now;
      } else if (this.skipping()) {
        if (this.now - this.lastStep > 40) {
          this.lastStep = this.now;
          this.advance();
        }
      } else if (this.auto) {
        const wait = AUTO_WAIT[this.settings.autoSpeed] + sv.total * 25;
        if (this.now - sv.doneAt > wait) this.advance();
      }
    } else if (b.t === 'wait') {
      if (this.now >= this.waitUntil) {
        this.vm!.advance();
        this.proceed();
      }
    } else if (b.t === 'chapter') {
      if (this.now - this.chapterShownAt > (this.skipping() ? 300 : 2400)) this.advance();
    }
  }

  // ================= 繪圖 =================

  captureSnap() {
    this.renderScene(this.sctx);
    const s = this.snap.getContext('2d')!;
    s.clearRect(0, 0, W, H);
    s.drawImage(this.scene, 0, 0);
  }

  beginTransition(ms: number, capture = true) {
    if (capture) {
      // 從目前整個畫面（含 UI）溶接
      const s = this.snap.getContext('2d')!;
      s.clearRect(0, 0, W, H);
      s.drawImage(this.canvas, 0, 0);
    }
    this.transStart = this.now;
    this.transDur = ms;
    this.transScene = !capture;
  }

  /** 把快照用抖色圖樣蓋在目前畫面上，隨時間消失 */
  drawDissolve() {
    const p = this.transDur ? (this.now - this.transStart) / this.transDur : 1;
    if (p >= 1) return;
    const tc = this.tmp.getContext('2d')!;
    tc.globalCompositeOperation = 'source-over';
    tc.clearRect(0, 0, W, H);
    tc.drawImage(this.snap, 0, 0);
    tc.globalCompositeOperation = 'destination-in';
    tc.fillStyle = ditherPattern(tc, Math.floor(p * 17));
    tc.fillRect(0, 0, W, H);
    tc.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.tmp, 0, 0);
  }

  renderScene(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = PALETTE[0];
    ctx.fillRect(0, 0, W, H);
    const t = this.now;
    if (this.mode === 'title' || this.mode === 'press') {
      ctx.drawImage(getBg('station', 'dusk', []).base, 0, 0);
      return;
    }
    const st = this.vm?.st;
    if (!st || !st.scene.bg) return;
    const sc = st.scene;
    const art = getBg(sc.bg!, sc.time, sc.fx);
    let ox = 0;
    let oy = 0;
    if (t < this.shakeUntil) {
      ox = Math.round(Math.sin(t / 20) * 2);
      oy = Math.round(Math.cos(t / 27) * 1);
    }
    if (sc.bg === 'train' && Math.floor(t / 90) % 11 === 0) oy += 1;
    ctx.save();
    ctx.translate(ox, oy);
    drawScenery(ctx, art, t);
    ctx.drawImage(art.base, 0, 0);
    if (sc.bg === 'seawall') drawSeaSparkle(ctx, sc.time, t);
    if (sc.bg === 'temple') drawLanterns(ctx, t);
    if (sc.fx.includes('fireworks')) {
      // 倉庫裡只從拱窗看得到煙火
      ctx.save();
      if (sc.bg === 'warehouse') {
        ctx.beginPath();
        ctx.ellipse(160, 26, 50, 22, 0, Math.PI, 0);
        ctx.rect(110, 26, 100, 34);
        ctx.clip();
      }
      drawFireworks(ctx, t);
      ctx.restore();
    }
    // 立繪
    for (const [id, c] of Object.entries(sc.chars)) {
      const x = POS_X[c.pos] ?? 160;
      ctx.drawImage(getSprite(id, c.expr, this.eyeFrame(id), this.mouthFrame(id)), x - SPR_W / 2, H - SPR_H);
    }
    if (sc.fx.includes('rain')) drawRain(ctx, t);
    ctx.restore();
  }

  eyeFrame(id: string): EyeFrame {
    let b = this.blink[id];
    if (!b) b = this.blink[id] = { next: this.now + 1500 + Math.random() * 3000, start: 0 };
    if (this.now > b.next) {
      b.start = this.now;
      b.next = this.now + 2200 + Math.random() * 3500;
    }
    const dt = this.now - b.start;
    if (dt < 50) return 1;
    if (dt < 130) return 2;
    if (dt < 180) return 1;
    return 0;
  }

  mouthFrame(id: string): MouthFrame {
    const sv = this.say;
    if (!sv || sv.stmt.who !== id || sv.shown >= sv.total || this.overlay) return 0;
    return ([1, 2, 1, 0] as MouthFrame[])[Math.floor(this.now / 85) % 4];
  }

  render() {
    const ctx = this.ctx;
    this.buttons = [];
    this.renderScene(this.sctx);
    ctx.drawImage(this.scene, 0, 0);
    if (this.transScene) this.drawDissolve();

    if (this.mode === 'press') this.renderPress();
    else if (this.mode === 'title') this.renderTitle();
    else this.renderPlay();

    if (this.overlay) this.renderOverlay();

    if (!this.transScene) this.drawDissolve();
    if (this.flashStart >= 0) {
      const fp = (this.now - this.flashStart) / 400;
      if (fp >= 1) this.flashStart = -1;
      else {
        const tc = this.tmp.getContext('2d')!;
        tc.clearRect(0, 0, W, H);
        tc.fillStyle = PALETTE[6];
        tc.fillRect(0, 0, W, H);
        tc.globalCompositeOperation = 'destination-in';
        tc.fillStyle = ditherPattern(tc, Math.floor(fp * 17));
        tc.fillRect(0, 0, W, H);
        tc.globalCompositeOperation = 'source-over';
        ctx.drawImage(this.tmp, 0, 0);
      }
    }
    if (this.now < this.toastUntil) {
      const w = this.textW(this.toast) + 12;
      this.panel((W - w) / 2, 4, w, 16, 2, 5);
      drawText(ctx, this.toast, (W - w) / 2 + 6, 6, 6);
    }
    this.canvas.style.cursor = this.buttons.some((b) => this.hit(b)) || this.choiceHover >= 0 ? 'pointer' : 'default';
  }

  textW(s: string) {
    let w = 0;
    for (const ch of s) w += charWidth(ch);
    return w;
  }

  panel(x: number, y: number, w: number, h: number, fill: number, border: number) {
    const ctx = this.ctx;
    x = Math.round(x);
    y = Math.round(y);
    ctx.fillStyle = PALETTE[border];
    ctx.fillRect(x + 1, y, w - 2, h);
    ctx.fillRect(x, y + 1, w, h - 2);
    ctx.fillStyle = PALETTE[fill];
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  }

  hit(b: { x: number; y: number; w: number; h: number }) {
    return this.mouse.x >= b.x && this.mouse.x < b.x + b.w && this.mouse.y >= b.y && this.mouse.y < b.y + b.h;
  }

  button(b: Button) {
    this.buttons.push(b);
    const hover = this.hit(b) && !b.disabled;
    if (b.tiny) {
      drawTiny(this.ctx, b.label, b.x + 1, b.y + 1, b.disabled ? 3 : b.active ? 14 : hover ? 6 : 4);
      return;
    }
    this.panel(b.x, b.y, b.w, b.h, hover ? 30 : 1, b.active ? 14 : hover ? 5 : 3);
    const tw = this.textW(b.label);
    drawText(this.ctx, b.label, Math.round(b.x + (b.w - tw) / 2), b.y + Math.round((b.h - 12) / 2), b.disabled ? 3 : 6, 0);
  }

  // ---- 開頭：點擊開始 ----
  renderPress() {
    const ctx = this.ctx;
    this.dimBackground(8);
    drawBigText(ctx, '浪尾支線', 112, 46, 2, 6, 25);
    ctx.fillStyle = PALETTE[29];
    ctx.fillRect(0, 73, W, 9);
    drawTiny(ctx, 'LANGWEI LINE - LAST STOP SUMMER', 160 - tinyWidth('LANGWEI LINE - LAST STOP SUMMER') / 2, 75, 28);
    if (Math.floor(this.now / 600) % 2 === 0) drawText(ctx, '— 點一下畫面開始 —', 160 - this.textW('— 點一下畫面開始 —') / 2, 132, 6, 25);
  }

  // ---- 標題 ----
  dimBackground(level: number) {
    const tc = this.tmp.getContext('2d')!;
    tc.clearRect(0, 0, W, H);
    tc.fillStyle = PALETTE[29];
    tc.fillRect(0, 0, W, H);
    tc.globalCompositeOperation = 'destination-in';
    tc.fillStyle = ditherPattern(tc, level);
    tc.fillRect(0, 0, W, H);
    tc.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.tmp, 0, 0);
  }

  renderTitle() {
    const ctx = this.ctx;
    this.dimBackground(8);
    drawBigText(ctx, '浪尾支線', 112, 30, 2, 6, 25);
    ctx.fillStyle = PALETTE[29];
    ctx.fillRect(0, 57, W, 9);
    drawTiny(ctx, 'LANGWEI LINE - LAST STOP SUMMER', 160 - tinyWidth('LANGWEI LINE - LAST STOP SUMMER') / 2, 59, 28);
    const hasSave = [0, 1, 2].some((i) => store.slot(i));
    const items: [string, () => void, boolean?][] = [
      ['開始遊戲', () => this.newGame()],
      ['讀取進度', () => this.openOverlay('load'), !hasSave],
      ['設定', () => this.openOverlay('config')],
      ['結局回顧', () => this.openOverlay('gallery')],
    ];
    items.forEach(([label, act, disabled], i) => {
      this.button({ x: 116, y: 82 + i * 21, w: 88, h: 17, label, act, disabled, active: this.titleCursor === i });
    });
    drawTiny(ctx, 'V1.0  2026', 4, 172, 4);
    drawTiny(ctx, `${this.endings.length}/4`, 300, 172, 4);
  }

  // ---- 遊戲中 ----
  renderPlay() {
    const ctx = this.ctx;
    const b = this.block;
    if (b?.t === 'chapter') {
      ctx.fillStyle = PALETTE[0];
      ctx.fillRect(0, 0, W, H);
      const [a, rest] = b.text.split('　');
      drawText(ctx, a, 160 - this.textW(a) / 2, 74, 6, null);
      if (rest) drawText(ctx, rest, 160 - this.textW(rest) / 2, 94, 4, null);
      ctx.fillStyle = PALETTE[3];
      ctx.fillRect(120, 90, 80, 1);
      return;
    }
    if (b?.t === 'ending' && this.ending) {
      ctx.fillStyle = PALETTE[0];
      ctx.fillRect(0, 0, W, H);
      const t1 = '結局';
      const t2 = `「${this.ending.title}」`;
      drawText(ctx, t1, 160 - this.textW(t1) / 2, 66, 4, null);
      drawText(ctx, t2, 160 - this.textW(t2) / 2, 84, 6, null);
      drawTiny(ctx, 'END', 160 - tinyWidth('END') / 2, 108, 13);
      if (this.now - this.transStart > 1500 && Math.floor(this.now / 600) % 2 === 0) drawTiny(ctx, 'CLICK', 160 - tinyWidth('CLICK') / 2, 160, 3);
      return;
    }
    if (this.uiHidden) return;

    // 對話框
    this.panel(4, 122, 312, 54, 29, 5);
    ctx.fillStyle = PALETTE[2];
    ctx.fillRect(6, 124, 308, 1);
    const sv = this.say;
    if (sv) {
      const s = sv.stmt;
      if (s.name) {
        const nw = this.textW(s.name) + 12;
        this.panel(8, 108, nw, 15, 1, NAME_COLOR[s.who ?? ''] ?? 4);
        drawText(ctx, s.name, 14, 110, NAME_COLOR[s.who ?? ''] ?? 5, 0);
      }
      const face = s.who === 'yan';
      let x0 = 14;
      if (face) {
        x0 = 62;
        this.panel(8, 125, 50, 48, 2, 3);
        ctx.save();
        ctx.beginPath();
        ctx.rect(9, 126, 48, 46);
        ctx.clip();
        ctx.drawImage(getSprite('yan', this.yanExpr, this.eyeFrame('yan'), this.mouthFrame('yan')), FACE.x, FACE.y, FACE.w, FACE.h, 9, 126, FACE.w, FACE.h);
        ctx.restore();
      }
      const color = s.name ? 6 : 5;
      let left = Math.floor(sv.shown);
      sv.pages[sv.page].forEach((line, i) => {
        if (left <= 0) return;
        const chars = [...line];
        drawText(ctx, chars.slice(0, left).join(''), x0, 127 + i * LINE_H, color, 1);
        left -= chars.length;
      });
      if (sv.shown >= sv.total && Math.floor(this.now / 400) % 2 === 0) {
        ctx.fillStyle = PALETTE[sv.page + 1 < sv.pages.length ? 13 : 5];
        const by = 167 + (Math.floor(this.now / 200) % 2);
        ctx.fillRect(302, by, 5, 1);
        ctx.fillRect(303, by + 1, 3, 1);
        ctx.fillRect(304, by + 2, 1, 1);
      }
    }

    // 選項
    if (b?.t === 'choice') {
      const n = this.choices.length;
      const y0 = Math.round(60 - (n * 22) / 2);
      this.choiceHover = -1;
      this.choices.forEach((c, i) => {
        const box = { x: 40, y: y0 + i * 22, w: 240, h: 18 };
        const hover = this.hit(box) || this.titleCursor === i;
        if (this.hit(box)) this.choiceHover = i;
        this.panel(box.x, box.y, box.w, box.h, hover ? 30 : 1, hover ? 14 : 4);
        drawText(ctx, c.opt.text, 160 - this.textW(c.opt.text) / 2, box.y + 3, hover ? 14 : 6, 0);
      });
    }

    // 快捷列
    const items: [string, () => void, boolean?][] = [
      ['AUTO', () => { this.auto = !this.auto; this.skip = false; }, this.auto],
      ['SKIP', () => { this.skip = !this.skip; this.auto = false; }, this.skip],
      ['LOG', () => this.openOverlay('log')],
      ['SAVE', () => this.openOverlay('save')],
      ['LOAD', () => this.openOverlay('load')],
      ['CONF', () => this.openOverlay('config')],
      ['TITLE', () => this.openOverlay('confirmTitle')],
    ];
    const barW = items.reduce((w, [l]) => w + tinyWidth(l) + 7, 0) + 2;
    this.panel(316 - barW, 110, barW, 14, 29, 5);
    ctx.fillStyle = PALETTE[29];
    ctx.fillRect(317 - barW, 122, barW - 2, 2);
    let x = 312;
    for (let i = items.length - 1; i >= 0; i--) {
      const [label, act, active] = items[i];
      const w = tinyWidth(label) + 2;
      x -= w;
      this.button({ x, y: 114, w, h: 8, label, act, active, tiny: true });
      x -= 5;
    }
  }

  // ---- 疊加畫面 ----
  openOverlay(o: Overlay) {
    chip.sfx('cursor');
    this.overlayFrom = this.mode === 'title' ? 'title' : 'play';
    this.overlay = o;
    this.logScroll = 0;
    this.auto = false;
    this.skip = false;
  }

  closeOverlay() {
    chip.sfx('cancel');
    this.overlay = null;
  }

  renderOverlay() {
    const ctx = this.ctx;
    const o = this.overlay!;
    // 背景壓暗（抖色）
    const tc = this.tmp.getContext('2d')!;
    tc.clearRect(0, 0, W, H);
    tc.fillStyle = PALETTE[0];
    tc.fillRect(0, 0, W, H);
    tc.globalCompositeOperation = 'destination-in';
    tc.fillStyle = ditherPattern(tc, o === 'confirmTitle' ? 8 : 4);
    tc.fillRect(0, 0, W, H);
    tc.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.tmp, 0, 0);
    if (o !== 'confirmTitle') {
      ctx.fillStyle = PALETTE[0];
      for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
    }
    const back = () => this.closeOverlay();

    if (o === 'confirmTitle') {
      this.panel(70, 60, 180, 60, 29, 5);
      drawText(ctx, '回到標題畫面嗎？', 160 - this.textW('回到標題畫面嗎？') / 2, 70, 6);
      drawText(ctx, '沒存的進度會不見。', 160 - this.textW('沒存的進度會不見。') / 2, 84, 4);
      this.button({ x: 92, y: 100, w: 60, h: 15, label: '回去', act: () => this.toTitle() });
      this.button({ x: 168, y: 100, w: 60, h: 15, label: '取消', act: back });
      return;
    }

    const title = { save: '存檔', load: '讀檔', log: '回看', config: '設定', gallery: '結局回顧' }[o];
    drawText(ctx, title, 12, 6, 14);
    this.button({ x: 268, y: 4, w: 46, h: 16, label: '返回', act: back });

    if (o === 'save' || o === 'load') {
      for (let i = 0; i < SLOTS; i++) {
        const d = store.slot(i);
        const box = { x: 12, y: 26 + i * 50, w: 296, h: 46 };
        const hover = this.hit(box);
        const disabled = o === 'load' && !d;
        this.buttons.push({ ...box, label: '', disabled, act: () => (o === 'save' ? this.saveTo(i) : this.loadFrom(i)) });
        this.panel(box.x, box.y, box.w, box.h, hover && !disabled ? 30 : 1, hover && !disabled ? 14 : 3);
        drawTiny(ctx, `NO.${i + 1}`, box.x + 5, box.y + 4, 13);
        if (d) {
          let img = this.thumbs.get(d.thumb);
          if (!img) {
            img = new Image();
            img.src = d.thumb;
            this.thumbs.set(d.thumb, img);
          }
          if (img.complete) ctx.drawImage(img, box.x + 5, box.y + 10);
          const dt = new Date(d.time);
          const p2 = (n: number) => String(n).padStart(2, '0');
          drawTiny(ctx, `${dt.getFullYear()}/${p2(dt.getMonth() + 1)}/${p2(dt.getDate())} ${p2(dt.getHours())}:${p2(dt.getMinutes())}`, box.x + 76, box.y + 4, 4);
          drawText(ctx, d.chapter, box.x + 76, box.y + 12, 6);
          const ex = [...d.text].slice(0, 17).join('') + ([...d.text].length > 17 ? '…' : '');
          drawText(ctx, ex, box.x + 76, box.y + 29, 4, null);
        } else {
          drawText(ctx, '— 空 —', box.x + 120, box.y + 17, 3, null);
        }
      }
      return;
    }

    if (o === 'log') {
      const lines: { text: string; color: number; x: number }[] = [];
      for (const e of this.log) {
        if (e.name) lines.push({ text: e.name, color: NAME_COLOR[e.who ?? ''] ?? 5, x: 14 });
        for (const l of paginate(e.text, 284).flat()) lines.push({ text: l, color: e.name ? 6 : e.text.startsWith('→') ? 14 : 5, x: 20 });
        lines.push({ text: '', color: 0, x: 0 });
      }
      const per = 10;
      const maxScroll = Math.max(0, lines.length - per);
      this.logScroll = Math.max(0, Math.min(maxScroll, this.logScroll));
      const start = Math.max(0, lines.length - per - this.logScroll);
      lines.slice(start, start + per).forEach((l, i) => drawText(ctx, l.text, l.x, 26 + i * 15, l.color, 0));
      if (maxScroll) {
        ctx.fillStyle = PALETTE[2];
        ctx.fillRect(312, 26, 2, 148);
        const h = Math.max(8, (148 * per) / lines.length);
        const y = 26 + (148 - h) * (1 - this.logScroll / maxScroll);
        ctx.fillStyle = PALETTE[5];
        ctx.fillRect(312, Math.round(y), 2, Math.round(h));
      }
      return;
    }

    if (o === 'config') {
      const s = this.settings;
      const row = (y: number, label: string, n: number, val: number, set: (v: number) => void, labels?: string[]) => {
        drawText(ctx, label, 24, y + 2, 6);
        for (let i = 0; i < n; i++) {
          const bw = labels ? 44 : 12;
          const b: Button = { x: 120 + i * (bw + 3), y, w: bw, h: 15, label: labels?.[i] ?? '', act: () => { set(i); this.saveSettings(); chip.sfx('cursor'); } };
          this.buttons.push(b);
          const on = labels ? i === val : i <= val;
          this.panel(b.x, b.y, b.w, b.h, on ? 13 : 1, this.hit(b) ? 6 : 3);
          if (labels) drawText(ctx, labels[i], b.x + (bw - this.textW(labels[i])) / 2, y + 2, on ? 0 : 5, null);
        }
      };
      row(30, '文字速度', 5, s.textSpeed, (v) => (s.textSpeed = v));
      row(52, '自動速度', 5, s.autoSpeed, (v) => (s.autoSpeed = v));
      row(74, '音樂音量', 11, s.bgm, (v) => { s.bgm = v; this.applyVolume(); });
      row(96, '音效音量', 11, s.se, (v) => { s.se = v; this.applyVolume(); });
      row(118, '快進', 2, s.skipAll ? 1 : 0, (v) => (s.skipAll = v === 1), ['已讀', '全部']);
      row(140, '全螢幕', 2, document.fullscreenElement ? 1 : 0, (v) => this.setFullscreen(v === 1), ['關', '開']);
      drawTiny(ctx, 'SPACE/ENTER: NEXT  CTRL: SKIP  A: AUTO  L: LOG  H: HIDE  ESC: BACK', 12, 170, 3);
      return;
    }

    if (o === 'gallery') {
      ENDINGS.forEach((e, i) => {
        const got = this.endings.includes(e.id);
        this.panel(40, 30 + i * 34, 240, 28, 1, got ? 13 : 3);
        drawTiny(ctx, `END ${i + 1}`, 48, 36 + i * 34, got ? 13 : 3);
        drawText(ctx, got ? `「${e.title}」` : '？？？', 48, 43 + i * 34, got ? 6 : 3, null);
        drawText(ctx, got ? e.who : '', 268 - this.textW(e.who), 43 + i * 34, 4, null);
      });
    }
  }

  saveSettings() {
    store.saveSettings(this.settings);
  }

  setFullscreen(on: boolean) {
    try {
      if (on && !document.fullscreenElement) document.documentElement.requestFullscreen();
      if (!on && document.fullscreenElement) document.exitFullscreen();
    } catch {
      /* 不支援 */
    }
  }

  // ================= 輸入 =================

  bindInput() {
    const c = this.canvas;
    const toLocal = (e: PointerEvent | WheelEvent | MouseEvent) => {
      const r = c.getBoundingClientRect();
      this.mouse.x = Math.floor(((e.clientX - r.left) / r.width) * W);
      this.mouse.y = Math.floor(((e.clientY - r.top) / r.height) * H);
    };
    c.addEventListener('pointermove', (e) => {
      toLocal(e);
      this.titleCursor = -1;
    });
    c.addEventListener('pointerdown', (e) => {
      toLocal(e);
      chip.unlock();
      if (e.button === 2) {
        this.back();
        return;
      }
      this.click();
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (this.overlay === 'log') this.logScroll += e.deltaY < 0 ? 2 : -2;
        else if (this.mode === 'play' && !this.overlay && e.deltaY < 0 && this.log.length) this.openOverlay('log');
        else if (this.mode === 'play' && !this.overlay && e.deltaY > 0 && this.block?.t !== 'choice') this.advance();
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => {
      chip.unlock();
      if (e.key === 'Control') this.ctrlHeld = true;
      this.key_(e);
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Control') this.ctrlHeld = false;
    });
    window.addEventListener('blur', () => (this.ctrlHeld = false));
  }

  click() {
    if (this.mode === 'press') {
      this.mode = 'title';
      this.beginTransition(400);
      chip.play('title');
      return;
    }
    const btn = [...this.buttons].reverse().find((b) => this.hit(b));
    if (btn) {
      if (!btn.disabled) btn.act();
      return;
    }
    if (this.overlay) {
      if (this.overlay === 'log') this.closeOverlay();
      return;
    }
    if (this.mode !== 'play') return;
    if (this.uiHidden) {
      this.uiHidden = false;
      return;
    }
    if (this.block?.t === 'choice') {
      if (this.choiceHover >= 0) this.choose(this.choiceHover);
      return;
    }
    this.skip = false;
    this.advance();
  }

  back() {
    if (this.overlay) this.closeOverlay();
    else if (this.mode === 'play') this.uiHidden = !this.uiHidden;
  }

  key_(e: KeyboardEvent) {
    const k = e.key;
    if (this.mode === 'press') {
      if (k === 'Enter' || k === ' ' || k === 'z') this.click();
      return;
    }
    if (k === 'Escape') {
      this.back();
      return;
    }
    if (this.overlay) {
      if (this.overlay === 'log') {
        if (k === 'ArrowUp') this.logScroll++;
        if (k === 'ArrowDown') this.logScroll--;
        if (k === 'l' || k === 'L') this.closeOverlay();
      }
      return;
    }
    if (this.mode === 'title') {
      if (k === 'ArrowDown') this.titleCursor = (this.titleCursor + 1 + 4) % 4;
      if (k === 'ArrowUp') this.titleCursor = (this.titleCursor - 1 + 4) % 4;
      if ((k === 'Enter' || k === ' ' || k === 'z') && this.titleCursor >= 0) {
        const b = this.buttons[this.titleCursor];
        if (b && !b.disabled) b.act();
      }
      return;
    }
    if (this.block?.t === 'choice') {
      const n = this.choices.length;
      if (k === 'ArrowDown') this.titleCursor = (Math.max(-1, this.titleCursor) + 1) % n;
      if (k === 'ArrowUp') this.titleCursor = (this.titleCursor - 1 + n) % n;
      if (/^[1-9]$/.test(k) && Number(k) <= n) this.choose(Number(k) - 1);
      if ((k === 'Enter' || k === ' ' || k === 'z') && this.titleCursor >= 0 && this.titleCursor < n) this.choose(this.titleCursor);
      return;
    }
    if (k === 'Enter' || k === ' ' || k === 'z') {
      e.preventDefault();
      if (this.uiHidden) this.uiHidden = false;
      else this.advance();
    }
    if (k === 'a' || k === 'A') this.auto = !this.auto;
    if (k === 's' || k === 'S') this.skip = !this.skip;
    if (k === 'l' || k === 'L') this.openOverlay('log');
    if (k === 'h' || k === 'H') this.uiHidden = !this.uiHidden;
  }
}
