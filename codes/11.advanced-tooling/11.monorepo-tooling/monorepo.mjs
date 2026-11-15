// Глава 11.11 — монорепо: workspaces связывают пакеты ссылками; «призрачная» зависимость работает в npm
// и падает в pnpm; Turborepo строит граф задач, кеширует результат и запускает только затронутое.
// run: node monorepo.mjs
import assert from 'node:assert/strict';
import { lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { project, run, write, read, bin } from '../../_lib/project.mjs';

const pkg = (name, deps = {}, scripts = {}) => JSON.stringify({ name, version: '1.0.0', type: 'module', main: 'index.js', dependencies: deps, scripts });
const files = (proto) => ({
  'packages/utils/package.json': pkg('@shop/utils', {}, { build: 'node build.js' }),
  'packages/utils/index.js': 'export const money = (v) => v + " ₽";\n',
  'packages/utils/build.js': "import { appendFileSync, mkdirSync } from 'node:fs'; mkdirSync('dist', { recursive: true }); appendFileSync('../../build.log', 'utils\\n'); appendFileSync('dist/out.txt', 'ok');\n",
  'packages/ui/package.json': pkg('@shop/ui', { '@shop/utils': proto }, { build: 'node build.js' }),
  'packages/ui/index.js': "import { money } from '@shop/utils';\nexport const priceTag = (v) => `[${money(v)}]`;\n",
  'packages/ui/build.js': "import { appendFileSync, mkdirSync } from 'node:fs'; mkdirSync('dist', { recursive: true }); appendFileSync('../../build.log', 'ui\\n'); appendFileSync('dist/out.txt', 'ok');\n",
  'apps/web/package.json': pkg('@shop/web', { '@shop/ui': proto }, { build: 'node build.js' }),
  // web использует utils напрямую, но в зависимостях его не указал
  'apps/web/index.js': "import { priceTag } from '@shop/ui';\nimport { money } from '@shop/utils';\nconsole.log(priceTag(490), money(1));\n",
  'apps/web/build.js': "import { appendFileSync, mkdirSync } from 'node:fs'; mkdirSync('dist', { recursive: true }); appendFileSync('../../build.log', 'web\\n'); appendFileSync('dist/out.txt', 'ok');\n",
});

// --- npm workspaces: пакеты связаны символическими ссылками, «призрачная» зависимость работает
{
  const dir = project({ ...files('1.0.0'), 'package.json': JSON.stringify({ name: 'shop', private: true, workspaces: ['packages/*', 'apps/*'] }) }, { linkModules: false });
  const r = run('npm', ['install', '--no-audit', '--no-fund', '--offline'], { cwd: dir });
  assert.equal(r.status, 0, r.out);
  assert.ok(lstatSync(join(dir, 'node_modules/@shop/ui')).isSymbolicLink());
  assert.equal(realpathSync(join(dir, 'node_modules/@shop/ui')), realpathSync(join(dir, 'packages/ui')));
  const web = run(process.execPath, ['apps/web/index.js'], { cwd: dir });
  assert.equal(web.stdout.trim(), '[490 ₽] 1 ₽');                     // utils нашёлся в корневом node_modules
}

// --- pnpm: изолированные node_modules, необъявленная зависимость не находится
{
  const dir = project({ ...files('workspace:*'), 'package.json': JSON.stringify({ name: 'shop', private: true }), 'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\n  - 'apps/*'\n" }, { linkModules: false });
  const r = run('pnpm', ['install', '--offline'], { cwd: dir });
  assert.equal(r.status, 0, r.out);
  const web = run(process.execPath, ['apps/web/index.js'], { cwd: dir });
  assert.notEqual(web.status, 0);
  assert.match(web.out, /Cannot find package '@shop\/utils'/);         // нужно объявить зависимость явно
  write(dir, 'apps/web/package.json', pkg('@shop/web', { '@shop/ui': 'workspace:*', '@shop/utils': 'workspace:*' }));
  run('pnpm', ['install', '--offline'], { cwd: dir });
  assert.equal(run(process.execPath, ['apps/web/index.js'], { cwd: dir }).stdout.trim(), '[490 ₽] 1 ₽');
}

// --- Turborepo: граф задач, кеш, только затронутое
{
  const dir = project({
    ...files('1.0.0'),
    'package.json': JSON.stringify({ name: 'shop', private: true, packageManager: 'npm@11.0.0', workspaces: ['packages/*', 'apps/*'] }),
    'turbo.json': JSON.stringify({ tasks: { build: { dependsOn: ['^build'], outputs: ['dist/**'] } } }),
    '.gitignore': 'node_modules\n.turbo\ndist\nbuild.log\n',
  }, { linkModules: false });
  run('npm', ['install', '--no-audit', '--no-fund', '--offline'], { cwd: dir });
  const git = (...a) => run('git', a, { cwd: dir, env: { GIT_AUTHOR_NAME: 'd', GIT_AUTHOR_EMAIL: 'd@e', GIT_COMMITTER_NAME: 'd', GIT_COMMITTER_EMAIL: 'd@e' } });
  git('init', '-q', '-b', 'main'); git('add', '-A'); git('commit', '-qm', 'init');
  const turbo = (...a) => run(bin('turbo'), ['run', 'build', '--output-logs=new-only', ...a], { cwd: dir, env: { TURBO_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1' } });
  const log = () => read(dir, 'build.log').trim().split('\n');

  const first = turbo();
  assert.equal(first.status, 0, first.out);
  assert.deepEqual(log(), ['utils', 'ui', 'web']);                    // зависимости — раньше зависимых
  const second = turbo();
  assert.match(second.out, /3 cached, 3 total/);                      // всё из кеша
  assert.deepEqual(log(), ['utils', 'ui', 'web']);                    // ничего не запускалось заново
  write(dir, 'packages/ui/index.js', read(dir, 'packages/ui/index.js') + '// правка\n');
  const third = turbo();
  assert.match(third.out, /1 cached, 3 total/);                       // utils из кеша
  assert.deepEqual(log().slice(3), ['ui', 'web']);                    // пересобраны ui и зависимый web
  git('add', '-A'); git('commit', '-qm', 'ui change');
  write(dir, 'packages/utils/index.js', read(dir, 'packages/utils/index.js') + '// правка\n');
  git('add', '-A'); git('commit', '-qm', 'utils change');
  const affected = run(bin('turbo'), ['run', 'build', '--filter=...[HEAD^1]', '--dry=json'], { cwd: dir, env: { TURBO_TELEMETRY_DISABLED: '1' } });
  const plan = JSON.parse(affected.stdout);
  assert.deepEqual(plan.tasks.map((t) => t.package).sort(), ['@shop/ui', '@shop/utils', '@shop/web']);   // utils и все, кто от него зависит
}
console.log('monorepo ok');
