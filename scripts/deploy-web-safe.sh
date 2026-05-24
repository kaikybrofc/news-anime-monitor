#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR/web"
PM2_WEB_NAME="${PM2_WEB_NAME:-news-anime-web}"
DOMAIN_URL="${DEPLOY_DOMAIN_URL:-https://animeradar.shop}"
LOCAL_URL="${DEPLOY_LOCAL_WEB_URL:-http://127.0.0.1:3010}"
SKIP_SEO_CHECK="${DEPLOY_SKIP_SEO_CHECK:-false}"

echo "[deploy:web] build do frontend"
cd "$WEB_DIR"
rm -rf .next
npm run build

echo "[deploy:web] start/restart pm2 web"
if pm2 describe "$PM2_WEB_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_WEB_NAME"
else
  pm2 start npm --name "$PM2_WEB_NAME" --cwd "$WEB_DIR" -- start
fi

echo "[deploy:web] aguardando boot"
sleep 2

for i in {1..20}; do
  if curl -fsS -I "$LOCAL_URL" >/dev/null 2>&1; then
    echo "[deploy:web] local ok"
    break
  fi
  sleep 1
done

curl -fsS -I "$LOCAL_URL" >/dev/null
curl -fsS -I "$DOMAIN_URL" >/dev/null

if [ "$SKIP_SEO_CHECK" = "true" ]; then
  echo "[deploy:web] healthcheck seo ignorado"
else
  echo "[deploy:web] healthcheck seo"
  cd "$ROOT_DIR"
  node src/scripts/seo-healthcheck.js
fi

echo "[deploy:web] concluído"
