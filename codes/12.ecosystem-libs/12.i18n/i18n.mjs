// Проверки к 12.12 «Интернационализация»: ICU, i18next, vue-i18n, ленивые переводы, SSR, RTL.
import assert from 'node:assert/strict';
import { IntlMessageFormat } from 'intl-messageformat';
import i18next from 'i18next';
import { createI18n } from 'vue-i18n';
import { cost } from '../../_lib/project.mjs';

const NBSP = ' ';

// ICU MessageFormat: формы выбирает CLDR, `#` форматируется по локали
const items = new IntlMessageFormat('{count, plural, one {# товар} few {# товара} many {# товаров} other {# товара}}', 'ru');
assert.equal(items.format({ count: 1 }), '1 товар');
assert.equal(items.format({ count: 3 }), '3 товара');
assert.equal(items.format({ count: 11 }), '11 товаров');
assert.equal(items.format({ count: 21 }), '21 товар');
assert.equal(items.format({ count: 1.5 }), '1,5 товара');
assert.equal(items.format({ count: 1000 }), `1${NBSP}000 товаров`);

// без other сообщение не компилируется
assert.throws(() => new IntlMessageFormat('{n, plural, one {#} few {#} many {#}}', 'ru'), /MISSING_OTHER_CLAUSE/);

// select и вложенный plural
const added = new IntlMessageFormat(
  '{gender, select, female {{name} добавила} male {{name} добавил} other {{name} добавили}} {count, plural, one {# товар} few {# товара} many {# товаров} other {# товара}}',
  'ru',
);
assert.equal(added.format({ gender: 'female', name: 'Аня', count: 2 }), 'Аня добавила 2 товара');
assert.equal(added.format({ gender: 'male', name: 'Петя', count: 5 }), 'Петя добавил 5 товаров');
assert.equal(added.format({ gender: 'other', name: 'Саша', count: 21 }), 'Саша добавили 21 товар');

// числа и даты внутри сообщения
const total = new IntlMessageFormat('Итого: {sum, number, ::currency/RUB}', 'ru');
assert.equal(total.format({ sum: 1234.5 }), `Итого: 1${NBSP}234,50${NBSP}₽`);

// i18next: формы — суффиксы ключа, выбирает Intl.PluralRules
const i = i18next.createInstance();
await i.init({
  lng: 'ru',
  fallbackLng: 'en',
  resources: {
    ru: { translation: {
      item_one: '{{count}} товар', item_few: '{{count}} товара', item_many: '{{count}} товаров', item_other: '{{count}} товара',
      price_one: '{{count, number}} товар', price_few: '{{count, number}} товара', price_many: '{{count, number}} товаров', price_other: '{{count, number}} товара',
    } },
    en: { translation: { hello: 'Hello' } },
  },
});
assert.deepEqual([1, 3, 11, 21].map((count) => i.t('item', { count })), ['1 товар', '3 товара', '11 товаров', '21 товар']);
// число подставляется как есть, без форматтера — с точкой
assert.equal(i.t('item', { count: 1.5 }), '1.5 товара');
assert.equal(i.t('price', { count: 1.5 }), '1,5 товара');
// нет ключа в ru — берётся fallbackLng, нет нигде — сам ключ
assert.equal(i.t('hello'), 'Hello');
assert.equal(i.t('cart.title'), 'cart.title');

// i18next: род через context и суффиксы
const ctx = i18next.createInstance();
await ctx.init({ lng: 'ru', resources: { ru: { translation: {
  added_female_one: '{{name}} добавила {{count}} товар', added_female_few: '{{name}} добавила {{count}} товара',
  added_male_many: '{{name}} добавил {{count}} товаров',
} } } });
assert.equal(ctx.t('added', { context: 'female', name: 'Аня', count: 2 }), 'Аня добавила 2 товара');
assert.equal(ctx.t('added', { context: 'male', name: 'Петя', count: 5 }), 'Петя добавил 5 товаров');

// в арабском шесть категорий, в английском две
const categories = (lng) => new Intl.PluralRules(lng).resolvedOptions().pluralCategories.length;
assert.equal(categories('ar'), 6);
assert.equal(categories('en'), 2);
assert.equal(categories('ru'), 4);

