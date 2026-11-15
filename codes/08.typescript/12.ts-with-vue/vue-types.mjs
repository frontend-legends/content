// Глава 8.12 — типы Vue проверяет vue-tsc в изолированном проекте _vue/: ему нужен программный API
// TypeScript, которого нет в TypeScript 7, поэтому там TypeScript 6. Ожидаемые ошибки отмечены
// @ts-expect-error в скриптах и @vue-expect-error в шаблонах: лишняя или пропущенная ошибка роняет проверку.
// run: node vue-types.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dir = fileURLToPath(new URL('./_vue/', import.meta.url));
if (!existsSync(join(dir, 'node_modules/.bin/vue-tsc'))) {
  const i = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: dir, encoding: 'utf8' });
  assert.equal(i.status, 0, i.stdout + i.stderr);
}
const tsVersion = JSON.parse((await import('node:fs')).readFileSync(join(dir, 'node_modules/typescript/package.json'), 'utf8')).version;
assert.match(tsVersion, /^6\./);

const r = spawnSync(process.execPath, [join(dir, 'node_modules/vue-tsc/bin/vue-tsc.js'), '-p', join(dir, 'tsconfig.json')], { encoding: 'utf8' });
assert.equal(r.status, 0, r.stdout + r.stderr);
console.log(`vue-tsc ok (typescript ${tsVersion})`);
