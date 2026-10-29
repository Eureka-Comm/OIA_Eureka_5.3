#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/eureka-chat
available=$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)
if (( available < 800000 )); then echo "Se requieren al menos 800 MB de RAM disponible para activar el navegador junto al servicio actual. No se modificó el despliegue."; exit 1; fi
if (( $(df -Pk /opt/eureka-chat | awk 'NR==2 {print $4}') < 6000000 )); then echo "Se requieren 6 GB libres para construir el navegador. No se modificó el despliegue."; exit 1; fi
revision=2ef3c673927063cba62fad34dc25dac10d667b6f
stage="/home/deploy/eureka-harness-$revision"
mkdir -p "$stage"
files=(harness/Dockerfile.runner harness/Dockerfile.browser harness/runner.mjs harness/browser.mjs harness/README.md harness/integration.test.mjs runtime/harness.mjs runtime/server.mjs worker/harness-page.js worker/index.js server.mjs compose.harness.yaml)
for f in "${files[@]}"; do mkdir -p "$stage/$(dirname "$f")"; curl -fsSL "https://raw.githubusercontent.com/Eureka-Comm/OIA_Eureka_5.3/$revision/$f" -o "$stage/$f"; done
for f in runtime/harness.mjs runtime/server.mjs worker/harness-page.js worker/index.js server.mjs harness/runner.mjs harness/browser.mjs; do
 docker run --rm --network none -v "$stage:/check:ro" --entrypoint node eureka-chat-app --check "/check/$f"
done
docker build -t eureka-browser:1 -f "$stage/harness/Dockerfile.browser" "$stage/harness"
printf '%s' '{"html":"<!doctype html><html><body><button id=\"go\" onclick=\"document.getElementById(\u0027result\u0027).hidden=false\">Go</button><p id=\"result\" hidden>OK</p></body></html>","tests":[{"action":"click","selector":"#go","value":""},{"action":"visible","selector":"#result","value":""}]}' |
 docker run --rm --init --network none --read-only --cap-drop ALL --security-opt no-new-privileges --memory 512m --cpus 0.75 --pids-limit 128 --shm-size 128m --tmpfs /tmp:rw,nosuid,size=128m -i eureka-browser:1 > "$stage/browser-check.json"
docker run --rm --network none -v "$stage:/check:ro" --entrypoint node eureka-chat-app -e 'const r=require("/check/browser-check.json");if(r.status!=="passed"||r.tests.length!==2||!r.screenshot)process.exit(1);console.log("Prueba real de navegador: correcta")'
envfile="$stage/.env.deploy"
composefile="$stage/compose.deploy.yaml"
trap 'rm -f "$envfile" "$composefile"' EXIT
docker run --rm --network none --user 0 -e "DEPLOY_UID=$(id -u)" -e "DEPLOY_GID=$(id -g)" -v /opt/eureka-chat:/cfg:ro -v "$stage:/drop:rw" --entrypoint sh eureka-chat-app -c 'set -eu; cp /cfg/.env /drop/.env.deploy; chown "$DEPLOY_UID:$DEPLOY_GID" /drop/.env.deploy; chmod 600 /drop/.env.deploy'
grep -Fqx '    env_file: .env' compose.yaml
sed "s|^    env_file: \.env$|    env_file: $envfile|" compose.yaml > "$composefile"
stamp=$(date +%Y%m%d-%H%M%S)
docker run --rm --network none --user 0 -e "STAMP=$stamp" -v /opt/eureka-chat:/cfg:rw -v "$stage:/drop:ro" --entrypoint sh eureka-chat-app -c 'set -eu; for f in harness/Dockerfile.runner harness/Dockerfile.browser harness/runner.mjs harness/browser.mjs harness/README.md harness/integration.test.mjs runtime/harness.mjs runtime/server.mjs worker/harness-page.js worker/index.js server.mjs compose.harness.yaml; do mkdir -p "/cfg/$(dirname "$f")"; if [ -f "/cfg/$f" ]; then cp -p "/cfg/$f" "/cfg/$f.backup-$STAMP"; fi; cp "/drop/$f" "/cfg/$f"; done'
export COMPOSE_DISABLE_ENV_FILE=1
compose=(docker compose --env-file "$envfile" --project-directory /opt/eureka-chat -p eureka-chat -f "$composefile" -f /opt/eureka-chat/compose.existing-caddy.yaml -f /opt/eureka-chat/compose.harness.yaml)
rollback(){
 echo "Restaurando los servicios anteriores..."
 docker run --rm --network none --user 0 -e "STAMP=$stamp" -v /opt/eureka-chat:/cfg:rw --entrypoint sh eureka-chat-app -c 'set -eu; for f in runtime/harness.mjs worker/harness-page.js runtime/server.mjs worker/index.js server.mjs; do cp -p "/cfg/$f.backup-$STAMP" "/cfg/$f"; done'
 "${compose[@]}" stop harness || true
 docker compose --env-file "$envfile" --project-directory /opt/eureka-chat -p eureka-chat -f "$composefile" -f /opt/eureka-chat/compose.existing-caddy.yaml up -d --no-deps --build runtime app
}
if ! "${compose[@]}" up -d --no-deps --build harness runtime app; then rollback; exit 1; fi
for i in $(seq 1 45); do
 a=$(docker inspect -f '{{.State.Health.Status}}' eureka-chat-app-1 2>/dev/null || true)
 r=$(docker inspect -f '{{.State.Health.Status}}' eureka-chat-runtime-1 2>/dev/null || true)
 h=$(docker inspect -f '{{.State.Health.Status}}' eureka-chat-harness-1 2>/dev/null || true)
 if [[ "$a" == healthy && "$r" == healthy && "$h" == healthy ]]; then
  echo "Chat actualizado. Aplicaciones se encuentra dentro del menú del chat: https://143.198.230.30/"
  echo "Respaldo: *.backup-$stamp. Conserva compose.harness.yaml en futuros despliegues."
  exit 0
 fi
 sleep 2
done
rollback
exit 1
