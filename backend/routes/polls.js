const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const createPollSchema = z.object({
  post_id: z.string(),
  options: z.array(z.string().min(1)).min(2).max(4), // 2-4 options
});

const votePollSchema = z.object({
  option_id: z.string().min(1),
});

/**
 * POST /api/polls
 * Create a poll (attach to post)
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const validatedData = createPollSchema.parse(req.body);

    const post = await prisma.post.findUnique({
      where: { id: validatedData.post_id },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Create poll options
    const pollOptions = await Promise.all(
      validatedData.options.map((optionText) =>
        prisma.pollOption.create({
          data: {
            post_id: validatedData.post_id,
            option_text: optionText,
          },
        })
      )
    );

    // Update post to mark as poll
    await prisma.post.update({
      where: { id: validatedData.post_id },
      data: { is_poll: true },
    });

    res.status(201).json({ pollOptions });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Create poll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/polls/post/:postId
 * Get poll for a post
 */
router.get('/post/:postId', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;

    const pollOptions = await prisma.pollOption.findMany({
      where: { post_id: postId },
      include: {
        _count: {
          select: { votes: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    // Check if user has voted
    const userVote = await prisma.pollVote.findUnique({
      where: {
        post_id_user_id: {
          post_id: postId,
          user_id: req.user.id,
        },
      },
      include: {
        option: true,
      },
    });

    const totalVotes = pollOptions.reduce((sum, opt) => sum + opt._count.votes, 0);

    res.json({
      options: pollOptions.map((opt) => ({
        id: opt.id,
        option_text: opt.option_text,
        vote_count: opt._count.votes,
        percentage: totalVotes > 0 ? (opt._count.votes / totalVotes) * 100 : 0,
      })),
      totalVotes,
      userVote: userVote
        ? {
            option_id: userVote.option_id,
            option_text: userVote.option.option_text,
          }
        : null,
    });
  } catch (error) {
    console.error('Get poll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/polls/vote
 * Vote on a poll
 */
router.post('/vote', authMiddleware, async (req, res) => {
  try {
    const { post_id, option_id } = req.body;
    const validatedData = votePollSchema.parse({ option_id });

    // Check if already voted
    const existingVote = await prisma.pollVote.findUnique({
      where: {
        post_id_user_id: {
          post_id,
          user_id: req.user.id,
        },
      },
    });

    if (existingVote) {
      return res.status(400).json({ error: 'Already voted on this poll' });
    }

    // Verify option belongs to post
    const option = await prisma.pollOption.findUnique({
      where: { id: validatedData.option_id },
    });

    if (!option || option.post_id !== post_id) {
      return res.status(400).json({ error: 'Invalid poll option' });
    }

    // Create vote
    const vote = await prisma.pollVote.create({
      data: {
        post_id,
        option_id: validatedData.option_id,
        user_id: req.user.id,
      },
    });

    // Update option vote count
    await prisma.pollOption.update({
      where: { id: validatedData.option_id },
      data: { vote_count: { increment: 1 } },
    });

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`post:${post_id}`).emit('poll.vote', {
        post_id,
        option_id: validatedData.option_id,
        user_id: req.user.id,
      });
    }

    res.status(201).json({ vote });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Vote poll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
