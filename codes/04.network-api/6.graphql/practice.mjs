// Проверки к практике 4.06: DataLoader из npm сводит 100 запросов за категориями к одному и возвращает
// значения в порядке ключей; схема с [Review!]! и Product! при ошибке отзывов обнуляет весь data,
// nullable-поля — только отзывы.
// Запуск: cd codes && node run.mjs 04.network-api/6.graphql
import assert from 'node:assert/strict';
import DataLoader from 'dataloader';
import { buildSchema, graphql } from 'graphql';

// --- DataLoader ---
const queries = [];
const db = {
  query: async (sql, params) => {
    queries.push(sql);
    if (sql.startsWith('SELECT * FROM products')) return Array.from({ length: 100 }, (_, i) => ({ id: i + 1, title: `Чай ${i + 1}`, categoryId: (i % 3) + 1 }));
    const ids = params[0];
    return ids.toReversed().map((id) => ({ id, title: `Категория ${id}` }));                    // база вернула в другом порядке
  },
};
function createLoaders() {
  return {
    category: new DataLoader(async (ids) => {
      const rows = await db.query('SELECT * FROM categories WHERE id = ANY($1)', [ids]);
      const byId = new Map(rows.map((r) => [r.id, r]));
      return ids.map((id) => byId.get(id) ?? null);
    }),
  };
}
const schema = buildSchema('type Category { title: String } type Product { title: String, category: Category } type Query { products: [Product] }');
const resolvers = {
  products: () => db.query('SELECT * FROM products LIMIT 100').then((rows) => rows.map((p) => ({
    ...p,
    category: (args, ctx) => ctx.loaders.category.load(p.categoryId),
  }))),
};
const result = await graphql({ schema, rootValue: resolvers, source: '{ products { title category { title } } }', contextValue: { loaders: createLoaders() } });
assert.equal(queries.length, 2);
assert.equal(result.data.products[4].category.title, 'Категория 2');                         // товар 5 → категория (4 % 3) + 1 = 2
assert.ok(result.data.products.every((p, i) => p.category.title === `Категория ${(i % 3) + 1}`));

// --- всплытие null ---
const strict = buildSchema('type Review { text: String } type Product { title: String!, reviews: [Review!]! } type Query { product(id: ID!): Product! }');
const soft = buildSchema('type Review { text: String } type Product { title: String!, reviews: [Review!] } type Query { product(id: ID!): Product }');
const root = { product: () => ({ title: 'Пуэр', reviews: () => { throw new Error('Сервис отзывов недоступен'); } }) };
const a = await graphql({ schema: strict, rootValue: root, source: '{ product(id: "1") { title reviews { text } } }' });
assert.equal(a.data, null);
assert.deepEqual(a.errors[0].path, ['product', 'reviews']);
const b = await graphql({ schema: soft, rootValue: root, source: '{ product(id: "1") { title reviews { text } } }' });
assert.deepEqual(JSON.parse(JSON.stringify(b.data)), { product: { title: 'Пуэр', reviews: null } });

console.log('practice ok');
