#!/usr/bin/env bash
set -Eeuo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecuta este script en la Web Console como root."; exit 1; }
stage=$(mktemp -d /opt/eureka/session-v2.XXXXXX)
chmod 700 "$stage"
docker cp eureka-caddy:/tmp/Caddyfile-v2 "$stage/previous" >/dev/null
chmod 600 "$stage/previous"
cp /opt/eureka/caddy/Caddyfile "$stage/host-backup"
docker run --rm --network none --user 0 -v "$stage:/work" --entrypoint node eureka-chat-app -e '
const fs=require("node:fs");
let s=fs.readFileSync("/work/previous","utf8");
const start=s.indexOf("# EUREKA_OPENAI_V2_BEGIN"), stop=s.indexOf("# EUREKA_OPENAI_V2_END");
if(start<0||stop<start) throw Error("No se encontró la ruta /v2 existente.");
const route=`# EUREKA_OPENAI_V2_BEGIN
    @openai_v2_root path /v2
    redir @openai_v2_root /v2/ 308
    handle_path /v2/* {
        route {
            @unsafe_origin {
                not method GET HEAD OPTIONS
                not header Origin https://eurekamultiverse.ai https://www.eurekamultiverse.ai
            }
            respond @unsafe_origin "Origen no autorizado" 403
            @document {
                method GET HEAD
                header Accept *text/html*
                not path /api/*
            }
            handle @document {
                forward_auth frontend:80 {
                    uri /api/auth/me
                    header_up -Authorization
                    @login status 401 403
                    handle_response @login {
                        redir /login 303
                    }
                }
                reverse_proxy eureka-chat:3000
            }
            handle {
                forward_auth frontend:80 {
                    uri /api/auth/me
                    header_up -Authorization
                }
                reverse_proxy eureka-chat:3000
            }
        }
    }
    # EUREKA_OPENAI_V2_END`;
s=s.slice(0,start)+route+s.slice(stop+"# EUREKA_OPENAI_V2_END".length);
fs.writeFileSync("/work/candidate",s,{mode:0o600});
'
docker cp "$stage/candidate" eureka-caddy:/tmp/Caddyfile-session-v2 >/dev/null
docker exec eureka-caddy chmod 600 /tmp/Caddyfile-session-v2
docker exec eureka-caddy caddy validate --config /tmp/Caddyfile-session-v2 --adapter caddyfile
rollback() {
  docker cp "$stage/previous" eureka-caddy:/tmp/Caddyfile-session-rollback >/dev/null
  docker exec eureka-caddy caddy reload --config /tmp/Caddyfile-session-rollback --adapter caddyfile
  cat "$stage/host-backup" > /opt/eureka/caddy/Caddyfile
}
trap 'rollback; echo "Falló la activación; se restauró la protección anterior."; exit 1' ERR
docker exec eureka-caddy caddy reload --config /tmp/Caddyfile-session-v2 --adapter caddyfile
page=$(curl -q --resolve eurekamultiverse.ai:443:127.0.0.1 -sS -H 'Accept: text/html' -o /dev/null -w '%{http_code}' https://eurekamultiverse.ai/v2/)
api=$(curl -q --resolve eurekamultiverse.ai:443:127.0.0.1 -sS -o /dev/null -w '%{http_code}' https://eurekamultiverse.ai/v2/api/status)
fake=$(curl -q --resolve eurekamultiverse.ai:443:127.0.0.1 -sS -H 'Cookie: session=invalid' -o /dev/null -w '%{http_code}' https://eurekamultiverse.ai/v2/api/status)
root=$(curl -q --resolve eurekamultiverse.ai:443:127.0.0.1 -sS -o /dev/null -w '%{http_code}' https://eurekamultiverse.ai/)
[ "$page" = 303 ] && [ "$api" = 401 ] && [ "$fake" = 401 ] && [ "$root" = 200 ]
cat "$stage/candidate" > /opt/eureka/caddy/Caddyfile
trap - ERR
echo "Sesión principal configurada: página=$page API=$api cookie inválida=$fake raíz=$root"
echo "Respaldo protegido: $stage"
echo "Falta verificar /v2/ desde el navegador con sesión iniciada."
