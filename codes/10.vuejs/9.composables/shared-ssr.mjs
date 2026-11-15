// Глава 10.09 — общее состояние на уровне модуля на сервере общее для всех запросов.
// run: node shared-ssr.mjs
import assert from 'node:assert/strict';
import { createSSRApp, h, ref, inject, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';

// модульное состояние: одно на процесс сервера
const currentUser = ref(null);
function useUser() { return { currentUser }; }

const Page = defineComponent({
  props: ['login'],
  setup(props) {
    const { currentUser } = useUser();
    if (props.login) currentUser.value = props.login;   // «вошёл» в этом запросе
    return () => h('p', currentUser.value ?? 'гость');
  },
});

const first = await renderToString(createSSRApp(Page, { login: 'Аня' }));
const second = await renderToString(createSSRApp(Page, {}));   // другой посетитель
assert.equal(first, '<p>Аня</p>');
assert.equal(second, '<p>Аня</p>');   // утечка данных первого пользователя

// состояние на приложение: через provide у каждого запроса своё
const UserKey = Symbol('user');
const SafePage = defineComponent({
  props: ['login'],
  setup(props) {
    const user = inject(UserKey);
    if (props.login) user.value = props.login;
    return () => h('p', user.value ?? 'гость');
  },
});
function createApp(props) { const app = createSSRApp(SafePage, props); app.provide(UserKey, ref(null)); return app; }
assert.equal(await renderToString(createApp({ login: 'Аня' })), '<p>Аня</p>');
assert.equal(await renderToString(createApp({})), '<p>гость</p>');
console.log('shared ssr ok');
