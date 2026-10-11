import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineMachine } from '@takhti/contracts';
import { diff, MASK } from './audit';
import { cronMatches, latestDue, parseCron } from './cron';
import {
  decryptSecret,
  encryptSecret,
  hashToken,
  hmacSha256,
  maskIdentity,
  randomDigits,
  randomToken,
  signatureMatches,
  tokenMatches,
} from './crypto';
import { csvLine, parseCsv, toCsv } from './csv';
import { parseEnv } from './env';
import {
  type AppError,
  conflict,
  findPostgresError,
  invalid,
  notFound,
  rateLimited,
  registerConstraintMessages,
  rule,
  stale,
  toErrorResponse,
} from './errors';
import { hashRequest } from './idempotency';
import { isUuid, newId } from './ids';
import { retryDelaySeconds } from './jobs';
import { escapeLike, normaliseQuery, normaliseUrdu } from './search';
import { formatNumber } from './sequences';
import { assertStatus, assertTransition } from './state-machine';

const KEY = Buffer.alloc(32, 7).toString('base64');

describe('errors', () => {
  it('every helper maps to its code and HTTP status', () => {
    const cases: [AppError, string, number][] = [
      [notFound('Student'), 'NOT_FOUND', 404],
      [rule('This voucher is already paid'), 'RULE', 409],
      [invalid({ name: ['Enter a name'] }), 'VALIDATION', 422],
      [conflict('Already in use'), 'CONFLICT', 409],
      [stale('Voucher'), 'STALE', 409],
      [rateLimited(30), 'RATE_LIMITED', 429],
    ];
    for (const [error, code, status] of cases) {
      const reply = toErrorResponse(error, 'req-1');
      expect(reply.body.error.code).toBe(code);
      expect(reply.status).toBe(status);
      expect(reply.body.error.requestId).toBe('req-1');
      expect(reply.unexpected).toBe(false);
    }
    expect(toErrorResponse(rateLimited(30), 'r').retryAfterSeconds).toBe(30);
    expect(toErrorResponse(notFound('Student'), 'r').body.error.message).toBe('Student not found');
  });

  it('a Zod error becomes VALIDATION with messages under each field', () => {
    const schema = z.object({ name: z.string().min(2, { error: 'Too short' }), age: z.int() });
    const result = schema.safeParse({ name: 'A', age: 1.5 });
    const reply = toErrorResponse(result.error, 'r');
    expect(reply.status).toBe(422);
    expect(reply.body.error.fields?.name).toEqual(['Too short']);
    expect(reply.body.error.fields?.age).toBeDefined();
  });

  it('a Postgres error is found under nested causes and explained', () => {
    const driver = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint_name: 'things_code_uq',
    });
    const wrapped = new Error('Failed query', { cause: driver });
    expect(findPostgresError(wrapped)).toEqual({
      code: '23505',
      message: 'duplicate key',
      constraint: 'things_code_uq',
    });
    expect(toErrorResponse(wrapped, 'r').body.error).toMatchObject({
      code: 'CONFLICT',
      message: 'That value is already in use',
    });

    registerConstraintMessages({
      things_code_uq: { message: 'This code is already in use', field: 'code' },
    });
    const friendly = toErrorResponse(wrapped, 'r').body.error;
    expect(friendly.message).toBe('This code is already in use');
    expect(friendly.fields).toEqual({ code: ['This code is already in use'] });
  });

  it('anything else is INTERNAL, flagged as unexpected, and says nothing about the cause', () => {
    const reply = toErrorResponse(new TypeError('cannot read x of undefined'), 'r');
    expect(reply.status).toBe(500);
    expect(reply.unexpected).toBe(true);
    expect(reply.body.error.message).not.toContain('undefined');
    expect(toErrorResponse('a string', 'r').status).toBe(500);
    expect(toErrorResponse(null, 'r').status).toBe(500);
  });
});

