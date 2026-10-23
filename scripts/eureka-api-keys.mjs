import { resolve } from "node:path";
import { createApiKey, listApiKeys, revokeApiKey } from "../worker/api-keys.js";

const dataDirectory = resolve(process.env.EUREKA_DATA_DIR || "runtime-data");
const [command, ...args] = process.argv.slice(2);

function usage() {
  console.log(`Uso:
  node scripts/eureka-api-keys.mjs create "Nombre de integración" [--scopes eureka:read,eureka:invoke]
  node scripts/eureka-api-keys.mjs list
  node scripts/eureka-api-keys.mjs revoke <key_id>`);
}

try {
  if (command === "create") {
    const name = args.find(arg => !arg.startsWith("--"));
    const scopeIndex = args.indexOf("--scopes");
    const scopes = scopeIndex >= 0 ? (args[scopeIndex + 1] || "").split(",").filter(Boolean) : ["eureka:read", "eureka:invoke"];
    const result = await createApiKey({ dataDirectory, name, scopes });
    console.log("Clave creada. Copia el valor ahora; no se puede volver a consultar:\n");
    console.log(result.token);
    console.log(`\nID: ${result.key.id}\nNombre: ${result.key.name}\nPermisos: ${result.key.scopes.join(", ")}\nCreada: ${result.key.createdAt}`);
  } else if (command === "list") {
    const keys = await listApiKeys(dataDirectory);
    if (!keys.length) console.log("No hay claves Eureka registradas.");
    else for (const key of keys) console.log(`${key.id}\t${key.revokedAt ? "revocada" : "activa"}\t${key.name}\t${key.scopes.join(",")}\tcreada=${key.createdAt}\túltimo_uso=${key.lastUsedAt || "nunca"}`);
  } else if (command === "revoke") {
    const id = args[0];
    if (!id) throw new Error("Indica el ID de la clave que deseas revocar.");
    if (!await revokeApiKey(dataDirectory, id)) throw new Error("No se encontró esa clave.");
    console.log(`Clave revocada: ${id}`);
  } else {
    usage();
    process.exitCode = 2;
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
