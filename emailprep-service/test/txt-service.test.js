const txtService = require('../src/services/txt.service');

describe('txt.service', () => {
  test('generates txt with separators and visible text', () => {
    const html = '<html><body><h1>No vivas la vida sin ella</h1><p>Publicidad</p></body></html>';
    const txt = txtService.generate(html, 'standard', {
      include_visible_text_in_txt: true,
      include_alt_text_in_txt: true,
      include_image_text_in_txt: true,
      include_legals_in_txt: true,
      preserve_case: true,
      use_block_separators_in_txt: true,
      txt_url_format_standard: 'newline',
      txt_url_format_centurion: 'parentheses',
    });

    expect(txt).toContain('No vivas la vida sin ella');
    expect(txt).toContain('Publicidad');
    expect(txt).toContain('**********');
  });
});
