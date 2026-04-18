const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: process.env.NODE_ENV !== 'production',
      singleLine: process.env.NODE_ENV === 'production',
    },
  },
});

module.exports = logger;
