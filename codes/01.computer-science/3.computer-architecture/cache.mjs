// Проверки к 1.03 в Node: последовательный обход памяти быстрее случайного, обход матрицы по строкам быстрее,
// чем по столбцам, предсказуемое ветвление быстрее случайного, связный список медленнее массива,
// ложное разделение кеш-линии между потоками. Время зависит от машины, поэтому проверяются только отношения
// с большим запасом (в проверке на Apple M4 разница была в 4–8 раз, здесь требуется хотя бы в 1,5–2).
// Запуск: cd codes && node run.mjs 01.computer-science/3.computer-architecture
import assert from 'node:assert/strict';
import os from 'node:os';
import { Worker } from 'node:worker_threads';

const time = (f) => { const s = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - s) / 1e6; };
const best = (f) => Math.min(time(f), time(f), time(f));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const x = a[i]; a[i] = a[j]; a[j] = x; } return a; };
const ratios = {};

// --- одна и та же сумма: индексы по порядку и вразнобой (64 МБ — больше любого кеша) ---
const N = 1 << 23;
const values = new Float64Array(N).fill(1);
const inOrder = new Uint32Array(N).map((_, i) => i);
const random = shuffle(inOrder.slice());
const sumBy = (ix) => () => { let s = 0; for (let i = 0; i < N; i++) s += values[ix[i]]; return s; };
ratios.random = best(sumBy(random)) / best(sumBy(inOrder));

// --- матрица 2048 × 2048: по строкам соседние элементы рядом, по столбцам — через 16 КБ ---
const W = 2048;
const m = new Float64Array(W * W).fill(1);
const byRows = () => { let s = 0; for (let r = 0; r < W; r++) for (let c = 0; c < W; c++) s += m[r * W + c]; return s; };
const byCols = () => { let s = 0; for (let c = 0; c < W; c++) for (let r = 0; r < W; r++) s += m[r * W + c]; return s; };
assert.equal(byRows(), byCols());
ratios.columns = best(byCols) / best(byRows);

// --- ветвление: те же числа, отсортированные и нет ---
const M = 1 << 22;
const data = new Int32Array(M).map(() => (Math.random() * 256) | 0);
const sorted = data.slice().sort();
const bigOnes = (d) => () => { let s = 0; for (let i = 0; i < M; i++) if (d[i] >= 128) s += d[i]; return s; };
assert.equal(bigOnes(data)(), bigOnes(sorted)());                                    // результат один
ratios.branches = best(bigOnes(data)) / best(bigOnes(sorted));

// --- связный список, разбросанный по памяти, против массива: оба O(n) ---
const L = 1 << 21;
const arr = Array.from({ length: L }, (_, i) => i);
let nodes = Array.from({ length: L }, (_, i) => ({ value: i, next: null }));
const order = shuffle(Array.from({ length: L }, (_, i) => i));
for (let i = 0; i < L - 1; i++) nodes[order[i]].next = nodes[order[i + 1]];
const head = nodes[order[0]];
nodes = null;
const sumArray = () => { let s = 0; for (let i = 0; i < L; i++) s += arr[i]; return s; };
const sumList = () => { let s = 0; for (let n = head; n; n = n.next) s += n.value; return s; };
assert.equal(sumArray(), sumList());
ratios.list = best(sumList) / best(sumArray);

// --- ложное разделение: 4 потока увеличивают свои счётчики, соседние или разнесённые на 128 байт ---
const counter = `
  const { workerData: { sab, slot, n }, parentPort } = require('node:worker_threads');
  const a = new Int32Array(sab);
  for (let i = 0; i < n; i++) Atomics.add(a, slot, 1);
  parentPort.postMessage(a[slot]);`;
async function counters(gap, threads = 4, n = 5e6) {
  const sab = new SharedArrayBuffer(4 * gap * threads);
  const start = performance.now();
  const done = await Promise.all(Array.from({ length: threads }, (_, i) => new Promise((resolve, reject) => {
    const w = new Worker(counter, { eval: true, workerData: { sab, slot: i * gap, n } });
    w.on('message', (v) => { w.terminate(); resolve(v); });
    w.on('error', reject);
  })));
  assert.deepEqual(done, Array(threads).fill(n));
  return performance.now() - start;
}
if (os.availableParallelism() >= 4) {
  const adjacent = Math.min(await counters(1), await counters(1));
  const padded = Math.min(await counters(32), await counters(32));                   // 32 × 4 байта = 128 байт
  ratios.falseSharing = adjacent / padded;
}

// --- практика «Почему тормозит?»: суммы по столбцам, циклы переставлены ---
{
  const H = 1500, Wd = 1500;
  const grid = new Float64Array(H * Wd).map(() => Math.random());
  const slow = () => { const t = new Float64Array(Wd); for (let c = 0; c < Wd; c++) for (let r = 0; r < H; r++) t[c] += grid[r * Wd + c]; return t; };
  const fast = () => { const t = new Float64Array(Wd); for (let r = 0; r < H; r++) { const row = r * Wd; for (let c = 0; c < Wd; c++) t[c] += grid[row + c]; } return t; };
  assert.deepEqual(fast(), slow());                                                   // тот же порядок сложений в каждом столбце
}

// --- практика «Почему список медленнее массива?»: очередь на массиве с указателем головы ---
class Queue {
  #items = [];
  #head = 0;
  push(x) { this.#items.push(x); }
  shift() {
    if (this.#head === this.#items.length) return undefined;
    const x = this.#items[this.#head++];
    if (this.#head > 1024 && this.#head * 2 > this.#items.length) {
      this.#items = this.#items.slice(this.#head);
      this.#head = 0;
    }
    return x;
  }
}
{
  const q = new Queue();
  const out = [];
  for (let i = 0; i < 5000; i++) { q.push(i); if (i % 3 === 0) out.push(q.shift()); }
  for (let x = q.shift(); x !== undefined; x = q.shift()) out.push(x);
  assert.deepEqual(out, Array.from({ length: 5000 }, (_, i) => i));                  // порядок FIFO сохранён
  assert.equal(q.shift(), undefined);
}

for (const [name, r] of Object.entries(ratios)) assert.ok(r >= (name === 'branches' ? 1.5 : 2), `${name}: ${r.toFixed(2)}`);
assert.equal(os.endianness(), 'LE');

console.log('cache ok', Object.fromEntries(Object.entries(ratios).map(([k, v]) => [k, +v.toFixed(1)])));
