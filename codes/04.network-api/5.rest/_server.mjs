// REST-сервер корзины для проверок 4.05: ресурсы, методы, статусы, ETag и If-Match, Problem Details.
import http from 'node:http';
import { createHash } from 'node:crypto';

export function mergePatch(target, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const result = target && typeof target === 'object' && !Array.isArray(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete result[key];                                                   // null — удалить поле
    else result[key] = mergePatch(result[key], value);
  }
  return result;
}

export function createShop() {
  const items = new Map();
  let nextId = 1;
  const etag = (item) => `"${createHash('sha1').update(JSON.stringify(item)).digest('hex').slice(0, 12)}"`;
  const problem = (res, status, title, extra = {}) => {
    res.writeHead(status, { 'content-type': 'application/problem+json' });
    res.end(JSON.stringify({ type: `https://shop.example/problems/${status}`, title, status, ...extra }));
  };
  const json = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(body === undefined ? undefined : JSON.stringify(body));
  };
  const validate = (b) => {
    const errors = [];
    if (typeof b.productId !== 'number') errors.push({ field: 'productId', message: 'нужен номер товара' });
    if (!Number.isInteger(b.qty) || b.qty < 1) errors.push({ field: 'qty', message: 'количество — целое больше нуля' });
    return errors;
  };

  return http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let body;
    try { body = raw ? JSON.parse(raw) : undefined; } catch { return problem(res, 400, 'Тело — не JSON'); }
    const url = new URL(req.url, 'http://x');
    const [, collection, idPart] = url.pathname.split('/');
    if (collection !== 'cart-items') return problem(res, 404, 'Нет такого ресурса');

    if (!idPart) {
      if (req.method === 'GET') {
        let list = [...items.values()];
        if (url.searchParams.get('sort') === '-qty') list = list.toSorted((a, b) => b.qty - a.qty);
        return json(res, 200, list);
      }
      if (req.method === 'POST') {
        const errors = validate(body ?? {});
        if (errors.length) return problem(res, 422, 'Данные не прошли проверку', { errors });
        if ([...items.values()].some((i) => i.productId === body.productId)) return problem(res, 409, 'Товар уже в корзине');
        const item = { id: nextId++, productId: body.productId, qty: body.qty, note: body.note };
        items.set(item.id, item);
        return json(res, 201, item, { location: `/cart-items/${item.id}`, etag: etag(item) });
      }
      res.writeHead(405, { allow: 'GET, POST' });
      return res.end();
    }

    const id = Number(idPart);
    const item = items.get(id);
    if (req.method === 'DELETE') {
      if (!item) return problem(res, 404, 'Позиции нет');
      items.delete(id);
      res.writeHead(204);
      return res.end();
    }
    if (!item) return problem(res, 404, 'Позиции нет');
    if (req.method === 'GET') return json(res, 200, item, { etag: etag(item) });
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const ifMatch = req.headers['if-match'];
      if (ifMatch && ifMatch !== etag(item)) return problem(res, 412, 'Позиция изменилась с момента чтения');
      const next = req.method === 'PUT' ? { id, ...body } : { ...mergePatch(item, body), id };
      const errors = validate(next);
      if (errors.length) return problem(res, 422, 'Данные не прошли проверку', { errors });
      items.set(id, next);
      return json(res, 200, next, { etag: etag(next) });
    }
    res.writeHead(405, { allow: 'GET, PUT, PATCH, DELETE' });
    res.end();
  });
}
