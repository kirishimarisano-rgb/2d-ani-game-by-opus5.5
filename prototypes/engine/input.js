// 輸入：鍵盤、手把（標準配置）、觸控虛擬搖桿與按鈕，統一成「動作」。
// 每個固定更新格呼叫一次 step()，之後以 down / pressed / released / held 查詢。

const PAD_DPAD = { up: 12, down: 13, left: 14, right: 15 };
const STICK = { left: [0, -1], right: [0, 1], up: [1, -1], down: [1, 1] };

function isTyping(el) {
  if (!el || !el.tagName) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  return el.tagName === 'INPUT' && el.type !== 'range' && el.type !== 'checkbox' && el.type !== 'button';
}

export class Input {
  /** map: { 動作: { keys: ['KeyZ', ...], pad: [0, ...] } }，left/right/up/down 會自動對應方向鍵與搖桿 */
  constructor(map) {
    this.map = map;
    this.actions = Object.keys(map);
    this.keyToActions = new Map();
    for (const [a, def] of Object.entries(map)) for (const k of def.keys || []) {
      if (!this.keyToActions.has(k)) this.keyToActions.set(k, []);
      this.keyToActions.get(k).push(a);
    }
    this.keysHeld = new Set();
    this.qPress = new Set(); this.qRelease = new Set();
    this.state = {}; this.pressedNow = {}; this.releasedNow = {}; this.holdT = {}; this.repeatNow = {};
    this.tapQ = []; this.taps = []; // 點擊／觸控畫面（原生座標），選單用
    this.touchHeld = new Set();
    this.touchAxis = { x: 0, y: 0 };
    this.padAxis = { x: 0, y: 0 };
    this.forced = null; // 測試用：強制指定按住的動作
    this.lastDevice = 'keyboard';
    addEventListener('keydown', e => this._key(e, true));
    addEventListener('keyup', e => this._key(e, false));
    addEventListener('blur', () => { this.keysHeld.clear(); this.touchHeld.clear(); });
  }
  _key(e, isDown) {
    if (isTyping(e.target)) return;
    const acts = this.keyToActions.get(e.code);
    if (!acts) return;
    // 滑桿取得焦點時，把按鍵交還給遊戲
    if (e.target && e.target.type === 'range') e.target.blur();
    e.preventDefault();
    if (isDown) {
      if (e.repeat) return;
      this.keysHeld.add(e.code);
      acts.forEach(a => this.qPress.add(a));
    } else {
      this.keysHeld.delete(e.code);
      acts.forEach(a => this.qRelease.add(a));
    }
    this.lastDevice = 'keyboard';
  }
  _pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }
  step(dt) {
    const pad = this._pad();
    if (pad) {
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0, m = Math.hypot(ax, ay);
      this.padAxis = m > 0.22 ? { x: ax, y: ay } : { x: 0, y: 0 };
    } else this.padAxis = { x: 0, y: 0 };
    for (const a of this.actions) {
      const def = this.map[a];
      let d = false;
      if (this.forced) d = !!this.forced[a];
      else {
        for (const k of def.keys || []) if (this.keysHeld.has(k)) { d = true; break; }
        if (this.touchHeld.has(a)) d = true;
        if (pad) {
          for (const i of def.pad || []) if (pad.buttons[i] && pad.buttons[i].pressed) { d = true; this.lastDevice = 'gamepad'; }
          if (PAD_DPAD[a] != null && pad.buttons[PAD_DPAD[a]] && pad.buttons[PAD_DPAD[a]].pressed) { d = true; this.lastDevice = 'gamepad'; }
          if (STICK[a]) { const v = pad.axes[STICK[a][0]] || 0; if (v * STICK[a][1] > 0.5) d = true; }
        }
        if (STICK[a]) { const v = STICK[a][0] ? this.touchAxis.y : this.touchAxis.x; if (v * STICK[a][1] > 0.45) d = true; }
      }
      const was = !!this.state[a];
      this.pressedNow[a] = (d && !was) || this.qPress.has(a);
      this.releasedNow[a] = (!d && was) || this.qRelease.has(a);
      this.state[a] = d;
      const h0 = this.holdT[a] || 0;
      this.holdT[a] = d ? h0 + dt : 0;
      // 按住時自動連發（選單移動用）：0.3 秒後每 0.085 秒一次
      const R0 = 0.3, RI = 0.085;
      this.repeatNow[a] = this.pressedNow[a] || (d && h0 + dt > R0 && Math.floor((h0 + dt - R0) / RI) !== Math.floor((h0 - R0) / RI) && h0 > R0 - dt);
    }
    this.qPress.clear(); this.qRelease.clear();
    this.taps = this.tapQ; this.tapQ = [];
  }
  /** 讓畫布上的點擊變成選單可用的座標（只接受直接點在遊戲畫面上的操作） */
  attachPointer(host, screen) {
    host.addEventListener('pointerdown', e => {
      if (e.target !== screen.view && e.target !== host) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const p = screen.toNative(e.clientX, e.clientY);
      if (p.x >= 0 && p.y >= 0 && p.x < screen.w && p.y < screen.h) this.tapQ.push({ x: p.x, y: p.y, touch: e.pointerType !== 'mouse' });
      if (e.pointerType !== 'mouse') this.lastDevice = 'touch';
    });
  }
  /** 這一格已經被選單等處理過：清掉按下事件與點擊，避免同一次按鍵又觸發遊戲動作 */
  eat() {
    for (const a of this.actions) { this.pressedNow[a] = false; this.repeatNow[a] = false; }
    this.taps = [];
  }
  repeat(a) { return !!this.repeatNow[a]; }
  down(a) { return !!this.state[a]; }
  pressed(a) { return !!this.pressedNow[a]; }
  released(a) { return !!this.releasedNow[a]; }
  held(a) { return this.holdT[a] || 0; }
  /** 移動向量（-1..1），搖桿有類比值，鍵盤為 8 方向 */
  axis() {
    let x = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    let y = (this.down('down') ? 1 : 0) - (this.down('up') ? 1 : 0);
    if (!this.forced) {
      if (this.padAxis.x || this.padAxis.y) { x = this.padAxis.x; y = this.padAxis.y; }
      else if (Math.hypot(this.touchAxis.x, this.touchAxis.y) > 0.15) { x = this.touchAxis.x; y = this.touchAxis.y; }
    }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y };
  }
}

