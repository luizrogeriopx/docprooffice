// Lightweight spreadsheet-style formula engine for Tiptap tables.
// Supports: numbers, cell refs (A1), ranges (A1:B3), + - * / ^, parentheses,
// unary minus, and functions: SUM/SOMA, AVG/AVERAGE/MEDIA, MIN, MAX,
// COUNT/CONT, PRODUCT/MULT, ABS, ROUND/ARRED.
// Numbers accept BR locale ("R$ 1.500,00" -> 1500.00).

export type Grid = string[][];

export function evalCell(
  grid: Grid,
  row: number,
  col: number,
  visiting: Set<string> = new Set(),
): number {
  const text = (grid[row]?.[col] ?? "").trim();
  if (!text) return 0;
  if (!text.startsWith("=")) return parseNumber(text);
  const key = `${row},${col}`;
  if (visiting.has(key)) throw new Error("#CYCLE");
  visiting.add(key);
  try {
    const tokens = tokenize(text.slice(1));
    const parser = new Parser(tokens, grid, visiting);
    const result = parser.parseExpr();
    if (parser.pos < tokens.length) throw new Error("Sintaxe");
    return result;
  } finally {
    visiting.delete(key);
  }
}

export function formatResult(n: number): string {
  if (!isFinite(n)) return "#ERR";
  if (Number.isInteger(n)) return n.toLocaleString("pt-BR");
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseNumber(s: string): number {
  let cleaned = s.replace(/[^\d,.\-]/g, "");
  if (!cleaned) return 0;
  // BR locale: dot = thousand, comma = decimal
  if (cleaned.includes(",")) cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}

type Token =
  | { type: "num"; value: string }
  | { type: "ref"; value: string }
  | { type: "fn"; value: string }
  | { type: "op"; value: "+" | "-" | "*" | "/" | "^" }
  | { type: "lp" }
  | { type: "rp" }
  | { type: "comma" }
  | { type: "colon" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[\d.]/.test(c)) {
      let j = i;
      while (j < input.length && /[\d.]/.test(input[j])) j++;
      tokens.push({ type: "num", value: input.slice(i, j) });
      i = j;
    } else if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < input.length && /[a-zA-Z]/.test(input[j])) j++;
      const word = input.slice(i, j).toUpperCase();
      let k = j;
      while (k < input.length && /\d/.test(input[k])) k++;
      if (k > j) {
        tokens.push({ type: "ref", value: word + input.slice(j, k) });
        i = k;
      } else {
        tokens.push({ type: "fn", value: word });
        i = j;
      }
    } else if ("+-*/^".includes(c)) {
      tokens.push({ type: "op", value: c as any });
      i++;
    } else if (c === "(") {
      tokens.push({ type: "lp" });
      i++;
    } else if (c === ")") {
      tokens.push({ type: "rp" });
      i++;
    } else if (c === ",") {
      tokens.push({ type: "comma" });
      i++;
    } else if (c === ";") {
      tokens.push({ type: "comma" });
      i++;
    } else if (c === ":") {
      tokens.push({ type: "colon" });
      i++;
    } else throw new Error(`Caractere inválido: ${c}`);
  }
  return tokens;
}

