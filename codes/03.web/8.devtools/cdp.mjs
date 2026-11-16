// Проверки к 3.08: панели DevTools — клиенты Chrome DevTools Protocol. Всё ниже делается теми же командами протокола.
// Покрытие JS и CSS (Coverage), консоль: снимок превью против текущего значения, assert/count/table/time,
// утилиты командной строки только в консоли, слушатели элемента (Event Listeners), принудительный :hover (Elements),
// точки останова: debugger, условная, logpoint (условие с console.log и false), DOM, слушатель события, fetch, исключения,
// сеть: задержка, ожидание ответа сервера, блокировка запросов, отключение кеша, подмена ответа,
// замедление процессора, эмуляция медиа, трейс Performance: принудительная раскладка со стеком и долгая задача.
// Запуск: cd codes && node run.mjs 03.web/8.devtools
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const cartJs = [
  'function addToCart(qty) {',
  '  const total = qty * 890;',                                         // строка 1 (с нуля) — сюда ставим точки останова
  '  return total;',
  '}',
  'function used() { return 1; }',
  'function unused() { return 2; }',
].join('\n');
let logoHits = 0;
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/cart.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(cartJs); }
  if (url.pathname === '/api/cart') {
    await wait(Number(url.searchParams.get('d') ?? 0));
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end('{"items":2}');
  }
  if (url.pathname === '/logo.svg') {
    logoHits++;
    res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'max-age=3600' });
    return res.end('<svg xmlns="http://www.w3.org/2000/svg"/>');
  }
  if (url.pathname === '/analytics.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end('window.tracked = true;'); }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html lang="ru"><head><meta charset="utf-8">
    <style>.used { color: green } .unused { color: red } #buy { background: rgb(0, 0, 255) } #buy:hover { background: rgb(255, 0, 0) }</style>
    <script src="/cart.js"></script><script>used();</script></head>
    <body><ul id="cart"></ul><button id="buy" class="used">В корзину</button></body></html>`);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({ executablePath: findChromium() });
const context = await browser.newContext();
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const consoleTexts = [];
page.on('console', (m) => consoleTexts.push([m.type(), m.text()]));

// пауза отладчика: вернуть событие Debugger.paused (или null, если пауза не случилась), выполнить onPause до resume
async function pauseOn(trigger, onPause) {
  let handler;
  const paused = new Promise((r) => { handler = r; cdp.on('Debugger.paused', handler); });
  const done = trigger();
  const event = await Promise.race([paused, done.then(() => null)]);
  cdp.off('Debugger.paused', handler);
  if (!event) return null;
  if (onPause) await onPause(event);
  await cdp.send('Debugger.resume');
  await done;
  return event;
}

try {
  // --- Coverage: запись до загрузки страницы, как кнопка «перезагрузить и записать» ---
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  await cdp.send('CSS.startRuleUsageTracking');
  await page.goto(base);
  const { result: jsCoverage } = await cdp.send('Profiler.takePreciseCoverage');
  const cartCov = jsCoverage.find((s) => s.url.endsWith('/cart.js'));
  const calls = Object.fromEntries(cartCov.functions.filter((f) => f.functionName).map((f) => [f.functionName, f.ranges[0].count]));
  assert.deepEqual(calls, { addToCart: 0, used: 1, unused: 0 });
  await cdp.send('Profiler.stopPreciseCoverage');
  const { ruleUsage } = await cdp.send('CSS.stopRuleUsageTracking');
  const sheetText = (await cdp.send('CSS.getStyleSheetText', { styleSheetId: ruleUsage[0].styleSheetId })).text;
  // протокол возвращает использованные правила; всё остальное в таблице стилей Coverage показывает как неиспользованное
  const usedRules = ruleUsage.filter((r) => r.used).map((r) => sheetText.slice(r.startOffset, r.endOffset).split('{')[0].trim());
  assert.deepEqual(usedRules.sort(), ['#buy', '.used']);
  const unusedRules = ['.used', '.unused', '#buy', '#buy:hover'].filter((sel) => !usedRules.includes(sel));
  assert.deepEqual(unusedRules, ['.unused', '#buy:hover']);

  // --- консоль: свёрнутая строка — снимок на момент вызова, раскрытие читает текущее значение ---
  await cdp.send('Runtime.enable');
  const logged = new Promise((r) => cdp.once('Runtime.consoleAPICalled', r));
  await page.evaluate(() => { const cart = { items: 1 }; console.log(cart); cart.items = 5; });
  const arg = (await logged).args[0];
  assert.equal(arg.preview.properties.find((p) => p.name === 'items').value, '1');
  const { result: now } = await cdp.send('Runtime.getProperties', { objectId: arg.objectId, ownProperties: true });
  assert.equal(now.find((p) => p.name === 'items').value.value, 5);

  consoleTexts.length = 0;
  await page.evaluate(() => {
    console.assert(true, 'не выведется');
    console.assert(false, 'корзина пуста');
    console.count('клик'); console.count('клик');
    console.table([{ name: 'Улун', price: 890 }]);
    console.time('загрузка'); console.timeEnd('загрузка');
  });
  await wait(100);
  assert.deepEqual(consoleTexts.map(([t]) => t), ['assert', 'count', 'count', 'table', 'timeEnd']);
  assert.equal(consoleTexts[0][1], 'корзина пуста');                  // только ложное условие, с типом assert
  assert.deepEqual(consoleTexts.slice(1, 3).map(([, t]) => t), ['клик: 1', 'клик: 2']);
  assert.match(consoleTexts[4][1], /^загрузка: [\d.]+ ms$/);

  // --- утилиты командной строки ($$, getEventListeners) есть только в консоли, а не в коде страницы ---
  await page.evaluate(() => {
    const buy = document.getElementById('buy');
    buy.addEventListener('click', function addItem() {});
    buy.addEventListener('wheel', () => {}, { passive: true });
  });
  const evaluate = async (expression, includeCommandLineAPI) => (await cdp.send('Runtime.evaluate', { expression, includeCommandLineAPI, returnByValue: true })).result.value;
  assert.equal(await evaluate("getEventListeners(document.getElementById('buy')).click.length", true), 1);
  assert.equal(await evaluate("$$('button').length", true), 1);
  assert.equal(await evaluate('typeof getEventListeners', false), 'undefined');
  assert.equal(await page.evaluate(() => typeof $$), 'undefined');
  // панель Event Listeners: тип, passive, once
  const { result: buyObj } = await cdp.send('Runtime.evaluate', { expression: "document.getElementById('buy')" });
  const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: buyObj.objectId });
  assert.deepEqual(listeners.map((l) => [l.type, l.passive, l.once]), [['click', false, false], ['wheel', true, false]]);

  // --- Elements: принудительное состояние :hover ---
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId: buyNode } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#buy' });
  const bg = () => page.evaluate(() => getComputedStyle(document.getElementById('buy')).backgroundColor);
  await cdp.send('CSS.forcePseudoState', { nodeId: buyNode, forcedPseudoClasses: ['hover'] });
  assert.equal(await bg(), 'rgb(255, 0, 0)');
  await cdp.send('CSS.forcePseudoState', { nodeId: buyNode, forcedPseudoClasses: [] });
  assert.equal(await bg(), 'rgb(0, 0, 255)');

  // --- точки останова ---
  assert.equal(await page.evaluate(() => { debugger; return 'без паузы'; }), 'без паузы'); // отладчик не подключён — debugger ничего не делает
  await cdp.send('Debugger.enable');
  assert.equal((await pauseOn(() => page.evaluate(() => { debugger; return 1; }))).reason, 'other');

  // условная: пауза только при qty > 10; на паузе читаем переменные кадра, как панель Scope
  const cond = await cdp.send('Debugger.setBreakpointByUrl', { urlRegex: 'cart\\.js$', lineNumber: 1, condition: 'qty > 10' });
  assert.equal(await pauseOn(() => page.evaluate(() => addToCart(1))), null);
  let qtyOnPause;
  const hit = await pauseOn(() => page.evaluate(() => addToCart(20)), async (e) => {
    qtyOnPause = (await cdp.send('Debugger.evaluateOnCallFrame', { callFrameId: e.callFrames[0].callFrameId, expression: 'qty' })).result.value;
  });
  assert.equal(hit.callFrames[0].functionName, 'addToCart');
  assert.deepEqual(hit.hitBreakpoints, [cond.breakpointId]);
  assert.equal(qtyOnPause, 20);
  await cdp.send('Debugger.removeBreakpoint', { breakpointId: cond.breakpointId });

  // logpoint — условие, которое пишет в консоль и возвращает false: паузы нет, сообщение есть
  consoleTexts.length = 0;
  const logpoint = await cdp.send('Debugger.setBreakpointByUrl', { urlRegex: 'cart\\.js$', lineNumber: 1, condition: "console.log('qty =', qty), false" });
  assert.equal(await pauseOn(() => page.evaluate(() => addToCart(3))), null);
  await wait(50);
  assert.deepEqual(consoleTexts, [['log', 'qty = 3']]);
  await cdp.send('Debugger.removeBreakpoint', { breakpointId: logpoint.breakpointId });

  // DOM: изменение поддерева
  const { nodeId: cartNode } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#cart' });
  await cdp.send('DOMDebugger.setDOMBreakpoint', { nodeId: cartNode, type: 'subtree-modified' });
  const dom = await pauseOn(() => page.evaluate(() => { document.getElementById('cart').append(document.createElement('li')); }));
  assert.deepEqual([dom.reason, dom.data.type], ['DOM', 'subtree-modified']);
  await cdp.send('DOMDebugger.removeDOMBreakpoint', { nodeId: cartNode, type: 'subtree-modified' });
  // атрибуты: и el.style, и classList меняют атрибут — точка их ловит
  await cdp.send('DOMDebugger.setDOMBreakpoint', { nodeId: buyNode, type: 'attribute-modified' });
  const viaStyle = await pauseOn(() => page.evaluate(() => { document.getElementById('buy').style.color = 'red'; }));
  const viaClass = await pauseOn(() => page.evaluate(() => { document.getElementById('buy').classList.add('active'); }));
  assert.deepEqual([viaStyle.data.type, viaClass.data.type], ['attribute-modified', 'attribute-modified']);
  await cdp.send('DOMDebugger.removeDOMBreakpoint', { nodeId: buyNode, type: 'attribute-modified' });

  // слушатель события
  await cdp.send('DOMDebugger.setEventListenerBreakpoint', { eventName: 'click' });
  const ev = await pauseOn(() => page.evaluate(() => document.getElementById('buy').click()));
  assert.deepEqual([ev.reason, ev.data.eventName], ['EventListener', 'listener:click']);
  await cdp.send('DOMDebugger.removeEventListenerBreakpoint', { eventName: 'click' });

  // запрос fetch по части адреса
  await cdp.send('DOMDebugger.setXHRBreakpoint', { url: '/api/cart' });
  const xhr = await pauseOn(() => page.evaluate(() => fetch('/api/cart').then((r) => r.json())));
  assert.equal(xhr.reason, 'XHR');
  await cdp.send('DOMDebugger.removeXHRBreakpoint', { url: '/api/cart' });

  // исключения: перехваченное останавливает только режим «все»
  const caught = () => page.evaluate(() => { try { JSON.parse('{'); } catch { return 'обработано'; } });
  await cdp.send('Debugger.setPauseOnExceptions', { state: 'uncaught' });
  assert.equal(await pauseOn(caught), null);
  await cdp.send('Debugger.setPauseOnExceptions', { state: 'all' });
  const exc = await pauseOn(caught);
  assert.deepEqual([exc.reason, exc.data.className], ['exception', 'SyntaxError']);
  await cdp.send('Debugger.setPauseOnExceptions', { state: 'none' });
  await cdp.send('Debugger.disable');

  // --- сеть ---
  await cdp.send('Network.enable');
  const timed = () => page.evaluate(async () => { const t = performance.now(); await fetch(`/api/cart?r=${Math.random()}`); return performance.now() - t; });
  const fast = await timed();
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: -1, uploadThroughput: -1 });
  const slow = await timed();
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  assert.ok(fast < 200 && slow >= 400, `${fast} ${slow}`);

  // «Waiting for server response» в водопаде — от отправки запроса до первых байтов ответа
  const timing = new Promise((r) => {
    const h = (e) => { if (e.response.url.includes('d=300')) { cdp.off('Network.responseReceived', h); r(e.response.timing); } };
    cdp.on('Network.responseReceived', h);
  });
  await page.evaluate(() => fetch('/api/cart?d=300'));
  const t = await timing;
  assert.ok((t.receiveHeadersStart ?? t.receiveHeadersEnd) - t.sendEnd >= 290, JSON.stringify(t));

  // блокировка запроса
  const failed = new Promise((r) => cdp.once('Network.loadingFailed', r));
  await cdp.send('Network.setBlockedURLs', { urls: ['*/analytics.js'] });
  assert.equal(await page.evaluate(() => fetch('/analytics.js').then(() => 'загружен', (e) => e.message)), 'Failed to fetch');
  assert.equal((await failed).blockedReason, 'inspector');              // заблокирован инструментами разработчика
  await cdp.send('Network.setBlockedURLs', { urls: [] });

  // отключение кеша
  const logo = () => page.evaluate(() => fetch('/logo.svg').then((r) => r.text()));
  await logo(); await logo();
  assert.equal(logoHits, 1);                                            // второй раз — из кеша
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await logo(); await logo();
  assert.equal(logoHits, 3);                                            // кеш выключен — оба запроса на сервер
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });

  // подмена ответа
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/cart*' }] });
  const fulfill = (e) => cdp.send('Fetch.fulfillRequest', {
    requestId: e.requestId, responseCode: 200,
    responseHeaders: [{ name: 'content-type', value: 'application/json' }],
    body: Buffer.from('{"items":0}').toString('base64'),
  });
  cdp.on('Fetch.requestPaused', fulfill);
  assert.deepEqual(await page.evaluate(() => fetch('/api/cart').then((r) => r.json())), { items: 0 });
  cdp.off('Fetch.requestPaused', fulfill);
  await cdp.send('Fetch.disable');

  // --- замедление процессора ---
  const work = () => page.evaluate(() => { const s = performance.now(); let x = 0; for (let i = 0; i < 3e6; i++) x += Math.sqrt(i); return performance.now() - s; });
  const median = async () => { const r = [await work(), await work(), await work()].sort((a, b) => a - b); return r[1]; };
  const normal = await median();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const throttled = await median();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  assert.ok(throttled / normal >= 2.5, `${normal} → ${throttled}`);

  // --- эмуляция медиа: тёмная тема и уменьшение движения ---
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.deepEqual(await page.evaluate(() => [matchMedia('(prefers-color-scheme: dark)').matches, matchMedia('(prefers-reduced-motion: reduce)').matches]), [true, true]);
  await cdp.send('Emulation.setEmulatedMedia', { features: [] });

  // --- трейс Performance: принудительная раскладка указывает на функцию, долгая задача видна целиком ---
  await page.evaluate(() => { const ul = document.getElementById('cart'); for (let i = 0; i < 50; i++) { const li = document.createElement('li'); li.textContent = `товар ${i}`; ul.append(li); } });
  await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.stack'] });
  await page.evaluate(() => {
    window.resizeAll = function resizeAll() {
      for (const li of document.querySelectorAll('#cart li')) li.style.height = `${li.offsetHeight + 1}px`; // чтение после записи
    };
    resizeAll();
    const end = performance.now() + 120;
    while (performance.now() < end) {}                                  // тяжёлая синхронная работа
  });
  await wait(200);
  const trace = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
  const forced = trace.filter((e) => e.name === 'Layout' && e.args?.beginData?.stackTrace?.[0]?.functionName === 'resizeAll');
  assert.ok(forced.length >= 50, `${forced.length}`);
  const longTasks = trace.filter((e) => e.name === 'RunTask' && e.dur >= 100_000);
  assert.ok(longTasks.length >= 1);
} finally {
  await browser.close();
  server.close();
}

console.log('cdp ok');
