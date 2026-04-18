const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const { ServiceUnavailableError, InternalError } = require('../utils/errors');

const execAsync = promisify(exec);

class RarCommandService {
  constructor(rarBin = process.env.RAR_BIN || 'rar', timeoutMs = 15000) {
    this.rarBin = rarBin;
    this.timeoutMs = timeoutMs;
  }

  async validateBinary(requestId) {
    try {
      logger.debug({ requestId, rarBin: this.rarBin }, 'Validating RAR binary');
      await execAsync(`${this.rarBin} --version`, { timeout: 5000 });
      logger.info({ requestId, rarBin: this.rarBin }, 'RAR binary validated');
      return true;
    } catch (error) {
      logger.error(
        { err: error, rarBin: this.rarBin, requestId },
        'RAR binary validation failed'
      );
      throw new ServiceUnavailableError(
        `RAR binary not available at ${this.rarBin}`
      );
    }
  }

  async createArchive(sessionDir, archiveName, requestId) {
    const outputPath = path.join(sessionDir, `${archiveName}.rar`);

    try {
      logger.info(
        { requestId, sessionDir, archiveName, outputPath },
        'Starting RAR compression'
      );

      await this.validateBinary(requestId);

      const command = `${this.rarBin} a -ep1 "${outputPath}" "${sessionDir}"/*`;

      logger.debug({ requestId, command }, 'Executing RAR command');

      await execAsync(command, {
        timeout: this.timeoutMs,
        cwd: sessionDir,
        maxBuffer: 10 * 1024 * 1024,
      });

      const stats = await fs.stat(outputPath);

      logger.info(
        { requestId, outputPath, size: stats.size },
        'RAR archive created successfully'
      );

      return outputPath;
    } catch (error) {
      if (error.code === 'ETIMEDOUT') {
        logger.error({ requestId, archiveName }, 'RAR compression timeout');
        throw new InternalError('RAR compression timed out');
      }

      logger.error(
        { err: error, sessionDir, archiveName, requestId },
        'RAR compression failed'
      );

      throw new InternalError(`Failed to create RAR archive: ${error.message}`);
    }
  }
}

module.exports = RarCommandService;
