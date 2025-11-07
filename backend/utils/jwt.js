const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

/**
 * Generate JWT token for user
 * @param {Object} payload - User data to encode
 * @param {string} payload.id - User ID
 * @param {string} payload.email - User email
 * @returns {string} JWT token
 */
/**
 * Generate access token (short-lived)
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h', // Reduced from 7d for better security
  });
}

/**
 * Generate refresh token (long-lived)
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d', // Refresh tokens can be longer-lived
  });
}

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Hash refresh token for storage in database
 * @param {string} token - Refresh token to hash
 * @returns {string} Hashed token
 */
function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify refresh token hash matches
 * @param {string} token - Original token
 * @param {string} hashedToken - Hashed token from database
 * @returns {boolean} True if tokens match
 */
function verifyRefreshTokenHash(token, hashedToken) {
  const hash = hashRefreshToken(token);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hashedToken));
}

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  hashRefreshToken,
  verifyRefreshTokenHash,
};
