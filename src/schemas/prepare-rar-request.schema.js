const { z } = require('zod');

const sourceSchema = z.object({
  type: z.enum(['url', 'base64']),
  value: z.string().min(1, 'source.value is required'),
});

const imageCatalogItemSchema = z.object({
  filename: z.string().min(1, 'filename is required'),
  source: sourceSchema,
});

const configSchema = z.object({
  rewrite_image_src: z.boolean().optional(),
  remove_test_suffixes_from_artifact_name: z.boolean().optional(),
  use_html_as_single_source_of_truth: z.boolean().optional(),
  generate_txt_from_html: z.boolean().optional(),
  preserve_case: z.boolean().optional(),
  strict_url_match: z.boolean().optional(),
  include_visible_text_in_txt: z.boolean().optional(),
  include_alt_text_in_txt: z.boolean().optional(),
  include_image_text_in_txt: z.boolean().optional(),
  include_legals_in_txt: z.boolean().optional(),
  use_block_separators_in_txt: z.boolean().optional(),
  txt_url_format_standard: z.enum(['newline', 'parentheses']).optional(),
  txt_url_format_centurion: z.enum(['newline', 'parentheses']).optional(),
  ignore_unused_catalog_images: z.boolean().optional(),
  report_unused_catalog_images: z.boolean().optional(),
  validate_required_variables: z.boolean().optional(),
  required_variables: z.array(z.string()).optional(),
  parse_inline_background_images: z.boolean().optional(),
  parse_img_src: z.boolean().optional(),
  allow_html_cleanup: z.boolean().optional(),
  remove_html_comments: z.boolean().optional(),
  normalize_special_characters: z.boolean().optional(),
}).partial();

const prepareRarRequestSchema = z.object({
  artifact_name: z.string().min(1, 'artifact_name is required'),
  delivery_type: z.string().min(1, 'delivery_type is required'),
  html: z.string().min(1, 'html is required'),
  images_catalog: z.array(imageCatalogItemSchema).default([]),
  config: configSchema.optional().default({}),
});

const validatePrepareRarRequest = (data) => {
  try {
    return prepareRarRequestSchema.parse(data);
  } catch (error) {
    const formatted = error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    throw new Error(JSON.stringify(formatted));
  }
};

module.exports = {
  prepareRarRequestSchema,
  validatePrepareRarRequest,
};
