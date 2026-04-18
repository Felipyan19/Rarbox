const logger = require('../utils/logger');
const TempFileService = require('./temp-file-service');
const { InternalError } = require('../utils/errors');

class ArchiveService {
  constructor(tempDir = process.env.TEMP_DIR || '/tmp/rarbox') {
    this.tempFileService = new TempFileService(tempDir);
  }

  async generateArchive(request, archiveName, files, requestId) {
    let sessionDir;

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

      return {
        sessionDir,
        archiveName,
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
