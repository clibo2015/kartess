const request = require('supertest');
const express = require('express');
const threadsRoutes = require('../../routes/threads');
const prisma = require('../../prisma/client');
const authMiddleware = require('../../middleware/auth');

jest.mock('../../prisma/client');
jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = global.mockUser;
  next();
});

const app = express();
app.use(express.json());
app.use('/api/threads', threadsRoutes);

describe('Threads Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/threads', () => {
    it('should create thread successfully', async () => {
      const mockThread = {
        id: 'thread-1',
        user_id: global.mockUser.id,
        title: 'Test Thread',
        content: 'Thread content',
        topic: 'general',
        created_at: new Date(),
        user: {
          id: global.mockUser.id,
          username: global.mockUser.username,
          full_name: global.mockUser.full_name,
          profile: { avatar_url: null },
        },
        _count: { replies: 0 },
      };

      prisma.thread.create.mockResolvedValue(mockThread);

      const response = await request(app)
        .post('/api/threads')
        .set('Authorization', 'Bearer mock_token')
        .send({
          title: 'Test Thread',
          content: 'Thread content',
          topic: 'general',
        })
        .expect(201);

      expect(response.body.id).toBe('thread-1');
    });

    it('should reject thread over 280 characters', async () => {
      const response = await request(app)
        .post('/api/threads')
        .set('Authorization', 'Bearer mock_token')
        .send({
          title: 'Test Thread',
          content: 'a'.repeat(281),
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('GET /api/threads', () => {
    it('should get threads with filters', async () => {
      const mockThreads = [
        {
          id: 'thread-1',
          title: 'Test Thread',
          content: 'Thread content',
          topic: 'general',
          created_at: new Date(),
          user: {
            id: 'user-1',
            username: 'user1',
            full_name: 'User 1',
            profile: { avatar_url: null },
          },
          _count: { replies: 0 },
        },
      ];

      prisma.thread.findMany.mockResolvedValue(mockThreads);

      const response = await request(app)
        .get('/api/threads?topic=general')
        .expect(200);

      expect(response.body).toHaveProperty('threads');
      expect(Array.isArray(response.body.threads)).toBe(true);
    });
  });
});

