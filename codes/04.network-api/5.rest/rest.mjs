// Проверки к 4.05: ресурсы корзины и методы — POST создаёт (201 и Location), повторный DELETE даёт 404,
// но состояние то же (идемпотентность); PUT заменяет целиком, PATCH (JSON Merge Patch) меняет часть,
// null удаляет поле; If-Match с устаревшим ETag — 412 вместо потерянного обновления; 405 и Allow;
// 409 при конфликте; 422 и 400 в формате Problem Details (application/problem+json).
// Запуск: cd codes && node run.mjs 04.network-api/5.rest
import assert from 'node:assert/strict';
import { createShop, mergePatch } from './_server.mjs';

const server = createShop();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const send = async (method, path, body, headers = {}) => {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : undefined };
};

// --- создание ---
const created = await send('POST', '/cart-items', { productId: 7, qty: 2, note: 'подарочная упаковка' });
assert.equal(created.status, 201);
assert.equal(created.headers.get('location'), '/cart-items/1');
assert.deepEqual(created.body, { id: 1, productId: 7, qty: 2, note: 'подарочная упаковка' });

// --- конфликт и проверка данных ---
const dup = await send('POST', '/cart-items', { productId: 7, qty: 1 });
assert.equal(dup.status, 409);
const invalid = await send('POST', '/cart-items', { productId: 8, qty: 0 });
assert.equal(invalid.status, 422);
assert.equal(invalid.headers.get('content-type'), 'application/problem+json');
assert.deepEqual(invalid.body.errors, [{ field: 'qty', message: 'количество — целое больше нуля' }]);
const broken = await send('POST', '/cart-items', '{"qty":');
assert.deepEqual([broken.status, broken.body.title], [400, 'Тело — не JSON']);

// --- PATCH меняет часть, null удаляет поле ---
const patched = await send('PATCH', '/cart-items/1', { qty: 3, note: null });
assert.deepEqual(patched.body, { id: 1, productId: 7, qty: 3 });
// --- PUT заменяет целиком: не переданные поля пропадают ---
await send('PATCH', '/cart-items/1', { note: 'без сахара' });
const put = await send('PUT', '/cart-items/1', { productId: 7, qty: 5 });
assert.deepEqual(put.body, { id: 1, productId: 7, qty: 5 });                                    // note исчез
const putPartial = await send('PUT', '/cart-items/1', { qty: 6 });
assert.equal(putPartial.status, 422);                                                          // PUT не дополняет недостающее

// --- If-Match: два редактора, одно чтение ---
const read = await send('GET', '/cart-items/1');
const version = read.headers.get('etag');
const alice = await send('PATCH', '/cart-items/1', { qty: 4 }, { 'if-match': version });
assert.equal(alice.status, 200);
const bob = await send('PATCH', '/cart-items/1', { note: 'к пятнице' }, { 'if-match': version });
assert.equal(bob.status, 412);                                                                 // Боб читал старую версию
assert.equal((await send('GET', '/cart-items/1')).body.qty, 4);                               // правка Алисы не потеряна

// --- DELETE идемпотентен по состоянию, но не по ответу ---
assert.equal((await send('DELETE', '/cart-items/1')).status, 204);
assert.equal((await send('DELETE', '/cart-items/1')).status, 404);
assert.deepEqual((await send('GET', '/cart-items')).body, []);

// --- 405 и Allow ---
const wrong = await send('PUT', '/cart-items', []);
assert.equal(wrong.status, 405);
assert.equal(wrong.headers.get('allow'), 'GET, POST');

// --- JSON Merge Patch (RFC 7396) ---
assert.deepEqual(mergePatch({ a: 'b', c: { d: 'e', f: 'g' } }, { a: 'z', c: { f: null } }), { a: 'z', c: { d: 'e' } });
assert.deepEqual(mergePatch({ tags: ['улун', 'пуэр'] }, { tags: ['сенча'] }), { tags: ['сенча'] });   // массив заменяется целиком

server.close();
console.log('rest ok');
