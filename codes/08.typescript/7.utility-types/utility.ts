// Глава 8.07 — утилитарные типы: что делают и где подводят.
import assert from 'node:assert/strict';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const ok = <T extends true>() => {};

type Product = { id: number; title: string; price: number; tags?: string[]; meta: { color: string } };

// --- Partial: поверхностный
type Patch = Partial<Product>;
const p1: Patch = { price: 100 };
// @ts-expect-error — meta.color по-прежнему обязателен: Partial не рекурсивен
const p2: Patch = { meta: {} };
void p1; void p2;

// Partial разрешает явный undefined — при слиянии он затирает значение
const product: Product = { id: 1, title: 'Чай', price: 490, meta: { color: 'green' } };
const patch: Partial<Product> = { title: undefined };
const merged = { ...product, ...patch };
ok<Equal<typeof merged.title, string>>();   // по типу — string
assert.equal(merged.title, undefined);     // а в рантайме undefined
// с exactOptionalPropertyTypes явный undefined в Partial запрещён — см. 8.09

// --- Required снимает ? и undefined из необязательного поля
type R = Required<{ a?: string }>;
ok<Equal<R, { a: string }>>();

// --- Readonly поверхностный
const frozen: Readonly<Product> = product;
// @ts-expect-error — Cannot assign to 'price' because it is a read-only property
frozen.price = 1;
frozen.meta.color = 'red';   // вложенное — можно
assert.equal(product.meta.color, 'red');
const fz = Object.freeze({ a: 1 });
ok<Equal<typeof fz, Readonly<{ a: 1 }>>>();

// --- Pick и Omit
type Card = Pick<Product, 'title' | 'price'>;
ok<Equal<Card, { title: string; price: number }>>();
// @ts-expect-error — Pick проверяет ключи
type BadPick = Pick<Product, 'colour'>;
// Omit ключи не проверяет: опечатка молча ничего не убирает
type NoId = Omit<Product, 'idd'>;
ok<Equal<NoId['id'], number>>();
type StrictOmit<T, K extends keyof T> = Omit<T, K>;
// @ts-expect-error — строгий вариант ловит опечатку
type NoId2 = StrictOmit<Product, 'idd'>;

// Omit на объединении теряет дискриминант
type Shape = { kind: 'circle'; r: number; id: string } | { kind: 'square'; side: number; id: string };
type ShapeNoId = Omit<Shape, 'id'>;
ok<Equal<keyof ShapeNoId, 'kind'>>();   // остались только общие ключи
const s = {} as ShapeNoId;
// @ts-expect-error — r пропал: keyof объединения — только общие ключи
s.r;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type ShapeNoId2 = DistributiveOmit<Shape, 'id'>;
const c: ShapeNoId2 = { kind: 'circle', r: 1 };
if (c.kind === 'circle') assert.equal(c.r, 1);

// --- Record
type Stock = Record<'tea' | 'pot', number>;
// @ts-expect-error — Property 'pot' is missing
const st: Stock = { tea: 1 };
void st;
const dict: Record<string, number> = {};
const v = dict.missing;
ok<Equal<typeof v, number>>();   // без noUncheckedIndexedAccess undefined не учтён
assert.equal(v, undefined);

// --- объединения: Exclude, Extract, NonNullable
type Status = 'idle' | 'loading' | 'success' | 'error';
ok<Equal<Exclude<Status, 'idle'>, 'loading' | 'success' | 'error'>>();
ok<Equal<Extract<Status | 404, string>, Status>>();
ok<Equal<Extract<Shape, { kind: 'circle' }>, { kind: 'circle'; r: number; id: string }>>();
ok<Equal<NonNullable<string | null | undefined>, string>>();
type MaybeT<T> = NonNullable<T>;
ok<Equal<MaybeT<number | null>, number>>();

// --- функции
function createOrder(userId: number, items: string[], promo?: string) { return { id: 1, userId, items, promo }; }
ok<Equal<Parameters<typeof createOrder>, [userId: number, items: string[], promo?: string]>>();
ok<Equal<Parameters<typeof createOrder>[1], string[]>>();
ok<Equal<ReturnType<typeof createOrder>, { id: number; userId: number; items: string[]; promo: string | undefined }>>();

// перегрузки: берётся последняя
function parse(v: string): number;
function parse(v: number): string;
function parse(v: string | number) { return typeof v === 'string' ? Number(v) : String(v); }
ok<Equal<ReturnType<typeof parse>, string>>();
ok<Equal<Parameters<typeof parse>, [v: number]>>();

// async
async function loadUser() { return { id: 1, name: 'Аня' }; }
ok<Equal<ReturnType<typeof loadUser>, Promise<{ id: number; name: string }>>>();
ok<Equal<Awaited<ReturnType<typeof loadUser>>, { id: number; name: string }>>();
ok<Equal<Awaited<Promise<Promise<number>>>, number>>();

// классы
class ApiClient { constructor(public baseUrl: string, public timeout = 5000) {} }
ok<Equal<ConstructorParameters<typeof ApiClient>, [baseUrl: string, timeout?: number]>>();
ok<Equal<InstanceType<typeof ApiClient>, ApiClient>>();

// --- строки
ok<Equal<Uppercase<'get'>, 'GET'>>();
ok<Equal<Capitalize<'click'>, 'Click'>>();
ok<Equal<`on${Capitalize<'click' | 'focus'>}`, 'onClick' | 'onFocus'>>();

// --- комбинации
type CreateProduct = Omit<Product, 'id'>;
type UpdateProduct = Partial<Omit<Product, 'id'>> & Pick<Product, 'id'>;
const u: UpdateProduct = { id: 1, price: 10 };
// @ts-expect-error — id обязателен
const u2: UpdateProduct = { price: 10 };
void u; void u2;
const cp: CreateProduct = { title: 'x', price: 1, meta: { color: 'b' } };
void cp;

// реализация Pick и Partial — mapped-типы
type MyPick<T, K extends keyof T> = { [P in K]: T[P] };
type MyPartial<T> = { [P in keyof T]?: T[P] };
type MyExclude<T, U> = T extends U ? never : T;
ok<Equal<MyPick<Product, 'id'>, Pick<Product, 'id'>>>();
ok<Equal<MyPartial<Card>, Partial<Card>>>();
ok<Equal<MyExclude<Status, 'idle'>, Exclude<Status, 'idle'>>>();
