/**
 * Security middleware
 * HTTPS enforcement and security headers
 */

/**
 * Enforce HTTPS in production
 */
function enforceHTTPS(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    // Check if request is secure (HTTPS)
    if (req.header('x-forwarded-proto') !== 'https' && req.secure !== true) {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
  }
  next();
}

/**
 * Generate request ID for tracing
 */
function requestIdMiddleware(req, res, next) {
  req.id = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
}

/**
 * Generic error message for production
 */
function sanitizeError(err, isProduction) {
  if (!isProduction) {
    return err;
  }

  // Don't leak sensitive information
  if (err.message) {
    // Generic error messages for common cases
    if (err.message.includes('User not found') || err.message.includes('Invalid credentials')) {
      return 'Invalid email or password';
    }
    if (err.message.includes('token')) {
      return 'Authentication failed';
    }
    if (err.message.includes('permission') || err.message.includes('authorized')) {
      return 'Access denied';
    }
    if (err.message.includes('database') || err.message.includes('connection')) {
      return 'Service temporarily unavailable';
    }
  }

  return 'An error occurred. Please try again later.';
}

module.exports = {
  enforceHTTPS,
  requestIdMiddleware,
  sanitizeError,
};

