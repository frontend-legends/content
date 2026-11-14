// Глава 7.01 — раздел «Strict mode»: таблица отличий и практика «Что выведет?» (strict-вариант)
// run: node strict-mode.cjs
'use strict';
const assert = require('node:assert/strict');

function f() { return typeof this; }
console.log('strict f():', f(), '| f.call(5):', f.call(5));
assert.deepEqual([f(), f.call(5)], ['undefined', 'number']);
class Logger { log(m) { return this.prefix + m; } }
const { log } = new Logger();
try { log('x'); } catch (e) { console.log('class method extracted:', e.constructor.name, e.message); }
try { undeclared = 1; } catch (e) { console.log('undeclared:', e.constructor.name); }
try { Object.freeze({a:1}).a = 2; } catch (e) { console.log('frozen write:', e.constructor.name); }
function args(a) { a = 2; return arguments[0]; }
console.log('arguments linked? strict ->', args(1));
eval('var leaked = 1'); console.log('eval leaks var in strict?', typeof leaked);
