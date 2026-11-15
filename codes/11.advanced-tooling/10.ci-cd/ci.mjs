// Глава 11.10 — CI: npm ci падает при рассинхроне lock-файла и не трогает его; ключ кеша по хешу lock-файла;
// бюджет размера бандла как гейт; структура workflow (параллельные задачи, needs, concurrency).
// run: node ci.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { project, run, read, write, list } from '../../_lib/project.mjs';
import { build } from 'vite';
import { parse } from 'yaml';

// --- npm ci: ставит строго по lock-файлу и падает, если package.json с ним разошёлся
{
  const dir = project({
    'package.json': JSON.stringify({ name: 'shop', version: '1.0.0', dependencies: {} }),
    'money-lib/package.json': JSON.stringify({ name: 'money-lib', version: '1.0.0' }),   // локальный пакет: без сети
  }, { linkModules: false });
  assert.equal(run('npm', ['install', '--no-audit', '--no-fund', '--offline'], { cwd: dir }).status, 0);
  const lockBefore = read(dir, 'package-lock.json');
  write(dir, 'package.json', JSON.stringify({ name: 'shop', version: '1.0.0', dependencies: { 'money-lib': 'file:./money-lib' } }));   // зависимость добавили, lock не обновили
  const r = run('npm', ['ci', '--no-audit', '--no-fund', '--offline'], { cwd: dir });
  assert.notEqual(r.status, 0);
  assert.match(r.out, /can only install packages when your package\.json and package-lock\.json .* are in sync/s);
  assert.equal(read(dir, 'package-lock.json'), lockBefore);   // lock-файл не переписан
}

// --- ключ кеша: хеш lock-файла меняется только при изменении зависимостей
{
  const key = (lock) => `npm-${process.platform}-${createHash('sha256').update(lock).digest('hex').slice(0, 16)}`;
  const lock = '{"lockfileVersion":3,"packages":{"node_modules/vue":{"version":"3.5.45"}}}';
  assert.equal(key(lock), key(lock));
  assert.notEqual(key(lock), key(lock.replace('3.5.45', '3.5.46')));
}

// --- бюджет размера: гейт падает, если точка входа выросла выше порога
async function entrySize(files) {
  const dir = project(files);
  await build({ root: dir, logLevel: 'silent' });
  const entry = list(dir, 'dist').find((f) => /^assets\/index-.*\.js$/.test(f));
  return gzipSync(read(dir, `dist/${entry}`)).length;
}
function checkBudget(bytes, limitKb) {
  return bytes <= limitKb * 1024 ? { ok: true } : { ok: false, message: `точка входа ${(bytes / 1024).toFixed(1)} КБ gzip > бюджета ${limitKb} КБ` };
}
{
  const base = { 'index.html': '<!doctype html><script type="module" src="/src/main.js"></script>' };
  const small = await entrySize({ ...base, 'src/main.js': "document.title = 'магазин';" });
  const big = await entrySize({ ...base, 'src/main.js': "import { createApp, h } from 'vue'; createApp({ render: () => h('p') }).mount('body');" });
  assert.deepEqual(checkBudget(small, 30), { ok: true });
  const r = checkBudget(big, 10);
  assert.equal(r.ok, false);
  assert.match(r.message, /> бюджета 10 КБ/);
}

// --- workflow: параллельные задачи, зависимость деплоя, отмена устаревших прогонов
{
  const wf = parse(`
name: CI
on:
  pull_request:
  push:
    branches: [main]
concurrency:
  group: ci-\${{ github.ref }}
  cancel-in-progress: true
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm run lint
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npx tsc --noEmit
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm test
  deploy:
    if: github.ref == 'refs/heads/main'
    needs: [lint, typecheck, test]
    runs-on: ubuntu-latest
    steps:
      - run: echo deploy
`);
  const jobs = Object.entries(wf.jobs);
  const parallel = jobs.filter(([, j]) => !j.needs).map(([n]) => n);
  assert.deepEqual(parallel, ['lint', 'typecheck', 'test']);       // идут одновременно
  assert.deepEqual(wf.jobs.deploy.needs, ['lint', 'typecheck', 'test']);
  assert.equal(wf.concurrency['cancel-in-progress'], true);
  assert.ok(jobs.every(([n, j]) => n === 'deploy' || j.steps.some((s) => s.run === 'npm ci')));
}
console.log('ci ok');
