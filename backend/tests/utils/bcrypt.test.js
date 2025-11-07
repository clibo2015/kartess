const bcrypt = require('bcrypt');
const { hashPassword, comparePassword } = require('../../utils/bcrypt');

describe('Bcrypt Utils', () => {
  describe('hashPassword', () => {
    it('should hash a password successfully', async () => {
      const password = 'Test123!@#';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2b$')).toBe(true); // bcrypt hash format
    });

    it('should produce different hashes for same password', async () => {
      const password = 'Test123!@#';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Bcrypt should produce different hashes due to salt
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for correct password', async () => {
      const password = 'Test123!@#';
      const hash = await hashPassword(password);

      const isValid = await comparePassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'Test123!@#';
      const wrongPassword = 'WrongPassword123!@#';
      const hash = await hashPassword(password);

      const isValid = await comparePassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should handle empty password', async () => {
      const hash = await hashPassword('Test123!@#');
      const isValid = await comparePassword('', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('Integration: hashPassword and comparePassword', () => {
    it('should work together correctly', async () => {
      const password = 'ComplexPassword123!@#$%';
      const hash = await hashPassword(password);
      const isValid = await comparePassword(password, hash);

      expect(isValid).toBe(true);
    });
  });
});

