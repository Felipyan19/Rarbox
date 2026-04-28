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

module.exports = {
  resolve,
};
