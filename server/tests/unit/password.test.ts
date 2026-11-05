import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/common/utils/password.js';

describe('Password Utility (Argon2id)', () => {
  it('should hash a password with argon2id prefix', async () => {
    const plain = 'SuperSecret123!';
    const hash = await hashPassword(plain);

    expect(hash).toBeDefined();
    expect(hash).toContain('$argon2id$');
  });

  it('should verify matching candidate password', async () => {
    const plain = 'CorrectPassword99';
    const hash = await hashPassword(plain);

    const isValid = await verifyPassword(hash, plain);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect candidate password', async () => {
    const plain = 'CorrectPassword99';
    const hash = await hashPassword(plain);

    const isValid = await verifyPassword(hash, 'WrongPassword12');
    expect(isValid).toBe(false);
  });

  it('should produce different hashes for same plain password (salting)', async () => {
    const plain = 'IdenticalPassword123';
    const hash1 = await hashPassword(plain);
    const hash2 = await hashPassword(plain);

    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(hash1, plain)).toBe(true);
    expect(await verifyPassword(hash2, plain)).toBe(true);
  });
});
