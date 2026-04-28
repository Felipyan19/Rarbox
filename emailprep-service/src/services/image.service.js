const path = require('path');

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

const normalizeRefForBasename = (ref) => {
  if (!ref) {
    return '';
  }

  const withoutQuery = ref.split('?')[0].split('#')[0];
  const normalized = withoutQuery.replace(/\\/g, '/');
  return path.posix.basename(normalized);
};

const resolve = (htmlRefs, catalog, reportUnusedCatalogImages = true) => {
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
      missingImages.push(cleanRef);
      continue;
    }

    usedCatalogIndexes.add(matchIndex);

    const previous = refMatches.get(cleanRef) || [];
    previous.push(catalog[matchIndex].filename);
    refMatches.set(cleanRef, previous);
  }

  const usedImages = Array.from(usedCatalogIndexes)
    .sort((a, b) => a - b)
    .map((index) => catalog[index]);

  const unusedCatalogImages = reportUnusedCatalogImages
    ? catalog
      .filter((item, index) => !usedCatalogIndexes.has(index))
      .map((item) => item.filename)
    : [];

  return {
    used_images: usedImages,
    missing_images: missingImages,
    duplicated_filenames: duplicatedFilenames,
    unused_catalog_images: unusedCatalogImages,
    ref_matches: refMatches,
  };
};

module.exports = {
  resolve,
};
