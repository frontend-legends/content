// Проверки к 13.10: SPA на статическом хостинге — резервная отдача index.html, её ловушка с ассетами,
// выкладка в подпапку и base.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { project, run, bin, list } from '../../_lib/project.mjs';
import { withPage } from '../../_lib/browser.mjs';

const app = project({
  'package.json': JSON.stringify({ type: 'module' }),
  'index.html': '<!doctype html><meta charset="utf-8"><title>Магазин</title><div id="app"></div><script type="module" src="/main.js"></script>',
  'main.js': `const route = location.pathname.replace(import.meta.env.BASE_URL, '/');
document.getElementById('app').textContent = route.startsWith('/products/') ? 'Товар ' + route.split('/').pop() : 'Каталог';
`,
});
const build = (outDir, base = '/') => {
  const r = run(bin('vite'), ['build', '--outDir', outDir, '--base', base, '--logLevel', 'error'], { cwd: app });
  assert.equal(r.status, 0, r.out);
  return join(app, outDir);
};
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };

// статический сервер: mode = 'none' | 'all' (любой путь → index.html) | 'routes' (только пути без расширения)
function serve(root, mode, prefix = '') {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (prefix) { if (!path.startsWith(prefix)) { res.statusCode = 404; return res.end('not found'); } path = path.slice(prefix.length - 1); }
      const file = join(root, path === '/' ? 'index.html' : path);
      const send = (f, status = 200) => { res.statusCode = status; res.setHeader('content-type', types[extname(f)] ?? 'application/octet-stream'); res.end(readFileSync(f)); };
      if (existsSync(file) && statSync(file).isFile()) return send(file);
      if (mode === 'all') return send(join(root, 'index.html'));
      if (mode === 'routes' && !extname(path)) return send(join(root, 'index.html'));
      res.statusCode = 404; res.end('not found');
    }).listen(0, () => resolve(server));
  });
}
async function visit(server, path) {
  const url = `http://localhost:${server.address().port}${path}`;
  try {
    return await withPage(async (page) => {
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      const res = await page.goto(url);
      await page.waitForTimeout(150);
      return { status: res.status(), text: await page.textContent('body'), errors };
    });
  } finally { server.close(); }
}

const dist = build('dist');
assert.deepEqual(list(app, 'dist').map((f) => f.replace(/-[\w-]{8}\.js$/, '-[hash].js')), ['assets/index-[hash].js', 'index.html']); // статика — просто файлы

// 1. без резервной отдачи: прямой заход на маршрут — 404
const none = await visit(await serve(dist, 'none'), '/products/7');
assert.equal(none.status, 404);

// 2. с резервной отдачей маршрут работает
const routes = await visit(await serve(dist, 'routes'), '/products/7');
assert.equal(routes.status, 200);
assert.equal(routes.text.trim(), 'Товар 7');

// 3. «всё → index.html»: отсутствующий чанк получает HTML со статусом 200
const html = readFileSync(join(dist, 'index.html'), 'utf8').replace(/src="\/assets\/[^"]+"/, 'src="/assets/index-old123.js"');
const stale = project({ 'index.html': html, ...Object.fromEntries(list(app, 'dist/assets').map((f) => [`assets/${f}`, readFileSync(join(dist, 'assets', f), 'utf8')])) }, { linkModules: false });
const all = await visit(await serve(stale, 'all'), '/');
assert.equal(all.status, 200);
assert.ok(all.errors.some((e) => /Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text\/html"/.test(e)), all.errors.join('\n'));
const strict = await visit(await serve(stale, 'routes'), '/');
assert.ok(strict.errors.some((e) => /404/.test(e)), strict.errors.join('\n')); // честный 404 вместо HTML под видом скрипта

// 4. выкладка в подпапку /shop/ с base по умолчанию: скрипт ищется в корне — пустая страница
const sub = await visit(await serve(dist, 'routes', '/shop/'), '/shop/');
assert.equal(sub.text.trim(), '');
assert.ok(sub.errors.some((e) => /404/.test(e)));
const withBase = build('dist-shop', '/shop/');
assert.match(readFileSync(join(withBase, 'index.html'), 'utf8'), /src="\/shop\/assets\//);
const subOk = await visit(await serve(withBase, 'routes', '/shop/'), '/shop/products/7');
assert.equal(subOk.text.trim(), 'Товар 7');

console.log('hosting ok');
