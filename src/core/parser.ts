import { CAST } from './cast';
import type { ChoiceOption, CmpOp, Cond, Effect, Program, SrcPos, Stmt } from './types';

export interface ScriptFile {
  name: string;
  text: string;
}

const CMP_RE = /^([a-z_][a-z0-9_]*)\s*(>=|<=|==|!=|>|<)\s*(-?\d+|[a-z_][a-z0-9_]*)$/;

export function parseCond(src: string): Cond[] {
  return src
    .split('&&')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part): Cond => {
      const m = part.match(CMP_RE);
      if (m) {
        const op = m[2] as CmpOp;
        if (/^-?\d+$/.test(m[3])) return { kind: 'cmp', v: m[1], op, n: Number(m[3]) };
        return { kind: 'cmpv', v: m[1], op, w: m[3] };
      }
      const neg = part.startsWith('!');
      const flag = neg ? part.slice(1).trim() : part;
      if (!/^[a-z_][a-z0-9_]*$/.test(flag)) throw new Error(`看不懂的條件：${part}`);
      return { kind: 'flag', flag, neg };
    });
}

function parseEffects(src: string): Effect[] {
  return src
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((e): Effect => {
      let m = e.match(/^([a-z_][a-z0-9_]*)\s*([+-])\s*(\d+)$/);
      if (m) return { kind: 'add', v: m[1], n: (m[2] === '-' ? -1 : 1) * Number(m[3]) };
      m = e.match(/^(!?)flag:([a-z_][a-z0-9_]*)$/);
      if (m) return { kind: 'flag', flag: m[2], value: m[1] !== '!' };
      throw new Error(`看不懂的效果：${e}`);
    });
}

// > 選項文字 => 標籤 {xiaoman+1, flag:x} ?xiaoman>=4
const OPT_RE = /^>\s*(.+?)\s*=>\s*(\S+)\s*(?:\{([^}]*)\})?\s*(?:\?(.+))?$/;
// 名[顯示名](表情)：台詞
const SAY_RE = /^([^\s：:@#>*/(（[]{1,8})(?:\[([^\]]+)\])?(?:[(（]([a-z]+)[)）])?：(.+)$/;

export function parse(files: ScriptFile[]): Program {
  const stmts: Stmt[] = [];
  const labels: Record<string, number> = {};
  const errors: string[] = [];

  for (const file of files) {
    const lines = file.text.split(/\r?\n/);
    let choice: { options: ChoiceOption[]; src: SrcPos } | null = null;

    lines.forEach((raw, i) => {
      const src: SrcPos = { file: file.name, line: i + 1 };
      const line = raw.trim();
      const where = `${file.name}:${i + 1}`;
      if (!line || line.startsWith('//')) return;

      try {
        if (choice) {
          if (line === '#end') {
            if (choice.options.length === 0) errors.push(`${where} 選項是空的`);
            stmts.push({ t: 'choice', options: choice.options, src: choice.src });
            choice = null;
            return;
          }
          const m = line.match(OPT_RE);
          if (!m) {
            errors.push(`${where} 選項格式錯誤：${line}`);
            return;
          }
          choice.options.push({
            text: m[1],
            target: m[2] === '-' ? null : m[2],
            effects: m[3] ? parseEffects(m[3]) : [],
            cond: m[4] ? parseCond(m[4]) : [],
          });
          return;
        }

        if (line.startsWith('*')) {
          const name = line.slice(1).trim();
          if (labels[name] !== undefined) errors.push(`${where} 標籤重複：${name}`);
          labels[name] = stmts.length;
          return;
        }

        if (line === '#choice') {
          choice = { options: [], src };
          return;
        }

        if (line.startsWith('@')) {
          const [cmd, ...args] = line.slice(1).split(/\s+/);
          const rest = line.slice(1 + cmd.length).trim();
          switch (cmd) {
            case 'bg':
              stmts.push({ t: 'bg', name: args[0], time: args[1] ?? 'day', fx: args.slice(2), src });
              break;
            case 'show':
              stmts.push({ t: 'show', who: args[0], expr: args[1] ?? 'normal', pos: args[2] ?? null, src });
              break;
            case 'hide':
              stmts.push({ t: 'hide', who: args[0] ?? 'all', src });
              break;
            case 'music':
              stmts.push({ t: 'music', name: args[0], src });
              break;
            case 'sfx':
              stmts.push({ t: 'sfx', name: args[0], src });
              break;
            case 'fx':
              stmts.push({ t: 'fx', name: args[0], src });
              break;
            case 'wait':
              stmts.push({ t: 'wait', ms: Number(args[0] ?? 500), src });
              break;
            case 'jump':
              stmts.push({ t: 'jump', target: args[0], src });
              break;
            case 'if': {
              const m = rest.match(/^(.+?)\s*=>\s*(\S+)$/);
              if (!m) throw new Error(`@if 格式錯誤：${line}`);
              stmts.push({ t: 'if', cond: parseCond(m[1]), target: m[2], src });
              break;
            }
            case 'set':
              stmts.push({ t: 'set', flag: args[0].replace(/^!/, ''), value: !args[0].startsWith('!'), src });
              break;
            case 'add':
              stmts.push({ t: 'add', v: args[0], n: Number(args[1] ?? 1), src });
              break;
            case 'chapter':
              stmts.push({ t: 'chapter', text: rest, src });
              break;
            case 'ending':
              stmts.push({ t: 'ending', id: args[0], title: args.slice(1).join(' '), src });
              break;
            default:
              errors.push(`${where} 未知指令：@${cmd}`);
          }
          return;
        }

        const m = line.match(SAY_RE);
        if (m) {
          const who = CAST[m[1]] ?? null;
          stmts.push({ t: 'say', who, name: m[2] ?? m[1], expr: m[3] ?? null, text: m[4].trim(), src });
          return;
        }
        stmts.push({ t: 'say', who: null, name: null, expr: null, text: line, src });
      } catch (e) {
        errors.push(`${where} ${(e as Error).message}`);
      }
    });
    if (choice) errors.push(`${file.name} 有 #choice 沒有 #end`);
  }

  // 檢查跳轉目標
  for (const s of stmts) {
    const at = `${s.src.file}:${s.src.line}`;
    if ((s.t === 'jump' || s.t === 'if') && labels[s.target] === undefined) errors.push(`${at} 找不到標籤：${s.target}`);
    if (s.t === 'choice')
      for (const o of s.options)
        if (o.target && labels[o.target] === undefined) errors.push(`${at} 選項找不到標籤：${o.target}`);
  }
  return { stmts, labels, errors };
}
