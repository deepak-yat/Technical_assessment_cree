import { BadRequestError } from '../errors/app-error.js';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns today's date formatted as YYYY-MM-DD in UTC.
 */
export function getTodayUtcString(): string {
  return new Date().toISOString().split('T')[0]!;
}

/**
 * Validates that a string is a valid calendar date in YYYY-MM-DD format.
 */
export function isValidDateString(dateStr: string): boolean {
  if (!ISO_DATE_REGEX.test(dateStr)) return false;

  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * Validates stay dates:
 * 1. checkIn and checkOut must be valid YYYY-MM-DD strings.
 * 2. checkIn cannot be in the past (before today in UTC).
 * 3. checkOut must be strictly after checkIn (checkOut > checkIn).
 */
export function validateStayDates(checkIn: string, checkOut: string): void {
  if (!isValidDateString(checkIn)) {
    throw new BadRequestError(`Invalid checkIn date format: '${checkIn}'. Expected YYYY-MM-DD.`);
  }

  if (!isValidDateString(checkOut)) {
    throw new BadRequestError(`Invalid checkOut date format: '${checkOut}'. Expected YYYY-MM-DD.`);
  }

  const today = getTodayUtcString();
  if (checkIn < today) {
    throw new BadRequestError(
      `checkIn date '${checkIn}' cannot be in the past (today is ${today}).`,
    );
  }

  if (checkOut <= checkIn) {
    throw new BadRequestError(
      `checkOut date '${checkOut}' must be strictly after checkIn date '${checkIn}'.`,
    );
  }
}

/**
 * Computes the number of nights between checkIn and checkOut.
 */
export function calculateNights(checkIn: string, checkOut: string): number {
  validateStayDates(checkIn, checkOut);

  const [y1, m1, d1] = checkIn.split('-').map(Number);
  const [y2, m2, d2] = checkOut.split('-').map(Number);

  const startUtc = Date.UTC(y1!, m1! - 1, d1!);
  const endUtc = Date.UTC(y2!, m2! - 1, d2!);

  const diffMs = endUtc - startUtc;
  const msPerDay = 1000 * 60 * 60 * 24;

  return Math.round(diffMs / msPerDay);
}

/**
 * Returns an array of date strings for the half-open interval [checkIn, checkOut).
 * For example, checkIn='2026-11-10' and checkOut='2026-11-13' returns:
 * ['2026-11-10', '2026-11-11', '2026-11-12'].
 */
export function getDateRangeArray(checkIn: string, checkOut: string): string[] {
  validateStayDates(checkIn, checkOut);

  const dates: string[] = [];
  const [y, m, d] = checkIn.split('-').map(Number);
  const current = new Date(Date.UTC(y!, m! - 1, d!));

  const [yEnd, mEnd, dEnd] = checkOut.split('-').map(Number);
  const end = new Date(Date.UTC(yEnd!, mEnd! - 1, dEnd!));

  while (current.getTime() < end.getTime()) {
    dates.push(current.toISOString().split('T')[0]!);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}