describe('crypto', () => {
  it('tokens are random, and only their hash needs storing', () => {
    const token = randomToken();
    expect(token).not.toBe(randomToken());
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(tokenMatches(token, hashToken(token))).toBe(true);
    expect(tokenMatches(`${token}x`, hashToken(token))).toBe(false);
    expect(tokenMatches(token, 'not-a-hash')).toBe(false);
  });

  it('one-time codes have the asked length and only digits', () => {
    for (let i = 0; i < 50; i++) expect(randomDigits(6)).toMatch(/^\d{6}$/);
  });

  it('a secret survives encryption, and tampering is detected', () => {
    const stored = encryptSecret('gateway-password', KEY);
    expect(stored).not.toContain('gateway-password');
    expect(stored).not.toBe(encryptSecret('gateway-password', KEY));
    expect(decryptSecret(stored, KEY)).toBe('gateway-password');
    const parts = stored.split('.');
    parts[3] = Buffer.from('tampered').toString('base64');
    expect(() => decryptSecret(parts.join('.'), KEY)).toThrow();
    expect(() => decryptSecret(stored, Buffer.alloc(32, 8).toString('base64'))).toThrow();
    expect(() => encryptSecret('x', 'short')).toThrow();
  });

  it('webhook signatures compare safely', () => {
    const signature = hmacSha256('secret', '{"a":1}');
    expect(signatureMatches(signature, signature)).toBe(true);
    expect(signatureMatches(signature, hmacSha256('secret', '{"a":2}'))).toBe(false);
    expect(signatureMatches(signature, 'zz')).toBe(false);
  });

  it('identity numbers are masked for display', () => {
    expect(maskIdentity('35202-1234567-1')).toMatch(/•+.*567-1$|•/);
    expect(maskIdentity('35202-1234567-1')).not.toContain('35202');
  });
});

describe('csv', () => {
  it('reads quoted cells, doubled quotes, embedded line breaks and both line endings', () => {
    const text = '﻿Name,Note\r\n"Khan, Ali","He said ""yes"""\n"two\nlines",plain\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ['Name', 'Note'],
      ['Khan, Ali', 'He said "yes"'],
      ['two\nlines', 'plain'],
    ]);
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('a,b')).toEqual([['a', 'b']]);
    expect(parseCsv('a,,c\n')).toEqual([['a', '', 'c']]);
  });

  it('writes what it reads, with Urdu text intact', () => {
    const rows = [
      ['نام', 'Amount'],
      ['علی رضا', 12500],
      ['Khan, "Ali"', null],
    ];
    const text = toCsv(rows);
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(parseCsv(text)).toEqual([
      ['نام', 'Amount'],
      ['علی رضا', '12500'],
      ['Khan, "Ali"', ''],
    ]);
  });

  it('a cell that a spreadsheet would run as a formula is neutralised', () => {
    expect(csvLine(['=HYPERLINK("http://evil")', '+92300', '-5', '@cmd'])).toBe(
      `"'=HYPERLINK(""http://evil"")",'+92300,'-5,'@cmd`,
    );
    // A real negative number is a number, not text, and is left alone.
    expect(csvLine([-5, 0, true])).toBe('-5,0,true');
  });
});

