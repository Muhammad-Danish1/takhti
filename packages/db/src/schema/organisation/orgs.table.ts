import { sql } from 'drizzle-orm';
import { integer, text, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { billingModes, locales, orgStatuses, provinces } from '@takhti/contracts';
import { bindOrgsTable } from '../../kernel/base-columns';
import {
  auditColumns,
  between,
  enumChecks,
  enumText,
  idColumn,
  live,
  table,
} from '../../kernel/columns';
import { customPolicy, policySql } from '../../kernel/policies';
import { registerTable } from '../../registry';
import { files } from '../shared/files.table';

/** One row per school group. This row's own `id` is the organisation id; it has no `org_id` column. */
export const orgs = table(
  'orgs',
  {
    id: idColumn(),
    ...auditColumns,
    name: text().notNull(),
    nameUr: text(),
    slug: text().notNull(),
    legalName: text(),
    logoFileId: uuid().references((): AnyPgColumn => files.id),
    ntn: text(),
    phone: text(),
    email: text(),
    website: text(),
    address: text(),
    city: text().notNull(),
    province: enumText(provinces).notNull(),
    academicYearStartMonth: integer().notNull().default(4),
    fiscalYearStartMonth: integer().notNull().default(7),
    defaultLocale: enumText(locales).notNull().default('en'),
    billingMode: enumText(billingModes).notNull().default('student'),
    status: enumText(orgStatuses).notNull(),
  },
  (t) => [
    ...enumChecks('orgs', t),
    between('orgs', t.academicYearStartMonth, 1, 12),
    between('orgs', t.fiscalYearStartMonth, 1, 12),
    // A slug is unique across the whole platform: it is the school code students sign in with.
    uniqueIndex('orgs_slug_uq').on(t.slug).where(live(t)),
    // Any member may read their own organisation's row; the service decides which columns a family user sees.
    customPolicy('orgs_member_read', {
      for: 'select',
      using: sql`${t.id} = (select app.org_id())`,
    }),
    // Staff may change it (the service checks `org:update`). Creating and closing an organisation is a platform action.
    customPolicy('orgs_staff_update', {
      for: 'update',
      using: sql`${t.id} = (select app.org_id()) and ${policySql.isStaff}`,
      withCheck: sql`${t.id} = (select app.org_id()) and ${policySql.isStaff}`,
    }),
  ],
);
bindOrgsTable(orgs.id);
registerTable(orgs, 'orgs', {
  module: 'M02',
  scope: 'org',
  orgColumn: 'id',
  staff: 'update',
  member: 'read',
});
