const fs = require('fs');
const addRequestId = require('../utils/request-id');
const rateLimitHook = require('../utils/rate-limit-hook');
const { checkApiKey } = require('../utils/auth');
const { validateRarRequest } = require('../schemas/rar-request.schema');
const { validatePrepareRarRequest } = require('../schemas/prepare-rar-request.schema');
const prepareService = require('../services/prepare-service');
const { sanitizeArchiveName, sanitizeFilename } = require('../utils/sanitize');
const { ValidationError } = require('../utils/errors');
const ArchiveService = require('../services/archive-service');

const IMAGE_FETCH_TIMEOUT_MS = 10000;
const normalizeDeliveryType = (value) =>
  String(value || '').toLowerCase() === 'centurion' ? 'centurion' : 'standard';

const normalizeBase64 = (value) => {
  const raw = (value || '').trim();
  if (!raw) {
    throw new Error('Invalid base64 image payload');
  }
  const commaIndex = raw.indexOf(',');
  if (commaIndex !== -1 && raw.slice(0, commaIndex).includes('base64')) {
    return raw.slice(commaIndex + 1);
  }
  return raw;
};

const fetchImageBuffer = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeout);
  }
};

const buildAdditionalFiles = async (images, deliveryType, request) => {
  const additional = [];

  for (const image of images) {
    const filename = sanitizeFilename(image.filename);
    const archivePath = deliveryType === 'standard' ? `images/${filename}` : filename;
    let content;

    if (image.source.type === 'base64') {
      content = Buffer.from(normalizeBase64(image.source.value), 'base64');
    } else {
      try {
        content = await fetchImageBuffer(image.source.value);
      } catch (error) {
        request.log.warn(
          {
            requestId: request.id,
            imageUrl: image.source.value,
            filename,
            err: error,
          },
          'Skipping image download; image will not be included in archive'
        );
        continue;
      }
    }

    additional.push({
      filename: archivePath,
      content,
    });
  }

  return additional;
};

const streamArchiveReply = (reply, archivePath, downloadName) => {
  reply.header('Content-Type', 'application/zip');
  reply.header('Content-Disposition', `attachment; filename="${downloadName}"`);
  return reply.send(fs.createReadStream(archivePath));
};

async function rarRoutes(fastify, opts) {
  const API_KEY = process.env.API_KEY;
  const archiveService = new ArchiveService();

  fastify.addHook('preHandler', addRequestId);
  fastify.addHook('preHandler', rateLimitHook);

  fastify.post('/v1/archives/rar', {
    schema: {
      tags: ['Archives'],
      summary: 'Generate a RAR archive from HTML and text content',
      body: {
        type: 'object',
        required: ['archiveName', 'files'],
        properties: {
          archiveName: { type: 'string' },
          files: {
            type: 'object',
            required: ['html', 'text'],
            properties: {
              html: {
                type: 'object',
                required: ['content'],
                properties: {
                  filename: { type: 'string', default: 'index.html' },
                  content: { type: 'string' },
                },
              },
              text: {
                type: 'object',
                required: ['content'],
                properties: {
                  filename: { type: 'string', default: 'content.txt' },
                  content: { type: 'string' },
                },
              },
            },
          },
          options: {
            type: 'object',
            properties: {
              compressionLevel: { type: 'integer', minimum: 0, maximum: 5, default: 3 },
              downloadName: { type: 'string' },
            },
          },
        },
      },
      response: {
        200: {
          type: 'string',
          format: 'binary',
          description: 'RAR archive file',
        },
      },
    },
  }, async (request, reply) => {
    const startTime = Date.now();
    let sessionDir;

    request.log.info({ requestId: request.id }, 'POST /v1/archives/rar received');

    try {
      // checkApiKey(request, API_KEY); // API key disabled for this endpoint

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

      const downloadName = validated.options?.downloadName || `${archiveName}.zip`;
      return streamArchiveReply(reply, result.archivePath, downloadName);
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

  fastify.post('/v1/archives/rar/prepare', {
    schema: {
      tags: ['Archives'],
      summary: 'Generate a RAR archive from emailprep-style payload',
      body: {
        type: 'object',
        required: ['artifact_name', 'delivery_type', 'html'],
        properties: {
          artifact_name: { type: 'string' },
          delivery_type: {
            type: 'string',
            description: 'centurion keeps centurion format; any other value is treated as standard',
          },
          html: { type: 'string' },
          images_catalog: {
            type: 'array',
            items: {
              type: 'object',
              required: ['filename', 'source'],
              properties: {
                filename: { type: 'string' },
                source: {
                  type: 'object',
                  required: ['type', 'value'],
                  properties: {
                    type: { type: 'string', enum: ['url', 'base64'] },
                    value: { type: 'string' },
                  },
                },
              },
            },
          },
          config: { type: 'object', additionalProperties: true },
        },
      },
      response: {
        200: {
          type: 'string',
          format: 'binary',
          description: 'RAR archive file',
        },
      },
    },
  }, async (request, reply) => {
    const startTime = Date.now();
    let sessionDir;

    request.log.info({ requestId: request.id }, 'POST /v1/archives/rar/prepare received');

    try {
      const validated = validatePrepareRarRequest(request.body);
      const prepared = prepareService.prepare({
        ...validated,
        delivery_type: normalizeDeliveryType(validated.delivery_type),
      });

      const archiveName = sanitizeArchiveName(prepared.artifact_name);
      const htmlFilename = sanitizeFilename('index.html');
      const textFilename = sanitizeFilename('content.txt');
      const additionalFiles = await buildAdditionalFiles(
        prepared.rar_request.images,
        prepared.delivery_type,
        request
      );

      request.log.info(
        {
          requestId: request.id,
          archiveName,
          deliveryType: prepared.delivery_type,
          images: additionalFiles.length,
        },
        'Prepare payload mapped to archive request'
      );

      const result = await archiveService.generateArchive(
        request,
        archiveName,
        {
          html: {
            filename: htmlFilename,
            content: prepared.rar_request.html,
          },
          text: {
            filename: textFilename,
            content: prepared.rar_request.txt,
          },
          additional: additionalFiles,
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
        'Archive generated from prepare payload'
      );

      const downloadName = `${archiveName}.zip`;
      return streamArchiveReply(reply, result.archivePath, downloadName);
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
