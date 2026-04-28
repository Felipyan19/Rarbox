const { AuthenticationError } = require('./errors');
const logger = require('./logger');

const checkApiKey = (request, expectedKey) => {
  if (!expectedKey) {
    logger.warn('API key validation disabled (no API_KEY env var set)');
    return true;
  }

  const apiKey = request.headers['x-api-key'];

  if (!apiKey) {
    throw new AuthenticationError('Missing X-API-Key header');
  }

  if (apiKey !== expectedKey) {
    throw new AuthenticationError('Invalid API key');
  }

  return true;
};

module.exports = {
  checkApiKey,
};
