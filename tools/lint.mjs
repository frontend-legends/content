// Проверка глав по стандарту CONTENT.md. Детерминированная: то, что можно проверить без чтения смысла.
//
//   node tools/lint.mjs                         — все главы, прошедшие стандарт (есть `reviewed` во frontmatter)
//   node tools/lint.mjs 07.javascript/2.types   — конкретные файлы (подстрока пути), строго, даже без `reviewed`
//   node tools/lint.mjs --report                — сводка по всей книге: сколько ошибок осталось у старых глав
//   node tools/lint.mjs --json <фильтр>         — то же в JSON (для воркфлоу)
//
// Код выхода 1, если есть ошибки (error). Предупреждения (warn) не валят проверку.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMdc from 'remark-mdc';
import { visit, SKIP } from 'unist-util-visit';
import YAML from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const REPORT = args.includes('--report');
const JSON_OUT = args.includes('--json');
const filters = args.filter((a) => !a.startsWith('--'));

// ---------- правила стандарта ----------
const COMPONENTS = {
  tldr: [],
  question: ['answer', 'more', 'followups'],
  practice: ['solution'],
  pitfall: ['symptom', 'cause', 'fix'],
};
const INLINE_COMPONENTS = ['term'];
const TAIL_FULL = ['Красные флаги в ответе', 'Как спрашивают на собеседовании', 'Практика', 'Полезные ссылки'];
const TAIL_LIGHT = ['Полезные ссылки'];
const LANGS = new Set([
  'js', 'ts', 'jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'json', 'jsonc', 'yaml', 'text', 'sh', 'bash', 'diff',
  'graphql', 'sql', 'md', 'markdown', 'java', 'c', 'go', 'py', 'rust', 'xml', 'wasm', 'http', 'dockerfile', 'toml', 'idl', 'bnf',
]);
const RUNNABLE = new Set(['js', 'ts', 'jsx', 'tsx', 'vue']);
// главы со своим шаблоном: 02 — темы-категории задач (раздел «Задачи», см. CONTENT.md; заглушки без reviewed
// пропускаются), 18 и 20 — карьера, облегчённый шаблон
const SKIP_CHAPTERS = ['02.'];
const TAIL_ALGO = ['Красные флаги в ответе', 'Как спрашивают на собеседовании', 'Полезные ссылки'];
const LIGHT_CHAPTERS = ['18.', '20.'];
const WORDS = { min: 900, max: 4000 };

// ---------- книга: какие адреса существуют ----------
function* walkMd(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || ['node_modules', 'codes', 'tools'].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walkMd(p);
    else if (e.name.endsWith('.md') && dir !== ROOT) yield p;
  }
}
const strip = (s) => s.replace(/^\d+\./, '').replace(/\.md$/, '');
const urlOf = (file) => {
  const rel = relative(ROOT, file).split('/');
  const chapter = strip(rel[0]);
  const story = strip(rel[1]);
  return story === 'index' ? `/content/${chapter}` : `/content/${chapter}/${story}`;
};
const files = [...walkMd(ROOT)].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
const URLS = new Set(files.map(urlOf));
URLS.add('/');

// ---------- разбор ----------
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMdc);
function parse(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  const fm = m ? YAML.parse(m[1]) ?? {} : null;
  const offset = m ? m[0].split('\n').length - 1 : 0;
  const body = m ? src.slice(m[0].length) : src;
  const tree = parser.runSync(parser.parse(body));
  return { fm, tree, offset, body };
}
const textOf = (n) => (n.type === 'text' || n.type === 'inlineCode' ? n.value : (n.children ?? []).map(textOf).join(''));

