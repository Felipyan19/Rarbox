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

app.register(helmet, {
  hsts: process.env.ENABLE_HSTS === 'true',
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      upgradeInsecureRequests: null,
    },
  },
});

const configuredSwaggerUrl = process.env.SWAGGER_URL;
const swaggerServers = configuredSwaggerUrl
  ? [
      {
        url: configuredSwaggerUrl,
        description: 'Configured server',
      },
    ]
  : process.env.NODE_ENV === 'production'
    ? [
        {
          url: '/',
          description: 'Production server',
        },
      ]
    : [
        {
          url: 'http://localhost:' + (process.env.PORT || '3000'),
          description: 'Development server',
        },
      ];

app.register(swagger, {
  openapi: {
    info: {
      title: 'Rarbox API',
      description: 'Microservicio seguro para generar archivos RAR bajo demanda',
      version: '0.1.0',
    },
    servers: swaggerServers,
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
  uiConfig: {
    layout: 'BaseLayout',
    deepLinking: true,
  },
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
