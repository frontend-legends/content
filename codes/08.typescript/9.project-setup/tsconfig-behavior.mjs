// Глава 8.09 — что делают опции tsconfig: значения по умолчанию TS 6/7, флаги строгости, модули, .d.ts.
// Каждый сценарий — временный проект, tsc -p, сверка кодов ошибок.
// run: node tsconfig-behavior.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const codes = fileURLToPath(new URL('../../', import.meta.url));
const tsc = join(codes, 'node_modules/typescript/bin/tsc');

function project(compilerOptions, files, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ts-cfg-'));
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { noEmit: true, ...compilerOptions }, ...extra }));
  for (const [name, code] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), code);
  }
  symlinkSync(join(codes, 'node_modules'), join(dir, 'node_modules'));
  const r = spawnSync(process.execPath, [tsc, '-p', dir], { encoding: 'utf8' });
  return { out: r.stdout + r.stderr, codes: [...(r.stdout + r.stderr).matchAll(/error (TS\d+)/g)].map((m) => m[1]) };
}

// --- strict включён по умолчанию (TS 6+): неявный any — ошибка без единого флага
{
  const r = project({}, { 'a.ts': 'export function f(x) { return x; }\n' });
  assert.deepEqual(r.codes, ['TS7006'], r.out);   // Parameter 'x' implicitly has an 'any' type
  const off = project({ strict: false }, { 'a.ts': 'export function f(x) { return x; }\n' });
  assert.deepEqual(off.codes, [], off.out);
}

// --- strictNullChecks
{
  const code = 'const el = [1, 2].find((n) => n > 5);\nexport const v = el.toFixed();\n';
  assert.deepEqual(project({}, { 'a.ts': code }).codes, ['TS18048']);   // 'el' is possibly 'undefined'
  assert.deepEqual(project({ strictNullChecks: false }, { 'a.ts': code }).codes, []);
}

// --- strictPropertyInitialization
{
  const code = 'export class Cart { items: string[]; }\n';
  assert.deepEqual(project({}, { 'a.ts': code }).codes, ['TS2564']);
}

// --- useUnknownInCatchVariables (входит в strict)
{
  const code = 'try {} catch (e) { e.message; }\n';
  assert.deepEqual(project({}, { 'a.ts': code }).codes, ['TS18046']);   // 'e' is of type 'unknown'
}

// --- types: [] по умолчанию — @types/node не подключаются сами
{
  const code = 'export const env = process.env.NODE_ENV;\n';
  const r = project({}, { 'a.ts': code });
  assert.deepEqual(r.codes, ['TS2591'], r.out);   // Cannot find name 'process'. Do you need to install type definitions for node?
  assert.deepEqual(project({ types: ['node'] }, { 'a.ts': code }).codes, []);
}

// --- noUncheckedIndexedAccess
{
  const code = 'const prices: Record<string, number> = {};\nexport const p = prices.tea.toFixed();\nexport const a = [1][5].toFixed();\n';
  assert.deepEqual(project({}, { 'a.ts': code }).codes, []);
  assert.deepEqual(project({ noUncheckedIndexedAccess: true }, { 'a.ts': code }).codes, ['TS18048', 'TS2532']);
}

// --- exactOptionalPropertyTypes
{
  const code = 'type P = { title?: string };\nexport const p: P = { title: undefined };\n';
  assert.deepEqual(project({}, { 'a.ts': code }).codes, []);
  assert.deepEqual(project({ exactOptionalPropertyTypes: true }, { 'a.ts': code }).codes, ['TS2375']);
}

// --- noImplicitOverride
{
  const code = 'class A { save() {} }\nexport class B extends A { save() {} }\n';
  assert.deepEqual(project({ noImplicitOverride: true }, { 'a.ts': code }).codes, ['TS4114']);
}

