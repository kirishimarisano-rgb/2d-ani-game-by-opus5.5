import { compile, midiToFreq, SONGS, type DrumEvent, type NoteEvent } from './songs';

// Web Audio 程序生成的聲音：四聲道晶片音樂＋文字嗶聲＋音效。

class Chip {
  ctx: AudioContext | null = null;
  bgm!: GainNode;
  se!: GainNode;
  noise!: AudioBuffer;
  duties = new Map<number, PeriodicWave>();
  bgmVol = 0.7;
  seVol = 0.7;

  private song: { notes: NoteEvent[]; drums: DrumEvent[]; steps: number; bpm: number; swing: number; duty: number; vol: number } | null = null;
  private songName: string | null = null;
  private songGain: GainNode | null = null;
  private startTime = 0;
  private nextStep = 0;
  private timer: number | null = null;

  /** 瀏覽器規定要在使用者操作之後才能開聲音 */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.bgm = this.ctx.createGain();
    this.se = this.ctx.createGain();
    this.bgm.connect(this.ctx.destination);
    this.se.connect(this.ctx.destination);
    this.setVolumes(this.bgmVol, this.seVol);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    // 線性回饋移位暫存器，像紅白機的雜訊聲道
    let lfsr = 1;
    for (let i = 0; i < len; i++) {
      if (i % 4 === 0) {
        const bit = (lfsr ^ (lfsr >> 1)) & 1;
        lfsr = (lfsr >> 1) | (bit << 14);
      }
      d[i] = lfsr & 1 ? 0.6 : -0.6;
    }
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      this.play(p);
    }
  }
  private pending: string | null = null;

  setVolumes(bgm: number, se: number) {
    this.bgmVol = bgm;
    this.seVol = se;
    if (!this.ctx) return;
    this.bgm.gain.value = bgm;
    this.se.gain.value = se;
  }

  private wave(duty: number): PeriodicWave {
    let w = this.duties.get(duty);
    if (w) return w;
    const n = 32;
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    // 脈衝波的傅立葉級數：餘弦項 a_k = 2/(kπ)·sin(kπd)
    for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    w = this.ctx!.createPeriodicWave(re, im);
    this.duties.set(duty, w);
    return w;
  }

  private tone(dest: AudioNode, type: 'pulse' | 'triangle', duty: number, freq: number, t: number, dur: number, vol: number, slide = 0) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    if (type === 'pulse') o.setPeriodicWave(this.wave(duty));
    else o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setTargetAtTime(vol * 0.6, t + 0.02, 0.08);
    g.gain.setTargetAtTime(0, t + Math.max(0.02, dur - 0.03), 0.015);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  private hit(dest: AudioNode, kind: 'k' | 's' | 'h', t: number, vol = 1) {
    const ctx = this.ctx!;
    if (kind === 'k') {
      this.tone(dest, 'triangle', 0, 150, t, 0.12, 0.35 * vol, 0.3);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = kind === 'h' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'h' ? 7000 : 1800;
    const g = ctx.createGain();
    const len = kind === 'h' ? 0.03 : 0.12;
    g.gain.setValueAtTime((kind === 'h' ? 0.05 : 0.12) * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + len + 0.02);
  }

  // ---- 音樂 ----
  play(name: string | null) {
    if (name === this.songName) return;
    if (!this.ctx) {
      this.pending = name;
      return;
    }
    this.stopSong();
    this.songName = name;
    if (!name) return;
    const s = SONGS[name];
    const c = compile(s);
    this.song = { ...c, bpm: s.bpm, swing: s.swing ?? 0, duty: s.leadDuty, vol: s.leadVol };
    this.songGain = this.ctx.createGain();
    this.songGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.songGain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.6);
    this.songGain.connect(this.bgm);
    this.startTime = this.ctx.currentTime + 0.1;
    this.nextStep = 0;
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  current() {
    return this.songName;
  }

  private stopSong() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    if (this.songGain && this.ctx) {
      const g = this.songGain;
      g.gain.cancelScheduledValues(this.ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.4);
      setTimeout(() => g.disconnect(), 600);
    }
    this.songGain = null;
    this.song = null;
  }

  private schedule() {
    const s = this.song;
    if (!s || !this.ctx || !this.songGain) return;
    const stepDur = 60 / s.bpm / 4;
    const horizon = this.ctx.currentTime + 0.15;
    for (;;) {
      const local = this.nextStep % s.steps;
      const swingOff = local % 2 === 1 ? s.swing * stepDur : 0;
      const t = this.startTime + this.nextStep * stepDur + swingOff;
      if (t > horizon) break;
      for (const n of s.notes) {
        if (n.step !== local) continue;
        const dur = n.len * stepDur;
        const f = midiToFreq(n.midi);
        if (n.ch === 'lead') this.tone(this.songGain, 'pulse', s.duty, f, t, dur * 0.92, s.vol);
        if (n.ch === 'arp') this.tone(this.songGain, 'pulse', 0.125, f, t, dur * 0.8, 0.025);
        if (n.ch === 'bass') this.tone(this.songGain, 'triangle', 0, f, t, dur * 0.9, 0.16);
      }
      for (const d of s.drums) if (d.step === local) this.hit(this.songGain, d.kind, t);
      this.nextStep++;
    }
  }

  // ---- 音效 ----
  blip(freq: number) {
    if (!this.ctx || !freq) return;
    const t = this.ctx.currentTime;
    this.tone(this.se, 'pulse', 0.25, freq * (0.97 + Math.random() * 0.06), t, 0.03, 0.05);
  }

  sfx(name: string) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    const se = this.se;
    switch (name) {
      case 'select':
        this.tone(se, 'pulse', 0.5, 988, t, 0.05, 0.08);
        this.tone(se, 'pulse', 0.5, 1319, t + 0.05, 0.08, 0.08);
        break;
      case 'cursor':
        this.tone(se, 'pulse', 0.25, 660, t, 0.03, 0.05);
        break;
      case 'cancel':
        this.tone(se, 'pulse', 0.5, 660, t, 0.05, 0.07);
        this.tone(se, 'pulse', 0.5, 440, t + 0.05, 0.08, 0.07);
        break;
      case 'bell': // 平交道
        for (let i = 0; i < 8; i++) {
          this.tone(se, 'pulse', 0.5, 1046, t + i * 0.36, 0.14, 0.06);
          this.tone(se, 'pulse', 0.5, 880, t + i * 0.36 + 0.18, 0.14, 0.06);
        }
        break;
      case 'door': // 店門口的風鈴
        [2093, 2637, 3136, 2637].forEach((f, i) => this.tone(se, 'triangle', 0, f, t + i * 0.09, 0.4, 0.05));
        break;
      case 'train': {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise;
        src.loop = true;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 300;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.25, t + 1);
        g.gain.linearRampToValueAtTime(0, t + 4);
        src.connect(f).connect(g).connect(se);
        src.start(t);
        src.stop(t + 4.1);
        for (let i = 0; i < 6; i++) {
          this.hit(se, 'k', t + 0.6 + i * 0.5, 0.6);
          this.hit(se, 'k', t + 0.72 + i * 0.5, 0.5);
        }
        break;
      }
      case 'tape':
        this.hit(se, 's', t, 0.8);
        this.tone(se, 'pulse', 0.125, 220, t + 0.08, 0.3, 0.03, 1.6);
        break;
      case 'phone':
        for (let i = 0; i < 3; i++) this.tone(se, 'pulse', 0.5, 140, t + i * 0.3, 0.18, 0.08);
        break;
    }
  }
}

export const chip = new Chip();
