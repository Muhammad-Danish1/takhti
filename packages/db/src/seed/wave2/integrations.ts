import {
  biometricDevices,
  biometricEnrolments,
  biometricPunches,
  integrationConnections,
  webhookEndpoints,
} from '../../schema';
import {
  at,
  branchOf,
  fakeHash,
  insertAll,
  random,
  workingDayOnOrBefore,
  type School,
} from '../context';
import type { Wave1 } from '../schools';

/*
 * M05 · Integrations: a local stand-in connection for every kind of outside service, one endpoint
 * for outgoing events, and at Main Campus an attendance machine with a morning of punches.
 *
 * Deliveries to the endpoint are not seeded: a delivery belongs to an event, and events are written
 * by the services of Phase 2. Secrets are placeholders that no provider would accept.
 */

const standIns = [
  ['payment', 'fake', 'Test payments'],
  ['sms', 'log', 'SMS (written to the outbox)'],
  ['whatsapp', 'log', 'WhatsApp (written to the outbox)'],
  ['email', 'log', 'Email (local mail catcher)'],
  ['push', 'log', 'Push (written to the outbox)'],
  ['biometric', 'fake', 'Attendance machines (test)'],
  ['gps', 'fake', 'Vehicle tracking (test)'],
  ['ai', 'fake', 'AI (canned answers)'],
] as const;

export async function seedIntegrations(school: School, wave1: Wave1): Promise<void> {
  const { tx, stamps } = school;
  // The machine's latest punches are from the last school day.
  const today = workingDayOnOrBefore(school.today);

  await insertAll(
    tx,
    integrationConnections,
    standIns.map(([category, provider, name]) => ({
      id: school.id(`connection:${category}`),
      ...stamps,
      category,
      provider,
      name,
      mode: 'test' as const,
      isDefault: true,
      status: 'connected' as const,
      lastCheckedAt: school.now,
    })),
  );

  if (school.key !== 'roshan') return;

  await insertAll(tx, webhookEndpoints, [
    {
      id: school.id('webhook-endpoint:echo'),
      ...stamps,
      url: 'https://hooks.roshan.test/takhti',
      description: 'A test listener that only records what it receives',
      eventNames: ['fee.payment_received', 'student.admitted', 'attendance.absent'],
      secretEncrypted: `seed-placeholder:${fakeHash('webhook-secret')}`,
    },
  ]);

  // One machine at the staff entrance of Main Campus, twenty people enrolled on it.
  const main = branchOf(school, 'MC');
  const deviceId = school.id('biometric-device:MC:1');
  await insertAll(tx, biometricDevices, [
    {
      id: deviceId,
      ...stamps,
      branchId: main,
      name: 'Staff entrance',
      serialNo: 'ZK-K40-000417',
      model: 'ZKTeco K40',
      location: 'Main gate, staff side',
      usedFor: 'staff',
      direction: 'both',
      lastSeenAt: at(today, '07:58'),
    },
  ]);
  const enrolled = wave1.staff.all
    .filter((person) => person.branch === 'MC' && person.status === 'active')
    .slice(0, 20);
  await insertAll(
    tx,
    biometricEnrolments,
    enrolled.map((person, index) => ({
      id: school.id(`biometric-enrolment:${person.id}`),
      ...stamps,
      branchId: main,
      personKind: 'staff' as const,
      staffId: person.id,
      deviceUserCode: String(101 + index),
    })),
  );

  // This morning's punches: most people on time, a few late, and three codes nobody is mapped to.
  const pick = random(`${school.key}:punches`);
  const punch = (code: string, time: string, staffId?: string) => ({
    id: school.id(`punch:${today}:${code}:${time}`),
    orgId: school.orgId,
    createdAt: school.now,
    branchId: main,
    deviceId,
    deviceUserCode: code,
    punchedAt: at(today, time),
    direction: 'in' as const,
    ...(staffId && { personKind: 'staff' as const, staffId }),
    raw: { pin: code, time: `${today} ${time}:00`, status: 0, verify: 1 },
  });
  const clock = (minutes: number) =>
    `${String(7 + Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  await insertAll(tx, biometricPunches, [
    ...enrolled.map((person, index) =>
      punch(
        String(101 + index),
        clock(index < 16 ? pick.int(12, 43) : pick.int(50, 70)),
        person.id,
      ),
    ),
    punch('901', '07:31'),
    punch('902', '07:36'),
    punch('977', '07:52'),
  ]);
}
