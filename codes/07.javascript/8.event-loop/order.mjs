// Глава 7.08 — порядок: синхронный код → все микрозадачи → одна задача; await — продолжение микрозадачей;
// process.nextTick раньше промисов; бесконечные микрозадачи не пускают таймеры.
// run: node order.mjs
import assert from 'node:assert/strict';
const tick = () => new Promise((r) => setTimeout(r, 20));

// классика
{
  const log = [];
  log.push('1 sync');
  setTimeout(() => log.push('5 timeout'), 0);
  Promise.resolve().then(() => log.push('3 microtask')).then(() => log.push('4 microtask 2'));
  queueMicrotask(() => log.push('3b queueMicrotask'));
  log.push('2 sync');
  await tick();
  assert.deepEqual(log, ['1 sync', '2 sync', '3 microtask', '3b queueMicrotask', '4 microtask 2', '5 timeout']);
}

// await: всё после await — микрозадача
{
  const log = [];
  async function addToCart() {
    log.push('a: до await');
    await null;
    log.push('c: после await');
  }
  addToCart();
  log.push('b: синхронный код дальше');
  await tick();
  assert.deepEqual(log, ['a: до await', 'b: синхронный код дальше', 'c: после await']);
}

// микрозадача, порождённая микрозадачей, выполняется до следующей задачи
{
  const log = [];
  setTimeout(() => log.push('timeout'), 0);
  Promise.resolve().then(() => { log.push('m1'); queueMicrotask(() => log.push('m1 → m2')); });
  await tick();
  assert.deepEqual(log, ['m1', 'm1 → m2', 'timeout']);
}

// голодание: пока очередь микрозадач не пуста, таймер не выполнится
{
  let timerAt = null; let spins = 0;
  const start = performance.now();
  setTimeout(() => { timerAt = performance.now() - start; }, 0);
  function spin() { if (performance.now() - start < 100) { spins++; queueMicrotask(spin); } }
  queueMicrotask(spin);
  await tick(); await tick();
  assert.ok(spins > 1000);
  assert.ok(timerAt >= 100, `таймер ждал микрозадачи: ${timerAt.toFixed(0)} мс`);
}


// практика: A F I C G H E B D
{
  const log = [];
  log.push('A');
  setTimeout(() => log.push('B'), 0);
  Promise.resolve().then(() => { log.push('C'); setTimeout(() => log.push('D'), 0); }).then(() => log.push('E'));
  (async () => { log.push('F'); await null; log.push('G'); })();
  queueMicrotask(() => log.push('H'));
  log.push('I');
  await tick();
  assert.deepEqual(log, ['A', 'F', 'I', 'C', 'G', 'H', 'E', 'B', 'D']);
}
console.log('ok');
