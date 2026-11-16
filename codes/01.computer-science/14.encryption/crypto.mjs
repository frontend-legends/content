// Проверки к 1.14 в Node (Web Crypto и node:crypto): Base64 — не шифрование; SHA-256 — известный вектор и
// лавинный эффект; пароль — медленный хеш с солью (scrypt), сравнение за постоянное время; HMAC для вебхуков;
// AES-GCM — подмена шифротекста обнаруживается, одинаковый nonce даёт одинаковый шифротекст; ECDH — общий
// секрет без передачи ключа; подпись Ed25519 и ECDSA — подмена данных ломает проверку; неизвлекаемый ключ;
// getRandomValues и randomUUID.
// Запуск: cd codes && node run.mjs 01.computer-science/14.encryption
import assert from 'node:assert/strict';
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const hex = (buf) => Buffer.from(buf).toString('hex');

// --- кодирование обратимо без ключа ---
assert.equal(atob(btoa('пароль'.length + ':secret')), '6:secret');

// --- хеш ---
assert.equal(hex(await subtle.digest('SHA-256', enc.encode('abc'))), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
const h1 = hex(await subtle.digest('SHA-256', enc.encode('заказ 1000')));
const h2 = hex(await subtle.digest('SHA-256', enc.encode('заказ 1001')));
const diffBits = [...Buffer.from(h1, 'hex')].reduce((n, b, i) => n + (b ^ Buffer.from(h2, 'hex')[i]).toString(2).replace(/0/g, '').length, 0);
assert.ok(diffBits > 90 && diffBits < 166, `различаются ${diffBits} бит из 256`);          // около половины
assert.equal(h1.length, 64);                                                                  // длина не зависит от входа
assert.equal(hex(await subtle.digest('SHA-256', new Uint8Array(1e6))).length, 64);

// --- пароль: соль и медленная функция ---
const fastHash = (p) => createHmac('sha256', '').update(p).digest('hex');
assert.equal(fastHash('qwerty'), fastHash('qwerty'));                                         // одинаковые пароли — одинаковые хеши
const salt1 = randomBytes(16), salt2 = randomBytes(16);
const stored1 = scryptSync('qwerty', salt1, 32);
const stored2 = scryptSync('qwerty', salt2, 32);
assert.notDeepEqual(stored1, stored2);                                                        // соль делает их разными
const verify = (password, salt, stored) => timingSafeEqual(scryptSync(password, salt, 32), stored);
assert.equal(verify('qwerty', salt1, stored1), true);
assert.equal(verify('qwerty1', salt1, stored1), false);
let t = performance.now();
for (let i = 0; i < 20; i++) scryptSync('qwerty', salt1, 32);
const slow = (performance.now() - t) / 20;
t = performance.now();
for (let i = 0; i < 20; i++) fastHash('qwerty');
const fast = (performance.now() - t) / 20;
assert.ok(slow > fast * 100, `scrypt ${slow.toFixed(2)} мс против sha256 ${fast.toFixed(4)} мс`);

// --- HMAC: подпись вебхука общим секретом ---
const secret = 'whsec_тестовый';
const body = '{"order":42,"status":"paid"}';
const signature = createHmac('sha256', secret).update(body).digest('hex');
const check = (b, sig) => {
  const expected = Buffer.from(createHmac('sha256', secret).update(b).digest('hex'));
  const got = Buffer.from(sig);
  return got.length === expected.length && timingSafeEqual(got, expected);
};
assert.equal(check(body, signature), true);
assert.equal(check(body.replace('paid', 'refunded'), signature), false);
assert.equal(check(body, 'короткая'), false);
// то же в Web Crypto
const hmacKey = await subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
assert.equal(hex(await subtle.sign('HMAC', hmacKey, enc.encode(body))), signature);
assert.equal(await subtle.verify('HMAC', hmacKey, Buffer.from(signature, 'hex'), enc.encode(body)), true);

// --- AES-GCM: шифрование с проверкой целостности ---
const aes = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
const iv = crypto.getRandomValues(new Uint8Array(12));
const note = enc.encode('адрес доставки: Лесная, 5');
const sealed = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, aes, note));
assert.equal(sealed.length, note.length + 16);                                                 // + 16 байт тега
assert.equal(new TextDecoder().decode(await subtle.decrypt({ name: 'AES-GCM', iv }, aes, sealed)), 'адрес доставки: Лесная, 5');
const tampered = sealed.slice(); tampered[0] ^= 1;
await assert.rejects(subtle.decrypt({ name: 'AES-GCM', iv }, aes, tampered), { name: 'OperationError' });
// одинаковые ключ и nonce: одинаковые сообщения видны как одинаковые
const again = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, aes, note));
assert.deepEqual(again, sealed);
const fresh = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: crypto.getRandomValues(new Uint8Array(12)) }, aes, note));
assert.notDeepEqual(fresh, sealed);
// неизвлекаемый ключ нельзя выгрузить
await assert.rejects(subtle.exportKey('raw', aes), /not extractable/);

// --- ECDH: общий секрет без передачи секрета ---
const alice = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
const bob = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
const s1 = hex(await subtle.deriveBits({ name: 'ECDH', public: bob.publicKey }, alice.privateKey, 256));
const s2 = hex(await subtle.deriveBits({ name: 'ECDH', public: alice.publicKey }, bob.privateKey, 256));
assert.equal(s1, s2);

// --- подпись: проверяет кто угодно по открытому ключу ---
for (const algo of [{ name: 'Ed25519' }, { name: 'ECDSA', namedCurve: 'P-256' }]) {
  const pair = await subtle.generateKey(algo, false, ['sign', 'verify']);
  const params = algo.name === 'ECDSA' ? { name: 'ECDSA', hash: 'SHA-256' } : algo;
  const release = enc.encode('app-2.4.1.tar.gz sha256=…');
  const sig = await subtle.sign(params, pair.privateKey, release);
  assert.equal(await subtle.verify(params, pair.publicKey, sig, release), true);
  assert.equal(await subtle.verify(params, pair.publicKey, sig, enc.encode('app-2.4.2.tar.gz sha256=…')), false);
}

// --- случайность ---
const bytes = crypto.getRandomValues(new Uint8Array(32));
assert.equal(bytes.length, 32);
assert.match(crypto.randomUUID(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.throws(() => crypto.getRandomValues(new Uint8Array(65537)), { name: 'QuotaExceededError' });

console.log('crypto ok');
