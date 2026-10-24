import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT || 3001);
const maxBodyBytes = 52 * 1024 * 1024;
const taskIdPattern = /^[A-Za-z0-9_-]{1,128}$/;
const roles = {
  core: { name: "EM Core", skill: "em-core-5-3", owner: "Eureka-0" },
  structurer: { name: "EM Structurer", skill: "em-structurer-5-3", owner: "EM Structurer" },
  descriptor: { name: "EM Descriptor", skill: "em-descriptor-5-3", owner: "EM Descriptor" },
  predictor: { name: "EM Predictor", skill: "em-predictor-5-3", owner: "EM Predictor" },
  prescriptor: { name: "EM Prescriptor", skill: "em-prescriptor-5-3", owner: "EM Prescriptor" },
  actioner: { name: "EM Actioner", skill: "em-actioner-5-3", owner: "EM Actioner" },
  installer: { name: "EM Installer", skill: "em-installer-5-3", owner: "EM Installer" },
  publisher: { name: "EM Publisher", skill: "em-publisher-5-3", owner: "EM Publisher" },
};
const specialistIds = Object.keys(roles).filter(id => id !== "core");
const skillsRoot = join(dirname(fileURLToPath(import.meta.url)), "skills");
const dataFile = process.env.EUREKA_RUNTIME_DATA_FILE || join(dirname(fileURLToPath(import.meta.url)), "runtime-data.json");
let writeQueue = Promise.resolve();
const skills = {};
for (const id of ["eureka-multiverse-5-3", ...Object.values(roles).map(role => role.skill)]) {
  try {
    const root = join(skillsRoot, id);
    const skill = await readFile(join(root, "SKILL.md"), "utf8");
    const referencesDir = join(root, "references");
    const referenceFiles = await readdir(referencesDir).catch(() => []);
    const references = await Promise.all(referenceFiles.filter(file => file.endsWith(".md")).sort().map(async file => ({ file, text: await readFile(join(referencesDir, file), "utf8") })));
    skills[id] = { text: [skill, ...references.map(reference => `\n\n# Reference: ${reference.file}\n${reference.text}`)].join(""), digest: createHash("sha256").update(skill + references.map(reference => reference.text).join("\n")).digest("hex") };
  } catch {
    skills[id] = null;
  }
}
const systemSkill = skills["eureka-multiverse-5-3"];

