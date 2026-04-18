# Plan de proyecto: rarbox

## 1. Objetivo

Construir un microservicio HTTP seguro, desplegable en Docker y preparado para producción, cuyo trabajo sea:

1. Recibir por API el contenido necesario para generar archivos internos.
2. Crear al menos un `index.html` y un archivo de texto dentro de una carpeta temporal.
3. Empaquetar esos archivos en un archivo `.rar`.
4. Responder al cliente con el `.rar` listo para descargar.

El servicio debe publicarse detrás de HTTPS y ser sencillo de desplegar en un servidor o plataforma cloud.

## 2. Nombre corto del proyecto

Nombre propuesto: `rarbox`

Razones:

1. Es corto.
2. Describe bien el propósito: RAR + API.
3. Funciona bien como nombre de carpeta, imagen Docker y dominio/subdominio.

Ejemplos:

1. Carpeta: `rarbox`
2. Imagen Docker: `rarbox:latest`
3. Servicio: `rarbox-service`
4. Dominio: `api.tudominio.com` o `rarbox.tudominio.com`

## 3. Alcance funcional inicial

Versión 1 del microservicio:

1. Endpoint para generar un `.rar`.
2. Entrada JSON con:
   - nombre base del paquete
   - contenido HTML
   - contenido TXT
   - nombres opcionales de archivos
3. Validación de tamaño, tipos y campos requeridos.
4. Creación de archivos temporales por request.
5. Compresión en formato RAR.
6. Respuesta binaria del archivo o URL temporal de descarga.
7. Logs básicos, healthcheck y configuración por variables de entorno.

Fuera de alcance para la primera versión:

1. Autenticación compleja por usuarios finales.
2. Panel web administrativo.
3. Persistencia en base de datos.
4. Almacenamiento permanente de archivos generados.

## 4. Flujo funcional

1. El cliente hace `POST /v1/archives/rar`.
2. El servicio valida el JSON de entrada.
3. Se crea un directorio temporal único.
4. Se escriben:
   - `index.html`
   - `content.txt`
5. Se ejecuta la herramienta de compresión RAR dentro del contenedor.
6. Se genera un archivo como `mi-paquete.rar`.
7. El servicio responde:
   - directamente con el binario del `.rar`, o
   - con metadatos y una URL temporal si más adelante se agrega almacenamiento externo.
8. Se eliminan los temporales al finalizar.

## 5. Contrato de entrada

### Endpoint principal

`POST /v1/archives/rar`

### Headers sugeridos

```http
Content-Type: application/json
X-API-Key: <secret-opcional>
```

### Request body propuesto

```json
{
  "archiveName": "entrega-cliente",
  "files": {
    "html": {
      "filename": "index.html",
      "content": "<html><body><h1>Hola</h1></body></html>"
    },
    "text": {
      "filename": "readme.txt",
      "content": "Este es el contenido del archivo de texto."
    }
  },
  "options": {
    "cleanup": true,
    "downloadName": "entrega-cliente.rar"
  }
}
```

### Reglas de validación

1. `archiveName`: requerido, texto corto, sin caracteres peligrosos.
2. `files.html.content`: requerido.
3. `files.text.content`: requerido.
4. `filename`: opcional, pero debe terminar en `.html` o `.txt` según el caso.
5. Limitar tamaño máximo del payload.
6. Sanitizar nombres de archivos para evitar path traversal.

### Ejemplo mínimo válido

```json
{
  "archiveName": "demo",
  "files": {
    "html": {
      "content": "<html><body>Demo</body></html>"
    },
    "text": {
      "content": "Texto de prueba"
    }
  }
}
```

## 6. Contrato de salida

### Opción recomendada para v1

Responder directamente con el `.rar`.

Headers esperados:

```http
HTTP/1.1 200 OK
Content-Type: application/vnd.rar
Content-Disposition: attachment; filename="entrega-cliente.rar"
```

Body:

1. Binario del archivo `.rar`.

### Respuesta de error

```json
{
  "error": "VALIDATION_ERROR",
  "message": "files.html.content es requerido",
  "requestId": "f4f4d0a1-92f2-4c1c-a0a4-15f7e7ef0001"
}
```

### Códigos HTTP sugeridos

1. `200` archivo generado correctamente.
2. `400` payload inválido.
3. `401` API key inválida, si se activa autenticación.
4. `413` payload demasiado grande.
5. `415` content-type inválido.
6. `500` error interno al crear archivos o comprimir.
7. `503` dependencia de compresión no disponible.

## 7. Stack recomendado

### Opción principal

Node.js + Fastify

