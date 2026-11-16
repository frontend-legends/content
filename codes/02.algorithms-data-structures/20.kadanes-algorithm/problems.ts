// Проверки к 2.20: алгоритм Кадане — максимальная сумма подмассива, границы подмассива и кольцевой
// вариант; примеры из условий и случайные тесты против перебора всех подмассивов.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/20.kadanes-algorithm
import { assert, fuzz, randArray, randInt } from '../_shared.ts';

// --- шаблон: Кадане с границами подмассива ---
function maxSubArrayRange(nums: number[]): [number, number, number] {
  let best = nums[0];
  let bestFrom = 0;
  let bestTo = 0;
  let current = nums[0];
  let from = 0;
  for (let i = 1; i < nums.length; i++) {
    if (current < 0) {                            // отрицательный хвост только мешает — начать заново
      current = nums[i];
      from = i;
    } else {
      current += nums[i];
    }
    if (current > best) [best, bestFrom, bestTo] = [current, from, i];
  }
  return [best, bestFrom, bestTo];
}

// --- 53. Maximum Subarray ---
function maxSubArray(nums: number[]): number {
  let best = nums[0];
  let current = nums[0];                          // лучшая сумма подмассива, кончающегося здесь
  for (let i = 1; i < nums.length; i++) {
    current = Math.max(nums[i], current + nums[i]);
    best = Math.max(best, current);
  }
  return best;
}

// --- 918. Maximum Sum Circular Subarray ---
function maxSubarraySumCircular(nums: number[]): number {
  let total = 0;
  let curMax = 0;
  let curMin = 0;
  let best = -Infinity;
  let worst = Infinity;
  for (const x of nums) {
    total += x;
    curMax = Math.max(x, curMax + x);
    best = Math.max(best, curMax);
    curMin = Math.min(x, curMin + x);
    worst = Math.min(worst, curMin);
  }
  // кольцевой подмассив = всё минус минимальный подмассив; но если всё отрицательное, «всё минус всё» пусто
  return best < 0 ? best : Math.max(best, total - worst);
}

// ===== проверки =====
const brute = (xs: number[]) => {
  let best = -Infinity;
  for (let i = 0; i < xs.length; i++) for (let j = i, s = 0; j < xs.length; j++) best = Math.max(best, (s += xs[j]));
  return best;
};

// шаблон
assert.deepEqual(maxSubArrayRange([-2, 1, -3, 4, -1, 2, 1, -5, 4]), [6, 3, 6]);
fuzz(1000, () => randArray(randInt(1, 15), -10, 10), (xs) => {
  const [sum, from, to] = maxSubArrayRange(xs);
  assert.equal(sum, brute(xs));
  assert.equal(xs.slice(from, to + 1).reduce((a, b) => a + b, 0), sum);
});

// 53
assert.equal(maxSubArray([-2, 1, -3, 4, -1, 2, 1, -5, 4]), 6);
assert.equal(maxSubArray([1]), 1);
assert.equal(maxSubArray([5, 4, -1, 7, 8]), 23);
assert.equal(maxSubArray([-3, -1, -2]), -1);
fuzz(1000, () => randArray(randInt(1, 15), -10, 10), (xs) => assert.equal(maxSubArray(xs), brute(xs)));

// 918
assert.equal(maxSubarraySumCircular([1, -2, 3, -2]), 3);
assert.equal(maxSubarraySumCircular([5, -3, 5]), 10);
assert.equal(maxSubarraySumCircular([-3, -2, -3]), -2);
fuzz(1000, () => randArray(randInt(1, 12), -10, 10), (xs) => {
  // эталон: все непустые подмассивы кольца длиной до n
  const n = xs.length;
  let best = -Infinity;
  for (let i = 0; i < n; i++) for (let len = 1, s = 0; len <= n; len++) best = Math.max(best, (s += xs[(i + len - 1) % n]));
  assert.equal(maxSubarraySumCircular(xs), best);
});

console.log('kadane ok');
