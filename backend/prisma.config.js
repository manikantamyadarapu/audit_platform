module.exports = {
  schema: './prisma/schema.prisma',
  migrate: {
    databaseUrl: process.env.DATABASE_URL,
  },
};
