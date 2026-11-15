// types-only
// Глава 8.02 — any, unknown, never, void, {} против object, литералы и расширение, as const, satisfies.

// any заразен: результат операций — тоже any, и он присваивается куда угодно
declare const fromAny: any;
const n: number = fromAny.deep.call();       // компилируется
// unknown нужно сузить
declare const fromUnknown: unknown;
// @ts-expect-error — 'fromUnknown' is of type 'unknown'
fromUnknown.toUpperCase();
if (typeof fromUnknown === 'string') fromUnknown.toUpperCase();
const anything: unknown = 42;                 // присвоить unknown можно что угодно
// @ts-expect-error — unknown нельзя присвоить конкретному типу
const s: string = anything;

// never: нижний тип — присваивается всему, ему — ничего
declare const nothing: never;
const fromNever: string = nothing;
// @ts-expect-error — number не присваивается never
const toNever: never = 1;
type Impossible = string & number;           // never
const imp: Impossible extends never ? true : false = true;

// {} — любое не-nullish значение, включая примитивы; object — только не-примитивы
const a: {} = 42;
const b: {} = 'строка';
// @ts-expect-error — null не подходит под {}
const c: {} = null;
// @ts-expect-error — примитив не подходит под object
const d: object = 42;
const e: object = { id: 1 };

// литералы: const сужает, let и свойства объекта расширяют
const status = 'paid';
let mutable = 'paid';
const order = { status: 'paid' };
function setStatus(s: 'paid' | 'shipped') { return s; }
setStatus(status);
// @ts-expect-error — string не подходит под 'paid' | 'shipped'
setStatus(mutable);
// @ts-expect-error — свойство расширилось до string
setStatus(order.status);
const frozen = { status: 'paid' } as const;
setStatus(frozen.status);
// @ts-expect-error — as const делает свойства readonly
frozen.status = 'shipped';

// union значений объекта через as const
const ORDER_STATUS = { Paid: 'paid', Shipped: 'shipped' } as const;
type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
const st: OrderStatus = 'shipped';
// @ts-expect-error
const bad: OrderStatus = 'lost';

// satisfies: проверяет, но не расширяет; аннотация — расширяет
type Route = { path: string; auth?: boolean };
const annotated: Record<string, Route> = { home: { path: '/' }, cart: { path: '/cart', auth: true } };
const checked = { home: { path: '/' }, cart: { path: '/cart', auth: true } } satisfies Record<string, Route>;
checked.cart.auth;                           // известно, что auth есть
// @ts-expect-error — после аннотации cart.auth — boolean | undefined: знание, что auth задан, потеряно
const authA: boolean = annotated.cart.auth;
// @ts-expect-error — satisfies всё равно проверяет форму
const wrongRoutes = { home: { url: '/' } } satisfies Record<string, Route>;

export { n, s, fromNever, toNever, imp, a, b, c, d, e, st, bad, authA, wrongRoutes };
