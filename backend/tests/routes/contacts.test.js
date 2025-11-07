const request = require('supertest');
const express = require('express');
const contactsRoutes = require('../../routes/contacts');
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
app.use('/api/contacts', contactsRoutes);

describe('Contacts Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/contacts/follow', () => {
    it('should send follow request successfully', async () => {
      prisma.contact.findFirst = jest.fn().mockResolvedValue(null);
      // Mock sender profile with visibility_presets
      prisma.profile.findUnique = jest.fn().mockImplementation((args) => {
        if (args.where.user_id === global.mockUser.id) {
          // Return sender profile
          return Promise.resolve({
            user_id: global.mockUser.id,
            visibility_presets: {
              personal: { email: true, phone: true },
              professional: { email: true, company: true },
            },
            user: {
              id: global.mockUser.id,
              email: global.mockUser.email,
              full_name: global.mockUser.full_name,
              username: global.mockUser.username,
            },
          });
        }
        return Promise.resolve(null);
      });
      prisma.contact.upsert = jest.fn().mockResolvedValue({
        id: 'contact-1',
        sender_id: global.mockUser.id,
        receiver_id: 'user-2',
        status: 'pending',
      });
      prisma.user.findUnique = jest.fn().mockResolvedValue({ username: 'user2', full_name: 'User 2' });
      prisma.notification.create = jest.fn().mockResolvedValue({});

      const response = await request(app)
        .post('/api/contacts/follow')
        .set('Authorization', 'Bearer mock_token')
        .send({ receiver_id: 'user-2' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Follow request sent');
    });

    it('should return 400 if trying to follow self', async () => {
      const response = await request(app)
        .post('/api/contacts/follow')
        .set('Authorization', 'Bearer mock_token')
        .send({ receiver_id: global.mockUser.id })
        .expect(400);

      expect(response.body.error).toBe('Cannot follow yourself');
    });

    it('should return 400 if already following', async () => {
      prisma.contact.findFirst.mockResolvedValue({
        id: 'contact-1',
        status: 'approved',
      });

      const response = await request(app)
        .post('/api/contacts/follow')
        .set('Authorization', 'Bearer mock_token')
        .send({ receiver_id: 'user-2' })
        .expect(400);

      expect(response.body.error).toBe('Already following this user');
    });
  });

  describe('POST /api/contacts/approve', () => {
    it('should approve follow request successfully', async () => {
      const mockContact = {
        id: 'contact-1',
        sender_id: 'user-2',
        receiver_id: global.mockUser.id,
        status: 'pending',
      };

      prisma.contact.findUnique.mockResolvedValue(mockContact);
      // Mock receiver profile (current user) with visibility_presets
      prisma.profile.findUnique.mockImplementation((args) => {
        if (args.where.user_id === global.mockUser.id) {
          return Promise.resolve({
            user_id: global.mockUser.id,
            visibility_presets: {
              personal: { email: true, phone: true },
              professional: { email: true, company: true },
            },
            user: {
              id: global.mockUser.id,
              email: global.mockUser.email,
              full_name: global.mockUser.full_name,
              username: global.mockUser.username,
            },
          });
        }
        return Promise.resolve(null);
      });
      prisma.contact.deleteMany = jest.fn().mockResolvedValue({ count: 1 });
      prisma.contact.update.mockResolvedValue({
        ...mockContact,
        status: 'approved',
        sender: {
          id: 'user-2',
          username: 'user2',
          full_name: 'User 2',
          profile: { avatar_url: null },
        },
      });
      prisma.notification.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/contacts/approve')
        .set('Authorization', 'Bearer mock_token')
        .send({ contact_id: 'contact-1', preset_name: 'personal' })
        .expect(200);

      expect(response.body.message).toBe('Follow request approved');
      expect(prisma.contact.update).toHaveBeenCalled();
      expect(prisma.contact.deleteMany).toHaveBeenCalled();
    });

    it('should return 404 for non-existent contact', async () => {
      prisma.contact.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/contacts/approve')
        .set('Authorization', 'Bearer mock_token')
        .send({ contact_id: 'non-existent' })
        .expect(404);

      expect(response.body.error).toBe('Contact request not found');
    });
  });

  describe('GET /api/contacts', () => {
    it('should get approved contacts', async () => {
      const mockContacts = [
        {
          id: 'contact-1',
          sender_id: global.mockUser.id,
          receiver_id: 'user-2',
          status: 'approved',
          sender: {
            id: global.mockUser.id,
            username: global.mockUser.username,
            full_name: global.mockUser.full_name,
            profile: { avatar_url: null, bio: null },
          },
          receiver: {
            id: 'user-2',
            username: 'user2',
            full_name: 'User 2',
            profile: { avatar_url: null, bio: null },
          },
          created_at: new Date(),
        },
      ];

      prisma.contact.findMany.mockResolvedValue(mockContacts);

      const response = await request(app)
        .get('/api/contacts')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body).toHaveProperty('contacts');
      expect(Array.isArray(response.body.contacts)).toBe(true);
    });
  });

  describe('GET /api/contacts/pending', () => {
    it('should get pending follow requests', async () => {
      const mockPending = [
        {
          id: 'contact-1',
          sender_id: 'user-2',
          receiver_id: global.mockUser.id,
          status: 'pending',
          created_at: new Date(),
          sender: {
            id: 'user-2',
            username: 'user2',
            full_name: 'User 2',
            profile: { avatar_url: null, bio: null },
          },
        },
      ];

      prisma.contact.findMany.mockResolvedValue(mockPending);

      const response = await request(app)
        .get('/api/contacts/pending')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body).toHaveProperty('pending');
      expect(Array.isArray(response.body.pending)).toBe(true);
    });
  });
});

