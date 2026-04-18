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

  test('POST /v1/archives/rar returns 501 (not yet implemented)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/archives/rar',
      headers: {
        'Content-Type': 'application/json',
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

    expect(response.statusCode).toBe(501);
    expect(response.json()).toHaveProperty('error', 'NOT_IMPLEMENTED');
  });

  test('POST /v1/archives/rar validates missing API key', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/archives/rar',
      headers: {
        'Content-Type': 'application/json',
      },
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
        'Content-Type': 'application/json',
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
});
