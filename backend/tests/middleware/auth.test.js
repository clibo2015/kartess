const { verifyToken } = require('../../utils/jwt');
const authMiddleware = require('../../middleware/auth');
const prisma = require('../../prisma/client');

jest.mock('../../utils/jwt');
jest.mock('../../prisma/client');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: null,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should call next() with valid token', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      username: 'testuser',
      full_name: 'Test User',
    };

    req.headers.authorization = 'Bearer valid_token';
    verifyToken.mockReturnValue({ id: 'user-1', email: 'test@example.com' });
    prisma.user.findUnique.mockResolvedValue(mockUser);

    await authMiddleware(req, res, next);

    expect(verifyToken).toHaveBeenCalledWith('valid_token');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: {
        id: true,
        email: true,
        username: true,
        full_name: true,
      },
    });
    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 401 if no authorization header', async () => {
    req.headers.authorization = undefined;

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if authorization header does not start with Bearer', async () => {
    req.headers.authorization = 'Invalid token';

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid', async () => {
    req.headers.authorization = 'Bearer invalid_token';
    verifyToken.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if user not found in database', async () => {
    req.headers.authorization = 'Bearer valid_token';
    verifyToken.mockReturnValue({ id: 'user-1', email: 'test@example.com' });
    prisma.user.findUnique.mockResolvedValue(null);

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should handle database errors', async () => {
    req.headers.authorization = 'Bearer valid_token';
    verifyToken.mockReturnValue({ id: 'user-1', email: 'test@example.com' });
    prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });
});

