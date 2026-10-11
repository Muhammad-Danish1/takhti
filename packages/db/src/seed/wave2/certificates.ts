import {
  certificateTemplates,
  certificateTypes,
  certificates,
  idCardBatches,
  idCardTemplates,
  idCards,
} from '../../schema';
import {
  addDays,
  branchOf,
  fakeHash,
  insertAll,
  nth,
  random,
  setCounter,
  type School,
} from '../context';
import type { Wave1 } from '../schools';
import type { SeededStudent } from '../wave1/students';

/*
 * M08 · Certificates and ID cards: the certificate types every school starts with, an English and
 * an Urdu template for each, certificates in every state, card designs, and active cards for two
 * classes and one department.
 *
 * The printed files are not seeded: a certificate's PDF is made by the documents service.
 */

const types = [
  {
    key: 'leaving',
    name: 'School Leaving Certificate',
    nameUr: 'سکول چھوڑنے کا سرٹیفکیٹ',
    to: 'student',
    approval: true,
    clearance: true,
    one: true,
  },
  {
    key: 'character',
    name: 'Character Certificate',
    nameUr: 'کریکٹر سرٹیفکیٹ',
    to: 'student',
    approval: true,
  },
  { key: 'bonafide', name: 'Bonafide Certificate', nameUr: 'تصدیقی سرٹیفکیٹ', to: 'student' },
  {
    key: 'provisional',
    name: 'Provisional Certificate',
    nameUr: 'عارضی سرٹیفکیٹ',
    to: 'student',
    approval: true,
  },
  {
    key: 'fee_clearance',
    name: 'Fee Clearance Certificate',
    nameUr: 'فیس کلیئرنس سرٹیفکیٹ',
    to: 'student',
    clearance: true,
  },
  {
    key: 'date_of_birth',
    name: 'Date of Birth Certificate',
    nameUr: 'تاریخ پیدائش کا سرٹیفکیٹ',
    to: 'student',
  },
  { key: 'merit', name: 'Merit Certificate', nameUr: 'میرٹ سرٹیفکیٹ', to: 'student' },
  {
    key: 'experience',
    name: 'Experience Certificate',
    nameUr: 'تجربے کا سرٹیفکیٹ',
    to: 'staff',
    approval: true,
  },
] as const;

const bodyEn = (name: string) =>
  `<p>This is to certify that <strong>{{student.fullName}}</strong>, child of {{student.fatherName}}, ` +
  `admission number {{student.admissionNo}}, is a student of {{student.className}} at {{branch.name}}.</p>` +
  `<p>This ${name.toLowerCase()} is issued on request for {{certificate.purpose}}.</p>`;
const bodyUr = (nameUr: string) =>
  `<p>تصدیق کی جاتی ہے کہ <strong>{{student.fullNameUr}}</strong> ولد {{student.fatherName}}، ` +
  `داخلہ نمبر {{student.admissionNo}}، {{branch.name}} میں {{student.className}} کے طالب علم ہیں۔</p>` +
  `<p>یہ ${nameUr} {{certificate.purpose}} کے لیے جاری کیا جاتا ہے۔</p>`;

