// Проверки к 2.08: счётчики, «видели ли раньше», префиксные суммы и задачи на хеш-таблицы — примеры
// из условий и случайные тесты против перебора.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/8.hashmap
import { assert, fuzz, randArray, randInt, randString } from '../_shared.ts';

// --- шаблоны ---
function countBy<T>(items: Iterable<T>): Map<T, number> {
  const count = new Map<T, number>();
  for (const x of items) count.set(x, (count.get(x) ?? 0) + 1);
  return count;
}

function subarraySum(nums: number[], k: number): number {
  const seen = new Map<number, number>([[0, 1]]); // префиксная сумма → сколько раз встречалась
  let prefix = 0;
  let count = 0;
  for (const x of nums) {
    prefix += x;
    count += seen.get(prefix - k) ?? 0;           // отрезки, которые кончаются здесь и дают k
    seen.set(prefix, (seen.get(prefix) ?? 0) + 1);
  }
  return count;
}

// --- 383. Ransom Note ---
function canConstruct(ransomNote: string, magazine: string): boolean {
  const count = new Map<string, number>();
  for (const c of magazine) count.set(c, (count.get(c) ?? 0) + 1);
  for (const c of ransomNote) {
    const left = count.get(c) ?? 0;
    if (left === 0) return false;
    count.set(c, left - 1);
  }
  return true;
}

// --- 205. Isomorphic Strings ---
function isIsomorphic(s: string, t: string): boolean {
  const st = new Map<string, string>();
  const ts = new Map<string, string>();
  for (let i = 0; i < s.length; i++) {
    const a = s[i];
    const b = t[i];
    if ((st.has(a) && st.get(a) !== b) || (ts.has(b) && ts.get(b) !== a)) return false;
    st.set(a, b);
    ts.set(b, a);
  }
  return true;
}

// --- 290. Word Pattern ---
function wordPattern(pattern: string, s: string): boolean {
  const words = s.split(' ');
  if (words.length !== pattern.length) return false;
  const pw = new Map<string, string>();
  const wp = new Map<string, string>();
  for (let i = 0; i < words.length; i++) {
    const p = pattern[i];
    const w = words[i];
    if ((pw.has(p) && pw.get(p) !== w) || (wp.has(w) && wp.get(w) !== p)) return false;
    pw.set(p, w);
    wp.set(w, p);
  }
  return true;
}

// --- 242. Valid Anagram ---
function isAnagram(s: string, t: string): boolean {
  if (s.length !== t.length) return false;
  const count = new Map<string, number>();
  for (const c of s) count.set(c, (count.get(c) ?? 0) + 1);
  for (const c of t) {
    const left = count.get(c) ?? 0;
    if (left === 0) return false;
    count.set(c, left - 1);
  }
  return true;
}

// --- 49. Group Anagrams ---
function groupAnagrams(strs: string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const s of strs) {
    const freq = new Array(26).fill(0);
    for (const c of s) freq[c.charCodeAt(0) - 97]++;
    const key = freq.join(',');                   // одинаковые частоты — одна группа
    const group = groups.get(key);
    if (group) group.push(s);
    else groups.set(key, [s]);
  }
  return [...groups.values()];
}

// --- 1. Two Sum ---
function twoSum(nums: number[], target: number): number[] {
  const seen = new Map<number, number>();         // значение → индекс
  for (let i = 0; i < nums.length; i++) {
    const j = seen.get(target - nums[i]);
    if (j !== undefined) return [j, i];
    seen.set(nums[i], i);
  }
  return [];
}

// --- 202. Happy Number ---
function isHappy(n: number): boolean {
  const next = (x: number) => {
    let sum = 0;
    for (; x > 0; x = Math.floor(x / 10)) sum += (x % 10) ** 2;
    return sum;
  };
  const seen = new Set<number>();
  while (n !== 1 && !seen.has(n)) {
    seen.add(n);
    n = next(n);
  }
  return n === 1;
}

// --- 219. Contains Duplicate II ---
function containsNearbyDuplicate(nums: number[], k: number): boolean {
  const last = new Map<number, number>();         // значение → последний индекс
  for (let i = 0; i < nums.length; i++) {
    const j = last.get(nums[i]);
    if (j !== undefined && i - j <= k) return true;
    last.set(nums[i], i);
  }
  return false;
}

// --- 128. Longest Consecutive Sequence ---
function longestConsecutive(nums: number[]): number {
  const set = new Set(nums);
  let best = 0;
  for (const x of set) {
    if (set.has(x - 1)) continue;                 // не начало последовательности
    let len = 1;
    while (set.has(x + len)) len++;
    best = Math.max(best, len);
  }
  return best;
}

// ===== проверки =====
assert.deepEqual([...countBy('банан')], [['б', 1], ['а', 2], ['н', 2]]);
assert.equal(subarraySum([1, 1, 1], 2), 2);
assert.equal(subarraySum([1, -1, 0], 0), 3);                                                  // с отрицательными окно не работает, префиксы — да
fuzz(2000, () => [randArray(randInt(0, 10), -3, 3), randInt(-3, 3)] as const, ([nums, k]) => {
  let brute = 0;
  for (let i = 0; i < nums.length; i++) { let s = 0; for (let j = i; j < nums.length; j++) { s += nums[j]; if (s === k) brute++; } }
  assert.equal(subarraySum(nums, k), brute);
});

