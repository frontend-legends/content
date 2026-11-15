// Проверки к 12.14: модель документа TipTap и доступный с клавиатуры drag-and-drop dnd-kit.
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { act } = React;

// ProseMirror и dnd-kit ждут браузерные глобальные объекты
for (const k of ['KeyboardEvent', 'MouseEvent', 'Event', 'HTMLElement', 'Node', 'MutationObserver', 'DOMParser', 'Element', 'Range', 'Selection', 'InputEvent', 'FocusEvent']) {
  if (window[k] && !globalThis[k]) globalThis[k] = window[k];
}
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame ??= (cb) => setTimeout(cb, 0);
const tick = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

(async () => {
  // --- TipTap: всё, чего нет в схеме, отбрасывается при разборе ---
  const { Editor } = await import('@tiptap/core');
  const { default: StarterKit } = await import('@tiptap/starter-kit');
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: [StarterKit],
    content: '<p>Привет <b>мир</b> <img src=x onerror="alert(1)"><script>alert(2)</script><span style="color:red" onclick="x()">красный</span> <a href="javascript:alert(3)">ссылка</a> <a href="https://shop.example">магазин</a></p><div>блок</div>',
  });
  assert.equal(
    editor.getHTML(),
    '<p>Привет <strong>мир</strong> красный ссылка <a target="_blank" rel="noopener noreferrer nofollow" href="https://shop.example">магазин</a></p><p>блок</p>',
  );
  // документ — данные, а не HTML
  const json = editor.getJSON();
  assert.equal(json.type, 'doc');
  assert.deepEqual(json.content[0].content[1], { type: 'text', marks: [{ type: 'bold' }], text: 'мир' });

  // команды и своя история изменений
  editor.commands.setContent('<p>a</p>');
  editor.commands.selectAll();
  editor.commands.toggleBold();
  assert.equal(editor.getHTML(), '<p><strong>a</strong></p>');
  editor.commands.undo();
  assert.equal(editor.getHTML(), '<p>a</p>');
  editor.destroy();

  // --- dnd-kit: перетаскивание с клавиатуры и объявления для скринридера ---
  const { DndContext, useDraggable, KeyboardSensor, useSensor, useSensors } = await import('@dnd-kit/core');
  const events = [];
  function Card() {
    const { attributes, listeners, setNodeRef } = useDraggable({ id: 'card-1' });
    return h('div', { ref: setNodeRef, ...attributes, ...listeners }, 'Карточка');
  }
  function Board() {
    const sensors = useSensors(useSensor(KeyboardSensor));
    return h(DndContext, { sensors, onDragStart: (e) => events.push(`start ${e.active.id}`), onDragEnd: (e) => events.push(`end ${e.active.id}`) }, h(Card));
  }
  const { container } = await mount(h(Board));
  const card = container.querySelector('[aria-roledescription="draggable"]');
  assert.equal(card.getAttribute('role'), 'button');
  assert.equal(card.getAttribute('tabindex'), '0');
  assert.ok(document.getElementById(card.getAttribute('aria-describedby')).textContent.includes('space'));

  card.focus();
  await act(async () => { card.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true })); });
  await tick();
  assert.deepEqual(events, ['start card-1']);
  const live = () => [...document.querySelectorAll('[aria-live]')].map((n) => n.textContent).join(' ');
  assert.match(live(), /Picked up draggable item card-1/);

  await act(async () => { document.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true })); });
  await tick();
  assert.deepEqual(events, ['start card-1', 'end card-1']);
  assert.match(live(), /Draggable item card-1 was dropped/);

  // нативный draggable не попадает в порядок Tab
  const native = document.createElement('div');
  native.draggable = true;
  assert.equal(native.tabIndex, -1);

  assert.deepEqual(errors, []);
  console.log('editor-dnd ok');
})().catch((e) => { console.error = console.log; console.log(e); process.exit(1); });
