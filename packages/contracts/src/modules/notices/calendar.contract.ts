import { z } from 'zod';
import { DateStr } from '../../kernel/primitives';

/*
 * The calendar: docs/plan/10-modules/m39-notices-events-calendar.md, section 4.
 * It is a read model, not a table: each module answers with its own dates for a range, and the
 * calendar merges them for the person asking.
 */

/** The longest range one call may ask for: a year's view and a little either side. */
export const MAX_CALENDAR_DAYS = 400;

export const CalendarQuery = z.strictObject({ from: DateStr, to: DateStr });
export type CalendarQuery = z.output<typeof CalendarQuery>;

export const CalendarEntry = z.object({
  /** Which module it comes from: `holidays`, `exams`, `events`, `fees`. The legend is built from this. */
  source: z.string().min(1),
  /** What it is, within its source: `holiday`, `term-start`, `exam-paper`, `fee-due`. */
  kind: z.string().min(1),
  title: z.string().min(1),
  /** A day (`2026-10-12`) for an all-day entry, else a moment. */
  start: z.string().min(10),
  end: z.string().min(10),
  allDay: z.boolean(),
  /** A path inside the person's portal that opens the thing itself. */
  link: z.string().nullable(),
  /** For a guardian: which child it is about. */
  studentId: z.uuid().nullable(),
});
export type CalendarEntry = z.output<typeof CalendarEntry>;

export const CalendarRange = z.object({
  from: DateStr,
  to: DateStr,
  entries: z.array(CalendarEntry),
  /** Sources that could not be read just now. The rest of the calendar is still shown. */
  unavailable: z.array(z.string()),
});
export type CalendarRange = z.output<typeof CalendarRange>;
