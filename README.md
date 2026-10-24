# Eureka Multiverse · Chat para VPS

Interfaz para conversar con el runtime de agentes de Eureka Multiverse. Se ejecuta como una aplicación Node.js en Docker detrás de Caddy, con HTTPS y autenticación HTTP Basic.

## Estado real

- El objetivo cognitivo y sus pendientes están definidos en `contracts/v0.1/arquitectura-cognitiva-eureka-multiverse-5-3.md`; la secuencia de trabajo está en el roadmap del workspace.
- El runtime persiste tareas, mensajes, invocaciones de especialistas, propuestas versionadas de EM Structurer y gates pendientes; el chat muestra la formulación y permite aceptar/rechazar con una cuenta Basic Auth dedicada vinculada mediante `EUREKA_ZERO_REVIEW_USERNAME`.
- Para habilitar decisiones desde la interfaz, configura `EUREKA_ZERO_REVIEW_USERNAME` igual al usuario Caddy de una cuenta dedicada a la revisión Eureka-0. Sin esa variable, las formulaciones aparecen en modo de solo lectura.
- El puente HTTP y un servicio privado están implementados en `worker/eureka-runtime.js` y `runtime/server.mjs`. El runtime carga las Skills fuente `eureka-multiverse-5-3@5.3.2` desde `runtime/skills/`, deja que EM Core determine respuesta directa o routing con dependencias, ejecuta los roles seleccionados y devuelve la síntesis a Core.
- La API pública de Eureka está protegida con claves Bearer separadas del token interno app↔runtime. Se crean, listan y revocan en el VPS con `docker compose exec app node scripts/eureka-api-keys.mjs ...`; el servidor guarda solo hashes.
- Los adjuntos se pueden enviar con cualquier extensión; el runtime conectado determina cuáles puede interpretar.
- El chat requiere que el runtime confirme EM Core como capacidad disponible. No devuelve respuestas simuladas.
- El runtime de Eureka incluye un adaptador de inferencia para Responses API y Chat Completions. Puede usar un proveedor remoto o Ollama local en Docker. El modelo ejecuta las Skills versionadas; Eureka es el pipeline, no el nombre del proveedor. El modelo aún debe configurarse y descargarse en el VPS. También falta conectar las herramientas MCP de EM Factory y el motor matemático determinista.
- EM Factory y el motor matemático continúan pendientes de sus propios adaptadores y conexiones verificables.
- El renderizador de subpáginas no crea aplicaciones ni gráficas por sí mismo. Solo puede servir artefactos reales integrados por el runtime.

El paquete puede versionarse en GitHub para revisión, pero preparar Docker no significa que el producto esté listo para producción. El VPS requiere credenciales de inferencia, validación integral y completar los gates de arquitectura que apliquen.

## Requisitos del VPS

- Linux con Docker Engine y Docker Compose.
- IP pública estática del Droplet o un dominio/subdominio con DNS A hacia esa IP.
- Puertos TCP 80 y 443 accesibles desde Internet.
- Acceso a un proveedor compatible con Responses API y una credencial de servidor para inferencia.
- Node.js 22 o superior en el equipo de desarrollo para ejecutar la validación local.

## Publicar en GitHub y desplegar en VPS

Cuando decidas publicar el código, crea un repositorio GitHub vacío y agrega su remoto desde esta carpeta:

```bash
git add .
git commit -m "Prepare Eureka Multiverse private chat"
git remote add origin <URL_DEL_REPOSITORIO>
git push -u origin main
```

En el VPS, clona el repositorio y prepara los secretos localmente:

```bash
git clone <URL_DEL_REPOSITORIO> eureka-chat-interface
cd eureka-chat-interface
cp .env.example .env
```

