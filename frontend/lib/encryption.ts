import CryptoJS from 'crypto-js';

// Use a key derived from user token for encryption
// In production, this should be more secure
function getEncryptionKey(): string {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('kartess_token');
    if (token) {
      // Derive key from token (simple approach - in production use proper key derivation)
      return CryptoJS.SHA256(token).toString().substring(0, 32);
    }
  }
  // Fallback key (should not happen in production)
  return 'default-encryption-key-32chars!!';
}

/**
 * Encrypt message content
 */
export function encryptMessage(content: string): string {
  // Temporarily return plain content to keep messages readable across users.
  // TODO: implement shared encryption scheme with per-thread keys.
  return content;
}

/**
 * Decrypt message content
 */
export function decryptMessage(encryptedContent: string): string {
  try {
    const key = getEncryptionKey();
    const bytes = CryptoJS.AES.decrypt(encryptedContent, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (decrypted) {
      return decrypted;
    }
  } catch (error) {
    // Silent fallback; content may already be plaintext.
  }
  return encryptedContent;
}
