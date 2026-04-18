const addRequestId = require('../utils/request-id');
const MetricsService = require('../services/metrics-service');

const metricsService = new MetricsService();

async function healthRoutes(fastify) {
  fastify.addHook('preHandler', addRequestId);

  fastify.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Service health check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            service: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    return {
      status: 'ok',
      service: 'rarbox',
      timestamp: new Date().toISOString(),
    };
  });

  fastify.get('/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Service readiness check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            service: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    return {
      status: 'ready',
      service: 'rarbox',
      timestamp: new Date().toISOString(),
    };
  });

  fastify.get('/metrics', {
    schema: {
      tags: ['Health'],
      summary: 'Service metrics',
      response: {
        200: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
  }, async (request, reply) => {
    return metricsService.getMetrics();
  });
}

module.exports = { healthRoutes, metricsService };
