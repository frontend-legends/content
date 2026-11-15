// Глава 11.02 — модули глазами инструментов на Node.js 24: поиск в node_modules, поле exports и условия,
// "type", import CommonJS из ESM (default и именованные), require(esm), двойной пакет, __esModule у бандлера.
// run: node resolution.mjs
import assert from 'node:assert/strict';
import { project, run } from '../../_lib/project.mjs';
import { build } from 'rolldown';
import { join } from 'node:path';

const node = (dir, file) => run(process.execPath, [file], { cwd: dir });

const dir = project({
  'package.json': '{ "name": "app", "type": "module" }',
  // пакет с exports и условиями
  'node_modules/price-kit/package.json': JSON.stringify({
    name: 'price-kit',
    exports: {
      '.': { import: './esm/index.js', require: './cjs/index.cjs' },
      './format': './esm/format.js',
    },
  }),
  'node_modules/price-kit/esm/index.js': 'export const kind = "esm"; export class Money {}\n',
  'node_modules/price-kit/esm/format.js': 'export const format = (v) => v + " ₽";\n',
  'node_modules/price-kit/esm/internal.js': 'export const secret = 1;\n',
  'node_modules/price-kit/cjs/index.cjs': 'exports.kind = "cjs"; class Money {} exports.Money = Money;\n',
  // CommonJS-пакет
  'node_modules/legacy/package.json': '{ "name": "legacy", "main": "index.js" }',
  'node_modules/legacy/index.js': 'exports.add = (a, b) => a + b;\nObject.assign(exports, { dynamicName: 1 });\nmodule.exports.version = "1.0";\n',
  // CommonJS, скомпилированный из ESM: флаг __esModule
  'node_modules/compiled/package.json': '{ "name": "compiled", "main": "index.js" }',
  'node_modules/compiled/index.js': 'Object.defineProperty(exports, "__esModule", { value: true });\nexports.default = function greet() { return "привет"; };\n',
  // ESM-пакеты для require(esm)
  'node_modules/esm-only/package.json': '{ "name": "esm-only", "type": "module", "exports": "./index.js" }',
  'node_modules/esm-only/index.js': 'export default function hello() { return "hi"; }\nexport const named = 1;\n',
  'node_modules/esm-tla/package.json': '{ "name": "esm-tla", "type": "module", "exports": "./index.js" }',
  'node_modules/esm-tla/index.js': 'export const config = await Promise.resolve({ ok: true });\n',

  'conditions.js': `import { kind } from 'price-kit';
import { format } from 'price-kit/format';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
console.log(kind, require('price-kit').kind, format(5));`,
  'deep.js': `import { secret } from 'price-kit/esm/internal.js';`,
  'interop.js': `import legacy, { add, version } from 'legacy';
import * as ns from 'legacy';
import greetDefault from 'compiled';
console.log(JSON.stringify({ add: add(1, 2), version, defaultIsExports: typeof legacy.add, hasDynamic: 'dynamicName' in ns, compiledType: typeof greetDefault, compiledDefaultType: typeof greetDefault.default }));`,
  'require-esm.cjs': `const m = require('esm-only');
console.log(JSON.stringify({ keys: Object.keys(m), defaultType: typeof m.default, named: m.named }));`,
  'require-tla.cjs': `require('esm-tla');`,
  'dual.js': `import { Money as M1 } from 'price-kit';
import { createRequire } from 'node:module';
const { Money: M2 } = createRequire(import.meta.url)('price-kit');
console.log(M1 === M2, new M1() instanceof M2);`,
  'plain.js': 'export const x = 1; console.log(typeof require);\n',
}, { linkModules: false });

// --- exports и условия: import берёт ESM-версию, require — CJS
assert.equal(node(dir, 'conditions.js').stdout.trim(), 'esm cjs 5 ₽');

// --- exports закрывает внутренние пути
{
  const r = node(dir, 'deep.js');
  assert.notEqual(r.status, 0);
  assert.match(r.out, /ERR_PACKAGE_PATH_NOT_EXPORTED/);
}

// --- импорт CommonJS из ESM
{
  const r = JSON.parse(node(dir, 'interop.js').stdout);
  assert.equal(r.add, 3);
  assert.equal(r.version, '1.0');
  assert.equal(r.defaultIsExports, 'function');   // default — это module.exports целиком
  assert.equal(r.hasDynamic, false);               // имя из Object.assign статический анализ не нашёл
  assert.equal(r.compiledType, 'object');          // Node игнорирует __esModule: default — весь exports
  assert.equal(r.compiledDefaultType, 'function');
}

// --- require(esm): работает без top-level await, отдаёт пространство имён
{
  const r = JSON.parse(node(dir, 'require-esm.cjs').stdout);
  assert.deepEqual(r.keys.sort(), ['__esModule', 'default', 'named']);   // Node добавляет __esModule для совместимости
  assert.equal(r.defaultType, 'function');
  const t = node(dir, 'require-tla.cjs');
  assert.notEqual(t.status, 0);
  assert.match(t.out, /ERR_REQUIRE_ASYNC_MODULE/);
}

// --- двойной пакет: две копии модуля, два разных класса
assert.equal(node(dir, 'dual.js').stdout.trim(), 'false false');

// --- "type": "module" — .js читается как ESM, require нет
assert.equal(node(dir, 'plain.js').stdout.trim(), 'undefined');

// --- бандлер учитывает __esModule, Node — нет
{
  const bundle = await build({
    input: join(dir, 'bundle-entry.js'),
    cwd: dir,
    write: false,
    logLevel: 'silent',
    plugins: [{ name: 'virtual', resolveId: (id) => (id === join(dir, 'bundle-entry.js') ? id : null), load: (id) => (id.endsWith('bundle-entry.js') ? "import greet from 'compiled'; globalThis.__result = typeof greet;" : null) }],
  });
  const code = bundle.output[0].code;
  new Function(code.replace(/^import .*$/gm, ''))();
  assert.equal(globalThis.__result, 'function');   // бандлер отдал exports.default
}
console.log('resolution ok');
