// Проверки к 1.02 в Node: типизированные массивы обрезают и заворачивают байты, parseInt и экспоненциальная запись,
// побитовые операции работают с 32-битными целыми, дополнительный код, раскладка double по битам (DataView),
// шаг между соседними double, порядок байтов, UTF-8 и TextEncoder, кракозябры, U+FFFD и fatal,
// BOM, encodeInto не режет символ, нормализация Unicode, Base64 и btoa.
// Запуск: cd codes && node run.mjs 01.computer-science/2.data-representation
import assert from 'node:assert/strict';

// --- байт: 0–255; Uint8Array берёт число по модулю 256, Uint8ClampedArray прижимает к краям ---
assert.deepEqual([...new Uint8Array([256, -1, 300])], [0, 255, 44]);
assert.deepEqual([...new Uint8ClampedArray([256, -1, 300.6])], [255, 0, 255]);
assert.deepEqual([...new Int8Array([127, 128, 255])], [127, -128, -1]);           // дополнительный код

// --- системы счисления ---
assert.equal((255).toString(2), '11111111');
assert.equal((255).toString(16), 'ff');
assert.equal(parseInt('ff', 16), 255);
assert.deepEqual([0b1010, 0o755, 0xff], [10, 493, 255]);
// parseInt сначала превращает аргумент в строку
assert.equal(String(0.0000005), '5e-7');
assert.equal(parseInt(0.0000005), 5);
assert.equal(parseInt('1e3'), 1);
assert.equal(Number('1e3'), 1000);

// --- побитовые операции: операнды приводятся к 32-битному целому со знаком ---
assert.equal((2 ** 31) | 0, -2147483648);
assert.equal((2 ** 32) | 0, 0);
assert.equal(~~3.7, 3);
assert.equal(~~-3.7, -3);
assert.equal(~~2147483648, -2147483648);                                           // «быстрое округление» ломается после 2^31
assert.equal(-1 >>> 0, 4294967295);                                                 // те же 32 единицы как беззнаковое
assert.equal((-1 >>> 0).toString(2), '1'.repeat(32));
assert.equal(1 << 31, -2147483648);
assert.equal(-5 >> 1, -3);                                                          // сдвиг со знаком
assert.equal(-5 >>> 28, 15);                                                        // сдвиг без знака
// флаги в битовой маске
const READ = 1, WRITE = 2, EXEC = 4;
let mode = READ | WRITE;
assert.equal(mode & WRITE, WRITE);
assert.equal(mode & EXEC, 0);
mode &= ~WRITE;
assert.equal(mode, READ);

// --- double по битам: 1 бит знака, 11 бит порядка, 52 бита мантиссы ---
const dv = new DataView(new ArrayBuffer(8));
const hex = (x) => { dv.setFloat64(0, x); return dv.getBigUint64(0).toString(16).padStart(16, '0'); };
assert.equal(hex(1), '3ff0000000000000');
assert.equal(hex(-2), 'c000000000000000');
assert.equal(hex(0.5), '3fe0000000000000');
assert.equal(hex(0.1), '3fb999999999999a');                                         // бесконечная дробь 1001…, округлена вверх
assert.equal(hex(-0), '8000000000000000');                                          // ноль со знаком
assert.equal(hex(Infinity), '7ff0000000000000');
assert.equal(hex(NaN), '7ff8000000000000');
assert.equal(0.1.toFixed(20), '0.10000000000000000555');
const bitsOf = (x) => { dv.setFloat64(0, x); const b = dv.getBigUint64(0); return { sign: Number(b >> 63n), exp: Number((b >> 52n) & 0x7ffn) - 1023 }; };
assert.deepEqual(bitsOf(10), { sign: 0, exp: 3 });                                  // 10 = 1.25 * 2^3
assert.equal(Object.is(-0, 0), false);
assert.equal(1 / -0, -Infinity);
// точные целые — до 2^53: дальше шаг между соседними double равен 2
assert.equal(Number.MAX_SAFE_INTEGER, 2 ** 53 - 1);
assert.equal(2 ** 53 + 1, 2 ** 53);
assert.equal(2 ** 53 + 2, 9007199254740994);
assert.equal(Number.EPSILON, 2 ** -52);                                             // шаг возле единицы
assert.equal(1 + Number.EPSILON / 2, 1);
// float32: 24 бита мантиссы, около 7 десятичных знаков
assert.equal(Math.fround(0.1), 0.10000000149011612);
assert.equal(Math.fround(16777217), 16777216);
assert.equal(new Float32Array([0.1])[0] === 0.1, false);

// --- порядок байтов ---
const one = new Uint32Array([1]);
assert.deepEqual([...new Uint8Array(one.buffer)], [1, 0, 0, 0]);                  // x86 и ARM — little-endian
assert.equal(new DataView(one.buffer).getUint32(0), 16777216);                     // DataView по умолчанию big-endian
assert.equal(new DataView(one.buffer).getUint32(0, true), 1);

// --- текст: кодовые точки и байты UTF-8 ---
const enc = new TextEncoder();
const utf8 = (s) => [...enc.encode(s)].map((b) => b.toString(16));
assert.deepEqual(utf8('A'), ['41']);
assert.deepEqual(utf8('Ж'), ['d0', '96']);
assert.deepEqual(utf8('€'), ['e2', '82', 'ac']);
assert.deepEqual(utf8('𝄞'), ['f0', '9d', '84', '9e']);
assert.equal('𝄞'.codePointAt(0).toString(16), '1d11e');
assert.deepEqual(['A', 'Ж', '€', '𝄞'].map((s) => s.length), [1, 1, 1, 2]);         // единицы UTF-16, не байты
assert.equal('Привет'.length, 6);
assert.equal(enc.encode('Привет').length, 12);

