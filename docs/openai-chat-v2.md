# Chat OpenAI en `/v2`

El dominio raíz `https://eurekamultiverse.ai/` permanece en la aplicación
DeepSeek. El chat OpenAI se sirve de forma independiente en
`https://eurekamultiverse.ai/v2/`.

La interfaz antepone `/v2` a sus solicitudes `/api/` cuando se carga bajo esa
ruta. Caddy elimina el prefijo antes de enviar las solicitudes al contenedor
`eureka-chat:3000`, por lo que el servidor interno conserva sus rutas actuales.
El acceso directo al chat por IP sigue usando `/` y `/api/`.

## Despliegue

En el Droplet, desde una cuenta con Docker, ejecuta el script
`scripts/deploy-openai-v2.sh` desde el repositorio OIA_Eureka_5.3. El script:

- actualiza y reconstruye solo el servicio web OpenAI;
- añade al Caddyfile una ruta `/v2/` con el mismo usuario y hash Basic Auth ya
  usados por el acceso OpenAI;
- conserva `frontend:80` como destino del resto del dominio;
- respalda el archivo web y Caddyfile, valida Caddy y revierte Caddy si falla
  la validación o la recarga.

La raíz del dominio debe seguir mostrando DeepSeek y `/v2/` debe solicitar
Basic Auth y mostrar el chat OpenAI.

