// Глава 11.13 — нативный тулинг: Rolldown (Rust) против Rollup (JS) на одном графе, цена JS-плагинов
// в нативном бандлере, раздача бинарников через платформенные пакеты (и Wasm-запасной вариант).
// run: node native.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { project } from '../../_lib/project.mjs';
import { rolldown } from 'rolldown';
import { rollup } from 'rollup';

// граф из 1500 модулей
const files = {};
const N = 1500;
for (let i = 0; i < N; i++) {
  const imports = [1, 2, 3].map((d) => i + d).filter((j) => j < N).map((j) => `import { f${j} } from './m${j}.js';`).join('\n');
  files[`src/m${i}.js`] = `${imports}\nexport function f${i}(x) { const items = [x, ${i}, 'товар ${i}']; return items.map((v) => String(v).length).reduce((a, b) => a + b, 0)${i + 1 < N ? ` + f${i + 1}(x)` : ''}; }\nexport const unused${i} = () => ${i};\n`;
}
const dir = project(files, { linkModules: false });
const input = join(dir, 'src/m0.js');

async function time(fn, runs = 3) {
  await fn();                                   // прогрев
  const t = performance.now();
  for (let i = 0; i < runs; i++) await fn();
  return (performance.now() - t) / runs;
}
const viaRolldown = (plugins = []) => async () => { const b = await rolldown({ input, logLevel: 'silent', plugins }); await b.generate({ format: 'es' }); };
const viaRollup = async () => { const b = await rollup({ input, onwarn() {} }); await b.generate({ format: 'es' }); };

// --- один и тот же результат
{
  const a = await rolldown({ input, logLevel: 'silent' });
  const b = await rollup({ input, onwarn() {} });
  const ca = (await a.generate({ format: 'es' })).output[0].code;
  const cb = (await b.generate({ format: 'es' })).output[0].code;
  for (const code of [ca, cb]) {
    assert.match(code, /function f1499/);
    assert.doesNotMatch(code, /unused[1-9]/);   // tree shaking в обоих (экспорты точки входа сохраняются)
  }
}

// --- скорость
const tRolldown = await time(viaRolldown());
const tRollup = await time(viaRollup);
console.log(`1500 модулей: Rollup ${tRollup.toFixed(0)} мс, Rolldown ${tRolldown.toFixed(0)} мс, x${(tRollup / tRolldown).toFixed(1)}`);
assert.ok(tRollup > tRolldown * 2);

// --- JS-плагин в нативном бандлере: каждый вызов хука — переход Rust → JS и обратно;
// фильтр в описании хука позволяет Rust не вызывать JS для неподходящих модулей
{
  let calls = 0;
  const jsTransform = { name: 'js-transform', transform(code) { calls++; return code.replace(/товар/g, 'item'); } };
  const tPlugin = await time(viaRolldown([jsTransform]), 1);
  const unfilteredCalls = calls / 2;                    // прогрев + один замер
  calls = 0;
  const filtered = { name: 'filtered', transform: { filter: { id: /m1\d\d\.js$/ }, handler(code) { calls++; return code.replace(/товар/g, 'item'); } } };
  const tFiltered = await time(viaRolldown([filtered]), 1);
  const filteredCalls = calls / 2;
  console.log(`JS-хук transform: без фильтра ${unfilteredCalls} вызовов (${tPlugin.toFixed(0)} мс), с фильтром ${filteredCalls} (${tFiltered.toFixed(0)} мс)`);
  assert.ok(unfilteredCalls >= N);                      // JS вызван для каждого модуля (плюс служебный модуль рантайма)
  assert.equal(filteredCalls, 100);                     // только для m100–m199
  // тот же формат хука понимает Rollup
  let rollupCalls = 0;
  const b = await rollup({ input, onwarn() {}, plugins: [{ name: 'filtered', transform: { filter: { id: /m1\d\d\.js$/ }, handler(code) { rollupCalls++; return code; } } }] });
  await b.generate({ format: 'es' });
  assert.equal(rollupCalls, 100);
}

// --- бинарник приходит платформенным пакетом из optionalDependencies
{
  const require = createRequire(import.meta.url);
  const pkg = require('rolldown/package.json');
  const optional = Object.keys(pkg.optionalDependencies ?? {});
  assert.ok(optional.includes(`@rolldown/binding-${process.platform}-${process.arch}`));
  assert.ok(optional.includes('@rolldown/binding-wasm32-wasi'));      // запасной вариант для платформ без бинарника
  assert.ok(existsSync(join(require.resolve('rolldown/package.json'), '..', '..', '@rolldown', `binding-${process.platform}-${process.arch}`)));
}
console.log('native ok');