// 383
assert.equal(canConstruct('a', 'b'), false);
assert.equal(canConstruct('aa', 'ab'), false);
assert.equal(canConstruct('aa', 'aab'), true);
fuzz(2000, () => [randString(randInt(0, 5), 'abc'), randString(randInt(0, 8), 'abc')] as const, ([note, mag]) => {
  const pool = [...mag];
  const brute = [...note].every((c) => { const i = pool.indexOf(c); if (i < 0) return false; pool.splice(i, 1); return true; });
  assert.equal(canConstruct(note, mag), brute);
});

// 205
assert.equal(isIsomorphic('egg', 'add'), true);
assert.equal(isIsomorphic('foo', 'bar'), false);
assert.equal(isIsomorphic('paper', 'title'), true);
assert.equal(isIsomorphic('badc', 'baba'), false);                                             // нужна проверка в обе стороны
const shape = (x: string) => [...x].map((c) => x.indexOf(c)).join(',');
fuzz(2000, () => { const n = randInt(1, 7); return [randString(n, 'abc'), randString(n, 'xyz')] as const; }, ([s, t]) => {
  assert.equal(isIsomorphic(s, t), shape(s) === shape(t));
});

// 290
assert.equal(wordPattern('abba', 'dog cat cat dog'), true);
assert.equal(wordPattern('abba', 'dog cat cat fish'), false);
assert.equal(wordPattern('aaaa', 'dog cat cat dog'), false);
assert.equal(wordPattern('abba', 'dog dog dog dog'), false);
assert.equal(wordPattern('aaa', 'aa aa aa aa'), false);
fuzz(2000, () => [randString(randInt(1, 5), 'ab'), Array.from({ length: randInt(1, 5) }, () => randString(randInt(1, 2), 'xy')).join(' ')] as const, ([p, s]) => {
  const w = s.split(' ');
  const shapeArr = (a: string[]) => a.map((x) => a.indexOf(x)).join(',');
  assert.equal(wordPattern(p, s), w.length === p.length && shapeArr([...p]) === shapeArr(w));
});

// 242
assert.equal(isAnagram('anagram', 'nagaram'), true);
assert.equal(isAnagram('rat', 'car'), false);
fuzz(2000, () => [randString(randInt(0, 6), 'abc'), randString(randInt(0, 6), 'abc')] as const, ([s, t]) => {
  assert.equal(isAnagram(s, t), [...s].sort().join('') === [...t].sort().join(''));
});

// 49
const canon = (g: string[][]) => g.map((x) => [...x].sort().join(',')).sort();
assert.deepEqual(canon(groupAnagrams(['eat', 'tea', 'tan', 'ate', 'nat', 'bat'])), canon([['bat'], ['nat', 'tan'], ['ate', 'eat', 'tea']]));
assert.deepEqual(groupAnagrams(['']), [['']]);
fuzz(500, () => Array.from({ length: randInt(1, 8) }, () => randString(randInt(0, 3), 'abc')), (strs) => {
  const brute = new Map<string, string[]>();
  for (const s of strs) { const key = [...s].sort().join(''); brute.set(key, [...(brute.get(key) ?? []), s]); }
  assert.deepEqual(canon(groupAnagrams(strs)), canon([...brute.values()]));
});

// 1
assert.deepEqual(twoSum([2, 7, 11, 15], 9), [0, 1]);
assert.deepEqual(twoSum([3, 2, 4], 6), [1, 2]);
assert.deepEqual(twoSum([3, 3], 6), [0, 1]);                                                    // один элемент дважды брать нельзя
fuzz(2000, () => { const a = randArray(randInt(2, 10), -10, 10); const i = randInt(0, a.length - 2), j = randInt(i + 1, a.length - 1); return [a, a[i] + a[j]] as const; }, ([a, target]) => {
  const [p, q] = twoSum(a, target);
  assert.ok(p !== q && a[p] + a[q] === target);
});

// 202
assert.equal(isHappy(19), true);
assert.equal(isHappy(2), false);
assert.equal(isHappy(1), true);
const happyBrute = (n: number) => { for (let i = 0; i < 1000; i++) { if (n === 1) return true; n = String(n).split('').reduce((s, d) => s + Number(d) ** 2, 0); } return false; };
for (let n = 1; n <= 2000; n++) assert.equal(isHappy(n), happyBrute(n), String(n));

// 219
assert.equal(containsNearbyDuplicate([1, 2, 3, 1], 3), true);
assert.equal(containsNearbyDuplicate([1, 0, 1, 1], 1), true);
assert.equal(containsNearbyDuplicate([1, 2, 3, 1, 2, 3], 2), false);
fuzz(2000, () => [randArray(randInt(0, 10), 0, 4), randInt(0, 4)] as const, ([nums, k]) => {
  let brute = false;
  for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length && j - i <= k; j++) if (nums[i] === nums[j]) brute = true;
  assert.equal(containsNearbyDuplicate(nums, k), brute);
});

// 128
assert.equal(longestConsecutive([100, 4, 200, 1, 3, 2]), 4);
assert.equal(longestConsecutive([0, 3, 7, 2, 5, 8, 4, 6, 0, 1]), 9);
assert.equal(longestConsecutive([]), 0);
fuzz(2000, () => randArray(randInt(0, 12), -6, 6), (nums) => {
  const s = [...new Set(nums)].sort((a, b) => a - b);
  let best = s.length ? 1 : 0, run = 1;
  for (let i = 1; i < s.length; i++) { run = s[i] === s[i - 1] + 1 ? run + 1 : 1; best = Math.max(best, run); }
  assert.equal(longestConsecutive(nums), best);
});
// O(n): миллион чисел обрабатывается быстро
const big = Array.from({ length: 1_000_000 }, (_, i) => i * 2);
const t = performance.now();
assert.equal(longestConsecutive(big), 1);
assert.ok(performance.now() - t < 2000);

console.log('hashmap ok');
