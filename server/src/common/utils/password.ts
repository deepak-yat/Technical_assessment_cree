import argon2 from 'argon2';

/**
 * Hashes a plain text password using Argon2id (OWASP recommended password hashing algorithm).
 * Uses memory-hard parameters to protect against GPU/ASIC brute-force attacks.
 */
export async function hashPassword(plainText: string): Promise<string> {
  return argon2.hash(plainText, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3, // 3 iterations
    parallelism: 1, // 1 lane
  });
}

/**
 * Verifies a candidate password against an Argon2id hash.
 * Constant-time comparison prevents timing attacks.
 */
export async function verifyPassword(storedHash: string, candidate: string): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, candidate);
  } catch {
    return false;
  }
}
