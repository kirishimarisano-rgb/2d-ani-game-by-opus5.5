// 劇本裡的名字 → 角色 id。有 id 的角色會有立繪或頭像。
export const CAST: Record<string, string> = {
  小滿: 'xiaoman',
  韶: 'shao',
  佩: 'pei',
  晏: 'yan',
};

// 沒有立繪的配角（劇本裡出現其他名字會被測試抓出來，避免旁白被誤判成台詞）
export const SIDE_NAMES = ['阿嬤', '程伯', '許爸', '里長', '廣播', '媽媽', '阿伯', '小孩', '客人', '眾人', '？？？'];

export const HEROINES = ['xiaoman', 'shao', 'pei'];

// 每個角色可用的表情
export const EXPRESSIONS: Record<string, string[]> = {
  xiaoman: ['normal', 'smile', 'shy', 'sad', 'angry'],
  shao: ['normal', 'smile', 'shy', 'sad', 'surprised'],
  pei: ['normal', 'smile', 'shy', 'sad', 'serious'],
  yan: ['normal', 'smile', 'troubled', 'surprised'],
};

export const BACKGROUNDS: Record<string, string[]> = {
  train: ['day', 'dusk', 'night'],
  station: ['day', 'dusk', 'night'],
  shop: ['day', 'night'],
  street: ['day', 'dusk', 'night'],
  seawall: ['day', 'dusk', 'night'],
  warehouse: ['day', 'dusk', 'night'],
  room: ['day', 'night'],
  temple: ['night'],
  black: ['day'],
};

export const BG_FX = ['rain', 'fireworks'];
export const MUSIC = ['title', 'daily', 'sad', 'night', 'stop'];
export const SFX = ['select', 'bell', 'door', 'train', 'tape', 'phone'];
export const FX = ['shake', 'flash'];
export const POSITIONS = ['left', 'center', 'right'];

// 文字嗶聲的音高（Hz），每個角色不同
export const VOICE: Record<string, number> = {
  xiaoman: 880,
  shao: 1175,
  pei: 587,
  yan: 440,
  other: 659,
  narration: 0,
};
