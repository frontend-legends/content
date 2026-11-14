// flags: --conditions react-server
// Глава 9.18 — Server Components через настоящий Flight-сервер: async-компонент ждёт данные прямо в рендере,
// в payload уходит результат, а не код; useState в серверном окружении нет; клиентский компонент — ссылка на модуль;
// функцию в props клиентскому компоненту передать нельзя, серверную функцию — можно.
// run: node --conditions react-server flight.cjs
const assert = require('node:assert/strict');
const React = require('react');
const { renderToPipeableStream, registerClientReference, registerServerReference } = require('react-server-dom-webpack/server');
const { Writable } = require('node:stream');
const h = React.createElement;

function render(el) {
  return new Promise((resolve) => {
    let out = '';
    const errors = [];
    const sink = new Writable({ write(c, _e, cb) { out += c; cb(); }, final(cb) { cb(); resolve({ out, errors }); } });
    const { pipe } = renderToPipeableStream(el, {}, { onError: (e) => { errors.push(e.message); } });
    pipe(sink);
  });
}

(async () => {
  // в серверном окружении нет хуков состояния и эффектов
  assert.equal(typeof React.useState, 'undefined');
  assert.equal(typeof React.useEffect, 'undefined');

  // async-компонент: данные «из базы» прямо в рендере; секрет не уходит в payload
  const db = { product: async (id) => ({ id, title: 'Чайник', price: 2490, supplierSecret: 'cost=900' }) };
  async function ProductPage({ id }) {
    const p = await db.product(id);
    return h('article', null, h('h1', null, p.title), h('p', null, `${p.price} ₽`));
  }
  const { out } = await render(h(ProductPage, { id: 7 }));
  assert.ok(out.includes('Чайник') && out.includes('2490 ₽'));
  assert.ok(!out.includes('cost=900'));           // в разметку попало только то, что отрендерили
  assert.ok(!out.includes('db.product') && !out.includes('await')); // исходного кода компонента нет
  // в dev в payload есть отладочная информация для DevTools: имя компонента и его props
  assert.ok(out.includes('"name":"ProductPage"') && out.includes('"props":{"id":7}'));
  // в production — только результат
  const prod = require('node:child_process').execFileSync(process.execPath, ['--conditions', 'react-server', '-e', `
    const React = require('react'); const { renderToPipeableStream } = require('react-server-dom-webpack/server');
    async function ProductPage() { return React.createElement('h1', null, 'Чайник'); }
    let s = ''; renderToPipeableStream(React.createElement(ProductPage, { id: 7 })).pipe(new (require('node:stream').Writable)({
      write(c, e, cb) { s += c; cb(); }, final(cb) { process.stdout.write(s); cb(); } }));
  `], { env: { ...process.env, NODE_ENV: 'production' }, cwd: __dirname }).toString();
  assert.equal(prod.trim(), '0:["$","h1",null,{"children":"Чайник"}]');
  console.log('payload:', out.trim().split('\n').slice(-1)[0].slice(0, 120));

  // клиентский компонент — ссылка на модуль, а не код
  const LikeButton = registerClientReference(function LikeButton() { throw new Error('client only'); }, './LikeButton.js', 'default');
  const manifest = { './LikeButton.js#default': { id: './LikeButton.js', chunks: ['like-chunk'], name: 'default' } };
  const withClient = await new Promise((resolve) => {
    let s = '';
    const sink = new Writable({ write(c, _e, cb) { s += c; cb(); }, final(cb) { cb(); resolve(s); } });
    renderToPipeableStream(h('div', null, h(LikeButton, { productId: 7 })), manifest).pipe(sink);
  });
  assert.ok(withClient.includes('./LikeButton.js') && withClient.includes('like-chunk'));
  assert.ok(withClient.includes('"productId":7'));

  // обычную функцию в props клиентскому компоненту передать нельзя
  async function errorsFor(props) {
    return new Promise((resolve) => {
      const errors = [];
      const sink = new Writable({ write(_c, _e, cb) { cb(); }, final(cb) { cb(); resolve(errors); } });
      renderToPipeableStream(h(LikeButton, props), manifest, { onError: (e) => { errors.push(e.message); } }).pipe(sink);
    });
  }
  const handler = await errorsFor({ onLike: () => {} });
  assert.ok(handler[0].startsWith('Event handlers cannot be passed to Client Component props.'));
  const fn = await errorsFor({ formatPrice: (p) => `${p} ₽` });
  assert.ok(fn[0].startsWith('Functions cannot be passed directly to Client Components'));

  // а серверную функцию — можно: уходит ссылка с id, а не тело
  async function likeProduct(id) { return id; }
  registerServerReference(likeProduct, 'actions.js', 'likeProduct');
  const ok = await new Promise((resolve) => {
    let s = ''; const errors = [];
    const sink = new Writable({ write(c, _e, cb) { s += c; cb(); }, final(cb) { cb(); resolve({ s, errors }); } });
    renderToPipeableStream(h(LikeButton, { onLike: likeProduct }), manifest, { onError: (e) => { errors.push(e.message); } }).pipe(sink);
  });
  assert.equal(ok.errors.length, 0);
  assert.ok(ok.s.includes('actions.js#likeProduct'));
  assert.ok(!ok.s.includes('return id'));
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
