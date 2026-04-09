import { BusinessCalendar } from './types';

/**
 * Parses a "HH:MM" time string and returns { hours, minutes }.
 */
function parseTime(t: string): { hours: number; minutes: number } {
  const [h, m] = t.split(':').map(Number);
  return { hours: h, minutes: m };
}

/**
 * Returns the number of business seconds in a half-open interval [start, end).
 * Handles timezone-aware calendars by working in local wall-clock time.
 */
export function computeBusinessSeconds(
  startIso: string,
  endIso: string,
  calendar: BusinessCalendar,
): number {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  if (startMs >= endMs) return 0;

  const tzOffsetMs = getTzOffsetMs(calendar.timezone, new Date(startIso));

  const { hours: startH, minutes: startM } = parseTime(calendar.workingHoursStart);
  const { hours: endH, minutes: endM } = parseTime(calendar.workingHoursEnd);

  const workStartSecondsOfDay = startH * 3600 + startM * 60;
  const workEndSecondsOfDay = endH * 3600 + endM * 60;

  // Build a set of holiday strings in YYYY-MM-DD for O(1) lookup
  const holidaySet = new Set(calendar.holidayDates);

  let totalBusinessSeconds = 0;
  let cursor = startMs;

  while (cursor < endMs) {
    // Convert cursor to local time in the configured timezone
    const localCursor = new Date(cursor + tzOffsetMs);
    const dayOfWeek = localCursor.getUTCDay();
    const dateStr = toLocalDateString(localCursor);

    // Check if this is a working day
    if (calendar.workingDays.includes(dayOfWeek) && !holidaySet.has(dateStr)) {
      // Compute the working window for this calendar day
      const dayStartMs = startOfUTCDayMs(localCursor) - tzOffsetMs + workStartSecondsOfDay * 1000;
      const dayEndMs = startOfUTCDayMs(localCursor) - tzOffsetMs + workEndSecondsOfDay * 1000;

      // Intersect [cursor, endMs) with [dayStartMs, dayEndMs)
      const windowStart = Math.max(cursor, dayStartMs);
      const windowEnd = Math.min(endMs, dayEndMs);

      if (windowEnd > windowStart) {
        totalBusinessSeconds += (windowEnd - windowStart) / 1000;
      }
    }

    // Advance to the next day
    cursor = startOfNextUTCDayMs(localCursor) - tzOffsetMs;
  }

  return Math.round(totalBusinessSeconds);
}

/**
 * Returns whether a given timestamp falls within business hours.
 */
export function isWithinBusinessHours(
  isoTimestamp: string,
  calendar: BusinessCalendar,
): boolean {
  const tzOffsetMs = getTzOffsetMs(calendar.timezone, new Date(isoTimestamp));
  const localDate = new Date(new Date(isoTimestamp).getTime() + tzOffsetMs);

  const dayOfWeek = localDate.getUTCDay();
  const dateStr = toLocalDateString(localDate);

  if (!calendar.workingDays.includes(dayOfWeek)) return false;
  if (calendar.holidayDates.includes(dateStr)) return false;

  const { hours: startH, minutes: startM } = parseTime(calendar.workingHoursStart);
  const { hours: endH, minutes: endM } = parseTime(calendar.workingHoursEnd);

  const secondsOfDay =
    localDate.getUTCHours() * 3600 +
    localDate.getUTCMinutes() * 60 +
    localDate.getUTCSeconds();

  const workStart = startH * 3600 + startM * 60;
  const workEnd = endH * 3600 + endM * 60;

  return secondsOfDay >= workStart && secondsOfDay < workEnd;
}

// ─── Timezone helpers ────────────────────────────────────────────────────────

/**
 * Returns the UTC offset in milliseconds for a given timezone at a specific date.
 * Uses the Intl.DateTimeFormat API for accuracy including DST.
 */
function getTzOffsetMs(timezone: string, date: Date): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const get = (type: string) =>
      parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);

    const localDate = new Date(
      Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')),
    );

    return localDate.getTime() - date.getTime();
  } catch {
    // Fallback: assume UTC
    return 0;
  }
}

/** Returns midnight (UTC) of the day represented by a local-timezone Date. */
function startOfUTCDayMs(localDate: Date): number {
  return Date.UTC(
    localDate.getUTCFullYear(),
    localDate.getUTCMonth(),
    localDate.getUTCDate(),
  );
}

/** Returns midnight (UTC) of the next day. */
function startOfNextUTCDayMs(localDate: Date): number {
  return Date.UTC(
    localDate.getUTCFullYear(),
    localDate.getUTCMonth(),
    localDate.getUTCDate() + 1,
  );
}

/** Returns "YYYY-MM-DD" from a UTC-base Date that represents local time. */
function toLocalDateString(localDate: Date): string {
  const y = localDate.getUTCFullYear();
  const m = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(localDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
