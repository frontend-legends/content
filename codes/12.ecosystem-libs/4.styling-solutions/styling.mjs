// Глава 12.04 — цена инструментов стилизации: Tailwind 4 генерирует только найденные классы и не находит собранные
// из строк; CSS Modules хешируют имена и не выбрасывают неиспользуемые классы; runtime CSS-in-JS вставляет стили
// при выполнении и плодит классы на каждое значение.
// run: node styling.mjs
import assert from 'node:assert/strict';
import { build } from 'vite';
import tailwind from '@tailwindcss/vite';
import { project, read, list, cost } from '../../_lib/project.mjs';
import { dom } from '../../_lib/vue.mjs';

const cssOf = (dir) => read(dir, 'dist/' + list(dir, 'dist').find((f) => f.endsWith('.css')));

// --- Tailwind 4: только используемые утилиты; классы, собранные из частей строки, не находятся
{
  const dir = project({
    'index.html': '<!doctype html><div id="app"></div><script type="module" src="/src/main.js"></script>',
    'src/style.css': '@import "tailwindcss";\n',
    'src/main.js': `import './style.css';
const status = 'error';
const color = status === 'error' ? 'red' : 'green';
document.querySelector('#app').innerHTML = \`
  <p class="p-4 text-lg bg-blue-500">статично</p>
  <p class="bg-\${color}-500">собрано из частей</p>
  <p class="\${status === 'error' ? 'text-red-700' : 'text-green-700'}">полное имя в строке</p>
  <p class="w-[137px]">произвольное значение</p>
  <p class="w-(--w)" style="--w: 37%">значение из данных через переменную</p>\`;
`,
  });
  await build({ root: dir, logLevel: 'silent', plugins: [tailwind()] });
  const css = cssOf(dir);
  assert.match(css, /\.p-4\{/);
  assert.match(css, /\.bg-blue-500\{/);
  assert.doesNotMatch(css, /\.bg-red-500/);           // «bg-${color}-500» сканер не видит
  assert.match(css, /\.text-red-700\{/);              // полные имена в строках находятся
  assert.match(css, /\.text-green-700\{/);
  assert.match(css, /\.w-\\\[137px\\\]\{width:137px\}/);
  assert.match(css, /\.w-\\\(--w\\\)\{width:var\(--w\)\}/);   // значение из данных — через CSS-переменную
  assert.doesNotMatch(css, /\.p-8\{|\.bg-yellow-200/); // неиспользуемых утилит нет
  console.log(`Tailwind CSS: ${(Buffer.byteLength(css) / 1024).toFixed(1)} КБ`);
}

// --- CSS Modules: имена хешируются, неиспользуемый класс модуля всё равно в сборке
{
  const dir = project({
    'index.html': '<!doctype html><script type="module" src="/src/main.js"></script>',
    'src/card.module.css': '.card { padding: 16px; }\n.title { font-weight: 700; }\n.unusedLegacy { color: hotpink; }\n',
    'src/main.js': "import s from './card.module.css';\ndocument.body.innerHTML = `<div class=\"${s.card}\"><h3 class=\"${s.title}\">Чай</h3></div>`;\n",
  });
  await build({ root: dir, logLevel: 'silent' });
  const css = cssOf(dir);
  assert.doesNotMatch(css, /\.card\{/);               // глобального .card нет
  assert.match(css, /\._card_[\w-]+\{padding:16px\}/);  // хешированное имя
  assert.match(css, /_unusedLegacy_[\w-]+\{color:#ff69b4\}/);   // неиспользуемый класс остался (минификатор сократил hotpink до #ff69b4)
}

// --- runtime CSS-in-JS: стили вставляются при выполнении, на каждое значение — новый класс
{
  globalThis.document = dom.window.document;
  const { css, sheet } = await import('@emotion/css');
  const before = document.head.querySelectorAll('style').length;
  const classes = new Set();
  for (let price = 100; price < 150; price++) {
    classes.add(css({ padding: 8, color: price > 120 ? 'red' : 'black', width: price }));   // ширина зависит от данных
  }
  assert.equal(classes.size, 50);                      // 50 значений — 50 классов и 50 правил
  assert.ok(document.head.querySelectorAll('style').length > before);
  assert.ok(sheet.tags.length > 0);
  const size = (await cost("import { css } from '@emotion/css'; console.log(css({ color: 'red' }));")).gzip;
  console.log(`@emotion/css в бандле: ${(size / 1024).toFixed(1)} КБ gzip`);
  assert.ok(size > 5 * 1024);
}
console.log('styling ok');
