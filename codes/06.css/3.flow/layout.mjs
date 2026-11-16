// Проверки к 6.03 в Chromium: строчные и блочные боксы, display: contents, способы скрыть элемент и атрибут hidden,
// схлопывание отступов, BFC и float, containing block у fixed, sticky и overflow, контекст наложения и z-index,
// flex-сокращения и min-width: auto, Grid: auto-fill/auto-fit, 1fr против minmax(0, 1fr), subgrid, центрирование.
// Запуск: cd codes && node run.mjs 06.css/3.flow
import assert from 'node:assert/strict';
import { withPage } from '../../_lib/browser.mjs';

await withPage(async (page) => {
  const set = (css, body) => page.setContent(`<!doctype html><html lang="ru"><style>body{margin:0;font:16px/1.2 sans-serif}${css}</style><body>${body}</body></html>`);
  const rect = (sel) => page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
  const cs = (sel, prop) => page.$eval(sel, (el, p) => getComputedStyle(el)[p], prop);
  const hit = (x, y) => page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id || null, [x, y]);

  // --- строчный бокс игнорирует width и height, inline-block — нет; двузначный display ---
  await set(`span { width: 100px; height: 50px; } .ib { display: inline-block; } .two { display: inline flex; }`,
    `<span id="s">ок</span><span id="ib" class="ib">ок</span><div id="two" class="two"></div>`);
  assert.ok((await rect('#s')).w < 100);
  assert.deepEqual([(await rect('#ib')).w, (await rect('#ib')).h], [100, 50]);
  assert.equal(await cs('#two', 'display'), 'inline-flex');

  // --- display: contents — обёртки нет, её дети становятся flex-элементами родителя ---
  await set(`.row { display: flex; } .row div:not(.wrap) { width: 100px; } .wrap { display: contents; }`,
    `<div class="row"><div id="a">a</div><div class="wrap" id="w"><div id="b">b</div><div id="c">c</div></div></div>`);
  assert.deepEqual([(await rect('#a')).x, (await rect('#b')).x, (await rect('#c')).x], [0, 100, 200]);
  assert.equal((await rect('#w')).w, 0);

  // --- способы скрыть ---
  await set(`
    .box { width: 100px; height: 40px; }
    .none { display: none; } .vis { visibility: hidden; width: 400px; } .op { opacity: 0; }
    .vis .back { visibility: visible; }
    .toolbar { display: flex; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }`,
  `<div class="box none" id="n">убранный блок</div>
   <div class="box vis" id="v">спрятанный текст <span class="back" id="vb">вернулся</span></div>
   <button class="box op" id="o">прозрачная кнопка</button>
   <div class="toolbar" id="tb" hidden>панель</div>
   <div id="tb2" hidden>панель</div>
   <span class="sr-only" id="sr">Корзина: 3 товара</span>`);
  assert.equal((await rect('#n')).h, 0);                            // display: none — места нет
  assert.deepEqual([(await rect('#v')).y, (await rect('#v')).h], [0, 40]); // visibility: hidden — место занято
  assert.equal(await hit(95, 30), null);                            // и клик проходит сквозь
  assert.equal(await cs('#vb', 'visibility'), 'visible');           // потомок может вернуть видимость
  assert.equal(await hit(10, 60), 'o');                             // opacity: 0 — кликабельна
  const tree = await page.locator('body').ariaSnapshot();
  assert.match(tree, /button "прозрачная кнопка"/);                 // и видна программам чтения с экрана
  assert.doesNotMatch(tree, /убранный блок|спрятанный текст/);
  { const r = await rect("#vb"); assert.equal(await hit(r.x + 3, r.y + 5), "vb"); } // и он видим и кликабелен
  assert.match(tree, /Корзина: 3 товара/);                           // sr-only читается
  assert.equal((await rect('#sr')).w, 1);
  assert.equal(await cs('#tb', 'display'), 'flex');                  // hidden проиграл .toolbar { display: flex }
  assert.equal(await cs('#tb2', 'display'), 'none');
  await page.addStyleTag({ content: '[hidden] { display: none !important; }' });
  assert.equal(await cs('#tb', 'display'), 'none');

  // --- схлопывание вертикальных отступов ---
  await set(`
    .a { margin-bottom: 20px; height: 10px; } .b { margin-top: 30px; height: 10px; }
    .neg-a { margin-bottom: 30px; height: 10px; } .neg-b { margin-top: -10px; height: 10px; }
    .parent { background: #eee; } .child { margin-top: 40px; height: 10px; }
    .flex { display: flex; flex-direction: column; } .flex .a, .flex .b { flex: none; }
    .fr { display: flow-root; }`,
  `<div id="s1"><div class="a" id="a1"></div><div class="b" id="b1"></div></div>
   <div id="s2"><div class="neg-a" id="a2"></div><div class="neg-b" id="b2"></div></div>
   <div id="s3" style="display: flow-root"><div class="parent" id="p3"><div class="child" id="c3"></div></div></div>
   <div id="s4"><div class="parent fr" id="p4"><div class="child" id="c4"></div></div></div>
   <div id="s5" class="flex"><div class="a" id="a5"></div><div class="b" id="b5"></div></div>`);
  const gap = async (a, b) => (await rect(b)).y - ((await rect(a)).y + (await rect(a)).h);
  assert.equal(await gap('#a1', '#b1'), 30);                       // не 50: берётся больший
  assert.equal(await gap('#a2', '#b2'), 20);                       // 30 + (−10)
  assert.equal((await rect('#c3')).y, (await rect('#p3')).y);      // отступ ребёнка «вывалился» из родителя
  assert.equal((await rect('#p3')).y - (await rect('#s3')).y, 40); // родитель сдвинулся вместе с ним
  assert.equal((await rect('#c4')).y - (await rect('#p4')).y, 40); // flow-root удержал отступ внутри
  assert.equal(await gap('#a5', '#b5'), 50);                       // во flex отступы не схлопываются

  // --- BFC: float не растягивает родителя; flow-root и overflow: hidden — растягивают, overflow: clip — нет ---
  await set(`
    .f { float: left; width: 100px; height: 80px; }
    .fr { display: flow-root; } .oh { overflow: hidden; } .oc { overflow: clip; }
    .side { display: flow-root; height: 40px; }`,
  `<div id="p0"><div class="f"></div></div><div style="clear:both"></div>
   <div id="p1" class="fr"><div class="f"></div></div>
   <div id="p2" class="oh"><div class="f"></div></div>
   <div id="p3" class="oc"><div class="f"></div></div><div style="clear:both"></div>
   <div><div class="f"></div><p id="txt">текст обтекает</p><div class="side" id="side">BFC рядом</div></div>`);
  assert.equal((await rect('#p0')).h, 0);
  assert.equal((await rect('#p1')).h, 80);
  assert.equal((await rect('#p2')).h, 80);
  assert.equal((await rect('#p3')).h, 0);                           // clip не создаёт BFC
  assert.equal((await rect('#txt')).x, 0);                          // бокс абзаца под float, обтекают только строки
  assert.equal((await rect('#side')).x, 100);                       // BFC не залезает под float

  // --- containing block: absolute — от позиционированного предка; fixed — от предка с transform или filter ---
  await set(`
    .card { position: relative; margin: 100px 0 0 50px; width: 300px; height: 200px; }
    .badge { position: absolute; top: 10px; right: 10px; width: 20px; height: 20px; }
    .t { transform: translateZ(0); margin-top: 300px; width: 300px; height: 100px; }
    .fl { filter: blur(0); margin-top: 300px; height: 100px; }
    .fx { position: fixed; top: 0; left: 0; width: 10px; height: 10px; }`,
  `<div class="card"><span class="badge" id="badge"></span></div>
   <div class="t" id="t"><div class="fx" id="fx1"></div></div>
   <div class="fl" id="fl"><div class="fx" id="fx2"></div></div>
   <div><div class="fx" id="fx3"></div></div>`);
  assert.deepEqual([(await rect('#badge')).x, (await rect('#badge')).y], [50 + 300 - 10 - 20, 110]);
  assert.equal((await rect('#fx3')).y, 0);                          // обычный fixed — от окна
  assert.equal((await rect('#fx1')).y, (await rect('#t')).y);       // transform у предка — fixed «прилип» к нему
  assert.equal((await rect('#fx2')).y, (await rect('#fl')).y);      // то же с filter

  // --- sticky: overflow: hidden у предка ломает, overflow: clip — нет; без top не липнет ---
  const sticky = async (wrap, headerCss = 'top: 0') => {
    await set(`.wrap { ${wrap} } header { position: sticky; ${headerCss}; height: 50px; } .long { height: 3000px; }`,
      `<div class="wrap"><header id="h">шапка</header><div class="long"></div></div>`);
    await page.evaluate(() => window.scrollTo(0, 1000));
    return (await rect('#h')).y;
  };
  assert.equal(await sticky(''), 0);
  assert.equal(await sticky('overflow-x: hidden'), -1000);         // предок стал контейнером прокрутки — шапка уехала
  assert.equal(await sticky('overflow-x: clip'), 0);               // clip обрезает, но прокрутку не создаёт
  assert.equal(await sticky('', 'top: auto'), -1000);              // без порога sticky ведёт себя как relative

  // --- контекст наложения: 9999 внутри z-index: 1 ниже соседа с z-index: 2 ---
  await set(`
    .sidebar { position: relative; z-index: 1; width: 300px; height: 100px; }
    .dropdown { position: absolute; z-index: 9999; top: 50px; left: 0; width: 300px; height: 200px; }
    .modal { position: relative; z-index: 2; width: 300px; height: 300px; }`,
  `<div class="sidebar" id="sb"><div class="dropdown" id="dd"></div></div><div class="modal" id="m"></div>`);
  assert.equal(await hit(150, 200), 'm');
  // без z-index у сайдбара контекста нет — 9999 сравнивается с 2 напрямую
  await page.$eval('#sb', (el) => (el.style.zIndex = 'auto'));
  assert.equal(await hit(150, 200), 'dd');
  // opacity < 1 тоже создаёт контекст: z-index 9999 снова заперт внутри
  await page.$eval('#sb', (el) => { el.style.position = 'static'; el.style.opacity = '0.99'; });
  assert.equal(await hit(150, 200), 'm');

  // верхний слой: модальный dialog внутри того же «запертого» сайдбара всё равно поверх всего
  await set(`
    .sidebar { position: relative; z-index: 1; width: 300px; height: 100px; }
    .modal { position: relative; z-index: 2; width: 600px; height: 600px; }
    dialog { width: 200px; height: 100px; padding: 0; border: 0; }`,
  `<div class="sidebar"><dialog id="dlg">окно</dialog></div><div class="modal" id="m2"></div>`);
  await page.$eval('#dlg', (d) => d.showModal());
  const c = await page.$eval('#dlg', (d) => { const r = d.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  assert.equal(await hit(c[0], c[1]), 'dlg');

  // popover — тоже верхний слой
  await set(`
    .sidebar { position: sticky; top: 0; z-index: 1; width: 300px; height: 100px; }
    .banner { position: relative; z-index: 2; width: 600px; height: 600px; }
    [popover] { position: fixed; inset: auto; top: 50px; left: 0; width: 200px; height: 200px; margin: 0; padding: 0; border: 0; }`,
  `<div class="sidebar"><div id="pop" popover>фильтры</div></div><div class="banner" id="bn"></div>`);
  await page.$eval('#pop', (p) => p.showPopover());
  assert.equal(await hit(100, 200), 'pop');

  // z-index без position не работает у обычного блока, но работает у flex-элемента
  await set(`
    .blk > div, .flx > div { width: 100px; height: 50px; } .second { margin-top: -25px; }
    .flx { display: flex; flex-direction: column; } .first { z-index: 1; }`,
  `<div class="blk"><div class="first" id="b1"></div><div class="second" id="b2"></div></div>
   <div class="flx" style="margin-top:100px"><div class="first" id="f1"></div><div class="second" id="f2"></div></div>`);
  assert.equal(await hit(50, 35), 'b2');                            // z-index проигнорирован
  assert.equal(await hit(50, 210), 'f1');                           // у flex-элемента — работает

  // z-index: -1 уходит под фон родителя, пока родитель не создал свой контекст
  await set(`
    .parent { position: relative; width: 200px; height: 100px; background: #eee; }
    .under { position: absolute; z-index: -1; inset: 0; }`,
  `<div class="parent" id="pp"><div class="under" id="un"></div></div>`);
  assert.equal(await hit(50, 50), 'pp');
  await page.$eval('#pp', (el) => (el.style.isolation = 'isolate'));
  assert.equal(await hit(50, 50), 'un');

  // --- flex: сокращения ---
  await set(`.row { display: flex; width: 600px; } .one > * { flex: 1; } .auto > * { flex: auto; } .none > * { flex: none; }`,
    `<div class="row one" id="r1"><div>коротко</div><div>текст подлиннее раза в три</div><div>x</div></div>
     <div class="row auto" id="r2"><div>коротко</div><div>текст подлиннее раза в три</div><div>x</div></div>`);
  const widths = (sel) => page.$$eval(`${sel} > *`, (els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  assert.deepEqual(await widths('#r1'), [200, 200, 200]);           // flex: 1 → база 0%, всё делится поровну
  const auto = await widths('#r2');
  assert.ok(auto[1] > auto[0] && auto[0] > auto[2]);                // flex: auto → база по содержимому
  assert.equal(auto.reduce((a, b) => a + b, 0), 600);
  const flexVals = await page.evaluate(() => {
    const d = document.createElement('div'); document.body.append(d);
    const out = {};
    for (const v of ['1', 'auto', 'none', 'initial']) { d.style.flex = v; const s = getComputedStyle(d); out[v] = `${s.flexGrow} ${s.flexShrink} ${s.flexBasis}`; }
    return out;
  });
  assert.deepEqual(flexVals, { 1: '1 1 0%', auto: '1 1 auto', none: '0 0 auto', initial: '0 1 auto' });

  // min-width: auto — длинное слово не даёт сжаться; min-width: 0 разрешает
  const url = 'https://example.com/catalog?utm_source=newsletter_autumn_tea_sale_utm_campaign=subscribers';
  await set(`.row { display: flex; width: 400px; } .icon { flex: none; width: 50px; } .text { flex: 1; }
             .fix { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`,
  `<div class="row" id="row1"><div class="icon"></div><div class="text" id="t1">${url}</div></div>
   <div class="row"><div class="icon"></div><div class="text fix" id="t2">${url}</div></div>`);
  assert.ok((await rect('#t1')).w > 350);                           // вылезла за 400 − 50
  assert.equal((await rect('#t2')).w, 350);
  assert.ok(await page.$eval('#row1', (el) => el.scrollWidth > el.clientWidth));

  // в колонке то же по высоте: прокручиваемая область внутри flex-элемента не получает прокрутку без min-height: 0
  const scrollable = async (fix) => {
    await set(`.col { display: flex; flex-direction: column; height: 300px; } .head { flex: none; height: 50px; }
               .body { flex: 1; ${fix} } .list { height: 100%; overflow: auto; } .list div { height: 100px; }`,
    `<div class="col"><div class="head"></div><div class="body" id="body"><div class="list" id="list">${'<div>товар</div>'.repeat(10)}</div></div></div>`);
    return { body: (await rect('#body')).h, scrolls: await page.$eval('#list', (el) => el.scrollHeight > el.clientHeight) };
  };
  assert.deepEqual(await scrollable(''), { body: 1000, scrolls: false });            // flex-элемент вырос до содержимого
  assert.deepEqual(await scrollable('min-height: 0;'), { body: 250, scrolls: true });

  // margin-left: auto отталкивает последний элемент
  await set(`nav { display: flex; width: 800px; } nav > * { width: 100px; } .push { margin-left: auto; }`,
    `<nav><a id="n1">Каталог</a><a id="n2">Доставка</a><a id="n3" class="push">Корзина</a></nav>`);
  assert.equal((await rect('#n3')).x, 700);

  // --- Grid: auto-fill против auto-fit ---
  await set(`.g { display: grid; width: 1000px; } .fill { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
             .fit { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }`,
  `<div class="g fill" id="gf"><div id="f1">1</div><div>2</div></div><div class="g fit" id="gt"><div id="t1">1</div><div>2</div></div>`);
  assert.equal((await rect('#f1')).w, 200);                         // пять дорожек, две пустые остались
  assert.equal((await rect('#t1')).w, 500);                         // пустые схлопнулись, карточки растянулись
  assert.equal((await cs('#gf', 'gridTemplateColumns')).split(' ').length, 5);

  // 1fr не сжимается меньше содержимого: длинное слово раздувает колонку; minmax(0, 1fr) — нет
  await set(`.g { display: grid; width: 400px; } .a { grid-template-columns: 1fr 1fr; } .b { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }`,
    `<div class="g a"><div id="a1">${url}</div><div id="a2">x</div></div><div class="g b"><div id="b1">${url}</div><div id="b2">x</div></div>`);
  assert.ok((await rect('#a1')).w > 200);
  assert.deepEqual([(await rect('#b1')).w, (await rect('#b2')).w], [200, 200]);

  // subgrid: строки карточек выравниваются между карточками
  const cards = (sub) => set(`
    .cards { display: grid; grid-template-columns: repeat(3, 150px); gap: 10px; }
    .card { display: grid; ${sub ? 'grid-row: span 3; grid-template-rows: subgrid;' : ''} }`,
  `<div class="cards">
    <div class="card"><h3 id="h1">Чай</h3><p>описание</p><b id="p1">990 ₽</b></div>
    <div class="card"><h3>Очень длинное название чайного набора</h3><p>описание</p><b id="p2">1990 ₽</b></div>
    <div class="card"><h3>Кофе</h3><p>описание</p><b id="p3">490 ₽</b></div></div>`);
  await cards(false);
  assert.notEqual((await rect('#p1')).y, (await rect('#p2')).y);
  await cards(true);
  assert.equal((await rect('#p1')).y, (await rect('#p2')).y);
  assert.equal((await rect('#p3')).y, (await rect('#p2')).y);

  // --- центрирование: flex, grid, absolute + margin: auto, align-content в обычном блоке ---
  const centered = async (css) => {
    await set(`.box { width: 400px; height: 200px; position: relative; ${css} } .item { width: 100px; height: 50px; }`,
      `<div class="box" id="box"><div class="item" id="item"></div></div>`);
    const r = await rect('#item');
    return [r.x, r.y];
  };
  assert.deepEqual(await centered('display: flex; justify-content: center; align-items: center;'), [150, 75]);
  assert.deepEqual(await centered('display: grid; place-items: center;'), [150, 75]);
  assert.deepEqual(await centered('} .item { position: absolute; inset: 0; margin: auto; } .x {'), [150, 75]);
  assert.deepEqual(await centered('display: block; align-content: center; } .item { margin-inline: auto; } .x {'), [150, 75]);
});

console.log('layout ok');
