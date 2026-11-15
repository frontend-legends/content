// Проверки к 16.11: обратимость решения как радиус изменения (настоящий dependency-cruiser: сколько модулей
// импортируют библиотеку напрямую), миграция strangler fig через настоящий HTTP-прокси с таблицей маршрутов,
// parallel run — сверка старой и новой реализации без влияния на пользователя, и записи о решениях, проверяемые в CI.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { project, run, bin } from '../../_lib/project.mjs';

// --- обратимость: сколько файлов придётся менять, если библиотеку решат заменить ---
const dependents = (files, pkg) => {
  const dir = project({ 'package.json': JSON.stringify({ type: 'module' }), ...files });
  const r = run(bin('depcruise'), ['src', '--output-type', 'json', '--no-config'], { cwd: dir });
  assert.equal(r.status, 0, r.out);
  return JSON.parse(r.stdout).modules
    .filter((m) => m.dependencies.some((d) => d.module === pkg))
    .map((m) => m.source.replace('src/', '')).sort();
};
const features = ['catalog/api.js', 'cart/api.js', 'checkout/api.js', 'profile/api.js', 'reviews/api.js', 'search/api.js'];
const direct = Object.fromEntries(features.map((f) => [`src/${f}`, `import axios from 'axios';\nexport const load = (id) => axios.get('/api/${f.split('/')[0]}/' + id).then((r) => r.data);\n`]));
assert.deepEqual(dependents(direct, 'axios'), [...features].sort());               // замена клиента — шесть фич

const wrapped = {
  'src/shared/http.js': "import axios from 'axios';\nexport const getJson = (url) => axios.get(url).then((r) => r.data);\n",
  ...Object.fromEntries(features.map((f) => [`src/${f}`, `import { getJson } from '../shared/http.js';\nexport const load = (id) => getJson('/api/${f.split('/')[0]}/' + id);\n`])),
};
assert.deepEqual(dependents(wrapped, 'axios'), ['shared/http.js']);    // одна точка — решение стало обратимым
const wrappedWithKy = { ...wrapped, 'src/shared/http.js': "import ky from 'ky';\nexport const getJson = (url) => ky.get(url, { prefixUrl: '' }).json();\n" };
assert.deepEqual(dependents(wrappedWithKy, 'axios'), []);
assert.deepEqual(dependents(wrappedWithKy, 'ky'), ['shared/http.js']); // замена — правка одного файла

// --- strangler fig: прокси перед двумя приложениями, маршруты переезжают по одному ---
const app = (name) => createServer((req, res) => { res.setHeader('x-app', name); res.end(`${name}:${req.url}`); });
const listen = (srv) => new Promise((r) => srv.listen(0, () => r(`http://localhost:${srv.address().port}`)));
const legacy = app('legacy'), next = app('next');
const legacyUrl = await listen(legacy), nextUrl = await listen(next);

let migrated = [];                                    // конфигурация, а не код: меняется без выкладки приложений
const proxy = createServer(async (req, res) => {
  const target = migrated.some((p) => req.url === p || req.url.startsWith(p + '/')) ? nextUrl : legacyUrl;
  const upstream = await fetch(target + req.url);
  res.setHeader('x-app', upstream.headers.get('x-app'));
  res.end(await upstream.text());
});
const proxyUrl = await listen(proxy);
const who = async (path) => (await fetch(proxyUrl + path)).headers.get('x-app');
const routes = ['/catalog', '/catalog/tea', '/cart', '/checkout', '/profile'];
const snapshot = async () => Object.fromEntries(await Promise.all(routes.map(async (r) => [r, await who(r)])));

assert.deepEqual(Object.values(await snapshot()), ['legacy', 'legacy', 'legacy', 'legacy', 'legacy']);
migrated = ['/catalog'];
assert.deepEqual(await snapshot(), { '/catalog': 'next', '/catalog/tea': 'next', '/cart': 'legacy', '/checkout': 'legacy', '/profile': 'legacy' });
migrated = ['/catalog', '/cart'];
assert.equal(await who('/cart'), 'next');
migrated = ['/catalog'];                              // откат одного маршрута — тоже правка конфигурации
assert.equal(await who('/cart'), 'legacy');
assert.equal(await who('/cartography'), 'legacy');   // префикс сравнивается по сегментам, а не по строке
migrated = routes.filter((r) => !r.includes('/', 1));
assert.deepEqual(Object.values(await snapshot()), ['next', 'next', 'next', 'next', 'next']); // старое можно выключать
for (const s of [proxy, legacy, next]) s.close();

