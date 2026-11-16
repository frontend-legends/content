// Проверки к 2.4: задачи на массивы и строки из LeetCode Top Interview 150 — запись на месте, жадные
// проходы, префиксы и суффиксы, римские числа, поиск подстроки и выравнивание текста; примеры из
// условий и случайные тесты против простых решений.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/4.strings-arrays
import { assert, fuzz, randArray, randInt, randString, random } from '../_shared.ts';

// --- шаблон: запись на месте указателем ---
function keepIf(nums: number[], keep: (x: number, written: number) => boolean): number {
  let k = 0;                                      // сколько элементов уже записано
  for (const x of nums) {
    if (keep(x, k)) nums[k++] = x;                // переписать на место k
  }
  return k;                                       // nums[0..k) — результат
}

// --- шаблон: два прохода — слева направо и справа налево ---
function maxToLeftAndRight(nums: number[]): [number[], number[]] {
  const n = nums.length;
  const left = new Array(n);                      // left[i] — максимум nums[0..i]
  const right = new Array(n);                     // right[i] — максимум nums[i..n)
  for (let i = 0; i < n; i++) left[i] = Math.max(nums[i], i > 0 ? left[i - 1] : -Infinity);
  for (let i = n - 1; i >= 0; i--) right[i] = Math.max(nums[i], i < n - 1 ? right[i + 1] : -Infinity);
  return [left, right];
}

// --- 88. Merge Sorted Array ---
function merge(nums1: number[], m: number, nums2: number[], n: number): void {
  let i = m - 1;
  let j = n - 1;
  for (let k = m + n - 1; j >= 0; k--) {         // заполнять с конца — там свободное место
    nums1[k] = i >= 0 && nums1[i] > nums2[j] ? nums1[i--] : nums2[j--];
  }
}

// --- 27. Remove Element ---
function removeElement(nums: number[], val: number): number {
  return keepIf(nums, (x) => x !== val);
}

// --- 26. Remove Duplicates from Sorted Array ---
function removeDuplicates(nums: number[]): number {
  return keepIf(nums, (x, k) => k < 1 || x !== nums[k - 1]);
}

// --- 80. Remove Duplicates from Sorted Array II ---
function removeDuplicatesII(nums: number[]): number {
  return keepIf(nums, (x, k) => k < 2 || x !== nums[k - 2]);   // третий подряд совпадёт с записанным два шага назад
}

// --- 169. Majority Element ---
function majorityElement(nums: number[]): number {
  let candidate = nums[0];
  let count = 0;
  for (const x of nums) {
    if (count === 0) candidate = x;               // пары «кандидат — другой» взаимно вычеркнулись
    count += x === candidate ? 1 : -1;
  }
  return candidate;
}

// --- 189. Rotate Array ---
function rotate(nums: number[], k: number): void {
  const n = nums.length;
  k %= n;
  const reverse = (lo: number, hi: number) => {
    for (; lo < hi; lo++, hi--) [nums[lo], nums[hi]] = [nums[hi], nums[lo]];
  };
  reverse(0, n - 1);                              // 1 2 3 4 5 → 5 4 3 2 1
  reverse(0, k - 1);                              // k = 2: 4 5 | 3 2 1
  reverse(k, n - 1);                              //        4 5 | 1 2 3
}

// --- 121. Best Time to Buy and Sell Stock ---
function maxProfitOnce(prices: number[]): number {
  let minPrice = Infinity;
  let best = 0;
  for (const p of prices) {
    minPrice = Math.min(minPrice, p);             // лучшая покупка до сегодняшнего дня
    best = Math.max(best, p - minPrice);          // продать сегодня
  }
  return best;
}

// --- 122. Best Time to Buy and Sell Stock II ---
function maxProfitMany(prices: number[]): number {
  let profit = 0;
  for (let i = 1; i < prices.length; i++) profit += Math.max(0, prices[i] - prices[i - 1]);   // каждый подъём
  return profit;
}

// --- 55. Jump Game ---
function canJump(nums: number[]): boolean {
  let farthest = 0;
  for (let i = 0; i < nums.length; i++) {
    if (i > farthest) return false;               // до i не допрыгнуть
    farthest = Math.max(farthest, i + nums[i]);
  }
  return true;
}

