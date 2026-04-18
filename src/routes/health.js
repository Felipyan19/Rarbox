const addRequestId = require('../utils/request-id');

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
}

module.exports = healthRoutes;
