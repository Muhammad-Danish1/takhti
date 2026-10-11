import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { builtInRoles, expandRoles, roleGroups, staffRoleKeys } from '../access/roles';
import { capabilitiesFor } from '../access/capabilities';
import { coreModuleKeys, modules } from '../access/modules';
import { defaultPermissionsFor, permissionCatalogue, settingCatalogue } from '../catalogue';
import { defineEvent } from './events';
import { defineMachine } from './machine';
import {
  Cnic,
  Code,
  csv,
  DateStr,
  daysInMonth,
  Email,
  isCalendarDate,
  Marks,
  Money,
  Name,
  NameUr,
  Percent,
  Period,
  Phone,
  PhoneAny,
  QueryBool,
  SignedMoney,
  Slug,
  TimeStr,
  Timestamp,
} from './primitives';
import { cursorQuery, listQuery } from './resource';
import { defineSetting } from './settings';

const ok = (schema: z.ZodType, value: unknown) => schema.safeParse(value).success;
const out = <T>(schema: z.ZodType<T>, value: unknown): T => schema.parse(value);

describe('money, percentages and marks', () => {
  it('money is whole paisa, never negative', () => {
    expect(ok(Money, 850_000)).toBe(true);
    expect(ok(Money, 0)).toBe(true);
    expect(ok(Money, -1)).toBe(false);
    expect(ok(Money, 10.5)).toBe(false);
    expect(ok(Money, '100')).toBe(false);
    expect(ok(Money, Number.NaN)).toBe(false);
    expect(ok(SignedMoney, -500)).toBe(true);
    expect(ok(SignedMoney, 0.1)).toBe(false);
  });

  it('a percentage is 0 to 100 with at most two decimals', () => {
    for (const good of [0, 7.5, 33.33, 100]) expect(ok(Percent, good), String(good)).toBe(true);
    for (const bad of [-0.01, 100.01, 33.333]) expect(ok(Percent, bad), String(bad)).toBe(false);
  });

  it('marks allow halves and refuse negatives', () => {
    expect(ok(Marks, 17.5)).toBe(true);
    expect(ok(Marks, 0)).toBe(true);
    expect(ok(Marks, -1)).toBe(false);
    expect(ok(Marks, 17.555)).toBe(false);
  });
});

describe('dates and times', () => {
  it('a date must exist on the calendar', () => {
    for (const good of ['2026-10-12', '2028-02-29', '2000-02-29', '2026-12-31'])
      expect(isCalendarDate(good), good).toBe(true);
    for (const bad of [
      '2026-02-30',
      '2026-02-29',
      '2100-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-04-31',
      '26-10-12',
      '2026-1-5',
      '2026/10/12',
      '',
      '2026-10-12T00:00',
    ]) {
      expect(isCalendarDate(bad), bad).toBe(false);
    }
    expect(ok(DateStr, '2026-02-30')).toBe(false);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2026, 11)).toBe(30);
  });

  it('times, months and timestamps', () => {
    for (const good of ['00:00', '08:05', '23:59']) expect(ok(TimeStr, good), good).toBe(true);
    for (const bad of ['24:00', '8:05', '08:60', '0805']) expect(ok(TimeStr, bad), bad).toBe(false);
    expect(ok(Period, '2026-10')).toBe(true);
    expect(ok(Period, '2026-13')).toBe(false);
    expect(ok(Period, '2026-1')).toBe(false);
    expect(ok(Timestamp, '2026-10-12T06:00:00.000Z')).toBe(true);
    expect(ok(Timestamp, '2026-10-12T11:00:00+05:00')).toBe(true);
    expect(ok(Timestamp, '2026-10-12 06:00')).toBe(false);
  });
});

describe('phone and identity numbers', () => {
  it('a mobile number is accepted however it is typed and stored in one form', () => {
    for (const typed of [
      '03001234567',
      '0300-1234567',
      '+92 300 1234567',
      '00923001234567',
      '923001234567',
      ' 0300 123 4567 ',
      '(0300) 1234567',
      '۰۳۰۰۱۲۳۴۵۶۷',
      '٠٣٠٠١٢٣٤٥٦٧',
    ]) {
      expect(out(Phone, typed), typed).toBe('+923001234567');
    }
  });

  it('refuses what is not a Pakistani mobile number', () => {
    for (const bad of [
      '0300123456',
      '030012345678',
      '04235761234',
      '+1 415 555 0100',
      'phone',
      '',
      '03001234 567x',
    ])
      expect(ok(Phone, bad), bad).toBe(false);
  });

  it('an office number may be a landline with its area code', () => {
    expect(out(PhoneAny, '042-35761234')).toBe('+924235761234');
    expect(out(PhoneAny, '0300 1234567')).toBe('+923001234567');
    expect(ok(PhoneAny, '35761234')).toBe(false);
  });

  it('a CNIC or B-Form number is 13 digits, stored with dashes', () => {
    expect(out(Cnic, '3520212345671')).toBe('35202-1234567-1');
    expect(out(Cnic, '35202-1234567-1')).toBe('35202-1234567-1');
    expect(out(Cnic, ' 35202 1234567 1 ')).toBe('35202-1234567-1');
    expect(out(Cnic, '۳۵۲۰۲۱۲۳۴۵۶۷۱')).toBe('35202-1234567-1');
    for (const bad of ['352021234567', '35202123456712', '35202-12345X7-1', ''])
      expect(ok(Cnic, bad), bad).toBe(false);
  });
});

