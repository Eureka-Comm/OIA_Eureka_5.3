# Eureka Multiverse 5.3 Skills

Este directorio conserva el paquete de instrucciones instalado `eureka-multiverse-5-3@5.3.2`, copiado para que el runtime VPS pueda cargar las mismas Skills y referencias sin depender de la caché local de Codex.

Se copiaron los nueve directorios fuente: Eureka Multiverse, EM Core y los siete roles especialistas. El adaptador no reescribe sus contenidos; añade un contrato HTTP de ejecución y límites de herramientas disponibles. El SHA-256 de cada Skill y sus referencias se incluye en la respuesta de trazabilidad de cada invocación.

Si se actualiza el plugin, actualizar este paquete como una unidad, registrar la nueva versión y comparar el diff antes de desplegar.