/**
 * 觸控：左半邊是浮動虛擬搖桿（手指按下的位置就是中心），右下角是動作按鈕。
 * 只在觸控裝置上顯示。
 */
export class TouchControls {
  constructor(host, input, buttons, o = {}) {
    this.input = input;
    this.wanted = true; this.enabled = false;
    const root = document.createElement('div');
    root.className = 'pa-touch';
    root.hidden = true;
    root.innerHTML = '<div class="pa-stick-zone"><div class="pa-stick"><div class="pa-knob"></div></div></div><div class="pa-buttons"></div>';
    host.appendChild(root);
    this.root = root;
    const zone = root.querySelector('.pa-stick-zone'), stick = root.querySelector('.pa-stick'), knob = root.querySelector('.pa-knob');
    let id = null, ox = 0, oy = 0;
    const R = 44;
    zone.addEventListener('pointerdown', e => {
      e.preventDefault(); id = e.pointerId; zone.setPointerCapture(id);
      const r = zone.getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top;
      stick.style.left = ox + 'px'; stick.style.top = oy + 'px'; stick.classList.add('on'); knob.style.transform = '';
    });
    zone.addEventListener('pointermove', e => {
      if (e.pointerId !== id) return;
      const r = zone.getBoundingClientRect();
      let dx = e.clientX - r.left - ox, dy = e.clientY - r.top - oy;
      const m = Math.hypot(dx, dy);
      if (m > R) { dx = dx / m * R; dy = dy / m * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      input.touchAxis = { x: dx / R, y: dy / R };
    });
    const end = e => { if (e.pointerId !== id) return; id = null; input.touchAxis = { x: 0, y: 0 }; stick.classList.remove('on'); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);

    const box = root.querySelector('.pa-buttons');
    for (const b of buttons) {
      const el = document.createElement('div');
      el.className = 'pa-tbtn' + (b.big ? ' big' : '');
      el.textContent = b.label;
      el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); input.touchHeld.add(b.action); input.qPress.add(b.action); el.classList.add('on'); input.lastDevice = 'touch'; });
      const up = () => { input.touchHeld.delete(b.action); input.qRelease.add(b.action); el.classList.remove('on'); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      box.appendChild(el);
    }
    if (o.pause) { // 右上角暫停鍵
      const pb = document.createElement('div');
      pb.className = 'pa-tpause';
      pb.textContent = 'Ⅱ';
      pb.addEventListener('pointerdown', e => { e.preventDefault(); input.qPress.add(o.pause); input.qRelease.add(o.pause); input.lastDevice = 'touch'; });
      root.appendChild(pb);
    }
    const show = () => { this.enabled = true; this._sync(); };
    if (matchMedia('(pointer: coarse)').matches) show();
    addEventListener('touchstart', show, { once: true, passive: true });
  }
  _sync() { this.root.hidden = !(this.enabled && this.wanted); }
  /** 選單畫面收起虛擬按鍵，讓點擊直接落在畫面上 */
  setVisible(v) {
    if (this.wanted === v) return;
    this.wanted = v;
    if (!v) { this.input.touchHeld.clear(); this.input.touchAxis = { x: 0, y: 0 }; this.root.querySelectorAll('.on').forEach(e => e.classList.remove('on')); }
    this._sync();
  }
  get active() { return this.enabled; }
}
