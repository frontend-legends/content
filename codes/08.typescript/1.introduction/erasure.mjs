// Глава 8.01 — стирание типов: tsc выдаёт JavaScript без типов; Node.js 24 сам стирает типы у .ts,
// но enum требует генерации кода и в режиме стирания не поддерживается.
// run: node erasure.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tsc = fileURLToPath(new URL('../../node_modules/typescript/bin/tsc', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'ts-erasure-'));
writeFileSync(join(dir, 'price.ts'), `
interface Product { id: number; price: number }
export function total(items: Product[]): number {
  return items.reduce((sum: number, i: Product) => sum + i.price, 0);
}
`);
const r = spawnSync(process.execPath, [tsc, '--target', 'es2022', '--module', 'esnext', '--outDir', join(dir, 'out'), '--ignoreConfig', join(dir, 'price.ts')], { encoding: 'utf8' });
assert.equal(r.status, 0, r.stdout + r.stderr);
const js = readFileSync(join(dir, 'out', 'price.js'), 'utf8');
assert.ok(!js.includes('interface') && !js.includes(': number') && !js.includes('Product'));
assert.match(js, /export function total\(items\) \{/);

// Node.js стирает типы сам
writeFileSync(join(dir, 'run.ts'), `const n: number = 2; console.log(n * 21);`);
const ok = spawnSync(process.execPath, [join(dir, 'run.ts')], { encoding: 'utf8' });
assert.equal(ok.stdout.trim(), '42');

// enum — не стираемый синтаксис
writeFileSync(join(dir, 'enum.ts'), `enum Status { Paid, Shipped } console.log(Status.Paid);`);
const bad = spawnSync(process.execPath, [join(dir, 'enum.ts')], { encoding: 'utf8' });
assert.notEqual(bad.status, 0);
assert.match(bad.stderr, /ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX/);
console.log('ok');
