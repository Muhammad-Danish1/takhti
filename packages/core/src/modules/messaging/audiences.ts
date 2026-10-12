import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import type { Audience, Locale } from '@takhti/contracts';
import {
  enrollments,
  families,
  guardians,
  membershipBranches,
  membershipRoles,
  memberships,
  profiles,
  roles,
  sectionSubjects,
  sections,
  staff,
  studentGuardians,
  students,
} from '@takhti/db';
import type { Ctx } from '../../kernel/context';
import { isUuid } from '../../kernel/ids';

/*
 * Who is told: each audience of the notification catalogue, turned into people.
 * docs/plan/30-reference/notification-catalogue.md ("Audiences"), M37 rule R-messaging-5.
 *
 * A resolver reads what it needs from the event's payload by name: `studentId` or `studentIds`,
 * `familyId`, `sectionId` or `sectionIds`, `staffId` or `staffIds`, `branchId`, `userId` or
 * `userIds`. An event that lacks what its audience needs reaches nobody, and dispatch says so in
 * the log.
 *
 * Dispatch runs as the system inside one school, so every query here is already confined to it.
 */

export interface Recipient {
  /** One person, however many audiences found them: `guardian:<id>`, `staff:<id>`, `user:<id>`. */
  key: string;
  kind: 'guardian' | 'staff' | 'student' | 'user';
  /** Their login, when they have one. Without it there is no bell to write to. */
  userId: string | null;
  guardianId: string | null;
  staffId: string | null;
  familyId: string | null;
  /** The children this message is about, for a guardian or a student. */
  studentIds: string[];
  name: string;
  locale: Locale;
  /** For SMS. */
  phone: string | null;
  /** For WhatsApp: their WhatsApp number when it differs from the phone. */
  whatsapp: string | null;
  email: string | null;
}

export interface AudienceRequest {
  payload: Readonly<Record<string, unknown>>;
  /** For `role-at-branch` and `role-in-org`. */
  roleKeys: readonly string[];
}

export type AudienceResolver = (ctx: Ctx, request: AudienceRequest) => Promise<Recipient[]>;

/** The ids under a name in a payload: one (`studentId`) or several (`studentIds`). Anything that is not an id is ignored. */
function idsIn(payload: Readonly<Record<string, unknown>>, name: string): string[] {
  const found: string[] = [];
  for (const value of [payload[name], payload[`${name}s`]].flat()) {
    if (typeof value === 'string' && isUuid(value) && !found.includes(value)) found.push(value);
  }
  return found;
}

/** The login of each person, when they have an active one. */
async function loginsOf(
  ctx: Ctx,
  column: 'guardianId' | 'staffId' | 'studentId',
  personIds: readonly string[],
): Promise<Map<string, string>> {
  if (personIds.length === 0) return new Map();
  const rows = await ctx.db
    .select({ personId: memberships[column], userId: memberships.userId })
    .from(memberships)
    .where(
      and(
        inArray(memberships[column], [...personIds]),
        eq(memberships.status, 'active'),
        isNull(memberships.deletedAt),
      ),
    );
  return new Map(rows.flatMap((row) => (row.personId ? [[row.personId, row.userId]] : [])));
}

/**
 * R-messaging-5: for each student, the guardians marked to receive messages; the primary contact
 * when none is marked. A guardian of several of the students is one recipient, with all of them.
 */
export async function guardiansOfStudents(
  ctx: Ctx,
  studentIds: readonly string[],
): Promise<Recipient[]> {
  if (studentIds.length === 0) return [];
  const links = await ctx.db
    .select({
      studentId: studentGuardians.studentId,
      receivesMessages: studentGuardians.receivesMessages,
      isPrimary: studentGuardians.isPrimary,
      guardian: guardians,
    })
    .from(studentGuardians)
    .innerJoin(guardians, eq(guardians.id, studentGuardians.guardianId))
    .where(
      and(
        inArray(studentGuardians.studentId, [...studentIds]),
        isNull(studentGuardians.deletedAt),
        isNull(guardians.deletedAt),
        eq(guardians.isDeceased, false),
      ),
    );

  const chosen = new Map<string, { guardian: (typeof links)[number]['guardian']; studentIds: string[] }>();
  for (const studentId of studentIds) {
    const mine = links.filter((link) => link.studentId === studentId);
    const marked = mine.filter((link) => link.receivesMessages);
    for (const link of marked.length > 0 ? marked : mine.filter((item) => item.isPrimary)) {
      const entry = chosen.get(link.guardian.id) ?? { guardian: link.guardian, studentIds: [] };
      if (!entry.studentIds.includes(studentId)) entry.studentIds.push(studentId);
      chosen.set(link.guardian.id, entry);
    }
  }

  const logins = await loginsOf(ctx, 'guardianId', [...chosen.keys()]);
  return [...chosen.values()].map(({ guardian, studentIds: children }) => ({
    key: `guardian:${guardian.id}`,
    kind: 'guardian' as const,
    userId: logins.get(guardian.id) ?? null,
    guardianId: guardian.id,
    staffId: null,
    familyId: guardian.familyId,
    studentIds: children,
    name: guardian.fullName,
    locale: guardian.preferredLocale,
    phone: guardian.phone,
    whatsapp: guardian.whatsappPhone ?? guardian.phone,
    email: guardian.email,
  }));
}

