const { PrismaClient } = require('@prisma/client');

// Singleton Prisma client with connection pooling for Neon
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

module.exports = prisma;
