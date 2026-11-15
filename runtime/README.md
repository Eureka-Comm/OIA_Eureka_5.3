# Eureka Multiverse API v0.3

Servicio privado que expone el runtime para la interfaz de Eureka Multiverse. Se publica solo dentro de la red Docker `runtime_internal`; no tiene puertos publicados en el host. Carga el contenido original de las Skills del paquete instalado `eureka-multiverse-5-3@5.3.2`, versionado bajo `runtime/skills/`.

## Rutas

- `GET /health`: health check sin datos sensibles.
- `GET /v1/capabilities`: requiere `Authorization: Bearer <EUREKA_RUNTIME_API_TOKEN>` y enumera Core y los siete roles. Los roles solo se marcan `available` si el endpoint, el modelo y la autenticación requerida para el protocolo están configurados.
- `GET /v1/factory/status`: verifica negociación MCP, herramientas anunciadas y una llamada satisfactoria a `factory_status`.
- `POST /v1/factory/tools/{toolName}`: solo permite `factory_status`, `factory_open`, `factory_build_resources` y `factory_present_context`; `factory_build_plugin` queda fuera de esta primera integración.
- `POST /v1/invocations`: requiere el mismo token y recibe invocaciones solo para `agent: "core"`. Un intento de invocar un especialista directamente recibe `403`.
- `POST /v1/tasks`: crea una tarea persistente con intención y evento inicial.
- `GET /v1/tasks/{taskId}`: recupera tarea, mensajes e InteractionState.
- `POST /v1/tasks/{taskId}/messages`: ejecuta un turno de Core dentro de la tarea.
- `GET /v1/tasks/{taskId}/events?after={sequence}`: devuelve eventos desde una secuencia dada.
- `POST /v1/tasks/{taskId}/formulations/propose`: EM Structurer propone una formulación JSON versionada a partir de la intención y contexto opcional; persiste la propuesta y un gate de revisión Eureka-0 pendiente, no bloqueante.
- `POST /v1/tasks/{taskId}/formulations/{version}/review`: ruta interna para guardar aceptación/rechazo. Solo acepta el nombre de usuario configurado en `EUREKA_ZERO_REVIEW_USERNAME`; el puente de la aplicación lo envía después de verificar la sesión Basic Auth.

La respuesta contiene `agent: "core"`, `taskId`, `status`, `product.text`, `routedAgents`, `routingReason` y referencias de solicitud del proveedor. El adaptador carga Eureka Multiverse y EM Core junto con las referencias incluidas en sus Skills, acepta el plan adaptativo de Core, carga la Skill versionada de cada especialista delegado y devuelve el resultado a Core para integración. Core puede responder directamente o delegar un grafo de tareas con dependencias; no se impone un orden fijo de agentes. EM Factory se conecta bajo demanda si Core delega en EM Installer; las herramientas no se entregan a otros agentes. Las llamadas registran herramienta, estado y digest del resultado en los eventos de la tarea. Mensajes y eventos se conservan en `EUREKA_RUNTIME_DATA_FILE` sobre el volumen Docker.

## EM Factory MCP

El runtime se conecta con `@modelcontextprotocol/client` por Streamable HTTP. `EM_FACTORY_AUTH_MODE=sites_bypass` envía `OAI-Sites-Authorization` con el token de bypass y `Authorization: Bearer` con el secreto de servicio compartido con el bridge de Factory. `EM_FACTORY_AUTH_MODE=bearer` admite un MCP con token único. HTTPS es obligatorio en producción. Las herramientas se anuncian al modelo solo durante una invocación de EM Installer; el runtime no confunde una URL configurada con una conexión válida.

Variables de servidor: `EM_FACTORY_MCP_URL`, `EM_FACTORY_AUTH_MODE`, `EM_FACTORY_SITES_BYPASS_TOKEN`, `EM_FACTORY_SERVICE_TOKEN`; o `EM_FACTORY_MCP_TOKEN` en modo Bearer. La interfaz puede consultar `GET /api/factory/status` y las llamadas permitidas se enrutan por la API web. No se devuelven secretos al navegador.

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

Las Skills fuente definen el pipeline cognitivo; el proveedor/modelo es el motor de inferencia que las ejecuta, no la identidad de Eureka. Esta implementación ofrece adaptadores Responses API y Chat Completions, incluido el endpoint local de Ollama. El servicio persiste tareas, mensajes, propuestas de formulación versionadas, gates pendientes y registros de invocaciones de especialistas en JSON, además de eventos secuenciales. La interfaz permite aceptar/rechazar una propuesta cuando `EUREKA_ZERO_REVIEW_USERNAME` coincide con una cuenta Basic Auth dedicada. El adaptador MCP de EM Factory está implementado, pero solo queda operativo en producción después de configurar y verificar ambos secretos del bridge. El motor determinista ACFL/GCLV y ejecución real autorizada de Actioner aún no están implementados. Es el primer runtime API de Eureka, no una afirmación de que todas las capacidades estén conectadas.
