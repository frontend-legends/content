// Проверки к 4.02 в Chromium: редиректы — 301 и 302 превращают POST в GET и теряют тело, 303 всегда GET,
// 307 и 308 сохраняют метод и тело; HTTP/1.1 — не больше 6 одновременных запросов к одному хосту,
// HTTP/2 по TLS — все запросы одним соединением параллельно (nextHopProtocol h2).
// Сертификат для HTTP/2 создаёт openssl; если его нет, часть с HTTP/2 пропускается.
// Запуск: cd codes && node run.mjs 04.network-api/2.http
import assert from 'node:assert/strict';
import http from 'node:http';
import http2 from 'node:http2';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

// --- сервер: редиректы и медленный ответ со счётчиком одновременных запросов ---
let active = 0, peak = 0;
const seen = [];
function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/redirect/')) {
    const code = Number(url.pathname.split('/')[2]);
    res.writeHead(code, { location: '/target' });
    return res.end();
  }
  if (url.pathname === '/target') {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => { seen.push(`${req.method} ${body}`); res.writeHead(200, { 'content-type': 'text/plain' }); res.end(req.method); });
    return;
  }
  if (url.pathname === '/slow') {
    active++; peak = Math.max(peak, active);
    setTimeout(() => { active--; res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }); res.end('ok'); }, 300);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><title>shop</title>');
}
const server = http.createServer(handler);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: findChromium() });
try {
  const page = await browser.newPage();
  await page.goto(base);

  // редиректы после POST
  const methods = {};
  for (const code of [301, 302, 303, 307, 308]) {
    seen.length = 0;
    const final = await page.evaluate((c) => fetch(`/redirect/${c}`, { method: 'POST', body: 'qty=2' }).then((r) => r.text()), code);
    methods[code] = [final, seen[0]];
  }
  assert.deepEqual(methods, {
    301: ['GET', 'GET '],
    302: ['GET', 'GET '],
    303: ['GET', 'GET '],
    307: ['POST', 'POST qty=2'],
    308: ['POST', 'POST qty=2'],
  });

  // HTTP/1.1: 12 параллельных запросов к одному хосту
  peak = 0;
  const h1 = await page.evaluate(async () => {
    const t = performance.now();
    await Promise.all(Array.from({ length: 12 }, (_, i) => fetch(`/slow?i=${i}`, { cache: 'no-store' }).then((r) => r.text())));
    const ms = performance.now() - t;
    await new Promise((r) => setTimeout(r, 50));                                               // записи Resource Timing появляются после ответа
    const entry = performance.getEntriesByType('resource').find((e) => e.name.includes('/slow'));
    return { ms, protocol: entry.nextHopProtocol };
  });
  assert.equal(peak, 6);                                                                       // шесть соединений на хост
  assert.equal(h1.protocol, 'http/1.1');
  assert.ok(h1.ms >= 590, `две волны: ${h1.ms.toFixed(0)} мс`);

  // HTTP/2 по TLS
  const dir = mkdtempSync(join(tmpdir(), 'h2-'));
  const gen = spawnSync('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-days', '1',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
    '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem')]);
  if (gen.status === 0) {
    const h2 = http2.createSecureServer({ key: readFileSync(join(dir, 'key.pem')), cert: readFileSync(join(dir, 'cert.pem')), allowHTTP1: true }, handler);
    await new Promise((r) => h2.listen(0, '127.0.0.1', r));
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const p2 = await context.newPage();
    await p2.goto(`https://127.0.0.1:${h2.address().port}/`);
    peak = 0;
    const r2 = await p2.evaluate(async () => {
      const t = performance.now();
      await Promise.all(Array.from({ length: 12 }, (_, i) => fetch(`/slow?i=${i}`, { cache: 'no-store' }).then((r) => r.text())));
    const ms = performance.now() - t;
    await new Promise((r) => setTimeout(r, 50));                                               // записи Resource Timing появляются после ответа
      const entries = performance.getEntriesByType('resource').filter((e) => e.name.includes('/slow'));
      return { ms, protocol: entries[0].nextHopProtocol };
    });
    assert.equal(peak, 12);                                                                    // все сразу, одним соединением
    assert.equal(r2.protocol, 'h2');
    assert.ok(r2.ms < 590, `одна волна: ${r2.ms.toFixed(0)} мс`);
    await context.close();
    h2.close();
  } else {
    console.log('openssl не найден — проверка HTTP/2 пропущена');
  }
  rmSync(dir, { recursive: true, force: true });
} finally {
  await browser.close();
  server.close();
}
console.log('browser ok');