/** Staff as recipients. Someone who has left is told nothing. */
export async function staffRecipients(ctx: Ctx, staffIds: readonly string[]): Promise<Recipient[]> {
  if (staffIds.length === 0) return [];
  const rows = await ctx.db
    .select({
      id: staff.id,
      fullName: staff.fullName,
      workPhone: staff.workPhone,
      workEmail: staff.workEmail,
    })
    .from(staff)
    .where(
      and(inArray(staff.id, [...new Set(staffIds)]), ne(staff.status, 'left'), isNull(staff.deletedAt)),
    );
  const logins = await loginsOf(
    ctx,
    'staffId',
    rows.map((row) => row.id),
  );
  const contacts = await contactsOf(ctx, [...logins.values()]);
  return rows.map((row) => {
    const userId = logins.get(row.id) ?? null;
    const contact = userId ? contacts.get(userId) : undefined;
    return {
      key: `staff:${row.id}`,
      kind: 'staff' as const,
      userId,
      guardianId: null,
      staffId: row.id,
      familyId: null,
      studentIds: [],
      name: row.fullName,
      // A job cannot read another person's interface language; staff are written to in English
      // until identity gives a way (docs/STATUS.md, "Left out on purpose").
      locale: 'en' as const,
      phone: row.workPhone ?? contact?.phone ?? null,
      whatsapp: row.workPhone ?? contact?.phone ?? null,
      email: row.workEmail ?? contact?.email ?? null,
    };
  });
}

async function contactsOf(
  ctx: Ctx,
  userIds: readonly string[],
): Promise<Map<string, { fullName: string; email: string | null; phone: string | null }>> {
  if (userIds.length === 0) return new Map();
  const rows = await ctx.db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      email: profiles.email,
      phone: profiles.phone,
    })
    .from(profiles)
    .where(inArray(profiles.id, [...new Set(userIds)]));
  return new Map(rows.map((row) => [row.id, row]));
}

/** Logins as recipients: for `user`, `requester` and `owner-of-record`. A login that is staff or a guardian here is told as that person. */
async function userRecipients(ctx: Ctx, userIds: readonly string[]): Promise<Recipient[]> {
  if (userIds.length === 0) return [];
  const mine = await ctx.db
    .select({
      userId: memberships.userId,
      staffId: memberships.staffId,
      guardianId: memberships.guardianId,
    })
    .from(memberships)
    .where(
      and(
        inArray(memberships.userId, [...new Set(userIds)]),
        eq(memberships.status, 'active'),
        isNull(memberships.deletedAt),
      ),
    );
  const staffIds = mine.flatMap((row) => (row.staffId ? [row.staffId] : []));
  const asStaff = await staffRecipients(ctx, staffIds);
  const known = new Set(asStaff.map((recipient) => recipient.userId));
  const others = [...new Set(mine.map((row) => row.userId))].filter((id) => !known.has(id));
  const contacts = await contactsOf(ctx, others);
  return [
    ...asStaff,
    ...others.flatMap((userId) => {
      const contact = contacts.get(userId);
      if (!contact) return [];
      const guardianId = mine.find((row) => row.userId === userId)?.guardianId ?? null;
      return [
        {
          key: guardianId ? `guardian:${guardianId}` : `user:${userId}`,
          kind: guardianId ? ('guardian' as const) : ('user' as const),
          userId,
          guardianId,
          staffId: null,
          familyId: null,
          studentIds: [],
          name: contact.fullName,
          locale: 'en' as const,
          phone: contact.phone,
          whatsapp: contact.phone,
          email: contact.email,
        },
      ];
    }),
  ];
}

