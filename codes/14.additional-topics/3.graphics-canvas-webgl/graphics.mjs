// Проверки к 14.03 в Chromium: devicePixelRatio и размытый canvas, immediate mode и isPointInPath,
// пиксели через getImageData и «испорченный» canvas, WebGL2 с шейдерами, проверка поддержки WebGPU.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import { findChromium } from '../../_lib/browser.mjs';

// картинка 2×2 с другого источника — без CORS и с CORS
const png = (() => { const p = new PNG({ width: 2, height: 2 }); p.data.fill(200); return PNG.sync.write(p); })();
const images = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    res.setHeader('content-type', 'image/png');
    if (req.url.startsWith('/cors')) res.setHeader('access-control-allow-origin', '*');
    res.end(png);
  }).listen(0, () => resolve(s));
});
const imgBase = `http://127.0.0.1:${images.address().port}`;

const browser = await chromium.launch({ executablePath: findChromium() });
try {
  // --- devicePixelRatio: canvas 100×100 по CSS на экране с плотностью 2 ---
  const context = await browser.newContext({ viewport: { width: 300, height: 200 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.setContent(`<body style="margin:0;background:#fff">
    <canvas id="naive" style="width:100px;height:100px;display:block"></canvas>
    <canvas id="sharp" style="width:100px;height:100px;display:block"></canvas></body>`);
  const sizes = await page.evaluate(() => {
    const draw = (c, scale) => {
      const ctx = c.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 100, 100);
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(50, 50, 30, 0, Math.PI * 2); ctx.fill();
    };
    const naive = document.getElementById('naive');
    naive.width = 100; naive.height = 100; draw(naive, 1);
    const sharp = document.getElementById('sharp');
    const dpr = devicePixelRatio;
    sharp.width = 100 * dpr; sharp.height = 100 * dpr; draw(sharp, dpr);
    return { dpr, naive: [naive.width, naive.height], sharp: [sharp.width, sharp.height] };
  });
  assert.deepEqual(sizes, { dpr: 2, naive: [100, 100], sharp: [200, 200] });
  // доля «промежуточных» серых пикселей вдоль края круга: растянутый canvas размыт
  const blur = async (id) => {
    const img = PNG.sync.read(await page.locator(`#${id}`).screenshot());
    let gray = 0, edge = 0;
    for (let i = 0; i < img.data.length; i += 4) { const v = img.data[i]; if (v > 0 && v < 255) gray++; if (v < 255) edge++; }
    return { width: img.width, gray, ratio: gray / edge };
  };
  const naiveBlur = await blur('naive');
  const sharpBlur = await blur('sharp');
  assert.equal(naiveBlur.width, 200); // на экране оба по 200 физических пикселей
  assert.equal(sharpBlur.width, 200);
  assert.ok(naiveBlur.gray > sharpBlur.gray * 1.5, `${naiveBlur.gray} vs ${sharpBlur.gray}`);
  console.log(`  серых пикселей на краю: растянутый ${naiveBlur.gray}, с учётом devicePixelRatio ${sharpBlur.gray}`);

  // --- immediate mode: фигур нет, попадание считают сами ---
  const hit = await page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d');
    const button = new Path2D(); button.roundRect(10, 10, 80, 30, 6);
    ctx.fill(button);
    return { inside: ctx.isPointInPath(button, 50, 25), outside: ctx.isPointInPath(button, 95, 25), children: ctx.canvas.children.length };
  });
  assert.deepEqual(hit, { inside: true, outside: false, children: 0 });

  // --- пиксели: оттенки серого через getImageData ---
  const gray = await page.evaluate(() => {
    const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d');
    ctx.fillStyle = 'rgb(255, 0, 0)'; ctx.fillRect(0, 0, 1, 1);
    const img = ctx.getImageData(0, 0, 1, 1);
    const [r, g, b] = img.data;
    const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    img.data.set([y, y, y, 255]); ctx.putImageData(img, 0, 0);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  });
  assert.deepEqual(gray, [76, 76, 76, 255]);

  // --- картинка с другого источника без CORS «портит» canvas: пиксели читать нельзя ---
  const taint = await page.evaluate(async (base) => {
    const load = (src, cors) => new Promise((r, j) => { const i = new Image(); if (cors) i.crossOrigin = 'anonymous'; i.onload = () => r(i); i.onerror = j; i.src = src; });
    const read = (img) => { const ctx = document.createElement('canvas').getContext('2d'); ctx.drawImage(img, 0, 0); try { return ctx.getImageData(0, 0, 1, 1).data[0]; } catch (e) { return e.name; } };
    return { plain: read(await load(`${base}/plain.png`, false)), cors: read(await load(`${base}/cors.png?x`, true)) };
  }, imgBase);
  assert.deepEqual(taint, { plain: 'SecurityError', cors: 200 });

  // --- WebGL2: вершинный и фрагментный шейдеры рисуют треугольник ---
  const gl = await page.evaluate(() => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
    const gl = canvas.getContext('webgl2');
    const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const vs = shader(gl.VERTEX_SHADER, `#version 300 es
      in vec2 pos; void main() { gl_Position = vec4(pos, 0.0, 1.0); }`);
    const fs = shader(gl.FRAGMENT_SHADER, `#version 300 es
      precision mediump float; out vec4 color; void main() { color = vec4(1.0, 0.0, 0.0, 1.0); }`);
    const broken = shader(gl.FRAGMENT_SHADER, `#version 300 es
      precision mediump float; out vec4 color; void main() { color = vec3(1.0); }`);
    const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); gl.useProgram(program);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 0, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'pos'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.clearColor(0, 0, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const px = (x, y) => { const p = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p); return [...p]; };
    return { center: px(32, 20), corner: px(1, 62), brokenOk: gl.getShaderParameter(broken, gl.COMPILE_STATUS), log: gl.getShaderInfoLog(broken) };
  });
  assert.deepEqual(gl.center, [255, 0, 0, 255]); // внутри треугольника — красный
  assert.deepEqual(gl.corner, [0, 0, 255, 255]); // фон — синий
  assert.equal(gl.brokenOk, false);              // ошибка в шейдере видна только в журнале компиляции
  assert.match(gl.log, /ERROR/);

  // --- WebGPU: есть не везде, проверяют наличие и адаптер ---
  const gpu = await page.evaluate(async () => ('gpu' in navigator ? Boolean(await navigator.gpu.requestAdapter()) : 'нет navigator.gpu'));
  console.log(`  WebGPU в проверочном headless Chromium: ${gpu}`);
  assert.ok(gpu === 'нет navigator.gpu' || typeof gpu === 'boolean');
} finally {
  await browser.close();
  images.close();
}
console.log('graphics ok');
