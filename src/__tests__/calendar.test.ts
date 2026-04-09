import {
  computeBusinessSeconds,
  isWithinBusinessHours,
  splitIntervalByBusinessHours,
} from '../sla/calendar';
import { BusinessCalendar } from '../sla/types';

const utcCalendar: BusinessCalendar = {
  calendarId: 'cal-utc',
  name: 'UTC Mon–Fri 9–18',
  timezone: 'UTC',
  workingDays: [1, 2, 3, 4, 5],
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00',
  holidayDates: [],
  afterHoursMode: 'business-hours',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('computeBusinessSeconds', () => {
  test('returns 0 when start equals end', () => {
    const t = '2024-01-08T10:00:00Z';
    expect(computeBusinessSeconds(t, t, utcCalendar)).toBe(0);
  });

  test('returns 0 when start is after end', () => {
    expect(
      computeBusinessSeconds(
        '2024-01-08T11:00:00Z',
        '2024-01-08T10:00:00Z',
        utcCalendar,
      ),
    ).toBe(0);
  });

  test('computes 1 hour within business hours on a Monday', () => {
    // Mon 10am–11am UTC
    const seconds = computeBusinessSeconds(
      '2024-01-08T10:00:00Z',
      '2024-01-08T11:00:00Z',
      utcCalendar,
    );
    expect(seconds).toBe(3600);
  });

  test('counts only the business window when span crosses EOD', () => {
    // Mon 17:00 to Tue 10:00 → 1h on Mon (17-18) + 1h on Tue (9-10)
    const seconds = computeBusinessSeconds(
      '2024-01-08T17:00:00Z',
      '2024-01-09T10:00:00Z',
      utcCalendar,
    );
    expect(seconds).toBe(3600 + 3600);
  });

  test('excludes weekend days', () => {
    // Saturday to Sunday entirely
    const seconds = computeBusinessSeconds(
      '2024-01-06T10:00:00Z',
      '2024-01-07T17:00:00Z',
      utcCalendar,
    );
    expect(seconds).toBe(0);
  });

  test('excludes holiday dates', () => {
    const calWithHoliday: BusinessCalendar = {
      ...utcCalendar,
      holidayDates: ['2024-01-08'], // Monday is a holiday
    };
    const seconds = computeBusinessSeconds(
      '2024-01-08T10:00:00Z',
      '2024-01-08T12:00:00Z',
      calWithHoliday,
    );
    expect(seconds).toBe(0);
  });

  test('excludes time before business hours starts', () => {
    // 08:00–09:30 → only 09:00–09:30 counts = 1800s
    const seconds = computeBusinessSeconds(
      '2024-01-08T08:00:00Z',
      '2024-01-08T09:30:00Z',
      utcCalendar,
    );
    expect(seconds).toBe(1800);
  });

  test('excludes time after business hours ends', () => {
    // 17:30–19:00 → only 17:30–18:00 counts = 1800s
    const seconds = computeBusinessSeconds(
      '2024-01-08T17:30:00Z',
      '2024-01-08T19:00:00Z',
      utcCalendar,
    );
    expect(seconds).toBe(1800);
  });

  test('splits intervals into business and outside-hours slices', () => {
    const slices = splitIntervalByBusinessHours(
      '2024-01-08T08:00:00Z',
      '2024-01-08T10:00:00Z',
      utcCalendar,
    );

    expect(slices).toEqual([
      {
        startedAt: '2024-01-08T08:00:00.000Z',
        endedAt: '2024-01-08T09:00:00.000Z',
        isBusinessHours: false,
      },
      {
        startedAt: '2024-01-08T09:00:00.000Z',
        endedAt: '2024-01-08T10:00:00.000Z',
        isBusinessHours: true,
      },
    ]);
  });

  test('handles DST transitions by recalculating timezone offsets per day', () => {
    const newYorkCalendar: BusinessCalendar = {
      ...utcCalendar,
      timezone: 'America/New_York',
    };

    const seconds = computeBusinessSeconds(
      '2024-03-08T14:00:00Z',
      '2024-03-11T15:00:00Z',
      newYorkCalendar,
    );

    expect(seconds).toBe(39600);
  });
});

describe('isWithinBusinessHours', () => {
  test('returns true for a weekday during business hours', () => {
    expect(
      isWithinBusinessHours('2024-01-08T10:00:00Z', utcCalendar),
    ).toBe(true);
  });

  test('returns false on a Saturday', () => {
    expect(
      isWithinBusinessHours('2024-01-06T10:00:00Z', utcCalendar),
    ).toBe(false);
  });

  test('returns false before business hours start', () => {
    expect(
      isWithinBusinessHours('2024-01-08T08:59:00Z', utcCalendar),
    ).toBe(false);
  });

  test('returns false after business hours end', () => {
    expect(
      isWithinBusinessHours('2024-01-08T18:00:00Z', utcCalendar),
    ).toBe(false);
  });

  test('returns false on a holiday', () => {
    const calWithHoliday: BusinessCalendar = {
      ...utcCalendar,
      holidayDates: ['2024-01-08'],
    };
    expect(
      isWithinBusinessHours('2024-01-08T10:00:00Z', calWithHoliday),
    ).toBe(false);
  });
});
