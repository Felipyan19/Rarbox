const app = require('./app');
const logger = require('./utils/logger');

const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info({ port: PORT, env: NODE_ENV }, 'Server started');
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
};

start();
