// Проверки к 6.07 в Chromium по пикселям скриншота: слои фона, object-fit, градиенты (жёсткие границы,
// прозрачность без серого, пространство интерполяции), box-shadow против drop-shadow, тень под overflow: hidden,
// opacity против прозрачного фона, filter и backdrop-filter, clip-path и клики, mask-image, mix-blend-mode и isolation,
// background-clip: text, aspect-ratio и минимальный размер.
// Запуск: cd codes && node run.mjs 06.css/7.visual-effects
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { withPage } from '../../_lib/browser.mjs';

// картинки для проверок: три полосы 300×100 и красный круг на прозрачном 100×100
const png = (w, h, fill) => {
  const img = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img.data.set(fill(x, y), (y * w + x) * 4);
  return `data:image/png;base64,${PNG.sync.write(img).toString('base64')}`;
};
const stripes = png(300, 100, (x) => (x < 100 ? [255, 0, 0, 255] : x < 200 ? [0, 255, 0, 255] : [0, 0, 255, 255]));
const circle = png(100, 100, (x, y) => ((x - 50) ** 2 + (y - 50) ** 2 < 40 ** 2 ? [255, 0, 0, 255] : [0, 0, 0, 0]));

await withPage(async (page) => {
  const set = (css, body) => page.setContent(`<!doctype html><html lang="ru"><style>body{margin:0;background:#fff}${css}</style><body>${body}</body></html>`);
  let shot;
  const snap = async () => { shot = PNG.sync.read(await page.screenshot()); };
  const px = (x, y) => { const i = (y * shot.width + x) * 4; return [shot.data[i], shot.data[i + 1], shot.data[i + 2]]; };
  const near = (a, b, tol = 6) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
  const RED = [255, 0, 0], BLUE = [0, 0, 255], GREEN = [0, 255, 0], WHITE = [255, 255, 255], BLACK = [0, 0, 0];

  // --- несколько фонов: первый в списке — сверху ---
  await set(`.b { width: 200px; height: 100px; background: linear-gradient(red, red) left / 50% 100% no-repeat, blue; }`, '<div class="b"></div>');
  await snap();
  assert.ok(near(px(50, 50), RED) && near(px(150, 50), BLUE));

  // --- object-fit: fill растягивает, cover обрезает по центру, contain вписывает с полями ---
  await set(`img { width: 100px; height: 100px; display: block; background: #fff; } .cover { object-fit: cover; } .contain { object-fit: contain; }`,
    `<img src="${stripes}" alt=""><img class="cover" src="${stripes}" alt=""><img class="contain" src="${stripes}" alt="">`);
  await snap();
  assert.ok(near(px(10, 50), RED) && near(px(50, 50), GREEN) && near(px(90, 50), BLUE));  // fill: все три полосы сжаты
  assert.ok(near(px(10, 150), GREEN) && near(px(90, 150), GREEN));                         // cover: видна только середина
  assert.ok(near(px(50, 210), WHITE) && near(px(10, 250), RED));                           // contain: поля сверху и снизу

  // --- градиенты: жёсткая граница; прозрачный конец без серой грязи; пространство интерполяции ---
  await set(`
    div { width: 200px; height: 50px; }
    .hard { background: linear-gradient(to right, red 50%, blue 50%); }
    .fade { background: linear-gradient(to right, red, transparent); }
    .srgb { background: linear-gradient(to right, blue, yellow); }
    .oklch { background: linear-gradient(in oklch to right, blue, yellow); }`,
  '<div class="hard"></div><div class="fade"></div><div class="srgb"></div><div class="oklch"></div>');
  await snap();
  assert.ok(near(px(98, 25), RED) && near(px(102, 25), BLUE));
  assert.ok(near(px(100, 75), [255, 128, 128], 8));          // полупрозрачный красный на белом — розовый, а не (191, 128, 128)
  assert.ok(near(px(100, 125), [128, 128, 128], 8));         // sRGB: середина синего и жёлтого — серая
  const mid = px(100, 175);
  assert.ok(Math.max(...mid) - Math.min(...mid) > 60);       // oklch: середина яркая, не серая

  // --- тени: box-shadow не двигает соседей, рисуется по боксу; drop-shadow — по контуру картинки ---
  await set(`
    .card { width: 100px; height: 50px; background: #eee; box-shadow: 0 20px 0 0 black; }
    .next { width: 100px; height: 10px; background: #ccc; }
    img { display: block; width: 100px; height: 100px; margin-top: 50px; }
    .bs { box-shadow: 15px 15px 0 black; } .ds { filter: drop-shadow(15px 15px 0 black); margin-left: 200px; margin-top: -100px; }`,
  `<div class="card" id="card"></div><div class="next" id="next"></div><img class="bs" src="${circle}" alt=""><img class="ds" src="${circle}" alt="">`);
  assert.equal(await page.$eval('#next', (el) => el.getBoundingClientRect().top), 50); // тень не заняла места
  await snap();
  assert.ok(near(px(110, 165), BLACK));                       // box-shadow: угол квадратной тени
  assert.ok(near(px(310, 165), WHITE));                       // drop-shadow: в углу пусто, тень повторяет круг
  assert.ok(near(px(290, 205), BLACK));                       // а со стороны смещения у круга тень есть

  // тень, обрезанная overflow: hidden родителя
  await set(`.wrap { overflow: hidden; width: 200px; height: 100px; padding: 0; } .card { margin: 0; width: 200px; height: 80px; background: #eee; box-shadow: 0 10px 0 black; }
             .wrap2 { width: 200px; height: 100px; padding-bottom: 20px; overflow: hidden; }`,
  '<div class="wrap"><div class="card"></div></div><div class="wrap2"><div class="card"></div></div>');
  await snap();
  assert.ok(near(px(100, 85), BLACK));                        // тень внутри родителя видна
  await set(`.wrap { overflow: hidden; width: 200px; height: 80px; } .card { width: 200px; height: 80px; background: #eee; box-shadow: 0 10px 0 black; }`,
    '<div class="wrap"><div class="card"></div></div>');
  await snap();
  assert.ok(near(px(100, 85), WHITE));                        // родитель ровно по карточке — тень срезана

  // --- opacity гасит всё содержимое, прозрачный фон — только фон ---
  await set(`.o { opacity: 0.5; background: black; color: black; width: 200px; height: 60px; font: 700 48px sans-serif; }
             .a { background: rgb(0 0 0 / 0.5); color: black; width: 200px; height: 60px; font: 700 48px sans-serif; }
             .tag { display: block; width: 20px; height: 20px; background: red; }`,
  '<div class="o"><span class="tag"></span></div><div class="a"><span class="tag"></span></div>');
  await snap();
  assert.ok(near(px(10, 10), [255, 128, 128], 8));            // красная метка внутри opacity: 0.5 — бледная
  assert.ok(near(px(10, 70), RED));                           // внутри полупрозрачного фона — яркая
  assert.ok(near(px(100, 50), [128, 128, 128], 8));           // фон: и там, и там серый
  assert.ok(near(px(100, 110), [128, 128, 128], 8));

  // --- filter и backdrop-filter ---
  await set(`
    .g { width: 100px; height: 50px; background: red; filter: grayscale(1); }
    .scene { position: relative; width: 200px; height: 100px; background: linear-gradient(to right, black 50%, white 50%); }
    .glass { position: absolute; inset: 0; backdrop-filter: blur(10px); }`,
  '<div class="g"></div><div class="scene"><div class="glass"></div></div>');
  await snap();
  const g = px(50, 25);
  assert.ok(g[0] === g[1] && g[1] === g[2]);                  // grayscale: серый
  assert.ok(near(px(98, 100), [128, 128, 128], 40));          // резкая граница под стеклом размыта в серый
  assert.ok(near(px(10, 100), BLACK, 10) && near(px(190, 100), WHITE, 10));
  // backdrop-filter, как filter, делает элемент containing block для fixed-потомков
  await set(`.header { margin-top: 300px; height: 60px; backdrop-filter: blur(8px); } .menu { position: fixed; top: 0; left: 0; width: 10px; height: 10px; }`,
    '<header class="header" id="h"><div class="menu" id="m"></div></header>');
  assert.equal(await page.$eval('#m', (el) => el.getBoundingClientRect().top), 300);

  // исправление: стекло на псевдоэлементе — сама шапка containing block не становится
  await set(`.header { position: relative; margin-top: 300px; height: 60px; } .header::before { content: ""; position: absolute; inset: 0; z-index: -1; backdrop-filter: blur(8px); }
             .menu { position: fixed; top: 0; left: 0; width: 10px; height: 10px; }`,
  '<header class="header"><div class="menu" id="m"></div></header>');
  assert.equal(await page.$eval('#m', (el) => el.getBoundingClientRect().top), 0);

  // overflow: clip с overflow-clip-margin выпускает тень за край, но обрезает дальше
  await set(`.wrap { overflow: clip; overflow-clip-margin: 20px; width: 200px; height: 80px; margin: 20px; }
             .card { width: 200px; height: 80px; background: #eee; box-shadow: 0 10px 0 black; }`,
  '<div class="wrap"><div class="card"></div></div>');
  await snap();
  assert.ok(near(px(100, 105), BLACK));                       // тень ниже края контейнера видна

  // --- clip-path: срезанная часть не рисуется и не ловит клики; раскладка не меняется ---
  await set(`
    .under { position: absolute; top: 0; left: 0; width: 100px; height: 100px; background: blue; }
    .btn { position: absolute; top: 0; left: 0; width: 100px; height: 100px; background: red; clip-path: circle(50%); }`,
  '<div class="under" id="under"></div><button class="btn" id="btn"></button>');
  assert.equal(await page.evaluate(() => document.elementFromPoint(50, 50).id), 'btn');
  assert.equal(await page.evaluate(() => document.elementFromPoint(3, 3).id), 'under'); // угол вне круга — клик проходит
  assert.equal(await page.$eval('#btn', (el) => el.getBoundingClientRect().width), 100);

  // --- mask-image: затухание к низу ---
  await set(`.desc { width: 200px; height: 100px; background: black; mask-image: linear-gradient(to bottom, black 50%, transparent); }`, '<div class="desc"></div>');
  await snap();
  assert.ok(near(px(100, 25), BLACK));
  assert.ok(near(px(100, 75), [128, 128, 128], 30));
  assert.ok(near(px(100, 99), WHITE, 12));

  // маска не меняет область кликов: прозрачная по маске часть всё равно ловит события
  await set(`
    .under { position: absolute; top: 0; left: 0; width: 200px; height: 100px; }
    .masked { position: absolute; top: 0; left: 0; width: 200px; height: 100px; background: black; mask-image: linear-gradient(to right, black 50%, transparent 50%); }`,
  '<div class="under" id="under2"></div><div class="masked" id="masked"></div>');
  const maskHit = await page.evaluate(() => document.elementFromPoint(190, 50).id);
  assert.equal(maskHit, 'masked');

  // --- mix-blend-mode и isolation ---
  await set(`
    .page { background: blue; padding: 20px; }
    .group { background: white; padding: 10px; }
    .iso { isolation: isolate; }
    .stamp { width: 60px; height: 30px; background: red; mix-blend-mode: multiply; }
    .solo { width: 60px; height: 30px; background: red; mix-blend-mode: multiply; }`,
  '<div class="page"><div class="solo"></div></div><div class="page"><div class="group iso"><div class="stamp"></div></div></div>');
  await snap();
  assert.ok(near(px(40, 30), BLACK));                         // красный × синий = чёрный
  assert.ok(near(px(60, 115), RED));                          // в изолированной белой группе: красный × белый = красный

  // --- background-clip: text — фон виден только сквозь буквы ---
  await set(`.t { font: 900 80px sans-serif; background: linear-gradient(red, red); background-clip: text; color: transparent; display: inline-block; }`, '<span class="t">ШШШ</span>');
  await snap();
  let redish = 0, dark = 0;
  for (let y = 0; y < 100; y++) for (let x = 0; x < 200; x++) { const [r, gg, b] = px(x, y); if (r > 200 && gg < 60 && b < 60) redish++; if (r < 60 && gg < 60 && b < 60) dark++; }
  assert.ok(redish > 500 && dark === 0);

  // --- aspect-ratio: высота из ширины; содержимое может её превысить, пока не задан min-height: 0 ---
  await set(`.v { width: 320px; aspect-ratio: 16 / 9; } .tall { height: 400px; } .fix { min-height: 0; overflow: auto; }`,
    '<div class="v" id="v1"></div><div class="v" id="v2"><div class="tall"></div></div><div class="v fix" id="v3"><div class="tall"></div></div>');
  const hh = (s) => page.$eval(s, (el) => el.getBoundingClientRect().height);
  assert.equal(await hh('#v1'), 180);
  assert.equal(await hh('#v2'), 400);                         // содержимое растянуло блок
  assert.equal(await hh('#v3'), 180);
});

console.log('effects ok');
