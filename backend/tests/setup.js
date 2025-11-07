// Test setup file
require('dotenv').config({ path: '.env.test' });

// Set required environment variables for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_only';

// Mock Prisma client
jest.mock('../prisma/client', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    post: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    contact: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    chatThread: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    messageRead: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    reaction: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    comment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    thread: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    job: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    application: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    qrToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    story: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    callSession: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    pollOption: {
      createMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    pollVote: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    bookmark: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    storyHighlight: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    report: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  return mockPrisma;
});

// Mock Cloudinary
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn((callback) => {
        callback(null, {
          url: 'https://res.cloudinary.com/test/image/upload/test.jpg',
          public_id: 'test',
        });
      }),
      upload: jest.fn(() => ({
        url: 'https://res.cloudinary.com/test/image/upload/test.jpg',
        public_id: 'test',
      })),
    },
  },
}));

// Mock abuse detection middleware to bypass rate limiting in tests
jest.mock('../middleware/abuseDetection', () => ({
  createAbuseGuard: () => (req, res, next) => next(),
}));

// Mock captcha middleware to bypass verification in tests
jest.mock('../middleware/captcha', () => ({
  captchaGuard: () => (req, res, next) => next(),
  isCaptchaEnabled: () => false,
  verifyCaptchaToken: jest.fn().mockResolvedValue({ enabled: false, success: true }),
}));

// Mock Socket.io
jest.mock('socket.io', () => {
  return jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    to: jest.fn(() => ({
      emit: jest.fn(),
    })),
  }));
});

// Global test utilities
global.mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
  full_name: 'Test User',
  password_hash: '$2b$10$hashed',
};

global.mockProfile = {
  user_id: 'user-1',
  bio: 'Test bio',
  company: 'Test Company',
  position: 'Test Position',
  phone: '1234567890',
  education: 'Test Education',
  avatar_url: 'https://example.com/avatar.jpg',
  handles: {
    connect: '@testuser.connect',
    visuals: '@testuser.visuals',
    threads: '@testuser.threads',
    careernet: '@testuser.careernet',
  },
  visibility_presets: {},
};

global.mockPost = {
  id: 'post-1',
  user_id: 'user-1',
  content: 'Test post content',
  module: 'connect',
  visibility: 'public',
  created_at: new Date(),
  media_urls: [],
  is_story: false,
  is_reel: false,
  is_poll: false,
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

