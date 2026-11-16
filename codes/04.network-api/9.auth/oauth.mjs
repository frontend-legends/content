// Проверки к 4.09: поток Authorization Code с PKCE и OpenID Connect на маленьком сервере авторизации.
// /authorize сверяет redirect_uri с зарегистрированным и возвращает code и state редиректом; /token
// принимает форму, код одноразовый и привязан к redirect_uri и code_verifier; id_token — JWT, клиент
// проверяет подпись, iss, aud и nonce; клиент отвергает чужой state; ресурс отвечает 401 с
// WWW-Authenticate без токена и 403 при нехватке scope; Basic — просто Base64.
// Запуск: cd codes && node run.mjs 04.network-api/9.auth
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify, generateKeyPair } from 'jose';

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const { privateKey, publicKey } = await generateKeyPair('ES256');
const CLIENT = { id: 'shop-web', redirect: 'https://shop.example/callback' };
const codes = new Map();
const tokens = new Map();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const issuer = `http://127.0.0.1:${server.address().port}`;
  const json = (status, body, headers = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(body)); };

  if (url.pathname === '/authorize') {
    const p = url.searchParams;
    // неизвестный клиент или чужой redirect_uri — ошибка без редиректа
    if (p.get('client_id') !== CLIENT.id || p.get('redirect_uri') !== CLIENT.redirect) return json(400, { error: 'invalid_request' });
    const code = b64url(randomBytes(16));
    codes.set(code, { redirect: p.get('redirect_uri'), challenge: p.get('code_challenge'), nonce: p.get('nonce'), scope: p.get('scope'), exp: Date.now() + 60_000 });
    const back = new URL(CLIENT.redirect);
    back.searchParams.set('code', code);
    back.searchParams.set('state', p.get('state'));
    res.writeHead(302, { location: back.href });
    return res.end();
  }
  if (url.pathname === '/token' && req.method === 'POST') {
    assert.equal(req.headers['content-type'], 'application/x-www-form-urlencoded');
    let raw = '';
    for await (const c of req) raw += c;
    const f = new URLSearchParams(raw);
    const grant = codes.get(f.get('code'));
    codes.delete(f.get('code'));                                                                 // одноразовый
    const verifierOk = grant && b64url(createHash('sha256').update(f.get('code_verifier') ?? '').digest()) === grant.challenge;
    if (!grant || grant.exp < Date.now() || grant.redirect !== f.get('redirect_uri') || !verifierOk) return json(400, { error: 'invalid_grant' });
    const access = b64url(randomBytes(24));
    tokens.set(access, { sub: 'user-42', scope: grant.scope });
    const idToken = await new SignJWT({ nonce: grant.nonce, email: 'anya@example.com' })
      .setProtectedHeader({ alg: 'ES256' }).setIssuer(issuer).setAudience(CLIENT.id).setSubject('user-42')
      .setIssuedAt().setExpirationTime('5m').sign(privateKey);
    return json(200, { access_token: access, token_type: 'Bearer', expires_in: 900, id_token: idToken, scope: grant.scope }, { 'cache-control': 'no-store' });
  }
  if (url.pathname === '/orders') {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    const info = tokens.get(token);
    if (!info) return json(401, { error: 'invalid_token' }, { 'www-authenticate': 'Bearer error="invalid_token"' });
    if (!info.scope.split(' ').includes('orders:read')) return json(403, { error: 'insufficient_scope' }, { 'www-authenticate': 'Bearer error="insufficient_scope", scope="orders:read"' });
    return json(200, [{ id: 1 }]);
  }
  json(404, {});
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const issuer = `http://127.0.0.1:${server.address().port}`;

// --- клиент ---
async function startLogin(scope) {
  const state = b64url(randomBytes(16));
  const nonce = b64url(randomBytes(16));
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const url = new URL(`${issuer}/authorize`);
  Object.entries({ response_type: 'code', client_id: CLIENT.id, redirect_uri: CLIENT.redirect, scope, state, nonce, code_challenge: challenge, code_challenge_method: 'S256' })
    .forEach(([k, v]) => url.searchParams.set(k, v));
  return { url, saved: { state, nonce, verifier } };                                            // saved — в sessionStorage или куке
}
async function finishLogin(callbackUrl, saved) {
  const params = new URL(callbackUrl).searchParams;
  if (params.get('state') !== saved.state) throw new Error('state не совпал');
  const res = await fetch(`${issuer}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: params.get('code'), redirect_uri: CLIENT.redirect, client_id: CLIENT.id, code_verifier: saved.verifier }).toString(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error);
  const { payload } = await jwtVerify(body.id_token, publicKey, { issuer, audience: CLIENT.id, algorithms: ['ES256'] });
  if (payload.nonce !== saved.nonce) throw new Error('nonce не совпал');
  return { ...body, user: payload };
}
const authorize = async (url) => {
  const res = await fetch(url, { redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location') };
};

// счастливый путь
const { url, saved } = await startLogin('openid email orders:read');
const step1 = await authorize(url);
assert.equal(step1.status, 302);
assert.ok(step1.location.startsWith(`${CLIENT.redirect}?code=`));
assert.ok(new URL(step1.location).searchParams.get('state') === saved.state);
const session = await finishLogin(step1.location, saved);
assert.equal(session.token_type, 'Bearer');
assert.equal(session.user.sub, 'user-42');
assert.equal(session.user.email, 'anya@example.com');

// токен в заголовке Authorization
assert.equal((await fetch(`${issuer}/orders`, { headers: { authorization: `Bearer ${session.access_token}` } })).status, 200);
const noToken = await fetch(`${issuer}/orders`);
assert.equal(noToken.status, 401);
assert.equal(noToken.headers.get('www-authenticate'), 'Bearer error="invalid_token"');

// код одноразовый
await assert.rejects(finishLogin(step1.location, saved), /invalid_grant/);

// чужой redirect_uri — сервер не редиректит
const evil = new URL(url);
evil.searchParams.set('redirect_uri', 'https://evil.example/callback');
assert.equal((await authorize(evil)).status, 400);

// state не совпал — клиент отказывается (подставленный вход)
const second = await startLogin('openid');
const attackerCallback = (await authorize((await startLogin('openid')).url)).location;          // код, выданный «другому» входу
await assert.rejects(finishLogin(attackerCallback, second.saved), /state не совпал/);

// без верного code_verifier код не обменять
const third = await startLogin('openid');
const step3 = await authorize(third.url);
await assert.rejects(finishLogin(step3.location, { ...third.saved, verifier: 'чужой' }), /invalid_grant/);

// мало прав — 403
const fourth = await startLogin('openid');
const narrow = await finishLogin((await authorize(fourth.url)).location, fourth.saved);
const forbidden = await fetch(`${issuer}/orders`, { headers: { authorization: `Bearer ${narrow.access_token}` } });
assert.equal(forbidden.status, 403);
assert.match(forbidden.headers.get('www-authenticate'), /insufficient_scope/);

// id_token другого клиента не принимается
const foreignId = await new SignJWT({ nonce: 'n' }).setProtectedHeader({ alg: 'ES256' }).setIssuer(issuer).setAudience('other-app').setSubject('user-42').setExpirationTime('5m').sign(privateKey);
await assert.rejects(jwtVerify(foreignId, publicKey, { issuer, audience: CLIENT.id }), { code: 'ERR_JWT_CLAIM_VALIDATION_FAILED' });

server.close();
console.log('oauth ok');
