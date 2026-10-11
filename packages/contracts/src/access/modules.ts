/*
 * The modules of the product, as in docs/plan/00-foundation/01-product-and-scope.md.
 * `key` is the folder name every layer uses and the value stored in `org_modules.module_key`.
 * `tier` says how a module is sold and switched on: core modules cannot be switched off.
 */

export const moduleTiers = ['core', 'extended', 'optional'] as const;
export type ModuleTier = (typeof moduleTiers)[number];

export interface ModuleDef {
  key: string;
  /** The specification's number: `M21`. */
  code: `M${number}${number}`;
  name: string;
  tier: ModuleTier;
}

export const modules = [
  { key: 'shared', code: 'M00', name: 'Shared kernel', tier: 'core' },
  { key: 'platform', code: 'M01', name: 'Platform console', tier: 'core' },
  { key: 'organisation', code: 'M02', name: 'Organisation and branches', tier: 'core' },
  { key: 'identity', code: 'M03', name: 'Identity, roles and audit', tier: 'core' },
  { key: 'setup', code: 'M04', name: 'School setup', tier: 'core' },
  { key: 'integrations', code: 'M05', name: 'Integrations and API', tier: 'extended' },
  { key: 'admissions', code: 'M06', name: 'Admissions', tier: 'core' },
  { key: 'students', code: 'M07', name: 'Students', tier: 'core' },
  { key: 'certificates', code: 'M08', name: 'Certificates and ID cards', tier: 'extended' },
  { key: 'front-office', code: 'M09', name: 'Front office', tier: 'extended' },
  { key: 'alumni', code: 'M10', name: 'Alumni', tier: 'optional' },
  { key: 'academics', code: 'M11', name: 'Academic structure', tier: 'core' },
  { key: 'timetable', code: 'M12', name: 'Timetable', tier: 'core' },
  { key: 'syllabus', code: 'M13', name: 'Syllabus and lesson plans', tier: 'extended' },
  { key: 'attendance', code: 'M14', name: 'Student attendance', tier: 'core' },
  { key: 'homework', code: 'M15', name: 'Homework and diary', tier: 'core' },
  { key: 'lms', code: 'M16', name: 'Learning', tier: 'extended' },
  { key: 'exams', code: 'M17', name: 'Exams and marks', tier: 'core' },
  { key: 'results', code: 'M18', name: 'Results and report cards', tier: 'core' },
  { key: 'question-bank', code: 'M19', name: 'Question bank and papers', tier: 'extended' },
  { key: 'behaviour', code: 'M20', name: 'Behaviour and houses', tier: 'extended' },
  { key: 'fees', code: 'M21', name: 'Fees', tier: 'core' },
  { key: 'payments', code: 'M22', name: 'Online payments and reconciliation', tier: 'extended' },
  { key: 'accounting', code: 'M23', name: 'Accounting', tier: 'core' },
  { key: 'procurement', code: 'M24', name: 'Expenses and procurement', tier: 'extended' },
  { key: 'tax', code: 'M25', name: 'Tax and compliance', tier: 'extended' },
  { key: 'staff', code: 'M26', name: 'Staff and recruitment', tier: 'core' },
  { key: 'staff-attendance', code: 'M27', name: 'Staff attendance and leave', tier: 'core' },
  { key: 'payroll', code: 'M28', name: 'Payroll', tier: 'core' },
  { key: 'appraisal', code: 'M29', name: 'Appraisal and training', tier: 'optional' },
  { key: 'transport', code: 'M30', name: 'Transport', tier: 'extended' },
  { key: 'library', code: 'M31', name: 'Library', tier: 'extended' },
  { key: 'inventory', code: 'M32', name: 'Inventory and assets', tier: 'extended' },
  { key: 'shop', code: 'M33', name: 'Shop and canteen', tier: 'optional' },
  { key: 'health', code: 'M34', name: 'Health and clinic', tier: 'optional' },
  { key: 'hostel', code: 'M35', name: 'Hostel', tier: 'optional' },
  { key: 'maintenance', code: 'M36', name: 'Maintenance and helpdesk', tier: 'optional' },
  { key: 'messaging', code: 'M37', name: 'Messaging hub', tier: 'core' },
  { key: 'chat', code: 'M38', name: 'Chat and parent–teacher meetings', tier: 'extended' },
  { key: 'notices', code: 'M39', name: 'Notices, events and calendar', tier: 'core' },
  { key: 'feedback', code: 'M40', name: 'Complaints and surveys', tier: 'extended' },
  { key: 'website', code: 'M41', name: 'School website', tier: 'optional' },
  { key: 'reports', code: 'M42', name: 'Dashboards and reports', tier: 'core' },
  { key: 'hq', code: 'M43', name: 'Owner analytics', tier: 'extended' },
  { key: 'ai', code: 'M44', name: 'AI suite', tier: 'extended' },
] as const satisfies readonly ModuleDef[];

export type ModuleKey = (typeof modules)[number]['key'];

export const moduleKeys = modules.map((module) => module.key) as readonly ModuleKey[];

/** Core modules are part of every plan and cannot be switched off. */
export const coreModuleKeys = modules
  .filter((module) => module.tier === 'core')
  .map((module) => module.key) as readonly ModuleKey[];

export const isModuleKey = (value: string): value is ModuleKey =>
  (moduleKeys as readonly string[]).includes(value);
