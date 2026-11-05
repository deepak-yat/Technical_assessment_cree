import { describe, it, expect } from 'vitest';
import {
  isValidDateString,
  getTodayUtcString,
  validateStayDates,
  calculateNights,
  getDateRangeArray,
} from '../../src/common/utils/date.js';
import { BadRequestError } from '../../src/common/errors/app-error.js';

describe('Date Utilities', () => {
  it('should validate valid and invalid YYYY-MM-DD date strings', () => {
    expect(isValidDateString('2026-11-10')).toBe(true);
    expect(isValidDateString('2026-02-28')).toBe(true);

    expect(isValidDateString('2026-13-01')).toBe(false); // Invalid month
    expect(isValidDateString('2026-04-31')).toBe(false); // April has 30 days
    expect(isValidDateString('not-a-date')).toBe(false);
    expect(isValidDateString('10-11-2026')).toBe(false); // Wrong format
  });

  it('should calculate stay nights correctly for [checkIn, checkOut)', () => {
    const today = getTodayUtcString();
    const [y, m, d] = today.split('-').map(Number);

    const checkInDate = new Date(Date.UTC(y!, m! - 1, d! + 1));
    const checkOutDate = new Date(Date.UTC(y!, m! - 1, d! + 4));

    const checkIn = checkInDate.toISOString().split('T')[0]!;
    const checkOut = checkOutDate.toISOString().split('T')[0]!;

    expect(calculateNights(checkIn, checkOut)).toBe(3);

    const dateArray = getDateRangeArray(checkIn, checkOut);
    expect(dateArray.length).toBe(3);
    expect(dateArray[0]).toBe(checkIn);
    expect(dateArray.includes(checkOut)).toBe(false); // checkOut is excluded
  });

  it('should reject checkOut on or before checkIn', () => {
    const today = getTodayUtcString();
    expect(() => validateStayDates(today, today)).toThrow(BadRequestError);
  });

  it('should reject past checkIn dates', () => {
    expect(() => validateStayDates('2020-01-01', '2020-01-05')).toThrow(BadRequestError);
  });
});
