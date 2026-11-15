// Проверки к 16.07 в Chromium: два микрофронтенда и оболочка. Своя копия библиотеки в каждом — два
// экземпляра состояния; общий модуль через import map — один; несовпадение версий общей зависимости;
// Shadow DOM изолирует стили; события связывают части без общего кода.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { withPage } from '../../_lib/browser.mjs';

const store = (version) => `let count = 0; const subs = new Set();
export const version = '${version}';
export const add = () => { count++; subs.forEach((f) => f(count)); };
export const subscribe = (f) => { subs.add(f); f(count); };
${version === '2.0.0' ? 'export const addMany = (n) => { for (let i = 0; i < n; i++) add(); };' : ''}
`;
const files = {
  // каждый микрофронтенд «вклеил» свою копию библиотеки
  '/bundled/catalog.js': "import { add } from './vendor-catalog/store.js';\nexport const mount = (el) => { el.innerHTML = '<button>В корзину</button>'; el.querySelector('button').onclick = add; };\n",
  '/bundled/header.js': "import { subscribe } from './vendor-header/store.js';\nexport const mount = (el) => subscribe((n) => { el.textContent = `Корзина: ${n}`; });\n",
  '/bundled/vendor-catalog/store.js': store('2.0.0'),
  '/bundled/vendor-header/store.js': store('2.0.0'),
  // общая зависимость по имени, адрес даёт оболочка через import map
  '/shared/catalog.js': "import { add } from 'shop-store';\nexport const mount = (el) => { el.innerHTML = '<button>В корзину</button>'; el.querySelector('button').onclick = add; };\n",
  '/shared/header.js': "import { subscribe } from 'shop-store';\nexport const mount = (el) => subscribe((n) => { el.textContent = `Корзина: ${n}`; });\n",
  '/shared/promo.js': "import { addMany } from 'shop-store';\nexport const mount = (el) => { el.innerHTML = '<button>Набор из 3</button>'; el.querySelector('button').onclick = () => addMany(3); };\n",
  '/libs/store@1.0.0.js': store('1.0.0'),
  '/libs/store@2.0.0.js': store('2.0.0'),
};
const shell = (importMap, modules) => `<!doctype html><meta charset="utf-8">
${importMap ? `<script type="importmap">${JSON.stringify({ imports: importMap })}</script>` : ''}
<header id="header"></header><main id="catalog"></main><aside id="promo"></aside>
<script type="module">
  window.errors = [];
  for (const [id, src] of ${JSON.stringify(modules)}) {
    try { (await import(src)).mount(document.getElementById(id)); } catch (e) { errors.push(id + ': ' + e.message); }
  }
  window.ready = true;
</script>`;
const pages = {
  '/bundled': shell(null, [['header', '/bundled/header.js'], ['catalog', '/bundled/catalog.js']]),
  '/shared': shell({ 'shop-store': '/libs/store@2.0.0.js' }, [['header', '/shared/header.js'], ['catalog', '/shared/catalog.js'], ['promo', '/shared/promo.js']]),
  '/old-shared': shell({ 'shop-store': '/libs/store@1.0.0.js' }, [['header', '/shared/header.js'], ['catalog', '/shared/catalog.js'], ['promo', '/shared/promo.js']]),
  '/isolation': `<!doctype html><meta charset="utf-8"><style>button { color: rgb(255, 0, 0); }</style>
    <button id="host-btn">Кнопка оболочки</button><shop-reviews></shop-reviews>
    <script>
      customElements.define('shop-reviews', class extends HTMLElement {
        connectedCallback() {
          const root = this.attachShadow({ mode: 'open' });
          root.innerHTML = '<style>button { color: rgb(0, 128, 0); }</style><button>Оставить отзыв</button>';
        }
      });
      // связь без общего кода: событие в окне
      window.received = [];
      window.addEventListener('shop:cart-changed', (e) => received.push(e.detail));
      document.querySelector('shop-reviews').dispatchEvent(new CustomEvent('shop:cart-changed', { detail: { count: 2 }, bubbles: true, composed: true }));
    </script>`,
};
const server = await new Promise((r) => {
  const s = createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (files[url]) { res.setHeader('content-type', 'text/javascript'); return res.end(files[url]); }
    if (pages[url]) { res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(pages[url]); }
    res.statusCode = 404; res.end();
  }).listen(0, () => r(s));
});
const base = `http://localhost:${server.address().port}`;

await withPage(async (page) => {
  const open = async (path) => { await page.goto(base + path); await page.waitForFunction(() => window.ready); };

  // --- свои копии: каталог добавляет в свою корзину, шапка смотрит в другую ---
  await open('/bundled');
  await page.click('#catalog button');
  await page.click('#catalog button');
  assert.equal(await page.textContent('#header'), 'Корзина: 0');

  // --- общий модуль: один адрес — один экземпляр ---
  await open('/shared');
  await page.click('#catalog button');
  await page.click('#promo button');
  assert.equal(await page.textContent('#header'), 'Корзина: 4');

  // --- оболочка даёт старую версию общей зависимости: промо ждёт addMany из 2.0 ---
  await open('/old-shared');
  const errors = await page.evaluate(() => window.errors);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^promo: The requested module 'shop-store' does not provide an export named 'addMany'/);
  await page.click('#catalog button');
  assert.equal(await page.textContent('#header'), 'Корзина: 1'); // остальные части живы

  // --- Shadow DOM: стили не проникают ни внутрь, ни наружу; событие проходит ---
  await page.goto(base + '/isolation');
  const iso = await page.evaluate(() => ({
    host: getComputedStyle(document.getElementById('host-btn')).color,
    inner: getComputedStyle(document.querySelector('shop-reviews').shadowRoot.querySelector('button')).color,
    received: window.received,
  }));
  assert.deepEqual(iso, { host: 'rgb(255, 0, 0)', inner: 'rgb(0, 128, 0)', received: [{ count: 2 }] });
});
server.close();
console.log('mfe ok');
