// 即時合成音效（Web Audio API），不使用任何音檔。
export class Sound {
  constructor() {
    this.ac = null; this.out = null; this.noiseBuf = null;
    this.volume = 0.6; this.muted = false;
    try { this.muted = localStorage.getItem('stardust/proto-mute') === '1'; } catch { /* 無痕模式等 */ }
    this._last = new Map();
  }
  /** 瀏覽器規定要在使用者操作後才能出聲：在第一次按鍵／點擊時呼叫 */
  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ac = new AC();
      this.out = this.ac.createGain();
      this.out.gain.value = this.muted ? 0 : this.volume;
      const comp = this.ac.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6;
      this.out.connect(comp); comp.connect(this.ac.destination);
      this.noiseBuf = this.ac.createBuffer(1, this.ac.sampleRate, this.ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { this.ac = null; }
  }
  get ready() { return !!this.ac && this.ac.state === 'running' && !this.muted; }
  setVolume(v) { this.volume = v; if (this.out && !this.muted) this.out.gain.value = v; }
  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('stardust/proto-mute', m ? '1' : '0'); } catch { /* 忽略 */ }
    if (this.out) this.out.gain.value = m ? 0 : this.volume;
  }
  /** 同一種音效在 gap 秒內只播一次（避免一次命中多個敵人時爆音） */
  throttle(name, gap = 0.03) {
    if (!this.ac) return false;
    const t = this.ac.currentTime, l = this._last.get(name);
    if (l !== undefined && t - l < gap) return false;
    this._last.set(name, t);
    return true;
  }
  _env(g, t, vol, attack, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.005, dur));
  }
  tone({ type = 'square', f0 = 440, f1 = f0, dur = 0.1, vol = 0.2, delay = 0, attack = 0.003, detune = 0 } = {}) {
    if (!this.ready) return;
    const t = this.ac.currentTime + delay;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.detune.value = detune;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this._env(g, t, vol, attack, dur);
    o.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + dur + 0.05);
  }
  noise({ dur = 0.1, vol = 0.2, filter = 'lowpass', f0 = 3000, f1 = f0, q = 1, delay = 0, attack = 0.002 } = {}) {
    if (!this.ready) return;
    const t = this.ac.currentTime + delay;
    const s = this.ac.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = this.ac.createBiquadFilter(); fl.type = filter; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = this.ac.createGain();
    this._env(g, t, vol, attack, dur);
    s.connect(fl); fl.connect(g); g.connect(this.out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  /** 鈴聲：非整數倍泛音疊加，聽起來像金屬鈴 */
  bell({ f = 880, dur = 0.9, vol = 0.18, delay = 0, bright = 1 } = {}) {
    if (!this.ready) return;
    const parts = [[1, 1], [2.76, 0.45 * bright], [5.4, 0.22 * bright], [8.93, 0.1 * bright]];
    for (const [r, a] of parts) this.tone({ type: 'sine', f0: f * r, dur: dur / Math.sqrt(r), vol: vol * a, delay, attack: 0.002 });
  }
}
