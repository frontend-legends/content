// Глава 9.14 — History API: pushState меняет URL без перезагрузки и без popstate; popstate — только «назад/вперёд».
// run: node history.cjs
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { window } = new JSDOM('<!doctype html>', { url: 'https://shop.example/' });

(async () => {
  const events = [];
  window.addEventListener('popstate', (e) => events.push(`popstate ${window.location.pathname} ${JSON.stringify(e.state)}`));
  window.history.pushState({ page: 'catalog' }, '', '/catalog');
  window.history.pushState({ page: 'product' }, '', '/product/42');
  assert.equal(window.location.href, 'https://shop.example/product/42');
  assert.deepEqual(events, []); // pushState событие не генерирует
  window.history.back();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(events, ['popstate /catalog {"page":"catalog"}']);
  window.history.replaceState(null, '', '/catalog?sort=price');
  assert.equal(window.history.length, 3); // replace не добавляет запись
  console.log('ok');
})();
