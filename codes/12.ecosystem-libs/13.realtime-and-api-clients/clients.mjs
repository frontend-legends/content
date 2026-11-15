// Проверки к 12.13 «Реалтайм и API-клиенты»: OpenAPI-кодген и openapi-fetch, tRPC, GraphQL-клиенты, Socket.io.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import createClient from 'openapi-fetch';
import { initTRPC, TRPCError } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { createTRPCClient, httpBatchLink, httpLink, TRPCClientError } from '@trpc/client';
import { z } from 'zod';
import { graphql, buildSchema } from 'graphql';
import { request as gqlRequest, ClientError } from 'graphql-request';
import { Server as SocketServer } from 'socket.io';
import { io as socketClient } from 'socket.io-client';
import { project, write, run, bin } from '../../_lib/project.mjs';

const listen = (server) => new Promise((resolve) => server.listen(0, () => resolve(server.address().port)));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const products = new Map([[1, { id: 1, title: 'Пуэр', price: 1200 }]]);

// --- OpenAPI: типы из схемы, клиент по типам ---------------------------------
const spec = {
  openapi: '3.1.0',
  info: { title: 'Shop', version: '1.0.0' },
  paths: {
    '/products/{id}': {
      get: {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } } },
          404: { description: 'not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
  },
  components: {
    schemas: {
      Product: { type: 'object', required: ['id', 'title', 'price'], properties: { id: { type: 'integer' }, title: { type: 'string' }, price: { type: 'number' } } },
      Error: { type: 'object', required: ['message'], properties: { message: { type: 'string' } } },
    },
  },
};

const fixture = fileURLToPath(new URL('./_fixture/', import.meta.url));
if (!existsSync(join(fixture, 'node_modules/openapi-typescript'))) spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: fixture, stdio: 'inherit' });
const { default: openapiTS, astToString } = await import(join(fixture, 'node_modules/openapi-typescript/dist/index.mjs'));
const schemaTypes = astToString(await openapiTS(spec));
assert.match(schemaTypes, /"\/products\/\{id\}"/);
assert.match(schemaTypes, /title: string/);

const dir = project({
  'schema.d.ts': schemaTypes,
  'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'es2022', module: 'nodenext', moduleResolution: 'nodenext', skipLibCheck: true } }),
  'package.json': JSON.stringify({ type: 'module' }),
  'ok.ts': `import createClient from 'openapi-fetch';
import type { paths } from './schema.js';
const api = createClient<paths>({ baseUrl: 'http://x' });
const { data, error } = await api.GET('/products/{id}', { params: { path: { id: 1 } } });
if (data) { const t: string = data.title; void t; }
if (error) { const m: string = error.message; void m; }
`,
});
const check = (code) => { write(dir, 'case.ts', code); return run(bin('tsc'), ['--noEmit', '-p', '.'], { cwd: dir }); };
let res = check('export {};');
assert.equal(res.status, 0, res.stdout + res.stderr);

const errors = (code) => (check(code).stdout.match(/case\.ts\(\d+,\d+\): error TS\d+/g) ?? []);
const header = `import createClient from 'openapi-fetch';\nimport type { paths } from './schema.js';\nconst api = createClient<paths>({ baseUrl: 'http://x' });\n`;
// опечатка в пути, в поле ответа, забытый параметр — ошибки компиляции
assert.ok(errors(header + `await api.GET('/product/{id}', { params: { path: { id: 1 } } });`).length > 0, 'wrong path');
assert.ok(errors(header + `const { data } = await api.GET('/products/{id}', { params: { path: { id: 1 } } }); data?.titel;`).length > 0, 'wrong field');
assert.ok(errors(header + `await api.GET('/products/{id}', { params: { path: {} } });`).length > 0, 'missing param');
assert.ok(errors(header + `await api.GET('/products/{id}', { params: { path: { id: '1' } } });`).length > 0, 'wrong param type');

