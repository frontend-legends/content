// Проверка к 19.10 в Chromium: нативный <dialog> с showModal() даёт из коробки то, что модалку на div
// заставляют писать руками, — закрытие по Escape, неактивный фон и возврат фокуса к открывшей кнопке.
import assert from 'node:assert/strict';
import { withPage } from '../../_lib/browser.mjs';

await withPage(async (page) => {
  await page.setContent(`<!doctype html><html lang=ru><body>
    <button id="open">Удалить</button><button id="behind">Кнопка на фоне</button>
    <dialog id="dlg" aria-label="Подтверждение"><p>Точно удалить?</p><button id="yes">Да</button></dialog>
    <script>
      window.behindClicks = 0;
      document.getElementById('behind').addEventListener('click', () => window.behindClicks++);
      document.getElementById('open').addEventListener('click', () => document.getElementById('dlg').showModal());
    </script></body></html>`);
  await page.click('#open');
  const opened = await page.evaluate(() => ({ open: document.getElementById('dlg').open, focus: document.activeElement.id, modal: document.getElementById('dlg').matches(':modal') }));
  assert.deepEqual(opened, { open: true, focus: 'yes', modal: true });         // фокус сам ушёл внутрь диалога
  const hit = await page.evaluate(() => { const r = document.getElementById('behind').getBoundingClientRect(); return document.elementFromPoint(r.x + 5, r.y + 5)?.id || document.elementFromPoint(r.x + 5, r.y + 5)?.tagName; });
  assert.notEqual(hit, 'behind');                                               // фон перекрыт и неактивен
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  assert.notEqual(await page.evaluate(() => document.activeElement.id), 'behind'); // Tab не уводит фокус на фон
  await page.keyboard.press('Escape');
  const closed = await page.evaluate(() => ({ open: document.getElementById('dlg').open, focus: document.activeElement.id }));
  assert.deepEqual(closed, { open: false, focus: 'open' });                    // Escape закрыл, фокус вернулся
});
console.log('dialog ok');
