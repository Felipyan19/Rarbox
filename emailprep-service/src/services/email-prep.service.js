const htmlService = require('./html.service');
const txtService = require('./txt.service');
const imageService = require('./image.service');
const validatorService = require('./validator.service');
const packagerService = require('./packager.service');
const { DEFAULT_CONFIG } = require('../utils/config-defaults');

const ARTIFACT_SUFFIX_PATTERN = /(-test|-draft|-v\d+|_final|_test|_ok|final|test|ok)$/i;

const mergeConfig = (inputConfig = {}) => ({
  ...DEFAULT_CONFIG,
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

const prepare = (input) => {
  const effectiveConfig = mergeConfig(input.config || {});

  const cleaned = cleanArtifactName(input.artifact_name, effectiveConfig);
  const artifactName = cleaned.artifactName;

  const htmlImageRefs = htmlService.extractImageRefs(input.html, effectiveConfig);

  const resolved = imageService.resolve(
    htmlImageRefs,
    input.images_catalog,
    effectiveConfig.report_unused_catalog_images
  );

  let html = htmlService.rewriteImageSrc(
    input.html,
    resolved.used_images,
    input.delivery_type,
    effectiveConfig,
    resolved.ref_matches
  );

  const warnings = [];
  const htmlCommentsCount = htmlService.countHtmlComments(html);

  if (cleaned.changed) {
    warnings.push('artifact_name tenía sufijo que fue removido');
  }

  if (!effectiveConfig.allow_html_cleanup && !effectiveConfig.remove_html_comments && htmlCommentsCount > 0) {
    warnings.push(`HTML tiene ${htmlCommentsCount} comentarios que NO fueron removidos`);
  }

  if (effectiveConfig.allow_html_cleanup) {
    html = htmlService.applyCleanup(html, effectiveConfig);
  }

  let txt = '';
  if (effectiveConfig.generate_txt_from_html) {
    txt = txtService.generate(html, input.delivery_type, effectiveConfig);
    warnings.push('TXT generado desde HTML');
  }

  if (effectiveConfig.report_unused_catalog_images) {
    for (const filename of resolved.unused_catalog_images) {
      warnings.push(`Imagen del catalog no usada por el HTML: ${filename}`);
    }
  }

  for (const image of resolved.used_images) {
    if (image.source.type === 'url') {
      warnings.push(`Imagen con source.type: "url" no descargada (solo referenciada): ${image.filename}`);
    }
  }

  for (const ref of resolved.missing_images) {
    warnings.push(`Referencia de imagen en HTML no resuelta contra catalog: ${ref}`);
  }

  const validations = validatorService.validate({
    artifact_name: artifactName,
    delivery_type: input.delivery_type,
    html,
    txt,
    used_images: resolved.used_images,
    missing_images: resolved.missing_images,
    duplicated_filenames: resolved.duplicated_filenames,
    config: effectiveConfig,
  });

  validations.unused_catalog_images = resolved.unused_catalog_images;

  const packagingPlan = packagerService.plan(artifactName, input.delivery_type, resolved.used_images);

  const rarRequest = {
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
    html_image_refs: htmlImageRefs,
    used_images: resolved.used_images,
    packaging_plan: packagingPlan,
    rar_request: rarRequest,
    validations,
    warnings,
  };
};

module.exports = {
  prepare,
  mergeConfig,
  cleanArtifactName,
};