// --- 45. Jump Game II ---
function jump(nums: number[]): number {
  let jumps = 0;
  let end = 0;                                    // граница достижимого за jumps прыжков
  let farthest = 0;                               // граница за jumps + 1
  for (let i = 0; i < nums.length - 1; i++) {
    farthest = Math.max(farthest, i + nums[i]);
    if (i === end) {                              // уровень пройден — нужен ещё прыжок
      jumps++;
      end = farthest;
    }
  }
  return jumps;
}

// --- 274. H-Index ---
function hIndex(citations: number[]): number {
  const n = citations.length;
  const count = new Array(n + 1).fill(0);         // count[c] — статей с c цитированиями (больше n — в n)
  for (const c of citations) count[Math.min(c, n)]++;
  let atLeast = 0;
  for (let h = n; h >= 0; h--) {
    atLeast += count[h];                          // статей с не меньше чем h цитированиями
    if (atLeast >= h) return h;
  }
  return 0;
}

// --- 380. Insert Delete GetRandom O(1) ---
class RandomizedSet {
  private values: number[] = [];
  private index = new Map<number, number>();      // значение → позиция в values

  insert(val: number): boolean {
    if (this.index.has(val)) return false;
    this.index.set(val, this.values.length);
    this.values.push(val);
    return true;
  }

  remove(val: number): boolean {
    const i = this.index.get(val);
    if (i === undefined) return false;
    const last = this.values.pop()!;
    if (last !== val) {                           // поставить последний на место удалённого
      this.values[i] = last;
      this.index.set(last, i);
    }
    this.index.delete(val);
    return true;
  }

  getRandom(): number {
    return this.values[Math.floor(Math.random() * this.values.length)];
  }
}

// --- 238. Product of Array Except Self ---
function productExceptSelf(nums: number[]): number[] {
  const n = nums.length;
  const result = new Array(n).fill(1);
  let prefix = 1;
  for (let i = 0; i < n; i++) {
    result[i] = prefix;                           // произведение всего слева
    prefix *= nums[i];
  }
  let suffix = 1;
  for (let i = n - 1; i >= 0; i--) {
    result[i] *= suffix;                          // умножить на всё справа
    suffix *= nums[i];
  }
  return result;
}

// --- 134. Gas Station ---
function canCompleteCircuit(gas: number[], cost: number[]): number {
  let total = 0;
  let tank = 0;
  let start = 0;
  for (let i = 0; i < gas.length; i++) {
    const diff = gas[i] - cost[i];
    total += diff;
    tank += diff;
    if (tank < 0) {                               // от start до i не доехать — и ни от какой станции между
      start = i + 1;
      tank = 0;
    }
  }
  return total >= 0 ? start : -1;
}

// --- 135. Candy ---
function candy(ratings: number[]): number {
  const n = ratings.length;
  const candies = new Array(n).fill(1);
  for (let i = 1; i < n; i++) {
    if (ratings[i] > ratings[i - 1]) candies[i] = candies[i - 1] + 1;   // правило с левым соседом
  }
  for (let i = n - 2; i >= 0; i--) {
    if (ratings[i] > ratings[i + 1]) candies[i] = Math.max(candies[i], candies[i + 1] + 1);   // с правым
  }
  return candies.reduce((a, b) => a + b, 0);
}

// --- 42. Trapping Rain Water ---
function trap(height: number[]): number {
  let lo = 0;
  let hi = height.length - 1;
  let leftMax = 0;
  let rightMax = 0;
  let water = 0;
  while (lo < hi) {
    if (height[lo] < height[hi]) {                // справа есть стена выше — уровень задаёт leftMax
      leftMax = Math.max(leftMax, height[lo]);
      water += leftMax - height[lo++];
    } else {
      rightMax = Math.max(rightMax, height[hi]);
      water += rightMax - height[hi--];
    }
  }
  return water;
}

// --- 13. Roman to Integer ---
function romanToInt(s: string): number {
  const value: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = value[s[i]];
    total += i + 1 < s.length && v < value[s[i + 1]] ? -v : v;   // меньший перед большим вычитается
  }
  return total;
}

// --- 12. Integer to Roman ---
function intToRoman(num: number): string {
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let result = '';
  for (const [value, symbol] of table) {
    for (; num >= value; num -= value) result += symbol;   // жадно: самое крупное, что помещается
  }
  return result;
}

// --- 58. Length of Last Word ---
function lengthOfLastWord(s: string): number {
  let i = s.length - 1;
  while (i >= 0 && s[i] === ' ') i--;             // пропустить пробелы в конце
  let length = 0;
  for (; i >= 0 && s[i] !== ' '; i--) length++;
  return length;
}

