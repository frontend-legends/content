// Проверки к 2.23: битовые приёмы — сложение двоичных строк, разворот битов, подсчёт единиц, XOR для
// поиска одиночного числа, счёт битов по модулю 3 и AND диапазона; примеры и сравнение с простыми решениями.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/23.bit-manipulation
import { assert, fuzz, randArray, randInt, randString, random } from '../_shared.ts';

// --- шаблон: основные приёмы ---
const getBit = (x: number, i: number) => (x >> i) & 1;
const setBit = (x: number, i: number) => x | (1 << i);
const clearBit = (x: number, i: number) => x & ~(1 << i);
const dropLowest = (x: number) => x & (x - 1);    // сбросить младшую единицу
const lowest = (x: number) => x & -x;             // оставить только младшую единицу
const isPowerOfTwo = (x: number) => x > 0 && (x & (x - 1)) === 0;

// --- 67. Add Binary ---
function addBinary(a: string, b: string): string {
  let result = '';
  let carry = 0;
  for (let i = a.length - 1, j = b.length - 1; i >= 0 || j >= 0 || carry; i--, j--) {
    const sum = (i >= 0 ? +a[i] : 0) + (j >= 0 ? +b[j] : 0) + carry;
    result = (sum & 1) + result;                  // младший бит суммы
    carry = sum >> 1;                             // перенос
  }
  return result;
}

// --- 190. Reverse Bits ---
function reverseBits(n: number): number {
  let result = 0;
  for (let i = 0; i < 32; i++) {
    result = (result << 1) | (n & 1);             // взять младший бит n и дописать справа
    n >>>= 1;
  }
  return result >>> 0;                            // в беззнаковое: иначе старший бит даст минус
}

// --- 191. Number of 1 Bits ---
function hammingWeight(n: number): number {
  let count = 0;
  while (n !== 0) {
    n &= n - 1;                                   // каждая итерация сбрасывает одну единицу
    count++;
  }
  return count;
}

// --- 136. Single Number ---
function singleNumber(nums: number[]): number {
  return nums.reduce((acc, x) => acc ^ x, 0);     // пары сокращаются: x ^ x = 0
}

// --- 137. Single Number II ---
function singleNumberII(nums: number[]): number {
  let ones = 0;                                   // биты, встреченные 1 раз (по модулю 3)
  let twos = 0;                                   // биты, встреченные 2 раза
  for (const x of nums) {
    ones = (ones ^ x) & ~twos;
    twos = (twos ^ x) & ~ones;
  }
  return ones;
}

// --- 201. Bitwise AND of Numbers Range ---
function rangeBitwiseAnd(left: number, right: number): number {
  let shift = 0;
  while (left !== right) {                        // ответ — общий двоичный префикс
    left >>= 1;
    right >>= 1;
    shift++;
  }
  return left << shift;
}

// ===== проверки =====
// шаблон
assert.equal(getBit(0b1010, 1), 1);
assert.equal(setBit(0b1010, 0), 0b1011);
assert.equal(clearBit(0b1010, 3), 0b0010);
assert.equal(dropLowest(0b10100), 0b10000);
assert.equal(lowest(0b10100), 0b100);
assert.deepEqual([0, 1, 2, 3, 4, 6, 8, 1024, 1023].map(isPowerOfTwo), [false, true, true, false, true, false, true, true, false]);

// 67
assert.equal(addBinary('11', '1'), '100');
assert.equal(addBinary('1010', '1011'), '10101');
assert.equal(addBinary('0', '0'), '0');
fuzz(1000, () => [randString(randInt(1, 60), '01').replace(/^0+(?=.)/, ''), randString(randInt(1, 60), '01').replace(/^0+(?=.)/, '')], ([a, b]) => {
  assert.equal(addBinary(a, b), (BigInt('0b' + a) + BigInt('0b' + b)).toString(2));
});

// 190
assert.equal(reverseBits(0b00000010100101000001111010011100), 964176192);
assert.equal(reverseBits(0b11111111111111111111111111111101), 3221225471);
fuzz(1000, () => Math.floor(random() * 2 ** 32), (n) => {
  assert.equal(reverseBits(n), parseInt(n.toString(2).padStart(32, '0').split('').reverse().join(''), 2));
});

// 191
assert.equal(hammingWeight(11), 3);
assert.equal(hammingWeight(128), 1);
assert.equal(hammingWeight(2147483645), 30);
fuzz(1000, () => Math.floor(random() * 2 ** 31), (n) => assert.equal(hammingWeight(n), [...n.toString(2)].filter((c) => c === '1').length));

// 136, 137
assert.equal(singleNumber([4, 1, 2, 1, 2]), 4);
assert.equal(singleNumberII([2, 2, 3, 2]), 3);
assert.equal(singleNumberII([0, 1, 0, 1, 0, 1, 99]), 99);
assert.equal(singleNumberII([-2, -2, 1, 1, 4, 1, 4, 4, -4, -2]), -4);
fuzz(1000, () => { const pairs = randArray(randInt(0, 6), -(2 ** 31), 2 ** 31 - 1); const single = randInt(-(2 ** 31), 2 ** 31 - 1); return { pairs: pairs.filter((x) => x !== single), single }; }, ({ pairs, single }) => {
  const shuffle = (xs: number[]) => xs.map((x) => [random(), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
  assert.equal(singleNumber(shuffle([...pairs, ...pairs, single])), single);
  assert.equal(singleNumberII(shuffle([...pairs, ...pairs, ...pairs, single])), single);
});

// 201
assert.equal(rangeBitwiseAnd(5, 7), 4);
assert.equal(rangeBitwiseAnd(0, 0), 0);
assert.equal(rangeBitwiseAnd(1, 2147483647), 0);
fuzz(1000, () => { const a = randInt(0, 5000); return [a, a + randInt(0, 300)]; }, ([a, b]) => {
  let and = a;
  for (let x = a + 1; x <= b; x++) and &= x;
  assert.equal(rangeBitwiseAnd(a, b), and);
});

console.log('bits ok');
