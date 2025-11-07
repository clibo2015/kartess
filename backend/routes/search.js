const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

/**
 * GET /api/search
 * Search for users, posts, and hashtags
 */
router.get('/', async (req, res) => {
  try {
    const { q, type = 'all', limit = 20 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json({
        users: [],
        posts: [],
        hashtags: [],
      });
    }

    const searchTerm = q.trim().toLowerCase();
    const searchLimit = parseInt(limit);

    const results = {
      users: [],
      posts: [],
      hashtags: [],
    };

    // Search users (by username or full name)
    if (type === 'all' || type === 'users') {
      results.users = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: searchTerm, mode: 'insensitive' } },
            { full_name: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: searchLimit,
        select: {
          id: true,
          username: true,
          full_name: true,
          email: true,
          profile: {
            select: {
              avatar_url: true,
              bio: true,
            },
          },
        },
      });
    }

    // Search posts (full-text search on content)
    if (type === 'all' || type === 'posts') {
      // Use Prisma's search or contains for basic search
      results.posts = await prisma.post.findMany({
        where: {
          visibility: 'public',
          OR: [
            { content: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: searchLimit,
        orderBy: { created_at: 'desc' },
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
              reactions: true,
              comments: true,
            },
          },
        },
      });

      // Extract hashtags from posts that match the search term
      const allPosts = await prisma.post.findMany({
        where: {
          visibility: 'public',
          tags: { not: null },
        },
        select: {
          tags: true,
        },
      });

      const hashtagSet = new Set();
      allPosts.forEach((post) => {
        if (post.tags && Array.isArray(post.tags)) {
          post.tags.forEach((tag) => {
            if (tag.toLowerCase().includes(searchTerm)) {
              hashtagSet.add(tag);
            }
          });
        }
      });

      results.hashtags = Array.from(hashtagSet)
        .slice(0, searchLimit)
        .map((tag) => ({ tag, count: 0 })); // Could add count later
    }

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/search/autocomplete
 * Autocomplete for hashtags and mentions
 */
router.get('/autocomplete', async (req, res) => {
  try {
    const { q, type = 'hashtags' } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json({ suggestions: [] });
    }

    const searchTerm = q.trim().toLowerCase();

    if (type === 'hashtags') {
      // Get all unique hashtags from posts
      const posts = await prisma.post.findMany({
        where: {
          visibility: 'public',
          tags: { not: null },
        },
        select: {
          tags: true,
        },
      });

      const hashtagMap = new Map();
      posts.forEach((post) => {
        if (post.tags && Array.isArray(post.tags)) {
          post.tags.forEach((tag) => {
            const tagLower = tag.toLowerCase();
            if (tagLower.startsWith(searchTerm)) {
              hashtagMap.set(tag, (hashtagMap.get(tag) || 0) + 1);
            }
          });
        }
      });

      const suggestions = Array.from(hashtagMap.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return res.json({ suggestions });
    } else if (type === 'mentions') {
      // Search for users to mention
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: searchTerm, mode: 'insensitive' } },
            { full_name: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: 10,
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
      });

      return res.json({
        suggestions: users.map((user) => ({
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          avatar_url: user.profile?.avatar_url,
        })),
      });
    }

    res.json({ suggestions: [] });
  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
