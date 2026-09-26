// 原型外殼：頁面版面、固定 60Hz 更新迴圈、除錯功能、調參面板、測試介面。
import { Screen } from './pixel.js';
import { Input, TouchControls } from './input.js';
import { Tuner } from './tuner.js';
import { Sound } from './audio.js';

export const STEP = 1 / 60;

const DEBUG_GROUP = {
  id: 'debug', name: '除錯與檢視', open: false,
  items: [
    { key: 'timeScale', label: '遊戲速度', min: 0.05, max: 1.5, step: 0.05, value: 1, unit: '×', hint: '放慢到 0.1～0.3 倍，可以看清楚每一格動畫、打擊停頓與擊退軌跡。' },
    { key: 'showHitbox', label: '顯示判定框（H）', type: 'toggle', value: false, hint: '綠：身體　紅：攻擊判定　黃：無敵中' },
    { key: 'showInfo', label: '顯示即時數值', type: 'toggle', value: false, hint: '在畫面左上角顯示速度、狀態等數值。' },
    { key: 'volume', label: '音量', min: 0, max: 1, step: 0.05, value: 0.6 },
  ],
};

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function isTyping(t) { return t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && !['range', 'checkbox', 'button'].includes(t.type))); }

/**
 * 啟動一個原型。def：
 *   id, title, subtitle, width, height, palette（≤16 色）, ui: { text, dark }（HUD 用的調色盤索引）
 *   input: 動作對應, touch: 觸控按鈕, tuning: { groups, presets }, intro: 面板說明
 *   create(ctx) → { update(dt), render(), reset(), debugLines?(), stageCover?() }
 */
export function runPrototype(def) {
  document.title = `${def.title}｜原型試玩 ☆ 星屑遊樂場`;

  // ---------- 版面 ----------
  const app = el('div', 'pa-app');
  const top = el('header', 'pa-top');
  const slot = el('div', 'pa-slot');
  const titleBox = el('div', 'pa-titlebox');
  titleBox.append(el('h1', null, def.title), el('span', 'pa-sub', def.subtitle));
  const soundBtn = el('button', 'pa-tbar', '');
  soundBtn.type = 'button';
  const panelBtn = el('button', 'pa-tbar pa-tbar-panel', '調參面板');
  panelBtn.type = 'button';
  top.append(slot, titleBox, el('div', 'pa-spacer'), soundBtn, panelBtn);
  const main = el('div', 'pa-main');
  const stage = el('div', 'pa-stage');
  const pausedTag = el('div', 'pa-paused', '⏸ 暫停中　P 繼續／N 逐格');
  pausedTag.hidden = true;
  stage.append(pausedTag);
  const panel = el('aside', 'pa-panel');
  panel.setAttribute('aria-label', '調參面板');
  main.append(stage, panel);
  app.append(top, main);
  document.body.prepend(app);
  if (window.PixelArcade) {
    const b = window.PixelArcade.backButton;
    b.classList.remove('pa-fixed');
    slot.append(b);
  }

  // 窄螢幕預設收起面板（覆蓋在畫面上）
  const narrow = matchMedia('(max-width: 860px)');
  const setPanel = open => { app.classList.toggle('panel-hidden', !open); panelBtn.classList.toggle('on', open); };
  setPanel(!narrow.matches);
  panelBtn.addEventListener('click', () => { setPanel(app.classList.contains('panel-hidden')); panelBtn.blur(); });

  // ---------- 系統 ----------
  const screen = new Screen(stage, { width: def.width, height: def.height, palette: def.palette });
  const input = new Input(def.input);
  const sound = new Sound();
  const tuner = new Tuner(panel, {
    storageKey: 'stardust/' + def.id,
    groups: [...def.tuning.groups, DEBUG_GROUP],
    presets: def.tuning.presets,
    intro: def.intro,
  });
  const P = tuner.values;
  sound.setVolume(P.volume);
  tuner.onChange((k, v) => { if (k === 'volume') sound.setVolume(v); });
  const syncSoundBtn = () => { soundBtn.textContent = sound.muted ? '🔇 靜音' : '🔊 音效'; soundBtn.classList.toggle('on', !sound.muted); };
  syncSoundBtn();
  soundBtn.addEventListener('click', () => { sound.unlock(); sound.setMuted(!sound.muted); syncSoundBtn(); soundBtn.blur(); });
  if (def.touch) new TouchControls(stage, input, def.touch);

  const ctx = { screen, input, sound, P, tuner, W: def.width, H: def.height };
  const game = def.create(ctx);

  // ---------- 除錯按鍵 ----------
  let paused = false, stepOnce = false;
  const setPaused = p => { paused = p; pausedTag.hidden = !p; };
  addEventListener('keydown', e => {
    sound.unlock();
    if (isTyping(e.target) || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.code) {
      case 'KeyP': setPaused(!paused); break;
      case 'KeyN': if (paused) stepOnce = true; else setPaused(true); break;
      case 'KeyH': tuner.set('showHitbox', !P.showHitbox); break;
      case 'KeyR': game.reset(); break;
      case 'KeyM': sound.setMuted(!sound.muted); syncSoundBtn(); break;
      case 'Backquote': setPanel(app.classList.contains('panel-hidden')); break;
      default: return;
    }
    e.preventDefault();
  });
  addEventListener('pointerdown', () => sound.unlock(), { passive: true });

  // ---------- 主迴圈（固定 60Hz 更新，時間倍率可調） ----------
  let frames = 0, acc = 0, last = performance.now();
  const ui = def.ui || { text: 15, dark: 0 };
  function renderAll() {
    game.render();
    if (P.showInfo && game.debugLines) {
      screen.screenSpace();
      game.debugLines().forEach((line, i) => screen.text(line, 3, 3 + i * 7, ui.text, { small: true, outline: ui.dark }));
    }
  }
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused || stepOnce) {
      acc += stepOnce ? STEP : dt * P.timeScale;
      let n = 0;
      while (acc >= STEP && n < 5) {
        input.step(STEP);
        game.update(STEP);
        acc -= STEP; frames++; n++;
      }
      if (n === 5) acc = 0;
      stepOnce = false;
    }
    renderAll();
    screen.present();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- 測試／工具用介面 ----------
  window.__proto = {
    game, P, tuner, input, screen, sound,
    info: () => ({ id: def.id, width: def.width, height: def.height, scale: screen.scale, palette: screen.palette, frames, params: tuner.count }),
    paletteViolations: () => screen.paletteViolations(),
    /** 隨機操作 n 格，並回傳期間取樣畫面中最多的調色盤違規像素數 */
    fuzz(n = 300, seedActions) {
      const forced = {};
      input.forced = forced;
      let worst = 0;
      for (let i = 0; i < n; i++) {
        if (i % 7 === 0) for (const a of input.actions) forced[a] = Math.random() < (seedActions && seedActions[a] != null ? seedActions[a] : 0.25);
        input.step(STEP);
        game.update(STEP);
        frames++;
        if (i % 20 === 0) { renderAll(); worst = Math.max(worst, screen.paletteViolations()); }
      }
      input.forced = null;
      input.step(STEP);
      renderAll();
      return Math.max(worst, screen.paletteViolations());
    },
    /** 直接跑 n 格（不經過 requestAnimationFrame） */
    advance(n = 1) { for (let i = 0; i < n; i++) { input.step(STEP); game.update(STEP); frames++; } renderAll(); screen.present(); },
    setPaused,
    snapshot: () => screen.buf.toDataURL('image/png'),
  };
  return window.__proto;
}
