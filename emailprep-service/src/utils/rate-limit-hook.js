const RateLimiter = require('./rate-limiter');

const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '10', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);

const limiter = new RateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

// Cleanup old entries every 5 minutes
const cleanupInterval = setInterval(() => {
  limiter.cleanup();
}, 5 * 60 * 1000);

// Allow process to exit even if interval is running
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

const rateLimitHook = async (request, reply) => {
  const clientIp = request.ip || request.headers['x-forwarded-for'] || '127.0.0.1';
  const result = limiter.isAllowed(clientIp);

  reply.header('X-RateLimit-Limit', RATE_LIMIT_MAX);
  reply.header('X-RateLimit-Remaining', result.remaining);

  if (!result.allowed) {
    reply.header('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + result.resetAfter);
    reply.header('Retry-After', result.resetAfter);

    request.log.warn(
      { ip: clientIp, remaining: result.remaining },
      'Rate limit exceeded'
    );

    return reply.status(429).send({
      error: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded',
      retryAfter: result.resetAfter,
      requestId: request.id,
    });
  }
};

module.exports = rateLimitHook;
