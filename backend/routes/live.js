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
    const { type = 'live', title, description, category, scheduled_at, thread_id } = req.body;

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
    // type can be: 'live', 'voice', 'video', or 'call'
    const isLiveStreaming = type === 'live';
    const isCall = type === 'call' || type === 'voice' || type === 'video';
    const callType = isCall ? (type === 'video' ? 'video' : 'voice') : null;

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

    // Determine call status
    let callStatus = null;
    if (isCall) {
      callStatus = 'ringing'; // Calls start in ringing state
    }

    // Create call session in database
    // Store call type as 'call' for database, but track voice/video separately
    const sessionType = isCall ? 'call' : type;
    const session = await prisma.callSession.create({
      data: {
        host_id: req.user.id,
        type: sessionType,
        thread_id: thread_id || undefined,
        title: title || undefined,
        description: description || undefined,
        category: category || undefined, // Category for live streams
        daily_room_url: room.url,
        daily_token: token,
        status: scheduled_at ? 'scheduled' : 'active',
        call_status: callStatus,
        scheduled_at: scheduled_at ? new Date(scheduled_at) : undefined,
        started_at: scheduled_at ? undefined : new Date(),
        participants: [req.user.id],
        viewers_count: 0,
      },
    });

    // If this is a call (not live stream), send notification to other participant(s)
    if (isCall && thread_id) {
      try {
        // Get thread participants
        const thread = await prisma.chatThread.findUnique({
          where: { id: thread_id },
        });

        if (thread) {
          const participants = Array.isArray(thread.participants) ? thread.participants : [];
          const otherParticipants = participants.filter((id) => id !== req.user.id);

          // Get caller info
          const caller = await prisma.user.findUnique({
            where: { id: req.user.id },
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

          // Send call notification via Socket.io to each participant
          const io = req.app.get('io');
          if (io) {
            otherParticipants.forEach((participantId) => {
              // Emit incoming call event with call type
              io.to(`user:${participantId}`).emit('call.incoming', {
                sessionId: session.id,
                threadId: thread_id,
                caller: caller,
                type: callType || 'voice', // 'voice' or 'video'
                roomUrl: room.url,
              });

              // Create notification in database
              prisma.notification.create({
                data: {
                  user_id: participantId,
                  sender_id: req.user.id,
                  type: 'call',
                  title: 'Incoming Call',
                  message: `${caller?.full_name || caller?.username} is calling you`,
                  link: `/chats/${thread_id}/call?sessionId=${session.id}`,
                },
              }).catch((err) => {
                logger.error('Failed to create call notification', { error: err.message });
              });
            });
          }
        }
      } catch (error) {
        logger.error('Failed to send call notifications', { error: error.message });
        // Don't fail the request if notification fails
      }
    }

    // If this is a live stream, notify contacts only
    if (type === 'live') {
      try {
        // Get host's approved contacts
        const contacts = await prisma.contact.findMany({
          where: {
            OR: [
              { sender_id: req.user.id, status: 'approved' },
              { receiver_id: req.user.id, status: 'approved' },
            ],
          },
        });

        // Get contact user IDs
        const contactUserIds = contacts.map((contact) => 
          contact.sender_id === req.user.id ? contact.receiver_id : contact.sender_id
        );

        // Get host info
        const host = await prisma.user.findUnique({
          where: { id: req.user.id },
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

        const io = req.app.get('io');
        if (io && contactUserIds.length > 0) {
          // Emit to contacts only
          contactUserIds.forEach((contactId) => {
            io.to(`user:${contactId}`).emit('live.stream.started', {
              sessionId: session.id,
              host: host,
              title: title || 'Live Stream',
              description: description || undefined,
              category: category || undefined,
              roomUrl: room.url,
            });
          });
        }

        // Create notifications for contacts
        if (contactUserIds.length > 0) {
          await Promise.all(
            contactUserIds.map((contactId) =>
              prisma.notification.create({
                data: {
                  user_id: contactId,
                  sender_id: req.user.id,
                  type: 'live',
                  title: 'Live Stream Started',
                  message: `${host?.full_name || host?.username} is now live streaming${title ? `: ${title}` : ''}`,
                  link: `/live/${session.id}`,
                },
              }).catch((err) => {
                logger.error('Failed to create live stream notification', { error: err.message });
              })
            )
          );
        }
      } catch (error) {
        logger.error('Failed to send live stream notifications', { error: error.message });
        // Don't fail the request if notification fails
      }
    }

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
      
      // Update viewer count for live streams
      const updateData = { participants };
      if (session.type === 'live') {
        updateData.viewers_count = participants.length;
      }
      
      await prisma.callSession.update({
        where: { id: sessionId },
        data: updateData,
      });

      // Emit viewer count update for live streams
      if (session.type === 'live') {
        const io = req.app.get('io');
        if (io) {
          io.to(`live:${sessionId}`).emit('live.viewers.updated', {
            sessionId,
            viewersCount: participants.length,
          });
        }
      }
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
 * POST /api/live/accept/:sessionId
 * Accept an incoming call
 */
router.post('/accept/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.callSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.type !== 'call') {
      return res.status(400).json({ error: 'This endpoint is only for calls' });
    }

    // Check if user is a participant (not the host)
    const isHost = session.host_id === req.user.id;

    if (isHost) {
      return res.status(400).json({ error: 'Host cannot accept their own call' });
    }

    // Verify user is part of the thread
    if (session.thread_id) {
      const thread = await prisma.chatThread.findUnique({
        where: { id: session.thread_id },
      });
      if (thread) {
        const threadParticipants = Array.isArray(thread.participants) ? thread.participants : [];
        if (!threadParticipants.includes(req.user.id)) {
          return res.status(403).json({ error: 'Not authorized to accept this call' });
        }
      }
    }

    // Update call status to accepted and add user to participants
    // Create a new array to avoid mutating the original session.participants
    const existingParticipants = Array.isArray(session.participants) ? session.participants : [];
    const participants = [...existingParticipants];
    if (!participants.includes(req.user.id)) {
      participants.push(req.user.id);
    }

    const updated = await prisma.callSession.update({
      where: { id: sessionId },
      data: {
        call_status: 'accepted',
        answered_at: new Date(),
        status: 'active',
        participants,
      },
    });

    // Get room URL and token for the accepting user
    if (!updated.daily_room_url) {
      return res.status(400).json({ error: 'Call session does not have a Daily.co room configured' });
    }

    const roomName = daily.extractRoomName(updated.daily_room_url);
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

    // Generate meeting token for the accepting user (participant, not owner)
    const token = await daily.createMeetingToken(roomName, {
      is_owner: false, // Accepting user is a participant, not the owner
      user_name: user?.full_name || user?.username || 'Participant',
    });

    // Notify caller that call was accepted
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${session.host_id}`).emit('call.accepted', {
        sessionId,
        acceptedBy: req.user.id,
      });
    }

    res.json({ 
      session: updated,
      roomUrl: updated.daily_room_url,
      token,
    });
  } catch (error) {
    logger.error('Accept call error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/live/reject/:sessionId
 * Reject an incoming call
 */
router.post('/reject/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.callSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.type !== 'call') {
      return res.status(400).json({ error: 'This endpoint is only for calls' });
    }

    // Verify user is part of the thread
    if (session.thread_id) {
      const thread = await prisma.chatThread.findUnique({
        where: { id: session.thread_id },
      });
      if (thread) {
        const threadParticipants = Array.isArray(thread.participants) ? thread.participants : [];
        if (!threadParticipants.includes(req.user.id)) {
          return res.status(403).json({ error: 'Not authorized to reject this call' });
        }
      }
    }

    // Update call status to rejected
    const updated = await prisma.callSession.update({
      where: { id: sessionId },
      data: {
        call_status: 'rejected',
        ended_at: new Date(),
        status: 'ended',
      },
    });

    // Notify caller that call was rejected
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${session.host_id}`).emit('call.rejected', {
        sessionId,
        rejectedBy: req.user.id,
      });
    }

    res.json({ session: updated });
  } catch (error) {
    logger.error('Reject call error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
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
    const updateData = {
      status: 'ended',
      ended_at: new Date(),
    };
    
    if (session.type === 'call') {
      updateData.call_status = 'ended';
    }

    const updated = await prisma.callSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    // Notify all participants that session ended
    const io = req.app.get('io');
    if (io) {
      if (session.type === 'call') {
        // Notify all participants in the call
        participants.forEach((participantId) => {
          io.to(`user:${participantId}`).emit('call.ended', {
            sessionId,
            endedBy: req.user.id,
          });
        });
      } else if (session.type === 'live') {
        // Notify all viewers
        io.to(`live:${sessionId}`).emit('live.stream.ended', {
          sessionId,
          endedBy: req.user.id,
        });
      }
    }

    res.json({ session: updated });
  } catch (error) {
    logger.error('End live session error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
