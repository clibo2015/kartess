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
      path.includes('/api/auth/register')) {
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

  // Validate token
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
 * Only sets token if one doesn't exist, or for GET requests
 */
function setCSRFToken(req, res, next) {
  // Skip for auth endpoints (login/register don't need CSRF tokens initially)
  const path = req.path || req.originalUrl || '';
  if (path.includes('/api/auth/login') || path.includes('/api/auth/register')) {
    return next();
  }

  // Only set token if it doesn't exist or if it's a GET request
  const existingToken = req.cookies?.csrf_token;
  
  if (!existingToken || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const token = existingToken || generateCSRFToken();
    res.cookie('csrf_token', token, {
      httpOnly: false, // Must be readable by JavaScript for double-submit
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
    
    // Also set in response header for easy access
    res.setHeader('X-CSRF-Token', token);
  } else {
    // Use existing token in header
    res.setHeader('X-CSRF-Token', existingToken);
  }
  
  next();
}

module.exports = {
  csrfProtection,
  setCSRFToken,
  generateCSRFToken,
};

