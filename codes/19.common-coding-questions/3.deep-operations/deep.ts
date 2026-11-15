// Проверки к 19.03: что теряет JSON-клон и что умеет structuredClone; deepClone с циклами, Date, RegExp,
// Map, Set и прототипом (исходная версия превращала Set в {}); deepEqual с NaN, датами и различием массива
// и объекта (исходная считала равными [1] и {0: 1} и любые две даты); flatten рекурсивный и через стек;
// flattenObject, не теряющий даты и пустые объекты; get/set по пути, set без загрязнения прототипа.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// --- встроенные способы и их пределы ---
const sample = { m: new Map([[1, 2]]), d: new Date(0), u: undefined, f: () => 1 };
assert.equal(JSON.stringify(sample), '{"m":{},"d":"1970-01-01T00:00:00.000Z"}'); // Map → {}, Date → строка, undefined и функция пропали
const cyclic: any = { name: 'корень' }; cyclic.self = cyclic;
assert.throws(() => JSON.stringify(cyclic), TypeError);                          // цикл — ошибка
const sc = structuredClone({ ...cyclic, d: new Date(0), m: new Map([[1, { x: 1 }]]), s: new Set([1]) });
assert.ok(sc.d instanceof Date && sc.m.get(1).x === 1 && sc.s.has(1));          // structuredClone понимает Date, Map, Set
assert.throws(() => structuredClone({ f: () => 1 }), { name: 'DataCloneError' }); // функции не клонирует
class Point { x = 1; norm() { return this.x; } }
assert.equal(structuredClone(new Point()) instanceof Point, false);              // и теряет класс

// --- deepClone ---
function deepClone<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') return value;  // примитивы и функции — как есть
  if (seen.has(value)) return seen.get(value) as T;                // цикл: вернуть уже созданную копию
  if (value instanceof Date) return new Date(value) as T;
  if (value instanceof RegExp) return new RegExp(value.source, value.flags) as T;
  if (value instanceof Map) {
    const map = new Map();
    seen.set(value, map);
    value.forEach((v, k) => map.set(k, deepClone(v, seen))); // ключи — по ссылке, как в lodash
    return map as T;
  }
  if (value instanceof Set) {
    const set = new Set();
    seen.set(value, set);
    value.forEach((v) => set.add(deepClone(v, seen)));
    return set as T;
  }
  if (Array.isArray(value)) {
    const arr: unknown[] = [];
    seen.set(value, arr);
    value.forEach((item, i) => { arr[i] = deepClone(item, seen); });
    return arr as T;
  }
  const result = Object.create(Object.getPrototypeOf(value)); // сохраняем прототип — класс не теряется
  seen.set(value, result);                                     // записываем ДО рекурсии
  for (const key of Object.keys(value)) result[key] = deepClone((value as any)[key], seen);
  return result;
}
{
  const original: any = { user: { name: 'Анна', tags: ['a', 'b'] }, at: new Date(5), re: /ч[аи]й/gi, roles: new Set(['admin']), prefs: new Map([['theme', { dark: true }]]), p: new Point() };
  original.self = original;
  const copy = deepClone(original);
  copy.user.tags.push('c');
  copy.prefs.get('theme').dark = false;
  assert.deepEqual(original.user.tags, ['a', 'b']);   // вложенный массив скопирован, а не общий
  assert.equal(original.prefs.get('theme').dark, true);
  assert.equal(copy.self, copy);                       // цикл воспроизведён в копии, без зацикливания
  assert.notEqual(copy.at, original.at);
  assert.equal(copy.at.getTime(), 5);
  assert.equal(copy.re.flags, 'gi');
  assert.ok(copy.roles instanceof Set && copy.roles.has('admin')); // Set остался Set
  assert.ok(copy.p instanceof Point && copy.p.norm() === 1);       // класс и методы сохранены
  const shared = { x: 1 };
  const twins = deepClone({ a: shared, b: shared });
  assert.equal(twins.a, twins.b);                      // общая ссылка в оригинале → общая копия в клоне
  assert.notEqual(twins.a, shared);
  assert.equal('size' in WeakMap.prototype, false);    // у WeakMap нет size и перебора — цена слабых ссылок
}

// --- deepEqual ---
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b || (a !== a && b !== b)) return true;  // SameValueZero: NaN равен NaN, 0 равен -0
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false; // массив ≠ объект, Date ≠ {}
  if (a instanceof Date) return a.getTime() === (b as Date).getTime();
  if (a instanceof Map) {
    const m = b as Map<unknown, unknown>;
    return a.size === m.size && [...a].every(([k, v]) => m.has(k) && deepEqual(v, m.get(k)));
  }
  if (a instanceof Set) {
    const s = b as Set<unknown>;
    return a.size === s.size && [...a].every((v) => s.has(v));
  }
  const keysA = Object.keys(a), keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual((a as any)[k], (b as any)[k]));
}
assert.equal(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), true);
assert.equal(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true);        // порядок ключей не важен
assert.equal(deepEqual({ a: 1 }, { a: 1, b: undefined }), false);     // разное число ключей
assert.equal(deepEqual(NaN, NaN), true);
assert.equal(deepEqual([1], { 0: 1 }), false);                        // исходная версия считала их равными
assert.equal(deepEqual(new Date(1), new Date(2)), false);             // исходная — тоже (у Date нет своих ключей)
assert.equal(deepEqual(new Date(1), new Date(1)), true);
assert.equal(deepEqual(new Map([['a', { x: 1 }]]), new Map([['a', { x: 1 }]])), true);
assert.equal(deepEqual(new Set([1, 2]), new Set([1, 3])), false);
assert.equal(deepEqual(null, {}), false);
assert.equal(deepEqual(0, -0), true);
const isEqual: (a: unknown, b: unknown) => boolean = createRequire(import.meta.url)('lodash/isEqual.js');
assert.equal(isEqual(NaN, NaN), true);   // lodash тоже SameValueZero: NaN равен NaN…
assert.equal(isEqual(0, -0), true);      // …и 0 равен -0
assert.equal(isEqual([1], { 0: 1 }), false);

