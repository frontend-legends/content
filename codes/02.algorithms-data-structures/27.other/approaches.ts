// Проверки к 2.27: подходы к решению задач — стресс-тест быстрого решения против перебора, поиск
// минимального контрпримера, ловушки JavaScript в алгоритмах и путь от перебора к O(n).
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/27.other
import { assert, randArray, randInt } from '../_shared.ts';

// --- стресс-тест: сравнить быстрое решение с перебором на случайных входах ---
function stressTest<I, O>(
  fast: (input: I) => O,
  slow: (input: I) => O,
  generate: (size: number) => I,
  rounds = 1000,
): I | null {
  for (let round = 0; round < rounds; round++) {
    const size = 1 + Math.floor(round / 100);     // сначала маленькие входы — контрпример будет коротким
    const input = generate(size);
    if (JSON.stringify(fast(input)) !== JSON.stringify(slow(input))) return input;
  }
  return null;                                    // расхождений не нашлось
}

// быстрое решение с ошибкой: ответ инициализирован нулём
function maxSubArrayBuggy(nums: number[]): number {
  let best = 0;
  let current = 0;
  for (const x of nums) {
    current = Math.max(x, current + x);
    best = Math.max(best, current);
  }
  return best;
}

// перебор: медленно, но очевидно правильно
function maxSubArrayBrute(nums: number[]): number {
  let best = -Infinity;
  for (let i = 0; i < nums.length; i++) {
    let sum = 0;
    for (let j = i; j < nums.length; j++) best = Math.max(best, (sum += nums[j]));
  }
  return best;
}

// --- от перебора к O(n): число пар с суммой k ---
function countPairsBrute(nums: number[], k: number): number {
  let count = 0;
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) if (nums[i] + nums[j] === k) count++;
  }
  return count;
}

function countPairs(nums: number[], k: number): number {
  const seen = new Map<number, number>();         // сколько раз встречалось число слева
  let count = 0;
  for (const x of nums) {
    count += seen.get(k - x) ?? 0;                // все пары, где x — правый элемент
    seen.set(x, (seen.get(x) ?? 0) + 1);
  }
  return count;
}

// --- минимум большого массива без spread ---
function minOf(nums: number[]): number {
  let min = Infinity;
  for (const x of nums) if (x < min) min = x;
  return min;
}

// ===== проверки =====
// стресс-тест находит ошибку на самом коротком входе — одном отрицательном числе
const counterexample = stressTest(maxSubArrayBuggy, maxSubArrayBrute, (size) => randArray(size, -10, 10));
assert.ok(counterexample !== null);
assert.equal(counterexample!.length, 1);
assert.ok(counterexample![0] < 0);
assert.equal(maxSubArrayBuggy([-3]), 0);                                                            // а должно быть −3
assert.equal(maxSubArrayBrute([-3]), -3);

// исправленное решение проходит тот же тест
const maxSubArray = (nums: number[]) => {
  let best = nums[0];
  let current = nums[0];
  for (let i = 1; i < nums.length; i++) {
    current = Math.max(nums[i], current + nums[i]);
    best = Math.max(best, current);
  }
  return best;
};
assert.equal(stressTest(maxSubArray, maxSubArrayBrute, (size) => randArray(size, -10, 10)), null);

// пары с суммой k: быстрое совпадает с перебором
assert.equal(countPairs([1, 5, 7, -1, 5], 6), 3);
assert.equal(countPairs([1, 1, 1, 1], 2), 6);
assert.equal(stressTest(({ xs, k }: { xs: number[]; k: number }) => countPairs(xs, k), ({ xs, k }) => countPairsBrute(xs, k), (size) => ({ xs: randArray(size * 3, -5, 5), k: randInt(-6, 6) })), null);
// и на большом входе укладывается в доли секунды, где перебор — 5 · 10⁹ сложений
{
  const big = randArray(100_000, -1000, 1000);
  const t = performance.now();
  countPairs(big, 7);
  assert.ok(performance.now() - t < 200);
}

// ловушки JavaScript
assert.deepEqual([10, 9, 1].sort(), [1, 10, 9]);                                                    // строковое сравнение
assert.deepEqual([10, 9, 1].sort((a, b) => a - b), [1, 9, 10]);
const million = randArray(1_000_000, -1e9, 1e9);
assert.throws(() => Math.min(...million), RangeError);                                              // слишком много аргументов
assert.equal(minOf(million), million.reduce((a, b) => (a < b ? a : b)));
assert.equal(2 ** 53 + 1, 2 ** 53);                                                                 // точность кончилась
assert.equal(String(10n ** 20n), '100000000000000000000');                                         // BigInt — точно

console.log('approaches ok');
