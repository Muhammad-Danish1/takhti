import type { RoleKey } from '@takhti/contracts';

/*
 * The sign-in accounts the seed creates. They exist only in a local or staging database.
 *
 * This file is the single place the seeded password is written. It is printed once at the end of
 * `pnpm db:seed`, so whoever runs the seed can sign in. It appears in no document and no test:
 * anything that needs it imports it from here.
 *
 * `.test` is a reserved top-level domain: nothing can be delivered to these addresses.
 */

/** One password for every seeded account, to keep trying roles out quick. Local databases only. */
export const SEED_PASSWORD = 'Takhti-local-2026';

export type SeedSchool = 'roshan' | 'alnoor';

export interface SeedAccount {
  email: string;
  fullName: string;
  school: SeedSchool;
  role: RoleKey;
  /** Branch codes the person works in. Left out for group roles (every branch) and for families. */
  branches?: readonly string[];
  /**
   * Further memberships of the same sign-in: a teacher who is also a parent at the school, a parent
   * with children in two schools. Such a person is asked where to continue after signing in.
   */
  also?: readonly { school: SeedSchool; role: 'guardian' }[];
}

export interface SeedPlatformAccount {
  email: string;
  fullName: string;
  role: 'super_admin' | 'support_agent';
}

export const platformAccounts: readonly SeedPlatformAccount[] = [
  { email: 'superadmin@takhti.test', fullName: 'Zainab Farooqi', role: 'super_admin' },
  { email: 'support@takhti.test', fullName: 'Hamza Siddiqui', role: 'support_agent' },
];

