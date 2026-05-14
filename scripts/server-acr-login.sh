#!/usr/bin/env bash
#
# scripts/server-acr-login.sh
#
# Run this ONCE on the production server (as the `deploy` user) so that
# `docker pull` from the Aliyun ACR private repository works without
# prompting. After this, GitHub Actions can SSH in and pull images freely.
#
# Why VPC domain? The server is in the same Aliyun region as the ACR
# instance, so pulls go through the internal VPC network — no traffic
# charges, no 1 Mbps personal-tier rate limit, much faster.
#
# Usage:
#   ./scripts/server-acr-login.sh \
#     --registry crpi-xxx-vpc.cn-beijing.personal.cr.aliyuncs.com \
#     --username dk9898
#   (will prompt for password)
#
# Or non-interactively:
#   ACR_PASSWORD='...' ./scripts/server-acr-login.sh \
#     --registry crpi-xxx-vpc.cn-beijing.personal.cr.aliyuncs.com \
#     --username dk9898

set -euo pipefail

REGISTRY=""
USERNAME=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --registry) REGISTRY="$2"; shift 2 ;;
    --username) USERNAME="$2"; shift 2 ;;
    -h|--help)
      grep '^# ' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$REGISTRY" || -z "$USERNAME" ]]; then
  echo "ERROR: --registry and --username are required." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found. Run scripts/server-bootstrap.sh first." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: cannot talk to docker daemon. Are you in the docker group?" >&2
  echo "       Try: newgrp docker  (or log out and back in)" >&2
  exit 1
fi

if [[ -n "${ACR_PASSWORD:-}" ]]; then
  echo "$ACR_PASSWORD" | docker login "$REGISTRY" --username "$USERNAME" --password-stdin
else
  docker login "$REGISTRY" --username "$USERNAME"
fi

echo ""
echo "OK. Credentials saved to ~/.docker/config.json"
echo "Test it:"
echo "  docker pull $REGISTRY/<namespace>/app:latest"
