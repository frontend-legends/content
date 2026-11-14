// Глава 7.01 — практика «Почему рендер списка тормозит?»: исходная и исправленная фабрика
// flags: --allow-natives-syntax
// run: node --allow-natives-syntax practice-shapes.cjs
const assert = require('node:assert/strict');

function makeUserBad(data) {
  const user = {};
  if (data.isAdmin) user.role = 'admin';
  if (data.avatar) user.avatar = data.avatar;
  user.name = data.name;
  user.id = data.id;
  return user;
}
function makeUser(data) {
  return {
    id: data.id,
    name: data.name,
    role: data.isAdmin ? 'admin' : null,
    avatar: data.avatar ?? null,
  };
}
const admin = { id: 1, name: 'Ann', isAdmin: true };
const guest = { id: 2, name: 'Bob', avatar: 'b.png' };

assert.equal(%HaveSameMap(makeUserBad(admin), makeUserBad(guest)), false);
assert.equal(%HaveSameMap(makeUser(admin), makeUser(guest)), true);
console.log('bad: разные формы, fixed: одна форма');
