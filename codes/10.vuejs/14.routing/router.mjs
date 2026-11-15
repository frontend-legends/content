// Глава 10.14 — Vue Router: параметры и переиспользование компонента, props из маршрута, вложенные маршруты,
// guards (глобальный, маршрута, в компоненте), сбои навигации, ленивые маршруты, catch-all, query как состояние.
// run: node router.mjs
import assert from 'node:assert/strict';
import { mount, flush, vue } from '../../_lib/vue.mjs';
const { h, ref, defineComponent, watch, onMounted } = vue;
const VR = await import('vue-router');
const { createRouter, createMemoryHistory, RouterView, RouterLink, useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate, isNavigationFailure, NavigationFailureType } = VR;

const log = [];
let setupCount = 0;
const Product = defineComponent({
  props: ['id'],
  setup(props) {
    setupCount++;
    const route = useRoute();
    onMounted(() => log.push(`mounted ${props.id}`));
    onBeforeRouteUpdate((to) => log.push(`update ${to.params.id}`));
    watch(() => route.params.id, (id) => log.push(`watch ${id}`));
    return () => h('article', `товар ${props.id}`);
  },
});
const Layout = defineComponent({ setup: () => () => h('section', { class: 'account' }, [h('h2', 'Кабинет'), h(RouterView)]) });
const Orders = defineComponent({ setup: () => () => h('p', 'заказы') });
let dirty = true;
const Checkout = defineComponent({ setup() { onBeforeRouteLeave(() => (dirty ? false : true)); return () => h('form', 'оформление'); } });
let lazyLoads = 0;
const NotFound = defineComponent({ setup() { const r = useRoute(); return () => h('p', `404: ${r.params.pathMatch.join('/')}`); } });

const isLoggedIn = ref(false);
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { render: () => h('p', 'главная') } },
    { path: '/products/:id', name: 'product', component: Product, props: true },
    { path: '/account', component: Layout, meta: { auth: true }, children: [{ path: 'orders', component: Orders }] },
    { path: '/checkout', component: Checkout },
    { path: '/reports', component: () => { lazyLoads++; return Promise.resolve({ render: () => h('p', 'отчёты') }); } },
    { path: '/login', component: { render: () => h('p', 'вход') } },
    { path: '/:pathMatch(.*)*', component: NotFound },
  ],
});
router.beforeEach((to) => {
  if (to.meta.auth && !isLoggedIn.value) return { path: '/login', query: { redirect: to.fullPath } };
});

const App = defineComponent({ setup: () => () => h('main', h(RouterView)) });
router.push('/');
await router.isReady();
const w = await mount(App, { plugins: [router] });
assert.equal(w.text(), 'главная');

// --- параметр меняется — компонент переиспользуется
await router.push({ name: 'product', params: { id: '1' } }); await flush();
await router.push('/products/2'); await flush();
assert.equal(w.text(), 'товар 2');
assert.equal(setupCount, 1);                              // setup один раз
assert.deepEqual(log, ['mounted 1', 'update 2', 'watch 2']);   // onMounted не повторился

// --- глобальный guard: редирект на вход с возвратом
await router.push('/account/orders'); await flush();
assert.equal(router.currentRoute.value.fullPath, '/login?redirect=/account/orders');
isLoggedIn.value = true;
await router.push(router.currentRoute.value.query.redirect); await flush();
assert.equal(w.container.querySelector('.account').textContent, 'Кабинетзаказы');   // вложенный RouterView

// --- guard в компоненте отменяет уход, push возвращает сбой, а не исключение
await router.push('/checkout'); await flush();
const failure = await router.push('/');
assert.ok(isNavigationFailure(failure, NavigationFailureType.aborted));
assert.equal(router.currentRoute.value.path, '/checkout');
dirty = false;
assert.equal(await router.push('/'), undefined);         // успех — undefined
// повторный переход туда же — тоже сбой, а не ошибка
assert.ok(isNavigationFailure(await router.push('/'), NavigationFailureType.duplicated));

// --- ленивый маршрут загружается при первом переходе
assert.equal(lazyLoads, 0);
await router.push('/reports'); await flush();
assert.equal(lazyLoads, 1);
assert.equal(w.text(), 'отчёты');

// --- catch-all
await router.push('/no/such/page'); await flush();
assert.equal(w.text(), '404: no/such/page');

// --- query как состояние: replace не добавляет запись в историю
await router.push({ path: '/products/2' });
const before = router.options.history.state.position ?? null;
await router.replace({ query: { sort: 'price' } });
assert.equal(router.currentRoute.value.fullPath, '/products/2?sort=price');
assert.equal(router.options.history.state?.position ?? null, before);

// --- RouterLink: активный класс и href
const Nav = defineComponent({ setup: () => () => h('nav', [h(RouterLink, { to: '/products/2' }, () => 'Товар'), h(RouterLink, { to: '/' }, () => 'Главная')]) });
const nav = await mount(Nav, { plugins: [router] });
const [a1, a2] = nav.container.querySelectorAll('a');
assert.equal(a1.getAttribute('href'), '/products/2');
assert.ok(a1.classList.contains('router-link-exact-active'));
assert.ok(!a2.classList.contains('router-link-active'));
console.log('router ok');
