import type { BusinessCalendar } from '../types';

export interface BusinessChunk {
  startedAt: string;
  endedAt: string;
  rawSeconds: number;
  businessSeconds: number;
  isBusinessTime: boolean;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const parseClock = (clock: string): number => {
  const [hours, minutes] = clock.split(':').map(Number);
  return (hours * 60) + minutes;
};

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

const startOfUtcDay = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const addMinutes = (date: Date, minutes: number): Date => new Date(date.getTime() + (minutes * 60 * 1000));

export const secondsBetween = (startedAt: Date, endedAt: Date): number => Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));

export const splitIntervalByBusinessHours = (
  startedAtIso: string,
  endedAtIso: string,
  calendar: BusinessCalendar,
): BusinessChunk[] => {
  const startedAt = new Date(startedAtIso);
  const endedAt = new Date(endedAtIso);
  if (endedAt <= startedAt) {
    return [];
  }

  const openingMinutes = parseClock(calendar.workingHours.start);
  const closingMinutes = parseClock(calendar.workingHours.end);
  const chunks: BusinessChunk[] = [];
  let cursor = startedAt;

  while (cursor < endedAt) {
    const dayStart = startOfUtcDay(cursor);
    const dayEnd = new Date(dayStart.getTime() + DAY_IN_MS);
    const working = calendar.workingDays.includes(dayStart.getUTCDay()) && !calendar.holidays.includes(isoDate(dayStart));
    const openAt = addMinutes(dayStart, openingMinutes);
    const closeAt = addMinutes(dayStart, closingMinutes);

    let boundary = dayEnd;
    let isBusinessTime = false;

    if (working) {
      if (cursor < openAt) {
        boundary = openAt;
      } else if (cursor < closeAt) {
        boundary = closeAt;
        isBusinessTime = true;
      }
    }

    const chunkEnd = new Date(Math.min(boundary.getTime(), endedAt.getTime()));
    const rawSeconds = secondsBetween(cursor, chunkEnd);
    chunks.push({
      startedAt: cursor.toISOString(),
      endedAt: chunkEnd.toISOString(),
      rawSeconds,
      businessSeconds: isBusinessTime ? rawSeconds : 0,
      isBusinessTime,
    });
    cursor = chunkEnd;
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
