// Проверки к 5.06 в Chromium: вычисление доступного имени (aria-labelledby > aria-label > подпись/текст > title > placeholder),
// роль из ARIA без поведения (div role="button" не фокусируется и не жмётся Enter), role затирает семантику,
// aria-hidden на фокусируемом элементе, группа radio — одна остановка Tab и стрелки, fieldset/legend,
// неявные live-регионы у status и alert, axe-core на плохой и исправленной форме, контраст по формуле WCAG.
// Запуск: cd codes && node run.mjs 05.html/6.accessibility
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { withPage } from '../../_lib/browser.mjs';

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

// контраст по WCAG: относительная яркость и (L1 + 0.05) / (L2 + 0.05)
const luminance = (hex) => {
  const [r, g, b] = hex.match(/\w\w/g).map((h) => parseInt(h, 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
assert.equal(contrast('777777', 'ffffff'), 4.48);   // чуть-чуть не дотягивает до 4.5
assert.equal(contrast('767676', 'ffffff'), 4.54);   // проходит AA для обычного текста
assert.equal(contrast('000000', 'ffffff'), 21);

await withPage(async (page) => {
  const set = (body) => page.setContent(`<!doctype html><html lang="ru"><head><title>Оформление заказа</title></head><body>${body}</body></html>`);
  // дерево доступности самого Chromium
  const ax = async () => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    await cdp.detach();
    return nodes.filter((n) => !n.ignored);
  };
  const nameOf = async (id) => {
    const cdp = await page.context().newCDPSession(page);
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#' + id });
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
    await cdp.detach();
    const n = nodes[0];
    return { role: n.role?.value, name: n.name?.value ?? '', live: n.properties?.find((p) => p.name === 'live')?.value.value };
  };

  // --- доступное имя: порядок источников ---
  await set(`
    <h2 id="cart-title">Корзина</h2>
    <button id="b1">Удалить</button>
    <button id="b2" aria-label="Удалить улун">×</button>
    <button id="b3" aria-labelledby="cart-title" aria-label="Не это">×</button>
    <button id="b4" title="Удалить пуэр"><svg width="10" height="10" aria-hidden="true"></svg></button>
    <button id="b5"><svg width="10" height="10"></svg></button>
    <label for="phone">Телефон</label><input id="phone">
    <input id="ph" placeholder="Город">
    <img id="i1" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Улун молочный, 100 г">
    <img id="i2" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="">`);
  assert.deepEqual(await nameOf('b1'), { role: 'button', name: 'Удалить', live: undefined });
  assert.equal((await nameOf('b2')).name, 'Удалить улун');     // aria-label сильнее текста
  assert.equal((await nameOf('b3')).name, 'Корзина');          // aria-labelledby сильнее aria-label
  assert.equal((await nameOf('b4')).name, 'Удалить пуэр');     // title — последний запасной вариант
  assert.equal((await nameOf('b5')).name, '');                 // кнопка-иконка без имени
  assert.equal((await nameOf('phone')).name, 'Телефон');
  assert.equal((await nameOf('ph')).name, 'Город');            // placeholder стал именем, но исчезнет при вводе
  assert.equal((await nameOf('i1')).name, 'Улун молочный, 100 г');
  assert.equal((await ax()).some((n) => n.role?.value === 'image' && n.name?.value === ''), false); // alt="" — картинка выпала из дерева

  // --- ARIA меняет роль, но не поведение ---
  await set(`
    <div id="fake" role="button" onclick="window.__fake = (window.__fake ?? 0) + 1">Оплатить</div>
    <button id="real" onclick="window.__real = (window.__real ?? 0) + 1">Оплатить</button>
    <h2 id="h" role="button">Доставка</h2>`);
  assert.equal((await nameOf('fake')).role, 'button');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'real');      // div с ролью пропущен
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  assert.deepEqual(await page.evaluate(() => [window.__fake ?? 0, window.__real]), [0, 2]); // Enter и пробел нажали настоящую кнопку
  assert.equal(await page.$eval('#fake', (d) => { d.focus(); return document.activeElement === d; }), false); // div без tabindex не фокусируется даже кодом
  // с tabindex фокус есть, но Enter всё равно не вызывает click — это пишут вручную
  await page.$eval('#fake', (d) => { d.tabIndex = 0; d.focus(); });
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => window.__fake ?? 0), 0);
  assert.equal((await ax()).filter((n) => n.role?.value === 'heading').length, 0); // role затёр заголовок

  // --- aria-hidden на фокусируемом: элемент получает фокус, но «невидим» для программ чтения ---
  const warnings = [];
  page.on('console', (m) => warnings.push(m.text()));
  await set(`<div aria-hidden="true"><a id="ghost" href="/promo">Акция</a></div><button>Купить</button>`);
  const before = (await ax()).some((n) => n.name?.value === 'Акция');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement.id);
  const after = (await ax()).some((n) => n.name?.value === 'Акция');
  assert.deepEqual([before, focused], [false, 'ghost']);                       // скрыта от дерева, но Tab на неё попадает
  assert.equal(after, true);                                                    // Chromium снимает aria-hidden с фокуса…
  assert.ok(warnings.some((w) => w.startsWith('Blocked aria-hidden on an element because its descendant retained focus'))); // …и ругается, советуя inert

  // --- группа radio: одна остановка Tab, внутри — стрелки (встроенный roving tabindex) ---
  await set(`
    <fieldset id="fs"><legend>Доставка</legend>
      <label><input type="radio" name="d" id="r1" checked> Курьер</label>
      <label><input type="radio" name="d" id="r2"> Самовывоз</label>
      <label><input type="radio" name="d" id="r3"> Почта</label>
    </fieldset><button id="next">Дальше</button>`);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'r1');
  await page.keyboard.press('ArrowDown');
  assert.deepEqual(await page.evaluate(() => [document.activeElement.id, document.getElementById('r2').checked]), ['r2', true]);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'next');      // вся группа — одна остановка
  assert.deepEqual(await nameOf('fs'), { role: 'group', name: 'Доставка', live: undefined });

  // --- status и alert — live-регионы по умолчанию ---
  await set(`<div id="st" role="status">Добавлено в корзину</div><div id="al" role="alert">Карта отклонена</div><output id="out">3 товара</output>`);
  assert.equal((await nameOf('st')).live, 'polite');
  assert.equal((await nameOf('al')).live, 'assertive');
  assert.equal((await nameOf('out')).live, 'polite');                              // output — тоже status

  // --- axe-core: что ловит автоматическая проверка ---
  const axe = async () => {
    await page.addScriptTag({ content: axeSource });
    const r = await page.evaluate(() => window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }));
    return r.violations.map((v) => v.id).sort();
  };
  await set(`
    <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="40" height="40">
    <input type="tel">
    <button><svg width="10" height="10"></svg></button>
    <p style="color: #999; background: #fff">Доставка завтра</p>`);
  assert.deepEqual(await axe(), ['button-name', 'color-contrast', 'image-alt', 'label']);
  await set(`
    <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="40" height="40" alt="Улун молочный">
    <label for="t">Телефон</label><input id="t" type="tel">
    <button aria-label="Удалить из корзины"><svg width="10" height="10" aria-hidden="true"></svg></button>
    <p style="color: #595959; background: #fff">Доставка завтра</p>`);
  assert.deepEqual(await axe(), []);
  // а этого axe не видит: «кнопка» из div с обработчиком не попадает в правила вовсе
  await set(`<main><div onclick="pay()" style="cursor: pointer">Оплатить</div></main>`);
  assert.deepEqual(await axe(), []);
});

console.log('a11y ok');
