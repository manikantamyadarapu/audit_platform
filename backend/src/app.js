const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');
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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'audit-platform-node-backend' });
});

// Single mount point for all versioned routes — see routes/index.js.
app.use('/api/v1', apiV1);

// Legacy unversioned compatibility mounts.
// These paths are called directly (without /v1) by the frontend today —
// verified against frontend/src/services/*.js — so they are kept as thin
// re-mounts of the same routers registered above under /api/v1, rather than
// separate/duplicated route files.
app.use('/api/auth', authRoutes); // frontend/src/services/authService.js (login/logout)
app.use('/api/notifications', require('./routes/notification.routes')); // notificationService.js
app.use('/api/dashboard', require('./routes/dashboard.routes')); // dashboardService.js
app.use('/api/audit-sessions', require('./routes/auditSession.routes')); // auditSessionService.js
app.use('/api/sales-audit', require('./routes/sales.routes')); // salesAuditService.js (product-average-rates)
app.use('/api/sales-return', require('./routes/salesReturn.routes')); // processExcelService.js (run-audit/rate-comparison/export-*)
app.use('/api/purchase-return', require('./routes/purchaseReturn.routes'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
