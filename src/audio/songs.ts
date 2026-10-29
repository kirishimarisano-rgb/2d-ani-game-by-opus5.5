// 晶片音樂曲譜。旋律手寫；和弦伴奏（分解和弦、低音）由和弦進行自動展開。
// 旋律記法：音名+八度:長度（以十六分音符為單位），例如 f#5:4、bb4:2、r:8（休止）

export interface Song {
  bpm: number;
  chords: string[]; // 每小節一個和弦
  lead: string;
  leadDuty: number; // 方波佔空比 0.125 / 0.25 / 0.5
  leadVol: number;
  bass: 'eighth' | 'walk' | 'whole' | 'bounce';
  arp: 'up' | 'broken' | 'none' | 'pad';
  drums: string[]; // 每小節 16 格：k 大鼓、s 小鼓、h 鈸、. 無
  swing?: number;
}

export const SONGS: Record<string, Song> = {
  // 標題曲：D 大調，懷舊、中速
  title: {
    bpm: 84,
    chords: ['D', 'A', 'Bm', 'F#m', 'G', 'D', 'Em', 'A', 'D', 'A', 'Bm', 'F#m', 'G', 'A', 'D', 'D'],
    lead: `
      f#5:4 e5:2 d5:2 a4:6 r:2 | c#5:4 d5:2 e5:2 a4:8 | d5:4 c#5:2 b4:2 f#4:6 r:2 | a4:4 b4:2 c#5:2 a4:8 |
      b4:4 c#5:2 d5:2 g5:6 f#5:2 | f#5:4 e5:2 d5:2 a4:8 | g4:2 a4:2 b4:2 d5:2 e5:4 d5:2 c#5:2 | e5:12 r:4 |
      a5:4 f#5:2 e5:2 d5:4 e5:2 f#5:2 | e5:6 c#5:2 a4:8 | b4:2 c#5:2 d5:2 f#5:2 e5:4 d5:4 | c#5:6 a4:2 a4:8 |
      b4:4 d5:4 g5:4 f#5:2 e5:2 | e5:4 f#5:2 e5:2 c#5:8 | d5:16 | r:16`,
    leadDuty: 0.25,
    leadVol: 0.09,
    bass: 'eighth',
    arp: 'broken',
    drums: ['k.......s.......', 'k.......s...k...'],
  },
  // 日常曲：F 大調，輕快
  daily: {
    bpm: 112,
    swing: 0.12,
    chords: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C', 'F', 'C', 'Dm', 'Bb', 'Gm', 'C', 'F', 'F'],
    lead: `
      c5:2 a4:2 c5:2 f5:2 e5:2 c5:2 a4:4 | g4:2 c5:2 e5:2 g5:2 f5:2 e5:2 c5:4 | d5:2 f5:2 a5:2 f5:2 e5:2 d5:2 c5:2 a4:2 | bb4:2 c5:2 d5:2 f5:2 d5:4 r:4 |
      a4:2 c5:2 f5:2 a5:2 g5:2 f5:2 e5:2 f5:2 | g5:4 e5:2 c5:2 d5:2 e5:2 g5:4 | f5:2 d5:2 bb4:2 d5:2 c5:2 a4:2 bb4:2 g4:2 | c5:8 r:8 |
      c5:2 a4:2 c5:2 f5:2 e5:2 c5:2 a4:4 | g4:2 c5:2 e5:2 g5:2 f5:2 e5:2 c5:4 | d5:2 f5:2 a5:2 c6:2 bb5:2 a5:2 f5:4 | d5:2 f5:2 bb5:2 a5:2 g5:4 f5:4 |
      g5:2 f5:2 d5:2 bb4:2 d5:2 f5:2 g5:4 | e5:2 g5:2 c6:2 bb5:2 a5:2 g5:2 e5:4 | f5:4 c5:2 a4:2 f4:4 a4:4 | f4:8 r:8`,
    leadDuty: 0.5,
    leadVol: 0.07,
    bass: 'bounce',
    arp: 'up',
    drums: ['k.h.s.h.k.k.s.h.', 'k.h.s.h.k.h.s.hh'],
  },
  // 感傷曲：A 小調，慢
  sad: {
    bpm: 66,
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E', 'F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'E'],
    lead: `
      e5:6 d5:2 c5:4 b4:4 | a4:8 c5:4 a4:4 | g4:6 a4:2 c5:4 e5:4 | d5:12 r:4 |
      e5:6 f5:2 e5:4 c5:4 | a5:6 g5:2 f5:4 e5:4 | d5:4 e5:2 f5:2 e5:4 d5:4 | g#4:4 b4:4 e5:8 |
      c5:6 d5:2 e5:4 a5:4 | g5:6 f5:2 e5:4 d5:4 | e5:4 g5:4 b4:4 c5:2 d5:2 | c5:4 a4:12 |
      f5:6 e5:2 d5:4 a4:4 | b4:4 d5:4 g5:8 | g5:4 f5:2 e5:2 d5:4 c5:4 | b4:12 r:4`,
    leadDuty: 0.5,
    leadVol: 0.06,
    bass: 'whole',
    arp: 'pad',
    drums: ['................'],
  },
  // 夜晚／廟會：G 大調，溫和
  night: {
    bpm: 96,
    chords: ['G', 'Em', 'C', 'D', 'G', 'Bm', 'C', 'D', 'Em', 'C', 'G', 'D', 'C', 'D', 'G', 'G'],
    lead: `
      d5:4 b4:4 a4:2 g4:2 a4:4 | b4:4 e5:4 d5:8 | e5:4 g5:2 e5:2 d5:4 b4:4 | a4:12 r:4 |
      d5:4 b4:4 d5:2 e5:2 g5:4 | f#5:4 d5:4 b4:8 | c5:4 e5:2 d5:2 c5:4 b4:2 a4:2 | a4:12 r:4 |
      b4:4 e5:4 g5:4 e5:4 | e5:4 d5:2 c5:2 e5:8 | d5:4 b4:4 g4:4 b4:4 | a4:8 f#4:4 a4:4 |
      g5:4 e5:4 c5:4 e5:4 | d5:4 a4:4 f#5:8 | g5:16 | r:16`,
    leadDuty: 0.125,
    leadVol: 0.08,
    bass: 'walk',
    arp: 'broken',
    drums: ['k...h...s...h...', 'k...h...s...h.h.'],
  },
};

