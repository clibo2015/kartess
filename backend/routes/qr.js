const express = require('express');
const crypto = require('crypto');
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/qr/validate/:token
 * Public endpoint to validate QR token (for non-users)
 */
router.get('/validate/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ valid: false, error: 'Token is required' });
    }

    // Find QR token
    const qrToken = await prisma.qrToken.findUnique({
      where: { token },
    });

    if (!qrToken) {
      return res.json({ valid: false, error: 'Invalid QR code' });
    }

    // Check if token is expired
    if (new Date() > qrToken.expires_at) {
      return res.json({ valid: false, error: 'QR code has expired' });
    }

    // Check if already consumed
    if (qrToken.consumed_by) {
      return res.json({ valid: false, error: 'QR code already used' });
    }

    // Get QR owner info (limited info for privacy)
    const owner = await prisma.user.findUnique({
      where: { id: qrToken.user_id },
      select: {
        id: true,
        username: true,
        full_name: true,
      },
    });

    if (!owner) {
      return res.json({ valid: false, error: 'User not found' });
    }

    res.json({
      valid: true,
      user: {
        username: owner.username,
        full_name: owner.full_name,
      },
      requires_signup: true,
    });
  } catch (error) {
    console.error('QR validate error:', error);
    res.status(500).json({ valid: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/qr/generate
 * Generate QR token for sharing
 */
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { preset_name } = req.body;

    if (!preset_name || !['personal', 'professional', 'custom'].includes(preset_name)) {
      return res.status(400).json({ error: 'Invalid preset name' });
    }

    // Verify preset exists for user
    const profile = await prisma.profile.findUnique({
      where: { user_id: req.user.id },
      select: { visibility_presets: true },
    });

    // Use default presets if none exist (same as presets endpoint)
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

    const presets = profile?.visibility_presets || defaultPresets;
    if (!presets[preset_name]) {
      return res.status(400).json({ error: 'Preset not found' });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');

    // Token expires in 24 hours
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create QR token record
    const qrToken = await prisma.qrToken.create({
      data: {
        user_id: req.user.id,
        token,
        preset_name,
        expires_at: expiresAt,
      },
    });

    res.json({
      token,
      expires_at: expiresAt,
      qr_token_id: qrToken.id,
    });
  } catch (error) {
    console.error('QR generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/qr/consume
 * Consume QR token and create contact (auto-approved for both directions)
 */
router.post('/consume', authMiddleware, async (req, res) => {
  try {
    const { token, preset_name } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    if (!preset_name || !['personal', 'professional', 'custom'].includes(preset_name)) {
      return res.status(400).json({ error: 'Valid preset_name is required (personal, professional, or custom)' });
    }

    // Find QR token
    const qrToken = await prisma.qrToken.findUnique({
      where: { token },
      include: {
        // Get user data via raw query since we don't have relation
      },
    });

    if (!qrToken) {
      return res.status(404).json({ error: 'Invalid QR code' });
    }

    // Check if token is expired
    if (new Date() > qrToken.expires_at) {
      return res.status(400).json({ error: 'QR code has expired' });
    }

    // Check if already consumed
    if (qrToken.consumed_by) {
      return res.status(400).json({ error: 'QR code already used' });
    }

    // Prevent self-scanning
    if (qrToken.user_id === req.user.id) {
      return res.status(400).json({ error: 'Cannot scan your own QR code' });
    }

    // Get sender's profile and preset
    const senderProfile = await prisma.profile.findUnique({
      where: { user_id: qrToken.user_id },
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

    if (!senderProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get scanner's (current user's) profile and preset
    const scannerProfile = await prisma.profile.findUnique({
      where: { user_id: req.user.id },
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

    if (!scannerProfile) {
      return res.status(404).json({ error: 'Scanner profile not found' });
    }

    const scannerPresets = scannerProfile.visibility_presets || {};
    const scannerPreset = scannerPresets[preset_name] || {};

    // Get sender's (QR owner's) profile and preset
    const senderPresets = senderProfile.visibility_presets || {};
    const senderPreset = senderPresets[qrToken.preset_name] || {};

    // Build shared data for sender (what QR owner shares with scanner)
    const senderSharedData = {
      full_name: senderProfile.user.full_name,
      username: senderProfile.user.username,
    };
    if (senderPreset.email) senderSharedData.email = senderProfile.user.email;
    if (senderPreset.phone && senderProfile.phone) senderSharedData.phone = senderProfile.phone;
    if (senderPreset.company && senderProfile.company) senderSharedData.company = senderProfile.company;
    if (senderPreset.position && senderProfile.position) senderSharedData.position = senderProfile.position;
    if (senderPreset.education && senderProfile.education) senderSharedData.education = senderProfile.education;
    if (senderPreset.bio && senderProfile.bio) senderSharedData.bio = senderProfile.bio;
    if (senderPreset.handles && senderProfile.handles) senderSharedData.handles = senderProfile.handles;
    if (senderPreset.avatar && senderProfile.avatar_url) senderSharedData.avatar_url = senderProfile.avatar_url;

    // Build shared data for scanner (what scanner shares with QR owner)
    const scannerSharedData = {
      full_name: scannerProfile.user.full_name,
      username: scannerProfile.user.username,
    };
    if (scannerPreset.email) scannerSharedData.email = scannerProfile.user.email;
    if (scannerPreset.phone && scannerProfile.phone) scannerSharedData.phone = scannerProfile.phone;
    if (scannerPreset.company && scannerProfile.company) scannerSharedData.company = scannerProfile.company;
    if (scannerPreset.position && scannerProfile.position) scannerSharedData.position = scannerProfile.position;
    if (scannerPreset.education && scannerProfile.education) scannerSharedData.education = scannerProfile.education;
    if (scannerPreset.bio && scannerProfile.bio) scannerSharedData.bio = scannerProfile.bio;
    if (scannerPreset.handles && scannerProfile.handles) scannerSharedData.handles = scannerProfile.handles;
    if (scannerPreset.avatar && scannerProfile.avatar_url) scannerSharedData.avatar_url = scannerProfile.avatar_url;

    // Check if contact already exists
    const existingContact = await prisma.contact.findFirst({
      where: {
        OR: [
          { sender_id: req.user.id, receiver_id: qrToken.user_id },
          { sender_id: qrToken.user_id, receiver_id: req.user.id },
        ],
      },
    });

    if (existingContact) {
      // Update existing contact - auto-approve in both directions
      const updatedContact = await prisma.contact.update({
        where: { id: existingContact.id },
        data: {
          status: 'approved',
          sender_preset: existingContact.sender_id === req.user.id ? preset_name : qrToken.preset_name,
          receiver_preset: existingContact.receiver_id === req.user.id ? preset_name : qrToken.preset_name,
          shared_data: existingContact.sender_id === req.user.id ? scannerSharedData : senderSharedData,
        },
        include: {
          sender: {
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
              profile: {
                select: {
                  avatar_url: true,
                },
              },
            },
          },
        },
      });

      // Create reverse contact if doesn't exist (bidirectional)
      const reverseContact = await prisma.contact.findFirst({
        where: {
          sender_id: qrToken.user_id,
          receiver_id: req.user.id,
        },
      });

      if (!reverseContact) {
        await prisma.contact.create({
          data: {
            sender_id: qrToken.user_id,
            receiver_id: req.user.id,
            status: 'approved',
            sender_preset: qrToken.preset_name,
            receiver_preset: preset_name,
            shared_data: senderSharedData,
          },
        });
      } else {
        await prisma.contact.update({
          where: { id: reverseContact.id },
          data: {
            status: 'approved',
            sender_preset: qrToken.preset_name,
            receiver_preset: preset_name,
            shared_data: senderSharedData,
          },
        });
      }

      // Mark token as consumed
      await prisma.qrToken.update({
        where: { id: qrToken.id },
        data: { consumed_by: req.user.id },
      });

      return res.json({
        message: 'Contact auto-approved in both directions',
        contact: updatedContact,
      });
    }

    // Create bidirectional approved contacts
    // Contact 1: Scanner -> QR Owner
    const contact1 = await prisma.contact.create({
      data: {
        sender_id: req.user.id,
        receiver_id: qrToken.user_id,
        status: 'approved',
        sender_preset: preset_name,
        receiver_preset: qrToken.preset_name,
        shared_data: scannerSharedData,
      },
    });

    // Contact 2: QR Owner -> Scanner (reverse direction)
    const contact2 = await prisma.contact.create({
      data: {
        sender_id: qrToken.user_id,
        receiver_id: req.user.id,
        status: 'approved',
        sender_preset: qrToken.preset_name,
        receiver_preset: preset_name,
        shared_data: senderSharedData,
      },
      include: {
        receiver: {
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

    // Mark token as consumed
    await prisma.qrToken.update({
      where: { id: qrToken.id },
      data: { consumed_by: req.user.id },
    });

    // Create notifications for both users
    await prisma.notification.create({
      data: {
        user_id: qrToken.user_id,
        sender_id: req.user.id,
        type: 'qr_scan',
        title: 'QR Code Scanned',
        message: `${req.user.full_name || req.user.username} scanned your QR code and was added as a contact`,
        link: '/contacts',
      },
    });

    await prisma.notification.create({
      data: {
        user_id: req.user.id,
        sender_id: qrToken.user_id,
        type: 'qr_scan',
        title: 'Contact Added',
        message: `You successfully scanned ${senderProfile.user.full_name || senderProfile.user.username}'s QR code`,
        link: '/contacts',
      },
    });

    // Emit notifications via Socket.io if available
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${qrToken.user_id}`).emit('notification.new', {
        type: 'qr_scan',
        title: 'QR Code Scanned',
        message: `${req.user.full_name || req.user.username} scanned your QR code and was added as a contact`,
      });
      io.to(`user:${req.user.id}`).emit('notification.new', {
        type: 'qr_scan',
        title: 'Contact Added',
        message: `You successfully scanned ${senderProfile.user.full_name || senderProfile.user.username}'s QR code`,
      });
    }

    res.json({
      message: 'Contact auto-approved in both directions',
      contact: contact2,
    });
  } catch (error) {
    console.error('QR consume error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/qr/consume-after-signup
 * Consume QR token after non-user completes registration
 */
router.post('/consume-after-signup', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Find QR token
    const qrToken = await prisma.qrToken.findUnique({
      where: { token },
    });

    if (!qrToken) {
      return res.status(404).json({ error: 'Invalid QR code' });
    }

    // Check if token is expired
    if (new Date() > qrToken.expires_at) {
      return res.status(400).json({ error: 'QR code has expired' });
    }

    // Check if already consumed
    if (qrToken.consumed_by) {
      return res.status(400).json({ error: 'QR code already used' });
    }

    // Prevent self-scanning
    if (qrToken.user_id === req.user.id) {
      return res.status(400).json({ error: 'Cannot scan your own QR code' });
    }

    // Get sender's (QR owner's) profile and preset
    const senderProfile = await prisma.profile.findUnique({
      where: { user_id: qrToken.user_id },
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

    if (!senderProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get scanner's (new user's) profile
    const scannerProfile = await prisma.profile.findUnique({
      where: { user_id: req.user.id },
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

    if (!scannerProfile) {
      return res.status(404).json({ error: 'Scanner profile not found' });
    }

    const senderPresets = senderProfile.visibility_presets || {};
    const senderPreset = senderPresets[qrToken.preset_name] || {};

    // Scanner defaults to 'personal' preset for non-user signups
    const scannerPresets = scannerProfile.visibility_presets || {};
    const scannerPreset = scannerPresets['personal'] || {};

    // Build shared data for sender (what QR owner shares with scanner)
    const senderSharedData = {
      full_name: senderProfile.user.full_name,
      username: senderProfile.user.username,
    };
    if (senderPreset.email) senderSharedData.email = senderProfile.user.email;
    if (senderPreset.phone && senderProfile.phone) senderSharedData.phone = senderProfile.phone;
    if (senderPreset.company && senderProfile.company) senderSharedData.company = senderProfile.company;
    if (senderPreset.position && senderProfile.position) senderSharedData.position = senderProfile.position;
    if (senderPreset.education && senderProfile.education) senderSharedData.education = senderProfile.education;
    if (senderPreset.bio && senderProfile.bio) senderSharedData.bio = senderProfile.bio;
    if (senderPreset.handles && senderProfile.handles) senderSharedData.handles = senderProfile.handles;
    if (senderPreset.avatar && senderProfile.avatar_url) senderSharedData.avatar_url = senderProfile.avatar_url;

    // Build shared data for scanner (what scanner shares with QR owner) - defaults to personal
    const scannerSharedData = {
      full_name: scannerProfile.user.full_name,
      username: scannerProfile.user.username,
    };
    if (scannerPreset.email) scannerSharedData.email = scannerProfile.user.email;
    if (scannerPreset.phone && scannerProfile.phone) scannerSharedData.phone = scannerProfile.phone;
    if (scannerPreset.company && scannerProfile.company) scannerSharedData.company = scannerProfile.company;
    if (scannerPreset.position && scannerProfile.position) scannerSharedData.position = scannerProfile.position;
    if (scannerPreset.education && scannerProfile.education) scannerSharedData.education = scannerProfile.education;
    if (scannerPreset.bio && scannerProfile.bio) scannerSharedData.bio = scannerProfile.bio;
    if (scannerPreset.handles && scannerProfile.handles) scannerSharedData.handles = scannerProfile.handles;
    if (scannerPreset.avatar && scannerProfile.avatar_url) scannerSharedData.avatar_url = scannerProfile.avatar_url;

    // Check if contact already exists
    const existingContact = await prisma.contact.findFirst({
      where: {
        OR: [
          { sender_id: req.user.id, receiver_id: qrToken.user_id },
          { sender_id: qrToken.user_id, receiver_id: req.user.id },
        ],
      },
    });

    if (existingContact) {
      // Update existing contact - auto-approve in both directions
      await prisma.contact.update({
        where: { id: existingContact.id },
        data: {
          status: 'approved',
          sender_preset: existingContact.sender_id === req.user.id ? 'personal' : qrToken.preset_name,
          receiver_preset: existingContact.receiver_id === req.user.id ? 'personal' : qrToken.preset_name,
          shared_data: existingContact.sender_id === req.user.id ? scannerSharedData : senderSharedData,
        },
      });

      // Create/update reverse contact
      const reverseContact = await prisma.contact.findFirst({
        where: {
          sender_id: qrToken.user_id,
          receiver_id: req.user.id,
        },
      });

      if (!reverseContact) {
        await prisma.contact.create({
          data: {
            sender_id: qrToken.user_id,
            receiver_id: req.user.id,
            status: 'approved',
            sender_preset: qrToken.preset_name,
            receiver_preset: 'personal',
            shared_data: senderSharedData,
          },
        });
      } else {
        await prisma.contact.update({
          where: { id: reverseContact.id },
          data: {
            status: 'approved',
            sender_preset: qrToken.preset_name,
            receiver_preset: 'personal',
            shared_data: senderSharedData,
          },
        });
      }

      // Mark token as consumed
      await prisma.qrToken.update({
        where: { id: qrToken.id },
        data: { consumed_by: req.user.id },
      });

      return res.json({
        message: 'Contact auto-approved in both directions',
        contact: existingContact,
      });
    }

    // Create bidirectional approved contacts
    // Contact 1: Scanner -> QR Owner
    await prisma.contact.create({
      data: {
        sender_id: req.user.id,
        receiver_id: qrToken.user_id,
        status: 'approved',
        sender_preset: 'personal',
        receiver_preset: qrToken.preset_name,
        shared_data: scannerSharedData,
      },
    });

    // Contact 2: QR Owner -> Scanner (reverse direction)
    const contact2 = await prisma.contact.create({
      data: {
        sender_id: qrToken.user_id,
        receiver_id: req.user.id,
        status: 'approved',
        sender_preset: qrToken.preset_name,
        receiver_preset: 'personal',
        shared_data: senderSharedData,
      },
      include: {
        receiver: {
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

    // Mark token as consumed
    await prisma.qrToken.update({
      where: { id: qrToken.id },
      data: { consumed_by: req.user.id },
    });

    // Create notifications
    await prisma.notification.create({
      data: {
        user_id: qrToken.user_id,
        sender_id: req.user.id,
        type: 'qr_scan',
        title: 'New Contact Added',
        message: `${req.user.full_name || req.user.username} signed up and was added as a contact`,
        link: '/contacts',
      },
    });

    await prisma.notification.create({
      data: {
        user_id: req.user.id,
        sender_id: qrToken.user_id,
        type: 'qr_scan',
        title: 'Contact Added',
        message: `You've been added as a contact with ${senderProfile.user.full_name || senderProfile.user.username}`,
        link: '/contacts',
      },
    });

    // Emit notifications via Socket.io if available
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${qrToken.user_id}`).emit('notification.new', {
        type: 'qr_scan',
        title: 'New Contact Added',
        message: `${req.user.full_name || req.user.username} signed up and was added as a contact`,
      });
      io.to(`user:${req.user.id}`).emit('notification.new', {
        type: 'qr_scan',
        title: 'Contact Added',
        message: `You've been added as a contact with ${senderProfile.user.full_name || senderProfile.user.username}`,
      });
    }

    res.json({
      message: 'Contact auto-approved in both directions',
      contact: contact2,
    });
  } catch (error) {
    console.error('QR consume-after-signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