Edita `.env` con la IP pública del Droplet en `DOMAIN`, el usuario, hash de contraseña y token interno del runtime. No necesitas comprar un dominio para el primer despliegue: Caddy 2.11.7 obtiene un certificado HTTPS de Let's Encrypt para la IP usando el perfil `shortlived`; el certificado dura 160 horas y Caddy renueva automáticamente. Mantén los puertos 80 y 443 abiertos para que Caddy pueda validar y renovar el certificado. Para OpenAI, configura `MODEL_API_PROTOCOL=responses`, `MODEL_API_URL=https://api.openai.com/v1/responses`, `MODEL_API_KEY` y `MODEL_NAME`. Para inferencia local con Ollama, configura `MODEL_API_PROTOCOL=chat_completions`, `MODEL_API_URL=http://ollama:11434/v1/chat/completions`, `MODEL_API_AUTH_MODE=none`, `MODEL_API_ALLOW_HTTP=true` y el tag de modelo en `MODEL_NAME`; habilita el perfil con `docker compose --profile local-inference up -d --build` y descarga un modelo adecuado a la memoria del VPS con `docker compose exec ollama ollama pull <modelo>`. Las imágenes requieren un modelo con visión; archivos arbitrarios usan Responses API. Genera también un valor aleatorio privado para el token interno. Genera el hash bcrypt para la contraseña:

```bash
read -rsp "Contraseña para el chat: " SITE_PASSWORD; echo
docker run --rm -i caddy:2-alpine caddy hash-password --plaintext "$SITE_PASSWORD"
unset SITE_PASSWORD
```

Coloca el resultado en `SITE_PASSWORD_HASH` entre comillas simples. Mantén `.env` fuera del repositorio y restringe sus permisos. Inicia el sitio:

```bash
chmod 600 .env
docker compose up -d --build
docker compose ps
```

Abre `https://<IP-publica-del-Droplet>`. El estado del panel debe confirmar el runtime antes de invocar agentes. Para futuras versiones, ejecuta `git pull` y `docker compose up -d --build`.

Para emitir una API key Eureka después del primer arranque:

```bash
docker compose exec app node scripts/eureka-api-keys.mjs create "Integración"
```

Copia la clave que se imprime; se muestra una sola vez. Usa `Authorization: Bearer <api_key>` al llamar `/api/v1/eureka/capabilities` o `/api/v1/eureka/invocations`. Consulta [`runtime/openapi.yaml`](runtime/openapi.yaml) para el contrato.

## Acceso privado temporal mediante túnel SSH

Si no administras el DNS y no quieres publicar la aplicación en la IP, despliega el proyecto Compose con nombre propio y sin iniciar su Caddy. Este modo deja la interfaz enlazada únicamente a `127.0.0.1:5174` dentro del VPS; no modifica el Caddy, frontend, backend ni volúmenes del proyecto existente.

En el VPS, crea `.env` como se describe arriba. Para esta modalidad usa `DOMAIN=localhost`, `SITE_USER=unused` y `SITE_PASSWORD_HASH=unused`; el servicio Caddy queda desactivado y esos valores no se usan. Define un `EUREKA_RUNTIME_API_TOKEN` aleatorio y mantén `.env` con permisos `600`. Después, desde la carpeta del proyecto:

```bash
docker compose -p eureka-chat -f compose.yaml -f compose.ssh-tunnel.yaml up -d --build
```

Desde tu computadora abre un túnel SSH y déjalo ejecutándose:

```powershell
ssh -i "$env:USERPROFILE\.ssh\eureka_cr11" -o IdentitiesOnly=yes -N -L 5174:127.0.0.1:5174 deploy@143.198.230.30
```

Escribe la frase de contraseña de tu clave SSH cuando la solicite. Mientras ese comando siga abierto, visita `http://localhost:5174` en tu navegador. El tráfico entre tu computadora y el VPS viaja dentro de SSH; el puerto web del chat no queda publicado en Internet. Para cerrar el acceso, detén el túnel con `Ctrl+C`.

## IP pública en EUAPI con HTTPS y contraseña

Usa esta modalidad si quieres abrir el chat por la IP pública y conservar el Caddy existente de EUAPI. Añade un sitio IP con HTTPS y Basic Auth al Caddy actual, y conecta solo el contenedor `app` a la red Docker de ese Caddy. No publiques el puerto de la app ni cambies el bloque de `eurekamultiverse.ai`.

Primero confirma el nombre de la red compartida y la versión de Caddy:

```bash
docker inspect eureka-caddy --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}'
docker exec eureka-caddy caddy version
```

