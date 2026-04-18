const logger = require('../utils/logger');
const TempFileService = require('./temp-file-service');
const RarCommandService = require('./rar-command-service');
const { InternalError } = require('../utils/errors');

class ArchiveService {
  constructor(
    tempDir = process.env.TEMP_DIR || '/tmp/rarbox',
    rarBin = process.env.RAR_BIN || 'rar'
  ) {
    this.tempFileService = new TempFileService(tempDir);
    this.rarCommandService = new RarCommandService(
      rarBin,
      parseInt(process.env.REQUEST_TIMEOUT_MS || '15000', 10)
    );
  }

  async generateArchive(request, archiveName, files, requestId) {
    let sessionDir;
    let archivePath;

    try {
      sessionDir = await this.tempFileService.initSession(requestId);

      logger.info({ requestId, sessionDir, archiveName }, 'Starting archive generation');

      await this.tempFileService.writeFile(
        sessionDir,
        files.html.filename,
        files.html.content,
        requestId
      );

      await this.tempFileService.writeFile(
        sessionDir,
        files.text.filename,
        files.text.content,
        requestId
      );

      logger.info({ requestId, sessionDir }, 'Files written to temporary directory');

      archivePath = await this.rarCommandService.createArchive(
        sessionDir,
        archiveName,
        requestId
      );

      logger.info({ requestId, archivePath }, 'Archive compression completed');

      return {
        sessionDir,
        archiveName,
        archivePath,
        files: {
          html: files.html.filename,
          text: files.text.filename,
        },
      };
    } catch (error) {
      if (sessionDir) {
        await this.tempFileService.cleanup(sessionDir, requestId, true);
      }
      throw error;
    }
  }

  async cleanup(sessionDir, requestId) {
    if (sessionDir) {
      await this.tempFileService.cleanup(sessionDir, requestId);
    }
  }
}

module.exports = ArchiveService;