async function readStore() {
  try { return JSON.parse(await readFile(dataFile, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return { tasks: {} }; throw error; }
}

function updateStore(update) {
  const operation = writeQueue.then(async () => {
    const state = await readStore();
    const result = await update(state);
    await mkdir(dirname(dataFile), { recursive: true });
    const temporary = `${dataFile}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
    await rename(temporary, dataFile);
    return result;
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

async function getTask(taskId) {
  await writeQueue;
  const state = await readStore();
  return state.tasks[taskId] || null;
}

function mutateTask(taskId, callback) {
  return updateStore(state => {
    const task = state.tasks[taskId];
    if (!task) return null;
    return callback(task);
  });
}

function appendTaskEvent(task, type, data = {}) {
  const at = new Date().toISOString();
  const { actor = "system", payload, ...details } = data;
  const event = { id: crypto.randomUUID(), taskId: task.id, sequence: task.events.length + 1, type, actor, at, occurredAt: at, payload: payload || details };
  if (Number.isInteger(details.formulationVersion) && details.formulationVersion > 0) event.formulationVersion = details.formulationVersion;
  if (typeof details.reason === "string") event.reason = details.reason;
  task.events.push(event);
  task.updatedAt = event.at;
  return event;
}

function ensureTaskState(task) {
  task.formulations ||= [];
  task.currentFormulationVersion ??= 0;
  task.gates ||= [];
  task.agentInvocations ||= [];
  task.schemaVersion ||= "0.1";
  task.createdBy ||= "system";
  return task;
}

function parseJsonObject(text, errorMessage) {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(normalized);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected object");
    return parsed;
  } catch { throw Object.assign(new Error(errorMessage), { status: 502 }); }
}

function normalizeStatementList(value, field, classification = "proposal") {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50 || value.some(item => typeof item !== "string" || !item.trim() || item.length > 2000)) {
    throw Object.assign(new Error(`La formulación contiene una lista ${field} no válida.`), { status: 502 });
  }
  return value.map(text => ({ text: text.trim(), classification, evidenceRefs: [], sourceNote: "Propuesta generada por EM Structurer; requiere revisión humana." }));
}

async function proposeFormulation(taskId, body) {
  if (!providerConfigured() || !skills[roles.structurer.skill] || !systemSkill) throw Object.assign(new Error("EM Structurer requiere runtime, Skills y proveedor de inferencia disponibles."), { status: 503 });
  const task = await getTask(taskId);
  if (!task) throw Object.assign(new Error("No se encontró la tarea."), { status: 404 });
  if (task.formulations?.some(item => item.status === "proposed")) throw Object.assign(new Error("Ya existe una formulación pendiente de revisión para esta tarea."), { status: 409 });
  const latestMessage = typeof body.context === "string" ? body.context.trim() : "";
  if (latestMessage.length > 12000) throw Object.assign(new Error("El contexto admite hasta 12 000 caracteres."), { status: 400 });
  const intent = task.intent || task.messages.find(message => message.role === "user")?.text || "";
  const conversationContext = (task.messages || []).slice(-20).map(message => `${message.role === "user" ? "Usuario" : "Eureka"}: ${message.text}`).join("\n\n");
  if (!intent && !latestMessage) throw Object.assign(new Error("La tarea necesita una intención o contexto para formularse."), { status: 400 });
  const prior = task.formulations?.at(-1);
  const prompt = [
    `Intención inicial de la tarea:\n${intent}${conversationContext ? `\n\nConversación reciente:\n${conversationContext}` : ""}${latestMessage ? `\n\nContexto adicional:\n${latestMessage}` : ""}`,
    prior ? `\n\nFormulación previa v${prior.version} (propón una nueva versión solo si el cambio lo justifica):\n${JSON.stringify(prior)}` : "",
    "\n\nDevuelve únicamente JSON con estas propiedades: problemStatement (string), objectives (array de strings), boundaries (objeto con included y excluded, ambos arrays de strings), assumptions (array de strings), constraints (array de strings), changeReason (string). No inventes evidencia ni términos canónicos CUT, operadores, cálculos ACFL/GCLV o semántica que no haya sido especificada. Esta es una propuesta, no una aceptación.",
  ].join("");
  const result = await infer(instructionsFor(roles.structurer.skill, "Formula y revisa el problema según la Skill completa de EM Structurer. Preserva ambigüedades como preguntas o supuestos; no decidas por Eureka-0."), [{ type: "input_text", text: prompt }], AbortSignal.timeout(Number(process.env.MODEL_TIMEOUT_MS || 120000)));
  const draft = parseJsonObject(result.text, "EM Structurer no devolvió una formulación JSON válida.");
  if (typeof draft.problemStatement !== "string" || !draft.problemStatement.trim() || draft.problemStatement.length > 12000 || typeof draft.changeReason !== "string" || !draft.changeReason.trim()) throw Object.assign(new Error("La formulación de EM Structurer no incluye problemStatement y changeReason válidos."), { status: 502 });
  const boundaries = draft.boundaries || {};
  if (!boundaries || typeof boundaries !== "object" || Array.isArray(boundaries)) throw Object.assign(new Error("La formulación contiene boundaries no válidos."), { status: 502 });
  const included = boundaries.included ?? [];
  const excluded = boundaries.excluded ?? [];
  if (![included, excluded].every(list => Array.isArray(list) && list.length <= 50 && list.every(item => typeof item === "string" && item.trim() && item.length <= 2000))) throw Object.assign(new Error("La formulación contiene límites no válidos."), { status: 502 });
  const proposed = await mutateTask(taskId, current => {
    ensureTaskState(current);
    const version = current.formulations.length ? Math.max(...current.formulations.map(item => item.version)) + 1 : 1;
    const now = new Date().toISOString();
    const formulation = {
      id: crypto.randomUUID(), taskId, version, status: "proposed", owner: "EM Structurer",
      problemStatement: draft.problemStatement.trim(),
      objectives: normalizeStatementList(draft.objectives, "objectives"),
      boundaries: { included: included.map(item => item.trim()), excluded: excluded.map(item => item.trim()) },
      assumptions: normalizeStatementList(draft.assumptions, "assumptions", "assumption"),
      constraints: normalizeStatementList(draft.constraints, "constraints", "constraint"),
      createdAt: now, changeReason: draft.changeReason.trim(),
    };
    current.formulations.push(formulation);
    current.currentFormulationVersion = version;
    current.status = "formulation_review";
    const gate = { id: crypto.randomUUID(), kind: "formulation_review", status: "pending", formulationVersion: version, requiredReviewer: "Eureka-0", raisedAt: now, blocking: false, note: "La propuesta requiere revisión humana antes de considerarse aceptada." };
    current.gates.push(gate);
    appendTaskEvent(current, "FormulationProposed", { actor: "EM Structurer", formulationVersion: version, reason: formulation.changeReason, payload: { formulationId: formulation.id, formulation, providerResponseId: result.providerResponseId } });
    appendTaskEvent(current, "GateRaised", { actor: "EM Core", formulationVersion: version, reason: gate.note, payload: { gateId: gate.id, kind: gate.kind, status: gate.status, blocking: gate.blocking } });
    return { formulation, gate };
  });
  return { taskId, ...proposed, trace: { providerResponseId: result.providerResponseId, skillVersion: "5.3.2", instructionDigest: skills[roles.structurer.skill].digest } };
}

async function reviewFormulation(taskId, version, body) {
  const configuredReviewer = process.env.EUREKA_ZERO_REVIEW_USERNAME || "";
  if (!configuredReviewer || body.reviewerUsername !== configuredReviewer) throw Object.assign(new Error("Esta sesión no está vinculada a una identidad revisora de Eureka-0."), { status: 403 });
  if (!["accepted", "rejected"].includes(body.decision)) throw Object.assign(new Error("decision debe ser accepted o rejected."), { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
  const result = await mutateTask(taskId, current => {
    ensureTaskState(current);
    const formulation = current.formulations.find(item => item.version === version);
    if (!formulation) return { error: "No se encontró esa versión de formulación.", status: 404 };
    if (formulation.status !== "proposed") return { error: "La formulación ya fue revisada y no admite otra decisión.", status: 409 };
    const gate = current.gates.find(item => item.kind === "formulation_review" && item.formulationVersion === version && item.status === "pending");
    if (!gate) return { error: "No existe un gate de revisión pendiente para esta versión.", status: 409 };
    const now = new Date().toISOString();
    formulation.status = body.decision;
    formulation.reviewedBy = "Eureka-0";
    formulation.reviewNote = note;
    gate.status = body.decision === "accepted" ? "passed" : "blocked";
    gate.reviewedAt = now;
    gate.reviewNote = note;
    if (body.decision === "accepted") {
      for (const previous of current.formulations) if (previous.version !== version && previous.status === "accepted") previous.status = "superseded";
      current.status = "analysis";
      appendTaskEvent(current, "FormulationAccepted", { actor: "Eureka-0", formulationVersion: version, reason: note || "Formulación aceptada por la persona revisora configurada.", payload: { formulationId: formulation.id, reviewer: configuredReviewer } });
      appendTaskEvent(current, "GatePassed", { actor: "Eureka-0", formulationVersion: version, reason: note || "Gate de revisión de formulación aprobado.", payload: { gateId: gate.id, kind: gate.kind } });
    } else {
      current.status = "formulation_review";
      appendTaskEvent(current, "FormulationRejected", { actor: "Eureka-0", formulationVersion: version, reason: note || "Formulación rechazada; requiere una nueva propuesta.", payload: { formulationId: formulation.id, reviewer: configuredReviewer } });
      appendTaskEvent(current, "GateBlocked", { actor: "Eureka-0", formulationVersion: version, reason: note || "La formulación fue rechazada.", payload: { gateId: gate.id, kind: gate.kind } });
    }
    appendTaskEvent(current, "FormulationReviewed", { actor: "Eureka-0", formulationVersion: version, reason: note || `Revisión registrada: ${body.decision}.`, payload: { formulationId: formulation.id, decision: body.decision, reviewer: configuredReviewer } });
    return { formulation, gate };
  });
  if (!result) throw Object.assign(new Error("No se encontró la tarea."), { status: 404 });
  if (result.error) throw Object.assign(new Error(result.error), { status: result.status });
  return { taskId, ...result, reviewer: "Eureka-0" };
}

function providerConfigured() {
  const protocol = process.env.MODEL_API_PROTOCOL || "responses";
  if (!["responses", "chat_completions"].includes(protocol)) return false;
  const authConfigured = process.env.MODEL_API_AUTH_MODE === "none" || Boolean(process.env.MODEL_API_KEY);
  return Boolean(process.env.MODEL_API_URL && authConfigured && process.env.MODEL_NAME && safeProviderUrl(process.env.MODEL_API_URL, process.env.MODEL_API_ALLOW_HTTP === "true"));
}

function capabilities() {
  const active = providerConfigured();
  return Object.entries(roles).map(([id, role]) => ({
    id,
    name: role.name,
    owner: role.owner,
    version: "5.3.2",
    instructionDigest: skills[role.skill]?.digest || null,
    status: active && systemSkill && skills[role.skill] ? "available" : "unavailable",
    ...(!systemSkill || !skills[role.skill] ? { reason: "Falta el paquete versionado de Skills de Eureka Multiverse 5.3." } : !active ? { reason: "Configura un proveedor de inferencia (MODEL_API_URL, MODEL_NAME y autenticación según corresponda)." } : {}),
  }));
}

function instructionsFor(skillId, adapterInstructions) {
  const bundle = [systemSkill?.text, skills[skillId]?.text].filter(Boolean).join("\n\n---\n\n");
  return `${bundle}\n\n## Adaptador de ejecución HTTP\n${adapterInstructions}\n\nLas Skills definen la cognición y propiedad del trabajo. El adaptador añade el formato de transporte; no las reemplaza.`;
}

function authorized(request) {
  const expected = process.env.EUREKA_RUNTIME_API_TOKEN || "";
  const actual = request.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !actual) return false;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  response.end(JSON.stringify(body));
}

function safeProviderUrl(value, allowHttp = false) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (allowHttp && ["localhost", "127.0.0.1", "host.docker.internal", "model", "ollama"].includes(url.hostname) && url.protocol === "http:");
  } catch { return false; }
}

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maxBodyBytes) throw Object.assign(new Error("Solicitud demasiado grande."), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Se esperaba un cuerpo JSON válido."), { status: 400 }); }
}

