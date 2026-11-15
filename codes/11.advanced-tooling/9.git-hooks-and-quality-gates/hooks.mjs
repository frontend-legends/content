// Глава 11.09 — git-хуки на настоящем git: хуки не версионируются, core.hooksPath, --no-verify обходит,
// husky, lint-staged проверяет только подготовленное и добавляет исправления, commitlint.
// run: node hooks.mjs
import assert from 'node:assert/strict';
import { chmodSync } from 'node:fs';
import { join } from 'node:path';
import { project, run, write, read, bin } from '../../_lib/project.mjs';

const git = (dir, ...args) => run('git', args, { cwd: dir, env: { GIT_AUTHOR_NAME: 'dev', GIT_AUTHOR_EMAIL: 'dev@example.com', GIT_COMMITTER_NAME: 'dev', GIT_COMMITTER_EMAIL: 'dev@example.com', HUSKY: undefined } });
function repo(files) {
  const dir = project({ ...files, '.gitignore': 'node_modules\n' });
  git(dir, 'init', '-q', '-b', 'main');
  return dir;
}
const hook = (dir, path, body) => { write(dir, path, `#!/bin/sh\n${body}\n`); chmodSync(join(dir, path), 0o755); };

// --- .git/hooks не попадает в репозиторий; core.hooksPath указывает на версионируемую папку
{
  const dir = repo({ 'a.txt': '1' });
  hook(dir, '.git/hooks/pre-commit', 'echo local-hook; exit 1');
  assert.equal(git(dir, 'ls-files', '--others', '--exclude-standard').stdout.includes('.git/hooks'), false);
  hook(dir, '.githooks/pre-commit', 'echo "проверка не прошла" >&2; exit 1');
  git(dir, 'config', 'core.hooksPath', '.githooks');
  git(dir, 'add', 'a.txt');
  const r = git(dir, 'commit', '-qm', 'feat: first');
  assert.notEqual(r.status, 0);                                   // хук заблокировал коммит
  assert.match(r.out, /проверка не прошла/);
  assert.doesNotMatch(r.out, /local-hook/);                       // хук из .git/hooks больше не используется
  const bypass = git(dir, 'commit', '-qm', 'feat: first', '--no-verify');
  assert.equal(bypass.status, 0);                                 // --no-verify обходит хук
}

// --- husky: создаёт .husky/pre-commit и выставляет core.hooksPath
{
  const dir = repo({ 'package.json': '{ "name": "shop", "scripts": {} }' });
  const r = run(bin('husky'), ['init'], { cwd: dir });
  assert.equal(r.status, 0, r.out);
  assert.equal(git(dir, 'config', 'core.hooksPath').stdout.trim(), '.husky/_');
  assert.match(read(dir, '.husky/pre-commit'), /npm test/);
  assert.match(read(dir, 'package.json'), /"prepare": "husky"/);  // хуки ставятся при npm install
}

// --- lint-staged: только подготовленные файлы, исправления попадают в коммит
{
  const dir = repo({
    'package.json': JSON.stringify({ name: 'shop', 'lint-staged': { '*.js': ['prettier --write', 'node log-files.mjs'] } }),
    'log-files.mjs': "import { appendFileSync } from 'node:fs'; appendFileSync('checked.log', process.argv.slice(2).map((f) => f.split('/').pop()).join(',') + '\\n');",
    'src/cart.js': 'export const a=1\n',
    'src/other.js': 'export const b=2\n',
  });
  git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'chore: init', '--no-verify');
  write(dir, 'src/cart.js', 'export const a   =   10\n');
  write(dir, 'src/other.js', 'export const b   =   20\n');        // изменён, но не подготовлен
  git(dir, 'add', 'src/cart.js');
  const r = run(bin('lint-staged'), [], { cwd: dir });
  assert.equal(r.status, 0, r.out);
  assert.equal(read(dir, 'checked.log').trim(), 'cart.js');         // other.js не проверялся
  assert.equal(git(dir, 'show', ':src/cart.js').stdout, 'export const a = 10;\n');   // в индексе — отформатированная версия
  assert.equal(read(dir, 'src/other.js'), 'export const b   =   20\n');               // неподготовленное не тронуто
}

// --- commitlint: формат Conventional Commits
{
  const dir = repo({ 'commitlint.config.js': "export default { extends: ['@commitlint/config-conventional'] };", 'package.json': '{ "type": "module" }' });
  const check = (msg) => run(bin('commitlint'), [], { cwd: dir, input: msg });
  assert.equal(check('feat(cart): добавить промокод').status, 0);
  assert.equal(check('fix: округление копеек\n\nBREAKING CHANGE: цены теперь в копейках').status, 0);
  const bad = check('поправил всё');
  assert.notEqual(bad.status, 0);
  assert.match(bad.out, /subject may not be empty|type may not be empty/);
}
console.log('hooks ok');
