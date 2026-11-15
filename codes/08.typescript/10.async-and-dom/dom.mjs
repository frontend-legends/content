// Глава 8.10 — типы DOM: querySelector, события, currentTarget и target, свои события.
// Типы проверяет tsc в чистом браузерном окружении (lib DOM без типов Node), поведение — jsdom.
// run: node dom.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const tsc = fileURLToPath(new URL('../../node_modules/typescript/bin/tsc', import.meta.url));

const TYPES = String.raw`
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const ok = <T extends true>() => {};

// querySelector: имя тега — точный тип, остальные селекторы — Element
const input = document.querySelector('input');
ok<Equal<typeof input, HTMLInputElement | null>>();
const byId = document.querySelector('#email');
ok<Equal<typeof byId, Element | null>>();
const img = document.querySelector('img');
ok<Equal<typeof img, HTMLImageElement | null>>();
const logo = document.querySelector('img.logo');
ok<Equal<typeof logo, Element | null>>();
const el = document.getElementById('email');
ok<Equal<typeof el, HTMLElement | null>>();
// @ts-expect-error — у Element нет value
byId?.value;
// дженерик — утверждение без проверки
const sel = document.querySelector<HTMLSelectElement>('#email');
ok<Equal<typeof sel, HTMLSelectElement | null>>();
if (byId instanceof HTMLInputElement) byId.value;

// события: тип по имени из карты событий
const button = document.querySelector('button')!;
button.addEventListener('click', (e) => {
  ok<Equal<typeof e, PointerEvent>>();   // click — PointerEvent, наследник MouseEvent
  const current = e.currentTarget;
  const target = e.target;
  ok<Equal<typeof current, EventTarget | null>>();
  ok<Equal<typeof target, EventTarget | null>>();
  // @ts-expect-error — у EventTarget нет disabled
  e.currentTarget?.disabled;
});
button.addEventListener('click', function () { const self = this; ok<Equal<typeof self, HTMLButtonElement>>(); });
input!.addEventListener('keydown', (e) => { ok<Equal<typeof e, KeyboardEvent>>(); });
input!.addEventListener('input', (e) => { ok<Equal<typeof e, InputEvent>>(); });
input!.addEventListener('my-event', (e) => { ok<Equal<typeof e, Event>>(); });

// FormData
const fd = new FormData();
const email = fd.get('email');
ok<Equal<typeof email, FormDataEntryValue | null>>();
ok<Equal<FormDataEntryValue, File | string>>();

// свои события — расширение карты
type CartUpdated = { count: number };
declare global {
  interface DocumentEventMap { 'cart:updated': CustomEvent<CartUpdated> }
}
document.addEventListener('cart:updated', (e) => {
  ok<Equal<typeof e, CustomEvent<CartUpdated>>>();
  e.detail.count;
});

// практика: обработчик поиска
declare function search(q: string): void;
// @ts-expect-error — Object is possibly 'null'
document.querySelector('#search').addEventListener('input', () => {});
document.querySelector('#search')!.addEventListener('input', (e) => {
  // @ts-expect-error — Property 'value' does not exist on type 'EventTarget'
  search(e.target!.value);
});
const searchInput = document.querySelector('#search');
if (!(searchInput instanceof HTMLInputElement)) throw new Error('#search not found');
searchInput.addEventListener('input', () => { search(searchInput.value); });

// dataset
const sku = document.body.dataset.sku;
ok<Equal<typeof sku, string | undefined>>();
export {};
`;
const dir = mkdtempSync(join(tmpdir(), 'ts-dom-'));
writeFileSync(join(dir, 'dom.ts'), TYPES);
const r = spawnSync(process.execPath, [tsc, '--ignoreConfig', '--strict', '--lib', 'es2024,dom,dom.iterable', '--noEmit', join(dir, 'dom.ts')], { encoding: 'utf8' });
assert.equal(r.status, 0, r.stdout + r.stderr);

// --- рантайм
const { window } = new JSDOM(`<form id="checkout"><input id="email" name="email" value="a@b.ru"><button>Купить</button></form><ul><li>Чай</li></ul>`);
const { document } = window;

// дженерик querySelector не проверяет: под видом select пришёл input
const lie = document.querySelector('#email');
assert.equal(lie.tagName, 'INPUT');
assert.equal(lie.options, undefined);

// target — элемент, по которому кликнули; currentTarget — где висит обработчик
const form = document.querySelector('form');
const button = document.querySelector('button');
let target = '', current = '';
form.addEventListener('click', (e) => { target = e.target.tagName; current = e.currentTarget.tagName; });
button.click();
assert.deepEqual([target, current], ['BUTTON', 'FORM']);

// FormData из формы
let email = null;
form.addEventListener('submit', (e) => { e.preventDefault(); email = new window.FormData(e.currentTarget).get('email'); });
form.dispatchEvent(new window.Event('submit', { cancelable: true }));
assert.equal(email, 'a@b.ru');

// своё событие
let count = -1;
document.addEventListener('cart:updated', (e) => { count = e.detail.count; });
document.dispatchEvent(new window.CustomEvent('cart:updated', { detail: { count: 3 } }));
assert.equal(count, 3);

console.log('dom ok');