function responseText(payload) {
  if (typeof payload.output_text === "string") return payload.output_text.trim();
  const chunks = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) if (content.type === "output_text" && typeof content.text === "string") chunks.push(content.text);
  }
  return chunks.join("\n").trim();
}

function chatCompletionMessages(instructions, content) {
  const messageContent = [];
  for (const part of content) {
    if (part.type === "input_text") messageContent.push({ type: "text", text: part.text || "" });
    else if (part.type === "input_image") {
      if (typeof part.image_url !== "string" || !part.image_url.startsWith("data:image/")) {
        throw Object.assign(new Error("La inferencia Chat Completions requiere imágenes adjuntas como data URL."), { status: 415 });
      }
      messageContent.push({ type: "image_url", image_url: { url: part.image_url, detail: part.detail || "auto" } });
    } else if (part.type === "input_file") {
      throw Object.assign(new Error("El proveedor Chat Completions configurado no admite archivos arbitrarios en esta integración. Usa un proveedor Responses API o convierte el documento a texto antes de adjuntarlo."), { status: 415 });
    }
  }
  return [
    { role: "system", content: instructions },
    { role: "user", content: messageContent.length === 1 && messageContent[0].type === "text" ? messageContent[0].text : messageContent },
  ];
}

function chatCompletionText(payload) {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.filter(part => part?.type === "text" && typeof part.text === "string").map(part => part.text).join("\n").trim();
  return "";
}

