# Contrato de runtime de agentes v0.1

**Estado:** contrato propuesto para Fase 0; existe implementación inicial en `../../runtime/server.mjs`, aún sin proveedor configurado ni runtime desplegado.

## Propósito

Definir cómo el puente identifica capacidades de Eureka, cómo EM Core pide una contribución especializada y cómo el chat muestra el resultado con procedencia. Una Skill define responsabilidad e instrucciones; una invocación registrada acredita que un proveedor configurado la ejecutó. No se debe mostrar un agente como disponible solo porque exista un archivo de Skill.

## Responsabilidades

- **Eureka-0:** crea la intención, aporta contexto privado y conserva la autoridad sobre formulación, decisiones y autorizaciones.
- **EM Core:** interpreta el objetivo operativo, elige la ruta, asigna los especialistas, integra sus productos y explica por qué los convocó.
- **EM Structurer:** mantiene la formulación revisable y la capa semántica versionada; distingue una propuesta provisional de una formulación aceptada por Eureka-0.
- **Especialista:** conserva su propiedad cognitiva y devuelve un artefacto que cita tarea, versión de formulación, entradas, fuentes y límites.
- **Eureka Runtime:** resuelve una capacidad registrada, ejecuta la invocación mediante un proveedor configurado y persiste eventos. No decide la ruta por encima de Core ni concede autoridad a un especialista.
- **EM Factory:** herramienta para preparar recursos y vistas. No es otro agente, no ejecuta código de forma autónoma y no despliega el servicio.

## Registro de capacidades

Cada capacidad debe declarar:

- `id` estable, `version`, `owner` y `skillRef` versionado;
- descripción, tipos de entrada y productos esperados;
- herramientas requeridas y proveedor disponible;
- estado `available`, `degraded` o `disabled`, con límites visibles.

Un perfil EM Core incluye la responsabilidad de routing. Los siete perfiles especialistas preservan su propio ámbito. Capacidades opcionales como búsqueda, solver, generación de vistas o acceso a EM Factory se registran como dependencias aparte; no se infieren del nombre de un agente.

La interfaz envía la intención a Core. No ofrece la selección manual de un especialista como sustituto del routing cognitivo de Core. La actividad de un especialista se muestra solo con una invocación y eventos correspondientes.

La formulación de Structurer puede incluir una capa semántica con términos, entidades, relaciones, predicados, contexto, procedencia, estado/grado de verdad cuando aplique, MODIFICADORES, reglas de composición y referencias a operadores. Este contrato define campos de trazabilidad, no la sintaxis de CUT Language ni semántica matemática. Esas definiciones requieren cotejo con sus fuentes primarias.

## Invocación

1. El mensaje de Eureka-0 se asocia con una `Task` y la versión vigente de `ProblemFormulation`.
2. EM Core emite una decisión de ruta con el especialista, motivo y dependencias. Una invocación paralela solo se permite si sus entradas están disponibles y no compite por autoridad o estado mutable.
3. El Runtime registra `AgentQueued` y `AgentInvoked`, y devuelve un `agentInvocation` con estado `running`.
4. Al concluir, registra `AgentCompleted` y enlaza uno o más artefactos. Ante fallo o falta de proveedor, registra `AgentFailed` o `blocked`, con limitación concreta; no fabrica resultado.
5. Core integra las contribuciones, identifica conflictos y entrega la síntesis junto con la ruta relevante.

Toda invocación referencia `taskId`, `formulationVersion`, `inputRefs`, el rol, la versión de capacidad, proveedor, estado y marcas de tiempo. Una invocación hija usa `parentInvocationId`. Cambiar la formulación no reescribe invocaciones ni artefactos anteriores.

## API propuesta

Las rutas `/api/v1/tasks/*` son el contrato futuro para tareas persistentes. La primera API de runtime tiene rutas internas `/v1/capabilities` y `/v1/invocations`; el prototipo conserva la ruta de renderizado privado de artefactos ya integrados:

| Ruta | Uso actual |
|---|---|
| `GET /api/artifacts/{artifactId}` | Recuperar el artefacto persistido. |
| `POST /api/artifacts/{artifactId}/integrate` | Integrar el artefacto tras recibir `confirm: true` desde la interfaz. |
| `GET /tasks/{taskId}/apps/{artifactId}` | Renderizar la aplicación integrada como subpágina privada del mismo sitio. |

La aplicación ofrece además un adaptador de runtime Eureka:

| Ruta | Uso |
|---|---|
| `GET /api/v1/eureka/capabilities` | Consulta el registro remoto de capacidades y solo responde como conectado si el proveedor devuelve `{ "capabilities": [...] }`. |
| `POST /api/v1/eureka/invocations` | El puente de la interfaz acepta solo una intención dirigida a `core`; EM Core enruta dentro del runtime. Sin URL y token responde `503`, nunca una respuesta simulada. |

