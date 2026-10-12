import {
  CalendarEntry,
  MAX_CALENDAR_DAYS,
  type CalendarRange,
  type ModuleKey,
} from '@takhti/contracts';
import type { Ctx } from '../../kernel/context';
import { diffDays } from '../../kernel/dates';
import { invalid } from '../../kernel/errors';
import { isModuleEnabled } from '../../kernel/modules';

/*
 * The calendar: docs/plan/10-modules/m39-notices-events-calendar.md, section 4 and rules
 * R-notices-17 and 18. One list of dates for each person, gathered from every module that has any:
 * holidays and terms, exam papers, meetings, events, fee and homework due dates, leave and duties.
 *
 * It is a read model, not a table. A module that has dates registers a source beside its service:
 *
 *   registerCalendarSource({
 *     source: 'holidays', module: 'setup',
 *     entries: (ctx, range) => holidaysDb.between(ctx, range).then(toEntries),
 *   });
 *
 * A source reads through the caller's `ctx`, so a person sees in the calendar only what they could
 * already see in the module itself.
 */

export interface CalendarSpan {
  from: string;
  to: string;
}

/** What a source hands back: `link` and `studentId` may be left out. */
export type CalendarEntryInput = Omit<CalendarEntry, 'source' | 'link' | 'studentId'> &
  Partial<Pick<CalendarEntry, 'link' | 'studentId'>>;

export interface CalendarSource {
  /** The name entries carry and the legend shows: `holidays`, `exams`. */
  source: string;
  /** The module it belongs to. A module that is off for the school has no dates. */
  module: ModuleKey;
  entries: (ctx: Ctx, range: CalendarSpan) => Promise<readonly CalendarEntryInput[]>;
}

const sources = new Map<string, CalendarSource>();

export function registerCalendarSource(source: CalendarSource): void {
  sources.set(source.source, source);
}

export const registeredCalendarSources = (): CalendarSource[] => [...sources.values()];

/** For tests: forgets a source registered by one. */
export function removeCalendarSource(source: string): void {
  sources.delete(source);
}

class SourceFailed extends Error {
  constructor(readonly original: unknown) {
    super('calendar source failed');
  }
}

/** The day an entry starts or ends on, whether it carries a day or a moment. */
const dayOf = (value: string): string => value.slice(0, 10);

export const calendarService = {
  /**
   * Every entry between two days, both included, from every source the school has, oldest first.
   * F-notices-8: a source that fails is named in `unavailable` and the others are still shown.
   */
  async range(ctx: Ctx, from: string, to: string): Promise<CalendarRange> {
    if (to < from) throw invalid({ to: ['The last day cannot be before the first'] });
    if (diffDays(from, to) >= MAX_CALENDAR_DAYS)
      throw invalid({ to: [`A calendar shows ${MAX_CALENDAR_DAYS} days at most`] });

    const entries: CalendarEntry[] = [];
    const unavailable: string[] = [];
    for (const source of sources.values()) {
      if (!(await isModuleEnabled(ctx, source.module))) continue;
      try {
        // A savepoint: a query that fails inside one source cannot spoil the transaction for the rest.
        const found = await ctx.db.transaction(async (savepoint) => {
          try {
            const raw = await source.entries({ ...ctx, db: savepoint }, { from, to });
            return raw.map((entry) =>
              CalendarEntry.parse({ link: null, studentId: null, ...entry, source: source.source }),
            );
          } catch (error) {
            throw new SourceFailed(error);
          }
        });
        // A source is asked for a range and may answer generously; only what touches it is shown.
        entries.push(
          ...found.filter((entry) => dayOf(entry.start) <= to && dayOf(entry.end) >= from),
        );
      } catch (error) {
        ctx.log.warn(
          { source: source.source, err: error instanceof SourceFailed ? error.original : error },
          'a calendar source could not be read',
        );
        unavailable.push(source.source);
      }
    }
    entries.sort(
      (a, b) =>
        a.start.localeCompare(b.start) ||
        Number(b.allDay) - Number(a.allDay) ||
        a.title.localeCompare(b.title),
    );
    return { from, to, entries, unavailable: unavailable.sort() };
  },
};
