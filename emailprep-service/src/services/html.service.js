const cheerio = require('cheerio');

const BACKGROUND_IMAGE_PATTERN = /background-image\s*:\s*url\((['"]?)(.*?)\1\)/ig;

const extractBackgroundRefs = (styleValue) => {
  if (!styleValue) {
    return [];
  }

  const refs = [];
  let match = BACKGROUND_IMAGE_PATTERN.exec(styleValue);

  while (match) {
    if (match[2]) {
      refs.push(match[2]);
    }
    match = BACKGROUND_IMAGE_PATTERN.exec(styleValue);
  }

  BACKGROUND_IMAGE_PATTERN.lastIndex = 0;

  return refs;
};

const extractImageRefs = (html, config) => {
  const refs = [];
  const $ = cheerio.load(html, { decodeEntities: false });

  if (config.parse_img_src) {
    $('img').each((_, el) => {
      const src = ($(el).attr('src') || '').trim();
      if (src) {
        refs.push(src);
      }
    });
  }

  if (config.parse_inline_background_images) {
    $('[style]').each((_, el) => {
      const style = $(el).attr('style') || '';
      refs.push(...extractBackgroundRefs(style));
    });
  }

  return refs;
};

const rewriteBackgroundStyle = (styleValue, replacementLookup) => {
  if (!styleValue) {
    return styleValue;
  }

  return styleValue.replace(BACKGROUND_IMAGE_PATTERN, (fullMatch, quote, refValue) => {
    const replacement = replacementLookup.get(refValue);
    if (!replacement) {
      return fullMatch;
    }

    return `background-image:url(${quote || ''}${replacement}${quote || ''})`;
  });
};

const rewriteImageSrc = (html, usedImages, deliveryType, config, refMatches = new Map()) => {
  if (!config.rewrite_image_src) {
    return html;
  }

  const $ = cheerio.load(html, { decodeEntities: false });
  const imageByFilename = new Map(usedImages.map((item) => [item.filename, item]));
  const replacementLookup = new Map();

  for (const [originalRef, matchedFilenames] of refMatches.entries()) {
    const filename = matchedFilenames[0];
    if (!filename || !imageByFilename.has(filename)) {
      continue;
    }

    const newPath = deliveryType === 'standard' ? `images/${filename}` : filename;
    replacementLookup.set(originalRef, newPath);
  }

  $('img').each((_, el) => {
    const src = ($(el).attr('src') || '').trim();
    const replacement = replacementLookup.get(src);
    if (replacement) {
      $(el).attr('src', replacement);
    }
  });

  $('[style]').each((_, el) => {
    const style = $(el).attr('style');
    const rewritten = rewriteBackgroundStyle(style, replacementLookup);
    if (rewritten !== style) {
      $(el).attr('style', rewritten);
    }
  });

  return $.html();
};

const countHtmlComments = (html) => {
  const matches = html.match(/<!--[\s\S]*?-->/g);
  return matches ? matches.length : 0;
};

const applyCleanup = (html, config) => {
  if (!config.allow_html_cleanup) {
    return html;
  }

  let result = html;

  if (config.remove_html_comments) {
    result = result.replace(/<!--[\s\S]*?-->/g, '');
  }

  if (config.normalize_special_characters) {
    result = result
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  return result;
};

module.exports = {
  extractImageRefs,
  rewriteImageSrc,
  applyCleanup,
  countHtmlComments,
};
