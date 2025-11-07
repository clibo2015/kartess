const logger = require('../utils/logger');

const CAPTCHA_PROVIDER = process.env.CAPTCHA_PROVIDER;
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET;
const RECAPTCHA_MIN_SCORE = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);

function isCaptchaEnabled() {
  if (process.env.NODE_ENV === 'test') {
    return false;
  }
  return Boolean(CAPTCHA_PROVIDER && RECAPTCHA_SECRET);
}

async function verifyCaptchaToken(token, ip) {
  if (!isCaptchaEnabled()) {
    return { enabled: false, success: true };
  }

  if (!token) {
    return { enabled: true, success: false, message: 'Missing CAPTCHA token' };
  }

  const provider = CAPTCHA_PROVIDER.toLowerCase();

  try {
    if (provider === 'recaptcha_v2' || provider === 'recaptcha_v3') {
      const params = new URLSearchParams();
      params.append('secret', RECAPTCHA_SECRET);
      params.append('response', token);
      if (ip) {
        params.append('remoteip', ip);
      }

      const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        body: params,
      });

      if (!response.ok) {
        return { enabled: true, success: false, message: 'Unable to verify CAPTCHA' };
      }

      const data = await response.json();
      const success = Boolean(data.success);
      const score = typeof data.score === 'number' ? data.score : null;

      if (!success) {
        return {
          enabled: true,
          success: false,
          message: data['error-codes']?.join(', ') || 'CAPTCHA verification failed',
        };
      }

      if (provider === 'recaptcha_v3' && score !== null && score < RECAPTCHA_MIN_SCORE) {
        return {
          enabled: true,
          success: false,
          message: `Low CAPTCHA score: ${score}`,
        };
      }

      return {
        enabled: true,
        success: true,
        score,
      };
    }

    return {
      enabled: true,
      success: false,
      message: `Unsupported CAPTCHA provider: ${CAPTCHA_PROVIDER}`,
    };
  } catch (error) {
    logger.logError(error, null, { context: 'CAPTCHA verification' });
    return { enabled: true, success: false, message: 'CAPTCHA verification error' };
  }
}

function captchaGuard(options = {}) {
  const { context = 'global' } = options;

  return async (req, res, next) => {
    const result = await verifyCaptchaToken(
      req.body?.captchaToken || req.headers['x-captcha-token'],
      req.ip
    );

    if (!result.enabled) {
      return next();
    }

    if (!result.success) {
      logger.warn('CAPTCHA verification failed', {
        context,
        message: result.message,
        ip: req.ip,
        userId: req.user?.id || null,
      });

      return res.status(400).json({
        error: 'CAPTCHA verification failed',
        details: process.env.NODE_ENV === 'development' ? result.message : undefined,
      });
    }

    req.captcha = {
      provider: CAPTCHA_PROVIDER,
      score: result.score ?? null,
      context,
    };

    return next();
  };
}

module.exports = {
  captchaGuard,
  verifyCaptchaToken,
  isCaptchaEnabled,
};

