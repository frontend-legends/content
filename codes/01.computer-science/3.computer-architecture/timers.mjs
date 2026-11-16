// Проверки к 1.03 в Chromium: защита от Spectre. Без изоляции между origin таймер performance.now()
// огрублён до 100 мкс и SharedArrayBuffer недоступен; с заголовками COOP и COEP — 5 мкс и SharedArrayBuffer есть.
// Запуск: cd codes && node run.mjs 01.computer-science/3.computer-architecture
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const server = createServer((req, res) => {
  const isolated = req.url === '/isolated';
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    ...(isolated && { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' }),
  });
  res.end('<!doctype html><title>таймер</title>');
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ executablePath: findChromium() });
try {
  const page = await browser.newPage();
  const probe = async (path) => {
    await page.goto(`http://localhost:${server.address().port}${path}`);
    return page.evaluate(() => {
      let min = Infinity, prev = performance.now();
      const end = prev + 200;
      while (prev < end) { const now = performance.now(); if (now !== prev) { min = Math.min(min, now - prev); prev = now; } }
      return { isolated: crossOriginIsolated, sab: typeof SharedArrayBuffer, step: Math.round(min * 1000) };   // мкс
    });
  };
  assert.deepEqual(await probe('/plain'), { isolated: false, sab: 'undefined', step: 100 });
  assert.deepEqual(await probe('/isolated'), { isolated: true, sab: 'function', step: 5 });
} finally {
  await browser.close();
  server.close();
}
console.log('timers ok');
