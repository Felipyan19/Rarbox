const Fastify = require('fastify');
const helmet = require('@fastify/helmet');
const swagger = require('@fastify/swagger');
const swaggerUi = require('@fastify/swagger-ui');
const logger = require('./utils/logger');
const { healthRoutes, metricsService } = require('./routes/health');
const rarRoutes = require('./routes/rar');
const errorHandler = require('./utils/error-handler');

const app = Fastify({
  logger: logger,
  bodyLimit: parseInt(process.env.MAX_BODY_SIZE_MB || '5', 10) * 1024 * 1024,
});

app.register(helmet);

app.register(swagger, {
  openapi: {
    info: {
      title: 'Rarbox API',
      description: 'Microservicio seguro para generar archivos RAR bajo demanda',
      version: '0.1.0',
    },
    tags: [
      { name: 'Health', description: 'Health, readiness and metrics endpoints' },
      { name: 'Archives', description: 'RAR generation endpoint' },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
    },
  },
});

app.register(swaggerUi, {
  routePrefix: '/docs',
  staticCSP: true,
  transformStaticCSP: (header) => header,
});

app.register(healthRoutes);
app.register(rarRoutes);

app.addHook('onResponse', (request, reply, done) => {
  metricsService.recordRequest(reply.statusCode);
  done();
});

app.setErrorHandler((error, request, reply) => {
  errorHandler(error, request, reply);
});

module.exports = app;
