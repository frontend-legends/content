// Глава 10.03 — практика: композабл с примитивом, сброс формы.
// run: node practice.mjs
import assert from 'node:assert/strict';
import { ref, reactive, computed, isRef, toValue, watchEffect } from 'vue';

// 1. композабл получил число вместо ref
function useDiscountBroken(price) { return computed(() => price * 0.9); }
function useDiscount(price) { return computed(() => toValue(price) * 0.9); }
const price = ref(100);
const broken = useDiscountBroken(price.value);
const fixed = useDiscount(price);
const getter = useDiscount(() => price.value);
price.value = 200;
assert.equal(broken.value, 90);
assert.equal(fixed.value, 180);
assert.equal(getter.value, 180);
assert.equal(useDiscount(50).value, 45);   // и с обычным числом

// 2. сброс формы
const initial = () => ({ email: '', agree: false });
let form = reactive(initial());
const formRef = form;
const seen = [];
watchEffect(() => seen.push(formRef.email), { flush: 'sync' });
formRef.email = 'a@b.ru';
form = reactive(initial());              // эффект и шаблон смотрят на старый объект
assert.deepEqual(seen, ['', 'a@b.ru']);
Object.assign(formRef, initial());       // правильно для reactive
assert.deepEqual(seen, ['', 'a@b.ru', '']);

const form2 = ref(initial());
const seen2 = [];
watchEffect(() => seen2.push(form2.value.email), { flush: 'sync' });
form2.value.email = 'x@y.ru';
form2.value = initial();                 // ref можно заменить целиком
assert.deepEqual(seen2, ['', 'x@y.ru', '']);
assert.equal(isRef(form2), true);
console.log('practice ok');
