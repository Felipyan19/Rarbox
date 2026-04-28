const htmlService = require('../src/services/html.service');

describe('html.service', () => {
  test('extracts img and background refs', () => {
    const html = '<html><body><img src="a.jpg"><div style="background-image:url(https://cdn/a.png)"></div></body></html>';
    const refs = htmlService.extractImageRefs(html, {
      parse_img_src: true,
      parse_inline_background_images: true,
    });

    expect(refs).toEqual(['a.jpg', 'https://cdn/a.png']);
  });

  test('rewrites img src for standard delivery', () => {
    const html = '<html><body><img src="https://cdn/banner.jpg"></body></html>';
    const rewritten = htmlService.rewriteImageSrc(
      html,
      [{ filename: '2026.jpg', source: { type: 'url', value: 'https://cdn/banner.jpg' } }],
      'standard',
      { rewrite_image_src: true },
      new Map([['https://cdn/banner.jpg', ['2026.jpg']]])
    );

    expect(rewritten).toContain('src="images/2026.jpg"');
  });
});
