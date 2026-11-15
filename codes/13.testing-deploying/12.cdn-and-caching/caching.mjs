// Проверки к 13.12: кеш при выкладке в настоящем Chromium — immutable-ассеты, no-cache против no-store,
// закешированный index.html после выкладки, удалённый ленивый чанк и vite:preloadError.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, rmSync, cpSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { project, run, bin, write, list } from '../../_lib/project.mjs';
import { withPage } from '../../_lib/browser.mjs';

const app = project({
  'package.json': JSON.stringify({ type: 'module' }),
  'index.html': '<!doctype html><meta charset="utf-8"><h1 id="v"></h1><button id="pay">Оформить</button><p id="out"></p><script type="module" src="/main.js"></script>',
  'main.js': `import { version } from './version.js';
document.getElementById('v').textContent = version;
window.addEventListener('vite:preloadError', (e) => { window.preloadError = e.payload.message; });
document.getElementById('pay').onclick = async () => {
  try { const m = await import('./checkout.js'); document.getElementById('out').textContent = m.title; }
  catch (e) { document.getElementById('out').textContent = 'ошибка: ' + e.message; }
};
`,
  'version.js': "export const version = 'v1';\n",
  'checkout.js': "export const title = 'Оформление v1';\n",
});
const build = () => { const r = run(bin('vite'), ['build', '--logLevel', 'error', '--emptyOutDir', 'false'], { cwd: app }); assert.equal(r.status, 0, r.out); };
const site = join(app, 'site'); // то, что раздаёт сервер

// сервер с политикой заголовков; считает запросы и ответы 304
function serve(policy) {
  const hits = {};
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const path = new URL(req.url, 'http://x').pathname;
      const file = join(site, path === '/' ? 'index.html' : path);
      hits[path] ??= { requests: 0, notModified: 0 };
      hits[path].requests++;
      if (!existsSync(file)) { res.statusCode = 404; return res.end(); }
      const body = readFileSync(file);
      const etag = `"${createHash('sha1').update(body).digest('hex').slice(0, 12)}"`;
      res.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream');
      res.setHeader('cache-control', path.startsWith('/assets/') ? policy.assets : policy.html);
      res.setHeader('etag', etag);
      if (req.headers['if-none-match'] === etag) { hits[path].notModified++; res.statusCode = 304; return res.end(); }
      res.end(body);
    }).listen(0, () => resolve({ server, hits, url: `http://localhost:${server.address().port}/` }));
  });
}
const deploy = () => { rmSync(site, { recursive: true, force: true }); cpSync(join(app, 'dist'), site, { recursive: true }); };

build();
deploy();
const v1Assets = list(app, 'site/assets');

// --- 1. правильная политика: ассеты immutable на год, index.html no-cache ---
{
  const { server, hits, url } = await serve({ assets: 'public, max-age=31536000, immutable', html: 'no-cache' });
  await withPage(async (page) => {
    await page.goto(url);
    await page.goto('about:blank');
    await page.goto(url); // повторный обычный переход
    const main = Object.keys(hits).find((p) => p.startsWith('/assets/index-'));
    assert.equal(hits[main].requests, 1);     // ассет второй раз не запрашивался
    assert.equal(hits['/'].requests, 2);      // HTML проверялся каждый раз
    assert.equal(hits['/'].notModified, 1);   // и вернулся 304 без тела
  });
  server.close();
}

// --- 2. no-store: HTML каждый раз целиком, без 304 ---
{
  const { server, hits, url } = await serve({ assets: 'public, max-age=31536000, immutable', html: 'no-store' });
  await withPage(async (page) => {
    await page.goto(url); await page.goto('about:blank'); await page.goto(url);
    assert.equal(hits['/'].requests, 2);
    assert.equal(hits['/'].notModified, 0);
  });
  server.close();
}

// --- 3. index.html закеширован на час: после выкладки пользователь видит старую версию ---
{
  const { server, hits, url } = await serve({ assets: 'public, max-age=31536000, immutable', html: 'max-age=3600' });
  await withPage(async (page) => {
    await page.goto(url);
    assert.equal(await page.textContent('#v'), 'v1');
    write(app, 'version.js', "export const version = 'v2';\n");
    build(); deploy();                                   // выкладка v2: новые хеши, старые ассеты удалены
    await page.goto('about:blank');
    await page.goto(url);
    assert.equal(await page.textContent('#v'), 'v1');    // HTML из кеша, сервер даже не спросили
    assert.equal(hits['/'].requests, 1);
  });
  server.close();
}

// --- 4. открытая вкладка v1, выкладка удалила старые чанки: ленивый импорт падает ---
write(app, 'version.js', "export const version = 'v1';\n");
write(app, 'checkout.js', "export const title = 'Оформление v1';\n");
rmSync(join(app, 'dist'), { recursive: true, force: true });
build(); deploy();
{
  const { server, url } = await serve({ assets: 'public, max-age=31536000, immutable', html: 'no-cache' });
  await withPage(async (page) => {
    await page.goto(url);
    write(app, 'checkout.js', "export const title = 'Оформление v2';\n");
    rmSync(join(app, 'dist'), { recursive: true, force: true });
    build(); deploy();                                   // старые ассеты не сохранили
    await page.click('#pay');
    await page.waitForFunction(() => document.getElementById('out').textContent !== '');
    assert.match(await page.textContent('#out'), /^ошибка: Failed to fetch dynamically imported module: .*\/assets\/checkout-.*\.js$/);
    assert.match(await page.evaluate(() => window.preloadError), /Failed to fetch dynamically imported module/); // Vite сообщил событием
  });
  server.close();
}

// --- 5. то же, но старые ассеты сохранены рядом с новыми ---
write(app, 'checkout.js', "export const title = 'Оформление v1';\n");
rmSync(join(app, 'dist'), { recursive: true, force: true });
build(); deploy();
{
  const { server, url } = await serve({ assets: 'public, max-age=31536000, immutable', html: 'no-cache' });
  await withPage(async (page) => {
    await page.goto(url);
    write(app, 'checkout.js', "export const title = 'Оформление v2';\n");
    build();                                              // --emptyOutDir false: dist хранит и старые файлы
    cpSync(join(app, 'dist'), site, { recursive: true });  // новые файлы поверх, старые остались
    assert.ok(list(app, 'site/assets').length > v1Assets.length);
    await page.click('#pay');
    await page.waitForFunction(() => document.getElementById('out').textContent !== '');
    assert.equal(await page.textContent('#out'), 'Оформление v1'); // вкладка догрузила чанк своей версии
  });
  server.close();
}

console.log('caching ok');
