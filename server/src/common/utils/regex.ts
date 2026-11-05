/**
 * Escapes characters with special meaning in regular expressions
 * to prevent RegExp injection and ReDoS vulnerabilities.
 */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
