// Глава 12.08 — утилиты: что уже есть в языке, structuredClone против cloneDeep, Immer и общие ветки,
// даты и переход на летнее время, HTTP-клиенты против fetch на ошибочном ответе, размеры.
// run: node utilities.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import cloneDeep from 'lodash/cloneDeep.js';
import { produce } from 'immer';
import axios from 'axios';
import ky from 'ky';
import { ofetch } from 'ofetch';
import { nanoid } from 'nanoid';
import { clsx } from 'clsx';
import { cost } from '../../_lib/project.mjs';

// --- встроено в язык
const orders = [{ id: 3, status: 'paid', total: 980 }, { id: 1, status: 'new', total: 490 }, { id: 2, status: 'paid', total: 1500 }];
assert.deepEqual(Object.keys(Object.groupBy(orders, (o) => o.status)), ['paid', 'new']);
assert.deepEqual(orders.toSorted((a, b) => a.id - b.id).map((o) => o.id), [1, 2, 3]);
assert.equal(orders[0].id, 3);                                     // исходный массив не тронут
assert.equal(orders.findLast((o) => o.status === 'paid').id, 2);
assert.deepEqual([...new Set(['tea', 'pot']).union(new Set(['pot', 'cup']))], ['tea', 'pot', 'cup']);
assert.deepEqual([...new Set(['tea', 'pot']).intersection(new Set(['pot', 'cup']))], ['pot']);
const { promise, resolve } = Promise.withResolvers();
resolve('ok');
assert.equal(await promise, 'ok');
assert.match(crypto.randomUUID(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

// --- structuredClone против JSON и cloneDeep
{
  class Money { constructor(v) { this.v = v; } format() { return `${this.v} ₽`; } }
  const cart = { createdAt: new Date('2026-11-15T10:00:00Z'), tags: new Set(['gift']), total: new Money(980) };
  cart.self = cart;                                                // цикл
  const viaJson = (() => { try { return JSON.parse(JSON.stringify(cart)); } catch (e) { return e; } })();
  assert.ok(viaJson instanceof TypeError);                         // JSON падает на цикле
  const sc = structuredClone(cart);
  assert.ok(sc.createdAt instanceof Date);                         // Date, Set и циклы сохраняются
  assert.ok(sc.tags.has('gift'));
  assert.equal(sc.self, sc);
  assert.equal(sc.total instanceof Money, false);                  // но экземпляр класса становится обычным объектом
  assert.equal(sc.total.format, undefined);
  const ld = cloneDeep(cart);
  assert.equal(ld.total instanceof Money, true);                   // cloneDeep сохраняет прототип
  assert.throws(() => structuredClone({ onPay: () => {} }), /could not be cloned/);   // функции не копируются
}

// --- Immer: пишешь мутации, получаешь новое состояние с общими неизменёнными ветками
{
  const state = { cart: { items: [{ sku: 'tea', qty: 1 }] }, user: { name: 'Аня' } };
  const next = produce(state, (draft) => { draft.cart.items[0].qty++; });
  assert.equal(state.cart.items[0].qty, 1);                        // исходное не изменилось
  assert.equal(next.cart.items[0].qty, 2);
  assert.notEqual(next.cart, state.cart);                          // изменённая ветка — новая
  assert.equal(next.user, state.user);                             // неизменённая — та же ссылка
  assert.ok(Object.isFrozen(next.cart.items[0]));                  // результат заморожен
}

// --- даты: «плюс сутки» и «следующий день» — разное в день перехода на летнее время
{
  const code = `
    const { addDays } = require('date-fns');
    const start = new Date(2026, 2, 28, 12, 0);             // 28 марта, полдень, Берлин
    const plus24h = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const nextDay = addDays(start, 1);
    console.log(JSON.stringify([plus24h.getDate(), plus24h.getHours(), nextDay.getDate(), nextDay.getHours()]));
  `;
  const r = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8', env: { ...process.env, TZ: 'Europe/Berlin' }, cwd: new URL('../../', import.meta.url).pathname });
  assert.deepEqual(JSON.parse(r.stdout), [29, 13, 29, 12]);        // 29 марта переводят часы: +24 ч даёт 13:00
}

// --- HTTP-клиенты на ответе 404
{
  const server = createServer((req, res) => { res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"error":"нет товара"}'); });
  await new Promise((r) => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/api/products/999`;

  const res = await fetch(url);                                    // fetch не бросает на 404
  assert.equal(res.ok, false);
  assert.equal(res.status, 404);
  await assert.rejects(axios.get(url), (e) => e.response.status === 404 && e.response.data.error === 'нет товара');
  await assert.rejects(ky.get(url).json(), (e) => e.name === 'HTTPError' && e.response.status === 404);
  await assert.rejects(ofetch(url), (e) => e.name === 'FetchError' && e.status === 404 && e.data.error === 'нет товара');
  server.close();
}

// --- мелочи
assert.equal(clsx('btn', { active: true, disabled: false }, null, ['lg']), 'btn active lg');
assert.equal(nanoid().length, 21);

// --- размеры
const kb = async (c) => +((await cost(c)).gzip / 1024).toFixed(1);
const sizes = {
  axios: await kb("import axios from 'axios'; console.log(axios.get);"),
  ky: await kb("import ky from 'ky'; console.log(ky.get);"),
  ofetch: await kb("import { ofetch } from 'ofetch'; console.log(ofetch);"),
  immer: await kb("import { produce } from 'immer'; console.log(produce);"),
  nanoid: await kb("import { nanoid } from 'nanoid'; console.log(nanoid());"),
  clsx: await kb("import { clsx } from 'clsx'; console.log(clsx('a'));"),
};
console.table(sizes);
assert.ok(sizes.axios > sizes.ky && sizes.axios > sizes.ofetch);
assert.ok(sizes.nanoid < 0.3 && sizes.clsx < 0.3);
console.log('utilities ok');
