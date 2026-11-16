// Маленький компилятор формул из 1.04: лексер → парсер → AST → свёртка констант → интерпретатор,
// байткод для стековой машины и генерация JavaScript. Импортируется проверками, сам не запускается.

export function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ') { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      tokens.push({ type: 'num', value: Number(src.slice(i, j)) });
      i = j;
    } else if (/[a-z]/i.test(ch)) {
      let j = i;
      while (j < src.length && /[a-z0-9]/i.test(src[j])) j++;
      tokens.push({ type: 'name', value: src.slice(i, j) });
      i = j;
    } else if ('+-*/()'.includes(ch)) {
      tokens.push({ type: ch });
      i++;
    } else {
      throw new SyntaxError(`Неожиданный символ «${ch}» в позиции ${i}`);
    }
  }
  return tokens;
}

// грамматика:  expr = term (('+' | '-') term)*
//              term = factor (('*' | '/') factor)*
//              factor = num | name | '(' expr ')' | '-' factor
export function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos]?.type;
  const take = (type) => {
    if (peek() !== type) throw new SyntaxError(`Ожидалось «${type}», а пришло «${peek() ?? 'конец'}»`);
    return tokens[pos++];
  };
  function expr() {
    let node = term();
    while (peek() === '+' || peek() === '-') node = { type: 'bin', op: tokens[pos++].type, left: node, right: term() };
    return node;
  }
  function term() {
    let node = factor();
    while (peek() === '*' || peek() === '/') node = { type: 'bin', op: tokens[pos++].type, left: node, right: factor() };
    return node;
  }
  function factor() {
    if (peek() === 'num') return { type: 'num', value: take('num').value };
    if (peek() === 'name') return { type: 'name', name: take('name').value };
    if (peek() === '-') { pos++; return { type: 'neg', arg: factor() }; }
    take('(');
    const node = expr();
    take(')');
    return node;
  }
  const ast = expr();
  if (pos < tokens.length) throw new SyntaxError(`Лишний токен «${peek()}»`);
  return ast;
}

const ops = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b };

// семантическая проверка: все имена известны
export function check(ast, known) {
  if (ast.type === 'name' && !known.includes(ast.name)) throw new ReferenceError(`Неизвестная переменная ${ast.name}`);
  if (ast.type === 'bin') { check(ast.left, known); check(ast.right, known); }
  if (ast.type === 'neg') check(ast.arg, known);
  return ast;
}

// оптимизация: свёртка констант
export function fold(ast) {
  if (ast.type === 'bin') {
    const left = fold(ast.left), right = fold(ast.right);
    if (left.type === 'num' && right.type === 'num') return { type: 'num', value: ops[ast.op](left.value, right.value) };
    return { ...ast, left, right };
  }
  if (ast.type === 'neg') {
    const arg = fold(ast.arg);
    return arg.type === 'num' ? { type: 'num', value: -arg.value } : { type: 'neg', arg };
  }
  return ast;
}

// интерпретатор: обходит дерево при каждом вычислении
export function interpret(ast, env) {
  switch (ast.type) {
    case 'num': return ast.value;
    case 'name': return env[ast.name];
    case 'neg': return -interpret(ast.arg, env);
    case 'bin': return ops[ast.op](interpret(ast.left, env), interpret(ast.right, env));
  }
}

// компиляция в байткод стековой машины
export function toBytecode(ast, code = []) {
  switch (ast.type) {
    case 'num': code.push(['push', ast.value]); break;
    case 'name': code.push(['load', ast.name]); break;
    case 'neg': toBytecode(ast.arg, code); code.push(['neg']); break;
    case 'bin': toBytecode(ast.left, code); toBytecode(ast.right, code); code.push([ast.op]); break;
  }
  return code;
}

export function run(code, env) {
  const stack = [];
  for (const [op, arg] of code) {
    if (op === 'push') stack.push(arg);
    else if (op === 'load') stack.push(env[arg]);
    else if (op === 'neg') stack.push(-stack.pop());
    else { const b = stack.pop(), a = stack.pop(); stack.push(ops[op](a, b)); }
  }
  return stack.pop();
}

// генерация JavaScript: движок дальше сам скомпилирует его в машинный код
export function toJs(ast) {
  switch (ast.type) {
    case 'num': return String(ast.value);
    case 'name': return `env.${ast.name}`;
    case 'neg': return `(-${toJs(ast.arg)})`;
    case 'bin': return `(${toJs(ast.left)} ${ast.op} ${toJs(ast.right)})`;
  }
}
export const compile = (ast) => new Function('env', `return ${toJs(ast)};`);
