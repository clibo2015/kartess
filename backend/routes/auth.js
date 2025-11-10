const express = require('express');
const { z } = require('zod');
const { hashPassword, comparePassword } = require('../utils/bcrypt');
const { generateToken, generateRefreshToken, hashRefreshToken, verifyRefreshTokenHash, verifyToken } = require('../utils/jwt');
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const registerSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .regex(/^[a-zA-Z0-9]+$/, 'Username must be alphanumeric'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one symbol'),
  qr_token: z.string().optional(), // Optional QR token for non-user signup flow
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Helper function to create and store refresh token
 * @param {string} userId - User ID
 * @returns {Promise<{refreshToken: string, expiresAt: Date}>}
 */
async function createRefreshToken(userId) {
  // Generate refresh token
  const refreshToken = generateRefreshToken({
    id: userId,
  });

  // Calculate expiry date (7 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Hash token for storage
  const hashedToken = hashRefreshToken(refreshToken);

  // Store in database
  await prisma.refreshToken.create({
    data: {
      user_id: userId,
      token: hashedToken,
      expires_at: expiresAt,
    },
  });

  return { refreshToken, expiresAt };
}

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    // Validate input
    const validatedData = registerSchema.parse(req.body);

    // Check if email already exists
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUserByEmail) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Check if username already exists
    const existingUserByUsername = await prisma.user.findUnique({
      where: { username: validatedData.username },
    });

    if (existingUserByUsername) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const password_hash = await hashPassword(validatedData.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        username: validatedData.username,
        password_hash,
        full_name: validatedData.full_name,
      },
      select: {
        id: true,
        email: true,
        username: true,
        full_name: true,
      },
    });

    // Generate JWT access token
    const token = generateToken({
      id: user.id,
      email: user.email,
    });

    // Generate and store refresh token
    const { refreshToken } = await createRefreshToken(user.id);

    // If QR token provided, consume it after signup (auto-approve contact)
    let qrContact = null;
    if (validatedData.qr_token) {
      try {
        // Make internal request to consume QR token
        const axios = require('axios');
        const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
        
        const response = await axios.post(
          `${baseUrl}/api/qr/consume-after-signup`,
          { token: validatedData.qr_token },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        
        qrContact = response.data.contact;
      } catch (error) {
        // Log error but don't fail registration if QR consumption fails
        logger.logError(error, req, { context: 'QR consume-after-signup' });
        // Continue with registration even if QR consumption fails
      }
    }

    // Check if profile exists and is complete
    const profile = await prisma.profile.findUnique({
      where: { user_id: user.id },
    });

    const profileComplete = Boolean(
      profile &&
      profile.bio &&
      profile.bio.trim().length > 0
    );

    res.status(201).json({
      token,
      refreshToken,
      user,
      profileComplete, // Include profile completion status
      qrContact, // Include contact info if QR token was consumed
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    logger.logError(error, req, { context: 'Registration' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
  try {
    // Validate input
    const validatedData = loginSchema.parse(req.body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
      select: {
        id: true,
        email: true,
        username: true,
        full_name: true,
        password_hash: true,
      },
    });

    // Use generic error message to prevent user enumeration
    const genericError = 'Invalid email or password';
    
    if (!user) {
      return res.status(401).json({ error: genericError });
    }

    // Compare password
    const isPasswordValid = await comparePassword(
      validatedData.password,
      user.password_hash
    );

    if (!isPasswordValid) {
      return res.status(401).json({ error: genericError });
    }

    // Check profile completeness
    const profile = await prisma.profile.findUnique({
      where: { user_id: user.id },
    });

    const profileComplete = Boolean(
      profile &&
      profile.bio &&
      profile.bio.trim().length > 0
    );

    // Generate JWT access token
    const token = generateToken({
      id: user.id,
      email: user.email,
    });

    // Generate and store refresh token
    const { refreshToken } = await createRefreshToken(user.id);

    // Remove password_hash from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      token,
      refreshToken,
      user: userWithoutPassword,
      profileComplete,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    logger.logError(error, req, { context: 'Login' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    // Validate input
    const validatedData = refreshTokenSchema.parse(req.body);
    const { refreshToken } = validatedData;

    // Verify refresh token JWT
    let decoded;
    try {
      decoded = verifyToken(refreshToken);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Hash the provided refresh token to search in database
    const hashedToken = hashRefreshToken(refreshToken);

    // Find refresh token in database
    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        user_id: decoded.id,
        token: hashedToken,
      },
    });

    if (!storedToken) {
      return res.status(401).json({ error: 'Refresh token not found' });
    }

    // Check if token is expired
    if (new Date() > storedToken.expires_at) {
      // Clean up expired token
      await prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    // Verify user still exists and is not suspended
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        is_suspended: true,
      },
    });

    if (!user) {
      // Clean up token if user doesn't exist
      await prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.is_suspended) {
      return res.status(403).json({ error: 'User account is suspended' });
    }

    // Generate new access token
    const newAccessToken = generateToken({
      id: user.id,
      email: user.email,
    });

    // Optionally rotate refresh token (generate new one, delete old one)
    // For now, we'll keep the same refresh token but update expiry if needed
    // Token rotation can be added later for enhanced security

    res.json({
      token: newAccessToken,
      // Optionally return new refresh token if rotating
      // refreshToken: newRefreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    logger.logError(error, req, { context: 'Refresh token' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/verify
 * Verify JWT token and return user data with profile status
 */
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { user_id: req.user.id },
    });

    const profileComplete = Boolean(
      profile &&
      profile.bio &&
      profile.bio.trim().length > 0
    );

    res.json({
      user: req.user,
      profileComplete,
      profile: profile
        ? {
            bio: profile.bio,
            company: profile.company,
            position: profile.position,
            phone: profile.phone,
            education: profile.education,
            avatar_url: profile.avatar_url,
          }
        : null,
    });
  } catch (error) {
    logger.logError(error, req, { context: 'Verify token' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
