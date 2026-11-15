// Глава 7.08 — фазы цикла Node.js: внутри колбэка ввода-вывода setImmediate всегда раньше setTimeout(0);
// setTimeout(0) — это минимум 1 мс.
// run: node node-phases.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');

fs.readFile(__filename, () => {
  const log = [];
  setTimeout(() => log.push('timeout'), 0);
  setImmediate(() => log.push('immediate'));
  setTimeout(() => {
    assert.deepEqual(log, ['immediate', 'timeout']); // из фазы poll следующая — check
    const t = performance.now();
    setTimeout(() => {
      const waited = performance.now() - t;
      assert.ok(waited >= 1, `setTimeout(0) ждал ${waited.toFixed(2)} мс`);
      console.log('ok');
    }, 0);
  }, 10);
});
