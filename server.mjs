import http from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import worker from "./worker/index.js";

const port = Number(process.env.PORT || 3000);
const dataFile = resolve(process.env.EUREKA_DATA_DIR || resolve(dirname(fileURLToPath(import.meta.url)), "runtime-data"), "applications.json");
let writeQueue = Promise.resolve();
async function readStore() {
  try { return JSON.parse(await readFile(dataFile, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return { tasks: [], artifacts: [] }; throw error; }
}
function updateStore(update) {
  const operation = writeQueue.then(async () => {
    const state = await readStore();
    const result = await update(state);
    await mkdir(dirname(dataFile), { recursive: true });
    const temporary = `${dataFile}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
    await rename(temporary, dataFile);
    return result;
  });
  writeQueue = operation.catch(() => {});
  return operation;
}
const appStore = {
  create(task, artifact) {
    return updateStore(state => {
      state.tasks.push(task);
      state.artifacts.push(artifact);
      return artifact;
    });
  },
  async getArtifact(id) {
    await writeQueue;
    return (await readStore()).artifacts.find(item => item.id === id) || null;
  },
  integrate(id) {
    return updateStore(state => {
      const artifact = state.artifacts.find(item => item.id === id);
      if (!artifact) return null;
      if (artifact.status === "integrated") return artifact;
      if (artifact.status !== "preview") throw new Error("Solo se puede integrar un artefacto en vista previa.");
      const at = new Date().toISOString();
      artifact.status = "integrated";
      artifact.integratedAt = at;
      artifact.events.push({ type: "ApplicationIntegrated", at, actor: "Eureka-0", reason: "Confirmación explícita desde la interfaz" });
      const task = state.tasks.find(item => item.id === artifact.taskId);
      if (task) {
        task.status = "application_integrated";
        task.updatedAt = at;
        task.events ||= [];
        task.events.push({ type: "ApplicationIntegrated", at, actor: "Eureka-0", artifactId: id });
      }
      return artifact;
    });
  },
};
const env = {
  EUREKA_RUNTIME_CAPABILITIES_URL: process.env.EUREKA_RUNTIME_CAPABILITIES_URL,
  EUREKA_RUNTIME_INVOKE_URL: process.env.EUREKA_RUNTIME_INVOKE_URL,
  EUREKA_RUNTIME_API_TOKEN: process.env.EUREKA_RUNTIME_API_TOKEN,
  EUREKA_RUNTIME_ALLOW_HTTP: process.env.EUREKA_RUNTIME_ALLOW_HTTP,
  EM_FACTORY_MCP_URL: process.env.EM_FACTORY_MCP_URL,
  EM_FACTORY_OAUTH_TOKEN: process.env.EM_FACTORY_OAUTH_TOKEN,
  MATH_ENGINE_URL: process.env.MATH_ENGINE_URL,
  appStore,
};

const server = http.createServer(async (incoming, outgoing) => {
  try {
    const chunks = [];
    let length = 0;
    for await (const chunk of incoming) {
      length += chunk.length;
      if (length > 51 * 1024 * 1024) {
        outgoing.writeHead(413, { "content-type": "application/json; charset=utf-8" });
        outgoing.end(JSON.stringify({ error: "Solicitud demasiado grande. El máximo combinado es 50 MB." }));
        return;
      }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    const host = incoming.headers.host || `localhost:${port}`;
    const protocol = incoming.headers["x-forwarded-proto"] || "http";
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) {
      if (value !== undefined && !["host", "content-length", "connection"].includes(key.toLowerCase())) {
        headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
    }
    const method = incoming.method || "GET";
    const init = { method, headers };
    if (method !== "GET" && method !== "HEAD" && body.length) init.body = new Uint8Array(body);
    const request = new Request(`${protocol}://${host}${incoming.url || "/"}`, init);
    const response = await worker.fetch(request, env);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error("Request failed:", error?.message || error);
    if (!outgoing.headersSent) outgoing.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    outgoing.end(JSON.stringify({ error: "Error interno del servidor." }));
  }
});

server.listen(port, "0.0.0.0", () => console.log(`Eureka chat escuchando en 0.0.0.0:${port}`));

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
