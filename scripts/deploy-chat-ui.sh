#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy only the chat continuity and feedback changes, pinned to a reviewed commit.
# Leaves the original .env permissions, Compose/Caddy configuration, volumes, and math engine untouched.
cd /opt/eureka-chat
source_revision=b5cffdce6bc5a8462ac00b4d8371f807ab877047
stage="/home/deploy/eureka-chat-ui-$source_revision"
base_url="https://raw.githubusercontent.com/Eureka-Comm/OIA_Eureka_5.3/$source_revision"
files=(worker/index.js worker/eureka-runtime.js runtime/server.mjs server.mjs)
envfile="$stage/.env.deploy"

mkdir -p "$stage"
for file in "${files[@]}"; do
  mkdir -p "$stage/$(dirname "$file")"
  curl -fsSL "$base_url/$file" -o "$stage/$file"
  test -s "$stage/$file"
done

for file in "${files[@]}"; do
  docker run --rm --network none \
    -v "$stage:/drop:ro" \
    --entrypoint node eureka-chat-app --check "/drop/$file"
done

# Give Compose a protected temporary env file, disabling its implicit lookup of root-only /opt/eureka-chat/.env.
docker run --rm --network none --user 0 \
  -e "DEPLOY_UID=$(id -u)" -e "DEPLOY_GID=$(id -g)" \
  -v /opt/eureka-chat:/cfg:ro -v "$stage:/drop:rw" \
  --entrypoint sh eureka-chat-app -c '
    set -eu
    cp /cfg/.env /drop/.env.deploy
    chown "$DEPLOY_UID:$DEPLOY_GID" /drop/.env.deploy
    chmod 600 /drop/.env.deploy
  '
cleanup() { rm -f "$envfile"; }
trap cleanup EXIT
export COMPOSE_DISABLE_ENV_FILE=1

stamp=$(date +%Y%m%d-%H%M%S)
copy_sources() {
  docker run --rm --network none --user 0 \
    -e "BACKUP_STAMP=$stamp" \
    -v /opt/eureka-chat:/cfg:rw -v "$stage:/drop:ro" \
    --entrypoint sh eureka-chat-app -c '
      set -eu
      for f in worker/index.js worker/eureka-runtime.js runtime/server.mjs server.mjs; do
        if [ ! -e "/cfg/$f.backup-$BACKUP_STAMP" ]; then
          cp -p "/cfg/$f" "/cfg/$f.backup-$BACKUP_STAMP"
        fi
        cp "/drop/$f" "/cfg/$f.new"
        mv "/cfg/$f.new" "/cfg/$f"
      done
    '
}

restore_sources() {
  docker run --rm --network none --user 0 \
    -e "BACKUP_STAMP=$stamp" \
    -v /opt/eureka-chat:/cfg:rw \
    --entrypoint sh eureka-chat-app -c '
      set -eu
      for f in worker/index.js worker/eureka-runtime.js runtime/server.mjs server.mjs; do
        cp -p "/cfg/$f.backup-$BACKUP_STAMP" "/cfg/$f"
      done
    '
}

copy_sources
compose=(docker compose --env-file "$envfile" -p eureka-chat -f compose.yaml -f compose.existing-caddy.yaml)
if ! "${compose[@]}" up -d --no-deps --build runtime app; then
  echo "Build failed; restoring the previous chat files."
  restore_sources
  "${compose[@]}" up -d --no-deps --build runtime app || true
  exit 1
fi

app_state=unknown
runtime_state=unknown
for _ in $(seq 1 45); do
  app_state=$(docker inspect --format '{{.State.Health.Status}}' eureka-chat-app-1 2>/dev/null || true)
  runtime_state=$(docker inspect --format '{{.State.Health.Status}}' eureka-chat-runtime-1 2>/dev/null || true)
  if [ "$app_state" = healthy ] && [ "$runtime_state" = healthy ]; then
    echo "APP: $app_state"
    echo "RUNTIME: $runtime_state"
    echo "Chat update deployed. Backups: *.backup-$stamp"
    exit 0
  fi
  sleep 2
done

echo "Health check failed; restoring the previous chat files."
restore_sources
"${compose[@]}" up -d --no-deps --build runtime app || true
echo "APP: $app_state"
echo "RUNTIME: $runtime_state"
exit 1
