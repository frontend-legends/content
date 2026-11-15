// Глава 7.15 — Performance API: performance.now монотонный, mark/measure, PerformanceObserver;
// в Chromium — наблюдение долгих задач (longtask) для задачи на 120 мс.
// run: node performance.mjs
import assert from 'node:assert/strict';
import { PerformanceObserver, performance } from 'node:perf_hooks';
import { withPage } from '../../_lib/browser.mjs';

const seen = [];
const obs = new PerformanceObserver((list) => seen.push(...list.getEntries().map((e) => e.name)));
obs.observe({ entryTypes: ['measure'] });
performance.mark('filter:start');
const items = Array.from({ length: 2e5 }, (_, i) => ({ price: i % 5000 }));
const cheap = items.filter((i) => i.price < 500);
performance.mark('filter:end');
const m = performance.measure('filter', 'filter:start', 'filter:end');
assert.ok(m.duration > 0 && cheap.length > 0);
await new Promise((r) => setTimeout(r, 10));
assert.deepEqual(seen, ['filter']);
obs.disconnect();
// now монотонный и дробный
const a = performance.now(); const b = performance.now();
assert.ok(b >= a);

await withPage(async (page) => {
  await page.setContent('<p>dashboard</p>');
  const tasks = await page.evaluate(() => new Promise((resolve) => {
    const found = [];
    new PerformanceObserver((list) => { for (const e of list.getEntries()) found.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true });
    setTimeout(() => { const end = performance.now() + 120; while (performance.now() < end); }, 0);
    setTimeout(() => { const end = performance.now() + 20; while (performance.now() < end); }, 200);
    setTimeout(() => resolve(found), 500);
  }));
  assert.ok(tasks.some((d) => d >= 110), `долгие задачи: ${tasks}`);
  assert.ok(tasks.every((d) => d > 50));          // задача на 20 мс в список не попала
});
console.log('ok');