function lint(file) {
  const rel = relative(ROOT, file);
  const out = [];
  const src = readFileSync(file, 'utf8');
  const { fm, tree, offset } = parse(src);
  const line = (n) => (n?.position ? n.position.start.line + offset : 0);
  const err = (msg, n) => out.push({ level: 'error', line: line(n), msg });
  const warn = (msg, n) => out.push({ level: 'warn', line: line(n), msg });

  const isIndex = basename(file).startsWith('0.index');
  const light = LIGHT_CHAPTERS.some((c) => rel.startsWith(c));
  const algo = rel.startsWith('02.') && /^## Задачи$/m.test(src);

  // frontmatter
  if (!fm) err('нет frontmatter');
  else {
    if (!fm.title || typeof fm.title !== 'string') err('frontmatter: нет title');
    else if (/[а-яё]/i.test(fm.title)) err(`frontmatter: title на английском, а не «${fm.title}»`);
    if (typeof fm.order !== 'number') err('frontmatter: order должен быть числом');
    else if (isIndex !== Number.isInteger(fm.order)) err(`frontmatter: order ${fm.order} — у страницы главы целое, у темы дробное`);
    for (const k of ['date', 'reviewed']) {
      if (fm[k] === undefined) { if (k === 'date') err('frontmatter: нет date'); continue; }
      const v = fm[k] instanceof Date ? fm[k].toISOString().slice(0, 10) : String(fm[k]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) err(`frontmatter: ${k} в формате ГГГГ-ММ-ДД, а не «${v}»`);
    }
    const allowed = ['title', 'description', 'author', 'date', 'reviewed', 'tags', 'image', 'order'];
    for (const k of Object.keys(fm)) if (!allowed.includes(k)) err(`frontmatter: неизвестное поле ${k}`);
  }

  // заголовки и корневая структура
  const root = tree.children;
  const h1 = root.filter((n) => n.type === 'heading' && n.depth === 1);
  if (h1.length !== 1) err(`нужен ровно один заголовок # (сейчас ${h1.length})`, h1[1]);
  const h2 = root.filter((n) => n.type === 'heading' && n.depth === 2);
  // h2 внутри компонента = компонент не закрыт (или заголовок не на своём месте)
  visit(tree, 'heading', (n, _i, parent) => {
    if (n.depth <= 2 && parent && parent.type !== 'root') err(`заголовок «${textOf(n)}» оказался внутри ::${parent.name ?? parent.type} — блок не закрыт \`::\`?`, n);
  });

  // запрещённое в тексте: HTML, эмодзи, дефис вместо тире, неизвестные компоненты
  visit(tree, (n, _i, parent) => {
    if (n.type === 'code') {
      if (!n.lang) err('блок кода без языка (для вывода и схем — ```text)', n);
      else if (!LANGS.has(n.lang)) warn(`необычный язык блока кода: ${n.lang}`, n);
      return SKIP;
    }
    if (n.type === 'inlineCode') return SKIP;
    if (n.type === 'html') { err(`HTML в markdown: ${n.value.trim().slice(0, 60)}`, n); return; }
    if (n.type === 'containerComponent' || n.type === 'leafComponent') {
      if (!(n.name in COMPONENTS)) err(`неизвестный компонент ::${n.name} (разрешены: ${Object.keys(COMPONENTS).join(', ')})`, n);
    }
    if (n.type === 'textComponent' && !INLINE_COMPONENTS.includes(n.name)) err(`неизвестный инлайн-компонент :${n.name}`, n);
    if (n.type === 'componentContainerSection' && parent?.name in COMPONENTS) {
      if (!COMPONENTS[parent.name].includes(n.name)) err(`у ::${parent.name} нет слота #${n.name} (есть: ${COMPONENTS[parent.name].join(', ') || 'нет слотов'})`, n);
    }
    if (n.type === 'text' && /\b(mid\+?|senior|junior)\b/i.test(n.value)) {
      err(`деление по уровням в тексте («${n.value.match(/\b(mid\+?|senior|junior)\b/i)[0]}»): книга — справочник для всех уровней`, n);
    }
    if (n.type === 'text') {
      if (/\p{Emoji_Presentation}|️/u.test(n.value)) err(`эмодзи в тексте: «${n.value.trim().slice(0, 40)}»`, n);
      if (/(^|[^\s-])\s-\s/.test(n.value) || /\s--\s/.test(n.value)) err(`дефис вместо тире « — »: «${n.value.trim().slice(0, 60)}»`, n);
    }
  });

  // ссылки
  visit(tree, 'link', (n) => {
    const u = n.url;
    if (u.startsWith('/')) {
      const path = u.split('#')[0].replace(/\/$/, '') || '/';
      if (!URLS.has(path)) err(`внутренняя ссылка ведёт в никуда: ${u}`, n);
    } else if (/^https?:\/\//.test(u)) {
      if (/^http:\/\//.test(u)) warn(`ссылка по http, не https: ${u}`, n);
    } else if (!u.startsWith('#') && !u.startsWith('mailto:')) err(`странная ссылка: ${u}`, n);
  });

  // термины
  const terms = new Map();
  visit(tree, 'textComponent', (n) => {
    if (n.name !== 'term') return;
    const t = textOf(n).trim();
    const def = n.attributes?.def;
    if (!def) err(`:term[${t}] без def`, n);
    else if (def.length > 160) warn(`:term[${t}] — определение длиннее 160 символов, это уже не тултип`, n);
    if (terms.has(t.toLowerCase())) warn(`:term[${t}] размечен второй раз — нужен только на первом упоминании`, n);
    terms.set(t.toLowerCase(), true);
  });

  if (isIndex) return out; // у страниц глав свой, короткий формат: только общие проверки выше

  // ---------- тема ----------
  const comps = (name) => root.filter((n) => n.type === 'containerComponent' && n.name === name);
  const slots = (n) => (n.children ?? []).filter((c) => c.type === 'componentContainerSection').map((c) => c.name);

  // вводный абзац и TL;DR
  const h1i = root.indexOf(h1[0]);
  const tldr = comps('tldr');
  if (tldr.length !== 1) err(`нужен ровно один ::tldr (сейчас ${tldr.length})`, tldr[1]);
  else {
    const ti = root.indexOf(tldr[0]);
    if (!root.slice(h1i + 1, ti).some((n) => n.type === 'paragraph')) err('нет вводного абзаца между # и ::tldr', tldr[0]);
    if (h2.length && root.indexOf(h2[0]) < ti) err('::tldr должен стоять до первого раздела ##', tldr[0]);
    const items = [];
    visit(tldr[0], 'listItem', (li) => { items.push(li); return SKIP; });
    if (items.length < 3 || items.length > 6) err(`в ::tldr ${items.length} пунктов, нужно 4–5`, tldr[0]);
    else if (items.length !== 4 && items.length !== 5) warn(`в ::tldr ${items.length} пунктов, стандарт — 4–5`, tldr[0]);
    const t = textOf(tldr[0]);
    if (/\bES20\d\d\b|\b(React|Vue|Node(\.js)?|TypeScript|Chrome|Safari|Firefox|V8)\s+v?\d+/.test(t)) warn('в ::tldr номер версии — им место в таблице эволюции', tldr[0]);
  }

  // хвост главы
  const titles = h2.map((n) => textOf(n).trim());
  const tail = algo ? TAIL_ALGO : light ? TAIL_LIGHT : TAIL_FULL;
  const optionalLight = ['Красные флаги в ответе', 'Как спрашивают на собеседовании', 'Практика'];
  const narrative = titles.filter((t) => !tail.includes(t) && !(light && optionalLight.includes(t)));
  const tailSeen = titles.filter((t) => tail.includes(t));
  if (tailSeen.join('|') !== tail.join('|')) err(`разделы в конце: ${tail.join(' → ')} (сейчас: ${tailSeen.join(' → ') || 'нет'})`);
  else {
    const firstTail = titles.indexOf(tail[0]);
    const after = titles.slice(firstTail).filter((t) => !tail.includes(t) && !(light && optionalLight.includes(t)));
    if (after.length) err(`после «${tail[0]}» идут разделы рассказа: ${after.join(', ')}`);
  }
  if (narrative.length < 2) err(`в рассказе ${narrative.length} раздел(а) ##, нужно хотя бы 2`);

  // вопросы
  const qs = comps('question');
  if (algo && (qs.length < 3 || qs.length > 5)) err(`вопросов ::question ${qs.length}, в теме главы 02 нужно 3–5`);
  else if (!algo && !light && (qs.length < 5 || qs.length > 7)) err(`вопросов ::question ${qs.length}, нужно 5–7`);
  for (const q of qs) {
    if (q.attributes?.level) err('::question без level: книга не делит ответы по уровням', q);
    if (!slots(q).includes('answer')) err('::question без #answer', q);
  }
  const qHeading = h2.find((n) => textOf(n).trim() === 'Как спрашивают на собеседовании');
  for (const q of qs) if (qHeading && root.indexOf(q) < root.indexOf(qHeading)) err('::question вне раздела «Как спрашивают на собеседовании»', q);

  // практика
  const ps = comps('practice');
  if (algo && ps.length < 1) err('в теме главы 02 нет задач ::practice');
  else if (!algo && !light && (ps.length < 2 || ps.length > 3)) err(`задач ::practice ${ps.length}, нужно 2–3`);
  for (const p of ps) {
    if (!p.attributes?.title) err('::practice без title', p);
    const sol = (p.children ?? []).find((c) => c.type === 'componentContainerSection' && c.name === 'solution');
    if (!sol) err('::practice без #solution', p);
    else {
      let code = false;
      visit(sol, 'code', () => { code = true; });
      if (!code && !light) warn(`решение «${p.attributes?.title}» без кода — решения пишутся с кодом`, p);
    }
  }
  for (const p of comps('pitfall')) {
    if (!p.attributes?.title) err('::pitfall без title', p);
    for (const s of COMPONENTS.pitfall) if (!slots(p).includes(s)) err(`::pitfall без #${s}`, p);
  }

  // объём рассказа: от TL;DR до первого раздела хвоста
  const start = tldr[0] ? root.indexOf(tldr[0]) + 1 : h1i + 1;
  const endHeading = h2.find((n) => tail.includes(textOf(n).trim()) || (light && optionalLight.includes(textOf(n).trim())));
  const end = endHeading ? root.indexOf(endHeading) : root.length;
  const words = root.slice(start, end).filter((n) => n.type !== 'code').map(textOf).join(' ').split(/\s+/).filter(Boolean).length;
  if (words < WORDS.min && !algo) warn(`рассказ — ${words} слов, это мало для темы (ориентир ${WORDS.min}–${WORDS.max})`);
  if (words > WORDS.max) warn(`рассказ — ${words} слов, это много (ориентир ${WORDS.min}–${WORDS.max}): что можно отдать соседним темам?`);

  // проверочный код
  let runnable = 0;
  visit(tree, 'code', (n) => { if (RUNNABLE.has(n.lang)) runnable++; });
  const codesDir = join(ROOT, 'codes', rel.replace(/\.md$/, ''));
  const hasCodes = existsSync(codesDir) && statSync(codesDir).isDirectory() && readdirSync(codesDir).length > 0;
  if (!light && runnable >= 3 && !hasCodes) err(`в теме ${runnable} блоков кода, а папки codes/${relative(join(ROOT, 'codes'), codesDir)}/ нет`);

  return out;
}

// ---------- запуск ----------
const reviewed = (f) => /^reviewed:/m.test(readFileSync(f, 'utf8').split('\n---')[0]);
const selected = files.filter((f) => {
  const rel = relative(ROOT, f);
  if (filters.length) return filters.some((x) => rel.includes(x));
  if (SKIP_CHAPTERS.some((c) => rel.startsWith(c)) && !reviewed(f)) return false;
  return REPORT || reviewed(f);
});

const results = selected.map((f) => ({ file: relative(ROOT, f), problems: lint(f) }));
const errors = results.reduce((s, r) => s + r.problems.filter((p) => p.level === 'error').length, 0);
const warns = results.reduce((s, r) => s + r.problems.filter((p) => p.level === 'warn').length, 0);

if (JSON_OUT) console.log(JSON.stringify({ errors, warns, results }, null, 2));
else if (REPORT) {
  const rows = results.map((r) => [r.file, r.problems.filter((p) => p.level === 'error').length, r.problems.filter((p) => p.level === 'warn').length]);
  for (const [f, e, w] of rows) console.log(`${e ? '✗' : '✓'} ${String(e).padStart(4)} err ${String(w).padStart(3)} warn  ${f}`);
  console.log(`\n${rows.filter((r) => !r[1]).length}/${rows.length} без ошибок · ${errors} ошибок · ${warns} предупреждений`);
} else {
  for (const r of results) {
    if (!r.problems.length) { console.log(`✓ ${r.file}`); continue; }
    console.log(`${r.problems.some((p) => p.level === 'error') ? '✗' : '!'} ${r.file}`);
    for (const p of r.problems.sort((a, b) => a.line - b.line)) console.log(`  ${p.level === 'error' ? 'error' : 'warn '} ${p.line ? `:${p.line}`.padEnd(6) : '      '}${p.msg}`);
  }
  console.log(`\n${results.length} файл(ов) · ${errors} ошибок · ${warns} предупреждений`);
}
process.exit(errors ? 1 : 0);
