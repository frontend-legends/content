// Проверки к 17.02 — только защита, без рабочих атак: контекстное экранирование, автоэкранирование React,
// санитизация DOMPurify (убирает script, обработчики событий, javascript:-ссылки), почему санитайзер на
// регулярках недостаточен, проверка протокола ссылки по белому списку, безопасная сериализация состояния для SSR.
// Ничего не исполняется и никуда не отправляется — проверяется, что опасное удалено из строки или DOM.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { withPage } from '../../_lib/browser.mjs';

const payload = '<img src=x onerror=handler()>'; // строка, которую нельзя пускать в HTML как есть; здесь не исполняется

// --- контекстное экранирование: для HTML-тела и для атрибута правила разные ---
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
assert.equal(escapeHtml(payload), '&lt;img src=x onerror=handler()&gt;'); // как текст — угловые скобки обезврежены
// «экранирование» только для тела не экранирует кавычки — в значении атрибута этого мало
const escapeBodyOnly = (s) => String(s).replace(/[<>]/g, (c) => ({ '<': '&lt;', '>': '&gt;' }[c]));
assert.ok(escapeBodyOnly('" onmouseover="x').includes('"'));          // кавычка уцелела — в атрибуте это опасно
assert.ok(!escapeHtml('" onmouseover="x').includes('"'));             // полное экранирование убирает и кавычки
// вывод: экранирование зависит от контекста (тело, атрибут, URL, JS), руками этого не делают

// --- фреймворк экранирует текст по умолчанию ---
const html = renderToStaticMarkup(createElement('div', null, payload));
assert.equal(html, '<div>&lt;img src=x onerror=handler()&gt;</div>'); // React вывел строку как текст, тег не возник
assert.ok(!html.includes('<img'));

// --- санитизация сырого HTML: DOMPurify удаляет опасное, оставляя разметку ---
const { window } = new JSDOM('');
const purify = DOMPurify(window);
assert.equal(purify.sanitize('<b>Отзыв</b><script>steal()</script>'), '<b>Отзыв</b>'); // скрипт вырезан
assert.equal(purify.sanitize('<img src=x onerror=handler()>'), '<img src="x">');         // обработчик события удалён
assert.equal(purify.sanitize('<a href="javascript:run()">клик</a>'), '<a>клик</a>');     // javascript:-ссылка обезврежена
assert.equal(purify.sanitize('<a href="https://ok.example">клик</a>'), '<a href="https://ok.example">клик</a>'); // безопасное сохранено

// --- почему свой санитайзер на регулярках недостаточен ---
const regexStrip = (s) => String(s).replace(/<script[^>]*>.*?<\/script>/gi, '');
assert.ok(regexStrip('<img src=x onerror=handler()>').includes('onerror')); // вырезает только <script>, обработчик остаётся в строке
assert.ok(!purify.sanitize('<img src=x onerror=handler()>').includes('onerror')); // DOMPurify его убирает
// и проверка, что в очищенном DOM нет обработчиков и скриптов
const cleaned = new JSDOM(`<body>${purify.sanitize('<div onclick="x()"><script>y()</script><p>текст</p></div>')}</body>`);
assert.equal(cleaned.window.document.querySelectorAll('script').length, 0);
assert.equal(cleaned.window.document.querySelector('div').getAttribute('onclick'), null);
assert.equal(cleaned.window.document.querySelector('p').textContent, 'текст');

// --- ссылки: экранирование текста не защищает href, нужен белый список протоколов ---
const safeHref = (raw) => {
  let url;
  try { url = new URL(raw, 'https://site.example'); } catch { return '#'; }
  return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : '#';
};
assert.equal(safeHref('javascript:run()'), '#');          // опасная схема отклонена
assert.equal(safeHref('data:text/html,<script>'), '#');   // data: тоже не в списке
assert.equal(safeHref('https://ok.example/page'), 'https://ok.example/page');
assert.equal(safeHref('/catalog'), 'https://site.example/catalog');
assert.equal(safeHref('mailto:hi@ok.example'), 'mailto:hi@ok.example');

// --- SSR: сериализация состояния в страницу так, чтобы данные не закрыли тег раньше времени ---
const state = { note: 'конец</script><b>жирный</b>' };            // строка данных, содержащая закрывающий тег
const unsafe = JSON.stringify(state);
assert.ok(unsafe.includes('</script>'));                          // наивно: HTML-парсер закроет <script> на этой подстроке
const safeJson = JSON.stringify(state).replace(/</g, '\\u003c');  // экранировать < при встраивании в <script>
assert.ok(!safeJson.includes('</script>'));
assert.deepEqual(JSON.parse(safeJson), state);                    // данные после разбора те же — < это тот же символ <

// --- Trusted Types: браузер запрещает присваивать строку в опасный sink, пропуская только проверенное значение ---
const server = createServer((req, res) => {
  res.setHeader('Content-Security-Policy', "require-trusted-types-for 'script'"); // политика на уровне заголовка
  res.setHeader('content-type', 'text/html');
  res.end('<!doctype html><div id="out"></div>');
});
await new Promise((r) => server.listen(0, r));
await withPage(async (page) => {
  await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'load' });
  const result = await page.evaluate(() => {
    const out = {};
    try { document.getElementById('out').innerHTML = '<b>строка</b>'; out.plain = 'разрешено'; } catch (e) { out.plain = e.name; }
    const policy = trustedTypes.createPolicy('sanitize', { createHTML: (s) => s.replace(/<script.*?<\/script>/gi, '') });
    try { document.getElementById('out').innerHTML = policy.createHTML('<b>очищено</b>'); out.viaPolicy = 'разрешено'; } catch (e) { out.viaPolicy = e.name; }
    return out;
  });
  assert.equal(result.plain, 'TypeError');   // присвоить сырую строку в innerHTML нельзя — DOM-XSS закрыт на корню
  assert.equal(result.viaPolicy, 'разрешено'); // только значение, прошедшее через политику, принимается
});
server.close();

console.log('escaping ok');