El contrato remoto mínimo del puente recibe `invocationId`, `agent: "core"`, `task`, `input` (texto y/o archivos codificados que aporta la conversación), `taskId`, `formulationVersion`, `inputRefs` y `requestedAt`; debe responder JSON con `agent: "core"`, `status` y `product`. Core puede convocar especialistas dentro de Eureka Runtime, donde se registran sus propias invocaciones, dependencias y productos. La respuesta integrada puede incluir `routedAgents` y referencias de trazabilidad; la interfaz los presenta como actividad reportada por el runtime, no como invocaciones locales. Los archivos se envían opacos con nombre y tipo MIME; el runtime debe declarar si puede leer o transformar cada formato. El API de capacidades devuelve objetos con `id`, `status` y `version`; la interfaz solo habilita el chat si `core` aparece como `available`. Los endpoints se configuran en el servidor mediante `EUREKA_RUNTIME_CAPABILITIES_URL`, `EUREKA_RUNTIME_INVOKE_URL` y `EUREKA_RUNTIME_API_TOKEN`.

El repositorio incluye una implementación inicial del servicio Eureka Runtime API (`runtime/server.mjs`) en un contenedor privado de Docker. Carga el paquete fuente `eureka-multiverse-5-3@5.3.2` preservado en `runtime/skills/`: Eureka Multiverse, EM Core y los siete roles especialistas con sus referencias. La API entrega la intención a Core, ejecuta la respuesta directa o el grafo de subtareas que Core determina, y retorna productos al mismo Core para integración. Las capacidades solo figuran como `available` cuando los paquetes de Skills y un proveedor de inferencia están disponibles. No se debe sustituir las Skills por prompts resumidos ni presentar el proveedor como Eureka. Aún faltan persistencia y revisión de formulaciones, conexión efectiva de herramientas MCP/EM Factory, estado de gates durable y el motor matemático ACFL/GCLV.

| Ruta | Uso |
|---|---|
| `POST /api/v1/tasks` | Crear tarea desde una intención y devolver `taskId`. |
| `GET /api/v1/tasks/{taskId}` | Leer tarea, formulación vigente, artefactos y estado degradado. |
| `POST /api/v1/tasks/{taskId}/messages` | Añadir un turno; EM Core decide si convoca especialistas y devuelve referencias a eventos y artefactos. |
| `GET /api/v1/tasks/{taskId}/events?after={sequence}` | Recuperar trazabilidad incremental; puede ofrecerse como SSE para actividad en vivo. |
| `POST /api/v1/tasks/{taskId}/formulations/{version}/review` | Registrar aceptar, modificar o rechazar como Eureka-0, con motivo. |
| `POST /api/v1/tasks/{taskId}/artifacts/{artifactId}/review` | Registrar observación, aceptación de uso en la tarea o rechazo del artefacto. |

Las rutas requieren identidad autenticada con acceso privado a la tarea. Credenciales de proveedor y MCP permanecen en el servidor. El cliente nunca recibe secretos ni llama a proveedores externos directamente.

## Respuesta de un turno

Un turno debería devolver, como mínimo:

```json
{
  "taskId": "uuid",
  "status": "analysis",
  "formulationVersion": 1,
  "message": { "id": "uuid", "text": "…" },
  "routing": [
    { "invocationId": "uuid", "agent": "EM Descriptor", "reason": "…", "status": "completed" }
  ],
  "artifactRefs": [],
  "eventSequence": 12,
  "limitations": []
}
```

El cliente renderiza esta respuesta y sus eventos; no decide por sí mismo qué agentes deben ejecutarse. Un agente visible como “convocado” debe tener una invocación/evento correspondiente.

## Criterios de aceptación

- La lista del cliente se deriva del registro de capacidades, no de opciones codificadas como si fueran plugins conectados.
- Eureka-0 puede inspeccionar la intención, formulación y gates; acepta, modifica o rechaza la formulación sin perder versiones anteriores.
- Core registra su motivo de routing; la interfaz no invoca especialistas por selección manual.
- Cada elemento semántico conserva contexto, fuente y estado provisional/aceptado; los huecos de CUT, ACFL, GCLV o MODIFICADORES permanecen explícitos.
- La actividad muestra quién fue convocado, por qué, con qué estado y qué producto devolvió.
- Los artefactos enlazan a la misma versión de formulación que usó el agente.
- Falta de MCP, clave, proveedor o Skill versionada aparece como limitación real.
- Ningún agente acepta una formulación por Eureka-0 ni autoriza una acción externa.
- No se afirma que hay subprocesos autónomos si el proveedor solo ejecuta llamadas secuenciales al modelo.

## Dependencias pendientes

Para el VPS se necesita un proveedor ejecutable y autenticado que pueda cargar las Skills versionadas o sus instrucciones aprobadas. El conector EM Factory disponible en esta sesión de Codex no constituye por sí solo una API accesible desde el VPS. Si se conserva EM Factory, se debe especificar y desplegar un adaptador MCP/HTTP permitido; si no, se reporta como no conectado.
