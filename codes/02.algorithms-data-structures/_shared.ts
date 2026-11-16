// Общее для проверок главы 02: узлы списков и деревьев в форме LeetCode, перевод из массивов и обратно,
// случайные данные и сравнение решения с решением перебором. Сам файл не запускается (начинается с _).
import assert from 'node:assert/strict';

export class ListNode {
  val: number;
  next: ListNode | null;
  constructor(val?: number, next?: ListNode | null) {
    this.val = val ?? 0;
    this.next = next ?? null;
  }
}

export class TreeNode {
  val: number;
  left: TreeNode | null;
  right: TreeNode | null;
  constructor(val?: number, left?: TreeNode | null, right?: TreeNode | null) {
    this.val = val ?? 0;
    this.left = left ?? null;
    this.right = right ?? null;
  }
}

export function toList(values: number[]): ListNode | null {
  let head: ListNode | null = null;
  for (let i = values.length - 1; i >= 0; i--) head = new ListNode(values[i], head);
  return head;
}

export function fromList(head: ListNode | null): number[] {
  const out: number[] = [];
  for (let node = head, guard = 0; node && guard < 1e6; node = node.next, guard++) out.push(node.val);
  return out;
}

// дерево из массива в порядке уровней, как в условиях LeetCode: [3, 9, 20, null, null, 15, 7]
export function toTree(values: (number | null)[]): TreeNode | null {
  if (!values.length || values[0] === null) return null;
  const root = new TreeNode(values[0]);
  const queue = [root];
  let i = 1;
  while (queue.length && i < values.length) {
    const node = queue.shift()!;
    const l = values[i++];
    if (l !== null && l !== undefined) { node.left = new TreeNode(l); queue.push(node.left); }
    const r = values[i++];
    if (r !== null && r !== undefined) { node.right = new TreeNode(r); queue.push(node.right); }
  }
  return root;
}

export function fromTree(root: TreeNode | null): (number | null)[] {
  const out: (number | null)[] = [];
  const queue: (TreeNode | null)[] = [root];
  while (queue.length) {
    const node = queue.shift()!;
    out.push(node ? node.val : null);
    if (node) queue.push(node.left, node.right);
  }
  while (out.length && out.at(-1) === null) out.pop();
  return out;
}

// детерминированный генератор, чтобы падение воспроизводилось
let seed = 20261116;
export function random(): number {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32;
  return seed / 2 ** 32;
}
export const randInt = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
export const randArray = (len: number, lo: number, hi: number) => Array.from({ length: len }, () => randInt(lo, hi));
export const randString = (len: number, alphabet: string) => Array.from({ length: len }, () => alphabet[randInt(0, alphabet.length - 1)]).join('');

// прогнать решение против перебора на случайных входах
export function fuzz<T>(times: number, make: () => T, check: (input: T) => void): void {
  for (let i = 0; i < times; i++) {
    const input = make();
    try {
      check(input);
    } catch (e) {
      throw new Error(`падение на входе ${JSON.stringify(input)}: ${(e as Error).message}`);
    }
  }
}

export { assert };
