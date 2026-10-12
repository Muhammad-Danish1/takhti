import { describe, expect, it } from 'vitest';
import { renderTemplate, smsSize, unknownVariables, variablesIn } from './render';

describe('filling a template', () => {
  it('puts each value where its name is, however the braces are spaced', () => {
    expect(
      renderTemplate('{{schoolName}}: {{ studentNames }} was absent on {{date}}.', {
        schoolName: 'Roshan Public School',
        studentNames: 'Ali and Sara',
        date: '12 Oct',
      }),
    ).toEqual({
      text: 'Roshan Public School: Ali and Sara was absent on 12 Oct.',
      missing: [],
    });
  });

  it('a variable with no value is left out and reported, never sent as braces', () => {
    expect(
      renderTemplate('Dear {{guardianName}}, fees of {{amount}} are due.', { amount: 'Rs 8,500' }),
    ).toEqual({
      text: 'Dear, fees of Rs 8,500 are due.',
      missing: ['guardianName'],
    });
  });

  it('lists the variables a template uses, each once', () => {
    expect(variablesIn('{{a}} {{b}} {{a}} {{ c }}')).toEqual(['a', 'b', 'c']);
  });

  it('R-messaging-15 / F-messaging-7 names a variable the event does not provide', () => {
    expect(unknownVariables('{{studentName}} owes {{balance}}', ['studentName', 'amount'])).toEqual(
      ['balance'],
    );
    expect(unknownVariables('{{studentName}}', ['studentName'])).toEqual([]);
  });
});

describe('T-messaging-14 the size of a text message', () => {
  it('English fits 160 characters in one part, then 153 in each', () => {
    expect(smsSize('a'.repeat(160))).toEqual({ encoding: 'gsm', length: 160, parts: 1 });
    expect(smsSize('a'.repeat(161)).parts).toBe(2);
    expect(smsSize('a'.repeat(306)).parts).toBe(2);
    expect(smsSize('a'.repeat(307)).parts).toBe(3);
  });

  it('Urdu fits 70 characters in one part, then 67 in each', () => {
    const letter = 'ا';
    expect(smsSize(letter.repeat(70))).toEqual({ encoding: 'unicode', length: 70, parts: 1 });
    expect(smsSize(letter.repeat(71)).parts).toBe(2);
    expect(smsSize(letter.repeat(134)).parts).toBe(2);
    expect(smsSize(letter.repeat(135)).parts).toBe(3);
  });

  it('one Urdu letter makes the whole message count as Urdu', () => {
    expect(smsSize(`${'a'.repeat(70)}ا`)).toMatchObject({ encoding: 'unicode', parts: 2 });
  });

  it('a few signs take two places each in an English message', () => {
    expect(smsSize('[10]')).toEqual({ encoding: 'gsm', length: 6, parts: 1 });
  });
});
