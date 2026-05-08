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

  test('uses blank lines around asterisk separators between blocks', () => {
    const html = `
      <!-- START: Block 1 -->
      <p>Primer bloque</p>
      <!-- END: Block 1 -->
      <!-- START: Block 2 -->
      <p>Segundo bloque</p>
      <!-- END: Block 2 -->
    `;

    const result = prepare(buildInput(html));
    const txt = result.txt;

    expect(txt).toContain('Primer bloque');
    expect(txt).toContain('Segundo bloque');
    expect(txt).toContain('Primer bloque\n\n************************************************************************\n\nSegundo bloque');
  });

  test('keeps visually continuous text in a single line across inline tags and br', () => {
    const html = `
      <!-- START: Hero -->
      <p>
        Disfrute de restaurantes destacados. En <strong>abril</strong><br />
        lo invitamos a descubrir propuestas de <strong>Ultramarinos</strong>.
      </p>
      <!-- END: Hero -->
    `;

    const result = prepare(buildInput(html));
    const txt = result.txt;

    expect(txt).toContain('Disfrute de restaurantes destacados. En abril lo invitamos a descubrir propuestas de Ultramarinos.');
    expect(txt).not.toContain('En\nabril');
    expect(txt).not.toContain('abril\nlo invitamos');
  });
});
