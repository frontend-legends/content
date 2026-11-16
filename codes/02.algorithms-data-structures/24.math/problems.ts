// Проверки к 2.24: математика в задачах — палиндром числа, плюс один, нули факториала, целый корень,
// быстрое возведение в степень и точки на прямой; примеры и сравнение с простыми решениями.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/24.math
import { assert, fuzz, randArray, randInt, random } from '../_shared.ts';

// --- шаблон: НОД алгоритмом Евклида ---
function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return Math.abs(a);
}

// --- 9. Palindrome Number ---
function isPalindrome(x: number): boolean {
  if (x < 0 || (x % 10 === 0 && x !== 0)) return false;   // минус или ноль в конце — не палиндром
  let reversed = 0;
  while (x > reversed) {                          // развернуть только половину цифр
    reversed = reversed * 10 + (x % 10);
    x = Math.floor(x / 10);
  }
  return x === reversed || x === Math.floor(reversed / 10);   // нечётная длина — средняя цифра лишняя
}

// --- 66. Plus One ---
function plusOne(digits: number[]): number[] {
  const result = [...digits];
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i] < 9) {
      result[i]++;
      return result;
    }
    result[i] = 0;                                // 9 + 1 = 10: ноль и перенос дальше
  }
  return [1, ...result];                          // все девятки: 999 + 1 = 1000
}

// --- 172. Factorial Trailing Zeroes ---
function trailingZeroes(n: number): number {
  let count = 0;
  for (let p = 5; p <= n; p *= 5) count += Math.floor(n / p);   // множители 5, 25, 125…
  return count;
}

// --- 69. Sqrt(x) ---
function mySqrt(x: number): number {
  let lo = 0;
  let hi = x;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);         // вверх — иначе lo = mid не сдвинется
    if (mid * mid <= x) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// --- 50. Pow(x, n) ---
function myPow(x: number, n: number): number {
  if (n < 0) return 1 / myPow(x, -n);
  let result = 1;
  let base = x;
  for (let e = n; e > 0; e = Math.floor(e / 2)) {
    if (e % 2 === 1) result *= base;              // бит степени равен 1 — домножить
    base *= base;                                 // x, x², x⁴, x⁸…
  }
  return result;
}

// --- 149. Max Points on a Line ---
function maxPoints(points: number[][]): number {
  let best = Math.min(points.length, 1);
  for (let i = 0; i < points.length; i++) {
    const slopes = new Map<string, number>();
    for (let j = i + 1; j < points.length; j++) {
      let dx = points[j][0] - points[i][0];
      let dy = points[j][1] - points[i][1];
      const g = gcd(dx, dy);
      dx /= g;
      dy /= g;
      if (dx < 0 || (dx === 0 && dy < 0)) [dx, dy] = [-dx, -dy];   // одно направление — один ключ
      const key = `${dx}/${dy}`;
      const count = (slopes.get(key) ?? 1) + 1;   // точка i плюс найденные
      slopes.set(key, count);
      best = Math.max(best, count);
    }
  }
  return best;
}

// ===== проверки =====
// шаблон
assert.equal(gcd(12, 18), 6);
assert.equal(gcd(-4, 6), 2);
assert.equal(gcd(0, 5), 5);
fuzz(500, () => [randInt(1, 500), randInt(1, 500)], ([a, b]) => {
  let g = 1;
  for (let d = 1; d <= Math.min(a, b); d++) if (a % d === 0 && b % d === 0) g = d;
  assert.equal(gcd(a, b), g);
});

// 9
assert.deepEqual([121, -121, 10, 0, 1221, 12321, 123].map(isPalindrome), [true, false, false, true, true, true, false]);
fuzz(2000, () => randInt(-1000, 2 ** 31 - 1), (x) => assert.equal(isPalindrome(x), String(x) === [...String(x)].reverse().join('')));

// 66
assert.deepEqual(plusOne([1, 2, 3]), [1, 2, 4]);
assert.deepEqual(plusOne([4, 3, 2, 1]), [4, 3, 2, 2]);
assert.deepEqual(plusOne([9]), [1, 0]);
assert.deepEqual(plusOne([9, 9, 9]), [1, 0, 0, 0]);
fuzz(1000, () => { const d = randArray(randInt(1, 30), 0, 9); if (d[0] === 0 && d.length > 1) d[0] = 9; return d; }, (d) => {
  assert.equal(plusOne(d).join(''), (BigInt(d.join('')) + 1n).toString());
});

// 172
assert.equal(trailingZeroes(3), 0);
assert.equal(trailingZeroes(5), 1);
assert.equal(trailingZeroes(25), 6);
assert.equal(trailingZeroes(0), 0);
let fact = 1n;
for (let n = 1; n <= 300; n++) {
  fact *= BigInt(n);
  assert.equal(trailingZeroes(n), fact.toString().length - fact.toString().replace(/0+$/, '').length);
}

// 69
assert.equal(mySqrt(4), 2);
assert.equal(mySqrt(8), 2);
assert.equal(mySqrt(0), 0);
assert.equal(mySqrt(2 ** 31 - 1), 46340);
fuzz(2000, () => randInt(0, 2 ** 31 - 1), (x) => assert.equal(mySqrt(x), Math.floor(Math.sqrt(x))));

// 50
assert.equal(myPow(2, 10), 1024);
assert.ok(Math.abs(myPow(2.1, 3) - 9.261) < 1e-9);
assert.equal(myPow(2, -2), 0.25);
assert.equal(myPow(1, -(2 ** 31)), 1);
fuzz(1000, () => ({ x: Math.round((random() * 4 - 2) * 100) / 100, n: randInt(-20, 20) }), ({ x, n }) => {
  if (x === 0 && n < 0) return;
  const expected = x ** n;
  assert.ok(Math.abs(myPow(x, n) - expected) <= 1e-9 * Math.max(1, Math.abs(expected)));
});
// число умножений — O(log n): для n = 2^30 цикл проходит 31 раз
let steps = 0;
for (let e = 2 ** 30; e > 0; e = Math.floor(e / 2)) steps++;
assert.equal(steps, 31);

// 149
assert.equal(maxPoints([[1, 1], [2, 2], [3, 3]]), 3);
assert.equal(maxPoints([[1, 1], [3, 2], [5, 3], [4, 1], [2, 3], [1, 4]]), 4);
assert.equal(maxPoints([[0, 0]]), 1);
fuzz(500, () => { const pts = new Map<string, number[]>(); const n = randInt(1, 9); while (pts.size < n) { const p = [randInt(-3, 3), randInt(-3, 3)]; pts.set(p.join(), p); } return [...pts.values()]; }, (pts) => {
  // эталон: для каждой пары — сколько точек коллинеарны (векторное произведение)
  let best = 1;
  for (const a of pts) for (const b of pts) if (a !== b) {
    best = Math.max(best, pts.filter((c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) === 0).length);
  }
  assert.equal(maxPoints(pts), best);
});

console.log('math ok');
