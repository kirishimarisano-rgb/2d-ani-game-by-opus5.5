// 《溫室魔女的剪定日》背景音樂：輕快的田園風（三拍子華爾滋、木琴般的撥弦），格式見 engine/music.js。
const join = (...p) => p.join(' ');
const rep = (s, n) => Array(n).fill(s).join(' ');
const R16 = rep('.', 16);
function bass(root, fifth, style = 'bounce') {
  if (style === 'bounce') return `${root} . . . ${fifth} . . . ${root} . . . ${fifth} . . .`;
  if (style === 'drive') return `${root} . ${root} . ${fifth} . ${root} . ${root} . ${root} . ${fifth} . ${fifth} .`;
  if (style === 'waltz') return `${root} . . . . . ${fifth} . . . . .`; // 12 格＝三拍
  return `${root} - - - - - - - - - - - - - - -`;
}

export const SONGS = {
  // 標題：溫室的午後
  title: {
    bpm: 92, div: 4,
    tracks: [
      { type: 'pluck', vol: 0.06, decay: 0.5, notes: join('G5 . E5 . C5 . E5 . G5 . A5 . G5 . . .', 'F5 . D5 . B4 . D5 . F5 . G5 . F5 . . .', 'E5 . C5 . A4 . C5 . E5 . F5 . E5 . D5 .', 'C5 . . . G4 . . . C5 . . . . . . .') },
      { type: 'pulse12', vol: 0.025, notes: join('C4+E4+G4 - - - - - - - - - - - - - - -', 'B3+D4+G4 - - - - - - - - - - - - - - -', 'A3+C4+E4 - - - - - - - - - - - - - - -', 'G3+C4+E4 - - - - - - - - - - - - - - -') },
      { type: 'triangle', vol: 0.07, notes: join(bass('C3', 'G2'), bass('G2', 'D3'), bass('A2', 'E3'), bass('C3', 'G2')) },
    ],
  },
  // 溫室小屋：三拍子
  hut: {
    bpm: 132, div: 4,
    tracks: [
      { type: 'pluck', vol: 0.055, decay: 0.45, notes: join('E5 . . . G5 . A5 . . . G5 .', 'E5 . . . D5 . C5 . . . . .', 'D5 . . . E5 . G5 . . . E5 .', 'D5 . . . . . . . . . . .', 'E5 . . . G5 . A5 . . . C6 .', 'B5 . . . A5 . G5 . . . E5 .', 'D5 . . . E5 . D5 . . . B4 .', 'C5 . . . . . . . . . . .') },
      { type: 'triangle', vol: 0.07, notes: join(bass('C3', 'G2', 'waltz'), bass('A2', 'E3', 'waltz'), bass('F2', 'C3', 'waltz'), bass('G2', 'D3', 'waltz'), bass('C3', 'G2', 'waltz'), bass('E2', 'B2', 'waltz'), bass('F2', 'G2', 'waltz'), bass('C3', 'G2', 'waltz')) },
      { type: 'pulse12', vol: 0.02, notes: join('. . . . C4+E4 . . . C4+E4 . . .', '. . . . C4+E4 . . . C4+E4 . . .', '. . . . A3+C4 . . . A3+C4 . . .', '. . . . B3+D4 . . . B3+D4 . . .') },
    ],
  },
  // 1F 苗圃區
  floor1: {
    bpm: 128, div: 4,
    tracks: [
      { type: 'pulse25', vol: 0.04, notes: join(
        'C5 - E5 - G5 - E5 - A5 - G5 - E5 - D5 -', 'C5 - D5 - E5 - G5 - E5 - - - . . . .', 'F5 - A5 - C6 - A5 - G5 - E5 - C5 - D5 -', 'E5 - - - D5 - - - C5 - - - . . . .') },
      { type: 'pluck', vol: 0.04, decay: 0.3, notes: rep('C4 G4 E4 G4 C4 G4 E4 G4 A3 E4 C4 E4 A3 E4 C4 E4', 1) + ' ' + rep('F3 C4 A3 C4 F3 C4 A3 C4 G3 D4 B3 D4 G3 D4 B3 D4', 1) },
      { type: 'triangle', vol: 0.08, notes: join(bass('C3', 'G2', 'drive'), bass('A2', 'E3', 'drive'), bass('F2', 'C3', 'drive'), bass('G2', 'D3', 'drive')) },
      { type: 'drum', vol: 0.06, notes: 'k . h . s . h . k k h . s . h .' },
    ],
  },
  // 2F 藥草園
  floor2: {
    bpm: 136, div: 4, swing: 0.1,
    tracks: [
      { type: 'pulse25', vol: 0.04, notes: join(
        'D5 - F5 - A5 - - - G5 - F5 - D5 - - -', 'E5 - G5 - A5 - C6 - A5 - - - . . . .', 'D5 - F5 - A5 - - - C6 - A5 - G5 - F5 -', 'E5 - - - C5 - - - D5 - - - . . . .') },
      { type: 'pluck', vol: 0.04, decay: 0.3, notes: rep('D4 A4 F4 A4 D4 A4 F4 A4', 2) + ' ' + rep('C4 G4 E4 G4 C4 G4 E4 G4', 2) + ' ' + rep('Bb3 F4 D4 F4 Bb3 F4 D4 F4', 2) + ' ' + rep('A3 E4 C#4 E4 A3 E4 C#4 E4', 2) },
      { type: 'triangle', vol: 0.08, notes: join(bass('D3', 'A2', 'drive'), bass('C3', 'G2', 'drive'), bass('Bb2', 'F2', 'drive'), bass('A2', 'E2', 'drive')) },
      { type: 'drum', vol: 0.06, notes: 'k . h h s . h . k . h h s . h c' },
    ],
  },
  // 3F 玻璃穹頂
  floor3: {
    bpm: 144, div: 4,
    tracks: [
      { type: 'pulse25', vol: 0.04, vib: 0.5, notes: join(
        'A5 - - - E5 - A5 - C6 - B5 - A5 - E5 -', 'F5 - - - C5 - F5 - A5 - G5 - F5 - C5 -', 'G5 - - - D5 - G5 - B5 - A5 - G5 - D5 -', 'E5 - - - G#5 - - - B5 - - - E6 - - -') },
      { type: 'pulse12', vol: 0.03, notes: rep('A3 C4 E4 A4', 4) + ' ' + rep('F3 A3 C4 F4', 4) + ' ' + rep('G3 B3 D4 G4', 4) + ' ' + rep('E3 G#3 B3 E4', 4) },
      { type: 'triangle', vol: 0.09, notes: join(bass('A2', 'E2', 'drive'), bass('F2', 'C3', 'drive'), bass('G2', 'D3', 'drive'), bass('E2', 'B2', 'drive')) },
      { type: 'drum', vol: 0.07, notes: 'k . h . s . h k k . h . s . h h' },
    ],
  },
  // 守護者
  boss: {
    bpm: 156, div: 4,
    tracks: [
      { type: 'pulse25', vol: 0.045, notes: join('E5 - E5 . D5 - E5 . G5 - F#5 - E5 - B4 -', 'C5 - C5 . B4 - C5 . E5 - D5 - C5 - A4 -', 'E5 - E5 . D5 - E5 . G5 - A5 - B5 - G5 -', 'F#5 - - - D#5 - - - B4 - - - D#5 - F#5 -') },
      { type: 'square', vol: 0.022, notes: rep('E4 . E4 . B3 . E4 . G4 . E4 . B3 . E4 .', 1) + ' ' + rep('C4 . C4 . A3 . C4 . E4 . C4 . A3 . C4 .', 1) },
      { type: 'triangle', vol: 0.1, notes: join(bass('E2', 'B2', 'drive'), bass('C3', 'G2', 'drive'), bass('E2', 'B2', 'drive'), bass('B2', 'F#2', 'drive')) },
      { type: 'drum', vol: 0.09, notes: 'k . h k s . h . k k h . s . s s' },
    ],
  },
  // 商店
  shop: {
    bpm: 104, div: 4, swing: 0.15,
    tracks: [
      { type: 'pluck', vol: 0.055, decay: 0.35, notes: join('C5 . E5 . G5 . E5 . F5 . A5 . G5 . . .', 'E5 . G5 . C6 . G5 . A5 . F5 . D5 . . .', 'C5 . E5 . G5 . E5 . F5 . A5 . C6 . . .', 'B5 . G5 . D5 . B4 . C5 . . . . . . .') },
      { type: 'triangle', vol: 0.07, notes: join(bass('C3', 'G2'), bass('A2', 'F2'), bass('C3', 'F2'), bass('G2', 'C3')) },
      { type: 'drum', vol: 0.04, notes: 'w . . . c . . . w . w . c . . .' },
    ],
  },
  // 過關（播一次）
  victory: {
    bpm: 140, div: 4, loop: false,
    tracks: [
      { type: 'pulse25', vol: 0.05, notes: 'C5 . E5 . G5 . C6 - - - B5 . C6 . E6 - - - - - - - - - - - . . . .' },
      { type: 'triangle', vol: 0.08, notes: 'C3 . . . G2 . . . F2 . . . G2 . . . C3 - - - - - - - - - - - . . . .' },
      { type: 'drum', vol: 0.07, notes: 'k . . . s . . . k . k . s . . . k . . . . . . . . . . . . . . .' },
    ],
  },
  // 倒下（播一次）
  gameover: {
    bpm: 80, div: 4, loop: false,
    tracks: [
      { type: 'pluck', vol: 0.06, decay: 0.9, notes: 'E5 . . . D5 . . . C5 . . . B4 . . . A4 - - - - - - - . . . . . . . .' },
      { type: 'triangle', vol: 0.06, notes: 'A2 - - - - - - - E2 - - - - - - - A2 - - - - - - - . . . . . . . .' },
    ],
  },
};
