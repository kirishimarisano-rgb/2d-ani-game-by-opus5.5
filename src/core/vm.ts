import type { ChoiceOption, Cond, Program, Stmt, VMState } from './types';

export type Block = Extract<Stmt, { t: 'say' | 'choice' | 'wait' | 'chapter' | 'ending' }>;

export function newState(pc = 0): VMState {
  return { pc, vars: {}, flags: {}, scene: { bg: null, time: 'day', fx: [], chars: {}, music: null } };
}

export function cloneState(s: VMState): VMState {
  return JSON.parse(JSON.stringify(s));
}

export function checkCond(st: VMState, cond: Cond[]): boolean {
  return cond.every((c) => {
    if (c.kind === 'flag') return !!st.flags[c.flag] !== c.neg;
    const a = st.vars[c.v] ?? 0;
    const b = c.kind === 'cmp' ? c.n : (st.vars[c.w] ?? 0);
    switch (c.op) {
      case '>=': return a >= b;
      case '<=': return a <= b;
      case '>': return a > b;
      case '<': return a < b;
      case '==': return a === b;
      case '!=': return a !== b;
    }
  });
}

export function visibleOptions(st: VMState, s: Extract<Stmt, { t: 'choice' }>): { opt: ChoiceOption; index: number }[] {
  return s.options.map((opt, index) => ({ opt, index })).filter(({ opt }) => checkCond(st, opt.cond));
}

export class VM {
  constructor(public prog: Program, public st: VMState) {}

  /** 執行到下一個需要玩家（或時間）的指令。中途的場景指令透過 events 回報。 */
  run(onEvent?: (s: Stmt) => void, limit = 100000): Block | null {
    const { stmts, labels } = this.prog;
    const st = this.st;
    for (let guard = 0; guard < limit; guard++) {
      if (st.pc >= stmts.length) return null;
      const s = stmts[st.pc];
      switch (s.t) {
        case 'say':
        case 'choice':
        case 'wait':
        case 'chapter':
        case 'ending':
          return s;
        case 'jump':
          onEvent?.(s);
          st.pc = labels[s.target];
          continue;
        case 'if':
          onEvent?.(s);
          st.pc = checkCond(st, s.cond) ? labels[s.target] : st.pc + 1;
          continue;
        case 'set':
          st.flags[s.flag] = s.value;
          break;
        case 'add':
          st.vars[s.v] = (st.vars[s.v] ?? 0) + s.n;
          break;
        case 'bg':
          st.scene.bg = s.name;
          st.scene.time = s.time;
          st.scene.fx = s.fx;
          st.scene.chars = {};
          break;
        case 'show': {
          const prev = st.scene.chars[s.who];
          st.scene.chars[s.who] = { expr: s.expr, pos: s.pos ?? prev?.pos ?? 'center' };
          break;
        }
        case 'hide':
          if (s.who === 'all') st.scene.chars = {};
          else delete st.scene.chars[s.who];
          break;
        case 'music':
          st.scene.music = s.name === 'stop' ? null : s.name;
          break;
      }
      onEvent?.(s);
      st.pc++;
    }
    throw new Error('VM 卡在無限迴圈');
  }

  /** 推進已顯示的阻塞指令（台詞、等待、章節卡）。 */
  advance() {
    const s = this.prog.stmts[this.st.pc];
    if (s.t === 'say' && s.who && s.expr && this.st.scene.chars[s.who]) this.st.scene.chars[s.who].expr = s.expr;
    this.st.pc++;
  }

  choose(index: number) {
    const s = this.prog.stmts[this.st.pc];
    if (s.t !== 'choice') throw new Error('現在不是選項');
    const opt = s.options[index];
    for (const e of opt.effects) {
      if (e.kind === 'add') this.st.vars[e.v] = (this.st.vars[e.v] ?? 0) + e.n;
      else this.st.flags[e.flag] = e.value;
    }
    this.st.pc = opt.target ? this.prog.labels[opt.target] : this.st.pc + 1;
  }
}
