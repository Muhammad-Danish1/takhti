import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineEvent, type CursorPage, type DevOutboxMessage, type EventDef } from '@takhti/contracts';
import {
  claimJobs,
  clearLocalOutbox,
  emit,
  enqueue,
  env,
  localOutbox,
  notifyDispatchJob,
  registerEventForTests,
  registerEventVariables,
  runAsSystem,
  runClaimedJob,
  setEnvForTests,
  setMessageProvider,
  type Actor,
} from '@takhti/core';
import {
  adminDb,
  channelSettings,
  guardians,
  jobs,
  messageDeliveries,
  messageOptOuts,
  notificationRules,
  notificationTemplates,
  notifications,
  studentGuardians,
  userNotificationPrefs,
  whatsappTemplates,
  withAdminTx,
} from '@takhti/db';
import * as outboxRoute from '../../../apps/web/app/api/v1/dev/outbox/route';
import { callRoute } from '../../helpers/http';
import { linkGuardian, makeGuardian, makeStudent } from '../../helpers/people';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { as, freezeTime, seedOrg, TEST_NOW, type TestOrg } from '../../helpers/world';

/*
 * From an event to the messages people receive, through the real jobs and the local stand-ins.
 * Rules, failure cases and tests: docs/plan/10-modules/m37-messaging-hub.md.
 */

const MORNING = '2026-10-12T06:00:00.000Z'; // 11:00 in Pakistan
const NIGHT = '2026-10-12T17:30:00.000Z'; // 22:30 in Pakistan, inside quiet hours
const NEXT_MORNING = '2026-10-13T03:00:00.000Z'; // 08:00 in Pakistan, when quiet hours end

const wording = (text: string) => ({ en: text, ur: text });
const absent = defineEvent({
  key: 'tests.absent',
  category: 'attendance',
  payload: z.object({ studentIds: z.array(z.uuid()), date: z.string() }),
  variables: ['schoolName', 'studentNames', 'date'],
  rules: [{ audience: 'guardians-of-student', channels: ['whatsapp', 'sms'] }],
  mergePerFamily: true,
  templates: {
    in_app: {
      en: { title: 'Absent today', body: '{{studentNames}}, {{date}}' },
      ur: { title: 'آج غیر حاضر', body: '{{studentNames}}، {{date}}' },
    },
    whatsapp: wording('{{schoolName}}: {{studentNames}} was marked absent today, {{date}}.'),
    sms: {
      en: '{{schoolName}}: {{studentNames}} was marked absent today, {{date}}.',
      ur: '{{schoolName}}: {{studentNames}} آج {{date}} کو غیر حاضر رہے۔',
    },
  },
});
const emergency = defineEvent({
  ...absent,
  key: 'tests.emergency',
  urgent: true,
});
const receipt = defineEvent({
  key: 'tests.receipt',
  category: 'fees',
  payload: z.object({ familyId: z.uuid(), amount: z.int(), receiptNo: z.string() }),
  variables: ['schoolName', 'amount', 'receiptNo', 'studentNames', 'guardianName'],
  rules: [{ audience: 'guardians-of-family', channels: ['sms'] }],
  compulsory: true,
  templates: {
    in_app: {
      en: { title: 'Payment received', body: '{{amount}}, receipt {{receiptNo}}' },
      ur: { title: 'ادائیگی موصول', body: '{{amount}}، رسید {{receiptNo}}' },
    },
    sms: wording('{{schoolName}}: We received {{amount}} for {{studentNames}}. Receipt {{receiptNo}}.'),
  },
});
const toAccountants = defineEvent({
  key: 'tests.to-accountants',
  category: 'money-office',
  payload: z.object({ branchId: z.uuid(), note: z.string() }),
  variables: ['note', 'staffName'],
  rules: [{ audience: 'role-at-branch', roleKeys: ['accountant'], channels: ['email'] }],
  templates: {
    in_app: { en: { title: 'For accounts', body: '{{note}}' }, ur: { title: 'x', body: '{{note}}' } },
    email: {
      en: { subject: 'For accounts', body: 'Dear {{staffName}}, {{note}}' },
      ur: { subject: 'x', body: '{{note}}' },
    },
  },
});
for (const event of [absent, emergency, receipt, toAccountants])
  registerEventForTests(event as unknown as EventDef);
