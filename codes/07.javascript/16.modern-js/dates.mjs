// Глава 7.16 — ловушки Date: месяцы с нуля, переполнение, строка без времени — UTC, с временем — локально,
// Date изменяемый.
// run: TZ=Europe/Moscow node dates.mjs (run.mjs запускает без TZ — проверки не зависят от пояса, кроме помеченных)
import assert from 'node:assert/strict';

const d = new Date(2026, 0, 31);          // 31 января: месяцы с нуля
assert.equal(d.getMonth(), 0);
d.setMonth(1);                            // «31 февраля» → переполнение в март
assert.equal(d.getMonth(), 2);
assert.equal(d.getDate(), 3);

// строка только с датой — UTC, с временем без зоны — локальное время
assert.equal(new Date('2026-11-15').toISOString(), '2026-11-15T00:00:00.000Z');
const local = new Date('2026-11-15T00:00');
assert.equal(local.getHours(), 0);        // полночь по местному времени, а в UTC — сдвиг на пояс
assert.equal(local.getTime() - new Date('2026-11-15').getTime(), local.getTimezoneOffset() * 60_000);

// Date изменяемый: функция, которая «прибавляет день», портит исходную дату
function addDayBad(date) { date.setDate(date.getDate() + 1); return date; }
const deadline = new Date(2026, 10, 15);
const next = addDayBad(deadline);
assert.equal(next, deadline);
assert.equal(deadline.getDate(), 16);
function addDay(date) { const copy = new Date(date); copy.setDate(copy.getDate() + 1); return copy; }
const fresh = new Date(2026, 10, 15);
assert.equal(addDay(fresh).getDate(), 16);
assert.equal(fresh.getDate(), 15);

assert.equal(typeof globalThis.Temporal, 'undefined'); // в Node.js 24 Temporal пока нет
console.log('ok');
