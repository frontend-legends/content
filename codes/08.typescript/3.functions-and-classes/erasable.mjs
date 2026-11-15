// Глава 8.03 — параметры-свойства и enum под erasableSyntaxOnly: tsc запрещает синтаксис, который нельзя просто стереть.
// run: node erasable.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tsc = fileURLToPath(new URL('../../node_modules/typescript/bin/tsc', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'erasable-'));
writeFileSync(join(dir, 'a.ts'), `class Product { constructor(private id: number) {} }\nenum Status { Paid }\nexport { Product, Status };\n`);
const r = spawnSync(process.execPath, [tsc, '--noEmit', '--erasableSyntaxOnly', '--ignoreConfig', join(dir, 'a.ts')], { encoding: 'utf8' });
assert.notEqual(r.status, 0);
const errors = r.stdout.match(/error TS1294/g) ?? [];
assert.equal(errors.length, 2, r.stdout);
assert.match(r.stdout, /This syntax is not allowed when 'erasableSyntaxOnly' is enabled/);
console.log('ok');