registerEventVariables(receipt, (_ctx, payload) => ({
  amount: `Rs ${Number(payload.amount) / 100}`,
}));

let db: TestDb;

interface World {
  school: TestOrg;
  principal: Actor;
  /** A guardian with a login, the primary contact of `child`. */
  father: Actor;
  childId: string;
  familyId: string;
}

const stamps = (org: TestOrg) => ({ orgId: org.orgId, createdAt: TEST_NOW, updatedAt: TEST_NOW });

async function enable(org: TestOrg, ...channels: ('whatsapp' | 'sms' | 'email')[]): Promise<void> {
  await adminDb()
    .insert(channelSettings)
    .values(channels.map((channel) => ({ id: randomUUID(), ...stamps(org), channel, isEnabled: true })));
}

/** A fresh school with one family: a father who signs in, and his daughter. */
async function world(...channels: ('whatsapp' | 'sms' | 'email')[]): Promise<World> {
  const school = await seedOrg();
  const principal = await school.actor('principal');
  const father = await school.actor('guardian');
  const child = await school.actor('student');
  if (channels.length > 0) await enable(school, ...channels);
  return {
    school,
    principal,
    father,
    childId: child.studentIds[0]!,
    familyId: father.familyId!,
  };
}

/** Runs every job whose time has come, and the jobs those queue, until nothing is left. */
async function drain(): Promise<void> {
  for (let round = 0; round < 20; round++) {
    const claimed = await claimJobs({ workerId: 'test', limit: 50, perOrgLimit: 50 });
    if (claimed.length === 0) return;
    for (const job of claimed) await runClaimedJob(job);
  }
  throw new Error('jobs kept queueing more jobs');
}

async function raise<P extends z.ZodType>(
  who: World,
  event: EventDef<P>,
  payload: z.input<P>,
): Promise<string> {
  const id = await as(who.principal, (ctx) => emit(ctx, event, payload));
  await drain();
  return id;
}

/** A school's deliveries, oldest first; those made in the same moment in the order channels are tried. */
const channelOrder = ['whatsapp', 'sms', 'email', 'push'];
const deliveriesOf = async (org: TestOrg) =>
  (
    await adminDb().select().from(messageDeliveries).where(eq(messageDeliveries.orgId, org.orgId))
  ).sort(
    (a, b) =>
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      channelOrder.indexOf(a.channel) - channelOrder.indexOf(b.channel),
  );
const bellOf = (org: TestOrg) =>
  adminDb().select().from(notifications).where(eq(notifications.orgId, org.orgId));

/** Registers an approved WhatsApp template for an event, as a school does once Meta has approved it. */
async function approveWhatsapp(org: TestOrg, event: { key: string }, status = 'approved'): Promise<void> {
  const templateId = randomUUID();
  await adminDb()
    .insert(whatsappTemplates)
    .values({
      id: templateId,
      ...stamps(org),
      name: `absent_${templateId.slice(0, 8)}`,
      language: 'ur',
      category: 'utility',
      body: '{{1}}: {{2}} absent {{3}}',
      variables: ['schoolName', 'studentNames', 'date'],
      status: status as 'approved',
    });
  await adminDb()
    .insert(notificationTemplates)
    .values({
      id: randomUUID(),
      ...stamps(org),
      eventKey: event.key,
      channel: 'whatsapp',
      locale: 'ur',
      body: '{{schoolName}}: {{studentNames}} آج {{date}} کو غیر حاضر رہے۔',
      whatsappTemplateId: templateId,
    });
}

beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  freezeTime();
  setMessageProvider('whatsapp', undefined);
  setMessageProvider('sms', undefined);
  await db.destroy();
});
beforeEach(async () => {
  freezeTime(MORNING);
  clearLocalOutbox();
  setMessageProvider('whatsapp', undefined);
  setMessageProvider('sms', undefined);
  // Each test starts with an empty queue, whatever the one before it left waiting.
  await adminDb().delete(jobs);
});

