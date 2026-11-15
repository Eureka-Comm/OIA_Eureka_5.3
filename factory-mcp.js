import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createHash } from "node:crypto";

export const FACTORY_TOOLS = Object.freeze([
  "factory_status",
  "factory_open",
  "factory_build_resources",
  "factory_present_context",
  "factory_build_plugin",
]);

const safeTools = new Set(FACTORY_TOOLS.filter(name => name !== "factory_build_plugin"));
const MAX_TEXT = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 30000;
const STATUS_CACHE_TTL_MS = 15000;
const statusCache = new Map();

function factoryUrl(env) {
  const value = env.EM_FACTORY_MCP_URL || "";
  let url;
  try { url = new URL(value); } catch { return { error: "Configura una URL MCP válida de EM Factory en el servidor." }; }
  if (url.username || url.password || url.search || url.hash) return { error: "La URL MCP no debe contener credenciales, parámetros ni fragmentos." };
  if (url.protocol === "https:") return { url };
  const localHost = ["localhost", "127.0.0.1", "::1", "factory", "em-factory"].includes(url.hostname);
  if (url.protocol === "http:" && localHost && env.EM_FACTORY_MCP_ALLOW_HTTP === "true") return { url };
  return { error: "EM Factory debe usar HTTPS; HTTP solo se permite para un servicio interno declarado explícitamente." };
}

function config(env) {
  const parsed = factoryUrl(env);
  const sitesBypassToken = env.EM_FACTORY_SITES_BYPASS_TOKEN || "";
  const serviceToken = env.EM_FACTORY_SERVICE_TOKEN || "";
  const authMode = env.EM_FACTORY_AUTH_MODE || (sitesBypassToken ? "sites_bypass" : "bearer");
  const token = authMode === "sites_bypass"
    ? sitesBypassToken
    : env.EM_FACTORY_MCP_TOKEN || env.EM_FACTORY_OAUTH_TOKEN || "";
  if (parsed.error) return { error: parsed.error };
  if (!token) return { error: authMode === "sites_bypass" ? "Falta EM_FACTORY_SITES_BYPASS_TOKEN emitido por el propietario de EM Factory." : "Falta el token Bearer de servicio para EM Factory." };
  if (!new Set(["bearer", "sites_bypass"]).has(authMode)) return { error: "EM_FACTORY_AUTH_MODE debe ser bearer o sites_bypass." };
  if (authMode === "sites_bypass" && !serviceToken) return { error: "Falta EM_FACTORY_SERVICE_TOKEN para autenticar el servicio interno de Eureka ante EM Factory." };
  return { url: parsed.url, token, serviceToken, authMode };
}

function requestSignal(parent, timeoutMs) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return parent ? AbortSignal.any([parent, timeout]) : timeout;
}

export async function connectFactory(env, parentSignal, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const settings = config(env);
  if (settings.error) throw Object.assign(new Error(settings.error), { code: "FACTORY_NOT_CONFIGURED", status: 503 });
  const signal = requestSignal(parentSignal, timeoutMs);
  const client = new Client(
    { name: "eureka-multiverse-web", version: "0.1.0" },
    { versionNegotiation: { mode: "auto" }, listMaxPages: 8 },
  );
  const transportOptions = {
    requestInit: {
      signal,
      redirect: "error",
      ...(settings.authMode === "sites_bypass" ? { headers: { "OAI-Sites-Authorization": `Bearer ${settings.token}`, authorization: `Bearer ${settings.serviceToken}` } } : {}),
    },
    ...(settings.authMode === "bearer" ? { authProvider: { token: async () => settings.token } } : {}),
  };
  const transport = new StreamableHTTPClientTransport(settings.url, transportOptions);
  try {
    await client.connect(transport, { signal });
    const listed = await client.listTools();
    return {
      client,
      transport,
      signal,
      tools: listed.tools.filter(tool => FACTORY_TOOLS.includes(tool.name)),
      server: client.getServerVersion() || null,
    };
  } catch (error) {
    await client.close().catch(() => {});
    throw Object.assign(new Error(`No se pudo negociar o enumerar EM Factory: ${String(error?.message || error).slice(0, 240)}`), {
      code: "FACTORY_CONNECTION_FAILED",
      status: 502,
      cause: error,
    });
  }
}

