// Глава 11.03 — как работает бандлер: граф от точки входа, динамический import → отдельный чанк,
// общий модуль → общий чанк, плагины (resolveId/load/transform) одинаковы в Rollup и Rolldown,
// scope hoisting, обёртка для CommonJS, external у библиотеки.
// run: node bundler.mjs
import assert from 'node:assert/strict';
import { project } from '../../_lib/project.mjs';
import { join } from 'node:path';
import { rolldown } from 'rolldown';
import { rollup } from 'rollup';

const dir = project({
  'src/main.js': `import { formatPrice } from './price.js';
import data from 'virtual:build-info';
import note from './note.txt';
document.title = formatPrice(980) + data.built + note;
document.querySelector('#cart').onclick = () => import('./cart.js').then((m) => m.open());
document.querySelector('#checkout').onclick = () => import('./checkout.js').then((m) => m.start());
`,
  'src/price.js': `export const formatPrice = (v) => v + ' ₽';\nexport const unused = () => 'не используется';\n`,
  'src/cart.js': `import { money } from './shared.js';\nexport const open = () => money(1);\n`,
  'src/checkout.js': `import { money } from './shared.js';\nexport const start = () => money(2);\n`,
  'src/shared.js': `export const money = (v) => v * 100;\n`,
  'src/note.txt': 'привет из txt',
  'src/legacy.cjs': 'module.exports = { legacy: true };\n',
  'src/uses-legacy.js': `import l from './legacy.cjs';\nexport const isLegacy = l.legacy;\n`,
  'lib/index.js': `import { ref } from 'vue';\nexport const useCounter = () => ref(0);\n`,
}, { linkModules: true });

// плагин: виртуальный модуль и импорт .txt как строки — один и тот же объект для Rollup и Rolldown
const plugin = {
  name: 'demo',
  resolveId(id) { return id === 'virtual:build-info' ? '\0build-info' : null; },
  load(id) { return id === '\0build-info' ? 'export default { built: " (сборка)" }' : null; },
  transform(code, id) { return id.endsWith('.txt') ? `export default ${JSON.stringify(code)};` : null; },
};

for (const [name, create] of [['rolldown', rolldown], ['rollup', rollup]]) {
  const bundle = await create({ input: join(dir, 'src/main.js'), plugins: [plugin], logLevel: 'silent', onwarn() {} });
  const { output } = await bundle.generate({ format: 'es', entryFileNames: '[name].js', chunkFileNames: '[name]-[hash].js' });
  const chunks = output.filter((o) => o.type === 'chunk');
  const byName = Object.fromEntries(chunks.map((c) => [c.name, c]));
  // точка входа + два ленивых чанка + общий чанк для shared.js
  assert.equal(chunks.length, 4, `${name}: ${chunks.map((c) => c.fileName)}`);
  assert.ok(byName.main.isEntry);
  assert.ok(byName.cart.isDynamicEntry && byName.checkout.isDynamicEntry, name);
  const sharedChunk = chunks.find((c) => !c.isEntry && !c.isDynamicEntry);
  assert.match(sharedChunk.code, /v \* 100/, name);        // shared.js вынесен один раз
  assert.doesNotMatch(byName.cart.code, /v \* 100/, name);
  // плагин сработал
  assert.match(byName.main.code, /\(сборка\)/, name);
  assert.match(byName.main.code, /привет из txt/, name);
  // scope hoisting: price.js вклеен в общую область, без обёртки модуля; неиспользуемое выброшено
  assert.match(byName.main.code, /const formatPrice = \(v\) => v \+ " ₽"|const formatPrice = \(v\) => v \+ ' ₽'/, name);
  assert.doesNotMatch(byName.main.code, /не используется/, name);
  await bundle.close?.();
}

// --- CommonJS-модуль получает обёртку-функцию (его экспорты известны только при выполнении)
{
  const b = await rolldown({ input: join(dir, 'src/uses-legacy.js'), logLevel: 'silent' });
  const { output } = await b.generate({ format: 'es' });
  assert.match(output[0].code, /__commonJS/);
}

// --- библиотека: зависимости остаются внешними, приложение их вклеивает
{
  const lib = await rolldown({ input: join(dir, 'lib/index.js'), external: ['vue'], logLevel: 'silent' });
  const libOut = (await lib.generate({ format: 'es' })).output[0].code;
  assert.match(libOut, /import \{ ref \} from "vue"/);
  assert.ok(libOut.length < 500);
  const app = await rolldown({ input: join(dir, 'lib/index.js'), logLevel: 'silent', platform: 'browser' });
  const appOut = (await app.generate({ format: 'es' })).output[0].code;
  assert.doesNotMatch(appOut, /from "vue"/);
  assert.ok(appOut.length > 20_000);                       // Vue внутри бандла
}
console.log('bundler ok');
