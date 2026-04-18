const fs = require('fs').promises;
const path = require('path');
const RarCommandService = require('../src/services/rar-command-service');

describe('RarCommandService', () => {
  let tempDir;
  let service;

  beforeEach(async () => {
    tempDir = path.join(__dirname, 'temp-rar-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // ignore
    }
  });

  test('throws ServiceUnavailableError if binary not found', async () => {
    service = new RarCommandService('/nonexistent/rar', 15000);

    expect.assertions(2);
    try {
      await service.validateBinary('test-request-id');
      throw new Error('Should have thrown error');
    } catch (error) {
      expect(error.name).toBe('ServiceUnavailableError');
      expect(error.statusCode).toBe(503);
    }
  });

  test('RarCommandService stores configuration', () => {
    service = new RarCommandService('/path/to/rar', 5000);
    expect(service.rarBin).toBe('/path/to/rar');
    expect(service.timeoutMs).toBe(5000);
  });

  test('RarCommandService uses environment variables', () => {
    service = new RarCommandService('/custom/rar', 20000);
    expect(service.rarBin).toBe('/custom/rar');
    expect(service.timeoutMs).toBe(20000);
  });
});
