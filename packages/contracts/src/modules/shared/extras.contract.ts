import { z } from 'zod';
import { LongText, Name, NameUr, QueryBool, ShortText } from '../../kernel/primitives';
import { baseEntity, defineResource, listQuery } from '../../kernel/resource';
import { EntityType } from './attachments.contract';
import { CustomFieldEntity, CustomFieldType, NoteVisibility } from './shared.constants';

/*
 * Custom fields, staff notes and saved views: docs/plan/10-modules/m00-shared-kernel.md.
 */

// ---------------------------------------------------------------------------------------------
// Custom fields
// ---------------------------------------------------------------------------------------------

const customFieldFields = {
  label: Name,
  labelUr: NameUr.nullable(),
  /** The choices of a `select` field. */
  options: z.array(ShortText.min(1)).min(1).max(50).nullable(),
  isRequired: z.boolean(),
  sortOrder: z.int().min(0).max(10_000),
  isActive: z.boolean(),
};

export const CustomField = z.object({
  ...baseEntity,
  entity: CustomFieldEntity,
  /** The name the value is kept under in the record's `custom` column. Lower case with underscores. */
  key: z.string(),
  fieldType: CustomFieldType,
  ...customFieldFields,
});
export type CustomField = z.output<typeof CustomField>;

export const CreateCustomField = z
  .object({
    id: z.uuid().optional(),
    entity: CustomFieldEntity,
    key: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/, 'Use lower-case letters, digits and underscores, starting with a letter')
      .max(40),
    fieldType: CustomFieldType,
    label: customFieldFields.label,
    labelUr: customFieldFields.labelUr.optional(),
    options: customFieldFields.options.optional(),
    isRequired: customFieldFields.isRequired.optional(),
    sortOrder: customFieldFields.sortOrder.optional(),
    isActive: customFieldFields.isActive.optional(),
  })
  .superRefine((field, context) => {
    const hasOptions = (field.options?.length ?? 0) > 0;
    if (field.fieldType === 'select' && !hasOptions)
      context.addIssue({ code: 'custom', path: ['options'], message: 'Give the choices of this list' });
    if (field.fieldType !== 'select' && hasOptions)
      context.addIssue({ code: 'custom', path: ['options'], message: 'Only a list has choices' });
  });
export type CreateCustomField = z.output<typeof CreateCustomField>;

/** What a field is for, its key and its type are fixed once it exists: values are already stored under them. */
export const UpdateCustomField = z
  .object(customFieldFields)
  .partial()
  .extend({ version: z.int() });
export type UpdateCustomField = z.output<typeof UpdateCustomField>;

export const ListCustomFields = listQuery({
  sortable: ['sortOrder', 'label', 'createdAt'],
  defaultSort: 'sortOrder',
  filters: { entity: CustomFieldEntity.optional(), isActive: QueryBool.optional() },
});
export type ListCustomFieldsParams = z.output<typeof ListCustomFields>;

export const customFieldsContract = defineResource({
  name: 'custom-fields',
  path: '/custom-fields',
  entity: CustomField,
  create: CreateCustomField,
  update: UpdateCustomField,
  list: ListCustomFields,
});

// ---------------------------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------------------------

const NoteBody = LongText.min(1, { error: 'Write the note' });

export const Note = z.object({
  ...baseEntity,
  entityType: z.string(),
  entityId: z.uuid(),
  body: z.string(),
  /** `staff`: every member of staff who can open the record. `leaders`: the leaders of the school only. */
  visibility: NoteVisibility,
  isPinned: z.boolean(),
  createdBy: z.uuid().nullable(),
  /** Who wrote it. */
  authorName: z.string().nullable(),
  /** Whether the person asking wrote it, and so may change or delete it. */
  mine: z.boolean(),
});
export type Note = z.output<typeof Note>;

export const ListNotes = z.strictObject({ entityType: EntityType, entityId: z.uuid() });
export type ListNotes = z.output<typeof ListNotes>;

export const CreateNote = z.object({
  entityType: EntityType,
  entityId: z.uuid(),
  body: NoteBody,
  visibility: NoteVisibility.optional(),
  isPinned: z.boolean().optional(),
});
export type CreateNote = z.output<typeof CreateNote>;

export const UpdateNote = z.object({
  version: z.int(),
  body: NoteBody.optional(),
  visibility: NoteVisibility.optional(),
  isPinned: z.boolean().optional(),
});
export type UpdateNote = z.output<typeof UpdateNote>;

// ---------------------------------------------------------------------------------------------
// Saved views
// ---------------------------------------------------------------------------------------------

/** Which list a view belongs to: `students`, `fee-vouchers.defaulters`. */
export const ListKey = z
  .string()
  .regex(/^[a-z][a-z0-9]*([.-][a-z0-9]+)*$/, 'Not the name of a list')
  .max(80);

/** The most views one person keeps for one list. */
export const MAX_SAVED_VIEWS = 30;

export const SavedView = z.object({
  ...baseEntity,
  listKey: z.string(),
  name: z.string(),
  /** The filters, sorting and columns as the list's screen wrote them. */
  filters: z.record(z.string(), z.unknown()),
  isDefault: z.boolean(),
});
export type SavedView = z.output<typeof SavedView>;

export const ListSavedViews = z.strictObject({ listKey: ListKey });
export type ListSavedViews = z.output<typeof ListSavedViews>;

export const CreateSavedView = z.object({
  listKey: ListKey,
  name: Name,
  filters: z.record(z.string(), z.unknown()),
  isDefault: z.boolean().optional(),
});
export type CreateSavedView = z.output<typeof CreateSavedView>;

export const UpdateSavedView = z.object({
  version: z.int(),
  name: Name.optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateSavedView = z.output<typeof UpdateSavedView>;
