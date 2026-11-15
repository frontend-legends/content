// Проверка к 14.05: общий код и платформенные файлы. Сборщик выбирает share.web.js или share.native.js
// по списку расширений — так React Native (Metro) и react-native-web делят реализацию по платформам.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { project, run, bin, list, read } from '../../_lib/project.mjs';

const dir = project({
  'package.json': JSON.stringify({ type: 'module' }),
  'index.html': '<!doctype html><script type="module" src="/main.js"></script>',
  'main.js': "import { share } from './share';\nimport { total } from './cart';\nconsole.log(share('Пуэр'), total([{ price: 1200, qty: 2 }]));\n",
  // общая логика — одна для всех платформ
  'cart.js': 'export const total = (items) => items.reduce((s, i) => s + i.price * i.qty, 0);\n',
  // платформенная реализация
  'share.web.js': "export const share = (title) => `web-share:${title}`; // navigator.share или копирование ссылки\n",
  'share.native.js': "export const share = (title) => `native-share:${title}`; // Share API платформы\n",
  'vite.web.config.js': "export default { resolve: { extensions: ['.web.js', '.js'] }, build: { outDir: 'dist-web', minify: false } };",
  'vite.native.config.js': "export default { resolve: { extensions: ['.native.js', '.js'] }, build: { outDir: 'dist-native', minify: false } };",
});
const build = (cfg, out) => {
  const r = run(bin('vite'), ['build', '--config', cfg, '--logLevel', 'error'], { cwd: dir });
  assert.equal(r.status, 0, r.out);
  return read(dir, join(out, list(dir, out).find((f) => f.endsWith('.js'))));
};
const web = build('vite.web.config.js', 'dist-web');
const native = build('vite.native.config.js', 'dist-native');
assert.match(web, /web-share:/);
assert.doesNotMatch(web, /native-share:/);
assert.match(native, /native-share:/);
assert.doesNotMatch(native, /web-share:/);
// общая логика попала в обе сборки
for (const code of [web, native]) assert.match(code, /reduce\(\(s, i\) => s \+ i\.price \* i\.qty, 0\)/);
console.log('platforms ok');
