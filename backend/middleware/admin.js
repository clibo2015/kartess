const prisma = require('../prisma/client');

/**
 * Middleware to check if user is admin or moderator
 */
const adminMiddleware = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.role !== 'admin' && user.role !== 'moderator') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    req.user.role = user.role;
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware to check if user is admin (not moderator)
 */
const adminOnlyMiddleware = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true },
    });

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    req.user.role = user.role;
    next();
  } catch (error) {
    console.error('Admin-only middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  adminMiddleware,
  adminOnlyMiddleware,
};
