import { describe, it, expect } from 'vitest';
import { escapeRegex } from '../../src/common/utils/regex.js';

describe('Regex Escaping Utility', () => {
  it('should escape all regex special characters', () => {
    const raw = 'test.*+?^${}()|[]\\string';
    const escaped = escapeRegex(raw);
    expect(escaped).toBe('test\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\string');
    // Ensure creating a RegExp with the escaped string does not throw
    expect(() => new RegExp(escaped)).not.toThrow();
  });

  it('should safely handle bare parentheses, brackets and wildcards', () => {
    expect(() => new RegExp(escapeRegex('('))).not.toThrow();
    expect(() => new RegExp(escapeRegex('['))).not.toThrow();
    expect(() => new RegExp(escapeRegex('.*'))).not.toThrow();
    expect(new RegExp(escapeRegex('(')).test('(')).toBe(true);
    expect(new RegExp(escapeRegex('.*')).test('.*')).toBe(true);
    expect(new RegExp(escapeRegex('.*')).test('abc')).toBe(false);
  });
});