class Parser {
  pos = 0;
  constructor(
    public tokens: Token[],
    public grid: Grid,
    public visiting: Set<string>,
  ) {}
  peek() {
    return this.tokens[this.pos];
  }
  next() {
    return this.tokens[this.pos++];
  }
  expect(type: Token["type"]) {
    const t = this.next();
    if (!t || t.type !== type) throw new Error(`Esperado ${type}`);
    return t;
  }
  parseExpr(): number {
    return this.parseAdd();
  }
  parseAdd(): number {
    let l = this.parseMul();
    while (
      this.peek()?.type === "op" &&
      ((this.peek() as any).value === "+" || (this.peek() as any).value === "-")
    ) {
      const op = (this.next() as any).value;
      const r = this.parseMul();
      l = op === "+" ? l + r : l - r;
    }
    return l;
  }
  parseMul(): number {
    let l = this.parsePow();
    while (
      this.peek()?.type === "op" &&
      ((this.peek() as any).value === "*" || (this.peek() as any).value === "/")
    ) {
      const op = (this.next() as any).value;
      const r = this.parsePow();
      l = op === "*" ? l * r : l / r;
    }
    return l;
  }
  parsePow(): number {
    const l = this.parseUnary();
    if (this.peek()?.type === "op" && (this.peek() as any).value === "^") {
      this.next();
      return Math.pow(l, this.parsePow());
    }
    return l;
  }
  parseUnary(): number {
    if (
      this.peek()?.type === "op" &&
      ((this.peek() as any).value === "+" || (this.peek() as any).value === "-")
    ) {
      const op = (this.next() as any).value;
      const v = this.parseUnary();
      return op === "-" ? -v : v;
    }
    return this.parsePrimary();
  }
  parsePrimary(): number {
    const t = this.next();
    if (!t) throw new Error("Fim inesperado");
    if (t.type === "num") return parseFloat(t.value);
    if (t.type === "lp") {
      const v = this.parseExpr();
      this.expect("rp");
      return v;
    }
    if (t.type === "ref") return this.resolveRef(t.value);
    if (t.type === "fn") return this.parseFn(t.value);
    throw new Error("Token inesperado");
  }
  parseFn(name: string): number {
    this.expect("lp");
    const args: number[] = [];
    if (this.peek()?.type !== "rp") {
      args.push(...this.parseArg());
      while (this.peek()?.type === "comma") {
        this.next();
        args.push(...this.parseArg());
      }
    }
    this.expect("rp");
    return applyFn(name, args);
  }
  parseArg(): number[] {
    if (this.peek()?.type === "ref" && this.tokens[this.pos + 1]?.type === "colon") {
      const a = (this.next() as any).value;
      this.next(); // colon
      const b = (this.expect("ref") as any).value;
      return this.resolveRange(a, b);
    }
    return [this.parseExpr()];
  }
  resolveRef(ref: string): number {
    const m = ref.match(/^([A-Z]+)(\d+)$/);
    if (!m) throw new Error("Ref inválida");
    const col = colToIdx(m[1]);
    const row = parseInt(m[2], 10) - 1;
    return evalCell(this.grid, row, col, this.visiting);
  }
  resolveRange(a: string, b: string): number[] {
    const ma = a.match(/^([A-Z]+)(\d+)$/);
    const mb = b.match(/^([A-Z]+)(\d+)$/);
    if (!ma || !mb) throw new Error("Range inválida");
    const c1 = colToIdx(ma[1]);
    const r1 = parseInt(ma[2], 10) - 1;
    const c2 = colToIdx(mb[1]);
    const r2 = parseInt(mb[2], 10) - 1;
    const out: number[] = [];
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
        const v = evalCell(this.grid, r, c, this.visiting);
        if (isFinite(v)) out.push(v);
      }
    }
    return out;
  }
}

function colToIdx(s: string): number {
  let n = 0;
  for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function applyFn(name: string, args: number[]): number {
  switch (name) {
    case "SUM":
    case "SOMA":
      return args.reduce((a, b) => a + b, 0);
    case "AVG":
    case "AVERAGE":
    case "MEDIA":
      return args.length ? args.reduce((a, b) => a + b, 0) / args.length : 0;
    case "MIN":
      return args.length ? Math.min(...args) : 0;
    case "MAX":
      return args.length ? Math.max(...args) : 0;
    case "COUNT":
    case "CONT":
      return args.length;
    case "PRODUCT":
    case "MULT":
      return args.reduce((a, b) => a * b, 1);
    case "ABS":
      return Math.abs(args[0] ?? 0);
    case "ROUND":
    case "ARRED": {
      const v = args[0] ?? 0;
      const d = args[1] ?? 0;
      const f = Math.pow(10, d);
      return Math.round(v * f) / f;
    }
    default:
      throw new Error(`Função desconhecida: ${name}`);
  }
}
