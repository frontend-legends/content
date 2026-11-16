// Проверки к 5.09 в Chromium: имя с дефисом, :defined и обновление, порядок колбэков жизненного цикла,
// запрет атрибутов в конструкторе, свойство до define затеняет сеттер, closed shadow root,
// слоты, запасное содержимое, slotchange, ::slotted только для верхнего уровня, ::part,
// события: composed и подмена target, template инертен, декларативный Shadow DOM, form-associated элементы.
// Запуск: cd codes && node run.mjs 05.html/9.web-components
import assert from 'node:assert/strict';
import { withPage } from '../../_lib/browser.mjs';

await withPage(async (page) => {
  let imgHits = 0;
  await page.route('http://fl.test/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/tpl.png') { imgHits++; return route.fulfill({ status: 404, body: '' }); }
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pages[path] ?? '' });
  });
  const pages = {};
  const goto = async (path, html) => { pages[path] = html; await page.goto('http://fl.test' + path); };
  await goto('/', '<!doctype html><html lang="ru"><body></body></html>');
  const set = (html) => page.evaluate((h) => { document.body.innerHTML = h; }, html);

  // --- имя с дефисом; до define элемент не обновлён, :defined это видит ---
  const names = await page.evaluate(() => {
    let err;
    try { customElements.define('rating', class extends HTMLElement {}); } catch (e) { err = e.name; }
    return err;
  });
  assert.equal(names, 'SyntaxError');

  const upgrade = await page.evaluate(async () => {
    document.body.innerHTML = '<tea-rating id="r" value="4"></tea-rating>';
    const el = document.getElementById('r');
    el.rating = 5;                                            // свойство записали до define
    const before = { defined: el.matches(':defined'), proto: Object.getPrototypeOf(el) === HTMLElement.prototype };
    const log = [];
    class TeaRating extends HTMLElement {
      static observedAttributes = ['value'];
      #rating = 0;
      constructor() { super(); log.push('constructor'); }
      attributeChangedCallback(name, oldV, newV) { log.push(`attributeChanged:${name}:${oldV}→${newV}`); }
      connectedCallback() { log.push('connected'); }
      disconnectedCallback() { log.push('disconnected'); }
      get rating() { return this.#rating; }
      set rating(v) { this.#rating = v; log.push('setter'); }
    }
    customElements.define('tea-rating', TeaRating);
    await customElements.whenDefined('tea-rating');
    const after = { defined: el.matches(':defined'), own: Object.hasOwn(el, 'rating'), rating: el.rating };
    document.body.append(el);                                 // перенос = отключение и подключение
    el.setAttribute('title', 'не наблюдается');
    el.setAttribute('value', '3');
    return { before, after, log };
  });
  assert.deepEqual(upgrade.before, { defined: false, proto: true });
  assert.deepEqual(upgrade.after, { defined: true, own: true, rating: 5 }); // своё свойство затенило сеттер класса
  assert.deepEqual(upgrade.log, ['constructor', 'attributeChanged:value:null→4', 'connected', 'disconnected', 'connected', 'attributeChanged:value:4→3']);
  assert.equal(upgrade.log.includes('setter'), false);

  // --- в конструкторе нельзя добавлять атрибуты и детей: браузер сообщает об ошибке и создаёт «неизвестный» элемент ---
  // отдельная вкладка: ошибка здесь ожидаема, а withPage падает на любой ошибке страницы
  const side = await page.context().browser().newPage();
  const reported = [];
  side.on('pageerror', (e) => reported.push(e.message));
  const ctor = await side.evaluate(() => {
    customElements.define('bad-badge', class extends HTMLElement { constructor() { super(); this.setAttribute('role', 'status'); } });
    const el = document.createElement('bad-badge');
    return [el.constructor.name, el.getAttribute('role')];
  });
  await side.waitForTimeout(50);
  await side.close();
  assert.deepEqual(ctor, ['HTMLUnknownElement', null]);
  assert.ok(reported.some((m) => /The result must not have attributes/.test(m)));

  // --- closed shadow root не виден снаружи ---
  const modes = await page.evaluate(() => {
    const a = document.createElement('div'); a.attachShadow({ mode: 'open' });
    const b = document.createElement('div'); const inner = b.attachShadow({ mode: 'closed' });
    return [a.shadowRoot !== null, b.shadowRoot, inner instanceof ShadowRoot];
  });
  assert.deepEqual(modes, [true, null, true]);

  // --- слоты, запасное содержимое, slotchange, ::slotted только для верхнего уровня, ::part ---
  const slots = await page.evaluate(async () => {
    customElements.define('tea-card', class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = `
          <style>::slotted(p) { color: rgb(255, 0, 0); } ::slotted(b) { color: rgb(0, 0, 255); }</style>
          <h3><slot name="title">Без названия</slot></h3>
          <div class="body"><slot></slot></div>
          <button part="buy">В корзину</button>`;
      }
    });
    document.head.insertAdjacentHTML('beforeend', '<style>tea-card::part(buy) { border-radius: 12px; }</style>');
    document.body.innerHTML = `
      <tea-card id="c1"><span slot="title">Улун</span><p id="p1">Описание <b id="b1">жирным</b></p></tea-card>
      <tea-card id="c2"></tea-card>`;
    const c1 = document.getElementById('c1'), c2 = document.getElementById('c2');
    const titleSlot = (c) => c.shadowRoot.querySelector('slot[name=title]');
    let changed = 0;
    c2.shadowRoot.querySelector('slot:not([name])').addEventListener('slotchange', () => changed++);
    c2.append(document.createElement('p'));
    await new Promise((r) => setTimeout(r, 0));
    return {
      assigned: titleSlot(c1).assignedElements().map((e) => e.textContent),
      fallback: titleSlot(c2).assignedNodes().length,
      fallbackText: c2.shadowRoot.querySelector('h3').textContent,
      p: getComputedStyle(document.getElementById('p1')).color,
      b: getComputedStyle(document.getElementById('b1')).color,
      part: getComputedStyle(c1.shadowRoot.querySelector('button')).borderTopLeftRadius,
      changed,
    };
  });
  assert.deepEqual(slots, { assigned: ['Улун'], fallback: 0, fallbackText: 'Без названия', p: 'rgb(255, 0, 0)', b: 'rgb(255, 0, 0)', part: '12px', changed: 1 });
  // b унаследовал красный от p: ::slotted(b) не сработал — вложенный b не сам распределён в слот

  // --- события: target подменяется на хост; без composed событие не выходит из тени ---
  const events = await page.evaluate(() => {
    customElements.define('buy-button', class extends HTMLElement {
      constructor() {
        super();
        const root = this.attachShadow({ mode: 'open' });
        root.innerHTML = '<button id="inner">Купить</button>';
        root.getElementById('inner').addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('add-to-cart', { bubbles: true, composed: true, detail: { id: 7 } }));
          root.getElementById('inner').dispatchEvent(new CustomEvent('inner-only', { bubbles: true }));
        });
      }
    });
    document.body.innerHTML = '<buy-button id="host"></buy-button>';
    const seen = {};
    document.addEventListener('click', (e) => { seen.target = e.target.id; seen.path = e.composedPath()[0].id; });
    document.addEventListener('add-to-cart', (e) => { seen.detail = e.detail.id; });
    document.addEventListener('inner-only', () => { seen.innerOnly = true; });
    document.getElementById('host').shadowRoot.getElementById('inner').click();
    return seen;
  });
  assert.deepEqual(events, { target: 'host', path: 'inner', detail: 7 });  // inner-only до документа не дошло

  // --- template инертен: картинка внутри не загружается, скрипт не выполняется ---
  imgHits = 0;
  await set('<template id="tpl"><img src="/tpl.png" alt=""><script>window.__tplRan = true<\/script></template>');
  await page.waitForTimeout(200);
  assert.equal(imgHits, 0);
  assert.equal(await page.evaluate(() => window.__tplRan ?? false), false);
  await page.evaluate(() => document.body.append(document.getElementById('tpl').content.cloneNode(true)));
  await page.waitForTimeout(200);
  assert.equal(imgHits, 1);                                  // после вставки клона — загрузилась

  // --- декоративный Shadow DOM из HTML: работает при разборе страницы и setHTMLUnsafe, но не в innerHTML ---
  const dsd = '<price-tag id="pt"><template shadowrootmode="open"><style>span { font-weight: 700 }</style><span>990 ₽</span></template></price-tag>';
  await goto('/dsd', `<!doctype html><html lang="ru"><body>${dsd}</body></html>`);
  assert.equal(await page.$eval('#pt', (el) => el.shadowRoot?.textContent.includes('990 ₽')), true);
  const parsed = await page.evaluate((h) => {
    const a = document.createElement('div'); a.innerHTML = h;
    const b = document.createElement('div'); b.setHTMLUnsafe(h);
    return [a.querySelector('price-tag').shadowRoot, b.querySelector('price-tag').shadowRoot !== null];
  }, dsd);
  assert.deepEqual(parsed, [null, true]);

  // --- form-associated: значение в FormData, своя валидация, связь с label и reset ---
  const form = await page.evaluate(() => {
    customElements.define('qty-input', class extends HTMLElement {
      static formAssociated = true;
      #internals = this.attachInternals();
      #value = 0;
      connectedCallback() { this.value = Number(this.getAttribute('value') ?? 0); }
      get value() { return this.#value; }
      set value(v) {
        this.#value = v;
        this.#internals.setFormValue(String(v));
        if (v < 1) this.#internals.setValidity({ rangeUnderflow: true }, 'Минимум 1 упаковка');
        else this.#internals.setValidity({});
      }
      formResetCallback() { this.value = Number(this.getAttribute('value') ?? 0); }
      get form() { return this.#internals.form; }
    });
    document.body.innerHTML = `<form id="f"><label for="q">Количество</label><qty-input id="q" name="qty" value="2"></qty-input></form>`;
    const f = document.getElementById('f'), q = document.getElementById('q');
    const first = [...new FormData(f)].map(([k, v]) => `${k}=${v}`);
    q.value = 0;
    const invalid = [f.checkValidity(), q.matches(':invalid')];
    f.reset();
    return { first, invalid, afterReset: q.value, ownerForm: q.form === f, labels: q.matches(':defined') };
  });
  assert.deepEqual(form, { first: ['qty=2'], invalid: [false, true], afterReset: 2, ownerForm: true, labels: true });
});

console.log('components ok');