/** Everyone holding one of the roles, at a branch or in the whole organisation. */
async function roleHolders(
  ctx: Ctx,
  roleKeys: readonly string[],
  branchId: string | undefined,
): Promise<Recipient[]> {
  if (roleKeys.length === 0) return [];
  const held = await ctx.db
    .select({
      membershipId: memberships.id,
      staffId: memberships.staffId,
      allBranches: memberships.allBranches,
    })
    .from(membershipRoles)
    .innerJoin(roles, eq(roles.id, membershipRoles.roleId))
    .innerJoin(memberships, eq(memberships.id, membershipRoles.membershipId))
    .where(
      and(
        inArray(roles.key, [...roleKeys]),
        eq(memberships.status, 'active'),
        eq(memberships.kind, 'staff'),
        isNull(membershipRoles.deletedAt),
        isNull(memberships.deletedAt),
        isNull(roles.deletedAt),
      ),
    );
  let reaching = held;
  if (branchId) {
    const limited = held.filter((row) => !row.allBranches).map((row) => row.membershipId);
    const atBranch =
      limited.length === 0
        ? []
        : await ctx.db
            .select({ membershipId: membershipBranches.membershipId })
            .from(membershipBranches)
            .where(
              and(
                inArray(membershipBranches.membershipId, limited),
                eq(membershipBranches.branchId, branchId),
                isNull(membershipBranches.deletedAt),
              ),
            );
    const here = new Set(atBranch.map((row) => row.membershipId));
    reaching = held.filter((row) => row.allBranches || here.has(row.membershipId));
  }
  return staffRecipients(
    ctx,
    reaching.flatMap((row) => (row.staffId ? [row.staffId] : [])),
  );
}

async function studentsOfSections(ctx: Ctx, sectionIds: readonly string[]): Promise<string[]> {
  if (sectionIds.length === 0) return [];
  const rows = await ctx.db
    .select({ studentId: enrollments.studentId })
    .from(enrollments)
    .where(
      and(
        inArray(enrollments.sectionId, [...sectionIds]),
        eq(enrollments.status, 'active'),
        isNull(enrollments.deletedAt),
      ),
    );
  return [...new Set(rows.map((row) => row.studentId))];
}

const resolvers: Record<Audience, AudienceResolver> = {
  'guardians-of-student': (ctx, { payload }) => guardiansOfStudents(ctx, idsIn(payload, 'studentId')),

  async 'guardians-of-family'(ctx, { payload }) {
    const [familyId] = idsIn(payload, 'familyId');
    if (!familyId) return [];
    // The children the event names, else every child of the family still at the school.
    let children = idsIn(payload, 'studentId');
    if (children.length === 0) {
      const rows = await ctx.db
        .select({ id: students.id })
        .from(students)
        .where(
          and(
            eq(students.familyId, familyId),
            inArray(students.status, ['active', 'on_leave', 'suspended']),
            isNull(students.deletedAt),
          ),
        );
      children = rows.map((row) => row.id);
    }
    const found = await guardiansOfStudents(ctx, children);
    if (found.length > 0) return found;
    // A family with no child at the school (an applicant's, or one that has left): its primary contact.
    const [family] = await ctx.db
      .select({ primaryGuardianId: families.primaryGuardianId })
      .from(families)
      .where(eq(families.id, familyId))
      .limit(1);
    const rows = await ctx.db
      .select()
      .from(guardians)
      .where(
        and(
          eq(guardians.familyId, familyId),
          isNull(guardians.deletedAt),
          eq(guardians.isDeceased, false),
          family?.primaryGuardianId ? eq(guardians.id, family.primaryGuardianId) : undefined,
        ),
      )
      .limit(1);
    const logins = await loginsOf(
      ctx,
      'guardianId',
      rows.map((row) => row.id),
    );
    return rows.map((guardian) => ({
      key: `guardian:${guardian.id}`,
      kind: 'guardian' as const,
      userId: logins.get(guardian.id) ?? null,
      guardianId: guardian.id,
      staffId: null,
      familyId,
      studentIds: [],
      name: guardian.fullName,
      locale: guardian.preferredLocale,
      phone: guardian.phone,
      whatsapp: guardian.whatsappPhone ?? guardian.phone,
      email: guardian.email,
    }));
  },

  'guardians-of-section': async (ctx, { payload }) =>
    guardiansOfStudents(ctx, await studentsOfSections(ctx, idsIn(payload, 'sectionId'))),

  async student(ctx, { payload }) {
    const studentIds = idsIn(payload, 'studentId');
    if (studentIds.length === 0) return [];
    const rows = await ctx.db
      .select({
        id: students.id,
        fullName: students.fullName,
        familyId: students.familyId,
        phone: students.phone,
      })
      .from(students)
      .where(and(inArray(students.id, studentIds), isNull(students.deletedAt)));
    const logins = await loginsOf(ctx, 'studentId', studentIds);
    // A student is told in their own portal, so one without a login is not a recipient.
    return rows.flatMap((row) => {
      const userId = logins.get(row.id);
      if (!userId) return [];
      return [
        {
          key: `student:${row.id}`,
          kind: 'student' as const,
          userId,
          guardianId: null,
          staffId: null,
          familyId: row.familyId,
          studentIds: [row.id],
          name: row.fullName,
          locale: 'en' as const,
          phone: row.phone,
          whatsapp: row.phone,
          email: null,
        },
      ];
    });
  },

  async 'class-teacher-of-section'(ctx, { payload }) {
    const sectionIds = idsIn(payload, 'sectionId');
    if (sectionIds.length === 0) return [];
    const rows = await ctx.db
      .select({ classTeacherId: sections.classTeacherId })
      .from(sections)
      .where(and(inArray(sections.id, sectionIds), isNull(sections.deletedAt)));
    return staffRecipients(
      ctx,
      rows.flatMap((row) => (row.classTeacherId ? [row.classTeacherId] : [])),
    );
  },

  async 'teachers-of-section'(ctx, { payload }) {
    const sectionIds = idsIn(payload, 'sectionId');
    if (sectionIds.length === 0) return [];
    const [subjectTeachers, classTeachers] = [
      await ctx.db
        .select({ staffId: sectionSubjects.teacherId })
        .from(sectionSubjects)
        .where(and(inArray(sectionSubjects.sectionId, sectionIds), isNull(sectionSubjects.deletedAt))),
      await ctx.db
        .select({ staffId: sections.classTeacherId })
        .from(sections)
        .where(and(inArray(sections.id, sectionIds), isNull(sections.deletedAt))),
    ];
    return staffRecipients(
      ctx,
      [...subjectTeachers, ...classTeachers].flatMap((row) => (row.staffId ? [row.staffId] : [])),
    );
  },

  staff: (ctx, { payload }) => staffRecipients(ctx, idsIn(payload, 'staffId')),

  async 'manager-of-staff'(ctx, { payload }) {
    const staffIds = idsIn(payload, 'staffId');
    if (staffIds.length === 0) return [];
    const rows = await ctx.db
      .select({ managerId: staff.reportsToStaffId })
      .from(staff)
      .where(and(inArray(staff.id, staffIds), isNull(staff.deletedAt)));
    return staffRecipients(
      ctx,
      rows.flatMap((row) => (row.managerId ? [row.managerId] : [])),
    );
  },

  'role-at-branch': (ctx, { payload, roleKeys }) =>
    roleHolders(ctx, roleKeys, idsIn(payload, 'branchId')[0]),
  'role-in-org': (ctx, { roleKeys }) => roleHolders(ctx, roleKeys, undefined),

  user: (ctx, { payload }) => userRecipients(ctx, idsIn(payload, 'userId')),
  requester: (ctx, { payload }) =>
    userRecipients(ctx, [...idsIn(payload, 'requestedBy'), ...idsIn(payload, 'requesterUserId')]),
  'owner-of-record': async (ctx, { payload }) => [
    ...(await userRecipients(ctx, idsIn(payload, 'ownerUserId'))),
    ...(await staffRecipients(ctx, idsIn(payload, 'ownerStaffId'))),
  ],
  // The approvals service names the people who may decide the step that is waiting.
  'approvers-of-request': (ctx, { payload }) => userRecipients(ctx, idsIn(payload, 'approverUserId')),
  // Takhti's own staff are told by the platform's services, not through a school's dispatch.
  'platform-staff': async () => [],
};

