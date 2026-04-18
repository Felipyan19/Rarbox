# Plan: emailprep-service — Microservicio de preparación de entregables

## Context
Se necesita un nuevo microservicio independiente llamado `emailprep-service` que recibe un HTML finalizado de campaña de email marketing, lo procesa junto con un catálogo de imágenes y configuración opcional, y devuelve un JSON estructurado listo para que `rarbox` genere el archivo RAR.

El servicio NO descarga imágenes, NO diseña HTML, NO comprime archivos. Su única responsabilidad es preparar y validar el entregable lógico.

**Ubicación del proyecto:** `c:\Users\USUARIO\Documents\codes\Niawi\emailprep-service\` (directorio nuevo separado de rarbox)

---

## Stack

Mismo que rarbox para consistencia:
- Fastify 4 + @fastify/helmet + @fastify/swagger + @fastify/swagger-ui
- Zod (validación de schema)
- cheerio (parseo y reescritura de HTML)
- pino + pino-pretty (logging)
- uuid (request IDs)
- jest (tests)

---

## Estructura de archivos

```
emailprep-service/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── routes/
│   │   ├── health.js
│   │   └── prepare.js            (POST /v1/prepare)
│   ├── services/
│   │   ├── email-prep.service.js (orquestador)
│   │   ├── html.service.js
│   │   ├── txt.service.js
│   │   ├── image.service.js
│   │   ├── validator.service.js
│   │   └── packager.service.js
│   ├── schemas/
│   │   └── prepare-request.schema.js
│   └── utils/
│       ├── logger.js             (copiar de rarbox)
│       ├── errors.js             (copiar de rarbox)
│       ├── error-handler.js      (copiar de rarbox + agregar details)
│       ├── auth.js               (copiar de rarbox)
│       ├── request-id.js         (copiar de rarbox)
│       ├── rate-limiter.js       (copiar de rarbox)
│       ├── rate-limit-hook.js    (copiar de rarbox)
│       └── config-defaults.js    (objeto DEFAULT_CONFIG con los 22 defaults)
├── test/
│   ├── prepare.e2e.test.js
│   ├── html-service.test.js
│   ├── txt-service.test.js
│   ├── image-service.test.js
│   └── validator.test.js
├── package.json
├── Dockerfile
├── .env.example
└── .gitignore
```

---

## Contrato de entrada — POST /v1/prepare

```json
{
  "artifact_name": "string",
  "delivery_type": "standard | centurion",
  "html": "string",
  "images_catalog": [
    {
      "filename": "string",
      "source": { "type": "url | base64", "value": "string" }
    }
  ],
  "config": { /* opcional, parcial o completo */ }
}
```

Headers: `X-API-Key`, `Content-Type: application/json`

---

## Contrato de salida — 200 OK

```json
{
  "artifact_name": "string",
  "delivery_type": "standard | centurion",
  "effective_config": { /* 22 campos con defaults aplicados */ },
  "html": "string (reescrito si config lo permite)",
  "txt": "string (generado desde HTML)",
  "html_image_refs": ["string"],
  "used_images": [{ "filename": "string", "source": { "type": "...", "value": "..." } }],
  "packaging_plan": {
    "root_folder": "string",
    "files": [{ "path": "string", "type": "html | txt | image" }]
  },
  "rar_request": {
    "artifact_name": "string",
    "delivery_type": "string",
    "html": "string",
    "txt": "string",
    "images": [{ "filename": "string", "source": { "type": "...", "value": "..." } }]
  },
  "validations": {
    "missing_images": [],
    "duplicated_filenames": [],
    "unused_catalog_images": [],
    "broken_variables": [],
    "txt_matches_html": false,
    "packaging_ready": false
  },
  "warnings": []
}
```

---

## DEFAULT_CONFIG (config-defaults.js)

```js
module.exports = {
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
```

Merge: `effectiveConfig = { ...DEFAULT_CONFIG, ...input.config }`

---

## Servicios — lógica detallada

### email-prep.service.js (orquestador)

Secuencia de llamadas:
1. `mergeConfig(input.config)` → `effectiveConfig`
2. `cleanArtifactName(input.artifact_name, effectiveConfig)` → `artifact_name`
3. `imageService.extractRefs(input.html, effectiveConfig)` → `html_image_refs`
4. `imageService.resolve(html_image_refs, input.images_catalog)` → `{ used_images, missing_images, duplicated_filenames, unused_catalog_images }`
5. `htmlService.rewriteImageSrc(input.html, used_images, delivery_type, effectiveConfig)` → `html`
6. `htmlService.applyCleanup(html, effectiveConfig)` → `html` (solo si allow_html_cleanup)
7. `txtService.generate(html, delivery_type, effectiveConfig)` → `txt`
8. `validatorService.validate(...)` → `validations`
9. `packagerService.plan(artifact_name, delivery_type, used_images)` → `packaging_plan`
10. Construir `rar_request` con artifact_name, delivery_type, html, txt, used_images
11. Retornar JSON final

### html.service.js

Usa **cheerio**.

- `extractImageRefs(html, config)`:
  - Si `parse_img_src`: extraer `$('img').attr('src')` de cada `<img>`
  - Si `parse_inline_background_images`: extraer URLs de `background-image:url(...)` en atributos `style`
  - Devuelve array de strings (referencias tal como aparecen en el HTML)

- `rewriteImageSrc(html, used_images, delivery_type, config)`:
  - Solo si `rewrite_image_src = true`
  - Construir mapa: `originalRef → newPath`
  - standard: `newPath = "images/<filename>"`
  - centurion: `newPath = "<filename>"`
  - Reemplazar con cheerio: `$('img').attr('src', newPath)` para cada img cuyo src matchea
  - Ídem para background-image inline
  - Devuelve HTML modificado

- `applyCleanup(html, config)`:
  - Solo si `allow_html_cleanup = true`
  - Si `remove_html_comments`: eliminar comentarios `<!-- -->` con cheerio
  - Si `normalize_special_characters`: reemplazar `&amp;`→`&`, `&nbsp;`→` `, etc.

### image.service.js

- `resolve(htmlRefs, catalog)`:
  - Para cada ref en htmlRefs, buscar en catalog con esta prioridad:
    1. Coincidencia exacta por `source.value` (si la ref es URL absoluta)
    2. Coincidencia exacta por `filename` (si la ref es filename local)
    3. Coincidencia por `path.basename(ref) === catalog.filename` (basename)
    4. Si ninguna → agregar a `missing_images`
  - Si mismo filename aparece >1 vez → `duplicated_filenames`
  - Las del catalog que no se usaron → `unused_catalog_images` (si `report_unused_catalog_images`)
  - Devuelve `{ used_images, missing_images, duplicated_filenames, unused_catalog_images }`

### txt.service.js

Usa **cheerio** para recorrer DOM en orden visual.

- `generate(html, delivery_type, config)`:
  - Recorrer nodos en orden DOM con `$('*').each()`
  - Incluir texto visible (`$el.text()`) de: h1, h2, h3, p, span, div, td, li, a
  - Incluir `alt` de `<img>` si `include_alt_text_in_txt`
  - Incluir texto relevante de imágenes que representen texto del correo si `include_image_text_in_txt`
  - Incluir legales (nodos con class/id que contengan "legal", "disclaimer", "footnote") si `include_legals_in_txt`
  - No resumir ni parafrasear
  - Si `preserve_case`: mantener exactamente el caso del HTML
  - Separar bloques con `**********` si `use_block_separators_in_txt`
  - Formato de URLs según `delivery_type`:
    - standard (`txt_url_format_standard: "newline"`): `Texto\nhttps://url.com`
    - centurion (`txt_url_format_centurion: "parentheses"`): `Texto (https://url.com)`
  - No agregar ni quitar slash final en URLs si `strict_url_match = true`

### validator.service.js

- `validate({ artifact_name, delivery_type, html, txt, used_images, missing_images, duplicated_filenames, config })`:
  - `txt_matches_html`: verificar que el texto principal del TXT corresponde al texto principal extraíble del HTML (comparación heurística, no character-by-character)
  - `broken_variables`: si `validate_required_variables`, buscar cada `required_variables[i]` en el HTML. Si no existe → agregar a lista
  - `packaging_ready`: `true` solo si:
    - artifact_name no vacío y válido
    - delivery_type es "standard" o "centurion"
    - html no vacío
    - txt no vacío
    - `missing_images.length === 0`
    - `duplicated_filenames.length === 0`
    - `txt_matches_html === true`

### packager.service.js

- `plan(artifact_name, delivery_type, used_images)`:
  - `root_folder = artifact_name`
  - files array:
    - `{ path: "<artifact_name>.html", type: "html" }`
    - `{ path: "<artifact_name>.txt", type: "txt" }`
    - Para cada imagen en used_images:
      - standard: `{ path: "images/<filename>", type: "image" }`
      - centurion: `{ path: "<filename>", type: "image" }`

---

## Normalización de artifact_name

Regex aplicado repetidamente hasta que no haya más cambios:
```js
/(-test|-draft|-v\d+|_final|_test|_ok|final|test|ok)$/i
```

Ejemplos:
- `"travel_platinum_2026_04_16_test"` → `"travel_platinum_2026_04_16"`
- `"newsletter_v2"` → `"newsletter"`
- `"campaign_final"` → `"campaign"`
- `"centurion_travel_v2"` → `"centurion_travel"`

Solo se aplica si `remove_test_suffixes_from_artifact_name = true`.

---

## Warnings (no fallan, solo reportan)

- `artifact_name` tenía sufijo que fue removido
- HTML tiene N comentarios que NO fueron removidos (si remove_html_comments=false)
- TXT generado desde HTML
- Imagen del catalog no usada por el HTML
- Imagen con `source.type: "url"` no descargada (solo referenciada)
- Referencia de imagen en HTML no resuelta contra catalog (también en missing_images)

---

## Patrones a copiar verbatim desde rarbox

| Archivo fuente | Destino | Modificaciones |
|---|---|---|
| `src/utils/logger.js` | copiar igual | ninguna |
| `src/utils/errors.js` | copiar igual | ninguna |
| `src/utils/auth.js` | copiar igual | ninguna |
| `src/utils/request-id.js` | copiar igual | ninguna |
| `src/utils/rate-limiter.js` | copiar igual | ninguna |
| `src/utils/rate-limit-hook.js` | copiar igual | ninguna |
| `src/utils/error-handler.js` | copiar + modificar | agregar `...(error.details ? { details: error.details } : {})` en el send |
| `src/server.js` | copiar + modificar | cambiar nombre a emailprep-service, cambiar PORT default a 5051 |
| `src/app.js` | copiar + modificar | registrar `prepareRoute` en lugar de `rarRoute`, actualizar Swagger meta |
| `src/routes/health.js` | copiar igual | ninguna |

---

## Verificación

1. `npm install` en el nuevo directorio
2. `npm test` — todos los tests pasan
3. Request mínimo de prueba:
```json
POST /v1/prepare
X-API-Key: change-me

{
  "artifact_name": "travel_platinum_2026_04_16_test",
  "delivery_type": "standard",
  "html": "<html><body><img src=\"https://cdn.midominio.com/assets/banner.jpg\" alt=\"No vivas la vida sin ella\"><h1>No vivas la vida sin ella</h1><p>Publicidad</p></body></html>",
  "images_catalog": [
    { "filename": "20260416_001.jpg", "source": { "type": "url", "value": "https://cdn.midominio.com/assets/banner.jpg" } },
    { "filename": "20260416_logo.png", "source": { "type": "base64", "value": "iVBORw0KGgo..." } }
  ]
}
```
4. Verificar en la respuesta:
   - `artifact_name` = `"travel_platinum_2026_04_16"` (sufijo `_test` removido)
   - `html_image_refs` = `["https://cdn.midominio.com/assets/banner.jpg"]`
   - `used_images` tiene `20260416_001.jpg`, NO incluye `20260416_logo.png`
   - `validations.unused_catalog_images` = `["20260416_logo.png"]`
   - `html` contiene `src="images/20260416_001.jpg"` (reescrito)
   - `txt` contiene `"No vivas la vida sin ella"` y `"Publicidad"`
   - `packaging_plan.files` tiene `.html`, `.txt`, `images/20260416_001.jpg`
   - `rar_request.images` tiene solo `20260416_001.jpg`
   - `validations.packaging_ready = true`
5. Request con config parcial (centurion + required_variables faltantes) para verificar `broken_variables`
6. `GET /health` responde 200
