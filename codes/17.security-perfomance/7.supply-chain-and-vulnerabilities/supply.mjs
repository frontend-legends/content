// Проверки к 17.07 — защитные механизмы: Subresource Integrity в Chromium (подменённый скрипт не выполнится),
// обнаружение тайпсквоттинга, безопасный merge против prototype pollution, детерминизм lockfile, сканер секретов
// в бандле, проверка rel=noopener и безопасного редиректа. Вредоносного кода не выполняется.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { withPage } from '../../_lib/browser.mjs';

// --- SRI: браузер выполняет скрипт, только если его хеш совпал с заявленным ---
const lib = 'window.libLoaded = true;';
const goodHash = 'sha384-' + createHash('sha384').update(lib).digest('base64');
const wrongHash = 'sha384-' + createHash('sha384').update('подменённый код').digest('base64');
const server = createServer((req, res) => {
  if (req.url === '/lib.js') { res.setHeader('content-type', 'text/javascript'); res.setHeader('access-control-allow-origin', '*'); return res.end(lib); }
  const integrity = new URL(req.url, 'http://x').searchParams.get('i');
  res.setHeader('content-type', 'text/html');
  res.end(`<!doctype html><html lang=ru><body><script src="/lib.js" integrity="${integrity}" crossorigin="anonymous"></script></body></html>`);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
await withPage(async (page) => {
  const loads = async (integrity) => { await page.goto(`${base}/?i=${encodeURIComponent(integrity)}`, { waitUntil: 'load' }); return page.evaluate(() => !!window.libLoaded); };
  assert.equal(await loads(goodHash), true);    // хеш совпал — скрипт выполнен
  assert.equal(await loads(wrongHash), false);  // подменённый на CDN скрипт не совпадёт с хешем — браузер его не выполнит
});
server.close();

// --- тайпсквоттинг: пакет с именем, похожим на популярный ---
const distance = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
const popular = ['react', 'lodash', 'express', 'chalk', 'axios'];
const suspicious = (name) => popular.some((p) => p !== name && distance(name, p) > 0 && distance(name, p) <= 1);
assert.equal(suspicious('reakt'), true);       // одна буква от react
assert.equal(suspicious('expres'), true);      // одна буква от express
assert.equal(suspicious('react'), false);      // сам популярный пакет — не подозрителен
assert.equal(suspicious('my-utils'), false);   // непохожее имя

// --- prototype pollution: безопасный merge не даёт загрязнить Object.prototype ---
const DANGEROUS = new Set(['__proto__', 'constructor', 'prototype']);
const safeMerge = (target, source) => {
  for (const key of Object.keys(source)) {
    if (DANGEROUS.has(key)) continue;            // ключи-ловушки игнорируем
    if (source[key] && typeof source[key] === 'object') { target[key] ??= {}; safeMerge(target[key], source[key]); }
    else target[key] = source[key];
  }
  return target;
};
const untrusted = JSON.parse('{"name":"anna","__proto__":{"isAdmin":true}}'); // внешний объект с ключом-ловушкой
const merged = safeMerge({}, untrusted);
assert.equal(merged.name, 'anna');
assert.equal({}.isAdmin, undefined);            // прототип всех объектов чист — загрязнения не произошло
assert.ok(!('isAdmin' in Object.prototype));
// «чистый» словарь без прототипа вовсе не подвержен загрязнению через __proto__
const dict = Object.create(null);
dict.__proto__ = { isAdmin: true };             // это просто своё свойство, не setter прототипа
assert.equal(Object.getPrototypeOf(dict), null);
assert.equal({}.isAdmin, undefined);

// --- детерминизм установки: npm ci ставит версию из lockfile, а не максимум из диапазона ---
const pkgRange = '^4.17.0';
const lockfile = { 'lodash': '4.17.21' };
const satisfiesCaret = (version, base) => { const [a] = version.split('.'); const [b] = base.replace('^', '').split('.'); return a === b && version >= base.replace('^', ''); };
const npmCiInstall = (name) => lockfile[name];                 // ci берёт точную версию из lockfile
const npmInstallMax = (name, range, available) => available.filter((v) => satisfiesCaret(v, range)).sort().at(-1);
assert.equal(npmCiInstall('lodash'), '4.17.21');              // воспроизводимо на всех машинах
assert.equal(npmInstallMax('lodash', pkgRange, ['4.17.21', '4.18.0', '5.0.0']), '4.18.0'); // install может подтянуть новее в рамках диапазона
assert.notEqual(npmCiInstall('lodash'), npmInstallMax('lodash', pkgRange, ['4.17.21', '4.18.0'])); // поэтому в CI используют ci

// --- сканер секретов: не пускать ключи в клиентский бандл ---
const SECRET_PATTERNS = [/\bsk_live_[A-Za-z0-9]{10,}\b/, /\bAKIA[0-9A-Z]{16}\b/, /-----BEGIN (?:RSA )?PRIVATE KEY-----/];
const scan = (code) => SECRET_PATTERNS.some((re) => re.test(code));
assert.equal(scan('const key = "sk_live_abc123DEF456";'), true);           // секретный ключ Stripe
assert.equal(scan('const id = "AKIA1234567890ABCDEF";'), true);            // ключ AWS
assert.equal(scan('const pub = import.meta.env.VITE_PUBLIC_MAP_KEY;'), false); // публичный ключ — не секрет

// --- tabnabbing: target=_blank требует rel=noopener ---
const unsafeBlank = (links) => links.filter((l) => l.target === '_blank' && !/noopener/.test(l.rel ?? ''));
assert.deepEqual(unsafeBlank([{ href: '/a', target: '_blank' }, { href: '/b', target: '_blank', rel: 'noopener noreferrer' }]).map((l) => l.href), ['/a']);

// --- open redirect: редирект только на свой origin или из белого списка ---
const safeRedirect = (target) => { try { const u = new URL(target, 'https://shop.example'); return u.origin === 'https://shop.example' ? u.pathname : '/'; } catch { return '/'; } };
assert.equal(safeRedirect('/account'), '/account');
assert.equal(safeRedirect('https://evil.example/phish'), '/');       // чужой origin отклонён
assert.equal(safeRedirect('//evil.example'), '/');                   // протокол-относительный URL тоже

console.log('supply ok');
