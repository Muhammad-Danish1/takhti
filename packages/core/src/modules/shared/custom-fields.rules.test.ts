import { describe, expect, it } from 'vitest';
import { checkCustomValues, type CustomFieldRule } from './custom-fields.rules';

const field = (key: string, overrides: Partial<CustomFieldRule> = {}): CustomFieldRule => ({
  key,
  label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
  fieldType: 'text',
  options: null,
  isRequired: false,
  isActive: true,
  ...overrides,
});

const definitions = [
  field('previous_school'),
  field('siblings', { fieldType: 'number' }),
  field('vaccinated_on', { fieldType: 'date' }),
  field('house_colour', { fieldType: 'select', options: ['Red', 'Blue'] }),
  field('needs_transport', { fieldType: 'bool' }),
  field('hifz_status', { isRequired: true }),
  field('old_field', { isRequired: true, isActive: false }),
];

describe('T-shared-10 custom field values', () => {
  it('R-shared-10 a value of each type is kept in the shape of its type', () => {
    expect(
      checkCustomValues(definitions, {
        previous_school: '  City Grammar  ',
        siblings: '3',
        vaccinated_on: '2026-03-14',
        house_colour: 'Blue',
        needs_transport: false,
        hifz_status: 'Nazra complete',
      }),
    ).toEqual({
      values: {
        previous_school: 'City Grammar',
        siblings: 3,
        vaccinated_on: '2026-03-14',
        house_colour: 'Blue',
        needs_transport: false,
        hifz_status: 'Nazra complete',
      },
      errors: {},
    });
  });

  it('R-shared-10 a required field that is empty blocks saving, by name', () => {
    expect(checkCustomValues(definitions, {}).errors).toEqual({
      hifz_status: 'Hifz status is required',
    });
    expect(checkCustomValues(definitions, { hifz_status: '   ' }).errors).toEqual({
      hifz_status: 'Hifz status is required',
    });
  });

  it.each([
    ['a number that is not one', { siblings: 'three' }, { siblings: 'Siblings must be a number' }],
    [
      'a date that does not exist',
      { vaccinated_on: '2026-02-30' },
      { vaccinated_on: 'Vaccinated on must be a date' },
    ],
    [
      'a choice that is not offered',
      { house_colour: 'Green' },
      { house_colour: 'House colour: choose one of Red, Blue' },
    ],
    [
      'a yes or no that is neither',
      { needs_transport: 'yes' },
      { needs_transport: 'Needs transport must be yes or no' },
    ],
    ['text that is not text', { previous_school: 42 }, { previous_school: 'Previous school must be text' }],
  ])('%s is refused under its own field', (_name, given, errors) => {
    expect(checkCustomValues(definitions, { hifz_status: 'x', ...given }).errors).toEqual(errors);
  });

  it('a field that is switched off is neither required nor kept, and an unknown key is ignored', () => {
    const { values, errors } = checkCustomValues(definitions, {
      hifz_status: 'x',
      old_field: 'still here',
      never_defined: 'anything',
    });
    expect(errors).toEqual({});
    expect(values).toEqual({ hifz_status: 'x' });
  });

  it('zero and "no" are values, not empty', () => {
    const { values } = checkCustomValues(definitions, {
      hifz_status: 'x',
      siblings: 0,
      needs_transport: false,
    });
    expect(values).toMatchObject({ siblings: 0, needs_transport: false });
  });
});
