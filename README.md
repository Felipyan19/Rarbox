# rarbox

Microservicio HTTP seguro para generar archivos RAR bajo demanda.

## Desarrollo

### Prerequisitos
- Node.js >= 18
- npm >= 9

### Setup

```bash
npm install
cp .env.example .env
npm run dev
```

El servidor estará disponible en `http://localhost:3000`.

Endpoints:
- `GET /health` - Estado del servicio
- `GET /ready` - Readiness probe
- `POST /v1/archives/rar` - Genera un archivo RAR

### Prueba rápida

```bash
curl -X POST http://localhost:3000/v1/archives/rar \
  -H "Content-Type: application/json" \
  -H "X-API-Key: change-me-in-production" \
  -d '{
    "archiveName": "demo",
    "files": {
      "html": {
        "content": "<html><body>Test</body></html>"
      },
      "text": {
        "content": "Test content"
      }
    }
  }'
```

## Docker

### Build

```bash
docker build -t rarbox:latest .
```

### Run

```bash
docker run -p 3000:3000 \
  -e API_KEY=your-secret-key \
  rarbox:latest
```

### Docker Compose

```bash
docker-compose up
```

## Estructura del Proyecto

```
rarbox/
  src/
    routes/           # Rutas y controladores
    services/         # Lógica de negocio
    schemas/          # Validación con Zod
    utils/            # Helpers (logger, auth, sanitize)
  test/               # Tests e2e y unitarios
  Dockerfile          # Imagen Docker
  docker-compose.yml  # Stack local
  plan.md             # Especificación del proyecto
```

## Variables de Entorno

Ver `.env.example` para la lista completa.

- `API_KEY`: Clave de API para proteger el endpoint
- `MAX_BODY_SIZE_MB`: Límite de tamaño de request
- `REQUEST_TIMEOUT_MS`: Timeout para procesos de compresión
- `TEMP_DIR`: Directorio para archivos temporales
- `RAR_BIN`: Ruta al binario RAR

## Seguridad

- API key requerida en header `X-API-Key`
- Validación estricta de entrada con Zod
- Sanitización de nombres de archivo (prevención de path traversal)
- Límite de tamaño de body configurable
- Helmet para headers de seguridad
- Logs correlacionados por requestId

## Fases de Implementación

- [x] Fase 1: Base técnica (Fastify + rutas + validación)
- [ ] Fase 2: Generación de archivos temporales
- [ ] Fase 3: Compresión RAR
- [ ] Fase 4: Endurecimiento (rate limiting, logs avanzados)
- [ ] Fase 5: Docker y release
- [ ] Fase 6: Tests

## Licencia

MIT
