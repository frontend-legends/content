// Глава 7.16 — JSON: что теряет stringify, toJSON у Date, BigInt и циклы бросают, replacer и reviver,
// большие целые теряют точность, доступ к исходному тексту в reviver (ES2026).
// run: node json.mjs
import assert from 'node:assert/strict';

const order = { id: 7, note: undefined, total: NaN, pay: () => {}, [Symbol('s')]: 1, at: new Date(Date.UTC(2026, 10, 15)), tags: new Set(['gift']) };
assert.equal(JSON.stringify(order), '{"id":7,"total":null,"at":"2026-11-15T00:00:00.000Z","tags":{}}');
assert.equal(JSON.stringify([undefined, () => {}]), '[null,null]');
assert.throws(() => JSON.stringify({ n: 1n }), { name: 'TypeError', message: /BigInt/ });
const loop = {}; loop.self = loop;
assert.throws(() => JSON.stringify(loop), { name: 'TypeError', message: /circular/ });

// toJSON, replacer, отступы
class Money { constructor(v) { this.kop = v; } toJSON() { return `${this.kop / 100} ₽`; } }
assert.equal(JSON.stringify({ price: new Money(249050) }), '{"price":"2490.5 ₽"}');
assert.equal(JSON.stringify({ a: 1, password: 'x' }, (k, v) => (k === 'password' ? undefined : v)), '{"a":1}');
assert.equal(JSON.stringify({ a: 1, b: 2 }, ['a']), '{"a":1}');
assert.equal(JSON.stringify({ a: [1] }, null, 2), '{\n  "a": [\n    1\n  ]\n}');

// reviver: даты обратно в Date
const parsed = JSON.parse('{"at":"2026-11-15T00:00:00.000Z"}', (k, v) => (k === 'at' ? new Date(v) : v));
assert.ok(parsed.at instanceof Date);

// большие целые теряют точность, а исходный текст в reviver позволяет её сохранить
assert.equal(JSON.parse('{"id":12345678901234567890}').id, 12345678901234567000);
const exact = JSON.parse('{"id":12345678901234567890}', (k, v, ctx) => (k === 'id' ? BigInt(ctx.source) : v));
assert.equal(exact.id, 12345678901234567890n);
console.log('ok');