// --- flatten массива ---
function flatten<T>(arr: unknown[], depth = Infinity): T[] {
  return arr.reduce<T[]>((acc, item) => {
    if (Array.isArray(item) && depth > 0) acc.push(...flatten<T>(item, depth - 1));
    else acc.push(item as T);
    return acc;
  }, []);
}
assert.deepEqual(flatten([1, [2, [3, [4]]]]), [1, 2, 3, 4]);
assert.deepEqual(flatten([1, [2, [3]]], 1), [1, 2, [3]]);
assert.deepEqual(flatten([1, [2, [3, [4]]]], 2), [...[1, [2, [3, [4]]]]].flat(2)); // совпадает со встроенным flat

function flattenIter(arr: unknown[]): unknown[] {
  const stack = [...arr];
  const result: unknown[] = [];
  while (stack.length) {
    const next = stack.pop();
    if (Array.isArray(next)) stack.push(...next);
    else result.push(next);
  }
  return result.reverse(); // pop идёт с конца — порядок разворачиваем
}
assert.deepEqual(flattenIter([1, [2, [3]], 4, [[5]]]), [1, 2, 3, 4, 5]);
// глубина, на которой рекурсия падает, а стек — нет
let deep: unknown[] = [0];
for (let i = 0; i < 20_000; i++) deep = [deep];
assert.throws(() => flatten(deep), RangeError);   // Maximum call stack size exceeded
assert.deepEqual(flattenIter(deep), [0]);

// --- flattenObject ---
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(v));
function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (isPlainObject(value) && Object.keys(value).length) Object.assign(result, flattenObject(value, path));
    else result[path] = value; // массивы, даты, пустые объекты и примитивы — листья
  }
  return result;
}
const at = new Date(0);
assert.deepEqual(flattenObject({ a: { b: { c: 1 } }, d: 2, tags: [1, 2], at, empty: {}, n: null }),
  { 'a.b.c': 1, d: 2, tags: [1, 2], at, empty: {}, n: null });
// наивная проверка typeof === 'object' рекурсивно заходит в Date и теряет её — у даты нет своих ключей
const naiveFlatten = (o: any, p = ''): any => Object.keys(o).reduce((r: any, k) => {
  const path = p ? `${p}.${k}` : k; const v = o[k];
  return v && typeof v === 'object' && !Array.isArray(v) ? { ...r, ...naiveFlatten(v, path) } : { ...r, [path]: v };
}, {});
assert.deepEqual(naiveFlatten({ at, empty: {} }), {}); // и дата, и пустой объект пропали

// --- get / set по пути ---
const toKeys = (path: string | string[]) => Array.isArray(path) ? path : path.replace(/\[(\w+)\]/g, '.$1').split('.').filter(Boolean);
function get(obj: unknown, path: string | string[], def?: unknown) {
  let result: any = obj;
  for (const key of toKeys(path)) {
    if (result == null) return def;
    result = result[key];
  }
  return result === undefined ? def : result;
}
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);
function set(obj: any, path: string | string[], value: unknown) {
  const keys = toKeys(path);
  if (keys.some((k) => FORBIDDEN.has(k))) throw new Error(`запрещённый ключ в пути: ${keys.join('.')}`);
  let curr = obj;
  keys.forEach((key, i) => {
    if (i === keys.length - 1) curr[key] = value;
    else {
      if (curr[key] == null) curr[key] = /^\d+$/.test(keys[i + 1]) ? [] : {}; // числовой следующий ключ → массив
      curr = curr[key];
    }
  });
  return obj;
}
const data = { a: { b: [{ c: 42 }] }, z: null };
assert.equal(get(data, 'a.b[0].c'), 42);
assert.equal(get(data, ['a', 'b', '0', 'c']), 42);
assert.equal(get({ a: 1 }, 'a.b.c', 'по умолчанию'), 'по умолчанию'); // не падает на несуществующем пути
assert.equal(get(data, 'z', 'по умолчанию'), null);                   // null — значение, default только для undefined
assert.deepEqual(set({}, 'form.items[0].title', 'чай'), { form: { items: [{ title: 'чай' }] } });
assert.throws(() => set({}, '__proto__.isAdmin', true), /запрещённый ключ/); // путь из внешних данных не загрязнит прототип
assert.equal(({} as any).isAdmin, undefined);

console.log('deep ok');
