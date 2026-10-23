# Contrato de artefactos visuales v0.1

**Estado:** propuesta para revisión de Fase 0. No hay generador ni sandbox desplegados.

## Regla de creación

Un dashboard o una interfaz aparece cuando mejora una tarea concreta —por ejemplo, comparar alternativas, mostrar tendencias, inspeccionar dependencias o recoger datos— y Core explica su propósito. No se crea automáticamente para cada conversación ni se trata la vista como evidencia o autoridad independiente.

## Superficie de gobierno de Eureka-0

Cuando la tarea lo justifica, la interfaz puede exponer paneles de intención, mapa de tarea, grafo de conocimiento, cadena bidireccional de trazabilidad, validación y autorización. Todos leen la misma tarea, formulación versionada, invocaciones y eventos que el chat. Un panel no deriva una semántica distinta ni sustituye una decisión de Eureka-0.

La cadena cognitiva debe poder seguirse como conocimiento → descripción → predicción → prescripción → decisión/acción → observación y recorrerse de regreso hasta sus fuentes. Las visualizaciones distinguen recuperaciones documentales, inferencias y propuestas nuevas, y muestran conflictos o vacíos relevantes.

## Propiedad cognitiva y técnica

- El agente dueño del conocimiento produce y valida los datos, relaciones, predicados, alternativas e incertidumbre.
- EM Installer convierte requisitos aceptados de la tarea en una capacidad o recurso mantenible y declara dependencias, límites y criterios de aceptación.
- EM Publisher adapta el conocimiento validado a la audiencia y al medio, sin cambiar su significado ni esconder incertidumbre.
- EM Core integra, conserva la trazabilidad y decide cuándo presentar la vista.
- Eureka-0 puede corregir o rechazar la representación. Una vista no autoriza una decisión, acción externa ni despliegue.

## Contenido del artefacto

Un `Artifact` visual usa `mediaType: application/vnd.eureka.ui-artifact+json`. El valor contiene:

- `viewType`: `chart`, `dashboard` o `interactive_interface`;
- título y propósito ligado a la formulación;
- `renderer`: `declarative` o `sandboxed_react`;
- componentes declarativos tipados, cada uno con ID, tipo, título y referencia a datos;
- `sourceRefs`, versión de formulación e incertidumbre;
- referencia y hash del bundle de sandbox cuando se use React compilado.

## Crear una aplicación dentro de Eureka

Cuando la solución requiere una herramienta, dashboard o interfaz propia, Eureka ofrece la acción explícita **“Crear aplicación”** desde la conversación. La aplicación resultante vive dentro del mismo sitio privado de Eureka Multiverse, ligada a la tarea como subpágina —por ejemplo, `/tasks/{taskId}/apps/{artifactId}`—, no como sitio separado ni como opción permanente del menú global. El chat muestra una tarjeta “Abrir aplicación” y la subpágina mantiene navegación de regreso a la conversación. Las respuestas que no requieren una aplicación siguen en el chat.

La subpágina muestra la aplicación y su propósito, estado/versionado, formulación de origen, agentes realmente invocados, fuentes, supuestos y limitaciones. La creación sigue un ciclo de propuesta, vista previa, revisión y confirmación de Eureka-0 antes de quedar disponible en el sitio. La aplicación no convierte una respuesta provisional en solución final.

EM Factory participa en la preparación de recursos y vistas para la solución. EM Installer estructura la capacidad y sus criterios; el runtime de Eureka valida el paquete, registra procedencia, crea la ruta interna y renderiza la aplicación dentro del sitio ya desplegado. Así, **“Crear aplicación” es una función del producto Eureka**, no una acción autónoma de EM Factory ni un despliegue a un VPS externo. La tarjeta y la subpágina se generan desde el mismo `Artifact` versionado para evitar versiones divergentes.

### Estado del runtime de aplicaciones

El prototipo tiene un renderizador y una ruta privada `/tasks/{taskId}/apps/{artifactId}` para cuando un proveedor real entregue un artefacto validado. La ruta no genera datos ni aplicaciones por sí sola. La creación e integración desde una salida de agentes queda pendiente de conectar al API de runtime de Eureka; hasta entonces, no se debe mostrar como capacidad disponible ni probar con datos sintéticos.

Los tipos de componente iniciales son indicadores, línea, barras, dispersión, tabla, línea de tiempo, mapa de sistema, formulario y texto. La especificación de cada tipo debe declarar escalas/unidades, dimensiones, filtros y tratamiento de valores faltantes cuando corresponda. No se permite una gráfica sin origen de datos y semántica identificables.

## Renderizado y seguridad

1. **Preferido: renderizador declarativo React.** El modelo produce una especificación JSON validada contra el esquema; la aplicación la mapea a un conjunto limitado de componentes conocidos. Las especificaciones no contienen HTML, JavaScript ejecutable, URLs para cargar scripts ni consultas libres.
2. **Solo si la tarea lo justifica: bundle React aislado.** EM Installer puede proponer una interfaz React/TypeScript construida en un proceso aislado con dependencias fijadas. El resultado se valida por hash y se previsualiza en un sandbox con origen separado, CSP estricta, sin credenciales, red, acceso al DOM de la aplicación ni almacenamiento persistente.
3. El renderizador no consulta APIs externas ni altera datos de tarea. Formularios emiten una propuesta de evento para que Core la valide y aplique con el actor adecuado.
4. Un bundle no se ejecuta solo por generarse. El usuario revisa la vista previa y confirma la incorporación de la aplicación al sitio privado; despliegues fuera del ciclo interno del producto y efectos externos requieren la autorización y gates aplicables.

## Tecnologías

Para el producto se propone React con TypeScript dentro de un framework adecuado al despliegue Node del VPS. La guía oficial actual de React recomienda comenzar una aplicación nueva con un framework; Vite es una alternativa si se acuerda explícitamente una SPA más simple. D3 queda disponible para visualizaciones con control fino de escalas, formas o interacciones; Observable Plot es preferible para gráficos estándar que no necesitan ese nivel de control. D3 y React son herramientas de renderizado, no agentes cognitivos ni una razón para producir gráficas sin necesidad.

## Ciclo de vida

`proposed → preview → accepted | rejected → integrated | superseded`

- `proposed`: artefacto enlazado a tarea, formulación y fuentes.
- `preview`: esquema y dependencias validados; visualización temporal y aislada.
- `accepted`: Eureka-0 acepta el artefacto para integrar una aplicación en la tarea.
- `integrated`: el runtime incorpora la aplicación como subpágina privada dentro del sitio de Eureka y registra la versión activa.
- `rejected`: se registra motivo y se conserva el historial.
- `superseded`: una revisión posterior lo reemplaza sin borrar la anterior.

Core puede presentar una vista previa sin cerrar la formulación. Una corrección del usuario vuelve al dueño semántico de los datos o al Installer, según el cambio solicitado.

## Criterios de aceptación

- Cada dashboard identifica la pregunta que ayuda a contestar, la tarea, versión de formulación y fuentes.
- Valores observados, simulados, estimados y faltantes se distinguen visualmente.
- La vista incluye alternativas, unidades, fecha o alcance cuando esos datos afectan la interpretación.
- Hay texto alternativo o una tabla equivalente, navegación por teclado, contraste adecuado y adaptación a móvil.
- Las transformaciones se pueden rastrear hasta un artefacto o herramienta; no se inventan datos ni puntuaciones.
- La aplicación anfitriona permanece inaccesible desde el bundle generado.
- La revisión de Eureka-0 y los eventos se conservan; presentar una vista no cambia el estado de la tarea.
