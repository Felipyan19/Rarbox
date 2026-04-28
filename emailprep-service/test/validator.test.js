const validatorService = require('../src/services/validator.service');

describe('validator.service', () => {
  test('flags missing required variables', () => {
    const result = validatorService.validate({
      artifact_name: 'travel',
      delivery_type: 'standard',
      html: '<html><body><h1>Hola</h1></body></html>',
      txt: 'Hola',
      missing_images: [],
      duplicated_filenames: [],
      config: {
        validate_required_variables: true,
        required_variables: ['{{FIRST_NAME}}'],
      },
    });

    expect(result.broken_variables).toEqual(['{{FIRST_NAME}}']);
    expect(result.packaging_ready).toBe(false);
  });
});
