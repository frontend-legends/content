// Проверки к 2.06: окно фиксированной и переменной длины, задачи на скользящее окно — примеры из условий
// и случайные тесты против перебора.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/6.sliding-window
import { assert, fuzz, randArray, randInt, randString } from '../_shared.ts';

// --- шаблоны ---
function maxSumOfK(a: number[], k: number): number {
  let sum = 0;
  for (let i = 0; i < k; i++) sum += a[i];
  let best = sum;
  for (let right = k; right < a.length; right++) {
    sum += a[right] - a[right - k];           // вошёл правый, вышел левый
    best = Math.max(best, sum);
  }
  return best;
}

function longestWithAtMostKDistinct(s: string, k: number): number {
  const count = new Map<string, number>();
  let left = 0;
  let best = 0;
  for (let right = 0; right < s.length; right++) {
    count.set(s[right], (count.get(s[right]) ?? 0) + 1);   // расширяем
    while (count.size > k) {                                // окно сломалось — сжимаем
      const c = s[left++];
      const n = count.get(c)! - 1;
      if (n === 0) count.delete(c);
      else count.set(c, n);
    }
    best = Math.max(best, right - left + 1);                // окно снова корректно
  }
  return best;
}

// --- 209. Minimum Size Subarray Sum ---
function minSubArrayLen(target: number, nums: number[]): number {
  let left = 0;
  let sum = 0;
  let best = Infinity;
  for (let right = 0; right < nums.length; right++) {
    sum += nums[right];
    while (sum >= target) {
      best = Math.min(best, right - left + 1);
      sum -= nums[left++];
    }
  }
  return best === Infinity ? 0 : best;
}

// --- 3. Longest Substring Without Repeating Characters ---
function lengthOfLongestSubstring(s: string): number {
  const last = new Map<string, number>();
  let left = 0;
  let best = 0;
  for (let right = 0; right < s.length; right++) {
    const seen = last.get(s[right]);
    if (seen !== undefined && seen >= left) left = seen + 1;
    last.set(s[right], right);
    best = Math.max(best, right - left + 1);
  }
  return best;
}

// --- 30. Substring with Concatenation of All Words ---
function findSubstring(s: string, words: string[]): number[] {
  const len = words[0].length;
  const need = new Map<string, number>();
  for (const w of words) need.set(w, (need.get(w) ?? 0) + 1);
  const result: number[] = [];
  for (let offset = 0; offset < len; offset++) {
    const have = new Map<string, number>();
    let left = offset;
    let used = 0;
    for (let right = offset; right + len <= s.length; right += len) {
      const word = s.slice(right, right + len);
      if (!need.has(word)) {                  // чужое слово — окно начинается заново
        have.clear();
        used = 0;
        left = right + len;
        continue;
      }
      have.set(word, (have.get(word) ?? 0) + 1);
      used++;
      while (have.get(word)! > need.get(word)!) {   // слово лишнее — сдвигаем левый край
        const first = s.slice(left, left + len);
        have.set(first, have.get(first)! - 1);
        used--;
        left += len;
      }
      if (used === words.length) result.push(left);
    }
  }
  return result.sort((x, y) => x - y);
}

// --- 76. Minimum Window Substring ---
function minWindow(s: string, t: string): string {
  const need = new Map<string, number>();
  for (const c of t) need.set(c, (need.get(c) ?? 0) + 1);
  let missing = t.length;                     // сколько символов t ещё не покрыто
  let left = 0;
  let bestStart = 0;
  let bestLen = Infinity;
  for (let right = 0; right < s.length; right++) {
    const c = s[right];
    if (need.has(c)) {
      if (need.get(c)! > 0) missing--;
      need.set(c, need.get(c)! - 1);
    }
    while (missing === 0) {
      if (right - left + 1 < bestLen) {
        bestLen = right - left + 1;
        bestStart = left;
      }
      const d = s[left++];
      if (need.has(d)) {
        need.set(d, need.get(d)! + 1);
        if (need.get(d)! > 0) missing++;
      }
    }
  }
  return bestLen === Infinity ? '' : s.slice(bestStart, bestStart + bestLen);
}

