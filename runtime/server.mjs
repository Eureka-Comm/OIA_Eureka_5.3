Warning: truncated output (original token count: 9927)
Total output lines: 571

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
const corePlanSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    mode: { type: "string", enum: ["direct", "delegate"] },
    reason: { type: "string", minLength: 1 },
    response: { type: "string" },
    steps: {
      type: "array",
      maxItems: specialistIds.length,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          agent: { type: "string", enum: specialistIds },
          task: { type: "string", minLength: 1 },
          dependsOn: { type: "array", items: { type: "integer", minimum: 0 } },
        },
        required: ["agent", "task", "dependsOn"],
      },
    },
  },
  required: ["mode", "reason", "response", "steps"],
};
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
  if (!providerConfigured() || !skills[roles.structurer.skill] || !systemSkill) throw Object.assign(new Error("EM Structurer requiere runtime, Skills y proveedor de inferen…6927 tokens truncated…an en un event store JSON; las herramientas MCP no están registradas en este runtime.",
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
    return json(response, 200, {
      service: "eureka-runtime-api",
      runtimeVersion: "0.3.0",
      skillsPackage: "eureka-multiverse-5-3@5.3.2",
      capabilities: listed,
      integrations: {
        emFactoryMcp: "unavailable",
        mathematicalEngine: "unavailable",
        mathematicalEngineDetails: {
          status: "pending_integration_validation",
          basis: "Hay un puerto inicial de ACFL-ELF/GCLV y la red de orden 1 en runtime/math_engine; aún no es invocable desde el runtime Eureka.",
          blockers: [
            "Falta un servicio interno y la integración de invocación desde el pipeline de Predictor/Descriptor.",
            "Faltan reglas CUT validadas para transformar oraciones en predicados ACFL; la traducción semántica no forma parte del port matemático.",
            "Falta reproducir los casos de referencia publicados y revisar la estabilidad del puerto matemático.",
            "No hay un dataset de dominio ni un modelo entrenado; ambos dependen del caso de uso.",
          ],
          references: [
            "Tesis Carlos Llorente 1 de julio.pdf, capítulo 4 y apéndice de implementación",
            "ACFL IJFS.pdf, secciones 2-4",
            "EM_ACFL_Complete_Theory_and_Applications_Compendium_v1_0.docx, secciones 10-11",
          ],
          contract: "contracts/v0.1/motor-matematico-red-acfl.md",
        },
      },
      ...(core?.status === "unavailable" ? { reason: core.reason } : {}),
    });
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

