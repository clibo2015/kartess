/**
 * Socket.io rate limiting middleware
 * Prevents DoS attacks via Socket.io events
 */

class SocketRateLimiter {
  constructor() {
    // Store: { socketId: { eventName: [timestamps] } }
    this.requests = new Map();
    
    // Cleanup interval (remove old entries every 5 minutes)
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Rate limit configuration per event
   */
  getLimitConfig(eventName) {
    const configs = {
      'thread:typing': { max: 10, window: 60000 }, // 10 per minute
      'join:thread': { max: 20, window: 60000 }, // 20 per minute
      'subscribe:posts': { max: 5, window: 60000 }, // 5 per minute
      'join:user': { max: 5, window: 60000 }, // 5 per minute
      default: { max: 30, window: 60000 }, // 30 per minute for other events
    };

    return configs[eventName] || configs.default;
  }

  /**
   * Check if request should be allowed
   */
  checkLimit(socketId, eventName) {
    const now = Date.now();
    const config = this.getLimitConfig(eventName);

    if (!this.requests.has(socketId)) {
      this.requests.set(socketId, {});
    }

    const socketData = this.requests.get(socketId);
    
    if (!socketData[eventName]) {
      socketData[eventName] = [];
    }

    const timestamps = socketData[eventName];
    
    // Remove timestamps outside the window
    const validTimestamps = timestamps.filter(ts => now - ts < config.window);
    
    // Check if limit exceeded
    if (validTimestamps.length >= config.max) {
      return { allowed: false, remaining: 0, resetAt: validTimestamps[0] + config.window };
    }

    // Add current timestamp
    validTimestamps.push(now);
    socketData[eventName] = validTimestamps;

    return { 
      allowed: true, 
      remaining: config.max - validTimestamps.length,
      resetAt: now + config.window
    };
  }

  /**
   * Cleanup old entries
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    for (const [socketId, data] of this.requests.entries()) {
      let hasRecentActivity = false;

      for (const eventName in data) {
        const timestamps = data[eventName];
        const validTimestamps = timestamps.filter(ts => now - ts < maxAge);
        
        if (validTimestamps.length > 0) {
          data[eventName] = validTimestamps;
          hasRecentActivity = true;
        } else {
          delete data[eventName];
        }
      }

      if (!hasRecentActivity) {
        this.requests.delete(socketId);
      }
    }
  }

  /**
   * Clear entries for a socket (on disconnect)
   */
  clearSocket(socketId) {
    this.requests.delete(socketId);
  }
}

const rateLimiter = new SocketRateLimiter();

/**
 * Socket.io rate limiting middleware
 */
function socketRateLimitMiddleware(socket, next) {
  // Attach rate limiter to socket
  socket.rateLimiter = rateLimiter;
  next();
}

/**
 * Check rate limit for an event
 */
function checkSocketRateLimit(socket, eventName) {
  const result = rateLimiter.checkLimit(socket.id, eventName);
  
  if (!result.allowed) {
    socket.emit('error', {
      type: 'rate_limit_exceeded',
      message: `Too many ${eventName} requests. Please slow down.`,
      resetAt: result.resetAt,
    });
    return false;
  }

  return true;
}

module.exports = {
  socketRateLimitMiddleware,
  checkSocketRateLimit,
  rateLimiter,
};