// --- 14. Longest Common Prefix ---
function longestCommonPrefix(strs: string[]): string {
  for (let i = 0; i < strs[0].length; i++) {
    const ch = strs[0][i];
    if (strs.some((s) => s[i] !== ch)) return strs[0].slice(0, i);   // столбец i разошёлся
  }
  return strs[0];
}

// --- 151. Reverse Words in a String ---
function reverseWords(s: string): string {
  return s.trim().split(/\s+/).reverse().join(' ');
}

// --- 6. Zigzag Conversion ---
function convert(s: string, numRows: number): string {
  if (numRows === 1) return s;
  const rows: string[] = new Array(Math.min(numRows, s.length)).fill('');
  let row = 0;
  let step = 1;
  for (const ch of s) {
    rows[row] += ch;
    if (row === 0) step = 1;                      // отразиться от верхнего ряда
    else if (row === numRows - 1) step = -1;      // и от нижнего
    row += step;
  }
  return rows.join('');
}

// --- 28. Find the Index of the First Occurrence in a String ---
function strStr(haystack: string, needle: string): number {
  // lps[i] — длина наибольшего собственного префикса needle[0..i], который одновременно суффикс
  const lps = new Array(needle.length).fill(0);
  for (let i = 1, len = 0; i < needle.length; ) {
    if (needle[i] === needle[len]) lps[i++] = ++len;
    else if (len > 0) len = lps[len - 1];
    else lps[i++] = 0;
  }
  for (let i = 0, j = 0; i < haystack.length; ) {
    if (haystack[i] === needle[j]) {
      i++;
      j++;
      if (j === needle.length) return i - j;
    } else if (j > 0) {
      j = lps[j - 1];                             // не откатывать i: совпавший префикс уже известен
    } else {
      i++;
    }
  }
  return needle.length === 0 ? 0 : -1;
}

// --- 68. Text Justification ---
function fullJustify(words: string[], maxWidth: number): string[] {
  const lines: string[] = [];
  let i = 0;
  while (i < words.length) {
    let j = i;
    let width = 0;                                // длина слов без пробелов
    while (j < words.length && width + words[j].length + (j - i) <= maxWidth) width += words[j++].length;
    const gaps = j - i - 1;
    if (j === words.length || gaps === 0) {       // последняя строка или одно слово — влево
      const line = words.slice(i, j).join(' ');
      lines.push(line + ' '.repeat(maxWidth - line.length));
    } else {
      const spaces = maxWidth - width;
      const base = Math.floor(spaces / gaps);
      const extra = spaces % gaps;                // лишние пробелы — в левые промежутки
      let line = words[i];
      for (let g = 1; g <= gaps; g++) line += ' '.repeat(base + (g <= extra ? 1 : 0)) + words[i + g];
      lines.push(line);
    }
    i = j;
  }
  return lines;
}

// ===== проверки =====
const asc = (xs: number[]) => [...xs].sort((a, b) => a - b);

// шаблоны
const kept = [3, 2, 2, 3];
assert.equal(keepIf(kept, (x) => x !== 3), 2);
assert.deepEqual(kept.slice(0, 2), [2, 2]);
assert.deepEqual(maxToLeftAndRight([2, 0, 3, 1]), [[2, 2, 3, 3], [3, 3, 3, 1]]);

// 88
const n1 = [1, 2, 3, 0, 0, 0];
merge(n1, 3, [2, 5, 6], 3);
assert.deepEqual(n1, [1, 2, 2, 3, 5, 6]);
const n2 = [0];
merge(n2, 0, [1], 1);
assert.deepEqual(n2, [1]);
fuzz(1000, () => [asc(randArray(randInt(0, 6), -5, 5)), asc(randArray(randInt(0, 6), -5, 5))], ([a, b]) => {
  const target = [...a, ...new Array(b.length).fill(0)];
  merge(target, a.length, b, b.length);
  assert.deepEqual(target, asc([...a, ...b]));
});

// 27, 26, 80
fuzz(1000, () => ({ xs: randArray(randInt(0, 12), 0, 4), v: randInt(0, 4) }), ({ xs, v }) => {
  const a = [...xs];
  const k = removeElement(a, v);
  assert.deepEqual(a.slice(0, k), xs.filter((x) => x !== v));
  const s = asc(xs);
  const b = [...s];
  assert.deepEqual(b.slice(0, removeDuplicates(b)), [...new Set(s)]);
  const c = [...s];
  assert.deepEqual(c.slice(0, removeDuplicatesII(c)), s.filter((x, i) => i < 2 || x !== s[i - 2]));
  assert.ok(c.slice(0, removeDuplicatesII([...s])).every((x, i, arr) => arr.filter((y) => y === x).length <= 2));
});
const r2 = [0, 0, 1, 1, 1, 1, 2, 3, 3];
assert.equal(removeDuplicatesII(r2), 7);
assert.deepEqual(r2.slice(0, 7), [0, 0, 1, 1, 2, 3, 3]);