describe('R-messaging-2 from an event to a message', () => {
  it('writes the bell for a person with a login and sends one message on the first channel that can reach them', async () => {
    const w = await world('sms');
    await raise(w, absent, { studentIds: [w.childId], date: '12 Oct' });

    const bell = await bellOf(w.school);
    expect(bell).toHaveLength(1);
    expect(bell[0]).toMatchObject({
      userId: w.father.userId,
      eventKey: 'tests.absent',
      category: 'attendance',
      // Guardians are written to in Urdu unless they chose otherwise.
      title: 'آج غیر حاضر',
      body: 'Ayesha Ahmed، 12 Oct',
      studentId: w.childId,
      isUrgent: false,
      readAt: null,
    });

    const sent = await deliveriesOf(w.school);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      channel: 'sms',
      status: 'sent',
      guardianId: w.father.guardianId,
      userId: w.father.userId,
      eventKey: 'tests.absent',
      notificationId: bell[0]!.id,
      locale: 'ur',
      provider: 'log',
      attempts: 1,
      body: 'روشن پبلک اسکول: Ayesha Ahmed آج 12 Oct کو غیر حاضر رہے۔',
    });
    expect(sent[0]!.sentAt).not.toBeNull();
    // What the local stand-in kept is exactly what would have gone out.
    expect(localOutbox()).toHaveLength(1);
    expect(localOutbox()[0]).toMatchObject({ channel: 'sms', to: sent[0]!.address, body: sent[0]!.body });
  });

  it('with no outside channel switched on, the bell is still written and nothing is sent', async () => {
    const w = await world();
    await raise(w, absent, { studentIds: [w.childId], date: '12 Oct' });
    expect(await bellOf(w.school)).toHaveLength(1);
    expect(await deliveriesOf(w.school)).toEqual([]);
    expect(localOutbox()).toEqual([]);
  });

  it('staff found by their role at a branch are told in English, by email, with their name', async () => {
    const w = await world('email');
    const accountant = await w.school.actor('accountant');
    await w.school.actor('accountant', { branch: 'city' });
    await raise(w, toAccountants, { branchId: w.school.mainBranchId, note: 'The bank file is ready' });

    const bell = await bellOf(w.school);
    expect(bell.map((row) => row.userId)).toEqual([accountant.userId]);
    expect(bell[0]).toMatchObject({ title: 'For accounts', body: 'The bank file is ready' });
    const sent = await deliveriesOf(w.school);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      channel: 'email',
      staffId: accountant.staffId,
      locale: 'en',
      body: 'Dear Imran Sheikh, The bank file is ready',
    });
    expect(localOutbox()[0]).toMatchObject({ channel: 'email', subject: 'For accounts' });
  });

  it('a module’s own variables are used: an amount arrives as the module formats it', async () => {
    const w = await world('sms');
    await raise(w, receipt, { familyId: w.familyId, amount: 850000, receiptNo: 'R-2610-00042' });
    const [message] = await deliveriesOf(w.school);
    expect(message?.body).toContain('We received Rs 8500 for Ayesha Ahmed. Receipt R-2610-00042.');
  });
});

