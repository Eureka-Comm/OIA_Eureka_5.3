#!/usr/bin/env bash
set -Eeuo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecuta este script como root en EUAPI."
  exit 1
fi

cd /opt/eureka-chat
stamp=$(date +%Y%m%d-%H%M%S)
echo "Respaldando y descargando el adaptador actualizado..."
cp -p runtime/server.mjs "runtime/server.mjs.backup-$stamp"
cp -p worker/eureka-runtime.js "worker/eureka-runtime.js.backup-$stamp"

curl -fsSL https://raw.githubusercontent.com/Eureka-Comm/OIA_Eureka_5.3/main/runtime/server.mjs -o runtime/server.mjs.new
curl -fsSL https://raw.githubusercontent.com/Eureka-Comm/OIA_Eureka_5.3/main/worker/eureka-runtime.js -o worker/eureka-runtime.js.new
if [ "$(stat -c %s runtime/server.mjs.new)" -lt 30000 ] || ! grep -Fq 'server.listen(port' runtime/server.mjs.new; then
  echo "Error: runtime/server.mjs llegó incompleto; no se reemplazaron los archivos." >&2
  exit 1
fi
if ! grep -Fq 'eureka_core_routing' runtime/server.mjs.new; then
  echo "Error: no se encontró el esquema estructurado de Core; no se reemplazaron los archivos." >&2
  exit 1
fi
if ! grep -Fq 'typeof payload?.error' worker/eureka-runtime.js.new; then
  echo "Error: el adaptador de la interfaz está incompleto; no se reemplazaron los archivos." >&2
  exit 1
fi
mv runtime/server.mjs.new runtime/server.mjs
mv worker/eureka-runtime.js.new worker/eureka-runtime.js

echo "Reconstruyendo runtime y app..."
docker compose -p eureka-chat -f compose.yaml -f compose.existing-caddy.yaml up -d --no-deps --build runtime app

for _ in $(seq 1 30); do
  app_state=$(docker inspect --format '{{.State.Health.Status}}' eureka-chat-app-1 2>/dev/null || true)
  runtime_state=$(docker inspect --format '{{.State.Health.Status}}' eureka-chat-runtime-1 2>/dev/null || true)
  if [ "$app_state" = healthy ] && [ "$runtime_state" = healthy ]; then
    break
  fi
  sleep 2
done

echo "APP: ${app_state:-unknown}"
echo "RUNTIME: ${runtime_state:-unknown}"
docker exec eureka-chat-app-1 node -e 'const s=require("node:fs").readFileSync("/app/worker/eureka-runtime.js","utf8");if(!s.includes("typeof payload?.error"))process.exit(1);console.log("APP: adaptador actualizado")'
docker exec eureka-chat-runtime-1 node -e 'const s=require("node:fs").readFileSync("/app/runtime/server.mjs","utf8");if(!s.includes("eureka_core_routing"))process.exit(1);console.log("RUNTIME: planificador actualizado")'

docker exec eureka-chat-runtime-1 node -e '
(async () => {
  const r = await fetch("http://127.0.0.1:3001/v1/invocations", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.EUREKA_RUNTIME_API_TOKEN}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ agent: "core", task: "que necesitamos para incorporar el motor matematico a eureka" })
  });
  console.log("Prueba Core HTTP:", r.status);
  console.log(await r.text());
  if (!r.ok) process.exitCode = 1;
})().catch(e => {
  console.error(e.name + ": " + e.message);
  process.exitCode = 1;
});
'

