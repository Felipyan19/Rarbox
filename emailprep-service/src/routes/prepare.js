const addRequestId = require('../utils/request-id');
const rateLimitHook = require('../utils/rate-limit-hook');
const { checkApiKey } = require('../utils/auth');
const { validatePrepareRequest } = require('../schemas/prepare-request.schema');
const { ValidationError } = require('../utils/errors');
const emailPrepService = require('../services/email-prep.service');

async function prepareRoute(fastify) {
  const API_KEY = process.env.API_KEY;

  fastify.addHook('preHandler', addRequestId);
  fastify.addHook('preHandler', rateLimitHook);

  fastify.post('/v1/prepare', {
    schema: {
      tags: ['Email Prep'],
      summary: 'Prepare email marketing deliverable payload',
      security: [{ ApiKeyAuth: [] }],
      body: {
        type: 'object',
        required: ['artifact_name', 'delivery_type', 'html', 'images_catalog'],
        properties: {
          artifact_name: { type: 'string' },
          delivery_type: { type: 'string', enum: ['standard', 'centurion'] },
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
          type: 'object',
          additionalProperties: true,
        },
      },
    },
  }, async (request) => {
    request.log.info({ requestId: request.id }, 'POST /v1/prepare received');

    try {
      checkApiKey(request, API_KEY);

      const validated = validatePrepareRequest(request.body);
      return emailPrepService.prepare(validated);
    } catch (error) {
      if (error.message && error.message.startsWith('[')) {
        const validationErrors = JSON.parse(error.message);
        throw new ValidationError('Validation failed', { errors: validationErrors });
      }

      if (error.statusCode) {
        throw error;
      }

      throw new ValidationError(error.message);
    }
  });
}

module.exports = prepareRoute;