// кракозябры: байты UTF-8 прочитаны как windows-1251
const bytes = enc.encode('Привет');
assert.equal(new TextDecoder('windows-1251').decode(bytes), 'РџСЂРёРІРµС‚');
// обрезали байты посреди символа — U+FFFD, а с fatal: true — ошибка
assert.equal(new TextDecoder().decode(bytes.slice(0, 3)), 'П\uFFFD');
assert.throws(() => new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(0, 3)), { name: 'TypeError' });
// encodeInto пишет только целые символы
const box = new Uint8Array(5);
assert.deepEqual(enc.encodeInto('Привет', box), { read: 2, written: 4 });
assert.equal(new TextDecoder().decode(box.subarray(0, 4)), 'Пр');
// BOM в начале UTF-8 декодер по умолчанию убирает
const withBom = new Uint8Array([0xef, 0xbb, 0xbf, 0x41]);
assert.equal(new TextDecoder().decode(withBom), 'A');
assert.equal(new TextDecoder('utf-8', { ignoreBOM: true }).decode(withBom), '\uFEFFA');

// нормализация: «й» одной кодовой точкой и «и» + знак краткости
const composed = 'й', decomposed = 'и\u0306';
assert.deepEqual([composed.length, decomposed.length], [1, 2]);
assert.equal(composed === decomposed, false);
assert.equal(composed.normalize() === decomposed.normalize(), true);              // NFC по умолчанию
assert.equal(composed.normalize('NFD').length, 2);
assert.deepEqual([enc.encode(composed).length, enc.encode(decomposed).length], [2, 4]);

// --- Base64: 3 байта — 4 символа ---
assert.deepEqual([btoa('abc'), btoa('ab'), btoa('a')], ['YWJj', 'YWI=', 'YQ==']);
assert.throws(() => btoa('Привет'), { name: 'InvalidCharacterError' });
const b64 = Buffer.from(enc.encode('Привет')).toString('base64');
assert.equal(b64, '0J/RgNC40LLQtdGC');
assert.equal(b64.length, 16);                                                       // 12 байт → 16 символов
assert.equal(Buffer.from([251, 255]).toString('base64'), '+/8=');
assert.equal(Buffer.from([251, 255]).toString('base64url'), '-_8');                // для URL и JWT
// atob возвращает «байтовую строку»: символ на байт, без декодирования UTF-8
assert.notEqual(atob(b64), 'Привет');
assert.equal(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))), 'Привет');
const size = (n) => 4 * Math.ceil(n / 3);
assert.equal(size(3_000_000), 4_000_000);                                           // +33%

// --- числа из текста ---
assert.equal(+(64e9 / 2 ** 30).toFixed(1), 59.6);                                   // «64 ГБ» в двоичных единицах
assert.deepEqual([0xff, 0x88, 0x00], [255, 136, 0]);                                  // #ff8800
assert.deepEqual([0o7, 0o5].map((d) => d.toString(2)), ['111', '101']);               // 755 = rwx r-x r-x
assert.equal('й'.codePointAt(0).toString(16), '439');
assert.equal('Ж'.codePointAt(0).toString(16), '416');
assert.equal('Ａ'.normalize('NFKC'), 'A');                                             // полноширинная буква
dv.setBigUint64(0, 0x7ff0000000000001n);
assert.ok(Number.isNaN(dv.getFloat64(0)));                                           // другой NaN: мантисса не пустая
assert.equal(+(1920 * 1080 * 3 * 30 * 60 / 1e9).toFixed(1), 11.2);                   // минута видео без сжатия, ГБ
assert.equal(44100 * 16 * 2, 1411200);                                               // ≈ 1,4 Мбит/с

// --- практика «Что выведет?» ---
assert.deepEqual([~~-3.7, Math.floor(-3.7)], [-3, -4]);
assert.deepEqual([new Uint8Array([300])[0], new Uint8ClampedArray([300])[0]], [44, 255]);

// --- практика «Обрезка до 255 байт» ---
function cutBroken(name, limit = 255) {
  const b = new TextEncoder().encode(name);
  return new TextDecoder().decode(b.slice(0, limit));
}
function cut(name, limit = 255) {
  const buffer = new Uint8Array(limit);
  const { written } = new TextEncoder().encodeInto(name, buffer);
  return new TextDecoder().decode(buffer.subarray(0, written));
}
const long = 'Чай '.repeat(60);                                                         // 240 символов, 420 байт
assert.ok(cutBroken(long).endsWith('\uFFFD'));
assert.ok(!cut(long).includes('\uFFFD'));
assert.ok(enc.encode(cut(long)).length <= 255);
assert.equal(cut('Привет', 5), 'Пр');
assert.equal(enc.encode('я'.repeat(255)).length, 510);

// --- практика «btoa падает на кириллице»: запасной путь через байтовую строку ---
const state = { query: 'улун', sort: 'price' };
assert.throws(() => btoa(JSON.stringify(state)), { name: 'InvalidCharacterError' });
const stateBytes = enc.encode(JSON.stringify(state));
const packed = btoa(String.fromCharCode(...stateBytes));
assert.deepEqual(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(packed), (c) => c.charCodeAt(0)))), state);

console.log('bits ok');
