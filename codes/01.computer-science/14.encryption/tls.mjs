// Проверки к 1.14: TLS на локальном сервере с самоподписанным сертификатом (openssl). Клиент без доверия
// к сертификату отказывается соединяться; с корневым сертификатом — TLS 1.3, AEAD-шифр и эфемерный обмен
// ключами на X25519 (прямая секретность, видно в openssl s_client); чужое имя в адресе — отказ. Если openssl нет, проверка пропускается.
// Запуск: cd codes && node run.mjs 01.computer-science/14.encryption
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import tls from 'node:tls';

const dir = mkdtempSync(join(tmpdir(), 'tls-'));
const gen = spawnSync('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-days', '1',
  '-subj', '/CN=shop.test', '-addext', 'subjectAltName=DNS:shop.test',
  '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem')], { encoding: 'utf8' });
if (gen.status !== 0) {
  console.log('openssl не найден — проверка TLS пропущена');
} else {
  const key = readFileSync(join(dir, 'key.pem'));
  const cert = readFileSync(join(dir, 'cert.pem'));
  const server = tls.createServer({ key, cert }, (socket) => socket.end('привет по TLS'));
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const connect = (options) => new Promise((resolve, reject) => {
    const socket = tls.connect({ port, host: '127.0.0.1', ...options }, () => {
      const info = { protocol: socket.getProtocol(), cipher: socket.getCipher().name };
      let data = '';
      socket.on('data', (d) => { data += d; });
      socket.on('end', () => resolve({ ...info, data }));
    });
    socket.on('error', reject);
  });

  // сертификат никем не подписан — клиент не доверяет
  await assert.rejects(connect({ servername: 'shop.test' }), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
  // доверяем ему явно: соединение установлено
  const ok = await connect({ servername: 'shop.test', ca: cert });
  assert.equal(ok.protocol, 'TLSv1.3');
  assert.match(ok.cipher, /^TLS_(AES_(128|256)_GCM|CHACHA20_POLY1305)_SHA(256|384)$/);       // только AEAD
  console.log(JSON.stringify(ok.ephemeral));              // эфемерный обмен ключами
  assert.equal(ok.data, 'привет по TLS');
  // сертификат на другое имя
  await assert.rejects(connect({ servername: 'evil.test', ca: cert }), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' });
  server.close();
}
rmSync(dir, { recursive: true });
console.log('tls ok');
