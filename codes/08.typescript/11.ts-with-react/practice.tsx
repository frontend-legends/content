// Глава 8.11 — практика: useState([]), Field с ref как prop, Action-объединение.
import assert from 'node:assert/strict';
import { useId, useRef, useState, type ComponentProps, type JSX, type ReactElement, type ReactNode } from 'react';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const ok = <T extends true>() => {};
const { mount } = require('../../_lib/react.cjs') as {
  mount: (el: ReactElement) => Promise<{ container: HTMLElement }>;
};
const jsx: JSX.Element = <div />;
void jsx;

type Product = { sku: string };

// 1. useState([])
function CartBroken() {
  const [items, setItems] = useState([]);
  ok<Equal<typeof items, never[]>>();
  // @ts-expect-error — Type 'Product' is not assignable to type 'never'
  const add = (p: Product) => setItems([...items, p]);
  void add;
  return null;
}
void CartBroken;
function CartFixed() {
  const [items, setItems] = useState<Product[]>([]);
  ok<Equal<typeof items, Product[]>>();
  const add = (p: Product) => setItems((prev) => [...prev, p]);
  void add;
  return null;
}
void CartFixed;

// 2. Field
type FieldProps = ComponentProps<'input'> & { label: string };
function Field({ label, id, ...rest }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (<><label htmlFor={inputId}>{label}</label><input id={inputId} {...rest} /></>);
}
// @ts-expect-error — нет такого атрибута
const bad = <Field label="Email" colour="red" />;
void bad;
let captured: HTMLInputElement | null = null;
function Form() {
  const ref = useRef<HTMLInputElement>(null);
  return <Field label="Email" type="email" ref={(el) => { ref.current = el; captured = el; }} required />;
}

// 3. Action
type ActionProps =
  | { kind: 'link'; href: string; children: ReactNode }
  | { kind: 'button'; onClick: () => void; type?: 'button' | 'submit'; children: ReactNode };
function Action(props: ActionProps) {
  if (props.kind === 'link') return <a href={props.href}>{props.children}</a>;
  return <button type={props.type ?? 'button'} onClick={props.onClick}>{props.children}</button>;
}
// @ts-expect-error — у кнопки нет href
const a1 = <Action kind="button" href="/cart" onClick={() => {}}>x</Action>;
// @ts-expect-error — нужен href
const a2 = <Action kind="link">x</Action>;
void a1; void a2;

void (async () => {
  const { container } = await mount(<div><Form /><Action kind="link" href="/cart">Корзина</Action><Action kind="button" onClick={() => {}}>Купить</Action></div>);
  const input = container.querySelector('input')!;
  assert.equal(captured, input);
  assert.equal(input.type, 'email');
  assert.equal(container.querySelector('label')!.htmlFor, input.id);
  assert.ok(input.id.length > 0);
  assert.equal(container.querySelector('a')!.getAttribute('href'), '/cart');
  assert.equal(container.querySelector('button')!.getAttribute('type'), 'button');
  console.log('practice ok');
})().catch((e) => { process.stdout.write(String(e?.stack ?? e) + '\n'); process.exit(1); });
