const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');
const apiV1 = require('./routes');
const openapiSpec = require('./openapi/openapi.json');
const { requestIdMiddleware } = require('./middleware/requestId.middleware');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler.middleware');

const app = express();

if (config.isProduction) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use(requestIdMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: config.getCorsOrigin(),
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

app.use('/api/v1', apiV1);
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/sales-audit', require('./routes/salesAudit.routes'));
app.use('/api/sales-return', require('./routes/salesReturnAudit.routes'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
