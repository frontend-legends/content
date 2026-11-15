// types-only
// Глава 8.04 — практика: интерфейс и Record<string, unknown>, вывод типов из одного источника.

// 1. Почему не вызывается логирование
function track(event: string, params: Record<string, unknown>) { void event; void params; }
interface OrderI { id: number; total: number }
type OrderT = { id: number; total: number };
declare const oi: OrderI;
declare const ot: OrderT;
// @ts-expect-error — Index signature for type 'string' is missing in type 'OrderI'
track('checkout', oi);
track('checkout', ot);          // псевдоним подходит
track('checkout', { ...oi });   // копия-литерал подходит

function track2<T extends object>(event: string, params: T) { void event; void params; }
track2('checkout', oi);

// шаблонная индексная сигнатура
type DataAttrs = { [key: `data-${string}`]: string };
const attrs: DataAttrs = { 'data-id': '7' };
void attrs;
// @ts-expect-error — ключ без префикса не подходит
const badAttrs: DataAttrs = { id: '7' };
void badAttrs;

// 2. Типы из одного источника
const DELIVERY = {
  courier: { price: 300, days: 1 },
  pickup: { price: 0, days: 0 },
  post: { price: 200, days: 5 },
} as const satisfies Record<string, { price: number; days: number }>;

type DeliveryMethod = keyof typeof DELIVERY;
type DeliveryPrice = (typeof DELIVERY)[DeliveryMethod]['price'];

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const m: Equal<DeliveryMethod, 'courier' | 'pickup' | 'post'> = true;
const p: Equal<DeliveryPrice, 300 | 0 | 200> = true;
void m; void p;

function cost(method: DeliveryMethod): number {
  return DELIVERY[method].price;
}
cost('pickup');
// @ts-expect-error — такого способа нет
cost('drone');

// typeof без as const расширяет литералы
const defaults = { currency: 'RUB', retries: 3, features: ['cart', 'promo'] };
type Defaults = typeof defaults;
const d: Equal<Defaults, { currency: string; retries: number; features: string[] }> = true;
const f: Equal<Defaults['features'][number], string> = true;
void d; void f;