const NOTE_IDX: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

export function noteToMidi(n: string): number | null {
  const m = n.match(/^([a-g])([#b]?)(\d)$/);
  if (!m) return null;
  let v = NOTE_IDX[m[1]] + 12 * (Number(m[3]) + 1);
  if (m[2] === '#') v++;
  if (m[2] === 'b') v--;
  return v;
}

export function midiToFreq(m: number) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** 和弦 → MIDI 音（根音在第 3 八度） */
export function chordNotes(name: string): { root: number; tones: number[] } {
  const m = name.match(/^([A-G])([#b]?)(m?)(7?)$/)!;
  let root = NOTE_IDX[m[1].toLowerCase()] + 48;
  if (m[2] === '#') root++;
  if (m[2] === 'b') root--;
  const third = m[3] ? 3 : 4;
  const tones = [0, third, 7];
  if (m[4]) tones.push(10);
  return { root, tones: tones.map((t) => root + t) };
}

export interface NoteEvent {
  step: number;
  len: number;
  midi: number;
  ch: 'lead' | 'arp' | 'bass';
}
export interface DrumEvent {
  step: number;
  kind: 'k' | 's' | 'h';
}

export function compile(song: Song): { notes: NoteEvent[]; drums: DrumEvent[]; steps: number } {
  const notes: NoteEvent[] = [];
  const drums: DrumEvent[] = [];
  let step = 0;
  for (const tok of song.lead.replace(/\|/g, ' ').split(/\s+/).filter(Boolean)) {
    const [n, d] = tok.split(':');
    const len = Number(d);
    const midi = noteToMidi(n);
    if (midi !== null) notes.push({ step, len, midi, ch: 'lead' });
    step += len;
  }
  const steps = song.chords.length * 16;
  if (step !== steps) console.warn(`旋律長度 ${step} 與和弦 ${steps} 不符`);

  song.chords.forEach((c, bar) => {
    const { root, tones } = chordNotes(c);
    const at = bar * 16;
    // 低音
    if (song.bass === 'eighth') for (let i = 0; i < 16; i += 2) notes.push({ step: at + i, len: 2, midi: root - 12 + (i === 6 || i === 14 ? 7 : 0), ch: 'bass' });
    if (song.bass === 'bounce') for (let i = 0; i < 16; i += 4) notes.push({ step: at + i, len: 2, midi: root - 12 + (i % 8 ? 7 : 0), ch: 'bass' });
    if (song.bass === 'whole') notes.push({ step: at, len: 16, midi: root - 12, ch: 'bass' });
    if (song.bass === 'walk') [0, tones[1] - root, 7, tones[1] - root].forEach((iv, k) => notes.push({ step: at + k * 4, len: 4, midi: root - 12 + iv, ch: 'bass' }));
    // 分解和弦
    const up = [...tones.map((t) => t + 12), tones[0] + 24];
    if (song.arp === 'up') for (let i = 0; i < 16; i++) notes.push({ step: at + i, len: 1, midi: up[i % up.length], ch: 'arp' });
    if (song.arp === 'broken') {
      const pat = [0, 2, 1, 2, 3, 2, 1, 2];
      for (let i = 0; i < 8; i++) notes.push({ step: at + i * 2, len: 2, midi: up[pat[i]], ch: 'arp' });
    }
    if (song.arp === 'pad') up.slice(0, 3).forEach((t, k) => notes.push({ step: at + k * 2, len: 16 - k * 2, midi: t, ch: 'arp' }));
    // 鼓
    const pat = song.drums[bar % song.drums.length];
    [...pat].forEach((k, i) => {
      if (k === 'k' || k === 's' || k === 'h') drums.push({ step: at + i, kind: k });
    });
  });
  return { notes, drums, steps };
}
