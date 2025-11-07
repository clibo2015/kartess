const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const createHighlightSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  story_ids: z.array(z.string()).min(1, 'At least one story is required'),
  cover_url: z.string().url().optional(),
});

/**
 * GET /api/highlights/user/:userId
 * Get user's story highlights
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const highlights = await prisma.storyHighlight.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    // Fetch story details for each highlight
    const highlightsWithStories = await Promise.all(
      highlights.map(async (highlight) => {
        const storyIds = Array.isArray(highlight.story_ids) ? highlight.story_ids : [];
        const stories = await prisma.post.findMany({
          where: {
            id: { in: storyIds },
            is_story: true,
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
          orderBy: { created_at: 'asc' },
        });

        return {
          ...highlight,
          stories,
        };
      })
    );

    res.json({ highlights: highlightsWithStories });
  } catch (error) {
    console.error('Get highlights error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/highlights
 * Create a story highlight
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const validatedData = createHighlightSchema.parse(req.body);

    // Verify all stories belong to user and are actual stories
    const stories = await prisma.post.findMany({
      where: {
        id: { in: validatedData.story_ids },
        user_id: req.user.id,
        is_story: true,
      },
    });

    if (stories.length !== validatedData.story_ids.length) {
      return res.status(400).json({ error: 'Invalid story IDs' });
    }

    const highlight = await prisma.storyHighlight.create({
      data: {
        user_id: req.user.id,
        title: validatedData.title,
        story_ids: validatedData.story_ids,
        cover_url: validatedData.cover_url || undefined,
      },
    });

    res.status(201).json(highlight);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Create highlight error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/highlights/:highlightId
 * Delete a highlight
 */
router.delete('/:highlightId', authMiddleware, async (req, res) => {
  try {
    const { highlightId } = req.params;

    const highlight = await prisma.storyHighlight.findUnique({
      where: { id: highlightId },
    });

    if (!highlight) {
      return res.status(404).json({ error: 'Highlight not found' });
    }

    if (highlight.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.storyHighlight.delete({
      where: { id: highlightId },
    });

    res.json({ message: 'Highlight deleted' });
  } catch (error) {
    console.error('Delete highlight error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
