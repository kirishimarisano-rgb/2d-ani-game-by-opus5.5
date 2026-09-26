// 《月下神樂》背景音樂：五聲音階（陽音階／陰音階）寫成的晶片音樂，譜的格式見 engine/music.js。
const join = (...parts) => parts.join(' ');
const rep = (s, n) => Array(n).fill(s).join(' ');
/** 依和弦根音產生低音線（每小節 16 格）：root、fifth */
function bassBar(root, fifth, style = 'drive') {
  if (style === 'drive') return `${root} . ${root} . ${fifth} . ${root} . ${root} . ${root} . ${fifth} . ${root} .`;
  if (style === 'half') return `${root} - - - - - - - ${fifth} - - - - - - -`;
  if (style === 'walk') return `${root} . . . ${fifth} . . . ${root} . . . ${fifth} . ${root} .`;
  return `${root} - - - - - - - - - - - - - - -`;
}
const BAR_REST = rep('.', 16);

export const SONGS = {
  // 標題：鈴聲慢板＋撥弦
  title: {
    bpm: 76, div: 4,
    tracks: [
      { type: 'bell', vol: 0.07, notes: join('D5 . . . . . A4 . G4 . . . E4 . . .', 'D4 . . . . . E4 . G4 . . . A4 . . .', 'B4 . . . . . A4 . G4 . E4 . D4 . . .', 'E4 . . . . . . . . . . . . . . .') },
      { type: 'pluck', vol: 0.05, decay: 0.6, notes: rep('D4 . A4 . D5 . A4 . E5 . A4 . D5 . A4 .', 2) + ' ' + rep('G3 . D4 . G4 . D4 . A4 . D4 . G4 . D4 .', 1) + ' ' + rep('A3 . E4 . A4 . E4 . B4 . E4 . A4 . E4 .', 1) },
      { type: 'triangle', vol: 0.07, notes: join(bassBar('D3', 'A2', 'long'), bassBar('D3', 'A2', 'long'), bassBar('G2', 'D3', 'long'), bassBar('A2', 'E3', 'long')) },
    ],
  },
  // 神社繪卷（地圖）：撥弦小調
  map: {
    bpm: 96, div: 4,
    tracks: [
      { type: 'pluck', vol: 0.06, decay: 0.5, notes: join('A4 . B4 . D5 . . . E5 . D5 . B4 . . .', 'G4 . A4 . B4 . . . D5 . B4 . A4 . . .', 'E4 . G4 . A4 . . . B4 . A4 . G4 . E4 .', 'D4 . . . E4 . . . D4 . . . . . . .') },
      { type: 'pulse12', vol: 0.025, notes: join('D4+A4 - - - - - - - - - - - - - - -', 'G3+D4 - - - - - - - - - - - - - - -', 'E3+B3 - - - - - - - - - - - - - - -', 'A3+E4 - - - - - - - - - - - - - - -') },
      { type: 'triangle', vol: 0.07, notes: join(bassBar('D3', 'A2', 'walk'), bassBar('G2', 'D3', 'walk'), bassBar('E2', 'B2', 'walk'), bassBar('A2', 'E3', 'walk')) },
      { type: 'drum', vol: 0.05, notes: 'w . . . . . w . . . w . . . . .' },
    ],
  },
  // 第一關：祭典（太鼓＋笛）
  stage1: {
    bpm: 132, div: 4,
    tracks: [
      { type: 'pulse25', vol: 0.045, vib: 1, notes: join(
        'D5 - E5 - G5 - - A5 G5 - E5 - D5 - - -', 'E5 - G5 - A5 - B5 - A5 - G5 - E5 - - -', 'D6 - B5 - A5 - G5 - A5 - B5 - A5 - G5 -', 'E5 - - - G5 - E5 - D5 - - - - - . .',
        'A4 - B4 - D5 - - E5 D5 - B4 - A4 - - -', 'B4 - D5 - E5 - G5 - E5 - D5 - B4 - - -', 'D5 - E5 - G5 - A5 - B5 - A5 - G5 - E5 -', 'D5 - - - - - - - . . . . . . . .') },
      { type: 'pulse12', vol: 0.025, notes: join('D4+A4 - - - - - - - D4+A4 - - - - - - -', 'E4+B4 - - - - - - - E4+B4 - - - - - - -', 'G4+D5 - - - - - - - G4+D5 - - - - - - -', 'A4+E5 - - - - - - - A4+D5 - - - - - - -',
        'D4+A4 - - - - - - - D4+A4 - - - - - - -', 'G3+D4 - - - - - - - G3+D4 - - - - - - -', 'A3+E4 - - - - - - - A3+E4 - - - - - - -', 'D4+A4 - - - - - - - - - - - - - - -') },
      { type: 'triangle', vol: 0.09, notes: join(bassBar('D3', 'A2'), bassBar('E3', 'B2'), bassBar('G2', 'D3'), bassBar('A2', 'E3'), bassBar('D3', 'A2'), bassBar('G2', 'D3'), bassBar('A2', 'E3'), bassBar('D3', 'A2')) },
      { type: 'drum', vol: 0.08, notes: 't . h . w . h t t . h . w . h . t . h . w . h t t . w . w w h .' },
    ],
  },
  // 第二關：竹林（尺八風的笛聲、木魚）
  stage2: {
    bpm: 108, div: 4,
    tracks: [
      { type: 'triangle', vol: 0.07, vib: 1.5, attack: 0.03, notes: join(
        'E5 - - - - - D5 - B4 - - - A4 - - -', 'B4 - - - D5 - - - E5 - - - - - - -', 'G5 - - - E5 - D5 - E5 - - - B4 - - -', 'A4 - - - - - - - . . . . . . . .',
        'E5 - - - G5 - - - A5 - - - G5 - E5 -', 'D5 - - - E5 - - - B4 - - - - - - -', 'A4 - B4 - D5 - E5 - D5 - B4 - A4 - - -', 'E4 - - - - - - - . . . . . . . .') },
      { type: 'pluck', vol: 0.045, decay: 0.35, notes: rep('E3 . B3 . E4 . B3 . D4 . B3 . E4 . B3 .', 2) + ' ' + rep('A2 . E3 . A3 . E3 . B3 . E3 . A3 . E3 .', 2) },
      { type: 'triangle', vol: 0.06, notes: join(bassBar('E2', 'B2', 'half'), bassBar('E2', 'B2', 'half'), bassBar('A2', 'E2', 'half'), bassBar('B2', 'E2', 'half')) },
      { type: 'drum', vol: 0.06, notes: 'w . . w . . w . k . w . . . w . w . . w . . w . k . w . w . w .' },
    ],
  },
  // 第三關：本殿（陰音階的撥弦＋鈴）
  stage3: {
    bpm: 100, div: 4,
    tracks: [
      { type: 'pluck', vol: 0.06, decay: 0.55, notes: join(
        'E4 . F4 . A4 . . . B4 . A4 . F4 . E4 .', 'C5 . B4 . A4 . . . F4 . . . E4 . . .', 'E5 . C5 . B4 . A4 . B4 . C5 . B4 . A4 .', 'F4 . . . E4 . . . . . . . . . . .') },
      { type: 'bell', vol: 0.04, notes: join('E5 . . . . . . . . . . . . . . .', BAR_REST, 'B5 . . . . . . . . . . . . . . .', 'A5 . . . . . . . F5 . . . . . . .') },
      { type: 'triangle', vol: 0.08, notes: join(bassBar('E2', 'B2', 'walk'), bassBar('A2', 'E2', 'walk'), bassBar('F2', 'C3', 'walk'), bassBar('E2', 'B2', 'walk')) },
      { type: 'drum', vol: 0.05, notes: 'k . . . w . . . k . . w . . w . k . . . w . . . k . w . w . . .' },
    ],
  },
  // 第四關：地下祭壇（低音脈動）
  stage4: {
    bpm: 120, div: 4,
    tracks: [
      { type: 'pulse25', vol: 0.035, notes: join(
        'A4 - - - C5 - - - B4 - A4 - F4 - - -', 'E4 - - - - - - - F4 - E4 - C4 - - -', 'A4 - - - E5 - - - D5 - C5 - B4 - - -', 'A4 - - - - - - - . . . . . . . .') },
      { type: 'square', vol: 0.03, notes: rep('A2 . A2 . A2 . A2 . A2 . A2 . A2 . A2 .', 2) + ' ' + rep('F2 . F2 . F2 . F2 . E2 . E2 . E2 . E2 .', 2) },
      { type: 'triangle', vol: 0.08, notes: join(bassBar('A1', 'E2', 'long'), bassBar('A1', 'E2', 'long'), bassBar('F1', 'C2', 'long'), bassBar('E1', 'B1', 'long')) },
      { type: 'drum', vol: 0.07, notes: 'k . . . s . . k . k . . s . . . k . . . s . . k . k . . s . s s' },
    ],
  },
  // 守護妖
  boss: {
    bpm: 152, div: 4,
    tracks: [
      { type: 'pulse25', vol: 0.045, notes: join(
        'E5 - E5 . G5 - E5 . A5 - G5 - E5 - D5 -', 'E5 - - - B4 - - - D5 - - - E5 - - -', 'G5 - G5 . A5 - G5 . B5 - A5 - G5 - E5 -', 'A5 - - - G5 - - - E5 - D5 - E5 - - -') },
      { type: 'square', vol: 0.025, notes: rep('E4 . E4 . G4 . E4 . A4 . E4 . G4 . E4 .', 4) },
      { type: 'triangle', vol: 0.1, notes: join(bassBar('E2', 'B2'), bassBar('E2', 'B2'), bassBar('C3', 'G2'), bassBar('D3', 'A2')) },
      { type: 'drum', vol: 0.09, notes: 't . h t s . h . t . h t s . h h t . h t s . h . t t h t s . s s' },
    ],
  },
  // 最終戰：月蝕大蛇
  final: {
    bpm: 162, div: 4,
    tracks: [
      { type: 'pulse25', vol: 0.045, vib: 0.6, notes: join(
        'A5 - - - G5 - F5 - E5 - - - C5 - D5 -', 'E5 - - - - - - - A4 - B4 - C5 - D5 -', 'E5 - - - F5 - E5 - D5 - C5 - B4 - C5 -', 'A4 - - - - - - - E5 - - - A5 - - -') },
      { type: 'pulse12', vol: 0.03, notes: rep('A3 E4 A4 E4 A3 E4 A4 E4 F3 C4 F4 C4 F3 C4 F4 C4', 1) + ' ' + rep('D3 A3 D4 A3 D3 A3 D4 A3 E3 B3 E4 B3 E3 B3 E4 B3', 1) },
      { type: 'triangle', vol: 0.1, notes: join(bassBar('A2', 'E2'), bassBar('F2', 'C3'), bassBar('D2', 'A2'), bassBar('E2', 'B2')) },
      { type: 'drum', vol: 0.1, notes: 'k . h k s . h . k k h . s . h h k . h k s . h . k k h k s s s s' },
    ],
  },
  // 茶屋
  shop: {
    bpm: 88, div: 4, swing: 0.12,
    tracks: [
      { type: 'pluck', vol: 0.06, decay: 0.4, notes: join('G4 . A4 . B4 . D5 . B4 . A4 . G4 . . .', 'E4 . G4 . A4 . B4 . A4 . G4 . E4 . . .', 'D4 . E4 . G4 . A4 . B4 . D5 . E5 . . .', 'D5 . B4 . A4 . G4 . . . . . . . . .') },
      { type: 'triangle', vol: 0.07, notes: join(bassBar('G2', 'D3', 'walk'), bassBar('E2', 'B2', 'walk'), bassBar('D2', 'A2', 'walk'), bassBar('G2', 'D3', 'walk')) },
      { type: 'drum', vol: 0.045, notes: 'w . . w . . w . w . . w . w . .' },
    ],
  },
  // 過關（播一次）
  clear: {
    bpm: 140, div: 4, loop: false,
    tracks: [
      { type: 'pulse25', vol: 0.05, notes: 'D5 . E5 . G5 . A5 . B5 - - - A5 . B5 . D6 - - - - - - - - - - - . . . .' },
      { type: 'bell', vol: 0.05, notes: 'D5 . . . . . . . G5 . . . . . . . D6 . . . . . . . . . . . . . . .' },
      { type: 'triangle', vol: 0.08, notes: 'D3 . . . G2 . . . A2 . . . . . . . D3 - - - - - - - - - - - . . . .' },
      { type: 'drum', vol: 0.08, notes: 't . . . t . . . t . t . t . . . t . . . . . . . . . . . . . . .' },
    ],
  },
  // 結局
  ending: {
    bpm: 72, div: 4,
    tracks: [
      { type: 'bell', vol: 0.06, notes: join('D5 . . . E5 . . . G5 . . . A5 . . .', 'B5 . . . A5 . . . G5 . . . . . . .', 'E5 . . . G5 . . . A5 . . . G5 . E5 .', 'D5 . . . . . . . . . . . . . . .') },
      { type: 'pluck', vol: 0.045, decay: 0.8, notes: rep('D4 A4 D5 E5 A4 D5 E5 A5', 2) + ' ' + rep('G3 D4 G4 A4 D4 G4 A4 D5', 2) + ' ' + rep('E4 B4 E5 G5 B4 E5 G5 B5', 2) + ' ' + rep('A3 E4 A4 D5 E4 A4 D5 E5', 2) },
      { type: 'triangle', vol: 0.07, notes: join(bassBar('D3', 'A2', 'long'), bassBar('G2', 'D3', 'long'), bassBar('E2', 'B2', 'long'), bassBar('A2', 'E3', 'long')) },
    ],
  },
};
