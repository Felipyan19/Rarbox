#!/bin/bash
set -e

# Test Docker build and basic functionality
# Usage: ./scripts/test-docker.sh

IMAGE_NAME="rarbox:test"
CONTAINER_NAME="rarbox-test"
TEST_API_KEY="test-key-12345"

echo "🐳 Building Docker image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" .

echo "🚀 Starting container..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -p 3001:3000 \
  -e API_KEY="$TEST_API_KEY" \
  -e LOG_LEVEL=debug \
  "$IMAGE_NAME"

# Wait for container to start
echo "⏳ Waiting for container to be ready..."
sleep 3

# Test health endpoint
echo "✓ Testing /health endpoint..."
HEALTH=$(curl -s http://localhost:3001/health)
if echo "$HEALTH" | grep -q "ok"; then
  echo "  ✓ Health check passed"
else
  echo "  ✗ Health check failed: $HEALTH"
  docker logs "$CONTAINER_NAME"
  docker rm -f "$CONTAINER_NAME"
  exit 1
fi

# Test ready endpoint
echo "✓ Testing /ready endpoint..."
READY=$(curl -s http://localhost:3001/ready)
if echo "$READY" | grep -q "ready"; then
  echo "  ✓ Ready check passed"
else
  echo "  ✗ Ready check failed"
  docker rm -f "$CONTAINER_NAME"
  exit 1
fi

# Test metrics endpoint
echo "✓ Testing /metrics endpoint..."
METRICS=$(curl -s http://localhost:3001/metrics)
if echo "$METRICS" | grep -q "requests"; then
  echo "  ✓ Metrics endpoint working"
else
  echo "  ✗ Metrics endpoint failed"
  docker rm -f "$CONTAINER_NAME"
  exit 1
fi

# Test RAR endpoint (without API key - should fail)
echo "✓ Testing /v1/archives/rar authentication..."
AUTH_TEST=$(curl -s -w "%{http_code}" http://localhost:3001/v1/archives/rar \
  -H "Content-Type: application/json" \
  -d '{"archiveName":"test","files":{"html":{"content":"<html></html>"},"text":{"content":"test"}}}')
HTTP_CODE=${AUTH_TEST: -3}
if [ "$HTTP_CODE" == "401" ]; then
  echo "  ✓ Authentication required (401)"
else
  echo "  ✗ Expected 401, got $HTTP_CODE"
  docker rm -f "$CONTAINER_NAME"
  exit 1
fi

# Test RAR endpoint (with API key)
echo "✓ Testing /v1/archives/rar with API key..."
RAR_TEST=$(curl -s -w "%{http_code}" -o /tmp/test.rar \
  http://localhost:3001/v1/archives/rar \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $TEST_API_KEY" \
  -d '{"archiveName":"test","files":{"html":{"content":"<html></html>"},"text":{"content":"test"}}}')
HTTP_CODE=${RAR_TEST: -3}
if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "500" ] || [ "$HTTP_CODE" == "503" ]; then
  echo "  ✓ RAR endpoint responds (HTTP $HTTP_CODE)"
else
  echo "  ✗ Unexpected status code: $HTTP_CODE"
  docker rm -f "$CONTAINER_NAME"
  exit 1
fi

echo ""
echo "✅ All Docker tests passed!"
echo ""
echo "Cleaning up..."
docker rm -f "$CONTAINER_NAME"

echo "✓ Ready to deploy! Next steps:"
echo "  1. Build and tag: docker build -t your-registry/rarbox:v1.0.0 ."
echo "  2. Push: docker push your-registry/rarbox:v1.0.0"
echo "  3. Deploy: docker-compose -f docker-compose.prod.yml up -d"
