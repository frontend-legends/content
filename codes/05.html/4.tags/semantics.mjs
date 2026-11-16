// Проверки к 5.04 в Chromium через дерево доступности (Playwright ariaSnapshot и getByRole):
// ориентиры страницы, header/footer внутри article, section с именем и без, уровни заголовков без «outline»,
// стиль h1 внутри section, div-суп против семантики, ссылка без href, таблица с caption и th,
// dialog: showModal, Esc, form method="dialog", недоступный фон; details с общим name.
// Запуск: cd codes && node run.mjs 05.html/4.tags
import assert from 'node:assert/strict';
import { withPage } from '../../_lib/browser.mjs';

await withPage(async (page) => {
  const set = (body, css = '') => page.setContent(`<!doctype html><html lang="ru"><head><title>Улун</title><style>${css}</style></head><body>${body}</body></html>`);
  const count = (role, opts) => page.getByRole(role, opts).count();

  // --- ориентиры: header и footer страницы — banner и contentinfo, внутри article — обычные ---
  await set(`
    <header>Магазин чая</header>
    <nav aria-label="Основная"><a href="/catalog">Каталог</a></nav>
    <main>
      <article>
        <header>Как заваривать улун</header>
        <section><h2>Вода</h2></section>
        <section aria-labelledby="t"><h2 id="t">Температура</h2></section>
        <footer>Автор: сомелье</footer>
      </article>
      <aside>Похожие сорта</aside>
    </main>
    <footer>© Магазин чая</footer>`);
  assert.equal(await count('banner'), 1);                    // только шапка страницы
  assert.equal(await count('contentinfo'), 1);               // только подвал страницы
  assert.equal(await count('navigation'), 1);
  assert.equal(await count('main'), 1);
  assert.equal(await count('complementary'), 1);
  assert.equal(await count('article'), 1);
  assert.equal(await count('region'), 1);                    // section — регион только с именем
  assert.equal(await page.getByRole('region').getAttribute('aria-labelledby'), 't');

  // --- div-суп: ни ориентиров, ни списка, ни ссылок-кнопок ---
  await set(`<div class="header"><div class="nav"><div class="item" onclick="location='/'">Каталог</div></div></div><div class="main">…</div>`);
  assert.equal(await count('banner') + await count('navigation') + await count('main') + await count('link') + await count('button'), 0);

  // --- outline не существует: h1 внутри section — всё равно первый уровень ---
  await set(`<h1>Блог</h1><section><h1>Как заваривать улун</h1><h3>Вода</h3></section>`);
  const snap = await page.locator('body').ariaSnapshot();
  assert.match(snap, /heading "Блог" \[level=1\]/);
  assert.match(snap, /heading "Как заваривать улун" \[level=1\]/);
  assert.match(snap, /heading "Вода" \[level=3\]/);           // пропуск уровня никто не «исправит»
  // и браузер больше не уменьшает h1 внутри section
  const h1 = await page.$$eval('h1', (hs) => hs.map((h) => getComputedStyle(h).fontSize));
  assert.deepEqual(h1, ['32px', '32px']);

  // --- ссылка без href — не ссылка и не в порядке Tab ---
  await set(`<a id="a1" href="/cart">Корзина</a><a id="a2" onclick="openCart()">Корзина</a><button id="b">Купить</button>`);
  assert.equal(await count('link'), 1);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'a1');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'b');   // a без href пропущена

  // --- таблица: caption даёт имя, th — заголовки строк и столбцов ---
  await set(`<table>
    <caption>Сравнение сортов</caption>
    <thead><tr><th scope="col">Сорт</th><th scope="col">Цена</th></tr></thead>
    <tbody><tr><th scope="row">Улун</th><td>990 ₽</td></tr></tbody></table>`);
  assert.equal(await count('table', { name: 'Сравнение сортов' }), 1);
  assert.equal(await count('columnheader'), 2);
  assert.equal(await count('rowheader', { name: 'Улун' }), 1);

  // --- dialog: модальный, Esc, form method="dialog", фон недоступен ---
  await set(`
    <button id="open">Удалить из корзины</button><a id="behind" href="/catalog">Каталог</a>
    <dialog id="dlg" aria-labelledby="dt">
      <h2 id="dt">Удалить улун?</h2>
      <form method="dialog"><button value="cancel" id="no">Отмена</button><button value="confirm" id="yes">Удалить</button></form>
    </dialog>`);
  await page.click('#open');
  await page.$eval('#dlg', (d) => d.showModal());
  assert.equal(await count('dialog', { name: 'Удалить улун?' }), 1);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'no'); // фокус ушёл в окно
  assert.equal(await page.$eval('#dlg', (d) => d.matches(':modal')), true);
  // фон инертен: в дерево доступности Chromium не попадает, фокус и клики не получает
  const axLink = async () => {
    const cdp = await page.context().newCDPSession(page);
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    await cdp.detach();
    const n = nodes.find((x) => x.role?.value === 'link' && x.name?.value === 'Каталог');
    return n ? !n.ignored : false;
  };
  assert.equal(await axLink(), false);
  assert.equal(await page.$eval('#behind', (a) => { a.focus(); return document.activeElement === a; }), false);
  const box = await page.$eval('#behind', (a) => { const r = a.getBoundingClientRect(); return [r.x + 5, r.y + 5]; });
  assert.notEqual(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, box), 'behind');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
  assert.notEqual(await page.evaluate(() => document.activeElement.id), 'behind');
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#dlg', (d) => d.open), false);
  await page.$eval('#dlg', (d) => d.showModal());
  await page.click('#yes');
  assert.deepEqual(await page.$eval('#dlg', (d) => [d.open, d.returnValue]), [false, 'confirm']);
  // немодальный show(): фон доступен
  await page.$eval('#dlg', (d) => d.show());
  assert.equal(await axLink(), true);
  assert.equal(await page.$eval('#behind', (a) => { a.focus(); return document.activeElement === a; }), true);

  // --- details с общим name — аккордеон, где открыта одна секция ---
  await set(`
    <details name="faq" id="d1" open><summary>Доставка</summary>Завтра</details>
    <details name="faq" id="d2"><summary>Оплата</summary>Картой</details>
    <details id="d3"><summary>Возврат</summary>14 дней</details>`);
  await page.click('#d2 summary');
  await page.click('#d3 summary');
  assert.deepEqual(await page.$$eval('details', (ds) => ds.map((d) => d.open)), [false, true, true]);
  const toggle = await page.evaluate(() => new Promise((r) => { const d = document.getElementById('d1'); d.addEventListener('toggle', (e) => r([e.oldState, e.newState]), { once: true }); d.open = true; }));
  assert.deepEqual(toggle, ['closed', 'open']);
  assert.equal(await page.$eval('#d2', (d) => d.open), false);          // открыв первую, закрыли вторую
  assert.equal(await count('group'), 3);                                 // details — группа с раскрывающимся summary
  assert.equal(await page.evaluate(() => CSS.supports('selector(::details-content)')), true); // содержимое details стилизуется отдельно
});

console.log('semantics ok');
