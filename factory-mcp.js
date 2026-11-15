import { createHash } from "node:crypto";

export const FACTORY_TOOLS = Object.freeze([
  "factory_status",
  "factory_open",
  "factory_build_resources",
  "factory_present_context",
  "factory_build_plugin",
]);

const callableTools = new Set(FACTORY_TOOLS.filter(name => name !== "factory_build_plugin"));
const MAX_TEXT = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 30000;
const STATUS_CACHE_TTL_MS = 15000;
const statusCache = new Map();

const toolDefinitions = [
  { name: "factory_status", description: "Read EM Factory capabilities and limits.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "factory_open", description: "Open EM Factory with a plugin specification, resource workspace or communication view.", inputSchema: { type: "object", properties: { spec: { type: "object" }, workspace: { type: "object" }, communication: { type: "object" } }, additionalProperties: false } },
  { name: "factory_build_resources", description: "Prepare a ZIP of text resources authored by the rightful Eureka agents. Does not execute or deploy code.", inputSchema: { type: "object", properties: { workspace: { type: "object" } }, required: ["workspace"], additionalProperties: false } },
  { name: "factory_present_context", description: "Prepare a context-adapted communication view with supplied predicates, evidence and alternatives.", inputSchema: { type: "object", properties: { communication: { type: "object" } }, required: ["communication"], additionalProperties: false } },
];

function endpointFrom(env) {
  const value = env.EM_FACTORY_SERVICE_API_URL || "";
  let url;
  try { url = new URL(value); } catch { return { error: "Configura la URL de la API de servicio de EM Factory." }; }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    return { error: "La API de EM Factory requiere una URL HTTPS sin credenciales, parámetros ni fragmentos." };
  }
  return { url };
}

function config(env) {
  const parsed = endpointFrom(env);
  const sitesBypassToken = env.EM_FACTORY_SITES_BYPASS_TOKEN || "";
  const serviceToken = env.EM_FACTORY_SERVICE_TOKEN || "";
  if (parsed.error) return { error: parsed.error };
  if (!sitesBypassToken) return { error: "Falta el token de acceso de servicio emitido para el Site de EM Factory." };
  if (!serviceToken) return { error: "Falta el secreto compartido de servicio configurado en EM Factory y Eureka." };
  return { url: parsed.url, sitesBypassToken, serviceToken };
}

function requestSignal(parent, timeoutMs) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return parent ? AbortSignal.any([parent, timeout]) : timeout;
}

function serviceHeaders(settings) {
  return {
    accept: "application/json",
    "content-type": "application/json",
    "OAI-Sites-Authorization": `Bearer ${settings.sitesBypassToken}`,
    authorization: `Bearer ${settings.serviceToken}`,
  };
}

