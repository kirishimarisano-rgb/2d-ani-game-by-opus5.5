// 劇本自動測試：解析全部劇本、檢查名稱與跳轉、窮舉所有分支。
// 執行：npm test
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BACKGROUNDS, BG_FX, EXPRESSIONS, FX, MUSIC, POSITIONS, SFX } from '../src/core/cast';
import { parse } from '../src/core/parser';
import { VM, cloneState, newState, visibleOptions } from '../src/core/vm';
import { GLYPH, TEXT_W, TEXT_W_FACE, textWidth, wrap } from '../src/core/wrap';

const EXPECTED_ENDINGS = ['xiaoman', 'shao', 'pei', 'normal'];

const dir = join(import.meta.dirname, '..', 'script');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.txt'))
  .sort()
  .map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }));

const prog = parse(files);
const errors = [...prog.errors];
const at = (s: { src: { file: string; line: number } }) => `${s.src.file}:${s.src.line}`;

// ---- 靜態檢查 ----
let chars = 0;
for (const s of prog.stmts) {
  switch (s.t) {
    case 'say': {
      chars += [...s.text].length;
      if (s.who && s.expr && !EXPRESSIONS[s.who].includes(s.expr)) errors.push(`${at(s)} ${s.who} 沒有表情 ${s.expr}`);
      const maxW = s.who === 'yan' ? TEXT_W_FACE : TEXT_W;
      for (const l of wrap(s.text, maxW))
        if (textWidth(l) > maxW + GLYPH) errors.push(`${at(s)} 這行超出對話框：${l}`);
      break;
    }
    case 'bg':
      if (!BACKGROUNDS[s.name]) errors.push(`${at(s)} 沒有背景 ${s.name}`);
      else if (!BACKGROUNDS[s.name].includes(s.time)) errors.push(`${at(s)} 背景 ${s.name} 沒有時段 ${s.time}`);
      for (const f of s.fx) if (!BG_FX.includes(f)) errors.push(`${at(s)} 沒有背景效果 ${f}`);
      break;
    case 'show':
      if (!EXPRESSIONS[s.who] || s.who === 'yan') errors.push(`${at(s)} 沒有立繪：${s.who}`);
      else if (!EXPRESSIONS[s.who].includes(s.expr)) errors.push(`${at(s)} ${s.who} 沒有表情 ${s.expr}`);
      if (s.pos && !POSITIONS.includes(s.pos)) errors.push(`${at(s)} 沒有位置 ${s.pos}`);
      break;
    case 'music':
      if (!MUSIC.includes(s.name)) errors.push(`${at(s)} 沒有音樂 ${s.name}`);
      break;
    case 'sfx':
      if (!SFX.includes(s.name)) errors.push(`${at(s)} 沒有音效 ${s.name}`);
      break;
    case 'fx':
      if (!FX.includes(s.name)) errors.push(`${at(s)} 沒有特效 ${s.name}`);
      break;
    case 'choice':
      for (const o of s.options)
        if (textWidth(o.text) > 240) errors.push(`${at(s)} 選項文字太長：${o.text}`);
      break;
  }
}
if (prog.labels.start === undefined) errors.push('找不到起點標籤 *start');

// ---- 窮舉分支 ----
const endings = new Map<string, number>();
const visited = new Set<number>();
const seen = new Set<string>();
const queue = [newState(prog.labels.start ?? 0)];
let paths = 0;

while (queue.length && errors.length < 50) {
  const st = queue.pop()!;
  const vm = new VM(prog, st);
  for (;;) {
    const before = st.pc;
    let block;
    try {
      block = vm.run(() => visited.add(st.pc));
    } catch (e) {
      errors.push(`從第 ${before} 句開始：${(e as Error).message}`);
      break;
    }
    if (!block) {
      const last = prog.stmts[Math.max(0, st.pc - 1)];
      errors.push(`劇本在沒有 @ending 的地方結束了（最後一句：${last ? at(last) : '?'}）`);
      break;
    }
    visited.add(st.pc);
    if (block.t === 'ending') {
      endings.set(block.id, (endings.get(block.id) ?? 0) + 1);
      paths++;
      break;
    }
    if (block.t === 'choice') {
      const opts = visibleOptions(st, block);
      if (opts.length === 0) errors.push(`${at(block)} 這個選項在某些狀態下一個都不能選（${JSON.stringify(st.vars)}）`);
      for (const { index } of opts) {
        const next = cloneState(st);
        new VM(prog, next).choose(index);
        const key = `${next.pc}|${JSON.stringify(next.vars)}|${JSON.stringify(next.flags)}`;
        if (!seen.has(key)) {
          seen.add(key);
          queue.push(next);
        }
      }
      break;
    }
    vm.advance();
  }
}

for (const id of EXPECTED_ENDINGS) if (!endings.has(id)) errors.push(`結局 ${id} 走不到`);

const unreachable = prog.stmts
  .map((s, i) => ({ s, i }))
  .filter(({ i }) => !visited.has(i))
  .map(({ s }) => at(s));
if (unreachable.length) errors.push(`有 ${unreachable.length} 句永遠走不到，例如：${unreachable.slice(0, 5).join(', ')}`);

console.log(`劇本檔案：${files.map((f) => f.name).join(', ')}`);
console.log(`台詞與旁白：${prog.stmts.filter((s) => s.t === 'say').length} 句，${chars} 字`);
console.log(`走過的分支狀態：${seen.size}，到達結局的路徑：${paths}`);
console.log(`結局：${[...endings].map(([k, v]) => `${k}×${v}`).join('、')}`);

if (errors.length) {
  console.error(`\n✗ ${errors.length} 個問題：`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('\n✓ 所有結局都能到達，沒有斷掉的跳轉');
