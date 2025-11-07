const express = require('express');
const { z } = require('zod');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Configure Cloudinary
if (process.env.CLOUDINARY_URL) {
  // Parse cloudinary://key:secret@cloud_name format
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

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Validation schema
const profileSchema = z.object({
  bio: z.string().min(10, 'Bio must be at least 10 characters'),
  company: z.string().optional(),
  position: z.string().optional(),
  phone: z.string().optional(),
  education: z.string().optional(),
});

/**
 * GET /api/profile
 * Get current user's profile
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { user_id: req.user.id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            email: true,
          },
        },
      },
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      profile: {
        id: profile.id,
        bio: profile.bio,
        company: profile.company,
        position: profile.position,
        phone: profile.phone,
        education: profile.education,
        avatar_url: profile.avatar_url,
        handles: profile.handles,
        visibility_presets: profile.visibility_presets,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/profile/upload-avatar
 * Upload avatar to Cloudinary
 */
router.post(
  '/upload-avatar',
  authMiddleware,
  upload.single('avatar'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Validate file before upload
      const { validateFileSignature, validateFileSize } = require('../middleware/fileValidation');
      
      const sizeCheck = validateFileSize(req.file.size, 5 * 1024 * 1024); // 5MB for avatars
      if (!sizeCheck.valid) {
        return res.status(400).json({ error: sizeCheck.error });
      }

      const signatureCheck = await validateFileSignature(req.file.buffer, ['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
      if (!signatureCheck.valid) {
        return res.status(400).json({ error: signatureCheck.error });
      }

      // Upload to Cloudinary
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'kartess/avatars',
            resource_type: 'image',
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        uploadStream.end(req.file.buffer);
      });

      res.json({
        avatar_url: uploadResult.secure_url,
      });
    } catch (error) {
      console.error('Avatar upload error:', error);
      res.status(500).json({ error: 'Failed to upload avatar' });
    }
  }
);

/**
 * PUT /api/profile
 * Update user profile (allows partial updates)
 */
router.put('/', authMiddleware, async (req, res) => {
  try {
    // Allow partial updates - only validate fields that are provided
    const updateData = {};
    if (req.body.bio !== undefined) {
      if (req.body.bio.length < 10 && req.body.bio.length > 0) {
        return res.status(400).json({ error: 'Bio must be at least 10 characters' });
      }
      updateData.bio = req.body.bio || null;
    }
    if (req.body.company !== undefined) updateData.company = req.body.company || null;
    if (req.body.position !== undefined) updateData.position = req.body.position || null;
    if (req.body.phone !== undefined) updateData.phone = req.body.phone || null;
    if (req.body.education !== undefined) updateData.education = req.body.education || null;
    if (req.body.avatar_url !== undefined) updateData.avatar_url = req.body.avatar_url || null;

    // Get user to access username for handles generation (if needed)
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { username: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get existing profile to preserve handles
    const existingProfile = await prisma.profile.findUnique({
      where: { user_id: req.user.id },
    });

    // Generate/update handles JSON if profile doesn't exist
    if (!existingProfile) {
      updateData.handles = {
        connect: `@${user.username}.connect`,
        visuals: `@${user.username}.visuals`,
        threads: `@${user.username}.threads`,
        careernet: `@${user.username}.careernet`,
      };
    }

    // Upsert profile
    const profile = await prisma.profile.upsert({
      where: { user_id: req.user.id },
      update: updateData,
      create: {
        user_id: req.user.id,
        bio: updateData.bio || null,
        company: updateData.company || null,
        position: updateData.position || null,
        phone: updateData.phone || null,
        education: updateData.education || null,
        avatar_url: updateData.avatar_url || null,
        handles: updateData.handles || {
          connect: `@${user.username}.connect`,
          visuals: `@${user.username}.visuals`,
          threads: `@${user.username}.threads`,
          careernet: `@${user.username}.careernet`,
        },
      },
    });

    res.json({
      message: 'Profile updated successfully',
      profile: {
        id: profile.id,
        bio: profile.bio,
        company: profile.company,
        position: profile.position,
        phone: profile.phone,
        education: profile.education,
        avatar_url: profile.avatar_url,
        handles: profile.handles,
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/profile/complete
 * Complete user profile
 */
router.post('/complete', authMiddleware, async (req, res) => {
  try {
    // Validate input
    const validatedData = profileSchema.parse(req.body);

    // Get user to access username for handles generation
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { username: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate handles JSON
    const handles = {
      connect: `@${user.username}.connect`,
      visuals: `@${user.username}.visuals`,
      threads: `@${user.username}.threads`,
      careernet: `@${user.username}.careernet`,
    };

    // Upsert profile
    const profile = await prisma.profile.upsert({
      where: { user_id: req.user.id },
      update: {
        bio: validatedData.bio,
        company: validatedData.company || null,
        position: validatedData.position || null,
        phone: validatedData.phone || null,
        education: validatedData.education || null,
        avatar_url: req.body.avatar_url || undefined,
        handles,
      },
      create: {
        user_id: req.user.id,
        bio: validatedData.bio,
        company: validatedData.company || null,
        position: validatedData.position || null,
        phone: validatedData.phone || null,
        education: validatedData.education || null,
        avatar_url: req.body.avatar_url || null,
        handles,
      },
    });

    res.json({
      message: 'Profile completed successfully',
      profile: {
        id: profile.id,
        bio: profile.bio,
        company: profile.company,
        position: profile.position,
        phone: profile.phone,
        education: profile.education,
        avatar_url: profile.avatar_url,
        handles: profile.handles,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Profile completion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
