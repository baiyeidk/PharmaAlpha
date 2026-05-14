#!/usr/bin/env bash
#
# scripts/server-bootstrap.sh
#
# Run this ONCE on the production server before the first GitHub Actions
# deployment. Idempotent — safe to re-run.
#
# Usage:
#   sudo bash server-bootstrap.sh \
#     --repo  https://github.com/<your-org>/PharmaAlpha.git \
#     --path  /opt/pharma-alpha \
#     --user  deploy
#
set -euo pipefail

REPO_URL=""
DEPLOY_PATH="/opt/pharma-alpha"
DEPLOY_USER="deploy"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO_URL="$2"; shift 2 ;;
    --path) DEPLOY_PATH="$2"; shift 2 ;;
    --user) DEPLOY_USER="$2"; shift 2 ;;
    -h|--help)
      grep '^# ' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$REPO_URL" ]]; then
  echo "ERROR: --repo is required" >&2
  exit 1
fi

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: must run as root (use sudo)" >&2
  exit 1
fi

echo "==> [1/6] Verifying Docker"
if ! command -v docker >/dev/null 2>&1; then
  echo "  Docker not found, installing via official convenience script (CN mirror)"
  curl -fsSL https://get.docker.com | bash -s -- --mirror Aliyun
  systemctl enable --now docker
fi
docker --version
docker compose version

echo "==> [2/6] Creating deploy user '$DEPLOY_USER'"
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
fi
# Allow running docker without sudo
usermod -aG docker "$DEPLOY_USER"

echo "==> [3/6] Setting up SSH key for GitHub Actions"
SSH_DIR="/home/$DEPLOY_USER/.ssh"
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"
touch "$SSH_DIR/authorized_keys"
chmod 600 "$SSH_DIR/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$SSH_DIR"
echo "  → Append your GitHub Actions deploy public key to: $SSH_DIR/authorized_keys"

echo "==> [4/6] Cloning repo into $DEPLOY_PATH"
mkdir -p "$DEPLOY_PATH"
chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH"
if [[ ! -d "$DEPLOY_PATH/.git" ]]; then
  sudo -u "$DEPLOY_USER" git clone "$REPO_URL" "$DEPLOY_PATH"
else
  echo "  Repo already cloned, skipping"
fi

echo "==> [5/6] Preparing production env file"
ENV_FILE="$DEPLOY_PATH/.env.production"
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$DEPLOY_PATH/.env.production.example" ]]; then
    cp "$DEPLOY_PATH/.env.production.example" "$ENV_FILE"
    echo "  Copied .env.production.example → .env.production"
  else
    cat >"$ENV_FILE" <<'EOF'
# Fill in production values, then re-run the deploy.
NEXTAUTH_SECRET=
LLM_API_KEY=
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_MODEL=qwen-plus
DASHSCOPE_API_KEY=
EMBEDDING_PROVIDER=dashscope
EMBEDDING_API_KEY=
EMBEDDING_MODEL=text-embedding-v4
EMBEDDING_DIMENSIONS=1024
POSTGRES_PASSWORD=
EOF
  fi
  chown "$DEPLOY_USER:$DEPLOY_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "  ⚠  EDIT $ENV_FILE NOW with real production secrets before deploying."
else
  echo "  $ENV_FILE already exists, leaving as-is"
fi

echo "==> [6/6] Done."
cat <<EOM

────────────────────────────────────────────────────────────
Next steps:

1. Add the deploy user's authorized_keys with your GitHub
   Actions SSH public key:
     vim $SSH_DIR/authorized_keys

2. Edit production secrets:
     vim $ENV_FILE

3. In GitHub repo → Settings → Secrets and variables → Actions,
   add these REPOSITORY SECRETS:
     SSH_HOST          = <this server's public IP or domain>
     SSH_USER          = $DEPLOY_USER
     SSH_PORT          = 22                 (or your custom port)
     SSH_PRIVATE_KEY   = (the matching private key, full PEM)
     DEPLOY_PATH       = $DEPLOY_PATH

   And optionally a REPOSITORY VARIABLE for post-deploy probe:
     HEALTH_URL        = http://<your-domain-or-ip>:3000/

4. Open firewall for ports your app needs (e.g. 3000 or 80/443
   if you put nginx in front). Do NOT open 5432 to the internet.

5. Push to main → GitHub Actions will auto-deploy.

For first-time launch you can also do it manually as $DEPLOY_USER:
  cd $DEPLOY_PATH
  docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
────────────────────────────────────────────────────────────
EOM