describe('T-messaging-2 which rule applies', () => {
  it('R-messaging-2 the school’s own rule beats the default: its channel order, or nobody at all', async () => {
    const w = await world('sms', 'email');
    await adminDb()
      .update(guardians)
      .set({ email: 'farhan@example.test' })
      .where(eq(guardians.id, w.father.guardianId!));
    const ruleId = randomUUID();
    await adminDb()
      .insert(notificationRules)
      .values({
        id: ruleId,
        ...stamps(w.school),
        eventKey: 'tests.absent',
        audience: 'guardians-of-student',
        channels: ['email', 'sms'],
      });
    await adminDb()
      .insert(notificationTemplates)
      .values({
        id: randomUUID(),
        ...stamps(w.school),
        eventKey: 'tests.absent',
        channel: 'email',
        locale: 'ur',
        subject: 'Absence',
        body: 'Our own wording for {{studentNames}}',
      });
    await raise(w, absent, { studentIds: [w.childId], date: '12 Oct' });
    expect((await deliveriesOf(w.school)).map((row) => [row.channel, row.body])).toEqual([
      ['email', 'Our own wording for Ayesha Ahmed'],
    ]);

    await adminDb().update(notificationRules).set({ isEnabled: false }).where(eq(notificationRules.id, ruleId));
    await raise(w, absent, { studentIds: [w.childId], date: '13 Oct' });
    expect(await deliveriesOf(w.school)).toHaveLength(1);
    expect(await bellOf(w.school)).toHaveLength(1);
  });

  it('a rule for a compulsory event cannot be switched off: the receipt still arrives', async () => {
    const w = await world('sms');
    await adminDb()
      .insert(notificationRules)
      .values({
        id: randomUUID(),
        ...stamps(w.school),
        eventKey: 'tests.receipt',
        audience: 'guardians-of-family',
        channels: ['sms'],
        isEnabled: false,
        alsoInApp: false,
      });
    await raise(w, receipt, { familyId: w.familyId, amount: 100, receiptNo: 'R-1' });
    expect(await deliveriesOf(w.school)).toHaveLength(1);
    expect(await bellOf(w.school)).toHaveLength(1);
  });
});

describe('T-messaging-3 who is told', () => {
  it('R-messaging-5 the guardians marked to receive messages; one without a login still gets the SMS, and no bell', async () => {
    const w = await world('sms');
    const mother = await withAdminTx(async (tx) => {
      const made = await makeGuardian(tx, {
        orgId: w.school.orgId,
        now: TEST_NOW,
        fullName: 'Sana Ahmed',
        familyId: w.familyId,
      });
      await linkGuardian(tx, {
        orgId: w.school.orgId,
        now: TEST_NOW,
        studentId: w.childId,
        guardianId: made.guardianId,
        isPrimary: false,
      });
      return made.guardianId;
    });
    await raise(w, absent, { studentIds: [w.childId], date: '12 Oct' });

    const sent = await deliveriesOf(w.school);
    expect(sent.map((row) => row.guardianId).sort()).toEqual([w.father.guardianId!, mother].sort());
    expect(sent.find((row) => row.guardianId === mother)).toMatchObject({
      userId: null,
      notificationId: null,
      status: 'sent',
    });
    expect((await bellOf(w.school)).map((row) => row.userId)).toEqual([w.father.userId]);
  });

  it('R-messaging-5 when no guardian is marked, the primary contact alone', async () => {
    const w = await world('sms');
    const mother = await withAdminTx(async (tx) => {
      const made = await makeGuardian(tx, {
        orgId: w.school.orgId,
        now: TEST_NOW,
        fullName: 'Sana Ahmed',
        familyId: w.familyId,
      });
      await linkGuardian(tx, {
        orgId: w.school.orgId,
        now: TEST_NOW,
        studentId: w.childId,
        guardianId: made.guardianId,
        isPrimary: false,
      });
      return made.guardianId;
    });
    await adminDb()
      .update(studentGuardians)
      .set({ receivesMessages: false })
      .where(eq(studentGuardians.studentId, w.childId));
    await raise(w, absent, { studentIds: [w.childId], date: '12 Oct' });
    const sent = await deliveriesOf(w.school);
    expect(sent.map((row) => row.guardianId)).toEqual([w.father.guardianId]);
    expect(sent.map((row) => row.guardianId)).not.toContain(mother);
  });

  it('a school never reaches another school’s people', async () => {
    const w = await world('sms');
    const other = await world('sms');
    await raise(w, absent, { studentIds: [other.childId], date: '12 Oct' });
    expect(await deliveriesOf(w.school)).toEqual([]);
    expect(await deliveriesOf(other.school)).toEqual([]);
  });
});

