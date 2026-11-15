// Глава 8.08 — бренд в zod: z.email().brand<'Email'>() выдаёт брендированный тип только после проверки.
import assert from 'node:assert/strict';
import { z } from 'zod';

const Email = z.email().brand<'Email'>();
type Email = z.infer<typeof Email>;
function send(to: Email) { return to; }
assert.equal(send(Email.parse('a@b.ru')), 'a@b.ru');
// @ts-expect-error — непроверенная строка не Email
send('a@b.ru');
assert.throws(() => Email.parse('nope'));
