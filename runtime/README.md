# Eureka Multiverse API v0.3

Servicio privado que expone el runtime para la interfaz de Eureka Multiverse. Se publica solo dentro de la red Docker `runtime_internal`; no tiene puertos publicados en el host. Carga el contenido original de las Skills del paquete instalado `eureka-multiverse-5-3@5.3.2`, versionado bajo `runtime/skills/`.

## Rutas

- `GET /health`: health check sin datos sensibles.
- `GET /v1/capabilities`: requiere `Authorization: Bearer <EUREKA_RUNTIME_API_TOKEN>` y enumera Core y los siete roles. Los roles solo se marcan `available` si el endpoint, el modelo y la autenticación requerida para el protocolo están configurados.
- `POST /v1/invocations`: requiere el mismo token y recibe invocaciones solo para `agent: "core"`. Un intento de invocar un especialista directamente recibe `403`.
- `POST /v1/tasks`: crea una tarea persistente con intención y evento inicial.
- `GET /v1/tasks/{taskId}`: recupera tarea, mensajes e InteractionState.
- `POST /v1/tasks/{taskId}/messages`: ejecuta un turno de Core dentro de la tarea.
- `GET /v1/tasks/{taskId}/events?after={sequence}`: devuelve eventos desde una secuencia dada.

La respuesta contiene `agent: "core"`, `taskId`, `status`, `product.text`, `routedAgents`, `routingReason` y referencias de solicitud del proveedor. El adaptador carga Eureka Multiverse y EM Core junto con las referencias incluidas en sus Skills, acepta el plan adaptativo de Core, carga la Skill versionada de cada especialista delegado y devuelve el resultado a Core para integración. Core puede responder directamente o delegar un grafo de tareas con dependencias; no se impone un orden fijo de agentes. Mensajes y eventos se conservan en `EUREKA_RUNTIME_DATA_FILE` sobre el volumen Docker.

## API keys de Eureka

La API pública `/api/v1/*` usa `Authorization: Bearer <api_key>` y los permisos `eureka:read` y `eureka:invoke`. La interfaz web conserva su autenticación HTTP Basic; el token `EUREKA_RUNTIME_API_TOKEN` sigue siendo exclusivamente para el enlace privado app↔runtime y no sirve como API key externa.

Después de desplegar el servicio, un administrador con acceso al servidor puede crear una clave:

```bash
docker compose exec app node scripts/eureka-api-keys.mjs create "Integración del chatbot"
```

El comando muestra el secreto una sola vez. El servidor conserva solo su SHA-256 en `/app/data/api-keys.json`, dentro del volumen persistente. Copia la clave a un gestor seguro o al secreto de la aplicación cliente; no la guardes en GitHub, en `.env.example` ni en código del navegador. Para administrar claves:

```bash
docker compose exec app node scripts/eureka-api-keys.mjs list
docker compose exec app node scripts/eureka-api-keys.mjs revoke <key_id>
```

Configura `EUREKA_API_CORS_ORIGINS` con orígenes exactos separados por comas si una aplicación web en otro dominio necesita llamar a la API; vacío significa que no se permite CORS entre dominios. CORS no sustituye la API key. `/api/v1/*` no solicita HTTP Basic; cada solicitud protegida debe incluir su Bearer token.

## Proveedor

`MODEL_API_PROTOCOL` selecciona el adaptador del motor de inferencia:

- `responses` (predeterminado): endpoint compatible con Responses API que acepte `model`, `instructions`, `input`, `max_output_tokens` y `store: false`; la respuesta debe exponer `output_text` o `output[].content[]` con `type: "output_text"`. Mantiene el soporte de entrada de texto, imagen y archivo definido por el proveedor.
- `chat_completions`: endpoint compatible con OpenAI Chat Completions; envía las Skills como mensaje `system` y la solicitud como `user`, y lee `choices[0].message.content`. Admite texto e imágenes data URL cuando el modelo soporte visión. Rechaza archivos arbitrarios con HTTP 415 para no descartarlos silenciosamente.

Usa `MODEL_API_AUTH_MODE=bearer` con `MODEL_API_KEY` para proveedores autenticados o `MODEL_API_AUTH_MODE=none` para un endpoint privado sin clave. HTTP solo se admite para hosts locales permitidos cuando `MODEL_API_ALLOW_HTTP=true`; HTTPS es obligatorio en los demás casos.

Para OpenAI, usa `MODEL_API_PROTOCOL=responses`, `https://api.openai.com/v1/responses` y Bearer authentication. Para inferencia local, el Compose incluye un servicio opcional Ollama sin puertos publicados al host. Configura en `.env` `MODEL_API_URL=http://ollama:11434/v1/chat/completions`, `MODEL_API_PROTOCOL=chat_completions`, `MODEL_API_AUTH_MODE=none`, `MODEL_API_ALLOW_HTTP=true` y `MODEL_NAME` con el mismo tag que instales. Luego inicia `docker compose --profile local-inference up -d --build` y descarga el modelo que corresponda al hardware del VPS con `docker compose exec ollama ollama pull <modelo>`. No se fija un modelo por defecto porque aún no se han medido CPU, RAM y GPU/VRAM del VPS. Ollama documenta compatibilidad con el endpoint de Chat Completions; las capacidades de imagen dependen del modelo elegido.

Un proveedor distinto o un modelo privado pueden ejecutar las Skills si implementan uno de estos contratos y se valida su fidelidad al pipeline. La API no puede inferir esa fidelidad automáticamente.

## Estado de la implementación

Las Skills fuente definen el pipeline cognitivo; el proveedor/modelo es el motor de inferencia que las ejecuta, no la identidad de Eureka. Esta implementación ofrece adaptadores Responses API y Chat Completions, incluido el endpoint local de Ollama. El servicio persiste mensajes y eventos básicos por tarea en JSON. Aún no implementa formulaciones semánticas versionadas y revisables, todos los gates, las herramientas MCP de EM Factory, un motor determinista ACFL/GCLV ni ejecución real autorizada de Actioner. Es el primer runtime API de Eureka, no una afirmación de que todas las capacidades estén conectadas.
