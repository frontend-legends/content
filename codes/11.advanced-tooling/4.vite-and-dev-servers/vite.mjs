// Глава 11.04 — Vite 8: сборка на Rolldown, пребандлинг зависимостей и переписывание голых импортов,
// HMR-границы (import.meta.hot.accept), переменные окружения VITE_*, ассеты (хеш и встраивание), предзагрузка чанков.
// run: node vite.mjs
import assert from 'node:assert/strict';
import { project, read, list } from '../../_lib/project.mjs';
import * as vite from 'vite';

// --- Vite 8 собирает на Rolldown
assert.match(vite.version, /^8\./);
assert.equal(typeof vite.rolldownVersion, 'string');

const files = {
  'index.html': '<!doctype html><div id="app"></div><script type="module" src="/src/main.js"></script>',
  '.env': 'VITE_API_URL=https://api.shop.example\nDB_PASSWORD=secret123\n',
  'src/main.js': `import { createApp, h } from 'vue';
import { counter } from './counter.js';
import logo from './logo.svg';
import photo from './photo.png';
const api = import.meta.env.VITE_API_URL;
const leak = import.meta.env.DB_PASSWORD;
createApp({ render: () => h('p', [api, String(leak), logo, photo, counter()]) }).mount('#app');
document.querySelector('#app').onclick = () => import('./cart.js').then((m) => m.open());
`,
  'src/counter.js': `export const counter = () => 1;\nif (import.meta.hot) import.meta.hot.accept();\n`,
  'src/plain.js': `export const plain = 1;\n`,
  'src/cart.js': `import { counter } from './counter.js';\nexport const open = () => counter();\n`,
  'src/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>',
  'src/photo.png': Buffer.alloc(8000, 1).toString('binary'),
  'public/robots.txt': 'User-agent: *\n',
};

// --- dev-сервер
{
  const dir = project(files);
  const server = await vite.createServer({ root: dir, logLevel: 'silent', server: { middlewareMode: true }, optimizeDeps: { include: ['vue'] } });
  await server.environments.client.depsOptimizer?.init?.();
  const main = await server.transformRequest('/src/main.js');
  // голый импорт переписан на пребандленную зависимость
  assert.match(main.code, /from "\/node_modules\/\.vite\/deps\/vue\.js\?v=[\w]+"/);
  // переменные окружения: VITE_* доступны, остальные — нет
  assert.match(main.code, /"VITE_API_URL": "https:\/\/api\.shop\.example"/);
  assert.doesNotMatch(main.code, /secret123/);
  // HMR-граница: модуль, который принимает свои обновления
  await server.transformRequest('/src/counter.js');
  await server.transformRequest('/src/plain.js');
  const graph = server.environments.client.moduleGraph;
  const counter = await graph.getModuleByUrl('/src/counter.js');
  const plain = await graph.getModuleByUrl('/src/plain.js');
  assert.equal(counter.isSelfAccepting, true);
  assert.equal(plain.isSelfAccepting, false);
  const mainNode = await graph.getModuleByUrl('/src/main.js');
  assert.ok([...counter.importers].includes(mainNode));      // граф знает, кто импортирует модуль
  await server.close();
}

// --- продакшен-сборка
{
  const dir = project(files);
  await vite.build({ root: dir, logLevel: 'silent' });
  const out = list(dir, 'dist');
  const entry = out.find((f) => /^assets\/index-.*\.js$/.test(f));
  const code = read(dir, `dist/${entry}`);
  assert.match(code, /https:\/\/api\.shop\.example/);
  assert.doesNotMatch(code, /secret123/);                       // не VITE_ — не попадает в бандл
  assert.match(code, /data:image\/svg\+xml/);                    // маленький SVG встроен
  assert.ok(out.some((f) => /^assets\/photo-[\w-]+\.png$/.test(f)));   // большой PNG — файл с хешем
  assert.ok(out.includes('robots.txt'));                         // public копируется как есть
  assert.ok(out.some((f) => /^assets\/cart-[\w-]+\.js$/.test(f)));     // ленивый чанк
  assert.match(code, /modulepreload/);                           // предзагрузка зависимостей ленивого чанка
}
console.log('vite ok');
