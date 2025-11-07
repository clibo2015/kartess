const request = require('supertest');
const express = require('express');
const chatsRoutes = require('../../routes/chats');
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
app.use('/api/chats', chatsRoutes);

describe('Chats Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/chats/threads', () => {
    it('should get user threads', async () => {
      const mockThreads = [
        {
          id: 'thread-1',
          type: '1:1',
          participants: [global.mockUser.id, 'user-2'],
          updated_at: new Date(),
        },
      ];

      prisma.chatThread.findMany = jest.fn().mockResolvedValue(mockThreads);
      prisma.message.findFirst = jest.fn().mockResolvedValue(null);
      prisma.user.findMany = jest.fn().mockResolvedValue([{ id: 'user-2', username: 'user2', full_name: 'User 2', profile: { avatar_url: null } }]);
      prisma.message.count = jest.fn().mockResolvedValue(0);

      const response = await request(app)
        .get('/api/chats/threads')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body).toHaveProperty('threads');
      expect(Array.isArray(response.body.threads)).toBe(true);
    });
  });

  describe('POST /api/chats/threads', () => {
    it('should create a new 1:1 thread', async () => {
      prisma.chatThread.findMany.mockResolvedValue([]);
      prisma.chatThread.create.mockResolvedValue({
        id: 'thread-1',
        type: '1:1',
        participants: [global.mockUser.id, 'user-2'],
        updated_at: new Date(),
      });
      prisma.user.findMany.mockResolvedValue([{ id: 'user-2', username: 'user2', full_name: 'User 2', profile: { avatar_url: null } }]);

      const response = await request(app)
        .post('/api/chats/threads')
        .set('Authorization', 'Bearer mock_token')
        .send({ type: '1:1', participant_ids: ['user-2'] })
        .expect(201);

      expect(response.body).toHaveProperty('thread');
      expect(response.body.thread.type).toBe('1:1');
    });

    it('should return existing 1:1 thread if it exists', async () => {
      const existingThread = {
        id: 'thread-1',
        type: '1:1',
        participants: [global.mockUser.id, 'user-2'],
        updated_at: new Date(),
      };

      prisma.chatThread.findMany.mockResolvedValue([existingThread]);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2', username: 'user2', full_name: 'User 2', profile: { avatar_url: null } });

      const response = await request(app)
        .post('/api/chats/threads')
        .set('Authorization', 'Bearer mock_token')
        .send({ type: '1:1', participant_ids: ['user-2'] })
        .expect(200);

      expect(response.body.thread.id).toBe('thread-1');
    });

    it('should return 400 for 1:1 with wrong participant count', async () => {
      const response = await request(app)
        .post('/api/chats/threads')
        .set('Authorization', 'Bearer mock_token')
        .send({ type: '1:1', participant_ids: ['user-2', 'user-3'] })
        .expect(400);

      expect(response.body.error).toBe('1:1 thread must have exactly 2 participants');
    });

    it('should create a group thread', async () => {
      prisma.chatThread.findMany.mockResolvedValue([]);
      prisma.chatThread.create.mockResolvedValue({
        id: 'thread-1',
        type: 'group',
        name: 'Test Group',
        participants: [global.mockUser.id, 'user-2', 'user-3'],
        updated_at: new Date(),
      });
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-2', username: 'user2', full_name: 'User 2', profile: { avatar_url: null } },
        { id: 'user-3', username: 'user3', full_name: 'User 3', profile: { avatar_url: null } },
      ]);

      const response = await request(app)
        .post('/api/chats/threads')
        .set('Authorization', 'Bearer mock_token')
        .send({ type: 'group', name: 'Test Group', participant_ids: ['user-2', 'user-3'] })
        .expect(201);

      expect(response.body.thread.type).toBe('group');
      expect(response.body.thread.name).toBe('Test Group');
    });
  });

  describe('GET /api/chats/threads/:threadId/messages', () => {
    it('should get messages for a thread', async () => {
      const mockThread = {
        id: 'thread-1',
        participants: [global.mockUser.id, 'user-2'],
      };

      const mockMessages = [
        {
          id: 'msg-1',
          thread_id: 'thread-1',
          user_id: 'user-2',
          content: 'Hello',
          created_at: new Date(),
          user: { id: 'user-2', username: 'user2', full_name: 'User 2', profile: { avatar_url: null } },
          reads: [],
        },
      ];

      prisma.chatThread.findUnique = jest.fn().mockResolvedValue(mockThread);
      prisma.message.findMany = jest.fn().mockResolvedValue(mockMessages);
      prisma.messageRead.createMany = jest.fn().mockResolvedValue({ count: 0 });

      const response = await request(app)
        .get('/api/chats/threads/thread-1/messages')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body).toHaveProperty('messages');
    });

    it('should return 404 for non-existent thread', async () => {
      prisma.chatThread.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/chats/threads/non-existent/messages')
        .set('Authorization', 'Bearer mock_token')
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
        .get('/api/chats/threads/thread-1/messages')
        .set('Authorization', 'Bearer mock_token')
        .expect(403);

      expect(response.body.error).toBe('Not authorized to view this thread');
    });
  });
});