Razones:

1. Rápido para construir APIs pequeñas.
2. Muy cómodo para manejar streams y archivos.
3. Buen soporte para validación con JSON Schema.
4. Excelente para contenedores pequeños.

### Dependencias esperadas

1. `fastify`
2. `@fastify/multipart` solo si luego se aceptan archivos reales
3. `@fastify/helmet`
4. `zod` o JSON Schema para validación
5. `pino` para logs
6. `uuid` para correlación de requests

### Herramienta de compresión

El punto crítico es la creación real del formato `.rar`.

Opciones:

1. Instalar `rar` o `winrar` CLI si la licencia y el sistema destino lo permiten.
2. Usar `7z` solo si el contenedor realmente soporta crear `.rar`.
3. Validar desde el inicio la herramienta disponible en producción, porque no todos los binarios permiten crear RAR; muchos solo extraen.

Decisión recomendada:

1. Definir explícitamente el binario de compresión desde la fase inicial.
2. Probar el contenedor localmente con el mismo binario que se usará en producción.
3. Si crear `.rar` no fuera viable por licencias o binarios, reevaluar temprano si el formato aceptable podría ser `.zip`.

## 8. Arquitectura propuesta

```text
Cliente HTTPS
    |
    v
Reverse proxy TLS (Nginx / Traefik / Caddy)
    |
    v
rarbox container
    |
    +-- Validador de payload
    +-- Generador de archivos temporales
    +-- Adaptador al binario RAR
    +-- Limpieza de temporales
    +-- Logs / healthcheck
```

## 9. Estructura de proyecto recomendada

```text
rarbox/
  plan.md
  Dockerfile
  docker-compose.yml
  .dockerignore
  .env.example
  README.md
  src/
    app.js
    server.js
    routes/
      health.js
      rar.js
    schemas/
      rar-request.schema.js
    services/
      archive-service.js
      temp-file-service.js
      rar-command-service.js
    utils/
      logger.js
      errors.js
      sanitize.js
  test/
    rar.e2e.test.js
    health.test.js
```

## 10. Diseño técnico interno

### Módulos

`routes/rar.js`

1. Recibe la petición.
2. Ejecuta validación.
3. Llama al servicio de generación.
4. Devuelve el stream del archivo.

`services/archive-service.js`

1. Crea la carpeta temporal.
2. Escribe archivos.
3. Invoca compresión.
4. Prepara respuesta.
5. Garantiza cleanup.

`services/rar-command-service.js`

1. Aísla la llamada al binario del sistema.
2. Evita acoplar la ruta del binario al resto del código.
3. Permite cambiar implementación más fácil.

`utils/sanitize.js`

1. Limpia nombres de archivo y nombre de paquete.
2. Previene caracteres inválidos o rutas peligrosas.

## 11. Seguridad

### HTTPS

La app puede correr en HTTP dentro del contenedor, pero en producción debe exponerse por HTTPS a través de un reverse proxy.

Recomendación:

1. Contenedor de app en puerto interno `3000`.
2. Nginx, Traefik o Caddy terminando TLS en `443`.
3. Certificados con Let's Encrypt.

### Medidas mínimas

1. API key simple en header para proteger el endpoint.
2. Límite de tamaño de body.
3. Rate limit por IP.
4. Sanitización estricta de nombres.
5. Directorio temporal aislado por request.
6. Timeout para la ejecución del proceso de compresión.
7. No permitir rutas arbitrarias ni nombres con `../`.
8. Borrar temporales incluso si falla el proceso.

## 12. Docker y contenedorización

### Objetivo del contenedor

Empaquetar la aplicación con la herramienta de compresión necesaria para que el comportamiento en local y producción sea idéntico.

### Dockerfile esperado

Características:

1. Imagen base liviana.
2. Instalación del runtime Node.js.
3. Instalación del binario de compresión RAR compatible.
4. Usuario no root.
5. Carpeta temporal controlada.
6. Healthcheck.

### Variables de entorno sugeridas

```env
PORT=3000
NODE_ENV=production
API_KEY=change-me
MAX_BODY_SIZE_MB=5
TEMP_DIR=/tmp/rarbox
RAR_BIN=/usr/bin/rar
REQUEST_TIMEOUT_MS=15000
```

### docker-compose para producción simple

Servicios sugeridos:

1. `rarbox`
2. `reverse-proxy`

Responsabilidades:

1. `rarbox` expone solo HTTP interno.
2. `reverse-proxy` expone `80/443`.
3. Certificados y redirección a HTTPS en el proxy.

## 13. Despliegue a producción

