const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');
const { adminMiddleware, adminOnlyMiddleware } = require('../middleware/admin');

const router = express.Router();

// All admin routes require authentication and admin/mod privileges
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * GET /api/admin/stats
 * Get platform statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalPosts,
      totalThreads,
      totalJobs,
      pendingReports,
      totalContacts,
      recentSignups,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          last_active: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
      prisma.post.count({ where: { is_story: false } }),
      prisma.thread.count(),
      prisma.job.count({ where: { status: 'open' } }),
      prisma.report.count({ where: { status: 'pending' } }),
      prisma.contact.count({ where: { status: 'approved' } }),
      prisma.user.count({
        where: {
          created_at: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
    ]);

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        recentSignups,
      },
      content: {
        posts: totalPosts,
        threads: totalThreads,
        jobs: totalJobs,
      },
      moderation: {
        pendingReports,
      },
      connections: {
        contacts: totalContacts,
      },
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/users
 * Get all users with pagination and filters
 */
router.get('/users', async (req, res) => {
  try {
    const { role, suspended, search, limit = 50, cursor } = req.query;

    const where = {};
    if (role) where.role = role;
    if (suspended === 'true') where.is_suspended = true;
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { full_name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      take: parseInt(limit),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        email: true,
        username: true,
        full_name: true,
        role: true,
        is_verified: true,
        is_suspended: true,
        suspended_until: true,
        last_active: true,
        created_at: true,
        _count: {
          select: {
            posts: true,
            comments: true,
            sentContacts: true,
          },
        },
      },
    });

    res.json({
      users,
      nextCursor: users.length === parseInt(limit) ? users[users.length - 1].id : null,
    });
  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/admin/users/:userId
 * Update user (suspend, change role, verify)
 */
router.patch('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, is_suspended, suspended_until, is_verified } = req.body;

    const updateData = {};
    if (role && req.user.role === 'admin') {
      updateData.role = role;
    }
    if (is_suspended !== undefined) {
      updateData.is_suspended = is_suspended;
      if (suspended_until) {
        updateData.suspended_until = new Date(suspended_until);
      } else if (!is_suspended) {
        updateData.suspended_until = null;
      }
    }
    if (is_verified !== undefined && req.user.role === 'admin') {
      updateData.is_verified = is_verified;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        full_name: true,
        role: true,
        is_verified: true,
        is_suspended: true,
        suspended_until: true,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete user (admin only)
 */
router.delete('/users/:userId', adminOnlyMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/reports
 * Get all reports with filters
 */
router.get('/reports', async (req, res) => {
  try {
    const { status = 'pending', limit = 50, cursor } = req.query;

    const reports = await prisma.report.findMany({
      where: { status },
      take: parseInt(limit),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { created_at: 'desc' },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            full_name: true,
          },
        },
      },
    });

    res.json({
      reports,
      nextCursor: reports.length === parseInt(limit) ? reports[reports.length - 1].id : null,
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/admin/reports/:reportId
 * Review and resolve a report
 */
router.patch('/reports/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, action_taken } = req.body;

    const updateData = {
      status: status || 'reviewed',
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
    };

    if (action_taken) {
      updateData.action_taken = action_taken;
    }

    const report = await prisma.report.update({
      where: { id: reportId },
      data: updateData,
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            full_name: true,
          },
        },
      },
    });

    res.json(report);
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/posts/:postId
 * Delete a post (moderation)
 */
router.delete('/posts/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

    await prisma.post.delete({
      where: { id: postId },
    });

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/comments/:commentId
 * Delete a comment (moderation)
 */
router.delete('/comments/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;

    await prisma.comment.delete({
      where: { id: commentId },
    });

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/admin/threads/:threadId/lock
 * Lock/unlock a thread
 */
router.patch('/threads/:threadId/lock', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { locked } = req.body;

    const thread = await prisma.thread.update({
      where: { id: threadId },
      data: { locked: locked === true },
    });

    res.json(thread);
  } catch (error) {
    console.error('Lock thread error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/analytics
 * Get platform analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const [
      userGrowth,
      postActivity,
      engagement,
      topUsers,
    ] = await Promise.all([
      // User growth over time
      prisma.user.groupBy({
        by: ['created_at'],
        where: {
          created_at: { gte: startDate },
        },
        _count: { id: true },
      }),

      // Post activity
      prisma.post.groupBy({
        by: ['created_at'],
        where: {
          created_at: { gte: startDate },
          is_story: false,
        },
        _count: { id: true },
      }),

      // Engagement metrics
      prisma.$queryRaw`
        SELECT 
          COUNT(DISTINCT p.id) as posts,
          COUNT(DISTINCT c.id) as comments,
          COUNT(DISTINCT r.id) as reactions
        FROM posts p
        LEFT JOIN comments c ON c.post_id = p.id
        LEFT JOIN reactions r ON r.post_id = p.id
        WHERE p.created_at >= ${startDate}
        AND p.is_story = false
      `,

      // Top users by activity
      prisma.user.findMany({
        take: 10,
        select: {
          id: true,
          username: true,
          full_name: true,
          _count: {
            select: {
              posts: true,
              comments: true,
            },
          },
        },
        orderBy: {
          posts: {
            _count: 'desc',
          },
        },
      }),
    ]);

    res.json({
      userGrowth,
      postActivity,
      engagement: engagement[0] || { posts: 0, comments: 0, reactions: 0 },
      topUsers,
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
