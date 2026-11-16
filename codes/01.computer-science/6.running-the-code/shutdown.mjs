// Проверки к практике 1.06: скрипт глотает ошибку и CI зелёный (код 0), с process.exitCode = 1 — красный;
// корректная остановка HTTP-сервера по SIGTERM: начатый запрос завершается, новые не принимаются, код 0.
// Запуск: cd codes && node run.mjs 01.computer-science/6.running-the-code
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';

// --- «CI зелёный, хотя проверка упала» ---
const check = 'async function main() { throw new Error("отчёт не сошёлся") }\n';
const swallowed = spawnSync(process.execPath, ['-e', `${check}main().catch((e) => console.error(e.message));`], { encoding: 'utf8' });
assert.deepEqual([swallowed.status, swallowed.stderr.trim()], [0, 'отчёт не сошёлся']);
const fixed = spawnSync(process.execPath, ['-e', `${check}main().catch((e) => { console.error(e.message); process.exitCode = 1; });`], { encoding: 'utf8' });
assert.equal(fixed.status, 1);

// --- корректная остановка сервера ---
const serverCode = `
const http = require('node:http');
const server = http.createServer((req, res) => setTimeout(() => res.end('отчёт готов'), 400));
server.listen(0, () => console.log(server.address().port));
process.on('SIGTERM', () => {
  console.error('SIGTERM: новые запросы не принимаем');
  server.close(() => { console.error('все запросы завершены'); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
});`;
const child = spawn(process.execPath, ['-e', serverCode]);
let stderr = '';
child.stderr.on('data', (d) => { stderr += d; });
const port = await new Promise((r) => child.stdout.once('data', (d) => r(Number(String(d).trim()))));
const get = () => new Promise((resolve, reject) => {
  http.get({ port, agent: false }, (res) => { let body = ''; res.on('data', (c) => { body += c; }); res.on('end', () => resolve(body)); }).on('error', reject);
});
const slow = get();                                                                   // запрос уже обрабатывается
await new Promise((r) => setTimeout(r, 100));
child.kill('SIGTERM');
await new Promise((r) => setTimeout(r, 100));
await assert.rejects(get(), { code: 'ECONNREFUSED' });                               // новые соединения не принимаются
assert.equal(await slow, 'отчёт готов');                                              // начатый — завершён
const [code] = await new Promise((r) => child.on('exit', (...a) => r(a)));
assert.equal(code, 0);
assert.match(stderr, /SIGTERM: новые запросы не принимаем\nвсе запросы завершены/);

console.log('shutdown ok');
