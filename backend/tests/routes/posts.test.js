const request = require('supertest');
const express = require('express');
const postsRoutes = require('../../routes/posts');
const prisma = require('../../prisma/client');
const authMiddleware = require('../../middleware/auth');

jest.mock('../../prisma/client');
jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = global.mockUser;
  next();
});

// Mock Socket.io
const mockIo = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
};

const app = express();
app.use(express.json());
app.set('io', mockIo);
app.use('/api/posts', postsRoutes);

describe('Posts Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/posts', () => {
    it('should create a post successfully', async () => {
      const postData = {
        content: 'Test post content',
        module: 'connect',
        visibility: 'public',
      };

      const mockPost = {
        id: 'post-1',
        user_id: global.mockUser.id,
        ...postData,
        created_at: new Date(),
        media_urls: null,
        is_story: false,
        is_reel: false,
        is_poll: false,
        user: {
          id: global.mockUser.id,
          username: global.mockUser.username,
          full_name: global.mockUser.full_name,
          profile: { avatar_url: null },
        },
        _count: {
          reactions: 0,
          comments: 0,
        },
      };

      prisma.post.create.mockResolvedValue(mockPost);

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', 'Bearer mock_token')
        .send(postData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe(postData.content);
      expect(prisma.post.create).toHaveBeenCalled();
      expect(mockIo.to).toHaveBeenCalledWith('posts');
      expect(mockIo.emit).toHaveBeenCalledWith('post.new', mockPost);
    });

    it('should reject thread post over 280 characters', async () => {
      const postData = {
        content: 'a'.repeat(281),
        module: 'threads',
        visibility: 'public',
      };

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', 'Bearer mock_token')
        .send(postData)
        .expect(400);

      expect(response.body.error).toBe('Thread posts must be 280 characters or less');
    });

    it('should accept thread post with 280 characters', async () => {
      const postData = {
        content: 'a'.repeat(280),
        module: 'threads',
        visibility: 'public',
      };

      const mockPost = {
        id: 'post-1',
        ...postData,
        user_id: global.mockUser.id,
        created_at: new Date(),
        user: {
          id: global.mockUser.id,
          username: global.mockUser.username,
          full_name: global.mockUser.full_name,
          profile: { avatar_url: null },
        },
        _count: { reactions: 0, comments: 0 },
      };

      prisma.post.create.mockResolvedValue(mockPost);

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', 'Bearer mock_token')
        .send(postData)
        .expect(201);

      expect(response.body.id).toBe('post-1');
    });
  });

  describe('GET /api/posts/timeline', () => {
    it('should get timeline posts', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          content: 'Post 1',
          module: 'connect',
          visibility: 'public',
          user_id: 'user-1',
          created_at: new Date(),
          user: {
            id: 'user-1',
            username: 'user1',
            full_name: 'User 1',
            profile: { avatar_url: null },
          },
          reactions: [],
          _count: { reactions: 0, comments: 0 },
        },
      ];

      prisma.contact.findMany.mockResolvedValue([]);
      prisma.post.findMany.mockResolvedValue(mockPosts);

      const response = await request(app)
        .get('/api/posts/timeline')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body).toHaveProperty('posts');
      expect(response.body.posts).toHaveLength(1);
    });

    it('should filter by module', async () => {
      prisma.contact.findMany.mockResolvedValue([]);
      prisma.post.findMany.mockResolvedValue([]);

      await request(app)
        .get('/api/posts/timeline?module=connect')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(prisma.post.findMany).toHaveBeenCalled();
      const whereClause = prisma.post.findMany.mock.calls[0][0].where;
      expect(whereClause.AND).toBeDefined();
    });
  });

  describe('GET /api/posts/module/:module', () => {
    it('should get module-specific posts', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          content: 'Post 1',
          module: 'connect',
          user_id: 'user-1',
          created_at: new Date(),
          user: {
            id: 'user-1',
            username: 'user1',
            full_name: 'User 1',
            profile: { avatar_url: null },
          },
          reactions: [],
          _count: { reactions: 0, comments: 0 },
        },
      ];

      prisma.contact.findMany.mockResolvedValue([]);
      prisma.post.findMany.mockResolvedValue(mockPosts);

      const response = await request(app)
        .get('/api/posts/module/connect')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body).toHaveProperty('posts');
    });
  });

  describe('GET /api/posts/user/:userId', () => {
    it('should get user posts', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          content: 'Post 1',
          user_id: 'user-1',
          created_at: new Date(),
          user: {
            id: 'user-1',
            username: 'user1',
            full_name: 'User 1',
            profile: { avatar_url: null },
          },
          _count: { reactions: 0, comments: 0 },
        },
      ];

      prisma.post.findMany.mockResolvedValue(mockPosts);

      const response = await request(app)
        .get('/api/posts/user/user-1')
        .expect(200);

      expect(response.body).toHaveProperty('posts');
    });
  });

  describe('GET /api/posts/:postId', () => {
    it('should get a single post', async () => {
      const mockPost = {
        id: 'post-1',
        content: 'Test post',
        user_id: 'user-1',
        created_at: new Date(),
        user: {
          id: 'user-1',
          username: 'user1',
          full_name: 'User 1',
          profile: { avatar_url: null },
        },
        _count: { reactions: 0, comments: 0 },
      };

      prisma.post.findUnique.mockResolvedValue(mockPost);

      const response = await request(app)
        .get('/api/posts/post-1')
        .expect(200);

      expect(response.body.id).toBe('post-1');
    });

    it('should return 404 for non-existent post', async () => {
      prisma.post.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/posts/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Post not found');
    });
  });

  describe('POST /api/posts/:postId/repost', () => {
    it('should repost successfully', async () => {
      const originalPost = {
        id: 'post-1',
        content: 'Original post',
        module: 'connect',
        media_urls: [],
      };

      const repost = {
        id: 'post-2',
        content: 'Repost comment',
        module: 'connect',
        parent_id: 'post-1',
        user_id: global.mockUser.id,
        created_at: new Date(),
        user: {
          id: global.mockUser.id,
          username: global.mockUser.username,
          full_name: global.mockUser.full_name,
          profile: { avatar_url: null },
        },
        _count: { reactions: 0, comments: 0 },
      };

      prisma.post.findUnique.mockResolvedValueOnce(originalPost);
      prisma.post.create.mockResolvedValue(repost);

      const response = await request(app)
        .post('/api/posts/post-1/repost')
        .set('Authorization', 'Bearer mock_token')
        .send({ content: 'Repost comment', module: 'connect' })
        .expect(201);

      expect(response.body.id).toBe('post-2');
      expect(response.body.parent_id).toBe('post-1');
    });

    it('should return 404 for non-existent post when reposting', async () => {
      prisma.post.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/posts/non-existent/repost')
        .set('Authorization', 'Bearer mock_token')
        .send({ content: 'Repost comment' })
        .expect(404);

      expect(response.body.error).toBe('Post not found');
    });
  });
});

