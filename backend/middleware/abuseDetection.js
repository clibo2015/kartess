const crypto = require('crypto');
const logger = require('../utils/logger');

const DEFAULT_SPAM_KEYWORDS = [
  'viagra',
  'free money',
  'work from home',
  'miracle cure',
  'click here',
  'buy now',
  'adult dating',
  'bitcoin giveaway',
];

const recentSubmissions = new Map();
const retentionMs = 5 * 60 * 1000; // keep entries for 5 minutes

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of recentSubmissions.entries()) {
    if (now - entry.timestamp > retentionMs) {
      recentSubmissions.delete(key);
    }
  }
})
  .unref?.(); // Do not keep the process alive in tests

function hashContent(content = '') {
  return crypto.createHash('sha1').update(content).digest('hex');
}

function createAbuseGuard(options = {}) {
  const {
    bucket = 'default',
    minIntervalMs = 3000,
    keywords = DEFAULT_SPAM_KEYWORDS,
    blockMessage = 'Please wait before sending another request.',
  } = options;

  return (req, res, next) => {
    try {
      const identifier = `${req.user?.id || 'anon'}:${bucket}`;
      const now = Date.now();
      const contentFields = [
        req.body?.content,
        req.body?.message,
        req.body?.text,
        req.body?.title,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const contentHash = hashContent(contentFields);
      const previous = recentSubmissions.get(identifier);

      if (previous) {
        const timeSinceLast = now - previous.timestamp;
        const isRapidRepeat = timeSinceLast < minIntervalMs;
        const isDuplicateContent =
          contentFields.length > 0 && previous.hash === contentHash && timeSinceLast < minIntervalMs * 5;

        if (isRapidRepeat || isDuplicateContent) {
          logger.warn('Potential abuse detected', {
            identifier,
            timeSinceLast,
            bucket,
            duplicate: isDuplicateContent,
            route: req.originalUrl,
          });

          return res.status(429).json({
            error: blockMessage,
            retryAfterMs: minIntervalMs,
          });
        }
      }

      if (contentFields.length > 0) {
        const matchedKeyword = keywords.find((keyword) => contentFields.includes(keyword));
        if (matchedKeyword) {
          logger.warn('Spam keyword detected', {
            identifier,
            keyword: matchedKeyword,
            route: req.originalUrl,
          });

          return res.status(400).json({
            error: 'Potential spam detected. Please adjust your message.',
          });
        }
      }

      recentSubmissions.set(identifier, {
        timestamp: now,
        hash: contentHash,
      });

      req.abuseContext = {
        identifier,
        bucket,
        timestamp: now,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      };

      return next();
    } catch (error) {
      logger.logError(error, req, { context: 'Abuse guard' });
      return res.status(500).json({ error: 'Unable to process request at this time.' });
    }
  };
}

module.exports = {
  createAbuseGuard,
  DEFAULT_SPAM_KEYWORDS,
};