describe('text', () => {
  it('a name is trimmed, its spaces collapsed, and must be 2 to 120 characters', () => {
    expect(out(Name, '  Ali   Raza ')).toBe('Ali Raza');
    expect(ok(Name, 'A')).toBe(false);
    expect(ok(Name, '   ')).toBe(false);
    expect(ok(Name, 'x'.repeat(121))).toBe(false);
    expect(ok(Name, 'x'.repeat(120))).toBe(true);
  });

  it('an Urdu name must be in Urdu script', () => {
    expect(out(NameUr, ' روشن  پبلک اسکول ')).toBe('روشن پبلک اسکول');
    expect(ok(NameUr, 'علی رضا')).toBe(true);
    expect(ok(NameUr, 'Ali Raza')).toBe(false);
    expect(ok(NameUr, '')).toBe(false);
  });

  it('an email is lower-cased; a code is upper-cased; a slug is strict', () => {
    expect(out(Email, '  Office@Roshan.Test ')).toBe('office@roshan.test');
    expect(ok(Email, 'not-an-email')).toBe(false);
    expect(out(Code(2, 5), ' mc ')).toBe('MC');
    expect(ok(Code(2, 5), 'M')).toBe(false);
    expect(ok(Code(2, 5), 'MAIN-1')).toBe(false);
    expect(out(Slug, 'Roshan')).toBe('roshan');
    expect(ok(Slug, 'roshan-public')).toBe(true);
    for (const bad of ['-roshan', 'roshan-', 'ro--shan', 'roshan school', 'r'])
      expect(ok(Slug, bad), bad).toBe(false);
  });
});

describe('query strings', () => {
  it('a filter with several values is split on commas', () => {
    const statuses = csv(z.enum(['unpaid', 'partial', 'paid']));
    expect(out(statuses, 'unpaid, partial')).toEqual(['unpaid', 'partial']);
    expect(ok(statuses, 'unpaid,cancelled')).toBe(false);
    expect(ok(statuses, '')).toBe(false);
  });

  it('booleans arrive as text', () => {
    expect(out(QueryBool, 'true')).toBe(true);
    expect(out(QueryBool, '1')).toBe(true);
    expect(out(QueryBool, 'false')).toBe(false);
    expect(out(QueryBool, '0')).toBe(false);
    expect(ok(QueryBool, 'yes')).toBe(false);
  });

  it('a list query has defaults, coerces numbers and refuses what it does not know', () => {
    const query = listQuery({
      sortable: ['name', 'createdAt'],
      defaultSort: 'name',
      filters: { kind: z.enum(['lab', 'hall']).optional() },
    });
    expect(out(query, {})).toEqual({ page: 1, pageSize: 25, sort: 'name', order: 'asc' });
    expect(
      out(query, { page: '3', pageSize: '50', q: '  lab ', order: 'desc', kind: 'lab' }),
    ).toEqual({ page: 3, pageSize: 50, q: 'lab', sort: 'name', order: 'desc', kind: 'lab' });
    for (const bad of [
      { page: '0' },
      { pageSize: '101' },
      { sort: 'secret' },
      { order: 'up' },
      { kind: 'pool' },
      { colour: 'blue' },
      { q: '' },
    ]) {
      expect(ok(query, bad), JSON.stringify(bad)).toBe(false);
    }
    expect(
      ok(listQuery({ sortable: ['name'], defaultSort: 'name', maxPageSize: 200 }), {
        pageSize: '200',
      }),
    ).toBe(true);
  });

  it('a cursor query has a limit and an optional cursor', () => {
    const query = cursorQuery();
    expect(out(query, {})).toEqual({ limit: 50 });
    expect(out(query, { limit: '10', cursor: 'abc' })).toEqual({ limit: 10, cursor: 'abc' });
    expect(ok(query, { limit: '101' })).toBe(false);
    expect(ok(query, { page: '2' })).toBe(false);
  });
});

