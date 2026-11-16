// Проверки к 3.07: что видит робот без JavaScript и с ним, мягкая 404 в SPA и её исправление,
// JSON-LD (не выполняется, ломается на «</script>» в данных, экранирование \u003c), экранирование в sitemap,
// нормализация канонического адреса, проверка взаимности hreflang.
// Запуск: cd codes && node run.mjs 03.web/7.seo
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

// --- страница товара: клиентский рендеринг (пустая оболочка + скрипт) и серверный (всё в HTML) ---
const product = { slug: 'oolong', name: 'Улун молочный', description: 'Мягкий улун со сливочным ароматом' };
const head = (p) => `<title>${p.name} — Магазин чая</title>
  <meta name="description" content="${p.description}">
  <meta property="og:title" content="${p.name}">
  <link rel="canonical" href="https://shop.example/tea/${p.slug}">`;
const shell = '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Магазин чая</title><script src="/app.js" defer></script></head><body><div id="app"></div></body></html>';
const app = `
  const products = { oolong: ${JSON.stringify(product)} };
  const slug = location.pathname.split('/').pop();
  const p = products[slug];
  if (!p) {
    location.replace('/not-found');                                   // исправление мягкой 404: на адрес с настоящим 404
  } else {
    document.title = p.name + ' — Магазин чая';
    document.head.insertAdjacentHTML('beforeend', '<meta name="description" content="' + p.description + '"><link rel="canonical" href="https://shop.example/tea/' + p.slug + '">');
    document.getElementById('app').innerHTML = '<h1>' + p.name + '</h1><p>' + p.description + '</p>';
  }`;
