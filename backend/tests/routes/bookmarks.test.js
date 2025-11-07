const request = require('supertest');
const express = require('express');
const bookmarksRoutes = require('../../routes/bookmarks');
const prisma = require('../../prisma/client');
const authMiddleware = require('../../middleware/auth');

jest.mock('../../prisma/client');
jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = global.mockUser;
  next();
});

const app = express();
app.use(express.json());
app.use('/api/bookmarks', bookmarksRoutes);

describe('Bookmarks Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/bookmarks', () => {
    it('should bookmark a post successfully', async () => {
      prisma.post.findUnique = jest.fn().mockResolvedValue({ id: 'post-1' });
      prisma.bookmark.findUnique = jest.fn().mockResolvedValue(null);
      prisma.bookmark.create = jest.fn().mockResolvedValue({
        id: 'bookmark-1',
        user_id: global.mockUser.id,
        post_id: 'post-1',
        post: {
          id: 'post-1',
          content: 'Test post',
          user: {
            id: 'user-1',
            username: 'user1',
            full_name: 'User 1',
          },
        },
      });

      const response = await request(app)
        .post('/api/bookmarks')
        .set('Authorization', 'Bearer mock_token')
        .send({ post_id: 'post-1' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.post_id).toBe('post-1');
    });

    it('should return 400 if post already bookmarked', async () => {
      prisma.post.findUnique = jest.fn().mockResolvedValue({ id: 'post-1' });
      prisma.bookmark.findUnique = jest.fn().mockResolvedValue({
        id: 'bookmark-1',
        user_id: global.mockUser.id,
        post_id: 'post-1',
      });

      const response = await request(app)
        .post('/api/bookmarks')
        .set('Authorization', 'Bearer mock_token')
        .send({ post_id: 'post-1' })
        .expect(400);

      expect(response.body.error).toBe('Post already bookmarked');
    });
  });

  describe('DELETE /api/bookmarks/:postId', () => {
    it('should remove bookmark successfully', async () => {
      prisma.bookmark.findFirst.mockResolvedValue({
        id: 'bookmark-1',
        user_id: global.mockUser.id,
        post_id: 'post-1',
      });
      prisma.bookmark.delete.mockResolvedValue({});

      const response = await request(app)
        .delete('/api/bookmarks/post-1')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body.message).toBe('Bookmark removed');
    });
  });

  describe('GET /api/bookmarks', () => {
    it('should get user bookmarks', async () => {
      const mockBookmarks = [
        {
          id: 'bookmark-1',
          user_id: global.mockUser.id,
          post_id: 'post-1',
          post: {
            id: 'post-1',
            content: 'Test post',
            user: {
              id: 'user-1',
              username: 'user1',
              full_name: 'User 1',
            },
          },
        },
      ];

      prisma.bookmark.findMany.mockResolvedValue(mockBookmarks);

      const response = await request(app)
        .get('/api/bookmarks')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body).toHaveProperty('bookmarks');
      expect(Array.isArray(response.body.bookmarks)).toBe(true);
    });
  });
});

