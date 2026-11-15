// Общая обвязка для Vue-проверок: jsdom + компиляция настоящих SFC (`<script setup>`, макросы, шаблон) + монтирование.
// Подключение: import { sfc, mount, flush, warnings, dom } from '../../_lib/vue.mjs';
// Импортируй этот модуль раньше 'vue': runtime-dom запоминает document при загрузке.
//
// sfc(source)        — компилирует строку .vue (lang="ts" тоже) через vue/compiler-sfc и возвращает компонент;
// mount(comp, opts)  — монтирует в jsdom: { app, container, html(), unmount() }; opts.props, opts.plugins, opts.provide;
// flush()            — дожидается планировщика Vue (nextTick) и микрозадач;
// warnings           — массив предупреждений Vue ([Vue warn]) за время проверки.
import { JSDOM } from 'jsdom';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { transformSync } from 'esbuild';

export const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (/^[A-Z]/.test(key) && !(key in globalThis)) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
}
// события и FormData — из jsdom, иначе dispatchEvent и формы не примут объекты Node.js
for (const key of ['window', 'document', 'navigator', 'location', 'history', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'Event', 'CustomEvent', 'FormData']) {
  Object.defineProperty(globalThis, key, { value: key === 'window' ? dom.window : dom.window[key], configurable: true, writable: true });
}

const vue = await import('vue');
const { parse, compileScript, compileTemplate } = await import('vue/compiler-sfc');

export const warnings = [];
// предупреждения без экземпляра приложения Vue пишет в console.warn — собираем и их
const consoleWarn = console.warn;
console.warn = (...args) => {
  const msg = args.map(String).join(' ');
  if (msg.startsWith('[Vue warn]')) warnings.push(msg.replace(/^\[Vue warn\]: /, ''));
  else consoleWarn(...args);
};
const cacheDir = fileURLToPath(new URL('./.sfc-cache/', import.meta.url));
mkdirSync(cacheDir, { recursive: true });

let counter = 0;
export async function sfc(source, filename = `Comp${++counter}.vue`) {
  const id = createHash('sha1').update(source).digest('hex').slice(0, 8);
  const { descriptor, errors } = parse(source, { filename });
  if (errors.length) throw errors[0];
  let code;
  if (descriptor.script || descriptor.scriptSetup) {
    const script = compileScript(descriptor, { id, inlineTemplate: true, propsDestructure: true });
    code = script.content;
    if (!descriptor.scriptSetup && descriptor.template) {
      const t = compileTemplate({ source: descriptor.template.content, filename, id });
      code = code.replace('export default', 'const __sfc__ =') + '\n' + t.code.replace('export function render', 'function render') + '\n__sfc__.render = render;\nexport default __sfc__;';
    }
  } else {
    const scoped = descriptor.styles.some((s) => s.scoped);
    const t = compileTemplate({ source: descriptor.template.content, filename, id: `data-v-${id}`, scoped });
    code = t.code + '\nexport default { render };';
  }
  const lang = descriptor.scriptSetup?.lang ?? descriptor.script?.lang;
  if (lang === 'ts') code = transformSync(code, { loader: 'ts', format: 'esm' }).code;
  const file = join(cacheDir, `${filename.replace(/\W/g, '_')}-${id}.mjs`);
  writeFileSync(file, code);
  const mod = await import(pathToFileURL(file).href);
  const comp = mod.default;
  // scoped-стили: сборщик (плагин Vite) выставляет компоненту __scopeId, здесь — то же самое
  if (descriptor.styles.some((s) => s.scoped)) comp.__scopeId = `data-v-${id}`;
  comp.__styles = descriptor.styles.map((s) => s.content);
  return comp;
}

export async function mount(component, { props = {}, plugins = [], provide = {}, slots } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = slots ? { render: () => vue.h(component, props, slots) } : null;
  const app = root ? vue.createApp(root) : vue.createApp(component, props);
  app.config.warnHandler = (msg) => warnings.push(msg);
  for (const p of plugins) app.use(...[].concat(p));
  for (const [k, v] of Object.entries(provide)) app.provide(k, v);
  const vm = app.mount(container);
  await flush();
  return { app, vm, container, html: () => container.innerHTML, text: () => container.textContent, unmount: () => app.unmount() };
}

export async function flush() {
  await vue.nextTick();
  await new Promise((r) => setTimeout(r, 0));
  await vue.nextTick();
}

export { vue };
