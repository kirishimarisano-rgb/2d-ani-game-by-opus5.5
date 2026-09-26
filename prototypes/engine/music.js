// 背景音樂：以文字寫成的譜，用 Web Audio 即時合成（晶片音樂風格）。
//
// 曲子格式：
// {
//   bpm: 120, div: 4,            // 每拍分成幾格（4＝十六分音符）
//   loop: true,                  // false＝播一次（過場音效）
//   tracks: [
//     { type: 'pulse25', vol: 0.05, notes: 'E5 - G5 . A5 - - . | C6 ...' },
//     { type: 'triangle', vol: 0.09, notes: 'A2 . . . E3 . . .' },
//     { type: 'drum', vol: 0.12, notes: 'k . h . s . h .' },
//   ],
// }
// 每個字＝一格：音名（C4、F#5、Bb3）、「-」延長上一個音、「.」休止、「|」小節線（忽略）。
// 和弦用「+」連接：C4+E4+G4。各軌長度可以不同，會各自循環（短鼓組配長旋律）。
// 音色：square / pulse12 / pulse25 / triangle / sawtooth / sine / pluck（撥弦）/ bell（鈴）/ drum
// 鼓：k 大鼓、s 小鼓、h 閉合鈸、o 開放鈸、t 太鼓、c 拍手、w 木魚

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteFreq(tok) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(tok);
  if (!m) return null;
  const midi = (Number(m[3]) + 1) * 12 + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function parse(song) {
  if (song._parsed) return song._parsed;
  song._parsed = song.tracks.map(tr => {
    const toks = tr.notes.split(/\s+/).filter(t => t && t !== '|');
    const byStep = new Map();
    let last = null;
    toks.forEach((t, i) => {
      if (t === '-') { if (last) last.len++; return; }
      if (t === '.') { last = null; return; }
      last = { tok: t, len: 1 };
      byStep.set(i, last);
    });
    return { ...tr, byStep, length: Math.max(1, toks.length) };
  });
  song._length = Math.max(...song._parsed.map(t => t.length));
  return song._parsed;
}

