// Глава 12.11 — таблицы: headless-ядро TanStack Table (сортировка, фильтр, страницы — просто расчёт строк),
// виртуализация 100 000 строк: в DOM только видимые плюс запас; aria-rowcount для скринридеров.
// run: node tables.mjs
import assert from 'node:assert/strict';
import {
  constructTable, tableFeatures, createColumnHelper,
  rowSortingFeature, createSortedRowModel, sortFn_basic,
  columnFilteringFeature, createFilteredRowModel, filterFn_equals,
  rowPaginationFeature, createPaginatedRowModel,
} from '@tanstack/table-core';
import { storeReactivityBindings } from '@tanstack/table-core/store-reactivity-bindings';
import { Virtualizer, elementScroll } from '@tanstack/virtual-core';
import { dom } from '../../_lib/vue.mjs';

// --- headless-таблица (TanStack Table 9): возможности регистрируются явно, результат — модель строк, без DOM
const products = Array.from({ length: 1000 }, (_, i) => ({ id: String(i + 1), title: `Товар ${i + 1}`, price: (i * 37) % 5000, inStock: i % 3 !== 0 }));
const features = tableFeatures({
  coreReactivityFeature: storeReactivityBindings(),
  rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns: { basic: sortFn_basic },
  columnFilteringFeature, filteredRowModel: createFilteredRowModel(), filterFns: { equals: filterFn_equals },
  rowPaginationFeature, paginatedRowModel: createPaginatedRowModel(),
});
const helper = createColumnHelper();
const columns = helper.columns([
  helper.accessor('title', { header: 'Название' }),
  helper.accessor('price', { header: 'Цена', sortFn: 'basic' }),
  helper.accessor('inStock', { header: 'В наличии', filterFn: 'equals' }),
]);
const table = constructTable({
  features, columns, data: products, getRowId: (r) => r.id,
  initialState: { sorting: [{ id: 'price', desc: true }], columnFilters: [{ id: 'inStock', value: true }], pagination: { pageIndex: 0, pageSize: 20 } },
});
const rows = table.getRowModel().rows;
assert.equal(rows.length, 20);                                       // одна страница
assert.ok(rows.every((r) => r.original.inStock));                    // фильтр
assert.ok(rows.every((r, i) => i === 0 || rows[i - 1].original.price >= r.original.price));   // сортировка по убыванию
assert.equal(table.getPageCount(), Math.ceil(products.filter((p) => p.inStock).length / 20));
assert.deepEqual(table.getHeaderGroups()[0].headers.map((h) => h.column.columnDef.header), ['Название', 'Цена', 'В наличии']);
const firstOfPage1 = rows[0].id;
table.nextPage();
const page2 = table.getRowModel().rows;
assert.equal(page2.length, 20);
assert.notEqual(page2[0].id, firstOfPage1);                          // вторая страница — другие строки
assert.ok(page2[0].original.price <= rows.at(-1).original.price);   // и продолжает сортировку

// --- виртуализация: 100 000 строк по 36 px в окне 600 px
{
  const document = dom.window.document;
  const scroller = document.createElement('div');
  document.body.append(scroller);
  const v = new Virtualizer({
    count: 100_000,
    getScrollElement: () => scroller,
    estimateSize: () => 36,
    overscan: 5,
    scrollToFn: elementScroll,
    observeElementRect: (inst, cb) => { cb({ width: 800, height: 600 }); return () => {}; },   // в jsdom нет раскладки — задаём размер окна
    observeElementOffset: (inst, cb) => { cb(0, false); return () => {}; },
  });
  v._willUpdate();
  let items = v.getVirtualItems();
  assert.equal(v.getTotalSize(), 3_600_000);                       // высота «пустого» контейнера под все строки
  assert.ok(items.length < 30);                                     // в DOM — около 17 видимых плюс запас
  assert.equal(items[0].index, 0);
  // прокрутили к середине
  v.scrollOffset = 50_000 * 36;
  v.notify?.(false);
  v.calculateRange?.();
  items = v.getVirtualItems();
  assert.ok(items.some((i) => i.index === 50_000));
  assert.equal(items.find((i) => i.index === 50_000).start, 1_800_000);
}

// --- для скринридера: реальное число строк и номер строки
{
  const document = dom.window.document;
  const grid = document.createElement('div');
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-rowcount', '100001');                     // заголовок + 100 000 строк
  grid.innerHTML = '<div role="row" aria-rowindex="50002"><div role="gridcell">Товар 50001</div></div>';
  assert.equal(grid.querySelectorAll('[role=row]').length, 1);       // в DOM одна строка…
  assert.equal(grid.getAttribute('aria-rowcount'), '100001');        // …а технологии знают, сколько их всего
}
console.log('tables ok');