// vue-i18n: свой формат «форма | форма | форма», правило по умолчанию не русское
const messages = { ru: { item: '{n} товар | {n} товара | {n} товаров' } };
const naive = createI18n({ legacy: false, locale: 'ru', messages });
assert.deepEqual([1, 2, 5, 21].map((n) => naive.global.t('item', n)), ['1 товара', '2 товаров', '5 товаров', '21 товаров']);

const ruRule = new Intl.PluralRules('ru');
const index = { one: 0, few: 1, many: 2, other: 1 };
const fixed = createI18n({ legacy: false, locale: 'ru', messages, pluralRules: { ru: (n) => index[ruRule.select(n)] } });
assert.deepEqual([1, 2, 5, 11, 21].map((n) => fixed.global.t('item', n)), ['1 товар', '2 товара', '5 товаров', '11 товаров', '21 товар']);

// ленивые неймспейсы: перевод раздела грузится, только когда он нужен
const loaded = [];
const lazy = i18next.createInstance();
await lazy
  .use({
    type: 'backend',
    read(lng, ns, cb) {
      loaded.push(`${lng}/${ns}`);
      const files = { 'ru/common': { save: 'Сохранить' }, 'ru/checkout': { pay: 'Оплатить' } };
      setTimeout(() => cb(null, files[`${lng}/${ns}`] ?? {}), 5);
    },
  })
  .init({ lng: 'ru', fallbackLng: false, ns: ['common'], defaultNS: 'common' });
assert.deepEqual(loaded, ['ru/common']);
assert.equal(lazy.t('save'), 'Сохранить');
assert.equal(lazy.t('pay', { ns: 'checkout' }), 'pay');
await lazy.loadNamespaces('checkout');
assert.deepEqual(loaded, ['ru/common', 'ru/checkout']);
assert.equal(lazy.t('pay', { ns: 'checkout' }), 'Оплатить');

// выбор локали по Accept-Language
function negotiate(header, supported, fallback) {
  const wanted = header.split(',').map((part) => {
    const [tag, q = 'q=1'] = part.trim().split(';');
    return { tag: tag.toLowerCase(), q: Number(q.split('=')[1]) };
  }).sort((a, b) => b.q - a.q);
  for (const { tag } of wanted) {
    const hit = supported.find((s) => s === tag || s === tag.split('-')[0]);
    if (hit) return hit;
  }
  return fallback;
}
assert.equal(negotiate('uk-UA,uk;q=0.9,ru;q=0.8,en;q=0.7', ['ru', 'en'], 'en'), 'ru');
assert.equal(negotiate('en-GB,en;q=0.9', ['ru', 'en'], 'ru'), 'en');
assert.equal(negotiate('de', ['ru', 'en'], 'en'), 'en');

// SSR: сервер в UTC и браузер в Москве форматируют один момент по-разному — hydration mismatch
const moment = new Date('2026-11-15T22:30:00Z');
const at = (timeZone) => new Intl.DateTimeFormat('ru', { dateStyle: 'short', timeStyle: 'short', timeZone }).format(moment);
assert.equal(at('UTC'), '15.11.2026, 22:30');
assert.equal(at('Europe/Moscow'), '16.11.2026, 01:30');

// направление текста знает Intl.Locale
assert.equal(new Intl.Locale('ar').getTextInfo().direction, 'rtl');
assert.equal(new Intl.Locale('he').getTextInfo().direction, 'rtl');
assert.equal(new Intl.Locale('ru').getTextInfo().direction, 'ltr');

// вес рантайма
const icu = await cost(`import { IntlMessageFormat } from 'intl-messageformat'; console.log(IntlMessageFormat);`);
const next = await cost(`import i18next from 'i18next'; console.log(i18next);`);
console.log(`  intl-messageformat ${(icu.gzip / 1024).toFixed(1)} KB gzip, i18next ${(next.gzip / 1024).toFixed(1)} KB gzip`);
assert.ok(icu.gzip > 5_000 && next.gzip > 5_000);

console.log('i18n ok');