export async function seedCertificates(school: School, wave1: Wave1): Promise<void> {
  const { tx, stamps, today } = school;
  const yyyy = today.slice(0, 4);

  const typeId = (key: string) => school.id(`certificate-type:${key}`);
  const templateId = (key: string, language: 'en' | 'ur') =>
    school.id(`certificate-template:${key}:${language}`);
  await insertAll(
    tx,
    certificateTypes,
    types.map((type) => ({
      id: typeId(type.key),
      ...stamps,
      key: type.key,
      name: type.name,
      nameUr: type.nameUr,
      issuedTo: type.to,
      requiresApproval: 'approval' in type,
      requiresClearance: 'clearance' in type,
      oneActivePerPerson: 'one' in type,
      isSystem: true,
    })),
  );
  await insertAll(
    tx,
    certificateTemplates,
    types.flatMap((type) =>
      (['en', 'ur'] as const).map((language) => ({
        id: templateId(type.key, language),
        ...stamps,
        typeId: typeId(type.key),
        name: `${type.name} (${language === 'en' ? 'English' : 'Urdu'})`,
        language,
        body: language === 'en' ? bodyEn(type.name) : bodyUr(type.nameUr),
        signatures: [{ title: 'Principal' }, { title: 'Class Teacher' }],
        isDefault: true,
        status: 'active' as const,
      })),
    ),
  );

  await insertAll(tx, idCardTemplates, [
    {
      id: school.id('id-card-template:student'),
      ...stamps,
      issuedTo: 'student',
      name: 'Student card',
      fields: {
        front: ['photo', 'fullName', 'className', 'admissionNo'],
        back: ['guardianName', 'guardianPhone', 'bloodGroup', 'address'],
      },
      backText: 'If found, please return to the school office.',
      isDefault: true,
    },
    {
      id: school.id('id-card-template:staff'),
      ...stamps,
      issuedTo: 'staff',
      name: 'Staff card',
      orientation: 'landscape',
      fields: { front: ['photo', 'fullName', 'designation', 'employeeNo'], back: ['bloodGroup'] },
      accent: 'ink',
      isDefault: true,
    },
  ]);

  if (school.key !== 'roshan') return;

  // ---- certificates: 30 issued (one of them revoked, one a duplicate copy), 4 asked for from the
  // portal, 3 waiting for approval.
  const active = wave1.students.roster.filter((student) => student.status === 'active');
  const numbers = new Map<string, number>();
  const nextNumber = (key: string) => {
    const serial = (numbers.get(key) ?? 0) + 1;
    numbers.set(key, serial);
    return `${key.toUpperCase()}-${yyyy}-${String(serial).padStart(4, '0')}`;
  };
  const rows: (typeof certificates.$inferInsert)[] = [];
  const issue = (
    label: string,
    student: SeededStudent,
    key: string,
    extra: Partial<typeof certificates.$inferInsert> = {},
  ) => {
    const pick = random(`${school.key}:certificate:${label}`);
    const issuedOn = addDays(today, -pick.int(2, 120));
    const row: typeof certificates.$inferInsert = {
      id: school.id(`certificate:${label}`),
      ...stamps,
      branchId: branchOf(school, student.branch),
      typeId: typeId(key),
      templateId: templateId(key, pick.chance(0.7) ? 'en' : 'ur'),
      studentId: student.id,
      number: nextNumber(key),
      purpose: pick.pick([
        'Passport application',
        'Scholarship form',
        'Bank account',
        'Visa application',
      ]),
      status: 'issued',
      issuedOn,
      collectedBy: student.guardianName,
      collectedOn: addDays(issuedOn, 1),
      ...extra,
    };
    rows.push(row);
    return row;
  };
  const studentKeys = ['bonafide', 'character', 'date_of_birth', 'fee_clearance', 'merit'] as const;
  for (let index = 0; index < 28; index++) {
    issue(`issued:${index}`, nth(active, 17 + index * 31), nth(studentKeys, index));
  }
  // The boy who withdrew took his leaving certificate with him.
  const adeel = wave1.students.roster.find((student) => student.key === 'adeel-shah');
  if (adeel)
    issue('adeel-leaving', adeel, 'leaving', {
      purpose: 'Admission to another school',
      issuedOn: adeel.leftOn ?? today,
      collectedOn: adeel.leftOn ?? today,
    });
  const first = rows[0];
  const second = rows[1];
  if (first) {
    // A second copy of the first certificate, marked as a duplicate.
    rows.push({
      ...first,
      id: school.id('certificate:duplicate'),
      number: nextNumber('bonafide'),
      isDuplicateCopy: true,
      originalId: first.id as string,
      purpose: 'The original was lost',
      issuedOn: addDays(today, -1),
      collectedOn: null,
      collectedBy: null,
    });
  }
  if (second) {
    second.status = 'revoked';
    second.revokedReason = 'Issued with the wrong date of birth';
  }
  for (let index = 0; index < 4; index++) {
    const student = nth(active, 5 + index * 97);
    rows.push({
      id: school.id(`certificate:requested:${index}`),
      ...stamps,
      branchId: branchOf(school, student.branch),
      typeId: typeId(index % 2 === 0 ? 'bonafide' : 'character'),
      templateId: templateId(index % 2 === 0 ? 'bonafide' : 'character', 'en'),
      studentId: student.id,
      purpose: 'Passport application',
      status: 'requested',
      requestedVia: 'portal',
    });
  }
  for (let index = 0; index < 3; index++) {
    const student = nth(active, 61 + index * 113);
    rows.push({
      id: school.id(`certificate:pending:${index}`),
      ...stamps,
      branchId: branchOf(school, student.branch),
      typeId: typeId('character'),
      templateId: templateId('character', 'en'),
      studentId: student.id,
      purpose: 'College admission',
      status: 'pending_approval',
    });
  }
  // The first certificate is written before the copy that points at it.
  await insertAll(
    tx,
    certificates,
    rows.filter((row) => !row.originalId),
  );
  await insertAll(
    tx,
    certificates,
    rows.filter((row) => row.originalId),
  );
  for (const [key, last] of numbers)
    await setCounter(school, `certificate:${key}`, last + 1, { period: yyyy });

  // ---- ID cards: every student of 6-B and 9-A at Main Campus, and the finance department
  const cardRows: (typeof idCards.$inferInsert)[] = [];
  const validUntil = wave1.setup.current.end;
  const issuedOn = addDays(wave1.setup.current.start, 20);
  const batchId = school.id('id-card-batch:MC:6-B');
  let cardNo = 0;
  const classes = new Set(['MC:6-B', 'MC:9-A']);
  for (const student of active) {
    const key = `${student.branch}:${student.grade}-${student.section.name}`;
    if (!classes.has(key)) continue;
    cardNo += 1;
    cardRows.push({
      id: school.id(`id-card:student:${student.id}`),
      ...stamps,
      branchId: branchOf(school, student.branch),
      issuedTo: 'student',
      studentId: student.id,
      templateId: school.id('id-card-template:student'),
      academicYearId: wave1.setup.current.id,
      cardNo: `SC-${yyyy}-${String(cardNo).padStart(4, '0')}`,
      qrTokenHash: fakeHash(`id-card:${student.id}`),
      issuedOn,
      validUntil,
      batchId: key === 'MC:6-B' ? batchId : null,
    });
  }
  const finance = wave1.staff.all.filter(
    (person) =>
      person.status === 'active' &&
      [
        'finance.head@roshan.test',
        'accountant@roshan.test',
        'cashier@roshan.test',
        'auditor@roshan.test',
      ].includes(person.email ?? ''),
  );
  for (const person of finance) {
    cardNo += 1;
    cardRows.push({
      id: school.id(`id-card:staff:${person.id}`),
      ...stamps,
      branchId: branchOf(school, person.branch),
      issuedTo: 'staff',
      staffId: person.id,
      templateId: school.id('id-card-template:staff'),
      cardNo: `EC-${yyyy}-${String(cardNo).padStart(4, '0')}`,
      qrTokenHash: fakeHash(`id-card:${person.id}`),
      issuedOn,
      validUntil: addDays(validUntil, 365),
    });
  }
  await insertAll(tx, idCardBatches, [
    {
      id: batchId,
      ...stamps,
      branchId: branchOf(school, 'MC'),
      templateId: school.id('id-card-template:student'),
      issuedTo: 'student',
      filters: { sectionKey: 'MC:6-B' },
      cardCount: cardRows.filter((card) => card.batchId === batchId).length,
      status: 'ready',
    },
  ]);
  await insertAll(tx, idCards, cardRows);
}
