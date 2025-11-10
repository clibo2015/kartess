const express = require('express');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * Convert string user ID to numeric UID for Agora
 * Agora requires numeric UIDs (0 to 2^32-1)
 * This function creates a consistent numeric hash from a string
 */
function stringToNumericUID(userId) {
  if (!userId) return 0;
  
  // Simple hash function to convert string to number
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Ensure positive number and within Agora's UID range (0 to 2^32-1)
  // Use Math.abs and modulo to keep it in range
  return Math.abs(hash) % 2147483647; // 2^31 - 1 (safe integer range)
}

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
      const logger = require('../utils/logger');
      logger.error('Agora configuration missing - live streaming/calls disabled', {
        hasAppId: !!appId,
        hasAppCertificate: !!appCertificate,
      });
      return res.status(503).json({ 
        error: 'Voice/video calls and live streaming are currently unavailable. Please configure Agora credentials.',
        requiresConfiguration: true,
        details: 'AGORA_APP_ID and AGORA_APP_CERTIFICATE environment variables are required.',
      });
    }

    // Validate appId format (should be a valid Agora App ID)
    if (appId.trim() === '' || appId.length < 10) {
      const logger = require('../utils/logger');
      logger.error('Invalid Agora App ID format', { appIdLength: appId.length });
      return res.status(500).json({
        error: 'Invalid Agora configuration. Please check your AGORA_APP_ID.',
        requiresConfiguration: true,
      });
    }

    // Generate channel name
    const channelName = `channel_${Date.now()}_${req.user.id}`;
    
    // Convert string user ID to numeric UID for Agora
    // Agora requires numeric UIDs (0 to 2^32-1)
    const numericUID = stringToNumericUID(req.user.id);

    // Calculate expiration time (24 hours from now)
    const expirationTimeInSeconds = Math.floor(Date.now() / 1000) + 3600 * 24;

    // Determine role and channel mode based on session type
    const isLiveStreaming = type === 'live';
    const role = RtcRole.PUBLISHER; // Host can publish and subscribe

    // Build token with numeric UID
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      numericUID,
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
      uid: numericUID, // Return numeric UID for Agora
      userId: req.user.id, // Also return string user ID for reference
      mode: isLiveStreaming ? 'live' : 'rtc', // Indicate client mode
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
      const logger = require('../utils/logger');
      logger.error('Agora configuration missing - live streaming/calls disabled', {
        hasAppId: !!appId,
        hasAppCertificate: !!appCertificate,
      });
      return res.status(503).json({ 
        error: 'Voice/video calls and live streaming are currently unavailable. Please configure Agora credentials.',
        requiresConfiguration: true,
        details: 'AGORA_APP_ID and AGORA_APP_CERTIFICATE environment variables are required.',
      });
    }

    // Validate appId format
    if (appId.trim() === '' || appId.length < 10) {
      const logger = require('../utils/logger');
      logger.error('Invalid Agora App ID format', { appIdLength: appId.length });
      return res.status(500).json({
        error: 'Invalid Agora configuration. Please check your AGORA_APP_ID.',
        requiresConfiguration: true,
      });
    }

    // Generate token for viewer (SUBSCRIBER role)
    const expirationTimeInSeconds = Math.floor(Date.now() / 1000) + 3600 * 24;
    const role = RtcRole.SUBSCRIBER; // Viewer can only subscribe
    
    // Convert string user ID to numeric UID for Agora
    const numericUID = stringToNumericUID(req.user.id);

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      session.agora_channel,
      numericUID,
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

    // Determine if this is live streaming or call based on session type
    const isLiveStreaming = session.type === 'live';

    res.json({
      token,
      channel: session.agora_channel,
      appId,
      uid: numericUID, // Return numeric UID for Agora
      userId: req.user.id, // Also return string user ID for reference
      mode: isLiveStreaming ? 'live' : 'rtc', // Indicate client mode
      session, // Include session data for frontend
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
