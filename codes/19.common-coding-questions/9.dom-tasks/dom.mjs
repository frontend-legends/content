// Проверки к 19.09 в Chromium: код из текста (TypeScript, типы убирает esbuild) против нативных API.
// Делегирование: клик во вложенный элемент, динамические элементы, проверка parent.contains, отписка,
// невсплывающий focus (capture и focusin). Свой getElementsByClassName и querySelector сверены с нативными:
// исходные версии включали в результат сам root и не понимали несколько классов. DFS совпадает с
// TreeWalker, BFS по уровням.
import assert from 'node:assert/strict';
import { transformSync } from 'esbuild';
import { withPage } from '../../_lib/browser.mjs';

const impl = `
function delegate(
  parent: HTMLElement,
  eventType: string,
  selector: string,
  handler: (event: Event, target: Element) => void,
  options?: boolean | AddEventListenerOptions,
) {
  const listener = (event: Event) => {
    const target = (event.target as Element).closest?.(selector); // ближайший подходящий вверх от точки события
    if (target && parent.contains(target)) handler(event, target);  // и только внутри parent
  };
  parent.addEventListener(eventType, listener, options);
  return () => parent.removeEventListener(eventType, listener, options);
}

function getElementsByClassName(root: Element, classNames: string): Element[] {
  const wanted = classNames.trim().split(/\\s+/).filter(Boolean);
  const result: Element[] = [];
  function traverse(node: Element) {
    for (const child of node.children) {                  // только потомки, сам root не входит
      if (wanted.length && wanted.every((c) => child.classList.contains(c))) result.push(child);
      traverse(child);
    }
  }
  traverse(root);
  return result;
}

function querySelectorAllByTag(root: Element, tag: string): Element[] {
  const result: Element[] = [];
  const name = tag.toUpperCase();
  function walk(node: Element) {
    for (const child of node.children) {
      if (child.tagName === name) result.push(child);
      walk(child);
    }
  }
  walk(root);
  return result;
}

function dfs(root: Element): Element[] {
  const out: Element[] = [];
  (function visit(node: Element) { out.push(node); for (const child of node.children) visit(child); })(root);
  return out;
}

function bfs(root: Element): Element[] {
  const queue: Element[] = [root];
  for (let i = 0; i < queue.length; i++) queue.push(...queue[i].children); // указатель вместо shift — O(n)
  return queue;
}

function maxDepth(node: Element): number {
  if (node.children.length === 0) return 1;
  return 1 + Math.max(...[...node.children].map(maxDepth));
}
`;
const js = transformSync(impl, { loader: 'ts' }).code;

