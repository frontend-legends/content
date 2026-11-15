// Глава 7.03 — копирование: spread поверхностный, structuredClone глубокий (Date, Map, циклы; функции и классы — нет),
// JSON теряет undefined, Date, NaN, Map.
// run: node copy.cjs
const assert = require('node:assert/strict');

const order = { id: 7, items: [{ sku: 'tea', qty: 1 }], createdAt: new Date(0), tags: new Map([['gift', true]]), note: undefined, score: NaN };

const shallow = { ...order };
shallow.items[0].qty = 5;
assert.equal(order.items[0].qty, 5); // вложенный массив общий
order.items[0].qty = 1;

const deep = structuredClone(order);
deep.items[0].qty = 9;
assert.equal(order.items[0].qty, 1);
assert.ok(deep.createdAt instanceof Date);
assert.ok(deep.tags instanceof Map);
assert.ok('note' in deep && Number.isNaN(deep.score));

// циклы — структурный клон их сохраняет
const node = { name: 'root' }; node.self = node;
const cloned = structuredClone(node);
assert.equal(cloned.self, cloned);

// функции не клонируются, экземпляр класса становится простым объектом
assert.throws(() => structuredClone({ fn() {} }), { name: 'DataCloneError' });
class Money { constructor(v) { this.v = v; } format() { return `${this.v} ₽`; } }
const m = structuredClone(new Money(10));
assert.equal(m instanceof Money, false);
assert.equal(m.format, undefined);
assert.equal(m.v, 10);

// JSON-копия теряет типы
const viaJson = JSON.parse(JSON.stringify(order));
assert.equal('note' in viaJson, false);
assert.equal(typeof viaJson.createdAt, 'string');
assert.equal(viaJson.score, null);
assert.deepEqual(viaJson.tags, {});
assert.throws(() => JSON.stringify(node), TypeError); // цикл
console.log('ok');
