// Глава 12.09 — анимации в настоящем Chromium: WAAPI и её промис finished, Motion анимирует transform через WAAPI,
// GSAP — кадрами через inline-стили, prefers-reduced-motion, View Transitions API.
// run: node animation.mjs
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { withPage } from '../../_lib/browser.mjs';
import { cost } from '../../_lib/project.mjs';

const bundle = async (code) => (await build({ stdin: { contents: code, resolveDir: process.cwd(), loader: 'js' }, bundle: true, write: false, format: 'iife', logLevel: 'silent' })).outputFiles[0].text;
const motionJs = await bundle("import { animate } from 'motion'; window.motionAnimate = animate;");
const gsapJs = await bundle("import { gsap } from 'gsap'; window.gsap = gsap;");

await withPage(async (page) => {
  await page.setContent('<div id="toast" style="width:100px;height:40px;background:green"></div><div id="badge" style="width:20px;height:20px;background:red"></div><div id="g" style="width:20px;height:20px"></div>');
  await page.addScriptTag({ content: motionJs });
  await page.addScriptTag({ content: gsapJs });

  // --- WAAPI: анимация — объект с промисом finished
  const waapi = await page.evaluate(async () => {
    const el = document.querySelector('#toast');
    const a = el.animate([{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], { duration: 120, easing: 'ease-out' });
    const during = el.getAnimations().length;
    await a.finished;
    return { during, state: a.playState, after: el.getAnimations().length };
  });
  assert.deepEqual(waapi, { during: 1, state: 'finished', after: 0 });

  // --- Motion: transform и opacity — через WAAPI (виден в getAnimations), промис завершения
  const motion = await page.evaluate(async () => {
    const el = document.querySelector('#badge');
    const controls = window.motionAnimate(el, { transform: ['scale(0.5)', 'scale(1)'], opacity: [0, 1] }, { duration: 0.12 });
    const waapiCount = el.getAnimations().length;
    await controls;
    return { waapiCount, opacity: getComputedStyle(el).opacity };
  });
  assert.ok(motion.waapiCount >= 1);
  assert.equal(motion.opacity, '1');

  // --- GSAP: свой движок кадров — меняет inline-стили через requestAnimationFrame, WAAPI не использует
  const g = await page.evaluate(async () => {
    const el = document.querySelector('#g');
    const samples = [];
    const tween = window.gsap.to(el, { x: 100, duration: 0.15, ease: 'none', onUpdate: () => samples.push(el.style.transform) });
    const waapiCount = el.getAnimations().length;
    await tween.then();
    return { waapiCount, samples: samples.length, final: el.style.transform };
  });
  assert.equal(g.waapiCount, 0);
  assert.ok(g.samples > 3);                                        // много промежуточных значений — кадр за кадром
  assert.match(g.final, /translate(3d)?\(100px/);

  // --- View Transitions API
  const vt = await page.evaluate(async () => {
    if (!document.startViewTransition) return 'нет';
    const t = document.startViewTransition(() => { document.querySelector('#toast').textContent = 'Добавлено'; });
    await t.finished;
    return document.querySelector('#toast').textContent;
  });
  assert.equal(vt, 'Добавлено');
});

// --- prefers-reduced-motion
await withPage(async (page) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setContent('<style>.card{transition:transform .3s}@media (prefers-reduced-motion: reduce){.card{transition:none}}</style><div class="card"></div>');
  const r = await page.evaluate(() => ({ media: matchMedia('(prefers-reduced-motion: reduce)').matches, transition: getComputedStyle(document.querySelector('.card')).transitionDuration }));
  assert.deepEqual(r, { media: true, transition: '0s' });
});
// --- размеры
const kb = async (c) => +((await cost(c)).gzip / 1024).toFixed(1);
const sizes = {
  'motion: animate': await kb("import { animate } from 'motion'; console.log(animate);"),
  'motion/mini: animate': await kb("import { animate } from 'motion/mini'; console.log(animate);"),
  'gsap: core': await kb("import { gsap } from 'gsap'; console.log(gsap.to);"),
};
console.table(sizes);
assert.ok(sizes['motion/mini: animate'] < sizes['motion: animate']);
console.log('animation ok');
