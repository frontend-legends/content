// Проверки к 4.06 на graphql-js: ответ повторяет форму запроса, псевдонимы, переменные и фрагменты;
// резолвер на каждое поле даёт N+1 обращений к базе, пакетный загрузчик — одно; ошибка в поле с
// типом «не null» обнуляет ближайшего родителя, который может быть null; поля мутации выполняются
// по очереди, поля запроса — параллельно; интроспекцию и глубину запроса ограничивают правилами
// проверки; сохранённые запросы — хеш вместо текста.
// Запуск: cd codes && node run.mjs 04.network-api/6.graphql
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildSchema, graphql, parse, validate, specifiedRules, NoSchemaIntrospectionCustomRule, GraphQLError, Kind } from 'graphql';

const schema = buildSchema(`
  type Category { id: ID!, title: String! }
  type Review { id: ID!, text: String!, rating: Int! }
  type Product {
    id: ID!
    title: String!
    price: Int!
    category: Category!
    reviews: [Review!]
    supplier: Supplier
  }
  type Supplier { id: ID!, name: String! }
  type Query { products(first: Int = 10): [Product!]!, product(id: ID!): Product }
  type Mutation { addToCart(productId: ID!): Int!, checkout: String! }
`);

const plain = (x) => JSON.parse(JSON.stringify(x));                                              // ответы graphql-js — объекты без прототипа

// «база»
const dbCalls = [];
const categories = { 1: { id: '1', title: 'Улуны' }, 2: { id: '2', title: 'Пуэры' } };
const products = Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1), title: `Чай ${i + 1}`, price: 300 + i * 50, categoryId: (i % 2) + 1 }));
const db = {
  category: async (id) => { dbCalls.push(`category ${id}`); return categories[id]; },
  categories: async (ids) => { dbCalls.push(`categories ${ids.join(',')}`); return ids.map((id) => categories[id]); },
};

// мини-DataLoader: собирает ключи за один проход цикла событий и делает один запрос
function createLoader(batch) {
  let queue = [];
  return (key) => new Promise((resolve, reject) => {
    queue.push({ key, resolve, reject });
    if (queue.length === 1) queueMicrotask(async () => {
      const current = queue;
      queue = [];
      const unique = [...new Set(current.map((q) => q.key))];
      try {
        const values = await batch(unique);
        current.forEach((q) => q.resolve(values[unique.indexOf(q.key)]));
      } catch (e) { current.forEach((q) => q.reject(e)); }
    });
  });
}

const makeRoot = (useLoader) => {
  const loadCategory = createLoader(db.categories);
  const productResolvers = (p) => ({
    ...p,
    category: () => (useLoader ? loadCategory(p.categoryId) : db.category(p.categoryId)),
    reviews: () => { if (p.id === '3') throw new Error('Сервис отзывов недоступен'); return [{ id: 'r1', text: 'Отличный', rating: 5 }]; },
    supplier: () => ({ id: 's1', name: () => { throw new Error('Поставщик не найден'); } }),
  });
  return {
    products: ({ first }) => products.slice(0, first).map(productResolvers),
    product: ({ id }) => { const p = products.find((x) => x.id === id); return p && productResolvers(p); },
  };
};

// --- форма ответа повторяет запрос; переменные, псевдонимы, фрагменты ---
const shape = await graphql({
  schema, rootValue: makeRoot(true),
  source: `query Card($id: ID!) {
    main: product(id: $id) { ...Short price }
    other: product(id: "2") { ...Short }
  }
  fragment Short on Product { title category { title } }`,
  variableValues: { id: '1' },
});
assert.deepEqual(plain(shape), { data: {
  main: { title: 'Чай 1', category: { title: 'Улуны' }, price: 300 },
  other: { title: 'Чай 2', category: { title: 'Пуэры' } },
} });

// --- N+1 и пакетная загрузка ---
for (const [useLoader, expected] of [[false, 10], [true, 1]]) {
  dbCalls.length = 0;
  const r = await graphql({ schema, rootValue: makeRoot(useLoader), source: '{ products { title category { title } } }' });
  assert.equal(r.data.products.length, 10);
  assert.equal(dbCalls.length, expected, dbCalls.join('; '));
}
assert.deepEqual(dbCalls, ['categories 1,2']);                                                 // одинаковые ключи схлопнуты

