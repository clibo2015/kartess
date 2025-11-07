const request = require('supertest');
const express = require('express');
const messagesRoutes = require('../../routes/messages');
const prisma = require('../../prisma/client');
const authMiddleware = require('../../middleware/auth');

jest.mock('../../prisma/client');
jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = global.mockUser;
  next();
});

const mockIo = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
};

const app = express();
app.use(express.json());
app.set('io', mockIo);
app.use('/api/messages', messagesRoutes);

describe('Messages Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/messages', () => {
    it('should send a message successfully', async () => {
      const mockThread = {
        id: 'thread-1',
        participants: [global.mockUser.id, 'user-2'],
      };

      const mockMessage = {
        id: 'msg-1',
        thread_id: 'thread-1',
        user_id: global.mockUser.id,
        content: 'Hello',
        encrypted: true,
        created_at: new Date(),
        user: {
          id: global.mockUser.id,
          username: global.mockUser.username,
          full_name: global.mockUser.full_name,
          profile: { avatar_url: null },
        },
      };

      prisma.chatThread.findUnique.mockResolvedValue(mockThread);
      prisma.message.create.mockResolvedValue(mockMessage);
      prisma.chatThread.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2', username: 'user2', full_name: 'User 2' });
      prisma.notification.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', 'Bearer mock_token')
        .send({ thread_id: 'thread-1', content: 'Hello', encrypted: true })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe('Hello');
      expect(mockIo.to).toHaveBeenCalledWith('thread:thread-1');
      expect(mockIo.emit).toHaveBeenCalled();
    });

    it('should return 400 if thread_id is missing', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', 'Bearer mock_token')
        .send({ content: 'Hello' })
        .expect(400);

      expect(response.body.error).toBe('Thread ID and content are required');
    });

    it('should return 404 if thread not found', async () => {
      prisma.chatThread.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', 'Bearer mock_token')
        .send({ thread_id: 'non-existent', content: 'Hello' })
        .expect(404);

      expect(response.body.error).toBe('Thread not found');
    });

    it('should return 403 if user is not a participant', async () => {
      const mockThread = {
        id: 'thread-1',
        participants: ['user-2', 'user-3'],
      };

      prisma.chatThread.findUnique.mockResolvedValue(mockThread);

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', 'Bearer mock_token')
        .send({ thread_id: 'thread-1', content: 'Hello' })
        .expect(403);

      expect(response.body.error).toBe('Not authorized to send message in this thread');
    });
  });
});

