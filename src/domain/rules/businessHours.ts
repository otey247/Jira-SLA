import type { BusinessCalendar } from '../types';

export interface BusinessChunk {
  startedAt: string;
  endedAt: string;
  rawSeconds: number;
  businessSeconds: number;
  isBusinessTime: boolean;
}

interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const parseClock = (clock: string): number => {
  const [hours, minutes] = clock.split(':').map(Number);
  return (hours * 60) + minutes;
};

const durationSeconds = (startedAtMs: number, endedAtMs: number): number =>
  Math.max(0, Math.floor((endedAtMs - startedAtMs) / 1000));

const addLocalDays = (
  localDateTime: Pick<LocalDateTimeParts, 'year' | 'month' | 'day'>,
  daysToAdd: number,
): LocalDateTimeParts => {
  const next = new Date(
    Date.UTC(localDateTime.year, localDateTime.month - 1, localDateTime.day + daysToAdd),
  );

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  };
};

const toLocalDateString = (
  localDate: Pick<LocalDateTimeParts, 'year' | 'month' | 'day'>,
): string =>
  `${localDate.year}-${String(localDate.month).padStart(2, '0')}-${String(
    localDate.day,
  ).padStart(2, '0')}`;

function getLocalDateTimeParts(
  timezone: string,
  date: Date,
): LocalDateTimeParts {
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

function getTimezoneOffsetMs(timezone: string, date: Date): number {
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

  let offset = getTimezoneOffsetMs(timezone, new Date(baseUtc));
  let resolvedUtc = baseUtc - offset;
  const resolvedOffset = getTimezoneOffsetMs(timezone, new Date(resolvedUtc));

  if (resolvedOffset !== offset) {
    offset = resolvedOffset;
    resolvedUtc = baseUtc - offset;
  }

  return resolvedUtc;
}

export const secondsBetween = (startedAt: Date, endedAt: Date): number =>
  durationSeconds(startedAt.getTime(), endedAt.getTime());

export const splitIntervalByBusinessHours = (
  startedAtIso: string,
  endedAtIso: string,
  calendar: BusinessCalendar,
): BusinessChunk[] => {
  const startedAtMs = new Date(startedAtIso).getTime();
  const endedAtMs = new Date(endedAtIso).getTime();

  if (endedAtMs <= startedAtMs) {
    return [];
  }

  const openingMinutes = parseClock(calendar.workingHours.start);
  const closingMinutes = parseClock(calendar.workingHours.end);
  const holidaySet = new Set(calendar.holidays);
  const chunks: BusinessChunk[] = [];
  let cursorMs = startedAtMs;

  while (cursorMs < endedAtMs) {
    const localCursor = getLocalDateTimeParts(calendar.timezone, new Date(cursorMs));
    const localDate = {
      year: localCursor.year,
      month: localCursor.month,
      day: localCursor.day,
    };
    const dayStartUtc = zonedLocalTimeToUtcMs(calendar.timezone, {
      ...localDate,
      hour: 0,
      minute: 0,
      second: 0,
    });
    const nextDayStartUtc = zonedLocalTimeToUtcMs(
      calendar.timezone,
      addLocalDays(localDate, 1),
    );
    const localDayOfWeek = new Date(
      Date.UTC(localDate.year, localDate.month - 1, localDate.day),
    ).getUTCDay();
    const dateKey = toLocalDateString(localDate);
    const isWorkingDay =
      calendar.workingDays.includes(localDayOfWeek) && !holidaySet.has(dateKey);

    const openAtUtc = zonedLocalTimeToUtcMs(calendar.timezone, {
      ...localDate,
      hour: Math.floor(openingMinutes / 60),
      minute: openingMinutes % 60,
      second: 0,
    });
    const closeAtUtc = zonedLocalTimeToUtcMs(calendar.timezone, {
      ...localDate,
      hour: Math.floor(closingMinutes / 60),
      minute: closingMinutes % 60,
      second: 0,
    });

    const dayEndUtc = Math.min(nextDayStartUtc, endedAtMs);

    if (
      !isWorkingDay ||
      closeAtUtc <= cursorMs ||
      openAtUtc >= dayEndUtc
    ) {
      const chunkEndMs = dayEndUtc;
      chunks.push({
        startedAt: new Date(cursorMs).toISOString(),
        endedAt: new Date(chunkEndMs).toISOString(),
        rawSeconds: durationSeconds(cursorMs, chunkEndMs),
        businessSeconds: 0,
        isBusinessTime: false,
      });
      cursorMs = chunkEndMs;
      continue;
    }

    if (cursorMs < openAtUtc) {
      const chunkEndMs = Math.min(openAtUtc, endedAtMs);
      chunks.push({
        startedAt: new Date(cursorMs).toISOString(),
        endedAt: new Date(chunkEndMs).toISOString(),
        rawSeconds: durationSeconds(cursorMs, chunkEndMs),
        businessSeconds: 0,
        isBusinessTime: false,
      });
      cursorMs = chunkEndMs;
      continue;
    }

    const chunkEndMs = Math.min(closeAtUtc, endedAtMs);
    const rawSeconds = durationSeconds(cursorMs, chunkEndMs);
    chunks.push({
      startedAt: new Date(cursorMs).toISOString(),
      endedAt: new Date(chunkEndMs).toISOString(),
      rawSeconds,
      businessSeconds: rawSeconds,
      isBusinessTime: true,
    });
    cursorMs = chunkEndMs;
  }

  return chunks;
};

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
};