describe('T-messaging-4 once per person per channel', () => {
  it('R-messaging-3 / F-messaging-4 dispatch run twice for one event gives one notification and one delivery', async () => {
    const w = await world('sms');
    const eventId = await raise(w, absent, { studentIds: [w.childId], date: '12 Oct' });
    // The worker crashed after dispatching and the job runs again.
    await adminDb().delete(jobs);
    await runAsSystem(w.school.orgId, {}, (ctx) => enqueue(ctx, notifyDispatchJob, { eventId }));
    await drain();

    expect(await bellOf(w.school)).toHaveLength(1);
    expect(await deliveriesOf(w.school)).toHaveLength(1);
    expect(localOutbox()).toHaveLength(1);
  });
});

describe('T-messaging-5 several children of one family', () => {
  it('R-messaging-4 / F-messaging-10 three children absent: one message naming all three', async () => {
    const w = await world('sms');
    const siblings = await withAdminTx(async (tx) => {
      const ids: string[] = [];
      for (const fullName of ['Hassan Ahmed', 'Zainab Ahmed']) {
        const made = await makeStudent(tx, {
          orgId: w.school.orgId,
          now: TEST_NOW,
          branchId: w.school.mainBranchId,
          fullName,
          familyId: w.familyId,
        });
        await linkGuardian(tx, {
          orgId: w.school.orgId,
          now: TEST_NOW,
          studentId: made.studentId,
          guardianId: w.father.guardianId!,
        });
        ids.push(made.studentId);
      }
      return ids;
    });
    await raise(w, absent, { studentIds: [w.childId, ...siblings], date: '12 Oct' });

    const sent = await deliveriesOf(w.school);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body).toContain('Ayesha Ahmed، Hassan Ahmed اور Zainab Ahmed');
    const bell = await bellOf(w.school);
    expect(bell).toHaveLength(1);
    // About more than one child, so it is not filed under any single one.
    expect(bell[0]!.studentId).toBeNull();
  });
});

describe('T-messaging-6 quiet hours', () => {
  it('R-messaging-6 / F-messaging-5 at night a message is held until the morning; the bell is written at once; in the morning it goes', async () => {
    const w = await world('sms');
    freezeTime(NIGHT);
    await raise(w, absent, { studentIds: [w.childId], date: '12 Oct' });

    expect(await bellOf(w.school)).toHaveLength(1);
    const [held] = await deliveriesOf(w.school);
    expect(held).toMatchObject({ status: 'held', attempts: 0 });
    expect(Date.parse(held!.sendAfter!)).toBe(Date.parse(NEXT_MORNING));
    expect(localOutbox()).toEqual([]);

    freezeTime(NEXT_MORNING);
    await drain();
    expect((await deliveriesOf(w.school))[0]).toMatchObject({ status: 'sent', attempts: 1 });
    expect(localOutbox()).toHaveLength(1);
  });

  it('R-messaging-6 an urgent event does not wait', async () => {
    const w = await world('sms');
    freezeTime(NIGHT);
    await raise(w, emergency, { studentIds: [w.childId], date: '12 Oct' });
    expect((await deliveriesOf(w.school))[0]).toMatchObject({ status: 'sent', sendAfter: null });
    expect((await bellOf(w.school))[0]!.isUrgent).toBe(true);
  });
});

describe('T-messaging-7 what a person muted', () => {
  const mute = (w: World, category: string, channel: 'sms' | 'in_app') =>
    adminDb()
      .insert(userNotificationPrefs)
      .values({
        id: randomUUID(),
        ...stamps(w.school),
        userId: w.father.userId,
        category,
        channel,
        isMuted: true,
      });

  it('R-messaging-7 a muted channel is skipped and says why; a muted bell is not written', async () => {
    const w = await world('sms');
    await mute(w, 'attendance', 'sms');
    await mute(w, 'attendance', 'in_app');
    await raise(w, absent, { studentIds: [w.childId], date: '12 Oct' });
    expect(await deliveriesOf(w.school)).toMatchObject([{ status: 'skipped', skipReason: 'muted' }]);
    expect(await bellOf(w.school)).toEqual([]);
    expect(localOutbox()).toEqual([]);
  });

  it('R-messaging-7 a compulsory event ignores the mute, and so does an urgent one', async () => {
    const w = await world('sms');
    await mute(w, 'fees', 'sms');
    await mute(w, 'fees', 'in_app');
    await mute(w, 'attendance', 'sms');
    await raise(w, receipt, { familyId: w.familyId, amount: 100, receiptNo: 'R-1' });
    await raise(w, emergency, { studentIds: [w.childId], date: '12 Oct' });
    expect((await deliveriesOf(w.school)).map((row) => row.status)).toEqual(['sent', 'sent']);
    expect(await bellOf(w.school)).toHaveLength(2);
  });
});

