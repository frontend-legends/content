// Глава 7.11 — «Практика»: живая привязка против CommonJS, ReferenceError в цикле.
// run: node practice.mjs
import assert from 'node:assert/strict';
await import('./_fixtures/p1/main.mjs');
assert.deepEqual(globalThis.__p1, [2, 0, 'TypeError']);
await assert.rejects(import('./_fixtures/p2/price.js'), { name: 'ReferenceError', message: "Cannot access 'DEFAULT_CURRENCY' before initialization" });
console.log('ok');
