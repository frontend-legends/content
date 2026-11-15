// Глава 12.02 — управление пакетами: диапазоны semver, devDependencies и --omit=dev, конфликт peerDependencies,
// скрипты жизненного цикла (pre/post, postinstall зависимости, --ignore-scripts, pnpm блокирует сборочные скрипты),
// раскладка node_modules у pnpm. overrides здесь не проверяются: офлайн с локальными file:-пакетами они не воспроизводятся.
// run: node packages.mjs
import assert from 'node:assert/strict';
import { existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import semver from 'semver';
import { project, run, read } from '../../_lib/project.mjs';

// --- semver
assert.equal(semver.validRange('^1.2.3'), '>=1.2.3 <2.0.0-0');
assert.equal(semver.validRange('~1.2.3'), '>=1.2.3 <1.3.0-0');
assert.equal(semver.validRange('^0.2.3'), '>=0.2.3 <0.3.0-0');     // до 1.0 ^ не пускает минорные
assert.equal(semver.validRange('^0.0.3'), '>=0.0.3 <0.0.4-0');     // и патчи на 0.0.x
assert.ok(semver.satisfies('1.9.0', '^1.2.3'));
assert.ok(!semver.satisfies('2.0.0', '^1.2.3'));
assert.ok(!semver.satisfies('1.3.0-beta.1', '^1.2.3'));           // пререлизы не подхватываются
assert.equal(semver.maxSatisfying(['1.2.3', '1.4.0', '1.10.2', '2.0.0'], '^1.2.3'), '1.10.2');
assert.equal(semver.maxSatisfying(['1.2.3', '1.2.9', '1.3.0'], '~1.2.3'), '1.2.9');

const pkg = (name, extra = {}) => JSON.stringify({ name, version: '1.0.0', ...extra });
const npm = (dir, ...args) => run('npm', [...args, '--no-audit', '--no-fund', '--offline'], { cwd: dir });

// --- devDependencies и --omit=dev
{
  const dir = project({
    'package.json': pkg('shop', { dependencies: { 'money-lib': 'file:./libs/money' }, devDependencies: { 'test-kit': 'file:./libs/test' } }),
    'libs/money/package.json': pkg('money-lib'),
    'libs/test/package.json': pkg('test-kit'),
  }, { linkModules: false });
  assert.equal(npm(dir, 'install', '--omit=dev').status, 0);
  assert.ok(existsSync(join(dir, 'node_modules/money-lib')));
  assert.ok(!existsSync(join(dir, 'node_modules/test-kit')));       // для продакшена не ставится
}

// --- peerDependencies: плагин требует другую мажорную версию хоста — конфликт при установке
{
  const dir = project({
    'package.json': pkg('shop', { dependencies: { host: 'file:./libs/host', plugin: 'file:./libs/plugin' } }),
    'libs/host/package.json': JSON.stringify({ name: 'host', version: '3.5.0' }),
    'libs/plugin/package.json': JSON.stringify({ name: 'plugin', version: '1.0.0', peerDependencies: { host: '^2.0.0' } }),
  }, { linkModules: false });
  const r = npm(dir, 'install');
  assert.notEqual(r.status, 0);
  assert.match(r.out, /ERESOLVE/);
  assert.match(r.out, /peer host@"\^2\.0\.0" from plugin@1\.0\.0/);
  assert.equal(npm(dir, 'install', '--legacy-peer-deps').status, 0);   // обход: проверка отключена, риск на тебе
}

// --- скрипты: pre/post и postinstall зависимости
{
  const files = {
    'package.json': pkg('shop', { dependencies: { 'native-addon': 'file:./libs/addon' }, scripts: { prebuild: 'node -e "require(\'fs\').appendFileSync(\'order.log\',\'prebuild\\\\n\')"', build: 'node -e "require(\'fs\').appendFileSync(\'order.log\',\'build\\\\n\')"', postbuild: 'node -e "require(\'fs\').appendFileSync(\'order.log\',\'postbuild\\\\n\')"' } }),
    'libs/addon/package.json': pkg('native-addon', { scripts: { postinstall: 'node -e "require(\'fs\').writeFileSync(require(\'path\').join(process.env.INIT_CWD, \'postinstall-ran\'), \'\')"' } }),
  };
  const dir = project(files, { linkModules: false });
  assert.equal(npm(dir, 'install').status, 0);
  assert.ok(existsSync(join(dir, 'postinstall-ran')));             // npm выполнил скрипт зависимости
  run('npm', ['run', 'build'], { cwd: dir });
  assert.deepEqual(read(dir, 'order.log').trim().split('\n'), ['prebuild', 'build', 'postbuild']);

  const safe = project(files, { linkModules: false });
  assert.equal(npm(safe, 'install', '--ignore-scripts').status, 0);
  assert.ok(!existsSync(join(safe, 'postinstall-ran')));

  const viaPnpm = project(files, { linkModules: false });
  const p = run('pnpm', ['install', '--offline'], { cwd: viaPnpm });
  assert.ok(!existsSync(join(viaPnpm, 'postinstall-ran')));         // pnpm не выполняет скрипты зависимостей без разрешения
  assert.match(p.out, /ERR_PNPM_IGNORED_BUILDS\] Ignored build scripts: native-addon/);
  assert.match(p.out, /pnpm approve-builds/);
  assert.notEqual(p.status, 0);                                     // в pnpm 11 это ошибка установки, а не предупреждение
}

// --- pnpm: прямые зависимости — ссылки в .pnpm
{
  const dir = project({
    'package.json': pkg('shop', { dependencies: { 'money-lib': 'file:./libs/money' } }),
    'libs/money/package.json': pkg('money-lib'),
  }, { linkModules: false });
  run('pnpm', ['install', '--offline'], { cwd: dir });
  assert.ok(existsSync(join(dir, 'node_modules/.pnpm')));
  assert.ok(lstatSync(join(dir, 'node_modules/money-lib')).isSymbolicLink());
}
console.log('packages ok');
