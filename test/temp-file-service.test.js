const fs = require('fs').promises;
const path = require('path');
const TempFileService = require('../src/services/temp-file-service');

describe('TempFileService', () => {
  let tempDir;
  let service;

  beforeEach(() => {
    tempDir = path.join(__dirname, 'temp-test-' + Date.now());
    service = new TempFileService(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // ignore
    }
  });

  test('creates temp directory if it does not exist', async () => {
    await service.ensureTempDir();
    const stats = await fs.stat(tempDir);
    expect(stats.isDirectory()).toBe(true);
  });

  test('creates session directory with UUID', async () => {
    await service.ensureTempDir();
    const sessionDir = service.createSessionDir();
    expect(sessionDir).toContain(tempDir);
    expect(sessionDir.length).toBeGreaterThan(tempDir.length);
  });

  test('initializes a session with proper permissions', async () => {
    const sessionDir = await service.initSession('test-request-id');
    const stats = await fs.stat(sessionDir);
    expect(stats.isDirectory()).toBe(true);
  });

  test('writes file to session directory', async () => {
    const sessionDir = await service.initSession('test-request-id');
    const content = 'Test file content';
    const filename = 'test.txt';

    const filePath = await service.writeFile(sessionDir, filename, content, 'test-request-id');

    const fileContent = await fs.readFile(filePath, 'utf-8');
    expect(fileContent).toBe(content);
  });

  test('prevents path traversal attacks', async () => {
    const sessionDir = await service.initSession('test-request-id');

    try {
      await service.writeFile(sessionDir, '../../../etc/passwd', 'content', 'test-request-id');
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).toContain('path traversal');
    }
  });

  test('cleans up session directory and files', async () => {
    const sessionDir = await service.initSession('test-request-id');
    await service.writeFile(sessionDir, 'file1.txt', 'content1', 'test-request-id');
    await service.writeFile(sessionDir, 'file2.txt', 'content2', 'test-request-id');

    await service.cleanup(sessionDir, 'test-request-id');

    try {
      await fs.stat(sessionDir);
      fail('Session directory should have been deleted');
    } catch (error) {
      expect(error.code).toBe('ENOENT');
    }
  });

  test('lists files in session directory', async () => {
    const sessionDir = await service.initSession('test-request-id');
    await service.writeFile(sessionDir, 'file1.txt', 'content1', 'test-request-id');
    await service.writeFile(sessionDir, 'file2.txt', 'content2', 'test-request-id');

    const files = await service.getSessionFiles(sessionDir);

    expect(files.length).toBe(2);
    expect(files.map((f) => f.name)).toContain('file1.txt');
    expect(files.map((f) => f.name)).toContain('file2.txt');
  });
});
