const express = require('express');
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/users/:username
 * Get user by username
 */
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        profile: true,
        _count: {
          select: {
            posts: true,
            sentContacts: { where: { status: 'approved' } },
            receivedContacts: { where: { status: 'approved' } },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/:username/analytics
 * Get user analytics
 */
router.get('/:username/analytics', authMiddleware, async (req, res) => {
  try {
    const { username } = req.params;

    // Only allow users to see their own analytics
    if (req.user.username !== username) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [posts, reactions, comments, contacts] = await Promise.all([
      prisma.post.findMany({
        where: { user_id: req.user.id },
        include: {
          _count: {
            select: { reactions: true, comments: true },
          },
        },
      }),
      prisma.reaction.findMany({
        where: { post: { user_id: req.user.id } },
      }),
      prisma.comment.findMany({
        where: { post: { user_id: req.user.id } },
      }),
      prisma.contact.findMany({
        where: {
          OR: [
            { sender_id: req.user.id, status: 'approved' },
            { receiver_id: req.user.id, status: 'approved' },
          ],
        },
      }),
    ]);

    const totalReactions = reactions.length;
    const totalComments = comments.length;
    const avgReactions = posts.length > 0 ? totalReactions / posts.length : 0;
    const avgComments = posts.length > 0 ? totalComments / posts.length : 0;

    res.json({
      posts: {
        total: posts.length,
      },
      reactions: {
        total: totalReactions,
      },
      comments: {
        total: totalComments,
      },
      contacts: {
        total: contacts.length,
      },
      engagement: {
        avgReactions,
        avgComments,
      },
    });
  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/users/settings
 * Update user settings
 */
router.patch('/settings', authMiddleware, async (req, res) => {
  try {
    const { privacy, notifications } = req.body;

    const settings = {};
    if (privacy) settings.privacy = privacy;
    if (notifications) settings.notifications = notifications;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        settings,
      },
      select: {
        id: true,
        settings: true,
      },
    });

    res.json({ user });
  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/users/account
 * Delete user's own account
 */
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete all refresh tokens for this user first (explicit cleanup)
    await prisma.refreshToken.deleteMany({
      where: { user_id: userId },
    });

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id: userId },
    });

    logger.info('Account deleted', { userId, requestId: req.requestId });
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    logger.logError(error, req, { userId: req.user.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;