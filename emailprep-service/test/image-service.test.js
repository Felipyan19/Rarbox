const imageService = require('../src/services/image.service');

describe('image.service', () => {
  test('resolves by URL and reports unused images', () => {
    const catalog = [
      { filename: 'banner.jpg', source: { type: 'url', value: 'https://cdn/banner.jpg' } },
      { filename: 'logo.png', source: { type: 'base64', value: 'abc' } },
    ];

    const result = imageService.resolve(['https://cdn/banner.jpg'], catalog, true);

    expect(result.used_images).toHaveLength(1);
    expect(result.used_images[0].filename).toBe('banner.jpg');
    expect(result.unused_catalog_images).toEqual(['logo.png']);
    expect(result.missing_images).toEqual([]);
  });
});
