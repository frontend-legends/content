// Глава 7.11 — ES-модули и CommonJS на настоящем Node.js: живые привязки против копии, импорт только для чтения,
// модуль выполняется один раз, циклы, top-level await задерживает импортёров, require(esm), JSON через атрибуты.
// run: node modules.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// живая привязка: импорт видит новое значение
const m = await import('./_fixtures/counter.mjs');
assert.equal(m.count, 0);
m.inc(); m.inc();
assert.equal(m.count, 2);
// CommonJS: деструктуризация — копия значения в момент require
const { count: copied } = require('./_fixtures/counter.cjs');
const cjs = require('./_fixtures/counter.cjs');
cjs.inc();
assert.equal(copied, 0);
assert.equal(cjs.live, 1);

// импорт только для чтения, пространство имён заморожено
assert.throws(() => { m.count = 10; }, TypeError);
assert.equal(Object.isFrozen(m), false);
assert.equal(Object.isSealed(m), true);

// модуль выполняется один раз, сколько бы его ни импортировали
const again = await import('./_fixtures/counter.mjs');
assert.equal(again, m);
assert.equal(globalThis.__loads, 1);

// this на верхнем уровне модуля — undefined
assert.equal(this, undefined);

// цикл в ESM: функции-объявления уже доступны, const — во временной мёртвой зоне
await import('./_fixtures/cycle-esm/a.mjs');
assert.deepEqual(globalThis.__cycle, { fnWorks: 'aFn', constError: 'ReferenceError' });
// цикл в CJS: второй модуль получает недосчитанный exports
const a = require('./_fixtures/cycle-cjs/a.cjs');
assert.equal(a.seen, 'a (до require b)');
assert.equal(a.a, 'a (готов)');

// top-level await: импортёр ждёт, пока модуль досчитается
globalThis.__order = [];
await import('./_fixtures/uses-slow.mjs');
assert.deepEqual(globalThis.__order, ['slow: before await', 'slow: after await', 'uses-slow: body sees /v1']);

// require ES-модуля работает, если в нём нет top-level await
assert.equal(require('./_fixtures/plain.mjs').plain, 'esm без await');
assert.equal(require('./_fixtures/plain.mjs').default, 'default export');
assert.throws(() => require('./_fixtures/tla.mjs'), { code: 'ERR_REQUIRE_ASYNC_MODULE' });

// JSON через атрибуты импорта
const { default: data } = await import('./_fixtures/data.json', { with: { type: 'json' } });
assert.equal(data.currency, '₽');
await assert.rejects(import('./_fixtures/data.json'), { code: 'ERR_IMPORT_ATTRIBUTE_MISSING' });
console.log('ok');