// --- parallel run: пользователь получает старый результат, новый сверяется в фоне ---
const oldTotal = (items) => items.reduce((s, i) => s + Math.round(i.price * i.qty * (1 - i.discount)), 0);
const newTotal = (items) => Math.round(items.reduce((s, i) => s + i.price * i.qty * (1 - i.discount), 0)); // округление в конце
const mismatches = [];
const total = (items) => {
  const result = oldTotal(items);
  try {
    const candidate = newTotal(items);
    if (candidate !== result) mismatches.push({ items, old: result, new: candidate });
  } catch (e) { mismatches.push({ items, error: e.message }); }
  return result;                                       // поведение для пользователя не изменилось
};
const orders = [
  [{ price: 1000, qty: 1, discount: 0 }],
  [{ price: 250, qty: 4, discount: 0.1 }],
  [{ price: 120, qty: 2, discount: 0.1 }, { price: 80, qty: 1, discount: 0 }],
  [{ price: 333, qty: 1, discount: 0.05 }, { price: 333, qty: 1, discount: 0.05 }, { price: 333, qty: 1, discount: 0.05 }],
];
assert.deepEqual(orders.map(total), [1000, 900, 296, 948]);
assert.equal(mismatches.length, 1);                   // расхождение нашлось до переключения, а не в жалобах
assert.deepEqual([mismatches[0].old, mismatches[0].new], [948, 949]);
assert.equal(mismatches[0].items.length, 3);         // три позиции по 316,35: округление каждой против округления суммы

// --- записи о решениях проверяются как код ---
const adrs = {
  'docs/adr/0001-react-query-for-server-state.md': '# 1. TanStack Query для серверного состояния\n\nСтатус: принято\n\n## Контекст\nЗагрузка и ошибки в Redux вручную.\n\n## Решение\nСерверные данные — в TanStack Query.\n\n## Последствия\n+ кеш и дедупликация; − новая зависимость.\n',
  'docs/adr/0002-axios.md': '# 2. HTTP-клиент axios\n\nСтатус: заменено [0005](0005-ky.md)\n\n## Контекст\n…\n\n## Решение\n…\n\n## Последствия\n…\n',
  'docs/adr/0005-ky.md': '# 5. HTTP-клиент ky\n\nСтатус: принято, заменяет [0002](0002-axios.md)\n\n## Контекст\nНативный fetch, меньше вес.\n\n## Решение\nky за обёрткой shared/http.\n',
  'docs/adr/0006-ssr.md': '# 6. Серверный рендеринг каталога\n\nСтатус: заменено [0009](0009-ssg.md)\n\n## Контекст\n…\n\n## Решение\n…\n\n## Последствия\n…\n',
};
const checkAdrs = (docs) => {
  const problems = [];
  for (const [path, text] of Object.entries(docs)) {
    const name = path.split('/').pop();
    for (const section of ['## Контекст', '## Решение', '## Последствия']) if (!text.includes(section)) problems.push(`${name}: нет раздела «${section.slice(3)}»`);
    const status = text.match(/^Статус: (.+)$/m)?.[1];
    if (!status) problems.push(`${name}: нет статуса`);
    for (const [, link] of (status ?? '').matchAll(/\]\(([^)]+)\)/g)) if (!docs[`docs/adr/${link}`]) problems.push(`${name}: ссылка на несуществующую запись ${link}`);
  }
  return problems;
};
assert.deepEqual(checkAdrs(adrs), [
  '0005-ky.md: нет раздела «Последствия»',
  '0006-ssr.md: ссылка на несуществующую запись 0009-ssg.md',
]);
adrs['docs/adr/0005-ky.md'] += '\n## Последствия\n+ меньше бандл; − переписать перехватчики.\n';
adrs['docs/adr/0009-ssg.md'] = '# 9. Статическая генерация каталога\n\nСтатус: принято, заменяет [0006](0006-ssr.md)\n\n## Контекст\n…\n\n## Решение\n…\n\n## Последствия\n…\n';
assert.deepEqual(checkAdrs(adrs), []);

console.log('decisions ok');
