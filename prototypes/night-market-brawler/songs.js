// 《夜市拳姬》背景音樂：霓虹城市風（放克貝斯、切分節奏），格式見 engine/music.js。
const join = (...p) => p.join(' ');
const rep = (s, n) => Array(n).fill(s).join(' ');
const funk = (r, o) => `${r} . ${r} ${o} . ${r} . ${r} ${r} . ${o} . ${r} . ${o} ${r}`;
const drive = (r, f) => `${r} . ${r} . ${f} . ${r} . ${r} . ${r} . ${f} . ${r} .`;

export const SONGS = {
  title: {
    bpm: 112, div: 4,
    tracks: [
      { type: 'pulse25', vol: 0.04, vib: 0.5, notes: join('E5 - - G5 - A5 - B5 - - - A5 - G5 - -', 'D5 - - E5 - G5 - A5 - - - G5 - E5 - -', 'C5 - - E5 - G5 - B5 - - - A5 - G5 - E5', 'D5 - - - - - B4 - - - - - . . . .') },
      { type: 'pulse12', vol: 0.025, notes: join('E4+G4+B4 - - - - - - - E4+G4+B4 - - - - - - -', 'D4+F#4+A4 - - - - - - - D4+F#4+A4 - - - - - - -', 'C4+E4+G4 - - - - - - - C4+E4+G4 - - - - - - -', 'B3+D4+F#4 - - - - - - - B3+D#4+F#4 - - - - - - -') },
      { type: 'triangle', vol: 0.09, notes: join(funk('E2', 'E3'), funk('D2', 'D3'), funk('C2', 'C3'), funk('B1', 'B2')) },
      { type: 'drum', vol: 0.07, notes: 'k . h . s . h k . k h . s . h h' },
    ],
  },
  map: {
    bpm: 100, div: 4, swing: 0.12,
    tracks: [
      { type: 'pluck', vol: 0.05, decay: 0.35, notes: join('A4 . C5 . E5 . C5 . G5 . E5 . D5 . C5 .', 'F4 . A4 . C5 . A4 . E5 . C5 . B4 . A4 .') },
      { type: 'triangle', vol: 0.08, notes: join(drive('A2', 'E2'), drive('F2', 'C3')) },
      { type: 'drum', vol: 0.05, notes: 'k . h . s . h . k . h k s . h .' },
    ],
  },
  stage1: {
    bpm: 136, div: 4,
    tracks: [
      { type: 'pulse25', vol: 0.045, notes: join('A4 - C5 - D5 - E5 - . E5 D5 - C5 - A4 -', 'G4 - A4 - C5 - D5 - . D5 C5 - A4 - - -', 'A4 - C5 - D5 - E5 - . G5 E5 - D5 - C5 -', 'D5 - - - E5 - - - A4 - - - . . . .') },
      { type: 'square', vol: 0.02, notes: rep('A3 . E4 . A3 . E4 . G3 . D4 . G3 . D4 .', 2) },
      { type: 'triangle', vol: 0.1, notes: join(funk('A2', 'A3'), funk('G2', 'G3'), funk('F2', 'F3'), funk('E2', 'E3')) },
      { type: 'drum', vol: 0.08, notes: 'k . h k s . h . k . h k s . h c' },
    ],
  },
  stage2: {
    bpm: 128, div: 4, swing: 0.1,
    tracks: [
      { type: 'pulse25', vol: 0.045, notes: join('D5 - F5 - . A5 G5 - F5 - D5 - C5 - D5 -', 'F5 - G5 - . A5 C6 - A5 - G5 - F5 - - -', 'D5 - F5 - . A5 G5 - F5 - D5 - C5 - A4 -', 'C5 - D5 - . F5 D5 - - - . . . . . .') },
      { type: 'pluck', vol: 0.04, decay: 0.25, notes: rep('D4 F4 A4 F4', 4) + ' ' + rep('Bb3 D4 F4 D4', 4) + ' ' + rep('C4 E4 G4 E4', 4) + ' ' + rep('A3 C#4 E4 C#4', 4) },
      { type: 'triangle', vol: 0.1, notes: join(funk('D2', 'D3'), funk('Bb1', 'Bb2'), funk('C2', 'C3'), funk('A1', 'A2')) },
      { type: 'drum', vol: 0.08, notes: 'k . h . s . h k . k h . s . h . k . h . s . h k . k h . s c s .' },
    ],
  },
  stage3: {
    bpm: 144, div: 4,
    tracks: [
      { type: 'pulse25', vol: 0.045, notes: join('E5 G5 B5 G5 E5 - D5 - E5 - G5 - A5 - G5 -', 'C5 E5 G5 E5 C5 - B4 - C5 - E5 - G5 - A5 -', 'B5 - A5 - G5 - E5 - D5 - E5 - G5 - A5 -', 'B5 - - - - - . . F#5 - - - D#5 - - -') },
      { type: 'pulse12', vol: 0.025, notes: rep('E4 . G4 . B4 . G4 .', 2) + ' ' + rep('C4 . E4 . G4 . E4 .', 2) + ' ' + rep('A3 . C4 . E4 . C4 .', 2) + ' ' + rep('B3 . D#4 . F#4 . D#4 .', 2) },
      { type: 'triangle', vol: 0.1, notes: join(drive('E2', 'B2'), drive('C2', 'G2'), drive('A1', 'E2'), drive('B1', 'F#2')) },
      { type: 'drum', vol: 0.08, notes: 'k . h . s . h . k k h . s . h h' },
    ],
  },
  stage4: {
    bpm: 150, div: 4,
    tracks: [
      { type: 'pulse25', vol: 0.045, vib: 0.4, notes: join('A5 - - - G5 - E5 - D5 - E5 - G5 - A5 -', 'C6 - - - B5 - A5 - G5 - A5 - E5 - - -', 'A5 - - - G5 - E5 - D5 - E5 - G5 - E5 -', 'D5 - - - C5 - - - A4 - - - . . . .') },
      { type: 'square', vol: 0.022, notes: rep('A3 A3 . A3 C4 . A3 . G3 G3 . G3 B3 . G3 .', 2) },
      { type: 'triangle', vol: 0.1, notes: join(funk('A1', 'A2'), funk('F1', 'F2'), funk('G1', 'G2'), funk('E1', 'E2')) },
      { type: 'drum', vol: 0.09, notes: 'k . h k s . h . k k h . s . s h' },
    ],
  },
  boss: {
    bpm: 158, div: 4,
    tracks: [
      { type: 'pulse25', vol: 0.045, notes: join('E5 - E5 . G5 - E5 . A5 - G5 - E5 - D5 -', 'E5 - - - B4 - - - D5 - - - E5 - - -', 'G5 - G5 . A5 - G5 . B5 - A5 - G5 - E5 -', 'F#5 - - - D#5 - - - B4 - - - D#5 - F#5 -') },
      { type: 'square', vol: 0.022, notes: rep('E3 . E3 E4 . E3 . E3', 2) + ' ' + rep('C3 . C3 C4 . C3 . C3', 2) },
      { type: 'triangle', vol: 0.1, notes: join(funk('E2', 'E3'), funk('E2', 'E3'), funk('C2', 'C3'), funk('B1', 'B2')) },
      { type: 'drum', vol: 0.09, notes: 'k . h k s . h . k k h . s . s s' },
    ],
  },
  final: {
    bpm: 166, div: 4,
    tracks: [
      { type: 'pulse25', vol: 0.045, vib: 0.5, notes: join('A5 - - - G5 - F5 - E5 - - - C5 - D5 -', 'E5 - - - - - - - A4 - B4 - C5 - D5 -', 'E5 - - - F5 - E5 - D5 - C5 - B4 - C5 -', 'A4 - - - - - - - E5 - - - A5 - - -') },
      { type: 'pulse12', vol: 0.03, notes: rep('A3 E4 A4 E4', 4) + ' ' + rep('F3 C4 F4 C4', 4) + ' ' + rep('D3 A3 D4 A3', 4) + ' ' + rep('E3 B3 E4 B3', 4) },
      { type: 'triangle', vol: 0.1, notes: join(drive('A1', 'E2'), drive('F1', 'C2'), drive('D2', 'A1'), drive('E2', 'B1')) },
      { type: 'drum', vol: 0.1, notes: 'k . h k s . h . k k h . s . h h k . h k s . h . k k h k s s s s' },
    ],
  },
  shop: {
    bpm: 96, div: 4, swing: 0.15,
    tracks: [
      { type: 'pluck', vol: 0.055, decay: 0.4, notes: join('C5 . E5 . G5 . A5 . G5 . E5 . D5 . . .', 'E5 . G5 . A5 . C6 . A5 . G5 . E5 . . .') },
      { type: 'triangle', vol: 0.07, notes: join(drive('C3', 'G2'), drive('A2', 'E2')) },
      { type: 'drum', vol: 0.045, notes: 'k . . h s . . h k . k h s . h .' },
    ],
  },
  clear: {
    bpm: 140, div: 4, loop: false,
    tracks: [
      { type: 'pulse25', vol: 0.05, notes: 'A4 . C5 . E5 . A5 - - - G5 . A5 . C6 - - - - - - - - - - - . . . .' },
      { type: 'triangle', vol: 0.09, notes: 'A2 . . . F2 . . . G2 . . . . . . . A2 - - - - - - - - - - - . . . .' },
      { type: 'drum', vol: 0.08, notes: 'k . . . s . . . k . k . s . . . k . . . . . . . . . . . . . . .' },
    ],
  },
  gameover: {
    bpm: 84, div: 4, loop: false,
    tracks: [
      { type: 'pulse25', vol: 0.05, notes: 'E5 . . . D5 . . . C5 . . . B4 . . . A4 - - - - - - - . . . . . . . .' },
      { type: 'triangle', vol: 0.07, notes: 'A2 - - - - - - - E2 - - - - - - - A1 - - - - - - - . . . . . . . .' },
    ],
  },
};
