const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

const errorHandler = (error, request, reply) => {
  const requestId = request.id || uuidv4();

  const statusCode = error.statusCode || 500;
  const errorCode = error.name || 'INTERNAL_ERROR';

  logger.error(
    { err: error, requestId, statusCode },
    `Error processing request`
  );

  reply.status(statusCode).send({
    error: errorCode,
    message: error.message,
    requestId,
  });
};

module.exports = errorHandler;
