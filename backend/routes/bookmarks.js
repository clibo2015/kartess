const express = require('express');
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/bookmarks
 * Get user's bookmarks
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { limit = 50, cursor } = req.query;

    const bookmarks = await prisma.bookmark.findMany({
      where: { user_id: req.user.id },
      take: parseInt(limit),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { created_at: 'desc' },
      include: {
        post: {
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
            _count: {
              select: { reactions: true, comments: true },
            },
          },
        },
      },
    });

    res.json({
      bookmarks,
      nextCursor: bookmarks.length === parseInt(limit) ? bookmarks[bookmarks.length - 1].id : null,
    });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/bookmarks
 * Bookmark a post
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { post_id } = req.body;

    if (!post_id) {
      return res.status(400).json({ error: 'Post ID is required' });
    }

    // Check if already bookmarked
    const existing = await prisma.bookmark.findUnique({
      where: {
        user_id_post_id: {
          user_id: req.user.id,
          post_id,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Post already bookmarked' });
    }

    const bookmark = await prisma.bookmark.create({
      data: {
        user_id: req.user.id,
        post_id,
      },
      include: {
        post: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                full_name: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json(bookmark);
  } catch (error) {
    console.error('Create bookmark error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/bookmarks/:postId
 * Remove bookmark
 */
router.delete('/:postId', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;

    await prisma.bookmark.delete({
      where: {
        user_id_post_id: {
          user_id: req.user.id,
          post_id: postId,
        },
      },
    });

    res.json({ message: 'Bookmark removed' });
  } catch (error) {
    console.error('Delete bookmark error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/bookmarks/check/:postId
 * Check if post is bookmarked
 */
router.get('/check/:postId', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;

    const bookmark = await prisma.bookmark.findUnique({
      where: {
        user_id_post_id: {
          user_id: req.user.id,
          post_id: postId,
        },
      },
    });

    res.json({ bookmarked: !!bookmark });
  } catch (error) {
    console.error('Check bookmark error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
