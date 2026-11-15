// Проверки к 16.02: barrel-файл в dev-сервере Vite тянет все модули; цикл через собственный barrel
// ломает загрузку; правила границ фич и слоёв в dependency-cruiser роняют проверку.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { project, run, bin, write } from '../../_lib/project.mjs';
import { withPage } from '../../_lib/browser.mjs';

// --- barrel в dev-сервере: одна кнопка — пятьдесят запросов ---
const components = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`src/shared/ui/C${i}.js`, `export const C${i} = () => 'компонент ${i}';\n`]));
const barrel = Object.keys(components).map((f) => `export * from './${f.split('/').pop()}';`).join('\n') + "\nexport * from './Button.js';\n";
const dir = project({
  'package.json': JSON.stringify({ type: 'module' }),
  'index.html': '<!doctype html><div id="app"></div><script type="module" src="/src/main.js"></script>',
  'src/shared/ui/Button.js': "export const Button = () => 'Купить';\n",
  'src/shared/ui/index.js': barrel,
  ...components,
  'src/main.js': "import { Button } from './shared/ui/index.js';\ndocument.getElementById('app').textContent = Button();\n",
});
const { createServer } = await import(join(dir, 'node_modules/vite/dist/node/index.js'));
const count = async (main) => {
  write(dir, 'src/main.js', main);
  const server = await createServer({ root: dir, logLevel: 'silent', server: { port: 0 } });
  await server.listen();
  try {
    return await withPage(async (page) => {
      const modules = new Set();
      page.on('request', (r) => { const p = new URL(r.url()).pathname; if (p.startsWith('/src/shared/')) modules.add(p); });
      await page.goto(server.resolvedUrls.local[0]);
      await page.waitForFunction(() => document.getElementById('app').textContent === 'Купить');
      return modules.size;
    });
  } finally { await server.close(); }
};
const viaBarrel = await count("import { Button } from './shared/ui/index.js';\ndocument.getElementById('app').textContent = Button();\n");
const direct = await count("import { Button } from './shared/ui/Button.js';\ndocument.getElementById('app').textContent = Button();\n");
assert.equal(viaBarrel, 52); // barrel + 50 компонентов + Button
assert.equal(direct, 1);

// --- цикл через собственный barrel: модуль импортирует свою фичу через её index ---
const cyc = project({
  'package.json': JSON.stringify({ type: 'module' }),
  'features/cart/index.js': "export { CartBadge } from './ui/CartBadge.js';\nexport { formatCount } from './model/format.js';\n",
  'features/cart/ui/CartBadge.js': "import { formatCount } from '../index.js';\nexport const label = formatCount(3);\nexport const CartBadge = () => label;\n",
  'features/cart/model/format.js': "export const formatCount = (n) => `В корзине: ${n}`;\n",
  'main.js': "import { CartBadge } from './features/cart/index.js';\nconsole.log(CartBadge());\n",
}, { linkModules: false });
const broken = spawnSync(process.execPath, ['main.js'], { cwd: cyc, encoding: 'utf8' });
assert.notEqual(broken.status, 0);
assert.match(broken.stderr, /ReferenceError: Cannot access 'formatCount' before initialization/);
write(cyc, 'features/cart/ui/CartBadge.js', "import { formatCount } from '../model/format.js';\nexport const label = formatCount(3);\nexport const CartBadge = () => label;\n");
assert.equal(spawnSync(process.execPath, ['main.js'], { cwd: cyc, encoding: 'utf8' }).stdout.trim(), 'В корзине: 3');

// --- границы: только публичный API фичи, слои импортируют только вниз ---
const rules = {
  forbidden: [
    { name: 'feature-internals', severity: 'error', comment: 'чужую фичу — только через её index.js',
      from: { path: '^src/features/([^/]+)/' }, to: { path: '^src/features/([^/]+)/.+', pathNot: ['^src/features/$1/', '^src/features/[^/]+/index\\.js$'] } },
    { name: 'no-upward', severity: 'error', comment: 'entities и shared не знают о features',
      from: { path: '^src/(entities|shared)/' }, to: { path: '^src/features/' } },
    { name: 'no-cycles', severity: 'error', from: {}, to: { circular: true } },
  ],
};
const app = project({
  'package.json': JSON.stringify({ type: 'module' }),
  '.dependency-cruiser.json': JSON.stringify(rules),
  'src/shared/format.js': "export const rub = (n) => `${n} ₽`;\n",
  'src/entities/product/index.js': "export const product = { id: 7, title: 'Пуэр', price: 1200 };\n",
  'src/features/cart/index.js': "export { addToCart } from './model/add.js';\n",
  'src/features/cart/model/add.js': "import { rub } from '../../../shared/format.js';\nexport const addToCart = (p) => rub(p.price);\n",
  'src/features/checkout/index.js': "import { addToCart } from '../cart/index.js';\nexport const checkout = (p) => addToCart(p);\n",
}, { linkModules: false });
const cruise = () => run(bin('depcruise'), ['src', '--config', '.dependency-cruiser.json', '--output-type', 'err'], { cwd: app });
assert.equal(cruise().status, 0, cruise().out); // всё по правилам

write(app, 'src/features/checkout/index.js', "import { addToCart } from '../cart/model/add.js';\nexport const checkout = (p) => addToCart(p);\n");
write(app, 'src/entities/product/index.js', "import { addToCart } from '../../features/cart/index.js';\nexport const product = { id: 7, title: 'Пуэр', price: 1200, add: addToCart };\n");
const violations = cruise();
assert.notEqual(violations.status, 0);
assert.match(violations.out, /error feature-internals: src\/features\/checkout\/index\.js → src\/features\/cart\/model\/add\.js/);
assert.match(violations.out, /error no-upward: src\/entities\/product\/index\.js → src\/features\/cart\/index\.js/);

console.log('structure ok');
