// types-only
// Глава 8.04 — объединения и пересечения, type против interface, индексные сигнатуры, keyof/typeof/индексный доступ,
// расширение глобальных типов.

// объединение: доступны только общие члены
type Card = { kind: 'card'; last4: string; pay(): void };
type Cash = { kind: 'cash'; change: number; pay(): void };
declare const method: Card | Cash;
method.pay();
method.kind;
// @ts-expect-error — last4 есть не у всех вариантов
method.last4;

// пересечение объединяет свойства; конфликт типов даёт never
type WithId = { id: number };
type WithTitle = { title: string };
const product: WithId & WithTitle = { id: 1, title: 'Чай' };
type Conflict = { id: string } & { id: number };
type ConflictId = Conflict['id'];                     // never
const neverId: ConflictId extends never ? true : false = true;
// @ts-expect-error — значения с id: never не существует
const impossible: Conflict = { id: 1 };

// interface: слияние объявлений; extends проверяет совместимость, & — молча даёт never
interface Settings { theme: string }
interface Settings { locale: string }
const settings: Settings = { theme: 'dark', locale: 'ru' };
// @ts-expect-error — без locale не подходит: объявления слились
const partial: Settings = { theme: 'dark' };
interface Base { id: string }
// @ts-expect-error — Interface 'Derived' incorrectly extends interface 'Base'
interface Derived extends Base { id: number }

// псевдоним типа совместим с Record<string, unknown>, интерфейс — нет (нет неявной индексной сигнатуры)
type ProductType = { id: number; title: string };
interface ProductInterface { id: number; title: string }
declare const t: ProductType;
declare const i: ProductInterface;
const r1: Record<string, unknown> = t;
// @ts-expect-error — Index signature for type 'string' is missing in type 'ProductInterface'
const r2: Record<string, unknown> = i;

// индексные сигнатуры и keyof
type PriceList = { [sku: string]: number };
type Keys = keyof PriceList;                          // string | number
const k1: Keys = 'tea';
const k2: Keys = 7;
type WithKnown = { [key: string]: number; total: number };
// @ts-expect-error — известное свойство должно подходить под индексную сигнатуру
type Broken = { [key: string]: number; title: string };

// typeof и индексный доступ
const config = { api: '/v1', retries: 3, features: ['cart', 'promo'] };
type Config = typeof config;
type Retries = Config['retries'];                    // number
type Feature = Config['features'][number];           // string
const f: Feature = 'cart';
const prices = [{ sku: 'tea', price: 490 }];
type PriceItem = (typeof prices)[number];
const pi: PriceItem = { sku: 'pot', price: 2490 };

// расширение глобального типа из модуля
declare global { interface Window { __APP_VERSION__: string } }
declare const win: Window;
const v: string = win.__APP_VERSION__;

export { product, neverId, impossible, settings, partial, r1, r2, k1, k2, f, pi, v };
export type { Retries, WithKnown, Broken, Derived };
