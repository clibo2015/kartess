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

    if (!req.file) {
      return res.status(400).json({ error: 'Media file is required for stories' });
    }

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const resourceType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'kartess/stories',
          resource_type: resourceType,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      uploadStream.end(req.file.buffer);
    });

    // Create story post (is_story=true)
    const story = await prisma.post.create({
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

    // Emit via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to('posts').emit('post.new', story);
    }

    res.status(201).json(story);
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
