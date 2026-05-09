const { z } = require('zod');

const pdfExtractImagesRequestSchema = z.object({
  url: z.string().url('url must be a valid URL'),
  exp: z.number().int().positive().optional(),
});

const validatePdfExtractImagesRequest = (data) => {
  try {
    return pdfExtractImagesRequestSchema.parse(data);
  } catch (error) {
    const formatted = error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    throw new Error(JSON.stringify(formatted));
  }
};

module.exports = { pdfExtractImagesRequestSchema, validatePdfExtractImagesRequest };
