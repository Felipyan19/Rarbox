const cheerio = require('cheerio');

const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'p', 'span', 'div', 'td', 'li', 'a']);
const LEGAL_PATTERN = /(legal|disclaimer|footnote)/i;

const normalizeWhitespace = (value) => value.replace(/\s+/g, ' ').trim();

const ownText = (node) => {
  let text = '';
  for (const child of node.children || []) {
    if (child.type === 'text' && child.data) {
      text += child.data;
    }
  }
  return normalizeWhitespace(text);
};

const formatLink = (text, href, deliveryType, config) => {
  if (!href) {
    return text;
  }

  const format = deliveryType === 'centurion'
    ? config.txt_url_format_centurion
    : config.txt_url_format_standard;

  if (format === 'parentheses') {
    return text ? `${text} (${href})` : href;
  }

  return text ? `${text}\n${href}` : href;
};

const generate = (html, deliveryType, config) => {
  const $ = cheerio.load(html, { decodeEntities: false });
  const blocks = [];

  $('*').each((_, el) => {
    const tagName = (el.tagName || '').toLowerCase();
    if (!tagName) {
      return;
    }

    if (TEXT_TAGS.has(tagName) && config.include_visible_text_in_txt) {
      const text = ownText(el);
      if (text) {
        if (tagName === 'a') {
          const href = $(el).attr('href') || '';
          blocks.push(formatLink(text, href, deliveryType, config));
        } else {
          blocks.push(text);
        }
      }
    }

    if (tagName === 'img') {
      if (config.include_alt_text_in_txt) {
        const alt = normalizeWhitespace($(el).attr('alt') || '');
        if (alt) {
          blocks.push(alt);
        }
      }

      if (config.include_image_text_in_txt) {
        const title = normalizeWhitespace($(el).attr('title') || '');
        if (title) {
          blocks.push(title);
        }
      }
    }

    if (config.include_legals_in_txt) {
      const classAttr = $(el).attr('class') || '';
      const idAttr = $(el).attr('id') || '';
      if (LEGAL_PATTERN.test(classAttr) || LEGAL_PATTERN.test(idAttr)) {
        const text = normalizeWhitespace($(el).text());
        if (text) {
          blocks.push(text);
        }
      }
    }
  });

  const deduped = [];
  const seen = new Set();

  for (const block of blocks) {
    const value = normalizeWhitespace(block);
    if (!value) {
      continue;
    }

    const key = config.preserve_case ? value : value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(config.preserve_case ? value : value.toLowerCase());
  }

  const separator = config.use_block_separators_in_txt ? '\n**********\n' : '\n';

  return deduped.join(separator);
};

module.exports = {
  generate,
};