describe('cron', () => {
  const at = (iso: string) => Date.parse(iso);

  it('matches on Pakistan time, not UTC', () => {
    const daily1am = parseCron('0 1 * * *');
    expect(cronMatches(daily1am, at('2026-10-11T20:00:00Z'))).toBe(true); // 01:00 on the 12th in Pakistan
    expect(cronMatches(daily1am, at('2026-10-12T01:00:00Z'))).toBe(false);
  });

  it('understands lists, ranges and steps', () => {
    const cron = parseCron('*/15 8-10 * * 1-5');
    expect(cronMatches(cron, at('2026-10-12T03:30:00Z'))).toBe(true); // Monday 08:30
    expect(cronMatches(cron, at('2026-10-12T03:31:00Z'))).toBe(false);
    expect(cronMatches(cron, at('2026-10-18T03:30:00Z'))).toBe(false); // Sunday
    expect(cronMatches(parseCron('0 0 1 * *'), at('2026-10-31T19:00:00Z'))).toBe(true); // the 1st, 00:00
    expect(cronMatches(parseCron('0 9 * * 0,6'), at('2026-10-17T04:00:00Z'))).toBe(true); // Saturday
    expect(cronMatches(parseCron('0 9 * * 7'), at('2026-10-18T04:00:00Z'))).toBe(true); // 7 is Sunday too
  });

  it('with both day fields set, either may match', () => {
    const cron = parseCron('0 9 1 * 1');
    expect(cronMatches(cron, at('2026-10-12T04:00:00Z'))).toBe(true); // a Monday, not the 1st
    expect(cronMatches(cron, at('2026-10-01T04:00:00Z'))).toBe(true); // the 1st, a Thursday
    expect(cronMatches(cron, at('2026-10-13T04:00:00Z'))).toBe(false);
  });

  it('finds the latest due time, once, however long the gap', () => {
    expect(latestDue('0 1 * * *', '2026-10-12T06:00:00Z')).toBe('2026-10-11T20:00:00.000Z');
    expect(latestDue('*/2 * * * *', '2026-10-12T06:03:40Z')).toBe('2026-10-12T06:02:00.000Z');
    expect(latestDue('0 0 1 1 *', '2026-10-12T06:00:00Z')).toBeUndefined();
  });

  it('refuses expressions it cannot read', () => {
    for (const bad of [
      '* * * *',
      '61 * * * *',
      '* 24 * * *',
      '*/0 * * * *',
      'a * * * *',
      '5-1 * * * *',
    ]) {
      expect(() => parseCron(bad), bad).toThrow();
    }
  });
});

describe('number formats', () => {
  it('fills counters, date parts and named values', () => {
    expect(formatNumber('FV-{yymm}-{00000}', 412, '2026-10-12')).toBe('FV-2610-00412');
    expect(formatNumber('{branch}-{yy}-{0000}', 7, '2026-10-12', { branch: 'MC' })).toBe(
      'MC-26-0007',
    );
    expect(formatNumber('{type}-{yyyy}-{0000}', 12345, '2026-10-12', { type: 'SLC' })).toBe(
      'SLC-2026-12345',
    );
  });

  it('never issues a number with a hole in it', () => {
    expect(() => formatNumber('FV-{yymm}', 1, '2026-10-12')).toThrow(/counter/);
    expect(() => formatNumber('{branch}-{0000}', 1, '2026-10-12')).toThrow(/branch/);
    expect(() => formatNumber('{branch}-{0000}', 1, '2026-10-12', { branch: '' })).toThrow(
      /branch/,
    );
  });
});

describe('state machines', () => {
  const voucher = defineMachine({
    unpaid: ['partial', 'paid', 'cancelled'],
    partial: ['paid', 'cancelled'],
    paid: [],
    cancelled: [],
  });

  it('allows the moves that are drawn and refuses the rest with a sentence', () => {
    expect(() => assertTransition(voucher, 'unpaid', 'paid', 'Voucher')).not.toThrow();
    expect(() => assertTransition(voucher, 'paid', 'paid', 'Voucher')).not.toThrow();
    expect(() => assertTransition(voucher, 'paid', 'cancelled', 'Voucher')).toThrow(
      'Voucher cannot go from paid to cancelled',
    );
    expect(voucher.isFinal('paid')).toBe(true);
    expect(voucher.next('partial')).toEqual(['paid', 'cancelled']);
  });

  it('checks the status an action needs', () => {
    expect(() =>
      assertStatus('unpaid', ['unpaid', 'partial'], 'Voucher', 'collected'),
    ).not.toThrow();
    expect(() => assertStatus('paid', ['unpaid', 'partial'], 'Voucher', 'collected')).toThrow(
      'Voucher is paid, so it cannot be collected',
    );
  });
});

