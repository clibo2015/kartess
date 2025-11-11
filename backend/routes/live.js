const express = require('express');
// Agora imports (kept for rollback, currently disabled)
// const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');
const daily = require('../services/daily');
const logger = require('../utils/logger');

const router = express.Router();

// Agora helper function (kept for rollback, currently disabled)
/*
function stringToNumericUID(userId) {
  if (!userId) return 0;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % 2147483647;
}
*/

/**
 * POST /api/live/create
 * Create a live streaming session using Daily.co
 */
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { type = 'live', title, description, scheduled_at } = req.body;

    // Check Daily.co API key
    if (!process.env.DAILY_API_KEY) {
      logger.error('Daily.co configuration missing - live streaming/calls disabled');
      return res.status(503).json({ 
        error: 'Voice/video calls and live streaming are currently unavailable. Please configure Daily.co credentials.',
        requiresConfiguration: true,
        details: 'DAILY_API_KEY environment variable is required.',
      });
    }

    // Determine if this is live streaming or call
    const isLiveStreaming = type === 'live';

    // Generate room name
    const roomName = `room_${Date.now()}_${req.user.id}`;

    // Create Daily.co room
    // For live streaming: owner_only_broadcast = true (only host can broadcast)
    // For calls: owner_only_broadcast = false (all participants can broadcast)
    const room = await daily.createRoom({
      name: roomName,
      owner_only_broadcast: isLiveStreaming, // Only host broadcasts in live streaming
      enable_chat: true,
      privacy: 'private',
    });

    if (!room || !room.url) {
      throw new Error('Failed to create Daily.co room');
    }

    // Extract room name from URL (Daily.co might return a different name)
    const actualRoomName = room.name || daily.extractRoomName(room.url);
    if (!actualRoomName) {
      throw new Error('Failed to get room name from Daily.co response');
    }

    // Get user details for token
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        full_name: true,
      },
    });

    // Generate meeting token for host (owner)
    const token = await daily.createMeetingToken(actualRoomName, {
      is_owner: true,
      user_name: user?.full_name || user?.username || 'Host',
    });

    // Create call session in database
    const session = await prisma.callSession.create({
      data: {
        host_id: req.user.id,
        type,
        title: title || undefined,
        description: description || undefined,
        daily_room_url: room.url,
        daily_token: token,
        status: scheduled_at ? 'scheduled' : 'active',
        scheduled_at: scheduled_at ? new Date(scheduled_at) : undefined,
        started_at: scheduled_at ? undefined : new Date(),
        participants: [req.user.id],
      },
    });

    res.json({
      session,
      roomUrl: room.url,
      token,
      userId: req.user.id,
    });
  } catch (error) {
    logger.error('Create live session error', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/live/join/:sessionId
 * Join a live streaming session using Daily.co
 */
router.post('/join/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.callSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    if (!session.daily_room_url) {
      return res.status(400).json({ error: 'Session does not have a Daily.co room configured' });
    }

    // Check Daily.co API key
    if (!process.env.DAILY_API_KEY) {
      logger.error('Daily.co configuration missing - live streaming/calls disabled');
      return res.status(503).json({ 
        error: 'Voice/video calls and live streaming are currently unavailable. Please configure Daily.co credentials.',
        requiresConfiguration: true,
        details: 'DAILY_API_KEY environment variable is required.',
      });
    }

    // Extract room name from room URL
    const roomName = daily.extractRoomName(session.daily_room_url);
    if (!roomName) {
      return res.status(500).json({ error: 'Invalid room URL' });
    }

    // Get user details for token
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        full_name: true,
      },
    });

    // Determine if user is host
    const isHost = session.host_id === req.user.id;

    // Generate meeting token for participant
    // Host gets owner token, audience gets participant token
    const token = await daily.createMeetingToken(roomName, {
      is_owner: isHost,
      user_name: user?.full_name || user?.username || 'Participant',
    });

    // Update participants
    const participants = Array.isArray(session.participants) ? session.participants : [];
    if (!participants.includes(req.user.id)) {
      participants.push(req.user.id);
      await prisma.callSession.update({
        where: { id: sessionId },
        data: { participants },
      });
    }

    res.json({
      session,
      roomUrl: session.daily_room_url,
      token,
      userId: req.user.id,
    });
  } catch (error) {
    logger.error('Join live session error', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/live/sessions
 * Get active live sessions
 */
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await prisma.callSession.findMany({
      where: {
        status: 'active',
      },
      include: {
        // Note: host_id is stored as string, need to fetch user separately
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    // Fetch user details for each session
    const sessionsWithUsers = await Promise.all(
      sessions.map(async (session) => {
        const user = await prisma.user.findUnique({
          where: { id: session.host_id },
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
        return {
          ...session,
          host: user,
        };
      })
    );

    res.json({ sessions: sessionsWithUsers });
  } catch (error) {
    logger.error('Get live sessions error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/live/end/:sessionId
 * End a live streaming session and delete Daily.co room
 */
router.post('/end/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.callSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.host_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete Daily.co room if it exists
    if (session.daily_room_url) {
      try {
        const roomName = daily.extractRoomName(session.daily_room_url);
        if (roomName) {
          await daily.deleteRoom(roomName);
        }
      } catch (error) {
        // Log error but don't fail the request
        logger.error('Failed to delete Daily.co room', { 
          error: error.message, 
          roomUrl: session.daily_room_url 
        });
      }
    }

    // Update session status
    const updated = await prisma.callSession.update({
      where: { id: sessionId },
      data: {
        status: 'ended',
        ended_at: new Date(),
      },
    });

    res.json({ session: updated });
  } catch (error) {
    logger.error('End live session error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
