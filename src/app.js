const Fastify = require('fastify');
const helmet = require('@fastify/helmet');
const logger = require('./utils/logger');
const { healthRoutes, metricsService } = require('./routes/health');
const rarRoutes = require('./routes/rar');
const errorHandler = require('./utils/error-handler');

const app = Fastify({
  logger: logger,
  bodyLimit: parseInt(process.env.MAX_BODY_SIZE_MB || '5', 10) * 1024 * 1024,
});

app.register(helmet);

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
