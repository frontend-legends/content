// Проверки к 3.01 в Chromium: разбор и нормализация URL по стандарту WHATWG, относительные адреса,
// фрагмент не уходит на сервер, URLSearchParams и кодирование, origin и непрозрачный origin,
// безопасный контекст: localhost — да, обычный http — нет, и какие API без него пропадают.
// Запуск: cd codes && node run.mjs 03.web/1.what-is-web
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { withPage } from '../../_lib/browser.mjs';

const requests = [];
const server = createServer((req, res) => {
  requests.push(req.url);
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><title>Каталог</title>');
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

try {
  await withPage(async (page) => {
    await page.goto(base);

    // --- нормализация: регистр схемы и хоста, порт по умолчанию, точки в пути, пробелы и кириллица ---
    const norm = await page.evaluate(() => {
      const u = new URL('HTTPS://Shop.Example.COM:443/catalog/../tea/улун молочный?sort=price#reviews');
      return { href: u.href, protocol: u.protocol, host: u.host, port: u.port, pathname: u.pathname, search: u.search, hash: u.hash, origin: u.origin };
    });
    assert.deepEqual(norm, {
      href: 'https://shop.example.com/tea/%D1%83%D0%BB%D1%83%D0%BD%20%D0%BC%D0%BE%D0%BB%D0%BE%D1%87%D0%BD%D1%8B%D0%B9?sort=price#reviews',
      protocol: 'https:', host: 'shop.example.com', port: '', pathname: '/tea/%D1%83%D0%BB%D1%83%D0%BD%20%D0%BC%D0%BE%D0%BB%D0%BE%D1%87%D0%BD%D1%8B%D0%B9',
      search: '?sort=price', hash: '#reviews', origin: 'https://shop.example.com',
    });
    // нестандартный порт сохраняется, домен на кириллице превращается в punycode
    const more = await page.evaluate(() => ({
      port: new URL('http://shop.example:8080/').host,
      idn: new URL('https://чай.рф/каталог').hostname,
      canParse: [URL.canParse('/tea'), URL.canParse('/tea', 'https://shop.example')],
    }));
    assert.deepEqual(more, { port: 'shop.example:8080', idn: 'xn--80as4b.xn--p1ai', canParse: [false, true] });

    // --- относительные адреса разрешаются от базового ---
    const rel = await page.evaluate(() => {
      const b = 'https://shop.example/catalog/tea/oolong?page=2';
      return ['milk', '../coffee', '/cart', '?page=3', '#reviews', '//cdn.example/tea.png'].map((r) => new URL(r, b).href);
    });
    assert.deepEqual(rel, [
      'https://shop.example/catalog/tea/milk',
      'https://shop.example/catalog/coffee',
      'https://shop.example/cart',
      'https://shop.example/catalog/tea/oolong?page=3',
      'https://shop.example/catalog/tea/oolong?page=2#reviews',
      'https://cdn.example/tea.png',
    ]);

    // --- фрагмент на сервер не уходит ---
    requests.length = 0;
    await page.goto(`${base}/tea/oolong?sort=price#reviews`);
    assert.deepEqual(requests, ['/tea/oolong?sort=price']);
    requests.length = 0;
    await page.evaluate(() => { location.hash = '#delivery'; });
    await page.waitForTimeout(100);
    assert.equal(requests.length, 0);                                      // смена фрагмента — без запроса

    // --- строка запроса: склейка ломается, URLSearchParams кодирует ---
    const q = await page.evaluate(() => {
      const term = 'чай & молоко 100%';
      const glued = new URL('https://shop.example/search?q=' + term);
      const u = new URL('https://shop.example/search');
      u.searchParams.set('q', term);
      u.searchParams.append('tag', 'улун');
      return {
        gluedQ: glued.searchParams.get('q'),
        properQ: u.searchParams.get('q'),
        search: u.search,
        plusIsSpace: new URLSearchParams('q=чай+с+молоком').get('q'),
        encodeURI: encodeURIComponent('чай с молоком'),
      };
    });
    assert.equal(q.gluedQ, 'чай ');                                       // «&» разрезал значение
    assert.equal(q.properQ, 'чай & молоко 100%');
    assert.equal(q.search, '?q=%D1%87%D0%B0%D0%B9+%26+%D0%BC%D0%BE%D0%BB%D0%BE%D0%BA%D0%BE+100%25&tag=%D1%83%D0%BB%D1%83%D0%BD');
    assert.equal(q.plusIsSpace, 'чай с молоком');                         // «+» в строке запроса — пробел
    assert.equal(q.encodeURI, '%D1%87%D0%B0%D0%B9%20%D1%81%20%D0%BC%D0%BE%D0%BB%D0%BE%D0%BA%D0%BE%D0%BC'); // а encodeURIComponent кодирует пробел как %20

    // --- origin: схема, хост и порт; у data: и sandbox — непрозрачный ---
    const origins = await page.evaluate(() => {
      const o = (u) => new URL(u).origin;
      return {
        same: o('https://shop.example/a') === o('https://shop.example:443/b?x#y'),
        http: o('http://shop.example') === o('https://shop.example'),
        sub: o('https://api.shop.example') === o('https://shop.example'),
        port: o('https://shop.example:8443') === o('https://shop.example'),
        data: o('data:text/html,<p>hi</p>'),
      };
    });
    assert.deepEqual(origins, { same: true, http: false, sub: false, port: false, data: 'null' });
  });

  // --- безопасный контекст: localhost — да, обычный http — нет; мощные API без него пропадают ---
  await withPage(async (page) => {
    const probe = () => page.evaluate(() => ({
      secure: isSecureContext,
      subtle: typeof crypto.subtle,
      sw: 'serviceWorker' in navigator,
      media: typeof navigator.mediaDevices,
      clipboard: typeof navigator.clipboard,
    }));
    await page.goto(base);
    assert.deepEqual(await probe(), { secure: true, subtle: 'object', sw: true, media: 'object', clipboard: 'object' });
    await page.route('http://shop.test/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>стенд</title>' }));
    await page.goto('http://shop.test/');
    assert.deepEqual(await probe(), { secure: false, subtle: 'undefined', sw: false, media: 'undefined', clipboard: 'undefined' });
  });
} finally {
  server.close();
}

console.log('web ok');
