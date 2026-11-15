// Глава 12.05 — схемы валидации: одна схема для клиента и сервера, преобразование строк формы,
// Standard Schema как общий интерфейс Zod и Valibot, размер в бандле.
// run: node schemas.mjs
import assert from 'node:assert/strict';
import { z } from 'zod';
import * as v from 'valibot';
import { cost } from '../../_lib/project.mjs';

// --- одна схема: форма заказа
const Order = z.object({
  email: z.email('Некорректный email'),
  qty: z.coerce.number().int().min(1).max(10),        // из поля формы приходит строка
  promo: z.string().trim().toUpperCase().optional(),
});
const fromForm = Object.fromEntries(new URLSearchParams('email=anna@shop.ru&qty=3&promo=%20sale%20'));
assert.deepEqual(Order.parse(fromForm), { email: 'anna@shop.ru', qty: 3, promo: 'SALE' });
const bad = Order.safeParse({ email: 'anna', qty: '0' });
assert.equal(bad.success, false);
assert.deepEqual(bad.error.issues.map((i) => i.path.join('.')).sort(), ['email', 'qty']);
assert.deepEqual(z.flattenError(bad.error).fieldErrors.email, ['Некорректный email']);

// --- Valibot: та же схема из маленьких функций
const OrderV = v.object({
  email: v.pipe(v.string(), v.email('Некорректный email')),
  qty: v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1), v.maxValue(10)),
});
assert.deepEqual(v.parse(OrderV, { email: 'anna@shop.ru', qty: '3' }), { email: 'anna@shop.ru', qty: 3 });
assert.equal(v.safeParse(OrderV, { email: 'anna', qty: '3' }).success, false);

// --- Standard Schema: код, который принимает любую совместимую схему
async function validate(schema, input) {
  const r = await schema['~standard'].validate(input);
  return r.issues ? { ok: false, fields: r.issues.map((i) => i.path?.map((p) => p.key ?? p).join('.')) } : { ok: true, value: r.value };
}
for (const [name, schema] of [['zod', Order], ['valibot', OrderV]]) {
  assert.equal(schema['~standard'].version, 1, name);
  assert.deepEqual(await validate(schema, { email: 'anna@shop.ru', qty: '3' }), { ok: true, value: { email: 'anna@shop.ru', qty: 3 } }, name);
  assert.deepEqual((await validate(schema, { email: 'anna', qty: '3' })).fields, ['email'], name);
}
assert.equal(Order['~standard'].vendor, 'zod');
assert.equal(OrderV['~standard'].vendor, 'valibot');

// --- размер в бандле для одной и той же схемы
const kb = async (code) => +((await cost(code)).gzip / 1024).toFixed(1);
const sizes = {
  zod: await kb("import { z } from 'zod'; console.log(z.object({ email: z.email(), qty: z.number().min(1) }).parse(window.x));"),
  'zod/mini': await kb("import * as z from 'zod/mini'; console.log(z.parse(z.object({ email: z.email(), qty: z.number().check(z.minimum(1)) }), window.x));"),
  valibot: await kb("import * as v from 'valibot'; console.log(v.parse(v.object({ email: v.pipe(v.string(), v.email()), qty: v.pipe(v.number(), v.minValue(1)) }), window.x));"),
};
console.table(sizes);
assert.ok(sizes.zod > sizes['zod/mini']);
assert.ok(sizes['zod/mini'] > sizes.valibot);
assert.ok(sizes.valibot < 3);
// практика: строки сравниваются посимвольно
assert.equal('10' > '9', false);
console.log('schemas ok');
