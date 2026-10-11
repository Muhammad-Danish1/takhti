/*
 * Capabilities are short flags derived from permissions. Row-level security checks them on the few
 * tables that deserve a second wall in the database: salaries, staff private details, health records,
 * counselling notes and examination papers before their exam.
 * Source: docs/plan/00-foundation/06-tenancy-roles-and-access.md.
 */

export const capabilities = ['hr', 'payroll', 'health', 'counselling', 'papers'] as const;
export type Capability = (typeof capabilities)[number];

/** A capability is held by anyone with at least one of these permissions. */
export const capabilityPermissions: Record<Capability, readonly string[]> = {
  hr: ['staff-private:read', 'staff:manage'],
  payroll: ['payroll:read', 'payroll:run', 'salary-structures:manage'],
  health: ['health:read', 'clinic:manage'],
  // A counsellor reaches their own notes as the person who wrote them; only this permission opens the rest.
  counselling: ['counselling:read-all'],
  // Whoever approves papers, or may see every paper, reads a confidential paper before its exam.
  papers: ['question-papers:read-all', 'question-papers:approve'],
};

/** The capabilities a set of permissions gives. */
export function capabilitiesFor(permissions: ReadonlySet<string>): Capability[] {
  return capabilities.filter((capability) =>
    capabilityPermissions[capability].some((key) => permissions.has(key)),
  );
}

/** Permissions the computed auditor role must not receive, although their action is `read`. */
export const auditorExcludedPermissions: ReadonlySet<string> = new Set([
  ...capabilityPermissions.health,
  ...capabilityPermissions.counselling,
]);
