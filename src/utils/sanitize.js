const UNSAFE_CHARS_REGEX = /[<>:"|?*\x00-\x1f]/g;
const PATH_TRAVERSAL_REGEX = /\.\.|\/|\\\\|^\/|^\\\\|^\w+:/;

const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return null;
  }

  if (PATH_TRAVERSAL_REGEX.test(filename)) {
    throw new Error(`Invalid filename: path traversal detected in "${filename}"`);
  }

  const sanitized = filename.replace(UNSAFE_CHARS_REGEX, '_');

  if (sanitized.length === 0 || sanitized === '.' || sanitized === '..') {
    throw new Error(`Invalid filename: "${filename}" is not allowed`);
  }

  return sanitized;
};

const sanitizeArchiveName = (name) => {
  if (!name || typeof name !== 'string') {
    return null;
  }

  if (PATH_TRAVERSAL_REGEX.test(name)) {
    throw new Error(`Invalid archive name: path traversal detected in "${name}"`);
  }

  const sanitized = name.replace(UNSAFE_CHARS_REGEX, '_');

  if (sanitized.length === 0) {
    throw new Error(`Invalid archive name: "${name}" is empty after sanitization`);
  }

  return sanitized;
};

module.exports = {
  sanitizeFilename,
  sanitizeArchiveName,
};
