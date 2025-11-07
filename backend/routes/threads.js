const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const createThreadSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required').max(280, 'Thread content must be 280 characters or less'),
  topic: z.string().optional(),
});

const createReplySchema = z.object({
  content: z.string().min(1, 'Content is required'),
  parent_id: z.string().optional(),
});

/**
 * GET /api/threads
 * Get all threads with filters
 */
router.get('/', async (req, res) => {
  try {
    const { topic, sort = 'recent', limit = 20, cursor } = req.query;

    const where = {};
    if (topic) {
      where.topic = topic;
    }

    let orderBy = { created_at: 'desc' };
    if (sort === 'popular') {
      orderBy = [{ replies_count: 'desc' }, { views_count: 'desc' }];
    } else if (sort === 'pinned') {
      orderBy = [{ pinned: 'desc' }, { created_at: 'desc' }];
    }

    const threads = await prisma.thread.findMany({
      where,
      take: parseInt(limit),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy,
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
          select: {
            replies: true,
          },
        },
      },
    });

    res.json({
      threads,
      nextCursor: threads.length === parseInt(limit) ? threads[threads.length - 1].id : null,
    });
  } catch (error) {
    console.error('Get threads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/threads/topics
 * Get all available topics
 */
router.get('/topics', async (req, res) => {
  try {
    const topics = await prisma.thread.groupBy({
      by: ['topic'],
      where: {
        topic: {
          not: null,
        },
      },
      _count: {
        topic: true,
      },
      orderBy: {
        _count: {
          topic: 'desc',
        },
      },
      take: 20,
    });

    res.json({ topics: topics.map((t) => ({ name: t.topic, count: t._count.topic })) });
  } catch (error) {
    console.error('Get topics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/threads
 * Create a new thread
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const validatedData = createThreadSchema.parse(req.body);

    const thread = await prisma.thread.create({
      data: {
        user_id: req.user.id,
        title: validatedData.title,
        content: validatedData.content,
        topic: validatedData.topic || undefined,
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
      },
    });

    res.status(201).json(thread);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Create thread error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/threads/:threadId
 * Get a single thread with replies
 */
router.get('/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params;

    // Increment views
    await prisma.thread.update({
      where: { id: threadId },
      data: { views_count: { increment: 1 } },
    });

    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
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
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    res.json(thread);
  } catch (error) {
    console.error('Get thread error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/threads/:threadId/replies
 * Create a reply to a thread
 */
router.post('/:threadId/replies', authMiddleware, async (req, res) => {
  try {
    const { threadId } = req.params;
    const validatedData = createReplySchema.parse(req.body);

    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    if (thread.locked) {
      return res.status(403).json({ error: 'Thread is locked' });
    }

    const reply = await prisma.threadReply.create({
      data: {
        thread_id: threadId,
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
      },
    });

    // Update thread reply count
    await prisma.thread.update({
      where: { id: threadId },
      data: { replies_count: { increment: 1 } },
    });

    // Create notification for thread author
    if (thread.user_id !== req.user.id) {
      await prisma.notification.create({
        data: {
          user_id: thread.user_id,
          sender_id: req.user.id,
          type: 'comment',
          title: 'New Thread Reply',
          message: `${req.user.full_name || req.user.username} replied to your thread`,
          link: `/threads/${threadId}`,
        },
      });

      // Emit notification via Socket.io
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${thread.user_id}`).emit('notification.new', {
          type: 'comment',
          title: 'New Thread Reply',
          message: `${req.user.full_name || req.user.username} replied to your thread`,
        });
      }
    }

    // Emit reply via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`thread:${threadId}`).emit('thread.reply.new', reply);
    }

    res.status(201).json(reply);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Create reply error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/threads/:threadId/pin
 * Pin/unpin a thread (admin/mod only)
 */
router.patch('/:threadId/pin', authMiddleware, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { pinned } = req.body;

    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // TODO: Check if user is admin/mod
    const updatedThread = await prisma.thread.update({
      where: { id: threadId },
      data: { pinned: pinned === true },
    });

    res.json(updatedThread);
  } catch (error) {
    console.error('Pin thread error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
