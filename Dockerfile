FROM node:18-slim

WORKDIR /app
ENV PORT=5050

RUN apt-get update && apt-get install -y \
  ugrep \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --only=production

COPY src ./src

RUN if getent passwd 1000 >/dev/null; then \
      existing_user="$(getent passwd 1000 | cut -d: -f1)"; \
      chown -R "${existing_user}:${existing_user}" /app; \
    else \
      useradd -m -u 1000 appuser && chown -R appuser:appuser /app; \
    fi

RUN mkdir -p /app/temp && chmod 777 /app/temp && \
    mkdir -p /tmp/rarbox && chmod 777 /tmp/rarbox

USER 1000

EXPOSE 5050

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5050/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["npm", "start"]