/** One person for every built-in role at Roshan Public School, named so a failing test reads like a real case. */
export const roshanAccounts: readonly SeedAccount[] = [
  { email: 'owner@roshan.test', fullName: 'Tariq Mehmood', school: 'roshan', role: 'owner' },
  { email: 'director@roshan.test', fullName: 'Amna Tariq', school: 'roshan', role: 'director' },
  {
    email: 'finance.head@roshan.test',
    fullName: 'Khalid Javed',
    school: 'roshan',
    role: 'finance_head',
  },
  {
    email: 'academic.head@roshan.test',
    fullName: 'Dr Farah Naqvi',
    school: 'roshan',
    role: 'academic_head',
  },
  { email: 'auditor@roshan.test', fullName: 'Asif Rehman', school: 'roshan', role: 'auditor' },
  {
    email: 'principal@roshan.test',
    fullName: 'Saima Akhtar',
    school: 'roshan',
    role: 'principal',
    branches: ['MC'],
  },
  {
    email: 'principal.cc@roshan.test',
    fullName: 'Nasreen Chaudhry',
    school: 'roshan',
    role: 'principal',
    branches: ['CC'],
  },
  {
    email: 'vice.principal@roshan.test',
    fullName: 'Shahid Iqbal',
    school: 'roshan',
    role: 'vice_principal',
    branches: ['MC'],
  },
  {
    email: 'branch.admin@roshan.test',
    fullName: 'Adnan Yousaf',
    school: 'roshan',
    role: 'branch_admin',
    branches: ['MC'],
  },
  {
    email: 'section.head@roshan.test',
    fullName: 'Samina Lodhi',
    school: 'roshan',
    role: 'section_head',
    branches: ['MC'],
  },
  {
    email: 'coordinator@roshan.test',
    fullName: 'Hina Rauf',
    school: 'roshan',
    role: 'coordinator',
    branches: ['MC'],
  },
  {
    email: 'exam.controller@roshan.test',
    fullName: 'Waqar Zaman',
    school: 'roshan',
    role: 'exam_controller',
    branches: ['MC'],
  },
  {
    email: 'class.teacher@roshan.test',
    fullName: 'Nadia Raza',
    school: 'roshan',
    role: 'class_teacher',
    branches: ['MC'],
  },
  {
    email: 'subject.teacher@roshan.test',
    fullName: 'Imran Siddiqui',
    school: 'roshan',
    role: 'subject_teacher',
    branches: ['MC'],
  },
  {
    email: 'counsellor@roshan.test',
    fullName: 'Mehwish Anwar',
    school: 'roshan',
    role: 'counsellor',
    branches: ['MC'],
  },
  {
    email: 'accountant@roshan.test',
    fullName: 'Farah Iqbal',
    school: 'roshan',
    role: 'accountant',
    branches: ['MC', 'CC'],
  },
  {
    email: 'cashier@roshan.test',
    fullName: 'Asif Butt',
    school: 'roshan',
    role: 'cashier',
    branches: ['MC'],
  },
  {
    email: 'hr.manager@roshan.test',
    fullName: 'Hira Baig',
    school: 'roshan',
    role: 'hr_manager',
    branches: ['MC', 'CC'],
  },
  {
    email: 'payroll.officer@roshan.test',
    fullName: 'Faisal Mirza',
    school: 'roshan',
    role: 'payroll_officer',
    branches: ['MC', 'CC'],
  },
  {
    email: 'admissions.officer@roshan.test',
    fullName: 'Rabia Saleem',
    school: 'roshan',
    role: 'admissions_officer',
    branches: ['MC'],
  },
  {
    email: 'receptionist@roshan.test',
    fullName: 'Komal Shafiq',
    school: 'roshan',
    role: 'receptionist',
    branches: ['MC'],
  },
  {
    email: 'librarian@roshan.test',
    fullName: 'Abdul Waheed',
    school: 'roshan',
    role: 'librarian',
    branches: ['MC'],
  },
  {
    email: 'transport.manager@roshan.test',
    fullName: 'Rashid Mahmood',
    school: 'roshan',
    role: 'transport_manager',
    branches: ['MC'],
  },
  {
    email: 'driver@roshan.test',
    fullName: 'Naveed Ashraf',
    school: 'roshan',
    role: 'driver',
    branches: ['MC'],
  },
  {
    email: 'store.keeper@roshan.test',
    fullName: 'Arshad Anjum',
    school: 'roshan',
    role: 'store_keeper',
    branches: ['MC'],
  },
  {
    email: 'nurse@roshan.test',
    fullName: 'Shazia Parveen',
    school: 'roshan',
    role: 'nurse',
    branches: ['MC'],
  },
  {
    email: 'hostel.warden@roshan.test',
    fullName: 'Muhammad Akram',
    school: 'roshan',
    role: 'hostel_warden',
    branches: ['MC'],
  },
  {
    email: 'security.guard@roshan.test',
    fullName: 'Sher Zaman',
    school: 'roshan',
    role: 'security_guard',
    branches: ['MC'],
  },
  {
    email: 'it.admin@roshan.test',
    fullName: 'Hassan Jamil',
    school: 'roshan',
    role: 'it_admin',
    branches: ['MC', 'CC'],
  },
  // Families sign in with a phone number or an admission number from Phase 5 on. Until then these
  // have an email sign-in, so every portal can be opened: the father of the Ahmed family and his
  // daughter Maryam (6-B), a teacher who is also a parent here, and a parent with children in both schools.
  { email: 'guardian@roshan.test', fullName: 'Farhan Ahmed', school: 'roshan', role: 'guardian' },
  { email: 'student@roshan.test', fullName: 'Maryam Ahmed', school: 'roshan', role: 'student' },
  {
    email: 'teacher.parent@roshan.test',
    fullName: 'Sobia Arif',
    school: 'roshan',
    role: 'subject_teacher',
    branches: ['MC'],
    also: [{ school: 'roshan', role: 'guardian' }],
  },
  {
    email: 'guardian.both@roshan.test',
    fullName: 'Kashif Mehmood',
    school: 'roshan',
    role: 'guardian',
    also: [{ school: 'alnoor', role: 'guardian' }],
  },
];

/** The second tenant: small on purpose. It exists so that every isolation test has something it must not reach. */
export const alnoorAccounts: readonly SeedAccount[] = [
  { email: 'owner@alnoor.test', fullName: 'Yasmin Lakhani', school: 'alnoor', role: 'owner' },
  {
    email: 'accountant@alnoor.test',
    fullName: 'Junaid Memon',
    school: 'alnoor',
    role: 'accountant',
    branches: ['AN'],
  },
  {
    email: 'teacher@alnoor.test',
    fullName: 'Sana Dawood',
    school: 'alnoor',
    role: 'class_teacher',
    branches: ['AN'],
  },
  { email: 'guardian@alnoor.test', fullName: 'Rashid Memon', school: 'alnoor', role: 'guardian' },
  { email: 'student@alnoor.test', fullName: 'Zainab Memon', school: 'alnoor', role: 'student' },
];

export const seedAccounts: readonly SeedAccount[] = [...roshanAccounts, ...alnoorAccounts];
