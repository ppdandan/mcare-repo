/**
 * Normalizes a Philippine mobile number into canonical 11-digit 09XXXXXXXXX format.
 * Accepts formats:
 * - 09171234567
 * - +639171234567
 * - +63 917 123 4567
 * - 0917-123-4567
 * - 9171234567
 * - (0917) 123 4567
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Phone number must be a non-empty string');
  }

  // Remove all non-numeric characters except leading '+'
  let digits = raw.trim().replace(/[^\d+]/g, '');

  // Handle +63 international prefix
  if (digits.startsWith('+63')) {
    digits = '0' + digits.slice(3);
  } else if (digits.startsWith('63') && digits.length === 12) {
    digits = '0' + digits.slice(2);
  } else if (digits.startsWith('9') && digits.length === 10) {
    // 10 digits starting with 9 -> prepend '0'
    digits = '0' + digits;
  }

  // Validate canonical Philippine mobile number format: 09XXXXXXXXX (11 digits)
  const phMobileRegex = /^09\d{9}$/;
  if (!phMobileRegex.test(digits)) {
    throw new Error(`Invalid Philippine mobile number: "${raw}". Must be an 11-digit number starting with 09.`);
  }

  return digits;
}

/**
 * Normalizes a name string: trims surrounding whitespace, collapses internal spaces,
 * and converts to lowercase for case-insensitive matching.
 */
export function normalizeName(name: string): string {
  if (!name || typeof name !== 'string') {
    return '';
  }
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}
