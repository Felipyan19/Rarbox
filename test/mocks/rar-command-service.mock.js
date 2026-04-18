const fs = require('fs').promises;
const path = require('path');

class MockRarCommandService {
  constructor() {
    this.rarBin = 'mock-rar';
    this.timeoutMs = 15000;
  }

  async validateBinary() {
    return true;
  }

  async createArchive(sessionDir, archiveName) {
    const outputPath = path.join(sessionDir, `${archiveName}.rar`);

    // Create a fake RAR file with minimal content
    const mockContent = Buffer.from(
      'Rar!\x1a\x07\x00' + // RAR header
        'mock archive content for testing'
    );

    await fs.writeFile(outputPath, mockContent);
    return outputPath;
  }
}

module.exports = MockRarCommandService;
