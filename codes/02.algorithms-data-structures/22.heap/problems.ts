// Проверки к 2.22: двоичная куча — своя реализация, k-й наибольший, жадный выбор проектов, k пар с
// наименьшей суммой и медиана потока; примеры из условий и случайные тесты против сортировки.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/22.heap
import { assert, fuzz, randArray, randInt } from '../_shared.ts';

// --- шаблон: двоичная куча с компаратором ---
class Heap<T> {
  private items: T[] = [];

  constructor(private before: (a: T, b: T) => boolean) {}   // true — a ближе к вершине

  get size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  push(value: T): void {
    const a = this.items;
    a.push(value);
    let i = a.length - 1;
    while (i > 0) {                               // просеять вверх
      const parent = (i - 1) >> 1;
      if (!this.before(a[i], a[parent])) break;
      [a[i], a[parent]] = [a[parent], a[i]];
      i = parent;
    }
  }

  pop(): T | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {                                  // просеять вниз
        const l = 2 * i + 1;
        const r = l + 1;
        let best = i;
        if (l < a.length && this.before(a[l], a[best])) best = l;
        if (r < a.length && this.before(a[r], a[best])) best = r;
        if (best === i) break;
        [a[i], a[best]] = [a[best], a[i]];
        i = best;
      }
    }
    return top;
  }
}

// --- 215. Kth Largest Element in an Array ---
function findKthLargest(nums: number[], k: number): number {
  const heap = new Heap<number>((a, b) => a < b); // min-куча из k наибольших
  for (const x of nums) {
    heap.push(x);
    if (heap.size > k) heap.pop();                // выбросить наименьший
  }
  return heap.peek()!;
}

// --- 502. IPO ---
function findMaximizedCapital(k: number, w: number, profits: number[], capital: number[]): number {
  const projects = capital.map((c, i) => [c, profits[i]]).sort((a, b) => a[0] - b[0]);
  const available = new Heap<number>((a, b) => a > b);   // max-куча прибылей доступных проектов
  let i = 0;
  for (let round = 0; round < k; round++) {
    while (i < projects.length && projects[i][0] <= w) available.push(projects[i++][1]);
    if (available.size === 0) break;              // ничего не по карману
    w += available.pop()!;
  }
  return w;
}

// --- 373. Find K Pairs with Smallest Sums ---
function kSmallestPairs(nums1: number[], nums2: number[], k: number): number[][] {
  const heap = new Heap<[number, number, number]>((a, b) => a[0] < b[0]);   // [сумма, i, j]
  for (let i = 0; i < Math.min(nums1.length, k); i++) heap.push([nums1[i] + nums2[0], i, 0]);
  const result: number[][] = [];
  while (result.length < k && heap.size > 0) {
    const [, i, j] = heap.pop()!;
    result.push([nums1[i], nums2[j]]);
    if (j + 1 < nums2.length) heap.push([nums1[i] + nums2[j + 1], i, j + 1]);   // следующий в строке i
  }
  return result;
}

// --- 295. Find Median from Data Stream ---
class MedianFinder {
  private low = new Heap<number>((a, b) => a > b);   // max-куча: меньшая половина
  private high = new Heap<number>((a, b) => a < b);  // min-куча: большая половина

  addNum(num: number): void {
    this.low.push(num);
    this.high.push(this.low.pop()!);              // наибольший из меньших — в большую половину
    if (this.high.size > this.low.size) this.low.push(this.high.pop()!);   // low больше на 0 или 1
  }

  findMedian(): number {
    if (this.low.size > this.high.size) return this.low.peek()!;
    return (this.low.peek()! + this.high.peek()!) / 2;
  }
}

// ===== проверки =====
const asc = (xs: number[]) => [...xs].sort((a, b) => a - b);

// шаблон: пирамидальная сортировка кучей
fuzz(500, () => randArray(randInt(0, 40), -50, 50), (xs) => {
  const h = new Heap<number>((a, b) => a < b);
  xs.forEach((x) => h.push(x));
  const out: number[] = [];
  while (h.size) out.push(h.pop()!);
  assert.deepEqual(out, asc(xs));
  assert.equal(h.pop(), undefined);
});

// 215
assert.equal(findKthLargest([3, 2, 1, 5, 6, 4], 2), 5);
assert.equal(findKthLargest([3, 2, 3, 1, 2, 4, 5, 5, 6], 4), 4);
fuzz(1000, () => { const xs = randArray(randInt(1, 20), -20, 20); return { xs, k: randInt(1, xs.length) }; }, ({ xs, k }) => {
  assert.equal(findKthLargest(xs, k), asc(xs).reverse()[k - 1]);
});

// 502
assert.equal(findMaximizedCapital(2, 0, [1, 2, 3], [0, 1, 1]), 4);
assert.equal(findMaximizedCapital(3, 0, [1, 2, 3], [0, 1, 2]), 6);
assert.equal(findMaximizedCapital(1, 0, [1, 2, 3], [1, 1, 2]), 0);
fuzz(500, () => { const n = randInt(1, 6); return { k: randInt(1, n), w: randInt(0, 3), p: randArray(n, 0, 5), c: randArray(n, 0, 6) }; }, ({ k, w, p, c }) => {
  // эталон: перебор всех порядков выбора не больше k проектов
  const n = p.length;
  let best = w;
  const go = (cap: number, used: number, left: number) => {
    best = Math.max(best, cap);
    if (left === 0) return;
    for (let i = 0; i < n; i++) if (!(used & (1 << i)) && c[i] <= cap) go(cap + p[i], used | (1 << i), left - 1);
  };
  go(w, 0, k);
  assert.equal(findMaximizedCapital(k, w, p, c), best);
});

// 373
assert.deepEqual(kSmallestPairs([1, 7, 11], [2, 4, 6], 3), [[1, 2], [1, 4], [1, 6]]);
assert.deepEqual(kSmallestPairs([1, 1, 2], [1, 2, 3], 2).map(([a, b]) => a + b), [2, 2]);
fuzz(500, () => ({ a: asc(randArray(randInt(1, 6), -5, 5)), b: asc(randArray(randInt(1, 6), -5, 5)), k: randInt(1, 40) }), ({ a, b, k }) => {
  const sums = asc(a.flatMap((x) => b.map((y) => x + y))).slice(0, k);
  const got = kSmallestPairs(a, b, k);
  assert.deepEqual(got.map(([x, y]) => x + y), sums);
  for (const [x, y] of got) assert.ok(a.includes(x) && b.includes(y));
});

// 295
const mf = new MedianFinder();
mf.addNum(1);
mf.addNum(2);
assert.equal(mf.findMedian(), 1.5);
mf.addNum(3);
assert.equal(mf.findMedian(), 2);
fuzz(300, () => randArray(randInt(1, 30), -100, 100), (xs) => {
  const f = new MedianFinder();
  xs.forEach((x, i) => {
    f.addNum(x);
    const s = asc(xs.slice(0, i + 1));
    const n = s.length;
    assert.equal(f.findMedian(), n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2);
  });
});

console.log('heap ok');