// --- ошибки: частичные данные; null всплывает до ближайшего nullable ---
const partial = await graphql({ schema, rootValue: makeRoot(true), source: '{ product(id: "3") { title reviews { text } } }' });
assert.deepEqual(plain(partial.data), { product: { title: 'Чай 3', reviews: null } });              // reviews может быть null
assert.deepEqual(partial.errors.map((e) => [e.message, e.path]), [['Сервис отзывов недоступен', ['product', 'reviews']]]);
const bubbled = await graphql({ schema, rootValue: makeRoot(true), source: '{ product(id: "1") { title supplier { name } } }' });
assert.deepEqual(plain(bubbled.data), { product: { title: 'Чай 1', supplier: null } });             // name: String! — обнулился supplier
const wholeList = await graphql({ schema, rootValue: makeRoot(true), source: '{ products(first: 3) { reviews { text } title } }' });
assert.deepEqual(wholeList.data.products.map((p) => p.reviews?.length ?? null), [1, 1, null]);

// --- мутации по очереди, запросы — параллельно ---
const order = [];
const step = (name, ms) => new Promise((r) => { order.push(`${name}:начало`); setTimeout(() => { order.push(`${name}:конец`); r(1); }, ms); });
await graphql({ schema, rootValue: { addToCart: () => step('add', 30), checkout: () => step('checkout', 1).then(() => 'ok') }, source: 'mutation { addToCart(productId: "1") checkout }' });
assert.deepEqual(order, ['add:начало', 'add:конец', 'checkout:начало', 'checkout:конец']);
order.length = 0;
await graphql({ schema, rootValue: { products: () => step('a', 30).then(() => []), product: () => step('b', 1).then(() => null) }, source: '{ products { id } product(id: "1") { id } }' });
assert.deepEqual(order, ['a:начало', 'b:начало', 'b:конец', 'a:конец']);

// --- интроспекция и глубина ---
const introspection = parse('{ __schema { types { name } } }');
assert.equal(validate(schema, introspection).length, 0);
assert.match(validate(schema, introspection, [...specifiedRules, NoSchemaIntrospectionCustomRule])[0].message, /introspection/i);

const maxDepth = (limit) => (context) => ({
  OperationDefinition(node) {
    const depth = (sel, d) => (sel?.selections ?? []).reduce((m, s) => Math.max(m, s.kind === Kind.FIELD ? depth(s.selectionSet, d + 1) : depth(s.selectionSet, d)), d);
    const d = depth(node.selectionSet, 0);
    if (d > limit) context.reportError(new GraphQLError(`Глубина запроса ${d} больше ${limit}`));
  },
});
const deepSchema = buildSchema('type User { name: String, friends: [User] } type Query { me: User }');
const deep = parse(`{ me { friends { friends { friends { friends { friends { name } } } } } } }`);
assert.deepEqual(validate(deepSchema, deep, [...specifiedRules, maxDepth(4)]).map((e) => e.message), ['Глубина запроса 7 больше 4']);
assert.equal(validate(deepSchema, parse('{ me { friends { name } } }'), [...specifiedRules, maxDepth(4)]).length, 0);

// --- сохранённые запросы: клиент шлёт хеш, сервер знает текст ---
const query = '{ products { title price } }';
const hash = createHash('sha256').update(query).digest('hex');
const allowed = new Map([[hash, query]]);
const byHash = async (h) => {
  const text = allowed.get(h);
  if (!text) return { errors: [{ message: 'PersistedQueryNotFound' }] };
  return graphql({ schema, rootValue: makeRoot(true), source: text });
};
assert.equal((await byHash(hash)).data.products.length, 10);
assert.deepEqual(await byHash('0'.repeat(64)), { errors: [{ message: 'PersistedQueryNotFound' }] });
assert.equal(`/graphql?id=${hash}`.length < 100, true);                                         // короткий GET — кешируемый адрес

console.log('graphql ok');