async function infer(instructions, content, signal) {
  const url = process.env.MODEL_API_URL;
  if (!safeProviderUrl(url, process.env.MODEL_API_ALLOW_HTTP === "true")) throw Object.assign(new Error("MODEL_API_URL debe usar HTTPS, salvo host local configurado explícitamente para inferencia privada."), { status: 503 });
  const protocol = process.env.MODEL_API_PROTOCOL || "responses";
  const providerHeaders = { "content-type": "application/json", accept: "application/json" };
  if (process.env.MODEL_API_AUTH_MODE !== "none" && process.env.MODEL_API_KEY) providerHeaders.authorization = `Bearer ${process.env.MODEL_API_KEY}`;
  const requestBody = protocol === "chat_completions"
    ? { model: process.env.MODEL_NAME, messages: chatCompletionMessages(instructions, content), max_tokens: Number(process.env.MODEL_MAX_OUTPUT_TOKENS || 3000), stream: false }
    : { model: process.env.MODEL_NAME, instructions, input: [{ role: "user", content }], max_output_tokens: Number(process.env.MODEL_MAX_OUTPUT_TOKENS || 3000), store: false };
  const response = await fetch(url, {
    method: "POST",
    headers: providerHeaders,
    body: JSON.stringify(requestBody),
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw Object.assign(new Error(`El proveedor de inferencia no completó la solicitud (HTTP ${response.status}).`), { status: 502 });
  const text = protocol === "chat_completions" ? chatCompletionText(payload) : responseText(payload);
  if (!text) throw Object.assign(new Error("El proveedor de inferencia devolvió una respuesta vacía."), { status: 502 });
  return { text, providerResponseId: typeof payload.id === "string" ? payload.id : null };
}

function parsePlan(text) {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let plan;
  try { plan = JSON.parse(normalized); }
  catch { throw Object.assign(new Error("EM Core no devolvió un plan de routing válido."), { status: 502 }); }
  if (!["direct", "delegate"].includes(plan.mode) || typeof plan.reason !== "string" || !plan.reason.trim()) {
    throw Object.assign(new Error("EM Core debe devolver modo y motivo de routing válidos."), { status: 502 });
  }
  if (plan.mode === "direct") {
    if (typeof plan.response !== "string" || !plan.response.trim() || (plan.steps || []).length) throw Object.assign(new Error("La respuesta directa de EM Core debe contener response y no incluir steps."), { status: 502 });
    return { mode: "direct", steps: [], response: plan.response.trim(), reason: plan.reason.trim().slice(0, 1200) };
  }
  if (!Array.isArray(plan.steps) || !plan.steps.length || plan.steps.length > specialistIds.length) throw Object.assign(new Error("El routing de Core debe incluir una lista válida de tareas especialistas."), { status: 502 });
  const steps = plan.steps.map((step, index) => {
    const dependencies = Array.isArray(step.dependsOn) ? step.dependsOn : [];
    if (!specialistIds.includes(step.agent) || typeof step.task !== "string" || !step.task.trim() || step.task.length > 12000 || dependencies.some(dep => !Number.isInteger(dep) || dep < 0 || dep >= index)) throw Object.assign(new Error("EM Core devolvió una tarea inválida, un rol no permitido o dependencias no válidas."), { status: 502 });
    return { agent: step.agent, task: step.task.trim(), dependsOn: [...new Set(dependencies)] };
  });
  return { mode: "delegate", steps, reason: plan.reason.trim().slice(0, 1200) };
}

function contentForModel(input, task) {
  const parts = Array.isArray(input) ? input.filter(item => item && ["input_text", "input_image", "input_file"].includes(item.type)) : [];
  if (!parts.some(item => item.type === "input_text")) parts.unshift({ type: "input_text", text: task });
  if (parts.length > 65) throw Object.assign(new Error("La solicitud contiene demasiadas partes de entrada."), { status: 400 });
  return parts;
}

async function invokeCore(body) {
  if (!providerConfigured()) throw Object.assign(new Error("El runtime API está instalado, pero falta configurar un proveedor de inferencia."), { status: 503 });
  if (!systemSkill || !skills[roles.core.skill]) throw Object.assign(new Error("Falta el paquete de instrucciones de Eureka Multiverse 5.3 en el runtime."), { status: 503 });
  const task = typeof body.task === "string" ? body.task.trim() : "";
  if (!task || task.length > 12000) throw Object.assign(new Error("El campo task es obligatorio y admite hasta 12 000 caracteres."), { status: 400 });
  const taskId = typeof body.taskId === "string" && taskIdPattern.test(body.taskId) ? body.taskId : crypto.randomUUID();
  const previousTask = await getTask(taskId);
  const previousMessages = previousTask?.messages || [];
  const content = contentForModel(body.input, task);
  if (previousTask?.intent) content.unshift({ type: "input_text", text: `Intención inicial de Eureka-0 para esta tarea:\n${previousTask.intent}` });
  if (previousMessages.length) {
    const history = previousMessages.slice(-24).map(message => `${message.role === "user" ? "Eureka-0" : "Eureka"}: ${message.text}`).join("\n\n");
    content.unshift({ type: "input_text", text: `Historial de esta tarea; consérvalo como contexto y corrige cualquier interpretación previa cuando nueva evidencia lo requiera:\n${history}` });
  }
  await updateStore(state => {
    const now = new Date().toISOString();
    const current = ensureTaskState(state.tasks[taskId] || { id: taskId, intent: "", createdAt: now, updatedAt: now, status: "intake", interactionState: "Dialogue/Explore", messages: [], events: [] });
    if (!current.events.length) appendTaskEvent(current, "TaskCreated", { actor: "system" });
    current.messages.push({ role: "user", text: task, at: now });
    appendTaskEvent(current, "MessageReceived", { actor: "system", text: task, attachments: Array.isArray(body.input) ? body.input.filter(part => part.type === "input_file" || part.type === "input_image").map(part => ({ type: part.type, filename: part.filename, media_type: part.media_type })) : [] });
    current.interactionState = "Understand/Frame";
    state.tasks[taskId] = current;
  });
  const timeout = AbortSignal.timeout(Number(process.env.MODEL_TIMEOUT_MS || 120000));
  const planResult = await infer(
    instructionsFor(roles.core.skill, `Opera la solicitud entrante bajo las reglas de las Skills completas incluidas arriba. No hay herramientas externas registradas en este runtime; no inventes llamadas a MCP, búsquedas, cálculos, acciones, estado persistente o permisos. Cuando la tarea pueda resolverse sin especialista devuelve solo JSON {"mode":"direct","reason":"motivo","response":"respuesta de Core"}. En caso contrario devuelve solo JSON {"mode":"delegate","reason":"motivo de routing","steps":[{"agent":"ID","task":"subtarea concreta","dependsOn":[]}]} con IDs entre ${specialistIds.join(", ")}. Usa un número y orden de pasos acorde con dependencias reales; no fuerces un flujo fijo. No invoques directamente herramientas ni afirmes que lo hiciste.`),
    content,
    timeout,
  );
  const plan = parsePlan(planResult.text);
  await mutateTask(taskId, current => { current.interactionState = plan.mode === "delegate" ? "Solve/Coordinate" : "Dialogue/Explore"; appendTaskEvent(current, "RoutingDecided", { actor: "EM Core", mode: plan.mode, reason: plan.reason, steps: plan.steps }); });
  if (plan.mode === "direct") {
    await mutateTask(taskId, current => { current.messages.push({ role: "assistant", text: plan.response, at: new Date().toISOString() }); current.interactionState = "Dialogue/Explore"; appendTaskEvent(current, "CoreCompleted", { text: plan.response, providerResponseId: planResult.providerResponseId }); });
    return { invocationId: body.invocationId || crypto.randomUUID(), taskId, agent: "core", status: "completed", product: { text: plan.response }, text: plan.response, routedAgents: [], routingReason: plan.reason, trace: { taskId, formulationVersion: body.formulationVersion ?? null, skillVersion: "5.3.2", coreInstructionDigest: skills[roles.core.skill].digest, systemInstructionDigest: systemSkill.digest, providerResponseIds: [planResult.providerResponseId].filter(Boolean), persistence: "json-event-store" } };
  }
  const results = [];
  const pending = new Set(plan.steps.map((_, index) => index));
  while (pending.size) {
    const ready = [...pending].filter(index => plan.steps[index].dependsOn.every(dependency => results[dependency]));
    if (!ready.length) throw Object.assign(new Error("El grafo de subtareas de Core contiene una dependencia no resoluble."), { status: 502 });
    const batch = await Promise.all(ready.map(async index => {
      const step = plan.steps[index];
      const role = roles[step.agent];
      if (!skills[role.skill]) throw Object.assign(new Error(`Falta la Skill versionada de ${role.name}.`), { status: 503 });
      const prior = step.dependsOn.map(dependency => results[dependency]).filter(Boolean).map(result => `### ${result.name}\n${result.text}`).join("\n\n");
      const taskContent = [...content, { type: "input_text", text: `Subtarea asignada por EM Core (${role.name}):\n${step.task}${prior ? `\n\nResultados previos que esta subtarea debe considerar:\n${prior}` : ""}` }];
      const invocationId = crypto.randomUUID();
      await mutateTask(taskId, current => {
        ensureTaskState(current);
        const invocation = { id: invocationId, taskId, agent: role.name, requestedBy: "EM Core", reason: plan.reason, executionMode: ready.length > 1 ? "parallel" : "sequential", status: "running", provider: "eureka-runtime", inputRefs: [], formulationVersion: current.currentFormulationVersion || null, requestedAt: new Date().toISOString(), startedAt: new Date().toISOString(), capabilityVersion: "5.3.2" };
        current.agentInvocations.push(invocation);
        appendTaskEvent(current, "AgentInvoked", { actor: "EM Core", agent: role.name, reason: plan.reason, formulationVersion: invocation.formulationVersion || undefined, payload: { invocationId, agent: role.name, reason: plan.reason, status: "running", dependsOn: step.dependsOn } });
      });
      let result;
      try {
        result = await infer(instructionsFor(role.skill, `Ejecuta únicamente la responsabilidad de ${role.name} definida por su Skill completa. Respeta autoridad de Eureka-0, gates, incertidumbre y límites de herramientas. El runtime no tiene herramientas externas registradas: no simules resultados de tools ni ejecuciones.`), taskContent, timeout);
      } catch (error) {
        await mutateTask(taskId, current => {
          ensureTaskState(current);
          const invocation = current.agentInvocations.find(item => item.id === invocationId);
          if (invocation) { invocation.status = "failed"; invocation.completedAt = new Date().toISOString(); invocation.failureNote = String(error.message || error).slice(0, 500); }
          appendTaskEvent(current, "AgentFailed", { actor: role.name, agent: role.name, reason: String(error.message || error).slice(0, 500), payload: { invocationId, agent: role.name, status: "failed" } });
        });
        throw error;
      }
      await mutateTask(taskId, current => {
        ensureTaskState(current);
        const invocation = current.agentInvocations.find(item => item.id === invocationId);
        if (invocation) { invocation.status = "completed"; invocation.completedAt = new Date().toISOString(); invocation.modelOrToolVersion = process.env.MODEL_NAME || "configured-provider"; }
        appendTaskEvent(current, "AgentCompleted", { actor: role.name, agent: role.name, formulationVersion: invocation?.formulationVersion || undefined, payload: { invocationId, agent: role.name, status: "completed", providerResponseId: result.providerResponseId }, text: result.text });
      });
      return { index, value: { id: step.agent, name: role.name, task: step.task, text: result.text, providerResponseId: result.providerResponseId } };
    }));
    for (const { index, value } of batch) { results[index] = value; pending.delete(index); }
  }
  const specialistResults = results;
  const synthesisInput = [{ type: "input_text", text: `Solicitud original:\n${task}\n\nMotivo del routing de EM Core:\n${plan.reason}\n\nContribuciones de especialistas:\n${specialistResults.map(result => `### ${result.name}\n${result.text}`).join("\n\n")}` }];
  const synthesis = await infer(
    instructionsFor(roles.core.skill, "Integra las contribuciones producidas por los roles que Core convocó según su Skill. No ocultes discrepancias, incertidumbres, límites, gates ni requisitos de autorización. No conviertas propuestas en decisiones autorizadas. Distingue evidencia, inferencia y recomendación cuando aplique."),
    synthesisInput,
    timeout,
  );
  await mutateTask(taskId, current => {
    current.messages.push({ role: "assistant", text: synthesis.text, at: new Date().toISOString() });
    current.interactionState = "Dialogue/Explore";
    appendTaskEvent(current, "CoreCompleted", { text: synthesis.text, providerResponseId: synthesis.providerResponseId, routedAgents: specialistResults.map(result => result.id) });
  });
  const invocationId = typeof body.invocationId === "string" ? body.invocationId : crypto.randomUUID();
  return {
    invocationId,
    agent: "core",
    status: "completed",
    product: { text: synthesis.text },
    text: synthesis.text,
    routedAgents: specialistResults.map(result => result.id),
    routingReason: plan.reason,
    trace: {
      taskId,
      formulationVersion: body.formulationVersion ?? null,
      providerResponseIds: [planResult.providerResponseId, ...specialistResults.map(result => result.providerResponseId), synthesis.providerResponseId].filter(Boolean),
      skillVersion: "5.3.2",
      coreInstructionDigest: skills[roles.core.skill].digest,
      systemInstructionDigest: systemSkill.digest,
      specialistInstructionDigests: Object.fromEntries(specialistResults.map(result => [result.id, skills[roles[result.id].skill].digest])),
      note: "Se ejecutaron Skills 5.3.2 empaquetadas. La tarea y eventos se guardan en un event store JSON; las herramientas MCP no están registradas en este runtime.",
    },
  };
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (request.method === "GET" && url.pathname === "/health") return json(response, 200, { ok: true, service: "eureka-runtime-api" });
  if (!authorized(request)) return json(response, 401, { error: "Autenticación de runtime inválida." });
  if (request.method === "GET" && url.pathname === "/v1/capabilities") {
    const listed = capabilities();
    const core = listed.find(capability => capability.id === "core");
    return json(response, 200, { service: "eureka-runtime-api", runtimeVersion: "0.3.0", skillsPackage: "eureka-multiverse-5-3@5.3.2", capabilities: listed, integrations: { emFactoryMcp: "unavailable", mathematicalEngine: "unavailable" }, ...(core?.status === "unavailable" ? { reason: core.reason } : {}) });
  }
  if (request.method === "POST" && url.pathname === "/v1/tasks") {
    try {
      const body = await readJson(request);
      const taskId = typeof body.taskId === "string" && taskIdPattern.test(body.taskId) ? body.taskId : crypto.randomUUID();
      const task = await updateStore(state => {
        if (state.tasks[taskId]) return null;
        const now = new Date().toISOString();
        const created = ensureTaskState({ id: taskId, intent: typeof body.intent === "string" ? body.intent.slice(0, 12000) : "", createdAt: now, updatedAt: now, status: "intake", interactionState: "Dialogue/Explore", messages: [], events: [] });
        appendTaskEvent(created, "TaskCreated", { actor: "system", intent: created.intent });
        state.tasks[taskId] = created;
        return created;
      });
      return task ? json(response, 201, task) : json(response, 409, { error: "La tarea ya existe." });
    } catch (error) { return json(response, error.status || 400, { error: error.message }); }
  }
  const formulationProposalRoute = url.pathname.match(/^\/v1\/tasks\/([A-Za-z0-9_-]{1,128})\/formulations\/propose$/);
  if (request.method === "POST" && formulationProposalRoute) {
    try { return json(response, 201, await proposeFormulation(formulationProposalRoute[1], await readJson(request))); }
    catch (error) { return json(response, error.status || 502, { error: error.message || "No se pudo proponer la formulación." }); }
  }
  const formulationReviewRoute = url.pathname.match(/^\/v1\/tasks\/([A-Za-z0-9_-]{1,128})\/formulations\/(\d+)\/review$/);
  if (request.method === "POST" && formulationReviewRoute) {
    try { return json(response, 200, await reviewFormulation(formulationReviewRoute[1], Number(formulationReviewRoute[2]), await readJson(request))); }
    catch (error) { return json(response, error.status || 502, { error: error.message || "No se pudo registrar la revisión." }); }
  }
  const taskRoute = url.pathname.match(/^\/v1\/tasks\/([A-Za-z0-9_-]{1,128})(?:\/(events|messages))?$/);
  if (taskRoute && request.method === "GET" && (!taskRoute[2] || taskRoute[2] === "events")) {
    const task = await getTask(taskRoute[1]);
    if (!task) return json(response, 404, { error: "No se encontró la tarea." });
    ensureTaskState(task);
    if (taskRoute[2] === "events") {
      const after = Math.max(0, Number(url.searchParams.get("after") || 0));
      return json(response, 200, { taskId: task.id, events: task.events.filter(event => event.sequence > after) });
    }
    return json(response, 200, task);
  }
  if (taskRoute && request.method === "POST" && taskRoute[2] === "messages") {
    try {
      const body = await readJson(request);
      if (!await getTask(taskRoute[1])) return json(response, 404, { error: "No se encontró la tarea." });
      return json(response, 200, await invokeCore({ ...body, agent: "core", taskId: taskRoute[1] }));
    } catch (error) { return json(response, error.status || 502, { error: error.message || "Falló la ejecución del turno." }); }
  }
  if (request.method === "POST" && url.pathname === "/v1/invocations") {
    try {
      const body = await readJson(request);
      if (body.agent !== "core") return json(response, 403, { error: "La API pública del runtime acepta solicitudes para EM Core; Core controla el routing de especialistas." });
      return json(response, 200, await invokeCore(body));
    } catch (error) {
      return json(response, error.status || 502, { error: error.message || "Falló la invocación de Eureka Runtime." });
    }
  }
  return json(response, 404, { error: "Ruta de runtime no encontrada." });
});

server.listen(port, "0.0.0.0", () => console.log(`Eureka Runtime API escuchando en puerto ${port}`));
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close(() => process.exit(0)));
