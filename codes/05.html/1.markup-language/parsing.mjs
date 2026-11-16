// Проверки к 5.01 настоящим HTML-парсером Chromium: что браузер строит из ошибочной разметки
// (p и div, вложенные a, form в form, button в button, неявный tbody, вынос текста из таблицы, adoption agency,
// необязательные закрывающие теги), разбор innerHTML в контексте и <template>, скрипт из innerHTML,
// режимы документа по DOCTYPE и пример причуды, символьные ссылки без точки с запятой, <div/> в HTML.
// Запуск: cd codes && node run.mjs 05.html/1.markup-language
import assert from 'node:assert/strict';
import { withPage } from '../../_lib/browser.mjs';

await withPage(async (page) => {
  // body.innerHTML документа, построенного браузером из строки (как при загрузке страницы)
  const parse = (html) => page.evaluate((html) => new DOMParser().parseFromString(html, 'text/html').body.innerHTML, html);
  const doc = (html) => page.evaluate((html) => {
    const d = new DOMParser().parseFromString(html, 'text/html');
    return { mode: d.compatMode, html: d.documentElement.outerHTML };
  }, html);

  // --- p не может содержать div: парсер закрывает p, а лишний </p> рождает пустой абзац ---
  assert.equal(await parse('<p>Чай улун <div>в наличии</div> скидка</p>'), '<p>Чай улун </p><div>в наличии</div> скидка<p></p>');

  // --- ссылка в ссылке: вторая закрывает первую; form в form — внутренний тег пропущен ---
  assert.equal(await parse('<a href="/tea">Чай <a href="/cart">в корзину</a></a>'), '<a href="/tea">Чай </a><a href="/cart">в корзину</a>');
  assert.equal(await parse('<form id="a"><form id="b"><input name="q"></form></form>'), '<form id="a"><input name="q"></form>');
  // а кнопку внутри ссылки парсер не трогает: DOM как в исходнике, ошибка остаётся
  assert.equal(await parse('<a href="/tea"><button>Купить</button></a>'), '<a href="/tea"><button>Купить</button></a>');
  // и div внутри ul тоже не трогает — только валидатор скажет, что так нельзя
  assert.equal(await parse('<ul><div><li>улун</li></div></ul>'), '<ul><div><li>улун</li></div></ul>');

  // --- таблица: неявный tbody и вынос «лишнего» текста перед таблицей ---
  assert.equal(
    await parse('<table><tr><td>Улун</td><td>990 ₽</td></tr>итого</table>'),
    'итого<table><tbody><tr><td>Улун</td><td>990 ₽</td></tr></tbody></table>',
  );
  const tbody = await page.evaluate(() => {
    const d = new DOMParser().parseFromString('<table><tr><td>Улун</td></tr></table>', 'text/html');
    return { direct: d.querySelector('table > tr'), viaTbody: d.querySelector('table > tbody > tr')?.tagName };
  });
  assert.deepEqual(tbody, { direct: null, viaTbody: 'TR' });

  // --- неправильно вложенное форматирование чинит adoption agency ---
  assert.equal(await parse('<b>жирный <i>оба</b> курсив</i>'), '<b>жирный <i>оба</i></b><i> курсив</i>');

  // --- необязательные закрывающие теги ---
  assert.equal(await parse('<ul><li>улун<li>пуэр</ul><p>один<p>два'), '<ul><li>улун</li><li>пуэр</li></ul><p>один</p><p>два</p>');

  // --- неявные html, head, body ---
  const implicit = await doc('<!doctype html><title>Каталог</title><h1>Чай</h1>');
  assert.equal(implicit.html, '<html><head><title>Каталог</title></head><body><h1>Чай</h1></body></html>');

  // --- innerHTML разбирается в контексте элемента: td вне таблицы теряются; <template> принимает любой фрагмент ---
  const ctx = await page.evaluate(() => {
    const div = document.createElement('div');
    div.innerHTML = '<td>Улун</td><td>990 ₽</td>';
    const tpl = document.createElement('template');
    tpl.innerHTML = '<td>Улун</td><td>990 ₽</td>';
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>Улун</td><td>990 ₽</td>';
    return { div: div.innerHTML, tpl: tpl.innerHTML, tr: tr.children.length };
  });
  assert.deepEqual(ctx, { div: 'Улун990 ₽', tpl: '<td>Улун</td><td>990 ₽</td>', tr: 2 });

  // --- <script>, вставленный через innerHTML, не выполняется ---
  const ran = await page.evaluate(() => {
    window.__ran = false;
    const box = document.createElement('div');
    document.body.append(box);
    box.innerHTML = '<script>window.__ran = true<\/script>';
    const viaCreate = document.createElement('script');
    viaCreate.textContent = 'window.__ran2 = true';
    document.body.append(viaCreate);
    return { innerHTML: window.__ran, createElement: window.__ran2 === true };
  });
  assert.deepEqual(ran, { innerHTML: false, createElement: true });

  // --- DOCTYPE и режим документа ---
  assert.equal((await doc('<!doctype html><p>')).mode, 'CSS1Compat');
  assert.equal((await doc('<p>без doctype')).mode, 'BackCompat');
  assert.equal((await doc('<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN"><p>')).mode, 'BackCompat');
  assert.equal((await doc('<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd"><p>')).mode, 'CSS1Compat'); // почти стандартный режим
  // причуда: в режиме совместимости CSS принимает длины без единиц
  const quirk = async (doctype) => {
    // настоящая навигация, а не setContent: режим документа выбирается при разборе его начала
    await page.goto('data:text/html,' + encodeURIComponent(`${doctype}<style>#box { width: 100; height: 20px; }</style><div id="box"></div>`));
    return page.$eval('#box', (el) => [document.compatMode, getComputedStyle(el).width].join(' '));
  };
  assert.equal(await quirk(''), 'BackCompat 100px');
  assert.equal(await quirk('<!doctype html>'), 'CSS1Compat 1264px');  // в стандартном режиме объявление отброшено: ширина по контейнеру (1280 − отступы body)

  // --- символьные ссылки ---
  const refs = await page.evaluate(() => {
    const d = new DOMParser().parseFromString(
      '<p id="t1">Цены &lt;1000 ₽&gt; &amp; скидки</p><p id="t2">&copy 2026</p><p id="t3">&notit;</p>' +
      '<a id="l" href="/catalog?sort=price&copy=1&amp;page=2">каталог</a><p id="nb">1&nbsp;000&nbsp;₽</p>', 'text/html');
    const t = (id) => d.getElementById(id).textContent;
    return { t1: t('t1'), t2: t('t2'), t3: t('t3'), href: d.getElementById('l').getAttribute('href'), nbsp: t('nb').charCodeAt(1).toString(16) };
  });
  assert.equal(refs.t1, 'Цены <1000 ₽> & скидки');
  assert.equal(refs.t2, '© 2026');                                   // старые ссылки работают и без «;»
  assert.equal(refs.t3, '¬it;');                                      // «&not» распознан как ¬ — нужна точка с запятой
  assert.equal(refs.href, '/catalog?sort=price&copy=1&page=2');       // в атрибуте «&copy=» не тронут, «&amp;» раскрыт
  assert.equal(refs.nbsp, 'a0');                                       // неразрывный пробел U+00A0

  // --- «самозакрывающийся» div в HTML не закрывается: слеш игнорируется ---
  assert.equal(await parse('<div/>Улун<span/>990 ₽'), '<div>Улун<span>990 ₽</span></div>');
  assert.equal(await parse('<br/><img src="x.png"/>'), '<br><img src="x.png">'); // у пустых элементов слеш просто лишний
  // а в XML-документе — закрывается, и ошибка разметки ломает разбор целиком
  const xml = await page.evaluate(() => {
    const ok = new DOMParser().parseFromString('<html xmlns="http://www.w3.org/1999/xhtml"><body><div/>Улун</body></html>', 'application/xhtml+xml');
    const bad = new DOMParser().parseFromString('<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Улун</body></html>', 'application/xhtml+xml');
    return { div: ok.querySelector('div').childNodes.length, error: bad.getElementsByTagName('parsererror').length > 0 };
  });
  assert.deepEqual(xml, { div: 0, error: true });
});

console.log('parsing ok');