export async function closeFactory(connection) {
  if (!connection) return;
  try { await connection.transport.terminateSession(); } catch {}
  try { await connection.client.close(); } catch {}
}

function trimResult(result) {
  const content = Array.isArray(result?.content) ? result.content.map(item => {
    if (item?.type === "text" && typeof item.text === "string") return { ...item, text: item.text.slice(0, MAX_TEXT) };
    if (item?.type === "image") return { type: "image", mimeType: item.mimeType, omitted: true, reason: "La vista web no guarda contenido binario MCP en esta ruta." };
    if (item?.type === "resource") return { type: "resource", omitted: true, reason: "Recursos binarios/embebidos requieren una ruta de descarga validada." };
    return item;
  }) : [];
  let structuredContent;
  if (result?.structuredContent && typeof result.structuredContent === "object") {
    const serialized = JSON.stringify(result.structuredContent);
    structuredContent = serialized.length <= MAX_TEXT
      ? result.structuredContent
      : { omitted: true, reason: "El contenido estructurado excede el límite de respuesta web.", sha256: createHash("sha256").update(serialized).digest("hex") };
  }
  return {
    isError: Boolean(result?.isError),
    content,
    ...(structuredContent === undefined ? {} : { structuredContent }),
  };
}

export async function callFactoryTool(env, name, args, options = {}) {
  const allowPluginPackaging = options.allowPluginPackaging === true;
  if (!FACTORY_TOOLS.includes(name) || (name === "factory_build_plugin" && !allowPluginPackaging)) {
    throw Object.assign(new Error("La operación Factory no está permitida por esta ruta."), { status: 403, code: "FACTORY_TOOL_NOT_ALLOWED" });
  }
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw Object.assign(new Error("Los argumentos Factory deben ser un objeto JSON."), { status: 400 });
  }
  const connection = await connectFactory(env, options.signal, options.timeoutMs);
  try {
    const definition = connection.tools.find(tool => tool.name === name);
    if (!definition) throw Object.assign(new Error(`EM Factory no anuncia la operación ${name}.`), { status: 503, code: "FACTORY_TOOL_UNAVAILABLE" });
    const result = await connection.client.callTool({ name, arguments: args }, { signal: connection.signal, toolDefinition: definition });
    const normalized = trimResult(result);
    if (normalized.isError) throw Object.assign(new Error(`EM Factory devolvió un error al ejecutar ${name}.`), { status: 502, code: "FACTORY_TOOL_FAILED", result: normalized });
    return { result: normalized, server: connection.server, tool: definition.name };
  } finally {
    await closeFactory(connection);
  }
}

export async function readFactoryStatus(env, options = {}) {
  const settings = config(env);
  if (settings.error) return { status: "unavailable", configured: false, connected: false, reason: settings.error, tools: [] };
  const cacheKey = createHash("sha256").update(`${settings.url.href}\0${settings.token}\0${settings.serviceToken || ""}`).digest("hex");
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
    const advertised = connection.tools.map(tool => ({ name: tool.name, description: String(tool.description || "").slice(0, 500) }));
    if (!advertised.some(tool => tool.name === "factory_status")) {
      return { status: "degraded", configured: true, connected: false, reason: "El servidor MCP respondió, pero no anuncia factory_status.", server: connection.server, tools: advertised };
    }
    const definition = connection.tools.find(tool => tool.name === "factory_status");
    const status = await connection.client.callTool({ name: "factory_status", arguments: {} }, { signal: connection.signal, toolDefinition: definition });
    const report = trimResult(status);
    if (report.isError) return { status: "degraded", configured: true, connected: false, reason: "factory_status devolvió un error.", server: connection.server, tools: advertised };
    return { status: "available", configured: true, connected: true, statusVerified: true, server: connection.server, tools: advertised };
  } catch (error) {
    return {
      status: error.code === "FACTORY_NOT_CONFIGURED" ? "unavailable" : "degraded",
      configured: error.code !== "FACTORY_NOT_CONFIGURED",
      connected: false,
      reason: String(error.message || error).slice(0, 300),
      tools: [],
    };
  } finally {
    await closeFactory(connection);
  }
}

export function getFactoryConfigStatus(env) {
  const settings = config(env);
  return settings.error
    ? { configured: false, reason: settings.error }
    : { configured: true, endpointHost: settings.url.hostname };
}
