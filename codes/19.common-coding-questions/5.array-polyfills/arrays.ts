// Проверки к 19.05: полифилы map, filter, reduce, forEach, flat и groupBy, unique — каждый сверен с нативным
// на краевых случаях. Исходные версии расходились: map терял длину с дырой в конце и обходил добавленные
// во время обхода элементы, reduce без начального значения давал NaN на [, 1, 2], flat оставлял дыры,
// groupBy падал на ключе '__proto__'.
import assert from 'node:assert/strict';

declare global {
  interface Array<T> {
    myMap<U>(cb: (value: T, index: number, array: T[]) => U, thisArg?: unknown): U[];
    myFilter(cb: (value: T, index: number, array: T[]) => unknown, thisArg?: unknown): T[];
    myReduce(cb: (acc: T, value: T, index: number, array: T[]) => T): T;
    myReduce<A>(cb: (acc: A, value: T, index: number, array: T[]) => A, initial: A): A;
    myForEach(cb: (value: T, index: number, array: T[]) => void, thisArg?: unknown): void;
    myFlat(depth?: number): unknown[];
  }
}

Array.prototype.myMap = function (cb, thisArg) {
  const len = this.length;                    // длину фиксируем: добавленное во время обхода не посещаем
  const result = new Array(len);              // та же длина и те же дыры
  for (let i = 0; i < len; i++) {
    if (i in this) result[i] = cb.call(thisArg, this[i], i, this); // дыры пропускаем
  }
  return result;
};
Array.prototype.myFilter = function (cb, thisArg) {
  const len = this.length;
  const result = [];
  for (let i = 0; i < len; i++) {
    if (i in this && cb.call(thisArg, this[i], i, this)) result.push(this[i]);
  }
  return result;
};
Array.prototype.myReduce = function (this: unknown[], cb: any, initial?: unknown): any {
  const len = this.length;
  let i = 0;
  let acc: unknown;
  if (arguments.length >= 2) acc = initial;   // наличие initial — по числу аргументов, а не по истинности
  else {
    while (i < len && !(i in this)) i++;      // первый существующий элемент, а не this[0]
    if (i >= len) throw new TypeError('Reduce of empty array with no initial value');
    acc = this[i++];
  }
  for (; i < len; i++) if (i in this) acc = cb(acc, this[i], i, this);
  return acc;
};
Array.prototype.myForEach = function (cb, thisArg) {
  const len = this.length;
  for (let i = 0; i < len; i++) if (i in this) cb.call(thisArg, this[i], i, this);
};
Array.prototype.myFlat = function (depth = 1) {
  const result: unknown[] = [];
  for (let i = 0; i < this.length; i++) {
    if (!(i in this)) continue;               // flat удаляет дыры; for...of выдал бы undefined
    const item = this[i];
    if (Array.isArray(item) && depth > 0) result.push(...item.myFlat(depth - 1));
    else result.push(item);
  }
  return result;
};

// --- сверка с нативными на обычных данных ---
const nums = [1, 2, 3, 4];
assert.deepEqual(nums.myMap((x, i) => x * i), nums.map((x, i) => x * i));
assert.deepEqual(nums.myFilter((x) => x % 2 === 0), [2, 4]);
assert.equal(nums.myReduce((a, b) => a + b), 10);
assert.equal(nums.myReduce((a, b) => a + b, 0), 10);
assert.deepEqual(nums.myReduce((acc: string[], x) => [...acc, String(x)], []), ['1', '2', '3', '4']);
assert.equal(nums.myMap(() => 0) !== nums, true);   // новый массив
const seen: unknown[] = [];
nums.myForEach((x, i, arr) => seen.push([x, i, arr === nums]));
assert.deepEqual(seen[1], [2, 1, true]);            // колбэк получает (value, index, array)
assert.equal(nums.myForEach(() => 1), undefined);   // forEach ничего не возвращает
assert.deepEqual(['1', '2', '3'].map(parseInt), [1, NaN, NaN]);          // индекс уходит в parseInt как основание
assert.deepEqual(['1', '2', '3'].myMap((s) => parseInt(s)), [1, 2, 3]);
const filtered = ([1, , 3] as number[]).myFilter(() => true);
assert.deepEqual(filtered, [1, 3]);
assert.equal(filtered.length, 2);                                      // filter возвращает плотный массив

// --- thisArg: работает с обычной функцией, бесполезен со стрелкой ---
const scale = { k: 10 };
assert.deepEqual([1, 2].myMap(function (this: typeof scale, x) { return x * this.k; }, scale), [10, 20]);
const arrowCb = (function (this: unknown) { return () => this; }).call('внешний');
assert.deepEqual([1].myMap(arrowCb, scale), ['внешний']); // стрелка берёт свой внешний this, thisArg игнорируется