describe('T-messaging-8 when a channel cannot reach the person', () => {
  const chain = async (org: TestOrg) =>
    (await deliveriesOf(org)).map((row) => [row.channel, row.status, row.skipReason]);

  it('R-messaging-11 / T-messaging-10 WhatsApp without an approved template falls back to SMS, linked to what it replaced', async () => {
    const w = await world('whatsapp', 'sms');
    await approveWhatsapp(w.school, absent, 'submitted');
    await raise(w, absent, { studentIds: [w.childId], date: '12 Oct' });
    const rows = await deliveriesOf(w.school);
    expect(rows.map((row) => [row.channel, row.status, row.skipReason])).toEqual([
      ['whatsapp', 'skipped', 'template_not_approved'],
      ['sms', 'sent', null],
    ]);
    expect(rows[1]!.fallbackOfId).toBe(rows[0]!.id);
    expect(await bellOf(w.school)).toHaveLength(1);
  });

  it('R-messaging-11 with an approved template WhatsApp is used, and SMS is not', async () => {
    const w = await world('whatsapp', 'sms');
    await approveWhatsapp(w.school, absent);
    await raise(w, absent, { studentIds: [w.childId], date: '12 Oct' });
    expect(await chain(w.school)).toEqual([['whatsapp', 'sent', null]]);
  });

  it('R-messaging-8 / F-messaging-9 a number that opted out of a channel is skipped and the next channel is tried', async () => {
    const w = await world('whatsapp', 'sms');
    await approveWhatsapp(w.school, absent);
    const [father] = await adminDb().select().from(guardians).where(eq(guardians.id, w.father.guardianId!));
    await adminDb()
      .insert(messageOptOuts)
      .values({
        id: randomUUID(),
        ...stamps(w.school),
        channel: 'whatsapp',
        address: father!.phone,
        reason: 'stop_reply',
      });
    await raise(w, absent, { studentIds: [w.childId], date: '12 Oct' });
    expect(await chain(w.school)).toEqual([
      ['whatsapp', 'skipped', 'opted_out'],
      ['sms', 'sent', null],
    ]);
  });

  it('R-messaging-8 a person with no number on any channel is skipped on each, and still has the bell', async () => {
    const w = await world('whatsapp', 'sms');
    await approveWhatsapp(w.school, absent);
    await adminDb().update(guardians).set({ phone: '' }).where(eq(guardians.id, w.father.guardianId!));
    await raise(w, absent, { studentIds: [w.childId], date: '12 Oct' });
    expect(await chain(w.school)).toEqual([
      ['whatsapp', 'skipped', 'no_address'],
      ['sms', 'skipped', 'no_address'],
    ]);
    expect(await bellOf(w.school)).toHaveLength(1);
    expect(localOutbox()).toEqual([]);
  });

  it('R-messaging-8 / F-messaging-2 a message the provider refuses for good fails, and the next channel takes over', async () => {
    const w = await world('whatsapp', 'sms');
    await approveWhatsapp(w.school, absent);
    setMessageProvider('whatsapp', {
      channel: 'whatsapp',
      name: 'refusing',
      send: async () => ({ ok: false, retryable: false, reason: 'The number is not on WhatsApp' }),
    });
    await raise(w, absent, { studentIds: [w.childId], date: '12 Oct' });
    const rows = await deliveriesOf(w.school);
    expect(rows.map((row) => [row.channel, row.status])).toEqual([
      ['whatsapp', 'failed'],
      ['sms', 'sent'],
    ]);
    expect(rows[0]).toMatchObject({ attempts: 1, error: 'The number is not on WhatsApp' });
    expect(rows[1]!.fallbackOfId).toBe(rows[0]!.id);
  });
});

