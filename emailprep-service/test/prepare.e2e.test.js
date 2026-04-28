const app = require('../src/app');

describe('POST /v1/prepare', () => {
  afterAll(async () => {
    await app.close();
  });

  test('returns prepared payload', async () => {
    process.env.API_KEY = 'change-me';

    const payload = {
      artifact_name: 'travel_platinum_2026_04_16_test',
      delivery_type: 'standard',
      html: '<html><body><img src="https://cdn.midominio.com/assets/banner.jpg" alt="No vivas la vida sin ella"><h1>No vivas la vida sin ella</h1><p>Publicidad</p></body></html>',
      images_catalog: [
        { filename: '20260416_001.jpg', source: { type: 'url', value: 'https://cdn.midominio.com/assets/banner.jpg' } },
        { filename: '20260416_logo.png', source: { type: 'base64', value: 'iVBORw0KGgo...' } },
      ],
    };

    const response = await app.inject({
      method: 'POST',
      url: '/v1/prepare',
      headers: {
        'x-api-key': 'change-me',
      },
      payload,
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.artifact_name).toBe('travel_platinum_2026_04_16');
    expect(body.html_image_refs).toEqual(['https://cdn.midominio.com/assets/banner.jpg']);
    expect(body.used_images.map((image) => image.filename)).toEqual(['20260416_001.jpg']);
    expect(body.validations.unused_catalog_images).toEqual(['20260416_logo.png']);
    expect(body.html).toContain('src="images/20260416_001.jpg"');
    expect(body.txt).toContain('No vivas la vida sin ella');
    expect(body.txt).toContain('Publicidad');
    expect(body.packaging_plan.files).toEqual(
      expect.arrayContaining([
        { path: 'travel_platinum_2026_04_16.html', type: 'html' },
        { path: 'travel_platinum_2026_04_16.txt', type: 'txt' },
        { path: 'images/20260416_001.jpg', type: 'image' },
      ])
    );
    expect(body.rar_request.images.map((image) => image.filename)).toEqual(['20260416_001.jpg']);
    expect(body.validations.packaging_ready).toBe(true);
  });
});
