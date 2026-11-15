// Глава 12.01 — цена зависимости: размер в бандле (одна функция из lodash и lodash-es, moment, date-fns, dayjs, Intl),
// транзитивные зависимости по lock-файлу, лицензии.
// run: node choosing.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cost, codesDir } from '../../_lib/project.mjs';

const kb = (b) => +(b / 1024).toFixed(1);
const sizes = {};
for (const [name, code] of Object.entries({
  'lodash: debounce': "import { debounce } from 'lodash'; console.log(debounce);",
  'lodash-es: debounce': "import { debounce } from 'lodash-es'; console.log(debounce);",
  'своя debounce': 'const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }; console.log(debounce);',
  'moment: format': "import moment from 'moment'; console.log(moment().format('LL'));",
  'date-fns: format': "import { format } from 'date-fns'; console.log(format(new Date(), 'PP'));",
  'dayjs: format': "import dayjs from 'dayjs'; console.log(dayjs().format('D MMMM YYYY'));",
  'Intl: format': "console.log(new Intl.DateTimeFormat('ru', { dateStyle: 'long' }).format(new Date()));",
})) sizes[name] = kb((await cost(code)).gzip);
console.table(sizes);

assert.ok(sizes['lodash: debounce'] > 20);                         // CommonJS-пакет целиком
assert.ok(sizes['lodash-es: debounce'] < 1.5);                     // ESM: только нужная функция
assert.ok(sizes['своя debounce'] < 0.2);
assert.ok(sizes['moment: format'] > sizes['date-fns: format'] * 3);
assert.ok(sizes['date-fns: format'] > sizes['dayjs: format']);
assert.ok(sizes['Intl: format'] < 0.2);                            // встроено в браузер

// --- транзитивные зависимости: сколько пакетов приходит вместе с одним
const lock = JSON.parse(readFileSync(join(codesDir, 'package-lock.json'), 'utf8')).packages;
function closure(name, seen = new Set()) {
  const entry = lock[`node_modules/${name}`];
  if (!entry || seen.has(name)) return seen;
  seen.add(name);
  for (const dep of Object.keys(entry.dependencies ?? {})) closure(dep, seen);
  return seen;
}
const eslintDeps = closure('eslint').size - 1;
const oxlintDeps = closure('oxlint').size - 1;
console.log(`транзитивных зависимостей: eslint ${eslintDeps}, oxlint ${oxlintDeps}`);
assert.ok(eslintDeps > 50);
assert.ok(oxlintDeps < 3);                                         // нативный бинарник — почти без зависимостей

// --- лицензии
const license = (name) => lock[`node_modules/${name}`].license;
assert.equal(license('vue'), 'MIT');
assert.equal(license('lodash-es'), 'MIT');
// --- Intl из практики
assert.equal(new Intl.RelativeTimeFormat('ru', { numeric: 'auto' }).format(-3, 'day'), '3 дня назад');
console.log('choosing ok');
