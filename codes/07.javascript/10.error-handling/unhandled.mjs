// Глава 7.10 — необработанные ошибки: в Node.js необработанное отклонение завершает процесс с кодом 1,
// исключение в колбэке таймера — тоже; обработчики process; в Chromium — событие unhandledrejection.
// run: node unhandled.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { withPage } from '../../_lib/browser.mjs';

const run = (code) => spawnSync(process.execPath, ['-e', code], { encoding: 'utf8' });

const rejection = run(`Promise.reject(new Error('payment failed')); setTimeout(() => console.log('не дожили'), 50);`);
assert.equal(rejection.status, 1);
assert.match(rejection.stderr, /payment failed/);
assert.equal(rejection.stdout, '');

const inTimer = run(`try { setTimeout(() => { throw new Error('in timer'); }, 0); } catch { console.log('caught'); }`);
assert.equal(inTimer.status, 1);
assert.equal(inTimer.stdout, '');
assert.match(inTimer.stderr, /in timer/);

const handled = run(`process.on('unhandledRejection', (r) => { console.log('logged:', r.message); });
  Promise.reject(new Error('x')); setTimeout(() => console.log('alive'), 20);`);
assert.equal(handled.status, 0);
assert.equal(handled.stdout.trim(), 'logged: x\nalive');

await withPage(async (page) => {
  const events = await page.evaluate(() => new Promise((resolve) => {
    const seen = [];
    window.addEventListener('unhandledrejection', (e) => { seen.push(`unhandled ${e.reason.message}`); e.preventDefault(); });
    window.addEventListener('rejectionhandled', () => { seen.push('handled later'); resolve(seen); });
    const p = Promise.reject(new Error('late'));
    setTimeout(() => p.catch(() => {}), 50);
  }));
  assert.deepEqual(events, ['unhandled late', 'handled later']);
});
console.log('ok');
