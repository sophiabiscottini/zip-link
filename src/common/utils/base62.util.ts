/**
 * Base62 Encoder/Decoder Utility
 *
 * Uses the alphabet: 0-9, a-z, A-Z (62 characters)
 * This is used to convert numeric IDs to short, URL-friendly codes.
 *
 * Example:
 *   encode(1000) => "g8"
 *   decode("g8") => 1000
 */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE = ALPHABET.length; // 62

/**
 * Encode a number to Base62 string
 * @param num - The number to encode
 * @returns Base62 encoded string
 */
export function encodeBase62(num: number): string {
  if (num === 0) return ALPHABET[0];

  let result = '';
  let n = num;

  while (n > 0) {
    result = ALPHABET[n % BASE] + result;
    n = Math.floor(n / BASE);
  }

  return result;
}

/**
 * Decode a Base62 string to number
 * @param str - The Base62 string to decode
 * @returns The decoded number
 */
export function decodeBase62(str: string): number {
  let result = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const index = ALPHABET.indexOf(char);

    if (index === -1) {
      throw new Error(`Invalid Base62 character: ${char}`);
    }

    result = result * BASE + index;
  }

  return result;
}

/**
 * Generate a random short code of specified length
 * This is used as a fallback or for custom generation
 * @param length - The length of the short code (default: 6)
 * @returns Random Base62 string
 */
export function generateRandomCode(length: number = 6): string {
  let result = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * BASE);
    result += ALPHABET[randomIndex];
  }

  return result;
}

/**
 * Pad a Base62 encoded string to a minimum length
 * @param encoded - The encoded string
 * @param minLength - Minimum length (default: 6)
 * @returns Padded string
 */
export function padBase62(encoded: string, minLength: number = 6): string {
  return encoded.padStart(minLength, '0');
}
