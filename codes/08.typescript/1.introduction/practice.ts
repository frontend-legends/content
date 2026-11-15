// Глава 8.01 — «Практика»: проверка данных на границе схемой Zod, тип выводится из схемы.
import assert from 'node:assert/strict';
import { z } from 'zod';

const ProductSchema = z.object({ id: z.number(), title: z.string(), price: z.number() });
type Product = z.infer<typeof ProductSchema>;

const ok: Product = ProductSchema.parse(JSON.parse('{"id":7,"title":"Чайник","price":2490}'));
assert.equal(ok.title, 'Чайник');
assert.throws(() => ProductSchema.parse(JSON.parse('{"id":"7"}')), z.ZodError);
// @ts-expect-error — у выведенного типа нет поля sale
ok.sale;
console.log('ok');
