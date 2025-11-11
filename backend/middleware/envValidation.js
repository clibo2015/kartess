/**
 * Environment variable validation middleware
 * Validates all required environment variables at startup
 */

const logger = require('../utils/logger');

function validateEnv() {
  const required = {
    JWT_SECRET: process.env.JWT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV || 'development',
  };

  const optional = {
    FRONTEND_URL: process.env.FRONTEND_URL,
    CLOUDINARY_URL: process.env.CLOUDINARY_URL,
    DAILY_API_KEY: process.env.DAILY_API_KEY,
    AGORA_APP_ID: process.env.AGORA_APP_ID,
    AGORA_APP_CERTIFICATE: process.env.AGORA_APP_CERTIFICATE,
    SENTRY_DSN: process.env.SENTRY_DSN,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_EMAIL: process.env.VAPID_EMAIL,
  };

  const missing = [];
  const warnings = [];

  // Check required variables
  for (const [key, value] of Object.entries(required)) {
    if (!value || value.trim() === '') {
      missing.push(key);
    }
  }

  // Check JWT_SECRET strength
  if (required.JWT_SECRET && required.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET should be at least 32 characters long for security');
  }

  // Check NODE_ENV
  if (required.NODE_ENV !== 'production' && required.NODE_ENV !== 'development' && required.NODE_ENV !== 'test') {
    warnings.push(`NODE_ENV is set to "${required.NODE_ENV}", expected 'production', 'development', or 'test'`);
  }

  // Production-specific checks
  if (required.NODE_ENV === 'production') {
    if (!optional.FRONTEND_URL) {
      warnings.push('FRONTEND_URL is recommended in production for CORS configuration');
    }
    
    if (!optional.CLOUDINARY_URL) {
      warnings.push('CLOUDINARY_URL is required for file uploads in production');
    }
  }

  // Report missing required variables
  if (missing.length > 0) {
    logger.error('Missing required environment variables', { missing });
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Report warnings
  if (warnings.length > 0) {
    warnings.forEach(warning => logger.warn(warning));
  }

  logger.info('Environment variables validated');
  return true;
}

module.exports = validateEnv;

