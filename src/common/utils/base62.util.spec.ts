import { encodeBase62, decodeBase62, generateRandomCode, padBase62 } from './base62.util';

describe('Base62 Utility', () => {
  describe('encodeBase62', () => {
    it('should encode 0 to "0"', () => {
      expect(encodeBase62(0)).toBe('0');
    });

    it('should encode small numbers correctly', () => {
      expect(encodeBase62(1)).toBe('1');
      expect(encodeBase62(10)).toBe('a');
      expect(encodeBase62(36)).toBe('A');
      expect(encodeBase62(61)).toBe('Z');
    });

    it('should encode larger numbers correctly', () => {
      expect(encodeBase62(62)).toBe('10');
      expect(encodeBase62(1000)).toBe('g8');
      expect(encodeBase62(123456)).toBe('w7e');
    });
  });

  describe('decodeBase62', () => {
    it('should decode "0" to 0', () => {
      expect(decodeBase62('0')).toBe(0);
    });

    it('should decode short codes correctly', () => {
      expect(decodeBase62('1')).toBe(1);
      expect(decodeBase62('a')).toBe(10);
      expect(decodeBase62('A')).toBe(36);
      expect(decodeBase62('Z')).toBe(61);
    });

    it('should decode longer codes correctly', () => {
      expect(decodeBase62('10')).toBe(62);
      expect(decodeBase62('g8')).toBe(1000);
      expect(decodeBase62('w7e')).toBe(123456);
    });

    it('should throw error for invalid characters', () => {
      expect(() => decodeBase62('abc!')).toThrow('Invalid Base62 character');
    });
  });

  describe('encode/decode roundtrip', () => {
    it('should correctly roundtrip various numbers', () => {
      const testNumbers = [0, 1, 10, 62, 100, 1000, 10000, 1000000];
      
      testNumbers.forEach((num) => {
        const encoded = encodeBase62(num);
        const decoded = decodeBase62(encoded);
        expect(decoded).toBe(num);
      });
    });
  });

  describe('generateRandomCode', () => {
    it('should generate code with default length of 6', () => {
      const code = generateRandomCode();
      expect(code.length).toBe(6);
    });

    it('should generate code with custom length', () => {
      const code = generateRandomCode(10);
      expect(code.length).toBe(10);
    });

    it('should only contain valid Base62 characters', () => {
      const code = generateRandomCode(100);
      const validChars = /^[0-9a-zA-Z]+$/;
      expect(validChars.test(code)).toBe(true);
    });
  });

  describe('padBase62', () => {
    it('should pad short strings to minimum length', () => {
      expect(padBase62('abc', 6)).toBe('000abc');
      expect(padBase62('a', 6)).toBe('00000a');
    });

    it('should not truncate strings longer than minimum', () => {
      expect(padBase62('abcdefgh', 6)).toBe('abcdefgh');
    });

    it('should use custom minimum length', () => {
      expect(padBase62('a', 4)).toBe('000a');
    });
  });
});
