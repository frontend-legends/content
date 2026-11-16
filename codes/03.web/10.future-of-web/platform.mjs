// Проверки к 3.10 в Chromium и Node: Navigation API (перехват ссылки, назад, программный переход с состоянием,
// чужой origin не перехватывается, pushState тоже виден как navigate, popstate на него не приходит),
// SPA-переход Navigation API + View Transitions (колбэк обновления выполняется позже вызова),
// moveBefore против append (iframe не перезагружается, фокус остаётся), URLPattern в браузере и Node.
// Плюс: отмена перехода новым (signal, AbortError), новая вкладка не даёт navigate, заморозка отрисовки и тайм-аут
// колбэка View Transition, connectedMoveCallback.
// Запуск: cd codes && node run.mjs 03.web/10.future-of-web
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const titles = { '/': 'Главная', '/catalog': 'Каталог', '/cart': 'Корзина' };
const app = `
  window.marker = 'документ не перезагружался';
  window.log = [];
  window.unloads = 0;
  addEventListener('beforeunload', () => unloads++);
  navigation.addEventListener('navigate', (e) => {
    const path = new URL(e.destination.url).pathname;
    log.push([e.navigationType, path, e.canIntercept]);
    if (window.unsaved) { log.push(['можно отменить', e.cancelable]); if (e.cancelable) { e.preventDefault(); return; } }
    if (!e.canIntercept) { e.preventDefault(); return; }             // для проверки — остаёмся на странице
    if (!(path in TITLES) || e.hashChange || e.downloadRequest) return;
    e.intercept({
      async handler() {
        log.push(['переход идёт', navigation.transition !== null]);
        await new Promise((r) => setTimeout(r, 30));                    // «загрузка данных»
        if (e.signal.aborted) { log.push(['отменён', path]); return; }   // начался другой переход
        const update = () => { document.querySelector('h1').textContent = TITLES[path]; };
        if (!document.startViewTransition) return update();
        const vt = document.startViewTransition(update);
        log.push(['сразу после startViewTransition', document.querySelector('h1').textContent]);
        await vt.updateCallbackDone;
        log.push(['после updateCallbackDone', document.querySelector('h1').textContent]);
        await vt.finished;
      },
    });
  });
  navigation.addEventListener('navigatesuccess', () => log.push(['готово', location.pathname]));
  addEventListener('popstate', () => log.push(['popstate', location.pathname]));`;
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><script>const TITLES = ${JSON.stringify(titles)};${app}</script></head>
    <body><nav><a id="to-catalog" href="/catalog">Каталог</a> <a id="blank" href="/catalog" target="_blank">Каталог в новой вкладке</a> <a id="away" href="https://other.example/">Партнёр</a></nav><h1>${titles[path] ?? 'Страница'}</h1></body></html>`);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({ executablePath: findChromium() });
try {
  const page = await browser.newPage();
  await page.goto(base);
  const take = () => page.evaluate(() => window.log.splice(0));

  // --- ссылка перехвачена: адрес сменился, документ тот же; DOM обновился внутри View Transition ---
  await page.click('#to-catalog');
  await page.waitForFunction(() => window.log.some((l) => l[0] === 'готово'));
  assert.deepEqual(await take(), [
    ['push', '/catalog', true],
    ['переход идёт', true],
    ['сразу после startViewTransition', 'Главная'],                    // колбэк ещё не выполнен
    ['после updateCallbackDone', 'Каталог'],
    ['готово', '/catalog'],
  ]);
  assert.equal(page.url(), `${base}/catalog`);
  assert.equal(await page.evaluate(() => window.marker), 'документ не перезагружался');

  // --- кнопка «назад» — тоже событие navigate, тип traverse ---
  await page.goBack();
  await page.waitForFunction(() => window.log.some((l) => l[0] === 'готово'));
  const back = await take();
  assert.deepEqual(back[0], ['traverse', '/', true]);
  assert.equal(await page.textContent('h1'), 'Главная');
  assert.ok(back.some((l) => l[0] === 'popstate'));                    // назад по записи истории — popstate тоже приходит

  // --- программный переход с состоянием; промисы committed и finished ---
  const nav = await page.evaluate(async () => {
    const { committed, finished } = navigation.navigate('/cart', { state: { from: 'кнопка' } });
    await committed;
    const at = location.pathname;
    await finished;
    return { at, state: navigation.currentEntry.getState(), h1: document.querySelector('h1').textContent, entries: navigation.entries().length };
  });
  assert.deepEqual(nav, { at: '/cart', state: { from: 'кнопка' }, h1: 'Корзина', entries: 2 }); // «/catalog» заменён: назад, затем новый переход
  await take();

  // --- ссылка на другой origin перехватить нельзя ---
  await page.click('#away');
  await page.waitForTimeout(100);
  assert.deepEqual(await take(), [['push', '/', false]]);
  assert.equal(page.url(), `${base}/cart`);

  // --- новый переход отменяет текущий: signal прерван, finished отклонён ---
  const aborted = await page.evaluate(async () => {
    const first = navigation.navigate('/catalog');
    navigation.navigate('/');
    const error = await first.finished.then(() => null, (e) => e.name);
    return { error, at: location.pathname };
  });
  assert.deepEqual(aborted, { error: 'AbortError', at: '/' });
  await page.waitForFunction(() => window.log.some((l) => l[0] === 'готово' && l[1] === '/'));
  assert.ok((await take()).some((l) => l[0] === 'отменён' && l[1] === '/catalog'));

  // --- новая вкладка (target и клик с модификатором) — не переход этого документа, события нет ---
  for (const open of [() => page.click('#blank'), () => page.click('#to-catalog', { modifiers: ['ControlOrMeta'] })]) {
    const [popup] = await Promise.all([page.context().waitForEvent('page'), open()]);
    await popup.close();
    await page.waitForTimeout(100);
    assert.deepEqual(await take(), []);
  }
  await page.evaluate(() => navigation.navigate('/cart').finished);
  await take();

  // --- несохранённая форма: переход внутри SPA отменяется preventDefault, beforeunload на него не приходит ---
  assert.equal(await page.evaluate(() => window.unloads), 0);          // все переходы выше были без выгрузки документа
  await page.evaluate(() => { window.unsaved = true; });
  await page.click('#to-catalog');
  await page.waitForTimeout(100);
  assert.deepEqual(await take(), [['push', '/catalog', true], ['можно отменить', true]]);
  assert.equal(page.url(), `${base}/cart`);
  await page.evaluate(() => { window.unsaved = false; });

  // --- старый роутер на pushState: navigate видит переход, popstate — нет ---
  await page.evaluate(() => history.pushState({}, '', '/legacy'));
  await page.waitForTimeout(50);
  assert.deepEqual(await take(), [['push', '/legacy', true], ['готово', '/legacy']]);

  // --- пока колбэк startViewTransition работает, страница не отрисовывается; слишком долгий — отмена через 4 с ---
  const vt = await page.evaluate(async () => {
    const frames = (ms) => new Promise((res) => { let n = 0; const end = performance.now() + ms; const tick = () => { n++; if (performance.now() < end) requestAnimationFrame(tick); else res(n); }; requestAnimationFrame(tick); });
    const normal = await frames(300);
    let frozen;
    await document.startViewTransition(async () => { frozen = await frames(300); }).finished;
    const t0 = performance.now();
    const slow = document.startViewTransition(() => new Promise((r) => setTimeout(r, 6000)));
    const error = await slow.ready.then(() => null, (e) => `${e.name}: ${e.message}`);
    return { normal, frozen, error, after: performance.now() - t0 };
  });
  assert.ok(vt.normal >= 5 && vt.frozen <= 1, JSON.stringify(vt));
  assert.equal(vt.error, 'TimeoutError: Transition was aborted because of timeout in DOM update');
  assert.ok(vt.after >= 3900 && vt.after < 5000);

  // --- moveBefore сохраняет состояние, append — нет ---
  const move = await page.evaluate(async () => {
    document.body.innerHTML = '<div id="box"><iframe id="map" srcdoc="<p>карта</p>"></iframe><input id="q"></div><aside id="side"></aside>';
    const map = document.getElementById('map');
    await new Promise((r) => map.addEventListener('load', r, { once: true }));
    let loads = 0;
    map.addEventListener('load', () => loads++);
    const box = document.getElementById('box'), side = document.getElementById('side'), q = document.getElementById('q');
    const settle = () => new Promise((r) => setTimeout(r, 200));

    q.focus();
    document.body.moveBefore(box, side.nextSibling);                    // переместить в конец body
    await settle();
    const moved = { loads, focused: document.activeElement === q };

    q.focus();
    side.append(box);                                                   // обычная вставка: удалить и вставить заново
    await settle();
    return { moved, appended: { loads, focused: document.activeElement === q } };
  });
  assert.deepEqual(move, { moved: { loads: 0, focused: true }, appended: { loads: 1, focused: false } });

  // кастомный элемент: connectedMoveCallback вместо отключения и подключения, если он определён
  const callbacks = await page.evaluate(() => {
    const log = [];
    customElements.define('delivery-map', class extends HTMLElement {
      connectedCallback() { log.push('map: connected'); }
      disconnectedCallback() { log.push('map: disconnected'); }
      connectedMoveCallback() { log.push('map: moved'); }
    });
    customElements.define('promo-banner', class extends HTMLElement {
      connectedCallback() { log.push('banner: connected'); }
      disconnectedCallback() { log.push('banner: disconnected'); }
    });
    document.body.innerHTML = '<delivery-map></delivery-map><promo-banner></promo-banner><div id="end"></div>';
    log.length = 0;
    const end = document.getElementById('end');
    document.body.moveBefore(document.querySelector('delivery-map'), end);
    document.body.moveBefore(document.querySelector('promo-banner'), end);
    return log;
  });
  assert.deepEqual(callbacks, ['map: moved', 'banner: disconnected', 'banner: connected']);

  // --- URLPattern в браузере ---
  const inBrowser = await page.evaluate(() => {
    const product = new URLPattern({ pathname: '/tea/:slug{/reviews}?' });
    return [
      product.exec('https://shop.example/tea/oolong/reviews')?.pathname.groups.slug,
      product.test('https://shop.example/tea'),
    ];
  });
  assert.deepEqual(inBrowser, ['oolong', false]);
} finally {
  await browser.close();
  server.close();
}

// --- URLPattern в Node: тот же синтаксис для серверных и edge-маршрутов ---
const product = new URLPattern({ pathname: '/tea/:slug{/reviews}?' });
assert.deepEqual(product.exec('https://shop.example/tea/oolong')?.pathname.groups, { slug: 'oolong' });
assert.equal(product.test('https://shop.example/tea/oolong/reviews'), true);
assert.equal(product.test('https://shop.example/tea'), false);
const api = new URLPattern({ pathname: '/api/orders/:id(\\d+)' });
assert.equal(api.test('https://shop.example/api/orders/42'), true);
assert.equal(api.test('https://shop.example/api/orders/new'), false);    // группа с регулярным выражением

console.log('platform ok');