/**
 * The people an audience stands for. The same person found twice (a guardian of two of the students)
 * is one recipient with both children.
 */
export async function resolveAudience(
  ctx: Ctx,
  audience: string,
  request: AudienceRequest,
): Promise<Recipient[]> {
  const resolver = resolvers[audience as Audience] as AudienceResolver | undefined;
  if (!resolver) {
    ctx.log.warn({ audience }, 'an event names an audience nothing can resolve');
    return [];
  }
  return mergeRecipients(await resolver(ctx, request));
}

/** One entry for each person, keeping every child any entry named. */
export function mergeRecipients(found: readonly Recipient[]): Recipient[] {
  const byKey = new Map<string, Recipient>();
  for (const recipient of found) {
    const existing = byKey.get(recipient.key);
    if (!existing) {
      byKey.set(recipient.key, { ...recipient, studentIds: [...recipient.studentIds] });
      continue;
    }
    for (const studentId of recipient.studentIds)
      if (!existing.studentIds.includes(studentId)) existing.studentIds.push(studentId);
  }
  return [...byKey.values()];
}

/** The names of students, for `{{studentName}}` and `{{studentNames}}`. */
export async function studentNames(
  ctx: Ctx,
  studentIds: readonly string[],
): Promise<Map<string, { en: string; ur: string }>> {
  if (studentIds.length === 0) return new Map();
  const rows = await ctx.db
    .select({ id: students.id, fullName: students.fullName, fullNameUr: students.fullNameUr })
    .from(students)
    .where(inArray(students.id, [...new Set(studentIds)]));
  return new Map(
    rows.map((row) => [row.id, { en: row.fullName, ur: row.fullNameUr ?? row.fullName }]),
  );
}
