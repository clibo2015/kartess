const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const commentSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  parent_id: z.string().optional(),
});

/**
 * POST /api/comments
 * Create a comment
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { post_id, content, parent_id } = req.body;

    if (!post_id || !content) {
      return res.status(400).json({ error: 'Post ID and content are required' });
    }

    // Validate nesting level (max 3 levels)
    if (parent_id) {
      const parent = await prisma.comment.findUnique({
        where: { id: parent_id },
        include: {
          parent: {
            include: {
              parent: true,
            },
          },
        },
      });

      if (!parent) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }

      // Check nesting level
      let level = 1;
      let current = parent;
      while (current.parent) {
        level++;
        current = current.parent;
      }

      if (level >= 3) {
        return res.status(400).json({ error: 'Maximum nesting level reached' });
      }
    }

    const validatedData = commentSchema.parse({ content, parent_id });

    const comment = await prisma.comment.create({
      data: {
        post_id,
        user_id: req.user.id,
        content: validatedData.content,
        parent_id: validatedData.parent_id || undefined,
      },
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
        parent: {
          select: {
            id: true,
            user: {
              select: {
                username: true,
              },
            },
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    // Create notification for post author
    const post = await prisma.post.findUnique({
      where: { id: post_id },
      select: { user_id: true },
    });

    if (post && post.user_id !== req.user.id) {
      await prisma.notification.create({
        data: {
          user_id: post.user_id,
          sender_id: req.user.id,
          type: 'comment',
          title: 'New Comment',
          message: `${req.user.full_name || req.user.username} commented on your post`,
          link: `/posts/${post_id}?commentId=${comment.id}`,
        },
      });

      // Emit notification via Socket.io
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${post.user_id}`).emit('notification.new', {
          type: 'comment',
          title: 'New Comment',
          message: `${req.user.full_name || req.user.username} commented on your post`,
        });
      }
    }

    // Emit comment via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to('posts').emit('comment.new', comment);
    }

    res.status(201).json(comment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/comments/post/:postId
 * Get comments for a post (nested structure)
 */
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

    // Get all comments for the post
    const allComments = await prisma.comment.findMany({
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
        replies: {
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
            replies: {
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
            },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    // Build nested structure (only top-level comments with replies)
    const topLevelComments = allComments.filter((comment) => !comment.parent_id);
    const nestedComments = topLevelComments.map((comment) => {
      const replies = allComments.filter((c) => c.parent_id === comment.id);
      const nestedReplies = replies.map((reply) => {
        const nestedReplies2 = allComments.filter((c) => c.parent_id === reply.id);
        return {
          ...reply,
          replies: nestedReplies2,
        };
      });

      return {
        ...comment,
        replies: nestedReplies,
      };
    });

    res.json({ comments: nestedComments });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/comments/:commentId
 * Delete a comment
 */
router.delete('/:commentId', authMiddleware, async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    // Emit via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to('posts').emit('comment.deleted', {
        comment_id: commentId,
        post_id: comment.post_id,
      });
    }

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
