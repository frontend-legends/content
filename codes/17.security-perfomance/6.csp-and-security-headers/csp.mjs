// Проверки к 17.06 в Chromium: CSP не даёт выполниться встроенному скрипту, nonce пропускает доверенный,
// 'unsafe-inline' снова всё открывает, 'self' пускает внешний скрипт только со своего origin. Внедрённые
// скрипты здесь безвредны (ставят флаг), атака не выполняется. Плюс разбор политики и набор заголовков в Node.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { withPage } from '../../_lib/browser.mjs';

const NONCE = 'n0nce-abc123';
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/ext.js') { res.setHeader('content-type', 'text/javascript'); return res.end('window.extRan = true;'); }
  const policy = u.searchParams.get('csp');
  res.setHeader('content-type', 'text/html');
  if (policy === 'self') res.setHeader('Content-Security-Policy', "script-src 'self'");
  if (policy === 'nonce') res.setHeader('Content-Security-Policy', `script-src 'nonce-${NONCE}'`);
  if (policy === 'unsafe') res.setHeader('Content-Security-Policy', "script-src 'self' 'unsafe-inline'");
  // встроенный скрипт и скрипт с nonce просто ставят безвредные флаги; CSP решает, выполнятся ли они
  res.end(`<!doctype html><html lang=ru><head><meta charset=utf-8></head><body>
  <script>window.inlineRan = true;</script>
  <script nonce="${NONCE}">window.noncedRan = true;</script>
  <script src="/ext.js"></script>
  </body></html>`);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

await withPage(async (page) => {
  const run = async (csp) => { await page.goto(`${base}/?csp=${csp}`, { waitUntil: 'load' }); return page.evaluate(() => ({ inline: !!window.inlineRan, nonced: !!window.noncedRan, ext: !!window.extRan })); };

  // без политики выполняется всё
  assert.deepEqual(await run('none'), { inline: true, nonced: true, ext: true });
  // script-src 'self': встроенные скрипты заблокированы, свой внешний — разрешён
  assert.deepEqual(await run('self'), { inline: false, nonced: false, ext: true });
  // nonce: доверенный встроенный с этим nonce выполнился, обычный встроенный — нет; внешний без 'self' тоже заблокирован
  assert.deepEqual(await run('nonce'), { inline: false, nonced: true, ext: false });
  // 'unsafe-inline' снова разрешает любые встроенные — защита CSP от XSS выключена
  assert.deepEqual(await run('unsafe'), { inline: true, nonced: true, ext: true });
});
server.close();

// --- разбор политики: слабая ли она ---
const parseCsp = (header) => Object.fromEntries(header.split(';').map((d) => d.trim().split(/\s+/)).filter((p) => p[0]).map(([k, ...v]) => [k, v]));
const weaknesses = (header) => {
  const csp = parseCsp(header);
  const out = [];
  const scripts = csp['script-src'] ?? csp['default-src'] ?? [];
  if (scripts.includes("'unsafe-inline'")) out.push('unsafe-inline'); // открывает любые встроенные скрипты
  if (scripts.includes("'unsafe-eval'")) out.push('unsafe-eval');     // открывает eval и new Function
  if (!csp['script-src'] && !csp['default-src']) out.push('no-script-src');
  return out;
};
assert.deepEqual(weaknesses("default-src 'self'; script-src 'self'"), []);
assert.deepEqual(weaknesses("script-src 'self' 'unsafe-inline' 'unsafe-eval'"), ['unsafe-inline', 'unsafe-eval']);
assert.deepEqual(weaknesses("img-src *"), ['no-script-src']);
assert.deepEqual(parseCsp("script-src 'self' https://cdn.example")['script-src'], ["'self'", 'https://cdn.example']);

// --- набор заголовков безопасности: чего не хватает ---
const required = {
  'content-security-policy': 'ограничивает источники ресурсов — слой против XSS',
  'strict-transport-security': 'всегда HTTPS на домен, защита от downgrade',
  'x-content-type-options': 'nosniff — запрет угадывать MIME-тип',
  'x-frame-options': 'запрет встраивания в iframe — против clickjacking',
  'referrer-policy': 'сколько URL утекает в Referer',
};
const audit = (headers) => Object.keys(required).filter((h) => !(h in headers));
const lower = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]));
assert.deepEqual(audit(lower({ 'Content-Security-Policy': "default-src 'self'", 'X-Content-Type-Options': 'nosniff' })),
  ['strict-transport-security', 'x-frame-options', 'referrer-policy']); // чего не хватает
assert.deepEqual(audit(lower(Object.fromEntries(Object.keys(required).map((h) => [h, 'set'])))), []); // всё на месте
// устаревший заголовок, который не нужен
assert.ok(!('x-xss-protection' in required)); // X-XSS-Protection устарел, полагаются на CSP

console.log('csp ok');
