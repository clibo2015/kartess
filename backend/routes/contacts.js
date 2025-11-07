const express = require('express');
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/contacts/follow
 * Send a follow/contact request
 */
router.post('/follow', authMiddleware, async (req, res) => {
  try {
    const { receiver_id, preset_name } = req.body;

    if (!receiver_id) {
      return res.status(400).json({ error: 'Receiver ID is required' });
    }

    if (receiver_id === req.user.id) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Check if contact already exists
    const existingContact = await prisma.contact.findFirst({
      where: {
        OR: [
          { sender_id: req.user.id, receiver_id },
          { sender_id: receiver_id, receiver_id: req.user.id },
        ],
      },
    });

    if (existingContact) {
      if (existingContact.status === 'approved') {
        return res.status(400).json({ error: 'Already following this user' });
      }
      if (existingContact.status === 'pending') {
        return res.status(400).json({ error: 'Follow request already pending' });
      }
    }

    // Validate preset_name if provided
    if (preset_name && !['personal', 'professional', 'custom'].includes(preset_name)) {
      return res.status(400).json({ error: 'Invalid preset_name. Must be personal, professional, or custom' });
    }

    // Get sender's (current user's) profile and preset
    const senderProfile = await prisma.profile.findUnique({
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

    if (!senderProfile) {
      return res.status(404).json({ error: 'Sender profile not found' });
    }

    // Get shared data based on sender's preset (what sender wants to share)
    let sharedData = null;
    if (preset_name) {
      const presets = senderProfile.visibility_presets || {};
      const preset = presets[preset_name] || {};

      sharedData = {
        full_name: senderProfile.user.full_name,
        username: senderProfile.user.username,
      };

      if (preset.email) sharedData.email = senderProfile.user.email;
      if (preset.phone && senderProfile.phone) sharedData.phone = senderProfile.phone;
      if (preset.company && senderProfile.company) sharedData.company = senderProfile.company;
      if (preset.position && senderProfile.position) sharedData.position = senderProfile.position;
      if (preset.education && senderProfile.education) sharedData.education = senderProfile.education;
      if (preset.bio && senderProfile.bio) sharedData.bio = senderProfile.bio;
      if (preset.handles && senderProfile.handles) sharedData.handles = senderProfile.handles;
      if (preset.avatar && senderProfile.avatar_url) sharedData.avatar_url = senderProfile.avatar_url;
    }

    const previousShared = existingContact?.shared_data || {};
    const newSharedData = {
      sender: sharedData || previousShared.sender || null,
      receiver: previousShared.receiver || null,
    };

    // Create or update contact
    const contact = await prisma.contact.upsert({
      where: {
        sender_id_receiver_id: {
          sender_id: req.user.id,
          receiver_id,
        },
      },
      update: {
        status: 'pending',
        sender_preset: preset_name || undefined,
        shared_data: newSharedData,
      },
      create: {
        sender_id: req.user.id,
        receiver_id,
        status: 'pending',
        sender_preset: preset_name || undefined,
        shared_data: sharedData ? { sender: sharedData } : undefined,
      },
    });

    // Create notification for receiver
    const receiver = await prisma.user.findUnique({
      where: { id: receiver_id },
      select: { username: true, full_name: true },
    });

    if (receiver) {
      await prisma.notification.create({
        data: {
          user_id: receiver_id,
          sender_id: req.user.id,
          type: 'follow',
          title: 'New Follow Request',
          message: `${req.user.full_name || req.user.username} wants to follow you`,
          link: `/contacts`,
        },
      });

      // Emit notification via Socket.io if available
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${receiver_id}`).emit('notification.new', {
          type: 'follow',
          title: 'New Follow Request',
          message: `${req.user.full_name || req.user.username} wants to follow you`,
        });
      }
    }

    res.json({ message: 'Follow request sent', contact });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/contacts/approve
 * Approve a follow request
 */
router.post('/approve', authMiddleware, async (req, res) => {
  try {
    const { contact_id, preset_name } = req.body;

    if (!contact_id) {
      return res.status(400).json({ error: 'Contact ID is required' });
    }

    // Find the contact (must be received by current user)
    const contact = await prisma.contact.findUnique({
      where: { id: contact_id },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact request not found' });
    }

    if (contact.receiver_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to approve this request' });
    }

    if (contact.status === 'approved') {
      return res.status(400).json({ error: 'Contact already approved' });
    }

    // Validate preset_name if provided
    if (preset_name && !['personal', 'professional', 'custom'].includes(preset_name)) {
      return res.status(400).json({ error: 'Invalid preset_name. Must be personal, professional, or custom' });
    }

    // Get receiver's (current user's) profile and preset
    const receiverProfile = await prisma.profile.findUnique({
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

    if (!receiverProfile) {
      return res.status(404).json({ error: 'Receiver profile not found' });
    }

    // Get shared data based on receiver's preset (what receiver wants to share)
    let receiverSharedData = contact.shared_data; // Keep existing sender's shared data
    if (preset_name) {
      const presets = receiverProfile.visibility_presets || {};
      const preset = presets[preset_name] || {};

      receiverSharedData = {
        full_name: receiverProfile.user.full_name,
        username: receiverProfile.user.username,
      };

      if (preset.email) receiverSharedData.email = receiverProfile.user.email;
      if (preset.phone && receiverProfile.phone) receiverSharedData.phone = receiverProfile.phone;
      if (preset.company && receiverProfile.company) receiverSharedData.company = receiverProfile.company;
      if (preset.position && receiverProfile.position) receiverSharedData.position = receiverProfile.position;
      if (preset.education && receiverProfile.education) receiverSharedData.education = receiverProfile.education;
      if (preset.bio && receiverProfile.bio) receiverSharedData.bio = receiverProfile.bio;
      if (preset.handles && receiverProfile.handles) receiverSharedData.handles = receiverProfile.handles;
      if (preset.avatar && receiverProfile.avatar_url) receiverSharedData.avatar_url = receiverProfile.avatar_url;
    }

    const existingShared = contact.shared_data || {};
    let senderSharedData = existingShared.sender || null;

    // Get sender's shared data (what sender originally shared)
    const senderProfile = await prisma.profile.findUnique({
      where: { user_id: contact.sender_id },
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

    if (senderProfile && contact.sender_preset) {
      const presets = senderProfile.visibility_presets || {};
      const preset = presets[contact.sender_preset] || {};

      senderSharedData = {
        full_name: senderProfile.user.full_name,
        username: senderProfile.user.username,
      };

      if (preset.email) senderSharedData.email = senderProfile.user.email;
      if (preset.phone && senderProfile.phone) senderSharedData.phone = senderProfile.phone;
      if (preset.company && senderProfile.company) senderSharedData.company = senderProfile.company;
      if (preset.position && senderProfile.position) senderSharedData.position = senderProfile.position;
      if (preset.education && senderProfile.education) senderSharedData.education = senderProfile.education;
      if (preset.bio && senderProfile.bio) senderSharedData.bio = senderProfile.bio;
      if (preset.handles && senderProfile.handles) senderSharedData.handles = senderProfile.handles;
      if (preset.avatar && senderProfile.avatar_url) senderSharedData.avatar_url = senderProfile.avatar_url;
    }

    const combinedShared = {
      sender: senderSharedData || null,
      receiver: receiverSharedData || existingShared.receiver || null,
    };

    // Update contact status (single record)
    const updatedContact = await prisma.contact.update({
      where: { id: contact_id },
      data: { 
        status: 'approved',
        receiver_preset: preset_name || undefined,
        shared_data: combinedShared,
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
      },
    });

    // Cleanup any legacy reverse contacts to prevent duplicates
    await prisma.contact.deleteMany({
      where: {
        sender_id: req.user.id,
        receiver_id: contact.sender_id,
        NOT: { id: contact_id },
      },
    });

    // Create notification for sender
    await prisma.notification.create({
      data: {
        user_id: contact.sender_id,
        sender_id: req.user.id,
        type: 'follow',
        title: 'Follow Request Approved',
        message: `${req.user.full_name || req.user.username} approved your follow request`,
        link: `/contacts`,
      },
    });

    res.json({ message: 'Follow request approved', contact: updatedContact });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/contacts
 * Get user's contacts (approved follows)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: {
        OR: [
          { sender_id: req.user.id, status: 'approved' },
          { receiver_id: req.user.id, status: 'approved' },
        ],
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
                bio: true,
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
                bio: true,
              },
            },
          },
        },
      },
    });

    // Transform to return the other user (not the current user)
    const uniqueContacts = new Map();

    contacts.forEach((contact) => {
      const isSender = contact.sender_id === req.user.id;
      const otherUser = isSender ? contact.receiver : contact.sender;
      const otherUserId = otherUser.id;

      const rawShared = contact.shared_data || {};
      let sharedDataCandidate = null;

      if (isSender) {
        if (rawShared && typeof rawShared === 'object' && rawShared.receiver) {
          sharedDataCandidate = rawShared.receiver;
        }
      } else {
        if (rawShared && typeof rawShared === 'object' && rawShared.sender) {
          sharedDataCandidate = rawShared.sender;
        }
      }

      if (
        !sharedDataCandidate &&
        rawShared &&
        typeof rawShared === 'object' &&
        !Array.isArray(rawShared)
      ) {
        sharedDataCandidate = rawShared;
      }

      const normalizedShared =
        sharedDataCandidate && typeof sharedDataCandidate === 'object' && !Array.isArray(sharedDataCandidate)
          ? sharedDataCandidate
          : null;

      const payload = {
        id: contact.id,
        user: otherUser,
        status: contact.status,
        created_at: contact.created_at,
        shared_data: normalizedShared,
      };

      const existing = uniqueContacts.get(otherUserId);
      if (
        !existing ||
        (existing.status !== 'approved' && contact.status === 'approved') ||
        new Date(payload.created_at) > new Date(existing.created_at)
      ) {
        uniqueContacts.set(otherUserId, payload);
      }
    });

    res.json({ contacts: Array.from(uniqueContacts.values()) });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/contacts/pending
 * Get pending follow requests (received)
 */
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    const pending = await prisma.contact.findMany({
      where: {
        receiver_id: req.user.id,
        status: 'pending',
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
                bio: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json({ pending });
  } catch (error) {
    console.error('Get pending error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/contacts/unfollow
 * Unfollow/remove a contact
 */
router.delete('/unfollow', authMiddleware, async (req, res) => {
  try {
    const { contact_id, user_id } = req.body;

    if (!contact_id && !user_id) {
      return res.status(400).json({ error: 'Either contact_id or user_id is required' });
    }

    let contact = null;

    if (contact_id) {
      // Find contact by ID
      contact = await prisma.contact.findUnique({
        where: { id: contact_id },
      });

      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      // Verify user is part of this contact
      if (contact.sender_id !== req.user.id && contact.receiver_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to unfollow this contact' });
      }
    } else if (user_id) {
      // Find contact by user_id
      contact = await prisma.contact.findFirst({
        where: {
          OR: [
            { sender_id: req.user.id, receiver_id: user_id },
            { sender_id: user_id, receiver_id: req.user.id },
          ],
        },
      });

      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
    }

    const otherUserId = contact.sender_id === req.user.id ? contact.receiver_id : contact.sender_id;

    // Delete both directions of the contact relationship
    await prisma.contact.deleteMany({
      where: {
        OR: [
          { sender_id: req.user.id, receiver_id: otherUserId },
          { sender_id: otherUserId, receiver_id: req.user.id },
        ],
      },
    });

    // Create notification for the other user
    await prisma.notification.create({
      data: {
        user_id: otherUserId,
        sender_id: req.user.id,
        type: 'follow',
        title: 'Contact Removed',
        message: `${req.user.full_name || req.user.username} unfollowed you`,
        link: '/contacts',
      },
    });

    // Emit notification via Socket.io if available
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${otherUserId}`).emit('notification.new', {
        type: 'follow',
        title: 'Contact Removed',
        message: `${req.user.full_name || req.user.username} unfollowed you`,
      });
    }

    res.json({ message: 'Contact removed successfully' });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
