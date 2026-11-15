// Глава 7.08 — браузерный цикл в настоящем Chromium: вложенные setTimeout(0) после 5 уровней ждут ≥ 4 мс;
// rAF выполняется перед отрисовкой, один раз за кадр; микрозадачи между слушателями при настоящем клике
// и после всех слушателей при el.click(); долгая задача задерживает обработку клика.
// run: node browser.mjs
import assert from 'node:assert/strict';
import { withPage } from '../../_lib/browser.mjs';

await withPage(async (page) => {
  await page.setContent('<button id="buy">Купить</button>');

  // ограничение вложенных таймеров
  const gaps = await page.evaluate(() => new Promise((resolve) => {
    const gaps = []; let last = performance.now(); let depth = 0;
    function next() {
      const now = performance.now(); gaps.push(now - last); last = now;
      if (++depth < 10) setTimeout(next, 0); else resolve(gaps);
    }
    setTimeout(next, 0);
  }));
  const early = gaps.slice(1, 4); const late = gaps.slice(6);
  assert.ok(late.every((g) => g >= 3.9), `глубокие уровни ≥ 4 мс: ${late.map((g) => g.toFixed(1))}`);
  assert.ok(early.some((g) => g < 2), `первые уровни быстрее: ${early.map((g) => g.toFixed(1))}`);

  // rAF: один раз за кадр, перед отрисовкой; десять setTimeout(0) успевают раньше rAF
  const frame = await page.evaluate(() => new Promise((resolve) => {
    const log = []; let timeouts = 0;
    for (let i = 0; i < 10; i++) setTimeout(() => timeouts++, 0);
    requestAnimationFrame(() => { log.push(`raf after ${timeouts} timeouts`); requestAnimationFrame((t2) => resolve(log)); });
  }));
  assert.match(frame[0], /^raf after \d+ timeouts$/);

  // клик пользователя против el.click(): где выполняются микрозадачи
  const attach = () => page.evaluate(() => {
    window.__log = [];
    const btn = document.getElementById('buy');
    window.__l1 = () => { Promise.resolve().then(() => window.__log.push('micro 1')); window.__log.push('listener 1'); };
    window.__l2 = () => { Promise.resolve().then(() => window.__log.push('micro 2')); window.__log.push('listener 2'); };
    btn.addEventListener('click', window.__l1); btn.addEventListener('click', window.__l2);
  });
  const detach = () => page.evaluate(() => {
    const btn = document.getElementById('buy');
    btn.removeEventListener('click', window.__l1); btn.removeEventListener('click', window.__l2);
    return window.__log;
  });
  await attach();
  await page.click('#buy');                       // настоящий клик мышью
  await page.waitForTimeout(30);
  const user = await detach();
  await attach();
  await page.evaluate(() => document.getElementById('buy').click()); // клик из скрипта
  await page.waitForTimeout(30);
  const scripted = await detach();
  assert.deepEqual(user, ['listener 1', 'micro 1', 'listener 2', 'micro 2']);
  assert.deepEqual(scripted, ['listener 1', 'listener 2', 'micro 1', 'micro 2']);

  // долгая задача: клик обработается только после неё
  const delay = await page.evaluate(() => new Promise((resolve) => {
    const btn = document.getElementById('buy');
    let clickedAt;
    btn.addEventListener('click', () => resolve(performance.now() - clickedAt), { once: true });
    setTimeout(() => { clickedAt = performance.now(); btn.dispatchEvent(new MouseEvent('click')); }, 0);
  }));
  assert.ok(delay < 50);
  const blocked = await page.evaluate(() => new Promise((resolve) => {
    const btn = document.getElementById('buy');
    let queuedAt;
    btn.addEventListener('click', () => resolve(performance.now() - queuedAt), { once: true });
    setTimeout(() => { queuedAt = performance.now(); setTimeout(() => btn.click(), 0); const end = performance.now() + 200; while (performance.now() < end); }, 0);
  }));
  assert.ok(blocked >= 200, `клик ждал долгую задачу ${blocked.toFixed(0)} мс`);
});
console.log('ok');
