// Глава 7.03 — массивы: дырки, length, sort по умолчанию, стабильность, немутирующие копии,
// includes против indexOf, Set и операции над множествами.
// run: node arrays.cjs
const assert = require('node:assert/strict');

// массив — объект с числовыми ключами и length
const arr = ['a', 'b', 'c'];
arr.length = 1;
assert.deepEqual(arr, ['a']);            // length обрезает
arr[4] = 'e';
assert.equal(arr.length, 5);             // и растёт с дырками
assert.equal(1 in arr, false);

// дырки: forEach и map их пропускают, for...of и Array.from — нет
const holes = [1, , 3];
let visited = 0; holes.forEach(() => visited++);
assert.equal(visited, 2);
assert.equal(Array(3).map(() => 0).length, 3);
assert.equal(0 in Array(3).map(() => 0), false);        // map не вызвал колбэк
assert.deepEqual(Array.from({ length: 3 }, (_, i) => i), [0, 1, 2]);
assert.deepEqual([...holes], [1, undefined, 3]);

// sort по умолчанию сравнивает строки и мутирует
const nums = [10, 9, 1, 100];
const sorted = nums.sort();
assert.deepEqual(nums, [1, 10, 100, 9]);
assert.equal(sorted, nums);
assert.deepEqual([10, 9, 1, 100].sort((a, b) => a - b), [1, 9, 10, 100]);
// стабильная сортировка: равные сохраняют порядок
const people = [{ n: 'Ann', a: 30 }, { n: 'Bob', a: 25 }, { n: 'Eve', a: 30 }, { n: 'Dan', a: 25 }];
assert.deepEqual(people.toSorted((x, y) => x.a - y.a).map((p) => p.n), ['Bob', 'Dan', 'Ann', 'Eve']);

// немутирующие копии
const base = [3, 1, 2];
assert.deepEqual(base.toSorted(), [1, 2, 3]);
assert.deepEqual(base.toReversed(), [2, 1, 3]);
assert.deepEqual(base.with(0, 9), [9, 1, 2]);
assert.deepEqual(base.toSpliced(1, 1), [3, 2]);
assert.deepEqual(base, [3, 1, 2]);
assert.equal(base.at(-1), 2);
assert.equal(base.findLast((x) => x > 1), 2);

// includes находит NaN (SameValueZero), indexOf — нет (===)
assert.equal([NaN].includes(NaN), true);
assert.equal([NaN].indexOf(NaN), -1);

// Set: уникальность по SameValueZero, порядок вставки, операции над множествами
assert.deepEqual([...new Set([1, '1', 1, NaN, NaN, 0, -0])], [1, '1', NaN, 0]);
const a = new Set(['tea', 'cup', 'pot']); const b = new Set(['cup', 'spoon']);
assert.deepEqual([...a.intersection(b)], ['cup']);
assert.deepEqual([...a.union(b)], ['tea', 'cup', 'pot', 'spoon']);
assert.deepEqual([...a.difference(b)], ['tea', 'pot']);
assert.equal(new Set(['cup']).isSubsetOf(a), true);

// reduce без начального значения на пустом массиве — TypeError
assert.throws(() => [].reduce((s, x) => s + x), TypeError);
assert.equal([].reduce((s, x) => s + x, 0), 0);
console.log('ok');
