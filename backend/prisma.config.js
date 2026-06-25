const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

module.exports = {
  schema: './prisma/schema.prisma',
  migrate: {
    databaseUrl: process.env.DATABASE_URL,
  },
};
