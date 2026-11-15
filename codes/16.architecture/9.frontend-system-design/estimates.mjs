// Проверки к 16.09: «оценки на салфетке» для фронтенда.
// Бюджет кадра — арифметика; цена сетевых раунд-трипов — настоящий HTTP-сервер с задержкой;
// цена DOM-узлов и длинных задач — в Chromium (число узлов, время отрисовки, PerformanceObserver longtask).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { withPage } from '../../_lib/browser.mjs';

// --- бюджет кадра ---
const frame = (hz) => Math.round((1000 / hz) * 10) / 10;
assert.equal(frame(60), 16.7);
assert.equal(frame(120), 8.3);

// --- раунд-трипы: последовательные запросы складываются, параллельные — нет ---
const RTT = 80;
const server = createServer((req, res) => setTimeout(() => {
  if (req.url === '/page') { res.setHeader('content-type', 'text/html'); return res.end('<table><tbody id="t"></tbody></table>'); }
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ url: req.url, id: 7 }));
}, RTT));
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const get = (p) => fetch(base + p).then((r) => r.json());
const timed = async (fn) => { const t = performance.now(); await fn(); return performance.now() - t; };
await get('/warmup');

// водопад: каждый запрос ждёт предыдущий, хотя от него зависит только первый
const waterfall = await timed(async () => {
  const user = await get('/me');
  await get(`/users/${user.id}/orders`);
  await get(`/users/${user.id}/recommendations`);
  await get('/banners');
});
// по зависимостям: баннеры сразу, заказы и рекомендации — параллельно после пользователя
const byDeps = await timed(async () => {
  await Promise.all([
    get('/me').then((user) => Promise.all([get(`/users/${user.id}/orders`), get(`/users/${user.id}/recommendations`)])),
    get('/banners'),
  ]);
});
// один агрегирующий запрос (BFF)
const aggregated = await timed(() => get('/home'));
assert.ok(waterfall >= 4 * RTT && waterfall < 4 * RTT + 150, `waterfall ${waterfall}`);
assert.ok(byDeps >= 2 * RTT && byDeps < 3 * RTT, `byDeps ${byDeps}`);
assert.ok(aggregated >= RTT && aggregated < 2 * RTT, `aggregated ${aggregated}`);

// --- DOM-узлы и длинные задачи в браузере ---
await withPage(async (page) => {
  await page.goto(`${base}/page`);
  const render = (count) => page.evaluate((count) => {
    const body = document.getElementById('t');
    body.replaceChildren();
    const t = performance.now();
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const tr = document.createElement('tr');
      for (const v of [i, `Товар ${i}`, `${i * 10} ₽`, 'в наличии']) {
        const td = document.createElement('td');
        td.textContent = v;
        tr.append(td);
      }
      frag.append(tr);
    }
    body.append(frag);
    body.getBoundingClientRect();          // принудительная раскладка — часть цены отрисовки
    const ms = performance.now() - t;
    return { ms, elements: body.getElementsByTagName('*').length };
  }, count);

  const full = await render(10_000);
  const windowed = await render(30);      // видимое окно с запасом — так рисует виртуализация
  assert.equal(full.elements, 50_000);    // 10 000 строк × (tr + 4 td)
  assert.equal(windowed.elements, 150);
  assert.ok(full.ms > 10 * windowed.ms, `${full.ms} vs ${windowed.ms}`);
  assert.ok(full.ms > frame(60), `полный список ${full.ms} мс — больше кадра`);
  assert.ok(windowed.ms < frame(60), `окно ${windowed.ms} мс — укладывается в кадр`);

  // длинная задача: всё, что дольше 50 мс без перерыва, браузер отмечает как longtask
  const longtasks = (mode) => page.evaluate(async (mode) => {
    const found = [];
    const obs = new PerformanceObserver((list) => found.push(...list.getEntries().map((e) => e.duration)));
    obs.observe({ type: 'longtask' });
    const busy = (ms) => { const end = performance.now() + ms; while (performance.now() < end); };
    const task = (fn) => new Promise((r) => setTimeout(() => { fn(); r(); }, 0)); // отдельная задача цикла событий
    if (mode === 'single') await task(() => busy(150));
    else for (let i = 0; i < 15; i++) await task(() => busy(10)); // та же работа частями, между ними браузер свободен
    await new Promise((r) => setTimeout(r, 200));
    obs.disconnect();
    return found;
  }, mode);
  const single = await longtasks('single');
  const chunked = await longtasks('chunked');
  assert.equal(single.length, 1);
  assert.ok(single[0] >= 150, String(single[0]));
  assert.deepEqual(chunked, []);
});
server.close();

console.log('estimates ok');
