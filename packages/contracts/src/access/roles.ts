/*
 * The 32 built-in roles and the role groups the module specifications use.
 * Source: docs/plan/00-foundation/06-tenancy-roles-and-access.md.
 * A school group can copy any role into a custom role; the keys here never change.
 */

export const roleLevels = [
  'platform',
  'group',
  'branch',
  'academics',
  'finance',
  'hr',
  'front',
  'operations',
  'family',
] as const;
export type RoleLevel = (typeof roleLevels)[number];

export const memberKinds = ['staff', 'guardian', 'student'] as const;
export type MemberKind = (typeof memberKinds)[number];

export interface BuiltInRole {
  key: string;
  name: string;
  nameUr: string;
  level: RoleLevel;
  /** Which kind of membership can hold it. Platform roles belong to Takhti's own staff. */
  kind: MemberKind | 'platform';
  /** Sees every branch by default. */
  allBranches: boolean;
}

export const builtInRoles = [
  {
    key: 'super_admin',
    name: 'Super Admin',
    nameUr: 'سپر ایڈمن',
    level: 'platform',
    kind: 'platform',
    allBranches: true,
  },
  {
    key: 'support_agent',
    name: 'Support Agent',
    nameUr: 'سپورٹ ایجنٹ',
    level: 'platform',
    kind: 'platform',
    allBranches: true,
  },
  {
    key: 'owner',
    name: 'Owner / CEO',
    nameUr: 'مالک',
    level: 'group',
    kind: 'staff',
    allBranches: true,
  },
  {
    key: 'director',
    name: 'Director',
    nameUr: 'ڈائریکٹر',
    level: 'group',
    kind: 'staff',
    allBranches: true,
  },
  {
    key: 'finance_head',
    name: 'Group Finance Head',
    nameUr: 'سربراہِ مالیات',
    level: 'group',
    kind: 'staff',
    allBranches: true,
  },
  {
    key: 'academic_head',
    name: 'Group Academic Head',
    nameUr: 'سربراہِ تعلیمات',
    level: 'group',
    kind: 'staff',
    allBranches: true,
  },
  {
    key: 'auditor',
    name: 'Auditor (read-only)',
    nameUr: 'آڈیٹر',
    level: 'group',
    kind: 'staff',
    allBranches: true,
  },
  {
    key: 'principal',
    name: 'Principal',
    nameUr: 'پرنسپل',
    level: 'branch',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'vice_principal',
    name: 'Vice Principal',
    nameUr: 'وائس پرنسپل',
    level: 'branch',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'branch_admin',
    name: 'Branch Admin',
    nameUr: 'برانچ ایڈمن',
    level: 'branch',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'section_head',
    name: 'Section Head',
    nameUr: 'سیکشن ہیڈ',
    level: 'branch',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'coordinator',
    name: 'Academic Coordinator',
    nameUr: 'تعلیمی کوآرڈینیٹر',
    level: 'academics',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'exam_controller',
    name: 'Exam Controller',
    nameUr: 'کنٹرولر امتحانات',
    level: 'academics',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'class_teacher',
    name: 'Class Teacher',
    nameUr: 'کلاس ٹیچر',
    level: 'academics',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'subject_teacher',
    name: 'Subject Teacher',
    nameUr: 'مضمون کے استاد',
    level: 'academics',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'counsellor',
    name: 'Counsellor',
    nameUr: 'کونسلر',
    level: 'academics',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'accountant',
    name: 'Accountant',
    nameUr: 'اکاؤنٹنٹ',
    level: 'finance',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'cashier',
    name: 'Cashier',
    nameUr: 'کیشیئر',
    level: 'finance',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'hr_manager',
    name: 'HR Manager',
    nameUr: 'ایچ آر مینیجر',
    level: 'hr',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'payroll_officer',
    name: 'Payroll Officer',
    nameUr: 'پے رول افسر',
    level: 'hr',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'admissions_officer',
    name: 'Admissions Officer',
    nameUr: 'داخلہ افسر',
    level: 'front',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'receptionist',
    name: 'Receptionist',
    nameUr: 'ریسپشنسٹ',
    level: 'front',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'librarian',
    name: 'Librarian',
    nameUr: 'لائبریرین',
    level: 'operations',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'transport_manager',
    name: 'Transport Manager',
    nameUr: 'ٹرانسپورٹ مینیجر',
    level: 'operations',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'driver',
    name: 'Driver / Attendant',
    nameUr: 'ڈرائیور',
    level: 'operations',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'store_keeper',
    name: 'Store Keeper',
    nameUr: 'اسٹور کیپر',
    level: 'operations',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'nurse',
    name: 'Nurse',
    nameUr: 'نرس',
    level: 'operations',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'hostel_warden',
    name: 'Hostel Warden',
    nameUr: 'ہاسٹل وارڈن',
    level: 'operations',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'security_guard',
    name: 'Security Guard',
    nameUr: 'سیکیورٹی گارڈ',
    level: 'operations',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'it_admin',
    name: 'IT Admin',
    nameUr: 'آئی ٹی ایڈمن',
    level: 'operations',
    kind: 'staff',
    allBranches: false,
  },
  {
    key: 'guardian',
    name: 'Parent / Guardian',
    nameUr: 'سرپرست',
    level: 'family',
    kind: 'guardian',
    allBranches: false,
  },
  {
    key: 'student',
    name: 'Student',
    nameUr: 'طالب علم',
    level: 'family',
    kind: 'student',
    allBranches: false,
  },
] as const satisfies readonly BuiltInRole[];

