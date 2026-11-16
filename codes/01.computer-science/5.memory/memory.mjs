// Проверки к 1.05 в Node: строка-примитив лежит в куче, а не на стеке; ArrayBuffer — память вне кучи V8;
// цикл объектов собирает трассирующий сборщик; слабая ссылка не держит объект, а момент сборки не определён;
// перенос ArrayBuffer отсоединяет исходный буфер (владение); выход за границы типизированного массива
// не портит память; подсчёт ссылок в CPython освобождает сразу, но цикл — только сборщиком циклов.
// flags: --expose-gc
// Запуск: cd codes && node run.mjs 01.computer-science/5.memory
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import v8 from 'node:v8';

const mb = (n) => n / 2 ** 20;

// --- строка в локальной переменной всё равно в куче: 10 млн латинских символов ≈ 9,5 МБ ---
function localString() {
  const bytes = new Uint8Array(1e7).fill(97);
  gc();
  const before = process.memoryUsage().heapUsed;
  const s = new TextDecoder().decode(bytes);
  gc();
  const grown = mb(process.memoryUsage().heapUsed - before);
  return [s.length, grown];
}
const [len, grown] = localString();
assert.equal(len, 1e7);
assert.ok(grown > 9 && grown < 10.5, `строка добавила в кучу ${grown.toFixed(1)} МБ`);

// --- ArrayBuffer: байты вне кучи V8, учитываются в arrayBuffers и rss ---
gc();
const m0 = process.memoryUsage();
const big = new ArrayBuffer(50 * 2 ** 20);
new Uint8Array(big).fill(1);
const m1 = process.memoryUsage();
assert.ok(Math.abs(mb(m1.heapUsed - m0.heapUsed)) < 2);
assert.ok(mb(m1.arrayBuffers - m0.arrayBuffers) >= 50);
// предел кучи задаётся флагом, по умолчанию он зависит от памяти машины
assert.ok(v8.getHeapStatistics().heap_size_limit > 0);
const limit = (flag) => Number(execFileSync(process.execPath, [...flag, '-p', 'require("v8").getHeapStatistics().heap_size_limit']).toString());
assert.ok(limit(['--max-old-space-size=128']) < limit(['--max-old-space-size=1024']));

// --- трассирующий сборщик собирает циклы ---
const collected = [];
const registry = new FinalizationRegistry((tag) => collected.push(tag));
(function makeCycle() {
  const order = { id: 1 };
  const customer = { order };
  order.customer = customer;                                                          // order ↔ customer
  registry.register(order, 'цикл заказ–покупатель');
})();
const weak = new WeakRef({ cached: true });
assert.ok(weak.deref());                                                              // до сборки объект жив, хотя ссылок нет
await new Promise((r) => setTimeout(r, 0));
gc();
assert.equal(weak.deref(), undefined);
await new Promise((r) => setTimeout(r, 20));
assert.deepEqual(collected, ['цикл заказ–покупатель']);

// --- владение: перенос отсоединяет исходный буфер ---
const frame = new ArrayBuffer(8);
const moved = structuredClone(frame, { transfer: [frame] });
assert.deepEqual([frame.byteLength, frame.detached, moved.byteLength], [0, true, 8]);
const view = new Uint8Array(new ArrayBuffer(8));
const owner = view.buffer.transfer();
assert.deepEqual([view.length, owner.byteLength], [0, 8]);
assert.throws(() => view.fill(1), { name: 'TypeError', message: /detached ArrayBuffer/ });  // «use-after-free» стал ошибкой

// --- границы: запись за пределы молча игнорируется, DataView бросает ---
const u8 = new Uint8Array(4);
u8[10] = 1;
assert.equal(u8[10], undefined);
assert.deepEqual(Object.keys(u8), ['0', '1', '2', '3']);
assert.throws(() => new DataView(u8.buffer).getUint8(10), RangeError);

// --- CPython: подсчёт ссылок освобождает сразу, цикл ждёт сборщика циклов ---
let python;
try {
  python = execFileSync('python3', ['-I', '-c', `
import gc, weakref
class Node: pass
a = Node(); r = weakref.ref(a)
del a
print(r() is None)
gc.disable()
x = Node(); y = Node(); x.other = y; y.other = x
rx = weakref.ref(x)
del x, y
print(rx() is None)
gc.collect()
print(rx() is None)
`]).toString().trim().split('\n');
} catch { python = null; }
if (python) assert.deepEqual(python, ['True', 'False', 'True']);
else console.log('python3 не найден — проверка подсчёта ссылок пропущена');

console.log('memory ok');
