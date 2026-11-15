// Глава 7.16 — возможности редакций ES2020–ES2025, которые спрашивают: логическое присваивание короткое,
// replaceAll, at, Object.hasOwn, groupBy, withResolvers, RegExp.escape, Promise.try, именованные группы, флаг v.
// run: node editions.mjs
import assert from 'node:assert/strict';

// ??= ||= &&= не присваивают, если не нужно — сеттер не вызывается
let writes = 0;
const settings = { get theme() { return 'dark'; }, set theme(v) { writes++; } };
settings.theme ??= 'light';
settings.theme ||= 'light';
assert.equal(writes, 0);
const cart = { promo: null, items: [] };
cart.promo ??= 'NEW10';
cart.items.length &&= 0;
assert.deepEqual(cart, { promo: 'NEW10', items: [] });

assert.equal('a-b-c'.replaceAll('-', '+'), 'a+b+c');
assert.equal([1, 2, 3].at(-1), 3);
assert.equal(Object.hasOwn(Object.create({ inherited: 1 }), 'inherited'), false);
assert.equal(1_000_000, 1000000);

// именованные группы и индексы совпадений (флаг d)
const m = /(?<rub>\d+)\.(?<kop>\d{2})/d.exec('Итого 2490.50 ₽');
assert.deepEqual([m.groups.rub, m.groups.kop], ['2490', '50']);
assert.deepEqual(m.indices.groups.rub, [6, 10]);

// ES2024–ES2025
assert.equal(RegExp.escape('1+1=2?').length > '1+1=2?'.length, true);
assert.ok(new RegExp(RegExp.escape('цена (₽)')).test('цена (₽)'));
const result = await Promise.try(() => { throw new Error('синхронная ошибка стала отклонением'); }).catch((e) => e.message);
assert.equal(result, 'синхронная ошибка стала отклонением');
assert.ok(/[\p{L}--[a-z]]/v.test('я'));               // флаг v: разность множеств символов
assert.ok(!/[\p{L}--[a-z]]/v.test('q'));
assert.equal(new Float16Array([1.0001]).at(0), 1);   // половинная точность
console.log('ok');
