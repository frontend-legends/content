// Проверки к 17.01: «не доверяй клиенту» на настоящем HTTP-сервере в двух версиях — наивной и исправленной.
// Скрытая кнопка не мешает запросу, чужой заказ по id (IDOR), лишнее поле в PATCH (mass assignment),
// цена от клиента, права токена (наименьшие привилегии) и стек ошибки в ответе.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

const sessions = { 'sid-anna': { id: 1, name: 'Анна', role: 'user' }, 'sid-boris': { id: 2, name: 'Борис', role: 'user' } };
const tokens = { 'tok-read': { userId: 1, scopes: ['orders:read'] }, 'tok-write': { userId: 1, scopes: ['orders:read', 'orders:write'] } };
const catalog = { tea: 4900, cup: 1200 };

function makeApp(safe) {
  const db = {
    posts: { 1: { id: 1, title: 'Новости' } },
    orders: { 10: { id: 10, userId: 1, total: 4900 }, 11: { id: 11, userId: 2, total: 990000, address: 'ул. Ленина, 5' } },
    users: { 1: { ...sessions['sid-anna'] }, 2: { ...sessions['sid-boris'] } },
  };
  let nextOrder = 12;
  return createServer(async (req, res) => {
    const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
    let body = '';
    for await (const chunk of req) body += chunk;
    const json = body ? JSON.parse(body) : {};
    const sid = /sid=([\w-]+)/.exec(req.headers.cookie ?? '')?.[1];
    const user = db.users[sessions[sid]?.id];
    const token = tokens[(req.headers.authorization ?? '').replace('Bearer ', '')];
    try {
      // удаление поста: кнопку видят только админы
      if (req.method === 'DELETE' && req.url === '/api/posts/1') {
        if (!user) return send(401);
        if (safe && user.role !== 'admin') return send(403, { error: 'forbidden' });
        delete db.posts[1];
        return send(204);
      }
      // заказ по id
      const m = /^\/api\/orders\/(\d+)$/.exec(req.url);
      if (req.method === 'GET' && m) {
        const order = db.orders[m[1]];
        if (!order || (safe && order.userId !== user?.id)) return send(404, { error: 'not found' }); // 404, а не 403: не подтверждаем, что заказ есть
        return send(200, order);
      }
      // профиль
      if (req.method === 'PATCH' && req.url === '/api/me') {
        const changes = safe ? { name: String(json.name ?? user.name).slice(0, 50) } : json; // только разрешённые поля
        Object.assign(user, changes);
        return send(200, user);
      }
      // оформление заказа
      if (req.method === 'POST' && req.url === '/api/orders') {
        if (safe) {
          if (!token) return send(401);
          if (!token.scopes.includes('orders:write')) return send(403, { error: 'insufficient scope' });
        }
        if (!(json.sku in catalog)) throw new TypeError(`Cannot read properties of undefined (reading 'price') at createOrder (/srv/app/orders.js:42:17)`);
        const total = safe ? catalog[json.sku] * json.qty : json.price * json.qty; // цену считает сервер
        const order = { id: nextOrder++, userId: token?.userId ?? user?.id, total };
        db.orders[order.id] = order;
        return send(201, order);
      }
      return send(404);
    } catch (e) {
      if (!safe) return send(500, { error: e.message });             // наружу ушли путь к файлу и строка
      const incident = 'err-' + Math.abs([...e.message].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36);
      // в журнал сервера — полностью, клиенту — только номер инцидента
      return send(500, { error: 'internal error', incident });
    }
  });
}

const start = (app) => new Promise((r) => app.listen(0, () => r(`http://localhost:${app.address().port}`)));
const req = async (base, method, path, opts) => {
  const r = await fetch(base + path, {
    method,
    headers: { ...(opts?.sid && { cookie: `sid=${opts.sid}` }), ...(opts?.token && { authorization: `Bearer ${opts.token}` }), 'content-type': 'application/json' },
    body: opts?.body && JSON.stringify(opts.body),
  });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
};

const naiveApp = makeApp(false), safeApp = makeApp(true);
const naive = await start(naiveApp), safe = await start(safeApp);

// 1. скрытая кнопка — не защита: запрос можно отправить из консоли
assert.equal((await req(naive, 'DELETE', '/api/posts/1', { sid: 'sid-anna' })).status, 204);
assert.equal((await req(safe, 'DELETE', '/api/posts/1', { sid: 'sid-anna' })).status, 403);

// 2. IDOR: перебор id отдаёт чужой заказ с адресом
const stolen = await req(naive, 'GET', '/api/orders/11', { sid: 'sid-anna' });
assert.equal(stolen.status, 200);
assert.equal(stolen.body.address, 'ул. Ленина, 5');
assert.equal((await req(safe, 'GET', '/api/orders/11', { sid: 'sid-anna' })).status, 404);
assert.equal((await req(safe, 'GET', '/api/orders/10', { sid: 'sid-anna' })).status, 200);
assert.deepEqual(await req(safe, 'GET', '/api/orders/999', { sid: 'sid-anna' }), await req(safe, 'GET', '/api/orders/11', { sid: 'sid-anna' })); // несуществующий и чужой неотличимы

// 3. mass assignment: форма отправляет только имя, но тело запроса можно дописать
const promoted = await req(naive, 'PATCH', '/api/me', { sid: 'sid-anna', body: { name: 'Аня', role: 'admin' } });
assert.equal(promoted.body.role, 'admin');
assert.equal((await req(naive, 'DELETE', '/api/posts/1', { sid: 'sid-anna' })).status, 204);
const kept = await req(safe, 'PATCH', '/api/me', { sid: 'sid-anna', body: { name: 'Аня', role: 'admin' } });
assert.deepEqual(kept.body, { id: 1, name: 'Аня', role: 'user' });

// 4. цена от клиента: «калькулятор корзины» на странице легко переписать
const cheap = await req(naive, 'POST', '/api/orders', { sid: 'sid-anna', body: { sku: 'tea', qty: 2, price: 1 } });
assert.equal(cheap.body.total, 2);
const fair = await req(safe, 'POST', '/api/orders', { token: 'tok-write', body: { sku: 'tea', qty: 2, price: 1 } });
assert.equal(fair.status, 201);
assert.equal(fair.body.total, 9800);

// 5. наименьшие привилегии: токен только на чтение не может создать заказ
assert.equal((await req(safe, 'POST', '/api/orders', { token: 'tok-read', body: { sku: 'tea', qty: 1 } })).status, 403);
assert.equal((await req(safe, 'GET', '/api/orders/10', { sid: 'sid-anna' })).status, 200);

// 6. ошибки: наивный сервер показывает внутренности, исправленный — номер инцидента
const leak = await req(naive, 'POST', '/api/orders', { sid: 'sid-anna', body: { sku: 'nope', qty: 1 } });
assert.equal(leak.status, 500);
assert.match(leak.body.error, /\/srv\/app\/orders\.js:42/);
const quiet = await req(safe, 'POST', '/api/orders', { token: 'tok-write', body: { sku: 'nope', qty: 1 } });
assert.equal(quiet.status, 500);
assert.deepEqual(Object.keys(quiet.body), ['error', 'incident']);
assert.doesNotMatch(JSON.stringify(quiet.body), /srv|orders\.js|undefined/);

naiveApp.close(); safeApp.close();
console.log('access ok');
