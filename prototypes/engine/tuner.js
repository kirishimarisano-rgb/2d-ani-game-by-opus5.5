// 調參面板：由資料（schema）產生滑桿／開關／選單，數值即時生效並自動記在瀏覽器。
// 支援：風格預設、全部重設、單項還原（雙擊名稱）、複製／貼上 JSON、A/B 比較。

const decimals = st => (String(st).split('.')[1] || '').length;
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

export class Tuner {
  constructor(host, { storageKey, groups, presets = {}, intro }) {
    this.host = host;
    this.storageKey = storageKey;
    this.groups = groups;
    this.presets = presets;
    this.values = {};
    this.defaults = {};
    this.items = new Map();
    this.rows = new Map();
    this.listeners = [];
    this.ab = { A: null, B: null };
    for (const g of groups) for (const it of g.items) {
      it.type = it.type || 'range';
      it.group = g;
      this.items.set(it.key, it);
      this.defaults[it.key] = it.value;
      this.values[it.key] = it.value;
    }
    this._load();
    this._build(intro);
  }
  get count() { return this.items.size; }
  onChange(fn) { this.listeners.push(fn); }

  _coerce(it, v) {
    if (it.type === 'toggle') return v === true || v === 'true' || v === 1;
    if (it.type === 'select') return it.options.some(o => String(o[0]) === String(v)) ? it.options.find(o => String(o[0]) === String(v))[0] : it.value;
    v = Number(v);
    if (!Number.isFinite(v)) return it.value;
    v = Math.min(it.max, Math.max(it.min, v));
    const st = it.step || 1;
    v = Math.round((v - it.min) / st) * st + it.min;
    return +v.toFixed(Math.max(decimals(st), decimals(it.min)));
  }
  set(key, v, { save = true, quiet = false } = {}) {
    const it = this.items.get(key);
    if (!it) return false;
    v = this._coerce(it, v);
    const changed = v !== this.values[key];
    this.values[key] = v;
    this._syncRow(key);
    if (save) this._save();
    if (changed && !quiet) for (const fn of this.listeners) fn(key, v);
    return true;
  }
  changed() {
    const out = {};
    for (const [k, v] of Object.entries(this.values)) if (v !== this.defaults[k]) out[k] = v;
    return out;
  }
  applyObject(obj, { resetFirst = false } = {}) {
    let n = 0;
    if (resetFirst) for (const k of this.items.keys()) this.set(k, this.defaults[k], { save: false });
    for (const [k, v] of Object.entries(obj || {})) if (this.set(k, v, { save: false })) n++;
    this._save();
    return n;
  }
  resetAll() { this.applyObject({}, { resetFirst: true }); }

