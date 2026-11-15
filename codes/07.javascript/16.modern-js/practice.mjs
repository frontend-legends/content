// Глава 7.16 — «Практика»: строка карточки заказа, следующий платёж через месяц на Date и Temporal.
// run: node practice.mjs
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';
const nb = (s) => s.replace(/[  ]/g, ' ');

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' });
const longDate = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: 'UTC' });
const plural = new Intl.PluralRules('ru-RU');
const goods = { one: 'товар', few: 'товара', many: 'товаров', other: 'товара' };
const orderSummary = ({ count, total, deliveryAt }) => `${count} ${goods[plural.select(count)]} на ${money.format(total)}, доставка ${longDate.format(new Date(deliveryAt))}`;
assert.equal(nb(orderSummary({ count: 3, total: 7470, deliveryAt: '2026-11-15' })), '3 товара на 7 470,00 ₽, доставка 15 ноября 2026 г.');
assert.equal(nb(orderSummary({ count: 21, total: 100, deliveryAt: '2026-11-15' })).split(' на ')[0], '21 товар');

function nextBad(start) { start.setMonth(start.getMonth() + 1); return start; }
const sub = { startedAt: new Date(2026, 0, 31) };
const bad = nextBad(sub.startedAt);
assert.deepEqual([bad.getMonth(), bad.getDate()], [2, 3]);
assert.equal(sub.startedAt.getMonth(), 2);              // исходная испорчена

function nextPayment(start) {
  const next = new Date(start);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}
const start = new Date(2026, 0, 31);
const ok = nextPayment(start);
assert.deepEqual([ok.getMonth(), ok.getDate(), start.getDate()], [1, 28, 31]);
assert.equal(Temporal.PlainDate.from('2026-01-31').add({ months: 1 }).toString(), '2026-02-28');
console.log('ok');
