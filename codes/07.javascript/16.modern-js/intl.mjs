// Глава 7.16 — Intl для русского языка: деньги, компактные числа, даты, относительное время, плюрализация
// (one/few/many), сортировка, графемы, списки. Строки содержат неразрывные пробелы.
// run: node intl.mjs
import assert from 'node:assert/strict';
const nb = (s) => s.replace(/[  ]/g, ' ');   // для читаемости сравнений

assert.equal(nb(new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(2490.5)), '2 490,50 ₽');
assert.equal(nb(new Intl.NumberFormat('ru-RU', { notation: 'compact' }).format(1_250_000)), '1,3 млн');
assert.equal(nb(new Intl.NumberFormat('ru-RU', { style: 'percent' }).format(0.15)), '15 %');
assert.equal(nb(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(2490.5)), '$2,490.50');

const date = new Date(Date.UTC(2026, 10, 15, 9, 30));
assert.equal(new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: 'UTC' }).format(date), '15 ноября 2026 г.');
assert.equal(new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(date), '12:30');

const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });
assert.deepEqual([rtf.format(-1, 'day'), rtf.format(2, 'hour'), rtf.format(-5, 'minute')], ['вчера', 'через 2 часа', '5 минут назад']);

const pr = new Intl.PluralRules('ru-RU');
assert.deepEqual([1, 2, 5, 21, 22, 25, 11, 1.5].map((n) => pr.select(n)), ['one', 'few', 'many', 'one', 'few', 'many', 'many', 'other']);
const forms = { one: 'товар', few: 'товара', many: 'товаров', other: 'товара' };
assert.deepEqual([1, 3, 11, 21].map((n) => `${n} ${forms[pr.select(n)]}`), ['1 товар', '3 товара', '11 товаров', '21 товар']);

// сортировка: по кодам «ё» и заглавные идут не туда
const names = ['ёж', 'Яна', 'еда', 'жук', 'Анна'];
assert.deepEqual([...names].sort(), ['Анна', 'Яна', 'еда', 'жук', 'ёж']);
assert.deepEqual([...names].sort(new Intl.Collator('ru').compare), ['Анна', 'еда', 'ёж', 'жук', 'Яна']);

// графемы: длина «как видит человек»
const word = 'е́ж'; // «е» с ударением как два кодовых пункта
assert.equal(word.length, 3);
assert.equal([...new Intl.Segmenter('ru', { granularity: 'grapheme' }).segment(word)].length, 2);

assert.equal(new Intl.ListFormat('ru', { type: 'conjunction' }).format(['чай', 'кофе', 'какао']), 'чай, кофе и какао');
console.log('ok');
