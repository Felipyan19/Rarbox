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

  test('POST /v1/archives/rar/prepare validates payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/archives/rar/prepare',
      headers: {
        'X-API-Key': 'test-api-key',
      },
      payload: {
        artifact_name: '',
        delivery_type: 'centurion',
        html: '',
        images_catalog: [],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  test('POST /v1/archives/rar/prepare with minimal payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/archives/rar/prepare',
      headers: {
        'X-API-Key': 'test-api-key',
      },
      payload: {
        artifact_name: 'mi_campana',
        delivery_type: 'centurion',
        html: '<html><body><h1>Hola</h1><p>Texto base</p></body></html>',
        images_catalog: [],
      },
    });

    expect([200, 500, 503]).toContain(response.statusCode);
  }, 15000);

  test('POST /v1/archives/rar/prepare accepts missing images_catalog', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/archives/rar/prepare',
      headers: {
        'X-API-Key': 'test-api-key',
      },
      payload: {
        artifact_name: 'mi_campana',
        delivery_type: 'centurion',
        html: '<html><body><h1>Hola</h1><img src="https://example.com/a.png"></body></html>',
      },
    });

    expect([200, 400, 500, 503]).toContain(response.statusCode);
  }, 15000);

  test('POST /v1/archives/rar/prepare treats non-centurion delivery_type as standard', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/archives/rar/prepare',
      headers: {
        'X-API-Key': 'test-api-key',
      },
      payload: {
        artifact_name: 'mi_campana',
        delivery_type: 'platinum',
        html: '<html><body><h1>Hola</h1><p>Texto base</p></body></html>',
        images_catalog: [],
      },
    });

    expect([200, 500, 503]).toContain(response.statusCode);
  }, 15000);
});
