#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR/web"
DOMAIN_URL="${DEPLOY_DOMAIN_URL:-https://omnizap.xyz}"
LOCAL_URL="${DEPLOY_LOCAL_URL:-http://127.0.0.1:3010}"

echo "[deploy] build do frontend"
cd "$WEB_DIR"
rm -rf .next
npm run build

echo "[deploy] restart pm2 web"
pm2 restart news-anime-web

echo "[deploy] aguardando boot"
sleep 2

for i in {1..20}; do
  if curl -fsS -I "$LOCAL_URL" >/dev/null 2>&1; then
    echo "[deploy] local ok"
    break
  fi
  sleep 1
done

curl -fsS -I "$LOCAL_URL" >/dev/null
curl -fsS -I "$DOMAIN_URL" >/dev/null

echo "[deploy] healthcheck seo"
cd "$ROOT_DIR"
node src/scripts/seo-healthcheck.js

echo "[deploy] concluído"

