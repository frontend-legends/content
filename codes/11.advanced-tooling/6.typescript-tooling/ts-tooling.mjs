// Глава 11.06 — TypeScript в конвейере: пофайловое стирание ломает реэкспорт типа (и isolatedModules это ловит),
// verbatimModuleSyntax, isolatedDeclarations, инкрементальная проверка, проект на TS 7 против TS 6.
// run: node ts-tooling.mjs
import assert from 'node:assert/strict';
import { project, run, write, codesDir } from '../../_lib/project.mjs';
import { transformSync } from 'esbuild';
import { join } from 'node:path';
import { existsSync, statSync } from 'node:fs';

const tsc7 = join(codesDir, 'node_modules/typescript/bin/tsc');
const tsc6 = join(codesDir, '08.typescript/12.ts-with-vue/_vue/node_modules/typescript/bin/tsc');
if (!existsSync(tsc6)) run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: join(codesDir, '08.typescript/12.ts-with-vue/_vue') });
const tsc = (bin, dir, args = ['-p', '.']) => run(process.execPath, [bin, ...args], { cwd: dir });
const codes = (out) => [...out.matchAll(/error (TS\d+)/g)].map((m) => m[1]);
const cfg = (opts) => JSON.stringify({ compilerOptions: { strict: true, module: 'preserve', moduleResolution: 'bundler', noEmit: true, types: [], ...opts }, include: ['src'] });

// --- пофайловое стирание: реэкспорт типа остаётся в коде и падает при выполнении
{
  const dir = project({
    'package.json': '{ "type": "module" }',
    'src/types.ts': 'export interface User { id: number }\nexport const ROLE = "admin";\n',
    'src/index.ts': "export { User, ROLE } from './types.ts';\n",
  });
  // esbuild видит один файл и не знает, что User — тип
  const js = transformSync(read(dir, 'src/index.ts'), { loader: 'ts' }).code;
  assert.match(js, /export \{ User, ROLE \} from ".\/types\.ts"/);
  write(dir, 'out/types.js', transformSync(read(dir, 'src/types.ts'), { loader: 'ts' }).code);
  write(dir, 'out/index.js', js.replace('types.ts', 'types.js'));
  const r = run(process.execPath, ['out/index.js'], { cwd: dir });
  assert.match(r.out, /does not provide an export named 'User'/);
  // isolatedModules ловит это при проверке
  write(dir, 'tsconfig.json', cfg({ isolatedModules: true, allowImportingTsExtensions: true }));
  assert.deepEqual(codes(tsc(tsc7, dir).out), ['TS1205']);   // Re-exporting a type when 'isolatedModules' is enabled requires using 'export type'
  write(dir, 'src/index.ts', "export type { User } from './types.ts';\nexport { ROLE } from './types.ts';\n");
  assert.deepEqual(codes(tsc(tsc7, dir).out), []);
}

// --- verbatimModuleSyntax: импорт только типа без type — ошибка
{
  const dir = project({
    'src/types.ts': 'export interface User { id: number }\n',
    'src/a.ts': "import { User } from './types';\nexport const u: User = { id: 1 };\n",
  });
  write(dir, 'tsconfig.json', cfg({ verbatimModuleSyntax: true }));
  assert.deepEqual(codes(tsc(tsc7, dir).out), ['TS1484']);   // 'User' is a type and must be imported using a type-only import
  write(dir, 'src/a.ts', "import type { User } from './types';\nexport const u: User = { id: 1 };\n");
  assert.deepEqual(codes(tsc(tsc7, dir).out), []);
}

// --- isolatedDeclarations: у экспорта должен быть явный тип, чтобы .d.ts можно было выпустить пофайлово
{
  const dir = project({ 'src/price.ts': 'export function total(items: { price: number }[]) { return items.reduce((s, i) => s + i.price, 0); }\n' });
  write(dir, 'tsconfig.json', cfg({ isolatedDeclarations: true, declaration: true, noEmit: false, emitDeclarationOnly: true, outDir: 'dist', rootDir: 'src' }));
  const r = tsc(tsc7, dir);
  assert.deepEqual(codes(r.out), ['TS9013']);
  assert.match(r.out, /Expression type can't be inferred with --isolatedDeclarations/);
  write(dir, 'src/price.ts', 'export function total(items: { price: number }[]): number { return items.reduce((s, i) => s + i.price, 0); }\n');
  assert.deepEqual(codes(tsc(tsc7, dir).out), []);
  assert.match(read(dir, 'dist/price.d.ts'), /export declare function total\(items: \{\s*price: number;\s*\}\[\]\): number;/);
}

// --- инкрементальная проверка: .tsbuildinfo
{
  const dir = project({ 'src/a.ts': 'export const a: number = 1;\n' });
  write(dir, 'tsconfig.json', cfg({ incremental: true, tsBuildInfoFile: '.cache/tsbuildinfo' }));
  assert.equal(tsc(tsc7, dir).status, 0);
  assert.ok(statSync(join(dir, '.cache/tsbuildinfo')).size > 0);
}

// --- TypeScript 7 (Go) против TypeScript 6 (JavaScript) на одном проекте
{
  const files = {};
  for (let i = 0; i < 300; i++) {
    files[`src/m${i}.ts`] = `import type { Item } from './types';
export type Mapped${i}<T> = { [K in keyof T as \`get\${Capitalize<string & K>}\`]: () => T[K] };
export function process${i}(items: Item[]): Mapped${i}<Item>[] { return items.map((i) => ({ getId: () => i.id, getTitle: () => i.title, getPrice: () => i.price })); }
`;
  }
  files['src/types.ts'] = 'export interface Item { id: number; title: string; price: number }\n';
  const dir = project(files);
  write(dir, 'tsconfig.json', cfg({}));
  const time = (bin) => { const t = performance.now(); const r = tsc(bin, dir); assert.equal(r.status, 0, r.out); return performance.now() - t; };
  time(tsc7); time(tsc6);                       // прогрев
  const t7 = time(tsc7), t6 = time(tsc6);
  console.log(`tsc 7: ${t7.toFixed(0)} мс, tsc 6: ${t6.toFixed(0)} мс, x${(t6 / t7).toFixed(1)}`);
  assert.ok(t6 > t7 * 1.5);
}
console.log('ts tooling ok');

function read(dir, p) { return run('cat', [join(dir, p)]).stdout; }
