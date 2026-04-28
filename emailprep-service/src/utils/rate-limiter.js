const logger = require('./logger');

class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isAllowed(key) {
    const now = Date.now();
    const userRequests = this.requests.get(key);

    if (!userRequests) {
      this.requests.set(key, [now]);
      return { allowed: true, remaining: this.maxRequests - 1 };
    }

    const validRequests = userRequests.filter((time) => now - time < this.windowMs);

    if (validRequests.length >= this.maxRequests) {
      logger.warn({ key, requests: validRequests.length }, 'Rate limit exceeded');
      return { allowed: false, remaining: 0, resetAfter: Math.ceil((validRequests[0] + this.windowMs - now) / 1000) };
    }

    validRequests.push(now);
    this.requests.set(key, validRequests);

    return { allowed: true, remaining: this.maxRequests - validRequests.length };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter((time) => now - time < this.windowMs);
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }
}

module.exports = RateLimiter;
