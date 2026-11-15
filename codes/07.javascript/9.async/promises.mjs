// Глава 7.09 — промисы: исполнитель синхронный, состояние меняется один раз, then возвращает новый промис,
// ошибки идут по цепочке до catch, finally не меняет значение, thenable, комбинаторы, Promise.withResolvers.
// run: node promises.mjs
import assert from 'node:assert/strict';
const wait = (ms, v, fail) => new Promise((res, rej) => setTimeout(() => (fail ? rej(new Error(v)) : res(v)), ms));

// исполнитель выполняется сразу
const log = [];
const p = new Promise((resolve, reject) => { log.push('executor'); resolve(1); resolve(2); reject(new Error('x')); });
log.push('after new Promise');
assert.deepEqual(log, ['executor', 'after new Promise']);
assert.equal(await p, 1);                                   // первое решение окончательное
assert.equal(await new Promise(() => { throw new Error('boom'); }).catch((e) => e.message), 'boom');

// цепочка: значение, промис, ошибка; catch возвращает успешный промис
const chained = await Promise.resolve(1)
  .then((v) => v + 1)
  .then((v) => wait(5, v * 10))
  .then(() => { throw new Error('payment failed'); })
  .then(() => 'пропущено')
  .catch((e) => `поймано: ${e.message}`)
  .then((v) => `${v}, цепочка продолжается`);
assert.equal(chained, 'поймано: payment failed, цепочка продолжается');

// finally не видит значение и не меняет его, но ошибка в finally заменяет результат
assert.equal(await Promise.resolve('ok').finally(() => 'ignored'), 'ok');
await assert.rejects(Promise.resolve('ok').finally(() => { throw new Error('cleanup failed'); }), /cleanup failed/);

// await понимает любой thenable
assert.equal(await { then(resolve) { resolve('thenable'); } }, 'thenable');

// комбинаторы
assert.deepEqual(await Promise.all([wait(10, 'a'), wait(5, 'b')]), ['a', 'b']);   // порядок входа, не завершения
const settled = await Promise.allSettled([wait(5, 'ok'), wait(5, 'bad', true)]);
assert.deepEqual(settled.map((s) => s.status), ['fulfilled', 'rejected']);
assert.equal(await Promise.race([wait(10, 'slow'), wait(5, 'fast')]), 'fast');
assert.equal(await Promise.any([wait(5, 'x', true), wait(10, 'second ok')]), 'second ok');
await assert.rejects(Promise.any([wait(5, 'a', true), wait(5, 'b', true)]), (e) => e instanceof AggregateError && e.errors.length === 2);
assert.deepEqual(await Promise.all([]), []);

// all отклоняется на первой ошибке, но остальные операции продолжают выполняться
const sideEffects = [];
const job = (ms, name, fail) => wait(ms).then(() => { sideEffects.push(name); if (fail) throw new Error(name); return name; });
await assert.rejects(Promise.all([job(5, 'fails', true), job(30, 'still runs')]), /fails/);
assert.deepEqual(sideEffects, ['fails']);
await wait(40);
assert.deepEqual(sideEffects, ['fails', 'still runs']);

// withResolvers
const { promise, resolve } = Promise.withResolvers();
setTimeout(() => resolve('done'), 5);
assert.equal(await promise, 'done');
console.log('ok');
