const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { PrismaClient } = require('@prisma/client');

// Single shared Prisma instance for the entire app.
// Required when using Supabase PgBouncer (transaction-mode pooler) which
// does not support prepared statements — multiple PrismaClient instances
// each opening their own connections cause "prepared statement does not exist"
// and "insufficient data left in message" errors.
const prisma = new PrismaClient();

module.exports = prisma;
