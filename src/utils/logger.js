const pino = require('pino');

const loggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
};

try {
  require.resolve('pino-pretty');
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: process.env.NODE_ENV !== 'production',
      singleLine: process.env.NODE_ENV === 'production',
    },
  };
} catch (err) {
  // Keep default JSON logging when pino-pretty is not installed.
}

const logger = pino(loggerOptions);

module.exports = logger;
