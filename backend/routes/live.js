const express = require('express');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/live/create
 * Create a live streaming session
 */
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { type = 'live', title, description, scheduled_at } = req.body;

    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      console.error('Agora configuration missing - live streaming/calls disabled');
      return res.status(503).json({ 
        error: 'Voice/video calls and live streaming are currently unavailable. Please configure Agora credentials.',
        requiresConfiguration: true 
      });
    }

    // Generate channel name
    const channelName = `channel_${Date.now()}_${req.user.id}`;
    const uid = req.user.id; // Use user ID as UID (or 0 for auto-generate)

    // Calculate expiration time (24 hours from now)
    const expirationTimeInSeconds = Math.floor(Date.now() / 1000) + 3600 * 24;

    // Build token
    const role = RtcRole.PUBLISHER; // Host can publish and subscribe
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      role,
      expirationTimeInSeconds
    );

    // Create call session in database
    const session = await prisma.callSession.create({
      data: {
        host_id: req.user.id,
        type,
        title: title || undefined,
        description: description || undefined,
        agora_channel: channelName,
        agora_token: token,
        status: scheduled_at ? 'scheduled' : 'active',
        scheduled_at: scheduled_at ? new Date(scheduled_at) : undefined,
        started_at: scheduled_at ? undefined : new Date(),
        participants: [req.user.id],
      },
    });

    res.json({
      session,
      token,
      channel: channelName,
      appId,
      uid,
    });
  } catch (error) {
    console.error('Create live session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/live/join/:sessionId
 * Join a live streaming session (get token for viewer)
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

    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      console.error('Agora configuration missing - live streaming/calls disabled');
      return res.status(503).json({ 
        error: 'Voice/video calls and live streaming are currently unavailable. Please configure Agora credentials.',
        requiresConfiguration: true 
      });
    }

    // Generate token for viewer (SUBSCRIBER role)
    const expirationTimeInSeconds = Math.floor(Date.now() / 1000) + 3600 * 24;
    const role = RtcRole.SUBSCRIBER; // Viewer can only subscribe
    const uid = req.user.id;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      session.agora_channel,
      uid,
      role,
      expirationTimeInSeconds
    );

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
      token,
      channel: session.agora_channel,
      appId,
      uid,
    });
  } catch (error) {
    console.error('Join live session error:', error);
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
    console.error('Get live sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/live/end/:sessionId
 * End a live streaming session
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

    const updated = await prisma.callSession.update({
      where: { id: sessionId },
      data: {
        status: 'ended',
        ended_at: new Date(),
      },
    });

    res.json({ session: updated });
  } catch (error) {
    console.error('End live session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
