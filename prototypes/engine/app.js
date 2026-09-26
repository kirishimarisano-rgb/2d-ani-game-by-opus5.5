// 遊戲外殼：頁面版面、固定 60Hz 更新迴圈、除錯功能、調參面板、背景音樂、測試介面。
import { Screen } from './pixel.js';
import { Input, TouchControls } from './input.js';
import { Tuner } from './tuner.js';
import { Sound } from './audio.js';
import { Music } from './music.js';

export const STEP = 1 / 60;

const DEBUG_GROUP = {
  id: 'debug', name: '除錯與檢視', open: false,
  items: [
    { key: 'timeScale', label: '遊戲速度', min: 0.05, max: 1.5, step: 0.05, value: 1, unit: '×', hint: '放慢到 0.1～0.3 倍，可以看清楚每一格動畫、打擊停頓與擊退軌跡。' },
    { key: 'showHitbox', label: '顯示判定框（H）', type: 'toggle', value: false, hint: '綠：身體　紅：攻擊判定　黃：無敵中' },
    { key: 'showInfo', label: '顯示即時數值', type: 'toggle', value: false, hint: '在畫面左上角顯示速度、狀態等數值。' },
    { key: 'volume', label: '音效音量', min: 0, max: 1, step: 0.05, value: 0.6 },
    { key: 'musicVolume', label: '音樂音量', min: 0, max: 1, step: 0.05, value: 0.5 },
  ],
};

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function isTyping(t) { return t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && !['range', 'checkbox', 'button'].includes(t.type))); }

/**
 * 啟動一款遊戲。def：
 *   id, title, subtitle, width, height, palette（≤16 色）, ui: { text, dark }（HUD 用的調色盤索引）
 *   input: 動作對應, touch: 觸控按鈕, touchPause: 觸控暫停鍵對應的動作,
 *   tuning: { groups, presets }, intro: 面板說明, debugItems: 加到「除錯」分組的項目
 *   create(ctx) → { update(dt), render(), reset(), debugLines?(), stageCover?(), onBlur?() }
 */
export function runPrototype(def) {
  document.title = `${def.title}｜星屑遊樂場`;

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
  const pausedTag = el('div', 'pa-paused', '⏸ 凍結中　F 繼續／N 逐格');
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

  // 面板預設收起（遊戲畫面可以放得更大），開關狀態會記住
  const PANEL_KEY = 'stardust/panel-open';
  const setPanel = open => {
    app.classList.toggle('panel-hidden', !open); panelBtn.classList.toggle('on', open);
    try { localStorage.setItem(PANEL_KEY, open ? '1' : '0'); } catch { /* 忽略 */ }
  };
  let panelOpen = false;
  try { panelOpen = localStorage.getItem(PANEL_KEY) === '1' && !matchMedia('(max-width: 860px)').matches; } catch { /* 忽略 */ }
  app.classList.toggle('panel-hidden', !panelOpen); panelBtn.classList.toggle('on', panelOpen);
  panelBtn.addEventListener('click', () => { setPanel(app.classList.contains('panel-hidden')); panelBtn.blur(); });

  // ---------- 系統 ----------
  const screen = new Screen(stage, { width: def.width, height: def.height, palette: def.palette });
  const input = new Input(def.input);
  const sound = new Sound();
  const music = new Music(sound);
  const debugGroup = { ...DEBUG_GROUP, items: [...DEBUG_GROUP.items, ...(def.debugItems || [])] };
  const tuner = new Tuner(panel, {
    storageKey: 'stardust/' + def.id,
    groups: [...def.tuning.groups, debugGroup],
    presets: def.tuning.presets,
    intro: def.intro,
  });
  const P = tuner.values;
  sound.setVolume(P.volume);
  sound.setMusicVolume(P.musicVolume);
  tuner.onChange((k, v) => { if (k === 'volume') sound.setVolume(v); if (k === 'musicVolume') sound.setMusicVolume(v); });
  const syncSoundBtn = () => { soundBtn.textContent = sound.muted ? '🔇 靜音' : '🔊 音效'; soundBtn.classList.toggle('on', !sound.muted); };
  syncSoundBtn();
  soundBtn.addEventListener('click', () => { sound.unlock(); sound.setMuted(!sound.muted); syncSoundBtn(); soundBtn.blur(); });
  const touch = def.touch ? new TouchControls(stage, input, def.touch, { pause: def.touchPause }) : { setVisible() {}, active: false };
  input.attachPointer(stage, screen);

  const ctx = { screen, input, sound, music, touch, P, tuner, W: def.width, H: def.height };
  const game = def.create(ctx);
  document.addEventListener('visibilitychange', () => { if (document.hidden && game.onBlur) game.onBlur(); });

  // ---------- 除錯按鍵 ----------
  let paused = false, stepOnce = false;
  const setPaused = p => { paused = p; pausedTag.hidden = !p; };
  addEventListener('keydown', e => {
    sound.unlock();
    if (isTyping(e.target) || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.code) {
      case 'KeyF': setPaused(!paused); break;
      case 'KeyN': if (paused) stepOnce = true; else setPaused(true); break;
      case 'KeyH': tuner.set('showHitbox', !P.showHitbox); break;
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
    game, P, tuner, input, screen, sound, music,
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
