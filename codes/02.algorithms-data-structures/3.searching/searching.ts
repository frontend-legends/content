// Проверки к 2.3: алгоритмы поиска — линейный с барьером, интерполяционный, экспоненциальный и
// прыжками; число проб на равномерных и неравномерных данных, поиск в массиве неизвестной длины,
// первая плохая версия и матрица, отсортированная по строкам и столбцам.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/3.searching
import { assert, fuzz, randArray, randInt } from '../_shared.ts';

let probes = 0;                                   // сколько элементов прочитал последний поиск
const counted = (arr: number[]) => new Proxy(arr, {
  get(target, key, receiver) {
    if (typeof key === 'string' && /^\d+$/.test(key)) probes++;   // чтение по индексу
    return Reflect.get(target, key, receiver);
  },
});

// --- двоичный поиск (шаблон из 2.21, с подсчётом проб) ---
function binarySearch(arr: number[], target: number, lo = 0, hi = arr.length - 1): number {
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const v = arr[mid];
    if (v === target) return mid;
    if (v < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

// --- интерполяционный поиск ---
function interpolationSearch(arr: number[], target: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo <= hi) {
    const low = arr[lo];
    const high = arr[hi];
    if (target < low || target > high) return -1;
    if (high === low) return low === target ? lo : -1;
    // угадать позицию по значению, как ищут слово в бумажном словаре
    const pos = lo + Math.floor(((target - low) * (hi - lo)) / (high - low));
    const v = arr[pos];
    if (v === target) return pos;
    if (v < target) lo = pos + 1;
    else hi = pos - 1;
  }
  return -1;
}

// --- экспоненциальный поиск ---
function exponentialSearch(arr: number[], target: number): number {
  if (arr.length === 0) return -1;
  let bound = 1;
  while (bound < arr.length && arr[bound] < target) bound *= 2;   // 1, 2, 4, 8… пока не перешагнули
  return binarySearch(arr, target, bound >> 1, Math.min(bound, arr.length - 1));
}

// --- поиск прыжками ---
function jumpSearch(arr: number[], target: number): number {
  const n = arr.length;
  const step = Math.max(1, Math.floor(Math.sqrt(n)));
  let prev = 0;
  let next = step;
  while (prev < n && arr[Math.min(next, n) - 1] < target) {   // прыгать блоками по √n
    prev = next;
    next += step;
  }
  for (let i = prev; i < Math.min(next, n); i++) {   // линейно внутри блока
    if (arr[i] === target) return i;
  }
  return -1;
}

// --- 702. Search in a Sorted Array of Unknown Size ---
interface ArrayReader {
  get(index: number): number;                     // за концом — 2^31 − 1
}

function searchUnknown(reader: ArrayReader, target: number): number {
  let hi = 1;
  while (reader.get(hi) < target) hi *= 2;        // найти границу, за которой target уже не может быть
  let lo = hi >> 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const v = reader.get(mid);
    if (v === target) return mid;
    if (v < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

// --- 278. First Bad Version ---
function firstBadVersion(n: number, isBad: (version: number) => boolean): number {
  let lo = 1;
  let hi = n;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (isBad(mid)) hi = mid;                     // mid плохая — первая не правее
    else lo = mid + 1;
  }
  return lo;
}

// --- 240. Search a 2D Matrix II ---
function searchMatrixII(matrix: number[][], target: number): boolean {
  let r = 0;
  let c = matrix[0].length - 1;                   // правый верхний угол
  while (r < matrix.length && c >= 0) {
    const v = matrix[r][c];
    if (v === target) return true;
    if (v > target) c--;                          // весь столбец ниже ещё больше — отбросить
    else r++;                                     // вся строка левее ещё меньше — отбросить
  }
  return false;
}

// ===== проверки =====
const sortedUnique = (n: number, gap: number) => Array.from({ length: n }, (_, i) => i * gap + randInt(0, gap - 1));

fuzz(1000, () => { const xs = [...new Set(randArray(randInt(0, 40), -50, 50))].sort((a, b) => a - b); return { xs, t: randInt(-55, 55) }; }, ({ xs, t }) => {
  const expected = xs.indexOf(t);
  for (const search of [binarySearch, interpolationSearch, exponentialSearch, jumpSearch]) {
    assert.equal(search(xs, t), expected, search.name);
  }
});

// число проб на миллионе равномерно распределённых чисел
const uniformData = sortedUnique(1_000_000, 10);
const uniform = counted(uniformData);
const measure = (search: (a: number[], t: number) => number) => {
  let total = 0;
  let worst = 0;
  for (let k = 0; k < 2000; k++) {
    const i = randInt(0, uniform.length - 1);
    const t = uniformData[i];
    probes = 0;
    assert.equal(search(uniform, t), i);
    total += probes;
    worst = Math.max(worst, probes);
  }
  return { avg: total / 2000, worst };
};
const bin = measure(binarySearch);
const interp = measure(interpolationSearch);
const jumpStats = measure(jumpSearch);
assert.ok(bin.worst <= 20);                                                                         // ⌈log₂ 10⁶⌉ = 20
assert.ok(interp.avg < 15);                                                                         // log log n шагов по три чтения
assert.ok(jumpStats.worst <= 2 * 1000 + 1);                                                          // до √n прыжков и √n шагов
assert.ok(jumpStats.avg > 500);
// на неравномерных данных интерполяция деградирует: кубы чисел
const skewedData = Array.from({ length: 100_000 }, (_, i) => i ** 3);
const skewed = counted(skewedData);
probes = 0;
assert.equal(interpolationSearch(skewed, skewedData[1000]), 1000);
const skewedProbes = probes;
probes = 0;
binarySearch(skewed, skewedData[1000]);
assert.ok(skewedProbes > 3000);                                                                    // 1001 шаг: проба сдвигается на один элемент
assert.ok(probes <= 17);                                                                            // двоичному хватает ⌈log₂ 10⁵⌉

// экспоненциальный: цель близко к началу — мало проб даже в огромном массиве
probes = 0;
assert.equal(exponentialSearch(uniform, uniformData[5]), 5);
assert.ok(probes <= 8);

// 702
fuzz(500, () => { const xs = [...new Set(randArray(randInt(1, 60), -100, 100))].sort((a, b) => a - b); return { xs, t: randInt(-105, 105) }; }, ({ xs, t }) => {
  const reader = { get: (i: number) => (i < xs.length ? xs[i] : 2 ** 31 - 1) };
  assert.equal(searchUnknown(reader, t), xs.indexOf(t));
});

// 278
fuzz(1000, () => { const n = randInt(1, 1000); return { n, bad: randInt(1, n) }; }, ({ n, bad }) => {
  let calls = 0;
  assert.equal(firstBadVersion(n, (v) => (calls++, v >= bad)), bad);
  assert.ok(calls <= Math.ceil(Math.log2(n)));
});
assert.equal(firstBadVersion(2 ** 31 - 1, (v) => v >= 2 ** 31 - 2), 2 ** 31 - 2);                    // lo + (hi − lo) / 2 — без переполнения в других языках

// 240
const m = [[1, 4, 7, 11, 15], [2, 5, 8, 12, 19], [3, 6, 9, 16, 22], [10, 13, 14, 17, 24], [18, 21, 23, 26, 30]];
assert.equal(searchMatrixII(m, 5), true);
assert.equal(searchMatrixII(m, 20), false);
fuzz(500, () => {
  const rows = randInt(1, 6), cols = randInt(1, 6);
  const g = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g[r][c] = Math.max(r ? g[r - 1][c] : 0, c ? g[r][c - 1] : 0) + randInt(0, 3);
  return { g, t: randInt(0, 30) };
}, ({ g, t }) => assert.equal(searchMatrixII(g, t), g.flat().includes(t)));

console.log('searching ok');
