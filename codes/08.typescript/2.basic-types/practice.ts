// Глава 8.02 — «Практика»: расширение свойства и три способа починить; замена enum на as const.
import assert from 'node:assert/strict';
type OrderStatus = 'draft' | 'paid' | 'shipped';
function setStatus(status: OrderStatus) { return status; }

const widened = { status: 'paid', currency: 'RUB' };
// @ts-expect-error — status расширился до string
setStatus(widened.status);
const viaSatisfies = { status: 'paid', currency: 'RUB' } satisfies { status: OrderStatus; currency: string };
const viaConst = { status: 'paid', currency: 'RUB' } as const;
assert.equal(setStatus(viaSatisfies.status), 'paid');
assert.equal(setStatus(viaConst.status), 'paid');
// @ts-expect-error — satisfies ловит опечатку в значении
const typo = { status: 'piad', currency: 'RUB' } satisfies { status: OrderStatus; currency: string };

const PaymentMethod = { Card: 'card', Sbp: 'sbp', Cash: 'cash' } as const;
type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];
function pay(method: PaymentMethod) { return method; }
assert.equal(pay(PaymentMethod.Sbp), 'sbp');
assert.equal(pay('cash'), 'cash');
function isPaymentMethod(value: string): value is PaymentMethod {
  return (Object.values(PaymentMethod) as string[]).includes(value);
}
const response = { method: 'card' as string };
// @ts-expect-error — string без проверки не подходит
pay(response.method);
if (isPaymentMethod(response.method)) assert.equal(pay(response.method), 'card');
void typo;
console.log('ok');