await withPage(async (page) => {
  await page.setContent(`<!doctype html><html lang=ru><body>
    <ul id="list"><li><span id="s1">чай</span></li><li>кофе</li></ul>
    <ul id="outerList"><li class="row" id="row"><div id="panel"><button id="inner">кнопка</button></div></li></ul>
    <form id="form"><input id="email"><input id="name"></form>
    <div id="tree" class="card"><div class="card a"><p class="a b">1</p><p class="b">2</p></div><section><p class="a b">3</p><i>4</i></section></div>
  </body></html>`);
  await page.addScriptTag({ content: js });

  // --- делегирование: клик по span внутри li, и li, добавленный позже ---
  const clicks = await page.evaluate(async () => {
    const got = [];
    const stop = delegate(document.getElementById('list'), 'click', 'li', (e, li) => got.push(li.textContent));
    document.getElementById('s1').click();                              // клик попал во вложенный span
    const li = document.createElement('li'); li.textContent = 'какао';
    document.getElementById('list').append(li);
    li.click();                                                         // новый элемент — без новых обработчиков
    document.getElementById('list').click();                            // клик мимо li — handler не зовётся
    stop();
    li.click();                                                         // после отписки тихо
    return got;
  });
  assert.deepEqual(clicks, ['чай', 'какао']);
  // matches по event.target промахивается: целью клика был вложенный span, а не li
  const viaMatches = await page.evaluate(() => {
    const got = [];
    document.getElementById('list').addEventListener('click', (e) => { if (e.target.matches('li')) got.push(e.target.textContent); });
    document.getElementById('s1').click();
    return got;
  });
  assert.deepEqual(viaMatches, []);

  // --- зачем parent.contains: closest может найти предка самого parent ---
  const containsCase = await page.evaluate(() => {
    const panel = document.getElementById('panel');
    const withCheck = [], withoutCheck = [];
    delegate(panel, 'click', '.row', (e, t) => withCheck.push(t.id));
    panel.addEventListener('click', (e) => { const t = e.target.closest('.row'); if (t) withoutCheck.push(t.id); });
    document.getElementById('inner').click();
    return { withCheck, withoutCheck };
  });
  assert.deepEqual(containsCase, { withCheck: [], withoutCheck: ['row'] }); // без проверки сработал на элементе вне panel

  // --- focus не всплывает: делегирование через capture или focusin ---
  await page.evaluate(() => {
    window.focusLog = { bubble: 0, capture: 0, focusin: 0 };
    const form = document.getElementById('form');
    delegate(form, 'focus', 'input', () => window.focusLog.bubble++);
    delegate(form, 'focus', 'input', () => window.focusLog.capture++, true);
    delegate(form, 'focusin', 'input', () => window.focusLog.focusin++);
  });
  await page.focus('#email');
  await page.focus('#name');
  assert.deepEqual(await page.evaluate(() => window.focusLog), { bubble: 0, capture: 2, focusin: 2 });
  assert.deepEqual(await page.evaluate(() => [new FocusEvent('focus').bubbles, new FocusEvent('focusin', { bubbles: true }).bubbles]), [false, true]);
  const real = await page.evaluate(() => new Promise((r) => { const f = document.getElementById('email'); f.addEventListener('focus', (e) => r(e.bubbles), { once: true }); f.blur(); f.focus(); }));
  assert.equal(real, false);                                            // у настоящего focus bubbles === false

  // --- свой getElementsByClassName против нативного ---
  const byClass = await page.evaluate(() => {
    const tree = document.getElementById('tree');
    const ids = (els) => els.map((e) => e.textContent.trim() || e.className);
    // исходная версия из текста: проверяла и сам root, и только один класс
    const original = (root, className) => { const r = []; (function t(n) { if (n.classList.contains(className)) r.push(n); for (const c of n.children) t(c); })(root); return r; };
    return {
      ours: ids(getElementsByClassName(tree, 'card')),
      native: ids([...tree.getElementsByClassName('card')]),
      original: ids(original(tree, 'card')),
      multiOurs: ids(getElementsByClassName(tree, 'a b')),
      multiNative: ids([...tree.getElementsByClassName('a b')]),
      live: (() => { const coll = tree.getElementsByClassName('b'); const before = coll.length; const p = document.createElement('p'); p.className = 'b'; tree.append(p); return [before, coll.length]; })(),
    };
  });
  assert.deepEqual(byClass.ours, byClass.native);               // только потомки
  assert.equal(byClass.original.length, byClass.native.length + 1); // исходная включила сам root
  assert.deepEqual(byClass.multiOurs, byClass.multiNative);     // 'a b' — элементы с обоими классами
  assert.deepEqual(byClass.multiOurs, ['1', '3']);
  assert.deepEqual(byClass.live, [3, 4]);                       // нативная коллекция живая, наш массив — снимок

  // --- свой querySelectorAll по тегу против нативного ---
  const byTag = await page.evaluate(() => {
    const tree = document.getElementById('tree');
    return { ours: querySelectorAllByTag(tree, 'p').map((e) => e.textContent), native: [...tree.querySelectorAll('p')].map((e) => e.textContent) };
  });
  assert.deepEqual(byTag.ours, byTag.native);

  // --- обходы: DFS совпадает с TreeWalker, BFS идёт по уровням ---
  const walks = await page.evaluate(() => {
    const tree = document.getElementById('tree');
    const tag = (e) => e.tagName.toLowerCase() + (e.textContent && e.children.length === 0 ? e.textContent : '');
    const walker = document.createTreeWalker(tree, NodeFilter.SHOW_ELEMENT);
    const viaWalker = [walker.currentNode];
    while (walker.nextNode()) viaWalker.push(walker.currentNode);
    return { dfs: dfs(tree).map(tag), walker: viaWalker.map(tag), bfs: bfs(tree).map(tag), depth: maxDepth(tree) };
  });
  assert.deepEqual(walks.dfs, walks.walker);                    // порядок документа
  assert.deepEqual(walks.dfs.slice(0, 4), ['div', 'div', 'p1', 'p2']);
  assert.deepEqual(walks.bfs.slice(0, 3), ['div', 'div', 'section']); // сначала весь уровень детей
  assert.equal(walks.depth, 3);
});

// --- BFS через shift: O(n) на каждый шаг на больших очередях ---
{
  const N = 100_000;
  const t1 = performance.now();
  const q1 = Array.from({ length: N }, (_, i) => i); while (q1.length) q1.shift();
  const shiftMs = performance.now() - t1;
  const t2 = performance.now();
  const q2 = Array.from({ length: N }, (_, i) => i); for (let i = 0; i < q2.length; i++) void q2[i];
  const indexMs = performance.now() - t2;
  assert.ok(shiftMs > indexMs * 5, `shift ${shiftMs.toFixed(1)} мс против указателя ${indexMs.toFixed(1)} мс`);
}

console.log('dom ok');
