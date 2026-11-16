// Проверки к 6.05 в Chromium: когда стартует переход (вставка с классом, чтение стиля, @starting-style),
// transitionend при 0s и 0.01ms и по разу на свойство, сокращение обратного перехода, display и allow-discrete,
// visibility, height: auto и interpolate-size, 0fr → 1fr, CSS-переменная без @property и с ним,
// fill-mode и приоритет анимации, steps() и linear(), анимации по прокрутке и сброс animation-timeline сокращением,
// одинаковое view-transition-name.
// Запуск: cd codes && node run.mjs 06.css/5.animations
import assert from 'node:assert/strict';
import { withPage } from '../../_lib/browser.mjs';

await withPage(async (page) => {
  const set = (css, body = '') => page.setContent(`<!doctype html><html lang="ru"><style>body{margin:0}${css}</style><body>${body}</body></html>`);
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

  // --- переход не стартует у элемента, который вставили и сразу изменили ---
  await set(`.toast { opacity: 0; transition: opacity 300ms; } .toast.show { opacity: 1; }`);
  const started = (mode) => page.evaluate((mode) => {
    const el = document.createElement('div');
    el.className = 'toast';
    document.body.append(el);
    if (mode === 'flush') getComputedStyle(el).opacity;      // принудительный пересчёт стиля
    el.classList.add('show');
    const n = el.getAnimations().length;
    el.remove();
    return n;
  }, mode);
  assert.equal(await started('same-frame'), 0);            // браузер не видел «до» — сразу opacity: 1
  assert.equal(await started('flush'), 1);
  // @starting-style задаёт «до» для первого появления
  await set(`.toast { opacity: 1; transition: opacity 300ms; } @starting-style { .toast { opacity: 0; } }`);
  assert.equal(await page.evaluate(() => {
    const el = document.createElement('div'); el.className = 'toast'; document.body.append(el);
    return el.getAnimations().length;
  }), 1);

  // --- transitionend: при 0s не приходит, при 0.01ms приходит; по событию на каждое свойство ---
  const ends = (css) => page.evaluate(async (css) => {
    document.body.innerHTML = `<style>${css}</style><div class="box"></div>`;
    const el = document.querySelector('.box');
    const props = [];
    el.addEventListener('transitionend', (e) => props.push(e.propertyName));
    getComputedStyle(el).opacity;
    el.classList.add('on');
    await new Promise((r) => setTimeout(r, 200));
    return props.sort();
  }, css);
  assert.deepEqual(await ends('.box{opacity:1;transition:opacity 0s}.on{opacity:0}'), []);
  assert.deepEqual(await ends('.box{opacity:1;transition:opacity 0.01ms}.on{opacity:0}'), ['opacity']);
  assert.deepEqual(await ends('.box{opacity:1;transform:none;transition:all 50ms}.on{opacity:0;transform:translateX(10px)}'), ['opacity', 'transform']);

  // --- обратный переход укорачивается: прерванный на середине возвращается за половину времени ---
  await set(`.drawer { transform: translateX(100%); transition: transform 1000ms linear; } .drawer.open { transform: none; }`, '<div class="drawer" id="d"></div>');
  const reverse = await page.evaluate(() => {
    const el = document.getElementById('d');
    el.classList.add('open');
    const a = el.getAnimations()[0];
    a.currentTime = 500;                                     // половина пути
    el.classList.remove('open');
    const b = el.getAnimations()[0];
    return Math.round(b.effect.getTiming().duration);
  });
  assert.equal(reverse, 500);

  // --- display: none анимируется только с allow-discrete; при уходе display остаётся block до конца ---
  await set(`
    .panel { display: block; opacity: 1; transition: opacity 200ms, display 200ms allow-discrete; }
    .panel.hidden { display: none; opacity: 0; }
    @starting-style { .panel { opacity: 0; } }
    .plain { opacity: 1; transition: opacity 200ms, display 200ms; } .plain.hidden { display: none; opacity: 0; }`,
  '<div class="panel" id="p">корзина</div><div class="plain" id="q">корзина</div>');
  await frame();
  const leave = await page.evaluate(() => {
    const p = document.getElementById('p'), q = document.getElementById('q');
    for (const a of [...p.getAnimations(), ...q.getAnimations()]) a.finish();
    p.classList.add('hidden'); q.classList.add('hidden');
    return { p: getComputedStyle(p).display, q: getComputedStyle(q).display, pAnims: p.getAnimations().length, qAnims: q.getAnimations().length };
  });
  assert.deepEqual(leave, { p: 'block', q: 'none', pAnims: 2, qAnims: 0 });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('p')).display === 'none');
  // и обратно: из display: none через @starting-style
  assert.equal(await page.evaluate(() => { const p = document.getElementById('p'); p.classList.remove('hidden'); return p.getAnimations().length > 0; }), true);

  // --- visibility: из visible в hidden остаётся видимым до самого конца ---
  await set(`.tip { visibility: visible; transition: visibility 1000ms linear; } .tip.off { visibility: hidden; }`, '<div class="tip" id="t">подсказка</div>');
  const vis = await page.evaluate(() => {
    const t = document.getElementById('t');
    t.classList.add('off');
    const a = t.getAnimations()[0];
    const at = (ms) => { a.currentTime = ms; return getComputedStyle(t).visibility; };
    return [at(10), at(990), at(1000)];
  });
  assert.deepEqual(vis, ['visible', 'visible', 'hidden']);

  // --- height: auto не анимируется; interpolate-size и 0fr → 1fr — да ---
  const accordion = (css, open) => page.evaluate(async ([css, open]) => {
    document.body.innerHTML = `<style>${css}</style><div class="acc"><div class="inner"><p style="height:120px;margin:0">ответ</p></div></div>`;
    const acc = document.querySelector('.acc');
    getComputedStyle(acc).height;
    acc.classList.add(open);
    const anims = acc.getAnimations();
    if (!anims.length) return { anims: 0, h: getComputedStyle(acc).height };
    anims[0].currentTime = anims[0].effect.getTiming().duration / 2;
    return { anims: anims.length, h: Math.round(parseFloat(getComputedStyle(acc).height)) };
  }, [css, open]);
  assert.deepEqual(await accordion('.acc{height:0;overflow:hidden;transition:height 400ms linear}.acc.open{height:auto}', 'open'), { anims: 0, h: '120px' });
  assert.deepEqual(await accordion(':root{interpolate-size:allow-keywords}.acc{height:0;overflow:hidden;transition:height 400ms linear}.acc.open{height:auto}', 'open'), { anims: 1, h: 60 });
  assert.deepEqual(await accordion('.acc{display:grid;grid-template-rows:0fr;transition:grid-template-rows 400ms linear}.acc.open{grid-template-rows:1fr}.inner{overflow:hidden}', 'open'), { anims: 1, h: 60 });

  // --- CSS-переменная без @property меняется скачком, с @property — плавно ---
  const angle = (registered) => page.evaluate(async (registered) => {
    document.body.innerHTML = `<style>
      ${registered ? '@property --angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }' : ''}
      .ring { --angle: 0deg; transition: --angle 1000ms linear; } .ring.on { --angle: 180deg; }</style><div class="ring"></div>`;
    const el = document.querySelector('.ring');
    getComputedStyle(el).getPropertyValue('--angle');
    el.classList.add('on');
    const a = el.getAnimations()[0];
    if (!a) return getComputedStyle(el).getPropertyValue('--angle').trim();
    a.currentTime = 500;
    return getComputedStyle(el).getPropertyValue('--angle').trim();
  }, registered);
  assert.equal(await angle(false), '180deg');
  assert.equal(await angle(true), '90deg');

  // --- fill-mode: forwards держит последний кадр и сильнее обычных стилей ---
  await set(`
    @keyframes fade-out { to { opacity: 0; } }
    .toast { opacity: 1; animation: fade-out 100ms forwards; }
    .toast.again { opacity: 1; }
    .delayed { opacity: 1; animation: fade-out 100ms 5s backwards; } .delayed2 { opacity: 1; animation: appear 100ms 5s; }
    @keyframes appear { from { opacity: 0.2; } }`,
  '<div class="toast" id="f">тост</div><div class="delayed" id="bw"></div><div class="delayed2" id="nobw"></div>');
  await page.evaluate(() => document.getElementById('f').getAnimations()[0].finish());
  assert.equal(await page.$eval('#f', (el) => getComputedStyle(el).opacity), '0');
  await page.$eval('#f', (el) => el.classList.add('again'));
  assert.equal(await page.$eval('#f', (el) => getComputedStyle(el).opacity), '0');   // класс не помог
  await page.$eval('#f', (el) => (el.style.animation = 'none'));
  assert.equal(await page.$eval('#f', (el) => getComputedStyle(el).opacity), '1');
  // backwards применяет первый кадр уже во время задержки
  assert.equal(await page.$eval('#bw', (el) => getComputedStyle(el).opacity), '1');      // fade-out начинается с текущего значения
  assert.equal(await page.$eval('#nobw', (el) => getComputedStyle(el).opacity), '1');    // без backwards во время задержки — свой стиль
  await page.$eval('#nobw', (el) => (el.style.animationFillMode = 'backwards'));
  assert.equal(await page.$eval('#nobw', (el) => getComputedStyle(el).opacity), '0.2');

  // --- steps() и linear() ---
  const sample = (timing, at) => page.evaluate(([timing, at]) => {
    document.body.innerHTML = `<style>@keyframes w { from { width: 0; } to { width: 400px; } } .b { animation: w 1000ms ${timing} paused; }</style><div class="b"></div>`;
    const el = document.querySelector('.b');
    el.getAnimations()[0].currentTime = at;
    return Math.round(parseFloat(getComputedStyle(el).width) * 100) / 100;
  }, [timing, at]);
  assert.equal(await sample('steps(4)', 300), 100);                   // jump-end: 0, 100, 200, 300
  assert.equal(await sample('steps(4, jump-start)', 300), 200);       // сразу первый шаг
  assert.equal(await sample('linear', 500), 200);
  assert.ok(Math.abs(await sample('linear(0, 0.25 75%, 1)', 500) - 400 / 6) < 0.05); // кусочно-линейная: к 75% только четверть пути
  assert.equal(await sample('linear(0, 1.2 60%, 0.95 80%, 1)', 600), 480); // «перелёт» за конечное значение — пружина без JavaScript

  // --- анимации по прокрутке ---
  const progress = (css) => page.evaluate(async (css) => {
    document.body.innerHTML = `<style>
      @keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      .bar { position: fixed; top: 0; left: 0; width: 100px; height: 4px; transform-origin: left; ${css} }
      .long { height: 5000px; }</style><div class="bar"></div><div class="long"></div>`;
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTo(0, max / 2);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const m = getComputedStyle(document.querySelector('.bar')).transform;
    return m === 'none' ? null : Math.round(parseFloat(m.slice(7)) * 100) / 100;
  }, css);
  assert.equal(await progress('animation: grow linear both; animation-timeline: scroll();'), 0.5);
  // сокращение animation сбрасывает animation-timeline: таймлайн, написанный раньше, потерян
  const lost = await progress('animation-timeline: scroll(); animation: grow 1ms linear both;');
  assert.equal(lost, 1);                                             // анимация по времени за 1 мс давно закончилась
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.bar')).animationTimeline), 'auto');

  // view(): элемент проявляется, пока въезжает в окно
  const reveal = await page.evaluate(async () => {
    document.body.innerHTML = `<style>
      @keyframes in { from { opacity: 0; } to { opacity: 1; } }
      .gap { height: 2000px; } .card { height: 200px; animation: in linear both; animation-timeline: view(); animation-range: entry 0% entry 100%; }</style>
      <div class="gap"></div><div class="card"></div><div class="gap"></div>`;
    const card = document.querySelector('.card');
    const at = async (y) => { scrollTo(0, y); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return Math.round(parseFloat(getComputedStyle(card).opacity) * 100) / 100; };
    const top = card.offsetTop;
    return [await at(top - innerHeight - 50), await at(top - innerHeight + 100), await at(top - innerHeight + 250)];
  });
  assert.deepEqual(reveal, [0, 0.5, 1]);                             // до входа, на середине входа, после полного входа

  // --- view-transition-name должен быть уникальным: дубль отменяет переход ---
  await set(`.a, .b { view-transition-name: hero; }`, '<div class="a">1</div><div class="b">2</div>');
  const vt = await page.evaluate(async () => {
    let changed = false;
    const t = document.startViewTransition(() => { changed = true; });
    const ready = await t.ready.then(() => 'ok', (e) => e.name);
    await t.finished;
    return { ready, changed };
  });
  assert.deepEqual(vt, { ready: 'InvalidStateError', changed: true }); // DOM обновился, анимации не было
});

console.log('animations ok');
