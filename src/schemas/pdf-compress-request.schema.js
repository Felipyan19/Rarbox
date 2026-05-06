const { z } = require('zod');

const pdfCompressRequestSchema = z.object({
  url: z.string().url('url must be a valid URL'),
  quality: z.enum(['screen', 'ebook', 'printer']).default('ebook'),
  downloadName: z
    .string()
    .max(255, 'downloadName must be at most 255 characters')
    .optional(),
});

const validatePdfCompressRequest = (data) => {
  try {
    return pdfCompressRequestSchema.parse(data);
  } catch (error) {
    const formatted = error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    throw new Error(JSON.stringify(formatted));
  }
};

module.exports = { pdfCompressRequestSchema, validatePdfCompressRequest };
