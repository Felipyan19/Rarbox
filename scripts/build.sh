#!/bin/bash
set -e

# Build script for rarbox Docker image
# Usage: ./scripts/build.sh [tag]

TAG=${1:-"latest"}
IMAGE_NAME="rarbox:$TAG"

echo "Building Docker image: $IMAGE_NAME"

docker build -t "$IMAGE_NAME" \
  --build-arg NODE_ENV=production \
  .

echo "✓ Build complete: $IMAGE_NAME"
echo ""
echo "Next steps:"
echo "1. Tag and push to registry:"
echo "   docker tag $IMAGE_NAME your-registry/rarbox:$TAG"
echo "   docker push your-registry/rarbox:$TAG"
echo ""
echo "2. Or run locally:"
echo "   docker run -p 3000:3000 \\
  -e API_KEY=your-secret-key \\
  -e RATE_LIMIT_MAX=10 \\
  $IMAGE_NAME"
