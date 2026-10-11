import { sql } from 'drizzle-orm';
import {
  alumni,
  alumniUpdates,
  enrollments,
  families,
  guardians,
  studentGuardians,
  students,
} from '../../schema';
import { addDays, branchOf, insertAll, random, setCounter, ymd, type School } from '../context';
import { addressIn, femaleNames, maleNames, mobileNumber, surnames, urduOf } from '../people';
import type { Wave1 } from '../schools';
import { sectionKey } from '../wave1/plan';

/*
 * M10 · Alumni: the three classes that finished Grade 10 before this year, sixty students each.
 * An alumni record belongs to a student record, so each graduate is written as a student who
 * has graduated, with a family and a guardian. Last year's class also has its final enrolment;
 * the years before that are older than the school years this seed holds.
 */

export async function seedAlumni(school: School, wave1: Wave1): Promise<void> {
  if (school.key !== 'roshan') return;
  const { tx, stamps } = school;
  const { setup, curriculum } = wave1;
  const perYear = school.size === 'small' ? 12 : 60;
  const main = branchOf(school, 'MC');
  const lastSections = wave1.sections.filter(
    (section) => section.branch === 'MC' && section.grade === 10,
  );

  const familyRows: (typeof families.$inferInsert)[] = [];
  const guardianRows: (typeof guardians.$inferInsert)[] = [];
  const studentRows: (typeof students.$inferInsert)[] = [];
  const linkRows: (typeof studentGuardians.$inferInsert)[] = [];
  const enrollmentRows: (typeof enrollments.$inferInsert)[] = [];
  const alumniRows: (typeof alumni.$inferInsert)[] = [];
  const updateRows: (typeof alumniUpdates.$inferInsert)[] = [];
  const primary: { familyId: string; guardianId: string }[] = [];
  let phone = 2_400_000;
  let showcased = 0;

  for (let back = 1; back <= 3; back++) {
    // The class that finished Grade 10 `back` years before the current year began.
    const finished = addDays(ymd(setup.current.startYear - back + 1, school.yearStartMonth, 1), -1);
    const graduationYear = Number(finished.slice(0, 4));
    const admittedYear = graduationYear - 10;
    const period = String(admittedYear).slice(2);
    for (let index = 0; index < perYear; index++) {
      const label = `${graduationYear}:${index}`;
      const pick = random(`${school.key}:alumnus:${label}`);
      const girl = pick.chance(0.48);
      const surname = pick.pick(surnames).en;
      const fatherName = `${pick.pick(maleNames).en} ${surname}`;
      const fullName = `${pick.pick(girl ? femaleNames : maleNames).en} ${surname}`;
      const familyId = school.id(`alumni-family:${label}`);
      const guardianId = school.id(`alumni-guardian:${label}`);
      const studentId = school.id(`alumni-student:${label}`);
      const guardianPhone = mobileNumber(phone++);

      familyRows.push({
        id: familyId,
        ...stamps,
        familyCode: `FA-${graduationYear}-${String(index + 1).padStart(3, '0')}`,
        address: addressIn('Lahore', pick),
        city: 'Lahore',
      });
      guardianRows.push({
        id: guardianId,
        ...stamps,
        familyId,
        fullName: fatherName,
        fullNameUr: urduOf(fatherName),
        phone: guardianPhone,
      });
      primary.push({ familyId, guardianId });
      studentRows.push({
        id: studentId,
        ...stamps,
        branchId: main,
        familyId,
        admissionNo: `MC-${period}-${String(index + 1).padStart(4, '0')}`,
        fullName,
        fullNameUr: urduOf(fullName),
        fatherName,
        gender: girl ? 'female' : 'male',
        dateOfBirth: ymd(graduationYear - 16, pick.int(1, 12), pick.int(1, 28)),
        admittedOn: ymd(admittedYear, school.yearStartMonth, pick.int(1, 20)),
        admissionGradeId: curriculum.gradeIds[1] as string,
        status: 'graduated',
        leftOn: finished,
        leavingReason: 'Completed Grade 10',
      });
      linkRows.push({
        id: school.id(`alumni-link:${label}`),
        ...stamps,
        studentId,
        guardianId,
        relation: 'father',
        isPrimary: true,
      });
      // Only last year's class sat in a school year the seed holds.
      const section = lastSections[index % Math.max(1, lastSections.length)];
      if (back === 1 && section) {
        enrollmentRows.push({
          id: school.id(`alumni-enrollment:${label}`),
          ...stamps,
          branchId: main,
          studentId,
          academicYearId: setup.previous.id,
          gradeId: curriculum.gradeIds[10] as string,
          sectionId: school.id(`section:${setup.previous.startYear}:${sectionKey(section)}`),
          subjectGroupId: section.group ? curriculum.groupIds[section.group] : null,
          status: 'graduated',
          joinedOn: setup.previous.start,
          leftOn: finished,
        });
      }

      const status = pick.pick([
        'studying',
        'studying',
        'working',
        'both',
        'other',
        'unknown',
      ] as const);
      const consent = pick.pick(['not_asked', 'yes', 'yes', 'no'] as const);
      // Twenty have agreed that their name and achievement may appear on the school's website.
      const showcase = consent === 'yes' && showcased < 20 && pick.chance(0.4);
      if (showcase) showcased += 1;
      const alumniId = school.id(`alumnus:${label}`);
      alumniRows.push({
        id: alumniId,
        ...stamps,
        studentId,
        branchId: main,
        graduationYear,
        lastGradeId: curriculum.gradeIds[10] as string,
        boardResultSummary: `SSC ${pick.int(780, 1080)}/1,100`,
        currentStatus: status,
        institution: ['studying', 'both'].includes(status)
          ? pick.pick([
              'Government College University, Lahore',
              'Punjab College',
              'FAST-NUCES, Lahore',
              'Kinnaird College',
            ])
          : null,
        fieldOfStudy: ['studying', 'both'].includes(status)
          ? pick.pick(['Pre-Engineering', 'Pre-Medical', 'Computer Science', 'Commerce'])
          : null,
        occupation: ['working', 'both'].includes(status)
          ? pick.pick(['Software developer', 'Sales', 'Family business'])
          : null,
        city: 'Lahore',
        phone: consent === 'yes' ? mobileNumber(phone++) : null,
        consentToContact: consent,
        consentToShowcase: showcase,
        achievements: showcase ? 'Topped the school in the board examination' : null,
      });
      if (index % 12 === 0)
        updateRows.push({
          id: school.id(`alumni-update:${label}`),
          orgId: school.orgId,
          createdAt: school.now,
          alumniId,
          changes: { currentStatus: status, city: 'Lahore' },
          source: index % 24 === 0 ? 'form' : 'staff',
        });
    }
    await setCounter(school, 'admission', perYear + 1, { branchId: main, period });
  }

  await insertAll(tx, families, familyRows);
  await insertAll(tx, guardians, guardianRows);
  for (let start = 0; start < primary.length; start += 500) {
    const part = primary.slice(start, start + 500);
    // Each family's one guardian is its primary guardian.
    await tx.execute(
      sql`
        update families set primary_guardian_id = data.guardian_id
        from unnest(${`{${part.map((row) => row.familyId).join(',')}}`}::uuid[],
                    ${`{${part.map((row) => row.guardianId).join(',')}}`}::uuid[]) as data(family_id, guardian_id)
        where families.id = data.family_id`,
    );
  }
  await insertAll(tx, students, studentRows);
  await insertAll(tx, studentGuardians, linkRows);
  await insertAll(tx, enrollments, enrollmentRows);
  await insertAll(tx, alumni, alumniRows);
  await insertAll(tx, alumniUpdates, updateRows);
}
