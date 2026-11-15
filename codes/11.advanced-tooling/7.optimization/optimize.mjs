// Глава 11.07 — оптимизация сборки: что делает минификатор, /*#__PURE__*/ и побочные эффекты,
// sideEffects: false выбрасывает CSS-импорт, ручное разбиение на чанки, сжатие gzip и brotli.
// run: node optimize.mjs
import assert from 'node:assert/strict';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { join } from 'node:path';
import { project, read, list, codesDir } from '../../_lib/project.mjs';
import { rolldown } from 'rolldown';
import { build } from 'vite';
import { minify } from 'rolldown/experimental';

// --- минификатор: пробелы, короткие имена, свёртка констант, мёртвые ветки
{
  const src = `export function calculateTotal(items) {
  const TAX_RATE = 0.2;
  let subtotal = 0;
  for (const item of items) subtotal += item.price * item.quantity;
  if (process.env.NODE_ENV !== 'production') { console.warn('debug total', subtotal); }
  return subtotal * (1 + TAX_RATE);
}`;
  const { code } = await minify('x.js', src.replace("process.env.NODE_ENV", '"production"'), { compress: true, mangle: true });
  assert.ok(code.length < src.length / 2, code);
  assert.doesNotMatch(code, /debug total/);               // ветка 'production' !== 'production' удалена
  assert.doesNotMatch(code, /subtotal|TAX_RATE/);         // локальные имена укорочены
  assert.match(code, /calculateTotal/);                   // экспорт сохранил имя
  assert.match(code, /1\.2/);                             // 1 + 0.2 свёрнуто в константу
}

// --- побочные эффекты: вызов верхнего уровня остаётся, с /*#__PURE__*/ — удаляется
async function bundle(files, input = 'src/main.js', opts = {}) {
  const dir = project(files, { linkModules: false });
  const b = await rolldown({ input: join(dir, input), logLevel: 'silent', ...opts });
  const { output } = await b.generate({ format: 'es', ...opts.output });
  return { dir, output };
}
{
  const { output } = await bundle({
    'src/main.js': "import { a } from './lib.js'; console.log(a);",
    'src/lib.js': `export const a = 1;
export const registry = createRegistry();            // вызов может что-то делать
export const cache = /*#__PURE__*/ createCache();    // помечен чистым
function createRegistry() { globalThis.__registered = true; return {}; }
function createCache() { return new Map(); }`,
  });
  const code = output[0].code;
  assert.match(code, /createRegistry/);                   // неиспользуемый, но с возможным эффектом — оставлен
  assert.doesNotMatch(code, /createCache/);               // PURE — удалён
}

// --- sideEffects: false у библиотеки: модуль-«бочка» выброшен вместе со своим импортом CSS;
// исключение ["*.css"] стили возвращает, а модуль с кодом верхнего уровня всё равно выбрасывается
async function uiKit(sideEffects, cssInButton = false) {
  const dir = project({
    'index.html': '<!doctype html><script type="module" src="/src/main.js"></script>',
    'package.json': '{ "name": "shop" }',
    'src/main.js': "import { button } from 'ui-kit';\ndocument.body.append(button());\n",
    'node_modules/ui-kit/package.json': JSON.stringify({ name: 'ui-kit', type: 'module', exports: './index.js', ...(sideEffects === undefined ? {} : { sideEffects }) }),
    'node_modules/ui-kit/index.js': (cssInButton ? '' : "import './button.css';\n") + "export { button } from './button.js';\nexport { chart } from './chart.js';\n",
    'node_modules/ui-kit/button.js': (cssInButton ? "import './button.css';\n" : '') + "export const button = () => document.createElement('button');\n",
    'node_modules/ui-kit/chart.js': "globalThis.__chartRegistered = 'тяжёлый график';\nexport const chart = () => 1;\n",
    'node_modules/ui-kit/button.css': 'button { color: rebeccapurple; }\n',
  }, { linkModules: false });
  await build({ root: dir, logLevel: 'silent', configFile: false });
  const out = list(dir, 'dist');
  const js = read(dir, 'dist/' + out.find((f) => f.endsWith('.js')));
  return { css: out.some((f) => f.endsWith('.css')), chart: /тяжёлый график/.test(js) };
}
assert.deepEqual(await uiKit(undefined), { css: true, chart: true });     // без флага: всё на месте, включая неиспользуемый chart.js
assert.deepEqual(await uiKit(false), { css: false, chart: false });       // флаг: chart выброшен, но и стили пропали
assert.deepEqual(await uiKit(['*.css']), { css: false, chart: false });   // не помогает: «бочку» с импортом стилей обходят
assert.deepEqual(await uiKit(['*.css'], true), { css: true, chart: false });   // стили импортирует модуль, который их использует
assert.deepEqual(await uiKit(['*.css', './index.js']), { css: true, chart: false });   // или «бочка» помечена как имеющая эффекты

// --- ручное разбиение: зависимости в отдельный чанк
{
  const { output } = await bundle({
    'src/main.js': "import { formatPrice } from 'money-lib'; import { open } from './cart.js'; console.log(formatPrice(1), open());",
    'src/cart.js': 'export const open = () => "корзина";',
    'node_modules/money-lib/package.json': '{ "name": "money-lib", "type": "module", "exports": "./index.js" }',
    'node_modules/money-lib/index.js': 'export const formatPrice = (v) => v + " ₽";',
  }, 'src/main.js', { output: { codeSplitting: { groups: [{ name: 'vendor', test: /node_modules/ }] }, chunkFileNames: '[name]-[hash].js' } });
  const chunks = output.filter((o) => o.type === 'chunk');
  const vendor = chunks.find((c) => c.name === 'vendor');
  assert.ok(vendor, chunks.map((c) => c.fileName).join(','));
  assert.match(vendor.code, /₽/);
  assert.doesNotMatch(chunks.find((c) => c.isEntry).code, / ₽/);
}

// --- сжатие: минификация и сжатие складываются; brotli меньше gzip
{
  const vueProd = read(join(codesDir, 'node_modules/vue/dist'), 'vue.runtime.esm-browser.prod.js');
  const raw = Buffer.byteLength(vueProd);
  const gz = gzipSync(vueProd, { level: 9 }).length;
  const br = brotliCompressSync(vueProd).length;
  console.log(`vue runtime prod: ${(raw / 1024).toFixed(0)} КБ, gzip ${(gz / 1024).toFixed(0)} КБ, brotli ${(br / 1024).toFixed(0)} КБ`);
  assert.ok(gz < raw / 2.5);
  assert.ok(br < gz);
}
console.log('optimize ok');
