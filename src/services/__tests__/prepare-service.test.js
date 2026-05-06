const { prepare } = require('../prepare-service');

const buildInput = (html) => ({
  artifact_name: 'campaign_test',
  delivery_type: 'standard',
  html,
  images_catalog: [],
  config: {
    required_variables: [],
  },
});

describe('prepare-service comment-delimited parsing', () => {
  test('uses START/END comment blocks as source for txt extraction', () => {
    const html = `
      <div>OUTSIDE BLOCK TEXT SHOULD NOT APPEAR</div>
      <!-- START: PH01 Preheader Text -->
      <p>Preheader message</p>
      <!-- END: PH01 Preheader Text -->
      <div>ANOTHER OUTSIDE TEXT</div>
      <!-- START: Hero Banner -->
      <p>Hero copy line</p>
      <a href="https://example.com/hero">Open Hero</a>
      <!-- END: Hero Banner -->
    `;

    const result = prepare(buildInput(html));
    const txt = result.txt;

    expect(txt).toContain('PUBLICIDAD');
    expect(txt).toContain('Preheader message');
    expect(txt).toContain('Hero copy line');
    expect(txt).toContain('Open Hero');
    expect(txt).not.toContain('OUTSIDE BLOCK TEXT SHOULD NOT APPEAR');
    expect(txt).not.toContain('ANOTHER OUTSIDE TEXT');
  });

  test('falls back to full html extraction when no START/END comments are present', () => {
    const html = `
      <p>Regular paragraph</p>
      <a href="https://example.com/path">Regular link</a>
    `;

    const result = prepare(buildInput(html));
    const txt = result.txt;

    expect(txt).toContain('PUBLICIDAD');
    expect(txt).toContain('Regular paragraph');
    expect(txt).toContain('Regular link');
  });
});
