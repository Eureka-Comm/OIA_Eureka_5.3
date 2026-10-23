# Eureka Multiverse · Chat privado en VPS

Interfaz privada para conversar con el runtime de agentes de Eureka Multiverse. Se ejecuta como una aplicación Node.js en Docker detrás de Caddy, con HTTPS y autenticación HTTP Basic.

## Estado real

- El objetivo cognitivo y sus pendientes están definidos en `contracts/v0.1/arquitectura-cognitiva-eureka-multiverse-5-3.md`; la secuencia de trabajo está en el roadmap del workspace.
- La interfaz persiste conversaciones y eventos básicos por tarea. Aún no expone el modelo completo de formulación revisable, gates, capa semántica compartida ni paneles de gobierno de Eureka-0.
- El puente HTTP y un servicio privado están implementados en `worker/eureka-runtime.js` y `runtime/server.mjs`. El runtime carga las Skills fuente `eureka-multiverse-5-3@5.3.2` desde `runtime/skills/`, deja que EM Core determine respuesta directa o routing con dependencias, ejecuta los roles seleccionados y devuelve la síntesis a Core.
- Los adjuntos se pueden enviar con cualquier extensión; el runtime conectado determina cuáles puede interpretar.
- El chat requiere que el runtime confirme EM Core como capacidad disponible. No devuelve respuestas simuladas.
- El runtime de Eureka incluye un adaptador de inferencia para Responses API y Chat Completions. Puede usar un proveedor remoto o Ollama local en Docker. El modelo ejecuta las Skills versionadas; Eureka es el pipeline, no el nombre del proveedor. El modelo aún debe configurarse y descargarse en el VPS. También falta conectar las herramientas MCP de EM Factory y el motor matemático determinista.
- EM Factory y el motor matemático continúan pendientes de sus propios adaptadores y conexiones verificables.
- El renderizador de subpáginas no crea aplicaciones ni gráficas por sí mismo. Solo puede servir artefactos reales integrados por el runtime.

El paquete puede versionarse en GitHub para revisión, pero preparar Docker no significa que el producto esté listo para producción. El VPS requiere credenciales de inferencia, validación integral y completar los gates de arquitectura que apliquen.

## Requisitos del VPS

- Linux con Docker Engine y Docker Compose.
- Dominio o subdominio con DNS A hacia la IP pública del VPS.
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

Edita `.env` con dominio, usuario, hash de contraseña y token interno del runtime. Para OpenAI, configura `MODEL_API_PROTOCOL=responses`, `MODEL_API_URL=https://api.openai.com/v1/responses`, `MODEL_API_KEY` y `MODEL_NAME`. Para inferencia local con Ollama, configura `MODEL_API_PROTOCOL=chat_completions`, `MODEL_API_URL=http://ollama:11434/v1/chat/completions`, `MODEL_API_AUTH_MODE=none`, `MODEL_API_ALLOW_HTTP=true` y el tag de modelo en `MODEL_NAME`; habilita el perfil con `docker compose --profile local-inference up -d --build` y descarga un modelo adecuado a la memoria del VPS con `docker compose exec ollama ollama pull <modelo>`. Las imágenes requieren un modelo con visión; archivos arbitrarios usan Responses API. Genera también un valor aleatorio privado para el token interno. Genera el hash bcrypt para la contraseña:

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

Abre `https://<tu-dominio>`. El estado del panel debe confirmar el runtime antes de invocar agentes. Para futuras versiones, ejecuta `git pull` y `docker compose up -d --build`.

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