// --- noPropertyAccessFromIndexSignature
{
  const code = 'const env: Record<string, string> = {};\nexport const a = env.API_URL;\nexport const b = env["API_URL"];\n';
  assert.deepEqual(project({ noPropertyAccessFromIndexSignature: true }, { 'a.ts': code }).codes, ['TS4111']);
}

// --- moduleResolution: nodenext требует расширения в относительных импортах ESM, bundler — нет
{
  const files = { 'src/a.ts': "import { b } from './b';\nexport const a = b;\n", 'src/b.ts': 'export const b = 1;\n', 'package.json': '{"type":"module"}' };
  const node = project({ module: 'nodenext' }, files);
  assert.deepEqual(node.codes, ['TS2835'], node.out);   // Relative import paths need explicit file extensions
  assert.deepEqual(project({ module: 'preserve', moduleResolution: 'bundler' }, files).codes, []);
  const withExt = { ...files, 'src/a.ts': "import { b } from './b.js';\nexport const a = b;\n" };
  assert.deepEqual(project({ module: 'nodenext' }, withExt).codes, []);
}

// --- baseUrl: устарел в TS 6, удалён в TS 7; paths работают без него
{
  const files = { 'src/a.ts': "import { b } from '@/b';\nexport const a = b;\n", 'src/b.ts': 'export const b = 1;\n' };
  const ok = project({ module: 'preserve', moduleResolution: 'bundler', paths: { '@/*': ['./src/*'] } }, files);
  assert.deepEqual(ok.codes, [], ok.out);
  const old = project({ module: 'preserve', moduleResolution: 'bundler', baseUrl: '.', paths: { '@/*': ['src/*'] } }, files);
  assert.ok(old.codes.includes('TS5102'));
  assert.match(old.out, /Option 'baseUrl' has been removed/);
}

// --- удалено в TS 7 (в TS 6 — устаревшие): node10, es5, amd, esModuleInterop: false, outFile
for (const [opts, re] of [
  [{ module: 'commonjs', moduleResolution: 'node10' }, /moduleResolution=node10' has been removed/],
  [{ target: 'es5' }, /target=ES5' has been removed/],
  [{ esModuleInterop: false }, /esModuleInterop=false' has been removed/],
  [{ outFile: 'x.js' }, /Option 'outFile' has been removed/],
]) {
  const r = project(opts, { 'a.ts': 'export {};\n' });
  assert.match(r.out, re);
}

// --- lib: без DOM нет document
{
  const code = 'export const t = document.title;\n';
  assert.deepEqual(project({ lib: ['es2024'] }, { 'a.ts': code }).codes, ['TS2584']);   // Cannot find name 'document'. Do you need to change your target library?
  assert.deepEqual(project({ lib: ['es2024', 'dom'] }, { 'a.ts': code }).codes, []);
}

// --- объявления: модуль без типов, ambient-модуль для ассетов
{
  writeFileSync; // eslint
  const files = {
    'src/a.ts': "import logo from './logo.svg';\nimport { slugify } from 'legacy-slug';\nexport const x: string = logo + slugify('A B');\n",
    'src/assets.d.ts': "declare module '*.svg' { const src: string; export default src; }\n",
    'src/legacy.d.ts': "declare module 'legacy-slug' { export function slugify(s: string): string; }\n",
  };
  assert.deepEqual(project({ module: 'preserve', moduleResolution: 'bundler' }, files).codes, []);
  const noDecl = project({ module: 'preserve', moduleResolution: 'bundler' }, { 'src/a.ts': files['src/a.ts'] });
  assert.deepEqual(noDecl.codes.sort(), ['TS2307', 'TS2307'], noDecl.out);   // Cannot find module
}

// --- noUncheckedSideEffectImports по умолчанию (TS 6+): опечатка в import './styles.css' ловится
{
  const r = project({ module: 'preserve', moduleResolution: 'bundler' }, { 'src/a.ts': "import './stlyes.css';\n" });
  assert.deepEqual(r.codes, ['TS2882'], r.out);
}

console.log('tsconfig behavior ok');
