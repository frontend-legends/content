// Проверки к 2.25: одномерное динамическое программирование — лестница, грабитель, разбиение строки
// на слова, размен монет и наибольшая возрастающая подпоследовательность; примеры из условий и
// случайные тесты против перебора.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/25.1d-dp
import { assert, fuzz, randArray, randInt, randString } from '../_shared.ts';

// --- шаблон: сверху вниз с мемоизацией и снизу вверх ---
let naiveCalls = 0;
function fibNaive(n: number): number {
  naiveCalls++;
  return n < 2 ? n : fibNaive(n - 1) + fibNaive(n - 2);
}

function fibMemo(n: number, memo = new Map<number, number>()): number {
  if (n < 2) return n;
  if (!memo.has(n)) memo.set(n, fibMemo(n - 1, memo) + fibMemo(n - 2, memo));   // каждое n — один раз
  return memo.get(n)!;
}

function fibTable(n: number): number {
  if (n < 2) return n;
  let prev = 0;
  let cur = 1;
  for (let i = 2; i <= n; i++) [prev, cur] = [cur, prev + cur];   // нужны только два последних
  return cur;
}

// --- 70. Climbing Stairs ---
function climbStairs(n: number): number {
  let oneBack = 1;                                // способов дойти до ступени i - 1
  let twoBack = 1;                                // до ступени i - 2 (для i = 1 — «с земли»)
  for (let i = 2; i <= n; i++) [twoBack, oneBack] = [oneBack, oneBack + twoBack];
  return oneBack;
}

// --- 198. House Robber ---
function rob(nums: number[]): number {
  let skip = 0;                                   // лучшее, если предыдущий дом не взят
  let take = 0;                                   // лучшее до предыдущего дома включительно
  for (const x of nums) [skip, take] = [Math.max(skip, take), skip + x];
  return Math.max(skip, take);
}

// --- 139. Word Break ---
function wordBreak(s: string, wordDict: string[]): boolean {
  const words = new Set(wordDict);
  const lengths = [...new Set(wordDict.map((w) => w.length))];
  const ok = new Array(s.length + 1).fill(false);  // ok[i] — префикс длины i разбивается
  ok[0] = true;
  for (let i = 1; i <= s.length; i++) {
    for (const len of lengths) {
      if (len <= i && ok[i - len] && words.has(s.slice(i - len, i))) {
        ok[i] = true;
        break;
      }
    }
  }
  return ok[s.length];
}

// --- 322. Coin Change ---
function coinChange(coins: number[], amount: number): number {
  const dp = new Array(amount + 1).fill(Infinity); // dp[a] — минимум монет для суммы a
  dp[0] = 0;
  for (let a = 1; a <= amount; a++) {
    for (const c of coins) if (c <= a) dp[a] = Math.min(dp[a], dp[a - c] + 1);
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}

// --- 300. Longest Increasing Subsequence ---
function lengthOfLISQuadratic(nums: number[]): number {
  const dp = nums.map(() => 1);                   // dp[i] — длина НВП, кончающейся в i
  for (let i = 1; i < nums.length; i++) {
    for (let j = 0; j < i; j++) if (nums[j] < nums[i]) dp[i] = Math.max(dp[i], dp[j] + 1);
  }
  return Math.max(0, ...dp);
}

function lengthOfLIS(nums: number[]): number {
  const tails: number[] = [];                     // tails[k] — наименьший хвост НВП длины k + 1
  for (const x of nums) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {                             // первая позиция, где tails[mid] >= x
      const mid = (lo + hi) >>> 1;
      if (tails[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = x;                                // продлить или улучшить хвост
  }
  return tails.length;
}

// ===== проверки =====
// шаблон: одинаковые ответы, а наивная рекурсия делает экспоненциально много вызовов
for (let n = 0; n <= 25; n++) assert.equal(fibMemo(n), fibTable(n));
naiveCalls = 0;
assert.equal(fibNaive(25), 75025);
assert.equal(naiveCalls, 242785);                                                                   // 2 · F(26) − 1
assert.equal(fibTable(78), 8944394323791464);                                                        // последнее точное в number
assert.ok(fibTable(79) > Number.MAX_SAFE_INTEGER);

// 70
assert.equal(climbStairs(2), 2);
assert.equal(climbStairs(3), 3);
assert.equal(climbStairs(1), 1);
for (let n = 1; n <= 40; n++) assert.equal(climbStairs(n), fibTable(n + 1));

// 198
assert.equal(rob([1, 2, 3, 1]), 4);
assert.equal(rob([2, 7, 9, 3, 1]), 12);
assert.equal(rob([2, 1, 1, 2]), 4);
fuzz(1000, () => randArray(randInt(0, 12), 0, 50), (xs) => {
  let best = 0;
  for (let mask = 0; mask < 1 << xs.length; mask++) if (!(mask & (mask >> 1))) best = Math.max(best, xs.reduce((s, x, i) => (mask >> i) & 1 ? s + x : s, 0));
  assert.equal(rob(xs), best);
});

// 139
assert.equal(wordBreak('leetcode', ['leet', 'code']), true);
assert.equal(wordBreak('applepenapple', ['apple', 'pen']), true);
assert.equal(wordBreak('catsandog', ['cats', 'dog', 'sand', 'and', 'cat']), false);
fuzz(1000, () => ({ s: randString(randInt(1, 10), 'ab'), dict: Array.from({ length: randInt(1, 4) }, () => randString(randInt(1, 3), 'ab')) }), ({ s, dict }) => {
  const can = (t: string): boolean => t === '' || dict.some((w) => t.startsWith(w) && can(t.slice(w.length)));
  assert.equal(wordBreak(s, dict), can(s));
});
// без мемоизации перебор экспоненциален: «aaaa…ab» со словами a, aa, aaa…
const hard = 'a'.repeat(200) + 'b';
assert.equal(wordBreak(hard, Array.from({ length: 10 }, (_, i) => 'a'.repeat(i + 1))), false);

// 322
assert.equal(coinChange([1, 2, 5], 11), 3);
assert.equal(coinChange([2], 3), -1);
assert.equal(coinChange([1], 0), 0);
assert.equal(coinChange([1, 3, 4], 6), 2);                                                          // жадный дал бы 4 + 1 + 1
fuzz(500, () => ({ coins: [...new Set(randArray(randInt(1, 3), 1, 9))], amount: randInt(0, 30) }), ({ coins, amount }) => {
  // эталон: обход в ширину по суммам
  const dist = new Map([[0, 0]]); const q = [0];
  for (let h = 0; h < q.length; h++) for (const c of coins) { const nx = q[h] + c; if (nx <= amount && !dist.has(nx)) { dist.set(nx, dist.get(q[h])! + 1); q.push(nx); } }
  assert.equal(coinChange(coins, amount), dist.get(amount) ?? -1);
});

// 300
assert.equal(lengthOfLIS([10, 9, 2, 5, 3, 7, 101, 18]), 4);
assert.equal(lengthOfLIS([0, 1, 0, 3, 2, 3]), 4);
assert.equal(lengthOfLIS([7, 7, 7, 7]), 1);
fuzz(1000, () => randArray(randInt(0, 12), 0, 9), (xs) => {
  let best = 0;
  for (let mask = 0; mask < 1 << xs.length; mask++) {
    const sub = xs.filter((_, i) => (mask >> i) & 1);
    if (sub.every((x, i) => i === 0 || sub[i - 1] < x)) best = Math.max(best, sub.length);
  }
  assert.equal(lengthOfLIS(xs), best);
  assert.equal(lengthOfLISQuadratic(xs), best);
});

console.log('1d dp ok');
