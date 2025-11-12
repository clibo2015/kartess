const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');
const { createAbuseGuard } = require('../middleware/abuseDetection');
const { captchaGuard } = require('../middleware/captcha');

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

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/') ||
      file.mimetype.startsWith('audio/')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only image, video, and audio files are allowed'), false);
    }
  },
});

const messageCaptchaGuard = captchaGuard({ context: 'messages:create' });

const messageAbuseGuard = createAbuseGuard({
  bucket: 'messages',
  minIntervalMs: 1500,
  blockMessage: 'You are sending messages too quickly. Please slow down.',
});

/**
 * POST /api/messages
 * Send a message (encrypted content expected from client)
 */
router.post(
  '/',
  authMiddleware,
  upload.array('media', 10),
  messageCaptchaGuard,
  messageAbuseGuard,
  async (req, res) => {
  try {
    const { thread_id, content, encrypted = true } = req.body;

    if (!thread_id || !content) {
      return res.status(400).json({ error: 'Thread ID and content are required' });
    }

    // Verify user is participant
    const thread = await prisma.chatThread.findUnique({
      where: { id: thread_id },
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const participants = Array.isArray(thread.participants) ? thread.participants : [];
    if (!participants.includes(req.user.id)) {
      return res.status(403).json({ error: 'Not authorized to send message in this thread' });
    }

    // Upload media files to Cloudinary with enhanced validation
    let mediaUrls = [];
    if (req.files && req.files.length > 0) {
      const { validateFileSignature, validateFileSize } = require('../middleware/fileValidation');
      
      const uploadPromises = req.files.map(async (file) => {
        // Validate file size
        const sizeCheck = validateFileSize(file.size, 10 * 1024 * 1024);
        if (!sizeCheck.valid) {
          throw new Error(sizeCheck.error);
        }

        // Validate file signature
        const allowedTypes = file.mimetype.startsWith('video/')
          ? ['video/mp4', 'video/webm', 'video/quicktime']
          : file.mimetype.startsWith('audio/')
          ? ['audio/mpeg', 'audio/wav', 'audio/ogg']
          : ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        
        const signatureCheck = await validateFileSignature(file.buffer, allowedTypes);
        if (!signatureCheck.valid) {
          throw new Error(signatureCheck.error);
        }

        // Upload to Cloudinary
        const resourceType = file.mimetype.startsWith('video/')
          ? 'video'
          : file.mimetype.startsWith('audio/')
          ? 'raw'
          : 'image';

        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'kartess/messages',
              resource_type: resourceType,
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result.secure_url);
            }
          );

          uploadStream.end(file.buffer);
        });
      });

      mediaUrls = await Promise.all(uploadPromises);
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        thread_id,
        user_id: req.user.id,
        content, // Already encrypted from client
        encrypted: encrypted === true || encrypted === 'true',
        media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
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

    // Update thread updated_at
    await prisma.chatThread.update({
      where: { id: thread_id },
      data: { updated_at: new Date() },
    });

    // Emit new message via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`thread:${thread_id}`).emit('message.new', message);
    }

    // Create notifications for other participants
    const otherParticipantIds = participants.filter((id) => id !== req.user.id);
    for (const participantId of otherParticipantIds) {
      await prisma.notification.create({
        data: {
          user_id: participantId,
          sender_id: req.user.id,
          type: 'message',
          title: 'New Message',
          message: `${req.user.full_name || req.user.username} sent you a message`,
          link: `/chats/${thread_id}`,
        },
      });

      // Emit notification via Socket.io
      if (io) {
        io.to(`user:${participantId}`).emit('notification.new', {
          type: 'message',
          title: 'New Message',
          message: `${req.user.full_name || req.user.username} sent you a message`,
        });
      }
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/messages/:messageId
 * Delete a message (only message sender can delete)
 */
router.delete('/:messageId', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;

    // Get message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        thread: {
          select: {
            id: true,
            participants: true,
          },
        },
      },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is the sender
    if (message.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }

    // Delete message (cascade will delete message reads)
    await prisma.message.delete({
      where: { id: messageId },
    });

    // Update thread updated_at
    await prisma.chatThread.update({
      where: { id: message.thread_id },
      data: { updated_at: new Date() },
    });

    // Emit message deleted via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`thread:${message.thread_id}`).emit('message.deleted', {
        message_id: messageId,
        thread_id: message.thread_id,
      });
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
