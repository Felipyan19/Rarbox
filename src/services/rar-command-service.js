const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const { ServiceUnavailableError, InternalError } = require('../utils/errors');

const execAsync = promisify(exec);

class RarCommandService {
  constructor(rarBin = process.env.ZIP_BIN || 'zip', timeoutMs = 15000) {
    this.rarBin = rarBin;
    this.timeoutMs = timeoutMs;
  }

  async validateBinary(requestId) {
    try {
      logger.debug({ requestId, zipBin: this.rarBin }, 'Validating ZIP binary');
      await execAsync(`${this.rarBin} --version`, { timeout: 5000 });
      logger.info({ requestId, zipBin: this.rarBin }, 'ZIP binary validated');
      return true;
    } catch (error) {
      logger.error(
        { err: error, zipBin: this.rarBin, requestId },
        'ZIP binary validation failed'
      );
      throw new ServiceUnavailableError(
        `ZIP binary not available at ${this.rarBin}`
      );
    }
  }

  async createArchive(sessionDir, archiveName, requestId) {
    const outputPath = path.join(sessionDir, `${archiveName}.zip`);

    try {
      logger.info(
        { requestId, sessionDir, archiveName, outputPath },
        'Starting ZIP compression'
      );

      await this.validateBinary(requestId);

      // Use zip to create zip archive
      const command = `cd "${sessionDir}" && zip -r -q "${outputPath}" .`;

      logger.debug({ requestId, command }, 'Executing archive command');

      await execAsync(command, {
        timeout: this.timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      });

      const stats = await fs.stat(outputPath);

      logger.info(
        { requestId, outputPath, size: stats.size },
        'Archive created successfully'
      );

      return outputPath;
    } catch (error) {
      if (error.code === 'ETIMEDOUT') {
        logger.error({ requestId, archiveName }, 'Archive compression timeout');
        throw new InternalError('Archive compression timed out');
      }

      logger.error(
        { err: error, sessionDir, archiveName, requestId },
        'Archive compression failed'
      );

      throw new InternalError(`Failed to create archive: ${error.message}`);
    }
  }
}

module.exports = RarCommandService;
