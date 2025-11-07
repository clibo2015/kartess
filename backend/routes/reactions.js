const express = require('express');
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/reactions
 * Create or update reaction
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { post_id, type } = req.body;

    if (!post_id || !type) {
      return res.status(400).json({ error: 'Post ID and reaction type are required' });
    }

    const validTypes = ['like', 'love', 'wow', 'sad', 'angry', 'endorse'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    // Check if reaction already exists
    const existing = await prisma.reaction.findFirst({
      where: {
        post_id,
        user_id: req.user.id,
      },
    });

    let reaction;
    if (existing) {
      // Update existing reaction
      if (existing.type === type) {
        // Same type, remove reaction (toggle off)
        await prisma.reaction.delete({
          where: { id: existing.id },
        });
        return res.json({ message: 'Reaction removed', reaction: null });
      } else {
        // Different type, update
        reaction = await prisma.reaction.update({
          where: { id: existing.id },
          data: { type },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                full_name: true,
              },
            },
          },
        });
      }
    } else {
      // Create new reaction
      reaction = await prisma.reaction.create({
        data: {
          post_id,
          user_id: req.user.id,
          type,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              full_name: true,
            },
          },
        },
      });
    }

    // Emit via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to('posts').emit('reaction.update', {
        post_id,
        reaction,
      });
    }

    res.json(reaction);
  } catch (error) {
    console.error('Reaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reactions/post/:postId
 * Get reactions for a post
 */
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

    const reactions = await prisma.reaction.findMany({
      where: { post_id: postId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            profile: {
              select: {
                avatar_url: true,
              },
            },
          },
        },
      },
    });

    // Group by type
    const grouped = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.type]) {
        acc[reaction.type] = [];
      }
      acc[reaction.type].push(reaction);
      return acc;
    }, {});

    res.json({ reactions: grouped, total: reactions.length });
  } catch (error) {
    console.error('Get reactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/reactions/:reactionId
 * Delete reaction
 */
router.delete('/:reactionId', authMiddleware, async (req, res) => {
  try {
    const { reactionId } = req.params;

    const reaction = await prisma.reaction.findUnique({
      where: { id: reactionId },
    });

    if (!reaction) {
      return res.status(404).json({ error: 'Reaction not found' });
    }

    if (reaction.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.reaction.delete({
      where: { id: reactionId },
    });

    // Emit via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to('posts').emit('reaction.update', {
        post_id: reaction.post_id,
        reaction: null,
      });
    }

    res.json({ message: 'Reaction deleted' });
  } catch (error) {
    console.error('Delete reaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
