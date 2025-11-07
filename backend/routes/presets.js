const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Preset schema validation
const presetSchema = z.object({
  email: z.boolean().optional(),
  phone: z.boolean().optional(),
  company: z.boolean().optional(),
  position: z.boolean().optional(),
  education: z.boolean().optional(),
  bio: z.boolean().optional(),
  handles: z.boolean().optional(),
});

const updatePresetsSchema = z.object({
  personal: presetSchema.optional(),
  professional: presetSchema.optional(),
  custom: presetSchema.optional(),
});

/**
 * GET /api/presets
 * Get user's visibility presets
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { user_id: req.user.id },
      select: { visibility_presets: true },
    });

    // Return default presets if none exist
    const defaultPresets = {
      personal: {
        email: true,
        phone: true,
        bio: true,
        handles: true,
      },
      professional: {
        email: true,
        company: true,
        position: true,
        education: true,
        bio: true,
        handles: true,
      },
      custom: {
        email: false,
        phone: false,
        company: false,
        position: false,
        education: false,
        bio: true,
        handles: true,
      },
    };

    res.json({
      presets: profile?.visibility_presets || defaultPresets,
    });
  } catch (error) {
    console.error('Get presets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/presets
 * Update user's visibility presets
 */
router.put('/', authMiddleware, async (req, res) => {
  try {
    const validatedData = updatePresetsSchema.parse(req.body);

    // Get current presets
    const profile = await prisma.profile.findUnique({
      where: { user_id: req.user.id },
      select: { visibility_presets: true },
    });

    const currentPresets = profile?.visibility_presets || {
      personal: {},
      professional: {},
      custom: {},
    };

    // Merge with new presets
    const updatedPresets = {
      ...currentPresets,
      ...validatedData,
    };

    // Update profile
    await prisma.profile.update({
      where: { user_id: req.user.id },
      data: {
        visibility_presets: updatedPresets,
      },
    });

    res.json({
      message: 'Presets updated successfully',
      presets: updatedPresets,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Update presets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/presets/get-shared-data
 * Get shared data based on preset for a user
 */
router.post('/get-shared-data', authMiddleware, async (req, res) => {
  try {
    const { user_id, preset_name } = req.body;

    if (!user_id || !preset_name) {
      return res.status(400).json({ error: 'User ID and preset name are required' });
    }

    // Get target user's profile
    const targetProfile = await prisma.profile.findUnique({
      where: { user_id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true,
            username: true,
          },
        },
      },
    });

    if (!targetProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get presets
    const presets = (targetProfile.visibility_presets || {})[preset_name];

    if (!presets) {
      return res.status(400).json({ error: 'Preset not found' });
    }

    // Build shared data object based on preset
    const sharedData = {
      full_name: targetProfile.user.full_name,
      username: targetProfile.user.username,
    };

    if (presets.email) sharedData.email = targetProfile.user.email;
    if (presets.phone && targetProfile.phone) sharedData.phone = targetProfile.phone;
    if (presets.company && targetProfile.company) sharedData.company = targetProfile.company;
    if (presets.position && targetProfile.position) sharedData.position = targetProfile.position;
    if (presets.education && targetProfile.education) sharedData.education = targetProfile.education;
    if (presets.bio && targetProfile.bio) sharedData.bio = targetProfile.bio;
    if (presets.handles && targetProfile.handles) sharedData.handles = targetProfile.handles;
    if (presets.avatar && targetProfile.avatar_url) sharedData.avatar_url = targetProfile.avatar_url;

    res.json({ shared_data: sharedData });
  } catch (error) {
    console.error('Get shared data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
