const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const createReportSchema = z.object({
  target_type: z.enum(['post', 'comment', 'user', 'thread', 'job']),
  target_id: z.string().min(1),
  reason: z.enum(['spam', 'harassment', 'inappropriate', 'fake', 'other']),
  description: z.string().optional(),
});

/**
 * POST /api/reports
 * Create a report
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const validatedData = createReportSchema.parse(req.body);

    // Check if already reported by this user
    const existing = await prisma.report.findFirst({
      where: {
        reporter_id: req.user.id,
        target_type: validatedData.target_type,
        target_id: validatedData.target_id,
        status: 'pending',
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Already reported this content' });
    }

    const report = await prisma.report.create({
      data: {
        reporter_id: req.user.id,
        target_type: validatedData.target_type,
        target_id: validatedData.target_id,
        reason: validatedData.reason,
        description: validatedData.description || undefined,
      },
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

    res.status(201).json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Create report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reports/my
 * Get user's own reports
 */
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      where: {
        reporter_id: req.user.id,
      },
      orderBy: { created_at: 'desc' },
    });

    res.json({ reports });
  } catch (error) {
    console.error('Get user reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
