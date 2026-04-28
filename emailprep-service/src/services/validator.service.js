const cheerio = require('cheerio');

const normalizeForComparison = (value) =>
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const calculateMatchScore = (htmlText, txtText) => {
  const htmlWords = new Set(normalizeForComparison(htmlText).split(' ').filter(Boolean));
  const txtWords = new Set(normalizeForComparison(txtText).split(' ').filter(Boolean));

  if (htmlWords.size === 0 || txtWords.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const word of htmlWords) {
    if (txtWords.has(word)) {
      intersection++;
    }
  }

  return intersection / htmlWords.size;
};

const validate = ({
  artifact_name,
  delivery_type,
  html,
  txt,
  missing_images,
  duplicated_filenames,
  config,
}) => {
  const $ = cheerio.load(html);
  const htmlText = $('body').text() || $.root().text();

  const score = calculateMatchScore(htmlText, txt);
  const txtMatchesHtml = score >= 0.5;

  const brokenVariables = [];

  if (config.validate_required_variables) {
    for (const variable of config.required_variables || []) {
      if (!html.includes(variable)) {
        brokenVariables.push(variable);
      }
    }
  }

  const packagingReady =
    Boolean(artifact_name && artifact_name.trim()) &&
    ['standard', 'centurion'].includes(delivery_type) &&
    Boolean(html && html.trim()) &&
    Boolean(txt && txt.trim()) &&
    missing_images.length === 0 &&
    duplicated_filenames.length === 0 &&
    brokenVariables.length === 0 &&
    txtMatchesHtml;

  return {
    missing_images,
    duplicated_filenames,
    broken_variables: brokenVariables,
    txt_matches_html: txtMatchesHtml,
    packaging_ready: packagingReady,
  };
};

module.exports = {
  validate,
};