describe('search', () => {
  it('escapes the wildcards of LIKE', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('folds the keyboard variants of Urdu letters together', () => {
    expect(normaliseUrdu('علي')).toBe(normaliseUrdu('علی'));
    expect(normaliseUrdu('كريم')).toBe(normaliseUrdu('کریم'));
    expect(normaliseQuery('  Ali   Raza ')).toBe('Ali Raza');
  });
});

describe('audit diff', () => {
  it('keeps only what changed and ignores the columns the kernel maintains', () => {
    const before = { name: 'Room 1', capacity: 30, version: 1, updatedAt: 'a', floor: null };
    const after = { name: 'Room 1', capacity: 35, version: 2, updatedAt: 'b', floor: 'First' };
    expect(diff(before, after)).toEqual({ capacity: [30, 35], floor: [null, 'First'] });
  });

  it('masks sensitive values, while still saying that they changed', () => {
    const changes = diff(
      { cnic: '35202-1234567-1', accountNo: '001', tokenHash: 'a' },
      { cnic: '35202-7654321-1', accountNo: '001', tokenHash: 'b' },
    );
    expect(changes).toEqual({ cnic: [MASK, MASK], tokenHash: [MASK, MASK] });
    expect(diff(undefined, { bFormNo: '1' })).toEqual({ bFormNo: [null, MASK] });
  });

  it('compares nested values by content', () => {
    expect(diff({ tags: ['a', 'b'] }, { tags: ['a', 'b'] })).toEqual({});
    expect(diff({ tags: ['a'] }, { tags: ['a', 'b'] })).toEqual({ tags: [['a'], ['a', 'b']] });
  });
});

describe('small things', () => {
  it('ids are UUID version 7 and sort by time', () => {
    const early = newId(1_700_000_000_000);
    const late = newId(1_800_000_000_000);
    expect(isUuid(early)).toBe(true);
    expect(early[14]).toBe('7');
    expect(early < late).toBe(true);
    expect(newId()).not.toBe(newId());
    expect(isUuid('not-a-uuid')).toBe(false);
  });

  it('retry delays double from 30 seconds to an hour, with a little spread', () => {
    const none = () => 0.5;
    expect(retryDelaySeconds(1, 'exponential', none)).toBe(30);
    expect(retryDelaySeconds(2, 'exponential', none)).toBe(60);
    expect(retryDelaySeconds(5, 'exponential', none)).toBe(480);
    expect(retryDelaySeconds(20, 'exponential', none)).toBe(3600);
    expect(retryDelaySeconds(3, 'fixed', none)).toBe(60);
    expect(retryDelaySeconds(1, 'exponential', () => 0)).toBe(24);
    expect(retryDelaySeconds(1, 'exponential', () => 1)).toBe(36);
  });

  it('two requests are the same only if method, path and body all match', () => {
    const a = hashRequest('POST', '/fee-payments', { amount: 100 });
    expect(a).toBe(hashRequest('POST', '/fee-payments', { amount: 100 }));
    expect(a).not.toBe(hashRequest('POST', '/fee-payments', { amount: 101 }));
    expect(a).not.toBe(hashRequest('POST', '/fee-refunds', { amount: 100 }));
  });

  it('the environment is refused with the name of every variable that is wrong', () => {
    const good = {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:64321',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'k',
      SUPABASE_SECRET_KEY: 's',
      DATABASE_URL: 'postgres://a',
      DATABASE_ADMIN_URL: 'postgres://b',
      ENCRYPTION_KEY: KEY,
    };
    expect(parseEnv(good).APP_ENV).toBe('local');
    expect(parseEnv(good).SMS_PROVIDER).toBe('log');
    expect(() => parseEnv({ ...good, ENCRYPTION_KEY: 'short', DATABASE_URL: 'mysql://x' })).toThrow(
      /ENCRYPTION_KEY[\s\S]*DATABASE_URL|DATABASE_URL[\s\S]*ENCRYPTION_KEY/,
    );
    expect(() => parseEnv({ ...good, AI_PROVIDER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
    expect(() => parseEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
