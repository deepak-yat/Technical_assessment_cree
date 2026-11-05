import { describe, it, expect } from 'vitest';
import { calculateReservationPrice } from '../../src/common/utils/pricing.js';
import { BadRequestError } from '../../src/common/errors/app-error.js';

describe('Pricing Pure Functions', () => {
  it('should accurately calculate price across nights and rooms without float drift', () => {
    // 199.99 * 3 nights * 2 rooms = 1199.94
    const total = calculateReservationPrice(199.99, 3, 2);
    expect(total).toBe(1199.94);
  });

  it('should handle single room and single night', () => {
    const total = calculateReservationPrice(150, 1, 1);
    expect(total).toBe(150);
  });

  it('should reject negative pricePerNight', () => {
    expect(() => calculateReservationPrice(-50, 2, 1)).toThrow(BadRequestError);
  });

  it('should reject invalid nights or roomCount', () => {
    expect(() => calculateReservationPrice(100, 0, 1)).toThrow(BadRequestError);
    expect(() => calculateReservationPrice(100, 2.5, 1)).toThrow(BadRequestError);
    expect(() => calculateReservationPrice(100, 2, 0)).toThrow(BadRequestError);
  });
});
