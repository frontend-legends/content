// Проверки к 2.21: двоичный поиск — левая граница, поиск в матрице, пик, повёрнутый массив,
// диапазон и медиана двух массивов; примеры из условий и случайные тесты против линейного поиска.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/21.binary-search
import { assert, fuzz, randArray, randInt } from '../_shared.ts';

// --- шаблон: первая позиция, где условие истинно ---
function lowerBound(nums: number[], target: number): number {
  let lo = 0;
  let hi = nums.length;                           // полуинтервал [lo, hi): ответ может быть равен length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (nums[mid] < target) lo = mid + 1;         // mid точно не ответ
    else hi = mid;                                // mid может быть ответом
  }
  return lo;
}

// --- 35. Search Insert Position ---
function searchInsert(nums: number[], target: number): number {
  return lowerBound(nums, target);
}

// --- 74. Search a 2D Matrix ---
function searchMatrix(matrix: number[][], target: number): boolean {
  const m = matrix.length;
  const n = matrix[0].length;
  let lo = 0;
  let hi = m * n - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const value = matrix[Math.floor(mid / n)][mid % n];   // матрица как один отсортированный массив
    if (value === target) return true;
    if (value < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}

// --- 162. Find Peak Element ---
function findPeakElement(nums: number[]): number {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (nums[mid] < nums[mid + 1]) lo = mid + 1;  // справа подъём — пик точно справа
    else hi = mid;                                // спуск — пик в [lo, mid]
  }
  return lo;
}

// --- 33. Search in Rotated Sorted Array ---
function search(nums: number[], target: number): number {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (nums[mid] === target) return mid;
    if (nums[lo] <= nums[mid]) {                  // левая половина отсортирована
      if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
      else lo = mid + 1;
    } else {                                      // правая половина отсортирована
      if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
      else hi = mid - 1;
    }
  }
  return -1;
}

// --- 34. Find First and Last Position of Element in Sorted Array ---
function searchRange(nums: number[], target: number): number[] {
  const first = lowerBound(nums, target);
  if (first === nums.length || nums[first] !== target) return [-1, -1];
  return [first, lowerBound(nums, target + 1) - 1];   // последняя — перед первой большей
}

// --- 153. Find Minimum in Rotated Sorted Array ---
function findMin(nums: number[]): number {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (nums[mid] > nums[hi]) lo = mid + 1;       // минимум правее mid
    else hi = mid;                                // mid может быть минимумом
  }
  return nums[lo];
}

// --- 4. Median of Two Sorted Arrays ---
function findMedianSortedArrays(nums1: number[], nums2: number[]): number {
  if (nums1.length > nums2.length) return findMedianSortedArrays(nums2, nums1);   // искать по короткому
  const m = nums1.length;
  const n = nums2.length;
  const half = (m + n + 1) >> 1;                  // размер левой части
  let lo = 0;
  let hi = m;
  while (lo <= hi) {
    const i = (lo + hi) >> 1;                     // сколько взять из nums1 в левую часть
    const j = half - i;                           // остальное — из nums2
    const left1 = i > 0 ? nums1[i - 1] : -Infinity;
    const right1 = i < m ? nums1[i] : Infinity;
    const left2 = j > 0 ? nums2[j - 1] : -Infinity;
    const right2 = j < n ? nums2[j] : Infinity;
    if (left1 > right2) hi = i - 1;               // из nums1 взяли слишком много
    else if (left2 > right1) lo = i + 1;          // слишком мало
    else {
      const leftMax = Math.max(left1, left2);
      if ((m + n) % 2) return leftMax;
      return (leftMax + Math.min(right1, right2)) / 2;
    }
  }
  throw new Error('массивы должны быть отсортированы');
}

// ===== проверки =====
const sortedRand = (len: number, lo: number, hi: number) => randArray(len, lo, hi).sort((a, b) => a - b);

