const DEFAULT_CONFIG = {
  rewrite_image_src: true,
  remove_test_suffixes_from_artifact_name: true,
  use_html_as_single_source_of_truth: true,
  generate_txt_from_html: true,
  preserve_case: true,
  strict_url_match: true,
  include_visible_text_in_txt: true,
  include_alt_text_in_txt: true,
  include_image_text_in_txt: true,
  include_legals_in_txt: true,
  use_block_separators_in_txt: true,
  txt_url_format_standard: 'newline',
  txt_url_format_centurion: 'parentheses',
  ignore_unused_catalog_images: true,
  report_unused_catalog_images: true,
  validate_required_variables: true,
  required_variables: [],
  parse_inline_background_images: true,
  parse_img_src: true,
  allow_html_cleanup: false,
  remove_html_comments: false,
  normalize_special_characters: false,
};

module.exports = {
  DEFAULT_CONFIG,
};
