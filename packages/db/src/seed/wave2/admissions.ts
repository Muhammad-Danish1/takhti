import { sql } from 'drizzle-orm';
import {
  admissionApplications,
  admissionEnquiries,
  admissionSeats,
  admissionTests,
  enquiryFollowups,
  leadSources,
} from '../../schema';
import {
  addDays,
  at,
  branchOf,
  fakeHash,
  insertAll,
  random,
  setCounter,
  ymd,
  type School,
} from '../context';
import {
  addressIn,
  femaleNames,
  identityNumber,
  maleNames,
  mobileNumber,
  surnames,
  urduOf,
} from '../people';
import type { Wave1 } from '../schools';

/*
 * M06 · Admissions: where enquiries come from, a pipeline of enquiries in every state with their
 * follow-ups, the seats each grade offers, and applications in every state with their tests.
 *
 * Application documents are not seeded: a document is an uploaded file.
 */

const sources = [
  ['Walk-in', 'walk_in'],
  ['A parent told them', 'referral'],
  ['School website', 'website'],
  ['Facebook page', 'facebook'],
  ['Banner near the campus', 'banner'],
  ['Newspaper advertisement', 'newspaper'],
] as const;

type EnquiryStatus = (typeof admissionEnquiries.$inferInsert)['status'];
type ApplicationStatus = NonNullable<(typeof admissionApplications.$inferInsert)['status']>;

/** How many enquiries sit in each state: 120 in all. */
const enquiryMix: readonly (readonly [NonNullable<EnquiryStatus>, number])[] = [
  ['new', 20],
  ['contacted', 30],
  ['visit_scheduled', 15],
  ['visited', 15],
  ['applied', 20],
  ['converted', 8],
  ['lost', 12],
];

/** How many applications sit in each state: 45 in all. */
const applicationMix: readonly (readonly [ApplicationStatus, number])[] = [
  ['draft', 3],
  ['submitted', 7],
  ['under_review', 6],
  ['test_scheduled', 5],
  ['tested', 4],
  ['offered', 4],
  ['accepted', 6],
  ['waitlisted', 4],
  ['rejected', 3],
  ['withdrawn', 2],
  ['enrolled', 1],
];

