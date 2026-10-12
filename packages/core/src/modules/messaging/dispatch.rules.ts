import type {
  EventDef,
  EventTemplates,
  Locale,
  NotificationChannel,
  OutsideChannel,
} from '@takhti/contracts';
import { addDays, pkToIso, timePk, todayPk } from '../../kernel/dates';

/*
 * The decisions of notification dispatch that need no database:
 * docs/plan/10-modules/m37-messaging-hub.md, rules R-messaging-2, 6 and 7.
 */

/**
 * When quiet hours end, if the given moment is inside them; otherwise undefined.
 * Times are Pakistan time of day (`21:00` to `08:00` runs through midnight). Equal times mean no quiet hours.
 */
export function quietUntil(now: string, quietFrom: string, quietTo: string): string | undefined {
  const from = quietFrom.slice(0, 5);
  const to = quietTo.slice(0, 5);
  if (from === to) return undefined;
  const time = timePk(now);
  const today = todayPk(now);
  if (from < to) return time >= from && time < to ? pkToIso(today, to) : undefined;
  // Through midnight: late evening ends tomorrow morning, early morning ends this morning.
  if (time >= from) return pkToIso(addDays(today, 1), to);
  if (time < to) return pkToIso(today, to);
  return undefined;
}

/** A rule as dispatch uses it: the catalogue's default, with the organisation's changes laid over it. */
export interface EffectiveRule {
  audience: string;
  channels: OutsideChannel[];
  roleKeys: readonly string[];
  inApp: boolean;
  delayMinutes: number;
  /** Collected into a daily message by `notify.digests`, not sent one by one. */
  digest: boolean;
}

export interface RuleOverride {
  audience: string;
  isEnabled: boolean;
  channels: readonly string[];
  alsoInApp: boolean;
  delayMinutes: number;
  digest: 'none' | 'daily';
}

const outside: readonly string[] = ['push', 'whatsapp', 'sms', 'email'];

/**
 * R-messaging-2: the organisation's rule where it has one, else the catalogue's.
 * A rule the organisation switched off tells nobody, unless the event is compulsory or urgent:
 * a receipt or a safety message cannot be switched off.
 */
export function effectiveRules(
  definition: Pick<EventDef, 'rules' | 'compulsory' | 'urgent' | 'digest'>,
  overrides: readonly RuleOverride[],
): EffectiveRule[] {
  const mustTell = definition.compulsory === true || definition.urgent === true;
  const rules: EffectiveRule[] = [];
  for (const rule of definition.rules) {
    const override = overrides.find((candidate) => candidate.audience === rule.audience);
    if (override && !override.isEnabled && !mustTell) continue;
    rules.push({
      audience: rule.audience,
      channels: (override
        ? override.channels.filter((channel) => outside.includes(channel))
        : [...rule.channels]) as OutsideChannel[],
      roleKeys: rule.roleKeys ?? [],
      inApp: override ? override.alsoInApp || mustTell : true,
      delayMinutes: override?.delayMinutes ?? 0,
      digest: (override ? override.digest === 'daily' : false) || definition.digest !== undefined,
    });
  }
  return rules;
}

/** R-messaging-7: a person may mute a category on a channel, except for an event that is compulsory or urgent. */
export function isMuted(
  definition: Pick<EventDef, 'category' | 'compulsory' | 'urgent'>,
  channel: NotificationChannel,
  mutes: ReadonlySet<string>,
): boolean {
  if (definition.compulsory || definition.urgent) return false;
  return mutes.has(`${definition.category}:${channel}`);
}

export interface Wording {
  /** The in-app title, the email subject or the push title. */
  title?: string;
  body: string;
}

/** The catalogue's wording for a channel in a language, or in the other language when that one is missing. */
export function defaultWording(
  templates: EventTemplates | undefined,
  channel: NotificationChannel,
  locale: Locale,
): Wording | undefined {
  const other: Locale = locale === 'en' ? 'ur' : 'en';
  const pick = <T>(set: Record<Locale, T> | undefined): T | undefined =>
    set?.[locale] ?? set?.[other];
  if (!templates) return undefined;
  if (channel === 'whatsapp' || channel === 'sms') {
    const body = pick(templates[channel]);
    return body === undefined ? undefined : { body };
  }
  if (channel === 'email') {
    const email = pick(templates.email);
    return email && { title: email.subject, body: email.body };
  }
  const titled = pick(templates[channel]);
  return titled && { title: titled.title, body: titled.body };
}

/** `fee.payment-received` as a title when an event has no wording yet: "Fee payment received". */
export function titleFromKey(key: string): string {
  const words = key.replace(/[.-]/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
