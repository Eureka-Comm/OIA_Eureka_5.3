#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy the pinned EM Factory MCP bridge without exposing or replacing .env.
if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecuta este script como root en el VPS."
  exit 1
fi

APP_DIR=/opt/eureka-chat
REV=555cc702e69c9445aeea48aea6d04986aad72aec
STAMP=$(date +%Y%m%d-%H%M%S)
RELEASE="$APP_DIR/releases/factory-$STAMP"
SOURCE="$RELEASE/source"
BACKUP="$RELEASE/backup"
BASE_URL="https://github.com/Eureka-Comm/OIA_Eureka_5.3/archive/$REV.tar.gz"
FILES=(Dockerfile package.json package-lock.json factory-mcp.js compose.yaml server.mjs worker/index.js worker/eureka-runtime.js runtime/server.mjs)

cd "$APP_DIR"
test -s .env || { echo "No existe $APP_DIR/.env; no se modificó el despliegue."; exit 1; }
test -s compose.existing-caddy.yaml || { echo "Falta compose.existing-caddy.yaml; no se modificó el despliegue."; exit 1; }
test -s compose.harness.yaml || { echo "Falta compose.harness.yaml; no se modificó el despliegue."; exit 1; }

mkdir -p "$SOURCE" "$BACKUP"
curl -fsSL "$BASE_URL" | tar -xz --strip-components=1 -C "$SOURCE"

for file in "${FILES[@]}"; do
  test -s "$SOURCE/$file" || { echo "Paquete incompleto: falta $file."; exit 1; }
  mkdir -p "$BACKUP/$(dirname "$file")" "$(dirname "$file")"
  cp -a "$file" "$BACKUP/$file"
done

COMPOSE=(docker compose --env-file "$APP_DIR/.env" --project-directory "$APP_DIR" -p eureka-chat -f compose.yaml -f compose.existing-caddy.yaml -f compose.harness.yaml)
OLD_RUNTIME=$(docker inspect --format '{{.Image}}' eureka-chat-runtime-1)
OLD_APP=$(docker inspect --format '{{.Image}}' eureka-chat-app-1)
docker image tag "$OLD_RUNTIME" "eureka-chat-runtime:rollback-$STAMP"
docker image tag "$OLD_APP" "eureka-chat-app:rollback-$STAMP"

restore() {
  echo "Falló el despliegue; restaurando archivos e imágenes anteriores..."
  for file in "${FILES[@]}"; do cp -a "$BACKUP/$file" "$APP_DIR/$file"; done
  docker image tag "eureka-chat-runtime:rollback-$STAMP" eureka-chat-runtime:latest || true
  docker image tag "eureka-chat-app:rollback-$STAMP" eureka-chat-app:latest || true
  "${COMPOSE[@]}" up -d --no-deps --no-build runtime app || true
}
trap restore ERR

for file in "${FILES[@]}"; do cp -a "$SOURCE/$file" "$APP_DIR/$file"; done
"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" build runtime app
"${COMPOSE[@]}" up -d --no-deps --no-build runtime app

for _ in $(seq 1 45); do
  APP_HEALTH=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' eureka-chat-app-1 2>/dev/null || true)
  RUNTIME_HEALTH=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' eureka-chat-runtime-1 2>/dev/null || true)
  if [ "$APP_HEALTH" = healthy ] && [ "$RUNTIME_HEALTH" = healthy ]; then
    trap - ERR
    echo "APP: $APP_HEALTH"
    echo "RUNTIME: $RUNTIME_HEALTH"
    echo "Adaptador desplegado. Respaldo: $BACKUP"
    echo "Factory requiere sus credenciales privadas antes de reportar conexión."
    exit 0
  fi
  sleep 2
done

echo "Health check falló: APP=$APP_HEALTH RUNTIME=$RUNTIME_HEALTH"
false
