// Проверки к 5.05 в Chromium: атрибут против свойства (value после ввода, defaultValue, href, id, неизвестные атрибуты,
// неверный type), булевые и перечислимые атрибуты, dataset, id как глобальная переменная и CSS.escape,
// обработчик в атрибуте видит поля формы, onclick перезаписывается, inert, popover и commandfor, target="_blank" и opener.
// Запуск: cd codes && node run.mjs 05.html/5.attributes
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { withPage } from '../../_lib/browser.mjs';

const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  if (req.url.startsWith('/child')) return res.end('<!doctype html><script>document.title = window.opener ? "opener" : "no-opener"</script>');
  res.end(`<!doctype html><a id="blank" href="/child" target="_blank">отзывы</a><a id="withopener" href="/child" target="_blank" rel="opener">отзывы</a>`);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

try {
  await withPage(async (page) => {
    await page.goto(base);                                       // настоящий адрес, чтобы относительные ссылки разрешались
    const set = (body) => page.setContent(`<!doctype html><html lang="ru"><body>${body}</body></html>`);

    // --- value: атрибут — начальное значение, свойство — текущее ---
    await set('<input id="qty" value="1"><input id="qty2" value="1">');
    await page.fill('#qty', '3');
    const v = await page.$eval('#qty', (i) => ({ attr: i.getAttribute('value'), prop: i.value, def: i.defaultValue }));
    assert.deepEqual(v, { attr: '1', prop: '3', def: '1' });
    // после ввода setAttribute('value') уже не меняет видимое значение; до ввода — меняет
    const after = await page.$eval('#qty', (i) => { i.setAttribute('value', '5'); return i.value; });
    const before = await page.$eval('#qty2', (i) => { i.setAttribute('value', '5'); return i.value; });
    assert.deepEqual([after, before], ['3', '5']);
    // reset формы возвращает к атрибуту
    await set('<form><input id="q" value="1"></form>');
    await page.fill('#q', '7');
    assert.equal(await page.$eval('#q', (i) => { i.form.reset(); return i.value; }), '1');

    // --- отражение: href — полный адрес, id — в обе стороны, class → className, for → htmlFor ---
    await set('<a id="link" href="/tea?sort=price" class="nav">Чай</a><label id="lbl" for="qty">Количество</label><div id="box" data-x="1" price="990"></div>');
    const refl = await page.evaluate(() => {
      const a = document.getElementById('link');
      a.id = 'catalog';
      const box = document.getElementById('box');
      box.discount = 10;                                        // своё свойство атрибута не создаёт
      return {
        hrefAttr: a.getAttribute('href'), hrefProp: a.href.replace(location.origin, ''),
        idAttr: a.getAttribute('id'), cls: a.className, htmlFor: document.getElementById('lbl').htmlFor,
        price: box.price, discountAttr: box.getAttribute('discount'),
      };
    });
    assert.deepEqual(refl, { hrefAttr: '/tea?sort=price', hrefProp: '/tea?sort=price', idAttr: 'catalog', cls: 'nav', htmlFor: 'qty', price: undefined, discountAttr: null });
    assert.equal(await page.$eval('#catalog', (a) => a.href), `${base}/tea?sort=price`); // свойство href — абсолютный адрес
    // неверное значение перечислимого атрибута: свойство показывает значение по умолчанию
    await set('<input id="t" type="phone">');
    assert.deepEqual(await page.$eval('#t', (i) => [i.getAttribute('type'), i.type]), ['phone', 'text']);

    // --- булевые атрибуты работают наличием, перечислимые понимают «false» ---
    await set(`
      <button id="b1" disabled="false">Купить</button>
      <img id="i1" src="data:," alt="" draggable="false">
      <div id="d1" contenteditable="false">текст</div>
      <div id="d2" hidden="false">скрыт</div>`);
    const flags = await page.evaluate(() => ({
      disabled: document.getElementById('b1').disabled,
      draggable: document.getElementById('i1').draggable,
      editable: document.getElementById('d1').isContentEditable,
      hidden: document.getElementById('d2').hidden,
    }));
    assert.deepEqual(flags, { disabled: true, draggable: false, editable: false, hidden: true });
    const off = await page.$eval('#b1', (b) => { b.disabled = false; return b.hasAttribute('disabled'); });
    assert.equal(off, false);                                     // свойство false удаляет атрибут

    // --- dataset: camelCase и строки ---
    await set('<button id="add" data-product-id="42" data-in-stock="true" data-price="990">В корзину</button>');
    const ds = await page.$eval('#add', (b) => {
      const before = { id: b.dataset.productId, stock: b.dataset.inStock, type: typeof b.dataset.price };
      b.dataset.isAdded = true;
      b.dataset.count = 2;
      delete b.dataset.inStock;
      return { ...before, added: b.getAttribute('data-is-added'), count: b.getAttribute('data-count'), stockAttr: b.hasAttribute('data-in-stock') };
    });
    assert.deepEqual(ds, { id: '42', stock: 'true', type: 'string', added: 'true', count: '2', stockAttr: false });

    // --- id: глобальная переменная, уникальность, CSS.escape ---
    await set('<div id="cart">корзина</div><div id="cart">вторая</div><p id="1st">первый</p>');
    const ids = await page.evaluate(() => {
      let bad;
      try { document.querySelector('#1st'); } catch (e) { bad = e.name; }
      return {
        global: window.cart instanceof HTMLCollection ? 'collection' : window.cart?.textContent,
        byId: document.getElementById('cart').textContent,
        bad,
        escaped: document.querySelector('#' + CSS.escape('1st')).textContent,
      };
    });
    assert.deepEqual(ids, { global: 'collection', byId: 'корзина', bad: 'SyntaxError', escaped: 'первый' });
    await set('<div id="cart">корзина</div>');
    assert.equal(await page.evaluate(() => window.cart.textContent), 'корзина');   // элемент доступен как window.cart

    // --- обработчик в атрибуте: this — элемент, видны поля формы; свойство onclick одно, слушателей — много ---
    await set(`<form><input name="qty" value="3"><button type="button" id="b" onclick="window.__seen = [this.id, qty.value, typeof event]">ок</button></form>`);
    await page.click('#b');
    assert.deepEqual(await page.evaluate(() => window.__seen), ['b', '3', 'object']);
    const handlers = await page.evaluate(() => {
      const log = [];
      const b = document.getElementById('b');
      b.onclick = () => log.push('первый');
      b.onclick = () => log.push('второй');
      b.addEventListener('click', () => log.push('слушатель 1'));
      b.addEventListener('click', () => log.push('слушатель 2'));
      b.click();
      return log;
    });
    assert.deepEqual(handlers, ['второй', 'слушатель 1', 'слушатель 2']);

    // --- inert: поддерево не фокусируется, не кликается и выпадает из дерева доступности ---
    await set('<main inert><button id="in">Купить</button></main><button id="out">Оплатить</button>');
    const pos = await page.evaluate(() => {
      const b = document.getElementById('in');
      b.addEventListener('click', () => { window.__clicked = true; });
      b.focus();
      const r = b.getBoundingClientRect();
      return { focused: document.activeElement === b, x: r.x + 3, y: r.y + 3 };
    });
    await page.mouse.click(pos.x, pos.y);
    assert.deepEqual({ focused: pos.focused, clicked: await page.evaluate(() => window.__clicked ?? false) }, { focused: false, clicked: false });
    // дерево доступности самого Chromium (Playwright getByRole инертность не учитывает)
    const cdp = await page.context().newCDPSession(page);
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    await cdp.detach();
    const visible = nodes.filter((n) => n.role?.value === 'button' && !n.ignored).map((n) => n.name?.value);
    assert.deepEqual(visible, ['Оплатить']);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'out');

    // --- popover: верхний слой, закрытие кликом мимо и Esc, второй auto закрывает первый; manual — нет ---
    await set(`
      <button id="t1" popovertarget="filters">Фильтры</button><button id="t2" popovertarget="sort">Сортировка</button>
      <div id="filters" popover>фильтры</div><div id="sort" popover>сортировка</div>
      <div id="toast" popover="manual">Добавлено в корзину</div><p id="far" style="margin-top:400px">пусто</p>`);
    const open = (id) => page.$eval('#' + id, (e) => e.matches(':popover-open'));
    await page.click('#t1');
    assert.equal(await open('filters'), true);
    await page.click('#t2');
    assert.deepEqual([await open('filters'), await open('sort')], [false, true]);
    await page.mouse.click(600, 500);
    assert.equal(await open('sort'), false);                     // клик мимо закрыл
    await page.$eval('#toast', (t) => t.showPopover());
    await page.mouse.click(600, 500);
    await page.keyboard.press('Escape');
    assert.equal(await open('toast'), true);                     // manual закрывают только кодом
    await page.click('#t1');
    await page.keyboard.press('Escape');
    assert.equal(await open('filters'), false);

    // --- commandfor: кнопка открывает модальный dialog без JavaScript ---
    await set(`<button commandfor="confirm" command="show-modal">Удалить</button>
      <dialog id="confirm"><button commandfor="confirm" command="close">Отмена</button></dialog>`);
    await page.click('text=Удалить');
    assert.equal(await page.$eval('#confirm', (d) => d.matches(':modal')), true);
    await page.click('text=Отмена');
    assert.equal(await page.$eval('#confirm', (d) => d.open), false);

    // --- target="_blank" сам добавляет noopener; rel="opener" возвращает доступ ---
    await page.goto(base);
    const popupTitle = async (sel) => {
      const [popup] = await Promise.all([page.waitForEvent('popup'), page.click(sel)]);
      await popup.waitForLoadState();
      const t = await popup.title();
      await popup.close();
      return t;
    };
    assert.equal(await popupTitle('#blank'), 'no-opener');
    assert.equal(await popupTitle('#withopener'), 'opener');
  });
} finally {
  server.close();
}

console.log('attributes ok');
