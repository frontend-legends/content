// Проверки к 3.03 в Chromium по счётчикам протокола DevTools: сколько раз браузер пересчитал стили (RecalcStyleCount)
// и раскладку (LayoutCount), какие элементы получили свой слой (LayerTree) и сколько раз слои перерисовывались (layerPainted).
// Принудительная синхронная раскладка, чтения, которые её вызывают и не вызывают, layout thrashing против пакетной работы,
// анимация left против transform по кадрам, слой от will-change, перерисовка от цвета против transform.
// Запуск: cd codes && node run.mjs 03.web/3.rendering
import assert from 'node:assert/strict';
import { withPage } from '../../_lib/browser.mjs';

await withPage(async (page) => {
  await page.setContent(`<!doctype html><html lang="ru"><style>
    body { margin: 0; } .card { width: 100px; height: 50px; background: rgb(200, 0, 0); margin: 4px; }
    .promoted { will-change: transform; } #c { transform: translateX(0); } /* переход из none сам меняет раскладку один раз */
  </style><body>
    <div id="a" class="card"></div>
    <div id="b" class="card promoted"></div>
    <div id="c" class="card"></div>
    <div id="list">${'<div class="card item"></div>'.repeat(50)}</div>
  </body></html>`);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const counters = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics
    .filter((x) => x.name === 'LayoutCount' || x.name === 'RecalcStyleCount').map((x) => [x.name === 'LayoutCount' ? 'layout' : 'style', x.value]));
  const delta = async (fn, arg) => {
    const before = await counters();
    const result = await page.evaluate(fn, arg);
    const after = await counters();
    return { layout: after.layout - before.layout, style: after.style - before.style, result };
  };
  const frames = (n = 2) => page.evaluate((n) => new Promise((r) => { let i = 0; const tick = () => (++i >= n ? r() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), n);
  await frames();

  // --- запись без чтения: в ходе скрипта браузер ничего не пересчитывает, копит до кадра ---
  let d = await delta(() => { const a = document.getElementById('a'); a.style.width = '110px'; a.style.color = 'blue'; });
  assert.deepEqual([d.layout, d.style], [0, 0]);
  await frames();

  // --- запись геометрии и чтение геометрии — раскладка прямо сейчас ---
  d = await delta(() => { const a = document.getElementById('a'); a.style.width = '120px'; return a.offsetWidth; });
  assert.deepEqual([d.layout, d.style, d.result], [1, 1, 120]);

  // --- чтение цвета требует только стилей, даже если геометрия изменилась ---
  d = await delta(() => { const a = document.getElementById('a'); a.style.width = '130px'; a.style.color = 'green'; return getComputedStyle(a).color; });
  assert.deepEqual([d.layout, d.style, d.result], [0, 1, 'rgb(0, 128, 0)']);
  // а чтение ширины через getComputedStyle — уже раскладки
  d = await delta(() => getComputedStyle(document.getElementById('a')).width);
  assert.deepEqual([d.layout, d.result], [1, '130px']);
  // повторное чтение без изменений бесплатно
  d = await delta(() => [document.getElementById('a').offsetWidth, document.getElementById('a').getBoundingClientRect().width]);
  assert.deepEqual([d.layout, d.style], [0, 0]);

  // --- layout thrashing: чтение после каждой записи — раскладка на каждом шаге ---
  d = await delta(() => { for (const el of document.querySelectorAll('.item')) { el.style.width = el.offsetWidth + 1 + 'px'; } });
  assert.equal(d.layout, 49);                                             // первое чтение бесплатно, дальше — после каждой записи
  await frames();
  d = await delta(() => {
    const items = [...document.querySelectorAll('.item')];
    const widths = items.map((el) => el.offsetWidth);                    // сначала все чтения
    items.forEach((el, i) => { el.style.width = widths[i] + 1 + 'px'; }); // потом все записи
  });
  assert.ok(d.layout <= 1);                                               // одна раскладка на все чтения, записи — до кадра
  await frames();

  // --- анимация по кадрам: left пересчитывает раскладку каждый кадр, transform — нет ---
  const animate = async (prop) => {
    const before = await counters();
    await page.evaluate((prop) => new Promise((resolve) => {
      const el = document.getElementById('c');
      el.style.position = 'relative';
      let i = 0;
      const step = () => {
        i++;
        if (prop === 'left') el.style.left = i * 5 + 'px'; else el.style.transform = `translateX(${i * 5}px)`;
        if (i < 10) requestAnimationFrame(step); else requestAnimationFrame(() => resolve());
      };
      requestAnimationFrame(step);
    }), prop);
    await frames(2);                                                    // дождаться кадра с последним изменением
    const after = await counters();
    return after.layout - before.layout;
  };
  const leftLayouts = await animate('left');
  const transformLayouts = await animate('transform');
  assert.ok(leftLayouts >= 10, `left: ${leftLayouts} раскладок`);
  assert.equal(transformLayouts, 0);
  // но первый переход transform из none меняет раскладку один раз: элемент становится контекстом наложения и containing block
  const first = await counters();
  await page.evaluate(() => { document.getElementById('a').style.transform = 'translateX(1px)'; });
  await frames(2);
  assert.equal((await counters()).layout - first.layout, 1);

  // --- слои: will-change даёт элементу свой слой; перерисовка от цвета есть, от transform на своём слое — нет ---
  await cdp.send('DOM.getDocument', { depth: -1 });
  const backendId = async (sel) => (await cdp.send('DOM.describeNode', { objectId: (await cdp.send('Runtime.evaluate', { expression: `document.querySelector('${sel}')` })).result.objectId })).node.backendNodeId;
  let layers = [];
  let painted = 0;
  cdp.on('LayerTree.layerTreeDidChange', (e) => { if (e.layers) layers = e.layers; });
  cdp.on('LayerTree.layerPainted', () => { painted++; });
  await cdp.send('LayerTree.enable');
  await frames(3);
  const layerNodes = layers.map((l) => l.backendNodeId).filter(Boolean);
  assert.equal(layerNodes.includes(await backendId('#b')), true);        // .promoted — свой слой
  assert.equal(layerNodes.includes(await backendId('#a')), false);       // обычный блок — рисуется в слое страницы

  painted = 0;
  await page.evaluate(() => { document.getElementById('a').style.background = 'rgb(0, 0, 200)'; });
  await frames(3);
  const paintsColor = painted;
  painted = 0;
  await page.evaluate(() => { document.getElementById('b').style.transform = 'translateX(40px)'; });
  await frames(3);
  assert.ok(paintsColor > 0, 'смена цвета перерисовала слой');
  assert.equal(painted, 0);                                               // сдвиг слоя — без перерисовки
});

console.log('pipeline ok');
