# Arquitectura cognitiva de Eureka Multiverse 5.3

**Base arquitectónica:** documento actualizado, versión 1.1, 23 de octubre de 2026.  
**Estado en este repositorio:** objetivo de diseño; no acredita capacidades implementadas.

Este contrato traslada al repositorio los requisitos arquitectónicos del documento actualizado. Los fundamentos y las relaciones que la fuente califica como verificadas deben cotejarse con los artículos y el código primarios antes de implementarlos. Las propuestas de diseño no se presentan como propiedades matemáticas ya demostradas.

## Principio de fidelidad y continuidad

La evolución que la arquitectura debe preservar es **GPTs customizados → Eureka Multiverse 5.2 → Eureka Multiverse 5.3**. La revisión de continuidad debe identificar qué instrucciones, roles, principios, recursos y código se conservaron, perfeccionaron, alteraron u omitieron. Cada recuperación debe distinguir evidencia documental, inferencia y propuesta nueva. Una pérdida no se resuelve rellenando vacíos con conocimiento inventado.

La documentación y las interfaces usan los nombres normativos **CUT Language**, **ACFL**, **GCLV** y **redes neuronales ACFL**. En las redes ACFL se usa **MODIFICADORES**; no se sustituyen por “pesos” ni por términos equivalentes. No se inventan fórmulas, operadores, reglas de aprendizaje, topologías ni equivalencias semánticas.

## Responsabilidades y autoridad

- **Eureka-0** conserva la intención y la autoridad humana. Puede inspeccionar el estado, revisar formulaciones, decidir y autorizar acciones dentro del alcance establecido.
- **EM Core** coordina y enruta el trabajo según el problema, las capacidades disponibles y los gates. Explica por qué eligió la ruta, integra los productos y mantiene la continuidad.
- **EM Structurer** propone y mantiene la formulación revisable del problema y custodia su capa semántica. Los cambios se versionan; una propuesta no sustituye silenciosamente una formulación aceptada.
- **Descriptor, Predictor y Prescriptor** aportan productos descriptivos, predictivos y prescriptivos con evidencia, entradas, versión e incertidumbre.
- **Actioner** separa preparación, autorización, ejecución y observación. Ninguna salida de agente constituye una autorización.
- **Installer** diseña capacidades mantenibles; **Publisher** adapta conocimiento validado sin cambiar su significado.

Core conserva el routing operativo. La interfaz presenta la actividad y el estado, pero no elige qué especialista debe ejecutarse ni declara una invocación por la sola existencia de una Skill.

## Capa semántica bajo responsabilidad de Structurer

La capa semántica enlaza lenguaje, conocimiento y cálculo. La formulación versionada debe poder registrar, cuando existan para el caso:

- términos y definiciones;
- entidades y relaciones;
- predicados y su contexto;
- fuente y estado o grado de verdad cuando corresponda;
- MODIFICADORES;
- reglas de composición;
- referencias a funciones u operadores aplicados.

Cada elemento debe conservar procedencia, contexto, condición provisional o aceptada y vínculos con los productos que lo usan. La sintaxis exacta de CUT Language y la semántica de sus construcciones quedan pendientes de cotejo con la especificación primaria. Una representación genérica en este contrato es un contenedor de datos auditables; no define una gramática CUT ni una operación ACFL.

## Trazabilidad cognitiva

Los productos relevantes deben referenciar la tarea, la versión de formulación, la capacidad y versión del agente, entradas, fuentes, transformaciones, incertidumbre y dependencias. La cadena debe recorrerse en ambos sentidos: desde una acción a su prescripción, predicción, descripción y conocimiento de origen, y desde el conocimiento hasta las conclusiones y acciones que lo utilizaron.

Los cambios de formulación, decisiones de Eureka-0, gates, invocaciones, validaciones, autorizaciones, resultados y observaciones requieren eventos con actor, tiempo, motivo y referencias. Una respuesta del modelo no se confunde con una observación, aprendizaje o cambio de estado.

## Superficie de gobierno y visualización

Eureka-0 puede inspeccionar los paneles que aporten valor al caso:

1. **Intención:** objetivo, alcance, restricciones, prioridad y preguntas abiertas.
2. **Mapa de tarea:** roles invocados, dependencias, estado, bloqueos y gates.
3. **Grafo de conocimiento:** entidades, relaciones, predicados, fuentes, versiones y conflictos.
4. **Cadena de trazabilidad:** conocimiento → descripción → predicción → prescripción → acción → observación.
5. **Validación:** pruebas ejecutadas, evidencia, resultados, incertidumbre y pendientes.
6. **Autorización:** acciones propuestas, impacto, reversibilidad, responsable y confirmación.

Los paneles leen la misma formulación y estado persistentes que el chat. Se crean solo cuando ayudan a entender, revisar o validar la solución. No son evidencia independiente ni cambian la autoridad del usuario.

## Gates de gobierno

Core gestiona el estado operativo de los gates y Eureka-0 aporta el juicio humano y las autorizaciones que correspondan:

- **G0 Meaning/Intent:** significado e intención compartidos.
- **G1 Problem/Frame:** revisión de problema y formulación.
- **G2 Decision:** revisión de la decisión.
- **G3 Action Authorization:** autorización humana de acciones.
- **G4 Learning/Freeze:** observación, aprendizaje y control de congelación o reapertura.

Las acciones de impacto requieren autorización explícita, limitada por acción, alcance y vigencia. Preparación y simulación no equivalen a ejecución.

## Validación por capas

- **Fidelidad documental:** cotejar nombres, definiciones, operadores, fórmulas y ejemplos con artículos y código de referencia.
- **Semántica:** comprobar términos, predicados, contexto y MODIFICADORES con casos canónicos.
- **ACFL/GCLV:** reproducir ejemplos numéricos de referencia con tolerancias documentadas.
- **Red neuronal ACFL:** validar estructura, propagación y uso de MODIFICADORES; no atribuir interpretación a “pesos”.
- **Explicabilidad:** reconstruir resultados desde fuentes y entradas a través de la cadena cognitiva.
- **Acción:** verificar simulación, autorización separada, observación posterior y rollback aplicable.

Una salida plausible no es por sí misma una salida validada.

## Especificaciones primarias pendientes

El documento actualizado deja pendientes de contraste, y este repositorio no debe rellenarlos por inferencia:

- especificación del CUT Language usado por el proyecto;
- grafía normativa, significado y notación exactos de GCLV;
- fórmulas, operadores, parámetros, normalización, valores faltantes y sensibilidad de ACFL/GCLV;
- reglas de aprendizaje, topologías y serialización de MODIFICADORES para redes ACFL;
- fuentes versionadas de GPTs customizados, Eureka 5.2 y código de referencia que acrediten continuidad;
- contrato ejecutable entre Eureka-0, Core, Structurer y especialistas.

Hasta que esos materiales estén disponibles y cotejados, el runtime, el solver matemático y los paneles que dependan de esa semántica deben reportarse como no implementados o no validados.
