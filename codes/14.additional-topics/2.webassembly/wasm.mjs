// Проверки к 14.02: настоящие модули WebAssembly из текстового формата (wabt) — числа на границе,
// линейная память и строки, memory.grow, ловушки, импорт функций JS, WASI в Node.js, MIME-тип в браузере.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import initWabt from 'wabt';
import { withPage } from '../../_lib/browser.mjs';

const wabt = await initWabt();
const compile = (wat) => wabt.parseWat('m.wat', wat).toBinary({}).buffer;
const instantiate = async (wat, imports = {}) => (await WebAssembly.instantiate(compile(wat), imports)).instance.exports;

// --- функции и числа на границе ---
const math = await instantiate(`(module
  (func (export "add") (param i32 i32) (result i32) local.get 0 local.get 1 i32.add)
  (func (export "add64") (param i64 i64) (result i64) local.get 0 local.get 1 i64.add)
  (func (export "div") (param i32 i32) (result i32) local.get 0 local.get 1 i32.div_s))`);
assert.equal(math.add(2, 3), 5);
assert.equal(math.add(2_147_483_647, 1), -2_147_483_648); // i32 переполняется по кругу
assert.equal(math.add(1.9, 1), 2);                         // дробное приведено к целому
assert.equal(math.add64(2n ** 62n, 2n ** 62n), -(2n ** 63n)); // i64 — это BigInt
assert.throws(() => math.add64(1, 2), TypeError);           // число вместо BigInt — ошибка
assert.throws(() => math.div(1, 0), (e) => e instanceof WebAssembly.RuntimeError && /divide by zero/.test(e.message));
assert.equal(compile(`(module (func (export "add") (param i32 i32) (result i32) local.get 0 local.get 1 i32.add))`).length, 41); // модуль в 41 байт

// --- нет DOM: всё внешнее — импортированные функции JS ---
const logged = [];
const greeter = await instantiate(`(module
  (import "env" "log" (func $log (param i32)))
  (func (export "run") i32.const 42 call $log))`, { env: { log: (n) => logged.push(n) } });
greeter.run();
assert.deepEqual(logged, [42]);
await assert.rejects(WebAssembly.instantiate(compile(`(module (import "env" "log" (func (param i32))))`), {}), TypeError);

// --- линейная память: строки кладут байтами, длину и адрес передают числами ---
const text = await instantiate(`(module
  (memory (export "memory") 1)
  (func (export "countA") (param $ptr i32) (param $len i32) (result i32)
    (local $i i32) (local $n i32)
    (block $done (loop $next
      (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
      (if (i32.eq (i32.load8_u (i32.add (local.get $ptr) (local.get $i))) (i32.const 97))
        (then (local.set $n (i32.add (local.get $n) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $next)))
    local.get $n)
  (func (export "read") (param i32) (result i32) local.get 0 i32.load8_u))`);
assert.ok(text.memory.buffer instanceof ArrayBuffer);
assert.equal(text.memory.buffer.byteLength, 65_536); // одна страница — 64 КиБ
const bytes = new TextEncoder().encode('banana');
new Uint8Array(text.memory.buffer).set(bytes, 0);
assert.equal(text.countA(0, bytes.length), 3);

// выход за границы памяти — ловушка, а не undefined
assert.throws(() => text.read(65_536), (e) => e instanceof WebAssembly.RuntimeError && /out of bounds/.test(e.message));

// memory.grow отсоединяет прежний ArrayBuffer — старые представления становятся пустыми
const view = new Uint8Array(text.memory.buffer);
assert.equal(view.length, 65_536);
text.memory.grow(1);
assert.equal(view.length, 0);
assert.equal(text.memory.buffer.byteLength, 131_072);

// --- WASI: модуль вне браузера пишет в stdout через системный интерфейс ---
const wasiWat = `(module
  (import "wasi_snapshot_preview1" "fd_write" (func $fd_write (param i32 i32 i32 i32) (result i32)))
  (memory (export "memory") 1)
  (data (i32.const 16) "hello from wasm\\n")
  (func (export "_start")
    (i32.store (i32.const 0) (i32.const 16))
    (i32.store (i32.const 4) (i32.const ${Buffer.byteLength('hello from wasm\n')}))
    (drop (call $fd_write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 8)))))`;
const { spawnSync } = await import('node:child_process');
const wasiScript = `const { WASI } = require('node:wasi');
const wasi = new WASI({ version: 'preview1' });
WebAssembly.instantiate(Buffer.from('${Buffer.from(compile(wasiWat)).toString('base64')}', 'base64'), wasi.getImportObject())
  .then(({ instance }) => wasi.start(instance));`;
const wasiRun = spawnSync(process.execPath, ['--no-warnings', '-e', wasiScript], { encoding: 'utf8' });
assert.equal(wasiRun.stdout, 'hello from wasm\n', wasiRun.stderr);

// --- браузер: instantiateStreaming требует Content-Type: application/wasm ---
const binary = Buffer.from(compile(`(module (func (export "answer") (result i32) i32.const 42))`));
const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    if (req.url === '/good.wasm') { res.setHeader('content-type', 'application/wasm'); return res.end(binary); }
    if (req.url === '/bad.wasm') { res.setHeader('content-type', 'application/octet-stream'); return res.end(binary); }
    res.setHeader('content-type', 'text/html'); res.end('<!doctype html>');
  }).listen(0, () => resolve(s));
});
await withPage(async (page) => {
  await page.goto(`http://localhost:${server.address().port}/`);
  const result = await page.evaluate(async () => {
    const good = (await WebAssembly.instantiateStreaming(fetch('/good.wasm'))).instance.exports.answer();
    let bad; try { await WebAssembly.instantiateStreaming(fetch('/bad.wasm')); } catch (e) { bad = `${e.name}: ${e.message}`; }
    const fallback = (await WebAssembly.instantiate(await (await fetch('/bad.wasm')).arrayBuffer())).instance.exports.answer();
    return { good, bad, fallback };
  });
  assert.equal(result.good, 42);
  assert.match(result.bad, /^TypeError: .*Incorrect response MIME type\. Expected 'application\/wasm'/);
  assert.equal(result.fallback, 42); // через arrayBuffer работает, но без компиляции по ходу загрузки
});
server.close();

// --- скорость: простой цикл в JS после JIT сопоставим с WASM ---
const sum = await instantiate(`(module (memory (export "memory") 160)
  (func (export "sum") (param $n i32) (result f64) (local $i i32) (local $s f64)
    (block $d (loop $l (br_if $d (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $s (f64.add (local.get $s) (f64.load (i32.shl (local.get $i) (i32.const 3)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $l)))
    local.get $s))`);
const N = 1_000_000;
const data = new Float64Array(sum.memory.buffer, 0, N);
for (let i = 0; i < N; i++) data[i] = i % 7;
const jsSum = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
for (let i = 0; i < 5; i++) { jsSum(data); sum.sum(N); } // прогрев
const time = (fn) => { const t = performance.now(); for (let i = 0; i < 20; i++) fn(); return performance.now() - t; };
const tJs = time(() => jsSum(data));
const tWasm = time(() => sum.sum(N));
assert.equal(jsSum(data), sum.sum(N));
console.log(`  сумма 1e6 чисел ×20: JS ${tJs.toFixed(1)} мс, WASM ${tWasm.toFixed(1)} мс`);
assert.ok(tJs / tWasm < 10 && tWasm / tJs < 10); // одного порядка

console.log('wasm ok');