describe('T-messaging-9 a provider that is down', () => {
  it('R-messaging-9 / F-messaging-1 is tried again three times, each wait longer, then the next channel takes over', async () => {
    const w = await world('whatsapp', 'sms');
    await approveWhatsapp(w.school, absent);
    let tries = 0;
    setMessageProvider('whatsapp', {
      channel: 'whatsapp',
      name: 'down',
      send: async () => {
        tries += 1;
        return { ok: false, retryable: true, reason: 'The provider did not answer' };
      },
    });
    await raise(w, absent, { studentIds: [w.childId], date: '12 Oct' });

    const first = (await deliveriesOf(w.school))[0]!;
    expect(first).toMatchObject({ channel: 'whatsapp', status: 'queued', attempts: 1 });
    const waits: number[] = [Date.parse(first.sendAfter!) - Date.parse(MORNING)];
    let now = first.sendAfter!;
    for (let retry = 2; retry <= 3; retry++) {
      freezeTime(new Date(Date.parse(now)).toISOString());
      await drain();
      const row = (await deliveriesOf(w.school))[0]!;
      expect(row).toMatchObject({ status: 'queued', attempts: retry });
      waits.push(Date.parse(row.sendAfter!) - Date.parse(now));
      now = row.sendAfter!;
    }
    expect(waits).toEqual([60_000, 300_000, 900_000]);

    // The third retry is the last.
    freezeTime(new Date(Date.parse(now)).toISOString());
    await drain();
    expect(tries).toBe(4);
    expect((await deliveriesOf(w.school)).map((row) => [row.channel, row.status, row.attempts])).toEqual([
      ['whatsapp', 'failed', 4],
      ['sms', 'sent', 1],
    ]);
  });

  it('a provider that answers on the second try sends the message once', async () => {
    const w = await world('sms');
    let tries = 0;
    setMessageProvider('sms', {
      channel: 'sms',
      name: 'flaky',
      send: async (message) => {
        tries += 1;
        return tries === 1
          ? { ok: false, retryable: true, reason: 'Busy' }
          : { ok: true, providerMessageId: `ok-${message.reference}` };
      },
    });
    await raise(w, absent, { studentIds: [w.childId], date: '12 Oct' });
    freezeTime('2026-10-12T06:01:00.000Z');
    await drain();
    const [row] = await deliveriesOf(w.school);
    expect(row).toMatchObject({ status: 'sent', attempts: 2, error: null });
    expect(row!.providerMessageId).toBe(`ok-${row!.id}`);
  });
});

describe('GET /dev/outbox', () => {
  const read = (actor?: Actor) =>
    callRoute<CursorPage<DevOutboxMessage>>(outboxRoute.GET, {
      ...(actor && { as: actor }),
      url: '/api/v1/dev/outbox',
    });

  it('lists what the local stand-ins sent for this school, newest first, and nothing of another school', async () => {
    const w = await world('sms');
    const other = await world('sms');
    await raise(w, absent, { studentIds: [w.childId], date: '12 Oct' });
    freezeTime('2026-10-12T06:05:00.000Z');
    await raise(w, receipt, { familyId: w.familyId, amount: 100, receiptNo: 'R-9' });
    await raise(other, absent, { studentIds: [other.childId], date: '12 Oct' });

    const response = await read(w.principal);
    expect(response.status).toBe(200);
    expect(response.data.items.map((message) => message.eventKey)).toEqual([
      'tests.receipt',
      'tests.absent',
    ]);
    expect(response.data.items[1]).toMatchObject({ channel: 'sms', status: 'sent', locale: 'ur' });
    expect((await read()).status).toBe(401);
  });

  it('does not exist in production', async () => {
    const w = await world('sms');
    setEnvForTests({ ...env(), APP_ENV: 'production' });
    try {
      expect((await read(w.principal)).status).toBe(404);
    } finally {
      setEnvForTests(undefined);
    }
  });
});