// openapi-fetch не бросает на 404: { data, error }
const rest = createServer((req, res) => {
  const id = Number(req.url.split('/').pop());
  const product = products.get(id);
  res.writeHead(product ? 200 : 404, { 'content-type': 'application/json' });
  res.end(JSON.stringify(product ?? { message: 'Товар не найден' }));
});
const restPort = await listen(rest);
const api = createClient({ baseUrl: `http://localhost:${restPort}` });
const found = await api.GET('/products/{id}', { params: { path: { id: 1 } } });
assert.deepEqual(found.data, { id: 1, title: 'Пуэр', price: 1200 });
assert.equal(found.error, undefined);
const missing = await api.GET('/products/{id}', { params: { path: { id: 99 } } });
assert.equal(missing.data, undefined);
assert.deepEqual(missing.error, { message: 'Товар не найден' });
assert.equal(missing.response.status, 404);
rest.close();

// --- tRPC: типы с сервера, пакетирование, проверка входа ------------------
const t = initTRPC.create();
const appRouter = t.router({
  product: t.router({
    byId: t.procedure.input(z.object({ id: z.number().int() })).query(({ input }) => {
      const product = products.get(input.id);
      if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: 'Товар не найден' });
      return product;
    }),
  }),
});
let httpRequests = 0;
const trpcServer = createHTTPServer({ router: appRouter, createContext: () => { httpRequests += 1; return {}; } });
const trpcPort = await listen(trpcServer);
const batched = createTRPCClient({ links: [httpBatchLink({ url: `http://localhost:${trpcPort}` })] });
const [a, b] = await Promise.all([batched.product.byId.query({ id: 1 }), batched.product.byId.query({ id: 1 })]);
assert.equal(a.title, 'Пуэр');
assert.deepEqual(a, b);
assert.equal(httpRequests, 1); // два вызова — один HTTP-запрос

const single = createTRPCClient({ links: [httpLink({ url: `http://localhost:${trpcPort}` })] });
httpRequests = 0;
await Promise.all([single.product.byId.query({ id: 1 }), single.product.byId.query({ id: 1 })]);
assert.equal(httpRequests, 2);

// вход проверяет zod на сервере
const bad = await single.product.byId.query({ id: 1.5 }).catch((e) => e);
assert.ok(bad instanceof TRPCClientError);
assert.equal(bad.data.code, 'BAD_REQUEST');
const notFound = await single.product.byId.query({ id: 99 }).catch((e) => e);
assert.equal(notFound.data.code, 'NOT_FOUND');
assert.equal(notFound.data.httpStatus, 404);
trpcServer.close();

// типы выводятся из роутера без кодгена
write(dir, 'router.ts', `import { initTRPC } from '@trpc/server';
import { z } from 'zod';
const t = initTRPC.create();
export const appRouter = t.router({ product: t.router({ byId: t.procedure.input(z.object({ id: z.number() })).query(({ input }) => ({ id: input.id, title: 'Пуэр', price: 1200 })) }) });
export type AppRouter = typeof appRouter;
`);
const trpcHeader = `import { createTRPCClient, httpBatchLink } from '@trpc/client';\nimport type { AppRouter } from './router.js';\nconst trpc = createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: 'http://x' })] });\n`;
assert.deepEqual(errors(trpcHeader + `const p = await trpc.product.byId.query({ id: 1 }); const title: string = p.title; void title;`), []);
assert.ok(errors(trpcHeader + `const p = await trpc.product.byId.query({ id: 1 }); p.titel;`).length > 0, 'trpc wrong field');
assert.ok(errors(trpcHeader + `await trpc.product.byId.query({ id: '1' });`).length > 0, 'trpc wrong input');

// --- GraphQL: частичные данные и ошибки в одном ответе -----------------------
const gqlSchema = buildSchema(`type Product { id: ID!, title: String!, reviews: [String!] } type Query { product(id: ID!): Product }`);
const root = {
  product: ({ id }) => ({ id, title: 'Пуэр', reviews: () => { throw new Error('Сервис отзывов недоступен'); } }),
};
const partial = await graphql({ schema: gqlSchema, source: '{ product(id: 1) { title reviews } }', rootValue: root });
assert.deepEqual(JSON.parse(JSON.stringify(partial.data)), { product: { title: 'Пуэр', reviews: null } });
assert.equal(partial.errors[0].message, 'Сервис отзывов недоступен');
assert.deepEqual(partial.errors[0].path, ['product', 'reviews']);

