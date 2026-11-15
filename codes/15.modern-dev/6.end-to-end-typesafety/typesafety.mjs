// Проверки к 15.06: общая схема — изменение ломает компиляцию и сервера, и клиента; типизированный построитель
// запросов к базе; приведение `as` против проверки схемой; Date после JSON и superjson.
import assert from 'node:assert/strict';
import { z } from 'zod';
import superjson from 'superjson';
import { project, run, bin, write } from '../../_lib/project.mjs';

const tsconfig = JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'es2022', module: 'nodenext', moduleResolution: 'nodenext', skipLibCheck: true, allowImportingTsExtensions: true } });
const schema = (field) => `import { z } from 'zod';
export const Product = z.object({ id: z.number(), title: z.string(), ${field}: z.number().positive() });
export type Product = z.infer<typeof Product>;
`;
const dir = project({
  'package.json': JSON.stringify({ type: 'module' }),
  'tsconfig.json': tsconfig,
  'shared/product.ts': schema('price'),
  // сервер: отдаёт товар по схеме
  'server/products.ts': `import { Product } from '../shared/product.ts';
export function getProduct(id: number): Product {
  return Product.parse({ id, title: 'Пуэр', price: 1200 });
}
`,
  // клиент: показывает цену
  'client/card.ts': `import type { Product } from '../shared/product.ts';
export const priceLabel = (p: Product) => \`\${p.title} — \${p.price} ₽\`;
`,
});
const tsc = () => run(bin('tsc'), ['-p', '.'], { cwd: dir });
assert.equal(tsc().status, 0, tsc().out);

// переименовали поле в общей схеме — компилятор показал и сервер, и клиент
write(dir, 'shared/product.ts', schema('amount'));
const after = tsc();
assert.notEqual(after.status, 0);
assert.match(after.out, /client\/card\.ts\(2,\d+\): error TS2339: Property 'price' does not exist on type/);
assert.doesNotMatch(after.out, /server\/products\.ts/); // объект в parse типом не проверяется — ошибка будет на рантайме
// с satisfies сервер тоже ломается при компиляции
write(dir, 'server/strict.ts', `import type { Product } from '../shared/product.ts';
export const sample = { id: 7, title: 'Пуэр', price: 1200 } satisfies Product;
`);
assert.match(tsc().out, /server\/strict\.ts\(2,\d+\): error TS2353: Object literal may only specify known properties, and 'price' does not exist in type/);
// на сервере та же поломка проявится при проверке схемой
const Renamed = z.object({ id: z.number(), title: z.string(), amount: z.number().positive() });
assert.equal(Renamed.safeParse({ id: 7, title: 'Пуэр', price: 1200 }).success, false);

// --- типизированный построитель запросов: опечатка в колонке — ошибка компиляции ---
write(dir, 'db/query.ts', `import { Kysely, SqliteDialect } from 'kysely';
interface DB { products: { id: number; title: string; price: number } }
declare const db: Kysely<DB>;
export async function ok() {
  const rows = await db.selectFrom('products').select(['id', 'title']).where('price', '>', 1000).execute();
  const title: string = rows[0].title;
  return title;
}
export async function typo() {
  return db.selectFrom('products').select(['titel']).execute();
}
`);
write(dir, 'shared/product.ts', schema('price'));
const q = tsc();
assert.match(q.out, /db\/query\.ts\(10,\d+\): error TS2/);   // 'titel' не колонка products
assert.doesNotMatch(q.out, /db\/query\.ts\([4-7],/);         // правильный запрос и тип результата — без ошибок

// --- граница: приведение типа ничего не проверяет ---
const response = '{"id":7,"title":"Пуэр","price":"1200 ₽"}';
const casted = /** @type {{ price: number }} */ (JSON.parse(response)); // в TS: as Product
assert.equal(casted.price + 300, '1200 ₽300');                        // «число» оказалось строкой
const Product = z.object({ id: z.number(), title: z.string(), price: z.number().positive() });
const parsed = Product.safeParse(JSON.parse(response));
assert.equal(parsed.success, false);
assert.deepEqual(parsed.error.issues.map((i) => i.path.join('.')), ['price']);

// --- Date через JSON становится строкой: тип говорит Date, а приходит string ---
const order = { id: 1, createdAt: new Date('2026-11-15T10:00:00Z') };
const viaJson = JSON.parse(JSON.stringify(order));
assert.equal(typeof viaJson.createdAt, 'string');
assert.throws(() => viaJson.createdAt.getTime(), TypeError);
const viaSuper = superjson.parse(superjson.stringify(order));
assert.ok(viaSuper.createdAt instanceof Date);
assert.equal(viaSuper.createdAt.getTime(), order.createdAt.getTime());
// или схема на границе приводит строку к дате
assert.ok(z.object({ createdAt: z.coerce.date() }).parse(viaJson).createdAt instanceof Date);

// что ещё теряет JSON
assert.equal(JSON.stringify({ m: new Map([['a', 1]]), s: new Set([1]), u: undefined }), '{"m":{},"s":{}}');
assert.throws(() => JSON.stringify({ n: 1n }), TypeError);

console.log('typesafety ok');