// --- краевые случаи, где исходные версии расходились с нативными ---
const holeAtEnd = [1, , ];                          // длина 2, дыра в позиции 1
assert.equal(holeAtEnd.myMap((x) => x).length, holeAtEnd.map((x) => x).length); // 2, как у нативного
assert.equal(1 in holeAtEnd.myMap((x) => x), false);                              // дыра сохранилась

const growing = [1, 2, 3];
let visits = 0;
growing.myMap((x) => { visits++; if (visits < 10) growing.push(x); return x; });
assert.equal(visits, 3);                            // добавленные во время обхода не посещаются — как у нативного

const holeFirst = [, 1, 2] as number[];
assert.equal(holeFirst.myReduce((a, b) => a + b), holeFirst.reduce((a, b) => a + b)); // 3, а не NaN
assert.throws(() => ([] as number[]).myReduce((a) => a), TypeError);
assert.throws(() => ([, ,] as unknown as number[]).myReduce((a) => a), TypeError); // одни дыры — как пустой
assert.equal([5].myReduce(() => { throw new Error('не вызывается'); }), 5); // один элемент без initial — колбэк не вызывается
assert.equal([1, 2].myReduce((a: number, b) => a + b, undefined as unknown as number), NaN); // undefined — тоже initial

assert.deepEqual([1, , 3].myFlat(), [1, , 3].flat());                // [1, 3]: дыры удалены
assert.deepEqual([1, [2, [3, [4]]]].myFlat(2), [1, [2, [3, [4]]]].flat(2));
assert.deepEqual([1, [2, [3, [4]]]].myFlat(Infinity), [1, 2, 3, 4]);

// --- map через reduce: работает, но спред на каждом шаге — O(n²) ---
const mapViaReduceSpread = <T, U>(arr: T[], fn: (x: T) => U) => arr.reduce<U[]>((acc, x) => [...acc, fn(x)], []);
const mapViaReducePush = <T, U>(arr: T[], fn: (x: T) => U) => arr.reduce<U[]>((acc, x) => { acc.push(fn(x)); return acc; }, []);
const big = Array.from({ length: 20_000 }, (_, i) => i);
const time = (fn: () => unknown) => { const t = performance.now(); fn(); return performance.now() - t; };
assert.deepEqual(mapViaReduceSpread([1, 2], (x) => x * 2), [2, 4]);
const spreadMs = time(() => mapViaReduceSpread(big, (x) => x));
const pushMs = time(() => mapViaReducePush(big, (x) => x));
assert.ok(spreadMs > pushMs * 20, `спред ${spreadMs.toFixed(1)} мс против push ${pushMs.toFixed(1)} мс`);

// --- groupBy ---
function groupBy<T>(arr: T[], keyFn: (item: T) => PropertyKey) {
  const groups: Record<PropertyKey, T[]> = Object.create(null); // без прототипа: '__proto__' — обычный ключ
  for (const item of arr) (groups[keyFn(item)] ??= []).push(item);
  return groups;
}
assert.deepEqual({ ...groupBy([6.1, 4.2, 6.3], Math.floor) }, { 4: [4.2], 6: [6.1, 6.3] });
assert.deepEqual(groupBy(['x'], () => '__proto__')['__proto__'], ['x']); // с обычным {} здесь был TypeError
const naiveGroupBy = <T>(arr: T[], f: (x: T) => string) => arr.reduce<Record<string, T[]>>((acc, it) => { (acc[f(it)] ??= []).push(it); return acc; }, {});
assert.throws(() => naiveGroupBy(['x'], () => '__proto__'), TypeError);     // acc.__proto__ — это Object.prototype, у него нет push
// встроенные с ES2024
assert.equal(Object.getPrototypeOf(Object.groupBy([1], () => 'a')), null);  // Object.groupBy тоже возвращает объект без прототипа
assert.deepEqual(Object.groupBy([6.1, 4.2, 6.3], Math.floor)[6], [6.1, 6.3]);
assert.deepEqual(Map.groupBy([1, 2, 3], (x) => x % 2).get(1), [1, 3]);       // Map.groupBy — ключи любого типа

// --- unique ---
const unique = <T>(arr: T[]): T[] => [...new Set(arr)];
assert.deepEqual(unique([1, 2, 1, NaN, NaN, '1']), [1, 2, NaN, '1']);        // Set: NaN дедуплицируется, '1' и 1 — разные
assert.equal(unique([{ id: 1 }, { id: 1 }]).length, 2);                      // объекты — по ссылке
function uniqueBy<T>(arr: T[], keyFn: (item: T) => unknown): T[] {
  const map = new Map<unknown, T>();
  for (const item of arr) { const key = keyFn(item); if (!map.has(key)) map.set(key, item); }
  return [...map.values()];
}
assert.deepEqual(uniqueBy([{ id: 1, v: 'a' }, { id: 2, v: 'b' }, { id: 1, v: 'c' }], (x) => x.id), [{ id: 1, v: 'a' }, { id: 2, v: 'b' }]); // первый на ключ

console.log('arrays ok');