  _load() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
      for (const [k, v] of Object.entries(saved)) { const it = this.items.get(k); if (it) this.values[k] = this._coerce(it, v); }
      const ab = JSON.parse(localStorage.getItem(this.storageKey + '/ab') || '{}');
      this.ab.A = ab.A || null; this.ab.B = ab.B || null;
    } catch { /* 無法使用 localStorage 時只是不記憶 */ }
  }
  _save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.changed()));
      localStorage.setItem(this.storageKey + '/ab', JSON.stringify(this.ab));
    } catch { /* 忽略 */ }
    this._syncGroupBadges();
  }
  msg(text) {
    this.msgEl.textContent = text;
    clearTimeout(this._msgT);
    this._msgT = setTimeout(() => { this.msgEl.textContent = ''; }, 2600);
  }

  // ---------------- DOM ----------------
  _build(intro) {
    const root = el('div', 'tn');
    const head = el('div', 'tn-head');
    const title = el('div', 'tn-title');
    title.append(el('span', null, '調參面板'), el('span', 'tn-kbd', '` 鍵開關'));
    head.append(title);

    const tools = el('div', 'tn-tools');
    const presetSel = el('select', 'tn-preset');
    presetSel.append(new Option('套用風格預設…', ''));
    for (const name of Object.keys(this.presets)) presetSel.append(new Option(name, name));
    presetSel.addEventListener('change', () => {
      const name = presetSel.value;
      if (!name) return;
      this.applyObject(this.presets[name], { resetFirst: true });
      this.msg(`已套用「${name}」`);
      presetSel.value = ''; presetSel.blur();
    });
    const btn = (label, fn, title) => { const b = el('button', 'tn-btn', label); b.type = 'button'; if (title) b.title = title; b.addEventListener('click', e => { fn(e); b.blur(); }); return b; };
    tools.append(presetSel,
      btn('全部重設', () => { this.resetAll(); this.msg('已恢復全部預設值'); }),
      btn('複製', () => this._copy(), '把修改過的參數以 JSON 複製到剪貼簿'),
      btn('貼上', () => { this.importBox.hidden = !this.importBox.hidden; if (!this.importBox.hidden) this.importText.focus(); }, '貼上之前複製的參數 JSON'));
    head.append(tools);

    const ab = el('div', 'tn-ab');
    ab.append(el('span', 'tn-ab-label', 'A/B 比較'));
    for (const slot of ['A', 'B']) {
      const g = el('span', 'tn-ab-slot');
      const save = btn(`存 ${slot}`, () => { this.ab[slot] = { ...this.values }; this._save(); this._syncAB(); this.msg(`目前的參數已存到 ${slot}`); });
      const load = btn(`套用 ${slot}`, () => { if (!this.ab[slot]) return; this.applyObject(this.ab[slot], { resetFirst: true }); this._syncAB(slot); this.msg(`已切換到 ${slot}`); });
      load.dataset.slot = slot;
      g.append(save, load);
      ab.append(g);
    }
    this.abEl = ab;
    head.append(ab);

    const box = el('div', 'tn-import'); box.hidden = true;
    const ta = el('textarea'); ta.rows = 4; ta.placeholder = '{ "參數名稱": 數值, ... }';
    box.append(ta, btn('套用', () => {
      try {
        const n = this.applyObject(JSON.parse(ta.value || '{}'));
        this.msg(`已套用 ${n} 個參數`); box.hidden = true; ta.value = '';
      } catch { this.msg('格式錯誤：請貼上 JSON'); }
    }), btn('取消', () => { box.hidden = true; }));
    this.importBox = box; this.importText = ta;
    head.append(box);

    this.msgEl = el('div', 'tn-msg'); this.msgEl.setAttribute('aria-live', 'polite');
    head.append(this.msgEl);
    root.append(head);

    if (intro) root.append(this._intro(intro));

    for (const g of this.groups) {
      const d = el('details', 'tn-group');
      d.open = g.open !== false;
      const sum = el('summary');
      sum.append(el('span', null, g.name));
      const badge = el('span', 'tn-badge'); badge.hidden = true;
      sum.append(badge);
      g._badge = badge;
      d.append(sum);
      if (g.note) d.append(el('p', 'tn-note', g.note));
      for (const it of g.items) d.append(this._row(it));
      root.append(d);
    }
    this.host.append(root);
    this._syncGroupBadges();
    this._syncAB();
  }
  _intro(intro) {
    const d = el('details', 'tn-intro');
    d.open = true;
    d.append(el('summary', null, '這個原型要感受什麼'));
    if (intro.pitch) d.append(el('p', 'tn-pitch', intro.pitch));
    if (intro.goals) { const ul = el('ul'); intro.goals.forEach(t => ul.append(el('li', null, t))); d.append(ul); }
    if (intro.controls) {
      const t = el('table', 'tn-keys');
      for (const [k, v] of intro.controls) { const tr = el('tr'); tr.append(el('th', null, k), el('td', null, v)); t.append(tr); }
      d.append(t);
    }
    return d;
  }
  _row(it) {
    const row = el('div', 'tn-row is-' + it.type);
    row.dataset.key = it.key;
    const label = el('label', 'tn-label');
    const name = el('span', 'tn-name', it.label);
    name.title = '雙擊還原預設值';
    name.addEventListener('dblclick', () => { this.set(it.key, this.defaults[it.key]); this.msg(`「${it.label}」已還原`); });
    const mod = el('span', 'tn-mod', '●'); mod.title = '已修改';
    label.append(name, mod);
    row.append(label);
    const r = { row, mod };
    if (it.type === 'range') {
      const valBox = el('span', 'tn-val');
      const num = el('input', 'tn-num');
      num.type = 'number'; num.min = it.min; num.max = it.max; num.step = it.step || 1;
      num.addEventListener('change', () => this.set(it.key, num.value));
      num.addEventListener('keydown', e => { if (e.key === 'Enter') num.blur(); });
      valBox.append(num);
      valBox.append(el('span', 'tn-unit', it.unit || ''));
      row.append(valBox);
      const range = el('input', 'tn-range');
      range.type = 'range'; range.min = it.min; range.max = it.max; range.step = it.step || 1;
      range.addEventListener('input', () => this.set(it.key, range.value));
      range.addEventListener('change', () => range.blur());
      range.addEventListener('pointerup', () => setTimeout(() => range.blur(), 0));
      row.append(range);
      Object.assign(r, { num, range });
    } else if (it.type === 'toggle') {
      const cb = el('input', 'tn-check');
      cb.type = 'checkbox';
      cb.addEventListener('change', () => { this.set(it.key, cb.checked); cb.blur(); });
      label.prepend(cb);
      Object.assign(r, { cb });
    } else if (it.type === 'select') {
      const sel = el('select', 'tn-select');
      for (const [v, t] of it.options) sel.append(new Option(t, v));
      sel.addEventListener('change', () => { this.set(it.key, sel.value); sel.blur(); });
      row.append(sel);
      Object.assign(r, { sel });
    }
    if (it.hint) row.append(el('div', 'tn-hint', it.hint));
    this.rows.set(it.key, r);
    this._syncRow(it.key);
    return row;
  }
  _syncRow(key) {
    const r = this.rows.get(key);
    if (!r) return;
    const v = this.values[key];
    if (r.range) { r.range.value = v; if (document.activeElement !== r.num) r.num.value = v; }
    if (r.cb) r.cb.checked = !!v;
    if (r.sel) r.sel.value = String(v);
    const modified = v !== this.defaults[key];
    r.mod.hidden = !modified;
    r.row.classList.toggle('is-mod', modified);
  }
  _syncGroupBadges() {
    for (const g of this.groups) {
      if (!g._badge) continue;
      const n = g.items.filter(it => this.values[it.key] !== this.defaults[it.key]).length;
      g._badge.hidden = !n;
      g._badge.textContent = n + ' 項已改';
    }
  }
  _syncAB(active) {
    if (!this.abEl) return;
    for (const b of this.abEl.querySelectorAll('button[data-slot]')) {
      b.disabled = !this.ab[b.dataset.slot];
      b.classList.toggle('on', b.dataset.slot === active);
    }
  }
  async _copy() {
    const text = JSON.stringify(this.changed(), null, 2);
    try { await navigator.clipboard.writeText(text); this.msg('已複製修改過的參數（JSON）'); }
    catch { this.importBox.hidden = false; this.importText.value = text; this.importText.select(); this.msg('請手動複製下方文字'); }
  }
}