async function postTool(settings, signal, name, args = {}) {
  const response = await fetch(settings.url, {
    method: "POST",
    headers: serviceHeaders(settings),
    body: JSON.stringify({ name, arguments: args }),
    redirect: "error",
    cache: "no-store",
    signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== "object") {
    const reason = typeof body?.error === "string" ? body.error.slice(0, 240) : `HTTP ${response.status}`;
    throw Object.assign(new Error(`EM Factory Service API no completó ${name}: ${reason}`), { status: response.status || 502, code: "FACTORY_SERVICE_API_FAILED" });
  }
  return body;
}

export async function connectFactory(env, parentSignal, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const settings = config(env);
  if (settings.error) throw Object.assign(new Error(settings.error), { code: "FACTORY_NOT_CONFIGURED", status: 503 });
  const signal = requestSignal(parentSignal, timeoutMs);
  try {
    const status = await postTool(settings, signal, "factory_status", {});
    if (status.isError || !status.structuredContent) throw new Error("factory_status no devolvió un estado válido.");
    const client = {
      async callTool({ name, arguments: args }, options = {}) {
        if (!callableTools.has(name)) throw Object.assign(new Error("La operación Factory no está permitida por esta ruta."), { status: 403 });
        const result = await postTool(settings, options.signal || signal, name, args || {});
        if (result.isError) throw Object.assign(new Error(`EM Factory informó un error al ejecutar ${name}.`), { status: 502, result });
        return result;
      },
      async close() {},
    };
    return {
      client,
      signal,
      tools: toolDefinitions.filter(tool => callableTools.has(tool.name)),
      server: { name: "em-factory-service-api", version: "1.0.0" },
      status: status.structuredContent,
    };
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") throw error;
    throw Object.assign(new Error(`No se pudo autenticar o consultar la API de servicio de EM Factory: ${String(error?.message || error).slice(0, 240)}`), {
      code: "FACTORY_CONNECTION_FAILED",
      status: 502,
      cause: error,
    });
  }
}

export async function closeFactory(connection) {
  try { await connection?.client?.close?.(); } catch {}
}

function trimResult(result) {
  const content = Array.isArray(result?.content) ? result.content.map(item => {
    if (item?.type === "text" && typeof item.text === "string") return { ...item, text: item.text.slice(0, MAX_TEXT) };
    if (item?.type === "image") return { type: "image", mimeType: item.mimeType, omitted: true, reason: "La vista web no guarda contenido binario en esta ruta." };
    if (item?.type === "resource") return { type: "resource", omitted: true, reason: "Los recursos binarios requieren una ruta de descarga validada." };
    return item;
  }) : [];
  let structuredContent;
  if (result?.structuredContent && typeof result.structuredContent === "object") {
    const serialized = JSON.stringify(result.structuredContent);
    structuredContent = serialized.length <= MAX_TEXT
      ? result.structuredContent
      : { omitted: true, reason: "El contenido estructurado excede el límite de respuesta web.", sha256: createHash("sha256").update(serialized).digest("hex") };
  }
  return { isError: Boolean(result?.isError), content, ...(structuredContent === undefined ? {} : { structuredContent }) };
}

export async function callFactoryTool(env, name, args, options = {}) {
  const allowPluginPackaging = options.allowPluginPackaging === true;
  if (!FACTORY_TOOLS.includes(name) || (name === "factory_build_plugin" && !allowPluginPackaging)) {
    throw Object.assign(new Error("La operación Factory no está permitida por esta ruta."), { status: 403, code: "FACTORY_TOOL_NOT_ALLOWED" });
  }
  if (!args || typeof args !== "object" || Array.isArray(args)) throw Object.assign(new Error("Los argumentos Factory deben ser un objeto JSON."), { status: 400 });
  const connection = await connectFactory(env, options.signal, options.timeoutMs);
  try {
    const definition = connection.tools.find(tool => tool.name === name);
    if (!definition) throw Object.assign(new Error(`EM Factory no anuncia la operación ${name}.`), { status: 503, code: "FACTORY_TOOL_UNAVAILABLE" });
    const result = await connection.client.callTool({ name, arguments: args }, { signal: connection.signal, toolDefinition: definition });
    const normalized = trimResult(result);
    if (normalized.isError) throw Object.assign(new Error(`EM Factory devolvió un error al ejecutar ${name}.`), { status: 502, code: "FACTORY_TOOL_FAILED", result: normalized });
    return { result: normalized, server: connection.server, tool: definition.name };
  } finally { await closeFactory(connection); }
}

export async function readFactoryStatus(env, options = {}) {
  const settings = config(env);
  if (settings.error) return { status: "unavailable", configured: false, connected: false, reason: settings.error, tools: [] };
  const cacheKey = createHash("sha256").update(`${settings.url.href}\0${settings.sitesBypassToken}\0${settings.serviceToken}`).digest("hex");
  const cached = statusCache.get(cacheKey);
  if (cached?.value && cached.expiresAt > Date.now()) return cached.value;
  if (cached?.pending) return cached.pending;
  const pending = probeFactoryStatus(env, options).then(value => {
    statusCache.set(cacheKey, { value, expiresAt: Date.now() + STATUS_CACHE_TTL_MS });
    return value;
  }).finally(() => {
    const current = statusCache.get(cacheKey);
    if (current?.pending === pending) statusCache.delete(cacheKey);
  });
  statusCache.set(cacheKey, { pending, expiresAt: 0 });
  return pending;
}

async function probeFactoryStatus(env, options = {}) {
  let connection;
  try {
    connection = await connectFactory(env, options.signal, options.timeoutMs || 8000);
    const status = await connection.client.callTool({ name: "factory_status", arguments: {} }, { signal: connection.signal });
    const report = trimResult(status);
    if (report.isError) return { status: "degraded", configured: true, connected: false, reason: "factory_status devolvió un error.", tools: [] };
    return { status: "available", configured: true, connected: true, statusVerified: true, server: connection.server, tools: connection.tools.map(({ name, description }) => ({ name, description })) };
  } catch (error) {
    return { status: error.code === "FACTORY_NOT_CONFIGURED" ? "unavailable" : "degraded", configured: error.code !== "FACTORY_NOT_CONFIGURED", connected: false, reason: String(error.message || error).slice(0, 300), tools: [] };
  } finally { await closeFactory(connection); }
}

export function getFactoryConfigStatus(env) {
  const settings = config(env);
  return settings.error ? { configured: false, reason: settings.error } : { configured: true, endpointHost: settings.url.hostname };
}

