import { appointments, callLogs, gatePasses, postalLogs, visitors } from '../../schema';
import {
  addDays,
  at,
  branchOf,
  fakeHash,
  insertAll,
  nth,
  random,
  workingDayOnOrAfter,
  workingDayOnOrBefore,
  workingDaysUpTo,
  type School,
} from '../context';
import { femaleNames, identityNumber, maleNames, mobileNumber, surnames } from '../people';
import type { Wave1 } from '../schools';

/*
 * M09 · Front office: a week at the reception desk of Main Campus. Visitors (three still inside),
 * gate passes in every state, the phone log, the post book and this week's appointments.
 */

type PassStatus = NonNullable<(typeof gatePasses.$inferInsert)['status']>;

const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export async function seedFrontOffice(school: School, wave1: Wave1): Promise<void> {
  if (school.key !== 'roshan') return;
  const { tx, stamps } = school;
  // The desk's "today" is the last school day: on a weekend nobody is at the gate.
  const today = workingDayOnOrBefore(school.today);
  const main = branchOf(school, 'MC');
  const week = workingDaysUpTo(today, 5);
  const active = wave1.students.roster.filter(
    (student) => student.status === 'active' && student.branch === 'MC',
  );
  const hosts = wave1.staff.all.filter(
    (person) => person.branch === 'MC' && person.status === 'active',
  );
  let phone = 2_200_000;

  // ---- visitors: about fifteen a day; three who came this morning have not left yet
  const visitorRows: (typeof visitors.$inferInsert)[] = [];
  for (const day of week) {
    for (let index = 0; index < 15; index++) {
      const pick = random(`${school.key}:visitor:${day}:${index}`);
      const purpose = pick.pick([
        'parent_visit',
        'parent_visit',
        'meeting',
        'admission_enquiry',
        'delivery',
        'maintenance',
        'official',
        'interview',
      ] as const);
      const arrived = 8 * 60 + index * 19 + pick.int(0, 12);
      const inside = day === today && index >= 12;
      const about = purpose === 'parent_visit' ? pick.pick(active) : undefined;
      visitorRows.push({
        id: school.id(`visitor:${day}:${index}`),
        ...stamps,
        branchId: main,
        fullName: about
          ? about.guardianName
          : `${pick.pick(pick.chance(0.7) ? maleNames : femaleNames).en} ${pick.pick(surnames).en}`,
        phone: about ? about.guardianPhone : mobileNumber(phone++),
        purpose,
        purposeDetail:
          purpose === 'delivery'
            ? 'Stationery order'
            : purpose === 'maintenance'
              ? 'Generator service'
              : null,
        hostStaffId: ['meeting', 'official', 'interview'].includes(purpose)
          ? pick.pick(hosts).id
          : null,
        studentId: about?.id ?? null,
        badgeNo: `V-${String(index + 1).padStart(2, '0')}`,
        checkedInAt: at(day, clock(arrived)),
        checkedOutAt: inside ? null : at(day, clock(arrived + pick.int(10, 55))),
        // Yesterday one visitor left without handing the badge back.
        isFlagged: day === week[week.length - 2] && index === 9,
      });
    }
  }
  await insertAll(tx, visitors, visitorRows);

  // ---- gate passes: twelve, in every state; two were asked for today and wait for a decision
  const states: readonly PassStatus[] = [
    'requested',
    'requested',
    'approved',
    'approved',
    'exited',
    'exited',
    'exited',
    'returned',
    'returned',
    'rejected',
    'cancelled',
    'expired',
  ];
  const passRows: (typeof gatePasses.$inferInsert)[] = states.map((status, index) => {
    const pick = random(`${school.key}:gate-pass:${index}`);
    const student = nth(active, 11 + index * 53);
    const day = ['requested', 'approved'].includes(status) ? today : (week[index % 4] ?? today);
    const temporary = status === 'returned';
    const byGuardian = index % 3 !== 0;
    const left = 10 * 60 + index * 17;
    const gone = ['exited', 'returned'].includes(status);
    return {
      id: school.id(`gate-pass:${index}`),
      ...stamps,
      branchId: main,
      studentId: student.id,
      passDate: day,
      kind: temporary
        ? 'temporary_exit'
        : pick.pick(['early_leave', 'medical', 'appointment'] as const),
      reason: temporary
        ? 'Dentist appointment, returning for the last two lessons'
        : 'Family commitment',
      requestedVia: index < 2 || index % 4 === 0 ? 'portal' : 'staff',
      pickupGuardianId: byGuardian ? student.guardianId : null,
      pickupName: byGuardian
        ? student.guardianName
        : `${pick.pick(maleNames).en} ${pick.pick(surnames).en}`,
      pickupRelation: byGuardian ? 'Father' : 'Uncle',
      pickupCnic: byGuardian ? null : identityNumber(700_000 + index, 0),
      leaveTime: clock(left),
      returnExpectedTime: temporary ? clock(left + 90) : null,
      verificationCodeHash: fakeHash(`gate-pass-code:${index}`),
      status,
      exitedAt: gone ? at(day, clock(left + 4)) : null,
      returnedAt: status === 'returned' ? at(day, clock(left + 85)) : null,
    };
  });
  await insertAll(tx, gatePasses, passRows);

  // ---- the phone log: forty calls, five still to be followed up
  await insertAll(
    tx,
    callLogs,
    Array.from({ length: 40 }, (_unused, index) => {
      const pick = random(`${school.key}:call:${index}`);
      const day = week[index % week.length] as string;
      const about = pick.chance(0.6) ? pick.pick(active) : undefined;
      return {
        id: school.id(`call:${index}`),
        ...stamps,
        branchId: main,
        direction: pick.chance(0.7) ? ('incoming' as const) : ('outgoing' as const),
        callerName: about
          ? about.guardianName
          : `${pick.pick(maleNames).en} ${pick.pick(surnames).en}`,
        phone: about ? about.guardianPhone : mobileNumber(phone++),
        regarding: pick.pick([
          'Fee voucher query',
          'Absence today',
          'Admission enquiry',
          'Bus timing',
          'Meeting with the class teacher',
          'Result card',
        ]),
        studentId: about?.id ?? null,
        calledAt: at(day, clock(8 * 60 + 15 + index * 9)),
        durationMinutes: pick.int(1, 9),
        followUpOn: index < 5 ? today : index < 9 ? addDays(day, 1) : null,
        isFollowUpDone: index >= 5 && index < 9,
      };
    }),
  );

  // ---- the post book: twenty-five entries, in and out
  await insertAll(
    tx,
    postalLogs,
    Array.from({ length: 25 }, (_unused, index) => {
      const pick = random(`${school.key}:post:${index}`);
      const received = index % 3 !== 0;
      const day = addDays(today, -pick.int(0, 20));
      return {
        id: school.id(`post:${index}`),
        ...stamps,
        branchId: main,
        direction: received ? ('received' as const) : ('dispatched' as const),
        loggedOn: day,
        party: pick.pick([
          'Board of Intermediate and Secondary Education, Lahore',
          'District Education Authority',
          'HBL, Johar Town branch',
          'Punjab Curriculum and Textbook Board',
          'A parent',
        ]),
        subject: pick.pick([
          'Registration returns for Grade 9',
          'Inspection notice',
          'Cheque book',
          'Textbook order',
          'Request for a leaving certificate',
        ]),
        referenceNo: `REF/${day.slice(0, 4)}/${String(100 + index)}`,
        courier: received ? pick.pick(['TCS', 'Leopards', 'Pakistan Post', 'By hand']) : 'TCS',
        addressedToStaffId: received ? pick.pick(hosts).id : null,
        handedTo: received && index % 2 === 0 ? pick.pick(hosts).fullName : null,
        handedAt: received && index % 2 === 0 ? at(day, '12:30') : null,
      };
    }),
  );

  // ---- appointments: ten this week, some asked for by parents from the portal
  const teachers = wave1.staff.all.filter(
    (person) => person.branch === 'MC' && person.kind && person.status === 'active',
  );
  await insertAll(
    tx,
    appointments,
    Array.from({ length: 10 }, (_unused, index) => {
      const pick = random(`${school.key}:appointment:${index}`);
      const student = nth(active, 29 + index * 67);
      const day =
        index < 4 ? (week[index] ?? today) : workingDayOnOrAfter(addDays(today, 1 + (index % 4)));
      const start = 13 * 60 + 50 + (index % 3) * 20;
      const past = day < today;
      return {
        id: school.id(`appointment:${index}`),
        ...stamps,
        branchId: main,
        staffId: pick.pick(teachers).id,
        guardianId: student.guardianId,
        studentId: student.id,
        visitorName: student.guardianName,
        phone: student.guardianPhone,
        purpose: pick.pick([
          'Progress in Mathematics',
          'Attendance',
          'Behaviour in class',
          'Subject choice for Grade 9',
        ]),
        startsAt: at(day, clock(start)),
        endsAt: at(day, clock(start + 20)),
        requestedVia: index % 2 === 0 ? ('portal' as const) : ('staff' as const),
        status: past
          ? index === 3
            ? ('no_show' as const)
            : ('completed' as const)
          : index % 3 === 0
            ? ('requested' as const)
            : ('confirmed' as const),
      };
    }),
  );
}
