// Глава 8.09 — практика: миграция конфига на TS 7, флаги сверх strict.
// run: node practice.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const codes = fileURLToPath(new URL('../../', import.meta.url));
const tsc = join(codes, 'node_modules/typescript/bin/tsc');
function project(compilerOptions, files) {
  const dir = mkdtempSync(join(tmpdir(), 'ts-cfg-'));
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { noEmit: true, ...compilerOptions }, include: ['src'] }));
  for (const [name, code] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), code);
  }
  symlinkSync(join(codes, 'node_modules'), join(dir, 'node_modules'));
  const r = spawnSync(process.execPath, [tsc, '-p', dir], { encoding: 'utf8' });
  return { out: r.stdout + r.stderr, codes: [...(r.stdout + r.stderr).matchAll(/error (TS\d+)/g)].map((m) => m[1]) };
}

// 1. миграция
const files = {
  'src/env.ts': "import { id } from '@/id';\nexport const env = `${process.env.NODE_ENV}-${id}`;\n",
  'src/id.ts': 'export const id = 1;\n',
};
const old = project({ target: 'es2020', module: 'esnext', moduleResolution: 'node', baseUrl: '.', paths: { '@/*': ['src/*'] } }, files);
assert.ok(old.codes.includes('TS5102') && old.codes.includes('TS5108'), old.out);
const noTypes = project({ target: 'es2020', module: 'preserve', moduleResolution: 'bundler', paths: { '@/*': ['./src/*'] } }, files);
assert.deepEqual(noTypes.codes, ['TS2591'], noTypes.out);
const fixed = project({ target: 'es2020', module: 'preserve', moduleResolution: 'bundler', paths: { '@/*': ['./src/*'] }, types: ['node'] }, files);
assert.deepEqual(fixed.codes, [], fixed.out);

// 2. флаги сверх strict
const code = `const discounts: Record<string, number> = { tea: 0.1 };
export function price(sku: string, base: number) { return base * (1 - discounts[sku]); }
type Patch = { title?: string };
export function apply(product: { title: string }, patch: Patch) { return { ...product, ...patch }; }
export const t = apply({ title: 'Чай' }, { title: undefined }).title.toUpperCase();
`;
assert.deepEqual(project({}, { 'src/a.ts': code }).codes, []);
const strictPlus = project({ noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true }, { 'src/a.ts': code });
assert.deepEqual(strictPlus.codes, ['TS2532', 'TS2379'], strictPlus.out);
const fixedCode = code.replace('(1 - discounts[sku])', '(1 - (discounts[sku] ?? 0))').replace("{ title: undefined }", '{}');
assert.deepEqual(project({ noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true }, { 'src/a.ts': fixedCode }).codes, []);

// рантайм: оба бага реальны
const discounts = { tea: 0.1 };
assert.ok(Number.isNaN(100 * (1 - discounts.coffee)));
assert.throws(() => ({ ...{ title: 'Чай' }, ...{ title: undefined } }).title.toUpperCase(), TypeError);
console.log('practice ok');
