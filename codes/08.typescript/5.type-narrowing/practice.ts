// Глава 8.05 — практика: состояние загрузки, врущий предикат, фильтр с сохранением типа.
import assert from 'node:assert/strict';
import { z } from 'zod';

type Product = { id: number; title: string; discount: number | null };

// 1. Размеченное состояние и проверка полноты
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: Product[] }
  | { status: 'error'; error: string };

function assertNever(value: never): never {
  throw new Error(`Unexpected state: ${JSON.stringify(value)}`);
}
function render(state: State): string {
  switch (state.status) {
    case 'idle': return '';
    case 'loading': return 'Загрузка...';
    case 'success': return state.data.map((p) => p.title).join(', ');
    case 'error': return `Ошибка: ${state.error}`;
    default: return assertNever(state);
  }
}
assert.equal(render({ status: 'success', data: [{ id: 1, title: 'Чай', discount: null }] }), 'Чай');
assert.throws(() => render({ status: 'empty' } as unknown as State), /Unexpected state/);

type State2 = State | { status: 'empty' };
function render2(state: State2): string {
  switch (state.status) {
    case 'idle': return '';
    case 'loading': return '';
    case 'success': return '';
    case 'error': return '';
    // @ts-expect-error — вариант empty не обработан
    default: return assertNever(state);
  }
}
void render2;

// невозможная комбинация больше не выражается
// @ts-expect-error — loading и error одновременно
const impossible: State = { status: 'loading', error: 'x' };
void impossible;

// 2. Врущий и полный предикат
type User = { id: number; name: string };
function isUserLie(x: unknown): x is User {
  return typeof x === 'object' && x !== null;
}
function isUser(x: unknown): x is User {
  return (
    typeof x === 'object' && x !== null &&
    'id' in x && typeof x.id === 'number' &&
    'name' in x && typeof x.name === 'string'
  );
}
const data: unknown = JSON.parse('{"id":1}');
if (isUserLie(data)) assert.throws(() => data.name.toUpperCase(), TypeError);
assert.equal(isUser(data), false);
assert.equal(isUser({ id: 1, name: 'Аня' }), true);

const UserSchema = z.object({ id: z.number(), name: z.string() });
type UserZ = z.infer<typeof UserSchema>;
const u: UserZ = UserSchema.parse({ id: 2, name: 'Оля' });
assert.equal(u.name, 'Оля');
assert.throws(() => UserSchema.parse(data));

// 3. Фильтр по свойству
const products: Product[] = [
  { id: 1, title: 'Чай', discount: 0.1 },
  { id: 2, title: 'Кофе', discount: null },
];
const plain = products.filter((p) => p.discount !== null);
// @ts-expect-error — 'p.discount' is possibly 'null': предикат по свойству не выводится
plain.map((p) => p.discount * 100);

type Discounted = Product & { discount: number };
const discounted = products.filter((p): p is Discounted => p.discount !== null);
assert.deepEqual(discounted.map((p) => p.discount * 100), [10]);

const percents = products.flatMap((p) => (p.discount === null ? [] : [p.discount * 100]));
const check: number[] = percents;
assert.deepEqual(check, [10]);
