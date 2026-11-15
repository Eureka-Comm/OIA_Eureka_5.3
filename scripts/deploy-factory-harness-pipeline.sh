#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy the Factory -> Harness handoff to the existing OpenAI Eureka runtime.
# This updates only the chat app and runtime; it does not recreate Caddy or DeepSeek.

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecuta este script como root en el VPS."
  exit 1
fi

REV=${1:-}
if [[ ! "$REV" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Uso: $0 <commit-sha-de-40-caracteres>"
  exit 2
fi

APP_DIR=/opt/eureka-chat
STAMP=$(date +%Y%m%d-%H%M%S)
RELEASE="$APP_DIR/releases/factory-harness-$STAMP"
SOURCE="$RELEASE/source"
BACKUP="$RELEASE/backup"
BASE_URL="https://github.com/Eureka-Comm/OIA_Eureka_5.3/archive/$REV.tar.gz"
FILES=(runtime/server.mjs runtime/harness.mjs worker/index.js worker/harness-page.js)

cd "$APP_DIR"
test -s .env || { echo "No existe $APP_DIR/.env; no se modificó el despliegue."; exit 1; }
test -s compose.yaml || { echo "Falta compose.yaml; no se modificó el despliegue."; exit 1; }
test -s compose.existing-caddy.yaml || { echo "Falta compose.existing-caddy.yaml; no se modificó el despliegue."; exit 1; }
test -s compose.harness.yaml || { echo "Falta compose.harness.yaml; no se modificó el despliegue."; exit 1; }

mkdir -p "$SOURCE" "$BACKUP"
curl -fsSL "$BASE_URL" | tar -xz --strip-components=1 -C "$SOURCE"
for file in "${FILES[@]}"; do
  test -s "$SOURCE/$file" || { echo "Paquete incompleto: falta $file; no se modificó el despliegue."; exit 1; }
  mkdir -p "$BACKUP/$(dirname "$file")"
  cp -a "$APP_DIR/$file" "$BACKUP/$file"
done

COMPOSE=(docker compose --env-file "$APP_DIR/.env" --project-directory "$APP_DIR" -p eureka-chat -f compose.yaml -f compose.existing-caddy.yaml -f compose.harness.yaml)
OLD_RUNTIME=$(docker inspect --format '{{.Image}}' eureka-chat-runtime-1)
OLD_APP=$(docker inspect --format '{{.Image}}' eureka-chat-app-1)
docker image tag "$OLD_RUNTIME" "eureka-chat-runtime:rollback-$STAMP"
docker image tag "$OLD_APP" "eureka-chat-app:rollback-$STAMP"

restore() {
  local status=$?
  trap - ERR
  echo "Falló la actualización; restaurando solo el chat Eureka y su runtime..."
  for file in "${FILES[@]}"; do cp -a "$BACKUP/$file" "$APP_DIR/$file"; done
  docker image tag "eureka-chat-runtime:rollback-$STAMP" eureka-chat-runtime:latest || true
  docker image tag "eureka-chat-app:rollback-$STAMP" eureka-chat-app:latest || true
  "${COMPOSE[@]}" up -d --no-deps --no-build runtime app || true
  exit "$status"
}
trap restore ERR

for file in "${FILES[@]}"; do cp -a "$SOURCE/$file" "$APP_DIR/$file"; done
"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" build runtime app
"${COMPOSE[@]}" up -d --no-deps --no-build runtime app

APP_HEALTH=unknown
RUNTIME_HEALTH=unknown
for _ in $(seq 1 60); do
  APP_HEALTH=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' eureka-chat-app-1 2>/dev/null || true)
  RUNTIME_HEALTH=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' eureka-chat-runtime-1 2>/dev/null || true)
  if [ "$APP_HEALTH" = healthy ] && [ "$RUNTIME_HEALTH" = healthy ]; then break; fi
  sleep 2
done
if [ "$APP_HEALTH" != healthy ] || [ "$RUNTIME_HEALTH" != healthy ]; then
  echo "Health check falló: APP=$APP_HEALTH RUNTIME=$RUNTIME_HEALTH"
  false
fi

FACTORY_STATUS=$(docker exec eureka-chat-runtime-1 node -e '
fetch("http://127.0.0.1:3001/v1/capabilities",{headers:{authorization:"Bearer "+process.env.EUREKA_RUNTIME_API_TOKEN}})
 .then(async r=>{if(!r.ok)process.exit(2);const d=await r.json();const f=d.integrations?.emFactoryMcp;console.log(typeof f==="string"?f:(f?.status||"unavailable"))})
 .catch(()=>{console.log("unavailable");process.exitCode=2})
' || true)

trap - ERR
echo "APP: $APP_HEALTH"
echo "RUNTIME: $RUNTIME_HEALTH"
echo "Factory: ${FACTORY_STATUS:-sin_confirmar}"
echo "Pipeline Factory → Harness desplegado en revisión $REV. Respaldo: $BACKUP"
