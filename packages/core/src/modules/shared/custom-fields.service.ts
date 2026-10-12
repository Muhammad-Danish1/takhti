import { asc, eq } from 'drizzle-orm';
import {
  customFieldsContract,
  type CustomField,
  type CustomFieldEntity,
  type ListCustomFieldsParams,
} from '@takhti/contracts';
import { customFieldDefs } from '@takhti/db';
import { audit } from '../../kernel/audit';
import type { Ctx } from '../../kernel/context';
import { createCrudService } from '../../kernel/crud-service';
import { createDbService } from '../../kernel/db-service';
import { invalid, registerConstraintMessages } from '../../kernel/errors';
import { assertPermission } from '../../kernel/permissions';
import { checkCustomValues, type CustomFieldRule } from './custom-fields.rules';

/*
 * The extra fields a school adds to students, guardians, staff and admissions.
 * docs/plan/10-modules/m00-shared-kernel.md, rule R-shared-10.
 */

registerConstraintMessages({
  custom_field_defs_uq: { message: 'There is already a field with this key', field: 'key' },
});

export const customFieldsDb = createDbService<typeof customFieldDefs, ListCustomFieldsParams>(
  customFieldDefs,
  {
    label: 'Custom field',
    search: [customFieldDefs.label, customFieldDefs.key],
    sort: {
      sortOrder: customFieldDefs.sortOrder,
      label: customFieldDefs.label,
      createdAt: customFieldDefs.createdAt,
    },
    filters: (params) => [
      params.entity && eq(customFieldDefs.entity, params.entity),
      params.isActive !== undefined && eq(customFieldDefs.isActive, params.isActive),
    ],
  },
);

const crud = createCrudService({
  contract: customFieldsContract,
  db: customFieldsDb,
  // One permission covers creating and changing a field. A field is never deleted: see `deactivate`.
  actions: { create: 'update', update: 'update', delete: false },
  summary: (row, action) =>
    action === 'create' ? `Added the field ${row.label}` : `Changed the field ${row.label}`,
  rules: {
    beforeUpdate(_ctx, current, input) {
      const options = input.options === undefined ? current.options : input.options;
      const has = Array.isArray(options) && options.length > 0;
      if (current.fieldType === 'select' && !has)
        throw invalid({ options: ['Give the choices of this list'] });
      if (current.fieldType !== 'select' && has)
        throw invalid({ options: ['Only a list has choices'] });
    },
  },
});

export const customFieldsService = {
  ...crud,

  /**
   * Switches a field off. Records keep the values they hold under it; the field is no longer asked
   * for, shown or checked. It is not deleted, so that those values keep their meaning.
   */
  async deactivate(ctx: Ctx, id: string): Promise<CustomField> {
    assertPermission(ctx, 'custom-fields:update');
    const current = await customFieldsDb.get(ctx, id);
    if (!current.isActive) return customFieldsContract.entity.parse(current);
    const row = await customFieldsDb.update(ctx, id, { isActive: false });
    await audit(ctx, 'custom-fields', 'deactivate', id, {
      before: current,
      after: row,
      summary: `Switched off the field ${row.label}`,
    });
    return customFieldsContract.entity.parse(row);
  },

  /**
   * R-shared-10: for the service of a record that has custom fields. Returns the values to store,
   * or refuses with each problem under `custom.<key>`, where the form shows it.
   */
  async validate(
    ctx: Ctx,
    entity: CustomFieldEntity,
    given: Readonly<Record<string, unknown>> | null | undefined,
  ): Promise<Record<string, string | number | boolean>> {
    const definitions = await ctx.db
      .select()
      .from(customFieldDefs)
      .where(eq(customFieldDefs.entity, entity))
      .orderBy(asc(customFieldDefs.sortOrder));
    const rules: CustomFieldRule[] = definitions
      .filter((definition) => definition.deletedAt === null)
      .map((definition) => ({
        key: definition.key,
        label: definition.label,
        fieldType: definition.fieldType,
        options: Array.isArray(definition.options) ? (definition.options as string[]) : null,
        isRequired: definition.isRequired,
        isActive: definition.isActive,
      }));
    const { values, errors } = checkCustomValues(rules, given ?? {});
    const fields = Object.fromEntries(
      Object.entries(errors).map(([key, message]) => [`custom.${key}`, [message]]),
    );
    if (Object.keys(fields).length > 0) throw invalid(fields);
    return values;
  },
};
