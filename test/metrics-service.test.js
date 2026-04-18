const MetricsService = require('../src/services/metrics-service');

describe('MetricsService', () => {
  let metrics;

  beforeEach(() => {
    metrics = new MetricsService();
  });

  test('initializes with zero metrics', () => {
    const data = metrics.getMetrics();
    expect(data.requests.total).toBe(0);
    expect(data.requests.success).toBe(0);
    expect(data.archives.totalGenerated).toBe(0);
  });

  test('records successful requests', () => {
    metrics.recordRequest(200);
    metrics.recordRequest(200);

    const data = metrics.getMetrics();
    expect(data.requests.total).toBe(2);
    expect(data.requests.success).toBe(2);
  });

  test('records error requests', () => {
    metrics.recordRequest(200);
    metrics.recordRequest(400);
    metrics.recordRequest(500);

    const data = metrics.getMetrics();
    expect(data.requests.total).toBe(3);
    expect(data.requests.success).toBe(1);
    expect(data.requests.error).toBe(2);
  });

  test('records rate limited requests', () => {
    metrics.recordRequest(200);
    metrics.recordRequest(429);

    const data = metrics.getMetrics();
    expect(data.requests.total).toBe(2);
    expect(data.requests.rateLimited).toBe(1);
  });

  test('records archive generation', () => {
    metrics.recordArchiveGenerated(1024);
    metrics.recordArchiveGenerated(2048);

    const data = metrics.getMetrics();
    expect(data.archives.totalGenerated).toBe(2);
    expect(data.archives.totalSize).toBe(3072);
    expect(data.averageArchiveSize).toBe(1536);
  });

  test('calculates success rate', () => {
    metrics.recordRequest(200);
    metrics.recordRequest(200);
    metrics.recordRequest(400);

    const data = metrics.getMetrics();
    expect(data.successRate).toBe('66.67%');
  });

  test('resets metrics', () => {
    metrics.recordRequest(200);
    metrics.recordArchiveGenerated(1024);

    metrics.reset();

    const data = metrics.getMetrics();
    expect(data.requests.total).toBe(0);
    expect(data.archives.totalGenerated).toBe(0);
  });
});
