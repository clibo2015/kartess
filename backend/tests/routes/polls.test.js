const request = require('supertest');
const express = require('express');
const pollsRoutes = require('../../routes/polls');
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
app.use('/api/polls', pollsRoutes);

describe('Polls Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/polls', () => {
    it('should create poll successfully', async () => {
      const mockPost = {
        id: 'post-1',
        user_id: global.mockUser.id,
        is_poll: true,
      };

      prisma.post.findUnique = jest.fn().mockResolvedValue(mockPost);
      prisma.pollOption.create = jest.fn()
        .mockResolvedValueOnce({ id: 'option-1', option_text: 'Option 1', post_id: 'post-1' })
        .mockResolvedValueOnce({ id: 'option-2', option_text: 'Option 2', post_id: 'post-1' });
      prisma.post.update = jest.fn().mockResolvedValue({ id: 'post-1', is_poll: true });

      const response = await request(app)
        .post('/api/polls')
        .set('Authorization', 'Bearer mock_token')
        .send({
          post_id: 'post-1',
          options: ['Option 1', 'Option 2'],
        })
        .expect(201);

      expect(response.body).toHaveProperty('pollOptions');
      expect(Array.isArray(response.body.pollOptions)).toBe(true);
    });

    it('should return 400 if post not found', async () => {
      prisma.post.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/polls')
        .set('Authorization', 'Bearer mock_token')
        .send({
          post_id: 'non-existent',
          options: ['Option 1', 'Option 2'],
        })
        .expect(404);

      expect(response.body.error).toBe('Post not found');
    });

    it('should return 400 if options are less than 2', async () => {
      const response = await request(app)
        .post('/api/polls')
        .set('Authorization', 'Bearer mock_token')
        .send({
          post_id: 'post-1',
          options: ['Option 1'],
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
      expect(response.body.details).toBeDefined();
    });
  });

  describe('GET /api/polls/post/:postId', () => {
    it('should get poll by post ID', async () => {
      const mockPoll = {
        post_id: 'post-1',
        options: [
          { id: 'option-1', option_text: 'Option 1', vote_count: 5, votes: [] },
          { id: 'option-2', option_text: 'Option 2', vote_count: 3, votes: [] },
        ],
      };

      prisma.post.findUnique = jest.fn().mockResolvedValue({ id: 'post-1', is_poll: true });
      prisma.pollOption.findMany = jest.fn().mockResolvedValue(mockPoll.options.map(opt => ({
        ...opt,
        _count: { votes: opt.vote_count },
      })));
      prisma.pollVote.findUnique = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/polls/post/post-1')
        .expect(200);

      expect(response.body).toHaveProperty('options');
      expect(response.body).toHaveProperty('totalVotes');
    });
  });

  describe('POST /api/polls/vote', () => {
    it('should vote on poll successfully', async () => {
      const mockOption = {
        id: 'option-1',
        post_id: 'post-1',
        option_text: 'Option 1',
        vote_count: 0,
      };

      prisma.pollVote.findUnique = jest.fn().mockResolvedValue(null);
      prisma.pollOption.findUnique = jest.fn().mockResolvedValue(mockOption);
      prisma.pollVote.create = jest.fn().mockResolvedValue({
        id: 'vote-1',
        post_id: 'post-1',
        option_id: 'option-1',
        user_id: global.mockUser.id,
      });
      prisma.pollOption.update = jest.fn().mockResolvedValue({
        ...mockOption,
        vote_count: 1,
      });

      const response = await request(app)
        .post('/api/polls/vote')
        .set('Authorization', 'Bearer mock_token')
        .send({ post_id: 'post-1', option_id: 'option-1' })
        .expect(201);

      expect(response.body).toHaveProperty('vote');
      expect(mockIo.to).toHaveBeenCalledWith('post:post-1');
    });

    it('should return 400 if user already voted', async () => {
      prisma.pollVote.findUnique = jest.fn().mockResolvedValue({
        id: 'vote-1',
        user_id: global.mockUser.id,
        post_id: 'post-1',
      });

      const response = await request(app)
        .post('/api/polls/vote')
        .set('Authorization', 'Bearer mock_token')
        .send({ post_id: 'post-1', option_id: 'option-1' })
        .expect(400);

      expect(response.body.error).toBe('Already voted on this poll');
    });
  });
});

