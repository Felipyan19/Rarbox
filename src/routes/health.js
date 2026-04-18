const addRequestId = require('../utils/request-id');
const MetricsService = require('../services/metrics-service');

const metricsService = new MetricsService();

async function healthRoutes(fastify) {
  fastify.addHook('preHandler', addRequestId);

  fastify.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      service: 'rarbox',
      timestamp: new Date().toISOString(),
    };
  });

  fastify.get('/ready', async (request, reply) => {
    return {
      status: 'ready',
      service: 'rarbox',
      timestamp: new Date().toISOString(),
    };
  });

  fastify.get('/metrics', async (request, reply) => {
    return metricsService.getMetrics();
  });
}

module.exports = { healthRoutes, metricsService };

