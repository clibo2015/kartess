const request = require('supertest');
const express = require('express');
const authRoutes = require('../../routes/auth');
const prisma = require('../../prisma/client');
const { hashPassword, comparePassword } = require('../../utils/bcrypt');
const { generateToken, generateRefreshToken, hashRefreshToken, verifyToken } = require('../../utils/jwt');
const authMiddleware = require('../../middleware/auth');

jest.mock('../../prisma/client');
jest.mock('../../utils/bcrypt');
jest.mock('../../utils/jwt');
jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = global.mockUser;
  next();
});

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        full_name: 'Test User',
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test123!@#',
      };

      prisma.user.findUnique
        .mockResolvedValueOnce(null) // Email check
        .mockResolvedValueOnce(null); // Username check
      hashPassword.mockResolvedValue('hashed_password');
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: userData.email,
        username: userData.username,
        full_name: userData.full_name,
      });
      generateToken.mockReturnValue('mock_jwt_token');
      generateRefreshToken.mockReturnValue('mock_refresh_token');
      hashRefreshToken.mockReturnValue('hashed_refresh_token');
      prisma.refreshToken.create.mockResolvedValue({
        id: 'refresh-token-1',
        user_id: 'user-1',
        token: 'hashed_refresh_token',
        expires_at: new Date(),
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(userData.email);
      expect(hashPassword).toHaveBeenCalledWith(userData.password);
      expect(generateToken).toHaveBeenCalled();
      expect(generateRefreshToken).toHaveBeenCalled();
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('should return 400 if email already exists', async () => {
      const userData = {
        full_name: 'Test User',
        email: 'existing@example.com',
        username: 'testuser',
        password: 'Test123!@#',
      };

      prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing-user' });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Email already exists');
    });

    it('should return 400 if username already exists', async () => {
      const userData = {
        full_name: 'Test User',
        email: 'test@example.com',
        username: 'existinguser',
        password: 'Test123!@#',
      };

      prisma.user.findUnique
        .mockResolvedValueOnce(null) // Email check
        .mockResolvedValueOnce({ id: 'existing-user' }); // Username check

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Username already exists');
    });

    it('should return 400 for invalid email', async () => {
      const userData = {
        full_name: 'Test User',
        email: 'invalid-email',
        username: 'testuser',
        password: 'Test123!@#',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should return 400 for short password', async () => {
      const userData = {
        full_name: 'Test User',
        email: 'test@example.com',
        username: 'testuser',
        password: 'Short1!',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should return 400 for password without uppercase', async () => {
      const userData = {
        full_name: 'Test User',
        email: 'test@example.com',
        username: 'testuser',
        password: 'test123!@#',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should return 500 on database error', async () => {
      const userData = {
        full_name: 'Test User',
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test123!@#',
      };

      prisma.user.findUnique.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with complete profile', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'Test123!@#',
      };

      const mockUser = {
        id: 'user-1',
        email: loginData.email,
        username: 'testuser',
        full_name: 'Test User',
        password_hash: 'hashed_password',
      };

      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      comparePassword.mockResolvedValue(true);
      prisma.profile.findUnique.mockResolvedValueOnce({
        user_id: 'user-1',
        bio: 'Test bio',
      });
      generateToken.mockReturnValue('mock_jwt_token');
      generateRefreshToken.mockReturnValue('mock_refresh_token');
      hashRefreshToken.mockReturnValue('hashed_refresh_token');
      prisma.refreshToken.create.mockResolvedValue({
        id: 'refresh-token-1',
        user_id: 'user-1',
        token: 'hashed_refresh_token',
        expires_at: new Date(),
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.profileComplete).toBe(true);
      expect(comparePassword).toHaveBeenCalledWith(loginData.password, mockUser.password_hash);
      expect(generateRefreshToken).toHaveBeenCalled();
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('should login successfully with incomplete profile', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'Test123!@#',
      };

      const mockUser = {
        id: 'user-1',
        email: loginData.email,
        username: 'testuser',
        full_name: 'Test User',
        password_hash: 'hashed_password',
      };

      prisma.user.findUnique = jest.fn().mockResolvedValueOnce(mockUser);
      comparePassword.mockResolvedValue(true);
      prisma.profile.findUnique = jest.fn().mockResolvedValueOnce(null);
      generateToken.mockReturnValue('mock_jwt_token');
      generateRefreshToken.mockReturnValue('mock_refresh_token');
      hashRefreshToken.mockReturnValue('hashed_refresh_token');
      prisma.refreshToken.create.mockResolvedValue({
        id: 'refresh-token-1',
        user_id: 'user-1',
        token: 'hashed_refresh_token',
        expires_at: new Date(),
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      // profileComplete should be false when profile is null
      expect(response.body.profileComplete).toBe(false);
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should return 401 for invalid email', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'Test123!@#',
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should return 401 for invalid password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        full_name: 'Test User',
        password_hash: 'hashed_password',
      };

      prisma.user.findUnique = jest.fn().mockResolvedValueOnce(mockUser);
      comparePassword.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!@#',
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'Test123!@#',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should return 500 on database error', async () => {
      prisma.user.findUnique.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#',
        })
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('POST /api/auth/verify', () => {
    it('should verify token and return user with complete profile', async () => {
      const mockUser = global.mockUser;
      const mockProfile = global.mockProfile;

      // Auth middleware is already mocked in the route setup
      prisma.profile.findUnique = jest.fn().mockResolvedValueOnce(mockProfile);

      const response = await request(app)
        .post('/api/auth/verify')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.profileComplete).toBe(true);
      expect(response.body.profile).toBeDefined();
    });

    it('should verify token and return user with incomplete profile', async () => {
      // Auth middleware is already mocked in the route setup
      prisma.profile.findUnique = jest.fn().mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/auth/verify')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body.profileComplete).toBe(false);
      expect(response.body.profile).toBeNull();
    });
  });

  describe('POST /api/auth/refresh', () => {
    const mockRefreshToken = 'mock_refresh_token';
    const mockUserId = 'user-1';
    const mockUser = {
      id: mockUserId,
      email: 'test@example.com',
      is_suspended: false,
    };

    beforeEach(() => {
      // Reset mocks
      verifyToken.mockClear();
      generateToken.mockClear();
      hashRefreshToken.mockClear();
      prisma.refreshToken.findFirst.mockClear();
      prisma.refreshToken.delete.mockClear();
      prisma.user.findUnique.mockClear();
    });

    it('should refresh token successfully', async () => {
      const decodedToken = { id: mockUserId };
      const hashedToken = 'hashed_mock_refresh_token';
      const storedToken = {
        id: 'token-1',
        user_id: mockUserId,
        token: hashedToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      };
      const newAccessToken = 'new_access_token';

      verifyToken.mockReturnValue(decodedToken);
      hashRefreshToken.mockReturnValue(hashedToken);
      prisma.refreshToken.findFirst.mockResolvedValueOnce(storedToken);
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      generateToken.mockReturnValue(newAccessToken);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: mockRefreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body.token).toBe(newAccessToken);
      expect(verifyToken).toHaveBeenCalledWith(mockRefreshToken);
      expect(hashRefreshToken).toHaveBeenCalledWith(mockRefreshToken);
      expect(prisma.refreshToken.findFirst).toHaveBeenCalledWith({
        where: {
          user_id: mockUserId,
          token: hashedToken,
        },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
        select: {
          id: true,
          email: true,
          is_suspended: true,
        },
      });
      expect(generateToken).toHaveBeenCalledWith({
        id: mockUserId,
        email: mockUser.email,
      });
    });

    it('should return 401 for invalid refresh token JWT', async () => {
      verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid_token' })
        .expect(401);

      expect(response.body.error).toBe('Invalid or expired refresh token');
      expect(prisma.refreshToken.findFirst).not.toHaveBeenCalled();
    });

    it('should return 401 if refresh token not found in database', async () => {
      const decodedToken = { id: mockUserId };
      const hashedToken = 'hashed_mock_refresh_token';

      verifyToken.mockReturnValue(decodedToken);
      hashRefreshToken.mockReturnValue(hashedToken);
      prisma.refreshToken.findFirst.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: mockRefreshToken })
        .expect(401);

      expect(response.body.error).toBe('Refresh token not found');
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return 401 and delete token if refresh token expired', async () => {
      const decodedToken = { id: mockUserId };
      const hashedToken = 'hashed_mock_refresh_token';
      const expiredToken = {
        id: 'token-1',
        user_id: mockUserId,
        token: hashedToken,
        expires_at: new Date(Date.now() - 1000), // Expired
      };

      verifyToken.mockReturnValue(decodedToken);
      hashRefreshToken.mockReturnValue(hashedToken);
      prisma.refreshToken.findFirst.mockResolvedValueOnce(expiredToken);
      prisma.refreshToken.delete.mockResolvedValueOnce({ id: expiredToken.id });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: mockRefreshToken })
        .expect(401);

      expect(response.body.error).toBe('Refresh token expired');
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: expiredToken.id },
      });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return 401 and delete token if user not found', async () => {
      const decodedToken = { id: mockUserId };
      const hashedToken = 'hashed_mock_refresh_token';
      const storedToken = {
        id: 'token-1',
        user_id: mockUserId,
        token: hashedToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      verifyToken.mockReturnValue(decodedToken);
      hashRefreshToken.mockReturnValue(hashedToken);
      prisma.refreshToken.findFirst.mockResolvedValueOnce(storedToken);
      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.refreshToken.delete.mockResolvedValueOnce({ id: storedToken.id });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: mockRefreshToken })
        .expect(401);

      expect(response.body.error).toBe('User not found');
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: storedToken.id },
      });
    });

    it('should return 403 if user is suspended', async () => {
      const decodedToken = { id: mockUserId };
      const hashedToken = 'hashed_mock_refresh_token';
      const storedToken = {
        id: 'token-1',
        user_id: mockUserId,
        token: hashedToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      const suspendedUser = {
        ...mockUser,
        is_suspended: true,
      };

      verifyToken.mockReturnValue(decodedToken);
      hashRefreshToken.mockReturnValue(hashedToken);
      prisma.refreshToken.findFirst.mockResolvedValueOnce(storedToken);
      prisma.user.findUnique.mockResolvedValueOnce(suspendedUser);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: mockRefreshToken })
        .expect(403);

      expect(response.body.error).toBe('User account is suspended');
      expect(generateToken).not.toHaveBeenCalled();
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation error');
      expect(verifyToken).not.toHaveBeenCalled();
    });

    it('should return 400 for empty refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: '' })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
      expect(verifyToken).not.toHaveBeenCalled();
    });

    it('should return 500 on database error', async () => {
      const decodedToken = { id: mockUserId };

      verifyToken.mockReturnValue(decodedToken);
      hashRefreshToken.mockReturnValue('hashed_token');
      prisma.refreshToken.findFirst.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: mockRefreshToken })
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
    });
  });
});

