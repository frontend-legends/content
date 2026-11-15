// Проверки к 17.03 — только защита, без рабочих атак: правило SameSite как функция, синхронизирующий токен
// на настоящем сервере (запрос без токена и с чужим Origin отклонён), double-submit cookie, требование
// кастомного заголовка, непредсказуемость токена. Никакой кросс-сайтовой атаки не выполняется.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';

// --- правило SameSite: пошлёт ли браузер куку в зависимости от контекста запроса ---
// context: { crossSite: чужой инициатор?, topLevelNav: навигация верхнего уровня?, method }
const cookieSent = (sameSite, ctx) => {
  if (!ctx.crossSite) return true;                       // свой сайт — кука всегда идёт
  if (sameSite === 'None') return true;                  // явно разрешено для всех (нужен Secure)
  if (sameSite === 'Strict') return false;               // с чужих сайтов — никогда
  return ctx.topLevelNav && ctx.method === 'GET';        // Lax: только переход по ссылке (GET верхнего уровня)
};
// классический CSRF — фоновый POST с чужого сайта
const backgroundPost = { crossSite: true, topLevelNav: false, method: 'POST' };
const linkClick = { crossSite: true, topLevelNav: true, method: 'GET' };
assert.equal(cookieSent('Lax', backgroundPost), false);  // Lax (дефолт браузеров) блокирует атаку
assert.equal(cookieSent('Lax', linkClick), true);        // но обычный переход по ссылке работает
assert.equal(cookieSent('Strict', linkClick), false);    // Strict строже — ломает и переходы со стороны
assert.equal(cookieSent('None', backgroundPost), true);  // None снова открывает запрос — нужен другой слой
assert.equal(cookieSent('Lax', { crossSite: false, method: 'POST' }), true); // свой сайт не затронут

// --- синхронизирующий токен на настоящем сервере ---
const SELF = 'https://shop.example';
const sessions = new Map();                               // sid → { token }
const makeToken = () => randomBytes(32).toString('hex');
const sid = 'sid-anna';
sessions.set(sid, { token: makeToken() });
const safeEqual = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

const server = createServer(async (req, res) => {
  const end = (code) => { res.writeHead(code).end(); };
  const session = sessions.get(/sid=([\w-]+)/.exec(req.headers.cookie ?? '')?.[1]);
  if (req.method === 'GET' && req.url === '/form') { // сервер отдаёт токен в форму
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ csrfToken: session.token }));
    return;
  }
  if (req.method === 'POST' && req.url === '/transfer') {
    if (!session) return end(401);
    if (req.headers.origin && req.headers.origin !== SELF) return end(403); // чужой источник — отказ
    let body = ''; for await (const c of req) body += c;
    const token = JSON.parse(body || '{}').csrfToken;
    if (!token || !safeEqual(token, session.token)) return end(403);        // нет токена или неверный — отказ
    return end(204);                                                        // всё совпало — действие разрешено
  }
  end(404);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const post = (body, { origin } = {}) => fetch(base + '/transfer', { method: 'POST', headers: { cookie: `sid=${sid}`, 'content-type': 'application/json', ...(origin && { origin }) }, body: JSON.stringify(body) }).then((r) => r.status);

const token = (await (await fetch(base + '/form', { headers: { cookie: `sid=${sid}` } })).json()).csrfToken;
assert.equal(await post({ csrfToken: token }), 204);          // легитимный запрос со своим токеном — ок
assert.equal(await post({}), 403);                            // без токена — как подделанный запрос — отклонён
assert.equal(await post({ csrfToken: 'подделка' }), 403);     // неверный токен — отклонён
assert.equal(await post({ csrfToken: token }, { origin: 'https://evil.example' }), 403); // чужой Origin — отклонён
assert.equal(await post({ csrfToken: token }, { origin: SELF }), 204);                    // свой Origin — ок
server.close();

// --- double-submit cookie: токен в куке и в заголовке должны совпасть, сервер ничего не хранит ---
const doubleSubmit = (cookieToken, headerToken) => Boolean(cookieToken) && safeEqual(cookieToken, headerToken);
const t = makeToken();
assert.equal(doubleSubmit(t, t), true);                       // свой код прочитал куку и продублировал в заголовок
assert.equal(doubleSubmit(t, makeToken()), false);            // чужой сайт не знает значение куки → не совпадёт
assert.equal(doubleSubmit(undefined, t), false);

// --- требование кастомного заголовка: его нельзя поставить в простом кросс-сайтовом запросе ---
const requireHeader = (headers) => 'x-requested-with' in headers; // браузер не даст чужому сайту добавить его без CORS
assert.equal(requireHeader({ 'x-requested-with': 'fetch', 'content-type': 'application/json' }), true);
assert.equal(requireHeader({ 'content-type': 'application/json' }), false);

// --- непредсказуемость токена ---
const tokens = new Set(Array.from({ length: 1000 }, makeToken));
assert.equal(tokens.size, 1000);                              // 1000 токенов — ни одного совпадения
assert.ok([...tokens][0].length >= 64);                      // 32 байта → 64 hex-символа, не угадать перебором

console.log('csrf ok');
