const { z } = require('zod');

const rarRequestSchema = z.object({
  archiveName: z
    .string()
    .min(1, 'archiveName is required')
    .max(255, 'archiveName must be at most 255 characters')
    .regex(/^[\w\-]+$/, 'archiveName can only contain letters, numbers, hyphens, and underscores'),

  files: z.object({
    html: z.object({
      filename: z
        .string()
        .max(255, 'filename must be at most 255 characters')
        .refine((v) => v.endsWith('.html'), 'html filename must end with .html')
        .optional()
        .default('index.html'),

      content: z
        .string()
        .min(1, 'html content is required')
        .max(5 * 1024 * 1024, 'html content is too large'),
    }),

    text: z.object({
      filename: z
        .string()
        .max(255, 'filename must be at most 255 characters')
        .refine((v) => v.endsWith('.txt'), 'text filename must end with .txt')
        .optional()
        .default('content.txt'),

      content: z
        .string()
        .min(1, 'text content is required')
        .max(5 * 1024 * 1024, 'text content is too large'),
    }),
  }),

  options: z
    .object({
      cleanup: z.boolean().optional().default(true),
      downloadName: z
        .string()
        .max(255, 'downloadName must be at most 255 characters')
        .optional(),
    })
    .optional()
    .default({}),
});

const validateRarRequest = (data) => {
  try {
    return rarRequestSchema.parse(data);
  } catch (error) {
    const formatted = error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    throw new Error(JSON.stringify(formatted));
  }
};

module.exports = {
  rarRequestSchema,
  validateRarRequest,
};
