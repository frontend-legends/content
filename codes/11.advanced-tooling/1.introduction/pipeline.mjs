// Глава 11.01 — конвейер сборки на настоящем Vite 8: исходники TS и CSS → граф → ассеты с хешами;
// dev-сервер отдаёт модули по одному без сборки; в prod выброшен код для разработки.
// run: node pipeline.mjs
import assert from 'node:assert/strict';
import { project, read, list } from '../../_lib/project.mjs';
import { build, createServer } from 'vite';

const files = {
  'index.html': '<!doctype html><html><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>',
  'src/main.ts': `import './style.css';
import { formatPrice } from './price';
const total: number = 980;
if (import.meta.env.DEV) console.log('отладка: только в разработке');
document.querySelector('#app')!.textContent = formatPrice(total);
`,
  'src/price.ts': `export function formatPrice(value: number): string { return value + ' ₽'; }
export function unused(): string { return 'этот код не попадёт в сборку'; }
`,
  'src/style.css': '.price { color: #42b883; }\n',
};

// --- prod-сборка
const dir = project(files);
await build({ root: dir, logLevel: 'silent', build: { outDir: 'dist' } });
const out = list(dir, 'dist');
const js = out.find((f) => /^assets\/index-[\w-]{8}\.js$/.test(f));
const css = out.find((f) => /^assets\/index-[\w-]{8}\.css$/.test(f));
assert.ok(js && css, out.join(', '));                         // имена с хешем содержимого
const code = read(dir, `dist/${js}`);
assert.doesNotMatch(code, /: number|: string/);              // типы стёрты
assert.doesNotMatch(code, /отладка/);                        // ветка import.meta.env.DEV выброшена
assert.doesNotMatch(code, /не попадёт в сборку/);            // неиспользуемый экспорт выброшен
assert.match(code, /₽/);
assert.ok(code.split('\n').length <= 3);                      // минифицировано
const html = read(dir, 'dist/index.html');
assert.match(html, new RegExp(`src="/${js.replace('.', '\\.')}"`));   // HTML ссылается на хешированный файл
assert.match(html, new RegExp(`href="/${css.replace('.', '\\.')}"`));

// изменение содержимого меняет хеш, неизменённый CSS сохраняет свой
const dir2 = project({ ...files, 'src/price.ts': files['src/price.ts'].replace("' ₽'", "' руб.'") });
await build({ root: dir2, logLevel: 'silent' });
const out2 = list(dir2, 'dist');
assert.ok(!out2.includes(js));
assert.ok(out2.includes(css));

// --- dev-сервер: каждый модуль отдельно, по запросу, без сборки в один файл
const server = await createServer({ root: dir, logLevel: 'silent', server: { middlewareMode: true } });
const main = await server.transformRequest('/src/main.ts');
assert.match(main.code, /import "\/src\/style\.css"/);        // импорты переписаны в URL
assert.match(main.code, /import \{ formatPrice \} from "\/src\/price\.ts"/);
assert.match(main.code, /отладка/);                           // код для разработки на месте
assert.doesNotMatch(main.code, /: number/);                   // типы стёрты и здесь
assert.doesNotMatch(main.code, /function formatPrice/);       // соседний модуль не вклеен
await server.close();
console.log('pipeline ok');
