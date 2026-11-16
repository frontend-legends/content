// Проверки к 1.02 в Chromium: btoa на кириллице, Uint8Array.toBase64 и fromBase64,
// размер распакованной картинки в памяти — ширина × высота × 4 байта, порядок байтов платформы.
// Запуск: cd codes && node run.mjs 01.computer-science/2.data-representation
import assert from 'node:assert/strict';
import { withPage } from '../../_lib/browser.mjs';

await withPage(async (page) => {
  const r = await page.evaluate(() => {
    let error;
    try { btoa('Привет'); } catch (e) { error = e.name; }
    const bytes = new TextEncoder().encode('Привет');
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const pixels = canvas.getContext('2d').getImageData(0, 0, 1920, 1080).data;
    return {
      error,
      b64: bytes.toBase64(),
      url: bytes.toBase64({ alphabet: 'base64url', omitPadding: true }),
      back: new TextDecoder().decode(Uint8Array.fromBase64('0J/RgNC40LLQtdGC')),
      pixels: pixels.length,
      kind: pixels.constructor.name,
      littleEndian: new Uint8Array(new Uint32Array([1]).buffer)[0] === 1,
      roundTrip: (() => {
        // практика «btoa падает на кириллице»
        const state = { query: 'улун', sort: 'price' };
        const hash = new TextEncoder().encode(JSON.stringify(state)).toBase64({ alphabet: 'base64url', omitPadding: true });
        const back = JSON.parse(new TextDecoder().decode(Uint8Array.fromBase64(hash, { alphabet: 'base64url' })));
        return /^[A-Za-z0-9_-]+$/.test(hash) && back.query === 'улун';
      })(),
    };
  });
  assert.deepEqual(r, {
    error: 'InvalidCharacterError',
    b64: '0J/RgNC40LLQtdGC',
    url: '0J_RgNC40LLQtdGC',
    back: 'Привет',
    pixels: 1920 * 1080 * 4,                                                         // 8 294 400 байт, RGBA
    kind: 'Uint8ClampedArray',
    littleEndian: true,
    roundTrip: true,
  });
});

console.log('browser ok');
