// Глава 7.08 — process.nextTick: из обычной задачи он выполняется раньше промисов,
// а из микрозадачи (в том числе после await и в ES-модуле) — после текущей очереди микрозадач.
// run: node nexttick.cjs
const assert = require('node:assert/strict');

const fromTask = [];
Promise.resolve().then(() => fromTask.push('promise'));
process.nextTick(() => fromTask.push('nextTick'));

setTimeout(() => {
  assert.deepEqual(fromTask, ['nextTick', 'promise']);
  const fromMicrotask = [];
  Promise.resolve().then(() => {
    Promise.resolve().then(() => fromMicrotask.push('promise'));
    process.nextTick(() => fromMicrotask.push('nextTick'));
  });
  setTimeout(() => {
    assert.deepEqual(fromMicrotask, ['promise', 'nextTick']);
    console.log('ok');
  }, 10);
}, 10);
