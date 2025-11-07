const request = require('supertest');
const express = require('express');
const reactionsRoutes = require('../../routes/reactions');
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
app.use('/api/reactions', reactionsRoutes);

describe('Reactions Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/reactions', () => {
    it('should create a new reaction', async () => {
      const mockReaction = {
        id: 'reaction-1',
        post_id: 'post-1',
        user_id: global.mockUser.id,
        type: 'like',
        user: {
          id: global.mockUser.id,
          username: global.mockUser.username,
          full_name: global.mockUser.full_name,
        },
      };

      prisma.reaction.findFirst.mockResolvedValue(null);
      prisma.reaction.create.mockResolvedValue(mockReaction);

      const response = await request(app)
        .post('/api/reactions')
        .set('Authorization', 'Bearer mock_token')
        .send({ post_id: 'post-1', type: 'like' })
        .expect(200);

      expect(response.body.id).toBe('reaction-1');
      expect(mockIo.to).toHaveBeenCalledWith('posts');
      expect(mockIo.emit).toHaveBeenCalled();
    });

    it('should toggle off reaction if same type exists', async () => {
      const existingReaction = {
        id: 'reaction-1',
        post_id: 'post-1',
        user_id: global.mockUser.id,
        type: 'like',
      };

      prisma.reaction.findFirst.mockResolvedValue(existingReaction);
      prisma.reaction.delete.mockResolvedValue(existingReaction);

      const response = await request(app)
        .post('/api/reactions')
        .set('Authorization', 'Bearer mock_token')
        .send({ post_id: 'post-1', type: 'like' })
        .expect(200);

      expect(response.body.message).toBe('Reaction removed');
      expect(response.body.reaction).toBeNull();
    });

    it('should update reaction if different type exists', async () => {
      const existingReaction = {
        id: 'reaction-1',
        post_id: 'post-1',
        user_id: global.mockUser.id,
        type: 'like',
      };

      const updatedReaction = {
        ...existingReaction,
        type: 'love',
        user: {
          id: global.mockUser.id,
          username: global.mockUser.username,
          full_name: global.mockUser.full_name,
        },
      };

      prisma.reaction.findFirst = jest.fn().mockResolvedValue(existingReaction);
      prisma.reaction.update = jest.fn().mockResolvedValue(updatedReaction);

      const response = await request(app)
        .post('/api/reactions')
        .set('Authorization', 'Bearer mock_token')
        .send({ post_id: 'post-1', type: 'love' })
        .expect(200);

      expect(response.body.type).toBe('love');
    });

    it('should return 400 for invalid reaction type', async () => {
      const response = await request(app)
        .post('/api/reactions')
        .set('Authorization', 'Bearer mock_token')
        .send({ post_id: 'post-1', type: 'invalid' })
        .expect(400);

      expect(response.body.error).toBe('Invalid reaction type');
    });
  });

  describe('GET /api/reactions/post/:postId', () => {
    it('should get reactions for a post', async () => {
      const mockReactions = [
        {
          id: 'reaction-1',
          post_id: 'post-1',
          type: 'like',
          user: {
            id: 'user-1',
            username: 'user1',
            full_name: 'User 1',
            profile: { avatar_url: null },
          },
        },
        {
          id: 'reaction-2',
          post_id: 'post-1',
          type: 'love',
          user: {
            id: 'user-2',
            username: 'user2',
            full_name: 'User 2',
            profile: { avatar_url: null },
          },
        },
      ];

      prisma.reaction.findMany = jest.fn().mockResolvedValue(mockReactions);

      const response = await request(app)
        .get('/api/reactions/post/post-1')
        .expect(200);

      expect(response.body).toHaveProperty('reactions');
      expect(response.body).toHaveProperty('total');
      expect(response.body.total).toBe(2);
    });
  });

  describe('DELETE /api/reactions/:reactionId', () => {
    it('should delete reaction successfully', async () => {
      const mockReaction = {
        id: 'reaction-1',
        post_id: 'post-1',
        user_id: global.mockUser.id,
        type: 'like',
      };

      prisma.reaction.findUnique = jest.fn().mockResolvedValue(mockReaction);
      prisma.reaction.delete = jest.fn().mockResolvedValue(mockReaction);

      const response = await request(app)
        .delete('/api/reactions/reaction-1')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body.message).toBe('Reaction deleted');
    });

    it('should return 404 for non-existent reaction', async () => {
      prisma.reaction.findUnique = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/reactions/non-existent')
        .set('Authorization', 'Bearer mock_token')
        .expect(404);

      expect(response.body.error).toBe('Reaction not found');
    });

    it('should return 403 if user does not own reaction', async () => {
      const mockReaction = {
        id: 'reaction-1',
        post_id: 'post-1',
        user_id: 'other-user-id',
        type: 'like',
      };

      prisma.reaction.findUnique = jest.fn().mockResolvedValue(mockReaction);

      const response = await request(app)
        .delete('/api/reactions/reaction-1')
        .set('Authorization', 'Bearer mock_token')
        .expect(403);

      expect(response.body.error).toBe('Not authorized');
    });
  });
});

