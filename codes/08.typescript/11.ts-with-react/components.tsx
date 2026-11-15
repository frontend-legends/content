// Глава 8.11 — дженерик-компоненты, пропсы-объединения, полиморфный as, события мыши.
import assert from 'node:assert/strict';
import type { ComponentPropsWithoutRef, ElementType, MouseEvent, ReactElement, ReactNode } from 'react';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const ok = <T extends true>() => {};
const { mount } = require('../../_lib/react.cjs') as {
  mount: (el: ReactElement) => Promise<{ container: HTMLElement }>;
};

// --- currentTarget типизирован элементом, target — нет
const btn = <button onClick={(e) => {
  ok<Equal<typeof e, MouseEvent<HTMLButtonElement, globalThis.MouseEvent>>>();
  const ct = e.currentTarget; const t = e.target;
  ok<Equal<typeof ct, EventTarget & HTMLButtonElement>>();
  ok<Equal<typeof t, EventTarget>>();
}} />;
void btn;

// --- дженерик-компонент
type ListProps<T> = { items: T[]; getKey: (item: T) => string | number; render: (item: T) => ReactNode };
function List<T>({ items, getKey, render }: ListProps<T>) {
  return <ul>{items.map((i) => <li key={getKey(i)}>{render(i)}</li>)}</ul>;
}
const products = [{ sku: 'tea', title: 'Чай' }, { sku: 'pot', title: 'Чайник' }];
const l1 = <List items={products} getKey={(p) => p.sku} render={(p) => p.title} />;
// @ts-expect-error — у товара нет price: T выведен из items
const l2 = <List items={products} getKey={(p) => p.sku} render={(p) => p.price} />;
// явный параметр типа в JSX
const l3 = <List<{ id: number }> items={[{ id: 1 }]} getKey={(x) => x.id} render={(x) => x.id} />;
void l2; void l3;
// стрелка-дженерик в .tsx — с запятой
const Select = <T,>({ options, value }: { options: T[]; value: T }) => <span>{String(options.indexOf(value))}</span>;
void Select;

// --- пропсы-объединения: ссылка или кнопка
type ActionProps =
  | { kind: 'link'; href: string; children: ReactNode }
  | { kind: 'button'; onClick: () => void; children: ReactNode };
function Action(props: ActionProps) {
  if (props.kind === 'link') return <a href={props.href}>{props.children}</a>;
  return <button onClick={props.onClick}>{props.children}</button>;
}
const a1 = <Action kind="link" href="/cart">Корзина</Action>;
// @ts-expect-error — у кнопки нет href
const a2 = <Action kind="button" href="/cart" onClick={() => {}}>x</Action>;
// @ts-expect-error — у ссылки нужен href
const a3 = <Action kind="link">x</Action>;
void a2; void a3;

// --- полиморфный as
type BoxProps<C extends ElementType> = { as?: C; children?: ReactNode } & Omit<ComponentPropsWithoutRef<C>, 'as' | 'children'>;
function Box<C extends ElementType = 'div'>({ as, children, ...rest }: BoxProps<C>) {
  const Tag: ElementType = as ?? 'div';
  return <Tag {...rest}>{children}</Tag>;
}
const x1 = <Box as="a" href="/cart">Корзина</Box>;
// @ts-expect-error — у div нет href
const x2 = <Box href="/cart">x</Box>;
const x3 = <Box as="button" type="submit" disabled>Купить</Box>;
// @ts-expect-error — у button нет href
const x4 = <Box as="button" href="/x">x</Box>;
function Price({ value }: { value: number }) { return <b>{value} ₽</b>; }
const x5 = <Box as={Price} value={490} />;
// @ts-expect-error — Price требует value
const x6 = <Box as={Price} />;
void x2; void x4; void x6;

void (async () => {
  const { container } = await mount(<div>{l1}{a1}{x1}{x3}{x5}</div>);
  assert.equal(container.querySelectorAll('li').length, 2);
  assert.equal(container.querySelector('a')?.getAttribute('href'), '/cart');
  assert.equal(container.querySelectorAll('a').length, 2);
  assert.equal(container.querySelector('button')?.getAttribute('type'), 'submit');
  assert.equal(container.querySelector('b')?.textContent, '490 ₽');
  console.log('components ok');
})().catch((e) => { process.stdout.write(String(e?.stack ?? e) + '\n'); process.exit(1); });
