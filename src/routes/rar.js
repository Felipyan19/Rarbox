const { v4: uuidv4 } = require('uuid');
const addRequestId = require('../utils/request-id');
const { checkApiKey } = require('../utils/auth');
const { validateRarRequest } = require('../schemas/rar-request.schema');
const { sanitizeArchiveName, sanitizeFilename } = require('../utils/sanitize');
const { ValidationError } = require('../utils/errors');

async function rarRoutes(fastify, opts) {
  const API_KEY = process.env.API_KEY;
  const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '15000', 10);

  fastify.addHook('preHandler', addRequestId);

  fastify.post('/v1/archives/rar', async (request, reply) => {
    const startTime = Date.now();
    request.log.info({ requestId: request.id }, 'POST /v1/archives/rar received');

    try {
      checkApiKey(request, API_KEY);

      const validated = validateRarRequest(request.body);

      const archiveName = sanitizeArchiveName(validated.archiveName);
      const htmlFilename = sanitizeFilename(validated.files.html.filename);
      const textFilename = sanitizeFilename(validated.files.text.filename);

      request.log.info(
        {
          requestId: request.id,
          archiveName,
          htmlFilename,
          textFilename,
        },
        'Request validated and sanitized'
      );

      return reply.status(501).send({
        error: 'NOT_IMPLEMENTED',
        message: 'Archive generation not yet implemented. Coming in next phase.',
        requestId: request.id,
      });
    } catch (error) {
      if (error.message.startsWith('[')) {
        const validationErrors = JSON.parse(error.message);
        throw new ValidationError('Validation failed', { errors: validationErrors });
      }
      if (error.statusCode) {
        throw error;
      }
      throw new ValidationError(error.message);
    } finally {
      const duration = Date.now() - startTime;
      request.log.info({ requestId: request.id, durationMs: duration }, 'Request completed');
    }
  });
}

module.exports = rarRoutes;
