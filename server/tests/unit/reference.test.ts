import { describe, it, expect } from 'vitest';
import { generateReservationReference } from '../../src/common/utils/reference.js';

describe('Reservation Reference Generator', () => {
  it('should generate human-readable format RES-XXXX-XXXX', () => {
    const ref = generateReservationReference();
    expect(ref).toMatch(/^RES-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
  });

  it('should generate distinct unique references on sequential invocations', () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const ref = generateReservationReference();
      expect(set.has(ref)).toBe(false);
      set.add(ref);
    }
    expect(set.size).toBe(100);
  });
});
