#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy the OpenAI chat under /v2 without changing the DeepSeek root site.
cd /opt/eureka-chat
ref="${EUREKA_DEPLOY_REF:-main}"
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

# Read the current Basic Auth identity from the IP site and add an idempotent
# /v2 route to the existing domain block. The hash is never printed.
docker run --rm --network none --user 0 -e "BACKUP_STAMP=$stamp" \
  -v /opt/eureka/caddy:/cfg:rw --entrypoint node eureka-chat-app -e '
const fs=require("node:fs");
const file="/cfg/Caddyfile";
let source=fs.readFileSync(file,"utf8");
function findBlock(text,pattern){
  const match=pattern.exec(text); if(!match) throw new Error("No se encontró un bloque Caddy esperado.");
  const open=text.indexOf("{",match.index); let depth=0;
  for(let i=open;i<text.length;i++){if(text[i]==="{")depth++;else if(text[i]==="}"&&--depth===0)return {start:match.index,end:i+1,bodyStart:open+1,bodyEnd:i};}
  throw new Error("Bloque Caddy sin cierre.");
}
const ip=findBlock(source,/^\s*143\.198\.230\.30\s*\{/m);
const auth=source.slice(ip.start,ip.end).match(/basic_auth\s*\{\s*([^\s{}]+)\s+(\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53})\s*\}/s);
if(!auth) throw new Error("No pude leer el Basic Auth existente; Caddyfile intacto.");
let site=findBlock(source,/^\s*eurekamultiverse\.ai\s*,\s*www\.eurekamultiverse\.ai\s*\{/m);
let block=source.slice(site.start,site.end);
const begin="# EUREKA_OPENAI_V2_BEGIN", end="# EUREKA_OPENAI_V2_END";
const a=block.indexOf(begin), b=block.indexOf(end);
if((a>=0)!==(b>=0)) throw new Error("Marcadores /v2 incompletos; Caddyfile intacto.");
if(a>=0) block=block.slice(0,a)+block.slice(b+end.length);
const fallback=/^([ \t]*)reverse_proxy[ \t]+frontend:80[ \t]*$/m.exec(block);
if(!fallback) throw new Error("No encontré el proxy DeepSeek frontend:80; Caddyfile intacto.");
const indent=fallback[1];
const route=[
  `${indent}${begin}`,
  `${indent}@openai_v2_root path /v2`,
  `${indent}redir @openai_v2_root /v2/ 308`,
  `${indent}handle_path /v2/* {`,
  `${indent}    basic_auth {`,
  `${indent}        ${auth[1]} ${auth[2]}`,
  `${indent}    }`,
  `${indent}    reverse_proxy eureka-chat:3000`,
  `${indent}}`,
  `${indent}${end}`,
  ""
].join("\n");
block=block.replace(fallback[0],route+fallback[0]);
source=source.slice(0,site.start)+block+source.slice(site.end);
const stamp=process.env.BACKUP_STAMP, backup=`${file}.backup-v2-${stamp}`;
fs.copyFileSync(file,backup); fs.chmodSync(backup,0o600);
// Caddy mounts this as an individual file. Write in place so the mount keeps
// observing updates; replacing the inode with rename leaves the container stale.
fs.writeFileSync(file,source,{mode:fs.statSync(file).mode&0o777});
console.log(`Ruta /v2 preparada. Respaldo protegido: Caddyfile.backup-v2-${stamp}`);
'

restore_caddy() {
  echo "Restaurando la configuración Caddy respaldada..."
  docker run --rm --network none --user 0 -e "BACKUP_STAMP=$stamp" \
    -v /opt/eureka/caddy:/cfg:rw --entrypoint node eureka-chat-app -e '
const fs=require("node:fs"); const file="/cfg/Caddyfile";
const backup=`${file}.backup-v2-${process.env.BACKUP_STAMP}`;
fs.writeFileSync(file,fs.readFileSync(backup),{mode:fs.statSync(file).mode&0o777});
'
  docker compose --project-directory /opt/eureka -f /opt/eureka/docker-compose.yml \
    -p eureka up -d --no-deps --force-recreate caddy || true
}

caddy_image=$(docker inspect --format '{{.Config.Image}}' eureka-caddy)
if ! docker run --rm --network none \
  -v /opt/eureka/caddy/Caddyfile:/etc/caddy/Caddyfile:ro \
  --entrypoint caddy "$caddy_image" validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
  echo "Host Caddyfile validation failed."
  restore_caddy
  exit 1
fi

# Previous deployments atomically replaced this single-file bind mount. If its
# container view differs from the host, recreate only Caddy to remount the file.
host_hash=$(sha256sum /opt/eureka/caddy/Caddyfile | awk '{print $1}')
container_hash=$(docker exec eureka-caddy sh -c 'sha256sum /etc/caddy/Caddyfile' | awk '{print $1}')
if [ "$host_hash" != "$container_hash" ]; then
  echo "Actualizando el montaje individual de Caddy recreando solo el proxy..."
  if ! docker compose --project-directory /opt/eureka -f /opt/eureka/docker-compose.yml \
    -p eureka up -d --no-deps --force-recreate caddy; then
    restore_caddy
    exit 1
  fi
fi

if ! docker exec eureka-caddy grep -Fq '# EUREKA_OPENAI_V2_BEGIN' /etc/caddy/Caddyfile ||
   ! docker exec eureka-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile ||
   ! docker exec eureka-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
  echo "La ruta /v2 no quedó cargada en el contenedor Caddy."
  restore_caddy
  exit 1
fi

root_status=$(curl -q -k -sS -o /dev/null -w '%{http_code}' https://eurekamultiverse.ai/)
v2_status=$(curl -q -k -sS -o /dev/null -w '%{http_code}' https://eurekamultiverse.ai/v2/)
printf 'DeepSeek raíz: HTTP %s\n' "$root_status"
printf 'Chat OpenAI /v2 sin credenciales: HTTP %s\n' "$v2_status"
if [ "$root_status" != 200 ] || [ "$v2_status" != 401 ]; then
  echo "La verificación de enrutamiento falló; restauro Caddy."
  restore_caddy
  exit 1
fi
echo "Despliegue /v2 aplicado. Worker backup: worker/index.js.backup-v2-$stamp"

