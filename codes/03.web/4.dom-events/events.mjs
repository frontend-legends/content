// Проверки к 3.04 в Chromium: живые и статичные коллекции, удаление в цикле по живой коллекции, innerHTML += теряет обработчики,
// DocumentFragment пустеет после вставки, фазы события и порядок на цели, stopPropagation и stopImmediatePropagation,
// preventDefault в passive-слушателе, пассивный по умолчанию wheel на window, focus не всплывает (focusin и перехват),
// делегирование через closest, CustomEvent не всплывает по умолчанию, dispatchEvent синхронный, isTrusted,
// недоверенный keydown не печатает, signal и once, порядок requestAnimationFrame и setTimeout.
// Запуск: cd codes && node run.mjs 03.web/4.dom-events
import assert from 'node:assert/strict';
import { withPage } from '../../_lib/browser.mjs';

await withPage(async (page) => {
  const set = (body) => page.setContent(`<!doctype html><html lang="ru"><body>${body}</body></html>`);

  // --- живая коллекция против снимка ---
  await set('<ul id="cart"><li class="item">Улун</li><li class="item">Пуэр</li><li class="item">Сенча</li><li class="item">Габа</li></ul>');
  const coll = await page.evaluate(() => {
    const live = document.getElementsByClassName('item');
    const snap = document.querySelectorAll('.item');
    document.getElementById('cart').insertAdjacentHTML('beforeend', '<li class="item">Матча</li>');
    const sizes = [live.length, snap.length];
    // классическая ошибка: снимаем класс в цикле по живой коллекции — элементы «уезжают» из-под индекса
    for (let i = 0; i < live.length; i++) live[i].classList.remove('item');
    return { sizes, left: document.querySelectorAll('.item').length };
  });
  assert.deepEqual(coll, { sizes: [5, 4], left: 2 });                     // обработана только половина

  // --- innerHTML += пересоздаёт содержимое и теряет обработчики ---
  await set('<ul id="list"><li><button id="buy">Купить</button></li></ul>');
  const lost = await page.evaluate(() => {
    let clicks = 0;
    document.getElementById('buy').addEventListener('click', () => clicks++);
    document.getElementById('list').innerHTML += '<li>Новый товар</li>';
    document.getElementById('buy').click();
    const afterInner = clicks;
    document.getElementById('buy').addEventListener('click', () => clicks++);
    document.getElementById('list').insertAdjacentHTML('beforeend', '<li>Ещё товар</li>');
    document.getElementById('buy').click();
    return [afterInner, clicks];
  });
  assert.deepEqual(lost, [0, 1]);                                          // после += обработчика нет, insertAdjacentHTML его сохранил

  // --- DocumentFragment пустеет после вставки ---
  const frag = await page.evaluate(() => {
    const f = document.createDocumentFragment();
    for (const name of ['Улун', 'Пуэр']) { const li = document.createElement('li'); li.textContent = name; f.append(li); }
    document.getElementById('list').append(f);
    return [f.childNodes.length, document.querySelectorAll('#list li').length];
  });
  assert.deepEqual(frag, [0, 5]);

  // --- фазы: перехват сверху вниз, цель, всплытие; на цели перехват раньше всплытия, даже если добавлен позже ---
  await set('<div id="card"><button id="btn">В корзину</button></div>');
  const phases = await page.evaluate(() => {
    const log = [];
    const btn = document.getElementById('btn'), card = document.getElementById('card');
    btn.addEventListener('click', () => log.push('цель: всплытие'));
    btn.addEventListener('click', () => log.push('цель: перехват'), { capture: true });
    card.addEventListener('click', () => log.push('card: всплытие'));
    card.addEventListener('click', () => log.push('card: перехват'), true);
    document.addEventListener('click', () => log.push('document: всплытие'));
    window.addEventListener('click', () => log.push('window: перехват'), true);
    btn.click();
    return log;
  });
  assert.deepEqual(phases, ['window: перехват', 'card: перехват', 'цель: перехват', 'цель: всплытие', 'card: всплытие', 'document: всплытие']);

  // --- stopPropagation против stopImmediatePropagation ---
  const stops = await page.evaluate(() => {
    const run = (method) => {
      const log = [];
      const btn = document.createElement('button');
      const wrap = document.createElement('div');
      wrap.append(btn); document.body.append(wrap);
      btn.addEventListener('click', (e) => { log.push('первый'); e[method](); });
      btn.addEventListener('click', () => log.push('второй'));
      wrap.addEventListener('click', () => log.push('родитель'));
      btn.click();
      wrap.remove();
      return log;
    };
    return { stop: run('stopPropagation'), immediate: run('stopImmediatePropagation') };
  });
  assert.deepEqual(stops, { stop: ['первый', 'второй'], immediate: ['первый'] });

  // --- preventDefault в passive-слушателе игнорируется с предупреждением ---
  const warnings = [];
  page.on('console', (m) => warnings.push(m.text()));
  const passive = await page.evaluate(() => {
    const el = document.body;
    const run = (opts) => {
      const h = (e) => e.preventDefault();
      el.addEventListener('order', h, opts);
      const ev = new Event('order', { cancelable: true });
      el.dispatchEvent(ev);
      el.removeEventListener('order', h, opts);
      return ev.defaultPrevented;
    };
    return { normal: run({}), passive: run({ passive: true }) };
  });
  assert.deepEqual(passive, { normal: true, passive: false });
  assert.ok(warnings.some((w) => /Unable to preventDefault inside passive event listener/.test(w)));

  // --- wheel на window пассивен по умолчанию: preventDefault не остановит прокрутку ---
  await set(`<div style="height: 3000px">длинный каталог</div>`);
  const wheel = async (opts) => {
    await page.evaluate((opts) => {
      window.__prevented = null;
      window.__h = (e) => { e.preventDefault(); window.__prevented = e.defaultPrevented; };
      window.addEventListener('wheel', window.__h, opts);
      scrollTo(0, 0);
    }, opts);
    await page.mouse.move(200, 200);
    await page.mouse.wheel(0, 300);
    await page.waitForFunction(() => window.__prevented !== null);
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => ({ prevented: window.__prevented, scrolled: scrollY > 0 }));
    await page.evaluate((opts) => window.removeEventListener('wheel', window.__h, opts), opts);
    return r;
  };
  assert.deepEqual(await wheel(undefined), { prevented: false, scrolled: true });
  assert.deepEqual(await wheel({ passive: false }), { prevented: true, scrolled: false });

  // --- focus не всплывает: родитель ловит его в фазе перехвата или через focusin ---
  await set('<form id="f"><input id="email"><input id="phone"></form>');
  const focus = await page.evaluate(() => {
    const log = [];
    const f = document.getElementById('f');
    f.addEventListener('focus', () => log.push('focus: всплытие'));
    f.addEventListener('focus', () => log.push('focus: перехват'), true);
    f.addEventListener('focusin', () => log.push('focusin'));
    document.getElementById('email').focus();
    return log;
  });
  assert.deepEqual(focus, ['focus: перехват', 'focusin']);

  // --- делегирование: один слушатель и closest ---
  await set('<ul id="cart"><li data-id="1"><span class="name">Улун</span> <button class="remove"><b>×</b></button></li><li data-id="2"><button class="remove">×</button></li></ul>');
  const deleg = await page.evaluate(() => {
    const removed = [];
    document.getElementById('cart').addEventListener('click', (e) => {
      const btn = e.target.closest('.remove');
      if (!btn) return;
      removed.push(btn.closest('li').dataset.id);
    });
    document.querySelector('[data-id="1"] b').click();       // клик по вложенному b внутри кнопки
    document.querySelector('[data-id="1"] .name').click();    // клик мимо кнопки
    const li = document.createElement('li'); li.dataset.id = '3'; li.innerHTML = '<button class="remove">×</button>';
    document.getElementById('cart').append(li);
    li.querySelector('button').click();                       // новый элемент — без своего слушателя
    return removed;
  });
  assert.deepEqual(deleg, ['1', '3']);

  // --- CustomEvent по умолчанию не всплывает; dispatchEvent синхронный и возвращает false при отмене ---
  const custom = await page.evaluate(() => {
    const log = [];
    const btn = document.querySelector('.remove');
    document.addEventListener('cart:remove', () => log.push('document'));
    btn.dispatchEvent(new CustomEvent('cart:remove', { detail: { id: 1 } }));
    log.push('после первого');
    btn.addEventListener('cart:remove', (e) => e.preventDefault());
    const allowed = btn.dispatchEvent(new CustomEvent('cart:remove', { bubbles: true, cancelable: true, detail: { id: 1 } }));
    log.push('после второго');
    return { log, allowed };
  });
  assert.deepEqual(custom, { log: ['после первого', 'document', 'после второго'], allowed: false });

  // --- isTrusted: клик мышью — доверенный, из кода — нет; недоверенный keydown не печатает ---
  await set('<button id="b">Купить</button><input id="q">');
  await page.evaluate(() => { window.__trusted = []; document.getElementById('b').addEventListener('click', (e) => window.__trusted.push(e.isTrusted)); });
  await page.click('#b');
  await page.evaluate(() => document.getElementById('b').click());
  assert.deepEqual(await page.evaluate(() => window.__trusted), [true, false]);
  const typed = await page.evaluate(() => {
    const q = document.getElementById('q');
    q.focus();
    q.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    q.dispatchEvent(new KeyboardEvent('keypress', { key: 'a', bubbles: true }));
    return q.value;
  });
  assert.equal(typed, '');
  await page.keyboard.type('a');
  assert.equal(await page.$eval('#q', (q) => q.value), 'a');

  // --- signal и once ---
  const opts = await page.evaluate(() => {
    let n = 0, m = 0;
    const ac = new AbortController();
    const b = document.getElementById('b');
    b.addEventListener('click', () => n++, { signal: ac.signal });
    b.addEventListener('click', () => m++, { once: true });
    b.click(); ac.abort(); b.click(); b.click();
    return [n, m];
  });
  assert.deepEqual(opts, [1, 1]);

  // --- requestAnimationFrame и setTimeout: порядок не задан — в разных прогонах выходит по-разному ---
  const order = await page.evaluate(() => new Promise((resolve) => {
    const log = ['sync'];
    setTimeout(() => log.push('setTimeout'), 0);
    Promise.resolve().then(() => log.push('microtask'));
    requestAnimationFrame(() => log.push('rAF'));
    setTimeout(() => setTimeout(() => resolve(log), 50), 0);
  }));
  assert.deepEqual(order.slice(0, 2), ['sync', 'microtask']);
  assert.ok(order.includes('rAF') && order.includes('setTimeout'));
  console.log(`  порядок в этом прогоне: ${order.join(' → ')}`);
});

console.log('events ok');
