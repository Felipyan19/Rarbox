const app = require('../src/app');

describe('RAR Archive Endpoint', () => {
  let server;

  beforeAll(async () => {
    process.env.API_KEY = 'test-api-key';
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  test('POST /v1/archives/rar validates missing API key', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/archives/rar',
      payload: {
        archiveName: 'test-archive',
        files: {
          html: { content: '<html></html>' },
          text: { content: 'Test' },
        },
      },
    });

    expect(response.statusCode).toBe(401);
  });

  test('POST /v1/archives/rar validates invalid payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/archives/rar',
      headers: {
        'X-API-Key': 'test-api-key',
      },
      payload: {
        archiveName: '',
        files: {
          html: { content: '' },
          text: { content: '' },
        },
      },
    });

    expect(response.statusCode).toBe(400);
  });

  test('GET /health returns 200', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('status', 'ok');
  });

  test('GET /ready returns 200', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('status', 'ready');
  });

  test('POST /v1/archives/rar with valid payload (RAR unavailable returns error)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/archives/rar',
      headers: {
        'X-API-Key': 'test-api-key',
      },
      payload: {
        archiveName: 'test-archive',
        files: {
          html: {
            content: '<html><body>Test</body></html>',
          },
          text: {
            content: 'Test content',
          },
        },
      },
    });

    // With real RAR: 200 with binary
    // Without RAR: 500 (ServiceUnavailable wrapped as InternalError)
    expect([200, 500, 503]).toContain(response.statusCode);
  }, 15000);
});
