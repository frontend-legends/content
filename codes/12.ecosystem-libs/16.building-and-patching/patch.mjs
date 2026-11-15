// Проверки к 12.16: патч зависимости через pnpm patch и patch-package; патч ломает установку после обновления версии.
// Нужна сеть или кеш: пакет ms@2.1.3 из реестра npm.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { project, run, bin, read, write, list } from '../../_lib/project.mjs';

// ms не понимает десятичную запятую: '1,5h' → undefined. Патч: заменить запятую на точку.
const fix = (file) => {
  const code = readFileSync(file, 'utf8');
  assert.match(code, /function parse\(str\) \{\n  str = String\(str\);/);
  writeFileSync(file, code.replace('function parse(str) {\n  str = String(str);', 'function parse(str) {\n  str = String(str).replace(",", ".");'));
};
// каждый вызов — в новом процессе: после патча pnpm меняет путь к пакету, а Node.js кеширует разрешённые пути
const ms = (dir) => (input) => {
  const r = run(process.execPath, ['-e', `process.stdout.write(JSON.stringify(require('ms')(${JSON.stringify(input)}) ?? null))`], { cwd: dir });
  return JSON.parse(r.stdout) ?? undefined;
};
const sh = (cmd, args, cwd) => {
  const r = run(cmd, args, { cwd });
  assert.equal(r.status, 0, `${cmd} ${args.join(' ')}\n${r.stdout}${r.stderr}`);
  return r;
};

// --- pnpm patch ---------------------------------------------------------
const app = project({ 'package.json': JSON.stringify({ name: 'shop', private: true, dependencies: { ms: '2.1.3' } }) }, { linkModules: false });
sh('pnpm', ['install', '--prefer-offline'], app);
assert.equal(ms(app)('1.5h'), 5_400_000);
assert.equal(ms(app)('1,5h'), undefined);

// pnpm patch даёт копию пакета для правки, patch-commit сохраняет разницу
const edit = join(app, '.edit-ms');
sh('pnpm', ['patch', 'ms@2.1.3', '--edit-dir', edit], app);
fix(join(edit, 'index.js'));
sh('pnpm', ['patch-commit', edit], app);

assert.deepEqual(list(app, 'patches'), ['ms@2.1.3.patch']);
const patch = read(app, 'patches/ms@2.1.3.patch');
assert.match(patch, /^\+  str = String\(str\)\.replace\(",", "."\);$/m);
// ссылка на патч — в pnpm-workspace.yaml, хеш патча — в lock-файле
assert.match(read(app, 'pnpm-workspace.yaml'), /patchedDependencies:\n  ms@2\.1\.3: patches\/ms@2\.1\.3\.patch/);
assert.match(read(app, 'pnpm-lock.yaml'), /patchedDependencies:/);
assert.equal(ms(app)('1,5h'), 5_400_000);

// чистая установка применяет патч сама
rmSync(join(app, 'node_modules'), { recursive: true, force: true });
sh('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], app);
assert.equal(ms(app)('1,5h'), 5_400_000);

// обновили пакет — патч к старой версии больше не подходит, установка падает
write(app, 'package.json', JSON.stringify({ name: 'shop', private: true, dependencies: { ms: '2.1.2' } }));
const bumped = run('pnpm', ['install', '--prefer-offline'], { cwd: app });
assert.notEqual(bumped.status, 0);
assert.match(bumped.stdout + bumped.stderr, /ERR_PNPM_UNUSED_PATCH/);

// --- patch-package для npm ------------------------------------------------
const npmApp = project({
  'package.json': JSON.stringify({ name: 'shop', private: true, scripts: { postinstall: 'patch-package' }, dependencies: { ms: '2.1.3' } }),
}, { linkModules: false });
const env = { ...process.env, PATH: `${join(bin('patch-package'), '..')}:${process.env.PATH}` };
const npm = (args) => { const r = run('npm', args, { cwd: npmApp, env }); assert.equal(r.status, 0, r.stdout + r.stderr); };
npm(['install', '--prefer-offline', '--no-audit', '--no-fund']);
fix(join(npmApp, 'node_modules/ms/index.js'));
const made = run(bin('patch-package'), ['ms'], { cwd: npmApp, env });
assert.equal(made.status, 0, made.stdout + made.stderr);
assert.deepEqual(list(npmApp, 'patches'), ['ms+2.1.3.patch']);

// postinstall применяет патч после чистой установки
rmSync(join(npmApp, 'node_modules'), { recursive: true, force: true });
npm(['ci', '--prefer-offline', '--no-audit', '--no-fund']);
assert.equal(ms(npmApp)('1,5h'), 5_400_000);
assert.ok(existsSync(join(npmApp, 'patches/ms+2.1.3.patch')));

console.log('patch ok');
