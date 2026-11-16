// Проверки к 4.09 в Chromium: домены shop.test, api.shop.test и other.test направлены на локальный сервер
// (--host-resolver-rules). HttpOnly не видна скрипту, но уходит с запросами; кука без Domain живёт только
// на своём хосте, с Domain — и на поддоменах; Path ограничивает адреса; удаление с другим Path не удаляет;
// Secure не ставится по http (кроме localhost); префикс __Host- требует Secure и запрещает Domain;
// кука больше 4 КБ отбрасывается; без SameSite кука ведёт себя как Lax — не уходит в межсайтовый fetch,
// но уходит при переходе по ссылке; Clear-Site-Data стирает куки; учётные данные в URL fetch запрещает.
// Запуск: cd codes && node run.mjs 04.network-api/9.auth
import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const seen = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  seen.push({ host: url.hostname, path: url.pathname, cookie: req.headers.cookie ?? '' });
  const set = url.searchParams.getAll('set');
  const headers = { 'content-type': 'text/html; charset=utf-8', 'access-control-allow-origin': req.headers.origin ?? '*', 'access-control-allow-credentials': 'true' };
  if (set.length) headers['set-cookie'] = set;
  if (url.pathname === '/logout-all') headers['clear-site-data'] = '"cookies"';
  res.writeHead(200, headers);
  res.end(`<!doctype html><title>${url.hostname}</title><a id="to-shop" href="http://shop.test:${server.address().port}/landing">в магазин</a>`);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const at = (host, path = '/') => `http://${host}:${port}${path}`;
const setUrl = (host, ...cookies) => at(host, `/set?${cookies.map((c) => `set=${encodeURIComponent(c)}`).join('&')}`);
const cookieFor = (host, path) => seen.filter((s) => s.host === host && s.path === path).at(-1)?.cookie;

