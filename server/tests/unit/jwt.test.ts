import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../src/common/utils/jwt.js';
import { UserRoles } from '../../src/types/auth.types.js';
import { UnauthorizedError } from '../../src/common/errors/app-error.js';

describe('JWT Utilities', () => {
  it('should sign and verify access token', () => {
    const payload = {
      sub: '507f1f77bcf86cd799439011',
      email: 'guest@hotel.com',
      role: UserRoles.GUEST,
    };

    const token = signAccessToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(UserRoles.GUEST);
  });

  it('should sign and verify refresh token', () => {
    const payload = {
      sub: '507f1f77bcf86cd799439022',
    };

    const token = signRefreshToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifyRefreshToken(token);
    expect(decoded.sub).toBe(payload.sub);
  });

  it('should throw UnauthorizedError when verifying corrupted token', () => {
    expect(() => verifyAccessToken('invalid.jwt.token')).toThrow(UnauthorizedError);
  });
});
