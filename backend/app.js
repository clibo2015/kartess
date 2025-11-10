require('dotenv').config();

// Validate environment variables FIRST (before any other imports)
const validateEnv = require('./middleware/envValidation');
const logger = require('./utils/logger');
const { version: appVersion } = require('./package.json');
try {
  validateEnv();
} catch (error) {
  logger.error('Environment validation failed', { error: error.message });
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const Sentry = require('@sentry/node');
const prisma = require('./prisma/client');

// Initialize Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
  });
}

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy - REQUIRED for Railway and other cloud platforms
// This allows Express to correctly identify client IPs behind reverse proxies
app.set('trust proxy', true);

// Security middleware (must be early in the chain)
const { enforceHTTPS, requestIdMiddleware, sanitizeError } = require('./middleware/security');

// HTTPS enforcement (before other middleware)
if (isProduction) {
  app.use(enforceHTTPS);
}

// Request ID middleware for tracing (before Sentry)
app.use(requestIdMiddleware);

// Sentry request handler
app.use(Sentry.Handlers.requestHandler());

// Helmet.js security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://*.cloudinary.com"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:3000'].filter(Boolean),
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow Cloudinary iframes
}));

// Compression middleware
app.use(compression());

// CORS configuration - FIXED: No longer allows all origins
const allowedOrigins = isProduction && process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : isProduction
  ? ['https://kartess-production.up.railway.app', 'http://localhost:3000', /^https:\/\/.*\.vercel\.app$/] // Temporarily allow Railway URL for testing
  : ['http://localhost:3000', /^https:\/\/.*\.vercel\.app$/]; // Development

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) {
      // Allow health checks and API testing without origin
      return callback(null, true);
    }
    
    // Check if origin matches allowed origins
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      if (typeof allowed === 'string' && allowed.includes('*')) {
        const pattern = allowed.replace(/\*/g, '.*');
        return new RegExp(pattern).test(origin);
      }
      return origin === allowed;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} is not allowed`), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Limit auth endpoints to 5 requests per 15 minutes
  message: 'Too many authentication attempts, please try again later.',
});

app.use(limiter);
app.use('/api/auth', authLimiter);

// Cookie parser for CSRF tokens
const cookieParser = require('cookie-parser');
app.use(cookieParser());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CSRF protection (before routes)
const { csrfProtection, setCSRFToken } = require('./middleware/csrf');
app.use(setCSRFToken); // Set CSRF token for all requests
app.use(csrfProtection); // Validate CSRF for state-changing requests

// Routes
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const postsRoutes = require('./routes/posts');
const searchRoutes = require('./routes/search');
const contactsRoutes = require('./routes/contacts');
const usersRoutes = require('./routes/users');
const presetsRoutes = require('./routes/presets');
const qrRoutes = require('./routes/qr');
const chatsRoutes = require('./routes/chats');
const messagesRoutes = require('./routes/messages');
const notificationsRoutes = require('./routes/notifications');
const reactionsRoutes = require('./routes/reactions');
const commentsRoutes = require('./routes/comments');
const storiesRoutes = require('./routes/stories');
const threadsRoutes = require('./routes/threads');
const careernetRoutes = require('./routes/careernet');
const liveRoutes = require('./routes/live');
const backgroundRoutes = require('./routes/background');
const adminRoutes = require('./routes/admin');
const reportsRoutes = require('./routes/reports');
const pollsRoutes = require('./routes/polls');
const bookmarksRoutes = require('./routes/bookmarks');
const highlightsRoutes = require('./routes/highlights');
const pushNotificationsRoutes = require('./routes/pushNotifications');

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/presets', presetsRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/reactions', reactionsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/threads', threadsRoutes);
app.use('/api/careernet', careernetRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/background', backgroundRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/polls', pollsRoutes);
app.use('/api/bookmarks', bookmarksRoutes);
app.use('/api/highlights', highlightsRoutes);
app.use('/api/notifications', pushNotificationsRoutes);

// Enhanced health check with richer diagnostics
app.get('/health', async (req, res) => {
  const startedAt = process.hrtime.bigint();
  const response = {
    timestamp: new Date().toISOString(),
    version: appVersion,
    environment: process.env.NODE_ENV || 'development',
    commit: process.env.GIT_SHA || null,
  };

  try {
    const dbStart = process.hrtime.bigint();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Number(process.hrtime.bigint() - dbStart) / 1e6;

    const uptimeSeconds = process.uptime();
    const memoryUsage = process.memoryUsage();
    const responseTimeMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    res.json({
      status: 'ok',
      ...response,
      uptimeSeconds: Number(uptimeSeconds.toFixed(2)),
      uptimeHuman: new Date(uptimeSeconds * 1000).toISOString().slice(11, 19),
      services: {
        database: {
          status: 'connected',
          latencyMs: Number(dbLatencyMs.toFixed(2)),
        },
      },
      metrics: {
        responseTimeMs: Number(responseTimeMs.toFixed(2)),
        memory: {
          rssMb: Number((memoryUsage.rss / 1024 / 1024).toFixed(2)),
          heapUsedMb: Number((memoryUsage.heapUsed / 1024 / 1024).toFixed(2)),
          heapTotalMb: Number((memoryUsage.heapTotal / 1024 / 1024).toFixed(2)),
        },
      },
    });
  } catch (error) {
    logger.logError(error, req, { context: 'Health check' });

    res.status(503).json({
      status: 'error',
      ...response,
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      services: {
        database: {
          status: 'disconnected',
          latencyMs: null,
        },
      },
      error: isProduction ? 'Service unavailable' : error.message,
    });
  }
});

// Sentry error handler must be before other error handlers
app.use(Sentry.Handlers.errorHandler());

// Error handler with sanitized messages
app.use((err, req, res, next) => {
  const requestId = req.id || 'unknown';
  const status = err.status || 500;
  
  // Log full error (with request ID for tracing)
  const logger = require('./utils/logger');
  logger.logError(err, req, {
    status,
    url: req.url,
    method: req.method,
  });

  // Send sanitized error message
  const errorMessage = sanitizeError(err, isProduction);
  
  res.status(status).json({
    error: errorMessage,
    requestId: requestId,
    ...(isProduction ? {} : { details: err.message }), // Only in development
  });
});

const PORT = process.env.PORT || 3001;

// Create HTTP server for Socket.io
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');

// Socket.io rate limiting
const { socketRateLimitMiddleware, checkSocketRateLimit, rateLimiter } = require('./middleware/socketRateLimit');

// Initialize Socket.io with security settings
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) {
        if (isProduction) {
          return callback(new Error('CORS: Origin required'), false);
        }
        return callback(null, true);
      }
      
      // Check if origin matches allowed origins
      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        if (typeof allowed === 'string' && allowed.includes('*')) {
          const pattern = allowed.replace(/\*/g, '.*');
          return new RegExp(pattern).test(origin);
        }
        return origin === allowed;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e6, // 1MB limit for Socket.io messages (FIXED: Issue #6)
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Socket.io middleware chain
const { verifyToken } = require('./utils/jwt');

// Apply rate limiting middleware first
io.use(socketRateLimitMiddleware);

// Then authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    
    if (!token) {
      // Allow unauthenticated connections for public features (posts subscription)
      // But they won't have userId
      return next();
    }

    // Verify token
    const decoded = verifyToken(token);
    
    // Fetch user to ensure it exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, full_name: true },
    });

    if (!user) {
      return next(new Error('User not found'));
    }

    // Attach user to socket
    socket.userId = user.id;
    socket.user = user;
    
    next();
  } catch (error) {
    // Allow connection but without userId (for public features)
    logger.debug('Socket auth error (allowing connection)', { error: error.message, socketId: socket.id });
    next();
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.debug('User connected', { socketId: socket.id, userId: socket.userId || null });

  // Auto-join user room if authenticated
  if (socket.userId) {
    socket.join(`user:${socket.userId}`);
    logger.debug('Socket auto-joined user room', { socketId: socket.id, userId: socket.userId });
  }

  // Rate-limited event handlers
  // Join posts channel for timeline updates
  socket.on('subscribe:posts', () => {
    if (!checkSocketRateLimit(socket, 'subscribe:posts')) return;
    socket.join('posts');
    logger.debug('Socket subscribed to posts', { socketId: socket.id });
  });

  // Leave posts channel
  socket.on('unsubscribe:posts', () => {
    socket.leave('posts');
    logger.debug('Socket unsubscribed from posts', { socketId: socket.id });
  });

  // Join thread for messaging
  socket.on('join:thread', (threadId) => {
    if (!checkSocketRateLimit(socket, 'join:thread')) return;
    socket.join(`thread:${threadId}`);
    logger.debug('Socket joined thread', { socketId: socket.id, threadId });
  });

  // Leave thread
  socket.on('leave:thread', (threadId) => {
    socket.leave(`thread:${threadId}`);
    logger.debug('Socket left thread', { socketId: socket.id, threadId });
  });

  // Typing indicator (rate limited)
  socket.on('thread:typing', (data) => {
    if (!socket.userId) {
      return; // Ignore if not authenticated
    }
    
    if (!checkSocketRateLimit(socket, 'thread:typing')) return;
    
    const { thread_id, typing } = data;
    socket.to(`thread:${thread_id}`).emit('thread:typing', {
      user_id: socket.userId,
      typing,
    });
  });

  // Join user room for notifications
  socket.on('join:user', (userId) => {
    if (!checkSocketRateLimit(socket, 'join:user')) return;
    
    // Only allow joining own user room
    if (socket.userId && socket.userId === userId) {
      socket.join(`user:${userId}`);
      logger.debug('Socket joined user room', { socketId: socket.id, userId });
    } else {
      logger.warn('Socket attempted to join unauthorized user room', { socketId: socket.id, requestedUserId: userId, socketUserId: socket.userId });
      socket.emit('error', { message: 'Unauthorized: Cannot join this user room' });
    }
  });

  socket.on('disconnect', () => {
    logger.debug('User disconnected', { socketId: socket.id });
    rateLimiter.clearSocket(socket.id);
  });
});

// Make io available to routes
app.set('io', io);

server.listen(PORT, () => {
  logger.info('Server started', { port: PORT, environment: process.env.NODE_ENV || 'development' });
  logger.info('Socket.io server ready');
});
