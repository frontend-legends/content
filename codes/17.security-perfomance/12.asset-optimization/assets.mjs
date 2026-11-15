// Проверки к 17.12: форматы и размеры изображений настоящим sharp (PNG → JPEG → WebP → AVIF и ресайз),
// выбор адаптивного изображения браузером по srcset/sizes в Chromium, вес зависимости от tree-shaking
// (именованный импорт из ESM против целой библиотеки) и удаление неиспользуемого CSS.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createServer } from 'node:http';
import { PNG } from 'pngjs';
import { withPage } from '../../_lib/browser.mjs';
import { cost } from '../../_lib/project.mjs';

// --- форматы изображений: один и тот же кадр в разных форматах ---
const W = 1200, H = 800, raw = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 3; raw[i] = 128 + 120 * Math.sin(x / 90); raw[i + 1] = 128 + 120 * Math.sin(y / 70); raw[i + 2] = 128 + 120 * Math.sin((x + y) / 110); }
const img = sharp(raw, { raw: { width: W, height: H, channels: 3 } });
const size = async (build) => (await build(img.clone()).toBuffer()).length;
const png = await size((i) => i.png());
const jpeg = await size((i) => i.jpeg({ quality: 80 }));
const webp = await size((i) => i.webp({ quality: 80 }));
const avif = await size((i) => i.avif({ quality: 50 }));
const resized = await size((i) => i.resize(400).webp({ quality: 80 }));
assert.ok(png > jpeg * 10, `PNG ${png} против JPEG ${jpeg}`);  // без потерь — в разы тяжелее
assert.ok(jpeg > webp, `WebP ${webp} легче JPEG ${jpeg}`);
assert.ok(webp > avif, `AVIF ${avif} легче WebP ${webp}`);
assert.ok(resized < webp / 3, `тот же WebP под телефон (400px) ${resized} против полного ${webp}`); // размер важнее формата

// --- адаптивные изображения: браузер сам выбирает кандидата по ширине ---
const mk = (w, h) => { const p = new PNG({ width: w, height: h }); for (let i = 0; i < p.data.length; i += 4) { p.data[i] = 120; p.data[i + 1] = 160; p.data[i + 2] = 200; p.data[i + 3] = 255; } return PNG.sync.write(p); };
const assets = { '/small.png': mk(400, 300), '/large.png': mk(1200, 900) };
const server = createServer((req, res) => {
  if (assets[req.url]) { res.setHeader('content-type', 'image/png'); return res.end(assets[req.url]); }
  res.setHeader('content-type', 'text/html');
  res.end('<!doctype html><img id=r srcset="/small.png 400w, /large.png 1200w" sizes="(max-width:600px) 400px, 1200px" src="/large.png" width=1200 height=900>');
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
await withPage(async (page) => {
  const chosen = async (width) => { await page.setViewportSize({ width, height: 800 }); await page.goto(base + '/', { waitUntil: 'load' }); return page.evaluate(() => document.getElementById('r').currentSrc.split('/').pop()); };
  assert.equal(await chosen(390), 'small.png');   // телефон получает маленькую картинку
  assert.equal(await chosen(1280), 'large.png');  // десктоп — большую
});
server.close();

// --- вес зависимости и tree-shaking: именованный импорт из ESM против целой библиотеки ---
const named = await cost("import { debounce } from 'lodash-es'; export default debounce(() => {}, 100);");
const whole = await cost("import _ from 'lodash'; export default _.debounce(() => {}, 100);");
assert.ok(named.gzip < 2 * 1024, `из lodash-es уехал только debounce: ${named.gzip} Б`);
assert.ok(whole.gzip > 10 * named.gzip, `вся lodash ${whole.gzip} Б против ${named.gzip} Б`);

// --- удаление неиспользуемого CSS: оставить только классы, встречающиеся в разметке ---
const css = Array.from({ length: 1000 }, (_, i) => `.u-${i}{margin:${i % 16}px}`).join('\n'); // утилитарный фреймворк
const html = '<div class="u-3 u-7"><span class="u-42">цена</span></div>';
const used = new Set((html.match(/class="([^"]*)"/g) ?? []).flatMap((m) => m.slice(7, -1).split(/\s+/)));
const purge = (css) => css.split('\n').filter((rule) => { const cls = rule.match(/^\.([\w-]+)\{/)?.[1]; return cls && used.has(cls); }).join('\n');
const purged = purge(css);
assert.equal(purged.split('\n').length, 3);                  // из тысячи правил осталось три используемых
assert.ok(Buffer.byteLength(purged) < Buffer.byteLength(css) / 100, `${Buffer.byteLength(purged)} против ${Buffer.byteLength(css)} Б`);
assert.ok(['u-3', 'u-7', 'u-42'].every((c) => purged.includes(`.${c}{`)));

console.log('assets ok');
