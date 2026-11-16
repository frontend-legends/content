// Проверки к 2.05: решения задач на два указателя — примеры из условий и случайные тесты против перебора.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/5.two-pointers
import { assert, fuzz, randArray, randInt, randString } from '../_shared.ts';

// --- шаблоны ---
function reverseInPlace(a: number[]): number[] {
  let left = 0;
  let right = a.length - 1;
  while (left < right) {
    [a[left], a[right]] = [a[right], a[left]];
    left++;
    right--;
  }
  return a;
}

function dedupeSorted(a: number[]): number {
  let write = 0;                              // медленный: куда писать
  for (let read = 0; read < a.length; read++) { // быстрый: что читать
    if (read === 0 || a[read] !== a[read - 1]) a[write++] = a[read];
  }
  return write;                               // длина без повторов
}

// --- 125. Valid Palindrome ---
function isPalindrome(s: string): boolean {
  const isAlnum = (c: string) => /[a-z0-9]/i.test(c);
  let left = 0;
  let right = s.length - 1;
  while (left < right) {
    if (!isAlnum(s[left])) left++;
    else if (!isAlnum(s[right])) right--;
    else if (s[left].toLowerCase() !== s[right].toLowerCase()) return false;
    else {
      left++;
      right--;
    }
  }
  return true;
}

// --- 392. Is Subsequence ---
function isSubsequence(s: string, t: string): boolean {
  let i = 0;
  for (let j = 0; j < t.length && i < s.length; j++) {
    if (s[i] === t[j]) i++;
  }
  return i === s.length;
}

// --- 167. Two Sum II ---
function twoSum(numbers: number[], target: number): number[] {
  let left = 0;
  let right = numbers.length - 1;
  while (left < right) {
    const sum = numbers[left] + numbers[right];
    if (sum === target) return [left + 1, right + 1];
    if (sum < target) left++;
    else right--;
  }
  return [];
}

// --- 11. Container With Most Water ---
function maxArea(height: number[]): number {
  let left = 0;
  let right = height.length - 1;
  let best = 0;
  while (left < right) {
    const h = Math.min(height[left], height[right]);
    best = Math.max(best, h * (right - left));
    if (height[left] < height[right]) left++;
    else right--;
  }
  return best;
}

// --- 15. 3Sum ---
function threeSum(nums: number[]): number[][] {
  const a = [...nums].sort((x, y) => x - y);
  const result: number[][] = [];
  for (let i = 0; i < a.length - 2; i++) {
    if (a[i] > 0) break;                      // дальше только положительные
    if (i > 0 && a[i] === a[i - 1]) continue; // тот же первый элемент
    let left = i + 1;
    let right = a.length - 1;
    while (left < right) {
      const sum = a[i] + a[left] + a[right];
      if (sum < 0) left++;
      else if (sum > 0) right--;
      else {
        result.push([a[i], a[left], a[right]]);
        while (left < right && a[left] === a[left + 1]) left++;
        while (left < right && a[right] === a[right - 1]) right--;
        left++;
        right--;
      }
    }
  }
  return result;
}

// ===== проверки =====
assert.deepEqual(reverseInPlace([1, 2, 3, 4]), [4, 3, 2, 1]);
const d = [1, 1, 2, 3, 3, 3];
assert.equal(dedupeSorted(d), 3);
assert.deepEqual(d.slice(0, 3), [1, 2, 3]);

// 125
assert.equal(isPalindrome('A man, a plan, a canal: Panama'), true);
assert.equal(isPalindrome('race a car'), false);
assert.equal(isPalindrome(' '), true);
assert.equal(isPalindrome('0P'), false);                                                    // цифра и буква — не равны
fuzz(2000, () => randString(randInt(0, 12), 'aAb0 ,.'), (s) => {
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  assert.equal(isPalindrome(s), clean === [...clean].reverse().join(''));
});

// 392
assert.equal(isSubsequence('abc', 'ahbgdc'), true);
assert.equal(isSubsequence('axc', 'ahbgdc'), false);
assert.equal(isSubsequence('', 'abc'), true);
const subsequenceBrute = (s: string, t: string): boolean => {
  if (!s) return true;
  if (!t) return false;
  return s[0] === t[0] ? subsequenceBrute(s.slice(1), t.slice(1)) || subsequenceBrute(s, t.slice(1)) : subsequenceBrute(s, t.slice(1));
};
fuzz(2000, () => [randString(randInt(0, 4), 'ab'), randString(randInt(0, 8), 'abc')] as const, ([s, t]) => {
  assert.equal(isSubsequence(s, t), subsequenceBrute(s, t));
});

// 167
assert.deepEqual(twoSum([2, 7, 11, 15], 9), [1, 2]);
assert.deepEqual(twoSum([2, 3, 4], 6), [1, 3]);
assert.deepEqual(twoSum([-1, 0], -1), [1, 2]);
fuzz(2000, () => {
  const a = randArray(randInt(2, 10), -20, 20).sort((x, y) => x - y);
  const i = randInt(0, a.length - 2), j = randInt(i + 1, a.length - 1);
  return { a, target: a[i] + a[j] };
}, ({ a, target }) => {
  const [p, q] = twoSum(a, target);
  assert.ok(p < q && a[p - 1] + a[q - 1] === target);                                         // пара может быть не единственной
});

// 11
assert.equal(maxArea([1, 8, 6, 2, 5, 4, 8, 3, 7]), 49);
assert.equal(maxArea([1, 1]), 1);
fuzz(2000, () => randArray(randInt(2, 12), 0, 10), (h) => {
  let best = 0;
  for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) best = Math.max(best, Math.min(h[i], h[j]) * (j - i));
  assert.equal(maxArea(h), best);
});

// 15
const norm = (r: number[][]) => r.map((t) => [...t].sort((x, y) => x - y).join(',')).sort();
assert.deepEqual(norm(threeSum([-1, 0, 1, 2, -1, -4])), ['-1,-1,2', '-1,0,1']);
assert.deepEqual(threeSum([0, 1, 1]), []);
assert.deepEqual(threeSum([0, 0, 0]), [[0, 0, 0]]);
fuzz(1000, () => randArray(randInt(0, 10), -5, 5), (nums) => {
  const found = new Set<string>();
  for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) for (let k = j + 1; k < nums.length; k++) {
    if (nums[i] + nums[j] + nums[k] === 0) found.add([nums[i], nums[j], nums[k]].sort((x, y) => x - y).join(','));
  }
  const got = norm(threeSum(nums));
  assert.deepEqual(got, [...found].sort());
  assert.equal(new Set(got).size, got.length);                                                 // без дублей
});

console.log('two pointers ok');
