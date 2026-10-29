export interface SrcPos {
  file: string;
  line: number;
}

export type CmpOp = '>=' | '<=' | '>' | '<' | '==' | '!=';

export type Cond =
  | { kind: 'cmp'; v: string; op: CmpOp; n: number }
  | { kind: 'cmpv'; v: string; op: CmpOp; w: string }
  | { kind: 'flag'; flag: string; neg: boolean };

export type Effect = { kind: 'add'; v: string; n: number } | { kind: 'flag'; flag: string; value: boolean };

export interface ChoiceOption {
  text: string;
  target: string | null; // null = 選完繼續往下
  effects: Effect[];
  cond: Cond[];
}

export type Stmt =
  | { t: 'say'; who: string | null; name: string | null; expr: string | null; text: string; src: SrcPos }
  | { t: 'bg'; name: string; time: string; fx: string[]; src: SrcPos }
  | { t: 'show'; who: string; expr: string; pos: string | null; src: SrcPos }
  | { t: 'hide'; who: string; src: SrcPos }
  | { t: 'music'; name: string; src: SrcPos }
  | { t: 'sfx'; name: string; src: SrcPos }
  | { t: 'fx'; name: string; src: SrcPos }
  | { t: 'wait'; ms: number; src: SrcPos }
  | { t: 'jump'; target: string; src: SrcPos }
  | { t: 'if'; cond: Cond[]; target: string; src: SrcPos }
  | { t: 'set'; flag: string; value: boolean; src: SrcPos }
  | { t: 'add'; v: string; n: number; src: SrcPos }
  | { t: 'chapter'; text: string; src: SrcPos }
  | { t: 'ending'; id: string; title: string; src: SrcPos }
  | { t: 'choice'; options: ChoiceOption[]; src: SrcPos };

export interface Program {
  stmts: Stmt[];
  labels: Record<string, number>;
  errors: string[];
}

export interface CharState {
  expr: string;
  pos: string;
}

export interface Scene {
  bg: string | null;
  time: string;
  fx: string[];
  chars: Record<string, CharState>;
  music: string | null;
}

export interface VMState {
  pc: number;
  vars: Record<string, number>;
  flags: Record<string, boolean>;
  scene: Scene;
}
