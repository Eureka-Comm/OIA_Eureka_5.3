# Contratos provisionales v0.1

Estos archivos contienen contratos conceptuales de Fase 0. El repo incluye un runtime LLM inicial documentado en `../runtime/README.md`; todavía faltan persistencia cognitiva, fuentes aprobadas para los roles, EM Factory, motor matemático y trazabilidad completa.

- [Arquitectura cognitiva 5.3](arquitectura-cognitiva-eureka-multiverse-5-3.md): continuidad, fidelidad, responsabilidad semántica, trazabilidad, gates y validación.
- [Matriz de autoridad](matriz_de_autoridad.md): límites de Eureka-0, agentes, Runtime, Factory e interfaz.
- [Task and trace schema](task-and-trace.schema.json): tareas, formulaciones, artefactos, eventos, capacidades e invocaciones.
- [Runtime de agentes](contrato-runtime-agentes.md): registro de capacidades, routing de Core, invocación y contrato de API.
- [Artefactos visuales](contrato-artefactos-visuales.md): dashboards e interfaces opcionales, trazabilidad y renderizado seguro.
- [Caso de referencia](plantilla_caso_referencia.md): recorrido de intención a formulación y revisión.
- [Caso propuesto para el runtime privado](caso-referencia-runtime-vps.md): candidata de bajo riesgo para recorrer plugin, trazabilidad y visualización, pendiente de revisión de Eureka-0.

## Orden de implementación

1. Recuperar y versionar fuentes primarias, código e instrucciones de continuidad 5.2/5.3.
2. Cerrar el contrato semántico de Structurer sin inventar CUT, ACFL o GCLV.
3. Validar un caso de referencia con tareas, formulaciones, eventos y gates de Eureka-0.
4. Instrumentar Core y conectar un runtime autenticado que ejecute capacidades versionadas.
5. Construir persistencia, trazabilidad y superficie de gobierno desde un único estado.
6. Cotejar ACFL/GCLV y redes neuronales con artículos/código antes de implementar sus motores.
7. Preparar el VPS de producción solo después de que Eureka-0 apruebe la fase de salida acordada.
