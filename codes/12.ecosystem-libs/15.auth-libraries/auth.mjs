// Проверки к 12.15 «Библиотеки авторизации»: декодирование и проверка JWT, PKCE, сессии Better Auth, обновление токена.
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify, createRemoteJWKSet, generateKeyPair, exportJWK } from 'jose';
import { jwtDecode } from 'jwt-decode';
import * as oauth from 'oauth4webapi';
import { createServer } from 'node:http';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';

// --- JWT: декодировать не значит проверить --------------------------------
const secret = new TextEncoder().encode('server-secret-at-least-32-bytes-long!!');
const real = await new SignJWT({ role: 'user' }).setProtectedHeader({ alg: 'HS256' }).setSubject('42').setExpirationTime('15m').sign(secret);

// подделка: та же подпись, другая полезная нагрузка
const [h, , sig] = real.split('.');
const forgedPayload = Buffer.from(JSON.stringify({ sub: '42', role: 'admin', exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url');
const forged = `${h}.${forgedPayload}.${sig}`;

// jwt-decode читает что угодно
assert.equal(jwtDecode(forged).role, 'admin');
// jose проверяет подпись и отвергает
await assert.rejects(jwtVerify(forged, secret), { code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' });
const { payload } = await jwtVerify(real, secret);
assert.equal(payload.role, 'user');

// alg: none не принимается
const none = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${forgedPayload}.`;
assert.equal(jwtDecode(none).role, 'admin');
await assert.rejects(jwtVerify(none, secret));

// истёкший токен
const expired = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setExpirationTime(Math.floor(Date.now() / 1000) - 60).sign(secret);
await assert.rejects(jwtVerify(expired, secret), { code: 'ERR_JWT_EXPIRED' });

// проверка по открытому ключу провайдера (JWKS) — без общего секрета
const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
const jwks = createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ keys: [jwk] })); });
await new Promise((r) => jwks.listen(0, r));
const issuer = `http://localhost:${jwks.address().port}`;
const idToken = await new SignJWT({ email: 'a@shop.example' }).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(issuer).setAudience('shop-web').setExpirationTime('5m').sign(privateKey);
const JWKS = createRemoteJWKSet(new URL(`${issuer}/jwks`));
const verified = await jwtVerify(idToken, JWKS, { issuer, audience: 'shop-web' });
assert.equal(verified.payload.email, 'a@shop.example');
await assert.rejects(jwtVerify(idToken, JWKS, { issuer, audience: 'other-app' }), { code: 'ERR_JWT_CLAIM_VALIDATION_FAILED' });
jwks.close();

// --- PKCE: code_challenge = base64url(sha256(code_verifier)) --------------
const verifier = oauth.generateRandomCodeVerifier();
assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
const challenge = await oauth.calculatePKCECodeChallenge(verifier);
assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'));

// --- Better Auth: сессия в httpOnly-cookie, пароль — хеш ------------------
const db = { user: [], session: [], account: [], verification: [] };
const auth = betterAuth({
  secret: randomBytes(32).toString('hex'),
  baseURL: 'https://shop.example',
  database: memoryAdapter(db),
  emailAndPassword: { enabled: true },
  logger: { disabled: true },
});
const signUp = await auth.api.signUpEmail({ body: { email: 'a@shop.example', password: 'correct-horse-battery', name: 'Аня' }, asResponse: true });
const setCookie = signUp.headers.get('set-cookie');
assert.match(setCookie, /^__Secure-better-auth\.session_token=/);
assert.match(setCookie, /HttpOnly/);
assert.match(setCookie, /Secure/);
assert.match(setCookie, /SameSite=Lax/);
// пароль хранится хешем, а не открытым текстом
assert.notEqual(db.account[0].password, 'correct-horse-battery');
assert.ok(!JSON.stringify(db).includes('correct-horse-battery'));

const cookie = setCookie.split(';')[0];
const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
assert.equal(session.user.email, 'a@shop.example');
// подделанная cookie — нет сессии
assert.equal(await auth.api.getSession({ headers: new Headers({ cookie: cookie.slice(0, -4) + 'AAAA' }) }), null);
// выход удаляет сессию на сервере: старая cookie больше не работает
await auth.api.signOut({ headers: new Headers({ cookie }) });
assert.equal(db.session.length, 0);
assert.equal(await auth.api.getSession({ headers: new Headers({ cookie }) }), null);

// --- обновление токена: одно обновление на все параллельные 401 ----------
function makeServer() {
  let access = 'A1', refresh = 'R1', n = 1;
  const state = { refreshCalls: 0, loggedOut: false };
  return {
    state,
    async api(token) { return token === access ? { status: 200 } : { status: 401 }; },
    async refresh(rt) {
      state.refreshCalls += 1;
      await new Promise((r) => setTimeout(r, 10));
      if (rt !== refresh) { state.loggedOut = true; return { status: 401 }; } // повтор старого refresh — отзыв
      n += 1; access = `A${n}`; refresh = `R${n}`;
      return { status: 200, access, refresh };
    },
    expire() { access = 'expired'; },
  };
}

function makeClient(server, { singleFlight }) {
  let access = 'A1', refresh = 'R1', pending = null;
  const doRefresh = async () => {
    const res = await server.refresh(refresh);
    if (res.status !== 200) throw new Error('logged out');
    access = res.access; refresh = res.refresh;
  };
  return async function request() {
    let res = await server.api(access);
    if (res.status !== 401) return res;
    if (singleFlight) {
      pending ??= doRefresh().finally(() => { pending = null; });
      await pending;
    } else {
      await doRefresh();
    }
    return server.api(access);
  };
}

// наивно: три параллельных 401 — три обновления, второе приходит со старым refresh, и сервер выкидывает пользователя
const s1 = makeServer(); s1.expire();
const naive = makeClient(s1, { singleFlight: false });
const results = await Promise.allSettled([naive(), naive(), naive()]);
assert.equal(s1.state.refreshCalls, 3);
assert.equal(s1.state.loggedOut, true);
assert.ok(results.some((r) => r.status === 'rejected'));

// одно общее обновление: все три запроса проходят
const s2 = makeServer(); s2.expire();
const single = makeClient(s2, { singleFlight: true });
const ok = await Promise.all([single(), single(), single()]);
assert.equal(s2.state.refreshCalls, 1);
assert.equal(s2.state.loggedOut, false);
assert.deepEqual(ok.map((r) => r.status), [200, 200, 200]);

console.log('auth ok');