// ===== проверки =====
assert.equal(maxSumOfK([2, 1, 5, 1, 3, 2], 3), 9);
assert.equal(longestWithAtMostKDistinct('eceba', 2), 3);
fuzz(1000, () => [randString(randInt(1, 10), 'abc'), randInt(1, 3)] as const, ([s, k]) => {
  let best = 0;
  for (let i = 0; i < s.length; i++) for (let j = i; j < s.length; j++) if (new Set(s.slice(i, j + 1)).size <= k) best = Math.max(best, j - i + 1);
  assert.equal(longestWithAtMostKDistinct(s, k), best);
});
fuzz(1000, () => { const a = randArray(randInt(1, 10), -5, 5); return [a, randInt(1, a.length)] as const; }, ([a, k]) => {
  let best = -Infinity;
  for (let i = 0; i + k <= a.length; i++) best = Math.max(best, a.slice(i, i + k).reduce((x, y) => x + y, 0));
  assert.equal(maxSumOfK(a, k), best);
});

// 209
assert.equal(minSubArrayLen(7, [2, 3, 1, 2, 4, 3]), 2);
assert.equal(minSubArrayLen(4, [1, 4, 4]), 1);
assert.equal(minSubArrayLen(11, [1, 1, 1, 1, 1, 1, 1, 1]), 0);
fuzz(2000, () => [randInt(1, 30), randArray(randInt(1, 10), 1, 9)] as const, ([target, nums]) => {
  let best = 0;
  for (let i = 0; i < nums.length; i++) {
    let sum = 0;
    for (let j = i; j < nums.length; j++) { sum += nums[j]; if (sum >= target) { if (!best || j - i + 1 < best) best = j - i + 1; break; } }
  }
  assert.equal(minSubArrayLen(target, nums), best);
});

// 3
assert.equal(lengthOfLongestSubstring('abcabcbb'), 3);
assert.equal(lengthOfLongestSubstring('bbbbb'), 1);
assert.equal(lengthOfLongestSubstring('pwwkew'), 3);
assert.equal(lengthOfLongestSubstring(''), 0);
assert.equal(lengthOfLongestSubstring('abba'), 2);                                              // старое вхождение левее окна
fuzz(2000, () => randString(randInt(0, 12), 'abcd'), (s) => {
  let best = 0;
  for (let i = 0; i < s.length; i++) for (let j = i; j < s.length; j++) if (new Set(s.slice(i, j + 1)).size === j - i + 1) best = Math.max(best, j - i + 1);
  assert.equal(lengthOfLongestSubstring(s), best);
});

// 30
assert.deepEqual(findSubstring('barfoothefoobarman', ['foo', 'bar']), [0, 9]);
assert.deepEqual(findSubstring('wordgoodgoodgoodbestword', ['word', 'good', 'best', 'word']), []);
assert.deepEqual(findSubstring('barfoofoobarthefoobarman', ['bar', 'foo', 'the']), [6, 9, 12]);
assert.deepEqual(findSubstring('aaaaaa', ['aa', 'aa']), [0, 1, 2]);
fuzz(1500, () => {
  const len = randInt(1, 2);
  const words = Array.from({ length: randInt(1, 3) }, () => randString(len, 'ab'));
  return [randString(randInt(0, 12), 'ab'), words] as const;
}, ([s, words]) => {
  const total = words.length * words[0].length;
  const key = [...words].sort().join('|');
  const brute: number[] = [];
  for (let i = 0; i + total <= s.length; i++) {
    const parts = Array.from({ length: words.length }, (_, k) => s.slice(i + k * words[0].length, i + (k + 1) * words[0].length));
    if (parts.sort().join('|') === key) brute.push(i);
  }
  assert.deepEqual(findSubstring(s, words), brute);
});

// 76
assert.equal(minWindow('ADOBECODEBANC', 'ABC'), 'BANC');
assert.equal(minWindow('a', 'a'), 'a');
assert.equal(minWindow('a', 'aa'), '');
fuzz(2000, () => [randString(randInt(1, 10), 'abc'), randString(randInt(1, 3), 'abc')] as const, ([s, t]) => {
  const covers = (w: string) => { const c = new Map<string, number>(); for (const x of w) c.set(x, (c.get(x) ?? 0) + 1); return [...t].every((x) => { const n = c.get(x) ?? 0; c.set(x, n - 1); return n > 0; }); };
  let best = '';
  for (let i = 0; i < s.length; i++) for (let j = i; j < s.length; j++) { const w = s.slice(i, j + 1); if (covers(w) && (!best || w.length < best.length)) best = w; }
  const got = minWindow(s, t);
  assert.equal(got.length, best.length);
  if (got) assert.ok(covers(got));
});

console.log('sliding window ok');
