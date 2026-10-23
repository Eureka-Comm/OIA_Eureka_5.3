# Caso de referencia propuesto: runtime privado de Eureka

**Estado:** borrador para revisión de Eureka-0; no constituye una decisión aceptada ni autoriza desarrollo externo o despliegue.

## Intención

Definir cómo llevar la interfaz privada de Eureka Multiverse a un VPS para que EM Core pueda convocar capacidades especializadas de forma visible y trazable, y presentar dashboards o interfaces solo cuando ayuden a resolver la tarea.

## Contexto y fuentes disponibles

- Propuesta arquitectónica Eureka Multiverse 5.3 y la ruta de implementación local.
- Contratos v0.1 de Task, ProblemFormulation, Artifact, eventos, runtime de agentes y artefactos visuales.
- Prototipo local del puente; el runtime de agentes aún no está expuesto como endpoint accesible desde el VPS.
- El conector EM Factory disponible en esta sesión prepara recursos/vistas, pero no ofrece por sí mismo ejecución de código autónoma ni despliegue del VPS.

## Objetivo observable

Comparar opciones de arquitectura para un MVP privado y proponer una ruta validable para el runtime, la persistencia y la interfaz de actividad de agentes, conservando los límites de gobierno de Eureka 5.3.

## Alcance

- Registro de Skills/capacidades y versiones.
- Routing de EM Core a especialistas mediante un proveedor declarado.
- Task, formulación versionada, invocaciones, artefactos y eventos trazables.
- Panel de actividad y presentación de artefactos visuales opcionales.
- Subpáginas de solución vinculadas a la tarea cuando haya un artefacto sustantivo validado.
- Selección de requisitos mínimos de autenticación privada y manejo de archivos.

## Fuera de alcance

- Introducir credenciales en el chat o desplegar cambios al VPS.
- Activar acciones externas, registrar/publicar plugins o instalar automáticamente recursos.
- Afirmar que ACFL/GCLV, un motor matemático o un endpoint de EM Factory están conectados sin contrato e implementación verificables.
- Generar dashboards si una representación más simple comunica suficientemente el resultado.

## Restricciones y supuestos por revisar

- La audiencia de la aplicación debe permanecer privada.
- El runtime de agentes de Eureka todavía no está expuesto como API accesible desde el VPS; la conexión funcional debe esperar a que se despliegue y configure el proveedor real.
- Se desconoce la especificación del VPS, el método de autenticación, retención/respaldo de datos y si existe un endpoint autorizado para las Skills o EM Factory.
- Las Skills son instrucciones versionadas; solo hay ejecución real cuando un proveedor de runtime está configurado y deja eventos y artefactos trazables.

## Preguntas que podrían cambiar el diseño

- ¿Qué sistema operativo y recursos tiene el VPS?
- ¿Qué identidad usará Eureka-0 para acceder y revisar tareas?
- ¿Cuánto tiempo deben conservarse tareas, archivos, eventos y respuestas del modelo?
- ¿Hay contrato, API o MCP server ya disponible para el plugin/runtime Eureka y para EM Factory?

## Decisión a evaluar

Elegir la arquitectura de primera entrega privada: proveedor de ejecución de especialistas, almacenamiento de tareas/eventos/archivos, límites de integración MCP y ciclo de previsualización de artefactos visuales. La decisión debe comparar al menos una implementación propia del runtime y una integración con proveedor/MCP cuando haya endpoints y permisos demostrables.

## Recorrido de aceptación esperado

1. Registrar esta intención como tarea y preservar el contexto/fuentes anteriores.
2. EM Structurer propone una formulación v1 y expone los datos faltantes.
3. Eureka-0 revisa, modifica, acepta o rechaza la formulación; solo entonces queda fijada la versión usada.
4. EM Descriptor separa capacidades confirmadas de ausentes; EM Installer arma alternativas técnicas; Predictor expone consecuencias y riesgos; Prescriptor recomienda una ruta con condiciones de cambio.
5. EM Core enlaza invocaciones, productos y conflictos a la formulación aceptada. Los roles que no se hayan ejecutado no aparecen como invocados.
6. Publisher presenta una tabla de opciones; un dashboard adicional solo se propone si el análisis contiene suficiente información cuantitativa o relaciones que lo justifiquen.
7. Si la solución se beneficia de una herramienta o interfaz, la conversación ofrece la acción **“Crear aplicación”**. Publisher y EM Factory aportan los recursos/vistas correspondientes; Installer define cómo se compone la capacidad y sus límites.
8. Eureka-0 revisa la vista previa y confirma la integración. El runtime valida el artefacto, registra procedencia e incorpora la aplicación como subpágina privada del sitio, por ejemplo `/tasks/{taskId}/apps/{artifactId}`. Esto ocurre dentro del sitio Eureka ya desplegado en el VPS; no es un despliegue independiente ejecutado por EM Factory.
9. Eureka-0 registra la decisión. En esta fase solo se define el flujo: todavía no se integra una aplicación real ni se ejecuta un despliegue al VPS.

## Criterios de aceptación

- Queda visible por qué se convocó cada especialista y qué artefacto devolvió.
- El usuario puede revisar la formulación y trazar una recomendación hasta fuentes, supuestos y alternativas.
- La ruta distingue una capacidad teórica, una dependencia disponible y una invocación realmente ejecutada.
- La vista sintetiza la decisión sin modificar autoridad ni ocultar información faltante.
- Cuando Eureka-0 elige “Crear aplicación”, la aplicación validada se puede abrir como subpágina privada de la tarea, con versión, formulación de origen, especialistas realmente invocados, fuentes, supuestos y límites.
- La tarjeta del chat y la subpágina presentan el mismo artefacto y no mantienen copias divergentes.
- El resultado deja claro que la implementación y el despliegue al VPS permanecen pendientes de requisitos, credenciales y autorización correspondientes.
