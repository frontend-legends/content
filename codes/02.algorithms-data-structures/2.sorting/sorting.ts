// Проверки к 2.2: сортировки — вставками, слиянием, быстрая с трёхчастным разбиением, пирамидальная,
// подсчётом и поразрядная; быстрый выбор, флаг Нидерландов и частые элементы через корзины.
// Сравнение со встроенной сортировкой, проверка устойчивости и подсчёт сравнений.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/2.sorting
import { assert, fuzz, randArray, randInt } from '../_shared.ts';

type Compare<T> = (a: T, b: T) => number;
const byNumber: Compare<number> = (a, b) => a - b;

// --- сортировка вставками ---
function insertionSort<T>(arr: T[], cmp: Compare<T>): T[] {
  for (let i = 1; i < arr.length; i++) {
    const x = arr[i];
    let j = i - 1;
    while (j >= 0 && cmp(arr[j], x) > 0) {        // сдвигать вправо всё, что больше x
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = x;
  }
  return arr;
}

// --- сортировка слиянием ---
function mergeSort<T>(arr: T[], cmp: Compare<T>): T[] {
  if (arr.length <= 1) return arr;
  const mid = arr.length >> 1;
  const left = mergeSort(arr.slice(0, mid), cmp);
  const right = mergeSort(arr.slice(mid), cmp);
  const out: T[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    out.push(cmp(left[i], right[j]) <= 0 ? left[i++] : right[j++]);   // <= — равные берём слева: устойчивость
  }
  return out.concat(left.slice(i), right.slice(j));
}

// --- быстрая сортировка с трёхчастным разбиением ---
function quickSort(arr: number[], lo = 0, hi = arr.length - 1): number[] {
  if (lo >= hi) return arr;
  const pivot = arr[lo + Math.floor(Math.random() * (hi - lo + 1))];   // случайный опорный
  let lt = lo;                                    // arr[lo..lt) < pivot
  let gt = hi;                                    // arr(gt..hi] > pivot
  let i = lo;                                     // arr[lt..i) === pivot
  while (i <= gt) {
    if (arr[i] < pivot) {
      [arr[lt], arr[i]] = [arr[i], arr[lt]];
      lt++;
      i++;
    } else if (arr[i] > pivot) {
      [arr[i], arr[gt]] = [arr[gt], arr[i]];
      gt--;                                       // i не двигаем: пришёл непроверенный элемент
    } else {
      i++;
    }
  }
  quickSort(arr, lo, lt - 1);                     // равные опорному уже на месте
  quickSort(arr, gt + 1, hi);
  return arr;
}

// --- пирамидальная сортировка ---
function heapSort(arr: number[]): number[] {
  const n = arr.length;
  const siftDown = (i: number, size: number) => {
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let big = i;
      if (l < size && arr[l] > arr[big]) big = l;
      if (r < size && arr[r] > arr[big]) big = r;
      if (big === i) return;
      [arr[i], arr[big]] = [arr[big], arr[i]];
      i = big;
    }
  };
  for (let i = (n >> 1) - 1; i >= 0; i--) siftDown(i, n);   // построить max-кучу за O(n)
  for (let end = n - 1; end > 0; end--) {
    [arr[0], arr[end]] = [arr[end], arr[0]];      // максимум — в конец
    siftDown(0, end);
  }
  return arr;
}

// --- сортировка подсчётом (устойчивая, по целому ключу из [0, k)) ---
function countingSort<T>(items: T[], key: (item: T) => number, k: number): T[] {
  const count = new Array(k + 1).fill(0);
  for (const item of items) count[key(item) + 1]++;
  for (let v = 0; v < k; v++) count[v + 1] += count[v];   // count[v] — где начинаются ключи v
  const out = new Array<T>(items.length);
  for (const item of items) out[count[key(item)]++] = item;   // проход слева — порядок равных сохранён
  return out;
}

