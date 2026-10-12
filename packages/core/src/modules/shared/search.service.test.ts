import { describe, expect, it } from 'vitest';
import { phonePatternOf, toSearchTerm } from './search.service';

describe('what was typed into the search box', () => {
  it.each([
    ['0300 1234567', '%3001234567%'],
    ['0300-1234567', '%3001234567%'],
    ['+92 300 1234567', '%3001234567%'],
    ['00923001234567', '%3001234567%'],
    ['923001234567', '%923001234567%'],
    ['1234567', '%1234567%'],
    ['4567', '%4567%'],
  ])('%s is a phone number, looked for as %s', (typed, pattern) => {
    expect(phonePatternOf(typed)).toBe(pattern);
  });

  it.each(['456', '0300', 'TV-2610-000123', 'zainab', '35202-7654321-8x', ''])(
    '%s is not looked for as a phone number',
    (typed) => {
      expect(phonePatternOf(typed)).toBeNull();
    },
  );

  it('is trimmed, has its spaces collapsed and its wildcards made plain text', () => {
    expect(toSearchTerm('  zainab   raza ')).toMatchObject({
      text: 'zainab raza',
      pattern: '%zainab raza%',
      phonePattern: null,
      limit: 8,
    });
    expect(toSearchTerm('50%_off').pattern).toBe('%50\\%\\_off%');
  });
});