export class Music {
  constructor(sound) {
    this.sound = sound;
    this.cur = null;
    this.song = null;
    this.timer = setInterval(() => this._pump(), 25);
  }
  /** 播放曲子（同一首正在播時不會重頭開始，除非 restart） */
  play(song, { restart = false } = {}) {
    if (song === this.song && !restart && this.cur) return;
    this.song = song;
    this._fadeOut(0.12);
    this.cur = song ? { song, tracks: parse(song), step: 0, next: 0, gain: null } : null;
  }
  stop(fade = 0.3) { this.song = null; this._fadeOut(fade); this.cur = null; }
  get playing() { return this.song; }
  _fadeOut(sec) {
    const c = this.cur, ac = this.sound.ac;
    if (!c || !c.gain || !ac) return;
    const g = c.gain;
    g.gain.cancelScheduledValues(ac.currentTime);
    g.gain.setValueAtTime(g.gain.value, ac.currentTime);
    g.gain.linearRampToValueAtTime(0, ac.currentTime + sec);
    setTimeout(() => { try { g.disconnect(); } catch { /* 已斷開 */ } }, sec * 1000 + 400);
  }
  _pump() {
    const s = this.sound, ac = s.ac, c = this.cur;
    if (!c || !ac || ac.state !== 'running' || !s.musicOut) return;
    if (!c.gain) {
      c.gain = ac.createGain();
      c.gain.connect(s.musicOut);
      c.next = ac.currentTime + 0.08;
    }
    // 分頁在背景時計時器會變慢，避免一次補排太多
    if (c.next < ac.currentTime - 0.2) c.next = ac.currentTime + 0.05;
    const song = c.song, stepDur = 60 / song.bpm / (song.div || 4);
    while (c.next < ac.currentTime + 0.14) {
      if (song.loop === false && c.step >= song._length) { this.cur = null; this.song = null; return; }
      for (const tr of c.tracks) {
        const ev = tr.byStep.get(c.step % tr.length);
        if (ev) this._event(tr, ev, c.next, stepDur, c.gain, c.step);
      }
      c.next += stepDur * (song.swing && c.step % 2 === 0 ? 1 + song.swing : song.swing && c.step % 2 ? 1 - song.swing : 1);
      c.step++;
    }
  }
  _event(tr, ev, t, stepDur, out, step) {
    const vol = tr.vol ?? 0.06;
    if (tr.type === 'drum') { for (const d of ev.tok) this._drum(d, t, vol, out); return; }
    const dur = ev.len * stepDur * (tr.gate ?? 0.92);
    for (const n of ev.tok.split('+')) {
      let f = noteFreq(n);
      if (!f) continue;
      if (tr.oct) f *= Math.pow(2, tr.oct);
      if (tr.type === 'bell') this._bell(f, t, dur, vol, out);
      else this._tone(tr, f, t, dur, vol, out, step);
    }
  }
  _tone(tr, f, t, dur, vol, out) {
    const ac = this.sound.ac;
    const o = ac.createOscillator(), g = ac.createGain();
    const type = tr.type === 'pluck' ? 'triangle' : tr.type;
    if (type.startsWith('pulse')) o.setPeriodicWave(this.sound.pulseWave(Number(type.slice(5)) / 100));
    else o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (tr.slide) o.frequency.setValueAtTime(f * 0.94, t), o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    if (tr.vib) { // 顫音：延遲後輕微上下
      const lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012 * tr.vib, t + Math.min(0.25, dur));
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.1);
    }
    const g0 = g.gain;
    const atk = tr.attack ?? 0.005;
    g0.setValueAtTime(0.0001, t);
    g0.exponentialRampToValueAtTime(vol, t + atk);
    if (tr.type === 'pluck') {
      g0.exponentialRampToValueAtTime(0.0001, t + Math.max(atk + 0.02, Math.min(dur + 0.3, tr.decay ?? 0.45)));
    } else {
      const sus = vol * (tr.sus ?? 0.65);
      g0.exponentialRampToValueAtTime(Math.max(0.0002, sus), t + atk + (tr.decay ?? 0.08));
      g0.setValueAtTime(Math.max(0.0002, sus), t + Math.max(atk + 0.01, dur - 0.02));
      g0.exponentialRampToValueAtTime(0.0001, t + dur + (tr.release ?? 0.04));
    }
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.5);
  }
  _bell(f, t, dur, vol, out) {
    const ac = this.sound.ac;
    for (const [r, a] of [[1, 1], [2.76, 0.4], [5.4, 0.18]]) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f * r;
      const d = Math.max(0.3, dur * 2) / Math.sqrt(r);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * a, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.05);
    }
  }
  _noise(t, dur, vol, out, filter, f0, f1 = f0, q = 1) {
    const ac = this.sound.ac;
    const s = ac.createBufferSource(); s.buffer = this.sound.noiseBuf;
    const fl = ac.createBiquadFilter(); fl.type = filter; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  _sweep(t, type, f0, f1, dur, vol, out) {
    const ac = this.sound.ac;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  _drum(d, t, vol, out) {
    switch (d) {
      case 'k': this._sweep(t, 'sine', 150, 42, 0.16, vol * 2.2, out); break;
      case 's': this._noise(t, 0.12, vol * 1.3, out, 'bandpass', 1800, 900, 0.8); this._sweep(t, 'triangle', 240, 150, 0.06, vol, out); break;
      case 'h': this._noise(t, 0.03, vol * 0.6, out, 'highpass', 7000); break;
      case 'o': this._noise(t, 0.14, vol * 0.5, out, 'highpass', 6000); break;
      case 't': this._sweep(t, 'sine', 110, 60, 0.28, vol * 2.4, out); this._noise(t, 0.05, vol * 0.6, out, 'lowpass', 600); break;
      case 'c': this._noise(t, 0.08, vol, out, 'bandpass', 1400, 1100, 1.2); this._noise(t + 0.012, 0.08, vol * 0.8, out, 'bandpass', 1400, 1100, 1.2); break;
      case 'w': this._sweep(t, 'sine', 900, 700, 0.05, vol * 0.9, out); break;
      default: break;
    }
  }
}
