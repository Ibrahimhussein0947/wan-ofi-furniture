// Validation helpers for bank / mobile-money account numbers.
// Ethiopia has no IBAN registry, so local account numbers (CBE 1000…, Awash 013…, phone
// numbers for wallets) are accepted as long as they hold 5–34 letters/digits plus the
// usual separators (spaces and dashes). Anything that LOOKS like an IBAN (2 letters + 2
// digits) is checked properly with the ISO 13616 mod-97 checksum, and its length must
// match the country's registered IBAN length.

const IBAN_LENGTHS = {
  AD: 24,
  AE: 23,
  AL: 28,
  AT: 20,
  AZ: 28,
  BA: 20,
  BE: 16,
  BG: 22,
  BH: 22,
  BR: 29,
  BY: 28,
  CH: 21,
  CR: 22,
  CY: 28,
  CZ: 24,
  DE: 22,
  DK: 18,
  DO: 28,
  EE: 20,
  EG: 29,
  ES: 24,
  FI: 18,
  FO: 18,
  FR: 27,
  GB: 22,
  GE: 22,
  GI: 23,
  GL: 18,
  GR: 27,
  GT: 28,
  HR: 21,
  HU: 28,
  IE: 22,
  IL: 23,
  IQ: 23,
  IS: 26,
  IT: 27,
  JO: 30,
  KW: 30,
  KZ: 20,
  LB: 28,
  LC: 32,
  LI: 21,
  LT: 20,
  LU: 20,
  LV: 21,
  LY: 25,
  MC: 27,
  MD: 24,
  ME: 22,
  MK: 19,
  MR: 27,
  MT: 31,
  MU: 30,
  NL: 18,
  NO: 15,
  PK: 24,
  PL: 28,
  PS: 29,
  PT: 25,
  QA: 29,
  RO: 24,
  RS: 22,
  SA: 24,
  SC: 31,
  SE: 24,
  SI: 19,
  SK: 24,
  SM: 27,
  ST: 25,
  SV: 28,
  TL: 23,
  TN: 24,
  TR: 26,
  UA: 29,
  VA: 22,
  VG: 24,
  XK: 20,
};

// Basic structure + per-country length check. Returns null when valid, otherwise a message.
function checkIbanFormat(value) {
  const compact = String(value).replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(compact))
    return 'An IBAN starts with 2 letters and 2 digits (e.g. DE44 5001 0517 5407 3249 31).';
  const expected = IBAN_LENGTHS[compact.slice(0, 2)];
  if (!expected) return `Unknown IBAN country code "${compact.slice(0, 2)}".`;
  if (compact.length !== expected)
    return `A ${compact.slice(0, 2)} IBAN must be ${expected} characters (got ${compact.length}).`;
  return null;
}

// ISO 13616 mod-97 checksum: move the first 4 characters to the end, convert letters
// (A=10…Z=35), the remainder of the whole number mod 97 must be 1.
function ibanChecksumValid(value) {
  const rearranged = String(value).replace(/[\s-]/g, '').toUpperCase();
  const rotated = rearranged.slice(4) + rearranged.slice(0, 4);
  let remainder = 0;
  for (const ch of rotated) {
    const code = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of code) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** True when the value is shaped like an IBAN: 2 letters, 2 check digits, then account data. */
function looksLikeIban(value) {
  return /^[A-Za-z]{2}\d{2}/.test(String(value).replace(/[\s-]/g, ''));
}

/**
 * Validates an account number. Local numbers only need allowed characters and a sane
 * length; IBAN-looking values additionally get format + checksum verification.
 * Returns null when valid, otherwise a human-readable error message.
 */
function accountNumberError(value, { allowIban = true } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return 'Account number is required';
  if (!/^[\dA-Za-z][\dA-Za-z\s-]{4,59}$/.test(raw))
    return 'Account numbers may only contain letters, digits, spaces and dashes (5–60 characters).';
  if (allowIban && looksLikeIban(raw)) {
    const formatError = checkIbanFormat(raw);
    if (formatError) return formatError;
    if (!ibanChecksumValid(raw))
      return 'The IBAN checksum is invalid — check the number for typos.';
  }
  return null;
}

module.exports = { accountNumberError, looksLikeIban, checkIbanFormat, ibanChecksumValid };
