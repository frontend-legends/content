// Проверки к 16.10 в Chromium: бесконечная лента на IntersectionObserver, подгрузка истории чата вверх
// с сохранением позиции, виртуальная таблица на 50 000 строк, доступный combobox (axe-core и клавиатура).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { withPage } from '../../_lib/browser.mjs';

const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const frame = () => new Promise((r) => setTimeout(r, 50));

await withPage(async (page) => {
  // --- лента: сторожевой элемент внизу, следующая страница — когда он появился в зоне видимости ---
  await page.setContent(`<style>body{margin:0} .post{height:100px;border-bottom:1px solid #ccc}</style>
<div id="feed"></div><div id="sentinel"></div>
<script>
  let page = 0, requests = 0;
  const feed = document.getElementById('feed');
  const load = () => { requests++; for (let i = 0; i < 10; i++) { const d = document.createElement('div'); d.className = 'post'; d.textContent = 'Пост ' + (page * 10 + i); feed.append(d); } page++; };
  load();
  new IntersectionObserver((entries) => { if (entries[0].isIntersecting) load(); }, { rootMargin: '200px' })
    .observe(document.getElementById('sentinel'));
  window.stats = () => ({ posts: feed.children.length, requests });
</script>`);
  await page.setViewportSize({ width: 800, height: 600 });
  await frame();
  assert.deepEqual(await page.evaluate(() => stats()), { posts: 10, requests: 1 }); // 1000 px ленты, сторож ниже экрана + 200 px
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await frame();
  assert.deepEqual(await page.evaluate(() => stats()), { posts: 20, requests: 2 });
  await page.evaluate(() => window.scrollBy(0, 100)); await frame();             // прокрутка без достижения конца — без запросов
  assert.equal((await page.evaluate(() => stats())).requests, 2);

  // --- чат: подгрузка истории вверх ---
  await page.setContent(`<style>#box{height:300px;overflow:auto} .m{height:40px}</style><div id="box"></div>
<script>
  const box = document.getElementById('box');
  let first = 100;
  const msg = (n) => { const d = document.createElement('div'); d.className = 'm'; d.textContent = 'Сообщение ' + n; return d; };
  for (let n = first; n < 130; n++) box.append(msg(n));
  box.scrollTop = box.scrollHeight;                             // чат открывается снизу, на последних сообщениях
  window.prepend = (keep) => {
    const before = box.scrollHeight;
    const frag = document.createDocumentFragment();
    for (let n = first - 20; n < first; n++) frag.append(msg(n));
    first -= 20;
    box.prepend(frag);
    if (keep) box.scrollTop += box.scrollHeight - before;      // сдвинуть на высоту добавленного
  };
  window.topVisible = () => { const top = box.getBoundingClientRect().top; return [...box.children].find((c) => c.getBoundingClientRect().bottom > top + 1).textContent; };
</script>`);
  assert.equal(await page.evaluate(() => box.scrollTop), 30 * 40 - 300);
  await page.evaluate(() => { box.scrollTop = 0; }); await frame();             // долистали до верха — пора грузить историю
  assert.equal(await page.evaluate(() => topVisible()), 'Сообщение 100');
  await page.evaluate(() => prepend(false)); await frame();
  assert.equal(await page.evaluate(() => topVisible()), 'Сообщение 80');         // экран прыгнул на 20 сообщений
  await page.evaluate(() => { box.scrollTop = 0; }); await frame();
  await page.evaluate(() => prepend(true)); await frame();
  assert.equal(await page.evaluate(() => topVisible()), 'Сообщение 80');         // с поправкой — на месте
  assert.equal(await page.evaluate(() => box.scrollTop), 20 * 40);
  // не в самом верху браузер держит позицию сам (scroll anchoring), с overflow-anchor: none — нет
  await page.evaluate(() => { box.scrollTop = 40; }); await frame();
  assert.equal(await page.evaluate(() => topVisible()), 'Сообщение 61');
  await page.evaluate(() => prepend(false)); await frame();
  assert.equal(await page.evaluate(() => topVisible()), 'Сообщение 61');
  await page.evaluate(() => { box.style.overflowAnchor = 'none'; box.scrollTop = 40; }); await frame();
  assert.equal(await page.evaluate(() => topVisible()), 'Сообщение 41');
  await page.evaluate(() => prepend(false)); await frame();
  assert.equal(await page.evaluate(() => topVisible()), 'Сообщение 21');

  // --- виртуальная таблица ---
  await page.setContent(`<style>body{margin:0} #vp{height:640px;overflow:auto;position:relative} .row{position:absolute;left:0;right:0;height:32px}</style>
<div id="vp"><div id="spacer"></div></div>
<script>
  const ROWS = 50000, H = 32, OVERSCAN = 5;
  const vp = document.getElementById('vp'), spacer = document.getElementById('spacer');
  spacer.style.height = ROWS * H + 'px';                        // полная высота — для правильного ползунка
  const render = () => {
    const start = Math.max(0, Math.floor(vp.scrollTop / H) - OVERSCAN);
    const end = Math.min(ROWS, Math.ceil((vp.scrollTop + vp.clientHeight) / H) + OVERSCAN);
    const rows = [];
    for (let i = start; i < end; i++) { const r = document.createElement('div'); r.className = 'row'; r.style.top = i * H + 'px'; r.textContent = 'Строка ' + i; rows.push(r); }
    spacer.replaceChildren(...rows);
  };
  vp.addEventListener('scroll', render);
  render();
  window.info = () => ({ rows: spacer.children.length, first: spacer.firstChild.textContent, scrollHeight: vp.scrollHeight,
    atTop: [...spacer.children].find((r) => r.getBoundingClientRect().bottom > vp.getBoundingClientRect().top + 1).textContent });
</script>`);
  let info = await page.evaluate(() => info());
  assert.equal(info.scrollHeight, 50_000 * 32);
  assert.equal(info.rows, 20 + 5);                               // 20 видимых + запас снизу
  await page.evaluate(() => { vp.scrollTop = 25_000 * 32; }); await frame();
  info = await page.evaluate(() => info());
  assert.equal(info.rows, 5 + 20 + 5);                           // в DOM — 30 строк из 50 000
  assert.equal(info.first, 'Строка 24995');
  assert.equal(info.atTop, 'Строка 25000');

  // --- combobox ---
  const axe = async () => { await page.addScriptTag({ path: axePath }); return page.evaluate(async () => (await axe.run(document.getElementById('app'))).violations.map((v) => v.id).sort()); };

  // «дропдаун из div»: выглядит так же, но для скринридера это текст без роли и подписи
  await page.setContent(`<div id="app"><div class="select" tabindex="0"><input placeholder="Город"></div>
<div class="list"><div class="opt" onclick="">Москва</div><div class="opt">Казань</div></div></div>`);
  assert.deepEqual(await axe(), []);                             // автоматическая проверка молчит: placeholder сошёл за имя
  // а дерево доступности показывает, что услышит скринридер: поле и текст, ни списка, ни вариантов
  assert.equal(await page.locator('#app').ariaSnapshot(), '- textbox "Город"\n- text: Москва Казань');

  await page.setContent(`<div id="app">
  <label for="city">Город</label>
  <input id="city" role="combobox" aria-expanded="false" aria-controls="list" aria-autocomplete="list">
  <ul id="list" role="listbox" aria-label="Города" hidden>
    <li id="o0" role="option" aria-selected="false">Москва</li>
    <li id="o1" role="option" aria-selected="false">Казань</li>
    <li id="o2" role="option" aria-selected="false">Самара</li>
  </ul>
</div>
<script>
  const input = document.getElementById('city'), list = document.getElementById('list');
  const options = [...list.children];
  let active = -1;
  const open = (v) => { list.hidden = !v; input.setAttribute('aria-expanded', String(v)); if (!v) { active = -1; input.removeAttribute('aria-activedescendant'); } };
  const move = (i) => { active = (i + options.length) % options.length; options.forEach((o, k) => o.setAttribute('aria-selected', String(k === active))); input.setAttribute('aria-activedescendant', options[active].id); };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) open(true); move(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(active - 1); }
    else if (e.key === 'Enter' && active >= 0) { input.value = options[active].textContent; open(false); }
    else if (e.key === 'Escape') open(false);
  });
</script>`);
  const state = () => page.evaluate(() => ({ expanded: input.getAttribute('aria-expanded'), active: input.getAttribute('aria-activedescendant'), value: input.value, focus: document.activeElement.id }));
  await page.focus('#city');
  await page.keyboard.press('ArrowDown');
  assert.deepEqual(await state(), { expanded: 'true', active: 'o0', value: '', focus: 'city' });
  assert.deepEqual(await axe(), []);                             // открытый список без нарушений
  assert.equal(await page.locator('#app').ariaSnapshot(), [
    '- text: Город',
    '- combobox "Город" [expanded]',
    '- listbox "Города":',
    '  - option "Москва" [selected]',
    '  - option "Казань"',
    '  - option "Самара"',
  ].join('\n'));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');                        // по кругу: после последнего — первый
  assert.equal((await state()).active, 'o0');
  await page.keyboard.press('ArrowUp');
  assert.equal((await state()).active, 'o2');
  await page.keyboard.press('Enter');
  assert.deepEqual(await state(), { expanded: 'false', active: null, value: 'Самара', focus: 'city' }); // фокус остался в поле
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  assert.deepEqual(await state(), { expanded: 'false', active: null, value: 'Самара', focus: 'city' });
});

console.log('ui ok');
