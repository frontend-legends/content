// Глава 12.07 — что делают мета-фреймворки, на настоящих сборках из изолированного _fixture/:
// Astro — HTML без JavaScript и острова с client:*, Next.js — статические и динамические маршруты,
// код серверного компонента не уходит в браузер.
// run: node frameworks.mjs
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, readFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const fixture = fileURLToPath(new URL('./_fixture/', import.meta.url));
if (!existsSync(join(fixture, 'node_modules/next'))) spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: fixture, stdio: 'inherit' });
const dirs = [];
process.on('exit', () => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
// inside: true — проект внутри _fixture: Turbopack компилирует только файлы внутри корня рабочей области
function project(files, { inside = false } = {}) {
  const dir = inside ? mkdtempSync(join(fixture, '.tmp-')) : mkdtempSync(join(tmpdir(), 'fl-meta-'));
  dirs.push(dir);
  for (const [n, c] of Object.entries(files)) { mkdirSync(dirname(join(dir, n)), { recursive: true }); writeFileSync(join(dir, n), c); }
  if (!inside) symlinkSync(join(fixture, 'node_modules'), join(dir, 'node_modules'));
  return dir;
}
const walk = (d, out = []) => { for (const e of readdirSync(d)) { const p = join(d, e); statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; };
const run = (dir, bin, args) => spawnSync(process.execPath, [join(fixture, 'node_modules', bin), ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', ASTRO_TELEMETRY_DISABLED: '1' } });

// --- Astro: по умолчанию HTML без JavaScript; интерактивный компонент — остров с client:*
{
  const dir = project({
    'package.json': '{ "name": "astro-shop", "type": "module" }',
    'astro.config.mjs': "import react from '@astrojs/react';\nexport default { integrations: [react()] };\n",
    'src/components/AddToCart.jsx': "import { useState } from 'react';\nexport default function AddToCart() { const [n, setN] = useState(0); return <button onClick={() => setN(n + 1)}>В корзине: {n}</button>; }\n",
    'src/pages/index.astro': '---\nimport AddToCart from "../components/AddToCart.jsx";\n---\n<h1>Улун</h1><p>Китайский чай</p><AddToCart />\n',
    'src/pages/product.astro': '---\nimport AddToCart from "../components/AddToCart.jsx";\n---\n<h1>Улун</h1><AddToCart client:visible />\n',
  });
  const r = run(dir, 'astro/bin/astro.mjs', ['build']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const index = readFileSync(join(dir, 'dist/index.html'), 'utf8');
  const product = readFileSync(join(dir, 'dist/product/index.html'), 'utf8');
  assert.match(index, /<button>В корзине: (<!-- -->)?0<\/button>/);   // компонент отрисован в HTML
  assert.doesNotMatch(index, /<script/);                       // и ни строки JavaScript
  assert.match(product, /<astro-island[^>]*client="visible"/);  // остров с загрузкой при появлении
  assert.match(product, /<script/);
  const jsFiles = walk(join(dir, 'dist')).filter((f) => f.endsWith('.js'));
  assert.ok(jsFiles.length > 0);                               // React грузится только ради острова
}

// --- Next.js: статический и динамический маршрут, серверный код не уходит в браузер
{
  const dir = project({
    'package.json': '{ "name": "next-shop", "private": true }',
    'next.config.mjs': 'export default {};\n',
    'app/layout.jsx': 'export default function Layout({ children }) { return <html><body>{children}</body></html>; }\n',
    'app/page.jsx': "import AddToCart from './add-to-cart';\nexport default function Page() { const secret = 'SERVER_ONLY_PRICE_RULES'; return <main><h1>Каталог</h1><p hidden>{secret.length}</p><AddToCart /></main>; }\n",
    'app/add-to-cart.jsx': "'use client';\nimport { useState } from 'react';\nexport default function AddToCart() { const [n, setN] = useState(0); return <button onClick={() => setN(n + 1)}>В корзине: {n}</button>; }\n",
    'app/orders/page.jsx': "import { cookies } from 'next/headers';\nexport default async function Orders() { const c = await cookies(); return <p>Заказы для {c.get('user')?.value ?? 'гостя'}</p>; }\n",
  }, { inside: true });
  const r = run(dir, 'next/dist/bin/next', ['build']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = r.stdout;
  assert.match(out, /○ \/\s/);                                 // главная — статическая, собрана заранее
  assert.match(out, /ƒ \/orders/);                             // заказы читают cookies — рендер на каждый запрос
  const clientJs = walk(join(dir, '.next/static')).filter((f) => f.endsWith('.js')).map((f) => readFileSync(f, 'utf8')).join('\n');
  assert.match(clientJs, /В корзине: /);                       // клиентский компонент — в браузерном коде
  assert.doesNotMatch(clientJs, /SERVER_ONLY_PRICE_RULES/);    // код серверного компонента — нет
  const html = readFileSync(join(dir, '.next/server/app/index.html'), 'utf8');
  assert.match(html, /<h1>Каталог<\/h1>/);
}
console.log('frameworks ok');