// --- поразрядная сортировка неотрицательных целых ---
function radixSort(nums: number[]): number[] {
  let out = nums;
  const max = Math.max(0, ...nums);
  for (let place = 1; Math.floor(max / place) > 0; place *= 10) {
    out = countingSort(out, (x) => Math.floor(x / place) % 10, 10);   // устойчиво по очередной цифре
  }
  return out;
}

// --- быстрый выбор: k-й наименьший (с нуля) ---
function quickSelect(arr: number[], k: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  for (;;) {
    const pivot = arr[lo + Math.floor(Math.random() * (hi - lo + 1))];
    let lt = lo;
    let gt = hi;
    let i = lo;
    while (i <= gt) {
      if (arr[i] < pivot) {
        [arr[lt], arr[i]] = [arr[i], arr[lt]];
        lt++;
        i++;
      } else if (arr[i] > pivot) {
        [arr[i], arr[gt]] = [arr[gt], arr[i]];
        gt--;
      } else {
        i++;
      }
    }
    if (k < lt) hi = lt - 1;                      // ответ среди меньших
    else if (k > gt) lo = gt + 1;                 // среди больших
    else return pivot;                            // попал в равные опорному
  }
}

// --- 75. Sort Colors ---
function sortColors(nums: number[]): void {
  let lo = 0;                                     // [0, lo) — нули
  let hi = nums.length - 1;                       // (hi, end] — двойки
  for (let i = 0; i <= hi; ) {
    if (nums[i] === 0) {
      [nums[lo], nums[i]] = [nums[i], nums[lo]];
      lo++;
      i++;
    } else if (nums[i] === 2) {
      [nums[i], nums[hi]] = [nums[hi], nums[i]];
      hi--;                                       // i не двигаем: пришёл непроверенный элемент
    } else {
      i++;
    }
  }
}

// --- 347. Top K Frequent Elements ---
function topKFrequent(nums: number[], k: number): number[] {
  const freq = new Map<number, number>();
  for (const x of nums) freq.set(x, (freq.get(x) ?? 0) + 1);
  const buckets: number[][] = Array.from({ length: nums.length + 1 }, () => []);
  for (const [x, f] of freq) buckets[f].push(x);  // корзина по частоте: частота не больше n
  const result: number[] = [];
  for (let f = nums.length; f > 0 && result.length < k; f--) result.push(...buckets[f]);
  return result.slice(0, k);
}

// ===== проверки =====
const asc = (xs: number[]) => [...xs].sort(byNumber);

fuzz(1000, () => randArray(randInt(0, 40), -20, 20), (xs) => {
  assert.deepEqual(insertionSort([...xs], byNumber), asc(xs));
  assert.deepEqual(mergeSort([...xs], byNumber), asc(xs));
  assert.deepEqual(quickSort([...xs]), asc(xs));
  assert.deepEqual(heapSort([...xs]), asc(xs));
  assert.deepEqual(countingSort(xs, (x) => x + 20, 41), asc(xs));
  const nonNeg = xs.map(Math.abs).map((x) => x * 997);
  assert.deepEqual(radixSort(nonNeg), asc(nonNeg));
  if (xs.length) {
    const k = randInt(0, xs.length - 1);
    assert.equal(quickSelect([...xs], k), asc(xs)[k]);
  }
});

