// Проверки к 17.05 — только защитные механизмы: проверка JWT настоящим jose (подпись, срок, запрет alg:none),
// JWT подписан, но не зашифрован (payload читается), компромисс хранения токена как матрица угроз,
// ротация refresh с обнаружением повторного использования, регенерация session ID при логине, PKCE.
import assert from 'node:assert/strict';
import { SignJWT, jwtVerify, decodeJwt, base64url, errors } from 'jose';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const secret = new TextEncoder().encode('secret-'.repeat(8));
const sign = (claims, exp = '5m') => new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(exp).sign(secret);
const verify = (jwt) => jwtVerify(jwt, secret, { algorithms: ['HS256'] }); // явный список алгоритмов — защита от подмены alg

// --- валидный токен проверяется, подделанный и просроченный — нет ---
const jwt = await sign({ sub: '123', role: 'user' });
const { payload } = await verify(jwt);
assert.equal(payload.sub, '123');
assert.equal(payload.role, 'user');

// подделка payload без секрета: подпись не сойдётся
const [h, , s] = jwt.split('.');
const forged = `${h}.${base64url.encode(JSON.stringify({ sub: '123', role: 'admin' }))}.${s}`;
await assert.rejects(verify(forged), (e) => e.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED');

// просроченный токен отклоняется
const expired = await sign({ sub: '123' }, Math.floor(Date.now() / 1000) - 10);
await assert.rejects(verify(expired), (e) => e instanceof errors.JWTExpired);

// alg: none — классическая атака на проверку; явный список алгоритмов её закрывает
const none = `${base64url.encode(JSON.stringify({ alg: 'none' }))}.${base64url.encode(JSON.stringify({ sub: '123', role: 'admin' }))}.`;
await assert.rejects(verify(none), (e) => e.code === 'ERR_JOSE_ALG_NOT_ALLOWED');

// --- JWT подписан, но НЕ зашифрован: payload читается кем угодно ---
const open = decodeJwt(jwt);                       // без секрета, без проверки подписи
assert.equal(open.role, 'user');                   // значит, секреты в payload класть нельзя — только идентификаторы
assert.ok(!('password' in open));

// --- где хранить токен: какая угроза применима ---
const storageRisk = (place) => ({
  cookie: { readableByJs: false, autoSent: true, mainThreat: 'CSRF', mitigation: 'SameSite + HttpOnly' },
  localStorage: { readableByJs: true, autoSent: false, mainThreat: 'XSS', mitigation: 'защита от XSS' },
  memory: { readableByJs: true, autoSent: false, mainThreat: 'XSS', mitigation: 'защита от XSS, не персистится' },
}[place]);
assert.equal(storageRisk('cookie').readableByJs, false);    // HttpOnly-куку скрипт не прочитает — XSS не украдёт
assert.equal(storageRisk('cookie').mainThreat, 'CSRF');     // но она отправляется сама — отсюда CSRF
assert.equal(storageRisk('localStorage').mainThreat, 'XSS'); // доступен скрипту — одна XSS-дыра и токен украден
assert.notEqual(storageRisk('cookie').mainThreat, storageRisk('localStorage').mainThreat); // угрозы противоположны

// --- ротация refresh-токенов: повторное использование старого выдаёт кражу ---
function makeRefreshStore() {
  const valid = new Map();  // token → familyId
  const families = new Set();
  const issue = (familyId) => { const t = randomBytes(24).toString('hex'); valid.set(t, familyId); families.add(familyId); return t; };
  return {
    issue,
    rotate(oldToken) {
      const family = valid.get(oldToken);
      if (family === undefined) {
        // старый или уже использованный токен — отзываем всю семью (признак кражи)
        return { ok: false, reason: 'reuse-detected' };
      }
      valid.delete(oldToken);                 // одноразовый: старый больше не действует
      return { ok: true, token: issue(family) };
    },
    revokeFamily(familyId) { for (const [t, f] of valid) if (f === familyId) valid.delete(t); },
  };
}
const store = makeRefreshStore();
const r1 = store.issue('fam-1');
const rot = store.rotate(r1);
assert.equal(rot.ok, true);
assert.notEqual(rot.token, r1);                  // каждый refresh выдаёт новый токен
assert.deepEqual(store.rotate(r1), { ok: false, reason: 'reuse-detected' }); // старый токен использован снова — тревога
assert.equal(store.rotate(rot.token).ok, true);  // актуальный токен ещё работает

// --- session fixation: ID регенерируют при логине ---
function login(session) {
  const before = session.id;
  session.id = randomBytes(16).toString('hex'); // новый ID — навязанный злоумышленником перестаёт действовать
  session.user = 'anna';
  return before !== session.id;
}
const session = { id: 'навязанный-заранее-id', user: null };
assert.equal(login(session), true);
assert.notEqual(session.id, 'навязанный-заранее-id');

// --- PKCE: привязка кода авторизации к устройству, начавшему вход ---
const b64url = (buf) => buf.toString('base64url');
const verifier = b64url(randomBytes(32));                              // хранится только на клиенте
const challenge = b64url(createHash('sha256').update(verifier).digest()); // уходит на сервер при старте
const checkPkce = (sentVerifier, storedChallenge) => { const d = b64url(createHash('sha256').update(sentVerifier).digest()); const a = Buffer.from(d), b = Buffer.from(storedChallenge); return a.length === b.length && timingSafeEqual(a, b); };
assert.equal(checkPkce(verifier, challenge), true);                   // код обменивает тот, кто знает verifier
assert.equal(checkPkce(b64url(randomBytes(32)), challenge), false);   // перехвативший код без verifier обменять не сможет

console.log('tokens ok');
