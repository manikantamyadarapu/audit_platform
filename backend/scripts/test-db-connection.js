require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const url = process.env.DATABASE_URL || '';
  const sanitized = url.replace(/:([^:@/]+)@/, ':***@');
  console.log('DATABASE_URL (sanitized):', sanitized);

  const result = await prisma.$queryRaw`SELECT 1 AS ok`;
  console.log('Connection OK:', result);

  const count = await prisma.user.count();
  console.log('User count:', count);
}

main()
  .catch((err) => {
    console.error('Connection FAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
