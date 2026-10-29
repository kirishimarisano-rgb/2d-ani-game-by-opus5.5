import type { VMState } from './core/types';

// localStorage 包一層：私密模式或被封鎖時不會讓遊戲壞掉。
const PREFIX = 'langwei_';

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* 存不了就算了 */
  }
}

export interface Settings {
  textSpeed: number; // 0–4
  autoSpeed: number; // 0–4
  bgm: number; // 0–10
  se: number; // 0–10
  skipAll: boolean;
}

export const DEFAULT_SETTINGS: Settings = { textSpeed: 2, autoSpeed: 2, bgm: 6, se: 7, skipAll: false };

export interface LogEntry {
  name: string | null;
  who: string | null;
  text: string;
}

export interface SaveData {
  v: 1;
  state: VMState;
  chapter: string;
  text: string;
  time: number;
  thumb: string;
  log: LogEntry[];
}

export const SLOTS = 3;

export const store = {
  settings: (): Settings => ({ ...DEFAULT_SETTINGS, ...read<Partial<Settings>>('settings', {}) }),
  saveSettings: (s: Settings) => write('settings', s),
  read: (): Set<string> => new Set(read<string[]>('read', [])),
  saveRead: (s: Set<string>) => write('read', [...s]),
  endings: (): string[] => read<string[]>('endings', []),
  saveEndings: (e: string[]) => write('endings', e),
  slot: (i: number): SaveData | null => read<SaveData | null>('slot' + i, null),
  saveSlot: (i: number, d: SaveData) => write('slot' + i, d),
};
