// Глава 8.11 — типы React 19: пропсы, children, ReactNode, хуки, события, контекст, ref как prop.
// Типы проверяет tsc (@types/react 19), поведение — jsdom через _lib/react.cjs.
import assert from 'node:assert/strict';
import {
  createContext, useContext, useReducer, useRef, useState,
  type ChangeEvent, type ComponentProps, type FC, type FormEvent, type ReactElement, type ReactNode, type Ref,
} from 'react';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const ok = <T extends true>() => {};
const { mount, errors } = require('../../_lib/react.cjs') as {
  mount: (el: ReactElement) => Promise<{ container: HTMLElement; render: (el: ReactElement) => Promise<void> }>;
  errors: string[];
};

// --- пропсы: обычная функция
type ButtonProps = { label: string; variant?: 'primary' | 'ghost'; onClick?: () => void };
function Button({ label, variant = 'primary', onClick }: ButtonProps) {
  return <button className={variant} onClick={onClick}>{label}</button>;
}
// @ts-expect-error — label обязателен
const b1 = <Button />;
// @ts-expect-error — неизвестный вариант
const b2 = <Button label="x" variant="danger" />;
void b1; void b2;

// FC не добавляет children неявно (с @types/react 18)
const Card: FC<{ title: string }> = ({ title }) => <h2>{title}</h2>;
// @ts-expect-error — Property 'children' does not exist
const c1 = <Card title="x">текст</Card>;
void c1;

// --- children и ReactNode
function Panel({ children }: { children: ReactNode }) { return <section>{children}</section>; }
const p1 = <Panel>{'строка'}{42}{null}{false}<b>жирный</b>{[1, 2].map((n) => <i key={n}>{n}</i>)}</Panel>;
void p1;
function OnlyElement({ children }: { children: ReactElement }) { return children; }
// @ts-expect-error — строка не ReactElement
const p2 = <OnlyElement>текст</OnlyElement>;
void p2;
// объект — не ReactNode
// @ts-expect-error — Type '{ a: number; }' is not assignable to type 'ReactNode'
const p3 = <Panel>{{ a: 1 }}</Panel>;
void p3;

// JSX — теперь React.JSX, глобального пространства нет
// @ts-expect-error — Cannot find namespace 'JSX'
const j1: JSX.Element = <div />;
const j2: React.JSX.Element = <div />;
void j1; void j2;

// --- пропсы нативных элементов и чужих компонентов
type InputProps = ComponentProps<'input'> & { label: string };
function Field({ label, ...rest }: InputProps) {
  return <label>{label}<input {...rest} /></label>;
}
const f1 = <Field label="Email" type="email" required autoComplete="email" />;
void f1;
type BtnProps = ComponentProps<typeof Button>;
ok<Equal<BtnProps, ButtonProps>>();
// ref — обычный prop (React 19)
ok<Equal<ComponentProps<'input'>['ref'], Ref<HTMLInputElement> | undefined>>();
function TextInput({ ref, ...rest }: ComponentProps<'input'>) { return <input ref={ref} {...rest} />; }
void TextInput;

// --- useState
function StateDemo() {
  const [count] = useState(0);
  ok<Equal<typeof count, number>>();
  const [items] = useState([]);
  ok<Equal<typeof items, never[]>>();   // пустой массив без параметра — never[]
  const [user, setUser] = useState<{ id: number } | null>(null);
  ok<Equal<typeof user, { id: number } | null>>();
  setUser({ id: 1 });
  const [maybe] = useState<string>();
  ok<Equal<typeof maybe, string | undefined>>();
  return null;
}
void StateDemo;

// --- useRef
function RefDemo() {
  const inputRef = useRef<HTMLInputElement>(null);
  ok<Equal<typeof inputRef, React.RefObject<HTMLInputElement | null>>>();
  const timer = useRef<number | undefined>(undefined);
  timer.current = 1;   // current изменяем
  // @ts-expect-error — useRef требует аргумент (React 19)
  useRef<number>();
  return <input ref={inputRef} />;
}
void RefDemo;

// --- события React
function SearchBox({ onSearch }: { onSearch: (q: string) => void }) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => onSearch(e.currentTarget.value);
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); };
  return <form onSubmit={handleSubmit}><input onChange={handleChange} /></form>;
}
void SearchBox;
// тип события выводится из места
const inline = <input onChange={(e) => { ok<Equal<typeof e, ChangeEvent<HTMLInputElement, Element>>>(); }} />;
void inline;

// --- useReducer с размеченными экшенами
type State = { items: string[]; status: 'idle' | 'saving' };
type Action = { type: 'add'; item: string } | { type: 'clear' } | { type: 'save' };
function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'add': return { ...s, items: [...s.items, a.item] };
    case 'clear': return { ...s, items: [] };
    case 'save': return { ...s, status: 'saving' };
  }
}
function Cart() {
  const [state, dispatch] = useReducer(reducer, { items: [], status: 'idle' });
  // @ts-expect-error — у add обязателен item
  dispatch({ type: 'add' });
  // @ts-expect-error — нет такого экшена
  dispatch({ type: 'remove' });
  return <p>{state.items.length}</p>;
}
void Cart;

// --- контекст без значения по умолчанию
type Auth = { user: string; logout: () => void };
const AuthContext = createContext<Auth | null>(null);
function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
function Profile() { const { user } = useAuth(); return <span>{user}</span>; }

// --- рантайм
void (async () => {
  const { container } = await mount(<AuthContext value={{ user: 'Аня', logout() {} }}><Profile /></AuthContext>);
  assert.equal(container.textContent, 'Аня');
  // без провайдера хук бросает понятную ошибку
  await assert.rejects(mount(<Profile />), /useAuth must be used inside <AuthProvider>/);
  void errors;

  // number && JSX рисует 0
  const { container: c0 } = await mount(<Panel>{0 && <b>есть</b>}</Panel>);
  assert.equal(c0.textContent, '0');
  console.log('react types ok');
})().catch((e) => { process.stdout.write(String(e?.stack ?? e) + '\n'); process.exit(1); });
