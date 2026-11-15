// Глава 8.05 — сужение типов: анализ потока управления, способы сужения, размеченные объединения,
// предикаты и утверждения, проверка полноты. Типы проверяет tsc, поведение — assert.
import assert from 'node:assert/strict';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
function expectType<T>(_v: T) { return <U>(ok: Equal<T, U>) => ok; }

// --- typeof, truthiness, равенство
function format(value: string | number | null) {
  if (value === null) return '—';
  expectType(value)<string | number>(true);
  if (typeof value === 'string') {
    expectType(value)<string>(true);
    return value.toUpperCase();
  }
  expectType(value)<number>(true);
  return value.toFixed(2);
}
assert.equal(format('a'), 'A');
assert.equal(format(1), '1.00');
assert.equal(format(null), '—');

// truthiness отсекает 0 и ''
function label(count: number | undefined) {
  return count ? `${count} шт.` : 'нет';
}
assert.equal(label(0), 'нет');   // 0 — допустимое значение потерялось

// --- typeof null
assert.equal(typeof null, 'object');
function len(v: string[] | null) {
  if (typeof v === 'object') {
    expectType(v)<string[] | null>(true);   // null остался
  }
  return v?.length ?? 0;
}
assert.equal(len(null), 0);

// --- in с отсутствующим в типе свойством (TS 4.9)
function hasId(x: object) {
  if ('id' in x) {
    expectType(x)<object & Record<'id', unknown>>(true);
    return true;
  }
  return false;
}
assert.equal(hasId({ id: 1 }), true);

// --- instanceof, Array.isArray
function toDate(v: string | Date) {
  return v instanceof Date ? v : new Date(v);
}
assert.ok(toDate('2026-11-15') instanceof Date);
function first(v: string | string[]) {
  return Array.isArray(v) ? v[0] : v;
}
assert.equal(first(['a']), 'a');

// --- сохранённое условие (aliased condition, TS 4.4)
function aliased(v: unknown) {
  const isString = typeof v === 'string';
  if (isString) {
    expectType(v)<string>(true);
    return v.length;
  }
  return 0;
}
assert.equal(aliased('abc'), 3);

// --- размеченное объединение и деструктуризация (TS 4.6)
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: string[] }
  | { status: 'error'; error: Error };

function render(state: State): string {
  switch (state.status) {
    case 'idle': return '';
    case 'loading': return '...';
    case 'success': return state.data.join(', ');
    case 'error': return state.error.message;
    default: {
      expectType(state)<never>(true);
      return state satisfies never;
    }
  }
}
assert.equal(render({ status: 'success', data: ['a', 'b'] }), 'a, b');

type Action = { type: 'add'; payload: number } | { type: 'reset'; payload: null };
function reduce(n: number, { type, payload }: Action) {
  if (type === 'add') {
    expectType(payload)<number>(true);
    return n + payload;
  }
  return 0;
}
assert.equal(reduce(1, { type: 'add', payload: 2 }), 3);

// проверка полноты ловит новый вариант
type Shape = { kind: 'circle'; r: number } | { kind: 'square'; side: number } | { kind: 'rect'; w: number; h: number };
function assertNever(value: never): never {
  throw new Error(`Unexpected: ${JSON.stringify(value)}`);
}
function area(s: Shape): number {
  switch (s.kind) {
    case 'circle': return Math.PI * s.r ** 2;
    case 'square': return s.side ** 2;
    // @ts-expect-error — rect не обработан: Argument of type '{ kind: "rect"; ... }' is not assignable to 'never'
    default: return assertNever(s);
  }
}
assert.throws(() => area({ kind: 'rect', w: 1, h: 2 } as Shape), /Unexpected/);

// switch (true) (TS 5.3)
function grade(v: string | number) {
  switch (true) {
    case typeof v === 'string': return v.length;
    default: expectType(v)<number>(true); return v;
  }
}
assert.equal(grade('ab'), 2);
assert.equal(grade(5), 5);

// --- пользовательский предикат: компилятор верит на слово
type User = { id: number; name: string };
function isUserLie(x: unknown): x is User {
  return typeof x === 'object' && x !== null;   // проверка неполная
}
const raw: unknown = { id: 1 };
if (isUserLie(raw)) {
  assert.throws(() => raw.name.toUpperCase(), TypeError);   // тип говорит string, а там undefined
}

// --- выведенные предикаты (TS 5.5)
const ids = [1, undefined, 3].filter((x) => x !== undefined);
expectType(ids)<number[]>(true);
assert.deepEqual(ids, [1, 3]);
const isDefined = (x: number | undefined) => x !== undefined;
expectType(isDefined)<(x: number | undefined) => x is number>(true);
// truthiness предикат не выводит: 0 тоже отсекается, и для number «ложь» не значит undefined
const truthy = [1, 0, undefined].filter((x) => !!x);
expectType(truthy)<(number | undefined)[]>(true);
assert.deepEqual(truthy, [1]);

// --- функции-утверждения
function assertDefined<T>(v: T, msg = 'value is required'): asserts v is NonNullable<T> {
  if (v === null || v === undefined) throw new Error(msg);
}
function useOrderId(id: string | null) {
  assertDefined(id, 'orderId required');
  expectType(id)<string>(true);
  return id.toUpperCase();
}
assert.equal(useOrderId('a1'), 'A1');
assert.throws(() => useOrderId(null), /orderId required/);

// стрелочная функция-утверждение требует явной аннотации у имени
const assertStrArrow = (v: unknown): asserts v is string => {
  if (typeof v !== 'string') throw new TypeError('not a string');
};
function callArrow(v: unknown) {
  // @ts-expect-error — TS2775: Assertions require every name in the call target to be declared with an explicit type annotation
  assertStrArrow(v);
}
const assertStr: (v: unknown) => asserts v is string = assertStrArrow;
function callTyped(v: unknown) {
  assertStr(v);
  return v.length;
}
assert.equal(callTyped('abc'), 3);
void callArrow;

// --- catch: unknown под strict
try { JSON.parse('{'); } catch (e) {
  expectType(e)<unknown>(true);
  assert.ok(e instanceof SyntaxError);
}

// --- сужение в замыканиях: let теряет, const и let после последнего присваивания (TS 5.4) сохраняют
function closures(input: string | undefined) {
  let a = input;
  if (a === undefined) a = 'default';
  // после последнего присваивания сужение сохраняется и в колбэке (TS 5.4)
  const f = () => a.toUpperCase();

  let b = input;
  if (b === undefined) return f();
  const g = () => {
    // @ts-expect-error — b ещё переприсваивается ниже, сужение в колбэке потеряно
    return b.toUpperCase();
  };
  b = input;
  return g();
}
assert.equal(closures(undefined), 'DEFAULT');

// --- сужение свойств не сбрасывается после вызова функции (нестрогость)
type Cart = { coupon: string | null };
const cart: Cart = { coupon: 'SALE' };
function clearCoupon() { cart.coupon = null; }
function applyCoupon(c: Cart) {
  if (c.coupon !== null) {
    clearCoupon();
    expectType(c.coupon)<string>(true);   // компилятор не знает, что вызов поменял свойство
    return c.coupon.toUpperCase();
  }
  return '';
}
assert.throws(() => applyCoupon(cart), TypeError);