export type RoleKey = (typeof builtInRoles)[number]['key'];

export const roleKeys = builtInRoles.map((role) => role.key) as readonly RoleKey[];

const isRoleKey = (value: string): value is RoleKey =>
  (roleKeys as readonly string[]).includes(value);

/** Roles held by staff of a school group, from `owner` to `it_admin`. */
export const staffRoleKeys = builtInRoles
  .filter((role) => role.kind === 'staff')
  .map((role) => role.key) as readonly RoleKey[];

/** The shorthand the "Default roles" column of every Permissions table uses. */
export const roleGroups = {
  LEADERS: ['director', 'principal', 'vice_principal', 'branch_admin'],
  ADMINS: ['principal', 'branch_admin'],
  ACADEMIC: ['academic_head', 'section_head', 'coordinator', 'exam_controller'],
  TEACHERS: ['class_teacher', 'subject_teacher'],
  FINANCE: ['finance_head', 'accountant', 'cashier'],
  ACCOUNTS: ['finance_head', 'accountant'],
  HR: ['hr_manager', 'payroll_officer'],
  FRONT: ['admissions_officer', 'receptionist'],
  FAMILY: ['guardian', 'student'],
  ALL_STAFF: staffRoleKeys,
  PLATFORM: ['super_admin', 'support_agent'],
} as const satisfies Record<string, readonly RoleKey[]>;

export type RoleGroup = keyof typeof roleGroups;

/** A role key or a group name, as written in a module spec. */
export type RoleToken = RoleKey | RoleGroup;

/** Turns `['FINANCE', 'principal']` into the role keys it stands for, without repeats. */
export function expandRoles(tokens: readonly RoleToken[]): RoleKey[] {
  const keys = new Set<RoleKey>();
  for (const token of tokens) {
    if (isRoleKey(token)) keys.add(token);
    else for (const key of roleGroups[token]) keys.add(key);
  }
  return [...keys];
}

/**
 * Two roles are computed rather than stored:
 * the owner holds every permission; the auditor holds every permission whose action is
 * `read`, `reports` or `export`, except those that open health or counselling records.
 */
export const OWNER_ROLE: RoleKey = 'owner';
export const AUDITOR_ROLE: RoleKey = 'auditor';
export const auditorActions = ['read', 'reports', 'export'] as const;
