const http = require('http');
const config = require('./config');
const logger = require('./utils/logger');

config.validateConfigOrThrow();

const app = require('./app');

const server = http.createServer(app);

server.listen(config.PORT, () => {
  logger.info('Node backend listening', { port: config.PORT, env: config.NODE_ENV });
});

function shutdown(signal) {
  logger.info('Shutdown signal received, closing server', { signal });
  server.close((err) => {
    if (err) {
      logger.error('Error during server close', { message: err.message });
      process.exit(1);
    }
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced exit after shutdown timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
