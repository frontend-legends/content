// Проверки к 17.11: в Chromium — длинная задача против дроблёной (PerformanceObserver longtask),
// layout thrashing против батчинга чтений и записей, content-visibility пропускает отрисовку вне экрана;
// в Node на виртуальных часах — debounce и throttle, снятие подписки через AbortController против утечки.
import assert from 'node:assert/strict';
import { withPage } from '../../_lib/browser.mjs';

await withPage(async (page) => {
  // --- длинная задача блокирует, та же работа кусками с уступкой — нет ---
  const longtasks = (mode) => page.evaluate(async (mode) => {
    const found = [];
    const obs = new PerformanceObserver((l) => found.push(...l.getEntries().map((e) => Math.round(e.duration))));
    obs.observe({ type: 'longtask' });
    const busy = (ms) => { const end = performance.now() + ms; while (performance.now() < end); };
    const task = (fn) => new Promise((r) => setTimeout(() => { fn(); r(); }, 0)); // отдельная задача цикла событий
    if (mode === 'block') await task(() => busy(150));
    else for (let i = 0; i < 15; i++) await task(() => busy(10)); // та же работа, но поток уступается между кусками
    await new Promise((r) => setTimeout(r, 200));
    obs.disconnect();
    return found;
  }, mode);
  const blocked = await longtasks('block');
  const yielded = await longtasks('yield');
  assert.equal(blocked.length, 1);
  assert.ok(blocked[0] >= 150, String(blocked[0]));
  assert.deepEqual(yielded, []);

  // --- layout thrashing: чтение после каждой записи заставляет пересчитывать геометрию синхронно ---
  const thrash = await page.evaluate(() => {
    const root = document.getElementById('root') || document.body.appendChild(document.createElement('div'));
    root.id = 'root'; root.innerHTML = '';
    const els = Array.from({ length: 800 }, () => { const d = document.createElement('div'); d.textContent = 'x'; d.style.padding = '2px'; root.append(d); return d; });
    const clear = () => { els.forEach((el) => { el.style.width = ''; }); void root.offsetWidth; };
    const results = [];
    clear();
    let t = performance.now();
    els.forEach((el) => { el.style.width = el.offsetWidth + 1 + 'px'; }); // запись, затем чтение offsetWidth на следующей итерации
    results.push(+(performance.now() - t).toFixed(1));
    clear();
    t = performance.now();
    const widths = els.map((el) => el.offsetWidth);                       // сначала все чтения
    els.forEach((el, i) => { el.style.width = widths[i] + 1 + 'px'; });    // потом все записи
    results.push(+(performance.now() - t).toFixed(1));
    return { thrash: results[0], batched: results[1] };
  });
  assert.ok(thrash.thrash > thrash.batched * 8, `thrashing ${thrash.thrash} мс против батчинга ${thrash.batched} мс`);

  // --- content-visibility: auto пропускает раскладку и отрисовку секций вне экрана ---
  const renderList = (cv) => page.evaluate(async (cv) => {
    document.head.innerHTML = `<style>.s{height:400px}${cv ? '.s{content-visibility:auto;contain-intrinsic-size:0 400px}' : ''}</style>`;
    document.body.innerHTML = '<div id=wrap></div>';
    const wrap = document.getElementById('wrap');
    const t = performance.now();
    for (let i = 0; i < 300; i++) { const s = document.createElement('section'); s.className = 's'; for (let j = 0; j < 40; j++) { const p = document.createElement('p'); p.textContent = `строка ${i}/${j}`; s.append(p); } wrap.append(s); }
    void document.body.offsetHeight; // форсировать раскладку
    return +(performance.now() - t).toFixed(1);
  }, cv);
  const plain = await renderList(false);
  const skipped = await renderList(true);
  assert.ok(skipped < plain / 2, `content-visibility ускорил раскладку с ${plain} до ${skipped} мс`);
});

// --- виртуальные часы: детерминированная проверка debounce и throttle ---
function makeClock() {
  let t = 0; const q = [];
  return {
    now: () => t,
    setTimeout: (fn, ms) => { const e = { fn, at: t + ms }; q.push(e); return e; },
    clearTimeout: (e) => { const i = q.indexOf(e); if (i >= 0) q.splice(i, 1); },
    tick: (ms) => { const target = t + ms; q.sort((a, b) => a.at - b.at); while (q.length && q[0].at <= target) { const e = q.shift(); t = e.at; e.fn(); } t = target; },
  };
}
const debounce = (fn, ms, clock) => { let id; return (...a) => { clock.clearTimeout(id); id = clock.setTimeout(() => fn(...a), ms); }; };
const throttle = (fn, ms, clock) => { let last = -Infinity, id, lastArgs; return (...a) => { lastArgs = a; const since = clock.now() - last; if (since >= ms) { last = clock.now(); fn(...a); } else if (!id) { id = clock.setTimeout(() => { last = clock.now(); id = null; fn(...lastArgs); }, ms - since); } }; };

// debounce: быстрый набор из пяти букв за 300 мс даёт один вызов, с последним аргументом
{
  const clock = makeClock();
  const calls = [];
  const onInput = debounce((v) => calls.push(v), 300, clock);
  for (const v of ['ч', 'ча', 'чай', 'чайн', 'чайник']) { onInput(v); clock.tick(50); } // нажатия каждые 50 мс
  assert.deepEqual(calls, []);           // пока печатают — ни одного запроса
  clock.tick(300);
  assert.deepEqual(calls, ['чайник']);   // один запрос после паузы, с финальным значением
}
// throttle: прокрутка каждые 50 мс при лимите 100 мс — ведущий вызов плюс не чаще раза в 100 мс
{
  const clock = makeClock();
  const calls = [];
  const onScroll = throttle((y) => calls.push({ y, at: clock.now() }), 100, clock);
  for (let y = 0; y <= 500; y += 50) { onScroll(y); clock.tick(50); } // 11 событий за 500 мс
  clock.tick(100);
  assert.ok(calls.length <= 7 && calls.length >= 5, `вызовов ${calls.length}`); // вместо 11 событий
  assert.equal(calls[0].at, 0);                     // ведущий вызов сразу
  for (let i = 1; i < calls.length; i++) assert.ok(calls[i].at - calls[i - 1].at >= 100); // не чаще раза в 100 мс
}

// --- утечка подписки: забытый слушатель живёт, AbortController его снимает ---
{
  const bus = new EventTarget();
  const leaked = [], cleaned = [];
  bus.addEventListener('tick', () => leaked.push(1));                 // некому снять — живёт вечно
  const ac = new AbortController();
  bus.addEventListener('tick', () => cleaned.push(1), { signal: ac.signal });
  const fire = () => bus.dispatchEvent(new Event('tick'));
  fire(); fire();
  assert.deepEqual([leaked.length, cleaned.length], [2, 2]);
  ac.abort();                                                        // cleanup при размонтировании компонента
  fire(); fire();
  assert.deepEqual([leaked.length, cleaned.length], [4, 2]);         // забытый сработал ещё дважды, снятый — нет
}

console.log('runtime ok');
