// Глава 11.12 — source maps: формат карты, восстановление исходной позиции и имени из минифицированного стека,
// режимы (файл с комментарием, hidden, inline), утечка исходников через sourcesContent,
// --enable-source-maps в Node.js.
// run: node sourcemaps.mjs
import assert from 'node:assert/strict';
import { SourceMapConsumer } from 'source-map';
import { build } from 'vite';
import { project, read, list, run } from '../../_lib/project.mjs';

const files = {
  'index.html': '<!doctype html><script type="module" src="/src/main.ts"></script>',
  'src/main.ts': `import { applyCoupon } from './coupon';
// TODO: убрать секретный промокод STAFF100 перед релизом
document.querySelector('button')!.onclick = () => applyCoupon({ total: 980 }, 'SALE');
`,
  'src/coupon.ts': `export function applyCoupon(cart: { total: number }, code: string): number {
  const discounts: Record<string, number> = { SALE: 0.1 };
  const rate = discounts[code];
  if (rate === undefined) throw new Error('Неизвестный промокод: ' + code);
  return cart.total * (1 - rate);
}
`,
};

async function buildWith(sourcemap) {
  const dir = project(files);
  await build({ root: dir, logLevel: 'silent', build: { sourcemap } });
  const out = list(dir, 'dist');
  const js = out.find((f) => /^assets\/index-.*\.js$/.test(f));
  return { dir, out, js, code: read(dir, `dist/${js}`) };
}

// --- обычный режим: файл .map и комментарий в бандле
const b = await buildWith(true);
assert.ok(b.out.includes(`${b.js}.map`));
assert.match(b.code, /\/\/# sourceMappingURL=index-[\w-]+\.js\.map\s*$/);
const map = JSON.parse(read(b.dir, `dist/${b.js}.map`));
assert.equal(map.version, 3);
assert.deepEqual(map.sources.map((s) => s.replace(/^.*src\//, 'src/')).sort(), ['src/coupon.ts', 'src/main.ts']);
assert.ok(typeof map.mappings === 'string' && /^[A-Za-z0-9+/,;]+$/.test(map.mappings));   // Base64 VLQ

// --- утечка: sourcesContent содержит исходники целиком, с комментариями и типами
assert.ok(map.sourcesContent.some((s) => s.includes('STAFF100')));
assert.ok(map.sourcesContent.some((s) => s.includes('Record<string, number>')));
assert.doesNotMatch(b.code, /STAFF100/);                       // в самом бандле комментария нет

// --- восстановление позиции: где в минифицированном коде брошена ошибка → исходная строка
{
  const lines = b.code.split('\n');
  const line = lines.findIndex((l) => l.includes('Неизвестный промокод'));
  const column = lines[line].indexOf('throw');
  assert.ok(line >= 0 && column >= 0);
  const consumer = await new SourceMapConsumer(map);
  const pos = consumer.originalPositionFor({ line: line + 1, column });
  consumer.destroy?.();
  assert.match(pos.source, /src\/coupon\.ts$/);
  assert.equal(pos.line, 4);                                    // строка с throw в coupon.ts
}

// --- hidden: карта есть, ссылки в бандле нет — для загрузки в мониторинг ошибок
{
  const h = await buildWith('hidden');
  assert.ok(h.out.includes(`${h.js}.map`));
  assert.doesNotMatch(h.code, /sourceMappingURL/);
}

// --- inline: карта внутри бандла как data: URL — бандл вырастает в разы
{
  const i = await buildWith('inline');
  assert.ok(!i.out.some((f) => f.endsWith('.map')));
  assert.match(i.code, /sourceMappingURL=data:application\/json;charset=utf-8;base64,/);
  assert.ok(i.code.length > b.code.length * 2);
}

// --- Node.js: стек в исходных файлах только с --enable-source-maps
{
  const dir = project({
    'src/coupon.ts': files['src/coupon.ts'],
    'src/run.ts': "import { applyCoupon } from './coupon';\napplyCoupon({ total: 1 }, 'BAD');\n",
  });
  await build({ root: dir, logLevel: 'silent', configFile: false, build: { ssr: 'src/run.ts', sourcemap: true, minify: true, outDir: 'out' } });
  const plain = run(process.execPath, ['out/run.mjs'], { cwd: dir });
  const mapped = run(process.execPath, ['--enable-source-maps', 'out/run.mjs'], { cwd: dir });
  assert.match(plain.out, /Неизвестный промокод: BAD/);
  assert.doesNotMatch(plain.out, /coupon\.ts/);
  assert.match(mapped.out, /src\/coupon\.ts:4/);                // стек указывает на исходник
}
console.log('sourcemaps ok');