// устойчивость: равные ключи сохраняют исходный порядок
fuzz(500, () => randArray(randInt(0, 30), 0, 4).map((key, id) => ({ key, id })), (items) => {
  const expected = [...items].sort((a, b) => a.key - b.key || a.id - b.id);
  assert.deepEqual(mergeSort([...items], (a, b) => a.key - b.key), expected);
  assert.deepEqual(insertionSort([...items], (a, b) => a.key - b.key), expected);
  assert.deepEqual(countingSort(items, (x) => x.key, 5), expected);
  assert.deepEqual([...items].sort((a, b) => a.key - b.key), expected);                             // Array.prototype.sort тоже
});
// пирамидальная — неустойчивая: на равных ключах порядок меняется
{
  const pairs = [[1, 0], [1, 1], [1, 2], [0, 3]];
  const order = [0, 1, 2, 3];
  const keys = pairs.map(([k]) => k);
  const idx = [...order];
  const n = keys.length;
  const sift = (i: number, size: number) => { for (;;) { const l = 2 * i + 1, r = l + 1; let b = i; if (l < size && keys[l] > keys[b]) b = l; if (r < size && keys[r] > keys[b]) b = r; if (b === i) return; [keys[i], keys[b]] = [keys[b], keys[i]]; [idx[i], idx[b]] = [idx[b], idx[i]]; i = b; } };
  for (let i = (n >> 1) - 1; i >= 0; i--) sift(i, n);
  for (let end = n - 1; end > 0; end--) { [keys[0], keys[end]] = [keys[end], keys[0]]; [idx[0], idx[end]] = [idx[end], idx[0]]; sift(0, end); }
  assert.deepEqual(idx, [3, 2, 1, 0]);                                                              // равные единицы встали в обратном порядке
}

// число сравнений
const counted = () => { let c = 0; return { cmp: (a: number, b: number) => (c++, a - b), get: () => c }; };
{
  const sorted = Array.from({ length: 1000 }, (_, i) => i);
  const a = counted();
  insertionSort([...sorted], a.cmp);
  assert.equal(a.get(), 999);                                                                       // на отсортированном — n − 1
  const b = counted();
  insertionSort([...sorted].reverse(), b.cmp);
  assert.equal(b.get(), (1000 * 999) / 2);                                                          // на обратном — n(n − 1)/2
  const c = counted();
  mergeSort(randArray(1000, 0, 1e6), c.cmp);
  assert.ok(c.get() <= 1000 * Math.log2(1000));                                                     // не больше n log n
  const log2Factorial = Array.from({ length: 1000 }, (_, i) => Math.log2(i + 1)).reduce((s, x) => s + x, 0);
  assert.equal(Math.ceil(log2Factorial), 8530);                                                     // нижняя граница для 1000 элементов
  assert.ok(c.get() >= log2Factorial);
}
// быстрая сортировка с первым элементом как опорным на отсортированных данных — n(n − 1)/2 сравнений
{
  let comparisons = 0;
  const naiveQuick = (xs: number[]): number[] => {
    if (xs.length <= 1) return xs;
    const [p, ...rest] = xs;
    const less: number[] = [], more: number[] = [];
    for (const x of rest) { comparisons++; (x < p ? less : more).push(x); }
    return [...naiveQuick(less), p, ...naiveQuick(more)];
  };
  naiveQuick(Array.from({ length: 2000 }, (_, i) => i));
  assert.equal(comparisons, (2000 * 1999) / 2);
}
// трёхчастное разбиение: массив из одинаковых элементов — без квадратичного времени
{
  const same = new Array(200_000).fill(7);
  const t = performance.now();
  quickSort(same);
  assert.ok(performance.now() - t < 200);
}

// 75
const colors = [2, 0, 2, 1, 1, 0];
sortColors(colors);
assert.deepEqual(colors, [0, 0, 1, 1, 2, 2]);
fuzz(1000, () => randArray(randInt(0, 20), 0, 2), (xs) => { const a = [...xs]; sortColors(a); assert.deepEqual(a, asc(xs)); });

// 347
assert.deepEqual(topKFrequent([1, 1, 1, 2, 2, 3], 2), [1, 2]);
assert.deepEqual(topKFrequent([1], 1), [1]);
fuzz(1000, () => { const xs = randArray(randInt(1, 25), 0, 6); return { xs, k: randInt(1, new Set(xs).size) }; }, ({ xs, k }) => {
  const freq = (v: number) => xs.filter((x) => x === v).length;
  const got = topKFrequent(xs, k);
  assert.equal(new Set(got).size, k);
  const kth = [...new Set(xs)].map(freq).sort((a, b) => b - a)[k - 1];
  assert.ok(got.every((v) => freq(v) >= kth));                                                       // каждый не реже k-го по частоте
});

console.log('sorting ok');
