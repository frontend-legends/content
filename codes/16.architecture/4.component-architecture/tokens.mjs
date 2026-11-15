// Проверка к 16.04 в Chromium: дизайн-токены как CSS-переменные — одно изменение меняет все компоненты,
// а тема переопределяет токены, не трогая стили компонентов.
import assert from 'node:assert/strict';
import { withPage } from '../../_lib/browser.mjs';

await withPage(async (page) => {
  await page.setContent(`<!doctype html><style>
    :root { --color-accent: rgb(37, 99, 235); --radius-control: 8px; --space-2: 8px; }
    [data-theme="sale"] { --color-accent: rgb(220, 38, 38); }
    .button { background: var(--color-accent); border-radius: var(--radius-control); padding: var(--space-2); }
    .badge { color: var(--color-accent); }
    .link { border-bottom: 1px solid var(--color-accent); }
  </style>
  <section id="main"><button class="button">Купить</button><span class="badge">новинка</span><a class="link">все чаи</a></section>
  <section id="promo" data-theme="sale"><button class="button">Купить со скидкой</button></section>`);
  const colors = () => page.evaluate(() => {
    const c = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
    return [c('#main .button', 'backgroundColor'), c('#main .badge', 'color'), c('#main .link', 'borderBottomColor'), c('#promo .button', 'backgroundColor')];
  });
  assert.deepEqual(await colors(), ['rgb(37, 99, 235)', 'rgb(37, 99, 235)', 'rgb(37, 99, 235)', 'rgb(220, 38, 38)']);
  // ребрендинг: одно значение токена — все компоненты
  await page.evaluate(() => document.documentElement.style.setProperty('--color-accent', 'rgb(5, 150, 105)'));
  assert.deepEqual(await colors(), ['rgb(5, 150, 105)', 'rgb(5, 150, 105)', 'rgb(5, 150, 105)', 'rgb(220, 38, 38)']); // тема распродажи сохранила своё
});
console.log('tokens ok');
