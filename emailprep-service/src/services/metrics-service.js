class MetricsService {
  constructor() {
    this.requests = {
      total: 0,
      success: 0,
      error: 0,
      rateLimited: 0,
    };
    this.startTime = Date.now();
  }

  recordRequest(statusCode) {
    this.requests.total++;

    if (statusCode >= 200 && statusCode < 300) {
      this.requests.success++;
    } else if (statusCode === 429) {
      this.requests.rateLimited++;
    } else if (statusCode >= 400) {
      this.requests.error++;
    }
  }

  getMetrics() {
    const uptime = Date.now() - this.startTime;

    return {
      uptime,
      requests: this.requests,
      successRate: this.requests.total > 0
        ? ((this.requests.success / this.requests.total) * 100).toFixed(2) + '%'
        : '0%',
    };
  }
}

module.exports = MetricsService;