// 169
assert.equal(majorityElement([3, 2, 3]), 3);
assert.equal(majorityElement([2, 2, 1, 1, 1, 2, 2]), 2);
fuzz(1000, () => { const n = randInt(1, 15); const major = randInt(0, 5); const k = Math.floor(n / 2) + 1; const xs = [...new Array(k).fill(major), ...randArray(n - k, 0, 5)]; return xs.map((x) => [random(), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x); }, (xs) => {
  const m = majorityElement(xs);
  assert.ok(xs.filter((x) => x === m).length > xs.length / 2);
});

// 189
const rot = [1, 2, 3, 4, 5, 6, 7];
rotate(rot, 3);
assert.deepEqual(rot, [5, 6, 7, 1, 2, 3, 4]);
fuzz(1000, () => ({ xs: randArray(randInt(1, 10), 0, 9), k: randInt(0, 25) }), ({ xs, k }) => {
  const a = [...xs];
  rotate(a, k);
  assert.deepEqual(a, xs.map((_, i) => xs[(i - (k % xs.length) + xs.length) % xs.length]));
});

// 121, 122
assert.equal(maxProfitOnce([7, 1, 5, 3, 6, 4]), 5);
assert.equal(maxProfitOnce([7, 6, 4, 3, 1]), 0);
assert.equal(maxProfitMany([7, 1, 5, 3, 6, 4]), 7);
assert.equal(maxProfitMany([1, 2, 3, 4, 5]), 4);
fuzz(1000, () => randArray(randInt(0, 10), 0, 9), (p) => {
  let once = 0;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) once = Math.max(once, p[j] - p[i]);
  assert.equal(maxProfitOnce(p), once);
  const many = (d: number, holding: boolean): number => (d === p.length ? 0 : Math.max(many(d + 1, holding), holding ? p[d] + many(d + 1, false) : -p[d] + many(d + 1, true)));
  assert.equal(maxProfitMany(p), many(0, false));
});

// 55, 45
assert.equal(canJump([2, 3, 1, 1, 4]), true);
assert.equal(canJump([3, 2, 1, 0, 4]), false);
assert.equal(jump([2, 3, 1, 1, 4]), 2);
assert.equal(jump([2, 3, 0, 1, 4]), 2);
assert.equal(jump([0]), 0);
fuzz(1000, () => randArray(randInt(1, 12), 0, 3), (xs) => {
  const dist = new Array(xs.length).fill(Infinity); dist[0] = 0;                                    // эталон: DP по прыжкам
  for (let i = 0; i < xs.length; i++) for (let s = 1; s <= xs[i] && i + s < xs.length; s++) dist[i + s] = Math.min(dist[i + s], dist[i] + 1);
  assert.equal(canJump(xs), dist.at(-1) < Infinity);
  if (dist.at(-1) < Infinity) assert.equal(jump(xs), dist.at(-1));
});

// 274
assert.equal(hIndex([3, 0, 6, 1, 5]), 3);
assert.equal(hIndex([1, 3, 1]), 1);
assert.equal(hIndex([0]), 0);
assert.equal(hIndex([100]), 1);
fuzz(1000, () => randArray(randInt(1, 12), 0, 15), (c) => {
  let h = 0;
  for (let t = 0; t <= c.length; t++) if (c.filter((x) => x >= t).length >= t) h = t;
  assert.equal(hIndex(c), h);
});

