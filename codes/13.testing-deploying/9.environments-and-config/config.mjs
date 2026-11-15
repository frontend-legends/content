// Проверки к 13.09: конфиг при сборке встраивается в бандл и меняет хеш, конфиг при запуске — одна сборка
// для всех окружений, режимы Vite, секрет с префиксом публичен, удалённый .env живёт в истории git.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { project, run, bin, read, write, list } from '../../_lib/project.mjs';
import { withPage } from '../../_lib/browser.mjs';

const app = project({
  'package.json': JSON.stringify({ type: 'module' }),
  'index.html': '<!doctype html><meta charset="utf-8"><div id="app"></div><script type="module" src="/main.js"></script>',
  'main.js': `document.getElementById('app').textContent = [import.meta.env.MODE, import.meta.env.PROD, import.meta.env.VITE_API_URL].join(' | ');\n`,
  '.env.staging': 'VITE_API_URL=https://api.staging.shop.example\n',
  '.env.production': 'VITE_API_URL=https://api.shop.example\n',
});
const build = (mode, outDir) => {
  const r = run(bin('vite'), ['build', '--mode', mode, '--outDir', outDir, '--logLevel', 'error'], { cwd: app });
  assert.equal(r.status, 0, r.out);
  const js = list(app, outDir).find((f) => f.endsWith('.js'));
  return { js, code: read(app, join(outDir, js)) };
};

// --- конфиг при сборке: значение встроено строкой, у каждого окружения свой бандл и хеш ---
const staging = build('staging', 'dist-staging');
const prod = build('production', 'dist-prod');
assert.match(staging.code, /https:\/\/api\.staging\.shop\.example/);
assert.match(prod.code, /https:\/\/api\.shop\.example/);
assert.doesNotMatch(prod.code, /staging/);
assert.notEqual(staging.js, prod.js); // разные файлы: на стенде проверяли не то, что уйдёт в продакшен

// режим staging — это всё ещё продакшен-сборка: MODE = staging, PROD = true; минификатор свернул всё в одну строку
assert.match(staging.code, /`staging \| true \| https:\/\/api\.staging\.shop\.example`/);
assert.doesNotMatch(staging.code, /import\.meta\.env/);

// --- конфиг при запуске: одна сборка, адрес читается из /config.json ---
write(app, 'main.js', `const config = await fetch('/config.json').then((r) => r.json());
document.getElementById('app').textContent = config.apiUrl;
`);
const once = build('production', 'dist-once');
const serve = (configJson) => new Promise((resolve) => {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json' };
  const server = createServer((req, res) => {
    if (req.url === '/config.json') { res.setHeader('content-type', types['.json']); return res.end(configJson); }
    const file = req.url === '/' ? 'index.html' : req.url.slice(1);
    try { res.setHeader('content-type', types[extname(file)] ?? 'text/plain'); res.end(readFileSync(join(app, 'dist-once', file))); }
    catch { res.statusCode = 404; res.end(); }
  }).listen(0, () => resolve(server));
});
const shown = async (configJson) => {
  const server = await serve(configJson);
  try {
    return await withPage(async (page) => {
      await page.goto(`http://localhost:${server.address().port}/`);
      await page.waitForFunction(() => document.getElementById('app').textContent !== '');
      return page.textContent('#app');
    });
  } finally { server.close(); }
};
assert.equal(await shown('{"apiUrl":"https://api.staging.shop.example"}'), 'https://api.staging.shop.example');
assert.equal(await shown('{"apiUrl":"https://api.shop.example"}'), 'https://api.shop.example');
assert.doesNotMatch(once.code, /shop\.example/); // в бандле адресов нет вовсе

// --- секрет с публичным префиксом попадает в бандл ---
write(app, 'main.js', "console.log(import.meta.env.VITE_PAYMENT_SECRET, import.meta.env.PAYMENT_SECRET);\n");
write(app, '.env.production', 'VITE_PAYMENT_SECRET=sk_live_51Hx9\nPAYMENT_SECRET=sk_live_server_only\n');
const leak = build('production', 'dist-leak');
assert.match(leak.code, /sk_live_51Hx9/);
assert.doesNotMatch(leak.code, /sk_live_server_only/);

// --- удалённый из репозитория .env остаётся в истории ---
const repo = project({ '.env': 'PAYMENT_SECRET=sk_live_oops\n', 'README.md': '# shop\n' }, { linkModules: false });
const git = (...args) => { const r = run('git', args, { cwd: repo }); assert.equal(r.status, 0, r.out); return r.stdout; };
git('init', '-q');
git('-c', 'user.name=dev', '-c', 'user.email=dev@shop.example', 'add', '.');
git('-c', 'user.name=dev', '-c', 'user.email=dev@shop.example', 'commit', '-qm', 'init');
git('rm', '-q', '--cached', '.env');
write(repo, '.gitignore', '.env\n');
git('add', '.gitignore');
git('-c', 'user.name=dev', '-c', 'user.email=dev@shop.example', 'commit', '-qm', 'remove .env');
assert.doesNotMatch(git('ls-files'), /^\.env$/m);
assert.equal(git('show', 'HEAD~1:.env'), 'PAYMENT_SECRET=sk_live_oops\n'); // секрет по-прежнему в истории
assert.match(git('log', '-p', '--all', '-S', 'sk_live_oops', '--format=%s'), /init/);

console.log('config ok');