// шаблон и 35
fuzz(1000, () => ({ xs: sortedRand(randInt(0, 12), 0, 10), t: randInt(-1, 11) }), ({ xs, t }) => {
  const expected = xs.findIndex((x) => x >= t);
  assert.equal(lowerBound(xs, t), expected === -1 ? xs.length : expected);
});
assert.equal(searchInsert([1, 3, 5, 6], 5), 2);
assert.equal(searchInsert([1, 3, 5, 6], 2), 1);
assert.equal(searchInsert([1, 3, 5, 6], 7), 4);
// lo + hi у индексов до 2^31 переполнил бы int32; >>> 1 корректен до 2^32
assert.equal((2 ** 31 + 2 ** 31 - 2) >>> 1, 2 ** 31 - 1);
assert.ok(((2 ** 31 + 2 ** 31 - 2) | 0) < 0);

// 74
const mat = [[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]];
assert.equal(searchMatrix(mat, 3), true);
assert.equal(searchMatrix(mat, 13), false);
fuzz(500, () => { const m = randInt(1, 4), n = randInt(1, 4); const flat = [...new Set(sortedRand(m * n, 0, 40))]; while (flat.length < m * n) flat.push(flat.at(-1)! + 1); return { m: Array.from({ length: m }, (_, r) => flat.slice(r * n, r * n + n)), t: randInt(-1, 45) }; }, ({ m, t }) => {
  assert.equal(searchMatrix(m, t), m.flat().includes(t));
});

// 162
assert.equal(findPeakElement([1, 2, 3, 1]), 2);
assert.ok([1, 5].includes(findPeakElement([1, 2, 1, 3, 5, 6, 4])));
fuzz(1000, () => { const xs = randArray(randInt(1, 12), 0, 20); return xs.filter((x, i) => i === 0 || x !== xs[i - 1]); }, (xs) => {
  const i = findPeakElement(xs);
  const at = (k: number) => (k < 0 || k >= xs.length ? -Infinity : xs[k]);
  assert.ok(xs[i] > at(i - 1) && xs[i] > at(i + 1));
});

// 33, 153
assert.equal(search([4, 5, 6, 7, 0, 1, 2], 0), 4);
assert.equal(search([4, 5, 6, 7, 0, 1, 2], 3), -1);
assert.equal(search([1], 0), -1);
assert.equal(findMin([3, 4, 5, 1, 2]), 1);
assert.equal(findMin([4, 5, 6, 7, 0, 1, 2]), 0);
assert.equal(findMin([11, 13, 15, 17]), 11);
fuzz(1000, () => { const xs = [...new Set(sortedRand(randInt(1, 12), -20, 20))]; const k = randInt(0, xs.length - 1); return { xs: [...xs.slice(k), ...xs.slice(0, k)], t: randInt(-21, 21) }; }, ({ xs, t }) => {
  assert.equal(search(xs, t), xs.indexOf(t));
  assert.equal(findMin(xs), Math.min(...xs));
});

// 34
assert.deepEqual(searchRange([5, 7, 7, 8, 8, 10], 8), [3, 4]);
assert.deepEqual(searchRange([5, 7, 7, 8, 8, 10], 6), [-1, -1]);
assert.deepEqual(searchRange([], 0), [-1, -1]);
fuzz(1000, () => ({ xs: sortedRand(randInt(0, 12), 0, 6), t: randInt(-1, 7) }), ({ xs, t }) => {
  assert.deepEqual(searchRange(xs, t), [xs.indexOf(t), xs.lastIndexOf(t)]);
});

// 4
assert.equal(findMedianSortedArrays([1, 3], [2]), 2);
assert.equal(findMedianSortedArrays([1, 2], [3, 4]), 2.5);
assert.equal(findMedianSortedArrays([], [1]), 1);
fuzz(2000, () => [sortedRand(randInt(0, 8), -10, 10), sortedRand(randInt(0, 8), -10, 10)], ([a, b]) => {
  if (a.length + b.length === 0) return;
  const all = [...a, ...b].sort((x, y) => x - y);
  const k = all.length;
  const median = k % 2 ? all[(k - 1) / 2] : (all[k / 2 - 1] + all[k / 2]) / 2;
  assert.equal(findMedianSortedArrays(a, b), median);
});

console.log('binary search ok');