// 380
const rs = new RandomizedSet();
assert.equal(rs.insert(1), true);
assert.equal(rs.remove(2), false);
assert.equal(rs.insert(2), true);
assert.ok([1, 2].includes(rs.getRandom()));
assert.equal(rs.remove(1), true);
assert.equal(rs.insert(2), false);
assert.equal(rs.getRandom(), 2);
fuzz(300, () => Array.from({ length: 40 }, () => [randInt(0, 2), randInt(0, 6)] as const), (ops) => {
  const set = new RandomizedSet(); const ref = new Set<number>();
  for (const [op, v] of ops) {
    if (op === 0) assert.equal(set.insert(v), !ref.has(v)), ref.add(v);
    else if (op === 1) assert.equal(set.remove(v), ref.delete(v));
    else if (ref.size) assert.ok(ref.has(set.getRandom()));
  }
});
const uniform = new RandomizedSet();
[10, 20, 30].forEach((v) => uniform.insert(v));
const hits = new Map<number, number>();
for (let t = 0; t < 30_000; t++) { const v = uniform.getRandom(); hits.set(v, (hits.get(v) ?? 0) + 1); }
for (const v of [10, 20, 30]) assert.ok(Math.abs(hits.get(v)! - 10_000) < 600);                    // равновероятно

// 238
assert.deepEqual(productExceptSelf([1, 2, 3, 4]), [24, 12, 8, 6]);
assert.deepEqual(productExceptSelf([-1, 1, 0, -3, 3]).map((x) => x + 0), [0, 0, 9, 0, 0]);
assert.ok(Object.is(productExceptSelf([-1, 1, 0, -3, 3])[0], -0));                                  // -0, а не 0
fuzz(1000, () => randArray(randInt(2, 8), -3, 3), (xs) => {
  assert.deepEqual(productExceptSelf(xs).map((x) => x + 0), xs.map((_, i) => xs.reduce((p, x, j) => (j === i ? p : p * x), 1) + 0));
});

// 134
assert.equal(canCompleteCircuit([1, 2, 3, 4, 5], [3, 4, 5, 1, 2]), 3);
assert.equal(canCompleteCircuit([2, 3, 4], [3, 4, 3]), -1);
fuzz(1000, () => { const n = randInt(1, 8); return [randArray(n, 0, 5), randArray(n, 0, 5)]; }, ([gas, cost]) => {
  const n = gas.length;
  const ok = (s: number) => { let tank = 0; for (let t = 0; t < n; t++) { const i = (s + t) % n; tank += gas[i] - cost[i]; if (tank < 0) return false; } return true; };
  const answer = canCompleteCircuit(gas, cost);
  if (answer === -1) assert.ok(!Array.from({ length: n }, (_, s) => s).some(ok));
  else assert.ok(ok(answer));
});

// 135
assert.equal(candy([1, 0, 2]), 5);
assert.equal(candy([1, 2, 2]), 4);
fuzz(1000, () => randArray(randInt(1, 12), 0, 4), (r) => {
  const c = r.map(() => 1);                                                                         // эталон: поднимать, пока правила нарушены
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      if (i > 0 && r[i] > r[i - 1] && c[i] <= c[i - 1]) { c[i] = c[i - 1] + 1; changed = true; }
      if (i < r.length - 1 && r[i] > r[i + 1] && c[i] <= c[i + 1]) { c[i] = c[i + 1] + 1; changed = true; }
    }
  }
  assert.equal(candy(r), c.reduce((a, b) => a + b, 0));
});

// 42
assert.equal(trap([0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]), 6);
assert.equal(trap([4, 2, 0, 3, 2, 5]), 9);
fuzz(1000, () => randArray(randInt(0, 15), 0, 6), (h) => {
  const [left, right] = maxToLeftAndRight(h);
  assert.equal(trap(h), h.reduce((w, x, i) => w + Math.min(left[i], right[i]) - x, 0));
});

// 13, 12
assert.equal(romanToInt('III'), 3);
assert.equal(romanToInt('LVIII'), 58);
assert.equal(romanToInt('MCMXCIV'), 1994);
assert.equal(intToRoman(3749), 'MMMDCCXLIX');
assert.equal(intToRoman(58), 'LVIII');
assert.equal(intToRoman(1994), 'MCMXCIV');
const seenRoman = new Set<string>();
for (let n = 1; n <= 3999; n++) {
  const r = intToRoman(n);
  assert.equal(romanToInt(r), n);
  assert.ok(!seenRoman.has(r));
  seenRoman.add(r);
  assert.ok(!/IIII|XXXX|CCCC|VV|LL|DD/.test(r));                                                     // каноническая запись
}

