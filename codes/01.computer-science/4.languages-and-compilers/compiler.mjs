// Проверки к 1.04: этапы компилятора на маленьком языке формул (лексер, парсер с приоритетами, семантическая
// проверка, свёртка констант, интерпретатор, байткод стековой машины, генерация JS) и те же этапы у настоящих
// инструментов: токены и AST от acorn, автоматическая вставка точки с запятой, ранняя SyntaxError,
// байткод V8 (--print-bytecode), стирание типов TypeScript, понижение синтаксиса Babel и esbuild, JSX.
// Запуск: cd codes && node run.mjs 01.computer-science/4.languages-and-compilers
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';
import { transformSync as esbuild } from 'esbuild';
import { transformSync as babel } from '@babel/core';
import { tokenize, parse, check, fold, interpret, toBytecode, run, toJs, compile } from './_calc.mjs';

// --- маленький язык формул ---
const formula = 'price * (1 - discount / 100) + delivery';
const env = { price: 1000, discount: 15, delivery: 300 };

assert.deepEqual(tokenize('price * 2').map((t) => t.value ?? t.type), ['price', '*', 2]);
const ast = check(parse(tokenize(formula)), Object.keys(env));
assert.equal(ast.type, 'bin');
assert.equal(ast.op, '+');                                                             // корень — сложение: умножение связывает сильнее
assert.equal(ast.left.op, '*');
assert.equal(interpret(ast, env), 1150);

// ошибки по этапам
assert.throws(() => tokenize('price # 2'), { name: 'SyntaxError', message: 'Неожиданный символ «#» в позиции 6' });
assert.throws(() => parse(tokenize('price * (1 - discount')), { name: 'SyntaxError', message: 'Ожидалось «)», а пришло «конец»' });
assert.throws(() => check(parse(tokenize('prise * 2')), Object.keys(env)), { name: 'ReferenceError' });

// свёртка констант
const folded = fold(parse(tokenize('price * (1 - 15 / 100) + 100 * 3')));
assert.deepEqual(folded, {
  type: 'bin', op: '+',
  left: { type: 'bin', op: '*', left: { type: 'name', name: 'price' }, right: { type: 'num', value: 0.85 } },
  right: { type: 'num', value: 300 },
});

// байткод стековой машины
const code = toBytecode(ast);
assert.deepEqual(code, [
  ['load', 'price'], ['push', 1], ['load', 'discount'], ['push', 100], ['/'], ['-'], ['*'], ['load', 'delivery'], ['+'],
]);
assert.equal(run(code, env), 1150);

// генерация JavaScript
assert.equal(toJs(ast), '((env.price * (1 - (env.discount / 100))) + env.delivery)');
assert.equal(compile(ast)(env), 1150);
assert.equal(compile(fold(ast))({ price: 2000, discount: 50, delivery: 0 }), 1000);

// практика: калькулятор без eval не выполняет чужой код
assert.throws(() => tokenize('alert(1); 2'), { name: 'SyntaxError' });
assert.throws(() => check(parse(tokenize('constructor')), Object.keys(env)), { name: 'ReferenceError' });
assert.equal(interpret(parse(tokenize('-(2 + 3) * 4')), {}), -20);
assert.equal(interpret(parse(tokenize('2 - 3 - 4')), {}), -5);                           // левая ассоциативность
assert.equal(interpret(parse(tokenize('8 / 4 / 2')), {}), 1);

// практика «2 - 3 - 4 = 3»: правая рекурсия делает вычитание правоассоциативным
function parseRightRecursive(tokens) {
  let pos = 0;
  const peek = () => tokens[pos]?.type;
  const term = () => ({ type: 'num', value: tokens[pos++].value });
  function expr() {
    const left = term();
    if (peek() === '+' || peek() === '-') return { type: 'bin', op: tokens[pos++].type, left, right: expr() };
    return left;
  }
  return expr();
}
assert.equal(interpret(parseRightRecursive(tokenize('2 - 3 - 4')), {}), 3);              // 2 - (3 - 4)
assert.equal(interpret(parse(tokenize('2 - 3 - 4')), {}), -5);                           // цикл: (2 - 3) - 4

// --- настоящий парсер JavaScript ---
const src = 'const total = price * qty + 10;';
const tokens = [...acorn.tokenizer(src, { ecmaVersion: 'latest' })].map((t) => t.value ?? t.type.label);
assert.deepEqual(tokens, ['const', 'total', '=', 'price', '*', 'qty', '+', 10, ';']);
const init = acorn.parse(src, { ecmaVersion: 'latest' }).body[0].declarations[0].init;
assert.equal(init.type, 'BinaryExpression');
assert.equal(init.operator, '+');
assert.equal(init.left.operator, '*');

// автоматическая вставка точки с запятой: return и перевод строки
const asi = acorn.parse('function f() {\n  return\n  { ok: true }\n}', { ecmaVersion: 'latest' }).body[0].body.body;
assert.equal(asi[0].type, 'ReturnStatement');
assert.equal(asi[0].argument, null);                                                     // return без значения
assert.equal(asi[1].type, 'BlockStatement');                                             // а { ok: true } — блок с меткой ok
assert.equal(asi[1].body[0].type, 'LabeledStatement');
assert.equal(new Function('return\n{ ok: true }')(), undefined);

// синтаксическая ошибка в конце файла — не выполнится и первая строка
assert.throws(() => acorn.parse('let x = ;', { ecmaVersion: 'latest' }), /Unexpected token \(1:8\)/);
const early = execFileSync(process.execPath, ['-e', 'try { require("vm").runInThisContext("globalThis.ran = true;\\nlet x = ;") } catch (e) { console.log(e.name, globalThis.ran) }']).toString().trim();
assert.equal(early, 'SyntaxError undefined');

// байткод V8 для function add(a, b) { return a + b }
const bytecode = execFileSync(process.execPath, ['--print-bytecode', '--print-bytecode-filter=add', '-e', 'function add(a, b) { return a + b } add(1, 2)']).toString();
for (const instr of ['Ldar a1', 'Add a0, [0]', 'Return']) assert.ok(bytecode.includes(instr), instr);

// --- транспиляция: исходник в исходник ---
const ts = esbuild('enum Size { S, M }\nconst n: number = 5;\nfunction len(x: string): number { return x.length }', { loader: 'ts' }).code;
assert.ok(!ts.includes(': number') && !ts.includes(': string'));                         // типы стёрты
assert.ok(ts.includes('Size2[Size2["S"] = 0] = "S"'));                                   // enum превратился в код
assert.ok(esbuild('const n: number = "строка";', { loader: 'ts' }).code.includes('const n ='));   // ошибка типа не мешает
const down = babel('const v = user?.name ?? "гость";', { presets: [['@babel/preset-env', { targets: 'chrome 70' }]], configFile: false, babelrc: false }).code;
assert.ok(!down.includes('?.') && !down.includes('??') && down.includes('void 0'));
const jsx = esbuild('const el = <Button size="s">Купить</Button>;', { loader: 'jsx', jsx: 'automatic' }).code;
assert.ok(jsx.includes('import { jsx } from "react/jsx-runtime"') && jsx.includes('jsx(Button, { size: "s", children:'));

console.log('compiler ok');
