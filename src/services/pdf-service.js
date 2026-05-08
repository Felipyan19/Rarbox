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
  constructor(tempDir = '/tmp/utils-amex', gsBin = 'gs', htmlToPdfBin = 'wkhtmltopdf') {
    this.tempFileService = new TempFileService(tempDir);
    this.gsBin = gsBin;
    this.htmlToPdfBin = htmlToPdfBin;
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

  async getContentHeightMm(pdfPath) {
    let stderr = '';
    try {
      const result = await execFileAsync(this.gsBin, [
        '-dNOPAUSE', '-dBATCH', '-dQUIET', '-sDEVICE=bbox', pdfPath,
      ]);
      stderr = result.stderr || '';
    } catch (e) {
      stderr = (e && e.stderr) || '';
    }

    const match = stderr.match(/%%HiResBoundingBox:\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (!match) return null;

    const heightPt = parseFloat(match[4]) - parseFloat(match[2]);
    return Math.ceil(heightPt * 25.4 / 72 * 100) / 100;
  }

  async getPdfPageDimensions(pdfPath) {
    const { stdout } = await execFileAsync(this.gsBin, [
      '-q',
      '-dBATCH',
      '-dNOPAUSE',
      '-dNODISPLAY',
      '-c',
      `(${pdfPath}) (r) file runpdfbegin 1 pdfgetpage /MediaBox get == quit`,
    ]);

    const match = stdout.match(/\[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*\]/);
    if (!match) {
      throw new InternalError(`Could not parse PDF dimensions from Ghostscript output: ${stdout.trim()}`);
    }

    const widthPt = parseFloat(match[3]) - parseFloat(match[1]);
    const heightPt = parseFloat(match[4]) - parseFloat(match[2]);
    const ptToMm = 25.4 / 72;

    return {
      widthMm: Math.round(widthPt * ptToMm * 100) / 100,
      heightMm: Math.round(heightPt * ptToMm * 100) / 100,
    };
  }

  async htmlToPdf(request, html, requestId, dimensions = null) {
    const sessionDir = await this.tempFileService.initSession(requestId);
    const inputPath = path.join(sessionDir, 'input.html');
    const outputPath = path.join(sessionDir, 'output.pdf');

    await fs.writeFile(inputPath, html, { mode: 0o600 });
    request.log.info({ requestId, inputSize: html.length }, 'HTML written to temp');

    try {
      const pageWidthMm = dimensions?.widthMm ?? (process.env.HTML_PAGE_WIDTH_MM || '210');
      const pageHeightMm = dimensions?.heightMm ?? (process.env.HTML_PAGE_HEIGHT_MM || '2000');

      request.log.info({ requestId, pageWidthMm, pageHeightMm }, 'Rendering HTML to PDF with dimensions');

      await execFileAsync(this.htmlToPdfBin, [
        '--encoding',
        'utf-8',
        '--enable-local-file-access',
        '--margin-top',
        '0',
        '--margin-right',
        '0',
        '--margin-bottom',
        '0',
        '--margin-left',
        '0',
        '--page-width',
        `${pageWidthMm}mm`,
        '--page-height',
        `${pageHeightMm}mm`,
        inputPath,
        outputPath,
      ]);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new InternalError(
          `HTML to PDF binary "${this.htmlToPdfBin}" not found. Install wkhtmltopdf or configure HTML_TO_PDF_BIN.`
        );
      }
      throw new InternalError(`HTML to PDF conversion failed: ${error.stderr || error.message}`);
    }

    const outputBuffer = await fs.readFile(outputPath);
    request.log.info(
      { requestId, inputSize: html.length, outputSize: outputBuffer.length },
      'HTML converted to PDF'
    );

    return { sessionDir, buffer: outputBuffer };
  }

  async htmlToPdfWithFirstPageFromUrl(request, html, pdfUrl, requestId) {
    const sessionDir = await this.tempFileService.initSession(requestId);
    const sourcePdfPath = path.join(sessionDir, 'source.pdf');
    const firstPagePath = path.join(sessionDir, 'source-page-1.pdf');
    const htmlPath = path.join(sessionDir, 'input.html');
    const htmlPdfTallPath = path.join(sessionDir, 'html-tall.pdf');
    const htmlPdfPath = path.join(sessionDir, 'html.pdf');
    const outputPath = path.join(sessionDir, 'output.pdf');

    request.log.info({ requestId, pdfUrl }, 'Fetching source PDF for page 1');
    const sourcePdfBuffer = await this._fetchPdf(pdfUrl);
    await fs.writeFile(sourcePdfPath, sourcePdfBuffer, { mode: 0o600 });

    await fs.writeFile(htmlPath, html, { mode: 0o600 });
    request.log.info(
      { requestId, sourcePdfSize: sourcePdfBuffer.length, htmlSize: html.length },
      'Inputs written to temp'
    );

    let dimensions;
    try {
      dimensions = await this.getPdfPageDimensions(sourcePdfPath);
      request.log.info({ requestId, ...dimensions }, 'Detected source PDF page dimensions');
    } catch (error) {
      request.log.warn({ requestId, error: error.message }, 'Could not detect PDF dimensions, using defaults');
      dimensions = null;
    }

    try {
      await execFileAsync(this.gsBin, [
        '-dBATCH',
        '-dNOPAUSE',
        '-dQUIET',
        '-sDEVICE=pdfwrite',
        '-dFirstPage=1',
        '-dLastPage=1',
        `-sOutputFile=${firstPagePath}`,
        sourcePdfPath,
      ]);
    } catch (error) {
      throw new InternalError(`Failed extracting first page from source PDF: ${error.stderr || error.message}`);
    }

    const pageWidthMm = dimensions?.widthMm ?? (process.env.HTML_PAGE_WIDTH_MM || '210');
    const wkhtmlArgs = [
      '--encoding', 'utf-8',
      '--enable-local-file-access',
      '--margin-top', '0',
      '--margin-right', '0',
      '--margin-bottom', '0',
      '--margin-left', '0',
      '--page-width', `${pageWidthMm}mm`,
    ];

    try {
      // Pass 1: render with large height to capture full content
      await execFileAsync(this.htmlToPdfBin, [
        ...wkhtmlArgs, '--page-height', '10000mm', htmlPath, htmlPdfTallPath,
      ]);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new InternalError(
          `HTML to PDF binary "${this.htmlToPdfBin}" not found. Install wkhtmltopdf or configure HTML_TO_PDF_BIN.`
        );
      }
      throw new InternalError(`HTML to PDF conversion failed: ${error.stderr || error.message}`);
    }

    // Detect actual content height from pass 1
    let pageHeightMm;
    try {
      const detected = await this.getContentHeightMm(htmlPdfTallPath);
      if (detected && detected > 0) {
        pageHeightMm = detected;
        request.log.info({ requestId, pageWidthMm, pageHeightMm }, 'Auto-detected HTML content height');
      }
    } catch (_) { /* fall through to default */ }

    if (!pageHeightMm) {
      pageHeightMm = dimensions?.heightMm ?? (process.env.HTML_PAGE_HEIGHT_MM || '2000');
      request.log.warn({ requestId, pageHeightMm }, 'Using fallback height for HTML rendering');
    }

    try {
      // Pass 2: render with exact detected height
      await execFileAsync(this.htmlToPdfBin, [
        ...wkhtmlArgs, '--page-height', `${pageHeightMm}mm`, htmlPath, htmlPdfPath,
      ]);
    } catch (error) {
      throw new InternalError(`HTML to PDF conversion failed (pass 2): ${error.stderr || error.message}`);
    }

    try {
      await execFileAsync(this.gsBin, [
        '-dBATCH',
        '-dNOPAUSE',
        '-dQUIET',
        '-sDEVICE=pdfwrite',
        `-sOutputFile=${outputPath}`,
        firstPagePath,
        htmlPdfPath,
      ]);
    } catch (error) {
      throw new InternalError(`Failed merging source page with HTML PDF: ${error.stderr || error.message}`);
    }

    const outputBuffer = await fs.readFile(outputPath);
    request.log.info({ requestId, outputSize: outputBuffer.length }, 'Final 2-page PDF generated');

    return { sessionDir, buffer: outputBuffer };
  }
}

module.exports = PdfService;
