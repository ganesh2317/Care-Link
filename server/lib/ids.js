import crypto from 'node:crypto';

/**
 * Crockford Base32 alphabet — excludes I, L, O, U to avoid visual ambiguity
 * when a caregiver reads an ID aloud or types it manually.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 32 chars

/**
 * Generate a 10-character Crockford Base32 ID.
 * ~50 bits of entropy — collision-safe for prototype volumes.
 *
 * @param {number} [length=10]
 * @returns {string}
 */
export function generateId(length = 10) {
  const bytes = crypto.randomBytes(length);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += ALPHABET[bytes[i] % 32];
  }
  return id;
}
