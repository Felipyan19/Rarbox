const addRequestId = require('../utils/request-id');
const rateLimitHook = require('../utils/rate-limit-hook');
const { checkApiKey } = require('../utils/auth');
const { validateRarRequest } = require('../schemas/rar-request.schema');
const { sanitizeArchiveName, sanitizeFilename } = require('../utils/sanitize');
const { ValidationError } = require('../utils/errors');
const ArchiveService = require('../services/archive-service');

async function rarRoutes(fastify, opts) {
  const API_KEY = process.env.API_KEY;
  const archiveService = new ArchiveService();

  fastify.addHook('preHandler', addRequestId);
  fastify.addHook('preHandler', rateLimitHook);

  fastify.post('/v1/archives/rar', async (request, reply) => {
    const startTime = Date.now();
    let sessionDir;

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

      const result = await archiveService.generateArchive(
        request,
        archiveName,
        {
          html: {
            filename: htmlFilename,
            content: validated.files.html.content,
          },
          text: {
            filename: textFilename,
            content: validated.files.text.content,
          },
        },
        request.id
      );

      sessionDir = result.sessionDir;

      request.log.info(
        {
          requestId: request.id,
          sessionDir,
          archiveName,
          archivePath: result.archivePath,
        },
        'Archive generated and compressed'
      );

      const downloadName = validated.options?.downloadName || `${archiveName}.rar`;

      return reply
        .header('Content-Type', 'application/vnd.rar')
        .header('Content-Disposition', `attachment; filename="${downloadName}"`)
        .sendFile(result.archivePath);
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
      if (sessionDir) {
        try {
          await archiveService.cleanup(sessionDir, request.id);
        } catch (cleanupError) {
          request.log.warn(
            { requestId: request.id, cleanupError },
            'Error during cleanup in finally block'
          );
        }
      }

      const duration = Date.now() - startTime;
      request.log.info({ requestId: request.id, durationMs: duration }, 'Request completed');
    }
  });
}

module.exports = rarRoutes;
