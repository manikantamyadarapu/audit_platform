const express = require('express');
const axios = require('axios');
const prisma = require('./lib/prisma');
const config = require('./config');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const apiV1 = require('./routes');
const authRoutes = require('./routes/auth.routes');
const openapiSpec = require('./openapi/openapi.json');
const { requestIdMiddleware } = require('./middleware/requestId.middleware');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler.middleware');

const app = express();

if (config.isProduction) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use(requestIdMiddleware);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: config.getCorsOrigin(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    maxAge: 86400,
  })
);

if (!config.isProduction) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

if (config.ENABLE_SWAGGER) {
  app.get('/openapi.json', (_req, res) => {
    res.json(openapiSpec);
  });
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openapiSpec, {
      customSiteTitle: 'HAA Audit Platform API — PAN',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        tryItOutEnabled: true,
      },
    })
  );
}

app.get('/api/health', async (_req, res) => {
  const checks = {
    service: 'audit-platform-node-backend',
    database: 'unknown',
    python: 'unknown',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  try {
    const pythonHealth = await axios.get(`${config.PYTHON_SERVICE_URL}/api/health`, {
      timeout: 3000,
      validateStatus: () => true,
    });
    checks.python = pythonHealth.status >= 200 && pythonHealth.status < 300 ? 'ok' : 'error';
  } catch {
    checks.python = 'error';
  }

  const healthy = checks.database === 'ok' && checks.python === 'ok';
  return res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    ...checks,
  });
});

app.use('/api/v1', apiV1);

app.use('/api/auth', authRoutes);
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/audit-sessions', require('./routes/auditSession.routes'));
app.use('/api/sales-audit', require('./routes/sales.routes'));
app.use('/api/sales-return', require('./routes/salesReturn.routes'));
app.use('/api/purchase-return', require('./routes/purchaseReturn.routes'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