// 58, 14, 151
assert.equal(lengthOfLastWord('Hello World'), 5);
assert.equal(lengthOfLastWord('   fly me   to   the moon  '), 4);
assert.equal(longestCommonPrefix(['flower', 'flow', 'flight']), 'fl');
assert.equal(longestCommonPrefix(['dog', 'racecar', 'car']), '');
assert.equal(longestCommonPrefix(['a']), 'a');
assert.equal(reverseWords('the sky is blue'), 'blue is sky the');
assert.equal(reverseWords('  hello world  '), 'world hello');
assert.equal(reverseWords('a good   example'), 'example good a');
fuzz(1000, () => randString(randInt(1, 15), 'ab  '), (s) => {
  if (!s.trim()) return;
  assert.equal(lengthOfLastWord(s), s.trim().split(' ').at(-1)!.length);
  assert.equal(reverseWords(s), s.split(' ').filter(Boolean).reverse().join(' '));
});
fuzz(1000, () => Array.from({ length: randInt(1, 5) }, () => randString(randInt(0, 5), 'ab')), (strs) => {
  let p = '';
  for (let len = 0; len <= Math.min(...strs.map((s) => s.length)); len++) if (strs.every((s) => s.startsWith(strs[0].slice(0, len)))) p = strs[0].slice(0, len);
  assert.equal(longestCommonPrefix(strs), p);
});

// 6
assert.equal(convert('PAYPALISHIRING', 3), 'PAHNAPLSIIGYIR');
assert.equal(convert('PAYPALISHIRING', 4), 'PINALSIGYAHRPI');
assert.equal(convert('A', 1), 'A');
assert.equal(convert('AB', 5), 'AB');
fuzz(500, () => ({ s: randString(randInt(1, 20), 'abcdef'), rows: randInt(1, 6) }), ({ s, rows }) => {
  // эталон: формула позиции — период 2 · (rows − 1)
  if (rows === 1) return assert.equal(convert(s, rows), s);
  const period = 2 * (rows - 1);
  const rowOf = (i: number) => Math.min(i % period, period - (i % period));
  const expected = Array.from({ length: rows }, (_, r) => [...s].filter((_, i) => rowOf(i) === r).join('')).join('');
  assert.equal(convert(s, rows), expected);
});

// 28
assert.equal(strStr('sadbutsad', 'sad'), 0);
assert.equal(strStr('leetcode', 'leeto'), -1);
assert.equal(strStr('aabaaabaaac', 'aabaaac'), 4);
// таблица lps из текста: для образца aabaaac
const lpsOf = (needle: string) => { const lps = new Array(needle.length).fill(0); for (let i = 1, len = 0; i < needle.length; ) { if (needle[i] === needle[len]) lps[i++] = ++len; else if (len > 0) len = lps[len - 1]; else lps[i++] = 0; } return lps; };
assert.deepEqual(lpsOf('aabaaac'), [0, 1, 0, 1, 2, 2, 0]);
fuzz(2000, () => [randString(randInt(0, 20), 'ab'), randString(randInt(1, 5), 'ab')], ([h, n]) => assert.equal(strStr(h, n), h.indexOf(n)));

// 68
assert.deepEqual(fullJustify(['This', 'is', 'an', 'example', 'of', 'text', 'justification.'], 16), ['This    is    an', 'example  of text', 'justification.  ']);
assert.deepEqual(fullJustify(['What', 'must', 'be', 'acknowledgment', 'shall', 'be'], 16), ['What   must   be', 'acknowledgment  ', 'shall be        ']);
assert.deepEqual(
  fullJustify(['Science', 'is', 'what', 'we', 'understand', 'well', 'enough', 'to', 'explain', 'to', 'a', 'computer.', 'Art', 'is', 'everything', 'else', 'we', 'do'], 20),
  ['Science  is  what we', 'understand      well', 'enough to explain to', 'a  computer.  Art is', 'everything  else  we', 'do                  '],
);
fuzz(500, () => { const width = randInt(5, 15); return { width, words: Array.from({ length: randInt(1, 10) }, () => randString(randInt(1, width), 'abc')) }; }, ({ width, words }) => {
  const lines = fullJustify(words, width);
  assert.deepEqual(lines.join(' ').split(' ').filter(Boolean), words);                               // слова и порядок сохранены
  lines.forEach((line, li) => {
    assert.equal(line.length, width);
    const gaps = line.trimEnd().split(/[^ ]+/).slice(1, -1).map((g) => g.length);
    if (li === lines.length - 1 || gaps.length === 0) assert.ok(gaps.every((g) => g === 1));       // влево
    else {
      assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 1);                                        // поровну
      assert.ok(gaps.every((g, i) => i === 0 || g <= gaps[i - 1]));                                 // лишние — слева
      assert.equal(line.trimEnd().length, width);
    }
  });
});

console.log('strings and arrays ok');
