// Глава 7.16 — Temporal (через temporal-polyfill: в Node.js 24 Temporal ещё нет): неизменяемые даты,
// месяцы с 1, «только дата», часовые пояса, длительности, конец месяца без переполнения.
// run: node temporal.mjs
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';

const date = Temporal.PlainDate.from('2026-01-31');
const plusMonth = date.add({ months: 1 });
assert.equal(plusMonth.toString(), '2026-02-28');    // не «3 марта», как у Date
assert.equal(date.toString(), '2026-01-31');          // исходная не изменилась
assert.equal(date.month, 1);                          // месяцы с 1

const meeting = Temporal.ZonedDateTime.from({ timeZone: 'Europe/Moscow', year: 2026, month: 11, day: 15, hour: 15 });
assert.equal(meeting.withTimeZone('America/New_York').hour, 7);
assert.equal(Temporal.Duration.from({ hours: 2, minutes: 30 }).total('minutes'), 150);
const until = Temporal.PlainDate.from('2026-11-15').until('2026-12-31', { largestUnit: 'days' });
assert.equal(until.days, 46);
assert.throws(() => Temporal.PlainDate.from('15.11.2026'), RangeError);   // строгий ISO-разбор
console.log('ok');
