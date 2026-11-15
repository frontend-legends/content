// Глава 8.08 — практика: параметры маршрута, IsNever, бренды для денег.
import assert from 'node:assert/strict';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const ok = <T extends true>() => {};

// 1. buildUrl
type RouteParams<S extends string> =
  S extends `${string}:${infer P}/${infer Rest}`
    ? { [K in P | keyof RouteParams<`/${Rest}`>]: string }
    : S extends `${string}:${infer P}`
      ? { [K in P]: string }
      : {};
function buildUrl<const S extends string>(route: S, params: RouteParams<S>): string {
  return route.replace(/:(\w+)/g, (_, key: string) => encodeURIComponent((params as Record<string, string>)[key]));
}
assert.equal(buildUrl('/shop/:category/items/:id', { category: 'tea', id: '7' }), '/shop/tea/items/7');
// @ts-expect-error — нет id
buildUrl('/shop/:category/items/:id', { category: 'tea' });
assert.equal(buildUrl('/about', {}), '/about');

// 2. IsNever
type IsNeverNaive<T> = T extends never ? true : false;
type IsNever<T> = [T] extends [never] ? true : false;
ok<Equal<IsNeverNaive<never>, never>>();
ok<Equal<IsNever<never>, true>>();
ok<Equal<IsNever<string>, false>>();

// 3. деньги
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };
type Kopecks = Brand<number, 'Kopecks'>;
type Qty = Brand<number, 'Qty'>;
function kopecks(n: number): Kopecks {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('price must be a non-negative integer');
  return n as Kopecks;
}
const addMoney = (a: Kopecks, b: Kopecks) => (a + b) as Kopecks;
const lineTotal = (price: Kopecks, qty: Qty) => (price * qty) as Kopecks;
let total = kopecks(0);
total = addMoney(total, lineTotal(kopecks(490), 2 as Qty));
assert.equal(total, 980);
// @ts-expect-error — Qty не Kopecks
total = addMoney(total, 2 as Qty);
assert.throws(() => kopecks(-1), RangeError);
const raw = (total as number) + 1;
ok<Equal<typeof raw, number>>();
