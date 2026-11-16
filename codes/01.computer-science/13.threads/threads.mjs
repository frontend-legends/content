// Проверки к 1.13 в Node: конкурентность без параллельности (async не ускоряет вычисления) и параллельность
// на потоках; инвариант «сумма на счетах» ломается без критической секции и держится с мьютексом на Atomics;
// взаимная блокировка на Web Locks (захват в разном порядке) и её исправление единым порядком;
// пул потоков libuv: 8 вызовов pbkdf2 идут двумя волнами при размере пула 4 и одной при 8; закон Амдала.
// Запуск: cd codes && node run.mjs 01.computer-science/13.threads
import assert from 'node:assert/strict';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';

const run = (code, workerData) => new Promise((resolve, reject) => {
  const w = new Worker(code, { eval: true, workerData });
  w.on('message', resolve);
  w.on('error', reject);
});

// --- конкурентность против параллельности ---
const burn = 'const end = Date.now() + 150; let x = 0; while (Date.now() < end) x++;';
const work = new Function(burn);
let t = performance.now();
await Promise.all([(async () => work())(), (async () => work())()]);                     // две «асинхронные» задачи
const concurrent = performance.now() - t;
t = performance.now();
await Promise.all([1, 2].map(() => run(`${burn} require('node:worker_threads').parentPort.postMessage(0)`)));
const parallel = performance.now() - t;
assert.ok(concurrent >= 295, `async: ${concurrent.toFixed(0)} мс`);                        // по очереди: 2 × 150
if (os.availableParallelism() >= 2) assert.ok(parallel < concurrent * 0.8, `потоки: ${parallel.toFixed(0)} мс`);

// --- критическая секция: перевод между счетами из четырёх потоков ---
const transfers = `
  const { workerData: { sab, n, locked, dir }, parentPort } = require('node:worker_threads');
  const acc = new Int32Array(sab, 0, 2);
  const m = new Int32Array(sab, 8, 1);
  const lock = () => { while (Atomics.compareExchange(m, 0, 0, 1) !== 0) Atomics.wait(m, 0, 1); };
  const unlock = () => { Atomics.store(m, 0, 0); Atomics.notify(m, 0, 1); };
  const [from, to] = dir ? [0, 1] : [1, 0];
  for (let i = 0; i < n; i++) {
    if (locked) lock();
    const a = acc[from], b = acc[to];      // прочитать оба счёта
    acc[from] = a - 1;                      // списать
    acc[to] = b + 1;                        // зачислить
    if (locked) unlock();
  }
  parentPort.postMessage(0);`;
async function bank(locked) {
  const sab = new SharedArrayBuffer(12);
  const acc = new Int32Array(sab, 0, 2);
  acc[0] = 1_000_000; acc[1] = 1_000_000;
  await Promise.all([0, 1, 2, 3].map((i) => run(transfers, { sab, n: 200_000, locked, dir: i % 2 === 0 })));
  return acc[0] + acc[1];
}
if (os.availableParallelism() >= 2) {
  const broken = await bank(false);
  assert.notEqual(broken, 2_000_000, 'без блокировки сумма должна была разойтись');
}
assert.equal(await bank(true), 2_000_000);                                                // с мьютексом инвариант держится

// --- взаимная блокировка: захват замков в разном порядке ---
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function reserve(name, first, second, signal) {
  return navigator.locks.request(first, { signal }, async () => {
    await sleep(20);
    return navigator.locks.request(second, { signal }, async () => `${name} готово`);
  });
}
const controller = new AbortController();
const deadlocked = Promise.allSettled([
  reserve('заказ', 'stock', 'balance', controller.signal),
  reserve('возврат', 'balance', 'stock', controller.signal),
]);
await sleep(150);
const state = await navigator.locks.query();
assert.deepEqual(state.held.map((l) => l.name).sort(), ['balance', 'stock']);              // каждый держит свой замок
assert.deepEqual(state.pending.map((l) => l.name).sort(), ['balance', 'stock']);           // и ждёт чужой
controller.abort();                                                                        // выход — тайм-аут или отмена
assert.deepEqual((await deadlocked).map((r) => r.reason?.name), ['AbortError', 'AbortError']);
// единый порядок захвата — блокировки нет
assert.deepEqual(await Promise.all([
  reserve('заказ', 'balance', 'stock'),
  reserve('возврат', 'balance', 'stock'),
]), ['заказ готово', 'возврат готово']);

// --- пул потоков libuv ---
function waves(size) {
  const r = spawnSync(process.execPath, ['-e', `
    const crypto = require('node:crypto');
    const start = Date.now(), ends = [];
    for (let i = 0; i < 8; i++) crypto.pbkdf2('пароль', 'соль', 300000, 32, 'sha256', () => {
      ends.push(Date.now() - start);
      if (ends.length === 8) console.log(JSON.stringify(ends));
    });`], { env: { ...process.env, UV_THREADPOOL_SIZE: String(size) }, encoding: 'utf8' });
  const ends = JSON.parse(r.stdout);
  return ends[7] / ends[0];
}
if (os.availableParallelism() >= 8) {
  assert.ok(waves(4) > 1.6, 'при пуле 4 вторая волна ждёт первую');
  assert.ok(waves(8) < 1.5, 'при пуле 8 все идут одновременно');
}

// --- закон Амдала: ускорение ограничено последовательной частью ---
const amdahl = (parallelShare, cores) => 1 / ((1 - parallelShare) + parallelShare / cores);
assert.equal(amdahl(0.9, 4).toFixed(2), '3.08');
assert.equal(amdahl(0.9, 1000).toFixed(2), '9.91');                                       // предел — 10 при 10% последовательного кода

console.log('threads ok');
