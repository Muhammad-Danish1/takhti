import { index, integer, text, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { branchStatuses, genderPolicies } from '@takhti/contracts';
import { baseColumns, bindBranchesTable } from '../../kernel/base-columns';
import {
  dateStr,
  decimal,
  enumChecks,
  enumText,
  live,
  positive,
  table,
} from '../../kernel/columns';
import { memberRead, orgScoped } from '../../kernel/policies';
import { registerTable } from '../../registry';
import { boards } from '../setup/setup.table';
import { staff } from '../staff/staff.table';

/**
 * A campus. All staff of the group can see the list of branches; what they can do inside one
 * depends on their branch access. Families may read branch names and contact details.
 */
export const branches = table(
  'branches',
  {
    ...baseColumns,
    /** 2 to 5 capital letters or digits; used inside human-facing numbers. */
    code: text().notNull(),
    name: text().notNull(),
    nameUr: text(),
    address: text().notNull(),
    city: text().notNull(),
    phone: text(),
    email: text(),
    gender: enumText(genderPolicies).notNull().default('mixed'),
    principalStaffId: uuid().references((): AnyPgColumn => staff.id),
    regulatorName: text(),
    regulatorRegistrationNo: text(),
    regulatorExpiresOn: dateStr(),
    boardId: uuid().references((): AnyPgColumn => boards.id),
    boardAffiliationNo: text(),
    boardAffiliationExpiresOn: dateStr(),
    capacity: integer(),
    openedOn: dateStr(),
    latitude: decimal(9, 6),
    longitude: decimal(9, 6),
    status: enumText(branchStatuses).notNull().default('active'),
  },
  (t) => [
    ...enumChecks('branches', t),
    positive('branches', t.capacity),
    uniqueIndex('branches_code_uq').on(t.orgId, t.code).where(live(t)),
    index('branches_org_status_idx').on(t.orgId, t.status),
    ...orgScoped('branches', t),
    ...memberRead('branches', t),
  ],
);
registerTable(branches, 'branches', { module: 'M02', scope: 'org', member: 'read' });
bindBranchesTable(branches.id);
