// Проверки к 1.03: как V8 хранит элементы массива. Только малые целые — SMI, есть дробные — double,
// строка или объект — массив ссылок, дыра — «дырявый» вид. Переходы только в сторону общего вида.
// flags: --allow-natives-syntax
// Запуск: cd codes && node run.mjs 01.computer-science/3.computer-architecture
const assert = require('node:assert/strict');

const ints = [1, 2, 3];
assert.ok(%HasSmiElements(ints));
const doubles = [1.5, 2];
assert.ok(%HasDoubleElements(doubles));
const mixed = [1, 'x'];
assert.ok(%HasObjectElements(mixed));
const holey = [1, 2, 3];
holey[10] = 1;
assert.ok(%HasHoleyElements(holey));

const back = [1, 2, 3];
back.push(1.5);
assert.ok(%HasDoubleElements(back));
back.pop();
assert.ok(%HasDoubleElements(back));                                                  // обратно в SMI не вернулся
assert.ok(!%HasSmiElements(back));

console.log('elements ok');