Usa el nombre de red que devuelve el primer comando en `EUAPI_CADDY_NETWORK` del `.env` del proyecto. Crea ese `.env` desde `.env.example`; como Compose evalúa variables del servicio Caddy aunque esté excluido por perfil, conserva `DOMAIN=localhost`, `SITE_USER=unused` y `SITE_PASSWORD_HASH=unused`. En el mismo archivo define `EUAPI_CADDY_NETWORK` con la red anterior y un valor aleatorio para `EUREKA_RUNTIME_API_TOKEN`. Arranca primero el proyecto nuevo para que la app quede lista en la red compartida:

```bash
docker compose -p eureka-chat -f compose.yaml -f compose.existing-caddy.yaml up -d --build
docker compose -p eureka-chat -f compose.yaml -f compose.existing-caddy.yaml ps
```

Confirma que la fila del runtime indique `healthy`. Luego haz una copia de seguridad y añade al `/opt/eureka/Caddyfile` un bloque adicional con la IP pública del Droplet. Genera un hash bcrypt en el servidor con Caddy; escribe una contraseña larga y única cuando la solicite el comando:

```bash
read -rsp 'Contraseña del chat: ' CHAT_PASSWORD; echo
docker exec eureka-caddy caddy hash-password --plaintext "$CHAT_PASSWORD"
unset CHAT_PASSWORD
```

Antes de editar, guarda una copia del Caddyfile actual:

```bash
cp /opt/eureka/Caddyfile "/opt/eureka/Caddyfile.backup.$(date +%Y%m%d-%H%M%S)"
```

Bloque que se añade al Caddyfile, sustituyendo la IP y las dos cadenas de ejemplo:

```caddyfile
143.198.230.30 {
    encode zstd gzip
    tls {
        issuer acme {
            profile shortlived
        }
    }
    basic_auth {
        eureka $2a$14$REEMPLAZA_CON_EL_HASH_BCRYPT
    }
    reverse_proxy eureka-chat:3000
}
```

Antes de recargar el proxy, valida el archivo:

```bash
docker exec eureka-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Después de guardar, valida el Caddyfile. Solo si la validación termina correctamente, recarga el Caddy existente:

```bash
docker exec eureka-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

Abre `https://<IP-publica-del-Droplet>` e inicia sesión con el usuario y contraseña definidos en el bloque nuevo. Caddy conserva el sitio actual en el mismo archivo. Si la validación falla, no recargues; restaura la copia de seguridad del Caddyfile antes de continuar. Los certificados IP de Let's Encrypt requieren el perfil `shortlived` y se renuevan automáticamente; mantén abiertos los puertos 80 y 443.

## Configuración

- `MODEL_API_URL`, `MODEL_API_PROTOCOL`, `MODEL_API_KEY`, `MODEL_NAME`: endpoint, protocolo, credencial y modelo del proveedor. Para Ollama se puede omitir la clave con `MODEL_API_AUTH_MODE=none`.
- `EUREKA_RUNTIME_API_TOKEN`: secreto interno compartido únicamente por la interfaz y el runtime dentro de Docker.
- El contrato HTTP de la interfaz está documentado en [`runtime/openapi.yaml`](runtime/openapi.yaml); el detalle del event store y del paquete de Skills está en [`runtime/README.md`](runtime/README.md).
- `EM_FACTORY_MCP_URL`, `EM_FACTORY_OAUTH_TOKEN`: reservados para un adaptador MCP autenticado; tenerlos definidos no valida conexión.
- `MATH_ENGINE_URL`: reservado para el motor matemático; aún no implementado.
- `EUREKA_DATA_DIR`: persistencia local para tareas y artefactos; el runtime comparte el volumen `/app/data` y guarda su event store en `runtime.json`.

No pegues secretos en el navegador, el repositorio ni mensajes de chat. `/api/status` solo informa estados y nunca devuelve credenciales.

## Validación local

Antes de subir cambios, ejecuta `npm run build`. Este comando empaqueta los módulos del worker e importa el resultado para confirmar que el artefacto se puede cargar. La inferencia requiere validación con credenciales de prueba, que no se guardan en el repositorio.
