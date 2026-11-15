// Глава 7.10 — try/catch/finally: порядок, return в finally перекрывает и проглатывает ошибку;
// встроенные типы; бросок не-Error без стека; свои классы с cause; что try не ловит.
// run: node errors.mjs
import assert from 'node:assert/strict';

// finally выполняется всегда; return в finally перекрывает return из try и проглатывает исключение
function order() { const log = []; try { log.push('try'); return log; } finally { log.push('finally'); } }
assert.deepEqual(order(), ['try', 'finally']);
function overrides() { try { return 'try'; } finally { return 'finally'; } }
assert.equal(overrides(), 'finally');
function swallows() { try { throw new Error('потерялась'); } finally { return 'всё хорошо'; } }
assert.equal(swallows(), 'всё хорошо');
function replaced() { try { throw new Error('исходная'); } finally { throw new Error('из finally'); } }
assert.throws(replaced, /из finally/);

// встроенные типы
assert.throws(() => undefinedVariable, ReferenceError);
assert.throws(() => null.price, TypeError);
assert.throws(() => (42)(), TypeError);
assert.throws(() => JSON.parse('{price: 1}'), SyntaxError);
assert.throws(() => new Array(-1), RangeError);
assert.throws(() => (1).toFixed(101), RangeError);
assert.throws(() => decodeURIComponent('%'), URIError);

// бросить можно что угодно, но у не-Error нет стека
try { throw 'строка'; } catch (e) { assert.equal(typeof e, 'string'); assert.equal(e.stack, undefined); }
const err = new Error('с контекстом');
assert.match(err.stack, /^Error: с контекстом\n\s+at /);

// свои классы ошибок
class HttpError extends Error {
  constructor(status, url, options) {
    super(`HTTP ${status} для ${url}`, options);
    this.name = 'HttpError';
    this.status = status;
  }
}
class ValidationError extends Error {
  name = 'ValidationError';
  constructor(field, message) { super(message); this.field = field; }
}
const network = new TypeError('fetch failed');
const http = new HttpError(503, '/api/pay', { cause: network });
assert.ok(http instanceof HttpError && http instanceof Error);
assert.equal(http.name, 'HttpError');
assert.equal(http.cause, network);
assert.match(String(http), /^HttpError: HTTP 503 для \/api\/pay$/);
assert.match(http.stack, /^HttpError: HTTP 503/);
const v = new ValidationError('email', 'Неверный адрес');
assert.equal(v.field, 'email');
assert.equal(v.name, 'ValidationError');
assert.equal(Error.isError(http), true);
assert.equal(Error.isError({ name: 'Error', message: 'fake', stack: '' }), false);

// AggregateError собирает несколько ошибок
const agg = new AggregateError([new Error('a'), new Error('b')], 'все источники недоступны');
assert.equal(agg.errors.length, 2);

// try не ловит ошибку из колбэка таймера и отклонение без await
let caughtSync = false;
try { setTimeout(() => { /* бросок здесь уже вне try */ }, 0); } catch { caughtSync = true; }
const failing = () => Promise.reject(new Error('async fail'));
let caught = 'нет';
try { failing().catch(() => {}); } catch { caught = 'да'; }
assert.equal(caught, 'нет');
try { await failing(); } catch (e) { caught = e.message; }
assert.equal(caught, 'async fail');

// опциональный catch binding
let parsed;
try { parsed = JSON.parse('не json'); } catch { parsed = null; }
assert.equal(parsed, null);
console.log('ok');

// практика: что вернёт функция
{
  const logs = [];
  function a() { try { return 'try'; } finally { logs.push('finally a'); } }
  function b() { try { throw new Error('ошибка'); } finally { return 'finally b'; } }
  function c() { try { throw new Error('исходная'); } finally { throw new Error('из finally'); } }
  logs.push(a()); logs.push(b());
  try { c(); } catch (e) { logs.push(e.message); }
  assert.deepEqual(logs, ['finally a', 'try', 'finally b', 'из finally']);
}
