/*
 * A small cron evaluator for `job_schedules`. Five fields, evaluated in Pakistan time:
 *
 *   minute (0-59)  hour (0-23)  day of month (1-31)  month (1-12)  day of week (0-6, Sunday is 0; 7 is also Sunday)
 *
 * Each field takes `*`, a number, a list `1,15`, a range `1-5`, and a step such as every fifth minute or `8-18/2`.
 * As in standard cron, when both day fields are restricted a date matches if either one does.
 */

const PAKISTAN_OFFSET_MS = 5 * 60 * 60 * 1000;
const MINUTE_MS = 60_000;

interface Field {
  any: boolean;
  values: ReadonlySet<number>;
}

export interface ParsedCron {
  minute: Field;
  hour: Field;
  dayOfMonth: Field;
  month: Field;
  dayOfWeek: Field;
}

function parseField(text: string, min: number, max: number, name: string): Field {
  const values = new Set<number>();
  for (const part of text.split(',')) {
    const [range = '', stepText] = part.split('/');
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1) throw new Error(`Cron ${name} "${text}": bad step`);
    let from: number;
    let to: number;
    if (range === '*') {
      from = min;
      to = max;
    } else if (range.includes('-')) {
      const [a, b] = range.split('-').map(Number);
      from = a ?? NaN;
      to = b ?? NaN;
    } else {
      from = Number(range);
      to = stepText === undefined ? from : max;
    }
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < min || to > max || from > to) {
      throw new Error(`Cron ${name} "${text}": expected values from ${min} to ${max}`);
    }
    for (let value = from; value <= to; value += step) values.add(value);
  }
  return { any: text === '*', values };
}

export function parseCron(expression: string): ParsedCron {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`Cron "${expression}" must have five fields`);
  const [minute = '', hour = '', dayOfMonth = '', month = '', dayOfWeek = ''] = fields;
  const weekdays = parseField(dayOfWeek, 0, 7, 'day of week');
  return {
    minute: parseField(minute, 0, 59, 'minute'),
    hour: parseField(hour, 0, 23, 'hour'),
    dayOfMonth: parseField(dayOfMonth, 1, 31, 'day of month'),
    month: parseField(month, 1, 12, 'month'),
    // 7 means Sunday, the same as 0.
    dayOfWeek: {
      any: weekdays.any,
      values: new Set([...weekdays.values].map((value) => value % 7)),
    },
  };
}

/** Whether the schedule is due in the minute containing this moment, on Pakistan's clock. */
export function cronMatches(cron: ParsedCron, epochMs: number): boolean {
  const local = new Date(epochMs + PAKISTAN_OFFSET_MS);
  if (!cron.minute.values.has(local.getUTCMinutes())) return false;
  if (!cron.hour.values.has(local.getUTCHours())) return false;
  if (!cron.month.values.has(local.getUTCMonth() + 1)) return false;
  const dayOfMonth = cron.dayOfMonth.values.has(local.getUTCDate());
  const dayOfWeek = cron.dayOfWeek.values.has(local.getUTCDay());
  if (cron.dayOfMonth.any && cron.dayOfWeek.any) return true;
  if (cron.dayOfMonth.any) return dayOfWeek;
  if (cron.dayOfWeek.any) return dayOfMonth;
  return dayOfMonth || dayOfWeek;
}

/**
 * The most recent minute at or before `now` when the schedule was due, as ISO text, looking back at
 * most `lookbackMinutes` (a day by default). Undefined when it was not due in that time.
 * Only the latest due time is returned: after an outage a schedule runs once, not once per missed time.
 */
export function latestDue(
  expression: string,
  now: string,
  lookbackMinutes = 24 * 60,
): string | undefined {
  const cron = parseCron(expression);
  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs)) throw new Error(`Not a timestamp: "${now}"`);
  const start = Math.floor(nowMs / MINUTE_MS) * MINUTE_MS;
  for (let offset = 0; offset <= lookbackMinutes; offset++) {
    const candidate = start - offset * MINUTE_MS;
    if (cronMatches(cron, candidate)) return new Date(candidate).toISOString();
  }
  return undefined;
}
