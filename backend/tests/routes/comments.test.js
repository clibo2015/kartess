const request = require('supertest');
const express = require('express');
const commentsRoutes = require('../../routes/comments');
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
app.use('/api/comments', commentsRoutes);

describe('Comments Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/comments', () => {
    it('should create a comment successfully', async () => {
      const mockComment = {
        id: 'comment-1',
        post_id: 'post-1',
        user_id: global.mockUser.id,
        content: 'Test comment',
        parent_id: null,
        user: {
          id: global.mockUser.id,
          username: global.mockUser.username,
          full_name: global.mockUser.full_name,
          profile: { avatar_url: null },
        },
        parent: null,
        _count: { replies: 0 },
      };

      prisma.comment.create.mockResolvedValue(mockComment);
      prisma.post.findUnique.mockResolvedValue({ user_id: 'other-user' });
      prisma.notification.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', 'Bearer mock_token')
        .send({ post_id: 'post-1', content: 'Test comment' })
        .expect(201);

      expect(response.body.id).toBe('comment-1');
      expect(mockIo.to).toHaveBeenCalledWith('posts');
      expect(mockIo.emit).toHaveBeenCalled();
    });

    it('should create nested comment', async () => {
      const parentComment = {
        id: 'comment-1',
        parent_id: null,
        parent: null,
      };

      const mockComment = {
        id: 'comment-2',
        post_id: 'post-1',
        user_id: global.mockUser.id,
        content: 'Reply comment',
        parent_id: 'comment-1',
        user: {
          id: global.mockUser.id,
          username: global.mockUser.username,
          full_name: global.mockUser.full_name,
          profile: { avatar_url: null },
        },
        parent: parentComment,
        _count: { replies: 0 },
      };

      prisma.comment.findUnique = jest.fn().mockResolvedValue(parentComment);
      prisma.comment.create.mockResolvedValue(mockComment);
      prisma.post.findUnique.mockResolvedValue({ user_id: 'other-user' });
      prisma.notification.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', 'Bearer mock_token')
        .send({ post_id: 'post-1', content: 'Reply comment', parent_id: 'comment-1' })
        .expect(201);

      expect(response.body.parent_id).toBe('comment-1');
    });

    it('should return 400 for maximum nesting level', async () => {
      const deeplyNestedComment = {
        id: 'comment-3',
        parent_id: 'comment-2',
        parent: {
          id: 'comment-2',
          parent_id: 'comment-1',
          parent: {
            id: 'comment-1',
            parent_id: null,
            parent: null,
          },
        },
      };

      prisma.comment.findUnique = jest.fn().mockResolvedValue(deeplyNestedComment);

      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', 'Bearer mock_token')
        .send({ post_id: 'post-1', content: 'Reply', parent_id: 'comment-3' })
        .expect(400);

      expect(response.body.error).toBe('Maximum nesting level reached');
    });

    it('should return 400 if content is missing', async () => {
      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', 'Bearer mock_token')
        .send({ post_id: 'post-1' })
        .expect(400);

      expect(response.body.error).toBe('Post ID and content are required');
    });
  });

  describe('GET /api/comments/post/:postId', () => {
    it('should get comments for a post', async () => {
      const mockComments = [
        {
          id: 'comment-1',
          post_id: 'post-1',
          parent_id: null,
          content: 'Top level comment',
          user: {
            id: 'user-1',
            username: 'user1',
            full_name: 'User 1',
            profile: { avatar_url: null },
          },
          replies: [],
        },
      ];

      prisma.comment.findMany.mockResolvedValue(mockComments);

      const response = await request(app)
        .get('/api/comments/post/post-1')
        .expect(200);

      expect(response.body).toHaveProperty('comments');
      expect(Array.isArray(response.body.comments)).toBe(true);
    });
  });

  describe('DELETE /api/comments/:commentId', () => {
    it('should delete comment successfully', async () => {
      const mockComment = {
        id: 'comment-1',
        post_id: 'post-1',
        user_id: global.mockUser.id,
      };

      prisma.comment.findUnique = jest.fn().mockResolvedValue(mockComment);
      prisma.comment.delete = jest.fn().mockResolvedValue(mockComment);

      const response = await request(app)
        .delete('/api/comments/comment-1')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body.message).toBe('Comment deleted');
    });

    it('should return 403 if user does not own comment', async () => {
      const mockComment = {
        id: 'comment-1',
        post_id: 'post-1',
        user_id: 'other-user-id',
      };

      prisma.comment.findUnique = jest.fn().mockResolvedValue(mockComment);

      const response = await request(app)
        .delete('/api/comments/comment-1')
        .set('Authorization', 'Bearer mock_token')
        .expect(403);

      expect(response.body.error).toBe('Not authorized');
    });
  });
});

