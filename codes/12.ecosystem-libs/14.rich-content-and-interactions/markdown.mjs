// Проверки к 12.14: что markdown-библиотеки делают с опасным вводом, как подсвечивают код, загрузка файлов.
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { marked } from 'marked';
import MarkdownIt from 'markdown-it';
import createDOMPurify from 'dompurify';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { codeToHtml } from 'shiki';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';

const input = 'Привет **мир** <img src=x onerror="alert(1)"> [клик](javascript:alert(1)) <script>alert(2)</script>';

// marked: сырой HTML и javascript:-ссылки проходят как есть
const fromMarked = marked.parse(input);
assert.match(fromMarked, /<img src=x onerror="alert\(1\)">/);
assert.match(fromMarked, /<a href="javascript:alert\(1\)">/);
assert.match(fromMarked, /<script>alert\(2\)<\/script>/);

// markdown-it по умолчанию экранирует HTML и не делает javascript:-ссылку
const fromMdIt = new MarkdownIt().render(input);
assert.match(fromMdIt, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
assert.match(fromMdIt, /\[клик\]\(javascript:alert\(1\)\)/);
assert.doesNotMatch(fromMdIt, /<script>/);
// с html: true — пропускает сырой HTML
assert.match(new MarkdownIt({ html: true }).render(input), /<script>alert\(2\)<\/script>/);

// DOMPurify после marked: обработчики, скрипты и javascript: убраны, разметка осталась
const { window } = new JSDOM('');
const DOMPurify = createDOMPurify(window);
const clean = DOMPurify.sanitize(fromMarked);
assert.equal(clean.trim(), '<p>Привет <strong>мир</strong> <img src="x"> <a>клик</a> </p>');

// react-markdown: HTML как текст, javascript:-адрес вычищен
const rm = renderToStaticMarkup(h(Markdown, null, input));
assert.match(rm, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
assert.match(rm, /<a href="">клик<\/a>/);
assert.doesNotMatch(rm, /javascript:/);

// rehype-raw включает HTML — и <script> попадает в серверную разметку
const rmRaw = renderToStaticMarkup(h(Markdown, { rehypePlugins: [rehypeRaw] }, input));
assert.match(rmRaw, /<script>alert\(2\)<\/script>/);
// rehype-sanitize после rehype-raw его убирает
const rmSafe = renderToStaticMarkup(h(Markdown, { rehypePlugins: [rehypeRaw, rehypeSanitize] }, input));
assert.doesNotMatch(rmSafe, /<script>|onerror|javascript:/);
assert.match(rmSafe, /<strong>мир<\/strong>/);

// Shiki: готовый HTML со встроенными цветами — в браузере не нужен ни JS, ни CSS темы
const shiki = await codeToHtml('const a = 1', { lang: 'js', theme: 'github-light' });
assert.match(shiki, /^<pre class="shiki github-light" style="background-color:#fff;color:#24292e"/);
assert.match(shiki, /<span style="color:#D73A49">const<\/span>/);

// highlight.js: классы, цвета — из подключённой CSS-темы
hljs.registerLanguage('javascript', javascript);
assert.equal(hljs.highlight('const a = 1', { language: 'javascript' }).value, '<span class="hljs-keyword">const</span> a = <span class="hljs-number">1</span>');

// загрузка: тип файла — по сигнатуре, а не по имени
const sniff = async (file) => {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const starts = (sig) => sig.every((b, i) => head[i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (starts([0x25, 0x50, 0x44, 0x46])) return 'application/pdf';
  return null;
};
const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])], 'photo.png');
const fake = new File(['<html><script>alert(1)</script></html>'], 'photo.png');
assert.equal(await sniff(png), 'image/png');
assert.equal(await sniff(fake), null);
// File, созданный в коде, не выводит тип из расширения
assert.equal(fake.type, '');

// загрузка частями: 12 МБ кусками по 5 МБ — три запроса, последний 2 МБ
const MB = 1024 * 1024;
const big = new Blob([new Uint8Array(12 * MB)]);
const chunks = [];
for (let offset = 0; offset < big.size; offset += 5 * MB) chunks.push(big.slice(offset, offset + 5 * MB));
assert.deepEqual(chunks.map((c) => c.size / MB), [5, 5, 2]);

// превью без загрузки: blob:-адрес живёт, пока его не отпустили
const url = URL.createObjectURL(png);
assert.match(url, /^blob:/);
URL.revokeObjectURL(url);

console.log('markdown ok');
