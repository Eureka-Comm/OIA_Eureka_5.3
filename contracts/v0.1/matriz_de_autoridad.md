# Matriz de autoridad v0.1

Esta matriz traduce las responsabilidades y límites de la arquitectura propuesta a reglas iniciales para revisión. Es un contrato conceptual; todavía no hay un servicio que aplique estas reglas automáticamente.

| Actor | Puede proponer | Puede aceptar/cambiar estado | Puede autorizar acción externa | Límite |
|---|---|---|---|---|
| Eureka-0 (usuario responsable) | Intención, objetivos, criterios, aclaraciones, cambios | Aceptar, modificar o rechazar formulación y prescripción | Sí, de manera explícita y dentro de alcance/permisos | La autorización debe registrarse con identidad, alcance y motivo |
| EM Core | Ruta, secuencia de trabajo, gates y síntesis; decide qué capacidades activar | Transiciones operativas permitidas por política | No | La interfaz no sustituye su routing; no cambia por sí solo la formulación ni ejecuta |
| EM Structurer | Formulación revisable del problema y capa semántica, incluido su contexto y procedencia | Crear o revisar versión propuesta; no aceptar por Eureka-0 | No | Cambios de objetivos, alcance o restricciones requieren revisión humana; no inventa gramática CUT u operadores |
| EM Descriptor | Descripciones, evidencia y relaciones observadas | Proponer artefactos descriptivos | No | Marca hechos, supuestos e inferencias por separado |
| EM Predictor | Escenarios, consecuencias e incertidumbre | Proponer artefactos predictivos | No | No prescribe ni ejecuta; declara supuestos y confianza disponible |
| EM Prescriptor | Alternativas, trade-offs y recomendación | Proponer prescripción | No | No ejecuta; los cálculos formales requieren motor validado |
| EM Actioner | Preparación, simulación, plan y observación | Registrar estado de preparación y resultado | No | Ejecutar solo con autorización explícita y política de permisos |
| EM Installer | Diseño e instalación de capacidades | Proponer cambios de capacidad y despliegue | No | Separar diseño, validación, despliegue y mantenimiento |
| EM Publisher | Presentación de artefactos aceptados | Producir representaciones adaptadas | No | No cambia el significado ni oculta incertidumbre |
| Eureka Runtime | Ejecutar invocaciones solicitadas por Core con capacidades habilitadas | Registrar cola, ejecución, resultado y error | No | No selecciona ruta por encima de Core; no simula un proveedor ausente |
| EM Factory | Preparar recursos y vistas contextuales con herramientas disponibles | Entregar paquete/recurso para la aplicación que Eureka propone | No | No es un agente cognitivo y no integra por sí sola la aplicación al sitio |
| Interfaz | Presentar intención, estado, actividad, trazabilidad y artefactos; ofrecer “Crear aplicación” y su vista previa cuando proceda | Enviar correcciones y confirmación de integración de Eureka-0 como eventos | No | No enruta especialistas ni altera semántica; lee el estado común; no ejecuta bundles sin validación |
| Runtime de aplicaciones | Validar y renderizar artefactos aceptados como subpáginas privadas dentro del sitio | Integrar o versionar una aplicación tras confirmación registrada | No | No crea aplicaciones por criterio propio ni permite código sin sandbox/validación |
| Servicio de persistencia | Registrar objetos/eventos validados | Aplicar reglas de integridad y versionado | No | No inventa semántica ni concede autoridad |

## Reglas de transición iniciales

1. La intención crea una tarea en estado `intake`.
2. EM Structurer propone una formulación versionada; la tarea pasa a `formulation_review`.
3. Eureka-0 acepta, modifica o rechaza explícitamente la propuesta. Aceptar fija la versión vigente; modificar exige una nueva versión y motivo.
4. Los artefactos de especialistas apuntan a la versión de formulación usada. Si esa versión cambia, los artefactos previos permanecen como historial y pueden marcarse obsoletos, nunca reescribirse silenciosamente.
5. Una prescripción es una propuesta hasta que Eureka-0 registra una decisión.
6. Una acción de impacto requiere una autorización separada, limitada por acción, alcance y vigencia; la autorización no se infiere del chat ni de una recomendación.
7. Cada transición de estado y autorización agrega un evento. El historial no se modifica para ocultar eventos previos; las correcciones son eventos nuevos.
8. Si falta una dependencia (MCP, solver, datos, permisos), la tarea se marca o se informa como degradada/bloqueada, sin simular capacidad disponible.
9. Una invocación especialista se muestra como activa solo si existe un `agentInvocation` y su evento correspondiente; una Skill disponible no prueba ejecución.
10. Confirmar “Crear aplicación” autoriza integrar esa versión como subpágina privada dentro del sitio Eureka; no autoriza acceso público, despliegue independiente ni acciones externas sugeridas por la aplicación.

## Invariantes de Fase 0

- Una tarea tiene un único ID estable y una secuencia creciente de eventos.
- Una formulación aceptada se identifica por `(taskId, version)` y es inmutable.
- Cada artefacto cognitivo cita la versión de formulación de entrada y sus dependencias.
- Toda decisión identifica quién la tomó, cuándo y con qué motivo.
- Una salida del modelo no es una autorización.
- ACFL, GCLV y CUT semántico permanecen sin ejecutar hasta que sus contratos específicos estén definidos.
- La continuidad GPTs customizados → Eureka 5.2 → Eureka 5.3 conserva referencias de origen y distingue recuperación, inferencia y propuesta.
- La capa semántica identifica procedencia, contexto y MODIFICADORES; el esquema de datos no define por sí mismo gramática CUT ni fórmulas.
