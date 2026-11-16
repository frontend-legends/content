// Проверки к 4.03 в Chromium: HTTPS-сервер за TCP-прокси, который задерживает каждый кусок данных на 50 мс
// в каждую сторону (RTT = 100 мс). Рукопожатие TLS 1.3 занимает один круг, запрос и ответ — ещё один,
// редирект добавляет круг, повторная навигация переиспользует соединение (без TCP и TLS), а с
// Connection: close каждое обращение открывает соединение заново (CDP connectionReused).
// Сертификат создаёт openssl; если его нет, проверка пропускается.
// Запуск: cd codes && node run.mjs 04.network-api/3.request-lifecycle
import assert from 'node:assert/strict';
import https from 'node:https';
import http from 'node:http';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const DELAY = 50;
// прокси: каждый кусок пересылается через DELAY мс, порядок сохраняется
function delayingProxy(targetPort) {
  return net.createServer((client) => {
    const upstream = net.connect(targetPort, '127.0.0.1');
    const pipe = (from, to) => {
      from.on('data', (chunk) => setTimeout(() => { if (!to.destroyed) to.write(chunk); }, DELAY));
      from.on('end', () => setTimeout(() => to.end(), DELAY));
      from.on('error', () => to.destroy());
    };
    pipe(client, upstream);
    pipe(upstream, client);
  });
}
const listen = (server) => new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));

const dir = mkdtempSync(join(tmpdir(), 'life-'));
const gen = spawnSync('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-days', '1',
  '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem')]);
if (gen.status !== 0) {
  console.log('openssl не найден — проверка пропущена');
  console.log('lifecycle ok');
  process.exit(0);
}

const app = (req, res) => {
  if (req.url === '/old') { res.writeHead(301, { location: '/new' }); return res.end(); }
  const close = req.url.startsWith('/close');
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', ...(close && { connection: 'close' }) });
  res.end('<!doctype html><title>чай</title><p>каталог</p>');
};
const server = https.createServer({ key: readFileSync(join(dir, 'key.pem')), cert: readFileSync(join(dir, 'cert.pem')) }, app);
const proxy = delayingProxy(await listen(server));
const origin = `https://127.0.0.1:${await listen(proxy)}`;
const plain = http.createServer(app);
const plainOrigin = `http://127.0.0.1:${await listen(plain)}`;

const browser = await chromium.launch({ executablePath: findChromium() });
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  // функция из практики «Разложи навигацию по шагам»
  const timing = () => page.evaluate(() => {
    function phases(n = performance.getEntriesByType('navigation')[0]) {
      return {
        redirect: n.redirectEnd - n.redirectStart,
        dns: n.domainLookupEnd - n.domainLookupStart,
        tcp: (n.secureConnectionStart || n.connectEnd) - n.connectStart,
        tls: n.secureConnectionStart ? n.connectEnd - n.secureConnectionStart : 0,
        ttfb: n.responseStart - n.requestStart,
        download: n.responseEnd - n.responseStart,
      };
    }
    const p = phases();
    const r = (x) => Math.round(x);
    return {
      tcp: r(p.tcp), tls: r(p.tls), ttfb: r(p.ttfb), redirect: r(p.redirect),
      redirects: performance.getEntriesByType('navigation')[0].redirectCount,
    };
  });

  // первый заход: TCP до прокси мгновенный, TLS — один круг, запрос — один круг
  await page.goto(`${origin}/`);
  const first = await timing();
  assert.ok(first.tcp < 30, JSON.stringify(first));
  assert.ok(first.tls >= 90 && first.tls < 200, `TLS: ${first.tls} мс`);                       // TLS 1.3 — 1 RTT
  assert.ok(first.ttfb >= 90 && first.ttfb < 200, `TTFB: ${first.ttfb} мс`);                  // запрос — 1 RTT

  // повторная навигация на тот же origin: соединение уже открыто
  await page.goto(`${origin}/again`);
  const second = await timing();
  assert.deepEqual([second.tcp, second.tls], [0, 0]);
  assert.ok(second.ttfb >= 90, `TTFB: ${second.ttfb} мс`);

  // редирект — ещё один круг до ответа
  await page.goto(`${origin}/old`);
  const redirected = await timing();
  assert.equal(redirected.redirects, 1);
  assert.ok(redirected.redirect >= 90, `редирект: ${redirected.redirect} мс`);

  // переиспользование соединения видно в CDP
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  const reused = {};
  cdp.on('Network.responseReceived', (e) => { if (e.type === 'Fetch') reused[new URL(e.response.url).pathname] = e.response.connectionReused; });
  await page.goto(`${plainOrigin}/`);
  await page.evaluate(async () => {
    for (const p of ['/keep-1', '/keep-2', '/close-1', '/close-2', '/close-3']) await (await fetch(p, { cache: 'no-store' })).text();
  });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(reused['/keep-1'], true);                                                       // то же соединение, что и для страницы
  assert.equal(reused['/keep-2'], true);
  assert.equal(reused['/close-2'], false);                                                     // после Connection: close — новое
  assert.equal(reused['/close-3'], false);
  await context.close();
} finally {
  await browser.close();
  proxy.close();
  server.close();
  plain.close();
  rmSync(dir, { recursive: true, force: true });
}
console.log('lifecycle ok');