const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ['--host-resolver-rules=MAP shop.test 127.0.0.1, MAP api.shop.test 127.0.0.1, MAP other.test 127.0.0.1'],
});
try {
  const context = await browser.newContext();
  const page = await context.newPage();

  // --- HttpOnly ---
  await page.goto(setUrl('shop.test', 'session=s1; HttpOnly; Path=/', 'theme=dark; Path=/'));
  assert.equal(await page.evaluate(() => document.cookie), 'theme=dark');                   // session не видна
  await page.goto(at('shop.test', '/catalog'));
  assert.equal(cookieFor('shop.test', '/catalog'), 'session=s1; theme=dark');               // но уходит на сервер

  // --- Domain: без него — только этот хост, с ним — и поддомены ---
  await page.goto(setUrl('shop.test', 'hostOnly=1; Path=/', 'wide=1; Domain=shop.test; Path=/'));
  await page.goto(at('api.shop.test', '/me'));
  const apiCookies = cookieFor('api.shop.test', '/me').split('; ');
  assert.ok(apiCookies.includes('wide=1'));
  assert.ok(!apiCookies.includes('hostOnly=1'));
  // поддомен не может поставить куку чужому домену
  await page.goto(setUrl('api.shop.test', 'foreign=1; Domain=other.test; Path=/'));
  assert.ok(!(await context.cookies()).some((c) => c.name === 'foreign'));

  // --- Path ---
  await page.goto(setUrl('shop.test', 'adminPrefs=1; Path=/admin'));
  await page.goto(at('shop.test', '/admin/orders'));
  await page.goto(at('shop.test', '/catalog'));
  assert.ok(cookieFor('shop.test', '/admin/orders').includes('adminPrefs=1'));
  assert.ok(!cookieFor('shop.test', '/catalog').includes('adminPrefs'));

  // --- удаление: нужны те же Path и Domain ---
  await page.goto(setUrl('shop.test', 'cart=c1; Path=/shop'));
  await page.goto(setUrl('shop.test', 'cart=; Max-Age=0'));                                  // Path по умолчанию — /
  assert.ok((await context.cookies()).some((c) => c.name === 'cart'));                       // не удалилась
  await page.goto(setUrl('shop.test', 'cart=; Max-Age=0; Path=/shop'));
  assert.ok(!(await context.cookies()).some((c) => c.name === 'cart'));

  // --- Secure и префикс __Host- ---
  await page.goto(setUrl('shop.test', 'secureOnHttp=1; Secure; Path=/'));
  assert.ok(!(await context.cookies()).some((c) => c.name === 'secureOnHttp'));              // по http не ставится
  await page.goto(setUrl('localhost', 'secureLocal=1; Secure; Path=/', '__Host-sid=1; Secure; Path=/', '__Host-bad=1; Secure; Path=/; Domain=localhost', '__Host-noSecure=1; Path=/'));
  const local = (await context.cookies()).filter((c) => c.domain === 'localhost').map((c) => c.name).sort();
  assert.deepEqual(local, ['__Host-sid', 'secureLocal']);                                    // localhost — безопасный контекст

  // --- размер ---
  await page.goto(setUrl('shop.test', `big=${'x'.repeat(4200)}; Path=/`, `ok=${'x'.repeat(3000)}; Path=/`));
  const names = (await context.cookies()).map((c) => c.name);
  assert.ok(!names.includes('big') && names.includes('ok'));

  // --- Path — не защита: страница своего origin читает куку другого пути через фрейм ---
  const viaFrame = await page.evaluate(async () => {
    const frame = Object.assign(document.createElement('iframe'), { src: '/admin/panel' });
    document.body.append(frame);
    await new Promise((r) => frame.addEventListener('load', r, { once: true }));
    return { own: document.cookie.includes('adminPrefs'), frame: frame.contentDocument.cookie.includes('adminPrefs=1') };
  });
  assert.deepEqual(viaFrame, { own: false, frame: true });

  // --- порт куки не различают ---
  const second = http.createServer((req, res) => { seen.push({ host: 'second', path: req.url, cookie: req.headers.cookie ?? '' }); res.end('ok'); });
  await new Promise((r) => second.listen(0, '127.0.0.1', r));
  await page.goto(setUrl('localhost', 'portless=1; Path=/'));
  await page.goto(`http://localhost:${second.address().port}/other-port`);
  assert.ok(seen.find((s) => s.path === '/other-port').cookie.includes('portless=1'));
  second.close();

  // --- SameSite=None без Secure отклоняется ---
  await page.goto(setUrl('localhost', 'noneInsecure=1; SameSite=None; Path=/', 'noneSecure=1; SameSite=None; Secure; Path=/'));
  const noneNames = (await context.cookies()).map((c) => c.name);
  assert.ok(!noneNames.includes('noneInsecure') && noneNames.includes('noneSecure'));

  // --- SameSite по умолчанию — Lax; Strict не уходит даже при переходе по ссылке ---
  await page.goto(setUrl('shop.test', 'lax=1; Path=/', 'strict=1; SameSite=Strict; Path=/'));
  const other = await context.newPage();
  await other.goto(at('other.test'));
  await other.evaluate((u) => fetch(u, { credentials: 'include' }).then((r) => r.text()), at('shop.test', '/api/cart'));
  assert.ok(!cookieFor('shop.test', '/api/cart').includes('lax=1'));                          // межсайтовый fetch — без куки
  await Promise.all([other.waitForURL(/landing/), other.click('#to-shop')]);
  assert.ok(cookieFor('shop.test', '/landing').includes('lax=1'));                            // переход по ссылке — с кукой
  assert.ok(!cookieFor('shop.test', '/landing').includes('strict=1'));                       // Strict — нет

  // --- Clear-Site-Data ---
  await page.goto(at('localhost', '/logout-all'));
  assert.ok(!(await context.cookies()).some((c) => c.domain === 'localhost'));

  // --- учётные данные в URL ---
  const credsInUrl = await page.evaluate((u) => fetch(u).then(() => 'ok', (e) => e.name), `http://user:pass@localhost:${port}/`);
  assert.equal(credsInUrl, 'TypeError');
  await context.close();
} finally {
  await browser.close();
  server.close();
}

// Basic — кодирование, а не шифрование
const basic = `Basic ${btoa('manager:qwerty')}`;
assert.equal(atob(basic.slice(6)), 'manager:qwerty');

console.log('cookies ok');