### Ruta recomendada

1. Construir imagen Docker.
2. Publicarla en un registry.
3. Desplegar en VPS o cloud.
4. Configurar dominio.
5. Montar reverse proxy con TLS.
6. Configurar variables de entorno seguras.
7. Activar logs y healthcheck.

### Opciones de hosting

1. VPS con Docker Compose.
2. AWS ECS/Fargate.
3. Azure Container Apps.
4. Google Cloud Run si el binario RAR es compatible con ese entorno.

### Checklist de producción

1. Dominio apuntando al servidor.
2. Certificado SSL funcionando.
3. Endpoint `/health` respondiendo `200`.
4. Tamaño máximo de request configurado.
5. API key almacenada fuera del repo.
6. Logs estructurados activados.
7. Política de reinicio del contenedor.
8. Monitoreo básico de CPU, RAM y errores.

## 14. Observabilidad

Agregar desde el inicio:

1. `GET /health`
2. `GET /ready`
3. Logs JSON con `requestId`
4. Métricas básicas si más adelante se integra Prometheus

Ejemplo de respuesta de health:

```json
{
  "status": "ok",
  "service": "rarbox"
}
```

## 15. Plan por fases

### Fase 1: base técnica ✅

1. ✅ Crear estructura del proyecto.
2. ✅ Levantar API con Fastify.
3. ✅ Crear endpoint `POST /v1/archives/rar`.
4. ✅ Implementar validación de entrada.

**Estado:** Completado. Fastify + validación con Zod + rutas /health y /ready

### Fase 2: generación de archivos ✅

1. ✅ Crear directorio temporal.
2. ✅ Escribir `index.html` y `readme.txt`.
3. ✅ Sanitizar nombres (prevención de path traversal).

**Estado:** Completado. TempFileService crea sesiones aisladas por request. Tests unitarios pasando.

### Fase 3: compresión RAR ✅

1. ✅ Integrar binario de compresión.
2. ✅ Ejecutar proceso con timeout.
3. ✅ Validar que el archivo final exista.
4. ✅ Retornar stream al cliente.

**Estado:** Completado. RarCommandService abstrae ejecución del binario. Respuesta binaria con headers de descarga. 15 tests pasando.

### Fase 4: endurecimiento

1. ✅ Agregar API key (ya implementada en Fase 1).
2. ⏳ Agregar rate limiting.
3. ✅ Agregar logs estructurados (ya implementado).
4. ✅ Asegurar cleanup robusto (ya implementado).

### Fase 5: Docker y release ✅

1. ✅ Crear Dockerfile (optimizado, incluye ugrep).
2. ✅ Crear `docker-compose.yml` (desarrollo).
3. ✅ Crear `docker-compose.prod.yml` (producción).
4. ✅ Agregar reverse proxy HTTPS (Caddy configurado).
5. ✅ Scripts de build (`./scripts/build.sh`).
6. ✅ Scripts de test Docker (`./scripts/test-docker.sh`).
7. ✅ Guía de deployment (`DEPLOYMENT.md`).
8. ✅ Configuración de producción (`.env.production.example`).

### Fase 6: pruebas

1. ✅ Test unitarios de validación.
2. ✅ Test e2e del endpoint.
3. ✅ Test de archivo `.rar` generado (validado con mock).
4. ✅ Test de errores y cleanup.

## 16. Riesgos y decisiones importantes

### Riesgo principal

La generación de archivos `.rar` puede depender de herramientas con restricciones de licencia o soporte limitado en Linux.

### Mitigación

1. Confirmar el binario exacto antes de implementar todo.
2. Construir un PoC de Docker solo para validar la compresión real.
3. Documentar claramente la dependencia.

### Otros riesgos

1. Payloads muy grandes.
2. Inyección por nombres de archivo.
3. Fugas de temporales.
4. Timeouts del proceso externo.

## 17. Primer entregable recomendado

Entregable inicial:

1. Servicio con `POST /v1/archives/rar`
2. Validación de entrada
3. Creación de `index.html` y `readme.txt`
4. Respuesta con archivo `.rar`
5. Dockerfile funcional
6. `docker-compose.yml` con proxy HTTPS para entorno de servidor

## 18. Siguiente paso sugerido

El siguiente paso ideal es crear el esqueleto del proyecto con:

1. Fastify
2. Endpoint `/health`
3. Endpoint `/v1/archives/rar`
4. Dockerfile
5. `docker-compose.yml`
6. Adaptador de compresión desacoplado para validar el binario RAR

Con eso quedará lista la base para comenzar la implementación real.