describe('declarations', () => {
  it('a setting must have a sensible key and a default that fits its own schema', () => {
    expect(() =>
      defineSetting({
        key: 'fees.due_day',
        scope: 'org',
        schema: z.int().min(1).max(28),
        default: 10,
        label: 'Due day',
      }),
    ).not.toThrow();
    expect(() =>
      defineSetting({
        key: 'DueDay',
        scope: 'org',
        schema: z.int(),
        default: 10,
        label: 'Due day',
      }),
    ).toThrow(/module\.name/);
    expect(() =>
      defineSetting({
        key: 'fees.due_day',
        scope: 'org',
        schema: z.int().min(1).max(28),
        default: 40,
        label: 'Due day',
      }),
    ).toThrow();
  });

  it('an event key must look like thing.what-happened', () => {
    const base = { category: 'fees' as const, payload: z.object({}), variables: [], rules: [] };
    expect(() => defineEvent({ key: 'fee.payment-received', ...base })).not.toThrow();
    expect(() => defineEvent({ key: 'Fee.Paid' as `${string}.${string}`, ...base })).toThrow();
  });

  it('a state machine answers what may follow what', () => {
    const machine = defineMachine({
      draft: ['published', 'cancelled'],
      published: ['cancelled'],
      cancelled: [],
    });
    expect(machine.states).toEqual(['draft', 'published', 'cancelled']);
    expect(machine.can('draft', 'published')).toBe(true);
    expect(machine.can('published', 'draft')).toBe(false);
    expect(machine.isFinal('cancelled')).toBe(true);
    expect(machine.next('published')).toEqual(['cancelled']);
  });
});

describe('roles, modules and the catalogue', () => {
  it('there are 32 built-in roles, 30 of which a school holds', () => {
    expect(builtInRoles).toHaveLength(32);
    expect(new Set(builtInRoles.map((role) => role.key)).size).toBe(32);
    expect(builtInRoles.filter((role) => role.kind !== 'platform')).toHaveLength(30);
    expect(staffRoleKeys).toHaveLength(28);
    expect(staffRoleKeys[0]).toBe('owner');
    expect(staffRoleKeys.at(-1)).toBe('it_admin');
  });

  it('role groups expand to their roles without repeats', () => {
    expect(expandRoles(['ADMINS', 'principal', 'cashier'])).toEqual([
      'principal',
      'branch_admin',
      'cashier',
    ]);
    expect(expandRoles(['ALL_STAFF'])).toHaveLength(28);
    expect(roleGroups.FAMILY).toEqual(['guardian', 'student']);
  });

  it('there are 45 modules, each with a unique key and code', () => {
    expect(modules).toHaveLength(45);
    expect(new Set(modules.map((module) => module.key)).size).toBe(45);
    expect(modules.map((module) => module.code)).toEqual(
      Array.from({ length: 45 }, (_unused, index) => `M${String(index).padStart(2, '0')}`),
    );
    expect(coreModuleKeys).toContain('fees');
    expect(coreModuleKeys).not.toContain('transport');
  });

  it('the permission catalogue has no duplicates and every key names a resource and an action', () => {
    const keys = permissionCatalogue.map((permission) => permission.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const permission of permissionCatalogue) {
      expect(`${permission.resource}:${permission.action}`).toBe(permission.key);
      expect(permission.label.length).toBeGreaterThan(3);
      expect(permission.defaultRoles.length).toBeGreaterThan(0);
    }
  });

  it('the owner holds everything, the auditor only what looks, and a default role what its table says', () => {
    expect(defaultPermissionsFor('owner')).toHaveLength(permissionCatalogue.length);
    const auditor = defaultPermissionsFor('auditor');
    expect(auditor.length).toBeGreaterThan(0);
    expect(auditor.every((key) => /:(read|reports|export)$/.test(key))).toBe(true);
    expect(defaultPermissionsFor('director')).toEqual(
      expect.arrayContaining(['branches:create', 'org:update', 'roles:update']),
    );
    expect(defaultPermissionsFor('driver')).toEqual(
      expect.arrayContaining(['branches:read', 'org:read']),
    );
    expect(defaultPermissionsFor('driver')).not.toContain('branches:update');
    // A family may look at the school's calendar and classes; it changes none of them.
    const guardian = defaultPermissionsFor('guardian');
    expect(guardian).toEqual(expect.arrayContaining(['academic-years:read', 'holidays:read']));
    expect(guardian).not.toContain('academic-years:update');
    expect(guardian).not.toContain('branches:read');
  });

  it('capabilities follow from permissions', () => {
    expect(capabilitiesFor(new Set(['payroll:run']))).toEqual(['payroll']);
    expect(capabilitiesFor(new Set(['staff:manage', 'health:read']))).toEqual(['hr', 'health']);
    expect(capabilitiesFor(new Set(['branches:read']))).toEqual([]);
  });

  it('every setting in the catalogue has a unique key and a default its schema accepts', () => {
    const keys = settingCatalogue.map((setting) => setting.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const setting of settingCatalogue)
      expect(setting.schema.safeParse(setting.default).success, setting.key).toBe(true);
  });
});
