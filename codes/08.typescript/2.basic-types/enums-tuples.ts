// Глава 8.02 — enum и кортежи: числовой enum создаёт объект с обратным отображением, числа вне набора
// запрещены (TS 5+), строковый enum номинален; кортеж можно испортить через push; readonly-кортеж — нет.
import assert from 'node:assert/strict';

enum Status { Draft, Paid, Shipped }
assert.deepEqual(Object.keys(Status), ['0', '1', '2', 'Draft', 'Paid', 'Shipped']);   // в рантайме — объект
assert.equal(Status[1], 'Paid');                                                      // обратное отображение
// @ts-expect-error — 42 не входит в набор значений Status
const unknownStatus: Status = 42;

enum Currency { Rub = 'RUB', Usd = 'USD' }
// @ts-expect-error — строковый литерал не присваивается строковому enum
const cur: Currency = 'RUB';
const ok: Currency = Currency.Rub;
assert.equal(ok, 'RUB');

// кортеж: фиксированные позиции, но push разрешён
const pair: [number, string] = [7, 'Чайник'];
pair.push(8);                                          // компилируется
assert.equal(pair.length, 3);
const safe: readonly [number, string] = [7, 'Чайник'];
// @ts-expect-error — у readonly-кортежа нет push
safe.push(8);
// именованные элементы и необязательные позиции
type Range = [from: number, to?: number];
const r: Range = [1];
assert.equal(r.length, 1);
void unknownStatus; void cur;
console.log('ok');
