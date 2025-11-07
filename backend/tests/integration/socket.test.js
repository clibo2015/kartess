/**
 * Socket.io Integration Tests
 * 
 * These tests verify real-time functionality with actual Socket.io connections.
 * Unlike unit tests that use mocks, these tests create real socket connections
 * to verify end-to-end functionality.
 */

// Unmock modules for integration tests (we need real implementations)
jest.unmock('../../prisma/client');
jest.unmock('socket.io');
jest.unmock('socket.io-client');

// Clear module cache to ensure fresh imports
delete require.cache[require.resolve('../../prisma/client')];
delete require.cache[require.resolve('socket.io')];
delete require.cache[require.resolve('socket.io-client')];

const { io: ioClient } = require('socket.io-client');
const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const { verifyToken } = require('../../utils/jwt');
const { generateToken } = require('../../utils/jwt');

// Import Prisma client AFTER clearing cache (will be used for real DB operations in tests)
const prisma = require('../../prisma/client');

describe('Socket.io Integration Tests', () => {
  // Increase timeout for integration tests (real DB + Socket.io connections)
  jest.setTimeout(30000); // 30 seconds

  let server;
  let io;
  let app;
  let httpServer;
  let clientSocket1;
  let clientSocket2;
  let user1Token;
  let user2Token;
  let testUser1;
  let testUser2;

  // Setup: Create test users and tokens before all tests
  beforeAll(async () => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Create HTTP server
    httpServer = http.createServer(app);

    // Initialize Socket.io server (simplified config for tests)
    io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      maxHttpBufferSize: 1e6,
      pingTimeout: 6000,
      pingInterval: 2500,
    });

    // Socket.io authentication middleware (same as app.js)
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token || 
                     socket.handshake.headers?.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(); // Allow unauthenticated connections
        }

        const decoded = verifyToken(token);
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
        });

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user.id;
        socket.user = user;
        next();
      } catch (error) {
        next(); // Allow connection without userId
      }
    });

    // Socket.io connection handling (same as app.js)
    io.on('connection', (socket) => {
      // Auto-join user room if authenticated
      if (socket.userId) {
        socket.join(`user:${socket.userId}`);
      }

      // Join posts channel
      socket.on('subscribe:posts', () => {
        socket.join('posts');
      });

      socket.on('unsubscribe:posts', () => {
        socket.leave('posts');
      });

      // Join thread
      socket.on('join:thread', (threadId) => {
        socket.join(`thread:${threadId}`);
      });

      socket.on('leave:thread', (threadId) => {
        socket.leave(`thread:${threadId}`);
      });

      // Typing indicator
      socket.on('thread:typing', (data) => {
        if (!socket.userId) return;
        
        const { thread_id, typing } = data;
        socket.to(`thread:${thread_id}`).emit('thread:typing', {
          user_id: socket.userId,
          typing,
        });
      });

      // Join user room
      socket.on('join:user', (userId) => {
        if (socket.userId && socket.userId === userId) {
          socket.join(`user:${userId}`);
        } else {
          socket.emit('error', { message: 'Unauthorized: Cannot join this user room' });
        }
      });
    });

    // Start server
    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        resolve();
      });
    });

    const port = httpServer.address().port;

    // Create test users in database
    testUser1 = await prisma.user.create({
      data: {
        email: `socket-test-user1-${Date.now()}@test.com`,
        username: `socket-test-user1-${Date.now()}`,
        password_hash: '$2b$10$hashed',
        full_name: 'Socket Test User 1',
      },
    });

    testUser2 = await prisma.user.create({
      data: {
        email: `socket-test-user2-${Date.now()}@test.com`,
        username: `socket-test-user2-${Date.now()}`,
        password_hash: '$2b$10$hashed',
        full_name: 'Socket Test User 2',
      },
    });

    // Generate tokens (generateToken expects an object with id property)
    user1Token = generateToken({ id: testUser1.id });
    user2Token = generateToken({ id: testUser2.id });

    // Create socket clients
    clientSocket1 = ioClient(`http://localhost:${port}`, {
      auth: { token: user1Token },
      transports: ['websocket'],
    });

    clientSocket2 = ioClient(`http://localhost:${port}`, {
      auth: { token: user2Token },
      transports: ['websocket'],
    });

    // Wait for connections with timeout
    await Promise.all([
      new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Socket1 connection timeout')), 5000);
        clientSocket1.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
        clientSocket1.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      }),
      new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Socket2 connection timeout')), 5000);
        clientSocket2.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
        clientSocket2.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      }),
    ]);

    // Small delay to ensure all setup is complete
    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  // Cleanup after all tests
  afterAll(async () => {
    // Disconnect clients
    if (clientSocket1) clientSocket1.disconnect();
    if (clientSocket2) clientSocket2.disconnect();

    // Close server
    if (io) io.close();
    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(() => resolve());
      });
    }

    // Clean up test users
    if (testUser1) {
      await prisma.user.delete({ where: { id: testUser1.id } }).catch(() => {});
    }
    if (testUser2) {
      await prisma.user.delete({ where: { id: testUser2.id } }).catch(() => {});
    }

    // Disconnect Prisma (if method exists)
    if (prisma && typeof prisma.$disconnect === 'function') {
      await prisma.$disconnect();
    }
  });

  describe('Connection and Authentication', () => {
    test('should connect authenticated socket successfully', (done) => {
      expect(clientSocket1.connected).toBe(true);
      expect(clientSocket2.connected).toBe(true);
      done();
    });

    test('should allow unauthenticated connections', (done) => {
      const unauthenticatedSocket = ioClient(`http://localhost:${httpServer.address().port}`, {
        transports: ['websocket'],
      });

      unauthenticatedSocket.on('connect', () => {
        expect(unauthenticatedSocket.connected).toBe(true);
        unauthenticatedSocket.disconnect();
        done();
      });
    });

    test('should auto-join user room on authenticated connection', (done) => {
      // Get socket rooms for user1
      const sockets = io.sockets.sockets;
      let userSocket = null;
      
      for (const [socketId, socket] of sockets) {
        if (socket.userId === testUser1.id) {
          userSocket = socket;
          break;
        }
      }

      expect(userSocket).not.toBeNull();
      expect(userSocket.rooms.has(`user:${testUser1.id}`)).toBe(true);
      done();
    });
  });

  describe('Posts Subscription', () => {
    test('should subscribe to posts channel', (done) => {
      clientSocket1.emit('subscribe:posts');

      setTimeout(() => {
        const sockets = io.sockets.sockets;
        let userSocket = null;
        
        for (const [socketId, socket] of sockets) {
          if (socket.userId === testUser1.id) {
            userSocket = socket;
            break;
          }
        }

        expect(userSocket.rooms.has('posts')).toBe(true);
        done();
      }, 100);
    });

    test('should receive new post event', (done) => {
      clientSocket2.once('post.new', (post) => {
        expect(post).toHaveProperty('id');
        expect(post).toHaveProperty('content');
        done();
      });

      clientSocket2.emit('subscribe:posts');

      setTimeout(() => {
        // Emit new post event to posts channel
        io.to('posts').emit('post.new', {
          id: 'test-post-1',
          content: 'Test post content',
          user_id: testUser1.id,
        });
      }, 100);
    });

    test('should unsubscribe from posts channel', (done) => {
      clientSocket1.emit('unsubscribe:posts');

      setTimeout(() => {
        const sockets = io.sockets.sockets;
        let userSocket = null;
        
        for (const [socketId, socket] of sockets) {
          if (socket.userId === testUser1.id) {
            userSocket = socket;
            break;
          }
        }

        expect(userSocket.rooms.has('posts')).toBe(false);
        done();
      }, 100);
    });
  });

  describe('Thread Messaging', () => {
    const testThreadId = 'test-thread-123';

    test('should join thread room', (done) => {
      clientSocket1.emit('join:thread', testThreadId);

      setTimeout(() => {
        const sockets = io.sockets.sockets;
        let userSocket = null;
        
        for (const [socketId, socket] of sockets) {
          if (socket.userId === testUser1.id) {
            userSocket = socket;
            break;
          }
        }

        expect(userSocket.rooms.has(`thread:${testThreadId}`)).toBe(true);
        done();
      }, 100);
    });

    test('should receive new message in thread', (done) => {
      // Both clients join thread
      clientSocket1.emit('join:thread', testThreadId);
      clientSocket2.emit('join:thread', testThreadId);

      setTimeout(() => {
        // Client2 listens for message
        clientSocket2.once('message.new', (message) => {
          expect(message).toHaveProperty('id');
          expect(message).toHaveProperty('content');
          expect(message).toHaveProperty('thread_id', testThreadId);
          done();
        });

        // Emit message to thread room
        io.to(`thread:${testThreadId}`).emit('message.new', {
          id: 'test-message-1',
          thread_id: testThreadId,
          content: 'Test message',
          user_id: testUser1.id,
        });
      }, 100);
    });

    test('should receive typing indicator', (done) => {
      clientSocket2.once('thread:typing', (data) => {
        expect(data).toHaveProperty('user_id', testUser1.id);
        expect(data).toHaveProperty('typing', true);
        done();
      });

      // User1 sends typing indicator
      clientSocket1.emit('thread:typing', {
        thread_id: testThreadId,
        typing: true,
      });
    });

    test('should not receive typing indicator from unauthenticated socket', (done) => {
      const unauthenticatedSocket = ioClient(`http://localhost:${httpServer.address().port}`, {
        transports: ['websocket'],
      });

      let receivedTyping = false;

      unauthenticatedSocket.on('connect', () => {
        unauthenticatedSocket.emit('join:thread', testThreadId);
        
        setTimeout(() => {
          clientSocket2.once('thread:typing', () => {
            receivedTyping = true;
          });

          // Unauthenticated socket tries to send typing indicator
          unauthenticatedSocket.emit('thread:typing', {
            thread_id: testThreadId,
            typing: true,
          });

          setTimeout(() => {
            expect(receivedTyping).toBe(false);
            unauthenticatedSocket.disconnect();
            done();
          }, 200);
        }, 100);
      });
    });

    test('should leave thread room', (done) => {
      clientSocket1.emit('leave:thread', testThreadId);

      setTimeout(() => {
        const sockets = io.sockets.sockets;
        let userSocket = null;
        
        for (const [socketId, socket] of sockets) {
          if (socket.userId === testUser1.id) {
            userSocket = socket;
            break;
          }
        }

        expect(userSocket.rooms.has(`thread:${testThreadId}`)).toBe(false);
        done();
      }, 100);
    });
  });

  describe('Notifications', () => {
    test('should receive notification in user room', (done) => {
      clientSocket1.once('notification.new', (notification) => {
        expect(notification).toHaveProperty('type');
        expect(notification).toHaveProperty('message');
        done();
      });

      // Emit notification to user1's room
      io.to(`user:${testUser1.id}`).emit('notification.new', {
        type: 'follow',
        title: 'New Follower',
        message: 'Someone followed you',
      });
    });

    test('should not allow joining other user\'s room', (done) => {
      clientSocket2.once('error', (error) => {
        expect(error.message).toContain('Unauthorized');
        done();
      });

      // User2 tries to join user1's room
      clientSocket2.emit('join:user', testUser1.id);
    });

    test('should allow joining own user room', (done) => {
      clientSocket1.emit('join:user', testUser1.id);

      setTimeout(() => {
        const sockets = io.sockets.sockets;
        let userSocket = null;
        
        for (const [socketId, socket] of sockets) {
          if (socket.userId === testUser1.id) {
            userSocket = socket;
            break;
          }
        }

        expect(userSocket.rooms.has(`user:${testUser1.id}`)).toBe(true);
        done();
      }, 100);
    });
  });

  describe('Real-time Events', () => {
    test('should receive reaction update', (done) => {
      clientSocket2.emit('subscribe:posts');

      setTimeout(() => {
        clientSocket2.once('reaction.update', (data) => {
          expect(data).toHaveProperty('post_id');
          expect(data).toHaveProperty('reaction');
          done();
        });

        io.to('posts').emit('reaction.update', {
          post_id: 'test-post-1',
          reaction: { type: 'like', user_id: testUser1.id },
        });
      }, 100);
    });

    test('should receive comment new event', (done) => {
      clientSocket2.emit('subscribe:posts');

      setTimeout(() => {
        clientSocket2.once('comment.new', (comment) => {
          expect(comment).toHaveProperty('id');
          expect(comment).toHaveProperty('content');
          expect(comment).toHaveProperty('post_id');
          done();
        });

        io.to('posts').emit('comment.new', {
          id: 'test-comment-1',
          post_id: 'test-post-1',
          content: 'Test comment',
          user_id: testUser1.id,
        });
      }, 100);
    });

    test('should receive read receipt', (done) => {
      const testThreadId = 'test-thread-read';
      clientSocket1.emit('join:thread', testThreadId);
      clientSocket2.emit('join:thread', testThreadId);

      setTimeout(() => {
        clientSocket2.once('message.read', (data) => {
          expect(data).toHaveProperty('message_id');
          expect(data).toHaveProperty('user_id', testUser1.id);
          done();
        });

        io.to(`thread:${testThreadId}`).emit('message.read', {
          message_id: 'test-message-1',
          user_id: testUser1.id,
        });
      }, 100);
    });
  });

  describe('Disconnection', () => {
    test('should handle socket disconnection', (done) => {
      const tempSocket = ioClient(`http://localhost:${httpServer.address().port}`, {
        auth: { token: user1Token },
        transports: ['websocket'],
      });

      tempSocket.on('connect', () => {
        expect(tempSocket.connected).toBe(true);
        
        tempSocket.on('disconnect', () => {
          expect(tempSocket.connected).toBe(false);
          done();
        });

        tempSocket.disconnect();
      });
    });
  });
});
