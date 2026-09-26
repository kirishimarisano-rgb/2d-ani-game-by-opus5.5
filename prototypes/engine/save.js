// 存檔：localStorage 讀寫 JSON，與預設值深度合併（新版本新增的欄位會自動補上）。
const clone = v => JSON.parse(JSON.stringify(v));
function merge(base, over) {
  if (base === null) return over === undefined ? null : over;
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    if (over && typeof over === 'object' && !Array.isArray(over)) for (const k of Object.keys(over)) out[k] = k in base ? merge(base[k], over[k]) : over[k];
    return out;
  }
  return over === undefined || over === null || typeof over !== typeof base ? base : over;
}

export class SaveData {
  constructor(key, defaults) {
    this.key = key;
    this.defaults = defaults;
    this.data = clone(defaults);
    this.exists = false;
    try {
      const raw = localStorage.getItem(key);
      if (raw) { this.data = merge(clone(defaults), JSON.parse(raw)); this.exists = true; }
    } catch { /* 無法讀取就用預設值 */ }
  }
  save() {
    this.exists = true;
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch { /* 無痕模式等 */ }
  }
  reset() {
    this.data = clone(this.defaults);
    this.exists = false;
    try { localStorage.removeItem(this.key); } catch { /* 忽略 */ }
  }
}
