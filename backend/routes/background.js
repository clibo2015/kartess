const express = require('express');
const prisma = require('../prisma/client');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware to verify Trigger.dev webhook secret
const verifyWebhook = (req, res, next) => {
  const secret = process.env.TRIGGER_API_KEY;
  const providedSecret = req.headers['x-trigger-secret'];

  if (!secret || providedSecret !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

/**
 * POST /api/background/expire-stories
 * Background job to expire old stories (can be triggered by Trigger.dev)
 */
router.post('/expire-stories', verifyWebhook, async (req, res) => {
  try {
    // Get stories older than 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const oldStories = await prisma.post.findMany({
      where: {
        is_story: true,
        created_at: {
          lt: twentyFourHoursAgo,
        },
      },
    });

    // Delete expired stories
    const deleted = await prisma.post.deleteMany({
      where: {
        is_story: true,
        created_at: {
          lt: twentyFourHoursAgo,
        },
      },
    });

    res.json({
      message: 'Stories expired',
      deleted: deleted.count,
      processed: oldStories.length,
    });
  } catch (error) {
    logger.logError(error, req, { context: 'Expire stories' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/background/cleanup-tokens
 * Clean up expired QR tokens
 */
router.post('/cleanup-tokens', verifyWebhook, async (req, res) => {
  try {
    const now = new Date();

    const deleted = await prisma.qrToken.deleteMany({
      where: {
        expires_at: {
          lt: now,
        },
      },
    });

    res.json({
      message: 'Tokens cleaned up',
      deleted: deleted.count,
    });
  } catch (error) {
    logger.logError(error, req, { context: 'Cleanup QR tokens' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/background/cleanup-refresh-tokens
 * Clean up expired refresh tokens
 */
router.post('/cleanup-refresh-tokens', verifyWebhook, async (req, res) => {
  try {
    const now = new Date();

    const deleted = await prisma.refreshToken.deleteMany({
      where: {
        expires_at: {
          lt: now,
        },
      },
    });

    res.json({
      message: 'Refresh tokens cleaned up',
      deleted: deleted.count,
    });
  } catch (error) {
    logger.logError(error, req, { context: 'Cleanup refresh tokens' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
