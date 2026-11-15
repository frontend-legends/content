// Проверки к 15.09: компиляция как общий тренд. React Compiler сам вставляет кеш мемоизации,
// Svelte 5 компилирует руны в статический шаблон и точечное обновление одного текстового узла.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { compile } from 'svelte/compiler';

const require = createRequire(import.meta.url);
const babel = require('@babel/core');

// --- React Compiler: та же функция компонента, но с кешем по зависимостям ---
const source = `export function Card({ product }) {
  const label = product.title + ' — ' + product.price + ' ₽';
  return <article><h2>{label}</h2></article>;
}`;
const { code: react } = babel.transformSync(source, {
  filename: 'Card.jsx', babelrc: false, configFile: false,
  plugins: ['babel-plugin-react-compiler'], parserOpts: { plugins: ['jsx'] },
});
assert.match(react, /import \{ c as _c \} from "react\/compiler-runtime";/);
assert.match(react, /const \$ = _c\(2\);/);            // две ячейки кеша
assert.match(react, /if \(\$\[0\] !== label\)/);       // JSX пересоздаётся, только если изменилась строка
assert.doesNotMatch(react, /useMemo|memo\(/);         // руками ничего не мемоизировали

// --- Svelte 5: статика уходит в шаблон, динамика — в один эффект на текстовый узел ---
const { js } = compile(`<script>
  let count = $state(0);
  let label = $derived('В корзине: ' + count);
</script>
<button onclick={() => count++}>{label}</button><ul><li>Пуэр</li><li>Улун</li></ul>`, { generate: 'client' });
assert.match(js.code, /\$\.from_html\(`<button> <\/button><ul><li>Пуэр<\/li><li>Улун<\/li><\/ul>`/); // список — статичный HTML
assert.match(js.code, /let count = \$\.state\(0\);/);
assert.match(js.code, /let label = \$\.derived\(\(\) => ['"]В корзине: ['"] \+ \$\.get\(count\)\);/);
assert.match(js.code, /\$\.template_effect\(\(\) => \$\.set_text\(text, \$\.get\(label\)\)\);/); // обновляется только текст кнопки
assert.equal((js.code.match(/template_effect/g) ?? []).length, 1);

console.log('future ok');
