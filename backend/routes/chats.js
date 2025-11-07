const express = require('express');
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/chats/threads
 * Get all threads for the current user
 */
router.get('/threads', authMiddleware, async (req, res) => {
  try {
    // Get all threads where user is a participant
    const allThreads = await prisma.chatThread.findMany({
      orderBy: { updated_at: 'desc' },
    });

    // Filter threads where current user is a participant
    const userThreads = allThreads.filter((thread) => {
      const participants = Array.isArray(thread.participants) ? thread.participants : [];
      return participants.includes(req.user.id);
    });

    // Get latest message and participant info for each thread
    const threadsWithDetails = await Promise.all(
      userThreads.map(async (thread) => {
        const participants = Array.isArray(thread.participants) ? thread.participants : [];
        const otherParticipantIds = participants.filter((id) => id !== req.user.id);

        // Get latest message
        const latestMessage = await prisma.message.findFirst({
          where: { thread_id: thread.id },
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
                  },
                },
              },
            },
          },
        });

        // Get other participants' info
        const otherParticipants = await prisma.user.findMany({
          where: {
            id: { in: otherParticipantIds },
          },
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
        });

        // Get unread count
        const unreadCount = await prisma.message.count({
          where: {
            thread_id: thread.id,
            user_id: { not: req.user.id },
            reads: {
              none: {
                user_id: req.user.id,
              },
            },
          },
        });

        return {
          id: thread.id,
          type: thread.type,
          name: thread.name,
          participants: otherParticipants,
          latestMessage: latestMessage
            ? {
                id: latestMessage.id,
                content: latestMessage.content,
                encrypted: latestMessage.encrypted,
                created_at: latestMessage.created_at,
                user: latestMessage.user,
              }
            : null,
          unreadCount,
          updated_at: thread.updated_at,
        };
      })
    );

    res.json({ threads: threadsWithDetails });
  } catch (error) {
    console.error('Get threads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/chats/threads
 * Create a new thread (1:1 or group)
 */
router.post('/threads', authMiddleware, async (req, res) => {
  try {
    const { type = '1:1', name, participant_ids } = req.body;

    if (!participant_ids || !Array.isArray(participant_ids)) {
      return res.status(400).json({ error: 'Participant IDs array is required' });
    }

    // Include current user in participants
    const allParticipants = [...new Set([req.user.id, ...participant_ids])];

    if (type === '1:1' && allParticipants.length !== 2) {
      return res.status(400).json({ error: '1:1 thread must have exactly 2 participants' });
    }

    // For 1:1, check if thread already exists
    if (type === '1:1') {
      const existingThreads = await prisma.chatThread.findMany({
        where: {
          type: '1:1',
        },
      });

      const existingThread = existingThreads.find((thread) => {
        const participants = Array.isArray(thread.participants) ? thread.participants : [];
        return (
          participants.length === 2 &&
          participants.includes(req.user.id) &&
          participants.includes(participant_ids[0])
        );
      });

      if (existingThread) {
        // Return existing thread with details
        const otherParticipant = await prisma.user.findUnique({
          where: { id: participant_ids[0] },
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
        });

        return res.json({
          thread: {
            id: existingThread.id,
            type: existingThread.type,
            participants: otherParticipant ? [otherParticipant] : [],
            latestMessage: null,
            unreadCount: 0,
            updated_at: existingThread.updated_at,
          },
        });
      }
    }

    // Create new thread
    const thread = await prisma.chatThread.create({
      data: {
        type,
        name: type === 'group' ? name : undefined,
        participants: allParticipants,
      },
    });

    // Get other participants' info
    const otherParticipantIds = allParticipants.filter((id) => id !== req.user.id);
    const otherParticipants = await prisma.user.findMany({
      where: {
        id: { in: otherParticipantIds },
      },
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
    });

    res.status(201).json({
      thread: {
        id: thread.id,
        type: thread.type,
        name: thread.name,
        participants: otherParticipants,
        latestMessage: null,
        unreadCount: 0,
        updated_at: thread.updated_at,
      },
    });
  } catch (error) {
    console.error('Create thread error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/chats/threads/:threadId/messages
 * Get messages for a thread
 */
router.get('/threads/:threadId/messages', authMiddleware, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { limit = 50, cursor } = req.query;

    // Verify user is participant
    const thread = await prisma.chatThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const participants = Array.isArray(thread.participants) ? thread.participants : [];
    if (!participants.includes(req.user.id)) {
      return res.status(403).json({ error: 'Not authorized to view this thread' });
    }

    // Get messages
    const messages = await prisma.message.findMany({
      where: { thread_id: threadId },
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
              },
            },
          },
        },
        reads: {
          where: {
            user_id: req.user.id,
          },
          select: {
            read_at: true,
          },
        },
      },
    });

    // Mark messages as read
    const unreadMessages = messages.filter((msg) => msg.reads.length === 0);
    if (unreadMessages.length > 0) {
      await prisma.messageRead.createMany({
        data: unreadMessages.map((msg) => ({
          message_id: msg.id,
          user_id: req.user.id,
        })),
        skipDuplicates: true,
      });

      // Emit read receipts via Socket.io
      const io = req.app.get('io');
      if (io) {
        unreadMessages.forEach((msg) => {
          io.to(`thread:${threadId}`).emit('message.read', {
            message_id: msg.id,
            user_id: req.user.id,
          });
        });
      }
    }

    res.json({
      messages: messages.reverse(), // Reverse to show oldest first
      nextCursor: messages.length === parseInt(limit) ? messages[0].id : null,
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