export async function seedAdmissions(school: School, wave1: Wave1): Promise<void> {
  if (school.key !== 'roshan') return;
  const { tx, stamps, today } = school;
  const { setup, curriculum, staff, sections } = wave1;
  const year = setup.current;
  const yy = String(year.startYear).slice(2);
  const append = { orgId: school.orgId, createdAt: school.now };
  const officer = staff.byEmail('admissions.officer@roshan.test');
  const branchCodes = ['MC', 'CC'] as const;
  const gradesAt = (branch: string) => (branch === 'MC' ? 10 : 8);

  await insertAll(
    tx,
    leadSources,
    sources.map(([name, kind]) => ({
      id: school.id(`lead-source:${kind}`),
      ...stamps,
      name,
      kind,
    })),
  );

  // Seats: the most in Grade 1, a few in every other grade.
  await insertAll(
    tx,
    admissionSeats,
    branchCodes.flatMap((branch) =>
      Array.from({ length: gradesAt(branch) }, (_unused, index) => ({
        id: school.id(`seats:${branch}:${index + 1}`),
        ...stamps,
        branchId: branchOf(school, branch),
        academicYearId: year.id,
        gradeId: curriculum.gradeIds[index + 1] as string,
        seats: index === 0 ? 12 : index < 5 ? 5 : 3,
      })),
    ),
  );

  // ---- enquiries
  const enquiryRows: (typeof admissionEnquiries.$inferInsert)[] = [];
  const followupRows: (typeof enquiryFollowups.$inferInsert)[] = [];
  const enquiryIds: { id: string; status: NonNullable<EnquiryStatus>; branch: string }[] = [];
  let number = 0;
  let phone = 2_000_000;
  for (const [status, howMany] of enquiryMix) {
    for (let index = 0; index < howMany; index++) {
      number += 1;
      const pick = random(`${school.key}:enquiry:${number}`);
      const branch = pick.chance(0.6) ? 'MC' : 'CC';
      const girl = branch === 'CC' || pick.chance(0.5);
      const surname = pick.pick(surnames).en;
      const grade = pick.chance(0.45) ? 1 : pick.int(1, gradesAt(branch));
      const id = school.id(`enquiry:${number}`);
      const created = addDays(today, -pick.int(1, 45));
      // Twenty are due for a call today; the rest are spread around it, and closed ones have none.
      const open = !['converted', 'lost'].includes(status);
      const due = !open ? null : number % 6 === 0 ? today : addDays(today, pick.int(-2, 9));
      enquiryRows.push({
        id,
        ...stamps,
        branchId: branchOf(school, branch),
        enquiryNo: `ENQ-${yy}-${String(number).padStart(4, '0')}`,
        academicYearId: year.id,
        gradeId: curriculum.gradeIds[grade] as string,
        childName: `${pick.pick(girl ? femaleNames : maleNames).en} ${surname}`,
        gender: girl ? 'female' : 'male',
        dateOfBirth: ymd(year.startYear - (grade + 5), pick.int(1, 12), pick.int(1, 28)),
        guardianName: `${pick.pick(maleNames).en} ${surname}`,
        phone: mobileNumber(phone++),
        area: addressIn('Lahore', pick).split(', ')[2] ?? null,
        sourceId: school.id(`lead-source:${pick.pick(sources)[1]}`),
        createdVia: number % 9 === 0 ? 'public_form' : number % 13 === 0 ? 'whatsapp' : 'staff',
        status,
        lostReason:
          status === 'lost'
            ? pick.pick(['fee', 'distance', 'chose_other_school', 'no_response'] as const)
            : null,
        assignedTo: officer.id,
        nextFollowUpOn: due,
        score: status === 'new' ? 0 : pick.int(20, 95),
      });
      enquiryIds.push({ id, status, branch });
      // Everything past "new" has been followed up at least once.
      const calls = status === 'new' ? 0 : pick.int(1, 3);
      for (let call = 0; call < calls; call++) {
        followupRows.push({
          id: school.id(`enquiry-followup:${number}:${call}`),
          ...append,
          branchId: branchOf(school, branch),
          enquiryId: id,
          kind: pick.pick(['call', 'whatsapp', 'visit', 'note'] as const),
          outcome: pick.pick([
            'reached',
            'no_answer',
            'interested',
            'visit_booked',
            'call_back',
          ] as const),
          note: call === 0 ? 'First contact' : 'Followed up',
          createdAt: at(addDays(created, call * 3), '11:30'),
        });
      }
    }
  }
  await insertAll(tx, admissionEnquiries, enquiryRows);
  await insertAll(tx, enquiryFollowups, followupRows);
  await setCounter(school, 'enquiry', number + 1, { period: yy });

  // ---- applications
  const applicationRows: (typeof admissionApplications.$inferInsert)[] = [];
  const testRows: (typeof admissionTests.$inferInsert)[] = [];
  const applied = enquiryIds.filter((enquiry) => ['applied', 'converted'].includes(enquiry.status));
  // The boy the plan names as admitted this week came in through an application.
  const ibrahim = wave1.students.roster.find((student) => student.key === 'ibrahim-qureshi');
  let applicationNo = 0;
  for (const [status, howMany] of applicationMix) {
    for (let index = 0; index < howMany; index++) {
      applicationNo += 1;
      const pick = random(`${school.key}:application:${applicationNo}`);
      const from = applied[applicationNo - 1];
      // The one enrolled application is the named boy's: it points at his student record.
      const enrolledAs = status === 'enrolled' ? ibrahim : undefined;
      const state: ApplicationStatus = status;
      const branch = enrolledAs?.branch ?? from?.branch ?? (pick.chance(0.6) ? 'MC' : 'CC');
      const girl = enrolledAs
        ? enrolledAs.gender === 'female'
        : branch === 'CC' || pick.chance(0.5);
      const surname = enrolledAs?.fullName.split(' ').slice(1).join(' ') ?? pick.pick(surnames).en;
      const grade = enrolledAs?.grade ?? (pick.chance(0.4) ? 1 : pick.int(1, gradesAt(branch)));
      const fullName =
        enrolledAs?.fullName ?? `${pick.pick(girl ? femaleNames : maleNames).en} ${surname}`;
      const fatherName = enrolledAs?.guardianName ?? `${pick.pick(maleNames).en} ${surname}`;
      const id = school.id(`application:${applicationNo}`);
      const viaForm = state === 'submitted' && index < 3;
      const decided = ['offered', 'accepted', 'waitlisted', 'rejected', 'enrolled'].includes(state);
      const section = sections.find(
        (candidate) => candidate.branch === branch && candidate.grade === grade,
      );
      applicationRows.push({
        id,
        ...stamps,
        branchId: branchOf(school, branch),
        applicationNo: `APP-${yy}-${String(applicationNo).padStart(4, '0')}`,
        enquiryId: from?.id ?? null,
        academicYearId: year.id,
        gradeId: curriculum.gradeIds[grade] as string,
        status: state,
        fullName,
        fullNameUr: urduOf(fullName),
        fatherName,
        gender: girl ? 'female' : 'male',
        dateOfBirth: ymd(year.startYear - (grade + 5), pick.int(1, 12), pick.int(1, 28)),
        bFormNo: pick.chance(0.7) ? identityNumber(500_000 + applicationNo, 1) : null,
        previousSchool: grade > 1 ? 'Crescent Model School' : null,
        previousClass: grade > 1 ? `Grade ${grade - 1}` : null,
        previousResultPercent: grade > 1 ? pick.int(55, 92) : null,
        guardians: [
          {
            relation: 'father',
            fullName: fatherName,
            phone: enrolledAs?.guardianPhone ?? mobileNumber(phone++),
            occupation: 'Businessman',
            isPrimary: true,
          },
        ],
        address: addressIn('Lahore', pick),
        city: 'Lahore',
        formFeePaid: state !== 'draft',
        submittedAt: state === 'draft' ? null : at(addDays(today, -pick.int(3, 30)), '10:15'),
        submittedVia: viaForm ? 'public_form' : 'staff',
        trackingTokenHash: viaForm ? fakeHash(`application-tracking:${applicationNo}`) : null,
        proposedSectionId: decided && state !== 'rejected' ? (section?.id ?? null) : null,
        decidedAt: decided ? at(addDays(today, -pick.int(1, 6)), '13:00') : null,
        decisionNote:
          state === 'rejected'
            ? 'Did not reach the pass mark in the entry test'
            : state === 'waitlisted'
              ? 'No seat in this grade at present'
              : null,
        offerExpiresOn: state === 'offered' ? addDays(today, 7) : null,
        studentId: enrolledAs?.id ?? null,
      });
      // A test is on the calendar for those waiting for one, and done for everyone further on.
      const tested = [
        'tested',
        'offered',
        'accepted',
        'waitlisted',
        'rejected',
        'enrolled',
      ].includes(state);
      if (state === 'test_scheduled' || tested) {
        const score = state === 'rejected' ? pick.int(18, 38) : pick.int(52, 96);
        testRows.push({
          id: school.id(`admission-test:${applicationNo}`),
          ...stamps,
          branchId: branchOf(school, branch),
          applicationId: id,
          kind: grade <= 2 ? 'interview' : 'test',
          scheduledAt: at(addDays(today, tested ? -pick.int(2, 12) : pick.int(1, 6)), '09:30'),
          conductedBy: tested ? officer.id : null,
          status: tested ? 'completed' : 'scheduled',
          score: tested ? score : null,
          maxScore: tested ? 100 : null,
          result: !tested ? 'pending' : state === 'rejected' ? 'fail' : 'pass',
        });
      }
    }
  }
  await insertAll(tx, admissionApplications, applicationRows);
  await insertAll(tx, admissionTests, testRows);
  await setCounter(school, 'application', applicationNo + 1, { period: yy });

  // The student record remembers the application it came from.
  if (ibrahim) {
    const source = applicationRows.find((row) => row.studentId === ibrahim.id);
    if (source)
      await tx.execute(
        sql`update students set source_application_id = ${source.id as string}::uuid where id = ${ibrahim.id}::uuid`,
      );
  }
}
