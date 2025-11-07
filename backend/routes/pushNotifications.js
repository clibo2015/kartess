const express = require('express');
const webpush = require('web-push');
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Configure VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:your-email@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

/**
 * POST /api/notifications/push/subscribe
 * Subscribe to push notifications
 */
router.post('/push/subscribe', authMiddleware, async (req, res) => {
  try {
    const subscription = req.body;

    // Store subscription in user settings
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { settings: true },
    });

    const settings = user?.settings || {};
    settings.pushSubscription = subscription;

    await prisma.user.update({
      where: { id: req.user.id },
      data: { settings },
    });

    res.json({ message: 'Subscription saved' });
  } catch (error) {
    logger.logError(error, req, { context: 'Push subscription' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/push/send
 * Send push notification (admin/internal use)
 */
router.post('/push/send', authMiddleware, async (req, res) => {
  try {
    const { user_id, title, message, link } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: user_id },
      select: { settings: true },
    });

    const settings = user?.settings || {};
    const subscription = settings.pushSubscription;

    if (!subscription) {
      return res.status(400).json({ error: 'User has no push subscription' });
    }

    const payload = JSON.stringify({
      title,
      message,
      link,
    });

    await webpush.sendNotification(subscription, payload);

    res.json({ message: 'Push notification sent' });
  } catch (error) {
    logger.logError(error, req, { context: 'Send push notification' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