// по HTTP: статус 200, ошибки внутри тела
const gqlHttp = createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk;
  const { query, variables } = JSON.parse(body);
  const result = await graphql({ schema: gqlSchema, source: query, variableValues: variables, rootValue: root });
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(result));
});
const gqlPort = await listen(gqlHttp);
const gqlUrl = `http://localhost:${gqlPort}`;
const raw = await fetch(gqlUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: '{ product(id: 1) { title reviews } }' }) });
assert.equal(raw.status, 200);
assert.ok(raw.ok); // fetch считает ответ успешным
const rawBody = await raw.json();
assert.equal(rawBody.errors.length, 1);

// graphql-request бросает ClientError при любых errors, даже с частичными данными
const ok = await gqlRequest(gqlUrl, '{ product(id: 1) { title } }');
assert.deepEqual(ok, { product: { title: 'Пуэр' } });
const failed = await gqlRequest(gqlUrl, '{ product(id: 1) { title reviews } }').catch((e) => e);
assert.ok(failed instanceof ClientError);
assert.deepEqual(failed.response.data, { product: { title: 'Пуэр', reviews: null } });
gqlHttp.close();

// --- Socket.io: свой протокол поверх WebSocket ------------------------------
const sioHttp = createServer();
const io = new SocketServer(sioHttp);
const received = [];
io.on('connection', (socket) => {
  socket.on('chat', (message) => received.push(message));
  socket.on('join', (room, ack) => { socket.join(room); ack?.(); });
  socket.emit('welcome', 'hi');
});
const sioPort = await listen(sioHttp);

// сырой WebSocket видит кадры Engine.IO / Socket.IO
const frames = [];
const ws = new WebSocket(`ws://localhost:${sioPort}/socket.io/?EIO=4&transport=websocket`);
ws.onmessage = (event) => { frames.push(event.data); if (frames.length === 1) ws.send('40'); };
while (frames.length < 3) await wait(20);
ws.close();
assert.match(frames[0], /^0\{"sid":/);        // open Engine.IO
assert.match(frames[0], /"upgrades":\[\]/);
assert.match(frames[1], /^40\{"sid":/);       // connect Socket.IO
assert.equal(frames[2], '42["welcome","hi"]'); // event

// обычный WebSocket к серверу Socket.io не подключается
const plainResult = await new Promise((resolve) => {
  const plain = new WebSocket(`ws://localhost:${sioPort}/`);
  plain.onopen = () => resolve('open');
  plain.onerror = () => resolve('error');
});
assert.equal(plainResult, 'error');

// клиент Socket.io: long-polling как запасной транспорт
const polling = socketClient(`http://localhost:${sioPort}`, { transports: ['polling'] });
await new Promise((resolve) => polling.on('connect', resolve));
assert.equal(polling.io.engine.transport.name, 'polling');
polling.close();

// переподключение и буфер: событие, отправленное без связи, дойдёт после восстановления
const client = socketClient(`http://localhost:${sioPort}`, { reconnectionDelay: 50 });
await new Promise((resolve) => client.on('connect', resolve));
client.io.engine.close(); // обрыв транспорта
assert.equal(client.connected, false);
client.emit('chat', 'отправлено без связи');
await new Promise((resolve) => client.once('connect', resolve));
while (received.length < 1) await wait(20);
assert.deepEqual(received, ['отправлено без связи']);

// комнаты: рассылка только участникам
const other = socketClient(`http://localhost:${sioPort}`);
await new Promise((resolve) => other.on('connect', resolve));
const inRoom = [], outside = [];
other.on('order', (m) => outside.push(m));
const delivered = new Promise((resolve) => client.on('order', (m) => { inRoom.push(m); resolve(); }));
await client.emitWithAck('join', 'order:42'); // подтверждение: сервер уже добавил клиента в комнату
io.to('order:42').emit('order', 'оплачен');
await delivered;
await wait(50);
assert.deepEqual(inRoom, ['оплачен']);
assert.deepEqual(outside, []);
client.close(); other.close();

// нативный WebSocket: send в закрытый сокет не бросает и ничего не отправляет
const native = new WebSocket(`ws://localhost:${sioPort}/socket.io/?EIO=4&transport=websocket`);
await new Promise((resolve) => { native.onopen = resolve; });
native.close();
await new Promise((resolve) => { native.onclose = resolve; });
assert.equal(native.readyState, WebSocket.CLOSED);
assert.doesNotThrow(() => native.send('потеряно'));
io.close();

console.log('clients ok');
