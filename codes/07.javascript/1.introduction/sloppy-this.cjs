// Глава 7.01 «Введение в JavaScript» — раздел «Strict mode» и практика «Что выведет?» (sloppy-вариант)
// run: node sloppy-this.cjs   (CommonJS-файл = sloppy mode)
const assert = require('node:assert/strict');

function f() { return typeof this; }
console.log('sloppy f():', f(), '| f.call(5):', f.call(5));
assert.deepEqual([f(), f.call(5)], ['object', 'object']);
function args(a) { a = 2; return arguments[0]; }
console.log('arguments linked? sloppy ->', args(1));
eval('var leaked = 1'); console.log('eval leaks var in sloppy?', typeof leaked);
setTimeout(function () { console.log('node setTimeout this:', this && this.constructor && this.constructor.name); });
