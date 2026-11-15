#!/usr/bin/env bash
set -Eeuo pipefail

# Route the OpenAI chat at /v2 through Eureka's existing browser session.
# The DeepSeek root site remains on frontend:80; no Basic Auth secret is copied.
[ "$(id -u)" = 0 ] || { echo "Ejecuta este script en la Web Console como root."; exit 1; }

FILE=/opt/eureka/caddy/Caddyfile
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$FILE.backup-v2-session-$STAMP"
CANDIDATE="$FILE.v2-session-$STAMP"
IMAGE=$(docker inspect --format '{{.Config.Image}}' eureka-chat-app-1)

test -s "$FILE"
docker inspect eureka-caddy >/dev/null
docker inspect eureka-chat-app-1 >/dev/null
cp -a "$FILE" "$BACKUP"

# Build a candidate from the mounted host Caddyfile. This edits only the
# eurekamultiverse.ai site block and is idempotent across reruns.
docker run --rm --network none --user 0 \
  -e "STAMP=$STAMP" -v /opt/eureka/caddy:/cfg:rw \
  --entrypoint node "$IMAGE" -e '
const fs = require("node:fs");
const file = "/cfg/Caddyfile";
let source = fs.readFileSync(file, "utf8");
const openMarker = "# EUREKA_OPENAI_V2_BEGIN";
const closeMarker = "# EUREKA_OPENAI_V2_END";
const open = source.indexOf(openMarker), close = source.indexOf(closeMarker);
if ((open >= 0) !== (close >= 0) || (open >= 0 && close < open)) throw new Error("Marcadores /v2 incompletos.");
if (open >= 0) source = source.slice(0, open) + source.slice(close + closeMarker.length);
const site = /^eurekamultiverse\.ai,\s*www\.eurekamultiverse\.ai\s*\{/m.exec(source);
if (!site) throw new Error("No se encontró el bloque de dominio de Eureka.");
const begin = site.index;
const brace = source.indexOf("{", begin);
let depth = 0, end = -1;
for (let i = brace; i < source.length; i++) {
  if (source[i] === "{") depth++;
  else if (source[i] === "}" && --depth === 0) { end = i; break; }
}
if (end < 0) throw new Error("El bloque de dominio no tiene cierre.");
let block = source.slice(begin, end + 1);
const fallback = /^([ \t]*)reverse_proxy[ \t]+frontend:80[ \t]*$/m.exec(block);
if (!fallback) throw new Error("No se encontró el proxy DeepSeek frontend:80; no se modificó la ruta.");
const indent = fallback[1];
const route = [
  `${indent}${openMarker}`,
  `${indent}@openai_v2_root path /v2`,
  `${indent}redir @openai_v2_root /v2/ 308`,
  `${indent}handle_path /v2/* {`,
  `${indent}    route {`,
  `${indent}        @unsafe_origin {`,
  `${indent}            not method GET HEAD OPTIONS`,
  `${indent}            not header_regexp origin Origin ^https://(www[.])?eurekamultiverse[.]ai$`,
  `${indent}        }`,
  `${indent}        respond @unsafe_origin "Origen no autorizado" 403`,
  `${indent}        @document {`,
  `${indent}            method GET HEAD`,
  `${indent}            header Accept *text/html*`,
  `${indent}            not path /api/*`,
  `${indent}        }`,
  `${indent}        handle @document {`,
  `${indent}            forward_auth frontend:80 {`,
  `${indent}                uri /api/auth/me`,
  `${indent}                header_up -Authorization`,
  `${indent}                @login status 401 403`,
  `${indent}                handle_response @login {`,
  `${indent}                    redir /login 303`,
  `${indent}                }`,
  `${indent}            }`,
  `${indent}            reverse_proxy eureka-chat:3000`,
  `${indent}        }`,
  `${indent}        handle {`,
  `${indent}            forward_auth frontend:80 {`,
  `${indent}                uri /api/auth/me`,
  `${indent}                header_up -Authorization`,
  `${indent}            }`,
  `${indent}            reverse_proxy eureka-chat:3000`,
  `${indent}        }`,
  `${indent}    }`,
  `${indent}}`,
  `${indent}${closeMarker}`,
  ""
].join("\n");
block = block.replace(fallback[0], route + fallback[0]);
const candidate = source.slice(0, begin) + block + source.slice(end + 1);
fs.writeFileSync(`/cfg/Caddyfile.v2-session-${process.env.STAMP || "candidate"}`, candidate, { mode: 0o600 });
console.log("Candidato /v2 generado; Caddyfile activo sigue intacto.");
' 

test -s "$CANDIDATE"
docker cp "$CANDIDATE" "eureka-caddy:/tmp/Caddyfile-v2-session-$STAMP" >/dev/null
docker exec eureka-caddy caddy validate --config "/tmp/Caddyfile-v2-session-$STAMP" --adapter caddyfile

restore() {
  cat "$BACKUP" > "$FILE"
  docker exec eureka-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile || true
  echo "Se restauró Caddyfile desde $BACKUP"
}
trap 'restore' ERR

# Write through the existing bind-mounted inode; reload only after the file is complete.
cat "$CANDIDATE" > "$FILE"
docker exec eureka-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec eureka-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

root_status=$(curl -q -k -sS -o /dev/null -w '%{http_code}' https://eurekamultiverse.ai/)
page_status=$(curl -q -k -sS -H 'Accept: text/html' -o /dev/null -w '%{http_code}' https://eurekamultiverse.ai/v2/)
api_status=$(curl -q -k -sS -o /dev/null -w '%{http_code}' https://eurekamultiverse.ai/v2/api/status)
fake_cookie_status=$(curl -q -k -sS -H 'Cookie: session=invalid' -o /dev/null -w '%{http_code}' https://eurekamultiverse.ai/v2/api/status)
printf 'DeepSeek raíz: HTTP %s\nChat OpenAI /v2 sin sesión: HTTP %s\nAPI /v2 sin sesión: HTTP %s\nCookie inválida: HTTP %s\n' \
  "$root_status" "$page_status" "$api_status" "$fake_cookie_status"

if [ "$root_status" != 200 ] || [ "$page_status" != 303 ] || [ "$api_status" != 401 ] || [ "$fake_cookie_status" != 401 ]; then
  echo "La verificación de rutas o sesión falló."
  false
fi

trap - ERR
rm -f "$CANDIDATE"
echo "Ruta /v2 conectada a la sesión Eureka existente. Sin autenticación Basic adicional."
echo "DeepSeek permanece en /; respaldo Caddy: $BACKUP"

