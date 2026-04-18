# rarbox Deployment Guide

## Overview

rarbox is production-ready with Docker containerization, automatic HTTPS via Caddy, and comprehensive monitoring.

## Quick Start

### 1. Build the Docker Image

```bash
./scripts/build.sh latest
```

Or manually:

```bash
docker build -t rarbox:latest .
```

### 2. Configure Environment

```bash
cp .env.production.example .env.production
# Edit .env.production with your API_KEY and other settings
```

### 3. Deploy with Docker Compose

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Configuration

### Required Variables

- `API_KEY`: Strong random key to protect the API (e.g., 32+ characters)

### Optional Variables

- `RATE_LIMIT_MAX`: Requests per window (default: 10)
- `RATE_LIMIT_WINDOW_MS`: Time window in ms (default: 60000 = 1 minute)
- `MAX_BODY_SIZE_MB`: Max request size (default: 5)
- `REQUEST_TIMEOUT_MS`: RAR compression timeout (default: 15000)
- `LOG_LEVEL`: info, warn, error, debug (default: info)

## HTTPS Setup

### Option A: Let's Encrypt (Automatic)

Edit `Caddyfile.prod` and replace `rarbox.example.com` with your domain:

```caddy
your-domain.com {
  # ... configuration
}
```

Caddy will automatically request and renew certificates.

### Option B: Custom Certificate

Place your certificate and key files and update Caddyfile:

```caddy
your-domain.com {
  tls /path/to/cert.pem /path/to/key.pem
  # ... rest of configuration
}
```

## Monitoring

### Health Checks

```bash
curl http://localhost/health
curl http://localhost/ready
```

### Metrics

```bash
curl http://localhost/metrics
```

Returns:
- Request counts and success rate
- Rate limit statistics
- Archive generation stats
- Service uptime

### Logs

Logs are streamed to stdout and also saved to `rarbox_logs` volume.

View logs:

```bash
docker compose -f docker-compose.prod.yml logs rarbox
# Follow logs
docker compose -f docker-compose.prod.yml logs -f rarbox
```

## Security Checklist

- [ ] Set strong `API_KEY` (32+ random characters)
- [ ] Configure `RATE_LIMIT_MAX` appropriately for your use case
- [ ] Set `MAX_BODY_SIZE_MB` to limit payload size
- [ ] Use HTTPS in production (Caddy handles this)
- [ ] Keep Docker images updated
- [ ] Review logs regularly for suspicious activity
- [ ] Restrict network access to the reverse proxy port
- [ ] Use environment files, not hardcoded secrets

## Scaling

### Horizontal Scaling

To run multiple rarbox instances:

```bash
# In docker-compose.prod.yml, under rarbox service:
deploy:
  replicas: 3
```

Caddy will automatically load balance across instances.

### Performance Tuning

- Increase `MAX_BODY_SIZE_MB` if processing large files
- Increase `REQUEST_TIMEOUT_MS` if compression takes longer
- Decrease `RATE_LIMIT_MAX` to be more restrictive
- Monitor uptime and adjust based on metrics

## Troubleshooting

### Container won't start

```bash
docker compose -f docker-compose.prod.yml logs rarbox
```

Check:
- API_KEY is set
- Ports 80/443 are available
- Disk space for `/tmp/rarbox`

### Rate limiting too strict

Adjust in `.env.production`:

```env
RATE_LIMIT_MAX=20
RATE_LIMIT_WINDOW_MS=60000
```

### HTTPS not working

Check Caddy logs:

```bash
docker compose -f docker-compose.prod.yml logs reverse-proxy
```

Ensure domain points to server and port 443 is accessible.

### RAR binary not found

Ensure `rar` or `ugrep` is installed in the container (already in Dockerfile).

If you use a custom image, add:

```dockerfile
RUN apt-get install -y rar
```

## Backup and Recovery

### Backup configuration

```bash
docker compose -f docker-compose.prod.yml config > backup.yml
```

### Restore

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

## Upgrades

### Update container image

```bash
git pull
./scripts/build.sh v1.1.0
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Rollback

```bash
docker compose -f docker-compose.prod.yml down
docker run -d --name rarbox:previous-version
```

## Production Checklist

- [ ] Domain configured and DNS pointing to server
- [ ] HTTPS certificate working (test with browser)
- [ ] API key configured and stored securely
- [ ] Rate limiting configured appropriately
- [ ] Logs aggregation set up (optional)
- [ ] Monitoring/alerting in place (optional)
- [ ] Backup strategy documented
- [ ] Disaster recovery plan in place

## Support

For issues:

1. Check logs: `docker compose logs rarbox`
2. Test health: `curl http://localhost/health`
3. Verify configuration: `docker compose config`
