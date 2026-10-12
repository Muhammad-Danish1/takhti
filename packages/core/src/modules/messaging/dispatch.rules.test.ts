import { describe, expect, it } from 'vitest';
import { joinNames } from './dispatch';
import {
  defaultWording,
  effectiveRules,
  isMuted,
  quietUntil,
  titleFromKey,
} from './dispatch.rules';

describe('R-messaging-6 quiet hours', () => {
  // Pakistan is five hours ahead of UTC.
  it.each([
    ['late evening waits for the next morning', '2026-10-12T17:30:00.000Z', '2026-10-13T03:00:00.000Z'],
    ['the first minute of quiet hours', '2026-10-12T16:00:00.000Z', '2026-10-13T03:00:00.000Z'],
    ['after midnight waits for the same morning', '2026-10-12T20:30:00.000Z', '2026-10-13T03:00:00.000Z'],
    ['early morning waits for the same morning', '2026-10-13T02:59:00.000Z', '2026-10-13T03:00:00.000Z'],
    ['the minute quiet hours end is not quiet', '2026-10-13T03:00:00.000Z', undefined],
    ['midday is not quiet', '2026-10-12T07:00:00.000Z', undefined],
    ['the minute before they start is not quiet', '2026-10-12T15:59:00.000Z', undefined],
  ])('%s', (_name, now, expected) => {
    expect(quietUntil(now, '21:00', '08:00')).toBe(expected);
  });

  it('quiet hours inside one day, and none at all', () => {
    expect(quietUntil('2026-10-12T08:30:00.000Z', '13:00:00', '15:00:00')).toBe(
      '2026-10-12T10:00:00.000Z',
    );
    expect(quietUntil('2026-10-12T10:00:00.000Z', '13:00', '15:00')).toBeUndefined();
    expect(quietUntil('2026-10-12T17:30:00.000Z', '00:00', '00:00')).toBeUndefined();
  });
});

describe('R-messaging-2 the rule that applies', () => {
  const definition = {
    rules: [
      { audience: 'guardians-of-student', channels: ['whatsapp', 'sms'] },
      { audience: 'class-teacher-of-section', channels: [] },
    ],
  } as const;
  const override = {
    audience: 'guardians-of-student',
    isEnabled: true,
    channels: ['sms', 'in_app', 'whatsapp'],
    alsoInApp: false,
    delayMinutes: 10,
    digest: 'none' as const,
  };

  it('without an override, the one in the catalogue', () => {
    expect(effectiveRules(definition, [])).toEqual([
      {
        audience: 'guardians-of-student',
        channels: ['whatsapp', 'sms'],
        roleKeys: [],
        inApp: true,
        delayMinutes: 0,
        digest: false,
      },
      {
        audience: 'class-teacher-of-section',
        channels: [],
        roleKeys: [],
        inApp: true,
        delayMinutes: 0,
        digest: false,
      },
    ]);
  });

  it('the school gives its own order of channels, its delay and its choice about the bell', () => {
    expect(effectiveRules(definition, [override])[0]).toEqual({
      audience: 'guardians-of-student',
      channels: ['sms', 'whatsapp'],
      roleKeys: [],
      inApp: false,
      delayMinutes: 10,
      digest: false,
    });
  });

  it('a rule switched off tells nobody, unless the event is compulsory or urgent', () => {
    const off = { ...override, isEnabled: false };
    expect(effectiveRules(definition, [off]).map((rule) => rule.audience)).toEqual([
      'class-teacher-of-section',
    ]);
    expect(effectiveRules({ ...definition, compulsory: true }, [off])).toHaveLength(2);
    expect(effectiveRules({ ...definition, urgent: true }, [off])[0]?.inApp).toBe(true);
  });

  it('a digest, by the event or by the rule of the school, is not sent one by one', () => {
    expect(effectiveRules({ ...definition, digest: 'daily' }, [])[0]?.digest).toBe(true);
    expect(effectiveRules(definition, [{ ...override, digest: 'daily' }])[0]?.digest).toBe(true);
  });
});

describe('R-messaging-7 mutes', () => {
  const mutes = new Set(['attendance:sms']);

  it('a muted category on a channel is muted there and nowhere else', () => {
    expect(isMuted({ category: 'attendance' }, 'sms', mutes)).toBe(true);
    expect(isMuted({ category: 'attendance' }, 'whatsapp', mutes)).toBe(false);
    expect(isMuted({ category: 'fees' }, 'sms', mutes)).toBe(false);
  });

  it('a compulsory or urgent event is never muted', () => {
    expect(isMuted({ category: 'attendance', compulsory: true }, 'sms', mutes)).toBe(false);
    expect(isMuted({ category: 'attendance', urgent: true }, 'sms', mutes)).toBe(false);
  });
});

describe('wording', () => {
  const templates = {
    in_app: {
      en: { title: 'Absent', body: 'b' },
      ur: { title: 'غیر حاضر', body: 'b' },
    },
    sms: { en: 'English text', ur: 'Urdu text' },
    email: {
      en: { subject: 'Subject', body: 'Body' },
      ur: { subject: 'Subject in Urdu', body: 'Body in Urdu' },
    },
  };

  it('the text in the catalogue for the channel and language', () => {
    expect(defaultWording(templates, 'sms', 'ur')).toEqual({ body: 'Urdu text' });
    expect(defaultWording(templates, 'in_app', 'en')).toEqual({ title: 'Absent', body: 'b' });
    expect(defaultWording(templates, 'email', 'en')).toEqual({ title: 'Subject', body: 'Body' });
    expect(defaultWording(templates, 'whatsapp', 'en')).toBeUndefined();
    expect(defaultWording(undefined, 'sms', 'en')).toBeUndefined();
  });

  it('an event with no wording yet still gets a title for the bell', () => {
    expect(titleFromKey('fee.payment-received')).toBe('Fee payment received');
  });

  it('names are joined as each language joins them', () => {
    expect(joinNames(['Ali'], 'en')).toBe('Ali');
    expect(joinNames(['Ali', 'Sara'], 'en')).toBe('Ali and Sara');
    expect(joinNames(['Ali', 'Sara', 'Hamza'], 'en')).toBe('Ali, Sara and Hamza');
    expect(joinNames(['A', 'B', 'C'], 'ur')).toBe('A، B اور C');
    expect(joinNames([], 'en')).toBe('');
  });
});
