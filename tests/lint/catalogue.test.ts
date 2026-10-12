import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { audiences, eventCatalogue, notificationCategories } from '@takhti/contracts';

/*
 * The event catalogue in code against the plan and against its own rules
 * (docs/plan/30-reference/notification-catalogue.md). An event exists only when its module's
 * specification names it, and it can be sent only when it has words in both languages.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function plannedEvents(): Set<string> {
  execFileSync(process.execPath, [join(root, 'docs/plan/_tools/check.mjs'), '--json', '--no-write'], {
    cwd: root,
    stdio: 'ignore',
  });
  const plan = JSON.parse(
    readFileSync(join(root, 'docs/plan/_tools/out/plan.json'), 'utf8'),
  ) as { events: string[] };
  return new Set(plan.events);
}

describe('the event catalogue', () => {
  it('holds only events a module specification names', () => {
    const planned = plannedEvents();
    expect(eventCatalogue.map((event) => event.key).filter((key) => !planned.has(key))).toEqual([]);
  });

  it('every event has a category and audiences the dispatcher knows', () => {
    for (const event of eventCatalogue) {
      expect(notificationCategories, event.key).toContain(event.category);
      for (const rule of event.rules) {
        expect(audiences, event.key).toContain(rule.audience);
        if (rule.audience === 'role-at-branch' || rule.audience === 'role-in-org')
          expect(rule.roleKeys?.length ?? 0, `${event.key} names no role`).toBeGreaterThan(0);
      }
    }
  });

  it('every event that tells anyone has words for the bell, and for each outside channel it uses, in English and Urdu', () => {
    const missing: string[] = [];
    for (const event of eventCatalogue) {
      if (event.rules.length === 0) continue;
      const channels = new Set<string>(['in_app', ...event.rules.flatMap((rule) => rule.channels)]);
      for (const channel of channels) {
        const wording = event.templates?.[channel as keyof NonNullable<typeof event.templates>] as
          | Record<string, unknown>
          | undefined;
        for (const locale of ['en', 'ur'])
          if (!wording?.[locale]) missing.push(`${event.key}: ${channel} in ${locale}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('the same facts in both languages: a pair of templates uses the same variables, all of which the event provides', () => {
    const problems: string[] = [];
    const variablesOf = (text: string) =>
      [...text.matchAll(/\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g)].map((match) => match[1] as string).sort();
    const textOf = (value: unknown): string =>
      typeof value === 'string' ? value : Object.values(value as Record<string, string>).join(' ');
    // What dispatch supplies for every event, beside the event's own variables.
    const always = ['schoolName', 'recipientName', 'guardianName', 'staffName', 'studentName', 'studentNames'];
    for (const event of eventCatalogue) {
      const allowed = new Set([...event.variables, ...always]);
      for (const [channel, wording] of Object.entries(event.templates ?? {})) {
        const pair = wording as Record<'en' | 'ur', unknown>;
        const en = variablesOf(textOf(pair.en));
        const ur = variablesOf(textOf(pair.ur));
        if (en.join(',') !== ur.join(','))
          problems.push(`${event.key} ${channel}: English uses [${en}] and Urdu [${ur}]`);
        for (const name of new Set([...en, ...ur]))
          if (!allowed.has(name)) problems.push(`${event.key} ${channel}: {{${name}}} is not a variable of the event`);
      }
    }
    expect(problems).toEqual([]);
  });
});
