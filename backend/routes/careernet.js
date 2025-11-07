const express = require('express');
const { z } = require('zod');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Configure Cloudinary
if (process.env.CLOUDINARY_URL) {
  const url = process.env.CLOUDINARY_URL;
  const match = url.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
  if (match) {
    cloudinary.config({
      cloud_name: match[3],
      api_key: match[1],
      api_secret: match[2],
    });
  }
}

// Configure multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

const createJobSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  company: z.string().optional(),
  location: z.string().optional(),
  type: z.enum(['full-time', 'part-time', 'contract', 'internship']).optional(),
  salary_range: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  application_url: z.string().url().optional(),
  application_email: z.string().email().optional(),
});

const createApplicationSchema = z.object({
  cover_letter: z.string().optional(),
});

const createEndorsementSchema = z.object({
  skill: z.string().min(1, 'Skill is required'),
  message: z.string().optional(),
});

/**
 * GET /api/careernet/jobs
 * Get all jobs with filters
 */
router.get('/jobs', async (req, res) => {
  try {
    const { status = 'open', type, location, search, limit = 20, cursor } = req.query;

    const where = {
      status,
    };

    if (type) {
      where.type = type;
    }

    if (location) {
      where.location = {
        contains: location,
        mode: 'insensitive',
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    const jobs = await prisma.job.findMany({
      where,
      take: parseInt(limit),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
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
                company: true,
              },
            },
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    res.json({
      jobs,
      nextCursor: jobs.length === parseInt(limit) ? jobs[jobs.length - 1].id : null,
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/careernet/jobs/:jobId
 * Get a single job
 */
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            profile: {
              select: {
                avatar_url: true,
                company: true,
              },
            },
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/careernet/jobs
 * Create a new job posting
 */
router.post('/jobs', authMiddleware, async (req, res) => {
  try {
    const validatedData = createJobSchema.parse(req.body);

    const job = await prisma.job.create({
      data: {
        user_id: req.user.id,
        title: validatedData.title,
        description: validatedData.description,
        company: validatedData.company || undefined,
        location: validatedData.location || undefined,
        type: validatedData.type || undefined,
        salary_range: validatedData.salary_range || undefined,
        requirements: validatedData.requirements || undefined,
        tags: validatedData.tags || undefined,
        application_url: validatedData.application_url || undefined,
        application_email: validatedData.application_email || undefined,
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

    res.status(201).json(job);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Create job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/careernet/jobs/:jobId/apply
 * Apply to a job
 */
router.post(
  '/jobs/:jobId/apply',
  authMiddleware,
  upload.single('resume'),
  async (req, res) => {
    try {
      const { jobId } = req.params;
      const validatedData = createApplicationSchema.parse(req.body);

      const job = await prisma.job.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.status !== 'open') {
        return res.status(400).json({ error: 'Job is not accepting applications' });
      }

      // Check if already applied
      const existing = await prisma.application.findUnique({
        where: {
          job_id_user_id: {
            job_id: jobId,
            user_id: req.user.id,
          },
        },
      });

      if (existing) {
        return res.status(400).json({ error: 'Already applied to this job' });
      }

      // Upload resume if provided
      let resumeUrl = null;
      if (req.file) {
        const uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'kartess/resumes',
              resource_type: 'raw',
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );

          uploadStream.end(req.file.buffer);
        });

        resumeUrl = uploadResult.secure_url;
      }

      const application = await prisma.application.create({
        data: {
          job_id: jobId,
          user_id: req.user.id,
          cover_letter: validatedData.cover_letter || undefined,
          resume_url: resumeUrl,
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
          job: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      // Create notification for job poster
      if (job.user_id !== req.user.id) {
        await prisma.notification.create({
          data: {
            user_id: job.user_id,
            sender_id: req.user.id,
            type: 'follow', // Reuse follow type for application
            title: 'New Job Application',
            message: `${req.user.full_name || req.user.username} applied to your job: ${job.title}`,
            link: `/careernet/jobs/${jobId}`,
          },
        });

        const io = req.app.get('io');
        if (io) {
          io.to(`user:${job.user_id}`).emit('notification.new', {
            type: 'follow',
            title: 'New Job Application',
            message: `${req.user.full_name || req.user.username} applied to your job`,
          });
        }
      }

      res.status(201).json(application);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
      }

      console.error('Apply to job error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/careernet/endorsements/user/:userId
 * Get endorsements for a user
 */
router.get('/endorsements/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const endorsements = await prisma.endorsement.findMany({
      where: { receiver_id: userId },
      include: {
        giver: {
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
      orderBy: { created_at: 'desc' },
    });

    // Group by skill
    const grouped = endorsements.reduce((acc, endorsement) => {
      if (!acc[endorsement.skill]) {
        acc[endorsement.skill] = [];
      }
      acc[endorsement.skill].push(endorsement);
      return acc;
    }, {});

    res.json({ endorsements: grouped });
  } catch (error) {
    console.error('Get endorsements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/careernet/endorsements
 * Create an endorsement
 */
router.post('/endorsements', authMiddleware, async (req, res) => {
  try {
    const { receiver_id, skill, message } = req.body;
    const validatedData = createEndorsementSchema.parse({ skill, message });

    if (receiver_id === req.user.id) {
      return res.status(400).json({ error: 'Cannot endorse yourself' });
    }

    // Check if already endorsed this skill
    const existing = await prisma.endorsement.findFirst({
      where: {
        giver_id: req.user.id,
        receiver_id,
        skill: validatedData.skill,
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Already endorsed this skill' });
    }

    const endorsement = await prisma.endorsement.create({
      data: {
        giver_id: req.user.id,
        receiver_id,
        skill: validatedData.skill,
        message: validatedData.message || undefined,
      },
      include: {
        giver: {
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
        receiver: {
          select: {
            id: true,
            username: true,
            full_name: true,
          },
        },
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        user_id: receiver_id,
        sender_id: req.user.id,
        type: 'endorse',
        title: 'New Endorsement',
        message: `${req.user.full_name || req.user.username} endorsed you for ${validatedData.skill}`,
        link: `/careernet/endorsements`,
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${receiver_id}`).emit('notification.new', {
        type: 'endorse',
        title: 'New Endorsement',
        message: `${req.user.full_name || req.user.username} endorsed you for ${validatedData.skill}`,
      });
    }

    res.status(201).json(endorsement);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Create endorsement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
