/**
 * CSRF Protection Middleware
 * Uses double-submit cookie pattern for stateless CSRF protection
 */

const crypto = require('crypto');

/**
 * Generate CSRF token
 */
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF protection middleware
 * Validates CSRF token for state-changing requests
 */
function csrfProtection(req, res, next) {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip for health check and public endpoints (check both path and originalUrl)
  const path = req.path || req.originalUrl || '';
  if (path === '/health' || 
      path.includes('/api/auth/login') || 
      path.includes('/api/auth/register') ||
      path.includes('/api/auth/verify') ||
      path.includes('/api/profile/complete') ||
      path.includes('/api/qr/generate') ||
      path.includes('/api/qr/consume')) {
    // Skip CSRF for JWT-protected endpoints - JWT provides sufficient protection
    // These endpoints require authentication via authMiddleware
    return next();
  }

  // Get token from header or body
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const cookieToken = req.cookies?.csrf_token;

  // In development, be more lenient
  if (process.env.NODE_ENV !== 'production') {
    if (!token && !cookieToken) {
      // Generate and set token for first request
      const newToken = generateCSRFToken();
      res.cookie('csrf_token', newToken, {
        httpOnly: false, // Must be readable by JavaScript
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });
      return next();
    }
  }

  // Validate token - both must be present and match
  // Note: For JWT-protected endpoints, CSRF is skipped above
  // This validation only applies to endpoints that require CSRF protection
  if (!token || !cookieToken || token !== cookieToken) {
    return res.status(403).json({ 
      error: 'Invalid CSRF token',
      requestId: req.id,
    });
  }

  next();
}

/**
 * Generate and set CSRF token (for initial page load)
 * Sets token for all requests to ensure it's available for subsequent requests
 */
function setCSRFToken(req, res, next) {
  // Always set CSRF token (even for auth endpoints) so it's available for subsequent requests
  const path = req.path || req.originalUrl || '';
  const existingToken = req.cookies?.csrf_token;
  
  // Generate new token if one doesn't exist, or reuse existing
  const token = existingToken || generateCSRFToken();
  
  // Set cookie with appropriate settings
  res.cookie('csrf_token', token, {
    httpOnly: false, // Must be readable by JavaScript for double-submit
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'strict', // Use 'lax' in production for cross-origin support
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/', // Ensure cookie is available for all paths
  });
  
  // Also set in response header for easy access
  res.setHeader('X-CSRF-Token', token);
  
  next();
}

module.exports = {
  csrfProtection,
  setCSRFToken,
  generateCSRFToken,
};

