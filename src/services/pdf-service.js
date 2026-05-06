const fs = require('fs').promises;
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const TempFileService = require('./temp-file-service');
const { ValidationError, InternalError } = require('../utils/errors');

const execFileAsync = promisify(execFile);
const FETCH_TIMEOUT_MS = 30000;

const QUALITY_SETTINGS = {
  screen: '/screen',
  ebook: '/ebook',
  printer: '/printer',
};

class PdfService {
  constructor(tempDir = '/tmp/utils-amex', gsBin = 'gs') {
    this.tempFileService = new TempFileService(tempDir);
    this.gsBin = gsBin;
  }

  async _fetchPdf(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new ValidationError(`Failed to fetch PDF: HTTP ${response.status}`);
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('pdf') && !url.toLowerCase().endsWith('.pdf')) {
        throw new ValidationError('URL does not appear to point to a PDF file');
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error.statusCode) throw error;
      if (error.name === 'AbortError') {
        throw new ValidationError('PDF fetch timed out');
      }
      throw new ValidationError(`Failed to fetch PDF: ${error.message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  async compressFirstPage(request, url, quality, requestId) {
    let sessionDir;

    const pdfSettings = QUALITY_SETTINGS[quality] || '/ebook';

    sessionDir = await this.tempFileService.initSession(requestId);

    const inputPath = path.join(sessionDir, 'input.pdf');
    const outputPath = path.join(sessionDir, 'output.pdf');

    request.log.info({ requestId, url, quality }, 'Fetching PDF');
    const pdfBuffer = await this._fetchPdf(url);

    await fs.writeFile(inputPath, pdfBuffer, { mode: 0o600 });
    request.log.info({ requestId, inputSize: pdfBuffer.length }, 'PDF written to temp');

    try {
      await execFileAsync(this.gsBin, [
        '-dBATCH',
        '-dNOPAUSE',
        '-dQUIET',
        '-sDEVICE=pdfwrite',
        `-dPDFSETTINGS=${pdfSettings}`,
        '-dFirstPage=1',
        '-dLastPage=1',
        `-sOutputFile=${outputPath}`,
        inputPath,
      ]);
    } catch (error) {
      throw new InternalError(`Ghostscript failed: ${error.stderr || error.message}`);
    }

    const outputBuffer = await fs.readFile(outputPath);
    request.log.info(
      { requestId, inputSize: pdfBuffer.length, outputSize: outputBuffer.length },
      'PDF compressed'
    );

    return { sessionDir, buffer: outputBuffer };
  }

  async cleanup(sessionDir, requestId) {
    await this.tempFileService.cleanup(sessionDir, requestId);
  }
}

module.exports = PdfService;
