#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_REF="${1:-${DEPLOY_REF:-main}}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_COMPONENT="${DEPLOY_COMPONENT:-full}"
DOMAIN_URL="${DEPLOY_DOMAIN_URL:-https://animeradar.shop}"
LOCAL_API_URL="${DEPLOY_LOCAL_API_URL:-http://127.0.0.1:3001}"
LOCAL_WEB_URL="${DEPLOY_LOCAL_WEB_URL:-http://127.0.0.1:3010}"
PUBLIC_API_URL="${DEPLOY_PUBLIC_API_URL:-${DOMAIN_URL}/monitor-api/articles?limit=1}"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
PREVIOUS_SHA="$(git -C "$ROOT_DIR" rev-parse HEAD)"

cd "$ROOT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
    nvm use --lts >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[deploy:vps] npm não encontrado no shell remoto. Verifique a instalação do Node/NVM." >&2
  exit 127
fi

echo "[deploy:vps] usando node $(node -v) e npm $(npm -v)"
echo "[deploy:vps] sha atual: $PREVIOUS_SHA"
echo "[deploy:vps] preparando ref: $DEPLOY_REF"

git fetch --prune origin

if git show-ref --verify --quiet "refs/remotes/origin/$DEPLOY_REF"; then
  git checkout -B "$DEPLOY_BRANCH" "origin/$DEPLOY_REF"
else
  git checkout "$DEPLOY_REF"
fi

DEPLOYED_SHA="$(git rev-parse HEAD)"
echo "[deploy:vps] sha implantado: $DEPLOYED_SHA"

echo "[deploy:vps] instalando dependências da api"
npm ci

if [ "$DEPLOY_COMPONENT" = "full" ] || [ "$DEPLOY_COMPONENT" = "web" ]; then
  echo "[deploy:vps] instalando dependências do frontend"
  npm --prefix web ci
fi

if [ "$DEPLOY_COMPONENT" = "full" ] || [ "$DEPLOY_COMPONENT" = "api" ]; then
  echo "[deploy:vps] deploy da api"
  bash scripts/deploy-api-safe.sh

  echo "[deploy:vps] verificação local api"
  curl -fsS "$LOCAL_API_URL/" >/dev/null
  curl -fsS "$LOCAL_API_URL/articles?limit=1" >/dev/null

  echo "[deploy:vps] verificação pública api"
  curl -fsS "$PUBLIC_API_URL" >/dev/null
fi

if [ "$DEPLOY_COMPONENT" = "full" ] || [ "$DEPLOY_COMPONENT" = "web" ]; then
  echo "[deploy:vps] deploy do frontend"
  bash scripts/deploy-web-safe.sh

  echo "[deploy:vps] verificação local frontend"
  curl -fsS -I "$LOCAL_WEB_URL" >/dev/null

  echo "[deploy:vps] verificação pública frontend"
  curl -fsS -I "$DOMAIN_URL" >/dev/null
fi

echo "[deploy:vps] concluído"
