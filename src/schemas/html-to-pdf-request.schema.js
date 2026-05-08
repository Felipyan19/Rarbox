const { z } = require('zod');

const htmlToPdfRequestSchema = z.object({
  html: z.string().min(1, 'html is required'),
  pdf_url: z.string().url('pdf_url must be a valid URL').optional(),
  downloadName: z
    .string()
    .max(255, 'downloadName must be at most 255 characters')
    .optional(),
});

const validateHtmlToPdfRequest = (data) => {
  try {
    return htmlToPdfRequestSchema.parse(data);
  } catch (error) {
    const formatted = error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    throw new Error(JSON.stringify(formatted));
  }
};

module.exports = { htmlToPdfRequestSchema, validateHtmlToPdfRequest };
