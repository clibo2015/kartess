const express = require('express');
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
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  },
});

/**
 * POST /api/stories
 * Create a story
 */
router.post('/', authMiddleware, upload.single('media'), async (req, res) => {
  try {
    const { content, module = 'connect' } = req.body;

    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_URL) {
      console.error('Cloudinary not configured - CLOUDINARY_URL environment variable is missing');
      return res.status(503).json({ 
        error: 'Media upload service is not configured. Please contact support.',
        code: 'CLOUDINARY_NOT_CONFIGURED'
      });
    }

    // Validate Cloudinary config
    if (!cloudinary.config().cloud_name || !cloudinary.config().api_key || !cloudinary.config().api_secret) {
      console.error('Cloudinary configuration incomplete');
      return res.status(503).json({ 
        error: 'Media upload service configuration error. Please contact support.',
        code: 'CLOUDINARY_CONFIG_ERROR'
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        error: 'Media file is required for stories',
        code: 'MISSING_FILE'
      });
    }

    // Validate file size
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      return res.status(400).json({ 
        error: `File size exceeds limit of ${maxSize / (1024 * 1024)}MB`,
        code: 'FILE_TOO_LARGE',
        maxSize: maxSize
      });
    }

    // Validate file type
    const isValidType = req.file.mimetype.startsWith('image/') || req.file.mimetype.startsWith('video/');
    if (!isValidType) {
      return res.status(400).json({ 
        error: 'Only image and video files are allowed',
        code: 'INVALID_FILE_TYPE',
        allowedTypes: ['image/*', 'video/*']
      });
    }

    // Validate file signature if available
    try {
      const { validateFileSignature } = require('../middleware/fileValidation');
      const allowedTypes = req.file.mimetype.startsWith('video/') 
        ? ['video/mp4', 'video/webm', 'video/quicktime']
        : ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      
      const signatureCheck = await validateFileSignature(req.file.buffer, allowedTypes);
      if (!signatureCheck.valid) {
        return res.status(400).json({ 
          error: signatureCheck.error || 'Invalid file format',
          code: 'INVALID_FILE_SIGNATURE'
        });
      }
    } catch (validationError) {
      // If validation middleware is not available, log but continue
      console.warn('File signature validation skipped:', validationError.message);
    }

    // Upload to Cloudinary
    let uploadResult;
    try {
      uploadResult = await new Promise((resolve, reject) => {
        const resourceType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'kartess/stories',
            resource_type: resourceType,
          },
          (error, result) => {
            if (error) {
              console.error('Cloudinary upload error:', error);
              reject(error);
            } else {
              resolve(result);
            }
          }
        );

        uploadStream.end(req.file.buffer);
      });
    } catch (uploadError) {
      console.error('Story upload to Cloudinary failed:', uploadError);
      return res.status(500).json({ 
        error: 'Failed to upload media file. Please try again.',
        code: 'UPLOAD_FAILED',
        details: process.env.NODE_ENV === 'development' ? uploadError.message : undefined
      });
    }

    if (!uploadResult || !uploadResult.secure_url) {
      return res.status(500).json({ 
        error: 'Failed to get uploaded file URL',
        code: 'UPLOAD_URL_MISSING'
      });
    }

    // Create story post (is_story=true)
    let story;
    try {
      story = await prisma.post.create({
        data: {
          user_id: req.user.id,
          content: content || '',
          module,
          visibility: 'public',
          media_urls: [uploadResult.secure_url],
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
      });
    } catch (dbError) {
      console.error('Database error creating story:', dbError);
      return res.status(500).json({ 
        error: 'Failed to create story. Please try again.',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }

    // Emit via Socket.io
    try {
      const io = req.app.get('io');
      if (io) {
        io.to('posts').emit('post.new', story);
      }
    } catch (socketError) {
      // Log but don't fail the request if Socket.io fails
      console.warn('Failed to emit story via Socket.io:', socketError);
    }

    res.status(201).json(story);
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/stories
 * Get active stories (not expired)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Get stories from last 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const stories = await prisma.post.findMany({
      where: {
        is_story: true,
        created_at: {
          gte: twentyFourHoursAgo,
        },
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
      orderBy: { created_at: 'desc' },
    });

    // Group by user
    const storiesByUser = stories.reduce((acc, story) => {
      const userId = story.user_id;
      if (!acc[userId]) {
        acc[userId] = {
          user: story.user,
          stories: [],
        };
      }
      acc[userId].stories.push(story);
      return acc;
    }, {});

    res.json({ stories: Object.values(storiesByUser) });
  } catch (error) {
    console.error('Get stories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/stories/user/:userId
 * Get stories for a specific user
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get stories from last 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const stories = await prisma.post.findMany({
      where: {
        user_id: userId,
        is_story: true,
        created_at: {
          gte: twentyFourHoursAgo,
        },
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
      orderBy: { created_at: 'desc' },
    });

    res.json({ stories });
  } catch (error) {
    console.error('Get user stories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
