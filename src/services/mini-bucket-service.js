const fs = require('fs').promises;
const { InternalError } = require('../utils/errors');

const MINI_BUCKET_URL = process.env.MINI_BUCKET_URL || 'http://149.130.164.187:2020';
const UPLOAD_TIMEOUT_MS = 30000;

class MiniBucketService {
  constructor(baseUrl = MINI_BUCKET_URL) {
    this.baseUrl = baseUrl;
  }

  async uploadFile(filePath, filename, exp = null) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    try {
      const fileBuffer = await fs.readFile(filePath);

      // Determine content type from filename extension
      let contentType = 'application/octet-stream';
      const ext = filename.toLowerCase().split('.').pop();
      if (ext === 'pdf') {
        contentType = 'application/pdf';
      } else if (ext === 'png') {
        contentType = 'image/png';
      } else if (ext === 'jpg' || ext === 'jpeg') {
        contentType = 'image/jpeg';
      } else if (ext === 'gif') {
        contentType = 'image/gif';
      } else if (ext === 'webp') {
        contentType = 'image/webp';
      }

      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer], { type: contentType }), filename);
      formData.append('exp', exp !== null && exp !== undefined ? String(exp) : '');

      const response = await fetch(`${this.baseUrl}/files`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new InternalError(`Failed to upload file to mini bucket: HTTP ${response.status}`);
      }

      const result = await response.json();

      return {
        id: result.id,
        filename: result.filename,
        url: `${this.baseUrl}/files/download/by-name/${encodeURIComponent(result.filename)}`,
        contentType: result.content_type,
        size: result.size,
        expiresAt: result.expires_at,
      };
    } catch (error) {
      if (error.statusCode) throw error;
      if (error.name === 'AbortError') {
        throw new InternalError('Mini bucket upload timed out');
      }
      throw new InternalError(`Failed to upload to mini bucket: ${error.message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  getDownloadUrl(filename) {
    return `${this.baseUrl}/files/download/by-name/${encodeURIComponent(filename)}`;
  }
}

module.exports = MiniBucketService;
