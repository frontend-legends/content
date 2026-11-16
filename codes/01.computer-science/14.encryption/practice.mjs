// Проверки к практике 1.14: подпись вебхука считают по сырому телу — после JSON.parse и JSON.stringify
// байты другие и подпись не сходится; шифрование заметок паролем: PBKDF2 с солью → AES-GCM со случайным IV,
// соль и IV хранятся рядом с шифротекстом, неверный пароль — OperationError.
// Запуск: cd codes && node run.mjs 01.computer-science/14.encryption
import assert from 'node:assert/strict';
import { createHmac, createHash, timingSafeEqual, scrypt, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

// --- вебхук ---
const secret = 'whsec_тестовый';
const raw = '{ "order": 42, "status": "paid" }\n';                                          // как прислал платёжный сервис
const header = createHmac('sha256', secret).update(raw).digest('hex');
function verifyWebhook(rawBody, signature) {
  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'));
  const got = Buffer.from(String(signature));
  return got.length === expected.length && timingSafeEqual(got, expected);
}
assert.equal(verifyWebhook(raw, header), true);
assert.equal(verifyWebhook(JSON.stringify(JSON.parse(raw)), header), false);              // тело пересобрано — другие байты
assert.equal(verifyWebhook(raw.replace('paid', 'refunded'), header), false);

// --- заметки, зашифрованные паролем ---
const { subtle } = globalThis.crypto;
const enc = new TextEncoder(), dec = new TextDecoder();
async function keyFromPassword(password, salt) {
  const base = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
async function encryptNote(text, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFromPassword(password, salt);
  const data = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text)));
  return { salt, iv, data };                                                                 // всё это можно хранить на сервере
}
async function decryptNote({ salt, iv, data }, password) {
  const key = await keyFromPassword(password, salt);
  return dec.decode(await subtle.decrypt({ name: 'AES-GCM', iv }, key, data));
}
const note = await encryptNote('код от домофона 1234', 'длинная фраза-пароль');
assert.equal(await decryptNote(note, 'длинная фраза-пароль'), 'код от домофона 1234');
await assert.rejects(decryptNote(note, 'не тот пароль'), { name: 'OperationError' });
const twice = await encryptNote('код от домофона 1234', 'длинная фраза-пароль');
assert.notDeepEqual(twice.data, note.data);                                                // новая соль и IV — другой шифротекст

// --- практика «Пароли в базе — SHA-256» ---
const scryptAsync = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 32);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [, saltHex, hashHex] = stored.split('$');
  const hash = await scryptAsync(password, Buffer.from(saltHex, 'hex'), 32);
  return timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}
const storedA = await hashPassword('qwerty');
const storedB = await hashPassword('qwerty');
assert.notEqual(storedA, storedB);
assert.equal(await verifyPassword('qwerty', storedA), true);
assert.equal(await verifyPassword('qwerty!', storedA), false);
// обёртка старого хеша: scrypt(sha256(password))
const sha = (p) => createHash('sha256').update(p).digest('hex');
const wrapped = await hashPassword(sha('qwerty'));
assert.equal(await verifyPassword(sha('qwerty'), wrapped), true);

console.log('practice ok');
