const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { InternalError } = require('../utils/errors');

class TempFileService {
  constructor(tempDir = '/tmp/rarbox') {
    this.tempDir = tempDir;
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error({ err: error, tempDir: this.tempDir }, 'Failed to create temp directory');
      throw new InternalError('Failed to initialize temporary directory');
    }
  }

  createSessionDir() {
    return path.join(this.tempDir, uuidv4());
  }

  async initSession(requestId) {
    await this.ensureTempDir();

    const sessionDir = this.createSessionDir();

    try {
      await fs.mkdir(sessionDir, { recursive: true, mode: 0o700 });
      logger.info({ requestId, sessionDir }, 'Temp session created');
      return sessionDir;
    } catch (error) {
      logger.error({ err: error, sessionDir, requestId }, 'Failed to create session directory');
      throw new InternalError('Failed to create temporary session');
    }
  }

  async writeFile(sessionDir, filename, content, requestId) {
    const filePath = path.join(sessionDir, filename);

    const relativePath = path.relative(sessionDir, filePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error('Invalid file path: path traversal detected');
    }

    try {
      await fs.writeFile(filePath, content, { flag: 'w', mode: 0o600 });
      logger.debug({ requestId, filename, size: content.length }, 'File written to temp directory');
      return filePath;
    } catch (error) {
      logger.error({ err: error, filePath, requestId }, 'Failed to write file');
      throw new InternalError(`Failed to write file: ${filename}`);
    }
  }

  async cleanup(sessionDir, requestId, force = false) {
    if (!sessionDir) {
      return;
    }

    try {
      const stats = await fs.stat(sessionDir);
      if (!stats.isDirectory()) {
        logger.warn({ requestId, sessionDir }, 'Cleanup path is not a directory');
        return;
      }

      const files = await fs.readdir(sessionDir, { withFileTypes: true });

      for (const file of files) {
        const filePath = path.join(sessionDir, file.name);
        if (file.isDirectory()) {
          await this.cleanup(filePath, requestId, force);
        } else {
          await fs.unlink(filePath);
        }
      }

      await fs.rmdir(sessionDir);
      logger.info({ requestId, sessionDir }, 'Temp session cleaned up');
    } catch (error) {
      if (!force) {
        logger.warn({ err: error, sessionDir, requestId }, 'Failed to cleanup temp session');
        return;
      }
      logger.error({ err: error, sessionDir, requestId }, 'Failed to cleanup temp session (forced)');
    }
  }

  async getSessionFiles(sessionDir) {
    try {
      const files = await fs.readdir(sessionDir, { withFileTypes: true });
      return files
        .filter((f) => f.isFile())
        .map((f) => ({
          name: f.name,
          path: path.join(sessionDir, f.name),
        }));
    } catch (error) {
      logger.error({ err: error, sessionDir }, 'Failed to read session files');
      throw new InternalError('Failed to read session files');
    }
  }
}

module.exports = TempFileService;
