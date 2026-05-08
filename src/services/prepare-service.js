const path = require('path');
const { DEFAULT_PREPARE_CONFIG } = require('../utils/prepare-config-defaults');

const ARTIFACT_SUFFIX_PATTERN = /(-test|-draft|-v\d+|_final|_test|_ok|final|test|ok)$/i;
const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;
const LEGAL_PATTERN = /(legal|disclaimer|footnote)/i;
const BACKGROUND_IMAGE_PATTERN = /background-image\s*:\s*url\((['"]?)(.*?)\1\)/ig;
const BLOCK_TAG_PATTERN = /<\/?(address|article|aside|blockquote|caption|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/ig;
const BLOCK_SEPARATOR_TOKEN = '__TXT_BLOCK__';
const BLOCK_SEPARATOR_LINE = '*'.repeat(72);
const BLOCK_SECTION_SEPARATOR = `\n\n${BLOCK_SEPARATOR_LINE}\n\n`;

const normalizeBlockSeparatorSpacing = (value) => {
  if (!value) {
    return value;
  }

  // Enforce a blank line before and after every separator line.
  return value
    .replace(/\n*\*{3,}\n*/g, `\n\n${BLOCK_SEPARATOR_LINE}\n\n`)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const mergeConfig = (inputConfig = {}) => ({
  ...DEFAULT_PREPARE_CONFIG,
  ...inputConfig,
});

const cleanArtifactName = (artifactName, config) => {
  if (!config.remove_test_suffixes_from_artifact_name) {
    return { artifactName, changed: false };
  }

  let current = artifactName;
  let changed = false;

  while (ARTIFACT_SUFFIX_PATTERN.test(current)) {
    changed = true;
    current = current.replace(ARTIFACT_SUFFIX_PATTERN, '').trim();
  }

  return {
    artifactName: current || artifactName,
    changed,
  };
};

const decodeEntities = (value) => {
  const namedEntities = {
    nbsp: ' ',
    amp: '&',
    quot: '"',
    apos: "'",
    lt: '<',
    gt: '>',
    copy: '©',
    reg: '®',
    deg: '°',
    ordm: 'º',
    iquest: '¿',
    iexcl: '¡',
    aacute: 'á',
    eacute: 'é',
    iacute: 'í',
    oacute: 'ó',
    uacute: 'ú',
    ntilde: 'ñ',
    uuml: 'ü',
    Aacute: 'Á',
    Eacute: 'É',
    Iacute: 'Í',
    Oacute: 'Ó',
    Uacute: 'Ú',
    Ntilde: 'Ñ',
    Uuml: 'Ü',
    ldquo: '"',
    rdquo: '"',
    lsquo: "'",
    rsquo: "'",
    mdash: '-',
    ndash: '-',
  };

  return (value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (full, name) => (
      Object.prototype.hasOwnProperty.call(namedEntities, name) ? namedEntities[name] : full
    ));
};

const normalizeWhitespace = (value) => value.replace(/\s+/g, ' ').trim();
const normalizeTextLine = (value) => normalizeWhitespace(value).replace(/\s+([,.;:!?])/g, '$1');

const stripTags = (value) => normalizeWhitespace(decodeEntities(value.replace(/<[^>]*>/g, ' ')));

const extractImageRefs = (html, config) => {
  const refs = [];
  const imgRegex = /<img\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1/ig;
  const styleRegex = /style\s*=\s*(['"])([^'"]*background-image\s*:\s*url\([^)]+\)[^'"]*)\1/ig;

  // Extract all image references with their positions
  const foundRefs = [];

  if (config.parse_img_src) {
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      if (match[2]) {
        foundRefs.push({
          position: match.index,
          ref: match[2].trim(),
        });
      }
    }
  }

  if (config.parse_inline_background_images) {
    let match;
    while ((match = styleRegex.exec(html)) !== null) {
      const styleContent = match[2];
      const bgMatch = BACKGROUND_IMAGE_PATTERN.exec(styleContent);
      if (bgMatch && bgMatch[2]) {
        foundRefs.push({
          position: match.index,
          ref: bgMatch[2].trim(),
        });
      }
      BACKGROUND_IMAGE_PATTERN.lastIndex = 0;
    }
  }

  // Sort by position in HTML to maintain top-to-bottom, left-to-right order
  foundRefs.sort((a, b) => a.position - b.position);

  return foundRefs.map(item => item.ref);
};

const normalizeRefForBasename = (ref) => {
  if (!ref) {
    return '';
  }

  const withoutQuery = ref.split('?')[0].split('#')[0];
  const normalized = withoutQuery.replace(/\\/g, '/');
  return path.posix.basename(normalized);
};

const resolveImages = (htmlRefs, catalog, reportUnusedCatalogImages = true) => {
  const duplicatedFilenames = [];
  const filenameCount = new Map();

  for (const item of catalog) {
    const count = filenameCount.get(item.filename) || 0;
    filenameCount.set(item.filename, count + 1);
  }

  for (const [filename, count] of filenameCount.entries()) {
    if (count > 1) {
      duplicatedFilenames.push(filename);
    }
  }

  const usedCatalogIndexes = new Set();
  const missingImages = [];
  const refMatches = new Map();
  const autoImagesByRef = new Map();
  const usedFilenames = new Set(catalog.map((item) => item.filename));
  const resolvedImagesInOrder = [];

  for (const ref of htmlRefs) {
    const cleanRef = (ref || '').trim();
    if (!cleanRef) {
      continue;
    }

    let matchIndex = -1;

    if (ABSOLUTE_URL_PATTERN.test(cleanRef)) {
      matchIndex = catalog.findIndex((item) => item.source.type === 'url' && item.source.value === cleanRef);
    }

    if (matchIndex === -1) {
      matchIndex = catalog.findIndex((item) => item.filename === cleanRef);
    }

    if (matchIndex === -1) {
      const basenameRef = normalizeRefForBasename(cleanRef);
      matchIndex = catalog.findIndex((item) => item.filename === basenameRef);
    }

    if (matchIndex === -1) {
      if (ABSOLUTE_URL_PATTERN.test(cleanRef)) {
        const basenameRef = normalizeRefForBasename(cleanRef) || 'image';
        const extMatch = /\.([a-z0-9]{1,8})$/i.exec(basenameRef);
        const ext = extMatch ? `.${extMatch[1]}` : '.bin';
        const baseName = basenameRef.replace(/\.[^.]+$/, '') || 'image';

        let candidate = `${baseName}${ext}`;
        let counter = 1;
        while (usedFilenames.has(candidate)) {
          candidate = `${baseName}-${counter}${ext}`;
          counter += 1;
        }

        usedFilenames.add(candidate);
        const autoImage = {
          filename: candidate,
          source: {
            type: 'url',
            value: cleanRef,
          },
        };
        autoImagesByRef.set(cleanRef, autoImage);

        refMatches.set(cleanRef, [candidate]);
        resolvedImagesInOrder.push({ ref: cleanRef, image: autoImage });
        continue;
      }

      missingImages.push(cleanRef);
      continue;
    }

    usedCatalogIndexes.add(matchIndex);
    const catalogImage = catalog[matchIndex];
    const previous = refMatches.get(cleanRef) || [];
    previous.push(catalogImage.filename);
    refMatches.set(cleanRef, previous);
    resolvedImagesInOrder.push({ ref: cleanRef, image: catalogImage });
  }

  // Rename images sequentially based on HTML order
  const sequentialRefMatches = new Map();
  const sequentialImages = [];
  const seenRefs = new Set();
  let sequentialCounter = 1;

  for (let i = 0; i < resolvedImagesInOrder.length; i++) {
    const { ref, image } = resolvedImagesInOrder[i];

    // Skip duplicate refs (same image referenced multiple times)
    if (seenRefs.has(ref)) {
      continue;
    }
    seenRefs.add(ref);

    // Extract extension from original filename
    const extMatch = /\.([a-z0-9]{1,8})$/i.exec(image.filename);
    const ext = extMatch ? `.${extMatch[1]}` : '.jpg';

    // Create sequential name: imagen_1.jpg, imagen_2.png, etc.
    const sequentialName = `imagen_${sequentialCounter}${ext}`;
    sequentialCounter++;

    // Create new image object with sequential name
    const sequentialImage = {
      ...image,
      filename: sequentialName,
    };

    sequentialImages.push(sequentialImage);
    sequentialRefMatches.set(ref, [sequentialName]);
  }

  const unusedCatalogImages = reportUnusedCatalogImages
    ? catalog
      .filter((item, index) => !usedCatalogIndexes.has(index))
      .map((item) => item.filename)
    : [];

  return {
    used_images: sequentialImages,
    missing_images: missingImages,
    duplicated_filenames: duplicatedFilenames,
    unused_catalog_images: unusedCatalogImages,
    ref_matches: sequentialRefMatches,
  };
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const rewriteImageSrc = (html, usedImages, deliveryType, config, refMatches = new Map()) => {
  if (!config.rewrite_image_src) {
    return html;
  }

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

  let rewritten = html;

  for (const [originalRef, newPath] of replacementLookup.entries()) {
    const escaped = escapeRegex(originalRef);
    const imgSrcPattern = new RegExp(`(\\bsrc\\s*=\\s*["'])${escaped}(["'])`, 'g');
    rewritten = rewritten.replace(imgSrcPattern, `$1${newPath}$2`);

    const stylePattern = new RegExp(
      `(background-image\\s*:\\s*url\\((['"]?))${escaped}(\\2\\))`,
      'g'
    );
    rewritten = rewritten.replace(stylePattern, `$1${newPath}$3`);
  }

  return rewritten;
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

const dedupeBlocks = (blocks, preserveCase) => {
  const deduped = [];
  const seen = new Set();

  for (const block of blocks) {
    // Preserve original value with newlines
    const originalValue = (block || '').trim();
    if (!originalValue) {
      continue;
    }

    // Use normalized version only for duplicate detection
    const normalizedForComparison = normalizeWhitespace(originalValue);
    const key = preserveCase ? normalizedForComparison : normalizedForComparison.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    // Return original value with newlines preserved, optionally lowercased
    deduped.push(preserveCase ? originalValue : originalValue.toLowerCase());
  }

  return deduped;
};

const extractCommentDelimitedSections = (html) => {
  const sections = [];
  const markerRegex = /<!--\s*(START|END)\s*:\s*([\s\S]*?)\s*-->/ig;
  let startMatch = null;
  let markerMatch = markerRegex.exec(html);

  while (markerMatch) {
    const markerType = (markerMatch[1] || '').toUpperCase();
    if (markerType === 'START') {
      startMatch = markerMatch;
    } else if (markerType === 'END' && startMatch) {
      const startTagEndIndex = startMatch.index + startMatch[0].length;
      const sectionHtml = html.slice(startTagEndIndex, markerMatch.index);
      sections.push({
        label: normalizeWhitespace(startMatch[2] || ''),
        html: sectionHtml,
      });
      startMatch = null;
    }
    markerMatch = markerRegex.exec(html);
  }

  return sections;
};

const extractTxtSectionsFromHtmlSegment = (htmlSegment, deliveryType, config) => {
  const sections = {
    visibleText: [],
    links: [],
    imageTexts: [],
    legals: [],
  };

  // Extract visible text first (main content section)
  if (config.include_visible_text_in_txt) {
    let textWorking = htmlSegment;
    // Keep visual text as complete block lines: strip inline markup, split on block elements.
    textWorking = textWorking
      .replace(/<a\b[^>]*\bhref\s*=\s*(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/ig, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<script[\s\S]*?<\/script>/ig, ' ')
      .replace(/<style[\s\S]*?<\/style>/ig, ' ')
      .replace(BLOCK_TAG_PATTERN, BLOCK_SEPARATOR_TOKEN)
      .replace(/<[^>]*>/g, ' ')
      .replace(/[\r\n\t]+/g, ' ');

    const lines = decodeEntities(textWorking)
      .split(BLOCK_SEPARATOR_TOKEN)
      .map((line) => normalizeTextLine(line))
      .filter(Boolean);

    sections.visibleText.push(...lines);
  }

  // Extract links
  const linkRegex = /<a\b[^>]*\bhref\s*=\s*(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/ig;
  let linkMatch = linkRegex.exec(htmlSegment);
  while (linkMatch) {
    const href = normalizeWhitespace(linkMatch[2] || '');
    const text = stripTags(linkMatch[3] || '');
    if (text || href) {
      sections.links.push(formatLink(text, href, deliveryType, config));
    }
    linkMatch = linkRegex.exec(htmlSegment);
  }

  // Extract image alt and title texts
  if (config.include_alt_text_in_txt || config.include_image_text_in_txt) {
    const imgRegex = /<img\b[^>]*>/ig;
    let imgMatch = imgRegex.exec(htmlSegment);
    while (imgMatch) {
      const tag = imgMatch[0];
      if (config.include_alt_text_in_txt) {
        const altMatch = /alt\s*=\s*(['"])(.*?)\1/i.exec(tag);
        const alt = normalizeWhitespace(decodeEntities(altMatch?.[2] || ''));
        if (alt) {
          sections.imageTexts.push(alt);
        }
      }
      if (config.include_image_text_in_txt) {
        const titleMatch = /title\s*=\s*(['"])(.*?)\1/i.exec(tag);
        const title = normalizeWhitespace(decodeEntities(titleMatch?.[2] || ''));
        if (title) {
          sections.imageTexts.push(title);
        }
      }
      imgMatch = imgRegex.exec(htmlSegment);
    }
  }

  // Extract legal texts
  if (config.include_legals_in_txt) {
    const legalRegex = /<([a-z0-9]+)\b([^>]*)>([\s\S]*?)<\/\1>/ig;
    let legalMatch = legalRegex.exec(htmlSegment);
    while (legalMatch) {
      const attrs = legalMatch[2] || '';
      const cls = /class\s*=\s*(['"])(.*?)\1/i.exec(attrs)?.[2] || '';
      const id = /id\s*=\s*(['"])(.*?)\1/i.exec(attrs)?.[2] || '';
      if (LEGAL_PATTERN.test(cls) || LEGAL_PATTERN.test(id)) {
        const legalText = stripTags(legalMatch[3] || '');
        if (legalText) {
          sections.legals.push(legalText);
        }
      }
      legalMatch = legalRegex.exec(htmlSegment);
    }
  }

  return sections;
};

const generateTxtFromHtml = (html, deliveryType, config) => {
  const separator = config.use_block_separators_in_txt ? BLOCK_SECTION_SEPARATOR : '\n\n';
  const sectionSeparator = '\n';
  const commentSections = extractCommentDelimitedSections(html);

  const buildBlockText = (extracted) => {
    const deduped = {
      visibleText: dedupeBlocks(extracted.visibleText, config.preserve_case),
      links: dedupeBlocks(extracted.links, config.preserve_case),
      imageTexts: dedupeBlocks(extracted.imageTexts, config.preserve_case),
      legals: dedupeBlocks(extracted.legals, config.preserve_case),
    };

    const parts = [];
    if (deduped.visibleText.length > 0) parts.push(deduped.visibleText.join(sectionSeparator));
    if (deduped.links.length > 0) parts.push(deduped.links.join(sectionSeparator));
    if (deduped.imageTexts.length > 0) parts.push(deduped.imageTexts.join(sectionSeparator));
    if (deduped.legals.length > 0) parts.push(deduped.legals.join(sectionSeparator));
    return parts.join(sectionSeparator);
  };

  if (commentSections.length > 0) {
    const blockTexts = [];
    for (const section of commentSections) {
      const extracted = extractTxtSectionsFromHtmlSegment(section.html, deliveryType, config);
      const blockText = buildBlockText(extracted);
      if (blockText) {
        blockTexts.push(blockText);
      }
    }
    const joined = blockTexts.join(separator);
    return config.use_block_separators_in_txt ? normalizeBlockSeparatorSpacing(joined) : joined;
  }

  // Fallback: no markers, process full html as before
  const fullExtracted = extractTxtSectionsFromHtmlSegment(html, deliveryType, config);
  return buildBlockText(fullExtracted);
};

const appendImageUrlsToTxt = (txt, usedImages, config) => {
  const sectionSeparator = config.use_block_separators_in_txt ? BLOCK_SECTION_SEPARATOR : '\n\n';
  const urlSeparator = '\n';
  const urlBlocks = [];
  const existing = new Set(
    txt
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );

  for (const image of usedImages) {
    const url = image?.source?.type === 'url' ? normalizeWhitespace(image.source.value || '') : '';
    if (!url || existing.has(url)) {
      continue;
    }
    existing.add(url);
    urlBlocks.push(url);
  }

  if (urlBlocks.length === 0) {
    return txt;
  }

  // Join URLs with simple newline, then add as a section with separator
  const urlSection = urlBlocks.join(urlSeparator);
  const result = txt ? `${txt}${sectionSeparator}${urlSection}` : urlSection;
  return config.use_block_separators_in_txt ? normalizeBlockSeparatorSpacing(result) : result;
};

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

const validatePrepareResult = ({
  artifact_name,
  delivery_type,
  html,
  txt,
  missing_images,
  duplicated_filenames,
  config,
}) => {
  const htmlText = stripTags(html);
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

const prepare = (input) => {
  const effectiveConfig = mergeConfig(input.config || {});
  const cleaned = cleanArtifactName(input.artifact_name, effectiveConfig);
  const artifactName = cleaned.artifactName;

  const htmlImageRefs = extractImageRefs(input.html, effectiveConfig);
  const resolved = resolveImages(
    htmlImageRefs,
    input.images_catalog,
    effectiveConfig.report_unused_catalog_images
  );

  let html = rewriteImageSrc(
    input.html,
    resolved.used_images,
    input.delivery_type,
    effectiveConfig,
    resolved.ref_matches
  );

  if (effectiveConfig.allow_html_cleanup) {
    if (effectiveConfig.remove_html_comments) {
      html = html.replace(/<!--[\s\S]*?-->/g, '');
    }
    if (effectiveConfig.normalize_special_characters) {
      html = decodeEntities(html);
    }
  }

  let txt = '';
  if (effectiveConfig.generate_txt_from_html) {
    txt = generateTxtFromHtml(html, input.delivery_type, effectiveConfig);
  }
  txt = appendImageUrlsToTxt(txt, resolved.used_images, effectiveConfig);

  // Add PUBLICIDAD header if not present in text
  if (txt && !/\bPUBLICIDAD\b/i.test(txt)) {
    txt = 'PUBLICIDAD\n\n\n' + txt;
  }

  const validations = validatePrepareResult({
    artifact_name: artifactName,
    delivery_type: input.delivery_type,
    html,
    txt,
    missing_images: resolved.missing_images,
    duplicated_filenames: resolved.duplicated_filenames,
    config: effectiveConfig,
  });

  validations.unused_catalog_images = resolved.unused_catalog_images;

  const rar_request = {
    artifact_name: artifactName,
    delivery_type: input.delivery_type,
    html,
    txt,
    images: resolved.used_images,
  };

  return {
    artifact_name: artifactName,
    delivery_type: input.delivery_type,
    effective_config: effectiveConfig,
    html,
    txt,
    rar_request,
    validations,
  };
};

module.exports = {
  prepare,
};
