// Проверки к 12.16: сборка библиотеки tsdown, проверка пакета publint, что попадёт в npm pack.
import assert from 'node:assert/strict';
import { project, run, bin, list, read, write } from '../../_lib/project.mjs';
import { publint } from 'publint';

const source = {
  'src/index.ts': `import { useMemo } from 'react';
export function formatPrice(n: number): string {
  return new Intl.NumberFormat('ru', { style: 'currency', currency: 'RUB' }).format(n);
}
export function usePrice(n: number): string {
  return useMemo(() => formatPrice(n), [n]);
}
`,
  'src/index.test.ts': '// тесты не должны попасть в пакет',
  'README.md': '# @shop/price',
  'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true, target: 'es2022', module: 'esnext', moduleResolution: 'bundler', declaration: true, isolatedDeclarations: true, skipLibCheck: true } }),
};

// пакет «как часто пишут»: types после import, пути угаданы, files нет
const naivePkg = {
  name: '@shop/price', version: '1.0.0', type: 'module',
  exports: { '.': { import: './dist/index.js', types: './dist/index.d.ts' } },
  peerDependencies: { react: '>=18' },
};
const dir = project({ ...source, 'package.json': JSON.stringify(naivePkg, null, 2) });

const build = run(bin('tsdown'), ['src/index.ts', '--format', 'esm', '--dts'], { cwd: dir });
assert.equal(build.status, 0, build.stdout + build.stderr);
// tsdown пишет .mjs и .d.mts
assert.deepEqual(list(dir, 'dist').sort(), ['index.d.mts', 'index.mjs']);
const js = read(dir, 'dist/index.mjs');
// React остался внешним импортом, а не вклеен
assert.match(js, /import \{ useMemo \} from "react"/);
assert.ok(js.length < 1000);
assert.match(read(dir, 'dist/index.d.mts'), /declare function formatPrice\(n: number\): string/);

// publint находит ошибки в package.json
const codes = async () => (await publint({ pkgDir: dir })).messages.map((m) => `${m.type}:${m.code}`).sort();
assert.deepEqual(await codes(), [
  'error:EXPORTS_TYPES_SHOULD_BE_FIRST',
  'error:FILE_DOES_NOT_EXIST',
  'error:FILE_DOES_NOT_EXIST',
  'suggestion:USE_FILES',
]);

// без files в пакет попадает всё: исходники, тесты, конфиги
const packed = () => JSON.parse(run('npm', ['pack', '--dry-run', '--json'], { cwd: dir }).stdout)[0].files.map((f) => f.path).sort();
assert.ok(packed().includes('src/index.test.ts'));
assert.ok(packed().includes('tsconfig.json'));

// исправленный package.json
const fixedPkg = {
  ...naivePkg,
  exports: { '.': { types: './dist/index.d.mts', import: './dist/index.mjs' } },
  files: ['dist'],
  sideEffects: false,
};
write(dir, 'package.json', JSON.stringify(fixedPkg, null, 2));
assert.deepEqual(await codes(), []);
assert.deepEqual(packed(), ['README.md', 'dist/index.d.mts', 'dist/index.mjs', 'package.json']);

console.log('build ok');
