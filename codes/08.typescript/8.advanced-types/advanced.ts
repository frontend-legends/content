// Глава 8.08 — mapped, условные типы, infer, распределение, шаблонные литералы, рекурсия, брендирование.
import assert from 'node:assert/strict';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const ok = <T extends true>() => {};

type Product = { readonly id: number; title: string; tags?: string[] };

// --- mapped: гомоморфный сохраняет модификаторы
type Clone<T> = { [K in keyof T]: T[K] };
ok<Equal<Clone<Product>, Product>>();
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
ok<Equal<Mutable<Product>, { id: number; title: string; tags?: string[] }>>();
type Concrete<T> = { [K in keyof T]-?: T[K] };
ok<Equal<Concrete<Product>, { readonly id: number; title: string; tags: string[] }>>();
// по объединению ключей — модификаторы не переносятся
type FromKeys = { [K in 'id' | 'title']: Product[K] };
ok<Equal<FromKeys, { id: number; title: string }>>();
// на массивах и кортежах гомоморфный mapped даёт массив/кортеж
type Stringify<T> = { [K in keyof T]: string };
ok<Equal<Stringify<[number, boolean]>, [string, string]>>();

// --- переименование ключей и фильтрация через as
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };
ok<Equal<Getters<{ name: string; age: number }>, { getName: () => string; getAge: () => number }>>();
type OnlyFunctions<T> = { [K in keyof T as T[K] extends (...a: any[]) => any ? K : never]: T[K] };
type Api = { base: string; get(): void; post(): void };
ok<Equal<keyof OnlyFunctions<Api>, 'get' | 'post'>>();

// --- условные типы и infer
type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
ok<Equal<ElementOf<string[]>, string>>();
ok<Equal<ElementOf<number>, never>>();
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
ok<Equal<MyReturnType<() => Promise<number>>, Promise<number>>>();
type UnwrapPromise<T> = T extends Promise<infer U> ? UnwrapPromise<U> : T;
ok<Equal<UnwrapPromise<Promise<Promise<string>>>, string>>();
// infer с ограничением (TS 4.7)
type FirstNum<T> = T extends [infer N extends number, ...unknown[]] ? N : never;
ok<Equal<FirstNum<[42, 'a']>, 42>>();
ok<Equal<FirstNum<['a']>, never>>();
// infer из шаблона: число из строки (TS 4.8)
type ToNumber<S> = S extends `${infer N extends number}` ? N : never;
ok<Equal<ToNumber<'42'>, 42>>();

// --- распределение
type ToArray<T> = T extends unknown ? T[] : never;
ok<Equal<ToArray<string | number>, string[] | number[]>>();
type ToArrayNonDist<T> = [T] extends [unknown] ? T[] : never;
ok<Equal<ToArrayNonDist<string | number>, (string | number)[]>>();
// never — пустое объединение: распределение по нему даёт never
type IsNeverNaive<T> = T extends never ? true : false;
ok<Equal<IsNeverNaive<never>, never>>();
type IsNever<T> = [T] extends [never] ? true : false;
ok<Equal<IsNever<never>, true>>();
ok<Equal<IsNever<string>, false>>();
// распределяется только «голый» параметр
type Wrap<T> = { v: T } extends { v: string } ? 'yes' : 'no';
ok<Equal<Wrap<string | number>, 'no'>>();
// boolean — это true | false
type IsTrue<T> = T extends true ? 'y' : 'n';
ok<Equal<IsTrue<boolean>, 'y' | 'n'>>();

// --- шаблонные литералы
type Size = 'sm' | 'md';
type Color = 'red' | 'blue';
ok<Equal<`${Size}-${Color}`, 'sm-red' | 'sm-blue' | 'md-red' | 'md-blue'>>();
type Px = `${number}px`;
const w: Px = '12px';
// @ts-expect-error — не число
const w2: Px = 'abcpx';
void w; void w2;
type RouteParams<S extends string> =
  S extends `${string}:${infer P}/${infer Rest}` ? { [K in P | keyof RouteParams<`/${Rest}`>]: string }
  : S extends `${string}:${infer P}` ? { [K in P]: string }
  : {};
ok<Equal<RouteParams<'/shop/:category/items/:id'>, { category: string; id: string }>>();
ok<Equal<RouteParams<'/about'>, {}>>();

// --- рекурсивные типы
type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
type Settings = { theme: { color: string; dark: boolean }; locale: string };
const patch: DeepPartial<Settings> = { theme: { dark: true } };
void patch;
type DeepReadonly<T> = { readonly [K in keyof T]: DeepReadonly<T[K]> };
const frozen: DeepReadonly<Settings> = { theme: { color: 'x', dark: false }, locale: 'ru' };
// @ts-expect-error — вложенное тоже readonly
frozen.theme.dark = true;
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
const j: Json = { a: [1, 'b', { c: null }] };
// @ts-expect-error — функция не JSON
const j2: Json = { f: () => 1 };
void j; void j2;
// DeepPartial на массиве: гомоморфный mapped сохраняет массив
ok<Equal<DeepPartial<string[]>, (string | undefined)[]>>();

// предел глубины
type Repeat<S extends string, N extends number, Acc extends string[] = []> =
  Acc['length'] extends N ? '' : `${S}${Repeat<S, N, [...Acc, S]>}`;
ok<Equal<Repeat<'a', 3>, 'aaa'>>();
// @ts-expect-error — TS2589: Type instantiation is excessively deep and possibly infinite
type TooDeep = Repeat<'a', 2000>;

// хвостовая рекурсия разрешает глубже (до 1000 уровней)
type BuildTuple<N extends number, Acc extends unknown[] = []> = Acc['length'] extends N ? Acc : BuildTuple<N, [...Acc, unknown]>;
ok<Equal<BuildTuple<500>['length'], 500>>();

// --- брендирование
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };
type UserId = Brand<string, 'UserId'>;
type OrderId = Brand<string, 'OrderId'>;
const toUserId = (s: string) => s as UserId;
function loadUser(id: UserId) { return id; }
const uid = toUserId('u1');
assert.equal(loadUser(uid), 'u1');
// @ts-expect-error — обычная строка не UserId
loadUser('u1');
// @ts-expect-error — OrderId не UserId
loadUser('o1' as OrderId);
assert.equal(uid.toUpperCase(), 'U1');   // это всё ещё строка
assert.equal(typeof uid, 'string');      // бренд существует только в типах

// бренд через валидацию
type Email = Brand<string, 'Email'>;
function parseEmail(s: string): Email {
  if (!/^[^@\s]+@[^@\s]+$/.test(s)) throw new Error('bad email');
  return s as Email;
}
assert.throws(() => parseEmail('nope'), /bad email/);
assert.equal(parseEmail('a@b.ru'), 'a@b.ru');
