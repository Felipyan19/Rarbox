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

El servidor estará disponible en `http://localhost:5050`.

Endpoints:
- `GET /health` - Estado del servicio
- `GET /ready` - Readiness probe
- `GET /metrics` - Métricas de servicio (requests, archives, success rate)
- `POST /v1/archives/rar` - Genera un archivo RAR (requiere API key, sujeto a rate limit)
- `GET /docs` - Swagger UI (OpenAPI)
- `GET /docs/json` - OpenAPI JSON

### Prueba rápida

```bash
curl -X POST http://localhost:5050/v1/archives/rar \
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
docker run -p 5050:5050 \
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
- `ENABLE_HSTS`: Activa Strict-Transport-Security (`true` solo detrás de HTTPS real)
- `SWAGGER_URL`: URL base que Swagger UI usará para ejecutar requests

## Seguridad

- API key requerida en header `X-API-Key`
- Validación estricta de entrada con Zod
- Sanitización de nombres de archivo (prevención de path traversal)
- Rate limiting por IP (configurable)
- Límite de tamaño de body configurable
- Helmet para headers de seguridad
- Logs correlacionados por requestId
- Cleanup automático de archivos temporales
- Timeouts configurable para procesos de compresión

## Observabilidad

- `GET /metrics` expone métricas:
  - Total de requests y éxito/error
  - Requests limitados por rate limit
  - Total de archives generados
  - Tamaño promedio de archivos
  - Uptime del servicio

## Fases de Implementación

- [x] Fase 1: Base técnica (Fastify + rutas + validación)
- [x] Fase 2: Generación de archivos temporales
- [x] Fase 3: Compresión RAR
- [x] Fase 4: Endurecimiento (rate limiting, métricas)
- [x] Fase 5: Docker y release
- [x] Fase 6: Tests (27 tests pasando)

## Deployment

Ver [DEPLOYMENT.md](DEPLOYMENT.md) para instrucciones completas.

### Quick Deploy

```bash
./scripts/build.sh latest
cp .env.production.example .env.production
# Edit .env.production with API_KEY
docker-compose -f docker-compose.prod.yml up -d
```

### Test Build

```bash
./scripts/test-docker.sh
```

## Licencia

MIT
