const addRequestId = require('../utils/request-id');
const rateLimitHook = require('../utils/rate-limit-hook');
const { checkApiKey } = require('../utils/auth');
const { validatePdfCompressRequest } = require('../schemas/pdf-compress-request.schema');
const { validateHtmlToPdfRequest } = require('../schemas/html-to-pdf-request.schema');
const { ValidationError } = require('../utils/errors');
const PdfService = require('../services/pdf-service');

async function pdfRoutes(fastify, opts) {
  const API_KEY = process.env.API_KEY;
  const pdfService = new PdfService();

  fastify.addHook('preHandler', addRequestId);
  fastify.addHook('preHandler', rateLimitHook);

  fastify.post('/v1/pdf/compress', {
    schema: {
      tags: ['PDF'],
      summary: 'Compress a PDF and extract only page 1',
      security: [{ ApiKeyAuth: [] }],
      body: {
        type: 'object',
        required: ['url'],
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            description: 'Publicly accessible URL of the PDF to compress',
          },
          quality: {
            type: 'string',
            enum: ['screen', 'ebook', 'printer'],
            default: 'ebook',
            description: 'Ghostscript compression quality: screen (72 dpi), ebook (150 dpi), printer (300 dpi)',
          },
          downloadName: {
            type: 'string',
            description: 'Filename for the downloaded PDF (default: compressed.pdf)',
          },
        },
      },
      response: {
        200: {
          type: 'string',
          format: 'binary',
          description: 'Compressed single-page PDF file',
        },
      },
    },
  }, async (request, reply) => {
    const startTime = Date.now();
    let sessionDir;

    request.log.info({ requestId: request.id }, 'POST /v1/pdf/compress received');

    try {
      checkApiKey(request, API_KEY);

      const validated = validatePdfCompressRequest(request.body);

      const { buffer, sessionDir: sd } = await pdfService.compressFirstPage(
        request,
        validated.url,
        validated.quality,
        request.id
      );
      sessionDir = sd;

      const downloadName = validated.downloadName || 'compressed.pdf';
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${downloadName}"`);
      return reply.send(buffer);
    } catch (error) {
      if (error.message.startsWith('[')) {
        const validationErrors = JSON.parse(error.message);
        throw new ValidationError('Validation failed', { errors: validationErrors });
      }
      if (error.statusCode) throw error;
      throw new ValidationError(error.message);
    } finally {
      if (sessionDir) {
        try {
          await pdfService.cleanup(sessionDir, request.id);
        } catch (cleanupError) {
          request.log.warn({ requestId: request.id, cleanupError }, 'Error during PDF cleanup');
        }
      }

      const duration = Date.now() - startTime;
      request.log.info({ requestId: request.id, durationMs: duration }, 'PDF request completed');
    }
  });

  fastify.post('/v1/pdf/from-html', {
    schema: {
      tags: ['PDF'],
      summary: 'Convert HTML string to PDF',
      security: [{ ApiKeyAuth: [] }],
      body: {
        type: 'object',
        required: ['html'],
        properties: {
          pdf_url: {
            type: 'string',
            format: 'uri',
            description: 'Optional source PDF URL. If provided, page 1 of this PDF will be used as first page in the output',
          },
          html: {
            type: 'string',
            description: 'Full HTML content to render as PDF',
          },
          downloadName: {
            type: 'string',
            description: 'Filename for the downloaded PDF (default: document.pdf)',
          },
        },
      },
      response: {
        200: {
          type: 'string',
          format: 'binary',
          description: 'Generated PDF file',
        },
      },
    },
  }, async (request, reply) => {
    const startTime = Date.now();
    let sessionDir;

    request.log.info({ requestId: request.id }, 'POST /v1/pdf/from-html received');

    try {
      checkApiKey(request, API_KEY);
      const validated = validateHtmlToPdfRequest(request.body);

      const { buffer, sessionDir: sd } = validated.pdf_url
        ? await pdfService.htmlToPdfWithFirstPageFromUrl(
            request,
            validated.html,
            validated.pdf_url,
            request.id
          )
        : await pdfService.htmlToPdf(
            request,
            validated.html,
            request.id
          );
      sessionDir = sd;

      const downloadName = validated.downloadName || 'document.pdf';
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${downloadName}"`);
      return reply.send(buffer);
    } catch (error) {
      if (error.message.startsWith('[')) {
        const validationErrors = JSON.parse(error.message);
        throw new ValidationError('Validation failed', { errors: validationErrors });
      }
      if (error.statusCode) throw error;
      throw new ValidationError(error.message);
    } finally {
      if (sessionDir) {
        try {
          await pdfService.cleanup(sessionDir, request.id);
        } catch (cleanupError) {
          request.log.warn({ requestId: request.id, cleanupError }, 'Error during PDF cleanup');
        }
      }

      const duration = Date.now() - startTime;
      request.log.info({ requestId: request.id, durationMs: duration }, 'PDF request completed');
    }
  });
}

module.exports = pdfRoutes;