const appSoft = app.replace("location.replace('/not-found');", "document.getElementById('app').textContent = 'Товар не найден';");
const server = createServer((req, res) => {
  if (req.url === '/app.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(app); }
  if (req.url === '/app-soft.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(appSoft); }
  if (req.url === '/not-found') { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); return res.end('<!doctype html><title>Не найдено</title><h1>Не найдено</h1>'); }
  if (req.url.startsWith('/ssr/')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><html lang="ru"><head><meta charset="utf-8">${head(product)}</head><body><div id="app"><h1>${product.name}</h1><p>${product.description}</p></div></body></html>`);
  }
  if (req.url.startsWith('/soft/')) {                                  // SPA с fallback на index.html: любой адрес — 200
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(shell.replace('/app.js', '/app-soft.js'));
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });  // /tea/* — та же оболочка
  res.end(shell);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

// сырой HTML — то, что получает робот без выполнения JavaScript и бот превью ссылок
const raw = async (path) => (await fetch(base + path)).text();
const csrRaw = await raw('/tea/oolong');
const ssrRaw = await raw('/ssr/tea/oolong');
assert.ok(!csrRaw.includes('<h1>') && !csrRaw.includes('og:title') && !csrRaw.includes('canonical'));
assert.match(csrRaw, /<title>Магазин чая<\/title>/);                  // один заголовок на все страницы
assert.ok(ssrRaw.includes('<h1>Улун молочный</h1>') && ssrRaw.includes('og:title') && ssrRaw.includes('rel="canonical"'));

const browser = await chromium.launch({ executablePath: findChromium() });
try {
  const look = async (path, javaScriptEnabled) => {
    const ctx = await browser.newContext({ javaScriptEnabled });
    const page = await ctx.newPage();
    await page.goto(base + path, { waitUntil: 'load' });
    const seen = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector('h1')?.textContent ?? null,
      canonical: document.querySelector('link[rel=canonical]')?.href ?? null,
    }));
    await ctx.close();
    return seen;
  };
  // без JavaScript клиентская страница пустая, после выполнения — полная
  assert.deepEqual(await look('/tea/oolong', false), { title: 'Магазин чая', h1: null, canonical: null });
  assert.deepEqual(await look('/tea/oolong', true), { title: 'Улун молочный — Магазин чая', h1: 'Улун молочный', canonical: 'https://shop.example/tea/oolong' });
  assert.deepEqual(await look('/ssr/tea/oolong', false), { title: 'Улун молочный — Магазин чая', h1: 'Улун молочный', canonical: 'https://shop.example/tea/oolong' });

  // --- мягкая 404: несуществующий товар отдаётся с 200 и текстом «не найден» ---
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const res = await page.goto(`${base}/soft/tea/unknown`, { waitUntil: 'load' });
    assert.equal(res.status(), 200);
    assert.equal(await page.textContent('#app'), 'Товар не найден');
    // исправление: скрипт уводит на адрес, для которого сервер отвечает 404
    const notFound = page.waitForResponse((r) => r.url().endsWith('/not-found'));
    await page.goto(`${base}/tea/unknown`);
    assert.equal((await notFound).status(), 404);
    await page.waitForURL(`${base}/not-found`);
    await ctx.close();
  }

  // --- JSON-LD: данные, а не скрипт; «</script>» в данных обрывает блок; экранирование < спасает ---
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const render = (data, escape) => {
      const json = JSON.stringify(data);
      return `<script type="application/ld+json">${escape ? json.replace(/</g, '\\u003c') : json}</script>`;
    };
    const read = () => page.evaluate(() => {
      const block = document.querySelector('script[type="application/ld+json"]');
      let data = null, error = null;
      try { data = JSON.parse(block.textContent); } catch (e) { error = e.name; }
      return { data, error, bodyText: document.body.innerText.trim() };         // видимый текст
    });
    const ok = { '@context': 'https://schema.org', '@type': 'Product', name: 'Улун молочный' };
    await page.setContent(`<body>${render(ok)}</body>`);
    const plain = await read();
    assert.equal(plain.data.name, 'Улун молочный');
    assert.deepEqual(errors, []);                                       // как JavaScript блок не выполняется

    const tricky = { ...ok, name: 'Улун </script> молочный' };           // название из CMS
    await page.setContent(`<body>${render(tricky, false)}</body>`);
    const broken = await read();
    assert.equal(broken.error, 'SyntaxError');                          // блок оборвался на </script>
    assert.equal(broken.bodyText, 'молочный"}');                         // хвост JSON виден на странице
    await page.setContent(`<body>${render(tricky, true)}</body>`);
    const fixed = await read();
    assert.equal(fixed.data.name, 'Улун </script> молочный');           // \u003c — тот же символ для JSON
    assert.equal(fixed.bodyText, '');
    assert.deepEqual(errors, []);

    // --- sitemap: адрес с & без экранирования ломает XML ---
    const url = 'https://shop.example/catalog?type=oolong&sort=price';
    const xml = (loc) => `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${loc}</loc></url></urlset>`;
    const parse = (text) => page.evaluate((t) => {
      const doc = new DOMParser().parseFromString(t, 'application/xml');
      return { error: doc.querySelector('parsererror') !== null, locs: [...doc.getElementsByTagName('loc')].map((l) => l.textContent) };
    }, text);
    assert.equal((await parse(xml(url))).error, true);
    const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    assert.deepEqual(await parse(xml(escapeXml(url))), { error: false, locs: [url] });
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}

// --- канонический адрес: без меток, хеша, лишнего слеша; параметры, меняющие содержимое, — в одном порядке ---
const CONTENT_PARAMS = new Set(['page', 'type']);
function canonical(input) {
  const url = new URL(input);
  url.hash = '';
  const kept = [...url.searchParams].filter(([key]) => CONTENT_PARAMS.has(key)).sort(([a], [b]) => a.localeCompare(b));
  url.search = new URLSearchParams(kept).toString();
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1);
  return url.href;
}
assert.equal(canonical('https://Shop.Example:443/tea/oolong/?utm_source=tg&sort=price#reviews'), 'https://shop.example/tea/oolong');
assert.equal(canonical('https://shop.example/catalog?utm_medium=email&type=oolong&page=2'), 'https://shop.example/catalog?page=2&type=oolong');
assert.equal(canonical('https://shop.example/catalog?page=2&type=oolong'), canonical('https://shop.example/catalog/?type=oolong&page=2&gclid=x'));
assert.equal(canonical('https://shop.example/Tea/Oolong'), 'https://shop.example/Tea/Oolong'); // путь чувствителен к регистру — не трогаем

// --- hreflang: каждая версия перечисляет себя и все остальные; связи взаимны ---
function checkHreflang(pages) {
  const problems = [];
  for (const [url, alternates] of Object.entries(pages)) {
    if (!Object.values(alternates).includes(url)) problems.push(`${url}: нет ссылки на себя`);
    for (const [lang, target] of Object.entries(alternates)) {
      if (target === url || lang === 'x-default') continue;
      if (!pages[target]) { problems.push(`${url}: ${lang} ведёт на неизвестную страницу ${target}`); continue; }
      if (!Object.values(pages[target]).includes(url)) problems.push(`${target}: нет обратной ссылки на ${url}`);
    }
  }
  return problems;
}
const ru = 'https://shop.example/ru/tea/oolong', en = 'https://shop.example/en/tea/oolong', kk = 'https://shop.example/kk/tea/oolong';
assert.deepEqual(checkHreflang({
  [ru]: { ru, en, kk, 'x-default': en },
  [en]: { en, ru, 'x-default': en },                                    // забыли казахскую версию
  [kk]: { ru, en },                                                     // забыли себя
}), [
  `${kk}: нет ссылки на себя`,
  `${en}: нет обратной ссылки на ${kk}`,
]);
console.log('seo ok');
