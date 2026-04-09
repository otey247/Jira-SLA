import { BusinessCalendar } from './types';

interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface TimeSlice {
  startedAt: string;
  endedAt: string;
  isBusinessHours: boolean;
}

function parseTime(t: string): { hours: number; minutes: number } {
  const [h, m] = t.split(':').map(Number);
  return { hours: h, minutes: m };
}

export function computeBusinessSeconds(
  startIso: string,
  endIso: string,
  calendar: BusinessCalendar,
): number {
  return splitIntervalByBusinessHours(startIso, endIso, calendar)
    .filter((slice) => slice.isBusinessHours)
    .reduce((total, slice) => total + durationSeconds(slice.startedAt, slice.endedAt), 0);
}

export function splitIntervalByBusinessHours(
  startIso: string,
  endIso: string,
  calendar: BusinessCalendar,
): TimeSlice[] {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  if (startMs >= endMs) return [];

  const { hours: startH, minutes: startM } = parseTime(calendar.workingHoursStart);
  const { hours: endH, minutes: endM } = parseTime(calendar.workingHoursEnd);
  const holidaySet = new Set(calendar.holidayDates);

  const slices: TimeSlice[] = [];
  let cursor = startMs;

  while (cursor < endMs) {
    const localCursor = getLocalDateTimeParts(calendar.timezone, new Date(cursor));
    const dayStartUtc = zonedLocalTimeToUtcMs(calendar.timezone, {
      year: localCursor.year,
      month: localCursor.month,
      day: localCursor.day,
      hour: 0,
      minute: 0,
      second: 0,
    });
    const nextDayStartUtc = zonedLocalTimeToUtcMs(calendar.timezone, nextLocalDay(localCursor));
    const dayEnd = Math.min(endMs, nextDayStartUtc);
    const dayStart = Math.max(cursor, dayStartUtc);
    const dateStr = toLocalDateString(localCursor);
    const localDayOfWeek = new Date(
      Date.UTC(localCursor.year, localCursor.month - 1, localCursor.day),
    ).getUTCDay();

    const businessStartUtc = zonedLocalTimeToUtcMs(calendar.timezone, {
      year: localCursor.year,
      month: localCursor.month,
      day: localCursor.day,
      hour: startH,
      minute: startM,
      second: 0,
    });
    const businessEndUtc = zonedLocalTimeToUtcMs(calendar.timezone, {
      year: localCursor.year,
      month: localCursor.month,
      day: localCursor.day,
      hour: endH,
      minute: endM,
      second: 0,
    });

    const isWorkingDay =
      calendar.workingDays.includes(localDayOfWeek) && !holidaySet.has(dateStr);

    if (!isWorkingDay || businessEndUtc <= dayStart || businessStartUtc >= dayEnd) {
      pushSlice(slices, dayStart, dayEnd, false);
    } else {
      if (dayStart < businessStartUtc) {
        pushSlice(slices, dayStart, Math.min(dayEnd, businessStartUtc), false);
      }

      const businessSliceStart = Math.max(dayStart, businessStartUtc);
      const businessSliceEnd = Math.min(dayEnd, businessEndUtc);
      if (businessSliceEnd > businessSliceStart) {
        pushSlice(slices, businessSliceStart, businessSliceEnd, true);
      }

      if (dayEnd > businessEndUtc) {
        pushSlice(slices, Math.max(dayStart, businessEndUtc), dayEnd, false);
      }
    }

    cursor = dayEnd;
  }

  return slices;
}

export function isWithinBusinessHours(
  isoTimestamp: string,
  calendar: BusinessCalendar,
): boolean {
  return splitIntervalByBusinessHours(
    isoTimestamp,
    new Date(new Date(isoTimestamp).getTime() + 1000).toISOString(),
    calendar,
  ).some((slice) => slice.isBusinessHours);
}

function pushSlice(
  slices: TimeSlice[],
  startMs: number,
  endMs: number,
  isBusinessHours: boolean,
): void {
  if (endMs <= startMs) return;

  const startedAt = new Date(startMs).toISOString();
  const endedAt = new Date(endMs).toISOString();
  const previous = slices[slices.length - 1];

  if (
    previous &&
    previous.isBusinessHours === isBusinessHours &&
    previous.endedAt === startedAt
  ) {
    previous.endedAt = endedAt;
    return;
  }

  slices.push({ startedAt, endedAt, isBusinessHours });
}

function durationSeconds(startIso: string, endIso: string): number {
  return Math.max(
    0,
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000,
  );
}

function getLocalDateTimeParts(timezone: string, date: Date): LocalDateTimeParts {
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
    parseInt(parts.find((part) => part.type === type)?.value ?? '0', 10);

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function zonedLocalTimeToUtcMs(
  timezone: string,
  localDateTime: LocalDateTimeParts,
): number {
  const baseUtc = Date.UTC(
    localDateTime.year,
    localDateTime.month - 1,
    localDateTime.day,
    localDateTime.hour,
    localDateTime.minute,
    localDateTime.second,
  );

  let offset = getTzOffsetMs(timezone, new Date(baseUtc));
  let resolvedUtc = baseUtc - offset;
  const resolvedOffset = getTzOffsetMs(timezone, new Date(resolvedUtc));

  if (resolvedOffset !== offset) {
    offset = resolvedOffset;
    resolvedUtc = baseUtc - offset;
  }

  return resolvedUtc;
}

function getTzOffsetMs(timezone: string, date: Date): number {
  const local = getLocalDateTimeParts(timezone, date);
  const utcEquivalent = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );

  return utcEquivalent - date.getTime();
}

function nextLocalDay(local: LocalDateTimeParts): LocalDateTimeParts {
  const next = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  };
}

function toLocalDateString(localDate: Pick<LocalDateTimeParts, 'year' | 'month' | 'day'>): string {
  const y = localDate.year;
  const m = String(localDate.month).padStart(2, '0');
  const d = String(localDate.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
