import { BadRequestError } from '../errors/app-error.js';

/**
 * Pure function to calculate total reservation price.
 * Rounds to 2 decimal places to avoid floating-point drift.
 */
export function calculateReservationPrice(
  pricePerNight: number,
  nights: number,
  roomCount: number,
): number {
  if (pricePerNight < 0) {
    throw new BadRequestError('pricePerNight cannot be negative');
  }
  if (nights < 1 || !Number.isInteger(nights)) {
    throw new BadRequestError('nights must be a positive integer');
  }
  if (roomCount < 1 || !Number.isInteger(roomCount)) {
    throw new BadRequestError('roomCount must be a positive integer');
  }

  const rawTotal = pricePerNight * nights * roomCount;
  return Math.round(rawTotal * 100) / 100;
}
