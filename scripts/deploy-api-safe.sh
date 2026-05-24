#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PM2_API_NAME="${PM2_API_NAME:-news-anime-monitor}"
LOCAL_API_URL="${DEPLOY_LOCAL_API_URL:-http://127.0.0.1:3001}"
API_ARTICLES_CHECK_URL="${DEPLOY_API_ARTICLES_CHECK_URL:-${LOCAL_API_URL}/articles?limit=1}"

cd "$ROOT_DIR"

echo "[deploy:api] start/restart pm2 api"
if pm2 describe "$PM2_API_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_API_NAME"
else
  pm2 start ecosystem.config.js --env production
fi

echo "[deploy:api] aguardando boot"
sleep 2

for i in {1..20}; do
  if curl -fsS "$LOCAL_API_URL/" >/dev/null 2>&1; then
    echo "[deploy:api] liveness ok"
    break
  fi
  sleep 1
done

curl -fsS "$LOCAL_API_URL/" >/dev/null
curl -fsS "$API_ARTICLES_CHECK_URL" >/dev/null

echo "[deploy:api] concluído"
