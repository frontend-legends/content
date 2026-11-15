// Глава 11.02 — Vite 8: импорт по умолчанию из CommonJS с __esModule зависит от формата импортирующего файла.
// В ESM-проекте ("type": "module") default — весь module.exports, как в Node.js; иначе — module.exports.default.
// run: node vite-interop.mjs
import assert from 'node:assert/strict';
import { project, read, list } from '../../_lib/project.mjs';
import { build } from 'vite';

async function bundleType(type) {
  const dir = project({
    'package.json': JSON.stringify({ name: 'app', ...(type ? { type } : {}) }),
    'node_modules/compiled/package.json': '{ "name": "compiled", "main": "index.js" }',
    'node_modules/compiled/index.js': 'Object.defineProperty(exports, "__esModule", { value: true });\nexports.default = function greet() { return "привет"; };\n',
    'main.js': "import greet from 'compiled'; globalThis.__kind = typeof greet;\n",
  }, { linkModules: false });
  await build({ root: dir, logLevel: 'silent', configFile: false, build: { lib: { entry: 'main.js', formats: ['es'], fileName: 'out' }, minify: false } });
  const file = list(dir, 'dist').find((f) => /\.m?js$/.test(f));
  delete globalThis.__kind;
  new Function(read(dir, `dist/${file}`).replace(/^export .*$/gm, ''))();
  return globalThis.__kind;
}
assert.equal(await bundleType('module'), 'object');     // как Node.js
assert.equal(await bundleType(undefined), 'function');  // старое поведение бандлеров
console.log('vite interop ok');
