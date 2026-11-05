import { randomBytes } from 'node:crypto';

// Characters excluding ambiguous visually similar characters (0, O, 1, I)
const CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates an uppercase unique human-readable reservation reference.
 * Format: RES-XXXX-XXXX (e.g. RES-97KA-P4W2)
 */
export function generateReservationReference(): string {
  const bytes = randomBytes(8);
  let part1 = '';
  let part2 = '';

  for (let i = 0; i < 4; i++) {
    part1 += CHARSET[bytes[i]! % CHARSET.length];
  }
  for (let i = 4; i < 8; i++) {
    part2 += CHARSET[bytes[i]! % CHARSET.length];
  }

  return `RES-${part1}-${part2}`;
}
