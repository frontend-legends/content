// Глава 8.06 — практика: pick, NoInfer для начального значения, метод против свойства-функции.
import assert from 'node:assert/strict';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
function expectType<T>(_v: T) { return <U>(ok: Equal<T, U>) => ok; }

// 1. pick
function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) result[key] = obj[key];
  return result;
}
const product = { id: 1, title: 'Чай', price: 490, stock: 12 };
const card = pick(product, ['title', 'price']);
expectType(card)<Pick<typeof product, 'title' | 'price'>>(true);
assert.deepEqual(card, { title: 'Чай', price: 490 });
// @ts-expect-error — 'color' нет среди ключей
pick(product, ['title', 'color']);

// 2. NoInfer
function useTabsLoose<T extends string>(tabs: T[], initial: T) {
  let active = initial;
  return { tabs, get active() { return active; }, select(t: T) { active = t; } };
}
const loose = useTabsLoose(['cart', 'favorites'], 'favourites');   // компилируется
loose.select('favourites');
assert.equal(loose.active, 'favourites');

function useTabs<T extends string>(tabs: T[], initial: NoInfer<T>) {
  let active = initial;
  return { tabs, get active() { return active; }, select(t: T) { active = t; } };
}
// @ts-expect-error — опечатка
useTabs(['cart', 'favorites'], 'favourites');
const t = useTabs(['cart', 'favorites'], 'cart');
// @ts-expect-error — нет такой вкладки
t.select('profile');
t.select('favorites');
assert.equal(t.active, 'favorites');

// 3. метод против свойства-функции
type Animal = { name: string };
type Dog = Animal & { bark(): void };
interface ListenerMethod { handle(a: Animal): void }
const lm: ListenerMethod = { handle: (d: Dog) => d.bark() };
assert.throws(() => lm.handle({ name: 'кот' }), TypeError);

interface ListenerProp { handle: (a: Animal) => void }
// @ts-expect-error — свойство-функция проверяется контравариантно
const lp: ListenerProp = { handle: (d: Dog) => d.bark() };
void lp;
