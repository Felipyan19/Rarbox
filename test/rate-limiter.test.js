const RateLimiter = require('../src/utils/rate-limiter');

describe('RateLimiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RateLimiter(3, 1000); // 3 requests per 1 second
  });

  test('allows requests up to the limit', () => {
    const key = '192.168.1.1';

    const req1 = limiter.isAllowed(key);
    expect(req1.allowed).toBe(true);
    expect(req1.remaining).toBe(2);

    const req2 = limiter.isAllowed(key);
    expect(req2.allowed).toBe(true);
    expect(req2.remaining).toBe(1);

    const req3 = limiter.isAllowed(key);
    expect(req3.allowed).toBe(true);
    expect(req3.remaining).toBe(0);
  });

  test('blocks requests after limit is exceeded', () => {
    const key = '192.168.1.1';

    limiter.isAllowed(key);
    limiter.isAllowed(key);
    limiter.isAllowed(key);

    const req4 = limiter.isAllowed(key);
    expect(req4.allowed).toBe(false);
    expect(req4.remaining).toBe(0);
    expect(req4.resetAfter).toBeGreaterThan(0);
  });

  test('resets after time window expires', (done) => {
    const key = '192.168.1.1';

    limiter.isAllowed(key);
    limiter.isAllowed(key);
    limiter.isAllowed(key);

    const blockedReq = limiter.isAllowed(key);
    expect(blockedReq.allowed).toBe(false);

    // Wait for window to expire
    setTimeout(() => {
      const newReq = limiter.isAllowed(key);
      expect(newReq.allowed).toBe(true);
      done();
    }, 1100);
  });

  test('tracks different IPs independently', () => {
    const ip1 = '192.168.1.1';
    const ip2 = '192.168.1.2';

    limiter.isAllowed(ip1);
    limiter.isAllowed(ip1);
    limiter.isAllowed(ip1);

    const blockedIp1 = limiter.isAllowed(ip1);
    expect(blockedIp1.allowed).toBe(false);

    const allowedIp2 = limiter.isAllowed(ip2);
    expect(allowedIp2.allowed).toBe(true);
  });

  test('cleans up old entries', (done) => {
    const key = '192.168.1.1';

    limiter.isAllowed(key);

    expect(limiter.requests.size).toBe(1);

    setTimeout(() => {
      limiter.cleanup();
      expect(limiter.requests.size).toBe(0);
      done();
    }, 1100);
  });
});
