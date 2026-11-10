#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy the OpenAI chat under /v2 without changing the DeepSeek root site.
cd /opt/eureka-chat
ref="${EUREKA_DEPLOY_REF:-2f5ac0e08b63dcd07c26f02163eea9058a4b63cd}"
base_url="https://raw.githubusercontent.com/Eureka-Comm/OIA_Eureka_5.3/${ref}"
stage="/home/deploy/eureka-openai-v2-${ref//[^A-Za-z0-9._-]/_}"
envfile="$stage/.env.deploy"
composefile="$stage/compose.deploy.yaml"
source_file="$stage/worker/index.js"
mkdir -p "$stage/worker"
cleanup() { rm -f "$envfile" "$composefile"; }
trap cleanup EXIT

echo "Descargando el frontend OpenAI de OIA_Eureka_5.3 (${ref})..."
curl -fsSL "$base_url/worker/index.js" -o "$source_file"
test -s "$source_file"
docker run --rm --network none -v "$stage:/drop:ro" \
  --entrypoint node eureka-chat-app --check /drop/worker/index.js

stamp=$(date +%Y%m%d-%H%M%S)
uid=$(id -u)
gid=$(id -g)

# Copy the protected Compose environment through a root container; never print it.
docker run --rm --network none --user 0 \
  -e "DEPLOY_UID=$uid" -e "DEPLOY_GID=$gid" \
  -v /opt/eureka-chat:/cfg:ro -v "$stage:/drop:rw" \
  --entrypoint node eureka-chat-app -e '
const fs=require("node:fs");
fs.copyFileSync("/cfg/.env","/drop/.env.deploy");
fs.chownSync("/drop/.env.deploy",Number(process.env.DEPLOY_UID),Number(process.env.DEPLOY_GID));
fs.chmodSync("/drop/.env.deploy",0o600);
'
grep -Fqx '    env_file: .env' /opt/eureka-chat/compose.yaml
sed "s|^    env_file: \.env$|    env_file: $envfile|" \
  /opt/eureka-chat/compose.yaml > "$composefile"
export COMPOSE_DISABLE_ENV_FILE=1
compose=(docker compose --env-file "$envfile" --project-directory /opt/eureka-chat \
  -p eureka-chat -f "$composefile" -f /opt/eureka-chat/compose.existing-caddy.yaml)

# Save and replace only the frontend worker used by the app container.
docker run --rm --network none --user 0 -e "BACKUP_STAMP=$stamp" \
  -v /opt/eureka-chat/worker:/cfg:rw -v "$stage/worker:/drop:ro" \
  --entrypoint node eureka-chat-app -e '
const fs=require("node:fs");
const dest="/cfg/index.js", backup=dest+".backup-v2-"+process.env.BACKUP_STAMP;
fs.copyFileSync(dest,backup); fs.chmodSync(backup,0o600);
const temp=dest+".new"; fs.copyFileSync("/drop/index.js",temp);
fs.chmodSync(temp,0o644); fs.renameSync(temp,dest);
'

if ! "${compose[@]}" up -d --no-deps --build app; then
  echo "App build failed; restoring the previous worker."
  docker run --rm --network none --user 0 -e "BACKUP_STAMP=$stamp" \
    -v /opt/eureka-chat/worker:/cfg:rw --entrypoint node eureka-chat-app -e '
const fs=require("node:fs");
const dest="/cfg/index.js", backup=dest+".backup-v2-"+process.env.BACKUP_STAMP;
fs.copyFileSync(backup,dest); fs.chmodSync(dest,0o644);
'
  "${compose[@]}" up -d --no-deps --build app || true
  exit 1
fi

for _ in $(seq 1 45); do
  app_state=$(docker inspect --format '{{.State.Health.Status}}' eureka-chat-app-1 2>/dev/null || true)
  [ "$app_state" = healthy ] && break
  sleep 2
done
if [ "${app_state:-unknown}" != healthy ]; then
  echo "OpenAI app did not become healthy; restoring the previous worker."
  docker run --rm --network none --user 0 -e "BACKUP_STAMP=$stamp" \
    -v /opt/eureka-chat/worker:/cfg:rw --entrypoint node eureka-chat-app -e '
const fs=require("node:fs");
const dest="/cfg/index.js", backup=dest+".backup-v2-"+process.env.BACKUP_STAMP;
fs.copyFileSync(backup,dest); fs.chmodSync(dest,0o644);
'
  "${compose[@]}" up -d --no-deps --build app || true
  exit 1
fi


echo "Frontend actualizado y healthy. La configuración de autenticación Caddy no se modificó."
