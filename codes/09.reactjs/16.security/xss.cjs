// Глава 9.16 — что React экранирует и где защиты нет: текст и атрибуты, javascript:-URL (React 19 блокирует),
// dangerouslySetInnerHTML, spread пользовательских props, состояние в <script> при SSR.
// run: node xss.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { renderToString } = require('react-dom/server');
const createDOMPurify = require('dompurify');
const DOMPurify = createDOMPurify(window);

const evil = '<img src=x onerror="alert(1)">';

(async () => {
  // текст и значения атрибутов экранируются
  assert.equal(renderToString(h('p', null, evil)), '<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>');
  assert.equal(renderToString(h('p', { title: '" onmouseover="alert(1)' })), '<p title="&quot; onmouseover=&quot;alert(1)"></p>');
  const { container } = await mount(h('p', null, evil));
  assert.equal(container.querySelector('img'), null);

  // javascript: в href React 19 подменяет на URL, который бросает ошибку — и на клиенте, и на сервере
  const blocked = "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')";
  const a = await mount(h('a', { href: 'javascript:alert(document.cookie)' }, 'сайт'));
  assert.equal(a.container.querySelector('a').getAttribute('href'), blocked);
  assert.ok(renderToString(h('a', { href: ' JavaScript:alert(1)' })).includes('React has blocked a javascript: URL'));
  // а data: и любые другие схемы — нет
  const d = await mount(h('a', { href: 'data:text/html,<script>alert(1)</script>' }, 'x'));
  assert.equal(d.container.querySelector('a').getAttribute('href'), 'data:text/html,<script>alert(1)</script>');

  // dangerouslySetInnerHTML вставляет как есть; DOMPurify вычищает обработчики
  const raw = await mount(h('div', { dangerouslySetInnerHTML: { __html: evil } }));
  assert.equal(raw.container.querySelector('img').getAttribute('onerror'), 'alert(1)');
  const clean = await mount(h('div', { dangerouslySetInnerHTML: { __html: DOMPurify.sanitize(evil + '<b>жирный</b>') } }));
  assert.equal(clean.container.innerHTML, '<div><img src="x"><b>жирный</b></div>');

  // spread props из пользовательских данных — путь к сырому HTML
  const userProps = JSON.parse('{"className":"bio","dangerouslySetInnerHTML":{"__html":"<img src=x onerror=alert(1)>"}}');
  const spread = await mount(h('div', { ...userProps }));
  assert.equal(spread.container.querySelector('img').getAttribute('onerror'), 'alert(1)');

  // состояние в <script> при SSR: JSON.stringify не экранирует </script>
  const state = { bio: '</script><script>alert(1)</script>' };
  const naive = `<script>window.__STATE__ = ${JSON.stringify(state)}</script>`;
  assert.equal(naive.split('</script>').length - 1, 3); // скрипт закрылся раньше времени
  const safeJson = JSON.stringify(state).replace(/</g, '\\u003c');
  const safe = `<script>window.__STATE__ = ${safeJson}</script>`;
  assert.equal(safe.split('</script>').length - 1, 1);
  assert.deepEqual(JSON.parse(safeJson), state); // данные те же
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
