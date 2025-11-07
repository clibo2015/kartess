# Socket.io Integration Tests

This directory contains integration tests for Socket.io real-time functionality.

## Overview

Unlike unit tests that use mocks, these integration tests create **real Socket.io connections** to verify end-to-end functionality. This ensures that the real-time features work correctly in actual scenarios.

## Running the Tests

### Prerequisites

1. Ensure your database is running and accessible via `DATABASE_URL` in `.env`
2. Install dependencies: `npm install`

### Run Integration Tests

```bash
# Run all integration tests
npm test -- tests/integration/socket.test.js

# Run with coverage
npm test -- --coverage tests/integration/socket.test.js

# Run in watch mode
npm test -- --watch tests/integration/socket.test.js
```

## Test Coverage

The integration tests cover:

### 1. Connection and Authentication
- ✅ Authenticated socket connections
- ✅ Unauthenticated socket connections
- ✅ Auto-joining user rooms on authenticated connection

### 2. Posts Subscription
- ✅ Subscribing to posts channel
- ✅ Receiving new post events
- ✅ Unsubscribing from posts channel

### 3. Thread Messaging
- ✅ Joining thread rooms
- ✅ Receiving new messages in threads
- ✅ Typing indicators (with authentication checks)
- ✅ Leaving thread rooms

### 4. Notifications
- ✅ Receiving notifications in user rooms
- ✅ Authorization checks (can't join other user's room)
- ✅ Joining own user room

### 5. Real-time Events
- ✅ Reaction updates
- ✅ Comment events
- ✅ Read receipts

### 6. Disconnection
- ✅ Proper socket disconnection handling

## Test Structure

The tests:
1. Create a real HTTP server with Socket.io
2. Set up test users in the database
3. Create real socket client connections
4. Test actual event emission and reception
5. Clean up test data after completion

## Important Notes

- **Database Required**: These tests require a real database connection (not mocked)
- **Test Isolation**: Each test run creates new test users with unique timestamps
- **Cleanup**: Test users are automatically deleted after tests complete
- **Port**: Tests use dynamic port allocation (port 0) to avoid conflicts

## Troubleshooting

### Tests Fail with Database Connection Error
- Check that `DATABASE_URL` is correctly set in `.env`
- Ensure the database is accessible
- Verify Prisma client is generated: `npx prisma generate`

### Tests Timeout
- Increase timeout in Jest configuration if needed
- Check that the Socket.io server starts correctly
- Verify network connectivity

### Port Already in Use
- Tests use dynamic ports (0), so this should not occur
- If it does, ensure no other servers are running on the test ports

## Adding New Tests

When adding new real-time features:

1. Add the Socket.io event handler to `backend/app.js`
2. Add corresponding integration tests in `socket.test.js`
3. Ensure tests cover both success and failure scenarios
4. Include authentication checks where applicable

Example:
```javascript
test('should handle new feature event', (done) => {
  clientSocket1.once('feature.new', (data) => {
    expect(data).toHaveProperty('requiredField');
    done();
  });

  io.to('channel').emit('feature.new', {
    requiredField: 'value',
  });
});
```
