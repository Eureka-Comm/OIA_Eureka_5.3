const agentIds = ["core", "structurer", "descriptor", "predictor", "prescriptor", "actioner", "installer", "publisher"];

function configured(env) {
  return Boolean(env.EUREKA_RUNTIME_CAPABILITIES_URL && env.EUREKA_RUNTIME_INVOKE_URL && env.EUREKA_RUNTIME_API_TOKEN);
}

function validateUrl(value, allowHttp = false) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || ((url.hostname === "localhost" || url.hostname === "127.0.0.1" || (allowHttp && url.hostname === "runtime")) && url.protocol === "http:");
  } catch { return false; }
}

export async function readEurekaCapabilities(env) {
  if (!configured(env)) {
    return {
      connected: false,
      reason: "Configura las URL de capacidades e invocación y el token del runtime de Eureka en el servidor.",
      capabilities: agentIds.map(id => ({ id, status: "unavailable", reason: "Runtime de Eureka no conectado" })),
    };
  }
  const allowHttp = env.EUREKA_RUNTIME_ALLOW_HTTP === "true";
  if (!validateUrl(env.EUREKA_RUNTIME_CAPABILITIES_URL, allowHttp) || !validateUrl(env.EUREKA_RUNTIME_INVOKE_URL, allowHttp)) {
    return { connected: false, reason: "El runtime de Eureka requiere HTTPS, salvo localhost durante desarrollo.", capabilities: [] };
  }
  let response;
  try {
    response = await fetch(env.EUREKA_RUNTIME_CAPABILITIES_URL, {
      headers: { authorization: `Bearer ${env.EUREKA_RUNTIME_API_TOKEN}`, accept: "application/json" },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
  } catch (error) {
    return { connected: false, reason: `No se pudo contactar al runtime de Eureka: ${String(error.message || error).slice(0, 240)}`, capabilities: [] };
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || !Array.isArray(payload.capabilities)) {
    return { connected: false, reason: `El API de capacidades no devolvió el contrato esperado (HTTP ${response.status}).`, capabilities: [] };
  }
  const coreAvailable = payload.capabilities.some(item => item.id === "core" && item.status === "available");
  return { connected: coreAvailable, reason: coreAvailable ? null : (payload.reason || "El runtime respondió, pero EM Core no está disponible. Configura el proveedor de inferencia."), capabilities: payload.capabilities };
}

export async function invokeEurekaAgent(request, env) {
  if (!configured(env)) return { status: 503, body: { error: "El runtime de agentes de Eureka todavía no está conectado.", dependency: "EUREKA_RUNTIME_CAPABILITIES_URL, EUREKA_RUNTIME_INVOKE_URL y EUREKA_RUNTIME_API_TOKEN" } };
  if (!validateUrl(env.EUREKA_RUNTIME_INVOKE_URL, env.EUREKA_RUNTIME_ALLOW_HTTP === "true")) return { status: 503, body: { error: "La URL de invocación debe usar HTTPS; HTTP solo se permite en localhost o en la red privada configurada del contenedor." } };
  let body;
  try { body = await request.json(); } catch { return { status: 400, body: { error: "Se esperaba un cuerpo JSON." } }; }
  const agent = typeof body.agent === "string" ? body.agent : "";
  const task = typeof body.task === "string" ? body.task.trim() : "";
  if (!agentIds.includes(agent)) return { status: 400, body: { error: "El campo agent debe identificar EM Core o uno de sus siete especialistas." } };
  if (!task || task.length > 12000) return { status: 400, body: { error: "El campo task es obligatorio y admite hasta 12 000 caracteres." } };
  const invocation = {
    invocationId: crypto.randomUUID(),
    agent,
    task,
    input: body.input ?? task,
    taskId: typeof body.taskId === "string" ? body.taskId : null,
    formulationVersion: body.formulationVersion ?? null,
    inputRefs: Array.isArray(body.inputRefs) ? body.inputRefs.slice(0, 50) : [],
    requestedAt: new Date().toISOString(),
  };
  let response;
  try {
    response = await fetch(env.EUREKA_RUNTIME_INVOKE_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${env.EUREKA_RUNTIME_API_TOKEN}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(invocation),
      signal: AbortSignal.timeout(120000),
    });
  } catch (error) {
    return { status: 502, body: { error: "Falló la conexión con el runtime de Eureka.", detail: String(error.message || error).slice(0, 240), invocationId: invocation.invocationId } };
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) return { status: 502, body: { error: `El runtime de Eureka no completó la invocación (HTTP ${response.status}).`, invocationId: invocation.invocationId } };
  if (payload.agent !== agent || typeof payload.status !== "string" || !Object.hasOwn(payload, "product")) {
    return { status: 502, body: { error: "La respuesta del runtime no cumple el contrato: debe confirmar agente, estado y producto.", invocationId: invocation.invocationId } };
  }
  return { status: response.status, body: { ...payload, invocationId: payload.invocationId || invocation.invocationId, agent } };
}

export async function requestEurekaTask(taskId, env, after = null) {
  if (!configured(env) || !validateUrl(env.EUREKA_RUNTIME_CAPABILITIES_URL, env.EUREKA_RUNTIME_ALLOW_HTTP === "true")) return { status: 503, body: { error: "El runtime de Eureka no está disponible." } };
  const target = new URL(env.EUREKA_RUNTIME_CAPABILITIES_URL);
  target.pathname = target.pathname.replace(/\/v1\/capabilities\/?$/, `/v1/tasks/${encodeURIComponent(taskId)}${after === null ? "" : "/events"}`);
  if (after !== null) target.searchParams.set("after", String(Math.max(0, Number(after) || 0)));
  try {
    const response = await fetch(target, { headers: { authorization: `Bearer ${env.EUREKA_RUNTIME_API_TOKEN}`, accept: "application/json" }, signal: AbortSignal.timeout(10000), cache: "no-store" });
    return { status: response.status, body: await response.json().catch(() => ({ error: "Respuesta inválida del runtime." })) };
  } catch (error) { return { status: 502, body: { error: "No se pudo leer la tarea de Eureka.", detail: String(error.message || error).slice(0, 200) } }; }
}

export async function createEurekaTask(request, env) {
  if (!configured(env) || !validateUrl(env.EUREKA_RUNTIME_CAPABILITIES_URL, env.EUREKA_RUNTIME_ALLOW_HTTP === "true")) return { status: 503, body: { error: "El runtime de Eureka no está disponible." } };
  let body;
  try { body = await request.json(); } catch { return { status: 400, body: { error: "Se esperaba un cuerpo JSON." } }; }
  const target = new URL(env.EUREKA_RUNTIME_CAPABILITIES_URL);
  target.pathname = target.pathname.replace(/\/v1\/capabilities\/?$/, "/v1/tasks");
  try {
    const response = await fetch(target, { method: "POST", headers: { authorization: `Bearer ${env.EUREKA_RUNTIME_API_TOKEN}`, "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    return { status: response.status, body: await response.json().catch(() => ({ error: "Respuesta inválida del runtime." })) };
  } catch (error) { return { status: 502, body: { error: "No se pudo crear la tarea en Eureka.", detail: String(error.message || error).slice(0, 200) } }; }
}

export { agentIds };
