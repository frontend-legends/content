// Проверки к 1.06 в Node: глубина стека зависит от размера кадра и --stack-size; стек ошибки собирается
// при создании Error и ограничен Error.stackTraceLimit; await сохраняет асинхронный стек, таймер — нет;
// процесс живёт, пока есть задачи, unref отпускает таймер; порядок beforeExit и exit; коды выхода
// (необработанное исключение и отклонение — 1, process.exitCode); SIGTERM без обработчика и с ним.
// Запуск: cd codes && node run.mjs 01.computer-science/6.running-the-code
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const node = (code, args = []) => spawnSync(process.execPath, [...args, '-e', code], { encoding: 'utf8', timeout: 20000 });
const out = (code, args) => node(code, args).stdout.trim();

// --- глубина стека: кадр больше — вызовов меньше; стек меньше — вызовов меньше ---
const depth = (code, args) => Number(out(`let d = 0; ${code} try { f(1, 2, 3, 4) } catch (e) { console.log(d) }`, args));
const small = depth('function f() { d++; f(); }');
const wide = depth('function f(a, b, c, e) { d++; const z = a + b + c + e; f(1, 2, 3, 4); return z; }');
const tiny = depth('function f() { d++; f(); }', ['--stack-size=200']);
assert.ok(small > 5000, `глубина ${small}`);
assert.ok(wide < small * 0.8, `${wide} против ${small}`);
assert.ok(tiny < small / 3, `${tiny} против ${small}`);
assert.match(node('function f() { f() } f()').stderr, /RangeError: Maximum call stack size exceeded/);

// --- стек ошибки: функции на момент создания, по умолчанию 10 кадров ---
const trace = out('function a() { b() } function b() { c() } function c() { throw new Error("x") } try { a() } catch (e) { console.log(e.stack.split("\\n").slice(1, 4).map((l) => l.trim().split(" ")[1]).join(",")) }');
assert.equal(trace, 'c,b,a');
const createdAt = out('const e = new Error("создана здесь");\nfunction thrower() { throw e }\ntry { thrower() } catch (x) { console.log(x.stack.split("\\n")[1].trim()) }');
assert.equal(createdAt, 'at [eval]:1:11');                                            // строка создания, thrower в стеке нет
assert.deepEqual(out('console.log(Error.stackTraceLimit); function f(n) { if (n === 0) throw new Error("deep"); f(n - 1) } try { f(50) } catch (e) { console.log(e.stack.split("\\n").length - 1) }').split('\n'), ['10', '10']);

// --- асинхронный стек: через await цепочка видна, через таймер — нет ---
const viaAwait = out('async function load() { await null; throw new Error("в load") } async function page() { await load() } page().catch((e) => console.log(e.stack))');
assert.match(viaAwait, /at load .*\n\s+at async page/);
const viaTimer = out('function load() { setTimeout(() => { try { throw new Error("в таймере") } catch (e) { console.log(e.stack) } }, 0) } function page() { load() } page()');
assert.doesNotMatch(viaTimer, /at (load|page) /);
assert.match(viaTimer, /listOnTimeout/);

// --- процесс живёт, пока есть работа; порядок событий выхода ---
const lifecycle = node(`
console.log('a');
setTimeout(() => console.log('timer'), 30);
process.on('beforeExit', () => console.log('beforeExit'));
process.on('exit', (code) => { setTimeout(() => console.log('late'), 0); console.log('exit', code); });
console.log('b');`);
assert.deepEqual(lifecycle.stdout.trim().split('\n'), ['a', 'b', 'timer', 'beforeExit', 'exit 0']);
assert.equal(lifecycle.status, 0);
const unref = node('setTimeout(() => console.log("никогда"), 5000).unref(); console.log("готово")');
assert.deepEqual([unref.stdout.trim(), unref.status], ['готово', 0]);

// --- коды выхода ---
const uncaught = node('throw new Error("boom")');
assert.equal(uncaught.status, 1);
assert.match(uncaught.stderr, /Error: boom/);
const rejected = node('Promise.reject(new Error("nope"))');
assert.equal(rejected.status, 1);
assert.match(rejected.stderr, /Error: nope/);
assert.equal(node('process.exitCode = 3; console.log("ok")').status, 3);

// --- SIGTERM: без обработчика процесс убит сигналом, оболочка видит 128 + 15 ---
const shell = spawnSync('sh', ['-c', `"${process.execPath}" -e "setInterval(() => {}, 1000)" & sleep 0.5; kill -TERM $!; wait $!; echo $?`], { encoding: 'utf8' });
assert.equal(shell.stdout.trim(), '143');
const graceful = spawnSync('sh', ['-c', `"${process.execPath}" -e "const t = setInterval(() => {}, 1000); process.on('SIGTERM', () => { console.log('закрываюсь'); clearInterval(t) })" & sleep 0.5; kill -TERM $!; wait $!; echo $?`], { encoding: 'utf8' });
assert.deepEqual(graceful.stdout.trim().split('\n'), ['закрываюсь', '0']);

// практика «Что выведет?» дословно; таймер в beforeExit оживляет цикл, и beforeExit срабатывает снова
const practice = node(`console.log('start');
setTimeout(() => console.log('timer'), 0);
process.on('beforeExit', () => console.log('beforeExit'));
process.on('exit', (code) => { setTimeout(() => console.log('late'), 0); console.log('exit', code); });
console.log('end');`);
assert.deepEqual(practice.stdout.trim().split('\n'), ['start', 'end', 'timer', 'beforeExit', 'exit 0']);
const again = out('let n = 0; process.on("beforeExit", () => { console.log("beforeExit", ++n); if (n < 3) setTimeout(() => {}, 0); });');
assert.deepEqual(again.split('\n'), ['beforeExit 1', 'beforeExit 2', 'beforeExit 3']);

// модули ES: синтаксическая ошибка в импортированном файле — не выполнится ничего
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'esm-'));
writeFileSync(join(dir, 'main.mjs'), 'console.log("main выполнился");\nimport "./broken.mjs";\n');
writeFileSync(join(dir, 'broken.mjs'), 'export const x = ;\n');
const esm = spawnSync(process.execPath, [join(dir, 'main.mjs')], { encoding: 'utf8' });
rmSync(dir, { recursive: true });
assert.equal(esm.stdout, '');
assert.match(esm.stderr, /SyntaxError/);
assert.equal(esm.status, 1);

console.log('process ok');
