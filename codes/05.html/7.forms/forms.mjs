// Проверки к 5.07 в Chromium: кнопка по умолчанию submit, отправка по Enter, клик по label,
// встроенная валидация (pattern целиком, minlength только после ввода, step, number и «e»), setCustomValidity держит ошибку,
// submit() против requestSubmit(), novalidate и formnovalidate, invalid не всплывает,
// что попадает в FormData (name, флажки, disabled, readonly, fieldset disabled, submitter, атрибут form),
// input против change, Content-Type у FormData на настоящем сервере.
// Запуск: cd codes && node run.mjs 05.html/7.forms
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { withPage } from '../../_lib/browser.mjs';

let lastType = null;
const server = createServer((req, res) => {
  lastType = req.headers['content-type'];
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const boundary = /boundary=(.+)$/.exec(lastType ?? '')?.[1];
    const fields = boundary ? [...body.matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)/g)].map((m) => `${m[1]}=${m[2]}`) : [];
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ boundary: Boolean(boundary), fields }));
  });
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

try {
  await withPage(async (page) => {
    await page.goto(base);
    const set = (body) => page.setContent(`<!doctype html><html lang="ru"><body>${body}<script>
      window.__submits = 0;
      document.addEventListener('submit', (e) => { e.preventDefault(); window.__submits++; window.__submitter = e.submitter?.id ?? null; });
    </script></body></html>`);
    const submits = () => page.evaluate(() => window.__submits);

    // --- кнопка без type внутри формы — submit ---
    await set(`<form><input name="promo"><button id="apply">Применить</button><button id="calc" type="button">Пересчитать</button></form>`);
    await page.click('#calc');
    assert.equal(await submits(), 0);
    await page.click('#apply');
    assert.deepEqual([await submits(), await page.evaluate(() => window.__submitter)], [1, 'apply']);

    // --- Enter в поле отправляет форму, если есть кнопка отправки или поле одно ---
    await set(`<form id="f1"><input id="a" name="a"><input name="b"><button>Оформить</button></form>
               <form id="f2"><input id="c" name="c"><input name="d"></form>
               <form id="f3"><input id="e" name="e"></form>`);
    for (const id of ['a', 'c', 'e']) { await page.focus('#' + id); await page.keyboard.press('Enter'); }
    assert.equal(await submits(), 2);                                   // f2 без кнопки и с двумя полями — нет
    // отправителем при Enter становится первая кнопка отправки формы
    await set(`<form><input id="promo" name="promo"><button id="apply2" onclick="window.__applied = true">Применить</button><button id="order2">Оформить</button></form>`);
    await page.focus('#promo');
    await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate(() => [window.__submitter, window.__applied]), ['apply2', true]);

    // --- клик по подписи переключает флажок ---
    await set(`<form><label><input type="checkbox" id="agree" name="agree"> Согласен с условиями</label>
               <label for="gift">Подарочная упаковка</label><input type="checkbox" id="gift" name="gift"></form>`);
    await page.click('text=Согласен с условиями');
    await page.click('text=Подарочная упаковка');
    assert.deepEqual(await page.evaluate(() => [agree.checked, gift.checked]), [true, true]);

    // --- встроенная валидация ---
    await set(`<form>
      <input id="zip" pattern="\\d{6}">
      <input id="email" type="email" required>
      <input id="name" minlength="2">
      <input id="price" type="number" step="0.01" min="0">
      <input id="qty" type="number"></form>`);
    const validity = await page.evaluate(() => {
      const v = (id, value) => { const el = document.getElementById(id); if (value !== undefined) el.value = value; const s = el.validity; return Object.keys(Object.getPrototypeOf(s)).filter((k) => k !== 'valid' && s[k]); };
      return {
        zipLong: v('zip', '1234567'),                              // pattern проверяет значение целиком
        zipOk: v('zip', '123456'),
        emailEmpty: v('email', ''),
        emailBad: v('email', 'чай@'),
        nameScript: v('name', 'Я'),                                // minlength после присваивания кодом не срабатывает
        priceStep: v('price', '9.995'),
        priceMin: v('price', '-1'),
        qtyExp: (() => { const q = document.getElementById('qty'); q.value = '1e3'; return [q.validity.valid, q.valueAsNumber]; })(),
      };
    });
    assert.deepEqual(validity, {
      zipLong: ['patternMismatch'], zipOk: [], emailEmpty: ['valueMissing'], emailBad: ['typeMismatch'],
      nameScript: [], priceStep: ['stepMismatch'], priceMin: ['rangeUnderflow'], qtyExp: [true, 1000],
    });
    await page.fill('#name', '');
    await page.type('#name', 'Я');
    assert.deepEqual(await page.$eval('#name', (i) => [i.validity.tooShort, i.validationMessage.length > 0]), [true, true]); // а после ввода — да

    // --- setCustomValidity держит ошибку, пока её не сбросят ---
    await set(`<form><input id="pass" type="password"><input id="repeat" type="password"></form>`);
    const custom = await page.evaluate(() => {
      const r = document.getElementById('repeat');
      r.value = 'чай1'; document.getElementById('pass').value = 'чай2';
      r.setCustomValidity('Пароли не совпадают');
      const was = [r.validity.customError, r.validationMessage];
      document.getElementById('pass').value = 'чай1';             // пароли совпали
      const still = r.checkValidity();
      r.setCustomValidity('');
      return { was, still, after: r.checkValidity() };
    });
    assert.deepEqual(custom, { was: [true, 'Пароли не совпадают'], still: false, after: true });

    // --- submit() пропускает валидацию и событие; requestSubmit() — как нажатие кнопки ---
    await set(`<form id="f"><input name="phone" required><button id="go">Оформить</button><button id="draft" formnovalidate>Черновик</button></form>`);
    const flows = await page.evaluate(() => {
      const f = document.getElementById('f');
      let invalids = 0, formInvalids = 0;
      f.phone.addEventListener('invalid', () => invalids++);
      f.addEventListener('invalid', () => formInvalids++);           // invalid не всплывает
      f.requestSubmit();
      const afterRequest = window.__submits;
      return { afterRequest, invalids, formInvalids };
    });
    assert.deepEqual(flows, { afterRequest: 0, invalids: 1, formInvalids: 0 }); // невалидно — submit не случился
    await page.click('#draft');
    assert.equal(await page.evaluate(() => [window.__submits, window.__submitter].join()), '1,draft'); // formnovalidate пропустил проверку
    const plain = await page.evaluate(() => new Promise((r) => {
      const f = document.getElementById('f');
      const before = window.__submits;
      f.target = 'sink'; f.action = 'about:blank';
      const sink = document.createElement('iframe'); sink.name = 'sink'; document.body.append(sink);
      f.submit();                                                     // без проверки и без события submit
      r(window.__submits - before);
    }));
    assert.equal(plain, 0);

    // --- что попадает в FormData ---
    await set(`<form id="order">
      <input name="name" value="Анна">
      <input value="без имени">
      <input type="checkbox" name="gift" value="yes">
      <input type="checkbox" name="call" value="yes" checked>
      <input name="city" value="Москва" disabled>
      <input name="promo" value="ЧАЙ10" readonly>
      <fieldset disabled><input name="card" value="4242"></fieldset>
      <select name="tea" multiple><option selected>Улун</option><option selected>Пуэр</option><option>Сенча</option></select>
      <button name="action" value="pay" id="pay">Оплатить</button>
    </form><input name="comment" form="order" value="позвонить за час">`);
    const fd = await page.evaluate(() => {
      const f = document.getElementById('order');
      return {
        plain: [...new FormData(f)].map(([k, v]) => `${k}=${v}`),
        withSubmitter: [...new FormData(f, document.getElementById('pay'))].map(([k, v]) => `${k}=${v}`),
        query: new URLSearchParams(new FormData(f)).toString(),
      };
    });
    assert.deepEqual(fd.plain, ['name=Анна', 'call=yes', 'promo=ЧАЙ10', 'tea=Улун', 'tea=Пуэр', 'comment=позвонить за час']);
    assert.equal(fd.withSubmitter.includes('action=pay'), true);
    assert.equal(fd.query, 'name=%D0%90%D0%BD%D0%BD%D0%B0&call=yes&promo=%D0%A7%D0%90%D0%9910&tea=%D0%A3%D0%BB%D1%83%D0%BD&tea=%D0%9F%D1%83%D1%8D%D1%80&comment=%D0%BF%D0%BE%D0%B7%D0%B2%D0%BE%D0%BD%D0%B8%D1%82%D1%8C+%D0%B7%D0%B0+%D1%87%D0%B0%D1%81');

    // --- input на каждый символ, change — при уходе из поля; у флажка change сразу ---
    await set(`<input id="t"><input type="checkbox" id="cb"><button id="other">x</button>`);
    await page.evaluate(() => {
      window.__ev = [];
      for (const id of ['t', 'cb']) for (const type of ['input', 'change']) document.getElementById(id).addEventListener(type, () => __ev.push(`${id}:${type}`));
    });
    await page.type('#t', 'чай');
    const typed = await page.evaluate(() => [...__ev]);
    await page.click('#other');
    await page.click('#cb');
    const all = await page.evaluate(() => [...__ev]);
    assert.deepEqual(typed, ['t:input', 't:input', 't:input']);
    assert.deepEqual(all.slice(3), ['t:change', 'cb:input', 'cb:change']);

    // --- FormData и fetch: Content-Type с границей ставит браузер; ручной заголовок её теряет ---
    const send = (manual) => page.evaluate(async ([manual, base]) => {
      const fd = new FormData();
      fd.append('name', 'Анна');
      fd.append('tea', 'Улун');
      const r = await fetch(base + '/order', { method: 'POST', body: fd, headers: manual ? { 'Content-Type': 'multipart/form-data' } : {} });
      return r.json();
    }, [manual, base]);
    assert.deepEqual(await send(false), { boundary: true, fields: ['name=Анна', 'tea=Улун'] });
    assert.deepEqual(await send(true), { boundary: false, fields: [] });   // сервер не может разобрать тело
    assert.equal(lastType, 'multipart/form-data');
  });
} finally {
  server.close();
}

console.log('forms ok');
